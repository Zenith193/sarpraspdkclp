import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate, forwardToNas } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await templateService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, requireRole('admin'), uploadTemplate.single('file'), forwardToNas('template'), async (req, res) => {
    try {
        const f = req.file as any;
        const data = {
            ...req.body,
            ...(req.file ? { filePath: f?.finalPath || req.file.path } : {}),
        };
        res.status(201).json(await templateService.create(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, requireRole('admin'), uploadTemplate.single('file'), forwardToNas('template'), async (req, res) => {
    try {
        const f = req.file as any;
        const data = {
            ...req.body,
            ...(req.file ? { filePath: f?.finalPath || req.file.path } : {}),
        };
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await templateService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

