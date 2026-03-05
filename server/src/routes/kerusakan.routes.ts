import { Router } from 'express';
import { kerusakanService } from '../services/kerusakan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await kerusakanService.list({
            sekolahId: req.query.sekolahId ? Number(req.query.sekolahId) : undefined,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const data = { ...req.body, fileName: req.file?.originalname || null, filePath: req.file?.path || null, status: req.file ? 'Menunggu Verifikasi' : 'Belum Upload' };
        res.status(201).json(await kerusakanService.create(data, req.user!.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
        res.json(await kerusakanService.updateFile(Number(req.params.id), req.file.originalname, req.file.path));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await kerusakanService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await kerusakanService.verify(Number(req.params.id), req.user!.id)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/reject', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await kerusakanService.reject(Number(req.params.id), req.user!.id, req.body.alasan)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await kerusakanService.unverify(Number(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/missing', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await kerusakanService.getMissingSchools()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
