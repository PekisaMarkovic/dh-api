import { Injectable } from '@nestjs/common';
import { CompaniesService } from '@/companies/services/companies.service';
import { UsersService } from '@/users/services/users.service';
import { Company } from '@/companies/entities/company.entity';

const COMPANY_NAME = 'NakNak';

@Injectable()
export class CompanySeederService {
  constructor(
    private companiesService: CompaniesService,
    private usersService: UsersService,
  ) {}

  async initCompany(): Promise<Company> {
    let company = await this.companiesService.findByName(COMPANY_NAME);

    if (company) {
      console.log('Seeder: company exists, skipping');
    } else {
      company = await this.companiesService.create({ name: COMPANY_NAME });
      console.log(`Seeder: company ${COMPANY_NAME} created`);
    }

    // there is a single company for now, so everyone belongs to it
    await this.usersService.assignCompanyToUsersWithout(company.companyId);

    return company;
  }
}
