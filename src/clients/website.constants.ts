import { SectionType } from '@/clients/website.types';

/** The address of the home page and of the drinks menu. Every site has both, they can not be deleted or moved */
export const HOME_SLUG = '';
export const MENU_SLUG = 'karta-pica';
/** the addresses the site already uses for something else */
export const RESERVED_SLUGS = [HOME_SLUG, MENU_SLUG, 'api'];
export const isSystemSlug = (slug: string) =>
  slug === HOME_SLUG || slug === MENU_SLUG;
/** lowercase letters, digits and single dashes, e.g. o-nama */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The pages a site starts with */
export const DEFAULT_PAGES = [
  { slug: HOME_SLUG, title: 'Početna' },
  { slug: MENU_SLUG, title: 'Karta pića' },
] as const;

/** What a section of each kind has: its texts, whether it has a picture and how big it is saved */
export const SECTION_CONFIG: Record<
  SectionType,
  {
    texts: readonly string[];
    /** the biggest side of the picture in pixels, null = the section has no picture */
    maxSide: number | null;
  }
> = {
  [SectionType.HERO]: {
    texts: ['title', 'subtitle', 'text', 'buttonText'],
    maxSide: 2000,
  },
  [SectionType.FEATURED]: { texts: ['title', 'buttonText'], maxSide: null },
  [SectionType.STORY]: {
    texts: ['title', 'paragraph1', 'paragraph2', 'buttonText'],
    maxSide: 1200,
  },
  [SectionType.INFO]: {
    texts: ['title', 'text', 'buttonText'],
    maxSide: 1200,
  },
};

/** the folder of the logo and of the pictures shown when a page is shared, in `<root>/company-<name>-<id>/client/<folder>` */
export const LOGO_FOLDER = 'general';
export const LOGO_MAX_SIDE = 600;
export const SEO_FOLDER = 'seo';
// shared pictures are 1200 x 630
export const SEO_MAX_SIDE = 1200;

export const MAX_FEATURED_DRINKS = 10;
/** how many drinks the "from our offer" section shows when none were picked (even, the site shows them in pairs) */
export const DEFAULT_FEATURED_DRINKS = 6;

/** The site shows the recommended drinks in pairs: an odd list loses its last drink (a single drink stays) */
export const evenFeatured = <T>(drinks: T[]): T[] =>
  drinks.length > 1
    ? drinks.slice(0, drinks.length - (drinks.length % 2))
    : drinks;
