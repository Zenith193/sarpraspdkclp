export declare const dashboardService: {
    getAdminStats(): Promise<{
        totalSekolah: number;
        sarpras: {
            total: number;
            baik: number;
            rusakRingan: number;
            rusakSedang: number;
            rusakBerat: number;
            verified: number;
        };
        proposal: {
            total: number;
            menunggu: number;
            disetujui: number;
            ditolak: number;
            revisi: number;
        };
        totalUser: number;
    }>;
    getKorwilStats(kecamatanList: string[]): Promise<{
        totalSekolah: number;
        sarpras: {
            total: number;
        };
        proposal: {
            total: number;
        };
    } | {
        totalSekolah: number;
        sarpras: {
            total: number;
            verified: number;
        };
        proposal?: undefined;
    }>;
    getSekolahStats(sekolahId: number): Promise<{
        sarpras: {
            total: number;
            baik: number;
            rusak: number;
        };
        proposal: {
            total: number;
        };
    }>;
};
