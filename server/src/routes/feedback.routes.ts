import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { feedbackService } from '../services/feedback.service.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

// Multer setup for feedback photo (max 500KB)
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = 'uploads/feedback';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `feedback_${Date.now()}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 }, // 500KB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only JPG, PNG, WEBP images are allowed') as any, false);
    },
});

// POST /api/feedback — any authenticated user can submit
router.post('/', requireAuth, upload.single('foto'), async (req: any, res) => {
    try {
        const user = req.user;
        if (!req.body.isiGagasan || !req.body.isiGagasan.trim()) {
            res.status(400).json({ error: 'Isi Gagasan wajib diisi' });
            return;
        }
        const fotoPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        const item = await feedbackService.create({
            userId: user.id,
            namaAkun: user.name || user.namaAkun || '',
            email: user.email || '',
            role: user.role || '',
            isiGagasan: req.body.isiGagasan.trim(),
            fotoPath,
            uploadStatus: fotoPath ? 'uploading' : 'done',
        });
        logActivity(req, 'Kirim Feedback', `Mengirim gagasan/feedback`);
        res.status(201).json(item);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/feedback — admin only: list all
router.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const data = await feedbackService.list();
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/feedback/:id — admin only: update (status, catatan)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const item = await feedbackService.update(Number(req.params.id), req.body);
        if (!item) { res.status(404).json({ error: 'Feedback tidak ditemukan' }); return; }
        logActivity(req, 'Update Feedback', `Mengubah feedback #${req.params.id}`);
        res.json(item);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/feedback/:id — admin only
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const item = await feedbackService.getById(Number(req.params.id));
        if (item?.fotoPath) {
            const { queueGDriveDelete } = await import('../utils/uploadQueue.js');
            queueGDriveDelete(item.fotoPath);
        }
        await feedbackService.delete(Number(req.params.id));
        logActivity(req, 'Hapus Feedback', `Menghapus feedback #${req.params.id}`);
        res.status(204).end();
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
