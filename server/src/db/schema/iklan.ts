import { pgTable, serial, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

// ============================================================
// IKLAN / ADS - Script Injection Model
// Admin inputs script tags (e.g. Google AdSense), system injects into <head>
// ============================================================
export const iklan = pgTable('iklan', {
    id: serial('id').primaryKey(),
    judul: text('judul').notNull(),           // Label/name for identification
    deskripsi: text('deskripsi'),             // Optional description
    advertiser: text('advertiser').notNull().default('-'), // Advertiser name
    scriptCode: text('script_code').notNull(), // The script tag to inject (e.g. Google AdSense)
    posisi: text('posisi').default('head'),    // head | body | sidebar
    aktif: boolean('aktif').default(true),
    prioritas: integer('prioritas').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
