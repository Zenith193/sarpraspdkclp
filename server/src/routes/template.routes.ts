import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate, forwardToNas } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await templateService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Download template file
router.get('/download/:id', requireAuth, async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl || !tpl.filePath) return res.status(404).json({ error: 'File not found' });

        if (fs.existsSync(tpl.filePath)) {
            res.download(tpl.filePath, tpl.nama || 'template');
        } else {
            res.status(404).json({ error: 'File not found on disk' });
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get template content for SPL generation
router.get('/content/:id', requireAuth, async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl) return res.status(404).json({ error: 'Template not found' });

        // If content is stored in DB, use that
        if (tpl.content) {
            return res.json({ content: tpl.content });
        }

        // Try reading the uploaded file
        if (tpl.filePath) {
            console.log(`[Template] Reading file: ${tpl.filePath}`);
            if (fs.existsSync(tpl.filePath)) {
                try {
                    const fileContent = fs.readFileSync(tpl.filePath, 'utf-8');
                    return res.json({ content: fileContent });
                } catch (readErr: any) {
                    return res.status(500).json({ error: `Gagal membaca file: ${readErr.message}` });
                }
            } else {
                return res.status(404).json({ error: `File tidak ditemukan di server: ${tpl.filePath}` });
            }
        }

        return res.status(404).json({ error: 'Template belum memiliki konten atau file. Silakan upload file HTML di Manajemen Template.' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin'), uploadTemplate.single('file'), forwardToNas('template'), async (req, res) => {
    try {
        const f = req.file as any;
        const data: any = {
            nama: req.body.name || req.body.nama,
            jenisCocok: req.body.type || req.body.jenisCocok,
        };
        if (req.body.content) data.content = req.body.content;
        if (req.file) {
            data.filePath = f?.finalPath || req.file.path;
            data.uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
        }
        res.status(201).json(await templateService.create(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin'), uploadTemplate.single('file'), forwardToNas('template'), async (req, res) => {
    try {
        const f = req.file as any;
        const data: any = {};
        if (req.body.name || req.body.nama) data.nama = req.body.name || req.body.nama;
        if (req.body.type || req.body.jenisCocok) data.jenisCocok = req.body.type || req.body.jenisCocok;
        if (req.body.content !== undefined) data.content = req.body.content;
        if (req.file) {
            data.filePath = f?.finalPath || req.file.path;
            data.uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
        }
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// JSON-only update for content (no file upload needed)
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const data: any = {};
        if (req.body.nama) data.nama = req.body.nama;
        if (req.body.jenisCocok) data.jenisCocok = req.body.jenisCocok;
        if (req.body.content !== undefined) data.content = req.body.content;
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await templateService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
