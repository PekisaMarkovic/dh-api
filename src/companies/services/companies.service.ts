import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '@/companies/entities/company.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';
import { ClientRoleEnums } from '@/auth/enums';
import { Drink } from '@/drinks/entities/drink.entity';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
} from '@/companies/dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Users can only see their own company, super admins see every company
   */
  assertCanAccess(user: User, companyId: number) {
    const isSuperAdmin = (user.roles ?? []).some(
      (role) => role.name === ClientRoleEnums.SUPER_ADMIN,
    );

    if (!isSuperAdmin && user.companyId !== companyId) {
      throw new ForbiddenException();
    }
  }

  async findUsersPage(companyId: number, query: PaginationQueryDto) {
    return this.usersService.getUsersPageByCompany(companyId, query);
  }

  async findUsers(companyId: number) {
    await this.findOne(companyId);

    return this.usersService.getUsersByCompany(companyId);
  }

  findAll(user: User) {
    const isSuperAdmin = (user.roles ?? []).some(
      (role) => role.name === ClientRoleEnums.SUPER_ADMIN,
    );

    return this.companyRepository.find({
      where: isSuperAdmin ? {} : { companyId: user.companyId ?? -1 },
      order: { name: 'ASC' },
    });
  }

  async findOne(companyId: number) {
    const company = await this.companyRepository.findOne({
      where: { companyId },
      relations: ['warehouses'],
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /**
   * The oldest company, there is a single company for now
   */
  findFirst() {
    return this.companyRepository.findOne({
      where: {},
      order: { companyId: 'ASC' },
    });
  }

  findByName(name: string) {
    return this.companyRepository.findOne({ where: { name } });
  }

  async create(dto: CreateCompanyDto) {
    if (await this.findByName(dto.name)) {
      throw new ConflictException('Company with this name already exists');
    }

    return this.companyRepository.save(this.companyRepository.create(dto));
  }

  async update(companyId: number, dto: UpdateCompanyDto) {
    const company = await this.findOne(companyId);

    if (
      dto.name &&
      dto.name !== company.name &&
      (await this.findByName(dto.name))
    ) {
      throw new ConflictException('Company with this name already exists');
    }

    Object.assign(company, dto);
    delete company.warehouses;

    return this.companyRepository.save(company);
  }

  /**
   * Soft delete the company together with its warehouses and their drinks
   */
  async remove(companyId: number) {
    await this.findOne(companyId);

    await this.companyRepository.manager.transaction(async (manager) => {
      await manager.softDelete(Drink, { companyId });
      await manager.softDelete(Warehouse, { companyId });

      await manager.softDelete(Company, { companyId });
    });

    return true;
  }
}
