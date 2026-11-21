import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { paginate } from 'nestjs-typeorm-paginate';
import { Role } from '@/auth/entities/role.entity';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let roleRepository: { findOne: jest.Mock };
  // every method of the query builder returns the builder, like the real one
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    builder = {};
    for (const method of [
      'where',
      'andWhere',
      'leftJoinAndSelect',
      'addSelect',
      'orderBy',
      'addOrderBy',
      'update',
      'set',
    ]) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.getMany = jest.fn();
    builder.getOne = jest.fn();
    builder.execute = jest.fn().mockResolvedValue(undefined);

    userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
      findOne: jest.fn(),
      create: jest.fn((entity: Partial<User>) => entity),
      save: jest.fn((entity: Partial<User>) =>
        Promise.resolve({ userId: 1, ...entity }),
      ),
    };
    roleRepository = { findOne: jest.fn() };
    (paginate as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Role), useValue: roleRepository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getUsers', () => {
    it('should return all the users with their roles and permissions', async () => {
      const users = [{ userId: 1 }];
      builder.getMany.mockResolvedValue(users);

      await expect(service.getUsers()).resolves.toBe(users);
      expect(builder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.roles',
        'role',
      );
      expect(builder.leftJoinAndSelect).toHaveBeenCalledWith(
        'role.permissions',
        'rolePermission',
      );
      expect(builder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.permissions',
        'permission',
      );
    });
  });

  describe('getUserByUserId', () => {
    it('should return the user', async () => {
      const user = { userId: 1 };
      builder.getOne.mockResolvedValue(user);

      await expect(service.getUserByUserId(1)).resolves.toBe(user);
      expect(builder.where).toHaveBeenCalledWith('user.userId = :userId', {
        userId: 1,
      });
    });

    it('should throw NotFoundException when there is no such user', async () => {
      builder.getOne.mockResolvedValue(null);

      await expect(service.getUserByUserId(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return the user with the email', async () => {
      const user = { userId: 1 };
      builder.getOne.mockResolvedValue(user);

      await expect(service.getUserByEmail('ana@drinkhouse.rs')).resolves.toBe(
        user,
      );
      expect(builder.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'ana@drinkhouse.rs',
      });
    });

    it('should return null when there is no such user', async () => {
      builder.getOne.mockResolvedValue(null);

      await expect(
        service.getUserByEmail('nema@drinkhouse.rs'),
      ).resolves.toBeNull();
    });

    it('should not select the password', async () => {
      builder.getOne.mockResolvedValue(null);

      await service.getUserByEmail('ana@drinkhouse.rs');

      expect(builder.addSelect).not.toHaveBeenCalled();
    });
  });

  describe('getUserByEmailForLogIn', () => {
    it('should also select the password, which is hidden otherwise', async () => {
      const user = { userId: 1, password: 'hash' };
      builder.getOne.mockResolvedValue(user);

      await expect(
        service.getUserByEmailForLogIn('ana@drinkhouse.rs'),
      ).resolves.toBe(user);
      expect(builder.addSelect).toHaveBeenCalledWith('user.password');
    });
  });

  describe('updateUserRolesAndPermissions', () => {
    it('should throw NotFoundException when there is no such user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserRolesAndPermissions(99, {} as never),
      ).rejects.toThrow(NotFoundException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should replace the roles and the permissions that were sent', async () => {
      userRepository.findOne.mockResolvedValue({
        userId: 1,
        roles: ['old'],
        permissions: ['old'],
      });

      const result = await service.updateUserRolesAndPermissions(1, {
        roles: ['new'],
        permissions: ['new'],
      } as never);

      expect(result).toEqual(
        expect.objectContaining({ roles: ['new'], permissions: ['new'] }),
      );
    });

    it('should keep what was not sent', async () => {
      userRepository.findOne.mockResolvedValue({
        userId: 1,
        roles: ['old'],
        permissions: ['old'],
      });

      const result = await service.updateUserRolesAndPermissions(1, {
        roles: ['new'],
      } as never);

      expect(result).toEqual(
        expect.objectContaining({ roles: ['new'], permissions: ['old'] }),
      );
    });
  });

  describe('patchUserProfile', () => {
    const stored = () => ({
      userId: 1,
      email: 'ana@drinkhouse.rs',
      language: 'sr',
      phoneNumber: '1',
      dateOfBirth: null,
    });

    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(stored());
      builder.getOne.mockResolvedValue({ userId: 1, fresh: true });
    });

    it('should throw NotFoundException when there is no such user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.patchUserProfile('nema@drinkhouse.rs', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should change the fields that were sent and leave the rest', async () => {
      await service.patchUserProfile('ana@drinkhouse.rs', {
        language: 'en' as never,
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en', phoneNumber: '1' }),
      );
    });

    it('should be able to clear the phone number', async () => {
      await service.patchUserProfile('ana@drinkhouse.rs', { phoneNumber: '' });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: '' }),
      );
    });

    it('should turn the date of birth into a date, or clear it', async () => {
      await service.patchUserProfile('ana@drinkhouse.rs', {
        dateOfBirth: '1990-05-17',
      });
      expect(userRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateOfBirth: new Date('1990-05-17') }),
      );

      userRepository.findOne.mockResolvedValue(stored());
      await service.patchUserProfile('ana@drinkhouse.rs', { dateOfBirth: '' });
      expect(userRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateOfBirth: null }),
      );
    });

    it('should throw ConflictException when the phone number is used by someone else', async () => {
      userRepository.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.patchUserProfile('ana@drinkhouse.rs', { phoneNumber: '064' }),
      ).rejects.toThrow(new ConflictException('Phone number is already used'));
    });

    it('should throw any other error of the database as it is', async () => {
      const error = new Error('connection lost');
      userRepository.save.mockRejectedValue(error);

      await expect(
        service.patchUserProfile('ana@drinkhouse.rs', {}),
      ).rejects.toBe(error);
    });

    it('should return the user as it is in the database now', async () => {
      await expect(
        service.patchUserProfile('ana@drinkhouse.rs', {}),
      ).resolves.toEqual({
        userId: 1,
        fresh: true,
      });
    });
  });

  describe('createUser', () => {
    const dto = {
      email: 'ana@drinkhouse.rs',
      password: 'tajna123',
      firstName: 'Ana',
      lastName: 'Anic',
      phone: '064123456',
    };

    it('should save a user with a hashed password, never the password itself', async () => {
      await service.createUser(dto);

      const created = userRepository.create.mock.calls[0][0] as {
        password: string;
      };
      expect(created.password).not.toBe('tajna123');
      await expect(bcrypt.compare('tajna123', created.password)).resolves.toBe(
        true,
      );
    });

    it('should not return the password', async () => {
      const result = await service.createUser(dto);

      expect(result).not.toHaveProperty('password');
    });

    it('should save the name, the email and the phone number', async () => {
      await service.createUser(dto);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@drinkhouse.rs',
          firstName: 'Ana',
          lastName: 'Anic',
          phoneNumber: '064123456',
          companyId: null,
        }),
      );
    });

    it('should save a user without a password', async () => {
      await service.createUser({ ...dto, password: null as unknown as string });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: null }),
      );
    });

    it('should put the user in the company', async () => {
      await service.createUser(dto, { companyId: 3 } as never);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 3 }),
      );
    });

    it('should give the user the roles that were asked for', async () => {
      const userRole = { name: ClientRoleEnums.USER };
      roleRepository.findOne.mockResolvedValue(userRole);

      const result = await service.createUser(dto, {
        roles: [ClientRoleEnums.USER],
      } as never);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: ClientRoleEnums.USER },
      });
      expect(result.roles).toEqual([userRole]);
    });

    it('should not touch the roles when none are asked for', async () => {
      await service.createUser(dto);

      expect(roleRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('createInvitedUser', () => {
    it('should create a user with the role user in the company of the invitation', async () => {
      roleRepository.findOne.mockResolvedValue({ name: ClientRoleEnums.USER });

      const result = await service.createInvitedUser(
        'novi@drinkhouse.rs',
        { firstName: 'Novi', lastName: 'Radnik', password: 'tajna123' },
        1,
      );

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'novi@drinkhouse.rs', companyId: 1 }),
      );
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: ClientRoleEnums.USER },
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('getUsersByCompany', () => {
    it('should return the users of the company sorted by first name', async () => {
      const users = [{ userId: 1 }];
      builder.getMany.mockResolvedValue(users);

      await expect(service.getUsersByCompany(1)).resolves.toBe(users);
      expect(builder.where).toHaveBeenCalledWith(
        'user.companyId = :companyId',
        { companyId: 1 },
      );
      expect(builder.orderBy).toHaveBeenCalledWith('user.firstName', 'ASC');
    });
  });

  describe('getUsersPageByCompany', () => {
    const query = { page: 1, limit: 10 };

    it('should return a page of the users of the company', async () => {
      const page = { items: [], meta: {} };
      (paginate as jest.Mock).mockResolvedValue(page);

      await expect(service.getUsersPageByCompany(1, query)).resolves.toBe(page);
      expect(paginate).toHaveBeenCalledWith(builder, query);
      expect(builder.andWhere).not.toHaveBeenCalled();
    });

    it('should search the name, the last name, the email and the full name', async () => {
      await service.getUsersPageByCompany(1, { ...query, search: 'ana' });

      expect(builder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('user.email ILIKE :pattern'),
        { pattern: '%ana%' },
      );
      expect(builder.andWhere.mock.calls[0][0]).toContain(
        'CONCAT(user.firstName',
      );
    });
  });

  describe('assignCompanyToUsersWithout', () => {
    it('should put every user without a company in the company', async () => {
      await service.assignCompanyToUsersWithout(1);

      expect(builder.update).toHaveBeenCalledWith(User);
      expect(builder.set).toHaveBeenCalledWith({ companyId: 1 });
      expect(builder.where).toHaveBeenCalledWith('company_id IS NULL');
      expect(builder.execute).toHaveBeenCalled();
    });
  });
});
