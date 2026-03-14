import { Router } from 'express';
import { sekolahService } from '../services/sekolah.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadKopSekolah, uploadDenahSekolah, forwardToNas } from '../middleware/upload.js';
import { db } from '../db/index.js';
import { sekolah } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { isGDriveEnabled, streamFromGDrive } from '../utils/googleDriveClient.js';
import { queueGDriveDelete } from '../utils/uploadQueue.js';
import { logActivity } from '../middleware/logActivity.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Middleware: inject sekolah info into req.body before forwardToNas
// This ensures GDrive uploads go to {kecamatan}/{nama}_{npsn}/... folder
const injectSekolahInfo = async (req: any, _res: any, next: any) => {
    try {
        const id = Number(req.params.id);
        if (id) {
            const sch = await db.select({ kecamatan: sekolah.kecamatan, nama: sekolah.nama, npsn: sekolah.npsn }).from(sekolah).where(eq(sekolah.id, id));
            if (sch[0]) {
                req.body = req.body || {};
                req.body.kecamatan = sch[0].kecamatan;
                req.body.namaSekolah = sch[0].nama;
                req.body.npsn = sch[0].npsn;
            }
        }
    } catch (e) { /* ignore lookup errors */ }
    next();
};

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const result = await sekolahService.list({
            id: isSekolah ? req.user!.sekolahId : undefined,
            search: req.query.search as string,
            kecamatan: req.query.kecamatan as string,
            jenjang: req.query.jenjang as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
            onlyWithUsers: req.query.onlyWithUsers === 'true',
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        if (isSekolah && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden: You can only view your own school' });
            return;
        }

        const result = await sekolahService.getById(id);
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await sekolahService.create(req.body);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await sekolahService.update(Number(req.params.id), req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await sekolahService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===================================================================
// UPLOAD KOP SEKOLAH (Word, max 1MB)
// ===================================================================
router.post('/:id/upload-kop', requireAuth, uploadKopSekolah.single('file'), injectSekolahInfo, forwardToNas('kop-sekolah'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolahUser = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolahUser && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden' }); return;
        }

        const file = req.file as Express.Multer.File & { finalPath?: string };
        if (!file) { res.status(400).json({ error: 'File tidak ditemukan' }); return; }

        // Validate file type (Word only)
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.doc', '.docx'].includes(ext)) {
            try { fs.unlinkSync(file.path); } catch {}
            res.status(400).json({ error: 'Format file harus Word (.doc atau .docx)' }); return;
        }

        // Delete old file if exists
        const existing = await db.select({ kopSekolah: sekolah.kopSekolah }).from(sekolah).where(eq(sekolah.id, id));
        if (existing[0]?.kopSekolah) {
            queueGDriveDelete(existing[0].kopSekolah);
        }

        const filePath = file.finalPath || file.path;
        const uploadPending = (file as any).uploadPending === true;
        const uploadStatus = uploadPending ? 'uploading' : 'done';

        await db.update(sekolah).set({
            kopSekolah: filePath,
            kopUploadStatus: uploadStatus,
            updatedAt: new Date()
        }).where(eq(sekolah.id, id));

        logActivity(req, 'Upload Kop Sekolah', `Mengupload kop sekolah`);
        res.json({ success: true, filePath, uploadStatus });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===================================================================
// UPLOAD DENAH SEKOLAH (PDF, max 5MB)
// ===================================================================
router.post('/:id/upload-denah', requireAuth, uploadDenahSekolah.single('file'), injectSekolahInfo, forwardToNas('kop-sekolah'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolahUser = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolahUser && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden' }); return;
        }

        const file = req.file as Express.Multer.File & { finalPath?: string };
        if (!file) { res.status(400).json({ error: 'File tidak ditemukan' }); return; }

        // Validate file type (PDF only)
        if (file.mimetype !== 'application/pdf') {
            try { fs.unlinkSync(file.path); } catch {}
            res.status(400).json({ error: 'Format file harus PDF' }); return;
        }

        // Delete old file if exists
        const existing = await db.select({ denahSekolah: sekolah.denahSekolah }).from(sekolah).where(eq(sekolah.id, id));
        if (existing[0]?.denahSekolah) {
            queueGDriveDelete(existing[0].denahSekolah);
        }

        const filePath = file.finalPath || file.path;
        const uploadPending = (file as any).uploadPending === true;
        const uploadStatus = uploadPending ? 'uploading' : 'done';

        await db.update(sekolah).set({
            denahSekolah: filePath,
            denahUploadStatus: uploadStatus,
            updatedAt: new Date()
        }).where(eq(sekolah.id, id));

        logActivity(req, 'Upload Denah Sekolah', `Mengupload denah sekolah`);
        res.json({ success: true, filePath, uploadStatus });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===================================================================
// DOWNLOAD KOP / DENAH
// ===================================================================
router.get('/:id/download-kop', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = await db.select({ kopSekolah: sekolah.kopSekolah }).from(sekolah).where(eq(sekolah.id, id));
        const filePath = result[0]?.kopSekolah;
        if (!filePath) { res.status(404).json({ error: 'File tidak ditemukan' }); return; }

        if (filePath.startsWith('gdrive://')) {
            const fileId = filePath.replace('gdrive://', '');
            const data = await streamFromGDrive(fileId);
            if (!data) { res.status(404).json({ error: 'File tidak ditemukan di Google Drive' }); return; }
            res.setHeader('Content-Type', data.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`);
            data.stream.pipe(res);
        } else if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: 'File tidak ditemukan' });
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/download-denah', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = await db.select({ denahSekolah: sekolah.denahSekolah }).from(sekolah).where(eq(sekolah.id, id));
        const filePath = result[0]?.denahSekolah;
        if (!filePath) { res.status(404).json({ error: 'File tidak ditemukan' }); return; }

        if (filePath.startsWith('gdrive://')) {
            const fileId = filePath.replace('gdrive://', '');
            const data = await streamFromGDrive(fileId);
            if (!data) { res.status(404).json({ error: 'File tidak ditemukan di Google Drive' }); return; }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${data.fileName}"`);
            data.stream.pipe(res);
        } else if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="denah_sekolah.pdf"`);
            res.sendFile(path.resolve(filePath));
        } else {
            res.status(404).json({ error: 'File tidak ditemukan' });
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===================================================================
// DELETE KOP / DENAH
// ===================================================================
router.delete('/:id/kop', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolahUser = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolahUser && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden' }); return;
        }
        const existing = await db.select({ kopSekolah: sekolah.kopSekolah }).from(sekolah).where(eq(sekolah.id, id));
        if (existing[0]?.kopSekolah) queueGDriveDelete(existing[0].kopSekolah);
        await db.update(sekolah).set({ kopSekolah: null, kopUploadStatus: 'done', updatedAt: new Date() }).where(eq(sekolah.id, id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/denah', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolahUser = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolahUser && req.user!.sekolahId !== id) {
            res.status(403).json({ error: 'Forbidden' }); return;
        }
        const existing = await db.select({ denahSekolah: sekolah.denahSekolah }).from(sekolah).where(eq(sekolah.id, id));
        if (existing[0]?.denahSekolah) queueGDriveDelete(existing[0].denahSekolah);
        await db.update(sekolah).set({ denahSekolah: null, denahUploadStatus: 'done', updatedAt: new Date() }).where(eq(sekolah.id, id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
