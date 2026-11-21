import { MigrationInterface, QueryRunner } from 'typeorm';

/** The title of the document ("Predracun - 40/26") as the AI read it, the file name is shown when there is none */
export class AddPurchaseImportTitle1764000000000 implements MigrationInterface {
  name = 'AddPurchaseImportTitle1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_imports" ADD COLUMN IF NOT EXISTS "title" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_imports" DROP COLUMN IF EXISTS "title"`,
    );
  }
}
