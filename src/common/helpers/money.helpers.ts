/**
 * postgres returns decimal columns as strings, this gives numbers back
 */
export const moneyTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
