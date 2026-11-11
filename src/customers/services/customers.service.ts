import { paginate } from 'nestjs-typeorm-paginate';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Customer } from '@/customers/entities/customer.entity';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { toLikePattern } from '@/common/helpers';
import { CompaniesService } from '@/companies/services/companies.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@/customers/dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly companiesService: CompaniesService,
  ) {}

  /**
   * A page of the customers of the company of the user, sorted by name
   */
  async findAll(user: User, query: PaginationQueryDto) {
    const pattern = toLikePattern(query.search);

    return paginate(this.customerRepository, query, {
      // name OR code
      where: pattern
        ? [
            { companyId: user.companyId ?? -1, name: ILike(pattern) },
            { companyId: user.companyId ?? -1, code: ILike(pattern) },
          ]
        : { companyId: user.companyId ?? -1 },
      order: { name: 'ASC', customerId: 'ASC' },
    });
  }

  /**
   * Only id and name of all the customers, for the select of a proforma
   */
  findOptions(user: User) {
    return this.customerRepository.find({
      select: { customerId: true, name: true },
      where: { companyId: user.companyId ?? -1 },
      order: { name: 'ASC', customerId: 'ASC' },
    });
  }

  async findOne(customerId: number, user?: User) {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (user) {
      this.companiesService.assertCanAccess(user, customer.companyId);
    }

    return customer;
  }

  async create(dto: CreateCustomerDto, user: User) {
    if (!user.companyId) {
      throw new BadRequestException(
        'You have to be in a company to add customers.',
      );
    }

    await this.assertNameIsFree(dto.name, user.companyId);
    await this.assertCodeIsFree(dto.code, user.companyId);

    return this.customerRepository.save(
      this.customerRepository.create({ ...dto, companyId: user.companyId }),
    );
  }

  async update(customerId: number, dto: UpdateCustomerDto, user: User) {
    const customer = await this.findOne(customerId, user);

    if (dto.name !== undefined && dto.name !== customer.name) {
      await this.assertNameIsFree(dto.name, customer.companyId, customerId);
    }

    if (dto.code && dto.code !== customer.code) {
      await this.assertCodeIsFree(dto.code, customer.companyId, customerId);
    }

    Object.assign(customer, dto);

    return this.customerRepository.save(customer);
  }

  /**
   * Soft delete. Proformas keep the name that was on them.
   */
  async remove(customerId: number, user: User) {
    await this.findOne(customerId, user);
    await this.customerRepository.softDelete({ customerId });

    return true;
  }

  /**
   * The customer code has to be unique inside the company
   * @throws ConflictException if another customer already has the code
   */
  private async assertCodeIsFree(
    code: string,
    companyId: number,
    exceptCustomerId?: number,
  ) {
    const same = await this.customerRepository.findOne({
      where: { code, companyId },
    });

    if (same && same.customerId !== exceptCustomerId) {
      throw new ConflictException('A customer with this code already exists.');
    }
  }

  /**
   * Two customers of one company can not have the same name (upper/lower case does not matter)
   * @throws ConflictException if the name is taken
   */
  private async assertNameIsFree(
    name: string,
    companyId: number,
    exceptCustomerId?: number,
  ) {
    // % and _ are wildcards in ILIKE, here they are just letters
    const exactName = name.replace(/[\\%_]/g, '\\$&');
    const sameName = await this.customerRepository.find({
      where: { companyId, name: ILike(exactName) },
    });

    if (sameName.some((customer) => customer.customerId !== exceptCustomerId)) {
      throw new ConflictException('A customer with this name already exists.');
    }
  }
}
