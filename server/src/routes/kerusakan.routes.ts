import { Router } from 'express';
import { kerusakanService } from '../services/kerusakan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFormKerusakan, forwardToNas } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import { db } from '../db/index.js';
import { korwilAssignment, formKerusakan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

// Inject sekolah info for GDrive folder path
const injectSekolahInfoFromBody = async (req: any, _res: any, next: any) => {
    try {
        const { sekolah: sekolahTable } = await import('../db/schema/index.js');
        const sid = req.body?.sekolahId || req.user?.sekolahId;
        if (sid) {
            const sch = await db.select({ kecamatan: sekolahTable.kecamatan, nama: sekolahTable.nama, npsn: sekolahTable.npsn }).from(sekolahTable).where(eq(sekolahTable.id, Number(sid)));
            if (sch[0]) {
                req.body.kecamatan = sch[0].kecamatan;
                req.body.namaSekolah = sch[0].nama;
                req.body.npsn = sch[0].npsn;
            }
        }
    } catch (e) { /* ignore */ }
    next();
};

router.get('/', requireAuth, async (req, res) => {
    try {
        const role = req.user!.role.toLowerCase();
        const isSekolah = role === 'sekolah';
        const isKorwil = role === 'korwil';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        let sekolahIds: number[] | undefined;
        if (isSekolah) {
            sekolahIds = req.user!.sekolahId ? [req.user!.sekolahId] : [];
        } else if (isKorwil) {
            // Get korwil's assigned kecamatan + jenjang
            const assignments = await db.select().from(korwilAssignment).where(eq(korwilAssignment.userId, req.user!.id));
            if (assignments.length > 0) {
                const kecList = assignments.map(a => a.kecamatan).filter(Boolean);
                const jenj = assignments[0].jenjang;
                // Find sekolah IDs matching these kecamatan + jenjang
                const { sekolah: sekolahTable } = await import('../db/schema/index.js');
                const { and: drizzleAnd, inArray } = await import('drizzle-orm');
                let conditions: any[] = [];
                if (kecList.length > 0) conditions.push(inArray(sekolahTable.kecamatan, kecList as string[]));
                if (jenj) conditions.push(eq(sekolahTable.jenjang, jenj));
                const schools = await db.select({ id: sekolahTable.id }).from(sekolahTable).where(conditions.length > 0 ? drizzleAnd(...conditions) : undefined);
                sekolahIds = schools.map(s => s.id);
            } else {
                sekolahIds = [];
            }
        }

        const result = await kerusakanService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            sekolahIds,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 9999,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// CREATE: save data + file to temp, GDrive upload happens in background queue
router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), injectSekolahInfoFromBody, forwardToNas('kerusakan'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const sekolahId = isSekolah ? req.user!.sekolahId! : Number(req.body.sekolahId);
        const masaBangunan = req.body.masaBangunan || null;

        // Check duplicate: 1 form per masa bangunan per school
        if (masaBangunan) {
            const isDup = await kerusakanService.checkDuplicate(sekolahId, masaBangunan);
            if (isDup) { res.status(400).json({ error: `Masa bangunan "${masaBangunan}" sudah memiliki form kerusakan untuk sekolah ini` }); return; }
        }

        // Determine initial status based on jenjang
        let initialStatus = 'Belum Upload';
        if (req.file) {
            const { sekolah: sekolahTable } = await import('../db/schema/index.js');
            const sch = await db.select({ jenjang: sekolahTable.jenjang }).from(sekolahTable).where(eq(sekolahTable.id, sekolahId));
            const jenjang = sch[0]?.jenjang || 'SMP';
            initialStatus = jenjang === 'SD' ? 'Menunggu Verifikasi Korwil' : 'Menunggu Verifikasi';
        }

        const f = req.file as any;
        const data: any = {
            sekolahId,
            masaBangunan,
            fileName: req.file?.originalname || null,
            filePath: f?.finalPath || req.file?.path || null,
            uploadStatus: req.file ? (f?.uploadPending ? 'uploading' : 'done') : 'done',
            status: initialStatus,
        };
        const result = await kerusakanService.create(data, req.user!.id);
        logActivity(req, 'Tambah Form Kerusakan', `Menambahkan form kerusakan bangunan ${masaBangunan || 'N/A'}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE FILE: save to temp, GDrive upload in background
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadFormKerusakan.single('file'), injectSekolahInfoFromBody, forwardToNas('kerusakan'), async (req, res) => {
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

        const f = req.file as any;
        const uploadStatus = f?.uploadPending ? 'uploading' : 'done';
        const result = await kerusakanService.updateFile(id, req.file.originalname, f?.finalPath || req.file.path, uploadStatus);
        logActivity(req, 'Upload File Kerusakan', `Upload file kerusakan #${id}: ${req.file.originalname}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try { await kerusakanService.delete(Number(req.params.id)); logActivity(req, 'Hapus Form Kerusakan', `Menghapus form kerusakan #${req.params.id}`); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const role = req.user!.role.toLowerCase();
        // Look up jenjang
        const existing = await kerusakanService.getById(id);
        if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
        const { sekolah: sekolahTable } = await import('../db/schema/index.js');
        const sch = await db.select({ jenjang: sekolahTable.jenjang }).from(sekolahTable).where(eq(sekolahTable.id, existing.formKerusakan.sekolahId));
        const jenjang = sch[0]?.jenjang || 'SMP';

        if (role === 'korwil' && jenjang === 'SD') {
            // Korwil verifies SD → promote to verifikator queue
            const r = await db.update(formKerusakan).set({ status: 'Menunggu Verifikasi', verifiedBy: req.user!.id, updatedAt: new Date() }).where(eq(formKerusakan.id, id)).returning();
            logActivity(req, 'Verifikasi Korwil Kerusakan', `Memverifikasi form kerusakan #${id} (SD → verifikator)`);
            res.json(r);
        } else {
            // Admin/Verifikator → final verify
            const r = await kerusakanService.verify(id, req.user!.id);
            logActivity(req, 'Verifikasi Kerusakan', `Memverifikasi form kerusakan #${id}`);
            res.json(r);
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/reject', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try { const r = await kerusakanService.reject(Number(req.params.id), req.user!.id, req.body.alasan); logActivity(req, 'Tolak Kerusakan', `Menolak form kerusakan #${req.params.id}`); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try { const r = await kerusakanService.unverify(Number(req.params.id)); logActivity(req, 'Batalkan Verifikasi Kerusakan', `Membatalkan verifikasi kerusakan #${req.params.id}`); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/revise', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try { const r = await kerusakanService.revise(Number(req.params.id), req.user!.id, req.body.alasan); logActivity(req, 'Revisi Kerusakan', `Merevisi form kerusakan #${req.params.id}`); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
// Get submitted masa bangunan for a school (for duplicate prevention)
router.get('/submitted-masa/:sekolahId', requireAuth, async (req, res) => {
    try {
        const { formKerusakan: fk } = await import('../db/schema/index.js');
        const rows = await db.select({ masaBangunan: fk.masaBangunan }).from(fk).where(eq(fk.sekolahId, Number(req.params.sekolahId)));
        res.json(rows.map(r => r.masaBangunan).filter(Boolean));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/missing', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await kerusakanService.getMissingSchools()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
