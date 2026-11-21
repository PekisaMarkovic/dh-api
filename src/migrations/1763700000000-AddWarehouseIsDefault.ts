import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One default (preselected) warehouse per company.
 * Existing companies get their first warehouse as the default.
 */
export class AddWarehouseIsDefault1763700000000 implements MigrationInterface {
  name = 'AddWarehouseIsDefault1763700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: environments created with synchronize already have the column
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      UPDATE "warehouses" SET "is_default" = true
      WHERE "warehouse_id" IN (
        SELECT MIN(w."warehouse_id") FROM "warehouses" w
        WHERE w."deleted_at" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "warehouses" d
            WHERE d."company_id" = w."company_id"
              AND d."is_default" = true AND d."deleted_at" IS NULL
          )
        GROUP BY w."company_id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "warehouses" DROP COLUMN IF EXISTS "is_default"`,
    );
  }
}
