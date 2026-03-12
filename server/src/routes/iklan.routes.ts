import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { iklanService } from '../services/iklan.service.js';

const router = Router();

// GET /api/iklan — list (admin sees all, others see aktif only)
router.get('/', requireAuth, async (req, res) => {
    try {
        const isAdmin = req.user?.role?.toLowerCase() === 'admin';
        const data = await iklanService.list(isAdmin);
        res.json({ data, total: data.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/iklan/scripts — PUBLIC: get active scripts for injection (no auth needed)
router.get('/scripts', async (_req, res) => {
    try {
        const scripts = await iklanService.getActiveScripts();
        res.json(scripts);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/iklan/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const item = await iklanService.getById(Number(req.params.id));
        if (!item) { res.status(404).json({ error: 'Iklan tidak ditemukan' }); return; }
        res.json(item);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/iklan — admin create
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const item = await iklanService.create(req.body);
        res.status(201).json(item);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/iklan/:id — admin update
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const item = await iklanService.update(Number(req.params.id), req.body);
        if (!item) { res.status(404).json({ error: 'Iklan tidak ditemukan' }); return; }
        res.json(item);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/iklan/:id — admin delete
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await iklanService.delete(Number(req.params.id));
        res.status(204).end();
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
