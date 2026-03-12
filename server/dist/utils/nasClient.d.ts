import { type SekolahInfo } from './storagePaths';
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
 *   NAS_SHARED_FOLDER=/SARDIKA  (shared folder name on NAS)
 */
interface NasConfig {
    enabled: boolean;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    username: string;
    password: string;
    sharedFolder: string;
    quickConnectId?: string;
}
export declare function setRuntimeConfig(config: Partial<NasConfig>): void;
declare function getConfig(): NasConfig;
declare function logout(): Promise<void>;
/**
 * Upload a file to NAS with full hierarchical path.
 * After upload, deletes the local temp copy.
 * Falls back to keeping file locally if NAS is disabled or upload fails.
 */
export declare function uploadToNas(localFilePath: string, category: 'sarpras' | 'proposal' | 'bast' | 'kerusakan' | 'prestasi' | 'kop-sekolah' | 'template' | 'backup', sekolah?: SekolahInfo, extra?: {
    masaBangunan?: string;
    namaRuang?: string;
    tahun?: string;
}): Promise<{
    stored: 'nas' | 'local';
    path: string;
}>;
/**
 * Get a file download link from NAS.
 * Returns a temporary download URL that can be served to the client.
 */
export declare function getNasDownloadLink(nasFilePath: string): Promise<string | null>;
/**
 * Test NAS connection.
 */
export declare function testNasConnection(): Promise<{
    success: boolean;
    message: string;
    model?: string;
    dsm?: string;
    diskTotal?: string;
    diskFree?: string;
}>;
/**
 * Check if NAS storage is enabled.
 */
export declare function isNasEnabled(): boolean;
export { getConfig as getNasConfig, logout as nasLogout };
/**
 * List folders on NAS at a given path.
 * Used for the folder chooser in PengaturanNAS.
 */
export declare function listNasSharedFolders(parentPath?: string): Promise<Array<{
    name: string;
    path: string;
    isDir: boolean;
}>>;
