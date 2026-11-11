import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    await this.assertCodeIsFree(dto.code, warehouse.companyId);
    this.assertLevels(dto.warningQuantity ?? 0, dto.criticalQuantity ?? 0);

    return this.drinkRepository.save(
      this.drinkRepository.create({ ...dto, companyId: warehouse.companyId }),
    );
  }

  async update(drinkId: number, dto: UpdateDrinkDto, user: User) {
    const drink = await this.findOne(drinkId, user);

    if (dto.code !== undefined && dto.code !== drink.code) {
      await this.assertCodeIsFree(dto.code, drink.companyId);
    }

    this.assertLevels(
      dto.warningQuantity ?? drink.warningQuantity,
      dto.criticalQuantity ?? drink.criticalQuantity,
    );

    Object.assign(drink, dto);

    return this.drinkRepository.save(drink);
  }

  /**
   * The red level (has to be bought again) has to be lower than the orange one (warning),
   * the drink gets orange first and red later. A level of 0 means it is off.
   * @throws BadRequestException if it is not lower
   */
  private assertLevels(warningQuantity: number, criticalQuantity: number) {
    if (criticalQuantity > 0 && criticalQuantity >= warningQuantity) {
      throw new BadRequestException(
        'The quantity for "has to be bought again" has to be lower than the quantity for the warning.',
      );
    }
  }

  /**
   * The article code has to be unique inside the company
   * @throws ConflictException if another drink already has the code
   */
  private async assertCodeIsFree(code: string, companyId: number) {
    const exists = await this.drinkRepository.exists({
      where: { code, companyId },
    });

    if (exists) {
      throw new ConflictException(
        'A drink with this article code already exists.',
      );
    }
  }

  async remove(drinkId: number, user: User) {
    await this.findOne(drinkId, user);
    await this.drinkRepository.softDelete({ drinkId });

    return true;
  }
}
