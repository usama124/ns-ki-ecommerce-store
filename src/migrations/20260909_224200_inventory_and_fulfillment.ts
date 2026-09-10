import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

    -- Add allowBackorder to product variants
    ALTER TABLE "products_variants"
      ADD COLUMN IF NOT EXISTS "allow_backorder" boolean DEFAULT false;

    -- Add fulfillment courier enum for orders
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_fulfillment_courier_name" AS ENUM(
        'TCS', 'Leopard', 'CallCourier', 'Trax', 'M&P', 'PostEx', 'Other'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add fulfillment fields to orders
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "fulfillment_courier_name" "enum_orders_fulfillment_courier_name",
      ADD COLUMN IF NOT EXISTS "fulfillment_tracking_number" varchar,
      ADD COLUMN IF NOT EXISTS "fulfillment_tracking_url" varchar;

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`

    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "fulfillment_courier_name",
      DROP COLUMN IF EXISTS "fulfillment_tracking_number",
      DROP COLUMN IF EXISTS "fulfillment_tracking_url";

    DROP TYPE IF EXISTS "public"."enum_orders_fulfillment_courier_name";

    ALTER TABLE "products_variants"
      DROP COLUMN IF EXISTS "allow_backorder";

  `)
}
