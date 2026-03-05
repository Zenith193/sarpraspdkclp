import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { iklanService } from '../services/iklan.service';

const router = Router();

// GET /api/iklan — list (admin sees all, others see aktif only)
router.get('/', requireAuth, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const data = await iklanService.list(isAdmin);
        res.json({ data, total: data.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/iklan/stats — admin stats
router.get('/stats', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const stats = await iklanService.getStats();
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/iklan/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const item = await iklanService.getById(Number(req.params.id));
        if (!item) return res.status(404).json({ error: 'Iklan tidak ditemukan' });
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
        if (!item) return res.status(404).json({ error: 'Iklan tidak ditemukan' });
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

// POST /api/iklan/:id/klik — record click
router.post('/:id/klik', requireAuth, async (req, res) => {
    try {
        const result = await iklanService.recordKlik(Number(req.params.id));
        res.json(result || { ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/iklan/:id/tayang — record impression
router.post('/:id/tayang', requireAuth, async (req, res) => {
    try {
        const result = await iklanService.recordTayang(Number(req.params.id));
        res.json(result || { ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
