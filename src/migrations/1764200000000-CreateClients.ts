import { MigrationInterface, QueryRunner } from 'typeorm';

/** The white label client sides (Next.js sites) of a company, the id is a GUID */
export class CreateClients1764200000000 implements MigrationInterface {
  name = 'CreateClients1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "clients" (
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "client_id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" character varying(150) NOT NULL,
        "company_id" integer NOT NULL REFERENCES "companies"("company_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_clients_company_id" ON "clients" ("company_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}
