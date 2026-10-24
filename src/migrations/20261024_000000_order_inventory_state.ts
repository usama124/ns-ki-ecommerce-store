import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// SQL schema compatibility only. The commerce command currently requires MongoDB.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_state" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "inventory_state";`)
}
