import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate } from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Convert DOCX file to HTML using mammoth
 */
async function docxToHtml(filePath: string): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.convertToHtml({ path: filePath });
    if (result.messages?.length) {
        console.log('[Template] mammoth warnings:', result.messages.map(m => m.message).join('; '));
    }
    return result.value; // HTML string
}

// List all templates
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

// Get template content (HTML) for SPL generation
router.get('/content/:id', requireAuth, async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl) return res.status(404).json({ error: 'Template not found' });

        // 1. If HTML content stored in DB, use that
        if (tpl.content) {
            return res.json({ content: tpl.content });
        }

        // 2. Try converting DOCX file to HTML
        if (tpl.filePath && fs.existsSync(tpl.filePath)) {
            try {
                const html = await docxToHtml(tpl.filePath);
                // Auto-save to DB for future use
                await templateService.update(tpl.id, { content: html });
                return res.json({ content: html });
            } catch (convErr: any) {
                return res.status(500).json({ error: `Gagal konversi DOCX ke HTML: ${convErr.message}` });
            }
        }

        return res.status(404).json({
            error: 'Template belum memiliki file. Silakan upload file DOCX di Manajemen Template.'
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create template (upload DOCX, auto-convert to HTML)
router.post('/', requireAuth, requireRole('admin'), uploadTemplate.single('file'), async (req, res) => {
    try {
        const data: any = {
            nama: req.body.name || req.body.nama,
            jenisCocok: req.body.type || req.body.jenisCocok,
        };
        if (req.file) {
            data.filePath = req.file.path;
            data.uploadStatus = 'done';
            // Auto-convert DOCX to HTML
            try {
                data.content = await docxToHtml(req.file.path);
            } catch (convErr: any) {
                console.error('[Template] DOCX conversion error:', convErr.message);
            }
        }
        if (req.body.content) data.content = req.body.content;
        res.status(201).json(await templateService.create(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update template (upload new DOCX, auto-convert to HTML)
router.put('/:id', requireAuth, requireRole('admin'), uploadTemplate.single('file'), async (req, res) => {
    try {
        const data: any = {};
        if (req.body.name || req.body.nama) data.nama = req.body.name || req.body.nama;
        if (req.body.type || req.body.jenisCocok) data.jenisCocok = req.body.type || req.body.jenisCocok;
        if (req.body.content !== undefined) data.content = req.body.content;
        if (req.file) {
            // Delete old file
            const existing = await templateService.getById(Number(req.params.id));
            if (existing?.filePath && fs.existsSync(existing.filePath)) {
                try { fs.unlinkSync(existing.filePath); } catch {}
            }
            data.filePath = req.file.path;
            data.uploadStatus = 'done';
            // Auto-convert DOCX to HTML
            try {
                data.content = await docxToHtml(req.file.path);
            } catch (convErr: any) {
                console.error('[Template] DOCX conversion error:', convErr.message);
            }
        }
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// JSON-only update for content (no file upload)
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const data: any = {};
        if (req.body.nama) data.nama = req.body.nama;
        if (req.body.jenisCocok) data.jenisCocok = req.body.jenisCocok;
        if (req.body.content !== undefined) data.content = req.body.content;
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Re-convert existing template DOCX to HTML (refresh content)
router.post('/:id/reconvert', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl) return res.status(404).json({ error: 'Template not found' });
        if (!tpl.filePath || !fs.existsSync(tpl.filePath)) {
            return res.status(404).json({ error: 'File DOCX tidak ditemukan di server' });
        }
        const html = await docxToHtml(tpl.filePath);
        const updated = await templateService.update(tpl.id, { content: html });
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (tpl?.filePath && fs.existsSync(tpl.filePath)) {
            try { fs.unlinkSync(tpl.filePath); } catch {}
        }
        await templateService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
