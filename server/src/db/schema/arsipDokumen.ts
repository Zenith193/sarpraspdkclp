import { pgTable, text, integer, serial, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { user } from './auth';

// ============================================================
// ARSIP REKOMENDASI
// ============================================================
export const arsipRekomendasi = pgTable('arsip_rekomendasi', {
    id: serial('id').primaryKey(),
    namaSekolah: text('nama_sekolah').notNull(),
    kecamatan: text('kecamatan'),
    subKegiatan: text('sub_kegiatan'),
    perihal: text('perihal'),
    jenjang: text('jenjang'),
    nilai: text('nilai'),
    target: text('target'),
    noAgenda: text('no_agenda'),
    suratMasuk: text('surat_masuk'),
    tanggalSurat: text('tanggal_surat'),
    nomorSurat: text('nomor_surat'),
    kondisi: text('kondisi'),
    sumber: text('sumber'),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// ARSIP CHECKLIST
// ============================================================
export const arsipChecklist = pgTable('arsip_checklist', {
    id: serial('id').primaryKey(),
    sekolahNama: text('sekolah_nama').notNull(),
    sekolahAlamat: text('sekolah_alamat'),
    jenisUsulan: text('jenis_usulan'),
    items: jsonb('items').default([]),          // array of { indikator, status, keterangan }
    verifikators: jsonb('verifikators').default([]), // array of { nama, nip }
    tanggalCetak: text('tanggal_cetak'),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
});
