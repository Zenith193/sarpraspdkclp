import { pencairan } from '../db/schema/index.js';
export declare const pencairanService: {
    list(): Promise<{
        pencairan: {
            id: number;
            matrikId: number;
            pencairanPersen: number | null;
            status: string | null;
            noRegister: string | null;
            noSp2d: string | null;
            hariKalender: number | null;
            updatedAt: Date | null;
        };
        matrikNoMatrik: string | null;
        matrikNamaSekolah: string | null;
        matrikNamaPaket: string | null;
        matrikNilaiKontrak: number | null;
    }[]>;
    getByMatrikId(matrikId: number): Promise<{
        id: number;
        matrikId: number;
        pencairanPersen: number | null;
        status: string | null;
        noRegister: string | null;
        noSp2d: string | null;
        hariKalender: number | null;
        updatedAt: Date | null;
    }>;
    upsert(matrikId: number, data: Partial<typeof pencairan.$inferInsert>): Promise<{
        id: number;
        updatedAt: Date | null;
        status: string | null;
        matrikId: number;
        pencairanPersen: number | null;
        noRegister: string | null;
        noSp2d: string | null;
        hariKalender: number | null;
    }>;
};
