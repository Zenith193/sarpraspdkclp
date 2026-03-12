export declare const korwilService: {
    list(): Promise<{
        korwilAssignment: {
            id: number;
            userId: string;
            kecamatan: string;
            jenjang: string;
        };
        userName: string | null;
        userEmail: string | null;
    }[]>;
    assign(data: {
        userId: string;
        kecamatanList: string[];
        jenjang: string;
    }): Promise<{
        id: number;
        userId: string;
        jenjang: string;
        kecamatan: string;
    }[]>;
    update(userId: string, data: {
        kecamatanList: string[];
        jenjang: string;
    }): Promise<{
        id: number;
        userId: string;
        jenjang: string;
        kecamatan: string;
    }[]>;
    delete(userId: string): Promise<void>;
};
