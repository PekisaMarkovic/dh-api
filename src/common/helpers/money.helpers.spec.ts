import {
  lineTotalCents,
  moneyTransformer,
  vatCents,
  vatSummary,
} from '@/common/helpers/money.helpers';

describe('money.helpers', () => {
  describe('moneyTransformer', () => {
    it('should keep a number as it is when it is saved', () => {
      expect(moneyTransformer.to(12.5)).toBe(12.5);
    });

    it('should turn the string of the database into a number', () => {
      expect(moneyTransformer.from('2304.500')).toBe(2304.5);
    });

    it('should keep null', () => {
      expect(moneyTransformer.from(null)).toBeNull();
    });
  });

  describe('lineTotalCents', () => {
    it('should multiply the price with the quantity and return cents', () => {
      expect(lineTotalCents(90, 48)).toBe(432000);
    });

    it('should not lose the third decimal of the price before the rounding', () => {
      // 3308.333 * 3 = 9924.999, which is 992500 cents
      expect(lineTotalCents(3308.333, 3)).toBe(992500);
    });

    it('should not have the 0.1 + 0.2 kind of errors', () => {
      expect(lineTotalCents(0.1, 3)).toBe(30);
      expect(lineTotalCents(0.2, 3)).toBe(60);
    });

    it('should take the discount off the line', () => {
      expect(lineTotalCents(100, 3, 10)).toBe(27000);
    });

    it('should support a discount with two decimals', () => {
      expect(lineTotalCents(100, 1, 12.5)).toBe(8750);
    });

    it('should be 0 with a discount of 100 %', () => {
      expect(lineTotalCents(100, 5, 100)).toBe(0);
    });

    it('should be 0 for a price of 0', () => {
      expect(lineTotalCents(0, 10)).toBe(0);
    });
  });

  describe('vatCents', () => {
    it('should return the VAT that is inside an amount with VAT', () => {
      // 1200 with 20 % VAT: 1000 + 200
      expect(vatCents(120000, 20)).toBe(20000);
    });

    it('should round to cents', () => {
      expect(vatCents(100, 20)).toBe(17);
    });

    it('should be 0 for 0', () => {
      expect(vatCents(0, 20)).toBe(0);
    });
  });

  describe('vatSummary', () => {
    it('should sum the lines and the VAT of every line', () => {
      expect(vatSummary([3970, 5184, 296, 306])).toEqual({
        vatAmount: 1626,
        totalWithVat: 9756,
      });
    });

    it('should return zeros for a proforma without lines', () => {
      expect(vatSummary([])).toEqual({ vatAmount: 0, totalWithVat: 0 });
    });

    it('should make the VAT of the lines add up, not the VAT of the sum', () => {
      // three lines of 0.10: the VAT of every line is 0.02 (rounded), the VAT of 0.30 would be 0.05
      expect(vatSummary([0.1, 0.1, 0.1])).toEqual({
        vatAmount: 0.06,
        totalWithVat: 0.3,
      });
    });
  });
});
