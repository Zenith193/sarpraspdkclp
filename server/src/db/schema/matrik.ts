import { pgTable, text, integer, serial, bigint, date, timestamp } from 'drizzle-orm/pg-core';
import { sekolah } from './sekolah';
import { user } from './auth';

// ============================================================
// MATRIK KEGIATAN
// ============================================================
export const matrikKegiatan = pgTable('matrik_kegiatan', {
    id: serial('id').primaryKey(),
    noMatrik: text('no_matrik').notNull(),
    npsn: text('npsn'),
    namaSekolah: text('nama_sekolah'),
    subBidang: text('sub_bidang'),
    noSubKegiatan: text('no_sub_kegiatan'),
    subKegiatan: text('sub_kegiatan'),
    rup: text('rup'),
    namaPaket: text('nama_paket'),
    paguAnggaran: bigint('pagu_anggaran', { mode: 'number' }),
    paguPaket: bigint('pagu_paket', { mode: 'number' }),
    hps: bigint('hps', { mode: 'number' }),
    nilaiKontrak: bigint('nilai_kontrak', { mode: 'number' }),
    terbilangKontrak: text('terbilang_kontrak'),
    sumberDana: text('sumber_dana'),
    metode: text('metode'),
    jenisPengadaan: text('jenis_pengadaan'),
    penyedia: text('penyedia'),
    namaPemilik: text('nama_pemilik'),
    statusPemilik: text('status_pemilik'),
    alamatKantor: text('alamat_kantor'),
    noSpk: text('no_spk'),
    tanggalMulai: date('tanggal_mulai'),
    tanggalSelesai: date('tanggal_selesai'),
    jangkaWaktu: integer('jangka_waktu'),
    tahunAnggaran: integer('tahun_anggaran'),
    honor: bigint('honor', { mode: 'number' }).default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// PENCAIRAN (1:1 with matrik)
// ============================================================
export const pencairan = pgTable('pencairan', {
    id: serial('id').primaryKey(),
    matrikId: integer('matrik_id').notNull().references(() => matrikKegiatan.id, { onDelete: 'cascade' }).unique(),
    pencairanPersen: integer('pencairan_persen').default(0),
    status: text('status').default('Belum Masuk'),  // Belum Masuk | Masuk | Keuangan | Clear
    noRegister: text('no_register'),
    noSp2d: text('no_sp2d'),
    hariKalender: integer('hari_kalender').default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// BAST TEMPLATE
// ============================================================
export const bastTemplate = pgTable('bast_template', {
    id: serial('id').primaryKey(),
    nama: text('nama').notNull(),
    header: text('header'),
    deskripsi: text('deskripsi'),
    jenisCocok: text('jenis_cocok'),
    content: text('content'),
    filePath: text('file_path'),
    uploadStatus: text('upload_status').default('done'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// BAST
// ============================================================
export const bast = pgTable('bast', {
    id: serial('id').primaryKey(),
    matrikId: integer('matrik_id').notNull().references(() => matrikKegiatan.id),
    templateId: integer('template_id').references(() => bastTemplate.id),
    noBast: text('no_bast'),
    npsn: text('npsn'),
    namaSekolah: text('nama_sekolah'),
    namaPaket: text('nama_paket'),
    nilaiKontrak: bigint('nilai_kontrak', { mode: 'number' }),
    penyedia: text('penyedia'),
    tanggalBast: date('tanggal_bast'),
    generatedHtml: text('generated_html'),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
});
