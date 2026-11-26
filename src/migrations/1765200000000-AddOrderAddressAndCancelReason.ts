import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The courier of the shop delivers the orders: the address of the delivery,
 * and the reason of a cancelled order (the buyer gets it in an email)
 */
export class AddOrderAddressAndCancelReason1765200000000
  implements MigrationInterface
{
  name = 'AddOrderAddressAndCancelReason1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancel_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "address"`,
    );
  }
}
