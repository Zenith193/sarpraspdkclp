import { riwayatBantuan } from '../db/schema/index.js';
export declare const riwayatBantuanService: {
    list(filters: {
        sekolahId?: number;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: {
            riwayatBantuan: {
                id: number;
                sekolahId: number;
                namaPaket: string;
                nilaiPaket: number | null;
                volumePaket: string | null;
                bastId: number | null;
                tahun: number | null;
                createdAt: Date | null;
            };
            sekolahNama: string | null;
            sekolahNpsn: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(id: number): Promise<{
        id: number;
        sekolahId: number;
        namaPaket: string;
        nilaiPaket: number | null;
        volumePaket: string | null;
        bastId: number | null;
        tahun: number | null;
        createdAt: Date | null;
    }>;
    create(data: typeof riwayatBantuan.$inferInsert): Promise<{
        id: number;
        sekolahId: number;
        createdAt: Date | null;
        namaPaket: string;
        tahun: number | null;
        nilaiPaket: number | null;
        volumePaket: string | null;
        bastId: number | null;
    }>;
    update(id: number, data: Partial<typeof riwayatBantuan.$inferInsert>): Promise<{
        id: number;
        sekolahId: number;
        namaPaket: string;
        nilaiPaket: number | null;
        volumePaket: string | null;
        bastId: number | null;
        tahun: number | null;
        createdAt: Date | null;
    }>;
    delete(id: number): Promise<void>;
};
