import { slugify } from '@/common/helpers/slug.helpers';

describe('slugify', () => {
  it('should lowercase the text and join the words with a dash', () => {
    expect(slugify({ text: 'Drink House' })).toBe('drink-house');
  });

  it('should remove diacritics', () => {
    expect(slugify({ text: 'Šljivovica Čačak' })).toBe('sljivovica-cacak');
  });

  it('should remove the characters that are not letters, digits or a dash', () => {
    expect(slugify({ text: 'Fanta 1.5L!' })).toBe('fanta-15l');
  });

  it('should make several spaces or dashes one dash', () => {
    expect(slugify({ text: 'a   b --- c' })).toBe('a-b-c');
  });

  it('should not start or end with a dash', () => {
    expect(slugify({ text: '  -ab-  ' })).toBe('ab');
  });

  it('should cut the text before it is made a slug', () => {
    expect(slugify({ text: 'drink house', truncate: 5 })).toBe('drink');
  });

  it('should not cut a text that is short enough', () => {
    expect(slugify({ text: 'ab', truncate: 5 })).toBe('ab');
  });
});
