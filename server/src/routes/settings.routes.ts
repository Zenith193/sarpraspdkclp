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
        if (saved && typeof saved === 'object') {
            setGDriveRuntimeConfig({
                enabled: saved.enabled ?? false,
                clientId: saved.clientId || '',
                clientSecret: saved.clientSecret || '',
                refreshToken: saved.refreshToken || '',
                folderId: saved.folderId || '',
            });
        }
    } catch { /* ignore */ }
}

router.get('/gdrive', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const config = await settingsService.get('gdrive_config');
        const safe = config ? {
            enabled: config.enabled,
            folderId: config.folderId,
            clientId: config.clientId || '',
            hasRefreshToken: !!config.refreshToken,
            gdriveEnabled: isGDriveEnabled(),
        } : { enabled: false, folderId: '', clientId: '', hasRefreshToken: false, gdriveEnabled: false };
        res.json(safe);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/gdrive', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        // Merge with existing config (don't lose refreshToken if not sent)
        const existing = await settingsService.get('gdrive_config') || {};
        const config = {
            enabled: req.body.enabled ?? existing.enabled ?? false,
            clientId: req.body.clientId || existing.clientId || '',
            clientSecret: req.body.clientSecret || existing.clientSecret || '',
            refreshToken: req.body.refreshToken || existing.refreshToken || '',
            folderId: req.body.folderId || existing.folderId || '',
        };

        const result = await settingsService.set('gdrive_config', config);
        setGDriveRuntimeConfig(config);
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
    try { res.json(await settingsService.reset('gdrive_config')); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Load configs from DB on module init
applyNasConfigFromDb().catch(() => { });
applyGDriveConfigFromDb().catch(() => { });

export default router;
