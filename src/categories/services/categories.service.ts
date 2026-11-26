import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Not, Raw, Repository } from 'typeorm';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@/categories/dto/category.dto';
import { Category } from '@/categories/entities/category.entity';
import { slugify } from '@/common/helpers';
import { CompaniesService } from '@/companies/services/companies.service';
import { User } from '@/users/entities/user.entity';

/** A category with the number of its drinks (a deleted drink is not counted) */
export type CategoryWithCount = Category & { drinksCount: number };

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly companiesService: CompaniesService,
  ) {}

  /** The categories of a company sorted by name, with the number of their drinks */
  async findAll(
    user: User,
    requestedCompanyId?: number,
  ): Promise<CategoryWithCount[]> {
    const companyId = requestedCompanyId ?? user.companyId;

    if (!companyId) {
      return [];
    }

    this.companiesService.assertCanAccess(user, companyId);

    return this.withCounts(companyId);
  }

  /** The categories of a company that have at least one drink: the filter of the menu of the site */
  async findWithDrinks(companyId: number): Promise<CategoryWithCount[]> {
    const categories = await this.withCounts(companyId);

    return categories.filter((category) => category.drinksCount > 0);
  }

  async findOne(categoryId: number, user: User) {
    const category = await this.categoryRepository.findOne({
      where: { categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    this.companiesService.assertCanAccess(user, category.companyId);

    return category;
  }

  /**
   * The categories with these ids, all of them have to be categories of the company
   * @throws BadRequestException if one is missing or of another company
   */
  async findForCompany(categoryIds: number[], companyId: number) {
    if (!categoryIds.length) {
      return [];
    }

    const categories = await this.categoryRepository.find({
      where: { categoryId: In(categoryIds), companyId },
    });

    if (categories.length !== new Set(categoryIds).size) {
      throw new BadRequestException('One of the categories does not exist.');
    }

    return categories;
  }

  async create(dto: CreateCategoryDto, user: User) {
    const companyId = dto.companyId ?? user.companyId;

    if (!companyId) {
      throw new BadRequestException('The company of the category is missing.');
    }

    this.companiesService.assertCanAccess(user, companyId);
    await this.assertNameIsFree(dto.name, companyId);

    return this.categoryRepository.save(
      this.categoryRepository.create({
        name: dto.name,
        companyId,
        slug: await this.uniqueSlug(dto.name, companyId),
      }),
    );
  }

  async update(categoryId: number, dto: UpdateCategoryDto, user: User) {
    const category = await this.findOne(categoryId, user);

    if (dto.name !== category.name) {
      await this.assertNameIsFree(dto.name, category.companyId, categoryId);
      // a new name is a new address (/karta-pica/<slug>)
      category.slug = await this.uniqueSlug(
        dto.name,
        category.companyId,
        categoryId,
      );
    }

    category.name = dto.name;

    return this.categoryRepository.save(category);
  }

  /** Soft deletes the category, its drinks stay but are no longer in it */
  async remove(categoryId: number, user: User) {
    const category = await this.findOne(categoryId, user);

    await this.categoryRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from('drink_categories')
        .where('category_id = :categoryId', { categoryId })
        .execute();
      await manager.getRepository(Category).softDelete({ categoryId });
    });

    return category;
  }

  private async withCounts(companyId: number): Promise<CategoryWithCount[]> {
    const categories = await this.categoryRepository.find({
      where: { companyId },
      order: { name: 'ASC', categoryId: 'ASC' },
    });

    if (!categories.length) {
      return [];
    }

    const counts = await this.categoryRepository.manager
      .createQueryBuilder()
      .select('dc.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'drinksCount')
      .from('drink_categories', 'dc')
      .innerJoin(
        'drinks',
        'd',
        'd.drink_id = dc.drink_id AND d.deleted_at IS NULL',
      )
      .where('dc.category_id IN (:...ids)', {
        ids: categories.map((c) => c.categoryId),
      })
      .groupBy('dc.category_id')
      .getRawMany<{ categoryId: number; drinksCount: string }>();

    const byId = new Map(
      counts.map((c) => [Number(c.categoryId), Number(c.drinksCount)]),
    );

    return categories.map((category) => ({
      ...category,
      drinksCount: byId.get(category.categoryId) ?? 0,
    }));
  }

  /** "Točeno pivo" -> "toceno-pivo", "toceno-pivo-2" when another category of the company already has it */
  private async uniqueSlug(
    name: string,
    companyId: number,
    exceptCategoryId?: number,
  ) {
    const base = slugify({ text: name, truncate: 100 }) || 'kategorija';
    const others = await this.categoryRepository.find({
      where: { companyId, slug: Like(`${base}%`) },
      select: { categoryId: true, slug: true },
    });
    const taken = new Set(
      others
        .filter((c) => c.categoryId !== exceptCategoryId)
        .map((c) => c.slug),
    );
    let slug = base;

    for (let n = 2; taken.has(slug); n++) {
      slug = `${base}-${n}`;
    }

    return slug;
  }

  /**
   * The name is unique inside the company, "pivo" and "Pivo" are the same name
   * @throws ConflictException if another category already has it
   */
  private async assertNameIsFree(
    name: string,
    companyId: number,
    exceptCategoryId?: number,
  ) {
    const exists = await this.categoryRepository.exists({
      where: {
        companyId,
        name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name }),
        ...(exceptCategoryId ? { categoryId: Not(exceptCategoryId) } : {}),
      },
    });

    if (exists) {
      throw new ConflictException('A category with this name already exists.');
    }
  }
}
