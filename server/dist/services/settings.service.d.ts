export declare const settingsService: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        id: number;
        key: string;
        value: unknown;
        updatedAt: Date | null;
    }[]>;
    reset(key: string): Promise<{
        id: number;
        key: string;
        value: unknown;
        updatedAt: Date | null;
    }[] | null>;
};
