import { Injectable } from '@nestjs/common';
import { CompaniesService } from '@/companies/services/companies.service';
import { UsersService } from '@/users/services/users.service';
import { Company } from '@/companies/entities/company.entity';

const COMPANY_NAME = 'DRINK HOUSE';

// the data that is printed on the documents, it can be changed later through PATCH /companies/:id
const COMPANY_DETAILS = {
  street: 'FILIPA KLJAJIĆA 82',
  city: 'LOZNICA',
  pib: '115962350',
  registrationNumber: '68783143',
  phone: null,
  bankAccount: '160600000276128785',
};

@Injectable()
export class CompanySeederService {
  constructor(
    private companiesService: CompaniesService,
    private usersService: UsersService,
  ) {}

  async initCompany(): Promise<Company> {
    let company = await this.companiesService.findByName(COMPANY_NAME);

    if (!company) {
      // there is a single company for now: an older one (it was called NakNak) gets the right name,
      // so a second company is not made next to it
      const existing = await this.companiesService.findFirst();

      if (existing) {
        company = await this.companiesService.update(existing.companyId, {
          name: COMPANY_NAME,
        });
        console.log(`Seeder: company renamed to ${COMPANY_NAME}`);
      } else {
        company = await this.companiesService.create({
          name: COMPANY_NAME,
          ...COMPANY_DETAILS,
        });
        console.log(`Seeder: company ${COMPANY_NAME} created`);
      }
    } else {
      console.log('Seeder: company exists, skipping');
    }

    // an older company has no data for the documents yet: fill it in, never overwrite
    if (!company.pib) {
      await this.companiesService.update(company.companyId, COMPANY_DETAILS);
      console.log('Seeder: company data for the documents filled in');
    }

    // there is a single company for now, so everyone belongs to it
    await this.usersService.assignCompanyToUsersWithout(company.companyId);

    return company;
  }
}
