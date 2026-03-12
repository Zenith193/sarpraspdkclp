import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';
/**
 * Middleware: Require authenticated user
 */
export const requireAuth = async (req, res, next) => {
    try {
        // Try Better Auth's session check first
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (session?.user) {
            // Check if user is active
            if (session.user.aktif === false) {
                res.status(403).json({ error: 'Account is deactivated' });
                return;
            }
            req.user = {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                role: session.user.role || 'sekolah',
                sekolahId: session.user.sekolahId,
                aktif: session.user.aktif,
            };
            next();
            return;
        }
        // Fallback: check session table directly (for custom NPSN login sessions)
        const cookieHeader = req.headers.cookie || '';
        const tokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
        if (tokenMatch) {
            const token = tokenMatch[1];
            const { db } = await import('../db/index.js');
            const { session: sessionTable, user: userTable } = await import('../db/schema/index.js');
            const { eq, and, gt } = await import('drizzle-orm');
            const sessions = await db
                .select({
                sessionId: sessionTable.id,
                userId: sessionTable.userId,
                expiresAt: sessionTable.expiresAt,
                userName: userTable.name,
                userEmail: userTable.email,
                userRole: userTable.role,
                userSekolahId: userTable.sekolahId,
                userAktif: userTable.aktif,
            })
                .from(sessionTable)
                .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
                .where(and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date())));
            const found = sessions[0];
            if (found) {
                if (found.userAktif === false) {
                    res.status(403).json({ error: 'Account is deactivated' });
                    return;
                }
                req.user = {
                    id: found.userId,
                    name: found.userName,
                    email: found.userEmail,
                    role: found.userRole || 'sekolah',
                    sekolahId: found.userSekolahId ?? undefined,
                    aktif: found.userAktif ?? undefined,
                };
                next();
                return;
            }
        }
        res.status(401).json({ error: 'Unauthorized' });
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid session' });
    }
};
/**
 * Middleware: Require specific role(s)
 * Usage: requireRole('admin', 'verifikator')
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userRole = req.user.role.toLowerCase();
        if (!roles.some(r => r.toLowerCase() === userRole)) {
            res.status(403).json({ error: 'Forbidden: insufficient role' });
            return;
        }
        next();
    };
};
