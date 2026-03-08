import fs from 'fs';
import path from 'path';
import {
    ensureDir, type SekolahInfo, type SarprasInfo,
    getSarprasFotoPath, getProposalPath, getBastPath,
    getKerusakanPath, getPrestasiPath, getKopSekolahPath,
    getTemplatePath, getBackupPath
} from './storagePaths';

/**
 * ===================================================================
 * SYNOLOGY NAS CLIENT — FileStation API
 * ===================================================================
 * 
 * Connects to Synology NAS via DSM Web API (HTTPS/HTTP).
 * Handles authentication, folder creation, file upload, and file listing.
 * 
 * All uploaded files go DIRECTLY to NAS — VPS only holds files temporarily
 * during the multipart upload, then streams them to NAS and deletes local copy.
 * 
 * Required env vars:
 *   NAS_ENABLED=true
 *   NAS_HOST=192.168.1.100 or nas.example.com
 *   NAS_PORT=5001 (HTTPS) or 5000 (HTTP)
 *   NAS_PROTOCOL=https or http
 *   NAS_USERNAME=admin
 *   NAS_PASSWORD=password
 *   NAS_SHARED_FOLDER=/spidol  (shared folder name on NAS)
 */

// ==================== CONFIG ====================

interface NasConfig {
    enabled: boolean;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    username: string;
    password: string;
    sharedFolder: string;  // e.g. "/spidol"
}

function getConfig(): NasConfig {
    return {
        enabled: process.env.NAS_ENABLED === 'true',
        host: process.env.NAS_HOST || '',
        port: parseInt(process.env.NAS_PORT || '5001'),
        protocol: (process.env.NAS_PROTOCOL || 'https') as 'http' | 'https',
        username: process.env.NAS_USERNAME || '',
        password: process.env.NAS_PASSWORD || '',
        sharedFolder: process.env.NAS_SHARED_FOLDER || '/spidol',
    };
}

function getBaseUrl(): string {
    const cfg = getConfig();
    return `${cfg.protocol}://${cfg.host}:${cfg.port}`;
}

// ==================== AUTH ====================

let sessionId: string | null = null;

async function login(): Promise<string> {
    const cfg = getConfig();
    const url = `${getBaseUrl()}/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(cfg.username)}&passwd=${encodeURIComponent(cfg.password)}&format=sid`;

    const res = await fetch(url, {
        method: 'GET',
        // @ts-ignore - allow self-signed certs on NAS
    });
    const data = await res.json() as any;

    if (!data.success) {
        throw new Error(`NAS login failed: error code ${data.error?.code || 'unknown'}`);
    }

    sessionId = data.data.sid;
    console.log('✅ NAS: Logged in successfully');
    return sessionId!;
}

async function getSid(): Promise<string> {
    if (!sessionId) {
        return await login();
    }
    return sessionId;
}

async function logout(): Promise<void> {
    if (!sessionId) return;
    try {
        await fetch(`${getBaseUrl()}/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&_sid=${sessionId}`);
    } catch { /* ignore */ }
    sessionId = null;
}

// ==================== FILE OPERATIONS ====================

/**
 * Create a folder on the NAS.
 * folder_path: e.g. "/spidol/Cilacap_Selatan/SDN_1_12345678/sarpras/2020/R.Kelas_1"
 */
async function createFolder(folderPath: string, name: string): Promise<boolean> {
    const sid = await getSid();
    const url = `${getBaseUrl()}/webapi/entry.cgi`;

    const params = new URLSearchParams({
        api: 'SYNO.FileStation.CreateFolder',
        version: '2',
        method: 'create',
        folder_path: `["${folderPath}"]`,
        name: `["${name}"]`,
        force_parent: 'true',
        _sid: sid,
    });

    const res = await fetch(url, {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await res.json() as any;

    if (!data.success && data.error?.code !== 109) { // 109 = already exists
        console.warn(`NAS: Failed to create folder ${folderPath}/${name}:`, data.error);
        return false;
    }
    return true;
}

/**
 * Ensure a full path exists on NAS, creating each level as needed.
 * fullPath: e.g. "/spidol/Cilacap_Selatan/SDN_1_12345678/sarpras/2020/R.Kelas_1"
 */
async function ensureNasDir(fullPath: string): Promise<void> {
    const parts = fullPath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        const parent = '/' + (current || '');
        await createFolder(parent === '/' ? '/' : parent, part);
        current = current ? `${current}/${part}` : part;
    }
}

/**
 * Upload a file to NAS.
 * localFilePath: absolute path to the local temp file
 * nasDestFolder: NAS folder path, e.g. "/spidol/Cilacap/SDN_1/sarpras/2020/R.Kelas"
 * nasFilename: target filename on NAS
 */
async function uploadFile(localFilePath: string, nasDestFolder: string, nasFilename: string): Promise<{ success: boolean; path: string }> {
    const sid = await getSid();
    const url = `${getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Upload&version=2&method=upload&_sid=${sid}`;

    // Ensure destination folder exists
    await ensureNasDir(nasDestFolder);

    // Read file and create form data
    const fileBuffer = fs.readFileSync(localFilePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append('path', nasDestFolder);
    formData.append('create_parents', 'true');
    formData.append('overwrite', 'true');
    formData.append('file', blob, nasFilename);

    const res = await fetch(url, {
        method: 'POST',
        body: formData,
    });
    const data = await res.json() as any;

    if (!data.success) {
        console.error(`NAS: Upload failed for ${nasFilename}:`, data.error);
        return { success: false, path: '' };
    }

    const nasPath = `${nasDestFolder}/${nasFilename}`;
    console.log(`✅ NAS: Uploaded ${nasFilename} → ${nasPath}`);
    return { success: true, path: nasPath };
}

/**
 * Delete a local file after successful NAS upload.
 */
function deleteLocalFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }
}

// ==================== HIGH-LEVEL HELPERS ====================

/**
 * Build the NAS destination path from sekolah/sarpras info.
 * Maps the local storagePaths structure to NAS shared folder.
 */
function toNasPath(localRelPath: string): string {
    const cfg = getConfig();
    // Strip the local upload dir prefix, keep the hierarchical structure
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const rel = localRelPath.replace(uploadDir, '').replace(/\\/g, '/');
    return `${cfg.sharedFolder}${rel}`;
}

/**
 * Upload a file to NAS with full hierarchical path.
 * After upload, deletes the local temp copy.
 * Falls back to keeping file locally if NAS is disabled or upload fails.
 */
export async function uploadToNas(
    localFilePath: string,
    category: 'sarpras' | 'proposal' | 'bast' | 'kerusakan' | 'prestasi' | 'kop-sekolah' | 'template' | 'backup',
    sekolah?: SekolahInfo,
    extra?: { masaBangunan?: string; namaRuang?: string; tahun?: string },
): Promise<{ stored: 'nas' | 'local'; path: string }> {
    const cfg = getConfig();
    const filename = path.basename(localFilePath);

    // If NAS is disabled, keep file locally
    if (!cfg.enabled || !cfg.host) {
        return { stored: 'local', path: localFilePath };
    }

    try {
        // Build NAS destination path
        let nasFolder: string;
        if (category === 'template') {
            nasFolder = toNasPath(getTemplatePath());
        } else if (category === 'backup') {
            nasFolder = toNasPath(getBackupPath());
        } else if (sekolah) {
            switch (category) {
                case 'sarpras':
                    nasFolder = toNasPath(getSarprasFotoPath(sekolah, {
                        masaBangunan: extra?.masaBangunan,
                        namaRuang: extra?.namaRuang || 'unknown',
                    }));
                    break;
                case 'proposal':
                    nasFolder = toNasPath(getProposalPath(sekolah, extra?.tahun));
                    break;
                case 'bast':
                    nasFolder = toNasPath(getBastPath(sekolah));
                    break;
                case 'kerusakan':
                    nasFolder = toNasPath(getKerusakanPath(sekolah));
                    break;
                case 'prestasi':
                    nasFolder = toNasPath(getPrestasiPath(sekolah));
                    break;
                case 'kop-sekolah':
                    nasFolder = toNasPath(getKopSekolahPath(sekolah));
                    break;
                default:
                    nasFolder = `${cfg.sharedFolder}/lainnya`;
            }
        } else {
            nasFolder = `${cfg.sharedFolder}/${category}`;
        }

        // Upload to NAS
        const result = await uploadFile(localFilePath, nasFolder, filename);

        if (result.success) {
            // Delete local temp file to free VPS disk
            deleteLocalFile(localFilePath);
            return { stored: 'nas', path: result.path };
        }

        // Upload failed — keep local file as fallback
        console.warn('NAS upload failed, keeping file locally:', localFilePath);
        return { stored: 'local', path: localFilePath };

    } catch (err) {
        console.error('NAS upload error:', err);
        // Keep local file as fallback
        return { stored: 'local', path: localFilePath };
    }
}

/**
 * Get a file download link from NAS.
 * Returns a temporary download URL that can be served to the client.
 */
export async function getNasDownloadLink(nasFilePath: string): Promise<string | null> {
    const cfg = getConfig();
    if (!cfg.enabled) return null;

    try {
        const sid = await getSid();
        // Create a sharing link
        const url = `${getBaseUrl()}/webapi/entry.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Sharing',
            version: '3',
            method: 'create',
            path: `["${nasFilePath}"]`,
            _sid: sid,
        });

        const res = await fetch(url, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const data = await res.json() as any;

        if (data.success && data.data?.links?.[0]?.url) {
            return data.data.links[0].url;
        }

        // Fallback: direct download via API
        return `${getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(`["${nasFilePath}"]`)}&_sid=${sid}`;

    } catch (err) {
        console.error('NAS download link error:', err);
        return null;
    }
}

/**
 * Test NAS connection.
 */
export async function testNasConnection(): Promise<{
    success: boolean;
    message: string;
    model?: string;
    dsm?: string;
    diskTotal?: string;
    diskFree?: string;
}> {
    const cfg = getConfig();
    if (!cfg.host) {
        return { success: false, message: 'NAS host tidak dikonfigurasi' };
    }

    try {
        // Login
        await login();

        // Get NAS info
        const sid = await getSid();
        const infoUrl = `${getBaseUrl()}/webapi/entry.cgi?api=SYNO.DSM.Info&version=2&method=getinfo&_sid=${sid}`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json() as any;

        // Get disk usage
        const shareUrl = `${getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Info&version=2&method=get&_sid=${sid}`;
        const shareRes = await fetch(shareUrl);
        const shareData = await shareRes.json() as any;

        const model = infoData.data?.model || 'Unknown';
        const dsm = infoData.data?.version_string || 'Unknown';

        return {
            success: true,
            message: `Berhasil terhubung ke ${cfg.host}:${cfg.port}`,
            model,
            dsm,
        };

    } catch (err: any) {
        return {
            success: false,
            message: `Gagal terhubung: ${err.message || 'Connection refused'}`,
        };
    }
}

/**
 * Check if NAS storage is enabled.
 */
export function isNasEnabled(): boolean {
    return getConfig().enabled;
}

export { getConfig as getNasConfig, logout as nasLogout };

/**
 * List folders on NAS at a given path.
 * Used for the folder chooser in PengaturanNAS.
 */
export async function listNasSharedFolders(parentPath: string = '/'): Promise<Array<{ name: string; path: string; isDir: boolean }>> {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.host) {
        throw new Error('NAS not configured');
    }

    try {
        const sid = await getSid();
        const url = `${getBaseUrl()}/webapi/entry.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.List',
            version: '2',
            method: 'list',
            folder_path: parentPath,
            sort_by: 'name',
            sort_direction: 'asc',
            filetype: 'dir',
            _sid: sid,
        });

        const res = await fetch(`${url}?${params.toString()}`);
        const data = await res.json() as any;

        if (!data.success) {
            // Try listing shared folders at root
            if (parentPath === '/') {
                const shareParams = new URLSearchParams({
                    api: 'SYNO.FileStation.List',
                    version: '2',
                    method: 'list_share',
                    sort_by: 'name',
                    sort_direction: 'asc',
                    _sid: sid,
                });
                const shareRes = await fetch(`${url}?${shareParams.toString()}`);
                const shareData = await shareRes.json() as any;
                if (shareData.success && shareData.data?.shares) {
                    return shareData.data.shares.map((s: any) => ({
                        name: s.name,
                        path: s.path,
                        isDir: true,
                    }));
                }
            }
            return [];
        }

        return (data.data?.files || []).filter((f: any) => f.isdir).map((f: any) => ({
            name: f.name,
            path: f.path,
            isDir: true,
        }));
    } catch (err) {
        console.error('NAS folder listing error:', err);
        throw err;
    }
}
