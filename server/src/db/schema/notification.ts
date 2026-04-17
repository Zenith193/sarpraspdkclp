import { pgTable, text, integer, serial, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { sekolah } from './sekolah';

// ============================================================
// NOTIFICATIONS (In-App)
// ============================================================
export const notification = pgTable('notifications', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    sekolahId: integer('sekolah_id').references(() => sekolah.id),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').default('info'),            // 'info' | 'warning' | 'error' | 'success'
    isRead: boolean('is_read').default(false),
    relatedId: integer('related_id'),               // e.g. sarpras ID
    relatedType: text('related_type'),              // 'sarpras' | 'proposal' | etc.
    createdAt: timestamp('created_at').defaultNow(),
});
