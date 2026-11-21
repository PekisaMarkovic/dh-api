import { Test, TestingModule } from '@nestjs/testing';
import { AppSeederService } from '@/seeder/app-seeder.service';
import { CompanySeederService } from '@/seeder/services/company-seeder.service';
import { UserSeederService } from '@/seeder/services/user-seeder.service';

describe('AppSeederService', () => {
  let service: AppSeederService;
  let userSeeder: {
    checkRoles: jest.Mock;
    getExistingRoles: jest.Mock;
    createRolesAndPermisions: jest.Mock;
    createSuperAdmin: jest.Mock;
  };
  let companySeeder: { initCompany: jest.Mock };
  let calls: string[];

  const roles = { superAdminRole: 'S', adminRole: 'A', userRole: 'U' };

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    calls = [];

    userSeeder = {
      checkRoles: jest.fn(),
      getExistingRoles: jest.fn().mockResolvedValue(roles),
      createRolesAndPermisions: jest.fn().mockResolvedValue(roles),
      createSuperAdmin: jest.fn(async () => {
        calls.push('super admin');
      }),
    };
    companySeeder = {
      initCompany: jest.fn(async () => {
        calls.push('company');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppSeederService,
        { provide: UserSeederService, useValue: userSeeder },
        { provide: CompanySeederService, useValue: companySeeder },
      ],
    }).compile();

    service = module.get(AppSeederService);
  });

  it('should create the roles and the super admin on an empty database', async () => {
    userSeeder.checkRoles.mockResolvedValue(false);

    await service.onModuleInit();

    expect(userSeeder.createRolesAndPermisions).toHaveBeenCalled();
    expect(userSeeder.createSuperAdmin).toHaveBeenCalledWith('S', 'A', 'U');
  });

  it('should only check the super admin when the roles are already there', async () => {
    userSeeder.checkRoles.mockResolvedValue(true);

    await service.onModuleInit();

    expect(userSeeder.createRolesAndPermisions).not.toHaveBeenCalled();
    expect(userSeeder.getExistingRoles).toHaveBeenCalled();
    expect(userSeeder.createSuperAdmin).toHaveBeenCalledWith('S', 'A', 'U');
  });

  it('should set up the company after the users, so the super admin gets the company', async () => {
    userSeeder.checkRoles.mockResolvedValue(true);

    await service.onModuleInit();

    expect(calls).toEqual(['super admin', 'company']);
  });
});
