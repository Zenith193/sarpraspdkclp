import { Router } from 'express';
import { proposalService } from '../services/proposal.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await proposalService.list({
            status: req.query.status as string,
            keranjang: req.query.keranjang as string,
            kecamatan: req.query.kecamatan as string,
            jenjang: req.query.jenjang as string,
            sekolahId: req.query.sekolahId ? Number(req.query.sekolahId) : undefined,
            search: req.query.search as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const result = await proposalService.getById(Number(req.params.id));
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const result = await proposalService.create(req.body, req.user!.id);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const result = await proposalService.update(Number(req.params.id), req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await proposalService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/status', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proposalService.updateStatus(Number(req.params.id), req.body.status, req.user!.id);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/keranjang', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proposalService.updateKeranjang(Number(req.params.id), req.body.keranjang);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/ranking', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proposalService.updateRanking(Number(req.params.id), req.body.ranking, req.body.bintang);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
