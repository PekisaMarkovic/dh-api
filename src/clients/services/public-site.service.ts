import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PublicDrinkDto } from '@/clients/dto/public-drink.dto';
import { PublicSiteDto, toPublicImage } from '@/clients/dto/public-site.dto';
import { Client } from '@/clients/entities/client.entity';
import {
  DEFAULT_FEATURED_DRINKS,
  evenFeatured,
} from '@/clients/website.constants';
import { Drink } from '@/drinks/entities/drink.entity';

/** Builds what a white label site shows, from the `clients` row, its pictures and the picked drinks */
@Injectable()
export class PublicSiteService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
  ) {}

  async find(client: Client): Promise<PublicSiteDto> {
    const full = await this.clientRepository.findOneOrFail({
      where: { clientId: client.clientId },
      relations: {
        logoImage: true,
        heroImage: true,
        storyImage: true,
        promoImage: true,
        ogImage: true,
      },
    });
    const { hero, featured, story, promo, seo } = full.sections ?? {};

    return {
      status: full.status,
      isOrderingAllowed: full.isOrderingAllowed,
      name: full.name,
      city: full.city,
      address: full.address,
      phone: full.phone,
      instagram: full.instagram,
      workingHours: full.workingHours,
      logo: toPublicImage(full.logoImage),
      hero: {
        title: hero?.title ?? null,
        subtitle: hero?.subtitle ?? null,
        text: hero?.text ?? null,
        buttonText: hero?.buttonText ?? null,
        image: toPublicImage(full.heroImage),
      },
      featured: {
        title: featured?.title ?? null,
        buttonText: featured?.buttonText ?? null,
        drinks: await this.featuredDrinks(full.companyId, featured?.drinkIds),
      },
      story: {
        title: story?.title ?? null,
        paragraph1: story?.paragraph1 ?? null,
        paragraph2: story?.paragraph2 ?? null,
        buttonText: story?.buttonText ?? null,
        image: toPublicImage(full.storyImage),
      },
      promo: {
        title: promo?.title ?? null,
        text: promo?.text ?? null,
        buttonText: promo?.buttonText ?? null,
        image: toPublicImage(full.promoImage),
      },
      seo: {
        title: seo?.title ?? null,
        description: seo?.description ?? null,
        menuTitle: seo?.menuTitle ?? null,
        menuDescription: seo?.menuDescription ?? null,
        image: toPublicImage(full.ogImage),
      },
    };
  }

  /** The picked drinks in the picked order (a deleted one is skipped), the first drinks of the menu when none were picked */
  private async featuredDrinks(
    companyId: number,
    drinkIds?: number[],
  ): Promise<PublicDrinkDto[]> {
    if (drinkIds?.length) {
      const drinks = await this.drinkRepository.find({
        where: { drinkId: In(drinkIds), companyId },
      });
      const byId = new Map(drinks.map((drink) => [drink.drinkId, drink]));

      // a deleted drink is skipped, so the list is made even again
      return evenFeatured(
        drinkIds
          .map((id) => byId.get(id))
          .filter((drink): drink is Drink => !!drink)
          .map((drink) => PublicDrinkDto.from(drink)),
      );
    }

    const drinks = await this.drinkRepository.find({
      where: { companyId },
      order: { name: 'ASC', drinkId: 'ASC' },
      take: DEFAULT_FEATURED_DRINKS,
    });

    return evenFeatured(drinks.map((drink) => PublicDrinkDto.from(drink)));
  }
}
