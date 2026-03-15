-- Add SPL fields to matrik_kegiatan
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS no_hp TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS konsultan_pengawas TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS dir_konsultan_pengawas TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS no_mc0 TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS tgl_mc0 DATE;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS no_mc100 TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS tgl_mc100 DATE;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS no_pcm TEXT;
ALTER TABLE matrik_kegiatan ADD COLUMN IF NOT EXISTS tgl_pcm DATE;

-- SPL Generated table
CREATE TABLE IF NOT EXISTS spl_generated (
    id SERIAL PRIMARY KEY,
    matrik_id INTEGER NOT NULL REFERENCES matrik_kegiatan(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES bast_template(id),
    nama_file TEXT,
    file_path TEXT,
    upload_status TEXT DEFAULT 'done',
    created_by TEXT REFERENCES "user"(id),
    created_at TIMESTAMP DEFAULT NOW()
);
