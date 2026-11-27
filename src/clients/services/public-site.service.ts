import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PublicDrinkDto } from '@/clients/dto/public-drink.dto';
import {
  PublicSectionDto,
  PublicSiteDto,
  toPublicImage,
} from '@/clients/dto/public-site.dto';
import { ClientStatus } from '@/clients/client-status.enum';
import { Page } from '@/clients/entities/page.entity';
import { Section } from '@/clients/entities/section.entity';
import { SectionType } from '@/clients/website.types';
import { Client } from '@/clients/entities/client.entity';
import {
  DEFAULT_FEATURED_DRINKS,
  evenFeatured,
} from '@/clients/website.constants';
import { Drink } from '@/drinks/entities/drink.entity';

/** Builds what a white label site shows: the general info, the published pages with their shown sections and the picked drinks */
@Injectable()
export class PublicSiteService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  async find(client: Client): Promise<PublicSiteDto> {
    const full = await this.clientRepository.findOneOrFail({
      where: { clientId: client.clientId },
      relations: { logoImage: true },
    });
    const pages = await this.pageRepository.find({
      where: { clientId: client.clientId, status: ClientStatus.PUBLISHED },
      relations: {
        seo: { image: true },
        pageSections: { section: { image: true } },
      },
      order: {
        position: 'ASC',
        pageId: 'ASC',
        pageSections: { position: 'ASC' },
      },
    });

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
      pages: await Promise.all(
        pages.map(async (page) => ({
          title: page.title,
          slug: page.slug,
          seo: {
            title: page.seo.title,
            description: page.seo.description,
            image: toPublicImage(page.seo.image),
          },
          sections: await Promise.all(
            page.pageSections
              .filter((item) => item.isVisible)
              .map(({ section }) =>
                this.toPublicSection(full.companyId, section),
              ),
          ),
        })),
      ),
    };
  }

  private async toPublicSection(
    companyId: number,
    section: Section,
  ): Promise<PublicSectionDto> {
    const content = section.content ?? {};

    return {
      sectionId: section.sectionId,
      type: section.type,
      title: content.title ?? null,
      subtitle: content.subtitle ?? null,
      text: content.text ?? null,
      paragraph1: content.paragraph1 ?? null,
      paragraph2: content.paragraph2 ?? null,
      buttonText: content.buttonText ?? null,
      image: toPublicImage(section.image),
      drinks:
        section.type === SectionType.FEATURED
          ? await this.featuredDrinks(companyId, content.drinkIds)
          : [],
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
