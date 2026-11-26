import { MigrationInterface, QueryRunner } from 'typeorm';

/** Whether the visitors of a white label site can order drinks, off for every site until it is turned on */
export class AddClientIsOrderingAllowed1764900000000
  implements MigrationInterface
{
  name = 'AddClientIsOrderingAllowed1764900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_ordering_allowed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN IF EXISTS "is_ordering_allowed"`,
    );
  }
}
