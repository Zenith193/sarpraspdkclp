/**
 * Background GDrive Upload Worker
 * 
 * Periodically checks for files with upload_status = 'uploading'
 * and uploads them to Google Drive in the background.
 */
import { db } from '../db/index.js';
import { sarprasFoto, formKerusakan, prestasi, proposal, proposalFoto } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';

// Dynamic import to avoid circular deps
async function getUploader() {
    const { uploadFileToGDrive } = await import('../utils/googleDriveClient.js');
    return uploadFileToGDrive;
}

let isProcessing = false;
const POLL_INTERVAL = 5000; // 5 seconds

async function processQueue() {
    if (isProcessing || !isGDriveEnabled()) return;
    isProcessing = true;

    try {
        const uploadFileToGDrive = await getUploader();

        // 1. sarpras_foto
        const pendingFotos = await db.select().from(sarprasFoto).where(eq(sarprasFoto.uploadStatus, 'uploading')).limit(5);
        for (const foto of pendingFotos) {
            if (!foto.filePath || !fs.existsSync(foto.filePath)) {
                await db.update(sarprasFoto).set({ uploadStatus: 'failed' }).where(eq(sarprasFoto.id, foto.id));
                continue;
            }
            try {
                const result = await uploadFileToGDrive(foto.filePath, 'sarpras', `sarpras/${foto.sarprasId}`);
                const oldPath = foto.filePath;
                await db.update(sarprasFoto).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(sarprasFoto.id, foto.id));
                try { fs.unlinkSync(oldPath); } catch { }
                console.log(`[UploadQueue] sarpras_foto #${foto.id} → GDrive ✅`);
            } catch (e: any) {
                console.error(`[UploadQueue] sarpras_foto #${foto.id} failed:`, e.message);
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
                const result = await uploadFileToGDrive(item.filePath, 'kerusakan', `kerusakan/${item.sekolahId}`);
                const oldPath = item.filePath;
                await db.update(formKerusakan).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(formKerusakan.id, item.id));
                try { fs.unlinkSync(oldPath); } catch { }
                console.log(`[UploadQueue] kerusakan #${item.id} → GDrive ✅`);
            } catch (e: any) {
                console.error(`[UploadQueue] kerusakan #${item.id} failed:`, e.message);
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
                const result = await uploadFileToGDrive(item.sertifikatPath, 'prestasi', `prestasi/${item.sekolahId}`);
                const oldPath = item.sertifikatPath;
                await db.update(prestasi).set({ sertifikatPath: result.path, uploadStatus: 'done' }).where(eq(prestasi.id, item.id));
                try { fs.unlinkSync(oldPath); } catch { }
                console.log(`[UploadQueue] prestasi #${item.id} → GDrive ✅`);
            } catch (e: any) {
                console.error(`[UploadQueue] prestasi #${item.id} failed:`, e.message);
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
                const result = await uploadFileToGDrive(item.filePath, 'proposal', `proposal/${item.sekolahId}`);
                const oldPath = item.filePath;
                await db.update(proposal).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(proposal.id, item.id));
                try { fs.unlinkSync(oldPath); } catch { }
                console.log(`[UploadQueue] proposal #${item.id} → GDrive ✅`);
            } catch (e: any) {
                console.error(`[UploadQueue] proposal #${item.id} failed:`, e.message);
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
                const result = await uploadFileToGDrive(item.filePath, 'proposal', `proposal/${item.proposalId}`);
                const oldPath = item.filePath;
                await db.update(proposalFoto).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(proposalFoto.id, item.id));
                try { fs.unlinkSync(oldPath); } catch { }
                console.log(`[UploadQueue] proposal_foto #${item.id} → GDrive ✅`);
            } catch (e: any) {
                console.error(`[UploadQueue] proposal_foto #${item.id} failed:`, e.message);
                await db.update(proposalFoto).set({ uploadStatus: 'failed' }).where(eq(proposalFoto.id, item.id));
            }
        }
    } catch (err: any) {
        console.error('[UploadQueue] Error:', err.message);
    } finally {
        isProcessing = false;
    }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startUploadQueue() {
    if (intervalId) return;
    console.log('[UploadQueue] Started (polling every', POLL_INTERVAL / 1000, 'seconds)');
    intervalId = setInterval(processQueue, POLL_INTERVAL);
    // Run immediately on start to process any pending from previous session
    setTimeout(processQueue, 2000);
}

export function stopUploadQueue() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[UploadQueue] Stopped');
    }
}
