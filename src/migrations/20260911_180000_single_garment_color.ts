import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add top-level garment color column to products table
  await db.execute(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS color VARCHAR(255);
  `)

  // Drop color_id from products_variants table
  await db.execute(sql`
    ALTER TABLE products_variants
      DROP COLUMN IF EXISTS color_id;
  `)

  // Drop colors_id from payload_locked_documents_rels table if it exists
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels
      DROP COLUMN IF EXISTS colors_id;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE products
      DROP COLUMN IF EXISTS color;
  `)
}
