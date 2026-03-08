import { aktivitasService } from '../services/aktivitas.service.js';
import type { Request } from 'express';

/**
 * Helper to log user activity after a successful action.
 * Call this at the end of route handlers.
 */
export async function logActivity(req: Request, aktivitas: string, keterangan?: string) {
    try {
        if (!req.user) return;
        await aktivitasService.log({
            userId: req.user.id,
            namaAkun: req.user.name || req.user.email,
            jenisAkun: req.user.role || 'unknown',
            aktivitas,
            keterangan: keterangan || '',
            ipAddress: req.ip || req.headers['x-real-ip'] as string || '',
        });
    } catch (_e) {
        // Don't fail the main request if logging fails
    }
}
