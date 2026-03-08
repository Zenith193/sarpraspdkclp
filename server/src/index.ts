import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// ===== BETTER AUTH HANDLER =====
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
import { db } from './db/index.js';
import { sekolah, user } from './db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

app.get('/api/public-stats', async (_req, res) => {
    try {
        // Count users with role 'sekolah' and aktif = true
        const sekolahUsers = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(eq(user.aktif, true));

        const userCount = Number(sekolahUsers[0]?.count || 0);

        // Count schools that have at least one aktif sekolah user
        const sekolahWithUsers = await db
            .selectDistinct({ sekolahId: user.sekolahId })
            .from(user)
            .where(eq(user.aktif, true));

        const validSekolahIds = sekolahWithUsers
            .map(r => r.sekolahId)
            .filter((id): id is number => id !== null && id !== undefined);

        const schoolCount = validSekolahIds.length;

        // Per-jenjang breakdown (from sekolah table filtered to registered schools)
        let jenjangBreakdown: Record<string, number> = {};
        if (validSekolahIds.length > 0) {
            const withJenjang = await db
                .select({ jenjang: sekolah.jenjang })
                .from(sekolah);

            const filtered = withJenjang.filter(r =>
                validSekolahIds.some(id => id !== null) && r.jenjang
            );

            // Count all schools with jenjang from ALL sekolah table (since we have the full table)
            // But only count those linked to users
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

        // Count distinct kecamatan from registered schools
        let kecamatanCount = 0;
        if (validSekolahIds.length > 0) {
            const kecData = await db
                .selectDistinct({ kecamatan: sekolah.kecamatan })
                .from(sekolah);
            const validKec = kecData.filter(r =>
                r.kecamatan
            );
            kecamatanCount = validKec.length;
        }

        res.json({ schoolCount, userCount, kecamatanCount, jenjangBreakdown });
    } catch (e: any) {
        res.json({ schoolCount: 0, userCount: 0, kecamatanCount: 0, jenjangBreakdown: {} });
    }
});

// ===== ADMIN: RESET SEKOLAH PASSWORDS TO NPSN =====
import { account } from './db/schema/index.js';

app.post('/api/admin/reset-sekolah-passwords', requireAuth, requireRole('admin'), async (_req: any, res: any) => {
    try {
        // Get all sekolah users with their NPSN
        const sekolahUsers = await db
            .select({
                userId: user.id,
                name: user.name,
                email: user.email,
                npsn: sekolah.npsn,
            })
            .from(user)
            .innerJoin(sekolah, eq(user.sekolahId, sekolah.id))
            .where(eq(user.role, 'sekolah'));

        const results: Array<{ name: string; npsn: string; success: boolean; error?: string }> = [];

        for (const su of sekolahUsers) {
            try {
                // Use Better Auth's internal password hash via ctx
                const hashFn = (auth as any).options?.hash?.password
                    || (auth as any).context?.password?.hash;

                let hashedPassword: string;

                if (hashFn) {
                    hashedPassword = await hashFn(su.npsn);
                } else {
                    // Fallback: use the same scrypt approach Better Auth uses internally
                    const { scrypt, randomBytes } = await import('crypto');
                    const { promisify } = await import('util');
                    const scryptAsync = promisify(scrypt);
                    const salt = randomBytes(16).toString('hex');
                    const derivedKey = (await scryptAsync(su.npsn, salt, 64)) as Buffer;
                    hashedPassword = `${salt}:${derivedKey.toString('hex')}`;
                }

                // Update the password in the account table
                await db
                    .update(account)
                    .set({ password: hashedPassword })
                    .where(
                        sql`${account.userId} = ${su.userId} AND ${account.providerId} = 'credential'`
                    );

                results.push({ name: su.name, npsn: su.npsn, success: true });
            } catch (e: any) {
                results.push({ name: su.name, npsn: su.npsn, success: false, error: e.message });
            }
        }

        res.json({
            total: sekolahUsers.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });
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
