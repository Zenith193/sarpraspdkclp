import { pgTable, serial, text, real, integer, timestamp, date } from 'drizzle-orm/pg-core';
// ============================================================
// IKLAN / ADS TABLE
// ============================================================
export const iklan = pgTable('iklan', {
    id: serial('id').primaryKey(),
    judul: text('judul').notNull(),
    deskripsi: text('deskripsi'),
    tipeIklan: text('tipe_iklan').notNull().default('banner'), // banner, sidebar, popup, native
    gambarUrl: text('gambar_url'),
    targetUrl: text('target_url'),
    advertiser: text('advertiser').notNull(),
    biayaPerKlik: real('biaya_per_klik').default(0), // CPC
    biayaPerTayang: real('biaya_per_tayang').default(0), // CPM (per 1000)
    budgetTotal: real('budget_total').default(0),
    budgetTerpakai: real('budget_terpakai').default(0),
    totalTayang: integer('total_tayang').default(0),
    totalKlik: integer('total_klik').default(0),
    status: text('status').notNull().default('aktif'), // aktif, nonaktif, habis, dijadwalkan
    tanggalMulai: date('tanggal_mulai'),
    tanggalSelesai: date('tanggal_selesai'),
    prioritas: integer('prioritas').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
