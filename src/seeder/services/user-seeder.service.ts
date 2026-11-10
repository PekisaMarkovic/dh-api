import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientRoleEnums } from '@/auth/enums';
import { ClientPermissionEnums } from '@/auth/enums';
import { UsersService } from '@/users/services/users.service';
import { Permission } from '@/auth/entities/permission.entity';
import { Role } from '@/auth/entities/role.entity';

@Injectable()
export class UserSeederService {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,

    @InjectRepository(Role)
    private roleRepository: Repository<Role>,

    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async checkRoles() {
    try {
      const roles = await this.roleRepository.find();

      return !!roles.length;
    } catch {
      return false;
    }
  }

  async getExistingRoles() {
    const roles = await this.roleRepository.find();
    const byName = (name: ClientRoleEnums) =>
      roles.find((r) => r.name === name);

    return {
      superAdminRole: byName(ClientRoleEnums.SUPER_ADMIN),
      adminRole: byName(ClientRoleEnums.ADMIN),
      userRole: byName(ClientRoleEnums.USER),
    };
  }

  async createSuperAdmin(
    superAdminRole: Role,
    adminRole: Role,
    userRole: Role,
  ) {
    const email = this.configService.get(
      'SUPER_ADMIN_EMAIL',
      'markovicandrija873@gmail.com',
    );

    const existing = await this.usersService.getUserByEmail(email);

    if (existing) {
      return existing;
    }

    const superAdmin = await this.usersService.createUser({
      email,
      password: this.configService.get('SUPER_ADMIN_PASSWORD', 'secret'),
      firstName: 'Super',
      lastName: 'Admin',
    });

    await this.usersService.updateUserRolesAndPermissions(superAdmin.userId, {
      roles: [superAdminRole, adminRole, userRole],
    });

    return superAdmin;
  }

  async createRolesAndPermisions() {
    const permissions = await this.createPermissions([
      ClientPermissionEnums.CRETE_USER,
      ClientPermissionEnums.READ_USER,
      ClientPermissionEnums.UPDATE_USER,
      ClientPermissionEnums.DELETE_USER,

      ClientPermissionEnums.CREATE_ANNOUNCEMENT,
      ClientPermissionEnums.UPDATE_ANNOUNCEMENT,
    ]);

    const [
      CRETE_USER,
      READ_USER,
      UPDATE_USER,
      DELETE_USER,
      CREATE_ANNOUNCEMENT,
      UPDATE_ANNOUNCEMENT,
    ] = permissions;

    const superAdminRole = await this.createRole({
      name: ClientRoleEnums.SUPER_ADMIN,
      permissions: [
        CRETE_USER,
        READ_USER,
        UPDATE_USER,
        DELETE_USER,
        CREATE_ANNOUNCEMENT,
        UPDATE_ANNOUNCEMENT,
      ],
    });

    const adminRole = await this.createRole({
      name: ClientRoleEnums.ADMIN,
      permissions: [CRETE_USER, READ_USER, UPDATE_USER, DELETE_USER],
    });

    const userRole = await this.createRole({
      name: ClientRoleEnums.USER,
      permissions: [READ_USER],
    });

    return { adminRole, userRole, superAdminRole, permissions };
  }

  private async createPermissions(
    permissionNames: ClientPermissionEnums[],
  ): Promise<Permission[]> {
    return Promise.all(
      permissionNames.map(async (name) => {
        const permission = this.permissionRepository.create({ name });

        return this.permissionRepository.save(permission);
      }),
    );
  }

  private async createRole(data: {
    name: ClientRoleEnums;
    permissions: Permission[];
  }) {
    const { name, permissions } = data;
    const role = this.roleRepository.create({ name });

    role.permissions = permissions;

    return await this.roleRepository.save(role);
  }
}
