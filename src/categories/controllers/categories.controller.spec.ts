import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '@/categories/controllers/categories.controller';
import { CategoriesService } from '@/categories/services/categories.service';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { User } from '@/users/entities/user.entity';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: Record<'findAll' | 'create' | 'update' | 'remove', jest.Mock>;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();

    controller = module.get(CategoriesController);
  });

  it('should return the categories of the company of the user', async () => {
    await controller.findAll(user);

    expect(service.findAll).toHaveBeenCalledWith(user, undefined);
  });

  it('should return the categories of the company in the query', async () => {
    await controller.findAll(user, '2');

    expect(service.findAll).toHaveBeenCalledWith(user, 2);
  });

  it('should throw BadRequestException when the company is not a number', () => {
    expect(() => controller.findAll(user, 'abc')).toThrow(BadRequestException);
  });

  it('should let every logged in user read the categories', () => {
    expect(rolesOf(CategoriesController.prototype.findAll)).toBeUndefined();
  });

  it('should let only the admins change the categories', () => {
    for (const handler of [
      CategoriesController.prototype.create,
      CategoriesController.prototype.update,
      CategoriesController.prototype.remove,
    ]) {
      expect(rolesOf(handler)).toEqual(ADMINS);
    }
  });
});
