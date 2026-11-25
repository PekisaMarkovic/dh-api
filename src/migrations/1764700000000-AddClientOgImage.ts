import { MigrationInterface, QueryRunner } from 'typeorm';

/** The picture that is shown when the site is shared (Open Graph) */
export class AddClientOgImage1764700000000 implements MigrationInterface {
  name = 'AddClientOgImage1764700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "og_image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN IF EXISTS "og_image_id"`,
    );
  }
}
