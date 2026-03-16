import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index';
import * as schema from '../db/schema/index';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,      // 1 day
    },
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: 'sekolah',
                input: true,
            },
            sekolahId: {
                type: 'number',
                required: false,
                input: true,
            },
            aktif: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                input: true,
            },
        },
    },
    hooks: {
        after: [
            {
                matcher(context) {
                    return context.path === '/sign-in/email';
                },
                async handler(ctx) {
                    // After sign-in, check if user is disabled
                    const response = ctx.response;
                    if (response && response.status === 200) {
                        try {
                            const body = ctx.responseBody as any;
                            const userId = body?.user?.id;
                            if (userId) {
                                const { user: userTable } = await import('../db/schema/index.js');
                                const { eq } = await import('drizzle-orm');
                                const rows = await db.select({ aktif: userTable.aktif }).from(userTable).where(eq(userTable.id, userId));
                                if (rows[0] && rows[0].aktif === false) {
                                    // Delete the session that was just created
                                    const { session: sessionTable } = await import('../db/schema/index.js');
                                    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
                                    return {
                                        response: Response.json(
                                            { code: 'ACCOUNT_DISABLED', message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' },
                                            { status: 403 }
                                        ),
                                    };
                                }
                            }
                        } catch (e) {
                            console.error('[Auth] Hook error:', e);
                        }
                    }
                },
            },
        ],
    },
    trustedOrigins: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3000',
        'http://sarpraspdkclp.site',
        'https://sarpraspdkclp.site',
        'http://www.sarpraspdkclp.site',
        'https://www.sarpraspdkclp.site',
        'http://sarpraspdkclp.id',
        'https://sarpraspdkclp.id',
        'http://www.sarpraspdkclp.id',
        'https://www.sarpraspdkclp.id',
        'http://202.155.18.22',
        ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : []),
    ],
});

