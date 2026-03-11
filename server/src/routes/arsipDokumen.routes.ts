import { Router } from 'express';
import { arsipDokumenService } from '../services/arsipDokumen.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ===== REKOMENDASI =====
router.get('/rekomendasi', requireAuth, async (_req, res) => {
    try { res.json(await arsipDokumenService.listRekomendasi()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/rekomendasi', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: req.user?.id };
        res.status(201).json(await arsipDokumenService.createRekomendasi(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/rekomendasi/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await arsipDokumenService.deleteRekomendasi(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== CHECKLIST =====
router.get('/checklist', requireAuth, async (_req, res) => {
    try { res.json(await arsipDokumenService.listChecklist()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/checklist', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: req.user?.id };
        res.status(201).json(await arsipDokumenService.createChecklist(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/checklist/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await arsipDokumenService.deleteChecklist(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
