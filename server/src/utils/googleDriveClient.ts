import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * ===================================================================
 * GOOGLE DRIVE CLIENT
 * ===================================================================
 *
 * Stores files in Google Drive using a Service Account.
 * Files are organized in a folder hierarchy mirroring the local structure.
 *
 * Required:
 *   - Google Cloud project with Drive API enabled
 *   - Service Account JSON key
 *   - Shared folder in Google Drive (shared with service account email)
 */

// ==================== CONFIG ====================

interface GDriveConfig {
    enabled: boolean;
    credentials: any;      // Service Account JSON key contents
    folderId: string;       // Root folder ID in Google Drive
}

let runtimeConfig: Partial<GDriveConfig> | null = null;
let driveClient: drive_v3.Drive | null = null;

export function setGDriveRuntimeConfig(config: Partial<GDriveConfig>) {
    runtimeConfig = config;
    driveClient = null; // Reset client so it re-initializes
}

function getGDriveConfig(): GDriveConfig {
    return {
        enabled: runtimeConfig?.enabled ?? false,
        credentials: runtimeConfig?.credentials ?? null,
        folderId: runtimeConfig?.folderId ?? '',
    };
}

export function isGDriveEnabled(): boolean {
    const cfg = getGDriveConfig();
    return cfg.enabled && !!cfg.credentials && !!cfg.folderId;
}

// ==================== AUTH ====================

function getDriveClient(): drive_v3.Drive {
    if (driveClient) return driveClient;

    const cfg = getGDriveConfig();
    if (!cfg.credentials) {
        throw new Error('Google Drive credentials not configured');
    }

    let creds = cfg.credentials;
    if (typeof creds === 'string') {
        try { creds = JSON.parse(creds); } catch { throw new Error('Invalid JSON credentials'); }
    }

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
}

// ==================== FOLDER OPERATIONS ====================

// Cache folder IDs to avoid repeated API calls
const folderCache = new Map<string, string>();

/**
 * Find or create a folder inside a parent folder.
 */
async function findOrCreateFolder(parentId: string, folderName: string): Promise<string> {
    const cacheKey = `${parentId}/${folderName}`;
    if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

    const drive = getDriveClient();

    // Search for existing folder
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

    // Create folder
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
}

/**
 * Ensure a full path exists in Google Drive, creating folders as needed.
 * Returns the ID of the deepest folder.
 *
 * Example: ensureGDrivePath("Cilacap_Selatan/SDN_1/sarpras/2020")
 *          → creates each folder level and returns leaf folder ID
 */
async function ensureGDrivePath(folderPath: string): Promise<string> {
    const cfg = getGDriveConfig();
    let currentId = cfg.folderId;

    const parts = folderPath.split('/').filter(Boolean);
    for (const part of parts) {
        currentId = await findOrCreateFolder(currentId, part);
    }

    return currentId;
}

// ==================== FILE OPERATIONS ====================

/**
 * Upload a file to Google Drive.
 */
export async function uploadToGDrive(
    localFilePath: string,
    destFolderPath: string,
    filename?: string,
): Promise<{ success: boolean; fileId: string; path: string }> {
    const drive = getDriveClient();
    const finalName = filename || path.basename(localFilePath);

    try {
        // Ensure destination folder exists
        const folderId = await ensureGDrivePath(destFolderPath);

        // Upload file
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

/**
 * Download a file from Google Drive and stream it to an Express response.
 */
export async function streamFromGDrive(fileId: string): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
} | null> {
    try {
        const drive = getDriveClient();

        // Get file metadata
        const meta = await drive.files.get({
            fileId,
            fields: 'name, mimeType',
        });

        // Download file content
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

/**
 * List folders in Google Drive at a given parent folder.
 */
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

/**
 * Test Google Drive connection.
 */
export async function testGDriveConnection(): Promise<{
    success: boolean;
    message: string;
    email?: string;
    folderName?: string;
    fileCount?: number;
}> {
    const cfg = getGDriveConfig();

    if (!cfg.credentials) {
        return { success: false, message: 'Credentials belum dikonfigurasi' };
    }
    if (!cfg.folderId) {
        return { success: false, message: 'Folder ID belum dikonfigurasi' };
    }

    try {
        const drive = getDriveClient();

        // Check service account email
        let creds = cfg.credentials;
        if (typeof creds === 'string') creds = JSON.parse(creds);
        const email = creds.client_email || 'unknown';

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
            ? 'Folder tidak ditemukan atau belum di-share ke service account'
            : err.message?.includes('invalid_grant')
                ? 'Credentials tidak valid'
                : err.message || 'Koneksi gagal';
        return { success: false, message: msg };
    }
}

// ==================== STORAGE INTEGRATION ====================

/**
 * Upload a file to Google Drive with hierarchical path.
 * Called by the upload middleware as an alternative to NAS.
 */
export async function uploadFileToGDrive(
    localFilePath: string,
    category: string,
    subPath: string,
): Promise<{ stored: 'gdrive' | 'local'; path: string }> {
    if (!isGDriveEnabled()) {
        return { stored: 'local', path: localFilePath };
    }

    try {
        const destPath = `${category}/${subPath}`.replace(/\/+/g, '/');
        const result = await uploadToGDrive(localFilePath, destPath);

        if (result.success) {
            // Delete local temp file
            try { fs.unlinkSync(localFilePath); } catch { /* ignore */ }
            return { stored: 'gdrive', path: result.path };
        }

        return { stored: 'local', path: localFilePath };

    } catch (err) {
        console.error('[GDrive] Upload error:', err);
        return { stored: 'local', path: localFilePath };
    }
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
