import { Router } from 'express';
import { aktivitasService } from '../services/aktivitas.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await aktivitasService.list({
            jenisAkun: req.query.jenisAkun,
            from: req.query.from,
            to: req.query.to,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/my', requireAuth, async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 50;
        const data = await aktivitasService.getByUserId(req.user.id, limit);
        res.json({ data, total: data.length, page: 1, limit });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await aktivitasService.delete(Number(req.params.id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
