import { db } from '../db/index.js';
import { matrikKegiatan } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';

export const matrikService = {
    async list(filters: { tahun?: number; sumberDana?: string; jenisPengadaan?: string; page?: number; limit?: number }) {
        const { tahun, sumberDana, jenisPengadaan, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (tahun) conditions.push(eq(matrikKegiatan.tahunAnggaran, tahun));
        if (sumberDana) conditions.push(eq(matrikKegiatan.sumberDana, sumberDana));
        if (jenisPengadaan) conditions.push(eq(matrikKegiatan.jenisPengadaan, jenisPengadaan));

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select().from(matrikKegiatan).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(matrikKegiatan).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: number) {
        const result = await db.select().from(matrikKegiatan).where(eq(matrikKegiatan.id, id));
        return result[0] || null;
    },

    async create(data: typeof matrikKegiatan.$inferInsert) {
        const result = await db.insert(matrikKegiatan).values(data).returning();
        return result[0];
    },

    async update(id: number, data: Partial<typeof matrikKegiatan.$inferInsert>) {
        const result = await db.update(matrikKegiatan).set({ ...data, updatedAt: new Date() }).where(eq(matrikKegiatan.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(matrikKegiatan).where(eq(matrikKegiatan.id, id));
    },

    async bulkCreate(items: (typeof matrikKegiatan.$inferInsert)[]) {
        return db.insert(matrikKegiatan).values(items).returning();
    },
};
