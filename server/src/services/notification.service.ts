import { db } from '../db/index.js';
import { notification } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export const notificationService = {
    async listByUser(userId: string, limit = 50) {
        return db.select().from(notification)
            .where(eq(notification.userId, userId))
            .orderBy(desc(notification.createdAt))
            .limit(limit);
    },

    async unreadCount(userId: string) {
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(notification)
            .where(and(eq(notification.userId, userId), eq(notification.isRead, false)));
        return Number(result[0]?.count || 0);
    },

    async create(data: {
        userId: string;
        sekolahId?: number | null;
        title: string;
        message: string;
        type?: string;
        relatedId?: number | null;
        relatedType?: string | null;
    }) {
        const result = await db.insert(notification).values({
            userId: data.userId,
            sekolahId: data.sekolahId || null,
            title: data.title,
            message: data.message,
            type: data.type || 'info',
            relatedId: data.relatedId || null,
            relatedType: data.relatedType || null,
        }).returning();
        return result[0];
    },

    async markRead(id: number, userId: string) {
        return db.update(notification)
            .set({ isRead: true })
            .where(and(eq(notification.id, id), eq(notification.userId, userId)))
            .returning();
    },

    async markAllRead(userId: string) {
        return db.update(notification)
            .set({ isRead: true })
            .where(and(eq(notification.userId, userId), eq(notification.isRead, false)))
            .returning();
    },

    async delete(id: number, userId: string) {
        return db.delete(notification)
            .where(and(eq(notification.id, id), eq(notification.userId, userId)));
    },
};
