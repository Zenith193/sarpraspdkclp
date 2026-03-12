import { Router } from 'express';
import { matrikService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.list({
            tahun: req.query.tahun ? Number(req.query.tahun) : undefined,
            sumberDana: req.query.sumberDana,
            jenisPengadaan: req.query.jenisPengadaan,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.getById(Number(req.params.id));
        if (!result) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.status(201).json(await matrikService.create(req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.json(await matrikService.update(Number(req.params.id), req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await matrikService.delete(Number(req.params.id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/import', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await matrikService.bulkCreate(req.body.items);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
