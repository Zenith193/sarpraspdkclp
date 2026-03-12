import { pgTable, text, integer, serial, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { user } from './auth';
// ============================================================
// KORWIL ASSIGNMENT (one row per kecamatan per user)
// ============================================================
export const korwilAssignment = pgTable('korwil_assignment', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    kecamatan: text('kecamatan').notNull(),
    jenjang: text('jenjang').notNull(), // SD | SMP
});
// ============================================================
// AKTIVITAS LOG
// ============================================================
export const aktivitas = pgTable('aktivitas', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id),
    namaAkun: text('nama_akun'),
    jenisAkun: text('jenis_akun'),
    aktivitas: text('aktivitas').notNull(),
    keterangan: text('keterangan'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow(),
});
// ============================================================
// APP SETTINGS (JSON key-value: access_config, countdown, nas_config)
// ============================================================
export const appSettings = pgTable('app_settings', {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
// ============================================================
// RIWAYAT BANTUAN
// ============================================================
export const riwayatBantuan = pgTable('riwayat_bantuan', {
    id: serial('id').primaryKey(),
    sekolahId: integer('sekolah_id').notNull(),
    namaPaket: text('nama_paket').notNull(),
    nilaiPaket: integer('nilai_paket'),
    volumePaket: text('volume_paket'),
    bastId: integer('bast_id'),
    tahun: integer('tahun'),
    createdAt: timestamp('created_at').defaultNow(),
});
