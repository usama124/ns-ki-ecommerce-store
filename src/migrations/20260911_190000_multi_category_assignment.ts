import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add primary_category_id column to products table
  await db.execute(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS primary_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
  `)

  // 2. Backfill primary_category_id from main_category_id if primary_category_id is NULL
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'main_category_id'
      ) THEN
        UPDATE products
        SET primary_category_id = main_category_id
        WHERE primary_category_id IS NULL AND main_category_id IS NOT NULL;

        INSERT INTO products_rels (parent_id, path, categories_id)
        SELECT id, 'categories', main_category_id
        FROM products
        WHERE main_category_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM products_rels
          WHERE parent_id = products.id AND path = 'categories' AND categories_id = products.main_category_id
        );
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE products
      DROP COLUMN IF EXISTS primary_category_id;
  `)
}

