import { MigrationInterface, QueryRunner } from 'typeorm';

/** A white label site is a draft until it is published */
export class AddClientStatus1764500000000 implements MigrationInterface {
  name = 'AddClientStatus1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "status",
        DROP COLUMN IF EXISTS "published_at"
    `);
  }
}
