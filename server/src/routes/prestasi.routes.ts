import { Router } from 'express';
import { prestasiService } from '../services/prestasi.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadSertifikat, forwardToNas } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await prestasiService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadSertifikat.single('sertifikat'), forwardToNas('prestasi'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const f = req.file as any;
        const data: any = {
            ...req.body,
            sekolahId: Number(req.body.sekolahId),
            tahun: req.body.tahun ? Number(req.body.tahun) : null,
            sertifikatPath: f?.finalPath || req.file?.path || null,
            uploadStatus: f?.uploadPending ? 'uploading' : 'done',
        };
        if (isSekolah) {
            data.sekolahId = req.user!.sekolahId;
        }
        res.status(201).json(await prestasiService.create(data, req.user!.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE SERTIFIKAT
router.put('/:id/sertifikat', requireAuth, requireRole('admin', 'sekolah'), uploadSertifikat.single('sertifikat'), forwardToNas('prestasi'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
        const f = req.file as any;
        const updateData: any = {
            sertifikatPath: f?.finalPath || req.file?.path || null,
            uploadStatus: f?.uploadPending ? 'uploading' : 'done',
        };
        res.json(await prestasiService.update(id, updateData));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        if (isSekolah) {
            const existing = await prestasiService.list({ sekolahId: req.user!.sekolahId });
            const item = existing.data.find(d => (d.prestasi as any).id === id);
            if (!item) {
                res.status(403).json({ error: 'Forbidden: You can only update your own achievements' });
                return;
            }
            delete req.body.sekolahId;
        }

        res.json(await prestasiService.update(id, req.body));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
