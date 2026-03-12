import { Router } from 'express';
import { settingsService } from '../services/settings.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { testNasConnection, isNasEnabled, listNasSharedFolders, setRuntimeConfig } from '../utils/nasClient.js';

const router = Router();

// ===== ACCESS CONFIG =====
router.get('/access', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.get('access_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/access', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await settingsService.set('access_config', req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/access/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('access_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== COUNTDOWN =====
router.get('/countdown', requireAuth, async (_req, res) => {
    try { res.json(await settingsService.get('countdown')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/countdown', requireAuth, requireRole('admin'), async (req, res) => {
    try { res.json(await settingsService.set('countdown', req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/countdown/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('countdown')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== HELPER: load NAS config from DB and apply to runtime =====
async function applyNasConfigFromDb() {
    try {
        const saved = await settingsService.get('nas_config');
        if (saved && typeof saved === 'object') {
            setRuntimeConfig({
                enabled: saved.enabled ?? false,
                host: saved.hostname || saved.host || '',
                port: saved.port ? Number(saved.port) : 5001,
                protocol: saved.protocol || 'https',
                username: saved.username || '',
                password: saved.password || '',
                sharedFolder: saved.sharedFolder || '/SARDIKA',
                quickConnectId: saved.quickConnectId || '',
            });
        }
    } catch { /* ignore if no config saved yet */ }
}

// ===== NAS CONFIG =====
router.get('/nas', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const config = await settingsService.get('nas_config');
        res.json({ ...config, nasEnabled: isNasEnabled() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/nas', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await settingsService.set('nas_config', req.body);
        // Apply to runtime immediately so test/upload uses new config
        setRuntimeConfig({
            enabled: req.body.enabled ?? false,
            host: req.body.hostname || req.body.host || '',
            port: req.body.port ? Number(req.body.port) : 5001,
            protocol: req.body.protocol || 'https',
            username: req.body.username || '',
            password: req.body.password || '',
            sharedFolder: req.body.sharedFolder || '/SARDIKA',
            quickConnectId: req.body.quickConnectId || '',
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/nas/test', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        // Ensure runtime config is loaded from DB
        await applyNasConfigFromDb();
        const result = await testNasConnection();
        res.json(result);
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/nas/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try { res.json(await settingsService.reset('nas_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== NAS FOLDER LISTING (for folder chooser) =====
router.get('/nas/folders', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await applyNasConfigFromDb();
        const parentPath = (req.query.path as string) || '/';
        const folders = await listNasSharedFolders(parentPath);
        res.json({ success: true, folders });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message, folders: [] }); }
});

// ===== GOOGLE DRIVE CONFIG =====
import { setGDriveRuntimeConfig, testGDriveConnection, listGDriveFolders, isGDriveEnabled } from '../utils/googleDriveClient.js';

async function applyGDriveConfigFromDb() {
    try {
        const saved = await settingsService.get('gdrive_config');
        if (!saved || typeof saved !== 'object') {
            console.log('[GDrive] No config in DB');
            return;
        }

        // Auto-migrate: old Service Account format has 'credentials' but no 'clientId'
        if (saved.credentials && !saved.clientId) {
            console.log('[GDrive] Old Service Account format detected — auto-resetting to OAuth2 format');
            const fresh = { enabled: false, clientId: '', clientSecret: '', refreshToken: '', folderId: saved.folderId || '' };
            await settingsService.set('gdrive_config', fresh);
            setGDriveRuntimeConfig(fresh);
            return;
        }

        // Merge: env vars take priority over DB values
        const envCid = process.env.GDRIVE_CLIENT_ID || '';
        const envCs = process.env.GDRIVE_CLIENT_SECRET || '';
        const envRt = process.env.GDRIVE_REFRESH_TOKEN || '';
        const envFid = process.env.GDRIVE_FOLDER_ID || '';

        const merged = {
            enabled: (envCid && envCs && envRt && envFid) ? true : (saved.enabled ?? false),
            clientId: envCid || saved.clientId || '',
            clientSecret: envCs || saved.clientSecret || '',
            refreshToken: envRt || saved.refreshToken || '',
            folderId: envFid || saved.folderId || '',
        };

        console.log('[GDrive] Config:', {
            enabled: merged.enabled,
            clientId: merged.clientId ? 'SET' : 'EMPTY',
            clientSecret: merged.clientSecret ? 'SET' : 'EMPTY',
            refreshToken: merged.refreshToken ? 'SET' : 'EMPTY',
            folderId: merged.folderId || '',
            source: envCid ? 'ENV+DB' : 'DB',
        });

        setGDriveRuntimeConfig(merged);
    } catch (e) { console.error('[GDrive] applyConfig error:', e); }
}

router.get('/gdrive', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const config = await settingsService.get('gdrive_config');
        const safe = config ? {
            enabled: config.enabled ?? false,
            folderId: config.folderId || '',
            clientId: config.clientId || '',
            hasRefreshToken: !!config.refreshToken,
            gdriveEnabled: isGDriveEnabled(),
        } : { enabled: false, folderId: '', clientId: '', hasRefreshToken: false, gdriveEnabled: false };
        res.json(safe);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/gdrive', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        console.log('[GDrive] PUT body keys:', Object.keys(req.body));

        // Load existing config to preserve secrets the frontend doesn't send back
        const existing = await settingsService.get('gdrive_config') || {};

        const config = {
            enabled: req.body.enabled ?? false,
            clientId: req.body.clientId || existing.clientId || '',
            clientSecret: req.body.clientSecret?.trim() || existing.clientSecret || '',
            refreshToken: req.body.refreshToken?.trim() || existing.refreshToken || '',
            folderId: req.body.folderId || existing.folderId || '',
        };
        console.log('[GDrive] Saving:', { ...config, clientSecret: config.clientSecret ? 'SET' : 'EMPTY', refreshToken: config.refreshToken ? 'SET' : 'EMPTY' });

        const result = await settingsService.set('gdrive_config', config);
        setGDriveRuntimeConfig(config);
        console.log('[GDrive] Saved! isEnabled:', isGDriveEnabled());
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/gdrive/test', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        await applyGDriveConfigFromDb();
        const result = await testGDriveConnection();
        res.json(result);
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

// Localhost-only debug endpoint — no auth required
router.get('/gdrive/debug-test', async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('::ffff:127.0.0.1')) {
        return res.status(403).json({ error: 'localhost only' });
    }
    try {
        console.log('[GDrive DEBUG-TEST] Starting...');
        await applyGDriveConfigFromDb();
        console.log('[GDrive DEBUG-TEST] Config applied, calling testGDriveConnection...');
        const result = await testGDriveConnection();
        console.log('[GDrive DEBUG-TEST] Result:', JSON.stringify(result));
        res.json(result);
    } catch (e: any) {
        console.error('[GDrive DEBUG-TEST] CRASH:', e.message, e.stack);
        res.status(500).json({ success: false, message: e.message, stack: e.stack });
    }
});

router.get('/gdrive/folders', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await applyGDriveConfigFromDb();
        const parentId = (req.query.parentId as string) || '';
        const folders = await listGDriveFolders(parentId || undefined);
        res.json({ success: true, folders });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message, folders: [] }); }
});

router.post('/gdrive/reset', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const fresh = { enabled: false, clientId: '', clientSecret: '', refreshToken: '', folderId: '' };
        res.json(await settingsService.set('gdrive_config', fresh));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== LOCALHOST-ONLY SETUP (no auth — for initial VPS config via curl) =====
router.post('/gdrive/setup', async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('::ffff:127.0.0.1')) {
        return res.status(403).json({ error: 'Only accessible from localhost' });
    }
    try {
        const config = {
            enabled: req.body.enabled ?? true,
            clientId: req.body.clientId || '',
            clientSecret: req.body.clientSecret || '',
            refreshToken: req.body.refreshToken || '',
            folderId: req.body.folderId || '',
        };
        console.log('[GDrive] SETUP from localhost');
        await settingsService.set('gdrive_config', config);
        setGDriveRuntimeConfig(config);
        const testResult = await testGDriveConnection();
        res.json({ saved: true, test: testResult, isEnabled: isGDriveEnabled() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== RANKING PRIORITAS (stored per kecamatan-jenjang) =====
// Lock is stored as a map: { locks: { "all": true, "SD": true, "Adipala": true, "SD_Adipala": true, ... } }
router.get('/ranking/lock', requireAuth, async (_req, res) => {
    try {
        const val = await settingsService.get('ranking_lock');
        res.json(val || { locks: {} });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/ranking/lock', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        // Load existing locks
        const existing = await settingsService.get('ranking_lock') || { locks: {} };
        const locks = existing.locks || {};
        // req.body: { key: "all"|"SD"|"Adipala"|"SD_Adipala", locked: true/false }
        const key = req.body.key || 'all';
        if (req.body.locked) {
            locks[key] = true;
        } else {
            delete locks[key];
        }
        res.json(await settingsService.set('ranking_lock', { locks }));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get ranking for a specific kecamatan+jenjang combo
router.get('/ranking/data', requireAuth, async (req, res) => {
    try {
        const kec = (req.query.kecamatan as string) || 'all';
        const jen = (req.query.jenjang as string) || 'all';
        const key = `ranking_${kec}_${jen}`;
        const val = await settingsService.get(key);
        res.json(val || { items: [] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Save ranking for a specific kecamatan+jenjang combo
router.put('/ranking/data', requireAuth, async (req, res) => {
    try {
        const kec = (req.query.kecamatan as string) || req.body.kecamatan || 'all';
        const jen = (req.query.jenjang as string) || req.body.jenjang || 'all';
        const key = `ranking_${kec}_${jen}`;
        const data = { items: req.body.items || [], updatedBy: req.user?.id, updatedAt: new Date().toISOString() };
        res.json(await settingsService.set(key, data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Load configs from DB on module init
applyNasConfigFromDb().catch(() => { });
applyGDriveConfigFromDb().catch(() => { });

export default router;
