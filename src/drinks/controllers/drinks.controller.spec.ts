import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { DrinksController } from '@/drinks/controllers/drinks.controller';
import { DrinksService } from '@/drinks/services/drinks.service';
import { User } from '@/users/entities/user.entity';

describe('DrinksController', () => {
  let controller: DrinksController;
  let service: Record<
    'findAll' | 'findOne' | 'create' | 'update' | 'remove',
    jest.Mock
  >;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrinksController],
      providers: [{ provide: DrinksService, useValue: service }],
    }).compile();

    controller = module.get(DrinksController);
  });

  it('should return a page of the drinks', async () => {
    const query = { page: 1, limit: 10, warehouseId: 5 };
    service.findAll.mockResolvedValue({ items: [] });

    await expect(controller.findAll(user, query)).resolves.toEqual({
      items: [],
    });
    expect(service.findAll).toHaveBeenCalledWith(user, query);
  });

  it('should return one drink', async () => {
    await controller.findOne(3, user);

    expect(service.findOne).toHaveBeenCalledWith(3, user);
  });

  it('should create a drink', async () => {
    const dto = {
      code: '352',
      name: 'FANTA',
      price: 153,
      quantity: 24,
      warehouseId: 5,
    };

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should update a drink', async () => {
    await controller.update(3, { quantity: 10 }, user);

    expect(service.update).toHaveBeenCalledWith(3, { quantity: 10 }, user);
  });

  it('should delete a drink', async () => {
    await controller.remove(3, user);

    expect(service.remove).toHaveBeenCalledWith(3, user);
  });

  describe('who can do what', () => {
    it.each(['create', 'update', 'remove'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(DrinksController.prototype[method])).toEqual(ADMINS);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      'should let every logged in user call %s',
      (method) => {
        expect(rolesOf(DrinksController.prototype[method])).toBeUndefined();
      },
    );
  });
});
