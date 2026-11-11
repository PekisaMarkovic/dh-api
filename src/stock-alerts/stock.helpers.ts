export type StockLevel = 'ok' | 'warning' | 'critical';

export type StockSnapshot = {
  quantity: number;
  warningQuantity: number;
  criticalQuantity: number;
};

/**
 * How low the stock of a drink is. A level of 0 means that level is off.
 * - critical: fell below the "has to be bought again" quantity
 * - warning: fell below the warning quantity
 */
export const getStockLevel = ({
  quantity,
  warningQuantity,
  criticalQuantity,
}: StockSnapshot): StockLevel => {
  if (criticalQuantity > 0 && quantity < criticalQuantity) return 'critical';
  if (warningQuantity > 0 && quantity < warningQuantity) return 'warning';

  return 'ok';
};
