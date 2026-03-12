import { proyeksiAnggaran, snpAcuan } from '../db/schema/index.js';
export declare const proyeksiService: {
    listAnggaran(): Promise<{
        id: number;
        jenisPrasarana: string;
        jenjang: string;
        lantai: number | null;
        rusakSedang: number | null;
        rusakBerat: number | null;
        pembangunan: number | null;
        updatedAt: Date | null;
    }[]>;
    createAnggaran(data: typeof proyeksiAnggaran.$inferInsert): Promise<{
        id: number;
        updatedAt: Date | null;
        jenjang: string;
        jenisPrasarana: string;
        lantai: number | null;
        rusakSedang: number | null;
        rusakBerat: number | null;
        pembangunan: number | null;
    }>;
    updateAnggaran(id: number, data: Partial<typeof proyeksiAnggaran.$inferInsert>): Promise<{
        id: number;
        jenisPrasarana: string;
        jenjang: string;
        lantai: number | null;
        rusakSedang: number | null;
        rusakBerat: number | null;
        pembangunan: number | null;
        updatedAt: Date | null;
    }>;
    deleteAnggaran(id: number): Promise<void>;
    listSnp(): Promise<{
        id: number;
        jenisPrasarana: string;
        jenjang: string;
        judulRehabilitasi: string | null;
        judulPembangunan: string | null;
    }[]>;
    createSnp(data: typeof snpAcuan.$inferInsert): Promise<{
        id: number;
        jenjang: string;
        jenisPrasarana: string;
        judulRehabilitasi: string | null;
        judulPembangunan: string | null;
    }>;
    updateSnp(id: number, data: Partial<typeof snpAcuan.$inferInsert>): Promise<{
        id: number;
        jenisPrasarana: string;
        jenjang: string;
        judulRehabilitasi: string | null;
        judulPembangunan: string | null;
    }>;
    deleteSnp(id: number): Promise<void>;
    getRekap(): Promise<{
        schools: any[];
        globalStats: {
            totalRS: number;
            totalRB: number;
            totalBuild: number;
            grandTotal: number;
        };
    }>;
};
