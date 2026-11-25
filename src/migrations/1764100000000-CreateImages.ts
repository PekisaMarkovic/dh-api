import { MigrationInterface, QueryRunner } from 'typeorm';

/** The images of the drinks: a row per file in the Cloudflare R2 bucket and a link to it from the drink */
export class CreateImages1764100000000 implements MigrationInterface {
  name = 'CreateImages1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "images" (
        "image_id" SERIAL PRIMARY KEY,
        "key" character varying(500) NOT NULL,
        "url" character varying(1000) NOT NULL,
        "company_id" integer NOT NULL REFERENCES "companies"("company_id") ON DELETE CASCADE,
        "mime_type" character varying(100) NOT NULL,
        "size" integer NOT NULL,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "alt_text" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_images_key" ON "images" ("key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_images_company_id" ON "images" ("company_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "image_id" integer REFERENCES "images"("image_id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "drinks" DROP COLUMN IF EXISTS "image_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "images"`);
  }
}
