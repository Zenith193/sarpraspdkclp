import { Router } from 'express';
import { riwayatBantuanService } from '../services/riwayatBantuan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await riwayatBantuanService.list({
            sekolahId: req.query.sekolahId ? Number(req.query.sekolahId) : undefined,
            search: req.query.search,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const r = await riwayatBantuanService.getById(Number(req.params.id));
        if (!r) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(r);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.status(201).json(await riwayatBantuanService.create(req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.json(await riwayatBantuanService.update(Number(req.params.id), req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await riwayatBantuanService.delete(Number(req.params.id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
