import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { CustomersController } from '@/customers/controllers/customers.controller';
import { CustomersService } from '@/customers/services/customers.service';
import { User } from '@/users/entities/user.entity';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: Record<
    'findAll' | 'findOptions' | 'findOne' | 'create' | 'update' | 'remove',
    jest.Mock
  >;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOptions: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: service }],
    }).compile();

    controller = module.get(CustomersController);
  });

  it('should return a page of the customers', async () => {
    const query = { page: 1, limit: 10, search: 'zurka' };

    await controller.findAll(user, query);

    expect(service.findAll).toHaveBeenCalledWith(user, query);
  });

  it('should return the id and the name of every customer for a select', async () => {
    service.findOptions.mockResolvedValue([
      { customerId: 9, name: 'PRIVATNA ZURKA' },
    ]);

    await expect(controller.findOptions(user)).resolves.toEqual([
      { customerId: 9, name: 'PRIVATNA ZURKA' },
    ]);
  });

  it('should return one customer', async () => {
    await controller.findOne(9, user);

    expect(service.findOne).toHaveBeenCalledWith(9, user);
  });

  it('should create a customer', async () => {
    const dto = { code: '28', name: 'PRIVATNA ZURKA' };

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should update a customer', async () => {
    await controller.update(9, { name: 'NOVO' }, user);

    expect(service.update).toHaveBeenCalledWith(9, { name: 'NOVO' }, user);
  });

  it('should delete a customer', async () => {
    await controller.remove(9, user);

    expect(service.remove).toHaveBeenCalledWith(9, user);
  });

  describe('who can do what', () => {
    it.each(['create', 'update', 'remove'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(CustomersController.prototype[method])).toEqual(ADMINS);
      },
    );

    it.each(['findAll', 'findOptions', 'findOne'] as const)(
      'should let every logged in user call %s',
      (method) => {
        expect(rolesOf(CustomersController.prototype[method])).toBeUndefined();
      },
    );
  });
});
