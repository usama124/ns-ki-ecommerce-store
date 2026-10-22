import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_shop_by_video BOOLEAN DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS show_in_shop_by_video;`)
}
