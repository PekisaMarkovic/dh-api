import { MigrationInterface, QueryRunner } from 'typeorm';

/** The history of the uploaded purchase documents: the document, what the AI read, what was added to the stock */
export class CreatePurchaseImports1763800000000 implements MigrationInterface {
  name = 'CreatePurchaseImports1763800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: environments created with synchronize already have the tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_imports" (
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "purchase_import_id" SERIAL NOT NULL,
        "company_id" integer NOT NULL,
        "warehouse_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(100) NOT NULL,
        "file_size" integer NOT NULL,
        "file_hash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'parsing',
        "model" character varying(100),
        "duration_ms" integer,
        "error_message" text,
        "applied_at" TIMESTAMP,
        CONSTRAINT "PK_purchase_imports" PRIMARY KEY ("purchase_import_id"),
        CONSTRAINT "FK_purchase_imports_company" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id"),
        CONSTRAINT "FK_purchase_imports_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id"),
        CONSTRAINT "FK_purchase_imports_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchase_imports_company_created" ON "purchase_imports" ("company_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchase_imports_file_hash" ON "purchase_imports" ("file_hash")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_import_items" (
        "purchase_import_item_id" SERIAL NOT NULL,
        "purchase_import_id" integer NOT NULL,
        "name_on_document" character varying(255) NOT NULL,
        "quantity" integer NOT NULL,
        "suggested_drink_id" integer,
        "applied_drink_id" integer,
        "applied_quantity" integer,
        CONSTRAINT "PK_purchase_import_items" PRIMARY KEY ("purchase_import_item_id"),
        CONSTRAINT "FK_purchase_import_items_import" FOREIGN KEY ("purchase_import_id") REFERENCES "purchase_imports"("purchase_import_id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_import_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_imports"`);
  }
}
