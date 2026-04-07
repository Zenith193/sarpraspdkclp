import { Router } from 'express';
import { matrikService, splHistoryService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../middleware/logActivity.js';
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

router.get('/spl/history', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try { const jenis = req.query.jenis as string | undefined; res.json(await splHistoryService.list(jenis)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/spl/history', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body, createdBy: (req as any).user?.id };
        const result = await splHistoryService.create(data);
        logActivity(req, 'Buat SPL History', `Membuat riwayat SPL: ${req.body.jenis || ''} - ${req.body.noSpl || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/spl/history/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await splHistoryService.delete(Number(req.params.id));
        logActivity(req, 'Hapus SPL History', `Menghapus riwayat SPL #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await matrikService.getById(Number(req.params.id));
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body };
        delete data.createdAt; delete data.updatedAt; delete data.id;
        const dateFields = ['tanggalMulai', 'tanggalSelesai', 'tglMc0', 'tglMc100', 'tglPcm'];
        for (const f of dateFields) {
            if (f in data) {
                if (!data[f] || data[f] === '' || data[f] === 'Invalid Date') {
                    data[f] = null;
                } else {
                    const d = new Date(data[f]);
                    data[f] = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                }
            }
        }
        if (data.noMatrik != null) {
            data.noMatrik = String(data.noMatrik).replace(/(\.\d+?)0{5,}\d*$/, '$1');
        }
        const result = await matrikService.create(data);
        logActivity(req, 'Tambah Matrik', `Menambahkan matrik kegiatan: ${data.namaPaket || ''} (No: ${data.noMatrik || ''})`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const data = { ...req.body };
        // Remove timestamp fields — these are managed server-side
        delete data.createdAt;
        delete data.updatedAt;
        delete data.id; // don't overwrite PK
        // Sanitize date fields — convert empty strings to null, invalid dates to null
        const dateFields = ['tanggalMulai', 'tanggalSelesai', 'tglMc0', 'tglMc100', 'tglPcm'];
        for (const f of dateFields) {
            if (f in data) {
                if (!data[f] || data[f] === '' || data[f] === 'Invalid Date') {
                    data[f] = null;
                } else {
                    // Ensure it's a valid date string (YYYY-MM-DD)
                    const d = new Date(data[f]);
                    data[f] = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                }
            }
        }
        // Ensure noMatrik is a clean string (fix floating point like 71.8000000000001)
        if (data.noMatrik != null) {
            data.noMatrik = String(data.noMatrik).replace(/(\.\d+?)0{5,}\d*$/, '$1');
        }
        const result = await matrikService.update(Number(req.params.id), data);
        if (!result) { res.status(404).json({ error: 'Data tidak ditemukan' }); return; }

        // ===== CASCADE: propagate shared fields to children =====
        const noMatrik = result.noMatrik;
        const isParent = noMatrik && !noMatrik.includes(',') && !/^\d+\.\d+$/.test(noMatrik);
        if (isParent) {
            // Fields that cascade from parent to children
            const CASCADABLE_FIELDS = [
                'subBidang', 'noSubKegiatan', 'subKegiatan', 'rup',
                'sumberDana', 'metode', 'jenisPengadaan',
                'penyedia', 'namaPemilik', 'statusPemilik', 'alamatKantor',
                'tanggalMulai', 'tanggalSelesai', 'jangkaWaktu', 'tahunAnggaran',
                'noHp', 'konsultanPengawas', 'dirKonsultanPengawas',
                'noMc0', 'tglMc0', 'noMc100', 'tglMc100', 'noPcm', 'tglPcm',
            ];
            const cascadeData: Record<string, any> = {};
            for (const f of CASCADABLE_FIELDS) {
                if (f in data) cascadeData[f] = data[f];
            }
            if (Object.keys(cascadeData).length > 0) {
                try {
                    const { matrikKegiatan } = await import('../db/schema/index.js');
                    const { like } = await import('drizzle-orm');
                    // Find children: noMatrik starts with "87." or "87,"
                    const allItems = await db.select({ id: matrikKegiatan.id, noMatrik: matrikKegiatan.noMatrik })
                        .from(matrikKegiatan);
                    const childIds = allItems
                        .filter(c => {
                            const nm = c.noMatrik;
                            return nm.startsWith(noMatrik + ',') || nm.startsWith(noMatrik + '.');
                        })
                        .map(c => c.id);
                    if (childIds.length > 0) {
                        for (const childId of childIds) {
                            await matrikService.update(childId, cascadeData);
                        }
                        console.log(`[Matrik] Cascaded ${Object.keys(cascadeData).length} fields to ${childIds.length} children of ${noMatrik}`);
                    }
                } catch (cascErr: any) {
                    console.error('[Matrik] Cascade error:', cascErr.message);
                }
            }
        }

        logActivity(req, 'Edit Matrik', `Mengubah matrik kegiatan #${req.params.id}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await matrikService.delete(Number(req.params.id));
        logActivity(req, 'Hapus Matrik', `Menghapus matrik kegiatan #${req.params.id}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/import', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const dateFields = ['tanggalMulai', 'tanggalSelesai', 'tglMc0', 'tglMc100', 'tglPcm'];
        const items = (req.body.items || []).map((item: any) => {
            const data = { ...item };
            delete data.createdAt; delete data.updatedAt; delete data.id;
            for (const f of dateFields) {
                if (f in data) {
                    if (!data[f] || data[f] === '') { data[f] = null; }
                    else { const d = new Date(data[f]); data[f] = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; }
                }
            }
            if (data.noMatrik != null) data.noMatrik = String(data.noMatrik).replace(/(\.\d+?)0{5,}\d*$/, '$1');
            return data;
        });
        const result = await matrikService.bulkCreate(items);
        logActivity(req, 'Import Matrik', `Mengimport ${items.length} data matrik kegiatan`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

