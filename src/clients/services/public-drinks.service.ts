import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { ILike, Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { PublicDrinkDto } from '@/clients/dto/public-drink.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { toLikePattern } from '@/common/helpers';
import { Drink } from '@/drinks/entities/drink.entity';

@Injectable()
export class PublicDrinksService {
  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
  ) {}

  /** A page of the drinks of the company of the client (all its warehouses), sorted by name, optionally searched by name */
  async findAll(client: Client, query: PaginationQueryDto) {
    const pattern = toLikePattern(query.search);
    const base = { companyId: client.companyId };

    const page = await paginate(this.drinkRepository, query, {
      where: pattern ? { ...base, name: ILike(pattern) } : base,
      order: { name: 'ASC', drinkId: 'ASC' },
    });

    return {
      items: page.items.map((drink) => PublicDrinkDto.from(drink)),
      meta: page.meta,
    };
  }
}
