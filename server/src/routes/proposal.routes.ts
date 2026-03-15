import { Router } from 'express';
import { proposalService } from '../services/proposal.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { proposal, sekolah } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { uploadFotos, uploadProposal, forwardToNas } from '../middleware/upload.js';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import { logActivity } from '../middleware/logActivity.js';

const router = Router();

// Inject sekolah info from proposal ID for GDrive folder path
const injectSekolahFromProposal = async (req: any, _res: any, next: any) => {
    try {
        const proposalId = Number(req.params.id);
        if (proposalId) {
            const row = await db.select({ sekolahId: proposal.sekolahId }).from(proposal).where(eq(proposal.id, proposalId));
            if (row[0]?.sekolahId) {
                const sch = await db.select({ kecamatan: sekolah.kecamatan, nama: sekolah.nama, npsn: sekolah.npsn }).from(sekolah).where(eq(sekolah.id, row[0].sekolahId));
                if (sch[0]) {
                    req.body = req.body || {};
                    req.body.kecamatan = sch[0].kecamatan;
                    req.body.namaSekolah = sch[0].nama;
                    req.body.npsn = sch[0].npsn;
                }
            }
        }
    } catch (e) { /* ignore */ }
    next();
};

router.get('/', requireAuth, async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        const rawSekolahId = req.query.sekolahId ? Number(req.query.sekolahId) : undefined;

        const result = await proposalService.list({
            status: req.query.status as string,
            keranjang: req.query.keranjang as string,
            kecamatan: req.query.kecamatan as string,
            jenjang: req.query.jenjang as string,
            sekolahId: isSekolah ? req.user!.sekolahId : rawSekolahId,
            search: req.query.search as string,
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        const result = await proposalService.getById(id);
        if (!result) { res.status(404).json({ error: 'Not found' }); return; }

        if (isSekolah && result.proposal.sekolahId !== req.user!.sekolahId) {
            res.status(403).json({ error: 'Forbidden: You can only view your own proposals' });
            return;
        }

        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        if (isSekolah) {
            req.body.sekolahId = req.user!.sekolahId;
        }
        // Sanitize empty date strings to null
        if (req.body.tanggalSurat === '') req.body.tanggalSurat = null;
        // Auto-set keranjang to 'Keranjang Usulan Sekolah' for new proposals
        req.body.keranjang = 'Keranjang Usulan Sekolah';
        req.body.status = 'Menunggu Verifikasi';
        const result = await proposalService.create(req.body, req.user!.id);
        let schNm = '';
        if (req.body.sekolahId) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, Number(req.body.sekolahId))); schNm = sc[0]?.nama || ''; }
        logActivity(req, 'Tambah Proposal', `Mengajukan proposal baru: ${schNm} - ${req.body.subKegiatan || req.body.jenisPrasarana || ''}`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'sekolah', 'verifikator'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';

        if (isSekolah) {
            const existing = await proposalService.getById(id);
            if (!existing || existing.proposal.sekolahId !== req.user!.sekolahId) {
                res.status(403).json({ error: 'Forbidden: You can only update your own proposals' });
                return;
            }
            delete req.body.sekolahId;
        }

        // Sanitize empty date strings to null
        if (req.body.tanggalSurat === '') req.body.tanggalSurat = null;
        const result = await proposalService.update(id, req.body);
        const pRow = await db.select({ sk: proposal.subKegiatan, sid: proposal.sekolahId }).from(proposal).where(eq(proposal.id, id));
        let schNm = '';
        if (pRow[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pRow[0].sid)); schNm = sc[0]?.nama || ''; }
        logActivity(req, 'Edit Proposal', `Mengubah proposal ${schNm} - ${pRow[0]?.sk || ''}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE PROPOSAL PDF
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadProposal.single('file'), injectSekolahFromProposal, forwardToNas('proposal'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isSekolah = req.user!.role.toLowerCase() === 'sekolah';
        if (!req.file) { res.status(400).json({ error: 'No file' }); return; }

        if (isSekolah) {
            const existing = await proposalService.getById(id);
            if (!existing || existing.proposal.sekolahId !== req.user!.sekolahId) {
                res.status(403).json({ error: 'Forbidden' }); return;
            }
        }

        const finalPath = (req.file as any).finalPath || req.file.path;
        const uploadPending = (req.file as any).uploadPending === true;

        await proposalService.update(id, {
            fileName: req.file.originalname,
            filePath: finalPath,
            uploadStatus: uploadPending ? 'uploading' : 'done',
        });
        const pRow = await db.select({ sk: proposal.subKegiatan, sid: proposal.sekolahId }).from(proposal).where(eq(proposal.id, id));
        let schNm = '';
        if (pRow[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pRow[0].sid)); schNm = sc[0]?.nama || ''; }
        logActivity(req, 'Upload Proposal PDF', `Upload PDF ${schNm} - ${pRow[0]?.sk || ''}: ${req.file.originalname}`);
        res.json({ success: true, fileName: req.file.originalname });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const pRow = await db.select({ sk: proposal.subKegiatan, sid: proposal.sekolahId }).from(proposal).where(eq(proposal.id, id));
        let schNm = '';
        if (pRow[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pRow[0].sid)); schNm = sc[0]?.nama || ''; }
        await proposalService.delete(id);
        logActivity(req, 'Hapus Proposal', `Menghapus proposal ${schNm} - ${pRow[0]?.sk || ''}`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/batch-approve', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const ids = req.body.ids || [];
        if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return; }
        let count = 0;
        for (const id of ids) {
            try { await proposalService.updateStatus(Number(id), 'Disetujui', req.user!.id); count++; } catch { /* skip */ }
        }
        logActivity(req, 'Batch Approve Proposal', `Menyetujui ${count} proposal sekaligus`);
        res.json({ success: true, approved: count });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== WORKFLOW: Status + Keranjang auto-transition =====
router.put('/:id/status', requireAuth, requireRole('admin', 'verifikator', 'korwil'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const newStatus = req.body.status;
        const userRole = req.user!.role.toLowerCase();

        // Lookup proposal + sekolah jenjang
        const existing = await db.select({ proposal, jenjang: sekolah.jenjang })
            .from(proposal).leftJoin(sekolah, eq(proposal.sekolahId, sekolah.id))
            .where(eq(proposal.id, id));
        if (!existing[0]) { res.status(404).json({ error: 'Proposal not found' }); return; }
        const jenjang = existing[0].jenjang || 'SMP';

        // Korwil can only verify SD proposals
        if (userRole === 'korwil' && jenjang !== 'SD') {
            res.status(403).json({ error: 'Korwil hanya bisa memverifikasi proposal SD' }); return;
        }

        // Auto-transition keranjang based on status + jenjang + role
        let newKeranjang = existing[0].proposal.keranjang;
        let finalStatus = newStatus;
        if (newStatus === 'Diterima' || newStatus === 'Disetujui') {
            if (userRole === 'korwil' && jenjang === 'SD') {
                // Korwil approves SD → keep as Menunggu Verifikasi, move keranjang to Usulan Korwil
                finalStatus = 'Menunggu Verifikasi';
                newKeranjang = 'Keranjang Usulan Korwil';
            } else if (userRole === 'admin' || userRole === 'verifikator') {
                // Admin/Verifikator approves → use specified keranjang (Kabupaten/Provinsi/Pusat)
                newKeranjang = req.body.keranjang || existing[0].proposal.keranjang;
            }
        } else if (newStatus === 'Ditolak' || newStatus === 'Revisi') {
            // Rejected/Revised → back to Usulan Sekolah
            newKeranjang = 'Keranjang Usulan Sekolah';
        }

        // Update status with potentially modified finalStatus
        await proposalService.updateStatus(id, finalStatus, req.user!.id);

        if (newKeranjang !== existing[0].proposal.keranjang) {
            await proposalService.updateKeranjang(id, newKeranjang || 'Keranjang Usulan Sekolah');
        }

        const pSk = existing[0].proposal.subKegiatan || '';
        let schNm2 = '';
        if (existing[0].proposal.sekolahId) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, existing[0].proposal.sekolahId)); schNm2 = sc[0]?.nama || ''; }
        logActivity(req, 'Ubah Status Proposal', `Mengubah status proposal ${schNm2} - ${pSk} menjadi ${newStatus} (keranjang: ${newKeranjang})`);
        // Return updated proposal
        const updated = await proposalService.getById(id);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/keranjang', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proposalService.updateKeranjang(Number(req.params.id), req.body.keranjang);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/ranking', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const result = await proposalService.updateRanking(Number(req.params.id), req.body.ranking, req.body.bintang);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PROPOSAL PDF UPLOAD =====
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadProposal.single('file'), forwardToNas('proposal'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
        const f = req.file as any;
        const result = await proposalService.update(id, {
            fileName: req.file.originalname,
            filePath: f.finalPath || req.file.path,
            uploadStatus: f.uploadPending ? 'uploading' : 'done',
        });
        const pRow2 = await db.select({ sk: proposal.subKegiatan, sid: proposal.sekolahId }).from(proposal).where(eq(proposal.id, id));
        let schNm3 = '';
        if (pRow2[0]?.sid) { const sc = await db.select({ nama: sekolah.nama }).from(sekolah).where(eq(sekolah.id, pRow2[0].sid)); schNm3 = sc[0]?.nama || ''; }
        logActivity(req, 'Upload File Proposal', `Upload file ${schNm3} - ${pRow2[0]?.sk || ''}: ${req.file.originalname}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PROPOSAL FOTO UPLOAD =====
router.post('/:id/foto', requireAuth, requireRole('admin', 'sekolah'), uploadFotos.single('foto'), injectSekolahFromProposal, forwardToNas('proposal'), async (req, res) => {
    try {
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
        const f = req.file as any;
        const result = await proposalService.addFoto(Number(req.params.id), {
            proposalId: Number(req.params.id),
            fileName: req.file.originalname,
            filePath: f.finalPath || req.file.path,
            uploadStatus: f.uploadPending ? 'uploading' : 'done',
        });
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/foto/:fotoId', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
    try {
        await proposalService.removeFoto(Number(req.params.fotoId));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

