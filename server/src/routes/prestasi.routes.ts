import { Router } from 'express';
import { prestasiService } from '../services/prestasi.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadSertifikat } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await prestasiService.list({
            sekolahId: req.query.sekolahId ? Number(req.query.sekolahId) : undefined,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadSertifikat.single('sertifikat'), async (req, res) => {
    try {
        const data = { ...req.body, sertifikatPath: req.file?.path || null };
        res.status(201).json(await prestasiService.create(data, req.user!.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try { res.json(await prestasiService.update(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await prestasiService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await prestasiService.verify(Number(req.params.id), req.user!.id)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/reject', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await prestasiService.reject(Number(req.params.id), req.user!.id, req.body.alasan)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await prestasiService.unverify(Number(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/rekap', requireAuth, requireRole('admin', 'korwil'), async (_req, res) => {
    try { res.json(await prestasiService.getRekap()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== POINT RULES =====
router.get('/point-rules', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await prestasiService.listPointRules()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/point-rules', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.status(201).json(await prestasiService.createPointRule(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/point-rules/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await prestasiService.updatePointRule(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/point-rules/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await prestasiService.deletePointRule(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
