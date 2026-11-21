import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
      order: { isDefault: 'DESC', name: 'ASC', warehouseId: 'ASC' },
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

    return this.warehouseRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Warehouse);
      const hasDefault = await repository.exists({
        where: { companyId: dto.companyId, isDefault: true },
      });
      // the first warehouse of a company is always the default one
      const isDefault = !hasDefault || dto.isDefault === true;

      if (isDefault) {
        await this.clearDefault(manager, dto.companyId);
      }

      return repository.save(repository.create({ ...dto, isDefault }));
    });
  }

  async update(warehouseId: number, dto: UpdateWarehouseDto, user: User) {
    const warehouse = await this.findOne(warehouseId, user);

    return this.warehouseRepository.manager.transaction(async (manager) => {
      const { isDefault, ...rest } = dto;
      Object.assign(warehouse, rest);
      delete warehouse.drinks;

      // a company always keeps one default, so it is changed only by
      // making another warehouse the default one
      if (isDefault === true && !warehouse.isDefault) {
        await this.clearDefault(manager, warehouse.companyId);
        warehouse.isDefault = true;
      }

      return manager.getRepository(Warehouse).save(warehouse);
    });
  }

  private clearDefault(manager: EntityManager, companyId: number) {
    return manager
      .getRepository(Warehouse)
      .update({ companyId, isDefault: true }, { isDefault: false });
  }

  /**
   * Soft delete an empty warehouse
   * @throws ConflictException if the warehouse still has drinks
   */
  async remove(warehouseId: number, user: User) {
    const warehouse = await this.findOne(warehouseId, user);

    const drinksCount = await this.warehouseRepository.manager.count(Drink, {
      where: { warehouseId },
    });

    if (drinksCount > 0) {
      throw new ConflictException(
        'Warehouse is not empty, remove all its drinks first',
      );
    }

    await this.warehouseRepository.softDelete({ warehouseId });

    // the default one is gone, so the first remaining warehouse takes over
    if (warehouse.isDefault) {
      const next = await this.warehouseRepository.findOne({
        where: { companyId: warehouse.companyId },
        order: { warehouseId: 'ASC' },
      });

      if (next) {
        await this.warehouseRepository.update(next.warehouseId, {
          isDefault: true,
        });
      }
    }

    return true;
  }
}
