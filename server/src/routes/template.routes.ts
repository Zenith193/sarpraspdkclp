import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate, forwardToNas } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Binary file magic bytes
const BINARY_SIGS: Record<string, number[]> = {
    'PDF': [0x25, 0x50, 0x44, 0x46],           // %PDF
    'DOCX/ZIP': [0x50, 0x4B, 0x03, 0x04],       // PK..
    'DOC': [0xD0, 0xCF, 0x11, 0xE0],            // OLE2
    'PNG': [0x89, 0x50, 0x4E, 0x47],             // .PNG
    'JPEG': [0xFF, 0xD8, 0xFF],                  // JPEG
};

function isBinaryFile(filePath: string): string | null {
    try {
        const buf = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        for (const [name, sig] of Object.entries(BINARY_SIGS)) {
            if (sig.every((b, i) => buf[i] === b)) return name;
        }
        return null;
    } catch { return null; }
}

/** Auto-read HTML file content for storage in DB */
function readHtmlContent(filePath: string): string | null {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
        try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
    }
    return null;
}

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

        // 1. If content is stored in DB, use that
        if (tpl.content) {
            return res.json({ content: tpl.content });
        }

        // 2. Try reading the uploaded file
        if (tpl.filePath) {
            if (!fs.existsSync(tpl.filePath)) {
                return res.status(404).json({ error: `File tidak ditemukan di server: ${tpl.filePath}` });
            }

            // Check if it's a binary file (PDF, DOCX, etc.)
            const binaryType = isBinaryFile(tpl.filePath);
            if (binaryType) {
                const ext = path.extname(tpl.filePath).toLowerCase();
                return res.status(400).json({
                    error: `File template adalah ${binaryType} (${ext}). Tidak bisa digunakan langsung. Silakan simpan template sebagai file .html dari Google Docs (File → Download → Halaman Web / .html) lalu upload ulang.`
                });
            }

            // Read as text (HTML/HTM/TXT)
            try {
                const fileContent = fs.readFileSync(tpl.filePath, 'utf-8');
                // Auto-save to DB for faster future access
                await templateService.update(tpl.id, { content: fileContent });
                return res.json({ content: fileContent });
            } catch (readErr: any) {
                return res.status(500).json({ error: `Gagal membaca file: ${readErr.message}` });
            }
        }

        return res.status(404).json({
            error: 'Template belum memiliki konten. Silakan upload file .html (bukan PDF/DOCX) di Manajemen Template.'
        });
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
            const fp = f?.finalPath || req.file.path;
            data.filePath = fp;
            data.uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
            // Auto-read HTML content into DB
            const html = readHtmlContent(fp);
            if (html) data.content = html;
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
            const fp = f?.finalPath || req.file.path;
            data.filePath = fp;
            data.uploadStatus = isGDriveEnabled() ? 'uploading' : 'done';
            // Auto-read HTML content into DB
            const html = readHtmlContent(fp);
            if (html) data.content = html;
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
