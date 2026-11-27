import { MigrationInterface, QueryRunner } from 'typeorm';

/** An optional picture of the map of a site: shown instead of the Google map until the visitor accepts the cookies of Google */
export class AddClientMapImage1765700000000 implements MigrationInterface {
  name = 'AddClientMapImage1765700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "map_image_id" integer`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_clients_map_image') THEN
          ALTER TABLE "clients" ADD CONSTRAINT "FK_clients_map_image"
            FOREIGN KEY ("map_image_id") REFERENCES "images"("image_id") ON DELETE SET NULL;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "FK_clients_map_image"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN IF EXISTS "map_image_id"`,
    );
  }
}
