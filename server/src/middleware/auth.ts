import type { Request, Response, NextFunction } from 'express';
import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';

// Extend Express Request with user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                name: string;
                email: string;
                role: string;
                sekolahId?: number;
                aktif?: boolean;
            };
        }
    }
}

/**
 * Middleware: Require authenticated user
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session?.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check if user is active
        if ((session.user as any).aktif === false) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        req.user = {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: (session.user as any).role || 'sekolah',
            sekolahId: (session.user as any).sekolahId,
            aktif: (session.user as any).aktif,
        };

        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid session' });
    }
};

/**
 * Middleware: Require specific role(s)
 * Usage: requireRole('admin', 'verifikator')
 */
export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: insufficient role' });
            return;
        }

        next();
    };
};
