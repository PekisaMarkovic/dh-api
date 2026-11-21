import { getStockLevel } from '@/stock-alerts/stock.helpers';

describe('stock.helpers', () => {
  describe('getStockLevel', () => {
    const drink = (
      quantity: number,
      warningQuantity = 12,
      criticalQuantity = 5,
    ) => ({
      quantity,
      warningQuantity,
      criticalQuantity,
    });

    it('should be ok when the quantity is not below any level', () => {
      expect(getStockLevel(drink(12))).toBe('ok');
      expect(getStockLevel(drink(100))).toBe('ok');
    });

    it('should be warning below the warning quantity', () => {
      expect(getStockLevel(drink(11))).toBe('warning');
      expect(getStockLevel(drink(5))).toBe('warning');
    });

    it('should be critical below the critical quantity', () => {
      expect(getStockLevel(drink(4))).toBe('critical');
      expect(getStockLevel(drink(0))).toBe('critical');
    });

    it('should be critical below zero, whatever the levels are', () => {
      expect(getStockLevel(drink(-1))).toBe('critical');
      expect(getStockLevel(drink(-1, 0, 0))).toBe('critical');
    });

    it('should not count the level itself as low', () => {
      expect(getStockLevel(drink(5))).toBe('warning');
      expect(getStockLevel(drink(12))).toBe('ok');
    });

    it('should ignore the warning level when it is 0 (off)', () => {
      expect(getStockLevel(drink(3, 0, 0))).toBe('ok');
      expect(getStockLevel(drink(3, 0, 5))).toBe('critical');
    });

    it('should ignore the critical level when it is 0 (off)', () => {
      expect(getStockLevel(drink(0, 12, 0))).toBe('warning');
      expect(getStockLevel(drink(12, 12, 0))).toBe('ok');
    });

    it('should be ok for a drink at zero when both levels are off', () => {
      expect(getStockLevel(drink(0, 0, 0))).toBe('ok');
    });
  });
});
