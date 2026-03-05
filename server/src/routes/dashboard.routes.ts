import { Router } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/admin', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await dashboardService.getAdminStats()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/korwil', requireAuth, requireRole('korwil'), async (req, res) => {
    try {
        // TODO: get kecamatan from korwil_assignment for current user
        const kecamatanList = (req.query.kecamatan as string || '').split(',').filter(Boolean);
        res.json(await dashboardService.getKorwilStats(kecamatanList));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/sekolah', requireAuth, requireRole('sekolah'), async (req, res) => {
    try {
        if (!req.user!.sekolahId) { res.status(400).json({ error: 'No sekolah linked' }); return; }
        res.json(await dashboardService.getSekolahStats(req.user!.sekolahId));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
