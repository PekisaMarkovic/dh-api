import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The uploaded documents are not kept (they hold the data of the customers),
 * what is remembered is the answer of the AI as JSON. The file table of the first
 * version was never used in production, it is dropped here for the databases that have it.
 */
export class StorePurchaseImportAiResponse1763900000000
  implements MigrationInterface
{
  name = 'StorePurchaseImportAiResponse1763900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_imports" ADD COLUMN IF NOT EXISTS "ai_response" jsonb`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_import_files"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_imports" DROP COLUMN IF EXISTS "ai_response"`,
    );
  }
}
