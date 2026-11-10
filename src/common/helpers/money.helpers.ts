import { VAT_RATE_PERCENT } from '@/common/constants/vat';

/**
 * postgres returns decimal columns as strings, this gives numbers back
 */
export const moneyTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Prices have up to 3 decimals, amounts of a line have 2.
 * The line is calculated in thousandths, so nothing is lost before the one rounding to cents.
 * The discount (0 - 100 %, up to 2 decimals) is taken off the line.
 */
export const lineTotalCents = (
  unitPrice: number,
  quantity: number,
  discountPercent = 0,
) => {
  const lineMillis = Math.round(unitPrice * 1000) * quantity;
  const afterDiscount =
    (lineMillis * (10000 - Math.round(discountPercent * 100))) / 10000;

  return Math.round(afterDiscount / 10);
};

/**
 * VAT of an amount without VAT (in cents), rounded to cents.
 * It is calculated for every line, so the lines add up to the totals.
 */
export const vatCents = (netCents: number, ratePercent = VAT_RATE_PERCENT) =>
  Math.round((netCents * ratePercent) / 100);

/**
 * The VAT and the amount to pay of a proforma, out of the amounts of its lines (without VAT)
 */
export const vatSummary = (lineTotals: number[]) => {
  const netCents = lineTotals.reduce((sum, line) => sum + toCents(line), 0);
  const vat = lineTotals.reduce(
    (sum, line) => sum + vatCents(toCents(line)),
    0,
  );

  return { vatAmount: vat / 100, totalWithVat: (netCents + vat) / 100 };
};

const toCents = (value: number) => Math.round(value * 100);
