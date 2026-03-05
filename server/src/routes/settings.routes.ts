import { Router } from 'express';
import { settingsService } from '../services/settings.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { testNasConnection, isNasEnabled } from '../utils/nasClient.js';

const router = Router();

// ===== ACCESS CONFIG =====
router.get('/access', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.get('access_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/access', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await settingsService.set('access_config', req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/access/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('access_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== COUNTDOWN =====
router.get('/countdown', requireAuth, async (_req, res) => {
    try { res.json(await settingsService.get('countdown')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/countdown', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await settingsService.set('countdown', req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/countdown/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('countdown')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== NAS CONFIG =====
router.get('/nas', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const config = await settingsService.get('nas_config');
        res.json({ ...config, nasEnabled: isNasEnabled() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/nas', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await settingsService.set('nas_config', req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/nas/test', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const result = await testNasConnection();
        res.json(result);
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});
router.post('/nas/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('nas_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
