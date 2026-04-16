import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { iklan } from '../db/schema/iklan.js';

export const iklanService = {
    // List all (admin sees all, others see aktif only)
    async list(showAll = false) {
        if (showAll) {
            return db.select().from(iklan).orderBy(desc(iklan.prioritas), desc(iklan.createdAt));
        }
        return db.select().from(iklan).where(eq(iklan.aktif, true)).orderBy(desc(iklan.prioritas));
    },

    async getById(id: number) {
        const rows = await db.select().from(iklan).where(eq(iklan.id, id));
        return rows[0] || null;
    },

    async create(data: any) {
        const rows = await db.insert(iklan).values({
            judul: data.judul,
            deskripsi: data.deskripsi || null,
            advertiser: data.advertiser || '-',
            scriptCode: data.scriptCode,
            posisi: data.posisi || 'head',
            aktif: data.aktif !== false,
            prioritas: data.prioritas || 0,
        }).returning();
        return rows[0];
    },

    async update(id: number, data: any) {
        const rows = await db.update(iklan).set({
            ...data,
            updatedAt: new Date(),
        }).where(eq(iklan.id, id)).returning();
        return rows[0];
    },

    async delete(id: number) {
        await db.delete(iklan).where(eq(iklan.id, id));
    },

    // Get active scripts for injection (public API)
    async getActiveScripts() {
        const rows = await db.select({
            id: iklan.id,
            scriptCode: iklan.scriptCode,
            posisi: iklan.posisi,
        }).from(iklan).where(eq(iklan.aktif, true)).orderBy(desc(iklan.prioritas));
        return rows;
    },
};
