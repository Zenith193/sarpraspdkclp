export declare const aktivitasService: {
    list(filters: {
        jenisAkun?: string;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: {
            id: number;
            userId: string | null;
            namaAkun: string | null;
            jenisAkun: string | null;
            aktivitas: string;
            keterangan: string | null;
            ipAddress: string | null;
            createdAt: Date | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getByUserId(userId: string, limit?: number): Promise<{
        id: number;
        userId: string | null;
        namaAkun: string | null;
        jenisAkun: string | null;
        aktivitas: string;
        keterangan: string | null;
        ipAddress: string | null;
        createdAt: Date | null;
    }[]>;
    log(data: {
        userId?: string;
        namaAkun: string;
        jenisAkun: string;
        aktivitas: string;
        keterangan?: string;
        ipAddress?: string;
    }): Promise<{
        id: number;
        createdAt: Date | null;
        ipAddress: string | null;
        userId: string | null;
        keterangan: string | null;
        aktivitas: string;
        namaAkun: string | null;
        jenisAkun: string | null;
    }[]>;
    delete(id: number): Promise<void>;
};
