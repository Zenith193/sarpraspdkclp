import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
    ensureDir, getSarprasFotoPath, getProposalPath,
    getBastPath, getKerusakanPath, getPrestasiPath,
    getKopSekolahPath, getTemplatePath,
    type SekolahInfo, type SarprasInfo
} from '../utils/storagePaths';
import { uploadToNas, isNasEnabled } from '../utils/nasClient';
import { isGDriveEnabled, uploadFileToGDrive } from '../utils/googleDriveClient';

// ===================================================================
// Upload strategy:
//   1. Receive file to local temp dir (/tmp or ./uploads/_temp)
//   2. If NAS enabled → upload to Synology NAS → delete local copy
//   3. If NAS disabled → move to hierarchical local folder structure
// ===================================================================

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const tempDir = path.join(os.tmpdir(), 'spidol-uploads');

// Ensure directories exist
[tempDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Legacy flat folders (fallback)
['fotos', 'sertifikat', 'form-kerusakan', 'bast', 'proposal'].forEach(dir => {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ===================================================================
// All uploads go to temp dir first, then NAS middleware handles routing
// ===================================================================
const tempStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        ensureDir(tempDir);
        cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// Unique filename generator (for local-only mode)
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
// NAS FORWARDING MIDDLEWARE
// ===================================================================

/**
 * Express middleware that forwards uploaded files to NAS after multer saves them to temp.
 * Attaches `nasPath` to each file object for the route handler to use.
 */
export function forwardToNas(
    category: 'sarpras' | 'proposal' | 'bast' | 'kerusakan' | 'prestasi' | 'kop-sekolah' | 'template' | 'backup'
) {
    return async (req: any, _res: any, next: any) => {
        if (!req.files && !req.file) return next();

        const files: Express.Multer.File[] = req.file ? [req.file] : (req.files as Express.Multer.File[] || []);
        const body = req.body || {};

        // Build sekolah info from request body
        const sekolah: SekolahInfo | undefined =
            (body.kecamatan && body.namaSekolah && body.npsn)
                ? { kecamatan: body.kecamatan, nama: body.namaSekolah, npsn: body.npsn }
                : undefined;

        const extra = {
            masaBangunan: body.masaBangunan,
            namaRuang: body.namaRuang,
            tahun: body.tahun,
        };

        // Determine sub-path for Google Drive folder hierarchy
        const subPath = sekolah
            ? `${sekolah.kecamatan}/${sekolah.nama}_${sekolah.npsn}/${category}${extra.namaRuang ? '/' + extra.namaRuang : ''}`
            : category;

        // Forward each file to storage
        for (const file of files) {
            try {
                // Priority: Google Drive > NAS > Local
                if (isGDriveEnabled()) {
                    const result = await uploadFileToGDrive(file.path, category, subPath);
                    (file as any).storedAt = result.stored;
                    (file as any).finalPath = result.path;
                } else {
                    const result = await uploadToNas(file.path, category, sekolah, extra);
                    (file as any).storedAt = result.stored;
                    (file as any).nasPath = result.path;

                    if (result.stored === 'nas') {
                        (file as any).finalPath = result.path;
                    } else {
                        // NAS disabled or failed — move from temp to local
                        const localDest = getLocalDestination(category, body);
                        const finalLocalPath = path.join(localDest, file.filename);
                        fs.renameSync(file.path, finalLocalPath);
                        (file as any).finalPath = finalLocalPath;
                    }
                }
            } catch (err) {
                console.error('Storage forwarding error for', file.filename, err);
                // Keep in temp as fallback — move to local
                try {
                    const localDest = getLocalDestination(category, body);
                    const finalLocalPath = path.join(localDest, file.filename);
                    fs.renameSync(file.path, finalLocalPath);
                    (file as any).finalPath = finalLocalPath;
                } catch {
                    (file as any).finalPath = file.path;
                }
                (file as any).storedAt = 'local';
            }
        }

        next();
    };
}

/**
 * Get local destination path when NAS is not available.
 */
function getLocalDestination(category: string, body: any): string {
    const sekolah = (body.kecamatan && body.namaSekolah && body.npsn)
        ? { kecamatan: body.kecamatan, nama: body.namaSekolah, npsn: body.npsn }
        : null;

    if (sekolah) {
        switch (category) {
            case 'sarpras':
                return ensureDir(getSarprasFotoPath(sekolah, {
                    masaBangunan: body.masaBangunan,
                    namaRuang: body.namaRuang || 'unknown',
                }));
            case 'proposal':
                return ensureDir(getProposalPath(sekolah, body.tahun));
            case 'bast':
                return ensureDir(getBastPath(sekolah));
            case 'kerusakan':
                return ensureDir(getKerusakanPath(sekolah));
            case 'prestasi':
                return ensureDir(getPrestasiPath(sekolah));
            case 'kop-sekolah':
                return ensureDir(getKopSekolahPath(sekolah));
        }
    }

    // Fallback to flat folders
    switch (category) {
        case 'sarpras': return ensureDir(path.join(uploadDir, 'fotos'));
        case 'proposal': return ensureDir(path.join(uploadDir, 'proposal'));
        case 'bast': return ensureDir(path.join(uploadDir, 'bast'));
        case 'kerusakan': return ensureDir(path.join(uploadDir, 'form-kerusakan'));
        case 'prestasi': return ensureDir(path.join(uploadDir, 'sertifikat'));
        case 'template': return ensureDir(getTemplatePath());
        default: return ensureDir(path.join(uploadDir, 'lainnya'));
    }
}

// ===================================================================
// MULTER UPLOAD PRESETS (all save to temp first)
// ===================================================================

export const uploadFotos = multer({
    storage: tempStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 500 * 1024, files: 5 },
});

export const uploadSertifikat = multer({
    storage: tempStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadFormKerusakan = multer({
    storage: tempStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadProposal = multer({
    storage: tempStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadBast = multer({
    storage: tempStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadKopSekolah = multer({
    storage: tempStorage,
    limits: { fileSize: 1 * 1024 * 1024 },
});

export const uploadTemplate = multer({
    storage: tempStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
});
