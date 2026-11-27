import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Page } from '@/clients/entities/page.entity';
import { PageSection } from '@/clients/entities/page-section.entity';
import { Section } from '@/clients/entities/section.entity';
import { Seo } from '@/clients/entities/seo.entity';
import { SitePagesService } from '@/clients/services/site-pages.service';
import { WebsiteService } from '@/clients/services/website.service';
import { SectionType } from '@/clients/website.types';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';

describe('SitePagesService', () => {
  const user = { userId: 1, companyId: 4 } as User;
  const client = { clientId: 'abc', companyId: 4, name: 'Drink House' };
  let pageRepository: {
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let sectionRepository: {
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let pageSectionRepository: { save: jest.Mock; create: jest.Mock };
  let seoRepository: { update: jest.Mock; delete: jest.Mock };
  let drinkRepository: { count: jest.Mock };
  let manager: { delete: jest.Mock; save: jest.Mock; create: jest.Mock };
  let website: {
    load: jest.Mock;
    findOne: jest.Mock;
    notifySite: jest.Mock;
    replaceImage: jest.Mock;
    deleteImage: jest.Mock;
  };
  let service: SitePagesService;

  const page = (overrides: object = {}) => ({
    pageId: 3,
    clientId: 'abc',
    title: 'O nama',
    slug: 'o-nama',
    status: 'draft',
    seoId: 30,
    seo: { seoId: 30, title: null, description: null, image: null },
    pageSections: [],
    ...overrides,
  });

  const section = (overrides: object = {}) => ({
    sectionId: 7,
    clientId: 'abc',
    type: SectionType.HERO,
    name: 'Hero',
    content: { title: 'Stari', text: 'Tekst' },
    image: null,
    ...overrides,
  });

  beforeEach(() => {
    manager = {
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_e: unknown, v: unknown) => v),
    };
    pageRepository = {
      findOne: jest.fn().mockResolvedValue(page()),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn((e: unknown) => Promise.resolve(e)),
      create: jest.fn((e: unknown) => e),
      delete: jest.fn(),
      manager: {
        transaction: jest.fn((run: (m: unknown) => unknown) => run(manager)),
      },
    };
    sectionRepository = {
      findOne: jest.fn().mockResolvedValue(section()),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn((e: object) => Promise.resolve({ sectionId: 11, ...e })),
      create: jest.fn((e: unknown) => e),
      update: jest.fn(),
      delete: jest.fn(),
    };
    pageSectionRepository = {
      save: jest.fn(),
      create: jest.fn((e: unknown) => e),
    };
    seoRepository = { update: jest.fn(), delete: jest.fn() };
    drinkRepository = { count: jest.fn().mockResolvedValue(2) };
    website = {
      load: jest.fn().mockResolvedValue(client),
      findOne: jest.fn().mockResolvedValue('site'),
      notifySite: jest.fn(),
      replaceImage: jest.fn(),
      deleteImage: jest.fn(),
    };
    service = new SitePagesService(
      pageRepository as unknown as Repository<Page>,
      sectionRepository as unknown as Repository<Section>,
      pageSectionRepository as unknown as Repository<PageSection>,
      seoRepository as unknown as Repository<Seo>,
      drinkRepository as unknown as Repository<Drink>,
      website as unknown as WebsiteService,
    );
  });

  describe('pages', () => {
    it('should make a draft page at the end of the menu, its address from the title', async () => {
      pageRepository.findOne.mockResolvedValue(page({ position: 4 }));

      const site = await service.createPage(user, { title: 'Akcije i ponude' });

      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'abc',
          title: 'Akcije i ponude',
          slug: 'akcije-i-ponude',
          status: 'draft',
          position: 5,
          seo: {},
        }),
      );
      expect(website.notifySite).toHaveBeenCalled();
      expect(site).toBe('site');
    });

    it.each(['', 'karta-pica', 'api'])(
      'should refuse the address %j that the site uses',
      async (slug) => {
        await expect(
          service.createPage(user, { title: 'x', slug }),
        ).rejects.toThrow(BadRequestException);
        expect(pageRepository.save).not.toHaveBeenCalled();
      },
    );

    it('should refuse a title that gives no address', async () => {
      await expect(service.createPage(user, { title: '!!!' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refuse the address of another page', async () => {
      pageRepository.count.mockResolvedValue(1);

      await expect(
        service.createPage(user, { title: 'O nama' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change the title, the address, the status and the SEO texts of a page', async () => {
      await service.updatePage(user, 3, {
        title: 'Ko smo mi',
        slug: 'ko-smo-mi',
        status: 'published' as never,
        seo: { title: 'SEO', description: 'Opis' },
      });

      expect(pageRepository.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ clientId: 'abc', slug: 'ko-smo-mi' }),
      });
      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ko smo mi',
          slug: 'ko-smo-mi',
          status: 'published',
          seo: expect.objectContaining({ title: 'SEO', description: 'Opis' }),
        }),
      );
    });

    it('should keep the address of the home page and the menu and keep them published', async () => {
      pageRepository.findOne.mockResolvedValue(
        page({ slug: 'karta-pica', status: 'published' }),
      );

      await expect(
        service.updatePage(user, 3, { slug: 'meni' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updatePage(user, 3, { status: 'draft' as never }),
      ).rejects.toThrow(BadRequestException);

      // the title and the SEO can be changed
      await service.updatePage(user, 3, { title: 'Meni', slug: 'karta-pica' });
      expect(pageRepository.save).toHaveBeenCalled();
    });

    it('should say 404 for a page of another site', async () => {
      pageRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePage(user, 3, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(pageRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pageId: 3, clientId: 'abc' } }),
      );
    });

    it('should delete a page with its SEO and its picture', async () => {
      const image = { imageId: 5 };
      pageRepository.findOne.mockResolvedValue(
        page({ seo: { seoId: 30, image } }),
      );

      await service.removePage(user, 3);

      expect(pageRepository.delete).toHaveBeenCalledWith({ pageId: 3 });
      expect(seoRepository.delete).toHaveBeenCalledWith({ seoId: 30 });
      expect(website.deleteImage).toHaveBeenCalledWith(
        image,
        expect.any(Function),
      );
    });

    it('should not delete the home page', async () => {
      pageRepository.findOne.mockResolvedValue(page({ slug: '' }));

      await expect(service.removePage(user, 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(pageRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('sections of a page', () => {
    it('should put the sections on the page in the sent order', async () => {
      sectionRepository.count.mockResolvedValue(2);

      await service.setPageSections(user, 3, {
        sections: [
          { sectionId: 8, isVisible: false },
          { sectionId: 7, isVisible: true },
        ],
      });

      expect(manager.delete).toHaveBeenCalledWith(PageSection, { pageId: 3 });
      expect(manager.save).toHaveBeenCalledWith([
        { pageId: 3, sectionId: 8, isVisible: false, position: 0 },
        { pageId: 3, sectionId: 7, isVisible: true, position: 1 },
      ]);
    });

    it('should refuse a section of another site and a section twice', async () => {
      sectionRepository.count.mockResolvedValue(1);

      await expect(
        service.setPageSections(user, 3, {
          sections: [
            { sectionId: 7, isVisible: true },
            { sectionId: 99, isVisible: true },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setPageSections(user, 3, {
          sections: [
            { sectionId: 7, isVisible: true },
            { sectionId: 7, isVisible: false },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('should add a new empty section at the end of the page', async () => {
      pageRepository.findOne.mockResolvedValue(
        page({ pageSections: [{ position: 0 }, { position: 3 }] }),
      );

      await service.createSection(user, 3, { type: SectionType.FEATURED });

      expect(sectionRepository.save).toHaveBeenCalledWith({
        clientId: 'abc',
        type: 'featured',
        name: 'Preporučeno',
        content: {},
      });
      expect(pageSectionRepository.save).toHaveBeenCalledWith({
        pageId: 3,
        sectionId: 11,
        position: 4,
        isVisible: true,
      });
    });
  });

  describe('sections', () => {
    it('should change only the texts of the type of the section and keep the rest', async () => {
      await service.updateSection(user, 7, {
        name: 'Glavni hero',
        title: 'Novi',
        paragraph1: 'not of a hero',
        drinkIds: [1, 2],
      });

      expect(sectionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Glavni hero',
          content: { title: 'Novi', text: 'Tekst' },
        }),
      );
      expect(drinkRepository.count).not.toHaveBeenCalled();
    });

    it('should save the picked drinks of the company', async () => {
      sectionRepository.findOne.mockResolvedValue(
        section({ type: SectionType.FEATURED, content: {} }),
      );

      await service.updateSection(user, 7, { drinkIds: [5, 6] });

      expect(drinkRepository.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ companyId: 4 }),
      });
      expect(sectionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: { drinkIds: [5, 6] } }),
      );
    });

    it('should refuse an odd number of drinks and a drink of another company', async () => {
      sectionRepository.findOne.mockResolvedValue(
        section({ type: SectionType.FEATURED, content: {} }),
      );

      await expect(
        service.updateSection(user, 7, { drinkIds: [5, 6, 7] }),
      ).rejects.toThrow(BadRequestException);

      drinkRepository.count.mockResolvedValue(1);
      await expect(
        service.updateSection(user, 7, { drinkIds: [5, 999] }),
      ).rejects.toThrow(BadRequestException);
      expect(sectionRepository.save).not.toHaveBeenCalled();
    });

    it('should delete a section with its picture', async () => {
      const image = { imageId: 5 };
      sectionRepository.findOne.mockResolvedValue(section({ image }));

      await service.removeSection(user, 7);

      expect(sectionRepository.delete).toHaveBeenCalledWith({ sectionId: 7 });
      expect(website.deleteImage).toHaveBeenCalledWith(
        image,
        expect.any(Function),
      );
    });

    it('should save the picture of a section in the folder of its type, with its size', async () => {
      const file = { buffer: Buffer.from('x') } as Express.Multer.File;
      sectionRepository.findOne.mockResolvedValue(
        section({ type: SectionType.INFO }),
      );

      await service.setSectionImage(user, 7, file, 'alt');

      expect(website.replaceImage).toHaveBeenCalledWith(
        client,
        { folder: 'info', maxSide: 1200, old: null },
        file,
        'alt',
        expect.any(Function),
      );
    });

    it('should refuse a picture for the recommended drinks', async () => {
      sectionRepository.findOne.mockResolvedValue(
        section({ type: SectionType.FEATURED }),
      );

      await expect(
        service.setSectionImage(user, 7, {} as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
      expect(website.replaceImage).not.toHaveBeenCalled();
    });

    it('should say 404 for a section of another site', async () => {
      sectionRepository.findOne.mockResolvedValue(null);

      await expect(service.removeSection(user, 7)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should save the picture for sharing a page in the folder seo', async () => {
      const file = { buffer: Buffer.from('x') } as Express.Multer.File;

      await service.setSeoImage(user, 3, file);

      expect(website.replaceImage).toHaveBeenCalledWith(
        client,
        { folder: 'seo', maxSide: 1200, old: null },
        file,
        undefined,
        expect.any(Function),
      );
    });
  });
});
