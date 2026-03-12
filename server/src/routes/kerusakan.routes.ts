import { Router } from 'express';
import { kerusakanService } from '../services/kerusakan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan } from '../middleware/upload.js';
import { isGDriveEnabled, uploadFileToGDrive } from '../utils/googleDriveClient.js';

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

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        let filePath = req.file?.path || null;
        let uploadStatus = 'done';

        // Direct GDrive upload
        if (req.file && isGDriveEnabled()) {
            try {
                const namaSekolah = req.body.namaSekolah || 'unknown';
                const npsn = req.body.npsn || '';
                const kecamatan = req.body.kecamatan || 'unknown';
                const subPath = `${kecamatan}/${namaSekolah}_${npsn}/kerusakan`;
                const result = await uploadFileToGDrive(req.file.path, 'kerusakan', subPath);
                filePath = result.path; // 'gdrive://id' or local path
                uploadStatus = 'done';
            } catch (e) {
                console.error('[Kerusakan] GDrive upload error:', e);
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
                // Try to get sekolah info for folder path
                const existing = await kerusakanService.getById(id);
                let subPath = `kerusakan/${id}`;
                if (existing) {
                    subPath = `${existing.sekolahKecamatan || 'unknown'}/${existing.sekolahNama || 'unknown'}_${existing.sekolahNpsn || ''}/kerusakan`;
                }
                const result = await uploadFileToGDrive(req.file.path, 'kerusakan', subPath);
                filePath = result.path; // 'gdrive://id' or local path
                uploadStatus = 'done';
            } catch (e) {
                console.error('[Kerusakan] GDrive upload error:', e);
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
