import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    ensureDir, getSarprasFotoPath, getProposalPath,
    getBastPath, getKerusakanPath, getPrestasiPath,
    getKopSekolahPath, getTemplatePath,
    type SekolahInfo, type SarprasInfo
} from '../utils/storagePaths';

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure base upload dir exists
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ===================================================================
// LEGACY: flat-folder storage (fallback when no sekolah info provided)
// ===================================================================
const dirs = ['fotos', 'sertifikat', 'form-kerusakan', 'bast', 'proposal'];
dirs.forEach(dir => {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Unique filename generator
const uniqueFilename = (_req: any, file: Express.Multer.File, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
};

// ===================================================================
// FILE FILTERS
// ===================================================================
const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
};

const pdfFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
};

// ===================================================================
// HIERARCHICAL STORAGE (NAS schema)
// Expects req.body or req.query to contain sekolah/sarpras info for path
// ===================================================================

/**
 * Foto Sarpras — hierarchical: /Kecamatan/Sekolah/sarpras/MasaBangunan/NamaRuang/
 * Falls back to flat /fotos/ if sekolah info not available.
 */
export const uploadFotos = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            // Try to build hierarchical path if sekolah info is available
            if (b.kecamatan && b.namaSekolah && b.npsn && b.namaRuang) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const sarpras: SarprasInfo = { masaBangunan: b.masaBangunan, namaRuang: b.namaRuang };
                const dest = ensureDir(getSarprasFotoPath(sekolah, sarpras));
                cb(null, dest);
            } else {
                // Fallback to flat
                cb(null, path.join(uploadDir, 'fotos'));
            }
        },
        filename: uniqueFilename,
    }),
    fileFilter: imageFilter,
    limits: { fileSize: 500 * 1024, files: 5 },
});

/**
 * Sertifikat Prestasi — /Kecamatan/Sekolah/prestasi/
 */
export const uploadSertifikat = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            if (b.kecamatan && b.namaSekolah && b.npsn) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const dest = ensureDir(getPrestasiPath(sekolah));
                cb(null, dest);
            } else {
                cb(null, ensureDir(path.join(uploadDir, 'sertifikat')));
            }
        },
        filename: uniqueFilename,
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Form Kerusakan — /Kecamatan/Sekolah/kerusakan/
 */
export const uploadFormKerusakan = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            if (b.kecamatan && b.namaSekolah && b.npsn) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const dest = ensureDir(getKerusakanPath(sekolah));
                cb(null, dest);
            } else {
                cb(null, ensureDir(path.join(uploadDir, 'form-kerusakan')));
            }
        },
        filename: uniqueFilename,
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Proposal — /Kecamatan/Sekolah/proposal/{Tahun}/
 */
export const uploadProposal = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            if (b.kecamatan && b.namaSekolah && b.npsn) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const dest = ensureDir(getProposalPath(sekolah, b.tahun));
                cb(null, dest);
            } else {
                cb(null, ensureDir(path.join(uploadDir, 'proposal')));
            }
        },
        filename: uniqueFilename,
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * BAST — /Kecamatan/Sekolah/bast/
 */
export const uploadBast = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            if (b.kecamatan && b.namaSekolah && b.npsn) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const dest = ensureDir(getBastPath(sekolah));
                cb(null, dest);
            } else {
                cb(null, ensureDir(path.join(uploadDir, 'bast')));
            }
        },
        filename: uniqueFilename,
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Kop Sekolah — /Kecamatan/Sekolah/kop-sekolah/
 */
export const uploadKopSekolah = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const b = req.body || {};
            if (b.kecamatan && b.namaSekolah && b.npsn) {
                const sekolah: SekolahInfo = { kecamatan: b.kecamatan, nama: b.namaSekolah, npsn: b.npsn };
                const dest = ensureDir(getKopSekolahPath(sekolah));
                cb(null, dest);
            } else {
                cb(null, ensureDir(path.join(uploadDir, 'kop-sekolah')));
            }
        },
        filename: uniqueFilename,
    }),
    limits: { fileSize: 1 * 1024 * 1024 },
});

/**
 * Template (sistem) — /_sistem/template/
 */
export const uploadTemplate = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, ensureDir(getTemplatePath()));
        },
        filename: uniqueFilename,
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
});
