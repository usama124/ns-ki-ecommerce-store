import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add image size columns (thumbnail, card, hero) to media table for Payload responsive image sizes
  await db.execute(sql`
    ALTER TABLE media
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_width NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_height NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_mime_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_filesize NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_thumbnail_filename VARCHAR(255),

      ADD COLUMN IF NOT EXISTS sizes_card_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_card_width NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_card_height NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_card_mime_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_card_filesize NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_card_filename VARCHAR(255),

      ADD COLUMN IF NOT EXISTS sizes_hero_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_hero_width NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_hero_height NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_hero_mime_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sizes_hero_filesize NUMERIC,
      ADD COLUMN IF NOT EXISTS sizes_hero_filename VARCHAR(255);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE media
      DROP COLUMN IF EXISTS sizes_thumbnail_url,
      DROP COLUMN IF EXISTS sizes_thumbnail_width,
      DROP COLUMN IF EXISTS sizes_thumbnail_height,
      DROP COLUMN IF EXISTS sizes_thumbnail_mime_type,
      DROP COLUMN IF EXISTS sizes_thumbnail_filesize,
      DROP COLUMN IF EXISTS sizes_thumbnail_filename,

      DROP COLUMN IF EXISTS sizes_card_url,
      DROP COLUMN IF EXISTS sizes_card_width,
      DROP COLUMN IF EXISTS sizes_card_height,
      DROP COLUMN IF EXISTS sizes_card_mime_type,
      DROP COLUMN IF EXISTS sizes_card_filesize,
      DROP COLUMN IF EXISTS sizes_card_filename,

      DROP COLUMN IF EXISTS sizes_hero_url,
      DROP COLUMN IF EXISTS sizes_hero_width,
      DROP COLUMN IF EXISTS sizes_hero_height,
      DROP COLUMN IF EXISTS sizes_hero_mime_type,
      DROP COLUMN IF EXISTS sizes_hero_filesize,
      DROP COLUMN IF EXISTS sizes_hero_filename;
  `)
}
