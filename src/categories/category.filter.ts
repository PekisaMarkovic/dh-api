import { FindOperator, Raw } from 'typeorm';

/**
 * A `where` condition on drinkId: only the drinks in any of these categories. A subquery instead of a join,
 * so the categories loaded with the drinks are all of their categories, not only the filtered ones.
 */
export const inCategories = (categoryIds: number[]): FindOperator<number> =>
  Raw(
    (alias) =>
      `${alias} IN (SELECT "drink_id" FROM "drink_categories" WHERE "category_id" IN (:...categoryIds))`,
    { categoryIds },
  );
