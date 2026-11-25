import { Client } from '@/clients/entities/client.entity';

/**
 * What a site needs before it can be published: every general info, the logo, every text of every section,
 * the picture of the hero, the story and the promo, and at least one recommended drink.
 * A missing thing is `<section>.<field>`, e.g. `general.logo`, `hero.image`, `featured.drinks`.
 */
export const REQUIRED_TEXTS = {
  hero: ['title', 'subtitle', 'text', 'buttonText'],
  featured: ['title', 'buttonText'],
  story: ['title', 'paragraph1', 'paragraph2', 'buttonText'],
  promo: ['title', 'text', 'buttonText'],
} as const;

const REQUIRED_GENERAL = [
  'name',
  'city',
  'address',
  'phone',
  'instagram',
  'workingHours',
] as const;

export interface WebsiteCompleteness {
  isComplete: boolean;
  /** what is still missing, `<section>.<field>` */
  missing: string[];
}

const filled = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

export const getCompleteness = (
  client: Pick<
    Client,
    | 'name'
    | 'city'
    | 'address'
    | 'phone'
    | 'instagram'
    | 'workingHours'
    | 'sections'
    | 'logoImageId'
    | 'heroImageId'
    | 'storyImageId'
    | 'promoImageId'
  >,
): WebsiteCompleteness => {
  const missing: string[] = [];

  for (const field of REQUIRED_GENERAL) {
    if (!filled(client[field])) {
      missing.push(`general.${field}`);
    }
  }

  if (!client.logoImageId) {
    missing.push('general.logo');
  }

  const sections = (client.sections ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;

  for (const [section, fields] of Object.entries(REQUIRED_TEXTS)) {
    for (const field of fields) {
      if (!filled(sections[section]?.[field])) {
        missing.push(`${section}.${field}`);
      }
    }
  }

  const pickedDrinks = sections.featured?.drinkIds;

  if (!Array.isArray(pickedDrinks) || !pickedDrinks.length) {
    missing.push('featured.drinks');
  }

  if (!client.heroImageId) missing.push('hero.image');
  if (!client.storyImageId) missing.push('story.image');
  if (!client.promoImageId) missing.push('promo.image');

  return { isComplete: !missing.length, missing };
};
