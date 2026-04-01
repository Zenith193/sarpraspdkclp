import { Router } from 'express';
import { bastService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadBast, forwardToNas } from '../middleware/upload.js';
import { db } from '../db/index.js';
import { matrikKegiatan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

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
    try {
        const matrikId = Number(req.params.matrikId);
        console.log('[BAST] Revert request for matrikId:', matrikId);
        // First check if record exists
        const existing = await bastService.getByMatrikId(matrikId);
        console.log('[BAST] Existing record:', existing ? `id=${existing.id}` : 'none');
        await bastService.revertByMatrikId(matrikId);
        console.log('[BAST] Revert completed for matrikId:', matrikId);
        res.json({ success: true, deleted: !!existing });
    } catch (e: any) {
        console.error('[BAST] Revert error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ===== Middleware: inject school info into req.body for GDrive folder routing =====
async function injectSekolahInfo(req: any, _res: any, next: any) {
    try {
        const matrikId = Number(req.params.matrikId);
        // Look up matrik to get school info
        const rows = await db.select().from(matrikKegiatan).where(eq(matrikKegiatan.id, matrikId));
        const matrik = rows[0];
        if (matrik) {
            req.body.namaSekolah = matrik.namaSekolah || req.body.namaSekolah || '';
            req.body.npsn = matrik.npsn || req.body.npsn || '';
            // Look up kecamatan from sekolah table
            if (matrik.npsn) {
                const { sekolah } = await import('../db/schema/index.js');
                const sekolahRows = await db.select({ kecamatan: sekolah.kecamatan }).from(sekolah).where(eq(sekolah.npsn, matrik.npsn));
                req.body.kecamatan = sekolahRows[0]?.kecamatan || '';
            }
        }
    } catch (e) {
        console.warn('[BAST] injectSekolahInfo:', (e as any).message);
    }
    next();
}

// ===== Upload BAST Fisik PDF (by matrikId) → GDrive school folder =====
router.post('/by-matrik/:matrikId/upload-fisik', requireAuth, requireRole('admin'),
    uploadBast.single('file'), injectSekolahInfo, forwardToNas('bast'),
    async (req, res) => {
        try {
            const matrikId = Number(req.params.matrikId);
            const userId = (req as any).user?.id;
            let existing = await bastService.getByMatrikId(matrikId);

            // Auto-create bast record if not exists (legacy data migration)
            if (!existing) {
                existing = await bastService.create({ matrikId } as any, userId);
            }

            const file = req.file as any;
            const finalPath = file?.finalPath || file?.path || '';

            const result = await bastService.updateByMatrikId(matrikId, { bastFisikPath: finalPath });
            res.json({ success: true, bastFisikPath: finalPath, data: result });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    }
);

// ===== Preview BAST Fisik PDF (inline in browser) =====
router.get('/by-matrik/:matrikId/preview-fisik', requireAuth, async (req, res) => {
    try {
        const existing = await bastService.getByMatrikId(Number(req.params.matrikId));
        if (!existing?.bastFisikPath) return res.status(404).json({ error: 'File BAST Fisik belum diupload' });
        if (!fs.existsSync(existing.bastFisikPath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="BAST_Fisik_${existing.npsn || ''}.pdf"`);
        fs.createReadStream(existing.bastFisikPath).pipe(res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== Download BAST Fisik PDF =====
router.get('/by-matrik/:matrikId/download-fisik', requireAuth, async (req, res) => {
    try {
        const existing = await bastService.getByMatrikId(Number(req.params.matrikId));
        if (!existing?.bastFisikPath) return res.status(404).json({ error: 'File tidak ditemukan' });
        if (!fs.existsSync(existing.bastFisikPath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });
        res.download(existing.bastFisikPath);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
