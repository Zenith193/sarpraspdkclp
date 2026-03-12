import { pgTable, text, integer, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
// ============================================================
// SEKOLAH
// ============================================================
export const sekolah = pgTable('sekolah', {
    id: serial('id').primaryKey(),
    nama: text('nama').notNull(),
    npsn: varchar('npsn', { length: 20 }).notNull().unique(),
    jenjang: text('jenjang').notNull(), // 'SD' | 'SMP'
    kecamatan: text('kecamatan').notNull(),
    status: text('status').notNull(), // 'Negeri' | 'Swasta'
    alamat: text('alamat'),
    kepsek: text('kepsek'),
    nip: text('nip'),
    noRek: text('no_rek'),
    namaBank: text('nama_bank'),
    rombel: integer('rombel').default(0),
    kopSekolah: text('kop_sekolah'),
    denahSekolah: text('denah_sekolah'),
    kopUploadStatus: text('kop_upload_status').default('done'),
    denahUploadStatus: text('denah_upload_status').default('done'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
