import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The categories of drinks of a company and which drink is in which category (many to many).
 * The menu is filtered by a category, so drink_categories has an index on category_id.
 * The names of the constraints and indexes are the ones the entities give (Category, Drink.categories),
 * so `synchronize` of the api changes nothing after this migration.
 */
export class CreateDrinkCategories1764800000000 implements MigrationInterface {
  name = 'CreateDrinkCategories1764800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: environments created with synchronize already have the tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "category_id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "company_id" integer NOT NULL,
        CONSTRAINT "PK_categories" PRIMARY KEY ("category_id"),
        CONSTRAINT "FK_categories_company" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_company_name" ON "categories" ("company_id", "name") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drink_categories" (
        "drink_id" integer NOT NULL,
        "category_id" integer NOT NULL,
        CONSTRAINT "PK_drink_categories" PRIMARY KEY ("drink_id", "category_id"),
        CONSTRAINT "FK_drink_categories_drink" FOREIGN KEY ("drink_id") REFERENCES "drinks"("drink_id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_drink_categories_category" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    // TypeORM's own names for the indexes of a join table: "the categories of a drink" and "the drinks of a category" (the filter)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_93ba1df64e6cd4e05ee9d70240" ON "drink_categories" ("drink_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_11ce772e1c02650d681d5b27fc" ON "drink_categories" ("category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "drink_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
