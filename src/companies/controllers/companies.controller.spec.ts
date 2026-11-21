import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from '@/companies/controllers/companies.controller';
import { CompaniesService } from '@/companies/services/companies.service';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: Record<
    | 'findAll'
    | 'findOne'
    | 'findUsersPage'
    | 'create'
    | 'update'
    | 'remove'
    | 'assertCanAccess',
    jest.Mock
  >;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findUsersPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assertCanAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: service }],
    }).compile();

    controller = module.get(CompaniesController);
  });

  const forbid = () =>
    service.assertCanAccess.mockImplementation(() => {
      throw new ForbiddenException();
    });

  it('should return the companies of the user', async () => {
    service.findAll.mockResolvedValue([{ companyId: 1 }]);

    await expect(controller.findAll(user)).resolves.toEqual([{ companyId: 1 }]);
    expect(service.findAll).toHaveBeenCalledWith(user);
  });

  describe('findOne', () => {
    it('should return the company after checking the user can use it', async () => {
      service.findOne.mockResolvedValue({ companyId: 1 });

      await expect(controller.findOne(1, user)).resolves.toEqual({
        companyId: 1,
      });
      expect(service.assertCanAccess).toHaveBeenCalledWith(user, 1);
    });

    it('should not return another company', () => {
      forbid();

      expect(() => controller.findOne(2, user)).toThrow(ForbiddenException);
      expect(service.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findUsers', () => {
    it('should return a page of the users of the company', async () => {
      const query = { page: 1, limit: 10 };

      await controller.findUsers(1, user, query);

      expect(service.assertCanAccess).toHaveBeenCalledWith(user, 1);
      expect(service.findUsersPage).toHaveBeenCalledWith(1, query);
    });

    it('should not return the users of another company', () => {
      forbid();

      expect(() =>
        controller.findUsers(2, user, { page: 1, limit: 10 }),
      ).toThrow(ForbiddenException);
      expect(service.findUsersPage).not.toHaveBeenCalled();
    });
  });

  it('should create a company', async () => {
    const dto = { name: 'NOVA' } as Parameters<
      CompaniesController['create']
    >[0];

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  describe('update', () => {
    it('should update the company after checking the user can use it', async () => {
      await controller.update(1, { phone: '064' }, user);

      expect(service.assertCanAccess).toHaveBeenCalledWith(user, 1);
      expect(service.update).toHaveBeenCalledWith(1, { phone: '064' });
    });

    it('should not update another company', () => {
      forbid();

      expect(() => controller.update(2, { phone: '064' }, user)).toThrow(
        ForbiddenException,
      );
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  it('should delete a company', async () => {
    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });

  describe('who can do what', () => {
    it.each(['create', 'remove'] as const)(
      'should let only the super admin call %s',
      (method) => {
        expect(rolesOf(CompaniesController.prototype[method])).toEqual([
          ClientRoleEnums.SUPER_ADMIN,
        ]);
      },
    );

    it.each(['update', 'findUsers'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(CompaniesController.prototype[method])).toEqual(ADMINS);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      'should let every logged in user call %s',
      (method) => {
        expect(rolesOf(CompaniesController.prototype[method])).toBeUndefined();
      },
    );
  });
});
