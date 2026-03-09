-- Migration: Add upload_status + filePath columns
-- Run: sudo -u postgres psql -d spidol -f /var/www/sarpraspdkclp/server/src/scripts/add-file-columns.sql

-- Proposal: add file_name and file_path for PDF document upload
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS file_path TEXT;

-- BAST Template: add file_path for template file upload
ALTER TABLE bast_template ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Upload status columns for background queue
ALTER TABLE sarpras_foto ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done';
ALTER TABLE form_kerusakan ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done';
ALTER TABLE prestasi ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done';
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done';
ALTER TABLE proposal_foto ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'done';

-- Verify
SELECT 'sarpras_foto' AS tbl, column_name FROM information_schema.columns WHERE table_name = 'sarpras_foto' AND column_name = 'upload_status'
UNION ALL
SELECT 'form_kerusakan', column_name FROM information_schema.columns WHERE table_name = 'form_kerusakan' AND column_name = 'upload_status'
UNION ALL
SELECT 'prestasi', column_name FROM information_schema.columns WHERE table_name = 'prestasi' AND column_name = 'upload_status'
UNION ALL
SELECT 'proposal', column_name FROM information_schema.columns WHERE table_name = 'proposal' AND column_name = 'upload_status'
UNION ALL
SELECT 'proposal_foto', column_name FROM information_schema.columns WHERE table_name = 'proposal_foto' AND column_name = 'upload_status';
