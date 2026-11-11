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

  /**
   * Warehouses with the number of their drinks and the value of the stock (in cents),
   * so the page does not need all the drinks to show them
   */
  async findAll(user: User, requestedCompanyId?: number) {
    const companyId = requestedCompanyId ?? user.companyId;

    if (companyId) {
      this.companiesService.assertCanAccess(user, companyId);
    }

    const warehouses = await this.warehouseRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC', warehouseId: 'ASC' },
    });

    if (!warehouses.length) {
      return [];
    }

    const stats = await this.warehouseRepository.manager
      .createQueryBuilder(Drink, 'drink')
      .select('drink.warehouseId', 'warehouseId')
      .addSelect('COUNT(*)', 'drinksCount')
      // every line is rounded to cents, the same as the dashboard did
      .addSelect(
        'COALESCE(SUM(ROUND(drink.price * drink.quantity * 100)), 0)',
        'totalValueCents',
      )
      .where('drink.warehouseId IN (:...ids)', {
        ids: warehouses.map((w) => w.warehouseId),
      })
      .groupBy('drink.warehouseId')
      .getRawMany<{
        warehouseId: number;
        drinksCount: string;
        totalValueCents: string;
      }>();

    const byId = new Map(stats.map((s) => [Number(s.warehouseId), s]));

    return warehouses.map((warehouse) => ({
      ...warehouse,
      drinksCount: Number(byId.get(warehouse.warehouseId)?.drinksCount ?? 0),
      totalValueCents: Number(
        byId.get(warehouse.warehouseId)?.totalValueCents ?? 0,
      ),
    }));
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
