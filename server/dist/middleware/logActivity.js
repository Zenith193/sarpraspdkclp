import { aktivitasService } from '../services/aktivitas.service.js';
/**
 * Helper to log user activity after a successful action.
 * Call this at the end of route handlers.
 */
export async function logActivity(req, aktivitas, keterangan) {
    try {
        if (!req.user)
            return;
        await aktivitasService.log({
            userId: req.user.id,
            namaAkun: req.user.name || req.user.email,
            jenisAkun: req.user.role || 'unknown',
            aktivitas,
            keterangan: keterangan || '',
            ipAddress: req.ip || req.headers['x-real-ip'] || '',
        });
    }
    catch (_e) {
        // Don't fail the main request if logging fails
    }
}
