/** The state of a white label site: it is a draft until the admin publishes it (only a complete site can be published) */
export enum ClientStatus {
  /** the site shows a "coming soon" page and is hidden from Google */
  DRAFT = 'draft',
  PUBLISHED = 'published',
}
