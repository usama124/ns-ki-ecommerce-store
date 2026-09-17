import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add cancellation_reason column to orders table
  await db.execute(sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE orders
      DROP COLUMN IF EXISTS cancellation_reason;
  `)
}
