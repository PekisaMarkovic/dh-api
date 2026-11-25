import { MigrationInterface, QueryRunner } from 'typeorm';

/** The opening hours are written one day per line, so the column is a text */
export class WorkingHoursText1764600000000 implements MigrationInterface {
  name = 'WorkingHoursText1764600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "working_hours" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "working_hours" TYPE character varying(255) USING left("working_hours", 255)`,
    );
  }
}
