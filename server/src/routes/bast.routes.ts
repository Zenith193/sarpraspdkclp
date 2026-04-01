import { Router } from 'express';
import { bastService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadBast, forwardToNas } from '../middleware/upload.js';
import fs from 'fs';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await bastService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/by-npsn/:npsn', requireAuth, async (req, res) => {
    try { res.json(await bastService.getByNpsn(req.params.npsn as string)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await bastService.getById(Number(req.params.id));
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.status(201).json(await bastService.create(req.body, req.user!.id)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await bastService.update(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await bastService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/revert/:matrikId', requireAuth, requireRole('admin'), async (req, res) => {
    try { await bastService.revertByMatrikId(Number(req.params.matrikId)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== Upload BAST Fisik PDF (by matrikId) =====
router.post('/by-matrik/:matrikId/upload-fisik', requireAuth, requireRole('admin'), uploadBast.single('file'), forwardToNas('bast'), async (req, res) => {
    try {
        const matrikId = Number(req.params.matrikId);
        const existing = await bastService.getByMatrikId(matrikId);
        if (!existing) return res.status(404).json({ error: 'BAST untuk matrik ini tidak ditemukan' });

        const file = req.file as any;
        const finalPath = file?.finalPath || file?.path || '';

        const result = await bastService.updateByMatrikId(matrikId, { bastFisikPath: finalPath });
        res.json({ success: true, bastFisikPath: finalPath, data: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== Download BAST Fisik PDF (by matrikId) =====
router.get('/by-matrik/:matrikId/download-fisik', requireAuth, async (req, res) => {
    try {
        const existing = await bastService.getByMatrikId(Number(req.params.matrikId));
        if (!existing?.bastFisikPath) return res.status(404).json({ error: 'File tidak ditemukan' });
        if (!fs.existsSync(existing.bastFisikPath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });
        res.download(existing.bastFisikPath);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
