import { db } from '../db/index.js';
import { korwilAssignment, user } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
export const korwilService = {
    async list() {
        return db.select({ korwilAssignment, userName: user.name, userEmail: user.email })
            .from(korwilAssignment).leftJoin(user, eq(korwilAssignment.userId, user.id));
    },
    async assign(data) {
        // Delete existing assignments for this user, then insert new ones
        await db.delete(korwilAssignment).where(eq(korwilAssignment.userId, data.userId));
        const rows = data.kecamatanList.map(k => ({ userId: data.userId, kecamatan: k, jenjang: data.jenjang }));
        if (rows.length > 0) {
            return db.insert(korwilAssignment).values(rows).returning();
        }
        return [];
    },
    async update(userId, data) {
        return this.assign({ userId, ...data });
    },
    async delete(userId) {
        await db.delete(korwilAssignment).where(eq(korwilAssignment.userId, userId));
    },
};
