import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { ILike, Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { inCategories } from '@/categories/category.filter';
import { CategoriesService } from '@/categories/services/categories.service';
import { PublicDrinkDto } from '@/clients/dto/public-drink.dto';
import { PublicDrinksQueryDto } from '@/clients/dto/public-drinks-query.dto';
import { toLikePattern } from '@/common/helpers';
import { Drink } from '@/drinks/entities/drink.entity';

@Injectable()
export class PublicDrinksService {
  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * A page of the drinks of the company of the client (all its warehouses), sorted by name,
   * optionally searched by name and only in some categories (any of them)
   */
  async findAll(client: Client, query: PublicDrinksQueryDto) {
    const pattern = toLikePattern(query.search);
    const base = {
      companyId: client.companyId,
      ...(query.categoryIds?.length
        ? { drinkId: inCategories(query.categoryIds) }
        : {}),
    };

    const page = await paginate(this.drinkRepository, query, {
      where: pattern ? { ...base, name: ILike(pattern) } : base,
      order: { name: 'ASC', drinkId: 'ASC' },
    });

    return {
      items: page.items.map((drink) => PublicDrinkDto.from(drink)),
      meta: page.meta,
    };
  }

  /** The categories of the company of the client that have drinks, sorted by name: the filter of the menu */
  async categories(client: Client) {
    const categories = await this.categoriesService.findWithDrinks(
      client.companyId,
    );

    return categories.map(({ categoryId, name, slug, drinksCount }) => ({
      categoryId,
      name,
      slug,
      drinksCount,
    }));
  }
}
