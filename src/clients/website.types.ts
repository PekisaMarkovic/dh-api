/** The kinds of sections a page of a site can have. The site has one component per kind */
export enum SectionType {
  HERO = 'hero',
  FEATURED = 'featured',
  STORY = 'story',
  INFO = 'info',
  /** free text from the rich text editor (headings, bold, lists, links), e.g. the page "O nama" */
  TEXT = 'text',
  /** the contact (phone, social, map) and the contact form, as at the bottom of the home page */
  CONTACT = 'contact',
}

/** The texts of a section, everything is optional: what is missing the site fills with its own default text */
export interface HeroContent {
  title: string;
  subtitle: string;
  text: string;
  buttonText: string;
  /** the button is shown unless this is false, then it needs no text */
  showButton: boolean;
}

export interface FeaturedContent {
  title: string;
  buttonText: string;
  /** the picked drinks, in this order. Empty = the first drinks of the menu */
  drinkIds: number[];
}

export interface StoryContent {
  title: string;
  paragraph1: string;
  paragraph2: string;
  buttonText: string;
}

export interface InfoContent {
  title: string;
  text: string;
  buttonText: string;
}

export interface TextContent {
  /** sanitized HTML, see rich-text.ts */
  html: string;
}

export type SectionContent = Partial<
  HeroContent & FeaturedContent & StoryContent & InfoContent & TextContent
>;
