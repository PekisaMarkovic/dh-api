/** The pictures of a white label site. Every slot is one image, it has its own folder in the bucket and its own size limit */
export const WEBSITE_IMAGE_SLOTS = [
  'logo',
  'hero',
  'story',
  'promo',
  'og',
] as const;
export type WebsiteImageSlot = (typeof WEBSITE_IMAGE_SLOTS)[number];

export const WEBSITE_SLOT_CONFIG: Record<
  WebsiteImageSlot,
  {
    /** the column of `clients` that points to the image */
    column:
      | 'logoImageId'
      | 'heroImageId'
      | 'storyImageId'
      | 'promoImageId'
      | 'ogImageId';
    /** the relation of `clients` with the image */
    relation:
      | 'logoImage'
      | 'heroImage'
      | 'storyImage'
      | 'promoImage'
      | 'ogImage';
    /** the folder in `<root>/company-<name>-<id>/client/<folder>` */
    folder: 'general' | 'hero' | 'story' | 'promo' | 'seo';
    /** the biggest side in pixels, a bigger image is made smaller */
    maxSide: number;
  }
> = {
  logo: {
    column: 'logoImageId',
    relation: 'logoImage',
    folder: 'general',
    maxSide: 600,
  },
  hero: {
    column: 'heroImageId',
    relation: 'heroImage',
    folder: 'hero',
    maxSide: 2000,
  },
  story: {
    column: 'storyImageId',
    relation: 'storyImage',
    folder: 'story',
    maxSide: 1200,
  },
  promo: {
    column: 'promoImageId',
    relation: 'promoImage',
    folder: 'promo',
    maxSide: 1200,
  },
  // the picture shown when the site is shared (Facebook, Viber, WhatsApp, Google): 1200 x 630
  og: {
    column: 'ogImageId',
    relation: 'ogImage',
    folder: 'seo',
    maxSide: 1200,
  },
};

export const MAX_FEATURED_DRINKS = 10;
/** how many drinks the "from our offer" section shows when none were picked (even, the site shows them in pairs) */
export const DEFAULT_FEATURED_DRINKS = 6;

/** The site shows the recommended drinks in pairs: an odd list loses its last drink (a single drink stays) */
export const evenFeatured = <T>(drinks: T[]): T[] =>
  drinks.length > 1
    ? drinks.slice(0, drinks.length - (drinks.length % 2))
    : drinks;
