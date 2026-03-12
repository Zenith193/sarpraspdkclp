-- ============================================================
-- Performance indexes for all major tables
-- Run this on the production database to fix slow data loading
-- ============================================================

-- SEKOLAH
CREATE INDEX IF NOT EXISTS idx_sekolah_kecamatan ON sekolah (kecamatan);
CREATE INDEX IF NOT EXISTS idx_sekolah_jenjang ON sekolah (jenjang);
CREATE INDEX IF NOT EXISTS idx_sekolah_npsn ON sekolah (npsn);
CREATE INDEX IF NOT EXISTS idx_sekolah_kec_jen ON sekolah (kecamatan, jenjang);

-- SARPRAS
CREATE INDEX IF NOT EXISTS idx_sarpras_sekolah_id ON sarpras (sekolah_id);
CREATE INDEX IF NOT EXISTS idx_sarpras_verified ON sarpras (verified);
CREATE INDEX IF NOT EXISTS idx_sarpras_kondisi ON sarpras (kondisi);
CREATE INDEX IF NOT EXISTS idx_sarpras_sekolah_verified ON sarpras (sekolah_id, verified);

-- SARPRAS_FOTO
CREATE INDEX IF NOT EXISTS idx_sarpras_foto_sarpras_id ON sarpras_foto (sarpras_id);
CREATE INDEX IF NOT EXISTS idx_sarpras_foto_upload ON sarpras_foto (upload_status);

-- FORM_KERUSAKAN
CREATE INDEX IF NOT EXISTS idx_form_kerusakan_sekolah_id ON form_kerusakan (sekolah_id);
CREATE INDEX IF NOT EXISTS idx_form_kerusakan_status ON form_kerusakan (status);
CREATE INDEX IF NOT EXISTS idx_form_kerusakan_upload ON form_kerusakan (upload_status);

-- PROPOSAL
CREATE INDEX IF NOT EXISTS idx_proposal_sekolah_id ON proposal (sekolah_id);
CREATE INDEX IF NOT EXISTS idx_proposal_status ON proposal (status);
CREATE INDEX IF NOT EXISTS idx_proposal_keranjang ON proposal (keranjang);
CREATE INDEX IF NOT EXISTS idx_proposal_upload ON proposal (upload_status);

-- PROPOSAL_FOTO
CREATE INDEX IF NOT EXISTS idx_proposal_foto_proposal_id ON proposal_foto (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_foto_upload ON proposal_foto (upload_status);

-- PRESTASI
CREATE INDEX IF NOT EXISTS idx_prestasi_sekolah_id ON prestasi (sekolah_id);
CREATE INDEX IF NOT EXISTS idx_prestasi_status ON prestasi (status);
CREATE INDEX IF NOT EXISTS idx_prestasi_upload ON prestasi (upload_status);
CREATE INDEX IF NOT EXISTS idx_prestasi_tingkat ON prestasi (tingkat);

-- USER
CREATE INDEX IF NOT EXISTS idx_user_email ON "user" (email);
CREATE INDEX IF NOT EXISTS idx_user_role ON "user" (role);
CREATE INDEX IF NOT EXISTS idx_user_sekolah_id ON "user" (sekolah_id);

-- APP_SETTINGS
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings (key);
