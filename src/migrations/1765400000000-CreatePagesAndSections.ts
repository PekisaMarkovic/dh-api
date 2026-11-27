import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The content of a site moves from `clients` into pages and sections: a page has its SEO and its sections in order,
 * a section can be on more pages. Every site gets the home page (hero, story, recommended drinks, info = the old promo)
 * and the drinks menu, with the texts and the pictures it had. The general info and the logo stay in `clients`.
 *
 * The old columns of `clients` (sections, hero/story/promo/og_image_id) are only copied, not dropped, so nothing is lost
 * if this has to be reverted; a later migration drops them.
 * The names of the constraints are the ones the entities give, so `synchronize` changes nothing after it.
 */
export class CreatePagesAndSections1765400000000 implements MigrationInterface {
  name = 'CreatePagesAndSections1765400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: a local api that ran `synchronize` with the new entities already made the tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seo" (
        "seo_id" SERIAL NOT NULL,
        "title" character varying(70),
        "description" character varying(160),
        "image_id" integer,
        CONSTRAINT "PK_2d06ef936982a945a1ba1d8d514" PRIMARY KEY ("seo_id"),
        CONSTRAINT "FK_seo_image" FOREIGN KEY ("image_id") REFERENCES "images"("image_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pages" (
        "page_id" SERIAL NOT NULL,
        "title" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "position" integer NOT NULL DEFAULT 0,
        "seo_id" integer NOT NULL,
        "client_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cc4fe3c89aa9d5e307302b3c7ac" PRIMARY KEY ("page_id"),
        CONSTRAINT "REL_3c9a1e22921f011629a98a50bc" UNIQUE ("seo_id"),
        CONSTRAINT "UQ_pages_client_slug" UNIQUE ("client_id", "slug"),
        CONSTRAINT "FK_pages_seo" FOREIGN KEY ("seo_id") REFERENCES "seo"("seo_id"),
        CONSTRAINT "FK_pages_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sections" (
        "section_id" SERIAL NOT NULL,
        "type" character varying(20) NOT NULL,
        "name" character varying(100) NOT NULL,
        "content" jsonb NOT NULL DEFAULT '{}',
        "image_id" integer,
        "client_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c5641bfa4992d9bb24205e4cf12" PRIMARY KEY ("section_id"),
        CONSTRAINT "FK_sections_image" FOREIGN KEY ("image_id") REFERENCES "images"("image_id") ON DELETE SET NULL,
        CONSTRAINT "FK_sections_client" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sections_client_id" ON "sections" ("client_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "page_sections" (
        "page_id" integer NOT NULL,
        "section_id" integer NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_cd5d0090e613dc7954a2fae0a46" PRIMARY KEY ("page_id", "section_id"),
        CONSTRAINT "FK_page_sections_page" FOREIGN KEY ("page_id") REFERENCES "pages"("page_id") ON DELETE CASCADE,
        CONSTRAINT "FK_page_sections_section" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE
      )
    `);

    // Every site without sections: the home page with its four sections in the order the site showed them, and the menu.
    // A home page or a menu the api already made (empty) gets the old SEO texts instead of a second page
    await queryRunner.query(`
      DO $$
      DECLARE
        c record;
        v_seo integer;
        v_home integer;
        v_menu integer;
        v_hero integer;
        v_story integer;
        v_featured integer;
        v_info integer;
      BEGIN
        -- a new database (made by the migrations) never had the old columns, there is nothing to copy
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'sections') THEN
          RETURN;
        END IF;

        FOR c IN
          SELECT * FROM "clients" cl
          WHERE NOT EXISTS (SELECT 1 FROM "sections" s WHERE s."client_id" = cl."client_id")
        LOOP
          v_home := NULL;
          v_menu := NULL;

          SELECT "page_id", "seo_id" INTO v_home, v_seo FROM "pages" WHERE "client_id" = c.client_id AND "slug" = '';
          IF v_home IS NULL THEN
            INSERT INTO "seo" ("title", "description", "image_id")
              VALUES (c.sections->'seo'->>'title', c.sections->'seo'->>'description', c.og_image_id)
              RETURNING "seo_id" INTO v_seo;
            INSERT INTO "pages" ("title", "slug", "status", "position", "seo_id", "client_id")
              VALUES ('Početna', '', 'published', 0, v_seo, c.client_id)
              RETURNING "page_id" INTO v_home;
          ELSE
            UPDATE "seo" SET
              "title" = COALESCE("title", c.sections->'seo'->>'title'),
              "description" = COALESCE("description", c.sections->'seo'->>'description'),
              "image_id" = COALESCE("image_id", c.og_image_id)
            WHERE "seo_id" = v_seo;
          END IF;

          SELECT "page_id", "seo_id" INTO v_menu, v_seo FROM "pages" WHERE "client_id" = c.client_id AND "slug" = 'karta-pica';
          IF v_menu IS NULL THEN
            INSERT INTO "seo" ("title", "description")
              VALUES (c.sections->'seo'->>'menuTitle', c.sections->'seo'->>'menuDescription')
              RETURNING "seo_id" INTO v_seo;
            INSERT INTO "pages" ("title", "slug", "status", "position", "seo_id", "client_id")
              VALUES ('Karta pića', 'karta-pica', 'published', 1, v_seo, c.client_id);
          ELSE
            UPDATE "seo" SET
              "title" = COALESCE("title", c.sections->'seo'->>'menuTitle'),
              "description" = COALESCE("description", c.sections->'seo'->>'menuDescription')
            WHERE "seo_id" = v_seo;
          END IF;

          INSERT INTO "sections" ("type", "name", "content", "image_id", "client_id")
            VALUES ('hero', 'Hero', COALESCE(c.sections->'hero', '{}'), c.hero_image_id, c.client_id)
            RETURNING "section_id" INTO v_hero;
          INSERT INTO "sections" ("type", "name", "content", "image_id", "client_id")
            VALUES ('story', 'Priča', COALESCE(c.sections->'story', '{}'), c.story_image_id, c.client_id)
            RETURNING "section_id" INTO v_story;
          INSERT INTO "sections" ("type", "name", "content", "client_id")
            VALUES ('featured', 'Preporučeno', COALESCE(c.sections->'featured', '{}'), c.client_id)
            RETURNING "section_id" INTO v_featured;
          INSERT INTO "sections" ("type", "name", "content", "image_id", "client_id")
            VALUES ('info', 'Info', COALESCE(c.sections->'promo', '{}'), c.promo_image_id, c.client_id)
            RETURNING "section_id" INTO v_info;

          INSERT INTO "page_sections" ("page_id", "section_id", "position") VALUES
            (v_home, v_hero, 0), (v_home, v_story, 1), (v_home, v_featured, 2), (v_home, v_info, 3);
        END LOOP;
      END $$
    `);
  }

  /** The old columns of `clients` were never dropped, so they still have the content as it was before the up (later changes are lost) */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "page_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seo"`);
  }
}
