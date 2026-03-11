import { Router } from 'express';
import { aktivitasService } from '../services/aktivitas.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await aktivitasService.list({
            jenisAkun: req.query.jenisAkun as string,
            from: req.query.from as string,
            to: req.query.to as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/my', requireAuth, async (req, res) => {
    try { res.json(await aktivitasService.getByUserId(req.user!.id)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await aktivitasService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
