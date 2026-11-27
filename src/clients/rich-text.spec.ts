import { sanitizeRichText, visibleText } from '@/clients/rich-text';

describe('sanitizeRichText', () => {
  it('should keep the formatting the site shows', () => {
    const html =
      '<h2>O nama</h2><p>Mi smo <strong>Drink House</strong>, <em>od 2010.</em></p><ul><li>pivo</li></ul><blockquote>citat</blockquote>';

    expect(sanitizeRichText(html)).toBe(html);
  });

  it('should remove scripts, events, styles and classes', () => {
    expect(
      sanitizeRichText(
        '<p class="x" style="color:red" onclick="alert(1)">Tekst</p><script>alert(1)</script><img src=x onerror=alert(1)>',
      ),
    ).toBe('<p>Tekst</p>');
  });

  it('should keep a safe link and make it noopener, drop a javascript link', () => {
    expect(
      sanitizeRichText(
        '<a href="https://drinkhouse.rs" target="_blank">sajt</a>',
      ),
    ).toBe(
      '<a href="https://drinkhouse.rs" target="_blank" rel="noopener noreferrer">sajt</a>',
    );
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a rel="noopener noreferrer">x</a>',
    );
  });

  it('should make a pasted h1 an h2 (the page has its own title)', () => {
    expect(sanitizeRichText('<h1>Naslov</h1>')).toBe('<h2>Naslov</h2>');
  });
});

describe('visibleText', () => {
  it('should be empty for HTML without text', () => {
    expect(visibleText('<p></p><p>&nbsp;</p>')).toBe('');
    expect(visibleText('<p><strong>a</strong></p>')).toBe('a');
  });
});
