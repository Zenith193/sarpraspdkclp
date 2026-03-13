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
        logActivity(req, 'Tambah Proposal', `Mengajukan proposal baru`);
        res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin', 'sekolah'), async (req, res) => {
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
        logActivity(req, 'Edit Proposal', `Mengubah proposal #${id}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// UPLOAD/REPLACE PROPOSAL PDF
router.put('/:id/upload', requireAuth, requireRole('admin', 'sekolah'), uploadProposal.single('file'), forwardToNas('proposal'), async (req, res) => {
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
        logActivity(req, 'Upload Proposal PDF', `Upload PDF proposal #${id}: ${req.file.originalname}`);
        res.json({ success: true, fileName: req.file.originalname });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await proposalService.delete(Number(req.params.id));
        logActivity(req, 'Hapus Proposal', `Menghapus proposal #${req.params.id}`);
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

        // Update status
        await proposalService.updateStatus(id, newStatus, req.user!.id);

        // Auto-transition keranjang based on status + jenjang + role
        let newKeranjang = existing[0].proposal.keranjang;
        if (newStatus === 'Diterima' || newStatus === 'Disetujui') {
            if (userRole === 'korwil' && jenjang === 'SD') {
                // Korwil approves SD → move to Usulan Korwil
                newKeranjang = 'Keranjang Usulan Korwil';
            } else if (userRole === 'admin' || userRole === 'verifikator') {
                // Admin/Verifikator approves → use specified keranjang (Kabupaten/Provinsi/Pusat)
                newKeranjang = req.body.keranjang || existing[0].proposal.keranjang;
            }
        } else if (newStatus === 'Ditolak' || newStatus === 'Revisi') {
            // Rejected/Revised → back to Usulan Sekolah
            newKeranjang = 'Keranjang Usulan Sekolah';
        }

        if (newKeranjang !== existing[0].proposal.keranjang) {
            await proposalService.updateKeranjang(id, newKeranjang || 'Keranjang Usulan Sekolah');
        }

        logActivity(req, 'Ubah Status Proposal', `Mengubah status proposal #${id} menjadi ${newStatus} (keranjang: ${newKeranjang})`);
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
        logActivity(req, 'Upload File Proposal', `Upload file proposal #${id}: ${req.file.originalname}`);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PROPOSAL FOTO UPLOAD =====
router.post('/:id/foto', requireAuth, requireRole('admin', 'sekolah'), uploadFotos.single('foto'), forwardToNas('proposal'), async (req, res) => {
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

