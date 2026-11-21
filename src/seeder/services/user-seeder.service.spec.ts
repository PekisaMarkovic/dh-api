import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Permission } from '@/auth/entities/permission.entity';
import { Role } from '@/auth/entities/role.entity';
import { ClientPermissionEnums, ClientRoleEnums } from '@/auth/enums';
import { UserSeederService } from '@/seeder/services/user-seeder.service';
import { UsersService } from '@/users/services/users.service';

describe('UserSeederService', () => {
  let service: UserSeederService;
  let usersService: {
    getUserByEmail: jest.Mock;
    createUser: jest.Mock;
    updateUserRolesAndPermissions: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let roleRepository: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let permissionRepository: { create: jest.Mock; save: jest.Mock };

  const roles = {
    superAdminRole: { name: ClientRoleEnums.SUPER_ADMIN },
    adminRole: { name: ClientRoleEnums.ADMIN },
    userRole: { name: ClientRoleEnums.USER },
  } as unknown as Record<'superAdminRole' | 'adminRole' | 'userRole', Role>;

  beforeEach(async () => {
    usersService = {
      getUserByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue({ userId: 1 }),
      updateUserRolesAndPermissions: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'SUPER_ADMIN_EMAIL' ? 'admin@drinkhouse.rs' : 'tajna123',
      ),
    };
    roleRepository = {
      find: jest.fn(),
      create: jest.fn((entity: Partial<Role>) => entity),
      save: jest.fn((entity: Partial<Role>) => Promise.resolve(entity)),
    };
    permissionRepository = {
      create: jest.fn((entity: Partial<Permission>) => entity),
      save: jest.fn((entity: Partial<Permission>) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSeederService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Role), useValue: roleRepository },
        {
          provide: getRepositoryToken(Permission),
          useValue: permissionRepository,
        },
      ],
    }).compile();

    service = module.get(UserSeederService);
  });

  describe('checkRoles', () => {
    it('should be true when there are roles', async () => {
      roleRepository.find.mockResolvedValue([{ name: 'user' }]);

      await expect(service.checkRoles()).resolves.toBe(true);
    });

    it('should be false when there are no roles', async () => {
      roleRepository.find.mockResolvedValue([]);

      await expect(service.checkRoles()).resolves.toBe(false);
    });

    it('should be false when the table does not exist yet', async () => {
      roleRepository.find.mockRejectedValue(
        new Error('relation "roles" does not exist'),
      );

      await expect(service.checkRoles()).resolves.toBe(false);
    });
  });

  describe('getExistingRoles', () => {
    it('should find every role by its name', async () => {
      roleRepository.find.mockResolvedValue([
        roles.userRole,
        roles.superAdminRole,
        roles.adminRole,
      ]);

      await expect(service.getExistingRoles()).resolves.toEqual(roles);
    });

    it('should return undefined for a role that is missing', async () => {
      roleRepository.find.mockResolvedValue([roles.userRole]);

      const result = await service.getExistingRoles();

      expect(result.adminRole).toBeUndefined();
    });
  });

  describe('createSuperAdmin', () => {
    it('should create the super admin with the email and the password of the environment', async () => {
      await service.createSuperAdmin(
        roles.superAdminRole,
        roles.adminRole,
        roles.userRole,
      );

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(
        'admin@drinkhouse.rs',
      );
      expect(usersService.createUser).toHaveBeenCalledWith({
        email: 'admin@drinkhouse.rs',
        password: 'tajna123',
        firstName: 'Super',
        lastName: 'Admin',
      });
    });

    it('should give the super admin all three roles', async () => {
      await service.createSuperAdmin(
        roles.superAdminRole,
        roles.adminRole,
        roles.userRole,
      );

      expect(usersService.updateUserRolesAndPermissions).toHaveBeenCalledWith(
        1,
        {
          roles: [roles.superAdminRole, roles.adminRole, roles.userRole],
        },
      );
    });

    it('should not create the super admin twice', async () => {
      const existing = { userId: 9 };
      usersService.getUserByEmail.mockResolvedValue(existing);

      await expect(
        service.createSuperAdmin(
          roles.superAdminRole,
          roles.adminRole,
          roles.userRole,
        ),
      ).resolves.toBe(existing);
      expect(usersService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('createRolesAndPermisions', () => {
    it('should create the permissions and the three roles', async () => {
      const result = await service.createRolesAndPermisions();

      expect(result.permissions).toHaveLength(6);
      expect(result.superAdminRole.name).toBe(ClientRoleEnums.SUPER_ADMIN);
      expect(result.adminRole.name).toBe(ClientRoleEnums.ADMIN);
      expect(result.userRole.name).toBe(ClientRoleEnums.USER);
    });

    it('should give the super admin every permission, the admin the permissions of the users and the user only reading', async () => {
      const { superAdminRole, adminRole, userRole } =
        await service.createRolesAndPermisions();
      const names = (role: Role) =>
        role.permissions.map((permission) => permission.name);

      expect(names(superAdminRole)).toHaveLength(6);
      expect(names(superAdminRole)).toContain(
        ClientPermissionEnums.CREATE_ANNOUNCEMENT,
      );
      expect(names(adminRole)).toEqual([
        ClientPermissionEnums.CRETE_USER,
        ClientPermissionEnums.READ_USER,
        ClientPermissionEnums.UPDATE_USER,
        ClientPermissionEnums.DELETE_USER,
      ]);
      expect(names(userRole)).toEqual([ClientPermissionEnums.READ_USER]);
    });
  });
});
