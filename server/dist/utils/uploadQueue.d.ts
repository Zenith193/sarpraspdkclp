/**
 * Queue a GDrive file path for background deletion.
 * Call this instead of deleteGDriveFile for instant response.
 */
export declare function queueGDriveDelete(filePath: string | null | undefined): void;
export declare function startUploadQueue(): void;
export declare function stopUploadQueue(): void;
