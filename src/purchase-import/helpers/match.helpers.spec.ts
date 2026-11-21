import {
  findBestMatch,
  nameSimilarity,
  toTokens,
} from '@/purchase-import/helpers/match.helpers';

describe('match.helpers', () => {
  describe('toTokens', () => {
    it('should lowercase and split the text on everything that is not a letter or a digit', () => {
      expect(toTokens('Coca-Cola 1,5L')).toEqual(['coca', 'cola', '1', '5l']);
    });

    it('should remove diacritics', () => {
      expect(toTokens('ŠLJIVOVICA ČAČAK')).toEqual(['sljivovica', 'cacak']);
    });

    it('should turn đ into dj', () => {
      expect(toTokens('CEDEVITA POMORANĐA')).toEqual([
        'cedevita',
        'pomorandja',
      ]);
    });

    it('should return an empty list for an empty text', () => {
      expect(toTokens('  --  ')).toEqual([]);
    });
  });

  describe('nameSimilarity', () => {
    it('should be 1 for the same name', () => {
      expect(nameSimilarity('FANTA 1.5L', 'FANTA 1.5L')).toBe(1);
    });

    it('should not depend on the order of the words, the case or the diacritics', () => {
      expect(nameSimilarity('1.5L fanta', 'FANTA 1.5L')).toBe(1);
      expect(nameSimilarity('šljivovica 0.7L', 'SLJIVOVICA 0.7L')).toBe(1);
    });

    it('should be between 0 and 1 when only a part of the name is shared', () => {
      // "fanta" is shared, "1" and "5l" are not
      expect(nameSimilarity('FANTA 1.5L', 'FANTA 0.25L')).toBeCloseTo(1 / 3);
    });

    it('should be 0 when nothing is shared', () => {
      expect(nameSimilarity('FANTA', 'TUBORG')).toBe(0);
    });

    it('should be 0 when one of the names has no words', () => {
      expect(nameSimilarity('', 'FANTA')).toBe(0);
      expect(nameSimilarity('FANTA', '--')).toBe(0);
    });
  });

  describe('findBestMatch', () => {
    const drinks = [
      { drinkId: 1, name: 'FANTA 0.25L LIM' },
      { drinkId: 2, name: 'FANTA 1.5L' },
      { drinkId: 3, name: 'TUBORG 0.33L' },
    ];

    it('should return the drink with the most similar name', () => {
      expect(findBestMatch('Fanta 1,5L', drinks)).toBe(drinks[1]);
    });

    it('should return null when no drink is similar enough', () => {
      expect(findBestMatch('HENNESSY VS 0.7L', drinks)).toBeNull();
    });

    it('should return null when there are no drinks', () => {
      expect(findBestMatch('FANTA 1.5L', [])).toBeNull();
    });

    it('should respect the minimal score', () => {
      // 1 of 3 words is shared: 0.33, below the default 0.6 but above 0.3
      expect(findBestMatch('FANTA 2L LIM', [drinks[1]])).toBeNull();
      expect(findBestMatch('FANTA 2L LIM', [drinks[1]], 0.3)).toBe(drinks[1]);
    });
  });
});
