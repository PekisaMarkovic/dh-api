import { Injectable, OnModuleInit } from '@nestjs/common';
import { UserSeederService } from '@/seeder/services/user-seeder.service';
import { CompanySeederService } from '@/seeder/services/company-seeder.service';

@Injectable()
export class AppSeederService implements OnModuleInit {
  constructor(
    private userSeederService: UserSeederService,
    private companySeederService: CompanySeederService,
  ) {}

  /**
   * Seeds roles, permissions, the single super admin and the company.
   * Every step is skipped if its data already exists.
   */
  async onModuleInit() {
    await this.seedUsers();
    // runs after users so the super admin is attached to the company
    await this.companySeederService.initCompany();
  }

  private async seedUsers() {
    const exist = await this.userSeederService.checkRoles();

    if (exist) {
      // roles are there, but make sure the configured super admin exists too
      const { superAdminRole, adminRole, userRole } =
        await this.userSeederService.getExistingRoles();

      await this.userSeederService.createSuperAdmin(
        superAdminRole,
        adminRole,
        userRole,
      );

      console.log('Seeder: roles exist, super admin checked');
      return;
    }

    const { superAdminRole, adminRole, userRole } =
      await this.userSeederService.createRolesAndPermisions();

    await this.userSeederService.createSuperAdmin(
      superAdminRole,
      adminRole,
      userRole,
    );

    console.log('Seeder: roles, permissions and super admin created');
  }
}
