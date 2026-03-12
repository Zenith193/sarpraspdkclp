// MUST be set before any HTTPS connections are made
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { getSarprasFotoPath, getProposalPath, getBastPath, getKerusakanPath, getPrestasiPath, getKopSekolahPath, getTemplatePath, getBackupPath } from './storagePaths';
// Runtime config override (set from settings DB)
let runtimeConfig = null;
export function setRuntimeConfig(config) {
    runtimeConfig = config;
    // Also set env vars so other parts of the code pick them up
    if (config.enabled !== undefined)
        process.env.NAS_ENABLED = config.enabled ? 'true' : 'false';
    if (config.host)
        process.env.NAS_HOST = config.host;
    if (config.port)
        process.env.NAS_PORT = String(config.port);
    if (config.protocol)
        process.env.NAS_PROTOCOL = config.protocol;
    if (config.username)
        process.env.NAS_USERNAME = config.username;
    if (config.password)
        process.env.NAS_PASSWORD = config.password;
    if (config.sharedFolder)
        process.env.NAS_SHARED_FOLDER = config.sharedFolder;
    if (config.quickConnectId)
        process.env.NAS_QUICKCONNECT_ID = config.quickConnectId;
    // Reset session and resolved URL so new credentials are used
    sessionId = null;
    resolvedBaseUrl = null;
}
function getConfig() {
    return {
        enabled: runtimeConfig?.enabled ?? (process.env.NAS_ENABLED === 'true'),
        host: runtimeConfig?.host ?? (process.env.NAS_HOST || ''),
        port: runtimeConfig?.port ?? parseInt(process.env.NAS_PORT || '5001'),
        protocol: runtimeConfig?.protocol ?? (process.env.NAS_PROTOCOL || 'https'),
        username: runtimeConfig?.username ?? (process.env.NAS_USERNAME || ''),
        password: runtimeConfig?.password ?? (process.env.NAS_PASSWORD || ''),
        sharedFolder: runtimeConfig?.sharedFolder ?? (process.env.NAS_SHARED_FOLDER || '/SARDIKA'),
        quickConnectId: runtimeConfig?.quickConnectId ?? (process.env.NAS_QUICKCONNECT_ID || ''),
    };
}
// ==================== QUICKCONNECT RESOLUTION ====================
let resolvedBaseUrl = null;
/**
 * Resolve QuickConnect ID to actual server URL.
 * Calls Synology's global relay API to find the relay/tunnel URL.
 */
async function resolveQuickConnect(qcId) {
    console.log(`[NAS] Resolving QuickConnect ID: ${qcId}`);
    try {
        // Step 1: Get server info from Synology global relay
        const serverInfoRes = await fetch('https://global.quickconnect.to/Serv.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: 1,
                command: 'get_server_info',
                stop_when_error: false,
                stop_when_success: false,
                id: 'dsm',
                serverID: qcId,
            }),
        });
        const serverInfo = await serverInfoRes.json();
        if (!serverInfo.errno && serverInfo.errno !== 0) {
            console.log('[NAS] QuickConnect server info:', JSON.stringify(serverInfo).substring(0, 300));
        }
        // Try relay URL first (most reliable for remote access)
        if (serverInfo.service?.relay_dn) {
            const relayHost = serverInfo.service.relay_dn;
            const relayPort = serverInfo.service.relay_port || 443;
            const relayUrl = `https://${relayHost}:${relayPort}`;
            console.log(`[NAS] Using relay: ${relayUrl}`);
            return relayUrl;
        }
        // Try tunnel
        if (serverInfo.service?.tunnel_dn) {
            const tunnelUrl = `https://${serverInfo.service.tunnel_dn}`;
            console.log(`[NAS] Using tunnel: ${tunnelUrl}`);
            return tunnelUrl;
        }
        // Try direct WAN access
        if (serverInfo.server?.external?.ip) {
            const extIp = serverInfo.server.external.ip;
            const extPort = serverInfo.server.external.port || 5001;
            const directUrl = `https://${extIp}:${extPort}`;
            console.log(`[NAS] Using direct WAN: ${directUrl}`);
            return directUrl;
        }
        // Try DDNS
        if (serverInfo.server?.ddns) {
            const ddnsUrl = `https://${serverInfo.server.ddns}:5001`;
            console.log(`[NAS] Using DDNS: ${ddnsUrl}`);
            return ddnsUrl;
        }
        // Fallback: use QuickConnect relay directly
        const fallbackUrl = `https://${qcId}.quickconnect.to`;
        console.log(`[NAS] Using fallback: ${fallbackUrl}`);
        return fallbackUrl;
    }
    catch (err) {
        console.error('[NAS] QuickConnect resolution failed:', err.message);
        // Fallback
        return `https://${qcId}.quickconnect.to`;
    }
}
/**
 * Get the base URL for NAS API calls.
 * If QuickConnect is configured, resolves and caches the URL.
 * Otherwise uses direct host:port.
 */
async function getBaseUrl() {
    const cfg = getConfig();
    // If QuickConnect ID is set, resolve it
    if (cfg.quickConnectId) {
        if (!resolvedBaseUrl) {
            resolvedBaseUrl = await resolveQuickConnect(cfg.quickConnectId);
        }
        return resolvedBaseUrl;
    }
    // Direct connection
    return `${cfg.protocol}://${cfg.host}:${cfg.port}`;
}
/**
 * Wrapper around fetch that handles self-signed certs for NAS.
 * Adds timeout and detailed error logging for debugging.
 */
async function nasFetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    try {
        console.log(`[NAS] Fetching: ${url.substring(0, 120)}...`);
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return res;
    }
    catch (err) {
        clearTimeout(timeout);
        // Add detailed error info for debugging
        const cfg = getConfig();
        const detail = err.cause ? ` (cause: ${err.cause.message || err.cause.code || JSON.stringify(err.cause)})` : '';
        console.error(`[NAS] Fetch failed to ${cfg.protocol}://${cfg.host}:${cfg.port}${detail}`);
        console.error(`[NAS] Error:`, err.message, err.code || '');
        throw new Error(`Koneksi ke NAS gagal (${cfg.host}:${cfg.port}): ${err.cause?.code || err.cause?.message || err.message}${detail ? ' - Pastikan hostname/IP, port, dan protocol sudah benar' : ''}`);
    }
}
// ==================== AUTH ====================
let sessionId = null;
async function login() {
    const cfg = getConfig();
    const url = `${await getBaseUrl()}/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(cfg.username)}&passwd=${encodeURIComponent(cfg.password)}&format=sid`;
    const res = await nasFetch(url, {
        method: 'GET',
        // @ts-ignore - allow self-signed certs on NAS
    });
    const data = await res.json();
    if (!data.success) {
        throw new Error(`NAS login failed: error code ${data.error?.code || 'unknown'}`);
    }
    sessionId = data.data.sid;
    console.log('✅ NAS: Logged in successfully');
    return sessionId;
}
async function getSid() {
    if (!sessionId) {
        return await login();
    }
    return sessionId;
}
async function logout() {
    if (!sessionId)
        return;
    try {
        await fetch(`${getBaseUrl()}/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&_sid=${sessionId}`);
    }
    catch { /* ignore */ }
    sessionId = null;
}
// ==================== FILE OPERATIONS ====================
/**
 * Create a folder on the NAS.
 * folder_path: e.g. "/SARDIKA/Cilacap_Selatan/SDN_1_12345678/sarpras/2020/R.Kelas_1"
 */
async function createFolder(folderPath, name) {
    const sid = await getSid();
    const url = `${await getBaseUrl()}/webapi/entry.cgi`;
    const params = new URLSearchParams({
        api: 'SYNO.FileStation.CreateFolder',
        version: '2',
        method: 'create',
        folder_path: `["${folderPath}"]`,
        name: `["${name}"]`,
        force_parent: 'true',
        _sid: sid,
    });
    const res = await nasFetch(url, {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await res.json();
    if (!data.success && data.error?.code !== 109) { // 109 = already exists
        console.warn(`NAS: Failed to create folder ${folderPath}/${name}:`, data.error);
        return false;
    }
    return true;
}
/**
 * Ensure a full path exists on NAS, creating each level as needed.
 * fullPath: e.g. "/SARDIKA/Cilacap_Selatan/SDN_1_12345678/sarpras/2020/R.Kelas_1"
 */
async function ensureNasDir(fullPath) {
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
 * nasDestFolder: NAS folder path, e.g. "/SARDIKA/Cilacap/SDN_1/sarpras/2020/R.Kelas"
 * nasFilename: target filename on NAS
 */
async function uploadFile(localFilePath, nasDestFolder, nasFilename) {
    const sid = await getSid();
    const url = `${await getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Upload&version=2&method=upload&_sid=${sid}`;
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
    const res = await nasFetch(url, {
        method: 'POST',
        body: formData,
    });
    const data = await res.json();
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
function deleteLocalFile(filePath) {
    try {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }
    catch { /* ignore */ }
}
// ==================== HIGH-LEVEL HELPERS ====================
/**
 * Build the NAS destination path from sekolah/sarpras info.
 * Maps the local storagePaths structure to NAS shared folder.
 */
function toNasPath(localRelPath) {
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
export async function uploadToNas(localFilePath, category, sekolah, extra) {
    const cfg = getConfig();
    const filename = path.basename(localFilePath);
    // If NAS is disabled, keep file locally
    if (!cfg.enabled || (!cfg.host && !cfg.quickConnectId)) {
        return { stored: 'local', path: localFilePath };
    }
    try {
        // Build NAS destination path
        let nasFolder;
        if (category === 'template') {
            nasFolder = toNasPath(getTemplatePath());
        }
        else if (category === 'backup') {
            nasFolder = toNasPath(getBackupPath());
        }
        else if (sekolah) {
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
        }
        else {
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
    }
    catch (err) {
        console.error('NAS upload error:', err);
        // Keep local file as fallback
        return { stored: 'local', path: localFilePath };
    }
}
/**
 * Get a file download link from NAS.
 * Returns a temporary download URL that can be served to the client.
 */
export async function getNasDownloadLink(nasFilePath) {
    const cfg = getConfig();
    if (!cfg.enabled)
        return null;
    try {
        const sid = await getSid();
        // Create a sharing link
        const url = `${await getBaseUrl()}/webapi/entry.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Sharing',
            version: '3',
            method: 'create',
            path: `["${nasFilePath}"]`,
            _sid: sid,
        });
        const res = await nasFetch(url, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const data = await res.json();
        if (data.success && data.data?.links?.[0]?.url) {
            return data.data.links[0].url;
        }
        // Fallback: direct download via API
        return `${await getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(`["${nasFilePath}"]`)}&_sid=${sid}`;
    }
    catch (err) {
        console.error('NAS download link error:', err);
        return null;
    }
}
/**
 * Test NAS connection.
 */
export async function testNasConnection() {
    const cfg = getConfig();
    if (!cfg.host && !cfg.quickConnectId) {
        return { success: false, message: 'NAS host atau QuickConnect ID belum dikonfigurasi' };
    }
    try {
        // Login
        await login();
        // Get NAS info
        const sid = await getSid();
        const infoUrl = `${await getBaseUrl()}/webapi/entry.cgi?api=SYNO.DSM.Info&version=2&method=getinfo&_sid=${sid}`;
        const infoRes = await nasFetch(infoUrl);
        const infoData = await infoRes.json();
        // Get disk usage
        const shareUrl = `${await getBaseUrl()}/webapi/entry.cgi?api=SYNO.FileStation.Info&version=2&method=get&_sid=${sid}`;
        const shareRes = await nasFetch(shareUrl);
        const shareData = await shareRes.json();
        const model = infoData.data?.model || 'Unknown';
        const dsm = infoData.data?.version_string || 'Unknown';
        return {
            success: true,
            message: `Berhasil terhubung ke NAS${cfg.quickConnectId ? ` (QuickConnect: ${cfg.quickConnectId})` : ` (${cfg.host}:${cfg.port})`}`,
            model,
            dsm,
        };
    }
    catch (err) {
        return {
            success: false,
            message: `Gagal terhubung: ${err.message || 'Connection refused'}`,
        };
    }
}
/**
 * Check if NAS storage is enabled.
 */
export function isNasEnabled() {
    return getConfig().enabled;
}
export { getConfig as getNasConfig, logout as nasLogout };
/**
 * List folders on NAS at a given path.
 * Used for the folder chooser in PengaturanNAS.
 */
export async function listNasSharedFolders(parentPath = '/') {
    const cfg = getConfig();
    if (!cfg.enabled || (!cfg.host && !cfg.quickConnectId)) {
        throw new Error('NAS not configured');
    }
    try {
        const sid = await getSid();
        const url = `${await getBaseUrl()}/webapi/entry.cgi`;
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
        const res = await nasFetch(`${url}?${params.toString()}`);
        const data = await res.json();
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
                const shareRes = await nasFetch(`${url}?${shareParams.toString()}`);
                const shareData = await shareRes.json();
                if (shareData.success && shareData.data?.shares) {
                    return shareData.data.shares.map((s) => ({
                        name: s.name,
                        path: s.path,
                        isDir: true,
                    }));
                }
            }
            return [];
        }
        return (data.data?.files || []).filter((f) => f.isdir).map((f) => ({
            name: f.name,
            path: f.path,
            isDir: true,
        }));
    }
    catch (err) {
        console.error('NAS folder listing error:', err);
        throw err;
    }
}
