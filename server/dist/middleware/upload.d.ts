import multer from 'multer';
/**
 * Express middleware that forwards uploaded files to NAS after multer saves them to temp.
 * Attaches `nasPath` to each file object for the route handler to use.
 */
export declare function forwardToNas(category: 'sarpras' | 'proposal' | 'bast' | 'kerusakan' | 'prestasi' | 'kop-sekolah' | 'template' | 'backup'): (req: any, _res: any, next: any) => Promise<any>;
export declare const uploadFotos: multer.Multer;
export declare const uploadSertifikat: multer.Multer;
export declare const uploadFormKerusakan: multer.Multer;
export declare const uploadProposal: multer.Multer;
export declare const uploadBast: multer.Multer;
export declare const uploadKopSekolah: multer.Multer;
export declare const uploadDenahSekolah: multer.Multer;
export declare const uploadTemplate: multer.Multer;
