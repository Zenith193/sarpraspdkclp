import { Readable } from 'stream';
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
interface GDriveConfig {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    folderId: string;
}
export declare function setGDriveRuntimeConfig(config: Partial<GDriveConfig>): void;
export declare function isGDriveEnabled(): boolean;
/**
 * Find an existing folder ID by traversing a path from the root folder.
 * Returns null if any segment doesn't exist.
 */
export declare function findGDriveFolderByPath(folderPath: string): Promise<string | null>;
/**
 * Rename a Google Drive folder by ID.
 */
export declare function renameGDriveFolder(folderId: string, newName: string): Promise<boolean>;
/**
 * Move a Google Drive folder to a new parent.
 */
export declare function moveGDriveFolder(folderId: string, newParentId: string, oldParentId?: string): Promise<boolean>;
export declare function ensureGDrivePath(folderPath: string): Promise<string>;
export declare function uploadToGDrive(localFilePath: string, destFolderPath: string, filename?: string): Promise<{
    success: boolean;
    fileId: string;
    path: string;
}>;
export declare function streamFromGDrive(fileId: string): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
} | null>;
export declare function listGDriveFolders(parentId?: string): Promise<Array<{
    name: string;
    id: string;
}>>;
export declare function testGDriveConnection(): Promise<{
    success: boolean;
    message: string;
    email?: string;
    folderName?: string;
    fileCount?: number;
}>;
export declare function uploadFileToGDrive(localFilePath: string, category: string, subPath: string): Promise<{
    stored: 'gdrive' | 'local';
    path: string;
}>;
/**
 * Delete a file from Google Drive by its file ID.
 * Returns the parent folder ID (for cleanup) or null.
 */
export declare function deleteFromGDrive(fileId: string): Promise<string | null>;
/**
 * Safe helper: delete a GDrive file from a path like "gdrive://fileId".
 * Also cleans up empty parent folders after deletion.
 */
export declare function deleteGDriveFile(filePath: string | null | undefined): Promise<void>;
export {};
