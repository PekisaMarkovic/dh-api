import { MigrationInterface, QueryRunner } from 'typeorm';

/** The content of a white label site: general info, the texts of the sections and four pictures */
export class AddClientWebsiteContent1764400000000
  implements MigrationInterface
{
  name = 'AddClientWebsiteContent1764400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "city" character varying(100),
        ADD COLUMN IF NOT EXISTS "address" character varying(150),
        ADD COLUMN IF NOT EXISTS "phone" character varying(50),
        ADD COLUMN IF NOT EXISTS "instagram" character varying(255),
        ADD COLUMN IF NOT EXISTS "working_hours" character varying(255),
        ADD COLUMN IF NOT EXISTS "sections" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "logo_image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "hero_image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "story_image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "promo_image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "address",
        DROP COLUMN IF EXISTS "phone",
        DROP COLUMN IF EXISTS "instagram",
        DROP COLUMN IF EXISTS "working_hours",
        DROP COLUMN IF EXISTS "sections",
        DROP COLUMN IF EXISTS "logo_image_id",
        DROP COLUMN IF EXISTS "hero_image_id",
        DROP COLUMN IF EXISTS "story_image_id",
        DROP COLUMN IF EXISTS "promo_image_id"
    `);
  }
}
