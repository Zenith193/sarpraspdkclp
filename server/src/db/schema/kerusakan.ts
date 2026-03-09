import { pgTable, text, integer, serial, timestamp } from 'drizzle-orm/pg-core';
import { sekolah } from './sekolah';
import { user } from './auth';

// ============================================================
// FORM KERUSAKAN
// ============================================================
export const formKerusakan = pgTable('form_kerusakan', {
    id: serial('id').primaryKey(),
    sekolahId: integer('sekolah_id').notNull().references(() => sekolah.id, { onDelete: 'cascade' }),
    masaBangunan: text('masa_bangunan'),
    fileName: text('file_name'),
    filePath: text('file_path'),
    uploadStatus: text('upload_status').default('done'), // 'uploading' | 'done' | 'failed'
    status: text('status').default('Belum Upload'),  // Belum Upload | Menunggu Verifikasi | Diverifikasi | Ditolak
    alasanPenolakan: text('alasan_penolakan'),
    verifiedBy: text('verified_by').references(() => user.id),
    uploadedBy: text('uploaded_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
