import { db } from '../db/index.js';
import { appSettings } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

// Default configs matching frontend settingsStore.js
const DEFAULTS: Record<string, any> = {
    access_config: {
        admin: ['dashboard', 'data-sarpras', 'proposal', 'proyeksi-anggaran', 'aktivitas', 'manajemen-pengguna', 'manajemen-template', 'riwayat-bantuan', 'matriks-kegiatan', 'create-bast', 'pencairan', 'manajemen-korwil', 'form-kerusakan', 'prestasi', 'verifikasi-sarpras', 'verifikasi-proposal', 'ranking', 'hak-akses', 'pengaturan-nas', 'countdown-settings'],
        verifikator: ['dashboard', 'data-sarpras', 'proposal', 'verifikasi-sarpras', 'verifikasi-proposal', 'ranking', 'riwayat-bantuan', 'manajemen-template', 'matriks-kegiatan', 'create-bast', 'pencairan', 'form-kerusakan', 'prestasi'],
        korwil: ['dashboard', 'verifikasi-sarpras', 'verifikasi-proposal', 'ranking', 'data-sarpras', 'proposal', 'riwayat-bantuan', 'form-kerusakan'],
        sekolah: ['dashboard', 'data-sarpras', 'proposal', 'riwayat-bantuan', 'prestasi', 'form-kerusakan'],
    },
    countdown: { enabled: false, deadline: '', label: 'Batas Akhir Input Data Sarpras', affectedRoles: ['sekolah', 'korwil', 'verifikator'], restrictedActions: ['tambah', 'edit', 'hapus'] },
    nas_config: { enabled: false, hostname: '', port: 5000, protocol: 'https', username: '', password: '', folders: { fotoSarpras: '/SarprasData/foto/', dokumenBAST: '/SarprasData/bast/', backupDB: '/SarprasData/backup/', template: '/SarprasData/template/', formKerusakan: '/SarprasData/form-kerusakan/' } },
    gdrive_config: { enabled: false, clientId: '', clientSecret: '', refreshToken: '', folderId: '' },
};

export const settingsService = {
    async get(key: string) {
        const r = await db.select().from(appSettings).where(eq(appSettings.key, key));
        return r[0]?.value || DEFAULTS[key] || null;
    },

    async set(key: string, value: any) {
        const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
        if (existing[0]) {
            return db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key)).returning();
        }
        return db.insert(appSettings).values({ key, value }).returning();
    },

    async reset(key: string) {
        const defaultValue = DEFAULTS[key];
        if (!defaultValue) return null;
        return this.set(key, defaultValue);
    },
};
