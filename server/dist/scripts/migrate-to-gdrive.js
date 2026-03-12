/**
 * Migration script: Upload all local files to Google Drive and update DB paths.
 *
 * Tables migrated:
 *   - sarpras_foto (file_path)
 *   - form_kerusakan (file_path)
 *   - prestasi (sertifikat_path)
 *
 * Usage: cd /var/www/sarpraspdkclp/server && npx tsx src/scripts/migrate-to-gdrive.ts
 */
import 'dotenv/config';
import { db } from '../db/index.js';
import { sarprasFoto, formKerusakan, prestasi, proposalFoto } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { uploadToGDrive, isGDriveEnabled } from '../utils/googleDriveClient.js';
import fs from 'fs';
async function migrate() {
    console.log('=== GDrive Migration Script ===');
    if (!isGDriveEnabled()) {
        console.error('❌ Google Drive is not configured! Please set GDRIVE_* env vars.');
        process.exit(1);
    }
    console.log('✅ Google Drive is enabled');
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    // ===== 1. Migrate sarpras_foto =====
    console.log('\n📸 Migrating sarpras_foto...');
    const fotos = await db.select().from(sarprasFoto).where(sql `${sarprasFoto.filePath} NOT LIKE 'gdrive://%'`);
    console.log(`   Found ${fotos.length} files to migrate`);
    for (const foto of fotos) {
        const filePath = foto.filePath || '';
        if (!filePath || !fs.existsSync(filePath)) {
            console.log(`   ⏭ ID ${foto.id}: File not found at ${filePath}`);
            skipped++;
            continue;
        }
        try {
            const result = await uploadToGDrive(filePath, `sarpras/${foto.sarprasId}`, foto.fileName);
            if (result.success) {
                await db.update(sarprasFoto).set({ filePath: result.path }).where(eq(sarprasFoto.id, foto.id));
                console.log(`   ✅ ID ${foto.id}: ${foto.fileName} → ${result.fileId}`);
                // Delete local file after successful upload
                try {
                    fs.unlinkSync(filePath);
                }
                catch { /* ignore */ }
                migrated++;
            }
            else {
                console.log(`   ❌ ID ${foto.id}: Upload failed`);
                failed++;
            }
        }
        catch (e) {
            console.log(`   ❌ ID ${foto.id}: ${e.message}`);
            failed++;
        }
    }
    // ===== 2. Migrate form_kerusakan =====
    console.log('\n📋 Migrating form_kerusakan...');
    const kerusakanFiles = await db.select().from(formKerusakan).where(sql `${formKerusakan.filePath} IS NOT NULL AND ${formKerusakan.filePath} NOT LIKE 'gdrive://%'`);
    console.log(`   Found ${kerusakanFiles.length} files to migrate`);
    for (const item of kerusakanFiles) {
        const filePath = item.filePath || '';
        if (!filePath || !fs.existsSync(filePath)) {
            console.log(`   ⏭ ID ${item.id}: File not found at ${filePath}`);
            skipped++;
            continue;
        }
        try {
            const result = await uploadToGDrive(filePath, `kerusakan/${item.sekolahId}`, item.fileName || undefined);
            if (result.success) {
                await db.update(formKerusakan).set({ filePath: result.path }).where(eq(formKerusakan.id, item.id));
                console.log(`   ✅ ID ${item.id}: ${item.fileName} → ${result.fileId}`);
                try {
                    fs.unlinkSync(filePath);
                }
                catch { /* ignore */ }
                migrated++;
            }
            else {
                console.log(`   ❌ ID ${item.id}: Upload failed`);
                failed++;
            }
        }
        catch (e) {
            console.log(`   ❌ ID ${item.id}: ${e.message}`);
            failed++;
        }
    }
    // ===== 3. Migrate prestasi sertifikat =====
    console.log('\n🏆 Migrating prestasi sertifikat...');
    const sertifikats = await db.select().from(prestasi).where(sql `${prestasi.sertifikatPath} IS NOT NULL AND ${prestasi.sertifikatPath} NOT LIKE 'gdrive://%'`);
    console.log(`   Found ${sertifikats.length} files to migrate`);
    for (const item of sertifikats) {
        const filePath = item.sertifikatPath || '';
        if (!filePath || !fs.existsSync(filePath)) {
            console.log(`   ⏭ ID ${item.id}: File not found at ${filePath}`);
            skipped++;
            continue;
        }
        try {
            const result = await uploadToGDrive(filePath, `prestasi/${item.sekolahId}`);
            if (result.success) {
                await db.update(prestasi).set({ sertifikatPath: result.path }).where(eq(prestasi.id, item.id));
                console.log(`   ✅ ID ${item.id}: → ${result.fileId}`);
                try {
                    fs.unlinkSync(filePath);
                }
                catch { /* ignore */ }
                migrated++;
            }
            else {
                console.log(`   ❌ ID ${item.id}: Upload failed`);
                failed++;
            }
        }
        catch (e) {
            console.log(`   ❌ ID ${item.id}: ${e.message}`);
            failed++;
        }
    }
    // ===== 4. Migrate proposal_foto =====
    console.log('\n📄 Migrating proposal_foto...');
    const proposalFotos = await db.select().from(proposalFoto).where(sql `${proposalFoto.filePath} NOT LIKE 'gdrive://%'`);
    console.log(`   Found ${proposalFotos.length} files to migrate`);
    for (const item of proposalFotos) {
        const filePath = item.filePath || '';
        if (!filePath || !fs.existsSync(filePath)) {
            console.log(`   ⏭ ID ${item.id}: File not found at ${filePath}`);
            skipped++;
            continue;
        }
        try {
            const result = await uploadToGDrive(filePath, `proposal/${item.proposalId}`, item.fileName);
            if (result.success) {
                await db.update(proposalFoto).set({ filePath: result.path }).where(eq(proposalFoto.id, item.id));
                console.log(`   ✅ ID ${item.id}: ${item.fileName} → ${result.fileId}`);
                try {
                    fs.unlinkSync(filePath);
                }
                catch { /* ignore */ }
                migrated++;
            }
            else {
                console.log(`   ❌ ID ${item.id}: Upload failed`);
                failed++;
            }
        }
        catch (e) {
            console.log(`   ❌ ID ${item.id}: ${e.message}`);
            failed++;
        }
    }
    console.log('\n=== Migration Complete ===');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭ Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    process.exit(0);
}
migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
