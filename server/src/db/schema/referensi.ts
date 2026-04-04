import { pgTable, text, serial, integer, timestamp } from 'drizzle-orm/pg-core';

// ============================================================
// DASAR HUKUM
// ============================================================
export const dasarHukum = pgTable('dasar_hukum', {
    id: serial('id').primaryKey(),
    tahun: integer('tahun').notNull(),
    isi: text('isi').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// SATUAN KERJA
// ============================================================
export const satuanKerja = pgTable('satuan_kerja', {
    id: serial('id').primaryKey(),
    nip: text('nip').notNull(),
    namaPimpinan: text('nama_pimpinan').notNull(),
    jabatan: text('jabatan'),
    website: text('website'),
    email: text('email'),
    telepon: text('telepon'),
    klpd: text('klpd'),
    createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// PPKOM (Pejabat Pembuat Komitmen)
// ============================================================
export const ppkom = pgTable('ppkom', {
    id: serial('id').primaryKey(),
    nip: text('nip').notNull(),
    nama: text('nama').notNull(),
    pangkat: text('pangkat'),
    jabatan: text('jabatan'),
    alamat: text('alamat'),
    noTelp: text('no_telp'),
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow(),
});
