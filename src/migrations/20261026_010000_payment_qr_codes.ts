import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE site_settings
    ADD COLUMN payment_details_bank_transfer_qr_code_id integer REFERENCES media(id) ON DELETE SET NULL,
    ADD COLUMN payment_details_jazzcash_qr_code_id integer REFERENCES media(id) ON DELETE SET NULL,
    ADD COLUMN payment_details_easypaisa_qr_code_id integer REFERENCES media(id) ON DELETE SET NULL;
    CREATE INDEX site_settings_bank_qr_idx ON site_settings(payment_details_bank_transfer_qr_code_id);
    CREATE INDEX site_settings_jazzcash_qr_idx ON site_settings(payment_details_jazzcash_qr_code_id);
    CREATE INDEX site_settings_easypaisa_qr_idx ON site_settings(payment_details_easypaisa_qr_code_id);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE site_settings
    DROP COLUMN payment_details_bank_transfer_qr_code_id,
    DROP COLUMN payment_details_jazzcash_qr_code_id,
    DROP COLUMN payment_details_easypaisa_qr_code_id;`)
}
