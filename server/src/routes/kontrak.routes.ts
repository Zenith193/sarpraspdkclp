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

// === Bulk sync all verified kontrak to matrik ===
router.post('/sync-matrik', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { kontrakService: ks } = await import('../services/kontrak.service.js');
        const { db: database } = await import('../db/index.js');
        const { permohonanKontrak, perusahaan, matrikKegiatan } = await import('../db/schema/index.js');
        const { eq } = await import('drizzle-orm');

        // Get all verified contracts
        const allKontrak = await database.select({
            kontrak: permohonanKontrak,
            namaPerusahaan: perusahaan.namaPerusahaan,
            namaPemilik: perusahaan.namaPemilik,
            alamatPerusahaan: perusahaan.alamatPerusahaan,
            noTelp: perusahaan.noTelp,
        }).from(permohonanKontrak)
          .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
          .where(eq(permohonanKontrak.status, 'Diverifikasi'));

        let synced = 0;
        for (const k of allKontrak) {
            const matrikData: any = {
                noSpk: k.kontrak.noSpk || null,
                nilaiKontrak: k.kontrak.nilaiKontrak || null,
                terbilangKontrak: k.kontrak.terbilangKontrak || null,
                tanggalMulai: k.kontrak.tanggalMulai || null,
                tanggalSelesai: k.kontrak.tanggalSelesai || null,
                jangkaWaktu: k.kontrak.waktuPenyelesaian ? parseInt(k.kontrak.waktuPenyelesaian) : null,
                penyedia: k.namaPerusahaan || null,
                namaPemilik: k.namaPemilik || null,
                alamatKantor: k.alamatPerusahaan || null,
                noHp: k.noTelp || null,
                metode: k.kontrak.metodePengadaan || null,
                jenisPengadaan: k.kontrak.jenisPengadaan || null,
                updatedAt: new Date(),
            };

            if (k.kontrak.matrikId) {
                await database.update(matrikKegiatan).set(matrikData)
                    .where(eq(matrikKegiatan.id, k.kontrak.matrikId));
                synced++;
            } else {
                const [newMatrik] = await database.insert(matrikKegiatan).values({
                    noMatrik: 'K-' + k.kontrak.id,
                    rup: k.kontrak.kodeSirup || '',
                    namaPaket: k.kontrak.namaPaket || '',
                    jenisPengadaan: k.kontrak.jenisPengadaan || '',
                    metode: k.kontrak.metodePengadaan || '',
                    tahunAnggaran: new Date().getFullYear(),
                    ...matrikData,
                }).returning();
                await database.update(permohonanKontrak).set({ matrikId: newMatrik.id })
                    .where(eq(permohonanKontrak.id, k.kontrak.id));
                synced++;
            }
        }
        console.log(`[Kontrak→Matrik] Bulk synced ${synced} contracts`);
        res.json({ success: true, synced, total: allKontrak.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
