import { pgTable, text, integer, serial, bigint, date, timestamp } from 'drizzle-orm/pg-core';
import { sekolah } from './sekolah';
import { user } from './auth';

// ============================================================
// PROPOSAL
// ============================================================
export const proposal = pgTable('proposal', {
    id: serial('id').primaryKey(),
    sekolahId: integer('sekolah_id').notNull().references(() => sekolah.id, { onDelete: 'cascade' }),
    subKegiatan: text('sub_kegiatan').notNull(),
    nilaiPengajuan: bigint('nilai_pengajuan', { mode: 'number' }),
    target: text('target'),
    noAgendaSurat: text('no_agenda_surat'),
    tanggalSurat: date('tanggal_surat', { mode: 'string' }),
    statusUsulan: text('status_usulan'),
    keterangan: text('keterangan'),
    status: text('status').notNull().default('Menunggu Verifikasi'),
    bintang: integer('bintang').default(0),
    keranjang: text('keranjang'),
    alasanRevisi: text('alasan_revisi'),
    ranking: integer('ranking'),
    fileName: text('file_name'),
    filePath: text('file_path'),
    uploadStatus: text('upload_status').default('done'), // 'uploading' | 'done' | 'failed'
    verifiedBy: text('verified_by').references(() => user.id),
    createdBy: text('created_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// PROPOSAL FOTO
// ============================================================
export const proposalFoto = pgTable('proposal_foto', {
    id: serial('id').primaryKey(),
    proposalId: integer('proposal_id').notNull().references(() => proposal.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    uploadStatus: text('upload_status').default('done'),
    createdAt: timestamp('created_at').defaultNow(),
});
