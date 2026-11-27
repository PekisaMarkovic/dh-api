import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { Page } from '@/clients/entities/page.entity';
import { PublicSiteService } from '@/clients/services/public-site.service';
import { Drink } from '@/drinks/entities/drink.entity';

describe('PublicSiteService', () => {
  let clientRepository: { findOneOrFail: jest.Mock };
  let drinkRepository: { find: jest.Mock };
  let pageRepository: { find: jest.Mock };
  let service: PublicSiteService;

  const full = (overrides: Partial<Client> = {}) =>
    ({
      clientId: 'abc',
      status: 'draft',
      isOrderingAllowed: false,
      companyId: 4,
      name: 'Drink House',
      city: 'Loznica',
      address: 'Filipa Kljajića 82',
      phone: '+381',
      instagram: null,
      workingHours: '7-23',
      logoImage: {
        url: 'https://cdn/logo.webp',
        altText: 'Logo',
        width: 300,
        height: 100,
        key: 'secret',
      },
      ...overrides,
    }) as unknown as Client;

  const section = (sectionId: number, type: string, content = {}) => ({
    sectionId,
    type,
    content,
    image: null,
  });

  const home = (sections: object[]) =>
    ({
      title: 'Početna',
      slug: '',
      seo: {
        title: 'SEO naslov',
        description: null,
        image: {
          url: 'https://cdn/og.webp',
          altText: null,
          width: 1200,
          height: 630,
          key: 'secret2',
        },
      },
      pageSections: sections,
    }) as unknown as Page;

  const drink = (drinkId: number) =>
    ({
      drinkId,
      name: `D${drinkId}`,
      price: 10,
      quantity: 1,
      image: null,
    }) as unknown as Drink;

  const featuredPage = (drinkIds?: number[]) =>
    home([
      {
        isVisible: true,
        section: section(3, 'featured', drinkIds ? { drinkIds } : {}),
      },
    ]);

  beforeEach(() => {
    clientRepository = { findOneOrFail: jest.fn().mockResolvedValue(full()) };
    drinkRepository = {
      find: jest.fn().mockResolvedValue([drink(1), drink(2)]),
    };
    pageRepository = {
      find: jest.fn().mockResolvedValue([
        home([
          { isVisible: true, section: section(1, 'hero', { title: 'Naslov' }) },
          { isVisible: false, section: section(2, 'story') },
        ]),
      ]),
    };
    service = new PublicSiteService(
      clientRepository as unknown as Repository<Client>,
      drinkRepository as unknown as Repository<Drink>,
      pageRepository as unknown as Repository<Page>,
    );
  });

  it('should return the general info and the logo, never the keys of the files', async () => {
    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site).toEqual(
      expect.objectContaining({
        status: 'draft',
        name: 'Drink House',
        city: 'Loznica',
        instagram: null,
        logo: {
          url: 'https://cdn/logo.webp',
          altText: 'Logo',
          width: 300,
          height: 100,
        },
      }),
    );
    expect(JSON.stringify(site)).not.toContain('secret');
  });

  it('should ask only for the published pages of the site, in order', async () => {
    await service.find({ clientId: 'abc' } as Client);

    expect(pageRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'abc', status: 'published' },
        order: expect.objectContaining({
          position: 'ASC',
          pageSections: { position: 'ASC' },
        }),
      }),
    );
  });

  it('should return a page with its SEO and only its shown sections, a text that is not set is null', async () => {
    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.pages).toHaveLength(1);
    expect(site.pages[0].seo).toEqual({
      title: 'SEO naslov',
      description: null,
      image: {
        url: 'https://cdn/og.webp',
        altText: null,
        width: 1200,
        height: 630,
      },
    });
    expect(site.pages[0].sections).toEqual([
      {
        sectionId: 1,
        type: 'hero',
        title: 'Naslov',
        subtitle: null,
        text: null,
        paragraph1: null,
        paragraph2: null,
        buttonText: null,
        html: null,
        image: null,
        drinks: [],
      },
    ]);
  });

  it('should leave out the text of a hidden button', async () => {
    pageRepository.find.mockResolvedValue([
      home([
        {
          isVisible: true,
          section: section(1, 'hero', {
            buttonText: 'Ponuda',
            showButton: false,
          }),
        },
      ]),
    ]);

    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.pages[0].sections[0].buttonText).toBeNull();
  });

  it('should tell the site whether the visitors can order', async () => {
    clientRepository.findOneOrFail.mockResolvedValue(
      full({ isOrderingAllowed: true }),
    );

    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.isOrderingAllowed).toBe(true);
  });

  it('should show the picked drinks in the picked order and skip a missing one', async () => {
    pageRepository.find.mockResolvedValue([featuredPage([2, 1, 99])]);

    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.pages[0].sections[0].drinks.map((d) => d.drinkId)).toEqual([
      2, 1,
    ]);
  });

  it('should show the first drinks of the menu when none were picked', async () => {
    pageRepository.find.mockResolvedValue([featuredPage()]);

    await service.find({ clientId: 'abc' } as Client);

    expect(drinkRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 4 }, take: 6 }),
    );
  });

  it('should show an even number of drinks when a picked one was deleted', async () => {
    pageRepository.find.mockResolvedValue([featuredPage([2, 1, 3, 99])]);
    drinkRepository.find.mockResolvedValue([drink(1), drink(2), drink(3)]);

    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.pages[0].sections[0].drinks.map((d) => d.drinkId)).toEqual([
      2, 1,
    ]);
  });
});
