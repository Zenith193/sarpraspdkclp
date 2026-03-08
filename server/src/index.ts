import 'dotenv/config';
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
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== ERROR HANDLER =====
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});

// ===== START =====
app.listen(PORT, () => {
    console.log(`🚀 SPIDOL API running at http://localhost:${PORT}`);
    console.log(`📦 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`💾 Health: http://localhost:${PORT}/api/health`);
});

export default app;
