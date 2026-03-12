import { db } from '../db/index.js';
import { bast, bastTemplate } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { queueGDriveDelete } from '../utils/uploadQueue.js';
export const bastService = {
    async list() {
        return db.select().from(bast);
    },
    async getById(id) {
        const result = await db.select().from(bast).where(eq(bast.id, id));
        return result[0] || null;
    },
    async create(data, userId) {
        const result = await db.insert(bast).values({ ...data, createdBy: userId }).returning();
        return result[0];
    },
    async update(id, data) {
        const result = await db.update(bast).set(data).where(eq(bast.id, id)).returning();
        return result[0];
    },
    async delete(id) {
        await db.delete(bast).where(eq(bast.id, id));
    },
    async revertByMatrikId(matrikId) {
        await db.delete(bast).where(eq(bast.matrikId, matrikId));
    },
    async getByNpsn(npsn) {
        return db.select().from(bast).where(eq(bast.npsn, npsn));
    },
};
export const templateService = {
    async list() { return db.select().from(bastTemplate); },
    async getById(id) {
        const result = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
        return result[0] || null;
    },
    async create(data) {
        const result = await db.insert(bastTemplate).values(data).returning();
        return result[0];
    },
    async update(id, data) {
        // Delete old GDrive file if replacing
        if (data.filePath) {
            const existing = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
            if (existing[0])
                queueGDriveDelete(existing[0].filePath);
        }
        const result = await db.update(bastTemplate).set({ ...data, updatedAt: new Date() }).where(eq(bastTemplate.id, id)).returning();
        return result[0];
    },
    async delete(id) {
        const existing = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
        if (existing[0])
            queueGDriveDelete(existing[0].filePath);
        await db.delete(bastTemplate).where(eq(bastTemplate.id, id));
    },
};
