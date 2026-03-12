import { Router } from 'express';
import { bastService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try {
        res.json(await bastService.list());
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/by-npsn/:npsn', requireAuth, async (req, res) => {
    try {
        res.json(await bastService.getByNpsn(req.params.npsn));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await bastService.getById(Number(req.params.id));
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
        res.status(201).json(await bastService.create(req.body, req.user.id));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.json(await bastService.update(Number(req.params.id), req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await bastService.delete(Number(req.params.id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/revert/:matrikId', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await bastService.revertByMatrikId(Number(req.params.matrikId));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
