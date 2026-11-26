import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The orders from the white label sites and their lines.
 * The names of the constraints and the index are the ones the entities give, so `synchronize` changes nothing after it.
 */
export class CreateOrders1765100000000 implements MigrationInterface {
  name = 'CreateOrders1765100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: environments created with synchronize already have the tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "order_id" SERIAL NOT NULL,
        "company_id" integer NOT NULL,
        "client_id" uuid NOT NULL,
        "full_name" character varying(150) NOT NULL,
        "email" character varying(150) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "pickup_date" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'new',
        "total" numeric(12,2) NOT NULL,
        CONSTRAINT "PK_orders" PRIMARY KEY ("order_id"),
        CONSTRAINT "FK_orders_company" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id"),
        CONSTRAINT "FK_orders_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_company_created" ON "orders" ("company_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "order_item_id" SERIAL NOT NULL,
        "order_id" integer NOT NULL,
        "drink_id" integer,
        "code" character varying(50),
        "name" character varying(150) NOT NULL,
        "unit_price" numeric(12,3) NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_order_items" PRIMARY KEY ("order_item_id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}
