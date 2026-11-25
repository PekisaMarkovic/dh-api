import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { In, Repository } from 'typeorm';
import { CompaniesService } from '@/companies/services/companies.service';
import { UpdateWebsiteDto } from '@/clients/dto/update-website.dto';
import { ClientStatus } from '@/clients/client-status.enum';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import {
  getCompleteness,
  WebsiteCompleteness,
} from '@/clients/website.completeness';
import {
  WEBSITE_SLOT_CONFIG,
  WebsiteImageSlot,
} from '@/clients/website.constants';
import { ClientSections, SectionName } from '@/clients/website.types';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { Drink } from '@/drinks/entities/drink.entity';
import { SiteRevalidationService } from '@/clients/services/site-revalidation.service';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';
import { ImagesService } from '@/storage/services/images.service';
import { StorageService } from '@/storage/services/storage.service';
import { User } from '@/users/entities/user.entity';

const GENERAL_FIELDS = [
  'city',
  'address',
  'phone',
  'instagram',
  'workingHours',
] as const;
const SECTION_NAMES: SectionName[] = ['hero', 'featured', 'story', 'promo'];
const IMAGE_RELATIONS = {
  logoImage: true,
  heroImage: true,
  storyImage: true,
  promoImage: true,
} as const;

/** The site as the dashboard gets it: the row, its pictures and the names of the picked drinks */
export type WebsiteDto = Client & {
  featuredDrinks: { drinkId: number; name: string }[];
  /** what is still missing before the site can be published */
  completeness: WebsiteCompleteness;
};

/** What the admin of a company does with the site of the company (the dashboard page "Web sajt") */
@Injectable()
export class WebsiteService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientContactedBy)
    private readonly contactRepository: Repository<ClientContactedBy>,
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    private readonly companiesService: CompaniesService,
    private readonly storageService: StorageService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly imagesService: ImagesService,
    private readonly siteRevalidation: SiteRevalidationService,
  ) {}

  /**
   * The site of the company of the user (a company can have more, the oldest one is managed),
   * with the names of the picked drinks (`featuredDrinks`) so the dashboard can show them.
   * @throws NotFoundException if the company has no site: it is not a white label company
   */
  async findOne(user: User): Promise<WebsiteDto> {
    const client = await this.load(user);

    return {
      ...client,
      featuredDrinks: await this.featuredDrinks(client),
      completeness: getCompleteness(client),
    };
  }

  /**
   * Publishes the site: it shows to everyone and Google can index it. Only a complete site can be published.
   * @throws BadRequestException with what is missing
   */
  async publish(user: User): Promise<WebsiteDto> {
    const client = await this.load(user);
    const { isComplete, missing } = getCompleteness(client);

    if (!isComplete) {
      throw new BadRequestException(
        `The website is not complete yet, missing: ${missing.join(', ')}.`,
      );
    }

    if (client.status !== ClientStatus.PUBLISHED) {
      await this.clientRepository.update(
        { clientId: client.clientId },
        { status: ClientStatus.PUBLISHED, publishedAt: new Date() },
      );
    }

    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  /** Takes the site back to a draft: it shows the "coming soon" page again */
  async unpublish(user: User): Promise<WebsiteDto> {
    const client = await this.load(user);

    if (client.status !== ClientStatus.DRAFT) {
      await this.clientRepository.update(
        { clientId: client.clientId },
        { status: ClientStatus.DRAFT },
      );
    }

    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  /** The names of the picked drinks, in the picked order (a deleted drink is skipped) */
  private async featuredDrinks(client: Client) {
    const ids = client.sections?.featured?.drinkIds ?? [];

    if (!ids.length) {
      return [];
    }

    const drinks = await this.drinkRepository.find({
      where: { drinkId: In(ids), companyId: client.companyId },
    });
    const byId = new Map(drinks.map((drink) => [drink.drinkId, drink]));

    return ids
      .map((id) => byId.get(id))
      .filter((drink): drink is Drink => !!drink)
      .map((drink) => ({ drinkId: drink.drinkId, name: drink.name }));
  }

  private async load(user: User): Promise<Client> {
    const client = user.companyId
      ? await this.clientRepository.findOne({
          where: { companyId: user.companyId },
          relations: IMAGE_RELATIONS,
          order: { createdAt: 'ASC' },
        })
      : null;

    if (!client) {
      throw new NotFoundException('This company has no website.');
    }

    return client;
  }

  async update(user: User, dto: UpdateWebsiteDto): Promise<WebsiteDto> {
    const client = await this.load(user);

    if (dto.name !== undefined && dto.name !== '') {
      client.name = dto.name;
    }

    // an empty text removes the value
    for (const field of GENERAL_FIELDS) {
      if (dto[field] !== undefined) {
        client[field] = dto[field] || null;
      }
    }

    if (dto.featured?.drinkIds?.length) {
      await this.assertDrinksBelongToCompany(
        dto.featured.drinkIds,
        client.companyId,
      );
    }

    const sections: ClientSections = { ...client.sections };

    for (const name of SECTION_NAMES) {
      const incoming = dto[name] as Record<string, unknown> | undefined;

      if (!incoming) {
        continue;
      }

      const merged: Record<string, unknown> = {
        ...(sections[name] as Record<string, unknown> | undefined),
      };

      for (const [key, value] of Object.entries(incoming)) {
        if (value === undefined) {
          continue;
        }

        // an empty text or an empty list removes the value (the site uses its default)
        const isEmpty =
          value === '' ||
          value === null ||
          (Array.isArray(value) && !value.length);

        if (isEmpty) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }

      sections[name] = merged;
    }

    client.sections = sections;
    await this.clientRepository.save(client);
    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  /**
   * Saves a picture of the site as a WebP into `<production|local>/company-<name>-<id>/client/<section>/`,
   * the old one is deleted.
   */
  async setImage(
    user: User,
    slot: WebsiteImageSlot,
    file: Express.Multer.File,
    altText?: string,
  ): Promise<WebsiteDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('The image is missing.');
    }

    const client = await this.load(user);
    const config = WEBSITE_SLOT_CONFIG[slot];
    const optimized = await this.imageOptimizer.toWebp(
      file.buffer,
      config.maxSide,
    );
    const company = await this.companiesService.findOne(client.companyId);
    const old = client[config.relation];

    const image = await this.imagesService.create({
      companyId: client.companyId,
      folder: this.storageService.clientFolder(company, config.folder),
      image: optimized,
      altText: altText || client.name,
    });

    try {
      await this.clientRepository.update(
        { clientId: client.clientId },
        { [config.column]: image.imageId },
      );
    } catch (error) {
      await this.imagesService.remove(image);
      throw error;
    }

    if (old) {
      await this.imagesService.remove(old);
    }

    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  async removeImage(user: User, slot: WebsiteImageSlot): Promise<WebsiteDto> {
    const client = await this.load(user);
    const config = WEBSITE_SLOT_CONFIG[slot];
    const old = client[config.relation];

    if (old) {
      await this.clientRepository.update(
        { clientId: client.clientId },
        { [config.column]: null },
      );
      await this.imagesService.remove(old);
    }

    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  /** The messages of the contact form of the site, newest first */
  async findContacts(user: User, query: PaginationQueryDto) {
    const client = await this.load(user);

    return paginate(this.contactRepository, query, {
      where: { clientId: client.clientId },
      order: { createdAt: 'DESC', contactId: 'DESC' },
    });
  }

  /** The picked drinks have to be drinks of the company of the site, not of another one */
  private async assertDrinksBelongToCompany(
    drinkIds: number[],
    companyId: number,
  ) {
    const found = await this.drinkRepository.count({
      where: { drinkId: In(drinkIds), companyId },
    });

    if (found !== drinkIds.length) {
      throw new BadRequestException('One of the picked drinks does not exist.');
    }
  }
}
