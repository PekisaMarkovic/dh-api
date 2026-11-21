import { cleanItems, composeTitle } from '@/ai/ai.types';

describe('ai.types', () => {
  describe('cleanItems', () => {
    it('should trim the names and keep valid lines', () => {
      expect(cleanItems([{ name: '  FANTA 1.5L ', quantity: 2 }])).toEqual([
        { name: 'FANTA 1.5L', quantity: 2 },
      ]);
    });

    it('should cut the decimals of a quantity', () => {
      expect(cleanItems([{ name: 'FANTA', quantity: 2.9 }])).toEqual([
        { name: 'FANTA', quantity: 2 },
      ]);
    });

    it('should drop the lines without a name', () => {
      expect(
        cleanItems([
          { name: '   ', quantity: 1 },
          { name: 'FANTA', quantity: 1 },
        ]),
      ).toEqual([{ name: 'FANTA', quantity: 1 }]);
    });

    it('should drop the lines with a quantity that is zero, negative or not a number', () => {
      expect(
        cleanItems([
          { name: 'A', quantity: 0 },
          { name: 'B', quantity: -3 },
          { name: 'C', quantity: Number.NaN },
          { name: 'D', quantity: 0.4 },
        ]),
      ).toEqual([]);
    });

    it('should not fail on a line with a missing name', () => {
      expect(
        cleanItems([
          { quantity: 1 } as unknown as { name: string; quantity: number },
        ]),
      ).toEqual([]);
    });
  });

  describe('composeTitle', () => {
    it('should join the buyer, the kind and the number of the document', () => {
      expect(
        composeTitle({
          buyerName: 'PRIVATNA ZURKA',
          documentType: 'Predracun',
          documentNumber: '40/26',
        }),
      ).toBe('PRIVATNA ZURKA Predracun 40/26');
    });

    it('should leave out what is missing', () => {
      expect(
        composeTitle({
          buyerName: '',
          documentType: 'Predracun',
          documentNumber: '40/26',
        }),
      ).toBe('Predracun 40/26');
      expect(composeTitle({ documentNumber: ' 40/26 ' })).toBe('40/26');
    });

    it('should return null when there is nothing', () => {
      expect(composeTitle({})).toBeNull();
      expect(
        composeTitle({ buyerName: ' ', documentType: '', documentNumber: '' }),
      ).toBeNull();
    });
  });
});
