import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { User } from '@/users/entities/user.entity';
import { WarehousesController } from '@/warehouses/controllers/warehouses.controller';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

describe('WarehousesController', () => {
  let controller: WarehousesController;
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
      controllers: [WarehousesController],
      providers: [{ provide: WarehousesService, useValue: service }],
    }).compile();

    controller = module.get(WarehousesController);
  });

  describe('findAll', () => {
    it('should return the warehouses of the user', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll(user);

      expect(service.findAll).toHaveBeenCalledWith(user, undefined);
    });

    it('should return the warehouses of the company in the query', async () => {
      await controller.findAll(user, '2');

      expect(service.findAll).toHaveBeenCalledWith(user, 2);
    });

    it('should throw BadRequestException when the company is not a number', () => {
      expect(() => controller.findAll(user, 'abc')).toThrow(
        BadRequestException,
      );
    });
  });

  it('should return one warehouse', async () => {
    service.findOne.mockResolvedValue({ warehouseId: 5 });

    await expect(controller.findOne(5, user)).resolves.toEqual({
      warehouseId: 5,
    });
    expect(service.findOne).toHaveBeenCalledWith(5, user);
  });

  it('should create a warehouse', async () => {
    const dto = { name: 'Magacin 2', companyId: 1 };

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should update a warehouse', async () => {
    await controller.update(5, { isDefault: true }, user);

    expect(service.update).toHaveBeenCalledWith(5, { isDefault: true }, user);
  });

  it('should delete a warehouse', async () => {
    await controller.remove(5, user);

    expect(service.remove).toHaveBeenCalledWith(5, user);
  });

  describe('who can do what', () => {
    it.each(['create', 'update', 'remove'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(WarehousesController.prototype[method])).toEqual(ADMINS);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      'should let every logged in user call %s',
      (method) => {
        expect(rolesOf(WarehousesController.prototype[method])).toBeUndefined();
      },
    );
  });
});
