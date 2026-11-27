import { ClientStatus } from '@/clients/client-status.enum';
import { Client } from '@/clients/entities/client.entity';
import { Page } from '@/clients/entities/page.entity';
import { HOME_SLUG, SECTION_CONFIG } from '@/clients/website.constants';
import { SectionType } from '@/clients/website.types';

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
  /**
   * What is still missing: `general.<field>`, `page.<pageId>.<seoTitle|seoDescription|seoImage>`
   * or `section.<sectionId>.<field|image|drinks>`
   */
  missing: string[];
}

const filled = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * What a site needs before it can be published: every general info and the logo, and on every published page
 * the SEO texts (the home page also the picture for sharing) and everything of every shown section
 * (its texts, its picture, at least one recommended drink). A section on more pages is checked once.
 */
export const getCompleteness = (
  client: Pick<
    Client,
    | 'name'
    | 'city'
    | 'address'
    | 'phone'
    | 'instagram'
    | 'workingHours'
    | 'logoImageId'
  >,
  pages: Page[],
): WebsiteCompleteness => {
  const missing: string[] = [];

  for (const field of REQUIRED_GENERAL) {
    if (!filled(client[field])) missing.push(`general.${field}`);
  }

  if (!client.logoImageId) missing.push('general.logo');

  const checked = new Set<number>();

  for (const page of pages) {
    if (page.status !== ClientStatus.PUBLISHED) continue;

    if (!filled(page.seo?.title)) missing.push(`page.${page.pageId}.seoTitle`);
    if (!filled(page.seo?.description)) {
      missing.push(`page.${page.pageId}.seoDescription`);
    }
    // the other pages are shared with the picture of the home page when they have none
    if (page.slug === HOME_SLUG && !page.seo?.imageId) {
      missing.push(`page.${page.pageId}.seoImage`);
    }

    for (const { section, isVisible } of page.pageSections ?? []) {
      if (!isVisible || !section || checked.has(section.sectionId)) continue;

      checked.add(section.sectionId);

      const config = SECTION_CONFIG[section.type];
      const content = (section.content ?? {}) as Record<string, unknown>;

      for (const field of config.texts) {
        if (!filled(content[field])) {
          missing.push(`section.${section.sectionId}.${field}`);
        }
      }

      if (config.maxSide && !section.imageId) {
        missing.push(`section.${section.sectionId}.image`);
      }

      if (
        section.type === SectionType.FEATURED &&
        !section.content?.drinkIds?.length
      ) {
        missing.push(`section.${section.sectionId}.drinks`);
      }
    }
  }

  return { isComplete: !missing.length, missing };
};
