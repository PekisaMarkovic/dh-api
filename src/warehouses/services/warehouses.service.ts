import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '@/warehouses/dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly companiesService: CompaniesService,
  ) {}

  findAll(user: User, requestedCompanyId?: number) {
    const companyId = requestedCompanyId ?? user.companyId;

    if (companyId) {
      this.companiesService.assertCanAccess(user, companyId);
    }

    return this.warehouseRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(warehouseId: number, user?: User) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { warehouseId },
      relations: ['drinks'],
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    if (user) {
      this.companiesService.assertCanAccess(user, warehouse.companyId);
    }

    return warehouse;
  }

  async create(dto: CreateWarehouseDto, user: User) {
    this.companiesService.assertCanAccess(user, dto.companyId);
    // throws NotFoundException if the company does not exist
    await this.companiesService.findOne(dto.companyId);

    return this.warehouseRepository.save(this.warehouseRepository.create(dto));
  }

  async update(warehouseId: number, dto: UpdateWarehouseDto, user: User) {
    const warehouse = await this.findOne(warehouseId, user);

    Object.assign(warehouse, dto);
    delete warehouse.drinks;

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * Soft delete an empty warehouse
   * @throws ConflictException if the warehouse still has drinks
   */
  async remove(warehouseId: number, user: User) {
    await this.findOne(warehouseId, user);

    const drinksCount = await this.warehouseRepository.manager.count(Drink, {
      where: { warehouseId },
    });

    if (drinksCount > 0) {
      throw new ConflictException(
        'Warehouse is not empty, remove all its drinks first',
      );
    }

    await this.warehouseRepository.softDelete({ warehouseId });

    return true;
  }
}
