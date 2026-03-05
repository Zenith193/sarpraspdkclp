import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directories exist
const dirs = ['fotos', 'sertifikat', 'form-kerusakan', 'bast', 'proposal'];
dirs.forEach(dir => {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Storage config
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.join(uploadDir, 'fotos'));
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// File filter for images
const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
};

// File filter for PDFs
const pdfFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
};

// Upload presets
export const uploadFotos = multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 500 * 1024, files: 5 }, // 500KB per file, max 5
});

export const uploadSertifikat = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, path.join(uploadDir, 'sertifikat')),
        filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        },
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadFormKerusakan = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, path.join(uploadDir, 'form-kerusakan')),
        filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        },
    }),
    fileFilter: pdfFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
