import { Router } from 'express';
import { matrikService, splHistoryService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { user } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.list({
            tahun: req.query.tahun ? Number(req.query.tahun) : undefined,
            sumberDana: req.query.sumberDana as string,
            jenisPengadaan: req.query.jenisPengadaan as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== SPL ROUTES (must be before /:id) =====
router.get('/spl', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.listSpl({
            tahun: req.query.tahun ? Number(req.query.tahun) : undefined,
        });
        console.log(`[SPL] Returning ${result.length} items`);
        res.json(result);
    } catch (e: any) { 
        console.error('[SPL] Error:', e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/spl/verifikator', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try {
        const verifikators = await db.select({
            id: user.id,
            name: user.name,
            nip: user.nip,
        }).from(user).where(eq(user.role, 'Verifikator'));
        res.json(verifikators);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/spl/history', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await splHistoryService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/spl/history', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: (req as any).user?.id };
        res.status(201).json(await splHistoryService.create(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/spl/history/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await splHistoryService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.getById(Number(req.params.id));
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.status(201).json(await matrikService.create(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await matrikService.update(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await matrikService.delete(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/import', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await matrikService.bulkCreate(req.body.items);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

