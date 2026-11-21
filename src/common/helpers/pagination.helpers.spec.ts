import { toLikePattern } from '@/common/helpers/pagination.helpers';

describe('toLikePattern', () => {
  it('should put the text between % for a search that contains it', () => {
    expect(toLikePattern('fanta')).toBe('%fanta%');
  });

  it('should remove the spaces around the text', () => {
    expect(toLikePattern('  fanta ')).toBe('%fanta%');
  });

  it('should keep the spaces inside the text', () => {
    expect(toLikePattern('coca cola')).toBe('%coca cola%');
  });

  it('should match % _ and \\ typed by the user literally, they are wildcards in ILIKE', () => {
    expect(toLikePattern('100%')).toBe('%100\\%%');
    expect(toLikePattern('a_b')).toBe('%a\\_b%');
    expect(toLikePattern('a\\b')).toBe('%a\\\\b%');
  });

  it.each([undefined, '', '   '])(
    'should return undefined when there is nothing to search for (%p)',
    (value) => {
      expect(toLikePattern(value)).toBeUndefined();
    },
  );
});
