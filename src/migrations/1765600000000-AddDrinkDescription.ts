import { MigrationInterface, QueryRunner } from 'typeorm';

/** A short description of a drink (at most 150 characters), shown in the detail of the drink on the site */
export class AddDrinkDescription1765600000000 implements MigrationInterface {
  name = 'AddDrinkDescription1765600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "description" character varying(150)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "drinks" DROP COLUMN IF EXISTS "description"`,
    );
  }
}
