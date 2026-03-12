import { pgTable, text, integer, serial, bigint, timestamp } from 'drizzle-orm/pg-core';
// ============================================================
// PROYEKSI ANGGARAN
// ============================================================
export const proyeksiAnggaran = pgTable('proyeksi_anggaran', {
    id: serial('id').primaryKey(),
    jenisPrasarana: text('jenis_prasarana').notNull(),
    jenjang: text('jenjang').notNull(),
    lantai: integer('lantai').default(1),
    rusakSedang: bigint('rusak_sedang', { mode: 'number' }).default(0),
    rusakBerat: bigint('rusak_berat', { mode: 'number' }).default(0),
    pembangunan: bigint('pembangunan', { mode: 'number' }).default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
});
// ============================================================
// SNP ACUAN
// ============================================================
export const snpAcuan = pgTable('snp_acuan', {
    id: serial('id').primaryKey(),
    jenisPrasarana: text('jenis_prasarana').notNull(),
    jenjang: text('jenjang').notNull(),
    judulRehabilitasi: text('judul_rehabilitasi'),
    judulPembangunan: text('judul_pembangunan'),
});
