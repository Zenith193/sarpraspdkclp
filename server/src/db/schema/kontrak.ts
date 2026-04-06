import { pgTable, text, integer, serial, bigint, date, timestamp, numeric } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { perusahaan } from './perusahaan';
import { matrikKegiatan } from './matrik';

// ============================================================
// PERMOHONAN KONTRAK
// ============================================================
export const permohonanKontrak = pgTable('permohonan_kontrak', {
    id: serial('id').primaryKey(),
    perusahaanId: integer('perusahaan_id').notNull().references(() => perusahaan.id, { onDelete: 'cascade' }),
    matrikId: integer('matrik_id').references(() => matrikKegiatan.id),
    // Dasar Permohonan (from SiRUP search)
    kodeSirup: text('kode_sirup').notNull(),
    namaPaket: text('nama_paket'),
    metodePengadaan: text('metode_pengadaan'),
    jenisPengadaan: text('jenis_pengadaan'),
    // Step 2: DPPL & BAHPL
    noDppl: text('no_dppl'),
    tanggalDppl: date('tanggal_dppl'),
    noBahpl: text('no_bahpl'),
    tanggalBahpl: date('tanggal_bahpl'),
    berkasPenawaranPath: text('berkas_penawaran_path'),
    // Lampiran data (JSON)
    timPenugasan: text('tim_penugasan'),       // JSON array
    peralatanUtama: text('peralatan_utama'),    // JSON array
    uraianSingkat: text('uraian_singkat'),      // JSON array of strings (lingkup pekerjaan)
    // SPK data (filled by verifikator)
    noSpk: text('no_spk'),
    nilaiKontrak: bigint('nilai_kontrak', { mode: 'number' }),
    terbilangKontrak: text('terbilang_kontrak'),
    tanggalMulai: date('tanggal_mulai'),
    tanggalSelesai: date('tanggal_selesai'),
    waktuPenyelesaian: text('waktu_penyelesaian'),
    tataCaraPembayaran: text('tata_cara_pembayaran'),
    uangMuka: text('uang_muka'),
    nilaiItems: text('nilai_items'), // JSON array of {nama, nilai} for child packages
    // SP/SPMK (filled by verifikator)
    noSp: text('no_sp'),
    tanggalSp: date('tanggal_sp'),
    idPaket: text('id_paket'),
    // Status
    status: text('status').default('Menunggu'), // Menunggu | Diverifikasi | Ditolak | Selesai
    catatan: text('catatan'),
    // Tracking
    createdBy: text('created_by').references(() => user.id),
    verifiedBy: text('verified_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// REALISASI (progress per kontrak per periode)
// ============================================================
export const realisasi = pgTable('realisasi', {
    id: serial('id').primaryKey(),
    kontrakId: integer('kontrak_id').references(() => permohonanKontrak.id, { onDelete: 'cascade' }),
    namaSekolah: text('nama_sekolah'),
    matrikId: integer('matrik_id').references(() => matrikKegiatan.id),
    tahun: integer('tahun').notNull(),
    bulan: integer('bulan').notNull(),
    targetPersen: numeric('target_persen', { precision: 5, scale: 2 }).default('0'),
    realisasiPersen: numeric('realisasi_persen', { precision: 5, scale: 2 }).default('0'),
    dokumentasiPaths: text('dokumentasi_paths'), // JSON array of up to 6 image paths
    keterangan: text('keterangan'),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
});
