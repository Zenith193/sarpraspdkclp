import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __gdriveFilename = fileURLToPath(import.meta.url);
const __gdriveDirname = path.dirname(__gdriveFilename);

/**
 * ===================================================================
 * GOOGLE DRIVE CLIENT (OAuth2)
 * ===================================================================
 *
 * Stores files in Google Drive using OAuth2 refresh token.
 * This works with consumer (free) Google accounts.
 *
 * Required:
 *   - Google Cloud project with Drive API enabled
 *   - OAuth2 Client ID + Client Secret
 *   - Refresh Token (generated via OAuth Playground)
 *   - Folder ID in Google Drive
 */

// ==================== CONFIG ====================

interface GDriveConfig {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    folderId: string;
}

let runtimeConfig: Partial<GDriveConfig> | null = null;
let driveClient: drive_v3.Drive | null = null;

export function setGDriveRuntimeConfig(config: Partial<GDriveConfig>) {
    runtimeConfig = config;
    driveClient = null; // Reset client so it re-initializes
}

// Cache for .env file values (parsed once, reused)
let envFileCache: Record<string, string> | null = null;

function readEnvFile(): Record<string, string> {
    if (envFileCache) return envFileCache;
    try {
        // Try multiple possible .env locations
        const candidates = [
            path.resolve(process.cwd(), '.env'),
            path.resolve(__gdriveDirname, '..', '.env'),
            '/var/www/sarpraspdkclp/server/.env',
        ];
        for (const envPath of candidates) {
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                const vars: Record<string, string> = {};
                content.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;
                    const eqIdx = trimmed.indexOf('=');
                    if (eqIdx > 0) {
                        vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
                    }
                });
                console.log(`[GDrive] Loaded .env fallback from: ${envPath} (${Object.keys(vars).length} vars)`);
                envFileCache = vars;
                return vars;
            }
        }
    } catch (e) { /* ignore */ }
    envFileCache = {};
    return {};
}

function getGDriveConfig(): GDriveConfig {
    // 1. Environment variables (loaded by dotenv or system)
    let clientId = process.env.GDRIVE_CLIENT_ID || '';
    let clientSecret = process.env.GDRIVE_CLIENT_SECRET || '';
    let refreshToken = process.env.GDRIVE_REFRESH_TOKEN || '';
    let folderId = process.env.GDRIVE_FOLDER_ID || '';

    // 2. If env vars missing, try direct .env file read (PM2 fallback)
    if (!clientId || !clientSecret || !refreshToken) {
        const envFile = readEnvFile();
        clientId = clientId || envFile['GDRIVE_CLIENT_ID'] || '';
        clientSecret = clientSecret || envFile['GDRIVE_CLIENT_SECRET'] || '';
        refreshToken = refreshToken || envFile['GDRIVE_REFRESH_TOKEN'] || '';
        folderId = folderId || envFile['GDRIVE_FOLDER_ID'] || '';
    }

    const envEnabled = clientId && clientSecret && refreshToken && folderId;

    if (envEnabled) {
        return {
            enabled: true,
            clientId,
            clientSecret,
            refreshToken,
            folderId,
        };
    }

    // 3. Fall back to runtime config (from DB)
    return {
        enabled: runtimeConfig?.enabled ?? false,
        clientId: runtimeConfig?.clientId || clientId,
        clientSecret: runtimeConfig?.clientSecret || clientSecret,
        refreshToken: runtimeConfig?.refreshToken || refreshToken,
        folderId: runtimeConfig?.folderId || folderId,
    };
}

export function isGDriveEnabled(): boolean {
    const cfg = getGDriveConfig();
    return cfg.enabled && !!cfg.clientId && !!cfg.clientSecret && !!cfg.refreshToken && !!cfg.folderId;
}

// ==================== AUTH ====================

function getDriveClient(): drive_v3.Drive {
    if (driveClient) return driveClient;

    const cfg = getGDriveConfig();
    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
        throw new Error('Google Drive OAuth2 credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
        cfg.clientId,
        cfg.clientSecret,
        'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
        refresh_token: cfg.refreshToken,
    });

    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    return driveClient;
}

// ==================== FOLDER OPERATIONS ====================

const folderCache = new Map<string, string>();

// Lock map to prevent parallel creation of same folder
const folderLocks = new Map<string, Promise<string>>();

async function findOrCreateFolder(parentId: string, folderName: string): Promise<string> {
    const cacheKey = `${parentId}/${folderName}`;
    if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

    // If another call is already creating this folder, wait for it
    if (folderLocks.has(cacheKey)) return folderLocks.get(cacheKey)!;

    // Create a promise that resolves when folder is found/created
    const promise = (async () => {
        // Double-check cache after acquiring "lock"
        if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

        const drive = getDriveClient();

        const res = await drive.files.list({
            q: `'${parentId}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1,
        });

        if (res.data.files && res.data.files.length > 0) {
            const id = res.data.files[0].id!;
            folderCache.set(cacheKey, id);
            return id;
        }

        const createRes = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            },
            fields: 'id',
        });

        const id = createRes.data.id!;
        folderCache.set(cacheKey, id);
        console.log(`[GDrive] Created folder: ${folderName} (${id})`);
        return id;
    })();

    folderLocks.set(cacheKey, promise);
    try {
        const result = await promise;
        return result;
    } finally {
        folderLocks.delete(cacheKey);
    }
}

// ==================== FOLDER RENAME / MOVE ====================

/**
 * Find an existing folder ID by traversing a path from the root folder.
 * Returns null if any segment doesn't exist.
 */
export async function findGDriveFolderByPath(folderPath: string): Promise<string | null> {
    if (!isGDriveEnabled()) return null;
    const cfg = getGDriveConfig();
    let currentId = cfg.folderId;
    const drive = getDriveClient();

    const parts = folderPath.split('/').filter(Boolean);
    for (const part of parts) {
        const cacheKey = `${currentId}/${part}`;
        if (folderCache.has(cacheKey)) {
            currentId = folderCache.get(cacheKey)!;
            continue;
        }
        const res = await drive.files.list({
            q: `'${currentId}' in parents and name='${part.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            pageSize: 1,
        });
        if (!res.data.files || res.data.files.length === 0) return null;
        currentId = res.data.files[0].id!;
        folderCache.set(cacheKey, currentId);
    }
    return currentId;
}

/**
 * Rename a Google Drive folder by ID.
 */
export async function renameGDriveFolder(folderId: string, newName: string): Promise<boolean> {
    try {
        const drive = getDriveClient();
        await drive.files.update({
            fileId: folderId,
            requestBody: { name: newName },
        });
        // Invalidate cache entries for old name
        folderCache.forEach((v, k) => { if (v === folderId) folderCache.delete(k); });
        console.log(`[GDrive] Renamed folder ${folderId} → ${newName}`);
        return true;
    } catch (err: any) {
        console.error('[GDrive] Rename failed:', err.message);
        return false;
    }
}

/**
 * Move a Google Drive folder to a new parent.
 */
export async function moveGDriveFolder(folderId: string, newParentId: string, oldParentId?: string): Promise<boolean> {
    try {
        const drive = getDriveClient();
        await drive.files.update({
            fileId: folderId,
            addParents: newParentId,
            removeParents: oldParentId || undefined,
        });
        // Invalidate cache
        folderCache.forEach((v, k) => { if (v === folderId) folderCache.delete(k); });
        console.log(`[GDrive] Moved folder ${folderId} to parent ${newParentId}`);
        return true;
    } catch (err: any) {
        console.error('[GDrive] Move failed:', err.message);
        return false;
    }
}

// Lock for ensureGDrivePath to serialize full path creation
const pathLocks = new Map<string, Promise<string>>();

export async function ensureGDrivePath(folderPath: string): Promise<string> {
    // Serialize calls for the same path
    if (pathLocks.has(folderPath)) return pathLocks.get(folderPath)!;

    const promise = (async () => {
        const cfg = getGDriveConfig();
        let currentId = cfg.folderId;

        const parts = folderPath.split('/').filter(Boolean);
        for (const part of parts) {
            currentId = await findOrCreateFolder(currentId, part);
        }

        return currentId;
    })();

    pathLocks.set(folderPath, promise);
    try {
        return await promise;
    } finally {
        pathLocks.delete(folderPath);
    }
}

// ==================== FILE OPERATIONS ====================

export async function uploadToGDrive(
    localFilePath: string,
    destFolderPath: string,
    filename?: string,
): Promise<{ success: boolean; fileId: string; path: string }> {
    const drive = getDriveClient();
    const finalName = filename || path.basename(localFilePath);

    try {
        const folderId = await ensureGDrivePath(destFolderPath);
        const fileStream = fs.createReadStream(localFilePath);
        const mimeType = getMimeType(finalName);

        const res = await drive.files.create({
            requestBody: {
                name: finalName,
                parents: [folderId],
            },
            media: {
                mimeType,
                body: fileStream,
            },
            fields: 'id, name',
        });

        const fileId = res.data.id!;
        console.log(`[GDrive] Uploaded: ${finalName} → ${fileId}`);

        return {
            success: true,
            fileId,
            path: `gdrive://${fileId}`,
        };

    } catch (err: any) {
        console.error('[GDrive] Upload failed:', err.message);
        return { success: false, fileId: '', path: '' };
    }
}

export async function streamFromGDrive(fileId: string): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
} | null> {
    try {
        const drive = getDriveClient();

        const meta = await drive.files.get({
            fileId,
            fields: 'name, mimeType',
        });

        const res = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' },
        );

        return {
            stream: res.data as unknown as Readable,
            mimeType: meta.data.mimeType || 'application/octet-stream',
            fileName: meta.data.name || 'file',
        };

    } catch (err: any) {
        console.error('[GDrive] Download failed:', err.message);
        return null;
    }
}

export async function listGDriveFolders(parentId?: string): Promise<Array<{ name: string; id: string }>> {
    const cfg = getGDriveConfig();
    const folderId = parentId || cfg.folderId;

    if (!folderId) throw new Error('Folder ID not configured');

    const drive = getDriveClient();

    const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'name',
        pageSize: 100,
    });

    return (res.data.files || []).map(f => ({
        name: f.name || '',
        id: f.id || '',
    }));
}

export async function testGDriveConnection(): Promise<{
    success: boolean;
    message: string;
    email?: string;
    folderName?: string;
    fileCount?: number;
}> {
    const cfg = getGDriveConfig();

    console.log('[GDrive TEST] getGDriveConfig result:', {
        enabled: cfg.enabled,
        clientId: cfg.clientId ? 'SET(' + cfg.clientId.slice(0, 8) + ')' : 'EMPTY',
        clientSecret: cfg.clientSecret ? 'SET' : 'EMPTY',
        refreshToken: cfg.refreshToken ? 'SET(' + cfg.refreshToken.slice(0, 10) + ')' : 'EMPTY',
        folderId: cfg.folderId || 'EMPTY',
    });
    console.log('[GDrive TEST] process.env check:', {
        CID: process.env.GDRIVE_CLIENT_ID ? 'SET' : 'EMPTY',
        CS: process.env.GDRIVE_CLIENT_SECRET ? 'SET' : 'EMPTY',
        RT: process.env.GDRIVE_REFRESH_TOKEN ? 'SET' : 'EMPTY',
        FID: process.env.GDRIVE_FOLDER_ID ? 'SET' : 'EMPTY',
    });
    console.log('[GDrive TEST] runtimeConfig:', {
        enabled: runtimeConfig?.enabled,
        clientId: runtimeConfig?.clientId ? 'SET' : 'EMPTY',
        clientSecret: runtimeConfig?.clientSecret ? 'SET' : 'EMPTY',
        refreshToken: runtimeConfig?.refreshToken ? 'SET' : 'EMPTY',
        folderId: runtimeConfig?.folderId || 'EMPTY',
    });

    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
        return { success: false, message: `Credentials belum dikonfigurasi (clientId=${!!cfg.clientId}, clientSecret=${!!cfg.clientSecret}, refreshToken=${!!cfg.refreshToken})` };
    }
    if (!cfg.folderId) {
        return { success: false, message: 'Folder ID belum dikonfigurasi' };
    }

    try {
        const drive = getDriveClient();

        // Get user info
        const about = await drive.about.get({ fields: 'user' });
        const email = about.data.user?.emailAddress || 'unknown';

        // Try to access the root folder
        const folder = await drive.files.get({
            fileId: cfg.folderId,
            fields: 'name, id',
        });

        // Count files in folder
        const files = await drive.files.list({
            q: `'${cfg.folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            pageSize: 1000,
        });

        return {
            success: true,
            message: `Berhasil terhubung ke Google Drive`,
            email,
            folderName: folder.data.name || 'Unknown',
            fileCount: files.data.files?.length || 0,
        };

    } catch (err: any) {
        const msg = err.message?.includes('notFound')
            ? 'Folder tidak ditemukan'
            : err.message?.includes('invalid_grant')
                ? 'Refresh token tidak valid — generate ulang di OAuth Playground'
                : err.message || 'Koneksi gagal';
        return { success: false, message: msg };
    }
}

// ==================== STORAGE INTEGRATION ====================

export async function uploadFileToGDrive(
    localFilePath: string,
    category: string,
    subPath: string,
): Promise<{ stored: 'gdrive' | 'local'; path: string }> {
    if (!isGDriveEnabled()) {
        return { stored: 'local', path: localFilePath };
    }

    try {
        const result = await uploadToGDrive(localFilePath, subPath);

        if (result.success) {
            try { fs.unlinkSync(localFilePath); } catch { /* ignore */ }
            return { stored: 'gdrive', path: result.path };
        }

        return { stored: 'local', path: localFilePath };

    } catch (err) {
        console.error('[GDrive] Upload error:', err);
        return { stored: 'local', path: localFilePath };
    }
}

// ==================== DELETE ====================

/**
 * Delete a file from Google Drive by its file ID.
 * Returns the parent folder ID (for cleanup) or null.
 */
export async function deleteFromGDrive(fileId: string): Promise<string | null> {
    try {
        const drive = getDriveClient();
        // Get parent folder before deleting
        const meta = await drive.files.get({ fileId, fields: 'parents' });
        const parentId = meta.data.parents?.[0] || null;
        await drive.files.delete({ fileId });
        console.log(`[GDrive] Deleted file: ${fileId}`);
        return parentId;
    } catch (err: any) {
        console.error('[GDrive] Delete failed:', err.message);
        return null;
    }
}

/**
 * Recursively delete empty parent folders up to the root GDrive folder.
 */
async function cleanupEmptyFolders(folderId: string | null): Promise<void> {
    if (!folderId) return;
    const config = getGDriveConfig();
    // Don't delete the root folder
    if (folderId === config.folderId) return;

    try {
        const drive = getDriveClient();
        // Check if folder is empty
        const list = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id)',
            pageSize: 1,
        });
        if (list.data.files && list.data.files.length > 0) return; // Not empty

        // Get parent before deleting
        const meta = await drive.files.get({ fileId: folderId, fields: 'parents' });
        const parentId = meta.data.parents?.[0] || null;

        await drive.files.delete({ fileId: folderId });
        console.log(`[GDrive] Deleted empty folder: ${folderId}`);
        folderCache.forEach((v, k) => { if (v === folderId) folderCache.delete(k); });

        // Recurse up
        await cleanupEmptyFolders(parentId);
    } catch (err: any) {
        console.error('[GDrive] Folder cleanup failed:', err.message);
    }
}

/**
 * Safe helper: delete a GDrive file from a path like "gdrive://fileId".
 * Also cleans up empty parent folders after deletion.
 */
export async function deleteGDriveFile(filePath: string | null | undefined): Promise<void> {
    if (!filePath || !filePath.startsWith('gdrive://') || !isGDriveEnabled()) return;
    const fileId = filePath.replace('gdrive://', '');
    const parentId = await deleteFromGDrive(fileId);
    // Clean up empty folders after file deletion
    await cleanupEmptyFolders(parentId);
}

// ==================== HELPERS ====================

function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
