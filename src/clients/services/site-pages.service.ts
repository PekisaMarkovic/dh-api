import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  CreatePageDto,
  CreateSectionDto,
  SetPageSectionsDto,
  UpdatePageDto,
  UpdateSectionDto,
} from '@/clients/dto/site-pages.dto';
import { ClientStatus } from '@/clients/client-status.enum';
import { Client } from '@/clients/entities/client.entity';
import { Page } from '@/clients/entities/page.entity';
import { PageSection } from '@/clients/entities/page-section.entity';
import { Section } from '@/clients/entities/section.entity';
import { Seo } from '@/clients/entities/seo.entity';
import {
  isSystemSlug,
  RESERVED_SLUGS,
  SECTION_CONFIG,
  SEO_FOLDER,
  SEO_MAX_SIDE,
} from '@/clients/website.constants';
import { SectionContent, SectionType } from '@/clients/website.types';
import { WebsiteDto, WebsiteService } from '@/clients/services/website.service';
import { slugify } from '@/common/helpers/slug.helpers';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';

/** The name a new section gets in the dashboard */
const DEFAULT_SECTION_NAMES: Record<SectionType, string> = {
  [SectionType.HERO]: 'Hero',
  [SectionType.FEATURED]: 'Preporučeno',
  [SectionType.STORY]: 'Priča',
  [SectionType.INFO]: 'Info',
};

/** The pages of a site and their sections (the dashboard page "Web sajt"). Every change answers with the whole site */
@Injectable()
export class SitePagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(PageSection)
    private readonly pageSectionRepository: Repository<PageSection>,
    @InjectRepository(Seo)
    private readonly seoRepository: Repository<Seo>,
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    private readonly websiteService: WebsiteService,
  ) {}

  /** A new page is a draft at the end of the menu, its address is made from the title when none is given */
  async createPage(user: User, dto: CreatePageDto): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const slug = dto.slug ?? slugify({ text: dto.title, truncate: 100 });

    await this.assertSlugFree(client.clientId, slug);

    const last = await this.pageRepository.findOne({
      where: { clientId: client.clientId },
      order: { position: 'DESC' },
    });

    await this.pageRepository.save(
      this.pageRepository.create({
        clientId: client.clientId,
        title: dto.title,
        slug,
        status: ClientStatus.DRAFT,
        position: (last?.position ?? -1) + 1,
        seo: {},
      }),
    );

    return this.done(user);
  }

  /** The home page and the menu keep their address and are always published */
  async updatePage(
    user: User,
    pageId: number,
    dto: UpdatePageDto,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);
    const isSystem = isSystemSlug(page.slug);

    if (dto.slug !== undefined && dto.slug !== page.slug) {
      if (isSystem) {
        throw new BadRequestException(
          'The address of this page can not be changed.',
        );
      }

      await this.assertSlugFree(client.clientId, dto.slug, page.pageId);
      page.slug = dto.slug;
    }

    if (dto.status !== undefined && dto.status !== page.status) {
      if (isSystem) {
        throw new BadRequestException('This page is always published.');
      }

      page.status = dto.status;
    }

    if (dto.title !== undefined) page.title = dto.title;
    if (dto.seo?.title !== undefined) page.seo.title = dto.seo.title;
    if (dto.seo?.description !== undefined) {
      page.seo.description = dto.seo.description;
    }

    await this.pageRepository.save(page);

    return this.done(user);
  }

  /** The sections of the page stay on the site (they can be on other pages or added again) */
  async removePage(user: User, pageId: number): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);

    if (isSystemSlug(page.slug)) {
      throw new BadRequestException('This page can not be deleted.');
    }

    await this.pageRepository.delete({ pageId: page.pageId });
    await this.websiteService.deleteImage(page.seo.image, () =>
      Promise.resolve(),
    );
    await this.seoRepository.delete({ seoId: page.seoId });

    return this.done(user);
  }

  /** Puts the sections on the page in this order with this visibility, the sections left out are taken off the page */
  async setPageSections(
    user: User,
    pageId: number,
    dto: SetPageSectionsDto,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);
    const ids = dto.sections.map((item) => item.sectionId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A section can be on a page only once.');
    }

    const found = ids.length
      ? await this.sectionRepository.count({
          where: { sectionId: In(ids), clientId: client.clientId },
        })
      : 0;

    if (found !== ids.length) {
      throw new BadRequestException('One of the sections does not exist.');
    }

    await this.pageRepository.manager.transaction(async (manager) => {
      await manager.delete(PageSection, { pageId: page.pageId });
      await manager.save(
        dto.sections.map(({ sectionId, isVisible }, position) =>
          manager.create(PageSection, {
            pageId: page.pageId,
            sectionId,
            isVisible,
            position,
          }),
        ),
      );
    });

    return this.done(user);
  }

  /** A new empty section, shown at the end of the page */
  async createSection(
    user: User,
    pageId: number,
    dto: CreateSectionDto,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);
    const section = await this.sectionRepository.save(
      this.sectionRepository.create({
        clientId: client.clientId,
        type: dto.type,
        name: dto.name ?? DEFAULT_SECTION_NAMES[dto.type],
        content: {},
      }),
    );
    const position = page.pageSections.length
      ? Math.max(...page.pageSections.map((item) => item.position)) + 1
      : 0;

    await this.pageSectionRepository.save(
      this.pageSectionRepository.create({
        pageId: page.pageId,
        sectionId: section.sectionId,
        position,
        isVisible: true,
      }),
    );

    return this.done(user);
  }

  /** Changes the name and the texts of a section; a text that is not of its type is ignored */
  async updateSection(
    user: User,
    sectionId: number,
    dto: UpdateSectionDto,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const section = await this.findSection(client, sectionId);
    const content: SectionContent = { ...section.content };

    for (const field of SECTION_CONFIG[section.type].texts) {
      const value = dto[field as keyof UpdateSectionDto];

      if (typeof value === 'string') {
        (content as Record<string, unknown>)[field] = value;
      }
    }

    if (section.type === SectionType.FEATURED && dto.drinkIds) {
      // the site shows the recommended drinks in pairs
      if (dto.drinkIds.length % 2) {
        throw new BadRequestException(
          'Pick an even number of drinks (2, 4, 6, 8 or 10).',
        );
      }

      const found = await this.drinkRepository.count({
        where: { drinkId: In(dto.drinkIds), companyId: client.companyId },
      });

      if (found !== dto.drinkIds.length) {
        throw new BadRequestException(
          'One of the picked drinks does not exist.',
        );
      }

      content.drinkIds = dto.drinkIds;
    }

    if (dto.name !== undefined) section.name = dto.name;
    section.content = content;
    await this.sectionRepository.save(section);

    return this.done(user);
  }

  /** Deletes the section from every page it is on */
  async removeSection(user: User, sectionId: number): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const section = await this.findSection(client, sectionId);

    await this.sectionRepository.delete({ sectionId: section.sectionId });
    await this.websiteService.deleteImage(section.image, () =>
      Promise.resolve(),
    );

    return this.done(user);
  }

  async setSectionImage(
    user: User,
    sectionId: number,
    file: Express.Multer.File,
    altText?: string,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const section = await this.findSection(client, sectionId);
    const { maxSide } = SECTION_CONFIG[section.type];

    if (!maxSide) {
      throw new BadRequestException('This section has no picture.');
    }

    await this.websiteService.replaceImage(
      client,
      { folder: section.type, maxSide, old: section.image },
      file,
      altText,
      (imageId) =>
        this.sectionRepository.update(
          { sectionId: section.sectionId },
          { imageId },
        ),
    );

    return this.findOne(user);
  }

  async removeSectionImage(user: User, sectionId: number): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const section = await this.findSection(client, sectionId);

    await this.websiteService.deleteImage(section.image, () =>
      this.sectionRepository.update(
        { sectionId: section.sectionId },
        { imageId: null },
      ),
    );

    return this.findOne(user);
  }

  /** The picture shown when the page is shared */
  async setSeoImage(
    user: User,
    pageId: number,
    file: Express.Multer.File,
    altText?: string,
  ): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);

    await this.websiteService.replaceImage(
      client,
      { folder: SEO_FOLDER, maxSide: SEO_MAX_SIDE, old: page.seo.image },
      file,
      altText,
      (imageId) =>
        this.seoRepository.update({ seoId: page.seoId }, { imageId }),
    );

    return this.findOne(user);
  }

  async removeSeoImage(user: User, pageId: number): Promise<WebsiteDto> {
    const client = await this.websiteService.load(user);
    const page = await this.findPage(client, pageId);

    await this.websiteService.deleteImage(page.seo.image, () =>
      this.seoRepository.update({ seoId: page.seoId }, { imageId: null }),
    );

    return this.findOne(user);
  }

  private findOne(user: User) {
    return this.websiteService.findOne(user);
  }

  /** after a change of the texts the site loads them again */
  private async done(user: User) {
    await this.websiteService.notifySite();

    return this.findOne(user);
  }

  /** @throws NotFoundException if the page is missing or is of another site */
  private async findPage(client: Client, pageId: number): Promise<Page> {
    const page = await this.pageRepository.findOne({
      where: { pageId, clientId: client.clientId },
      relations: { seo: { image: true }, pageSections: true },
    });

    if (!page) {
      throw new NotFoundException('The page does not exist.');
    }

    return page;
  }

  /** @throws NotFoundException if the section is missing or is of another site */
  private async findSection(
    client: Client,
    sectionId: number,
  ): Promise<Section> {
    const section = await this.sectionRepository.findOne({
      where: { sectionId, clientId: client.clientId },
      relations: { image: true },
    });

    if (!section) {
      throw new NotFoundException('The section does not exist.');
    }

    return section;
  }

  /** @throws BadRequestException if the address is used by the site or by another page */
  private async assertSlugFree(
    clientId: string,
    slug: string,
    exceptPageId?: number,
  ) {
    if (!slug || RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException('This address can not be used.');
    }

    const taken = await this.pageRepository.count({
      where: {
        clientId,
        slug,
        ...(exceptPageId && { pageId: Not(exceptPageId) }),
      },
    });

    if (taken) {
      throw new BadRequestException('Another page has this address.');
    }
  }
}
