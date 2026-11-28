import { cleanItems, composeTitle, purchasePrompt } from '@/ai/ai.types';

const NO_IDS = new Set<number>();

describe('ai.types', () => {
  describe('cleanItems', () => {
    it('should keep only the drinks that were sent to the AI', () => {
      expect(
        cleanItems(
          [
            { name: 'FANTA', quantity: 1, drinkId: 128 },
            { name: 'PEPSI', quantity: 1, drinkId: 999 },
            { name: 'COLA', quantity: 1, drinkId: 0 },
          ],
          new Set([128]),
        ).map((item) => item.drinkId),
      ).toEqual([128, null, null]);
    });

    it('should list the drinks in the prompt', () => {
      const prompt = purchasePrompt([{ drinkId: 128, name: 'FANTA 1.5L' }]);

      expect(prompt).toContain('128: FANTA 1.5L');
      expect(prompt).toContain('drinkId');
    });

    it('should trim the names and keep valid lines', () => {
      expect(
        cleanItems([{ name: '  FANTA 1.5L ', quantity: 2 }], NO_IDS),
      ).toEqual([{ name: 'FANTA 1.5L', quantity: 2, drinkId: null }]);
    });

    it('should cut the decimals of a quantity', () => {
      expect(cleanItems([{ name: 'FANTA', quantity: 2.9 }], NO_IDS)).toEqual([
        { name: 'FANTA', quantity: 2, drinkId: null },
      ]);
    });

    it('should drop the lines without a name', () => {
      expect(
        cleanItems(
          [
            { name: '   ', quantity: 1 },
            { name: 'FANTA', quantity: 1 },
          ],
          NO_IDS,
        ),
      ).toEqual([{ name: 'FANTA', quantity: 1, drinkId: null }]);
    });

    it('should drop the lines with a quantity that is zero, negative or not a number', () => {
      expect(
        cleanItems(
          [
            { name: 'A', quantity: 0 },
            { name: 'B', quantity: -3 },
            { name: 'C', quantity: Number.NaN },
            { name: 'D', quantity: 0.4 },
          ],
          NO_IDS,
        ),
      ).toEqual([]);
    });

    it('should not fail on a line with a missing name', () => {
      expect(
        cleanItems(
          [{ quantity: 1 } as unknown as { name: string; quantity: number }],
          NO_IDS,
        ),
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
