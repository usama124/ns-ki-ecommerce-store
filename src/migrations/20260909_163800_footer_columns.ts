import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

    -- New enum for footer_columns_links link type
    CREATE TYPE "public"."enum_footer_columns_links_link_type" AS ENUM('reference', 'custom');

    -- Add simple text columns to footer table
    ALTER TABLE "footer"
      ADD COLUMN IF NOT EXISTS "tagline" varchar,
      ADD COLUMN IF NOT EXISTS "social_links_instagram" varchar,
      ADD COLUMN IF NOT EXISTS "social_links_facebook" varchar,
      ADD COLUMN IF NOT EXISTS "social_links_tiktok" varchar,
      ADD COLUMN IF NOT EXISTS "social_links_youtube" varchar,
      ADD COLUMN IF NOT EXISTS "social_links_whatsapp" varchar,
      ADD COLUMN IF NOT EXISTS "payment_note" varchar,
      ADD COLUMN IF NOT EXISTS "copyright_text" varchar;

    -- Footer columns (heading groups)
    CREATE TABLE IF NOT EXISTS "footer_columns" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL
    );

    -- Footer columns -> links (individual link rows inside each column)
    CREATE TABLE IF NOT EXISTS "footer_columns_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_columns_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    -- Foreign keys
    ALTER TABLE "footer_columns"
      ADD CONSTRAINT "footer_columns_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "footer_columns_links"
      ADD CONSTRAINT "footer_columns_links_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_columns"("id") ON DELETE cascade ON UPDATE no action;

    -- Indexes
    CREATE INDEX IF NOT EXISTS "footer_columns_order_idx" ON "footer_columns" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_columns_parent_id_idx" ON "footer_columns" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "footer_columns_links_order_idx" ON "footer_columns_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_columns_links_parent_id_idx" ON "footer_columns_links" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "footer_columns_links" CASCADE;
    DROP TABLE IF EXISTS "footer_columns" CASCADE;

    ALTER TABLE "footer"
      DROP COLUMN IF EXISTS "tagline",
      DROP COLUMN IF EXISTS "social_links_instagram",
      DROP COLUMN IF EXISTS "social_links_facebook",
      DROP COLUMN IF EXISTS "social_links_tiktok",
      DROP COLUMN IF EXISTS "social_links_youtube",
      DROP COLUMN IF EXISTS "social_links_whatsapp",
      DROP COLUMN IF EXISTS "payment_note",
      DROP COLUMN IF EXISTS "copyright_text";

    DROP TYPE IF EXISTS "public"."enum_footer_columns_links_link_type";
  `)
}
