import { Router } from 'express';
import { penggunaService } from '../services/pengguna.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { user, account } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '../auth/index.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await penggunaService.list({
            search: req.query.search as string,
            role: req.query.role as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/batch', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        if (!Array.isArray(req.body.users)) {
            res.status(400).json({ error: 'Body harus berisi array users' });
            return;
        }
        res.json(await penggunaService.batchCreate(req.body.users));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role.toLowerCase() !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        const r = await penggunaService.getById(id);
        if (!r) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role.toLowerCase() !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        res.json(await penggunaService.update(id, req.body));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/toggle-active', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await penggunaService.toggleActive(req.params.id as string)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await penggunaService.delete(req.params.id as string); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== CHANGE PASSWORD =====
router.put('/:id/change-password', requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id as string;
        const isAdmin = req.user!.role.toLowerCase() === 'admin';
        const isSelf = req.user!.id === targetId;
        if (!isAdmin && !isSelf) { res.status(403).json({ error: 'Forbidden' }); return; }

        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'Password minimal 6 karakter' }); return;
        }

        // Hash using Better Auth's internal hashing
        const hashModule = await import('better-auth/crypto');
        const hashedPassword = await hashModule.hashPassword(newPassword);

        // Update hashed password in account table
        await db.update(account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(and(eq(account.userId, targetId), eq(account.providerId, 'credential')));

        // Update plain password in user table (raw SQL since column not in Drizzle schema)
        try {
            await db.execute(sql`UPDATE "user" SET "plain_password" = ${newPassword}, "updated_at" = NOW() WHERE "id" = ${targetId}`);
        } catch (_) { /* column may not exist yet */ }

        res.json({ success: true, message: 'Password berhasil diubah' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
