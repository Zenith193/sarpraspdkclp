import { Router } from 'express';
import { riwayatBantuanService } from '../services/riwayatBantuan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await riwayatBantuanService.list({
            sekolahId: req.query.sekolahId ? Number(req.query.sekolahId) : undefined,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', requireAuth, async (req, res) => {
    try { const r = await riwayatBantuanService.getById(Number(req.params.id)); if (!r) { res.status(404).json({ error: 'Not found' }); return; } res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, requireRole('admin'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const data: any = {
            sekolahId: Number(req.body.sekolahId),
            namaPaket: req.body.namaPaket,
            nilaiPaket: req.body.nilaiPaket ? Number(req.body.nilaiPaket) : null,
            volumePaket: req.body.volumePaket || null,
            bastId: req.body.bastId ? Number(req.body.bastId) : null,
            tahun: req.body.tahun ? Number(req.body.tahun) : null,
            fileName: req.file?.originalname || null,
            filePath: req.file?.path || null,
            uploadStatus: req.file && isGDriveEnabled() ? 'uploading' : 'done',
        };
        const result = await riwayatBantuanService.create(data);
        logActivity(req, 'Tambah Riwayat Bantuan', `Menambahkan riwayat bantuan: ${req.body.namaPaket || 'N/A'}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { const r = await riwayatBantuanService.update(Number(req.params.id), req.body); logActivity(req, 'Edit Riwayat Bantuan', `Mengubah riwayat bantuan #${req.params.id}`); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Upload/replace file for existing riwayat bantuan
router.put('/:id/upload', requireAuth, requireRole('admin'), uploadFormKerusakan.single('file'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
        const uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
        const result = await riwayatBantuanService.update(id, {
            fileName: req.file.originalname,
            filePath: req.file.path,
            uploadStatus,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await riwayatBantuanService.delete(Number(req.params.id)); logActivity(req, 'Hapus Riwayat Bantuan', `Menghapus riwayat bantuan #${req.params.id}`); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
