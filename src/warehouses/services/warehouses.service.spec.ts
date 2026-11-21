import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompaniesService } from '@/companies/services/companies.service';
import { User } from '@/users/entities/user.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let warehouseRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    manager: {
      transaction: jest.Mock;
      count: jest.Mock;
      createQueryBuilder: jest.Mock;
    };
  };
  // the repository of the warehouses inside a transaction
  let transactionRepository: {
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let companiesService: { assertCanAccess: jest.Mock; findOne: jest.Mock };

  const user = { userId: 1, companyId: 1, roles: [] } as unknown as User;

  const warehouse = (overrides: Partial<Warehouse> = {}) =>
    ({
      warehouseId: 1,
      name: 'Magacin 1',
      companyId: 1,
      isDefault: false,
      drinks: [],
      ...overrides,
    }) as Warehouse;

  beforeEach(async () => {
    transactionRepository = {
      exists: jest.fn(),
      create: jest.fn((entity: Partial<Warehouse>) => entity),
      save: jest.fn((entity: Partial<Warehouse>) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const transactionManager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    };
    warehouseRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback(transactionManager),
        ),
        count: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    };
    companiesService = {
      assertCanAccess: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ companyId: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: getRepositoryToken(Warehouse),
          useValue: warehouseRepository,
        },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(WarehousesService);
  });

  describe('findAll', () => {
    it('should return an empty list when the company has no warehouses', async () => {
      warehouseRepository.find.mockResolvedValue([]);

      await expect(service.findAll(user)).resolves.toEqual([]);
      expect(
        warehouseRepository.manager.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('should ask for the warehouses of the company of the user, the default one first', async () => {
      warehouseRepository.find.mockResolvedValue([]);

      await service.findAll(user);

      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
      expect(warehouseRepository.find).toHaveBeenCalledWith({
        where: { companyId: 1 },
        order: { isDefault: 'DESC', name: 'ASC', warehouseId: 'ASC' },
      });
    });

    it('should not return the warehouses of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findAll(user, 2)).rejects.toThrow(
        ForbiddenException,
      );
      expect(warehouseRepository.find).not.toHaveBeenCalled();
    });

    it('should add the number of the drinks and the value of the stock to every warehouse', async () => {
      warehouseRepository.find.mockResolvedValue([
        warehouse({ warehouseId: 1 }),
        warehouse({ warehouseId: 2, name: 'Magacin 2' }),
      ]);
      const builder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { warehouseId: 1, drinksCount: '4', totalValueCents: '150000' },
          ]),
      };
      warehouseRepository.manager.createQueryBuilder.mockReturnValue(builder);

      const result = await service.findAll(user);

      expect(result).toEqual([
        expect.objectContaining({
          warehouseId: 1,
          drinksCount: 4,
          totalValueCents: 150000,
        }),
        // a warehouse without drinks has no row in the statistics
        expect.objectContaining({
          warehouseId: 2,
          drinksCount: 0,
          totalValueCents: 0,
        }),
      ]);
    });
  });

  describe('findOne', () => {
    it('should return the warehouse', async () => {
      const found = warehouse();
      warehouseRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne(1, user)).resolves.toBe(found);
      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
    });

    it('should throw NotFoundException when there is no such warehouse', async () => {
      warehouseRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should check that the user can use the company and that it exists', async () => {
      transactionRepository.exists.mockResolvedValue(true);

      await service.create({ name: 'Magacin 2', companyId: 1 }, user);

      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
      expect(companiesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should not create a warehouse in a company the user can not use', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.create({ name: 'Magacin 2', companyId: 2 }, user),
      ).rejects.toThrow(ForbiddenException);
      expect(warehouseRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should make the first warehouse of a company the default one', async () => {
      transactionRepository.exists.mockResolvedValue(false);

      const created = await service.create(
        { name: 'Magacin 1', companyId: 1 },
        user,
      );

      expect(created.isDefault).toBe(true);
    });

    it('should not make another warehouse the default one when it is not asked', async () => {
      transactionRepository.exists.mockResolvedValue(true);

      const created = await service.create(
        { name: 'Magacin 2', companyId: 1 },
        user,
      );

      expect(created.isDefault).toBe(false);
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should take the default from the old one when the new warehouse is asked to be the default', async () => {
      transactionRepository.exists.mockResolvedValue(true);

      const created = await service.create(
        { name: 'Magacin 2', companyId: 1, isDefault: true },
        user,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(
        { companyId: 1, isDefault: true },
        { isDefault: false },
      );
      expect(created.isDefault).toBe(true);
    });
  });

  describe('update', () => {
    it('should rename the warehouse without touching the default', async () => {
      warehouseRepository.findOne.mockResolvedValue(
        warehouse({ isDefault: true }),
      );

      const updated = await service.update(1, { name: 'Novi naziv' }, user);

      expect(updated).toEqual(
        expect.objectContaining({ name: 'Novi naziv', isDefault: true }),
      );
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should make the warehouse the default one and take it from the old one', async () => {
      warehouseRepository.findOne.mockResolvedValue(
        warehouse({ isDefault: false }),
      );

      const updated = await service.update(1, { isDefault: true }, user);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        { companyId: 1, isDefault: true },
        { isDefault: false },
      );
      expect(updated.isDefault).toBe(true);
    });

    it('should not take the default from the warehouse, another one has to become the default', async () => {
      warehouseRepository.findOne.mockResolvedValue(
        warehouse({ isDefault: true }),
      );

      const updated = await service.update(1, { isDefault: false }, user);

      expect(updated.isDefault).toBe(true);
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should not save the drinks of the warehouse', async () => {
      warehouseRepository.findOne.mockResolvedValue(warehouse());

      await service.update(1, { name: 'Novi naziv' }, user);

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.not.objectContaining({ drinks: expect.anything() }),
      );
    });
  });

  describe('remove', () => {
    it('should throw ConflictException when the warehouse still has drinks', async () => {
      warehouseRepository.findOne.mockResolvedValue(warehouse());
      warehouseRepository.manager.count.mockResolvedValue(3);

      await expect(service.remove(1, user)).rejects.toThrow(ConflictException);
      expect(warehouseRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should delete an empty warehouse that is not the default one', async () => {
      warehouseRepository.findOne.mockResolvedValue(
        warehouse({ isDefault: false }),
      );
      warehouseRepository.manager.count.mockResolvedValue(0);

      await expect(service.remove(1, user)).resolves.toBe(true);

      expect(warehouseRepository.softDelete).toHaveBeenCalledWith({
        warehouseId: 1,
      });
      expect(warehouseRepository.update).not.toHaveBeenCalled();
    });

    it('should make the first remaining warehouse the default one when the default one is deleted', async () => {
      warehouseRepository.findOne
        .mockResolvedValueOnce(warehouse({ warehouseId: 1, isDefault: true }))
        .mockResolvedValueOnce(
          warehouse({ warehouseId: 2, name: 'Magacin 2' }),
        );
      warehouseRepository.manager.count.mockResolvedValue(0);

      await service.remove(1, user);

      expect(warehouseRepository.findOne).toHaveBeenLastCalledWith({
        where: { companyId: 1 },
        order: { warehouseId: 'ASC' },
      });
      expect(warehouseRepository.update).toHaveBeenCalledWith(2, {
        isDefault: true,
      });
    });

    it('should delete the last warehouse of the company without a new default', async () => {
      warehouseRepository.findOne
        .mockResolvedValueOnce(warehouse({ isDefault: true }))
        .mockResolvedValueOnce(null);
      warehouseRepository.manager.count.mockResolvedValue(0);

      await expect(service.remove(1, user)).resolves.toBe(true);

      expect(warehouseRepository.update).not.toHaveBeenCalled();
    });
  });
});
