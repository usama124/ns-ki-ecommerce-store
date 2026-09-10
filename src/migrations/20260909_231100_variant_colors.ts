import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

    -- Add color name + hex to product variants
    ALTER TABLE "products_variants"
      ADD COLUMN IF NOT EXISTS "color"      varchar,
      ADD COLUMN IF NOT EXISTS "color_hex"  varchar;

    -- Add variantColor to order items
    ALTER TABLE "orders_items"
      ADD COLUMN IF NOT EXISTS "variant_color" varchar;

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`

    ALTER TABLE "orders_items"
      DROP COLUMN IF EXISTS "variant_color";

    ALTER TABLE "products_variants"
      DROP COLUMN IF EXISTS "color",
      DROP COLUMN IF EXISTS "color_hex";

  `)
}
