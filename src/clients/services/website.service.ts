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
import { Page } from '@/clients/entities/page.entity';
import { Section } from '@/clients/entities/section.entity';
import {
  getCompleteness,
  WebsiteCompleteness,
} from '@/clients/website.completeness';
import {
  DEFAULT_PAGES,
  CLIENT_IMAGE_CONFIG,
  ClientImageSlot,
} from '@/clients/website.constants';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { Drink } from '@/drinks/entities/drink.entity';
import { SiteRevalidationService } from '@/clients/services/site-revalidation.service';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';
import { ImagesService } from '@/storage/services/images.service';
import { StorageService } from '@/storage/services/storage.service';
import { Image } from '@/storage/entities/image.entity';
import { User } from '@/users/entities/user.entity';

const GENERAL_FIELDS = [
  'city',
  'address',
  'phone',
  'instagram',
  'workingHours',
] as const;

export interface WebsitePageDto {
  pageId: number;
  title: string;
  slug: string;
  status: ClientStatus;
  isInMenu: boolean;
  position: number;
  seo: {
    title: string | null;
    description: string | null;
    image: Image | null;
  };
  /** the sections of the page in their order */
  sections: { sectionId: number; position: number; isVisible: boolean }[];
}

export type WebsiteSectionDto = Section & {
  /** the picked recommended drinks with their names and images (only for the recommended drinks) */
  drinks: { drinkId: number; name: string; imageUrl: string | null }[];
};

/** The site as the dashboard gets it: the general info, every page with its sections and every section of the site */
export type WebsiteDto = Client & {
  pages: WebsitePageDto[];
  sections: WebsiteSectionDto[];
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
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    private readonly companiesService: CompaniesService,
    private readonly storageService: StorageService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly imagesService: ImagesService,
    private readonly siteRevalidation: SiteRevalidationService,
  ) {}

  /**
   * The site of the company of the user with its pages and sections (a company can have more sites, the oldest one is managed).
   * @throws NotFoundException if the company has no site: it is not a white label company
   */
  async findOne(user: User): Promise<WebsiteDto> {
    const client = await this.load(user);
    const pages = await this.findPages(client.clientId);
    const sections = await this.sectionRepository.find({
      where: { clientId: client.clientId },
      relations: { image: true },
      order: { sectionId: 'ASC' },
    });

    return {
      ...client,
      pages: pages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        slug: page.slug,
        status: page.status,
        isInMenu: page.isInMenu,
        position: page.position,
        seo: {
          title: page.seo.title,
          description: page.seo.description,
          image: page.seo.image,
        },
        sections: page.pageSections.map(
          ({ sectionId, position, isVisible }) => ({
            sectionId,
            position,
            isVisible,
          }),
        ),
      })),
      sections: await this.withDrinks(client.companyId, sections),
      completeness: getCompleteness(client, pages),
    };
  }

  /**
   * Publishes the site: it shows to everyone and Google can index it. Only a complete site can be published.
   * @throws BadRequestException with what is missing
   */
  async publish(user: User): Promise<WebsiteDto> {
    const client = await this.load(user);
    const pages = await this.findPages(client.clientId);
    const { isComplete, missing } = getCompleteness(client, pages);

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

  /** The pages of the site in the order of the menu, with their SEO and their sections in order */
  findPages(clientId: string): Promise<Page[]> {
    return this.pageRepository.find({
      where: { clientId },
      relations: { seo: { image: true }, pageSections: { section: true } },
      order: {
        position: 'ASC',
        pageId: 'ASC',
        pageSections: { position: 'ASC' },
      },
    });
  }

  /** The names and images of the picked drinks of every recommended drinks section, in the picked order (a deleted drink is skipped) */
  private async withDrinks(
    companyId: number,
    sections: Section[],
  ): Promise<WebsiteSectionDto[]> {
    const ids = sections.flatMap((section) => section.content?.drinkIds ?? []);
    const drinks = ids.length
      ? await this.drinkRepository.find({
          where: { drinkId: In(ids), companyId },
        })
      : [];
    const byId = new Map(drinks.map((drink) => [drink.drinkId, drink]));

    return sections.map((section) => ({
      ...section,
      drinks: (section.content?.drinkIds ?? [])
        .map((id) => byId.get(id))
        .filter((drink): drink is Drink => !!drink)
        .map((drink) => ({
          drinkId: drink.drinkId,
          name: drink.name,
          imageUrl: drink.image?.url ?? null,
        })),
    }));
  }

  /** The site of the company of the user; a site without pages (made by hand in the database) gets the home page and the menu */
  async load(user: User): Promise<Client> {
    const client = user.companyId
      ? await this.clientRepository.findOne({
          where: { companyId: user.companyId },
          relations: { logoImage: true, mapImage: true },
          order: { createdAt: 'ASC' },
        })
      : null;

    if (!client) {
      throw new NotFoundException('This company has no website.');
    }

    if (
      !(await this.pageRepository.count({
        where: { clientId: client.clientId },
      }))
    ) {
      await this.pageRepository.save(
        DEFAULT_PAGES.map(({ slug, title, isInMenu }, position) =>
          this.pageRepository.create({
            clientId: client.clientId,
            slug,
            title,
            isInMenu,
            position,
            status: ClientStatus.PUBLISHED,
            seo: {},
          }),
        ),
      );
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

    await this.clientRepository.save(client);
    await this.siteRevalidation.notify();

    return this.findOne(user);
  }

  /**
   * Saves a picture as a WebP into `<production|local>/company-<name>-<id>/client/<folder>/`, points `save` to it
   * and deletes the old one. The new file is deleted again when it can not be pointed to.
   */
  async replaceImage(
    client: Client,
    target: { folder: string; maxSide: number; old: Image | null },
    file: Express.Multer.File,
    altText: string | undefined,
    save: (imageId: number) => Promise<unknown>,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('The image is missing.');
    }

    const optimized = await this.imageOptimizer.toWebp(
      file.buffer,
      target.maxSide,
    );
    const company = await this.companiesService.findOne(client.companyId);
    const image = await this.imagesService.create({
      companyId: client.companyId,
      folder: this.storageService.clientFolder(company, target.folder),
      image: optimized,
      altText: altText || client.name,
    });

    try {
      await save(image.imageId);
    } catch (error) {
      await this.imagesService.remove(image);
      throw error;
    }

    if (target.old) {
      await this.imagesService.remove(target.old);
    }

    await this.siteRevalidation.notify();
  }

  /** the site loads its content again */
  notifySite() {
    return this.siteRevalidation.notify();
  }

  /** Deletes a picture after `clear` stopped pointing to it */
  async deleteImage(old: Image | null, clear: () => Promise<unknown>) {
    if (old) {
      await clear();
      await this.imagesService.remove(old);
    }

    await this.siteRevalidation.notify();
  }

  /** The logo or the picture of the map of the site, saved as a WebP; the old one is deleted */
  async setImage(
    user: User,
    slot: ClientImageSlot,
    file: Express.Multer.File,
    altText?: string,
  ): Promise<WebsiteDto> {
    const client = await this.load(user);
    const { column, relation, folder, maxSide } = CLIENT_IMAGE_CONFIG[slot];

    await this.replaceImage(
      client,
      { folder, maxSide, old: client[relation] },
      file,
      altText,
      (imageId) =>
        this.clientRepository.update(
          { clientId: client.clientId },
          { [column]: imageId },
        ),
    );

    return this.findOne(user);
  }

  async removeImage(user: User, slot: ClientImageSlot): Promise<WebsiteDto> {
    const client = await this.load(user);
    const { column, relation } = CLIENT_IMAGE_CONFIG[slot];

    await this.deleteImage(client[relation], () =>
      this.clientRepository.update(
        { clientId: client.clientId },
        { [column]: null },
      ),
    );

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
}
