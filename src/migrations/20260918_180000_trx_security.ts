import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add trx_id, composite_trx_key, payment_proof_hash columns to orders table
  await db.execute(sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS trx_id TEXT,
      ADD COLUMN IF NOT EXISTS composite_trx_key TEXT,
      ADD COLUMN IF NOT EXISTS payment_proof_hash TEXT;

    CREATE INDEX IF NOT EXISTS orders_composite_trx_key_idx ON orders (composite_trx_key);
    CREATE UNIQUE INDEX IF NOT EXISTS orders_composite_trx_key_unique_idx ON orders (composite_trx_key) WHERE composite_trx_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS orders_payment_proof_hash_idx ON orders (payment_proof_hash);

    ALTER TABLE media
      ADD COLUMN IF NOT EXISTS file_hash TEXT;

    CREATE INDEX IF NOT EXISTS media_file_hash_idx ON media (file_hash);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS orders_composite_trx_key_idx;
    DROP INDEX IF EXISTS orders_composite_trx_key_unique_idx;
    DROP INDEX IF EXISTS orders_payment_proof_hash_idx;
    DROP INDEX IF EXISTS media_file_hash_idx;

    ALTER TABLE orders
      DROP COLUMN IF EXISTS trx_id,
      DROP COLUMN IF EXISTS composite_trx_key,
      DROP COLUMN IF EXISTS payment_proof_hash;

    ALTER TABLE media
      DROP COLUMN IF EXISTS file_hash;
  `)
}

