/** The pictures of a white label site. Every slot is one image, it has its own folder in the bucket and its own size limit */
export const WEBSITE_IMAGE_SLOTS = ['logo', 'hero', 'story', 'promo'] as const;
export type WebsiteImageSlot = (typeof WEBSITE_IMAGE_SLOTS)[number];

export const WEBSITE_SLOT_CONFIG: Record<
  WebsiteImageSlot,
  {
    /** the column of `clients` that points to the image */
    column: 'logoImageId' | 'heroImageId' | 'storyImageId' | 'promoImageId';
    /** the relation of `clients` with the image */
    relation: 'logoImage' | 'heroImage' | 'storyImage' | 'promoImage';
    /** the folder in `<root>/company-<name>-<id>/client/<folder>` */
    folder: 'general' | 'hero' | 'story' | 'promo';
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
};

export const MAX_FEATURED_DRINKS = 10;
/** how many drinks the "from our offer" section shows when none were picked */
export const DEFAULT_FEATURED_DRINKS = 5;
