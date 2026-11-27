import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The whole schema as the entities had it when `synchronize` was turned off (generated with `migration:generate` on an empty database).
 * The databases made before that (made by `synchronize`) already have it, so there it does nothing.
 * The migrations after it are the changes on top of it, a new database runs them all.
 */
export class Baseline1763000000000 implements MigrationInterface {
  name = 'Baseline1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      return;
    }

    await queryRunner.query(`
            CREATE TABLE "images" (
                "image_id" SERIAL NOT NULL,
                "key" character varying(500) NOT NULL,
                "url" character varying(1000) NOT NULL,
                "company_id" integer NOT NULL,
                "mime_type" character varying(100) NOT NULL,
                "size" integer NOT NULL,
                "width" integer NOT NULL,
                "height" integer NOT NULL,
                "alt_text" character varying(255),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_c84a23d9d89dd5ea37c283c340e" PRIMARY KEY ("image_id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_b81c3bf4a0c17cf677d1d9e2ab" ON "images" ("key")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_870a12708c65d094dcfc6fa246" ON "images" ("company_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "clients" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "client_id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(150) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'draft',
                "published_at" TIMESTAMP,
                "is_ordering_allowed" boolean NOT NULL DEFAULT false,
                "city" character varying(100),
                "address" character varying(150),
                "phone" character varying(50),
                "instagram" character varying(255),
                "working_hours" text,
                "logo_image_id" integer,
                "company_id" integer NOT NULL,
                CONSTRAINT "PK_49e91f1e368e3f760789e7764aa" PRIMARY KEY ("client_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_fcadfe25d85cf2125127316912" ON "clients" ("company_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "categories" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "category_id" SERIAL NOT NULL,
                "name" character varying(100) NOT NULL,
                "slug" character varying(120) NOT NULL DEFAULT '',
                "company_id" integer NOT NULL,
                CONSTRAINT "PK_51615bef2cea22812d0dcab6e18" PRIMARY KEY ("category_id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_categories_company_name" ON "categories" ("company_id", "name")
            WHERE "deleted_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "drinks" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "drink_id" SERIAL NOT NULL,
                "name" character varying(150) NOT NULL,
                "code" character varying(50),
                "price" numeric(12, 3) NOT NULL,
                "quantity" integer NOT NULL DEFAULT '0',
                "warning_quantity" integer NOT NULL DEFAULT '0',
                "critical_quantity" integer NOT NULL DEFAULT '0',
                "image_id" integer,
                "warehouse_id" integer NOT NULL,
                "company_id" integer NOT NULL,
                CONSTRAINT "REL_b52eb653ae8250f903b41a1cde" UNIQUE ("image_id"),
                CONSTRAINT "PK_c939e7fb348a4976b9e59034f24" PRIMARY KEY ("drink_id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_aea17d36b9dd66913f0d742a56" ON "drinks" ("company_id", "code")
            WHERE "deleted_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_333b29fd6d4ab33d597b694523" ON "drinks" ("company_id", "name")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."permission_name_enum" AS ENUM(
                'permission.create.user',
                'permission.read.user',
                'permission.update.user',
                'permission.delete.user',
                'permission.create.announcement',
                'permission.update.announcement'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "permission" (
                "id" SERIAL NOT NULL,
                "name" "public"."permission_name_enum" NOT NULL DEFAULT 'permission.read.user',
                CONSTRAINT "UQ_240853a0c3353c25fb12434ad33" UNIQUE ("name"),
                CONSTRAINT "PK_3b8b97af9d9d8807e41e6f48362" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."role_name_enum" AS ENUM('user', 'admin', 'super.admin')
        `);
    await queryRunner.query(`
            CREATE TABLE "role" (
                "id" SERIAL NOT NULL,
                "name" "public"."role_name_enum" NOT NULL DEFAULT 'user',
                CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"),
                CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "user_id" SERIAL NOT NULL,
                "first_name" character varying(100) NOT NULL,
                "last_name" character varying(100) NOT NULL,
                "language" character varying(5) NOT NULL DEFAULT 'en',
                "date_of_birth" date,
                "created_at" date NOT NULL DEFAULT '"2026-11-27T10:05:16.591Z"',
                "updated_at" date,
                "deleted_at" date,
                "last_logged_in_at" date,
                "email" character varying NOT NULL,
                "phone_number" character varying,
                "password" character varying,
                "company_id" integer,
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "UQ_17d1817f241f10a3dbafb169fd2" UNIQUE ("phone_number"),
                CONSTRAINT "UQ_450a05c0c4de5b75ac8d34835b9" UNIQUE ("password"),
                CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "companies" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "company_id" SERIAL NOT NULL,
                "name" character varying(150) NOT NULL,
                "street" character varying(150) NOT NULL DEFAULT '',
                "city" character varying(100) NOT NULL DEFAULT '',
                "pib" character varying(20) NOT NULL DEFAULT '',
                "registration_number" character varying(20) NOT NULL DEFAULT '',
                "phone" character varying(50),
                "bank_account" character varying(40) NOT NULL DEFAULT '',
                "invoice_name" character varying(150),
                CONSTRAINT "UQ_3dacbb3eb4f095e29372ff8e131" UNIQUE ("name"),
                CONSTRAINT "PK_8c008cd5c4c0c20cf1e77f68e8d" PRIMARY KEY ("company_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "warehouses" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "warehouse_id" SERIAL NOT NULL,
                "name" character varying(150) NOT NULL,
                "is_default" boolean NOT NULL DEFAULT false,
                "company_id" integer NOT NULL,
                CONSTRAINT "PK_02702eca36a8790626984c68de1" PRIMARY KEY ("warehouse_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "purchase_import_items" (
                "purchase_import_item_id" SERIAL NOT NULL,
                "purchase_import_id" integer NOT NULL,
                "name_on_document" character varying(255) NOT NULL,
                "quantity" integer NOT NULL,
                "suggested_drink_id" integer,
                "applied_drink_id" integer,
                "applied_quantity" integer,
                CONSTRAINT "PK_0ee4938bb53f9b455161a080eed" PRIMARY KEY ("purchase_import_item_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "purchase_imports" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "purchase_import_id" SERIAL NOT NULL,
                "company_id" integer NOT NULL,
                "warehouse_id" integer NOT NULL,
                "user_id" integer NOT NULL,
                "title" character varying(255),
                "file_name" character varying(255) NOT NULL,
                "mime_type" character varying(100) NOT NULL,
                "file_size" integer NOT NULL,
                "file_hash" character varying(64) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'parsing',
                "model" character varying(100),
                "duration_ms" integer,
                "ai_response" jsonb,
                "error_message" text,
                "applied_at" TIMESTAMP,
                CONSTRAINT "PK_0a741f5c7ac8bb24dd6a96809dc" PRIMARY KEY ("purchase_import_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_14ffe41de103e399460f57d16d" ON "purchase_imports" ("file_hash")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_39eff843e8923e518880704b08" ON "purchase_imports" ("company_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "customers" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "customer_id" SERIAL NOT NULL,
                "code" character varying(50),
                "name" character varying(150) NOT NULL,
                "city" character varying(100),
                "address" character varying(150),
                "pib" character varying(20),
                "type" character varying(20),
                "phone" character varying(50),
                "email" character varying(150),
                "company_id" integer NOT NULL,
                CONSTRAINT "PK_6c444ce6637f2c1d71c3cf136c1" PRIMARY KEY ("customer_id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_23486c7d4cc2d811c1b7f89e27" ON "customers" ("company_id", "code")
            WHERE "deleted_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_b1716bb58d4f30a84cc240b4bb" ON "customers" ("company_id", "name")
        `);
    await queryRunner.query(`
            CREATE TABLE "proforma_items" (
                "proforma_item_id" SERIAL NOT NULL,
                "proforma_id" integer NOT NULL,
                "drink_id" integer,
                "code" character varying(50),
                "name" character varying(150) NOT NULL,
                "unit_price" numeric(12, 3) NOT NULL,
                "quantity" integer NOT NULL,
                "discount_percent" numeric(5, 2) NOT NULL DEFAULT '0',
                "line_total" numeric(12, 2) NOT NULL,
                CONSTRAINT "PK_14b7e9255d10f4a1e498e213f99" PRIMARY KEY ("proforma_item_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "proformas" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "proforma_id" SERIAL NOT NULL,
                "company_id" integer NOT NULL,
                "warehouse_id" integer NOT NULL,
                "customer_id" integer,
                "customer_name" character varying(150),
                "created_by_id" integer,
                "status" character varying(20) NOT NULL DEFAULT 'active',
                "returned_at" TIMESTAMP,
                "returned_by_id" integer,
                "total" numeric(12, 2) NOT NULL,
                CONSTRAINT "PK_4a8eee79e611e10301396283ee9" PRIMARY KEY ("proforma_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "orders" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "order_id" SERIAL NOT NULL,
                "company_id" integer NOT NULL,
                "client_id" uuid NOT NULL,
                "full_name" character varying(150) NOT NULL,
                "email" character varying(150) NOT NULL,
                "phone" character varying(30) NOT NULL,
                "address" character varying(255) NOT NULL DEFAULT '',
                "pickup_date" date NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'new',
                "cancel_reason" character varying(500),
                "total" numeric(12, 2) NOT NULL,
                CONSTRAINT "PK_cad55b3cb25b38be94d2ce831db" PRIMARY KEY ("order_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_company_created" ON "orders" ("company_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "order_items" (
                "order_item_id" SERIAL NOT NULL,
                "order_id" integer NOT NULL,
                "drink_id" integer,
                "code" character varying(50),
                "name" character varying(150) NOT NULL,
                "unit_price" numeric(12, 3) NOT NULL,
                "quantity" integer NOT NULL,
                CONSTRAINT "PK_54c952fdc94b9b487ef968b4047" PRIMARY KEY ("order_item_id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."validation_tokens_validation_token_type_enum" AS ENUM('refresh')
        `);
    await queryRunner.query(`
            CREATE TABLE "validation_tokens" (
                "validation_token_id" SERIAL NOT NULL,
                "token" text NOT NULL,
                "email" character varying NOT NULL,
                "expiration_date" bigint,
                "validation_token_type" "public"."validation_tokens_validation_token_type_enum" NOT NULL DEFAULT 'refresh',
                CONSTRAINT "PK_1bc948874fe9a42ed5d64ab9731" PRIMARY KEY ("validation_token_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "sections" (
                "section_id" SERIAL NOT NULL,
                "type" character varying(20) NOT NULL,
                "name" character varying(100) NOT NULL,
                "content" jsonb NOT NULL DEFAULT '{}',
                "image_id" integer,
                "client_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_c5641bfa4992d9bb24205e4cf12" PRIMARY KEY ("section_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_sections_client_id" ON "sections" ("client_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "page_sections" (
                "page_id" integer NOT NULL,
                "section_id" integer NOT NULL,
                "position" integer NOT NULL DEFAULT '0',
                "is_visible" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_cd5d0090e613dc7954a2fae0a46" PRIMARY KEY ("page_id", "section_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "seo" (
                "seo_id" SERIAL NOT NULL,
                "title" character varying(70),
                "description" character varying(160),
                "image_id" integer,
                CONSTRAINT "PK_2d06ef936982a945a1ba1d8d514" PRIMARY KEY ("seo_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "pages" (
                "page_id" SERIAL NOT NULL,
                "title" character varying(100) NOT NULL,
                "slug" character varying(100) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'draft',
                "position" integer NOT NULL DEFAULT '0',
                "seo_id" integer NOT NULL,
                "client_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_pages_client_slug" UNIQUE ("client_id", "slug"),
                CONSTRAINT "REL_3c9a1e22921f011629a98a50bc" UNIQUE ("seo_id"),
                CONSTRAINT "PK_cc4fe3c89aa9d5e307302b3c7ac" PRIMARY KEY ("page_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "invitations" (
                "invitation_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "company_id" integer NOT NULL,
                "expiration_date" bigint NOT NULL,
                "accepted_at" TIMESTAMP,
                "last_sent_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_56a33d475f5faf8b63d020b650f" PRIMARY KEY ("invitation_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "clients_contacted_by" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "contact_id" SERIAL NOT NULL,
                "client_id" uuid NOT NULL,
                "name" character varying(150) NOT NULL,
                "phone" character varying(30) NOT NULL,
                "email" character varying(150),
                "message" text,
                CONSTRAINT "PK_9c85ba71afac9293061778a56f4" PRIMARY KEY ("contact_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_b75e6965b8f59da0148a6b549e" ON "clients_contacted_by" ("client_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "drink_categories" (
                "drink_id" integer NOT NULL,
                "category_id" integer NOT NULL,
                CONSTRAINT "PK_289c261c24cf03601a084efb1f1" PRIMARY KEY ("drink_id", "category_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_93ba1df64e6cd4e05ee9d70240" ON "drink_categories" ("drink_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_11ce772e1c02650d681d5b27fc" ON "drink_categories" ("category_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "role_permissions_permission" (
                "roleId" integer NOT NULL,
                "permissionId" integer NOT NULL,
                CONSTRAINT "PK_b817d7eca3b85f22130861259dd" PRIMARY KEY ("roleId", "permissionId")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_b36cb2e04bc353ca4ede00d87b" ON "role_permissions_permission" ("roleId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_bfbc9e263d4cea6d7a8c9eb3ad" ON "role_permissions_permission" ("permissionId")
        `);
    await queryRunner.query(`
            CREATE TABLE "users_roles_role" (
                "usersUserId" integer NOT NULL,
                "roleId" integer NOT NULL,
                CONSTRAINT "PK_87941bc4f1c5eae285347c53dd8" PRIMARY KEY ("usersUserId", "roleId")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_c999fb882793bc155ec3c68fe6" ON "users_roles_role" ("usersUserId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_03c652226fd376f26b31503d40" ON "users_roles_role" ("roleId")
        `);
    await queryRunner.query(`
            CREATE TABLE "users_permissions_permission" (
                "usersUserId" integer NOT NULL,
                "permissionId" integer NOT NULL,
                CONSTRAINT "PK_47583c8a88f58cdfa3e4c006a52" PRIMARY KEY ("usersUserId", "permissionId")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_4f9318e3f458926b778f9105b6" ON "users_permissions_permission" ("usersUserId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_bb779b42732e822b848f9f32ad" ON "users_permissions_permission" ("permissionId")
        `);
    await queryRunner.query(`
            ALTER TABLE "images"
            ADD CONSTRAINT "FK_870a12708c65d094dcfc6fa246a" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "clients"
            ADD CONSTRAINT "FK_5331e09886a78a6898c0772cae8" FOREIGN KEY ("logo_image_id") REFERENCES "images"("image_id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "clients"
            ADD CONSTRAINT "FK_fcadfe25d85cf21251273169128" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "categories"
            ADD CONSTRAINT "FK_categories_company" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drinks"
            ADD CONSTRAINT "FK_b52eb653ae8250f903b41a1cdea" FOREIGN KEY ("image_id") REFERENCES "images"("image_id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drinks"
            ADD CONSTRAINT "FK_449313e6bef4158164ceb99f617" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drinks"
            ADD CONSTRAINT "FK_b56b9bb1288a084a1395683ce91" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_7ae6334059289559722437bcc1c" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "warehouses"
            ADD CONSTRAINT "FK_3fcbfd5832b46945f514a7d1f56" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "purchase_import_items"
            ADD CONSTRAINT "FK_8ded1699b26000b84cbdfe7b916" FOREIGN KEY ("purchase_import_id") REFERENCES "purchase_imports"("purchase_import_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "purchase_imports"
            ADD CONSTRAINT "FK_99e5623b8ab865661ce979cb6d4" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "purchase_imports"
            ADD CONSTRAINT "FK_7945d68006fd1df2fb603cc657e" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "purchase_imports"
            ADD CONSTRAINT "FK_cd23db4e8000fa9cb1ce13089ce" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "customers"
            ADD CONSTRAINT "FK_f0e29920aaf871f3eddbea69f0d" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "proforma_items"
            ADD CONSTRAINT "FK_7cc707159d5ac00128b7da5406e" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("proforma_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "proformas"
            ADD CONSTRAINT "FK_0b196fc66c717dbee296f8cebfc" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "proformas"
            ADD CONSTRAINT "FK_ac4ead1ceab80baab1b0a6ac057" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "proformas"
            ADD CONSTRAINT "FK_709ecf60533fee53f5d21f3e288" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "proformas"
            ADD CONSTRAINT "FK_8d530a2262fbdeb84e624ad2db3" FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_company" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "order_items"
            ADD CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "sections"
            ADD CONSTRAINT "FK_sections_image" FOREIGN KEY ("image_id") REFERENCES "images"("image_id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "sections"
            ADD CONSTRAINT "FK_sections_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "page_sections"
            ADD CONSTRAINT "FK_page_sections_page" FOREIGN KEY ("page_id") REFERENCES "pages"("page_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "page_sections"
            ADD CONSTRAINT "FK_page_sections_section" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "seo"
            ADD CONSTRAINT "FK_seo_image" FOREIGN KEY ("image_id") REFERENCES "images"("image_id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "pages"
            ADD CONSTRAINT "FK_pages_seo" FOREIGN KEY ("seo_id") REFERENCES "seo"("seo_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "pages"
            ADD CONSTRAINT "FK_pages_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "clients_contacted_by"
            ADD CONSTRAINT "FK_b75e6965b8f59da0148a6b549e8" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drink_categories"
            ADD CONSTRAINT "FK_drink_categories_drink" FOREIGN KEY ("drink_id") REFERENCES "drinks"("drink_id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "drink_categories"
            ADD CONSTRAINT "FK_drink_categories_category" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions_permission"
            ADD CONSTRAINT "FK_b36cb2e04bc353ca4ede00d87b9" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions_permission"
            ADD CONSTRAINT "FK_bfbc9e263d4cea6d7a8c9eb3ad2" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "users_roles_role"
            ADD CONSTRAINT "FK_c999fb882793bc155ec3c68fe69" FOREIGN KEY ("usersUserId") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "users_roles_role"
            ADD CONSTRAINT "FK_03c652226fd376f26b31503d40c" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users_permissions_permission"
            ADD CONSTRAINT "FK_4f9318e3f458926b778f9105b68" FOREIGN KEY ("usersUserId") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "users_permissions_permission"
            ADD CONSTRAINT "FK_bb779b42732e822b848f9f32ad5" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
  }

  // never drops the schema: on a database made by `synchronize` that would be everything
  public async down(): Promise<void> {}
}
