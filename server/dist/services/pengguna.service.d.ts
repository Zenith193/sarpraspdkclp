export declare const penggunaService: {
    list(filters: {
        search?: string;
        role?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: {
            id: string;
            name: string;
            email: string;
            role: string;
            sekolahId: number | null;
            aktif: boolean | null;
            createdAt: Date | null;
            npsn: string | null;
            jenjang: string | null;
            kecamatan: string | null;
            statusSekolah: string | null;
            alamat: string | null;
            kepsek: string | null;
            nip: string;
            noRek: string | null;
            namaBank: string | null;
            rombel: number | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(id: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: string;
        sekolahId: number | null;
        aktif: boolean | null;
        createdAt: Date | null;
        npsn: string | null;
        jenjang: string | null;
        kecamatan: string | null;
        statusSekolah: string | null;
        alamat: string | null;
        kepsek: string | null;
        nip: string;
        noRek: string | null;
        namaBank: string | null;
        rombel: number | null;
    }>;
    update(id: string, data: {
        name?: string;
        role?: string;
        sekolahId?: number;
        aktif?: boolean;
        jenjang?: string;
        kecamatan?: string;
        alamat?: string;
        kepsek?: string;
        nip?: string;
        noRek?: string;
        namaBank?: string;
        rombel?: number;
    }): Promise<{
        id: string;
        name: string;
        email: string;
        emailVerified: boolean | null;
        image: string | null;
        role: string;
        sekolahId: number | null;
        nip: string | null;
        aktif: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    toggleActive(id: string): Promise<{
        id: string;
        name: string;
        email: string;
        emailVerified: boolean | null;
        image: string | null;
        role: string;
        sekolahId: number | null;
        nip: string | null;
        aktif: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    } | null>;
    delete(id: string): Promise<void>;
    batchCreate(users: Array<{
        name: string;
        email: string;
        password?: string;
        role?: string;
        npsn?: string;
        jenjang?: string;
        kecamatan?: string;
        statusSekolah?: string;
        alamat?: string;
        kepsek?: string;
        nip?: string;
        noRek?: string;
        namaBank?: string;
        rombel?: number;
    }>): Promise<{
        results: {
            email: string;
            success: boolean;
            error?: string;
        }[];
        successCount: number;
        failCount: number;
        total: number;
    }>;
};
