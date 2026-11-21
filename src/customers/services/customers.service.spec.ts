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
import { Customer } from '@/customers/entities/customer.entity';
import { CustomersService } from '@/customers/services/customers.service';
import { User } from '@/users/entities/user.entity';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('CustomersService', () => {
  let service: CustomersService;
  let customerRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };
  let companiesService: { assertCanAccess: jest.Mock };

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;
  const query = { page: 1, limit: 10 };

  const storedCustomer = (overrides: Partial<Customer> = {}) =>
    ({
      customerId: 9,
      code: '28',
      name: 'PRIVATNA ZURKA',
      companyId: 1,
      ...overrides,
    }) as Customer;

  beforeEach(async () => {
    customerRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((entity: Partial<Customer>) => entity),
      save: jest.fn((entity: Partial<Customer>) => Promise.resolve(entity)),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    companiesService = { assertCanAccess: jest.fn() };
    (paginate as jest.Mock)
      .mockReset()
      .mockResolvedValue({ items: [], meta: {} });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: customerRepository },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(CustomersService);
  });

  describe('findAll', () => {
    const whereOf = () => (paginate as jest.Mock).mock.calls[0][2].where;

    it('should return the customers of the company of the user sorted by name', async () => {
      await service.findAll(user, query);

      expect(paginate).toHaveBeenCalledWith(
        customerRepository,
        query,
        expect.objectContaining({
          where: { companyId: 1 },
          order: { name: 'ASC', customerId: 'ASC' },
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

    it('should search the name and the code', async () => {
      await service.findAll(user, { ...query, search: 'zurka' });

      expect(whereOf()).toHaveLength(2);
      expect(whereOf()[0]).toHaveProperty('name');
      expect(whereOf()[1]).toHaveProperty('code');
    });
  });

  describe('findOptions', () => {
    it('should return only the id and the name of the customers of the company', async () => {
      const options = [{ customerId: 9, name: 'PRIVATNA ZURKA' }];
      customerRepository.find.mockResolvedValue(options);

      await expect(service.findOptions(user)).resolves.toBe(options);
      expect(customerRepository.find).toHaveBeenCalledWith({
        select: { customerId: true, name: true },
        where: { companyId: 1 },
        order: { name: 'ASC', customerId: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the customer', async () => {
      const found = storedCustomer();
      customerRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne(9, user)).resolves.toBe(found);
      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
    });

    it('should throw NotFoundException when there is no such customer', async () => {
      customerRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        new NotFoundException('Customer not found'),
      );
    });

    it('should not return the customer of another company', async () => {
      customerRepository.findOne.mockResolvedValue(storedCustomer());
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(9, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const dto = { code: '28', name: 'PRIVATNA ZURKA' };

    beforeEach(() => {
      customerRepository.findOne.mockResolvedValue(null);
    });

    it('should save the customer in the company of the user', async () => {
      const result = await service.create(dto, user);

      expect(customerRepository.create).toHaveBeenCalledWith({
        ...dto,
        companyId: 1,
      });
      expect(result).toEqual(
        expect.objectContaining({ code: '28', companyId: 1 }),
      );
    });

    it('should throw BadRequestException when the user is not in a company', async () => {
      await expect(
        service.create(dto, { ...user, companyId: null } as unknown as User),
      ).rejects.toThrow(BadRequestException);
      expect(customerRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when another customer has the same name, whatever the case', async () => {
      customerRepository.find.mockResolvedValue([storedCustomer()]);

      await expect(
        service.create({ ...dto, name: 'privatna zurka' }, user),
      ).rejects.toThrow(
        new ConflictException('A customer with this name already exists.'),
      );
      expect(customerRepository.save).not.toHaveBeenCalled();
    });

    it('should treat % and _ in the name as letters, not as wildcards', async () => {
      await service.create({ code: '30', name: '100%_FUN' }, user);

      const { where } = customerRepository.find.mock.calls[0][0] as {
        where: { name: { _value: string } };
      };
      expect(where.name._value).toBe('100\\%\\_FUN');
    });

    it('should throw ConflictException when the code is taken', async () => {
      customerRepository.findOne.mockResolvedValue(storedCustomer());

      await expect(service.create(dto, user)).rejects.toThrow(
        new ConflictException('A customer with this code already exists.'),
      );
      expect(customerRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    // findOne is used for the customer first and then for the check of the code
    beforeEach(() => {
      customerRepository.findOne
        .mockResolvedValueOnce(storedCustomer())
        .mockResolvedValue(null);
    });

    it('should change the fields that were sent', async () => {
      const result = await service.update(9, { name: 'NOVO IME' }, user);

      expect(result).toEqual(
        expect.objectContaining({ name: 'NOVO IME', code: '28' }),
      );
    });

    it('should not check the name when it did not change', async () => {
      await service.update(9, { name: 'PRIVATNA ZURKA' }, user);

      expect(customerRepository.find).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when another customer has the new name', async () => {
      customerRepository.find.mockResolvedValue([
        storedCustomer({ customerId: 10 }),
      ]);

      await expect(service.update(9, { name: 'DRUGI' }, user)).rejects.toThrow(
        ConflictException,
      );
      expect(customerRepository.save).not.toHaveBeenCalled();
    });

    it('should not count the customer itself as another one with the same name', async () => {
      // only the case of the letters changes
      customerRepository.find.mockResolvedValue([
        storedCustomer({ customerId: 9 }),
      ]);

      await expect(
        service.update(9, { name: 'Privatna Zurka' }, user),
      ).resolves.toBeDefined();
    });

    it('should throw ConflictException when another customer has the new code', async () => {
      customerRepository.findOne.mockReset();
      customerRepository.findOne
        .mockResolvedValueOnce(storedCustomer())
        .mockResolvedValueOnce(storedCustomer({ customerId: 10, code: '30' }));

      await expect(service.update(9, { code: '30' }, user)).rejects.toThrow(
        new ConflictException('A customer with this code already exists.'),
      );
    });

    it('should not change the customer of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.update(9, { name: 'X' }, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(customerRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete the customer', async () => {
      customerRepository.findOne.mockResolvedValue(storedCustomer());

      await expect(service.remove(9, user)).resolves.toBe(true);
      expect(customerRepository.softDelete).toHaveBeenCalledWith({
        customerId: 9,
      });
    });

    it('should throw NotFoundException when there is no such customer', async () => {
      customerRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
      expect(customerRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
