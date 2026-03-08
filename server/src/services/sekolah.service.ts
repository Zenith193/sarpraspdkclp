import { db } from '../db/index.js';
import { sekolah, user } from '../db/schema/index.js';
import { eq, ilike, and, sql, inArray } from 'drizzle-orm';

export const sekolahService = {
    async list(filters: { id?: number; search?: string; kecamatan?: string; jenjang?: string; page?: number; limit?: number; onlyWithUsers?: boolean }) {
        const { id, search, kecamatan, jenjang, page = 1, limit = 50, onlyWithUsers } = filters;
        const conditions = [];

        if (id) conditions.push(eq(sekolah.id, id));
        if (search) conditions.push(ilike(sekolah.nama, `%${search}%`));
        if (kecamatan) conditions.push(eq(sekolah.kecamatan, kecamatan));
        if (jenjang) conditions.push(eq(sekolah.jenjang, jenjang));

        // Only return schools that have at least 1 active user linked
        if (onlyWithUsers) {
            const activeUserSchools = await db
                .selectDistinct({ sekolahId: user.sekolahId })
                .from(user)
                .where(eq(user.aktif, true));
            const activeIds = activeUserSchools
                .map(r => r.sekolahId)
                .filter((id): id is number => id !== null && id !== undefined);
            if (activeIds.length > 0) {
                conditions.push(inArray(sekolah.id, activeIds));
            } else {
                // No active users → return empty
                return { data: [], total: 0, page, limit };
            }
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const [data, countResult] = await Promise.all([
            db.select().from(sekolah).where(where).limit(limit).offset(offset),
            db.select({ count: sql<number>`count(*)` }).from(sekolah).where(where),
        ]);

        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: number) {
        const result = await db.select().from(sekolah).where(eq(sekolah.id, id));
        return result[0] || null;
    },

    async create(data: typeof sekolah.$inferInsert) {
        const result = await db.insert(sekolah).values(data).returning();
        return result[0];
    },

    async update(id: number, data: Partial<typeof sekolah.$inferInsert>) {
        const result = await db.update(sekolah).set({ ...data, updatedAt: new Date() }).where(eq(sekolah.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(sekolah).where(eq(sekolah.id, id));
    },
};
