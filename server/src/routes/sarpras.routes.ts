import { Router } from 'express';
import { sarprasService } from '../services/sarpras.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFotos, forwardToNas } from '../middleware/upload.js';
import { logActivity } from '../middleware/logActivity.js';
import { isGDriveEnabled, findGDriveFolderByPath, renameGDriveFolder, moveGDriveFolder, ensureGDrivePath } from '../utils/googleDriveClient.js';
import fs from 'fs';
import path from 'path';

// Sanitize folder name (same logic as storagePaths.ts)
function sanitize(name: string): string {
    return (name || 'unknown').trim().replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 100);
}

const uploadRoot = process.env.UPLOAD_DIR || './uploads';

/**
 * Build GDrive path exactly like uploadQueue.ts does:
 *   {kecamatan}/{nama}_{npsn}/sarpras[/{masaBangunan}][/{namaRuang}]
 * masaBangunan and namaRuang are only appended if truthy.
 */
function buildGDriveSarprasPath(kecamatan: string, namaSekolah: string, npsn: string, masaBangunan?: string | null, namaRuang?: string | null): string {
    let p = `${kecamatan || 'unknown'}/${namaSekolah}_${npsn}/sarpras`;
    if (masaBangunan) p += `/${masaBangunan}`;
    if (namaRuang) p += `/${namaRuang}`;
    return p;
}

/**
 * Sync folder in GDrive + Local when masaBangunan or namaRuang changes.
 */
async function syncSarprasFolder(
    existing: any,
    oldMasa: string | null, oldRuang: string,
    newMasa: string | null, newRuang: string,
    masaChanged: boolean, ruangChanged: boolean,
) {
    const kec = existing.sekolahKecamatan;
    const schNama = existing.sekolahNama;
    const npsn = existing.sekolahNpsn;

    // ===== GOOGLE DRIVE =====
    if (isGDriveEnabled()) {
        try {
            // Build old path exactly like uploadQueue.ts
            const oldPath = buildGDriveSarprasPath(kec, schNama, npsn, oldMasa, oldRuang);
            console.log(`[SarprasSync][GDrive] Old path: ${oldPath}`);

            // Find the namaRuang folder (the deepest folder)
            const ruangFolderId = await findGDriveFolderByPath(oldPath);

            if (!ruangFolderId) {
                console.log(`[SarprasSync][GDrive] ⚠ Folder not found at: ${oldPath}`);
                return;
            }

            console.log(`[SarprasSync][GDrive] Found folder: ${ruangFolderId}`);

            if (masaChanged) {
                // masaBangunan changed → need to move the namaRuang folder to new parent
                const oldParentPath = buildGDriveSarprasPath(kec, schNama, npsn, oldMasa);
                const newParentPath = buildGDriveSarprasPath(kec, schNama, npsn, newMasa);

                const oldParentId = await findGDriveFolderByPath(oldParentPath);
                const newParentId = await ensureGDrivePath(newParentPath);

                console.log(`[SarprasSync][GDrive] Moving from ${oldParentPath} → ${newParentPath}`);
                await moveGDriveFolder(ruangFolderId, newParentId, oldParentId || undefined);
                console.log(`[SarprasSync][GDrive] ✅ Moved folder`);
            }

            if (ruangChanged) {
                // namaRuang changed → rename the folder
                console.log(`[SarprasSync][GDrive] Renaming: ${oldRuang} → ${newRuang}`);
                await renameGDriveFolder(ruangFolderId, newRuang);
                console.log(`[SarprasSync][GDrive] ✅ Renamed folder`);
            }

            const newPath = buildGDriveSarprasPath(kec, schNama, npsn, newMasa, newRuang);
            console.log(`[SarprasSync][GDrive] ✅ Complete: ${oldPath} → ${newPath}`);
        } catch (err: any) {
            console.error('[SarprasSync][GDrive] Error:', err.message);
        }
    }

    // ===== LOCAL FILESYSTEM =====
    try {
        const kecSafe = sanitize(kec);
        const schSafe = `${sanitize(schNama)}_${npsn}`;
        const sarprasBase = path.join(uploadRoot, kecSafe, schSafe, 'sarpras');

        // Build old local path
        let oldLocalPath = sarprasBase;
        if (oldMasa) oldLocalPath = path.join(oldLocalPath, sanitize(oldMasa));
        oldLocalPath = path.join(oldLocalPath, sanitize(oldRuang));

        if (fs.existsSync(oldLocalPath)) {
            // Build new local path
            let newLocalDir = sarprasBase;
            if (newMasa) {
                newLocalDir = path.join(newLocalDir, sanitize(newMasa));
                if (!fs.existsSync(newLocalDir)) fs.mkdirSync(newLocalDir, { recursive: true });
            }
            const newLocalPath = path.join(newLocalDir, sanitize(newRuang));
            fs.renameSync(oldLocalPath, newLocalPath);
            console.log(`[SarprasSync][Local] ✅ ${oldLocalPath} → ${newLocalPath}`);
        }
    } catch (err: any) {
        console.error('[SarprasSync][Local] Error:', err.message);
    }
}

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await sarprasService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            kecamatan: req.query.kecamatan as string,
            jenjang: req.query.jenjang as string,
            kondisi: req.query.kondisi as string,
            verified: req.query.verified as string,
            search: req.query.search as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', requireAuth, async (_req, res) => {
    try {
        const stats = await sarprasService.getStats();
        res.json(stats);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const result = await sarprasService.getById(Number(req.params.id));
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFotos.array('fotos', 5), forwardToNas('sarpras'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolah) {
            req.body.sekolahId = req.user!.sekolahId;
        }

        const item = await sarprasService.create(req.body, req.user!.id);
        // Save uploaded fotos
        if (req.files && Array.isArray(req.files)) {
            console.log('[SARPRAS] Saving', req.files.length, 'fotos for item', item.id);
            for (const file of req.files) {
                const f = file as any;
                const filePath = f.finalPath || file.path;
                console.log('[SARPRAS] Foto:', file.originalname, 'finalPath:', f.finalPath, 'file.path:', file.path, 'saving:', filePath);
                await sarprasService.addFoto(item.id, {
                    sarprasId: item.id,
                    fileName: file.originalname,
                    filePath: filePath,
                    fileSize: file.size,
                    geoLat: req.body[`geo_lat_${file.originalname}`] ? parseFloat(req.body[`geo_lat_${file.originalname}`]) : null,
                    geoLng: req.body[`geo_lng_${file.originalname}`] ? parseFloat(req.body[`geo_lng_${file.originalname}`]) : null,
                    uploadStatus: f.uploadPending ? 'uploading' : 'done',
                });
            }
        } else {
            console.log('[SARPRAS] No files in req.files');
        }
        res.status(201).json(item);
        logActivity(req, 'Tambah Sarpras', `Menambahkan data sarpras: ${req.body.namaRuang || 'N/A'}`);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'sekolah', 'verifikator'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const existing = await sarprasService.getById(id);

        if (isSekolah) {
            if (!existing || existing.sarpras.sekolahId !== req.user!.sekolahId) {
                res.status(403).json({ error: 'Forbidden: You can only update your own school\'s sarpras' });
                return;
            }
            // Ensure they don't try to change sekolahId
            delete req.body.sekolahId;
        }

        const result = await sarprasService.update(id, req.body);
        res.json(result);

        const nama = existing?.sekolahNama || '';
        const ruang = existing?.sarpras?.namaRuang || req.body.namaRuang || '';
        logActivity(req, 'Edit Sarpras', `Mengubah data sarpras ${nama} ${ruang}`.trim());

        // ===== SYNC FOLDER (GDrive + Local) =====
        // Fire-and-forget: don't block the API response
        if (existing && existing.sekolahNama && existing.sekolahNpsn && existing.sekolahKecamatan) {
            const oldMasa = existing.sarpras.masaBangunan || null;
            const oldRuang = existing.sarpras.namaRuang;
            const newMasa = req.body.masaBangunan || null;
            const newRuang = req.body.namaRuang || oldRuang;
            const masaChanged = (newMasa || '') !== (oldMasa || '');
            const ruangChanged = newRuang !== oldRuang;

            console.log(`[SarprasSync] Check: oldMasa=${oldMasa}, newMasa=${newMasa}, masaChanged=${masaChanged}, oldRuang=${oldRuang}, newRuang=${newRuang}, ruangChanged=${ruangChanged}`);

            if (masaChanged || ruangChanged) {
                syncSarprasFolder(existing, oldMasa, oldRuang, newMasa, newRuang, masaChanged, ruangChanged).catch(err =>
                    console.error('[SarprasSync] Error:', err.message)
                );
            }
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await sarprasService.getById(id);
        const nama = existing?.sekolahNama || '';
        const ruang = existing?.sarpras?.namaRuang || '';
        await sarprasService.delete(id);
        res.json({ success: true });
        logActivity(req, 'Hapus Sarpras', `Menghapus data sarpras ${nama} ${ruang}`.trim());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await sarprasService.verify(Number(req.params.id), req.user!.id);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await sarprasService.unverify(Number(req.params.id));
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/foto', requireAuth, requireRole('admin', 'sekolah'), uploadFotos.single('foto'), forwardToNas('sarpras'), async (req, res) => {
    try {
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

        // Enforce max 5 photos per sarpras
        const existing = await sarprasService.getById(Number(req.params.id));
        if (existing && existing.fotos && existing.fotos.length >= 5) {
            res.status(400).json({ error: 'Maksimal 5 foto per data sarpras' });
            return;
        }

        const f = req.file as any;
        const result = await sarprasService.addFoto(Number(req.params.id), {
            sarprasId: Number(req.params.id),
            fileName: req.file.originalname,
            filePath: f.finalPath || req.file.path,
            fileSize: req.file.size,
            geoLat: req.body.geoLat ? parseFloat(req.body.geoLat) : null,
            geoLng: req.body.geoLng ? parseFloat(req.body.geoLng) : null,
            uploadStatus: f.uploadPending ? 'uploading' : 'done',
        });
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/foto/:fotoId', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        await sarprasService.removeFoto(Number(req.params.fotoId));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== DEBUG ENDPOINT: Test GDrive folder detection =====
router.get('/:id/debug-gdrive', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await sarprasService.getById(id);
        if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

        const kec = existing.sekolahKecamatan;
        const schNama = existing.sekolahNama;
        const npsn = existing.sekolahNpsn;
        const masa = existing.sarpras.masaBangunan;
        const ruang = existing.sarpras.namaRuang;

        const gdriveEnabled = isGDriveEnabled();
        const fullPath = buildGDriveSarprasPath(kec || '', schNama || '', npsn || '', masa, ruang);
        const parts = fullPath.split('/').filter(Boolean);

        const results: any[] = [];
        if (gdriveEnabled) {
            // Test each segment
            let testPath = '';
            for (const part of parts) {
                testPath = testPath ? `${testPath}/${part}` : part;
                const folderId = await findGDriveFolderByPath(testPath);
                results.push({ path: testPath, found: !!folderId, folderId: folderId || null });
            }
        }

        res.json({
            sarprasId: id,
            sekolahNama: schNama,
            sekolahKecamatan: kec,
            sekolahNpsn: npsn,
            masaBangunan: masa,
            namaRuang: ruang,
            gdriveEnabled,
            gdriveFullPath: fullPath,
            folderSegments: results,
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
