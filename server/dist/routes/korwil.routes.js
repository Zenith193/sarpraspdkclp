import { Router } from 'express';
import { korwilService } from '../services/korwil.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, requireRole('admin', 'korwil'), async (_req, res) => {
    try {
        res.json(await korwilService.list());
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.status(201).json(await korwilService.assign(req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        res.json(await korwilService.update(req.params.userId, req.body));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await korwilService.delete(req.params.userId);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
