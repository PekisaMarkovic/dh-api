import { MigrationInterface, QueryRunner } from 'typeorm';
import { slugify } from '@/common/helpers/slug.helpers';

/**
 * The slug of a category: its name in the address of the site (/karta-pica/pivo), unique in the company.
 * The categories that exist get one made from their name ("Točeno pivo" -> "toceno-pivo", "-2" when it is taken).
 */
export class AddCategorySlug1765000000000 implements MigrationInterface {
  name = 'AddCategorySlug1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: synchronize may have added the column already (empty)
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "slug" character varying(120) NOT NULL DEFAULT ''`,
    );

    const rows: {
      category_id: number;
      company_id: number;
      name: string;
      slug: string;
    }[] = await queryRunner.query(
      `SELECT "category_id", "company_id", "name", "slug" FROM "categories" WHERE "deleted_at" IS NULL ORDER BY "category_id"`,
    );
    // the slugs that are taken, per company
    const taken = new Map<number, Set<string>>();

    for (const row of rows) {
      if (!taken.has(row.company_id)) taken.set(row.company_id, new Set());
      if (row.slug) taken.get(row.company_id)!.add(row.slug);
    }

    for (const row of rows.filter((r) => !r.slug)) {
      const slugs = taken.get(row.company_id)!;
      const base = slugify({ text: row.name, truncate: 100 }) || 'kategorija';
      let slug = base;

      for (let n = 2; slugs.has(slug); n++) {
        slug = `${base}-${n}`;
      }

      slugs.add(slug);
      await queryRunner.query(
        `UPDATE "categories" SET "slug" = $1 WHERE "category_id" = $2`,
        [slug, row.category_id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN IF EXISTS "slug"`,
    );
  }
}
