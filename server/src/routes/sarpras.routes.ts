import { Router } from 'express';
import { sarprasService } from '../services/sarpras.service.js';
import { db } from '../db/index.js';
import { sarpras, sekolah } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFotos, forwardToNas } from '../middleware/upload.js';
import { logActivity } from '../middleware/logActivity.js';
import { notificationService } from '../services/notification.service.js';
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
    let p = `${kecamatan || 'unknown'}/${namaSekolah}_${npsn}/data sarpras`;
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
            status: req.query.status as string,
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

// Batch create sarpras (without photos)
router.post('/batch', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const { sekolahId, items } = req.body;
        if (!sekolahId || !items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'sekolahId dan items (array) harus diisi' });
            return;
        }
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const finalSekolahId = isSekolah ? req.user!.sekolahId : sekolahId;

        const rows = items.map((item: any, idx: number) => ({
            sekolahId: finalSekolahId,
            masaBangunan: item.masaBangunan || '',
            jenisPrasarana: item.jenisPrasarana || 'Ruang Kelas',
            namaRuang: (item.namaRuang || `Ruang ${idx + 1}`).replace(/\//g, ''),
            lantai: item.lantai || 1,
            panjang: parseFloat(item.panjang) || 0,
            lebar: parseFloat(item.lebar) || 0,
            kondisi: item.kondisi || 'BAIK',
            keterangan: item.keterangan || '',
        }));

        const result = await sarprasService.batchCreate(rows, req.user!.id);
        res.status(201).json({ success: true, count: result.length, data: result });
        logActivity(req, 'Batch Tambah Sarpras', `Menambahkan ${result.length} data sarpras sekaligus`);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Batch create sarpras by NPSN (resolves NPSN→sekolahId server-side)
router.post('/batch-by-npsn', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'items (array) harus diisi' });
            return;
        }

        // Collect unique NPSNs
        const npsnSet = new Set<string>();
        items.forEach((item: any) => { if (item.npsn) npsnSet.add(String(item.npsn).trim()); });

        // Resolve all NPSNs to sekolahIds from DB
        const { sekolah: sekolahTable } = await import('../db/schema/index.js');
        const allSekolah = await db.select({ id: sekolahTable.id, npsn: sekolahTable.npsn, nama: sekolahTable.nama }).from(sekolahTable);
        const npsnMap = new Map<string, number>();
        allSekolah.forEach(s => { if (s.npsn) npsnMap.set(s.npsn.trim(), s.id); });

        const validRows: any[] = [];
        const skippedNpsn = new Set<string>();
        let skippedCount = 0;

        items.forEach((item: any, idx: number) => {
            const npsn = String(item.npsn || '').trim();
            if (!npsn) { skippedCount++; return; }
            const sekolahId = npsnMap.get(npsn);
            if (!sekolahId) { skippedNpsn.add(npsn); skippedCount++; return; }

            validRows.push({
                sekolahId,
                masaBangunan: item.masaBangunan || '',
                jenisPrasarana: item.jenisPrasarana || 'Ruang Kelas',
                namaRuang: (item.namaRuang || `Ruang ${idx + 1}`).replace(/\//g, ''),
                lantai: item.lantai || 1,
                panjang: parseFloat(item.panjang) || 0,
                lebar: parseFloat(item.lebar) || 0,
                kondisi: item.kondisi || 'BAIK',
                keterangan: item.keterangan || '',
            });
        });

        let savedCount = 0;
        if (validRows.length > 0) {
            const result = await sarprasService.batchCreate(validRows, req.user!.id);
            savedCount = result.length;
        }

        res.status(201).json({
            success: true,
            count: savedCount,
            skipped: skippedCount,
            skippedNpsn: [...skippedNpsn],
            totalSekolahInDB: npsnMap.size,
        });
        logActivity(req, 'Batch Tambah Sarpras', `Menambahkan ${savedCount} data sarpras (${skippedCount} dilewati)`);
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

        if (req.body.namaRuang) req.body.namaRuang = req.body.namaRuang.replace(/\//g, '');

        // Set verification status based on jenjang
        if (isSekolah) {
            const sch = await db.select({ jenjang: sekolah.jenjang }).from(sekolah).where(eq(sekolah.id, req.user!.sekolahId!));
            const jenjang = sch[0]?.jenjang || 'SMP';
            req.body.status = jenjang === 'SD' ? 'Menunggu Verifikasi Korwil' : 'Menunggu Verifikasi';
            req.body.actionType = 'tambah';
            req.body.verified = false;
        } else {
            // Admin creates → directly verified
            req.body.status = 'Diverifikasi';
            req.body.verified = true;
        }

        const item = await sarprasService.create(req.body, req.user!.id);
        // Save uploaded fotos
        if (req.files && Array.isArray(req.files)) {
            console.log('[SARPRAS] Saving', req.files.length, 'fotos for item', item.id);
            for (const file of req.files) {
                const f = file as any;
                const filePath = f.finalPath || file.path;
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
        }
        res.status(201).json(item);
        logActivity(req, 'Tambah Sarpras', `Menambahkan data sarpras: ${req.body.namaRuang || 'N/A'}`);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'sekolah', 'verifikator', 'korwil'), async (req, res) => {
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

        if (req.body.namaRuang) req.body.namaRuang = req.body.namaRuang.replace(/\//g, '');
        // Reset verification when sekolah edits data
        if (isSekolah) {
            const sch = await db.select({ jenjang: sekolah.jenjang }).from(sekolah).where(eq(sekolah.id, req.user!.sekolahId!));
            const jenjang = sch[0]?.jenjang || 'SMP';
            req.body.verified = false;
            req.body.verifiedBy = null;
            req.body.verifiedAt = null;
            req.body.status = jenjang === 'SD' ? 'Menunggu Verifikasi Korwil' : 'Menunggu Verifikasi';
            req.body.actionType = 'edit';
            req.body.alasanPenolakan = null;
            // Save snapshot of current data before edit for change tracking
            if (existing) {
                const s = existing.sarpras;
                req.body.previousData = JSON.stringify({
                    masaBangunan: s.masaBangunan,
                    jenisPrasarana: s.jenisPrasarana,
                    namaRuang: s.namaRuang,
                    lantai: s.lantai,
                    panjang: s.panjang,
                    lebar: s.lebar,
                    luas: s.luas,
                    kondisi: s.kondisi,
                    keterangan: s.keterangan,
                });
            }
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

router.delete('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const existing = await sarprasService.getById(id);
        const nama = existing?.sekolahNama || '';
        const ruang = existing?.sarpras?.namaRuang || '';

        if (isSekolah) {
            // Sekolah can only request deletion, not hard delete
            if (!existing || existing.sarpras.sekolahId !== req.user!.sekolahId) {
                res.status(403).json({ error: 'Forbidden' }); return;
            }
            const sch = await db.select({ jenjang: sekolah.jenjang }).from(sekolah).where(eq(sekolah.id, req.user!.sekolahId!));
            const jenjang = sch[0]?.jenjang || 'SMP';
            await db.update(sarpras).set({
                status: jenjang === 'SD' ? 'Menunggu Verifikasi Korwil' : 'Menunggu Verifikasi',
                actionType: 'hapus',
                verified: false,
                verifiedBy: null,
                verifiedAt: null,
                updatedAt: new Date(),
            }).where(eq(sarpras.id, id));
            res.json({ success: true, pending: true });
            logActivity(req, 'Ajukan Hapus Sarpras', `Mengajukan hapus data sarpras ${nama} ${ruang}`.trim());
        } else {
            // Admin: hard delete
            await sarprasService.delete(id);
            res.json({ success: true });
            logActivity(req, 'Hapus Sarpras', `Menghapus data sarpras ${nama} ${ruang}`.trim());
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/batch-verify', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const ids = req.body.ids || [];
        if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return; }
        let count = 0;
        for (const id of ids) {
            try { await sarprasService.verify(Number(id), req.user!.id); count++; } catch { /* skip failed */ }
        }
        res.json({ success: true, verified: count });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const role = req.user!.role.toLowerCase();
        // Look up sekolah jenjang via sarpras
        const sItem = await sarprasService.getById(id);
        let jenjang = 'SMP';
        if (sItem?.sarpras?.sekolahId) {
            const sch = await db.select({ jenjang: sekolah.jenjang }).from(sekolah).where(eq(sekolah.id, sItem.sarpras.sekolahId));
            jenjang = sch[0]?.jenjang || 'SMP';
        }
        // Check if this is a delete request — if verified, actually delete the record
        const currentItem = sItem?.sarpras;
        if (role === 'korwil' && jenjang === 'SD') {
            // Korwil verifies SD → set status to Menunggu Verifikasi so verifikator can finalize
            const r = await db.update(sarpras).set({ verified: false, status: 'Menunggu Verifikasi', verifiedBy: req.user!.id, updatedAt: new Date() }).where(eq(sarpras.id, id)).returning();
            const nm = sItem?.sekolahNama || '';
            const rg = currentItem?.namaRuang || '';
            const jp = currentItem?.jenisPrasarana || '';
            const kd = currentItem?.kondisi || '';
            logActivity(req, 'Verifikasi Korwil Sarpras', `Memverifikasi ${nm} - ${rg} (${jp}, ${kd}) → diteruskan ke verifikator`);
            res.json(r[0]);
        } else {
            // Admin/Verifikator → final verify
            if (currentItem?.actionType === 'hapus') {
                // Delete request approved → actually delete
                const nm2 = sItem?.sekolahNama || '';
                const rg2 = currentItem?.namaRuang || '';
                await sarprasService.delete(id);
                logActivity(req, 'Verifikasi Hapus Sarpras', `Menyetujui penghapusan ${nm2} - ${rg2}`);
                res.json({ success: true, deleted: true });
            } else {
                const result = await sarprasService.verify(id, req.user!.id);
                const nm3 = sItem?.sekolahNama || '';
                const rg3 = currentItem?.namaRuang || '';
                const jp3 = currentItem?.jenisPrasarana || '';
                const kd3 = currentItem?.kondisi || '';
                logActivity(req, 'Verifikasi Sarpras', `Memverifikasi ${nm3} - ${rg3} (${jp3}, ${kd3})`);
                res.json(result);
            }
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const sItem = await sarprasService.getById(id);
        const nm = sItem?.sekolahNama || '';
        const rg = sItem?.sarpras?.namaRuang || '';
        const result = await sarprasService.unverify(id);
        logActivity(req, 'Batalkan Verifikasi Sarpras', `Membatalkan verifikasi ${nm} - ${rg}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/reject', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const { alasan } = req.body;
        if (!alasan?.trim()) { res.status(400).json({ error: 'Alasan wajib diisi' }); return; }
        const id = Number(req.params.id);
        const sItem = await sarprasService.getById(id);
        const nm = sItem?.sekolahNama || '';
        const rg = sItem?.sarpras?.namaRuang || '';
        const result = await sarprasService.reject(id, alasan);
        logActivity(req, 'Tolak Sarpras', `Menolak ${nm} - ${rg}: ${alasan}`);
        // Send notification to all school users linked to this sekolahId
        if (sItem?.sarpras?.sekolahId) {
            const { user: userTable } = await import('../db/schema/index.js');
            const schoolUsers = await db.select({ id: userTable.id }).from(userTable)
                .where(and(eq(userTable.sekolahId, sItem.sarpras.sekolahId), sql`lower(${userTable.role}) = 'sekolah'`));
            for (const su of schoolUsers) {
                notificationService.create({
                    userId: su.id,
                    sekolahId: sItem.sarpras.sekolahId,
                    title: '❌ Data Sarpras Ditolak',
                    message: `Data "${rg}" di ${nm} ditolak. Alasan: ${alasan}`,
                    type: 'error',
                    relatedId: id,
                    relatedType: 'sarpras',
                }).catch(e => console.warn('[Notification] reject:', e.message));
            }
        }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/revisi', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const { alasan } = req.body;
        if (!alasan?.trim()) { res.status(400).json({ error: 'Alasan revisi wajib diisi' }); return; }
        const id = Number(req.params.id);
        const sItem = await sarprasService.getById(id);
        const nm = sItem?.sekolahNama || '';
        const rg = sItem?.sarpras?.namaRuang || '';
        const result = await sarprasService.revisi(id, alasan);
        logActivity(req, 'Revisi Sarpras', `Meminta revisi ${nm} - ${rg}: ${alasan}`);
        // Send notification to all school users linked to this sekolahId
        if (sItem?.sarpras?.sekolahId) {
            const { user: userTable } = await import('../db/schema/index.js');
            const schoolUsers = await db.select({ id: userTable.id }).from(userTable)
                .where(and(eq(userTable.sekolahId, sItem.sarpras.sekolahId), sql`lower(${userTable.role}) = 'sekolah'`));
            for (const su of schoolUsers) {
                notificationService.create({
                    userId: su.id,
                    sekolahId: sItem.sarpras.sekolahId,
                    title: '🔄 Revisi Data Sarpras',
                    message: `Data "${rg}" di ${nm} diminta revisi. Alasan: ${alasan}`,
                    type: 'warning',
                    relatedId: id,
                    relatedType: 'sarpras',
                }).catch(e => console.warn('[Notification] revisi:', e.message));
            }
        }
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
