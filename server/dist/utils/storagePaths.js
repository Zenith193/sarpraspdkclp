import path from 'path';
import fs from 'fs';
/**
 * ===================================================================
 * NAS STORAGE PATH GENERATOR
 * ===================================================================
 *
 * Struktur penyimpanan hierarkis berbasis:
 *   /{root}/{Kecamatan}/{NamaSekolah_NPSN}/
 *       ├── sarpras/{MasaBangunan}/{NamaRuang}/   ← foto kondisi sarpras
 *       ├── proposal/{Tahun}/                     ← dokumen proposal
 *       ├── bast/                                 ← dokumen BAST
 *       ├── kerusakan/                            ← form kerusakan
 *       ├── prestasi/                             ← sertifikat prestasi
 *       ├── kop-sekolah/                          ← file kop sekolah
 *       └── lainnya/                              ← file lainnya
 *
 * Folder khusus (bukan per-sekolah):
 *   /{root}/_sistem/
 *       ├── template/                             ← template dokumen
 *       └── backup/                               ← backup database
 */
const uploadRoot = process.env.UPLOAD_DIR || './uploads';
// Sanitize folder name: remove special chars, replace spaces with underscore
function sanitize(name) {
    return (name || 'unknown')
        .trim()
        .replace(/[<>:"/\\|?*]/g, '') // remove illegal chars
        .replace(/\s+/g, '_') // spaces to underscore
        .replace(/_+/g, '_') // collapse multiple underscores
        .substring(0, 100); // limit length
}
/**
 * Path dasar sekolah: /{root}/{Kecamatan}/{NamaSekolah_NPSN}/
 */
export function getSekolahBasePath(sekolah) {
    const kec = sanitize(sekolah.kecamatan);
    const nama = sanitize(sekolah.nama) + '_' + sekolah.npsn;
    return path.join(uploadRoot, kec, nama);
}
/**
 * Foto sarpras: /{root}/{Kecamatan}/{Sekolah}/sarpras/{MasaBangunan}/{NamaRuang}/
 */
export function getSarprasFotoPath(sekolah, sarpras) {
    const base = getSekolahBasePath(sekolah);
    const masa = sanitize(sarpras.masaBangunan || 'Tidak_diketahui');
    const ruang = sanitize(sarpras.namaRuang);
    return path.join(base, 'sarpras', masa, ruang);
}
/**
 * Proposal: /{root}/{Kecamatan}/{Sekolah}/proposal/{Tahun}/
 */
export function getProposalPath(sekolah, tahun) {
    const base = getSekolahBasePath(sekolah);
    const yr = tahun || new Date().getFullYear().toString();
    return path.join(base, 'proposal', yr);
}
/**
 * BAST: /{root}/{Kecamatan}/{Sekolah}/bast/
 */
export function getBastPath(sekolah) {
    return path.join(getSekolahBasePath(sekolah), 'bast');
}
/**
 * Form Kerusakan: /{root}/{Kecamatan}/{Sekolah}/kerusakan/
 */
export function getKerusakanPath(sekolah) {
    return path.join(getSekolahBasePath(sekolah), 'kerusakan');
}
/**
 * Prestasi: /{root}/{Kecamatan}/{Sekolah}/prestasi/
 */
export function getPrestasiPath(sekolah) {
    return path.join(getSekolahBasePath(sekolah), 'prestasi');
}
/**
 * Kop Sekolah: /{root}/{Kecamatan}/{Sekolah}/dokumen/
 */
export function getKopSekolahPath(sekolah) {
    return path.join(getSekolahBasePath(sekolah), 'dokumen');
}
/**
 * Denah Sekolah: /{root}/{Kecamatan}/{Sekolah}/dokumen/
 */
export function getDenahSekolahPath(sekolah) {
    return path.join(getSekolahBasePath(sekolah), 'dokumen');
}
/**
 * Template (sistem): /{root}/_sistem/template/
 */
export function getTemplatePath() {
    return path.join(uploadRoot, '_sistem', 'template');
}
/**
 * Backup (sistem): /{root}/_sistem/backup/
 */
export function getBackupPath() {
    return path.join(uploadRoot, '_sistem', 'backup');
}
/**
 * Ensure a directory exists, create recursively if not.
 */
export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}
/**
 * Get example tree structure for a given school (for display purposes).
 */
export function getStorageTree(sekolah) {
    const kec = sanitize(sekolah.kecamatan);
    const nama = sanitize(sekolah.nama) + '_' + sekolah.npsn;
    return `${uploadRoot}/
  └── ${kec}/
      └── ${nama}/
          ├── sarpras/
          │   ├── {Masa_Bangunan}/
          │   │   └── {Nama_Ruang}/
          │   │       ├── foto1.jpg
          │   │       └── foto2.jpg
          ├── proposal/
          │   └── {Tahun}/
          │       └── dokumen.pdf
          ├── bast/
          ├── kerusakan/
          ├── prestasi/
          └── kop-sekolah/`;
}
