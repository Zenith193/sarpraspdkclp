import { Router } from 'express';
import { prestasiService } from '../services/prestasi.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadSertifikat, forwardToNas } from '../middleware/upload.js';
import { logActivity } from '../middleware/logActivity.js';
import { db } from '../db/index.js';
import { prestasi, sekolah } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await prestasiService.list({
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            search: req.query.search as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), uploadSertifikat.single('sertifikat'), forwardToNas('prestasi'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const f = req.file as any;
        const data: any = {
            sekolahId: Number(req.body.sekolahId),
            jenisPrestasi: req.body.jenisPrestasi,
            siswa: req.body.siswa,
            kategori: req.body.kategori,
            tingkat: req.body.tingkat,
            tahun: req.body.tahun ? Number(req.body.tahun) : null,
            capaian: req.body.keterangan || req.body.capaian || null,
            sertifikatPath: f?.finalPath || req.file?.path || null,
            uploadStatus: f?.uploadPending ? 'uploading' : 'done',
        };
        if (isSekolah) {
            data.sekolahId = req.user!.sekolahId;
        }
        const result = await prestasiService.create(data, req.user!.id);
        logActivity(req, 'Tambah Prestasi', `Menambahkan data prestasi: ${req.body.jenisPrestasi || 'N/A'}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE SERTIFIKAT
router.put('/:id/sertifikat', requireAuth, requireRole('admin', 'sekolah'), uploadSertifikat.single('sertifikat'), forwardToNas('prestasi'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
        const f = req.file as any;
        const updateData: any = {
            sertifikatPath: f?.finalPath || req.file?.path || null,
            uploadStatus: f?.uploadPending ? 'uploading' : 'done',
        };
        res.json(await prestasiService.update(id, updateData));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        if (isSekolah) {
            const existing = await prestasiService.list({ sekolahId: req.user!.sekolahId });
            const item = existing.data.find(d => (d.prestasi as any).id === id);
            if (!item) {
                res.status(403).json({ error: 'Forbidden: You can only update your own achievements' });
                return;
            }
            delete req.body.sekolahId;
        }

        // Map keterangan → capaian and strip non-schema fields
        const updateData: any = {
            jenisPrestasi: req.body.jenisPrestasi,
            siswa: req.body.siswa,
            kategori: req.body.kategori,
            tingkat: req.body.tingkat,
            tahun: req.body.tahun ? Number(req.body.tahun) : null,
            capaian: req.body.keterangan || req.body.capaian || null,
        };
        const result = await prestasiService.update(id, updateData);
        const pItem = await db.select({ jp: prestasi.jenisPrestasi, siswa: prestasi.siswa, sid: prestasi.sekolahId }).from(prestasi).where(eq(prestasi.id, id));
        let schNm = '';
        if (pItem[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pItem[0].sid)); schNm = sc[0]?.nama || ''; }
        logActivity(req, 'Edit Prestasi', `Mengubah prestasi ${schNm} - ${pItem[0]?.jp || ''} (${pItem[0]?.siswa || ''})`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const pItem = await db.select({ jp: prestasi.jenisPrestasi, siswa: prestasi.siswa, sid: prestasi.sekolahId }).from(prestasi).where(eq(prestasi.id, Number(req.params.id)));
        let schNm = '';
        if (pItem[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pItem[0].sid)); schNm = sc[0]?.nama || ''; }
        await prestasiService.delete(Number(req.params.id));
        logActivity(req, 'Hapus Prestasi', `Menghapus prestasi ${schNm} - ${pItem[0]?.jp || ''} (${pItem[0]?.siswa || ''})`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/verify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const role = req.user!.role.toLowerCase();
        // Look up sekolah jenjang via prestasi
        const item = await db.select({ sekolahId: prestasi.sekolahId }).from(prestasi).where(eq(prestasi.id, id));
        let jenjang = 'SMP';
        if (item[0]?.sekolahId) {
            const sch = await db.select({ jenjang: sekolah.jenjang }).from(sekolah).where(eq(sekolah.id, item[0].sekolahId));
            jenjang = sch[0]?.jenjang || 'SMP';
        }
        // Get school name for activity log
        let schNm = '';
        const pItem = await db.select({ jp: prestasi.jenisPrestasi, siswa: prestasi.siswa }).from(prestasi).where(eq(prestasi.id, id));
        if (item[0]?.sekolahId) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, item[0].sekolahId)); schNm = sc[0]?.nama || ''; }
        const prestasiInfo = `${schNm} - ${pItem[0]?.jp || ''} (${pItem[0]?.siswa || ''})`;
        if (role === 'korwil' && jenjang === 'SD') {
            const r = await db.update(prestasi).set({ status: 'Menunggu Verifikasi', verifiedBy: req.user!.id, updatedAt: new Date() }).where(eq(prestasi.id, id)).returning();
            logActivity(req, 'Verifikasi Korwil Prestasi', `Memverifikasi prestasi ${prestasiInfo} → diteruskan ke verifikator`);
            res.json(r);
        } else {
            const r = await prestasiService.verify(id, req.user!.id);
            logActivity(req, 'Verifikasi Prestasi', `Memverifikasi prestasi ${prestasiInfo}`);
            res.json(r);
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/reject', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const pItem = await db.select({ jp: prestasi.jenisPrestasi, siswa: prestasi.siswa, sid: prestasi.sekolahId }).from(prestasi).where(eq(prestasi.id, Number(req.params.id)));
        let schNm = '';
        if (pItem[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pItem[0].sid)); schNm = sc[0]?.nama || ''; }
        const r = await prestasiService.reject(Number(req.params.id), req.user!.id, req.body.alasan);
        logActivity(req, 'Tolak Prestasi', `Menolak prestasi ${schNm} - ${pItem[0]?.jp || ''}: ${req.body.alasan || ''}`);
        res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/unverify', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try { res.json(await prestasiService.unverify(Number(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/rekap', requireAuth, requireRole('admin', 'korwil'), async (_req, res) => {
    try { res.json(await prestasiService.getRekap()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== POINT RULES =====
router.get('/point-rules', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await prestasiService.listPointRules()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/point-rules', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.status(201).json(await prestasiService.createPointRule(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/point-rules/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await prestasiService.updatePointRule(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/point-rules/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await prestasiService.deletePointRule(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
