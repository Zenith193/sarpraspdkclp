import { Router } from 'express';
import { arsipDokumenService } from '../services/arsipDokumen.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

// ===== REKOMENDASI =====
router.get('/rekomendasi', requireAuth, async (_req, res) => {
    try { res.json(await arsipDokumenService.listRekomendasi()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/rekomendasi', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: req.user?.id };
        const result = await arsipDokumenService.createRekomendasi(data);
        logActivity(req, 'Buat Rekomendasi', `Membuat rekomendasi: ${req.body.namaSekolah || ''} - ${req.body.subKegiatan || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/rekomendasi/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await arsipDokumenService.deleteRekomendasi(Number(req.params.id));
        logActivity(req, 'Hapus Rekomendasi', `Menghapus rekomendasi #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/rekomendasi/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const updated = await arsipDokumenService.updateRekomendasi(Number(req.params.id), req.body);
        logActivity(req, 'Edit Rekomendasi', `Mengubah rekomendasi #${req.params.id}`);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== CHECKLIST =====
router.get('/checklist', requireAuth, async (_req, res) => {
    try { res.json(await arsipDokumenService.listChecklist()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/checklist', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: req.user?.id };
        const result = await arsipDokumenService.createChecklist(data);
        logActivity(req, 'Buat Checklist', `Membuat checklist: ${req.body.sekolahNama || ''} - ${req.body.jenisUsulan || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/checklist/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await arsipDokumenService.deleteChecklist(Number(req.params.id));
        logActivity(req, 'Hapus Checklist', `Menghapus checklist #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/checklist/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const updated = await arsipDokumenService.updateChecklist(Number(req.params.id), req.body);
        logActivity(req, 'Edit Checklist', `Mengubah checklist #${req.params.id}`);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
