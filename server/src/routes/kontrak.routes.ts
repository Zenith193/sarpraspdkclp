import { Router } from 'express';
import { kontrakService } from '../services/kontrak.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Multer for upload berkas penawaran
const uploadsDir = path.join(process.cwd(), 'uploads', 'kontrak');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Hanya file PDF yang diizinkan'));
    },
});

// === Search SiRUP ===
router.get('/search-sirup', requireAuth, async (req, res) => {
    try {
        const kode = req.query.kode as string;
        if (!kode) return res.status(400).json({ error: 'Kode SiRUP wajib diisi' });
        const result = await kontrakService.searchSirup(kode);
        if (!result) return res.status(404).json({ error: 'Paket tidak ditemukan' });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === Search siblings (anakan) by RUP ===
router.get('/siblings', requireAuth, async (req, res) => {
    try {
        const rup = req.query.rup as string;
        if (!rup) return res.status(400).json({ error: 'RUP wajib diisi' });
        const results = await kontrakService.searchSiblings(rup);
        res.json(results);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === PENYEDIA: Create permohonan ===
router.post('/permohonan', requireAuth, upload.single('berkasPenawaran'), async (req, res) => {
    try {
        const data = req.body;
        if (req.file) {
            data.berkasPenawaranPath = `/uploads/kontrak/${req.file.filename}`;
        }
        const created = await kontrakService.createPermohonan(data, req.user!.id);
        res.status(201).json(created);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// === List permohonan (filtered by role) ===
router.get('/permohonan', requireAuth, async (req, res) => {
    try {
        const data = await kontrakService.listPermohonan(req.user!.id, req.user!.role);
        res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === Dashboard stats ===
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const stats = await kontrakService.getStats(req.user!.id);
        res.json(stats);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === Get single permohonan ===
router.get('/permohonan/:id', requireAuth, async (req, res) => {
    try {
        const result = await kontrakService.getById(Number(req.params.id));
        if (!result) return res.status(404).json({ error: 'Permohonan tidak ditemukan' });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === VERIFIKATOR: Update/Verify permohonan ===
router.put('/permohonan/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const updated = await kontrakService.updateByVerifikator(Number(req.params.id), req.body, req.user!.id);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === Delete permohonan ===
router.delete('/permohonan/:id', requireAuth, async (req, res) => {
    try {
        await kontrakService.deletePermohonan(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// === REALISASI ===
router.get('/permohonan/:id/realisasi', requireAuth, async (req, res) => {
    try {
        const data = await kontrakService.listRealisasi(Number(req.params.id));
        res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/permohonan/:id/realisasi', requireAuth, upload.single('dokumentasi'), async (req, res) => {
    try {
        const data = req.body;
        if (req.file) data.dokumentasiPath = `/uploads/kontrak/${req.file.filename}`;
        const created = await kontrakService.createRealisasi(Number(req.params.id), data, req.user!.id);
        res.status(201).json(created);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/realisasi/:id', requireAuth, async (req, res) => {
    try {
        const updated = await kontrakService.updateRealisasi(Number(req.params.id), req.body);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/realisasi/:id', requireAuth, async (req, res) => {
    try {
        await kontrakService.deleteRealisasi(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
