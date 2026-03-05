import { db } from '../db/index.js';
import { user } from '../db/schema/index.js';
import { eq, ilike, sql } from 'drizzle-orm';
import { auth } from '../auth/index.js';

export const penggunaService = {
    async list(filters: { search?: string; role?: string; page?: number; limit?: number }) {
        const { search, role, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (search) conditions.push(ilike(user.name, `%${search}%`));
        if (role) conditions.push(eq(user.role, role));
        const where = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select({
            id: user.id, name: user.name, email: user.email, role: user.role,
            sekolahId: user.sekolahId, aktif: user.aktif, createdAt: user.createdAt,
        }).from(user).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(user).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: string) {
        const r = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, sekolahId: user.sekolahId, aktif: user.aktif, createdAt: user.createdAt })
            .from(user).where(eq(user.id, id));
        return r[0] || null;
    },

    async update(id: string, data: { name?: string; role?: string; sekolahId?: number; aktif?: boolean }) {
        const r = await db.update(user).set({ ...data, updatedAt: new Date() }).where(eq(user.id, id)).returning();
        return r[0];
    },

    async toggleActive(id: string) {
        const existing = await db.select({ aktif: user.aktif }).from(user).where(eq(user.id, id));
        if (!existing[0]) return null;
        const r = await db.update(user).set({ aktif: !existing[0].aktif, updatedAt: new Date() }).where(eq(user.id, id)).returning();
        return r[0];
    },

    async delete(id: string) {
        await db.delete(user).where(eq(user.id, id));
    },
};
