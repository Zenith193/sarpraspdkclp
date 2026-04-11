import { Router } from 'express';
import { proyeksiService } from '../services/proyeksi.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

// ===== ANGGARAN =====
router.get('/anggaran', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await proyeksiService.listAnggaran()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/anggaran', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proyeksiService.createAnggaran(req.body);
        logActivity(req, 'Tambah Anggaran', `Menambahkan data anggaran: ${req.body.namaKegiatan || req.body.subKegiatan || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/anggaran/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proyeksiService.updateAnggaran(Number(req.params.id), req.body);
        logActivity(req, 'Edit Anggaran', `Mengubah data anggaran #${req.params.id}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/anggaran/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await proyeksiService.deleteAnggaran(Number(req.params.id));
        logActivity(req, 'Hapus Anggaran', `Menghapus data anggaran #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== SNP =====
router.get('/snp', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await proyeksiService.listSnp()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/snp', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proyeksiService.createSnp(req.body);
        logActivity(req, 'Tambah SNP', `Menambahkan data SNP: ${req.body.standar || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/snp/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proyeksiService.updateSnp(Number(req.params.id), req.body);
        logActivity(req, 'Edit SNP', `Mengubah data SNP #${req.params.id}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/snp/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await proyeksiService.deleteSnp(Number(req.params.id));
        logActivity(req, 'Hapus SNP', `Menghapus data SNP #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== REKAP =====
router.get('/rekap', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await proyeksiService.getRekap()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== KETERANGAN / USULAN (persisted in appSettings) =====
router.get('/keterangan', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await proyeksiService.getKeterangan()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/keterangan', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proyeksiService.saveKeterangan(req.body);
        logActivity(req, 'Edit Keterangan Proyeksi', `Mengubah keterangan/usulan proyeksi anggaran`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
