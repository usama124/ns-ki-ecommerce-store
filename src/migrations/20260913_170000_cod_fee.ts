import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add cod_fee column to orders table
  await db.execute(sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS cod_fee NUMERIC DEFAULT 0;
  `)

  // Add shipping_cod_fee column to site_settings table if site_settings exists
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'site_settings'
      ) THEN
        ALTER TABLE site_settings
          ADD COLUMN IF NOT EXISTS shipping_cod_fee NUMERIC DEFAULT 250;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE orders
      DROP COLUMN IF EXISTS cod_fee;
  `)
}
