/**
 * Background GDrive Queue Worker
 * 
 * Handles three types of background operations:
 * 1. UPLOAD: Files with upload_status='uploading' → upload to GDrive
 * 2. DELETE: GDrive files queued for deletion → delete from GDrive + cleanup empty folders
 * 3. Both run in background so user gets instant responses
 */
import { db } from '../db/index.js';
import { sarprasFoto, formKerusakan, prestasi, proposal, proposalFoto, bastTemplate, riwayatBantuan, feedback } from '../db/schema/index.js';
import { sarpras } from '../db/schema/sarpras.js';
import { sekolah } from '../db/schema/sekolah.js';
import { eq, or, and, not, like, type AnyColumn } from 'drizzle-orm';
import { isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';
import path from 'path';

/**
 * Build a condition that matches items needing GDrive upload:
 * - uploadStatus = 'uploading' (explicit pending)
 * - OR uploadStatus = 'done' AND filePath NOT like 'gdrive://%' (locally saved, needs sync)
 */
function needsGDriveSync(statusCol: AnyColumn, pathCol: AnyColumn) {
    return or(
        eq(statusCol, 'uploading'),
        and(eq(statusCol, 'done'), not(like(pathCol, 'gdrive://%')))
    );
}

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
    const pendingFotos = await db.select().from(sarprasFoto).where(needsGDriveSync(sarprasFoto.uploadStatus, sarprasFoto.filePath)).limit(5);
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
                    subPath = `${sch.kecamatan || 'unknown'}/${sch.nama}_${sch.npsn}/data sarpras`;
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
    const pendingKerusakan = await db.select().from(formKerusakan).where(needsGDriveSync(formKerusakan.uploadStatus, formKerusakan.filePath)).limit(5);
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
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/form kerusakan`;
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
    const pendingPrestasi = await db.select().from(prestasi).where(needsGDriveSync(prestasi.uploadStatus, prestasi.sertifikatPath)).limit(5);
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
    const pendingProposal = await db.select().from(proposal).where(needsGDriveSync(proposal.uploadStatus, proposal.filePath)).limit(5);
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
    const pendingProposalFoto = await db.select().from(proposalFoto).where(needsGDriveSync(proposalFoto.uploadStatus, proposalFoto.filePath)).limit(5);
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

    // 6. bast_template — SKIP: templates are stored locally only (not sent to GDrive)
    // Set any pending templates to 'done' so queue doesn't keep trying
    try {
        const pendingTpl = await db.select().from(bastTemplate).where(eq(bastTemplate.uploadStatus, 'uploading')).limit(20);
        for (const item of pendingTpl) {
            await db.update(bastTemplate).set({ uploadStatus: 'done' }).where(eq(bastTemplate.id, item.id));
            console.log(`[Queue] Template #${item.id} set to 'done' (local only, skipping GDrive)`);
        }
    } catch {}

    // 6b. riwayat_bantuan
    const pendingRiwayat = await db.select().from(riwayatBantuan).where(needsGDriveSync(riwayatBantuan.uploadStatus, riwayatBantuan.filePath)).limit(5);
    for (const item of pendingRiwayat) {
        if (!item.filePath || !fs.existsSync(item.filePath)) {
            await db.update(riwayatBantuan).set({ uploadStatus: 'failed' }).where(eq(riwayatBantuan.id, item.id));
            continue;
        }
        try {
            let subPath = `riwayat-bantuan/${item.sekolahId}`;
            if (item.sekolahId) {
                const sch = await db.select().from(sekolah).where(eq(sekolah.id, item.sekolahId));
                if (sch[0]) subPath = `${sch[0].kecamatan || 'unknown'}/${sch[0].nama}_${sch[0].npsn}/riwayat bantuan`;
            }
            const result = await uploadFileToGDrive(item.filePath, 'riwayat-bantuan', subPath);
            const oldPath = item.filePath;
            await db.update(riwayatBantuan).set({ filePath: result.path, uploadStatus: 'done' }).where(eq(riwayatBantuan.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload riwayat_bantuan #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload riwayat_bantuan #${item.id} failed:`, e.message);
            await db.update(riwayatBantuan).set({ uploadStatus: 'failed' }).where(eq(riwayatBantuan.id, item.id));
        }
    }

    // 7. kop_sekolah
    const pendingKop = await db.select().from(sekolah).where(needsGDriveSync(sekolah.kopUploadStatus, sekolah.kopSekolah)).limit(5);
    for (const item of pendingKop) {
        if (!item.kopSekolah || !fs.existsSync(item.kopSekolah)) {
            await db.update(sekolah).set({ kopUploadStatus: 'failed' }).where(eq(sekolah.id, item.id));
            continue;
        }
        try {
            const subPath = `${item.kecamatan || 'unknown'}/${item.nama}_${item.npsn}/profil`;
            const result = await uploadFileToGDrive(item.kopSekolah, 'kop-sekolah', subPath);
            const oldPath = item.kopSekolah;
            await db.update(sekolah).set({ kopSekolah: result.path, kopUploadStatus: 'done' }).where(eq(sekolah.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload kop sekolah #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload kop sekolah #${item.id} failed:`, e.message);
            await db.update(sekolah).set({ kopUploadStatus: 'failed' }).where(eq(sekolah.id, item.id));
        }
    }

    // 8. denah_sekolah
    const pendingDenah = await db.select().from(sekolah).where(needsGDriveSync(sekolah.denahUploadStatus, sekolah.denahSekolah)).limit(5);
    for (const item of pendingDenah) {
        if (!item.denahSekolah || !fs.existsSync(item.denahSekolah)) {
            await db.update(sekolah).set({ denahUploadStatus: 'failed' }).where(eq(sekolah.id, item.id));
            continue;
        }
        try {
            const subPath = `${item.kecamatan || 'unknown'}/${item.nama}_${item.npsn}/profil`;
            const result = await uploadFileToGDrive(item.denahSekolah, 'denah-sekolah', subPath);
            const oldPath = item.denahSekolah;
            await db.update(sekolah).set({ denahSekolah: result.path, denahUploadStatus: 'done' }).where(eq(sekolah.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload denah sekolah #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload denah sekolah #${item.id} failed:`, e.message);
            await db.update(sekolah).set({ denahUploadStatus: 'failed' }).where(eq(sekolah.id, item.id));
        }
    }

    // 8b. feedback foto
    const pendingFeedback = await db.select().from(feedback).where(needsGDriveSync(feedback.uploadStatus, feedback.fotoPath)).limit(5);
    for (const item of pendingFeedback) {
        if (!item.fotoPath || !fs.existsSync(item.fotoPath)) {
            await db.update(feedback).set({ uploadStatus: 'failed' }).where(eq(feedback.id, item.id));
            continue;
        }
        try {
            const subPath = `feedback/${item.role || 'unknown'}`;
            const result = await uploadFileToGDrive(item.fotoPath, 'feedback', subPath);
            const oldPath = item.fotoPath;
            await db.update(feedback).set({ fotoPath: result.path, uploadStatus: 'done' }).where(eq(feedback.id, item.id));
            try { fs.unlinkSync(oldPath); } catch { }
            console.log(`[Queue] Upload feedback foto #${item.id} → ${subPath} ✅`);
        } catch (e: any) {
            console.error(`[Queue] Upload feedback foto #${item.id} failed:`, e.message);
            await db.update(feedback).set({ uploadStatus: 'failed' }).where(eq(feedback.id, item.id));
        }
    }

    // 9. MIGRATE: realisasi photos — local paths → GDrive (Kontrak/Tahun/NoMatrik NamaPaket/Realisasi/Bulan/)
    try {
        const { realisasi } = await import('../db/schema/kontrak.js');
        const { matrikKegiatan } = await import('../db/schema/matrik.js');
        const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        
        const allRealisasi = await db.select().from(realisasi).limit(20);
        for (const r of allRealisasi) {
            if (!r.dokumentasiPaths) continue;
            let paths: string[] = [];
            try { paths = JSON.parse(r.dokumentasiPaths); } catch { continue; }
            if (!Array.isArray(paths)) continue;
            
            // Check if any path is still local
            const hasLocal = paths.some(p => p && !p.startsWith('gdrive://'));
            if (!hasLocal) continue;
            
            // Get matrik info for folder structure
            let matrikInfo: any = null;
            if (r.matrikId) {
                const mRows = await db.select().from(matrikKegiatan).where(eq(matrikKegiatan.id, r.matrikId));
                matrikInfo = mRows[0];
            }
            
            const tahun = String(r.tahun || new Date().getFullYear());
            const sanitize = (s: string) => (s || '').replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
            const paketFolder = `${matrikInfo?.noMatrik || r.matrikId || 'XX'}. ${sanitize(matrikInfo?.namaPaket || '')}`;
            const bulanName = BULAN_NAMES[(r.bulan || 1) - 1] || 'Unknown';
            const gDrivePath = `Kontrak/${tahun}/${paketFolder}/Realisasi/${bulanName}`;
            
            const newPaths: string[] = [];
            let changed = false;
            for (const p of paths) {
                if (!p || p.startsWith('gdrive://')) { newPaths.push(p); continue; }
                // Resolve local file path
                const basename = p.replace(/.*[/\\]/, '');
                const uploadDir = process.env.UPLOAD_DIR || './uploads';
                const localCandidates = [
                    p,
                    `${uploadDir}/kontrak/${basename}`,
                    `./uploads/kontrak/${basename}`,
                ];
                let localFile = '';
                for (const c of localCandidates) {
                    const resolved = path.resolve(c);
                    if (fs.existsSync(resolved)) { localFile = resolved; break; }
                }
                if (!localFile) { newPaths.push(p); continue; }
                
                try {
                    const result = await uploadFileToGDrive(localFile, 'kontrak-migrate', gDrivePath);
                    newPaths.push(result.path);
                    try { fs.unlinkSync(localFile); } catch {}
                    changed = true;
                    console.log(`[Queue] Migrate realisasi foto #${r.id} → GDrive ✅`);
                } catch { newPaths.push(p); }
            }
            if (changed) {
                await db.update(realisasi).set({ dokumentasiPaths: JSON.stringify(newPaths) }).where(eq(realisasi.id, r.id));
            }
        }
    } catch (e: any) { console.error('[Queue] Realisasi migrate error:', e.message); }
    
    // 10. MIGRATE: spl_generated — local DOCX/PDF → GDrive (only files older than 2 hours)
    try {
        const { splGenerated } = await import('../db/schema/matrik.js');
        const { matrikKegiatan } = await import('../db/schema/matrik.js');
        const { lt } = await import('drizzle-orm');
        
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        // Find spl_generated with local file paths (not gdrive://), older than 2 hours
        const localSpl = await db.select({
            spl: splGenerated,
            noMatrik: matrikKegiatan.noMatrik,
            namaPaket: matrikKegiatan.namaPaket,
            tahunAnggaran: matrikKegiatan.tahunAnggaran,
        }).from(splGenerated)
          .leftJoin(matrikKegiatan, eq(splGenerated.matrikId, matrikKegiatan.id))
          .where(and(
              not(like(splGenerated.filePath, 'gdrive://%')),
              eq(splGenerated.uploadStatus, 'done'),
              lt(splGenerated.createdAt, twoHoursAgo)
          ))
          .limit(5);
        
        for (const row of localSpl) {
            if (!row.spl.filePath || !fs.existsSync(row.spl.filePath)) continue;
            
            const tahun = String(row.tahunAnggaran || new Date().getFullYear());
            const sanitize = (s: string) => (s || '').replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
            const paketFolder = `${row.noMatrik || 'XX'}. ${sanitize(row.namaPaket || '')}`;
            
            // Detect subfolder from template or default to SPL
            const tplName = (row.spl as any).templateNama || '';
            let subFolder = 'SPL';
            if (tplName.toLowerCase().includes('bast')) subFolder = 'BAST';
            else if (tplName.toLowerCase().includes('kontrak') || tplName.toLowerCase().includes('spk')) subFolder = 'Kontrak';
            const gDrivePath = `Kontrak/${tahun}/${paketFolder}/${subFolder}`;
            
            try {
                // Upload DOCX
                const result = await uploadFileToGDrive(row.spl.filePath, 'kontrak-migrate', gDrivePath);
                let finalPath = result.path; // gdrive://DOCX_ID
                
                // Upload PDF if exists
                const oldDocxPath = row.spl.filePath;
                const pdfPath = oldDocxPath.replace(/\.docx$/i, '.pdf');
                if (fs.existsSync(pdfPath)) {
                    const pdfResult = await uploadFileToGDrive(pdfPath, 'kontrak-migrate', gDrivePath);
                    // Store both: gdrive://DOCX_ID|PDF_ID
                    finalPath = `${result.path}|${pdfResult.path}`;
                    try { fs.unlinkSync(pdfPath); } catch {}
                    console.log(`[Queue] Migrate SPL PDF #${row.spl.id} → GDrive ✅`);
                }
                
                await db.update(splGenerated).set({ filePath: finalPath }).where(eq(splGenerated.id, row.spl.id));
                try { fs.unlinkSync(oldDocxPath); } catch {}
                console.log(`[Queue] Migrate SPL #${row.spl.id} → GDrive ✅ path=${finalPath}`);
            } catch (e: any) {
                console.error(`[Queue] Migrate SPL #${row.spl.id} failed:`, e.message);
            }
        }
    } catch (e: any) { console.error('[Queue] SPL migrate error:', e.message); }
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
