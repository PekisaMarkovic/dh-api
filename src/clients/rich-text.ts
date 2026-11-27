import * as sanitizeHtml from 'sanitize-html';

/** The most characters of the HTML of a text section */
export const RICH_TEXT_MAX = 20000;

/**
 * The HTML of a text section (from the rich text editor, often pasted from another site or Word) with only what the site shows:
 * paragraphs, headings, bold / italic / underline / strike, lists, quotes and links. Everything else (scripts, styles, classes,
 * images, events) is removed, so nothing can run on the public site. Links get rel="noopener noreferrer".
 */
export const sanitizeRichText = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'h2',
      'h3',
      'h4',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'hr',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      // a pasted h1 would be a second title of the page
      h1: 'h2',
    },
  }).trim();

/** The text a person sees, without the tags: empty when the HTML has no text (e.g. `<p></p>`) */
export const visibleText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
