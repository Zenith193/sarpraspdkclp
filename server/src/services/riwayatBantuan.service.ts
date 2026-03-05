import { db } from '../db/index.js';
import { riwayatBantuan, sekolah } from '../db/schema/index.js';
import { eq, ilike, and, sql } from 'drizzle-orm';

export const riwayatBantuanService = {
    async list(filters: { sekolahId?: number; search?: string; page?: number; limit?: number }) {
        const { sekolahId, search, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (sekolahId) conditions.push(eq(riwayatBantuan.sekolahId, sekolahId));
        if (search) conditions.push(ilike(riwayatBantuan.namaPaket, `%${search}%`));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select({ riwayatBantuan, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn })
            .from(riwayatBantuan).leftJoin(sekolah, eq(riwayatBantuan.sekolahId, sekolah.id)).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(riwayatBantuan).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },
    async getById(id: number) { const r = await db.select().from(riwayatBantuan).where(eq(riwayatBantuan.id, id)); return r[0] || null; },
    async create(data: typeof riwayatBantuan.$inferInsert) { const r = await db.insert(riwayatBantuan).values(data).returning(); return r[0]; },
    async update(id: number, data: Partial<typeof riwayatBantuan.$inferInsert>) { const r = await db.update(riwayatBantuan).set(data).where(eq(riwayatBantuan.id, id)).returning(); return r[0]; },
    async delete(id: number) { await db.delete(riwayatBantuan).where(eq(riwayatBantuan.id, id)); },
};
