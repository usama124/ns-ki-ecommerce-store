import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** PostgreSQL only. Does not link legacy orders by editable/unverified email. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "customer_account_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
    CREATE INDEX "orders_customer_account_idx" ON "orders" ("customer_account_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "orders_customer_account_idx";
    ALTER TABLE "orders" DROP COLUMN "customer_account_id";
  `)
}
