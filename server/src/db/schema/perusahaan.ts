import { pgTable, text, serial, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const perusahaan = pgTable('perusahaan', {
    id: serial('id').primaryKey(),
    // Data Pemilik/Direktur
    nikPemilik: text('nik_pemilik'),
    namaPemilik: text('nama_pemilik'),
    jabatanPemilik: text('jabatan_pemilik'),
    alamatPemilik: text('alamat_pemilik'),
    // Data Perusahaan
    namaPerusahaan: text('nama_perusahaan').notNull(),
    namaPerusahaanSingkat: text('nama_perusahaan_singkat'),
    noAkta: text('no_akta'),
    namaNotaris: text('nama_notaris'),
    tanggalAkta: text('tanggal_akta'),
    alamatPerusahaan: text('alamat_perusahaan'),
    noTelp: text('no_telp'),
    emailPerusahaan: text('email_perusahaan'),
    npwp: text('npwp').notNull().unique(),
    // Data Rekening
    noRekening: text('no_rekening'),
    namaRekening: text('nama_rekening'),
    bank: text('bank'),
    // Status
    status: text('status').default('Menunggu'), // Menunggu | Diverifikasi | Ditolak
    keteranganVerifikasi: text('keterangan_verifikasi'),
    userId: text('user_id').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
});
