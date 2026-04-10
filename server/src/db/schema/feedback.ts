import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const feedback = pgTable('feedback', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    namaAkun: text('nama_akun').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    isiGagasan: text('isi_gagasan').notNull(),
    fotoPath: text('foto_path'),
    status: text('status').default('Baru'),        // Baru | Selesai
    catatanAdmin: text('catatan_admin'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
