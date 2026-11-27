import { MigrationInterface, QueryRunner } from 'typeorm';

/** Whether a page is in the main menu of the site (at most 5), the other published pages are in the footer. The drinks menu is in it */
export class AddPageIsInMenu1765500000000 implements MigrationInterface {
  name = 'AddPageIsInMenu1765500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "is_in_menu" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "pages" SET "is_in_menu" = true WHERE "slug" = 'karta-pica'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "is_in_menu"`,
    );
  }
}
