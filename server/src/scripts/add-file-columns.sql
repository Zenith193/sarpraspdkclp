-- Migration: Add filePath columns for proposal and bastTemplate
-- Run on server: sudo -u postgres psql -d spidol -f /var/www/sarpraspdkclp/server/src/scripts/add-file-columns.sql

-- Proposal: add file_name and file_path for PDF document upload
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS file_path TEXT;

-- BAST Template: add file_path for template file upload
ALTER TABLE bast_template ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'proposal' AND column_name IN ('file_name', 'file_path');

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'bast_template' AND column_name = 'file_path';
