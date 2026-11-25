import { MigrationInterface, QueryRunner } from 'typeorm';

/** The messages from the contact forms of the white label sites */
export class CreateClientsContactedBy1764300000000
  implements MigrationInterface
{
  name = 'CreateClientsContactedBy1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "clients_contacted_by" (
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "contact_id" SERIAL PRIMARY KEY,
        "client_id" uuid NOT NULL REFERENCES "clients"("client_id"),
        "name" character varying(150) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "email" character varying(150),
        "message" text
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_clients_contacted_by_client_id" ON "clients_contacted_by" ("client_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clients_contacted_by"`);
  }
}
