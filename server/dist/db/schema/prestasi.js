import { pgTable, text, integer, serial, timestamp } from 'drizzle-orm/pg-core';
import { sekolah } from './sekolah';
import { user } from './auth';
// ============================================================
// PRESTASI
// ============================================================
export const prestasi = pgTable('prestasi', {
    id: serial('id').primaryKey(),
    sekolahId: integer('sekolah_id').notNull().references(() => sekolah.id, { onDelete: 'cascade' }),
    jenisPrestasi: text('jenis_prestasi').notNull(),
    siswa: text('siswa').notNull(),
    kategori: text('kategori').notNull(), // Perorangan | Beregu
    tingkat: text('tingkat').notNull(), // Kecamatan | Kabupaten/Kota | Provinsi | Nasional | Internasional
    tahun: integer('tahun'),
    capaian: text('capaian'), // Juara 1, 2, 3, etc.
    sertifikatPath: text('sertifikat_path'),
    uploadStatus: text('upload_status').default('done'), // 'uploading' | 'done' | 'failed'
    status: text('status').default('Menunggu Verifikasi'),
    alasanPenolakan: text('alasan_penolakan'),
    verifiedBy: text('verified_by').references(() => user.id),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
// ============================================================
// PRESTASI POINT RULE
// ============================================================
export const prestasiPointRule = pgTable('prestasi_point_rule', {
    id: serial('id').primaryKey(),
    tingkat: text('tingkat').notNull(),
    kategori: text('kategori').notNull(),
    capaian: text('capaian').notNull(),
    poin: integer('poin').notNull(),
});
