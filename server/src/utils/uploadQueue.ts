/**
 * Background GDrive Queue Worker
 * 
 * Handles three types of background operations:
 * 1. UPLOAD: Files with upload_status='uploading' → upload to GDrive
 * 2. DELETE: GDrive files queued for deletion → delete from GDrive + cleanup empty folders
 * 3. Both run in background so user gets instant responses
 */
import { db } from '../db/index.js';
import { sarprasFoto, formKerusakan, prestasi, proposal, proposalFoto } from '../db/schema/index.js';
import { sarpras } from '../db/schema/sarpras.js';
import { sekolah } from '../db/schema/sekolah.js';
import { eq } from 'drizzle-orm';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';

// ==================== DELETE QUEUE ====================
// In-memory queue for GDrive file deletions
const deleteQueue: string[] = []; // GDrive file paths like "gdrive://fileId"

/**
 * Queue a GDrive file path for background deletion.
 * Call this instead of deleteGDriveFile for instant response.
 */
export function queueGDriveDelete(filePath: string | null | undefined): void {
    if (!filePath) return;
    // Queue both gdrive:// and local paths
    deleteQueue.push(filePath);
    console.log(`[Queue] Queued for deletion: ${filePath.substring(0, 30)}... (${deleteQueue.length} pending)`);
}

// Dynamic import to avoid circular deps
async function getGDriveUtils() {
    const mod = await import('../utils/googleDriveClient.js');
    return {
        uploadFileToGDrive: mod.uploadFileToGDrive,
        deleteGDriveFile: mod.deleteGDriveFile,
    };
}

// ==================== PROCESS DELETE QUEUE ====================
async function processDeleteQueue() {
    if (deleteQueue.length === 0) return;

    const { deleteGDriveFile } = await getGDriveUtils();

    // Process up to 10 deletions per cycle
    const batch = deleteQueue.splice(0, 10);
    for (const filePath of batch) {
        try {
            if (filePath.startsWith('gdrive://')) {
                await deleteGDriveFile(filePath);
                console.log(`[Queue] Deleted from GDrive: ${filePath.substring(0, 30)}... ✅`);
            } else if (fs.existsSync(filePath)) {
                // Delete local file
                fs.unlinkSync(filePath);
                console.log(`[Queue] Deleted local file: ${filePath} ✅`);
            }
        } catch (e: any) {
            console.error(`[Queue] Delete failed: ${filePath}`, e.message);
            // Don't re-queue — it's a best-effort cleanup
        }
    }
}

// ==================== PROCESS UPLOAD QUEUE ====================
let isProcessing = false;
const POLL_INTERVAL = 5000; // 5 seconds

async function processUploadQueue() {
    if (!isGDriveEnabled()) return;

    const { uploadFileToGDrive } = await getGDriveUtils();

    // 1. sarpras_foto — build full folder path: kecamatan/namaSekolah_npsn/sarpras/masaBangunan/namaRuang
    const pendingFotos = await db.select().from(sarprasFoto).where(eq(sarprasFoto.uploadStatus, 'uploading')).limit(5);
    for (const foto of pendingFotos) {
        if (!foto.filePath || !fs.existsSync(foto.filePath)) {
            await db.update(sarprasFoto).set({ uploadStatus: 'failed' }).where(eq(sarprasFoto.id, foto.id));
            continue;
        }
        try {
            // Look up sarpras + sekolah for folder hierarchy
            const sarprasRow = await db.select().from(sarpras).where(eq(sarpras.id, foto.sarprasId));
            let subPath = 'sarpras';
            if (sarprasRow[0]) {
                const s = sarprasRow[0];
                const sekolahRow = await db.select().from(sekolah).where(eq(sekolah.id, s.sekolahId));
                const sch = sekolahRow[0];
                if (sch) {
                    subPath = `${sch.kecamatan || 'unknown'}/${sch.nama}_${sch.npsn}/sarpras`;
                }
                if (s.masaBangunan) subPath += `/${s.masaBangunan}`;
                if (s.namaRuang) subPath += `/${s.namaRuang}`;
            }
            const result = await uploadFileToGDrive(foto.filePath, 'sarpras', subPath);
            const oldPath = foto.filePath;
            await db.update(sarprasFoto).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(sarprasFoto.id, foto.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload sarpras_foto #${foto.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload sarpras_foto #${foto.id} failed:`, e.message);
            await db.update(sarprasFoto).set({ uploadStatus: 'failed' }).where(eq(sarprasFoto.id, foto.id));
        }
    }

    // 2. form_kerusakan
    const pendingKerusakan = await db.select().from(formKerusakan).where(eq(formKerusakan.uploadStatus, 'uploading')).limit(5);
    for (const item of pendingKerusakan) {
        if (!item.filePath || !fs.existsSync(item.filePath)) {
            await db.update(formKerusakan).set({ uploadStatus: 'failed' }).where(eq(formKerusakan.id, item.id));
            continue;
        }
        try {
            // Look up sekolah for folder path
            let subPath = `kerusakan/${item.sekolahId}`;
            if (item.sekolahId) {
                const sch = await db.select().from(sekolah).where(eq(sekolah.id, item.sekolahId));
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/kerusakan`;
            }
            const result = await uploadFileToGDrive(item.filePath, 'kerusakan', subPath);
            const oldPath = item.filePath;
            await db.update(formKerusakan).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(formKerusakan.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload kerusakan #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload kerusakan #${item.id} failed:`, e.message);
            await db.update(formKerusakan).set({ uploadStatus: 'failed' }).where(eq(formKerusakan.id, item.id));
        }
    }

    // 3. prestasi
    const pendingPrestasi = await db.select().from(prestasi).where(eq(prestasi.uploadStatus, 'uploading')).limit(5);
    for (const item of pendingPrestasi) {
        if (!item.sertifikatPath || !fs.existsSync(item.sertifikatPath)) {
            await db.update(prestasi).set({ uploadStatus: 'failed' }).where(eq(prestasi.id, item.id));
            continue;
        }
        try {
            // Look up sekolah for folder path
            let subPath = `prestasi/${item.sekolahId}`;
            if (item.sekolahId) {
                const sch = await db.select().from(sekolah).where(eq(sekolah.id, item.sekolahId));
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/prestasi`;
            }
            const result = await uploadFileToGDrive(item.sertifikatPath, 'prestasi', subPath);
            const oldPath = item.sertifikatPath;
            await db.update(prestasi).set({ sertifikatPath: result.path, uploadStatus: 'done' }).where(eq(prestasi.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload prestasi #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload prestasi #${item.id} failed:`, e.message);
            await db.update(prestasi).set({ uploadStatus: 'failed' }).where(eq(prestasi.id, item.id));
        }
    }

    // 4. proposal
    const pendingProposal = await db.select().from(proposal).where(eq(proposal.uploadStatus, 'uploading')).limit(5);
    for (const item of pendingProposal) {
        if (!item.filePath || !fs.existsSync(item.filePath)) {
            await db.update(proposal).set({ uploadStatus: 'failed' }).where(eq(proposal.id, item.id));
            continue;
        }
        try {
            let subPath = `proposal/${item.sekolahId}`;
            if (item.sekolahId) {
                const sch = await db.select().from(sekolah).where(eq(sekolah.id, item.sekolahId));
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/proposal`;
            }
            const result = await uploadFileToGDrive(item.filePath, 'proposal', subPath);
            const oldPath = item.filePath;
            await db.update(proposal).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(proposal.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload proposal #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload proposal #${item.id} failed:`, e.message);
            await db.update(proposal).set({ uploadStatus: 'failed' }).where(eq(proposal.id, item.id));
        }
    }

    // 5. proposal_foto
    const pendingProposalFoto = await db.select().from(proposalFoto).where(eq(proposalFoto.uploadStatus, 'uploading')).limit(5);
    for (const item of pendingProposalFoto) {
        if (!item.filePath || !fs.existsSync(item.filePath)) {
            await db.update(proposalFoto).set({ uploadStatus: 'failed' }).where(eq(proposalFoto.id, item.id));
            continue;
        }
        try {
            // Look up proposal → sekolah for folder path
            let subPath = `proposal/${item.proposalId}`;
            const propRow = await db.select().from(proposal).where(eq(proposal.id, item.proposalId));
            if (propRow[0]?.sekolahId) {
                const sch = await db.select().from(sekolah).where(eq(sekolah.id, propRow[0].sekolahId));
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/proposal`;
            }
            const result = await uploadFileToGDrive(item.filePath, 'proposal', subPath);
            const oldPath = item.filePath;
            await db.update(proposalFoto).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(proposalFoto.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload proposal_foto #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload proposal_foto #${item.id} failed:`, e.message);
            await db.update(proposalFoto).set({ uploadStatus: 'failed' }).where(eq(proposalFoto.id, item.id));
        }
    }
}

// ==================== MAIN LOOP ====================
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        // Process deletions first (fast, in-memory queue)
        await processDeleteQueue();
        // Then process uploads (DB polling)
        await processUploadQueue();
    } catch (err: any) {
        console.error('[Queue] Error:', err.message);
    } finally {
        isProcessing = false;
    }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startUploadQueue() {
    if (intervalId) return;
    console.log('[Queue] Started (polling every', POLL_INTERVAL / 1000, 'seconds)');
    intervalId = setInterval(processQueue, POLL_INTERVAL);
    setTimeout(processQueue, 2000);
}

export function stopUploadQueue() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[Queue] Stopped');
    }
}
