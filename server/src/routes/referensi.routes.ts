import { Router } from 'express';
import { db } from '../db/index.js';
import { dasarHukum, satuanKerja, ppkom } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// ============ DASAR HUKUM ============
router.get('/dasar-hukum', async (_req, res) => {
    try {
        const rows = await db.select().from(dasarHukum).orderBy(desc(dasarHukum.id));
        res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/dasar-hukum', async (req, res) => {
    try {
        const [row] = await db.insert(dasarHukum).values({
            tahun: Number(req.body.tahun) || new Date().getFullYear(),
            isi: req.body.isi || '',
        }).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/dasar-hukum/:id', async (req, res) => {
    try {
        const [row] = await db.update(dasarHukum).set({
            tahun: Number(req.body.tahun) || undefined,
            isi: req.body.isi,
        }).where(eq(dasarHukum.id, Number(req.params.id))).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/dasar-hukum/:id', async (req, res) => {
    try {
        await db.delete(dasarHukum).where(eq(dasarHukum.id, Number(req.params.id)));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ SATUAN KERJA ============
router.get('/satuan-kerja', async (_req, res) => {
    try {
        const rows = await db.select().from(satuanKerja).orderBy(desc(satuanKerja.id));
        res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/satuan-kerja', async (req, res) => {
    try {
        const [row] = await db.insert(satuanKerja).values({
            nip: req.body.nip || '',
            namaPimpinan: req.body.namaPimpinan || '',
            jabatan: req.body.jabatan || '',
            website: req.body.website || '',
            email: req.body.email || '',
            telepon: req.body.telepon || '',
            klpd: req.body.klpd || '',
        }).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/satuan-kerja/:id', async (req, res) => {
    try {
        const [row] = await db.update(satuanKerja).set({
            nip: req.body.nip,
            namaPimpinan: req.body.namaPimpinan,
            jabatan: req.body.jabatan,
            website: req.body.website,
            email: req.body.email,
            telepon: req.body.telepon,
            klpd: req.body.klpd,
        }).where(eq(satuanKerja.id, Number(req.params.id))).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/satuan-kerja/:id', async (req, res) => {
    try {
        await db.delete(satuanKerja).where(eq(satuanKerja.id, Number(req.params.id)));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ PPKOM ============
router.get('/ppkom', async (_req, res) => {
    try {
        const rows = await db.select().from(ppkom).orderBy(desc(ppkom.id));
        res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/ppkom', async (req, res) => {
    try {
        const [row] = await db.insert(ppkom).values({
            nip: req.body.nip || '',
            nama: req.body.nama || '',
            pangkat: req.body.pangkat || '',
            jabatan: req.body.jabatan || '',
            alamat: req.body.alamat || '',
            noTelp: req.body.noTelp || '',
            email: req.body.email || '',
        }).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/ppkom/:id', async (req, res) => {
    try {
        const [row] = await db.update(ppkom).set({
            nip: req.body.nip,
            nama: req.body.nama,
            pangkat: req.body.pangkat,
            jabatan: req.body.jabatan,
            alamat: req.body.alamat,
            noTelp: req.body.noTelp,
            email: req.body.email,
        }).where(eq(ppkom.id, Number(req.params.id))).returning();
        res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/ppkom/:id', async (req, res) => {
    try {
        await db.delete(ppkom).where(eq(ppkom.id, Number(req.params.id)));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
