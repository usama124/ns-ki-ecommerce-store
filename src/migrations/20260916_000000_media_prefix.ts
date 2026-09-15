import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add prefix column to media table (required by @payloadcms/storage-s3 for per-file subfolder routing)
  await db.execute(sql`
    ALTER TABLE media
      ADD COLUMN IF NOT EXISTS prefix VARCHAR(255) DEFAULT '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE media
      DROP COLUMN IF EXISTS prefix;
  `)
}
