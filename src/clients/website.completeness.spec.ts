import { getCompleteness } from '@/clients/website.completeness';
import { Page } from '@/clients/entities/page.entity';

type General = Parameters<typeof getCompleteness>[0];

const general = (): General => ({
  name: 'Drink House',
  city: 'Loznica',
  address: 'Filipa Kljajića 82',
  phone: '+381 15 000 000',
  instagram: 'https://instagram.com/x',
  workingHours: '7-23',
  logoImageId: 1,
});

const section = (
  sectionId: number,
  type: string,
  content: object,
  imageId: number | null = 9,
) => ({ sectionId, type, content, imageId });

const completeSections = () => [
  section(1, 'hero', { title: 't', subtitle: 's', text: 'x', buttonText: 'b' }),
  section(2, 'featured', { title: 't', buttonText: 'b', drinkIds: [1] }, null),
  section(3, 'story', {
    title: 't',
    paragraph1: 'a',
    paragraph2: 'b',
    buttonText: 'c',
  }),
  section(4, 'info', { title: 't', text: 'x', buttonText: 'b' }),
];

const page = (
  pageId: number,
  slug: string,
  sections: object[] = [],
  overrides: object = {},
) =>
  ({
    pageId,
    slug,
    status: 'published',
    seo: { title: 't', description: 'd', imageId: 5 },
    pageSections: sections.map((s) => ({ section: s, isVisible: true })),
    ...overrides,
  }) as unknown as Page;

const completePages = () => [
  page(1, '', completeSections()),
  page(2, 'karta-pica', [], { seo: { title: 'm', description: 'md' } }),
];

describe('getCompleteness', () => {
  it('should say complete when everything is filled in', () => {
    expect(getCompleteness(general(), completePages())).toEqual({
      isComplete: true,
      missing: [],
    });
  });

  it('should need every general info and the logo', () => {
    const result = getCompleteness(
      { ...general(), city: null, phone: '  ', logoImageId: null },
      completePages(),
    );

    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual([
      'general.city',
      'general.phone',
      'general.logo',
    ]);
  });

  it('should list every missing text and picture of a new section', () => {
    const pages = [
      page(1, '', [
        section(7, 'hero', {}, null),
        section(8, 'featured', {}, null),
        section(9, 'info', { title: 't' }, null),
      ]),
    ];

    expect(getCompleteness(general(), pages).missing).toEqual([
      'section.7.title',
      'section.7.subtitle',
      'section.7.text',
      'section.7.buttonText',
      'section.7.image',
      'section.8.title',
      'section.8.buttonText',
      'section.8.drinks',
      'section.9.text',
      'section.9.buttonText',
      'section.9.image',
    ]);
  });

  it('should need the SEO texts of every published page, the picture for sharing only on the home page', () => {
    const pages = [
      page(1, '', [], {
        seo: { title: null, description: 'd', imageId: null },
      }),
      page(3, 'o-nama', [], { seo: { title: 't', description: ' ' } }),
    ];

    expect(getCompleteness(general(), pages).missing).toEqual([
      'page.1.seoTitle',
      'page.1.seoImage',
      'page.3.seoDescription',
    ]);
  });

  it('should not check a draft page or a hidden section', () => {
    const hidden = page(1, '');
    hidden.pageSections = [
      { section: section(7, 'hero', {}, null), isVisible: false },
    ] as never;
    const draft = page(3, 'o-nama', [section(8, 'story', {})], {
      status: 'draft',
      seo: {},
    });

    expect(getCompleteness(general(), [hidden, draft]).missing).toEqual([]);
  });

  it('should need text in a text section, empty paragraphs are not text', () => {
    const pages = [
      page(1, '', [section(7, 'text', { html: '<p></p>' }, null)]),
    ];

    expect(getCompleteness(general(), pages).missing).toEqual([
      'section.7.html',
    ]);
  });

  it('should not need the button text of a hero without a button', () => {
    const pages = [
      page(1, '', [
        section(7, 'hero', {
          title: 't',
          subtitle: 's',
          text: 'x',
          showButton: false,
        }),
      ]),
    ];

    expect(getCompleteness(general(), pages).missing).toEqual([]);
  });

  it('should check a section on more pages once', () => {
    const shared = section(7, 'info', {}, null);
    const pages = [page(1, '', [shared]), page(3, 'o-nama', [shared])];

    expect(
      getCompleteness(general(), pages).missing.filter((key) =>
        key.startsWith('section.7.'),
      ),
    ).toHaveLength(4);
  });
});
