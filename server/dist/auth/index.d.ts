export declare const auth: import("better-auth").Auth<{
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    emailAndPassword: {
        enabled: true;
    };
    session: {
        expiresIn: number;
        updateAge: number;
    };
    user: {
        additionalFields: {
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: true;
            };
            sekolahId: {
                type: "number";
                required: false;
                input: true;
            };
            aktif: {
                type: "boolean";
                required: false;
                defaultValue: true;
                input: true;
            };
        };
    };
    trustedOrigins: string[];
}>;
