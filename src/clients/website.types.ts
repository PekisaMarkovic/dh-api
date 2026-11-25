/** The texts of the sections of a site. Everything is optional: what is missing the site fills with its own default text */
export interface HeroSection {
  title: string;
  subtitle: string;
  text: string;
  buttonText: string;
}

export interface FeaturedSection {
  title: string;
  buttonText: string;
  /** the picked drinks, in this order. Empty = the first drinks of the menu */
  drinkIds: number[];
}

export interface StorySection {
  title: string;
  paragraph1: string;
  paragraph2: string;
  buttonText: string;
}

export interface PromoSection {
  title: string;
  text: string;
  buttonText: string;
}

export interface ClientSections {
  hero?: Partial<HeroSection>;
  featured?: Partial<FeaturedSection>;
  story?: Partial<StorySection>;
  promo?: Partial<PromoSection>;
}

export type SectionName = keyof ClientSections;
