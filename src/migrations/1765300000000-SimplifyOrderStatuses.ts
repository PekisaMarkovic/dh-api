import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Four statuses of an order instead of five: new, in progress (the courier took it), delivered, cancelled.
 * A confirmed order becomes new again, "with the courier" is "in progress", "completed" is "delivered".
 */
export class SimplifyOrderStatuses1765300000000 implements MigrationInterface {
  name = 'SimplifyOrderStatuses1765300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'new' WHERE "status" = 'confirmed'`,
    );
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'in_progress' WHERE "status" = 'with_courier'`,
    );
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'delivered' WHERE "status" = 'completed'`,
    );
  }

  // the confirmed ones can not be told apart any more, they stay new
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'with_courier' WHERE "status" = 'in_progress'`,
    );
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'completed' WHERE "status" = 'delivered'`,
    );
  }
}
