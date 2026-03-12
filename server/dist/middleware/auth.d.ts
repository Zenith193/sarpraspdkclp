import type { Request, Response, NextFunction } from 'express';
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
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware: Require specific role(s)
 * Usage: requireRole('admin', 'verifikator')
 */
export declare const requireRole: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
