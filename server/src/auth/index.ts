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
        before: [
            {
                matcher(context) {
                    return context.path === '/sign-in/email';
                },
                async handler(ctx) {
                    try {
                        const body = ctx.body as any;
                        const email = body?.email;
                        if (!email) return;

                        const { user: userTable } = await import('../db/schema/index.js');
                        const { eq } = await import('drizzle-orm');
                        const rows = await db.select({ aktif: userTable.aktif }).from(userTable).where(eq(userTable.email, email));
                        if (rows[0] && rows[0].aktif === false) {
                            return {
                                response: new Response(
                                    JSON.stringify({ code: 'ACCOUNT_DISABLED', message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }),
                                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                                ),
                            };
                        }
                    } catch (e) {
                        console.error('[Auth] Before hook error:', e);
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

