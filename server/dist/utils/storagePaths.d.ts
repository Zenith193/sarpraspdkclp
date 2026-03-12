export interface SekolahInfo {
    kecamatan: string;
    nama: string;
    npsn: string;
}
export interface SarprasInfo {
    masaBangunan?: string;
    namaRuang: string;
}
/**
 * Path dasar sekolah: /{root}/{Kecamatan}/{NamaSekolah_NPSN}/
 */
export declare function getSekolahBasePath(sekolah: SekolahInfo): string;
/**
 * Foto sarpras: /{root}/{Kecamatan}/{Sekolah}/sarpras/{MasaBangunan}/{NamaRuang}/
 */
export declare function getSarprasFotoPath(sekolah: SekolahInfo, sarpras: SarprasInfo): string;
/**
 * Proposal: /{root}/{Kecamatan}/{Sekolah}/proposal/{Tahun}/
 */
export declare function getProposalPath(sekolah: SekolahInfo, tahun?: string): string;
/**
 * BAST: /{root}/{Kecamatan}/{Sekolah}/bast/
 */
export declare function getBastPath(sekolah: SekolahInfo): string;
/**
 * Form Kerusakan: /{root}/{Kecamatan}/{Sekolah}/kerusakan/
 */
export declare function getKerusakanPath(sekolah: SekolahInfo): string;
/**
 * Prestasi: /{root}/{Kecamatan}/{Sekolah}/prestasi/
 */
export declare function getPrestasiPath(sekolah: SekolahInfo): string;
/**
 * Kop Sekolah: /{root}/{Kecamatan}/{Sekolah}/dokumen/
 */
export declare function getKopSekolahPath(sekolah: SekolahInfo): string;
/**
 * Denah Sekolah: /{root}/{Kecamatan}/{Sekolah}/dokumen/
 */
export declare function getDenahSekolahPath(sekolah: SekolahInfo): string;
/**
 * Template (sistem): /{root}/_sistem/template/
 */
export declare function getTemplatePath(): string;
/**
 * Backup (sistem): /{root}/_sistem/backup/
 */
export declare function getBackupPath(): string;
/**
 * Ensure a directory exists, create recursively if not.
 */
export declare function ensureDir(dirPath: string): string;
/**
 * Get example tree structure for a given school (for display purposes).
 */
export declare function getStorageTree(sekolah: SekolahInfo): string;
