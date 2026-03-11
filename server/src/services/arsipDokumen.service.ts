import { db } from '../db/index.js';
import { arsipRekomendasi, arsipChecklist } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export const arsipDokumenService = {
    // Rekomendasi
    async listRekomendasi(limit = 500) {
        return db.select().from(arsipRekomendasi).orderBy(desc(arsipRekomendasi.createdAt)).limit(limit);
    },
    async createRekomendasi(data: typeof arsipRekomendasi.$inferInsert) {
        const r = await db.insert(arsipRekomendasi).values(data).returning();
        return r[0];
    },
    async deleteRekomendasi(id: number) {
        await db.delete(arsipRekomendasi).where(eq(arsipRekomendasi.id, id));
    },

    // Checklist
    async listChecklist(limit = 500) {
        return db.select().from(arsipChecklist).orderBy(desc(arsipChecklist.createdAt)).limit(limit);
    },
    async createChecklist(data: typeof arsipChecklist.$inferInsert) {
        const r = await db.insert(arsipChecklist).values(data).returning();
        return r[0];
    },
    async deleteChecklist(id: number) {
        await db.delete(arsipChecklist).where(eq(arsipChecklist.id, id));
    },
};
