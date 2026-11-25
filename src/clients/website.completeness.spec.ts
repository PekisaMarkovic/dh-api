import { getCompleteness } from '@/clients/website.completeness';
import { Client } from '@/clients/entities/client.entity';

const complete = (): Parameters<typeof getCompleteness>[0] => ({
  name: 'Drink House',
  city: 'Loznica',
  address: 'Filipa Kljajića 82',
  phone: '+381 15 000 000',
  instagram: 'https://instagram.com/x',
  workingHours: '7-23',
  sections: {
    hero: { title: 't', subtitle: 's', text: 'x', buttonText: 'b' },
    featured: { title: 't', buttonText: 'b', drinkIds: [1] },
    story: { title: 't', paragraph1: 'a', paragraph2: 'b', buttonText: 'c' },
    promo: { title: 't', text: 'x', buttonText: 'b' },
  },
  logoImageId: 1,
  heroImageId: 2,
  storyImageId: 3,
  promoImageId: 4,
});

describe('getCompleteness', () => {
  it('should say complete when everything is filled in', () => {
    expect(getCompleteness(complete())).toEqual({
      isComplete: true,
      missing: [],
    });
  });

  it('should list everything that is missing on a new site', () => {
    const result = getCompleteness({
      ...complete(),
      city: null,
      phone: '  ',
      sections: {},
      logoImageId: null,
      heroImageId: null,
      storyImageId: null,
      promoImageId: null,
    } as unknown as Client);

    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        'general.city',
        'general.phone',
        'general.logo',
        'hero.title',
        'hero.image',
        'featured.drinks',
        'story.paragraph1',
        'story.image',
        'promo.text',
        'promo.image',
      ]),
    );
    expect(result.missing).not.toContain('general.name');
  });

  it('should need a picture for the hero, the story and the promo and the logo', () => {
    const result = getCompleteness({
      ...complete(),
      heroImageId: null,
      logoImageId: null,
    } as never);

    expect(result.missing).toEqual(['general.logo', 'hero.image']);
  });

  it('should need at least one recommended drink', () => {
    const c = complete();
    c.sections = {
      ...c.sections,
      featured: { title: 't', buttonText: 'b', drinkIds: [] },
    };

    expect(getCompleteness(c).missing).toEqual(['featured.drinks']);
  });
});
