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
                sharedFolder: saved.sharedFolder || '/spidol',
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
            sharedFolder: req.body.sharedFolder || '/spidol',
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

        console.log('[GDrive] Config:', {
            enabled: saved.enabled,
            clientId: saved.clientId ? 'SET' : 'EMPTY',
            clientSecret: saved.clientSecret ? 'SET' : 'EMPTY',
            refreshToken: saved.refreshToken ? 'SET' : 'EMPTY',
            folderId: saved.folderId || ''
        });

        setGDriveRuntimeConfig({
            enabled: saved.enabled ?? false,
            clientId: saved.clientId || '',
            clientSecret: saved.clientSecret || '',
            refreshToken: saved.refreshToken || '',
            folderId: saved.folderId || '',
        });
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
        const config = {
            enabled: req.body.enabled ?? false,
            clientId: req.body.clientId || '',
            clientSecret: req.body.clientSecret || '',
            refreshToken: req.body.refreshToken || '',
            folderId: req.body.folderId || '',
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

// Load configs from DB on module init
applyNasConfigFromDb().catch(() => { });
applyGDriveConfigFromDb().catch(() => { });

export default router;
