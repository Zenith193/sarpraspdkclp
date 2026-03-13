import { Router } from 'express';
import { pencairanService } from '../services/pencairan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await pencairanService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:matrikId', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { res.json(await pencairanService.getByMatrikId(Number(req.params.matrikId))); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:matrikId', requireAuth, requireRole('admin'), async (req, res) => {
    try { const r = await pencairanService.upsert(Number(req.params.matrikId), req.body); logActivity(req, 'Update Pencairan', `Mengubah data pencairan matrik #${req.params.matrikId}`); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
