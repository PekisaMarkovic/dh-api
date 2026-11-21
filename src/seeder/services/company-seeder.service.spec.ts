import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from '@/companies/services/companies.service';
import { CompanySeederService } from '@/seeder/services/company-seeder.service';
import { UsersService } from '@/users/services/users.service';

describe('CompanySeederService', () => {
  let service: CompanySeederService;
  let companiesService: {
    findByName: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let usersService: { assignCompanyToUsersWithout: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    companiesService = {
      findByName: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn((dto: object) =>
        Promise.resolve({ companyId: 1, ...dto }),
      ),
      update: jest.fn((id: number, dto: object) =>
        Promise.resolve({ companyId: id, pib: '115962350', ...dto }),
      ),
    };
    usersService = {
      assignCompanyToUsersWithout: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySeederService,
        { provide: CompaniesService, useValue: companiesService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(CompanySeederService);
  });

  it('should create the company with the data for the documents when there is none', async () => {
    companiesService.findByName.mockResolvedValue(null);
    companiesService.findFirst.mockResolvedValue(null);

    const company = await service.initCompany();

    expect(companiesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DRINK HOUSE',
        pib: '115962350',
        city: 'LOZNICA',
      }),
    );
    expect(company.name).toBe('DRINK HOUSE');
  });

  it('should rename an older company, so a second one is not made next to it', async () => {
    companiesService.findByName.mockResolvedValue(null);
    companiesService.findFirst.mockResolvedValue({
      companyId: 4,
      name: 'NakNak',
      pib: '1',
    });

    await service.initCompany();

    expect(companiesService.update).toHaveBeenCalledWith(4, {
      name: 'DRINK HOUSE',
    });
    expect(companiesService.create).not.toHaveBeenCalled();
  });

  it('should leave a company that exists as it is', async () => {
    companiesService.findByName.mockResolvedValue({
      companyId: 1,
      name: 'DRINK HOUSE',
      pib: '1',
    });

    await service.initCompany();

    expect(companiesService.create).not.toHaveBeenCalled();
    expect(companiesService.update).not.toHaveBeenCalled();
  });

  it('should fill in the data for the documents of an older company that has none', async () => {
    companiesService.findByName.mockResolvedValue({
      companyId: 1,
      name: 'DRINK HOUSE',
      pib: null,
    });

    await service.initCompany();

    expect(companiesService.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        pib: '115962350',
        bankAccount: '160600000276128785',
      }),
    );
  });

  it('should put every user without a company in the company', async () => {
    companiesService.findByName.mockResolvedValue({
      companyId: 7,
      name: 'DRINK HOUSE',
      pib: '1',
    });

    await service.initCompany();

    expect(usersService.assignCompanyToUsersWithout).toHaveBeenCalledWith(7);
  });
});
