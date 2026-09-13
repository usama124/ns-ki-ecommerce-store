import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create sizes table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sizes (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      sort_order  INTEGER NOT NULL DEFAULT 100,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Create colors table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS colors (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      hex_code    VARCHAR(255),
      sort_order  INTEGER NOT NULL DEFAULT 100,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Add size_id FK column to products_variants (replaces old text size field)
  await db.execute(sql`
    ALTER TABLE products_variants
      ADD COLUMN IF NOT EXISTS size_id INTEGER REFERENCES sizes(id) ON DELETE SET NULL
  `)

  // Add color_id FK column to products_variants (replaces old text color field)
  await db.execute(sql`
    ALTER TABLE products_variants
      ADD COLUMN IF NOT EXISTS color_id INTEGER REFERENCES colors(id) ON DELETE SET NULL
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE products_variants DROP COLUMN IF EXISTS size_id`)
  await db.execute(sql`ALTER TABLE products_variants DROP COLUMN IF EXISTS color_id`)
  await db.execute(sql`DROP TABLE IF EXISTS colors`)
  await db.execute(sql`DROP TABLE IF EXISTS sizes`)
}
