import { Router } from 'express';
import { kerusakanService } from '../services/kerusakan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await kerusakanService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 9999,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// CREATE: save data + file to temp, GDrive upload happens in background queue
router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        const data: any = {
            sekolahId: Number(req.body.sekolahId),
            masaBangunan: req.body.masaBangunan || null,
            fileName: req.file?.originalname || null,
            filePath: req.file?.path || null,
            // If GDrive enabled, mark as 'uploading' so background queue picks it up
            uploadStatus: req.file && isGDriveEnabled() ? 'uploading' : 'done',
            status: req.file ? 'Menunggu Verifikasi' : 'Belum Upload',
        };
        if (isSekolah) {
            data.sekolahId = req.user!.sekolahId;
        }
        res.status(201).json(await kerusakanService.create(data, req.user!.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE FILE: save to temp, GDrive upload in background
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }

        if (isSekolah) {
            const existing = await kerusakanService.getById(id);
            if (!existing || existing.formKerusakan.sekolahId !== req.user!.sekolahId) {
                res.status(403).json({ error: 'Forbidden: You can only upload for your own school' });
                return;
            }
        }

        const uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
        res.json(await kerusakanService.updateFile(id, req.file.originalname, req.file.path, uploadStatus));
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
