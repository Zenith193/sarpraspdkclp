import { Router } from 'express';
import { penggunaService } from '../services/pengguna.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        const r = await penggunaService.getById(id);
        if (!r) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        res.json(await penggunaService.update(id, req.body));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/toggle-active', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await penggunaService.toggleActive(req.params.id as string)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await penggunaService.delete(req.params.id as string); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
