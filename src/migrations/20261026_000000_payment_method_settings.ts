import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE site_settings
    ADD COLUMN IF NOT EXISTS payment_methods_cod BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_methods_bank_transfer BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS payment_methods_jazzcash BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_methods_easypaisa BOOLEAN DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE site_settings
    DROP COLUMN IF EXISTS payment_methods_cod,
    DROP COLUMN IF EXISTS payment_methods_bank_transfer,
    DROP COLUMN IF EXISTS payment_methods_jazzcash,
    DROP COLUMN IF EXISTS payment_methods_easypaisa;`)
}
