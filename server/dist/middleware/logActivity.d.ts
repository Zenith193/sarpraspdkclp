import type { Request } from 'express';
/**
 * Helper to log user activity after a successful action.
 * Call this at the end of route handlers.
 */
export declare function logActivity(req: Request, aktivitas: string, keterangan?: string): Promise<void>;
