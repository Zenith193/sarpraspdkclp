import { Router } from 'express';
import { kerusakanService } from '../services/kerusakan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan } from '../middleware/upload.js';
import { isGDriveEnabled, uploadFileToGDrive } from '../utils/googleDriveClient.js';
import fs from 'fs';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await kerusakanService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        let filePath = req.file?.path || null;
        let uploadStatus = 'done';

        // Direct GDrive upload
        if (req.file && isGDriveEnabled()) {
            try {
                const gDrivePath = `form-kerusakan/${req.body.namaSekolah || 'unknown'}_${req.body.npsn || ''}`;
                const gdriveResult = await uploadFileToGDrive(req.file.path, gDrivePath, req.file.originalname);
                if (gdriveResult?.id) {
                    filePath = `gdrive://${gdriveResult.id}`;
                    uploadStatus = 'done';
                    // Clean up temp file
                    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
                }
            } catch (e) {
                console.error('GDrive upload error:', e);
                // Fallback to local
                filePath = req.file.path;
                uploadStatus = 'done';
            }
        }

        const data = {
            ...req.body,
            fileName: req.file?.originalname || null,
            filePath,
            uploadStatus,
            status: req.file ? 'Menunggu Verifikasi' : 'Belum Upload',
        };
        if (isSekolah) {
            data.sekolahId = req.user!.sekolahId;
        }
        res.status(201).json(await kerusakanService.create(data, req.user!.id));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

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

        let filePath = req.file.path;
        let uploadStatus = 'done';

        // Direct GDrive upload
        if (isGDriveEnabled()) {
            try {
                const gDrivePath = `form-kerusakan/${req.body.namaSekolah || 'upload'}_${Date.now()}`;
                const gdriveResult = await uploadFileToGDrive(req.file.path, gDrivePath, req.file.originalname);
                if (gdriveResult?.id) {
                    filePath = `gdrive://${gdriveResult.id}`;
                    uploadStatus = 'done';
                    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
                }
            } catch (e) {
                console.error('GDrive upload error:', e);
                filePath = req.file.path;
            }
        }

        res.json(await kerusakanService.updateFile(id, req.file.originalname, filePath, uploadStatus));
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
