import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientRoleEnums } from '@/auth/enums';
import { Company } from '@/companies/entities/company.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let manager: { softDelete: jest.Mock };
  let usersService: {
    getUsersPageByCompany: jest.Mock;
    getUsersByCompany: jest.Mock;
  };

  const userWithRole = (role: ClientRoleEnums, companyId: number | null = 1) =>
    ({ userId: 7, companyId, roles: [{ name: role }] }) as unknown as User;
  const admin = userWithRole(ClientRoleEnums.ADMIN);
  const superAdmin = userWithRole(ClientRoleEnums.SUPER_ADMIN, null);

  const storedCompany = (overrides: Partial<Company> = {}) =>
    ({
      companyId: 1,
      name: 'DRINK HOUSE',
      warehouses: [],
      ...overrides,
    }) as Company;

  beforeEach(async () => {
    manager = { softDelete: jest.fn().mockResolvedValue(undefined) };
    companyRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity: Partial<Company>) => entity),
      save: jest.fn((entity: Partial<Company>) => Promise.resolve(entity)),
      manager: {
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback(manager),
        ),
      },
    };
    usersService = {
      getUsersPageByCompany: jest.fn(),
      getUsersByCompany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  describe('assertCanAccess', () => {
    it('should let a user use the company they belong to', () => {
      expect(() => service.assertCanAccess(admin, 1)).not.toThrow();
    });

    it('should not let a user use another company', () => {
      expect(() => service.assertCanAccess(admin, 2)).toThrow(
        ForbiddenException,
      );
    });

    it('should let a super admin use every company', () => {
      expect(() => service.assertCanAccess(superAdmin, 2)).not.toThrow();
    });

    it('should not let a user without a company use one', () => {
      const lonely = userWithRole(ClientRoleEnums.USER, null);

      expect(() => service.assertCanAccess(lonely, 1)).toThrow(
        ForbiddenException,
      );
    });

    it('should not fail for a user without roles', () => {
      const noRoles = { userId: 7, companyId: 1 } as unknown as User;

      expect(() => service.assertCanAccess(noRoles, 1)).not.toThrow();
      expect(() => service.assertCanAccess(noRoles, 2)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return only the company of the user', () => {
      service.findAll(admin);

      expect(companyRepository.find).toHaveBeenCalledWith({
        where: { companyId: 1 },
        order: { name: 'ASC' },
      });
    });

    it('should return no company for a user without a company', () => {
      service.findAll(userWithRole(ClientRoleEnums.USER, null));

      expect(companyRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: -1 } }),
      );
    });

    it('should return every company to a super admin', () => {
      service.findAll(superAdmin);

      expect(companyRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the company with its warehouses', async () => {
      const found = storedCompany();
      companyRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne(1)).resolves.toBe(found);
      expect(companyRepository.findOne).toHaveBeenCalledWith({
        where: { companyId: 1 },
        relations: ['warehouses'],
      });
    });

    it('should throw NotFoundException when there is no such company', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });
  });

  describe('users of a company', () => {
    it('should return a page of the users', async () => {
      const query = { page: 1, limit: 10 };
      usersService.getUsersPageByCompany.mockResolvedValue({ items: [] });

      await service.findUsersPage(1, query);

      expect(usersService.getUsersPageByCompany).toHaveBeenCalledWith(1, query);
    });

    it('should return all the users of an existing company', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());
      usersService.getUsersByCompany.mockResolvedValue([{ userId: 7 }]);

      await expect(service.findUsers(1)).resolves.toEqual([{ userId: 7 }]);
    });

    it('should throw NotFoundException for the users of a company that does not exist', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.findUsers(99)).rejects.toThrow(NotFoundException);
      expect(usersService.getUsersByCompany).not.toHaveBeenCalled();
    });
  });

  describe('findFirst', () => {
    it('should return the oldest company', async () => {
      await service.findFirst();

      expect(companyRepository.findOne).toHaveBeenCalledWith({
        where: {},
        order: { companyId: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const dto = { name: 'DRINK HOUSE' } as Parameters<
      CompaniesService['create']
    >[0];

    it('should save the company', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).resolves.toEqual(dto);
      expect(companyRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when the name is taken', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Company with this name already exists'),
      );
      expect(companyRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should change the fields that were sent', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());

      const result = await service.update(1, { phone: '064123456' });

      expect(result).toEqual(
        expect.objectContaining({ name: 'DRINK HOUSE', phone: '064123456' }),
      );
    });

    it('should not save the warehouses together with the company', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());

      await service.update(1, { phone: '064123456' });

      expect(companyRepository.save).toHaveBeenCalledWith(
        expect.not.objectContaining({ warehouses: expect.anything() }),
      );
    });

    it('should throw NotFoundException when there is no such company', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.update(99, { phone: '1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when another company has the new name', async () => {
      companyRepository.findOne
        .mockResolvedValueOnce(storedCompany())
        .mockResolvedValueOnce(storedCompany({ companyId: 2, name: 'DRUGA' }));

      await expect(service.update(1, { name: 'DRUGA' })).rejects.toThrow(
        ConflictException,
      );
      expect(companyRepository.save).not.toHaveBeenCalled();
    });

    it('should not look for the name when it did not change', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());

      await service.update(1, { name: 'DRINK HOUSE' });

      // only the company itself was loaded
      expect(companyRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when there is no such company', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
      expect(companyRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should soft delete the drinks, the warehouses and the company in one transaction', async () => {
      companyRepository.findOne.mockResolvedValue(storedCompany());

      await expect(service.remove(1)).resolves.toBe(true);

      expect(manager.softDelete).toHaveBeenNthCalledWith(1, Drink, {
        companyId: 1,
      });
      expect(manager.softDelete).toHaveBeenNthCalledWith(2, Warehouse, {
        companyId: 1,
      });
      expect(manager.softDelete).toHaveBeenNthCalledWith(3, Company, {
        companyId: 1,
      });
    });
  });
});
