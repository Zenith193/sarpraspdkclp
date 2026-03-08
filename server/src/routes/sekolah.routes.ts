import { Router } from 'express';
import { sekolahService } from '../services/sekolah.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const result = await sekolahService.list({
            id: isSekolah ? req.user!.sekolahId : undefined,
            search: req.query.search as string,
            kecamatan: req.query.kecamatan as string,
            jenjang: req.query.jenjang as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        if (isSekolah && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden: You can only view your own school' });
            return;
        }

        const result = await sekolahService.getById(id);
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await sekolahService.create(req.body);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await sekolahService.update(Number(req.params.id), req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await sekolahService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
