import { paginate } from 'nestjs-typeorm-paginate';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Raw, Repository } from 'typeorm';
import { inCategories } from '@/categories/category.filter';
import { CategoriesService } from '@/categories/services/categories.service';
import { User } from '@/users/entities/user.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { CreateDrinkDto, UpdateDrinkDto } from '@/drinks/dto/drink.dto';
import {
  DrinkSort,
  DrinkStockLevel,
  FindDrinksDto,
} from '@/drinks/dto/find-drinks.dto';
import { toLikePattern } from '@/common/helpers';
import { StorageService } from '@/storage/services/storage.service';
import { ImagesService } from '@/storage/services/images.service';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';

@Injectable()
export class DrinksService {
  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    private readonly warehousesService: WarehousesService,
    private readonly companiesService: CompaniesService,
    private readonly storageService: StorageService,
    private readonly imagesService: ImagesService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(user: User, query: FindDrinksDto) {
    const { warehouseId } = query;

    if (warehouseId) {
      // checks the warehouse belongs to the user's company
      await this.warehousesService.findOne(warehouseId, user);
    }

    const base = {
      ...(warehouseId ? { warehouseId } : { companyId: user.companyId ?? -1 }),
      ...this.stockLevelWhere(query.stockLevel),
      ...(query.categoryIds?.length
        ? { drinkId: inCategories(query.categoryIds) }
        : {}),
    };
    const pattern = toLikePattern(query.search);

    const page = await paginate(this.drinkRepository, query, {
      // name OR code
      where: pattern
        ? [
            { ...base, name: ILike(pattern) },
            { ...base, code: ILike(pattern) },
          ]
        : base,
      order: query.sort
        ? {
            price: query.sort === DrinkSort.PRICE_DESC ? 'DESC' : 'ASC',
            name: 'ASC',
            drinkId: 'ASC',
          }
        : { name: 'ASC', drinkId: 'ASC' },
      relations: { categories: true },
    });

    return page;
  }

  /**
   * The same levels as the dashboard shows: below zero is always red,
   * a level of 0 means that level is off.
   */
  private stockLevelWhere(level?: DrinkStockLevel) {
    switch (level) {
      case DrinkStockLevel.CRITICAL:
        return {
          quantity: Raw(
            (q) =>
              `(${q} < 0 OR ("critical_quantity" > 0 AND ${q} < "critical_quantity"))`,
          ),
        };
      case DrinkStockLevel.WARNING:
        return {
          quantity: Raw(
            (q) =>
              `(${q} >= 0 AND "warning_quantity" > 0 AND ${q} < "warning_quantity" AND ("critical_quantity" = 0 OR ${q} >= "critical_quantity"))`,
          ),
        };
      default:
        return {};
    }
  }

  async findOne(drinkId: number, user?: User) {
    const drink = await this.drinkRepository.findOne({
      where: { drinkId },
      relations: { categories: true },
    });

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

    const { categoryIds, ...fields } = dto;
    const categories = await this.categoriesService.findForCompany(
      categoryIds ?? [],
      warehouse.companyId,
    );

    return this.drinkRepository.save(
      this.drinkRepository.create({
        ...fields,
        companyId: warehouse.companyId,
        categories,
      }),
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

    const { categoryIds, ...fields } = dto;

    // not sent: the categories stay as they are
    if (categoryIds !== undefined) {
      drink.categories = await this.categoriesService.findForCompany(
        categoryIds,
        drink.companyId,
      );
    }

    Object.assign(drink, fields);

    return this.drinkRepository.save(drink);
  }

  /**
   * Saves the image of a drink as a WebP (at most 1200x1200) in
   * `<production|local>/company-<name>-<id>/drinks/<drinkId>/<time>.webp` and as a row of `images`,
   * the old image is deleted. Every upload has a new name so the browser and the CDN never show the old one.
   */
  async setImage(
    drinkId: number,
    file: Express.Multer.File,
    user: User,
    altText?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('The image is missing.');
    }

    const drink = await this.findOne(drinkId, user);
    const optimized = await this.imageOptimizer.toWebp(file.buffer);
    const company = await this.companiesService.findOne(drink.companyId);
    const old = drink.image;

    const image = await this.imagesService.create({
      companyId: drink.companyId,
      folder: this.storageService.drinkFolder(company, drinkId),
      image: optimized,
      altText: altText || drink.name,
    });

    try {
      await this.drinkRepository.update(
        { drinkId },
        { imageId: image.imageId },
      );
    } catch (error) {
      await this.imagesService.remove(image);
      throw error;
    }

    if (old) {
      await this.imagesService.remove(old);
    }

    drink.imageId = image.imageId;
    drink.image = image;

    return drink;
  }

  async removeImage(drinkId: number, user: User) {
    const drink = await this.findOne(drinkId, user);

    if (drink.image) {
      await this.drinkRepository.update({ drinkId }, { imageId: null });
      await this.imagesService.remove(drink.image);
      drink.imageId = null;
      drink.image = null;
    }

    return drink;
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
