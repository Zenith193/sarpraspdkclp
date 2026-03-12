import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema/index.js';

const connectionString = process.env.DATABASE_URL!;

const pool = new pg.Pool({ connectionString });
export const db = drizzle(pool, { schema });

export type Database = typeof db;

// Auto-create performance indexes on startup
export async function ensureIndexes() {
    try {
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_sekolah_kecamatan ON sekolah (kecamatan);
            CREATE INDEX IF NOT EXISTS idx_sekolah_jenjang ON sekolah (jenjang);
            CREATE INDEX IF NOT EXISTS idx_sekolah_npsn ON sekolah (npsn);
            CREATE INDEX IF NOT EXISTS idx_sekolah_kec_jen ON sekolah (kecamatan, jenjang);
            CREATE INDEX IF NOT EXISTS idx_sarpras_sekolah_id ON sarpras (sekolah_id);
            CREATE INDEX IF NOT EXISTS idx_sarpras_verified ON sarpras (verified);
            CREATE INDEX IF NOT EXISTS idx_sarpras_sekolah_verified ON sarpras (sekolah_id, verified);
            CREATE INDEX IF NOT EXISTS idx_sarpras_foto_sarpras_id ON sarpras_foto (sarpras_id);
            CREATE INDEX IF NOT EXISTS idx_sarpras_foto_upload ON sarpras_foto (upload_status);
            CREATE INDEX IF NOT EXISTS idx_form_kerusakan_sekolah_id ON form_kerusakan (sekolah_id);
            CREATE INDEX IF NOT EXISTS idx_form_kerusakan_status ON form_kerusakan (status);
            CREATE INDEX IF NOT EXISTS idx_form_kerusakan_upload ON form_kerusakan (upload_status);
            CREATE INDEX IF NOT EXISTS idx_proposal_sekolah_id ON proposal (sekolah_id);
            CREATE INDEX IF NOT EXISTS idx_proposal_status ON proposal (status);
            CREATE INDEX IF NOT EXISTS idx_proposal_upload ON proposal (upload_status);
            CREATE INDEX IF NOT EXISTS idx_proposal_foto_proposal_id ON proposal_foto (proposal_id);
            CREATE INDEX IF NOT EXISTS idx_prestasi_sekolah_id ON prestasi (sekolah_id);
            CREATE INDEX IF NOT EXISTS idx_prestasi_status ON prestasi (status);
            CREATE INDEX IF NOT EXISTS idx_prestasi_upload ON prestasi (upload_status);
            CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings (key);
        `);
        // Auto-add riwayat_bantuan file columns if missing
        await db.execute(sql`ALTER TABLE riwayat_bantuan ADD COLUMN IF NOT EXISTS file_name TEXT`);
        await db.execute(sql`ALTER TABLE riwayat_bantuan ADD COLUMN IF NOT EXISTS file_path TEXT`);
        await db.execute(sql`ALTER TABLE riwayat_bantuan ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done'`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_riwayat_bantuan_sekolah_id ON riwayat_bantuan (sekolah_id)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_riwayat_bantuan_upload ON riwayat_bantuan (upload_status)`);
        console.log('[DB] Performance indexes ensured ✅');
    } catch (e: any) {
        console.error('[DB] Index creation warning:', e.message);
    }
}
