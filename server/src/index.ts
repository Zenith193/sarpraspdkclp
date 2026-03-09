import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Explicitly load .env from the server directory (PM2 bash wrapper may change CWD)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '.env');
const dotenvResult = dotenv.config({ path: envPath });
console.log(`[dotenv] Loaded from: ${envPath} (${dotenvResult.error ? 'ERROR: ' + dotenvResult.error.message : 'OK, ' + Object.keys(dotenvResult.parsed || {}).length + ' vars'})`);
import express from 'express';
import cors from 'cors';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth/index.js';
import { requireAuth, requireRole } from './middleware/auth.js';

// Route imports
import sekolahRoutes from './routes/sekolah.routes.js';
import sarprasRoutes from './routes/sarpras.routes.js';
import proposalRoutes from './routes/proposal.routes.js';
import proyeksiRoutes from './routes/proyeksi.routes.js';
import matrikRoutes from './routes/matrik.routes.js';
import pencairanRoutes from './routes/pencairan.routes.js';
import bastRoutes from './routes/bast.routes.js';
import templateRoutes from './routes/template.routes.js';
import riwayatBantuanRoutes from './routes/riwayatBantuan.routes.js';
import prestasiRoutes from './routes/prestasi.routes.js';
import kerusakanRoutes from './routes/kerusakan.routes.js';
import korwilRoutes from './routes/korwil.routes.js';
import penggunaRoutes from './routes/pengguna.routes.js';
import aktivitasRoutes from './routes/aktivitas.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import iklanRoutes from './routes/iklan.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        // Allow any localhost for development
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
        // Allow configured production origin(s)
        const allowed = process.env.CORS_ORIGIN || '';
        if (allowed === '*') return callback(null, true);
        const origins = allowed.split(',').map(o => o.trim());
        if (origins.includes(origin)) return callback(null, true);
        // Allow same IP-based origins
        if (/^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// ===== FILE PROXY: serve sarpras photos from local or NAS =====
import fs from 'fs';
import path from 'path';
import { getNasDownloadLink, isNasEnabled } from './utils/nasClient.js';

app.get('/api/foto/:fotoId', async (req, res) => {
    try {
        const { sarprasFoto } = await import('./db/schema/index.js');
        const foto = await db.select().from(sarprasFoto).where(eq(sarprasFoto.id, Number(req.params.fotoId)));
        if (!foto[0]) { res.status(404).json({ error: 'Foto not found' }); return; }

        const filePath = foto[0].filePath || '';
        const normalizedPath = filePath.replace(/\\/g, '/');

        // 1. Check if file exists at exact path
        if (fs.existsSync(filePath)) {
            res.sendFile(path.resolve(filePath));
            return;
        }

        // 2. Check relative uploads path
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const uploadsIdx = normalizedPath.indexOf('uploads/');
        if (uploadsIdx >= 0) {
            const relPath = normalizedPath.substring(uploadsIdx);
            const localPath = path.resolve(relPath);
            if (fs.existsSync(localPath)) {
                res.sendFile(localPath);
                return;
            }
        }

        // 3. Try filename only in fotos folder
        const filename = path.basename(normalizedPath);
        const fotosPath = path.resolve(uploadDir, 'fotos', filename);
        if (fs.existsSync(fotosPath)) {
            res.sendFile(fotosPath);
            return;
        }

        // 4. If file is stored in Google Drive (path = gdrive://fileId)
        if (normalizedPath.startsWith('gdrive://')) {
            const { streamFromGDrive } = await import('./utils/googleDriveClient.js');
            const fileId = normalizedPath.replace('gdrive://', '');
            const gResult = await streamFromGDrive(fileId);
            if (gResult) {
                res.setHeader('Content-Type', gResult.mimeType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                gResult.stream.pipe(res);
                return;
            }
        }

        // 5. If NAS enabled, download from NAS and stream through server
        if (isNasEnabled() && normalizedPath.startsWith('/')) {
            const nasUrl = await getNasDownloadLink(normalizedPath);
            if (nasUrl) {
                try {
                    const nasRes = await fetch(nasUrl);
                    if (nasRes.ok && nasRes.body) {
                        const contentType = nasRes.headers.get('content-type') || 'image/jpeg';
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        const reader = nasRes.body.getReader();
                        const pump = async () => {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) { res.end(); break; }
                                res.write(value);
                            }
                        };
                        await pump();
                        return;
                    }
                } catch (nasErr) {
                    console.error('NAS stream error:', nasErr);
                }
            }
        }

        res.status(404).json({ error: 'File not found', path: filePath });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== GENERIC FILE PROXY HELPER =====
async function serveFileFromPath(filePath: string, res: any) {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // 1. Local file
    if (fs.existsSync(filePath)) {
        return res.sendFile(path.resolve(filePath));
    }

    // 2. Google Drive
    if (normalizedPath.startsWith('gdrive://')) {
        const { streamFromGDrive } = await import('./utils/googleDriveClient.js');
        const fileId = normalizedPath.replace('gdrive://', '');
        const gResult = await streamFromGDrive(fileId);
        if (gResult) {
            res.setHeader('Content-Type', gResult.mimeType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            gResult.stream.pipe(res);
            return;
        }
    }

    // 3. NAS
    if (isNasEnabled() && normalizedPath.startsWith('/')) {
        const nasUrl = await getNasDownloadLink(normalizedPath);
        if (nasUrl) {
            try {
                const nasRes = await fetch(nasUrl);
                if (nasRes.ok && nasRes.body) {
                    res.setHeader('Content-Type', nasRes.headers.get('content-type') || 'application/octet-stream');
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    const reader = nasRes.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) { res.end(); break; }
                        res.write(value);
                    }
                    return;
                }
            } catch { /* fall through */ }
        }
    }

    res.status(404).json({ error: 'File not found' });
}

// ===== KERUSAKAN FILE PROXY =====
app.get('/api/file/kerusakan/:id', async (req, res) => {
    try {
        const { formKerusakan } = await import('./db/schema/index.js');
        const result = await db.select().from(formKerusakan).where(eq(formKerusakan.id, Number(req.params.id)));
        if (!result[0] || !result[0].filePath) { res.status(404).json({ error: 'File not found' }); return; }
        await serveFileFromPath(result[0].filePath, res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PRESTASI SERTIFIKAT PROXY =====
app.get('/api/file/prestasi/:id', async (req, res) => {
    try {
        const { prestasi } = await import('./db/schema/index.js');
        const result = await db.select().from(prestasi).where(eq(prestasi.id, Number(req.params.id)));
        if (!result[0] || !result[0].sertifikatPath) { res.status(404).json({ error: 'File not found' }); return; }
        await serveFileFromPath(result[0].sertifikatPath, res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PROPOSAL FOTO PROXY =====
app.get('/api/file/proposal/:fotoId', async (req, res) => {
    try {
        const { proposalFoto } = await import('./db/schema/index.js');
        const result = await db.select().from(proposalFoto).where(eq(proposalFoto.id, Number(req.params.fotoId)));
        if (!result[0] || !result[0].filePath) { res.status(404).json({ error: 'File not found' }); return; }
        await serveFileFromPath(result[0].filePath, res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== PROPOSAL PDF PROXY =====
app.get('/api/file/proposal-doc/:id', async (req, res) => {
    try {
        const { proposal } = await import('./db/schema/index.js');
        const result = await db.select().from(proposal).where(eq(proposal.id, Number(req.params.id)));
        if (!result[0] || !result[0].filePath) { res.status(404).json({ error: 'File not found' }); return; }
        await serveFileFromPath(result[0].filePath, res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== TEMPLATE FILE PROXY =====
app.get('/api/file/template/:id', async (req, res) => {
    try {
        const { bastTemplate } = await import('./db/schema/index.js');
        const result = await db.select().from(bastTemplate).where(eq(bastTemplate.id, Number(req.params.id)));
        if (!result[0] || !result[0].filePath) { res.status(404).json({ error: 'File not found' }); return; }
        await serveFileFromPath(result[0].filePath, res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== QUEUE STATUS API =====
app.get('/api/queue/status', async (_req, res) => {
    try {
        const { sarprasFoto, formKerusakan, prestasi, proposal, proposalFoto } = await import('./db/schema/index.js');
        const { db: database } = await import('./db/index.js');
        const { eq, sql } = await import('drizzle-orm');

        const count = async (table: any, col: string) => {
            const uploading = await database.select({ count: sql<number>`count(*)` }).from(table).where(eq((table as any).uploadStatus, 'uploading'));
            const failed = await database.select({ count: sql<number>`count(*)` }).from(table).where(eq((table as any).uploadStatus, 'failed'));
            return { uploading: Number(uploading[0]?.count || 0), failed: Number(failed[0]?.count || 0) };
        };

        const [foto, kerusakan, prest, prop, propFoto] = await Promise.all([
            count(sarprasFoto, 'uploadStatus'),
            count(formKerusakan, 'uploadStatus'),
            count(prestasi, 'uploadStatus'),
            count(proposal, 'uploadStatus'),
            count(proposalFoto, 'uploadStatus'),
        ]);

        const totalUploading = foto.uploading + kerusakan.uploading + prest.uploading + prop.uploading + propFoto.uploading;
        const totalFailed = foto.failed + kerusakan.failed + prest.failed + prop.failed + propFoto.failed;

        res.json({
            totalUploading,
            totalFailed,
            details: { sarprasFoto: foto, kerusakan, prestasi: prest, proposal: prop, proposalFoto: propFoto },
        });
    } catch (e: any) { res.json({ totalUploading: 0, totalFailed: 0, error: e.message }); }
});

// ===== CUSTOM NPSN LOGIN (sekolah only, no password) =====
import { db } from './db/index.js';
import { sekolah, user, account, session as sessionTable } from './db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

app.post('/api/npsn-login', async (req, res) => {
    try {
        const { npsn, password } = req.body;
        if (!npsn || !password) {
            res.status(400).json({ error: 'NPSN dan Password wajib diisi' });
            return;
        }

        // Verify password matches NPSN
        if (password !== npsn) {
            res.status(401).json({ error: 'Password salah' });
            return;
        }

        // Find user by NPSN email
        const email = `${npsn}@spidol.cilacapkab.go.id`;
        const users = await db.select().from(user).where(eq(user.email, email));
        const foundUser = users[0];

        if (!foundUser) {
            res.status(401).json({ error: 'NPSN tidak ditemukan' });
            return;
        }

        if (!foundUser.aktif) {
            res.status(401).json({ error: 'Akun tidak aktif' });
            return;
        }

        // Create session directly
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionId = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(sessionTable).values({
            id: sessionId,
            token: sessionToken,
            userId: foundUser.id,
            expiresAt,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
        });

        // Set session cookie (same name Better Auth uses)
        res.cookie('better-auth.session_token', sessionToken, {
            httpOnly: true,
            secure: req.protocol === 'https',
            sameSite: 'lax',
            path: '/',
            expires: expiresAt,
        });

        // Return user info
        res.json({
            user: {
                id: foundUser.id,
                name: foundUser.name,
                email: foundUser.email,
                role: foundUser.role,
                sekolahId: foundUser.sekolahId,
            },
            session: {
                token: sessionToken,
                expiresAt,
            },
        });

        // Log login activity (fire-and-forget)
        try {
            const { aktivitasService } = await import('./services/aktivitas.service.js');
            await aktivitasService.log({
                userId: foundUser.id,
                namaAkun: foundUser.name || foundUser.email,
                jenisAkun: foundUser.role || 'Sekolah',
                aktivitas: 'Login',
                keterangan: `Login berhasil via NPSN ${npsn}`,
                ipAddress: req.ip || '',
            });
        } catch (_) { }
    } catch (e: any) {
        console.error('[NPSN Login Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// ===== CUSTOM SESSION CHECK (fallback for NPSN login sessions) =====
app.get('/api/check-session', async (req, res) => {
    try {
        // Try Better Auth first
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (session?.user) {
            res.json({ user: session.user, session: session.session });
            return;
        }

        // Fallback: check session table directly
        const cookieHeader = req.headers.cookie || '';
        const tokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
        if (tokenMatch) {
            const token = tokenMatch[1];
            const sessions = await db
                .select({
                    userId: sessionTable.userId,
                    expiresAt: sessionTable.expiresAt,
                    token: sessionTable.token,
                })
                .from(sessionTable)
                .where(eq(sessionTable.token, token));

            const s = sessions[0];
            if (s && new Date(s.expiresAt) > new Date()) {
                const users = await db.select().from(user).where(eq(user.id, s.userId));
                const u = users[0];
                if (u) {
                    res.json({
                        user: {
                            id: u.id,
                            name: u.name,
                            email: u.email,
                            role: u.role,
                            sekolahId: u.sekolahId,
                            aktif: u.aktif,
                        },
                        session: { token: s.token, expiresAt: s.expiresAt },
                    });
                    return;
                }
            }
        }

        res.status(401).json({ error: 'No session' });
    } catch (e: any) {
        res.status(401).json({ error: 'Invalid session' });
    }
});
// Mount Better Auth on /api/auth/*
app.all('/api/auth/*splat', toNodeHandler(auth));

// ===== API ROUTES =====
app.use('/api/sekolah', sekolahRoutes);
app.use('/api/sarpras', sarprasRoutes);
app.use('/api/proposal', proposalRoutes);
app.use('/api/proyeksi', proyeksiRoutes);
app.use('/api/matrik', matrikRoutes);
app.use('/api/pencairan', pencairanRoutes);
app.use('/api/bast', bastRoutes);
app.use('/api/template', templateRoutes);
app.use('/api/riwayat-bantuan', riwayatBantuanRoutes);
app.use('/api/prestasi', prestasiRoutes);
app.use('/api/form-kerusakan', kerusakanRoutes);
app.use('/api/korwil', korwilRoutes);
app.use('/api/pengguna', penggunaRoutes);
app.use('/api/aktivitas', aktivitasRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/iklan', iklanRoutes);

// ===== PUBLIC STATS (no auth required for login page) =====

app.get('/api/public-stats', async (_req, res) => {
    try {
        const sekolahUsersCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(eq(user.aktif, true));

        const userCount = Number(sekolahUsersCount[0]?.count || 0);

        const sekolahWithUsers = await db
            .selectDistinct({ sekolahId: user.sekolahId })
            .from(user)
            .where(eq(user.aktif, true));

        const validSekolahIds = sekolahWithUsers
            .map(r => r.sekolahId)
            .filter((id): id is number => id !== null && id !== undefined);

        const schoolCount = validSekolahIds.length;

        let jenjangBreakdown: Record<string, number> = {};
        if (validSekolahIds.length > 0) {
            const sekolahData = await db
                .select({ id: sekolah.id, jenjang: sekolah.jenjang })
                .from(sekolah);

            sekolahData.forEach(s => {
                if (validSekolahIds.includes(s.id) && s.jenjang) {
                    const j = s.jenjang;
                    jenjangBreakdown[j] = (jenjangBreakdown[j] || 0) + 1;
                }
            });
        }

        let kecamatanCount = 0;
        if (validSekolahIds.length > 0) {
            const kecData = await db
                .selectDistinct({ kecamatan: sekolah.kecamatan })
                .from(sekolah);
            const validKec = kecData.filter(r => r.kecamatan);
            kecamatanCount = validKec.length;
        }

        res.json({ schoolCount, userCount, kecamatanCount, jenjangBreakdown });
    } catch (e: any) {
        res.json({ schoolCount: 0, userCount: 0, kecamatanCount: 0, jenjangBreakdown: {} });
    }
});

// ===== ADMIN: RESET SEKOLAH PASSWORDS TO NPSN =====
app.post('/api/admin/reset-sekolah-passwords', requireAuth, requireRole('admin'), async (_req: any, res: any) => {
    try {
        // Get all sekolah records with their NPSN
        const sekolahList = await db.select().from(sekolah);

        const results: Array<{ name: string; npsn: string; success: boolean; error?: string }> = [];

        for (const sch of sekolahList) {
            try {
                if (!sch.npsn) {
                    results.push({ name: sch.nama || '?', npsn: '?', success: false, error: 'No NPSN' });
                    continue;
                }

                const email = `${sch.npsn}@spidol.cilacapkab.go.id`;

                // Check if user already exists with this email
                const existingUsers = await db.select().from(user).where(eq(user.email, email));
                const existing = existingUsers[0];

                if (existing) {
                    // Delete old user and account, then re-create
                    await db.delete(account).where(eq(account.userId, existing.id));
                    await db.delete(user).where(eq(user.id, existing.id));
                }

                // Create new user via Better Auth
                await auth.api.signUpEmail({
                    body: {
                        name: sch.nama || `Sekolah ${sch.npsn}`,
                        email,
                        password: sch.npsn,
                    },
                });

                // Manually update custom fields that Better Auth doesn't handle
                await db.update(user).set({
                    role: 'Sekolah',
                    sekolahId: sch.id,
                    aktif: true,
                }).where(eq(user.email, email));

                results.push({ name: sch.nama || '?', npsn: sch.npsn, success: true });
            } catch (e: any) {
                results.push({ name: sch.nama || '?', npsn: sch.npsn || '?', success: false, error: e.message });
            }
        }

        res.json({
            total: sekolahList.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== ADMIN: FIX SEKOLAH LINKS (repair sekolahId on existing users) =====
app.post('/api/admin/fix-sekolah-links', requireAuth, requireRole('admin'), async (_req: any, res: any) => {
    try {
        const sekolahList = await db.select().from(sekolah);
        let fixed = 0;

        for (const sch of sekolahList) {
            if (!sch.npsn) continue;
            const email = `${sch.npsn}@spidol.cilacapkab.go.id`;
            const result = await db.update(user).set({
                sekolahId: sch.id,
                role: 'Sekolah',
                aktif: true,
            }).where(eq(user.email, email)).returning();
            if (result.length > 0) fixed++;
        }

        res.json({ total: sekolahList.length, fixed });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== HEALTH CHECK =====
app.get('/api/health', async (req: any, res: any) => {
    const q = req.query.gdrive;
    if (q) {
        // GDrive test (localhost only)
        const ip = req.ip || req.socket?.remoteAddress || '';
        if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('::ffff:127.0.0.1')) {
            return res.status(403).json({ error: 'localhost only' });
        }
        try {
            const { google } = await import('googleapis');
            const cid = process.env.GDRIVE_CLIENT_ID || '';
            const cs = process.env.GDRIVE_CLIENT_SECRET || '';
            const rt = process.env.GDRIVE_REFRESH_TOKEN || '';
            const fid = process.env.GDRIVE_FOLDER_ID || '';
            if (!cid || !cs || !rt) {
                return res.json({ success: false, v: 2, msg: 'ENV missing', cid: !!cid, cs: !!cs, rt: !!rt });
            }
            const oauth2 = new google.auth.OAuth2(cid, cs, 'https://developers.google.com/oauthplayground');
            oauth2.setCredentials({ refresh_token: rt });
            const drive = google.drive({ version: 'v3', auth: oauth2 });
            const about = await drive.about.get({ fields: 'user' });
            const email = about.data.user?.emailAddress || 'unknown';
            let folderName = '';
            if (fid) {
                const f = await drive.files.get({ fileId: fid, fields: 'name' });
                folderName = f.data.name || '';
            }
            return res.json({ success: true, v: 2, email, folderName });
        } catch (e: any) {
            return res.json({ success: false, v: 2, msg: e.message });
        }
    }
    res.json({ status: 'ok', v: 2, timestamp: new Date().toISOString() });
});



// ===== ERROR HANDLER =====
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});



app.listen(PORT, () => {
    console.log(`🚀 SPIDOL API running at http://localhost:${PORT}`);
    console.log(`📦 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`💾 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔑 ENV GDRIVE:`, {
        CID: process.env.GDRIVE_CLIENT_ID ? 'SET' : 'EMPTY',
        CS: process.env.GDRIVE_CLIENT_SECRET ? 'SET' : 'EMPTY',
        RT: process.env.GDRIVE_REFRESH_TOKEN ? 'SET' : 'EMPTY',
        FID: process.env.GDRIVE_FOLDER_ID ? 'SET' : 'EMPTY',
    });
    // Start background GDrive upload queue
    import('./utils/uploadQueue.js').then(({ startUploadQueue }) => startUploadQueue());
});

export default app;
