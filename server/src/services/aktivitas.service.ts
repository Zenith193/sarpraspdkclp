import { db } from '../db/index.js';
import { aktivitas } from '../db/schema/index.js';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export const aktivitasService = {
    async list(filters: { jenisAkun?: string; from?: string; to?: string; page?: number; limit?: number }) {
        const { jenisAkun, from, to, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (jenisAkun) conditions.push(eq(aktivitas.jenisAkun, jenisAkun));
        if (from) conditions.push(gte(aktivitas.createdAt, new Date(from)));
        if (to) conditions.push(lte(aktivitas.createdAt, new Date(to)));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select().from(aktivitas).where(where).orderBy(sql`${aktivitas.createdAt} DESC`).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(aktivitas).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getByUserId(userId: string, limit = 50) {
        return db.select().from(aktivitas).where(eq(aktivitas.userId, userId)).orderBy(sql`${aktivitas.createdAt} DESC`).limit(limit);
    },

    async log(data: { userId?: string; namaAkun: string; jenisAkun: string; aktivitas: string; keterangan?: string; ipAddress?: string }) {
        return db.insert(aktivitas).values(data).returning();
    },

    async delete(id: number) {
        await db.delete(aktivitas).where(eq(aktivitas.id, id));
    },
};
