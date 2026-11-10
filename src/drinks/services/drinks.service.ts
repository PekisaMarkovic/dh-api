import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { CreateDrinkDto, UpdateDrinkDto } from '@/drinks/dto/drink.dto';

@Injectable()
export class DrinksService {
  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    private readonly warehousesService: WarehousesService,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(user: User, warehouseId?: number) {
    if (warehouseId) {
      // checks the warehouse belongs to the user's company
      await this.warehousesService.findOne(warehouseId, user);
    }

    return this.drinkRepository.find({
      where: warehouseId
        ? { warehouseId }
        : { companyId: user.companyId ?? -1 },
      order: { name: 'ASC' },
    });
  }

  async findOne(drinkId: number, user?: User) {
    const drink = await this.drinkRepository.findOne({ where: { drinkId } });

    if (!drink) {
      throw new NotFoundException('Drink not found');
    }

    if (user) {
      this.companiesService.assertCanAccess(user, drink.companyId);
    }

    return drink;
  }

  async create(dto: CreateDrinkDto, user: User) {
    // throws NotFound / Forbidden if the warehouse is missing or not yours
    const warehouse = await this.warehousesService.findOne(
      dto.warehouseId,
      user,
    );

    return this.drinkRepository.save(
      this.drinkRepository.create({ ...dto, companyId: warehouse.companyId }),
    );
  }

  async update(drinkId: number, dto: UpdateDrinkDto, user: User) {
    const drink = await this.findOne(drinkId, user);

    Object.assign(drink, dto);

    return this.drinkRepository.save(drink);
  }

  async remove(drinkId: number, user: User) {
    await this.findOne(drinkId, user);
    await this.drinkRepository.softDelete({ drinkId });

    return true;
  }
}
