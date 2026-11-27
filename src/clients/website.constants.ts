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

/** The pages a site starts with (the logo leads to the home page, so it is not in the menu) */
export const DEFAULT_PAGES = [
  { slug: HOME_SLUG, title: 'Početna', isInMenu: false },
  { slug: MENU_SLUG, title: 'Karta pića', isInMenu: true },
] as const;

/** The most pages in the main menu of the site, the other published pages are in the footer */
export const MAX_MENU_PAGES = 5;

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
  [SectionType.TEXT]: { texts: ['html'], maxSide: null },
};

/** The pictures of the site itself (not of a page or a section), each is a column of `clients` */
export const CLIENT_IMAGE_SLOTS = ['logo', 'map'] as const;
export type ClientImageSlot = (typeof CLIENT_IMAGE_SLOTS)[number];

export const CLIENT_IMAGE_CONFIG: Record<
  ClientImageSlot,
  {
    column: 'logoImageId' | 'mapImageId';
    relation: 'logoImage' | 'mapImage';
    /** the folder in `<root>/company-<name>-<id>/client/<folder>` */
    folder: string;
    /** the biggest side in pixels */
    maxSide: number;
  }
> = {
  logo: {
    column: 'logoImageId',
    relation: 'logoImage',
    folder: 'general',
    maxSide: 600,
  },
  // optional: a picture of the map shown instead of the Google map until the visitor accepts its cookies
  map: {
    column: 'mapImageId',
    relation: 'mapImage',
    folder: 'general',
    maxSide: 1200,
  },
};

/** the folder of the pictures shown when a page is shared */
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
