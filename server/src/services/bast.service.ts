import { db } from '../db/index.js';
import { bast, bastTemplate, matrikKegiatan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export const bastService = {
    async list() {
        return db.select().from(bast);
    },

    async getById(id: number) {
        const result = await db.select().from(bast).where(eq(bast.id, id));
        return result[0] || null;
    },

    async create(data: typeof bast.$inferInsert, userId: string) {
        const result = await db.insert(bast).values({ ...data, createdBy: userId }).returning();
        return result[0];
    },

    async update(id: number, data: Partial<typeof bast.$inferInsert>) {
        const result = await db.update(bast).set(data).where(eq(bast.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(bast).where(eq(bast.id, id));
    },

    async revertByMatrikId(matrikId: number) {
        await db.delete(bast).where(eq(bast.matrikId, matrikId));
    },

    async getByNpsn(npsn: string) {
        return db.select().from(bast).where(eq(bast.npsn, npsn));
    },
};

export const templateService = {
    async list() { return db.select().from(bastTemplate); },
    async create(data: typeof bastTemplate.$inferInsert) {
        const result = await db.insert(bastTemplate).values(data).returning();
        return result[0];
    },
    async update(id: number, data: Partial<typeof bastTemplate.$inferInsert>) {
        const result = await db.update(bastTemplate).set({ ...data, updatedAt: new Date() }).where(eq(bastTemplate.id, id)).returning();
        return result[0];
    },
    async delete(id: number) { await db.delete(bastTemplate).where(eq(bastTemplate.id, id)); },
};
