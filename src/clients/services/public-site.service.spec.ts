import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { PublicSiteService } from '@/clients/services/public-site.service';
import { Drink } from '@/drinks/entities/drink.entity';

describe('PublicSiteService', () => {
  let clientRepository: { findOneOrFail: jest.Mock };
  let drinkRepository: { find: jest.Mock };
  let service: PublicSiteService;

  const full = (overrides: Partial<Client> = {}) =>
    ({
      clientId: 'abc',
      status: 'draft',
      companyId: 4,
      name: 'Drink House',
      city: 'Loznica',
      address: 'Filipa Kljajića 82',
      phone: '+381',
      instagram: null,
      workingHours: '7-23',
      sections: {
        hero: { title: 'Naslov' },
        featured: { drinkIds: [2, 1, 99] },
        seo: { title: 'SEO naslov', menuTitle: 'Karta' },
      },
      logoImage: {
        url: 'https://cdn/logo.webp',
        altText: 'Logo',
        width: 300,
        height: 100,
        key: 'secret',
      },
      heroImage: null,
      storyImage: null,
      promoImage: null,
      ogImage: {
        url: 'https://cdn/og.webp',
        altText: null,
        width: 1200,
        height: 630,
        key: 'secret2',
      },
      ...overrides,
    }) as unknown as Client;

  const drink = (drinkId: number) =>
    ({
      drinkId,
      name: `D${drinkId}`,
      price: 10,
      quantity: 1,
      image: null,
    }) as unknown as Drink;

  beforeEach(() => {
    clientRepository = { findOneOrFail: jest.fn().mockResolvedValue(full()) };
    drinkRepository = {
      find: jest.fn().mockResolvedValue([drink(1), drink(2)]),
    };
    service = new PublicSiteService(
      clientRepository as unknown as Repository<Client>,
      drinkRepository as unknown as Repository<Drink>,
    );
  });

  it('should return the general info, the texts (null when not set) and the pictures', async () => {
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
    expect(site.hero).toEqual({
      title: 'Naslov',
      subtitle: null,
      text: null,
      buttonText: null,
      image: null,
    });
    expect(site.story.title).toBeNull();
    expect(site.seo).toEqual({
      title: 'SEO naslov',
      description: null,
      menuTitle: 'Karta',
      menuDescription: null,
      image: {
        url: 'https://cdn/og.webp',
        altText: null,
        width: 1200,
        height: 630,
      },
    });
    expect(JSON.stringify(site)).not.toContain('secret');
  });

  it('should show the picked drinks in the picked order and skip a missing one', async () => {
    const site = await service.find({ clientId: 'abc' } as Client);

    expect(site.featured.drinks.map((d) => d.drinkId)).toEqual([2, 1]);
  });

  it('should show the first drinks of the menu when none were picked', async () => {
    clientRepository.findOneOrFail.mockResolvedValue(full({ sections: {} }));

    await service.find({ clientId: 'abc' } as Client);

    expect(drinkRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 4 }, take: 5 }),
    );
  });
});
