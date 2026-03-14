import { Router } from 'express';
import { penggunaService } from '../services/pengguna.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { user, account } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '../auth/index.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logActivity } from '../middleware/logActivity.js';

const avatarDir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
console.log('[Avatar] Dir:', avatarDir);
const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, avatarDir),
        filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya file gambar (jpg, png, webp)'));
    },
});

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await penggunaService.list({
            search: req.query.search as string,
            role: req.query.role as string,
            page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 50,
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/batch', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        if (!Array.isArray(req.body.users)) {
            res.status(400).json({ error: 'Body harus berisi array users' });
            return;
        }
        res.json(await penggunaService.batchCreate(req.body.users));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role.toLowerCase() !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        const r = await penggunaService.getById(id);
        if (!r) { res.status(404).json({ error: 'Not found' }); return; }
        res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id as string;
        if (req.user!.role.toLowerCase() !== 'admin' && req.user!.id !== id) { res.status(403).json({ error: 'Forbidden' }); return; }
        res.json(await penggunaService.update(id, req.body));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/toggle-active', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await penggunaService.toggleActive(req.params.id as string)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try { await penggunaService.delete(req.params.id as string); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== CHANGE PASSWORD =====
router.put('/:id/change-password', requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id as string;
        const isAdmin = req.user!.role.toLowerCase() === 'admin';
        const isSelf = req.user!.id === targetId;
        if (!isAdmin && !isSelf) { res.status(403).json({ error: 'Forbidden' }); return; }

        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'Password minimal 6 karakter' }); return;
        }

        // Hash using Better Auth's internal hashing
        const hashModule = await import('better-auth/crypto');
        const hashedPassword = await hashModule.hashPassword(newPassword);

        // Update hashed password in account table
        await db.update(account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(and(eq(account.userId, targetId), eq(account.providerId, 'credential')));

        // Update plain password in user table (raw SQL since column not in Drizzle schema)
        try {
            await db.execute(sql`UPDATE "user" SET "plain_password" = ${newPassword}, "updated_at" = NOW() WHERE "id" = ${targetId}`);
        } catch (_) { /* column may not exist yet */ }

        res.json({ success: true, message: 'Password berhasil diubah' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== UPLOAD PROFILE PHOTO =====
router.put('/:id/photo', requireAuth, avatarUpload.single('photo'), async (req, res) => {
    try {
        const targetId = req.params.id as string;
        const isAdmin = req.user!.role.toLowerCase() === 'admin';
        const isSelf = req.user!.id === targetId;
        if (!isAdmin && !isSelf) { res.status(403).json({ error: 'Forbidden' }); return; }
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

        // Delete old avatar (local or GDrive)
        const existing = await db.select().from(user).where(eq(user.id, targetId));
        if (existing[0]?.image) {
            if (existing[0].image.startsWith('gdrive://')) {
                try {
                    const { queueGDriveDelete } = await import('../utils/uploadQueue.js');
                    queueGDriveDelete(existing[0].image);
                } catch { /* ignore */ }
            } else if (existing[0].image.startsWith('/api/pengguna/')) {
                const oldFile = path.join(avatarDir, path.basename(existing[0].image.replace('/api/pengguna/photo/', '')));
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            }
        }

        // Always use the local API URL for serving the photo
        const imageUrl = `/api/pengguna/photo/${req.file.filename}`;

        // Upload to GDrive in background — use uploadToGDrive (NOT uploadFileToGDrive which deletes local file!)
        try {
            const { isGDriveEnabled, uploadToGDrive } = await import('../utils/googleDriveClient.js');
            if (isGDriveEnabled()) {
                let subPath = `profil`;
                if (existing[0]?.sekolahId) {
                    const { sekolah: sekolahTable } = await import('../db/schema/index.js');
                    const sch = await db.select().from(sekolahTable).where(eq(sekolahTable.id, existing[0].sekolahId));
                    if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/profil`;
                }
                // Upload to GDrive as backup — uploadToGDrive does NOT delete local file
                uploadToGDrive(req.file.path, subPath).then(r =>
                    console.log('[Avatar] GDrive upload:', r.success ? `✅ ${r.fileId}` : '❌ failed')
                ).catch((e: any) =>
                    console.error('[Avatar] GDrive upload error:', e.message)
                );
            }
        } catch (gErr) {
            console.error('[Avatar] GDrive check error:', gErr);
        }

        await db.update(user).set({ image: imageUrl, updatedAt: new Date() }).where(eq(user.id, targetId));
        console.log('[Avatar Upload] Saved:', req.file.path, '→ URL:', imageUrl);
        logActivity(req, 'Upload Foto Profil', `Mengubah foto profil`);
        res.json({ success: true, imageUrl });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== DELETE PROFILE PHOTO =====
router.delete('/:id/photo', requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id as string;
        const isAdmin = req.user!.role.toLowerCase() === 'admin';
        const isSelf = req.user!.id === targetId;
        if (!isAdmin && !isSelf) { res.status(403).json({ error: 'Forbidden' }); return; }

        const existing = await db.select().from(user).where(eq(user.id, targetId));
        if (existing[0]?.image) {
            if (existing[0].image.startsWith('gdrive://')) {
                try {
                    const { queueGDriveDelete } = await import('../utils/uploadQueue.js');
                    queueGDriveDelete(existing[0].image);
                } catch { /* ignore */ }
            } else if (existing[0].image.startsWith('/api/pengguna/photo/')) {
                const filename = existing[0].image.replace('/api/pengguna/photo/', '');
                const oldFile = path.join(avatarDir, filename);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            }
        }

        await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, targetId));
        logActivity(req, 'Hapus Foto Profil', `Menghapus foto profil`);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== SERVE PROFILE PHOTO =====
router.get('/photo/:filename', async (req, res) => {
    const filePath = path.join(avatarDir, req.params.filename);
    console.log('[Avatar Serve]', filePath, 'exists:', fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) {
        // Try listing the directory to see what files are there
        try { console.log('[Avatar Serve] Files in dir:', fs.readdirSync(avatarDir).slice(0, 10)); } catch(e) {}
        res.status(404).json({ error: 'Not found', path: filePath });
        return;
    }
    res.sendFile(path.resolve(filePath));
});

export default router;
