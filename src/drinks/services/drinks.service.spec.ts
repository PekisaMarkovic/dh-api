import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { CompaniesService } from '@/companies/services/companies.service';
import { DrinkStockLevel } from '@/drinks/dto/find-drinks.dto';
import { Drink } from '@/drinks/entities/drink.entity';
import { DrinksService } from '@/drinks/services/drinks.service';
import { User } from '@/users/entities/user.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('DrinksService', () => {
  let service: DrinksService;
  let drinkRepository: {
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };
  let warehousesService: { findOne: jest.Mock };
  let companiesService: { assertCanAccess: jest.Mock };

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;
  const query = { page: 1, limit: 10 };

  const storedDrink = (overrides: Partial<Drink> = {}) =>
    ({
      drinkId: 3,
      code: '352',
      name: 'FANTA 1.5L',
      companyId: 1,
      warehouseId: 5,
      warningQuantity: 12,
      criticalQuantity: 5,
      ...overrides,
    }) as Drink;

  const dto = {
    code: '352',
    name: 'FANTA 1.5L',
    price: 153,
    quantity: 24,
    warehouseId: 5,
  };

  beforeEach(async () => {
    drinkRepository = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((entity: Partial<Drink>) => entity),
      save: jest.fn((entity: Partial<Drink>) => Promise.resolve(entity)),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    warehousesService = {
      findOne: jest.fn().mockResolvedValue({ warehouseId: 5, companyId: 1 }),
    };
    companiesService = { assertCanAccess: jest.fn() };
    (paginate as jest.Mock)
      .mockReset()
      .mockResolvedValue({ items: [], meta: {} });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrinksService,
        { provide: getRepositoryToken(Drink), useValue: drinkRepository },
        { provide: WarehousesService, useValue: warehousesService },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(DrinksService);
  });

  describe('findAll', () => {
    const whereOf = () => (paginate as jest.Mock).mock.calls[0][2].where;

    it('should return the drinks of the company of the user sorted by name', async () => {
      await service.findAll(user, query);

      expect(paginate).toHaveBeenCalledWith(
        drinkRepository,
        query,
        expect.objectContaining({
          where: { companyId: 1 },
          order: { name: 'ASC', drinkId: 'ASC' },
        }),
      );
    });

    it('should find nothing for a user without a company', async () => {
      await service.findAll(
        { ...user, companyId: null } as unknown as User,
        query,
      );

      expect(whereOf()).toEqual({ companyId: -1 });
    });

    it("should only return the drinks of one warehouse after checking it is the user's", async () => {
      await service.findAll(user, { ...query, warehouseId: 5 });

      expect(warehousesService.findOne).toHaveBeenCalledWith(5, user);
      expect(whereOf()).toEqual({ warehouseId: 5 });
    });

    it('should not return the drinks of a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.findAll(user, { ...query, warehouseId: 9 }),
      ).rejects.toThrow(ForbiddenException);
      expect(paginate).not.toHaveBeenCalled();
    });

    it('should search the name and the code', async () => {
      await service.findAll(user, { ...query, search: 'fanta' });

      expect(whereOf()).toHaveLength(2);
      expect(whereOf()[0]).toHaveProperty('name');
      expect(whereOf()[1]).toHaveProperty('code');
    });

    it('should filter the critical drinks', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.CRITICAL,
      });

      expect(whereOf()).toEqual({ companyId: 1, quantity: expect.anything() });
    });

    it('should filter the drinks with a warning', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.WARNING,
      });

      expect(whereOf()).toEqual({ companyId: 1, quantity: expect.anything() });
    });

    it('should write the SQL of the critical level: below zero, or below the critical quantity when it is on', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.CRITICAL,
      });

      const sql = whereOf().quantity.getSql('"quantity"') as string;
      expect(sql).toContain('"quantity" < 0');
      expect(sql).toContain('"critical_quantity" > 0');
    });

    it('should write the SQL of the warning level so a critical drink is not in it', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.WARNING,
      });

      const sql = whereOf().quantity.getSql('"quantity"') as string;
      expect(sql).toContain('"quantity" >= 0');
      expect(sql).toContain('"warning_quantity" > 0');
      expect(sql).toContain(
        '"critical_quantity" = 0 OR "quantity" >= "critical_quantity"',
      );
    });
  });

  describe('findOne', () => {
    it('should return the drink', async () => {
      const found = storedDrink();
      drinkRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne(3, user)).resolves.toBe(found);
      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
    });

    it('should throw NotFoundException when there is no such drink', async () => {
      drinkRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        new NotFoundException('Drink not found'),
      );
    });

    it('should not check the company when it is called without a user', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      await service.findOne(3);

      expect(companiesService.assertCanAccess).not.toHaveBeenCalled();
    });

    it('should not return the drink of another company', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(3, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should save the drink in the company of its warehouse', async () => {
      const result = await service.create(dto, user);

      expect(warehousesService.findOne).toHaveBeenCalledWith(5, user);
      expect(drinkRepository.create).toHaveBeenCalledWith({
        ...dto,
        companyId: 1,
      });
      expect(result).toEqual(
        expect.objectContaining({ code: '352', companyId: 1 }),
      );
    });

    it('should not add a drink to a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.create(dto, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the article code is taken in the company', async () => {
      drinkRepository.exists.mockResolvedValue(true);

      await expect(service.create(dto, user)).rejects.toThrow(
        new ConflictException('A drink with this article code already exists.'),
      );
      expect(drinkRepository.exists).toHaveBeenCalledWith({
        where: { code: '352', companyId: 1 },
      });
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the critical level is not below the warning level', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 5, criticalQuantity: 5 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(
          { ...dto, warningQuantity: 5, criticalQuantity: 8 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should accept a critical level below the warning level', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 12, criticalQuantity: 5 },
          user,
        ),
      ).resolves.toBeDefined();
    });

    it('should accept a level that is off (0)', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 0, criticalQuantity: 0 },
          user,
        ),
      ).resolves.toBeDefined();
      await expect(
        service.create(
          { ...dto, warningQuantity: 12, criticalQuantity: 0 },
          user,
        ),
      ).resolves.toBeDefined();
    });

    it('should not accept only a critical level, because the warning level is then 0 (off)', async () => {
      await expect(
        service.create({ ...dto, criticalQuantity: 5 }, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());
    });

    it('should change the fields that were sent', async () => {
      const result = await service.update(
        3,
        { name: 'FANTA 2L', price: 200 },
        user,
      );

      expect(result).toEqual(
        expect.objectContaining({ name: 'FANTA 2L', price: 200, code: '352' }),
      );
    });

    it('should not check the code when it did not change', async () => {
      await service.update(3, { code: '352' }, user);

      expect(drinkRepository.exists).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the new code is taken', async () => {
      drinkRepository.exists.mockResolvedValue(true);

      await expect(service.update(3, { code: '400' }, user)).rejects.toThrow(
        ConflictException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should check the levels together with the ones the drink already has', async () => {
      // the drink has the warning level 12, a critical level of 12 is not below it
      await expect(
        service.update(3, { criticalQuantity: 12 }, user),
      ).rejects.toThrow(BadRequestException);
      // the drink has the critical level 5, a warning level of 5 is not above it
      await expect(
        service.update(3, { warningQuantity: 5 }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not change the drink of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.update(3, { name: 'X' }, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete the drink', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      await expect(service.remove(3, user)).resolves.toBe(true);
      expect(drinkRepository.softDelete).toHaveBeenCalledWith({ drinkId: 3 });
    });

    it('should throw NotFoundException when there is no such drink', async () => {
      drinkRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
      expect(drinkRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
