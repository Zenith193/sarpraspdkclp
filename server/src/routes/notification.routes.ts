import { Router } from 'express';
import { notificationService } from '../services/notification.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List notifications for current user
router.get('/', requireAuth, async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 50;
        const data = await notificationService.listByUser(req.user!.id, limit);
        res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get unread count
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const count = await notificationService.unreadCount(req.user!.id);
        res.json({ count });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Mark one as read
router.put('/:id/read', requireAuth, async (req, res) => {
    try {
        await notificationService.markRead(Number(req.params.id), req.user!.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
    try {
        await notificationService.markAllRead(req.user!.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await notificationService.delete(Number(req.params.id), req.user!.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
