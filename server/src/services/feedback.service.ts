import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { feedback } from '../db/schema/feedback.js';

export const feedbackService = {
    async list() {
        return db.select().from(feedback).orderBy(desc(feedback.createdAt));
    },

    async getById(id: number) {
        const rows = await db.select().from(feedback).where(eq(feedback.id, id));
        return rows[0] || null;
    },

    async create(data: any) {
        const rows = await db.insert(feedback).values({
            userId: data.userId,
            namaAkun: data.namaAkun,
            email: data.email,
            role: data.role,
            isiGagasan: data.isiGagasan,
            fotoPath: data.fotoPath || null,
        }).returning();
        return rows[0];
    },

    async update(id: number, data: any) {
        const rows = await db.update(feedback).set({
            ...data,
            updatedAt: new Date(),
        }).where(eq(feedback.id, id)).returning();
        return rows[0];
    },

    async delete(id: number) {
        await db.delete(feedback).where(eq(feedback.id, id));
    },
};
