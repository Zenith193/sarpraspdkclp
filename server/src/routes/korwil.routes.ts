import { Router } from 'express';
import { korwilService } from '../services/korwil.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'korwil'), async (_req, res) => {
    try { res.json(await korwilService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await korwilService.assign(req.body);
        logActivity(req, 'Assign Korwil', `Menambahkan penugasan korwil`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await korwilService.update(req.params.userId as string, req.body);
        logActivity(req, 'Edit Korwil', `Mengubah penugasan korwil ${req.params.userId}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await korwilService.delete(req.params.userId as string);
        logActivity(req, 'Hapus Korwil', `Menghapus penugasan korwil ${req.params.userId}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
