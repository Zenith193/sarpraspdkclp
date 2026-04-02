import { Router } from 'express';
import { perusahaanService } from '../services/perusahaan.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ===== PUBLIC: Registration =====
router.post('/register', async (req, res) => {
    try {
        const { npwp, email, password, confirmPassword, ...rest } = req.body;
        if (!npwp) return res.status(400).json({ error: 'NPWP wajib diisi' });
        if (!rest.namaPerusahaan) return res.status(400).json({ error: 'Nama perusahaan wajib diisi' });
        if (!email) return res.status(400).json({ error: 'Email wajib diisi' });
        if (!password || password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
        if (password !== confirmPassword) return res.status(400).json({ error: 'Password dan konfirmasi tidak cocok' });

        const saved = await perusahaanService.register({ ...rest, npwp, email, password });
        res.status(201).json({ success: true, message: 'Registrasi berhasil! Silakan tunggu verifikasi admin.', data: saved });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ===== PUBLIC: Check verification status =====
router.get('/check/:npwp', async (req, res) => {
    try {
        const result = await perusahaanService.checkByNpwp(req.params.npwp);
        if (!result) return res.status(404).json({ error: 'NPWP tidak ditemukan. Pastikan format benar.' });
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== ADMIN/VERIFIKATOR: List all =====
router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try {
        res.json(await perusahaanService.list());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN/VERIFIKATOR: Verify/Reject =====
router.put('/:id/verify', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const { status, keterangan } = req.body;
        if (!['Diverifikasi', 'Ditolak', 'Menunggu'].includes(status)) {
            return res.status(400).json({ error: 'Status harus Diverifikasi, Ditolak, atau Menunggu' });
        }
        const result = await perusahaanService.verify(Number(req.params.id), status, keterangan);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN/VERIFIKATOR: Update =====
router.put('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        const updated = await perusahaanService.update(Number(req.params.id), req.body);
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN/VERIFIKATOR: Delete =====
router.delete('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
    try {
        await perusahaanService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
