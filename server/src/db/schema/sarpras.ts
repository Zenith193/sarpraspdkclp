import { pgTable, text, integer, serial, boolean, timestamp, doublePrecision } from 'drizzle-orm/pg-core';
import { sekolah } from './sekolah';
import { user } from './auth';

// ============================================================
// SARPRAS (Sarana & Prasarana)
// ============================================================
export const sarpras = pgTable('sarpras', {
    id: serial('id').primaryKey(),
    sekolahId: integer('sekolah_id').notNull().references(() => sekolah.id, { onDelete: 'cascade' }),
    masaBangunan: text('masa_bangunan'),
    jenisPrasarana: text('jenis_prasarana').notNull(),
    namaRuang: text('nama_ruang').notNull(),
    lantai: integer('lantai').default(1),
    panjang: doublePrecision('panjang'),
    lebar: doublePrecision('lebar'),
    luas: doublePrecision('luas'),
    kondisi: text('kondisi').notNull(),           // BAIK | RUSAK RINGAN | RUSAK SEDANG | RUSAK BERAT
    keterangan: text('keterangan'),
    bintang: integer('bintang').default(0),
    verified: boolean('verified').default(false),
    status: text('status').default('Diverifikasi'),   // Menunggu Verifikasi Korwil | Menunggu Verifikasi | Diverifikasi | Ditolak | Revisi
    actionType: text('action_type'),                   // tambah | edit | hapus
    alasanPenolakan: text('alasan_penolakan'),
    previousData: text('previous_data'),              // JSON snapshot of data before edit
    verifiedBy: text('verified_by').references(() => user.id),
    verifiedAt: timestamp('verified_at'),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// SARPRAS FOTO
// ============================================================
export const sarprasFoto = pgTable('sarpras_foto', {
    id: serial('id').primaryKey(),
    sarprasId: integer('sarpras_id').notNull().references(() => sarpras.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    uploadStatus: text('upload_status').default('done'), // 'uploading' | 'done' | 'failed'
    createdAt: timestamp('created_at').defaultNow(),
});
