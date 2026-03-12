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
