import { db } from '../db/index.js';
import { formKerusakan, sekolah } from '../db/schema/index.js';
import { eq, and, sql, notInArray, isNotNull } from 'drizzle-orm';
import { queueGDriveDelete } from '../utils/uploadQueue.js';

export const kerusakanService = {
    async list(filters: { sekolahId?: number; search?: string; page?: number; limit?: number }) {
        const { sekolahId, search, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (sekolahId) conditions.push(eq(formKerusakan.sekolahId, sekolahId));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;
        const data = await db.select({ formKerusakan, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn, sekolahKecamatan: sekolah.kecamatan })
            .from(formKerusakan).leftJoin(sekolah, eq(formKerusakan.sekolahId, sekolah.id)).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(formKerusakan).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },
    async getById(id: number) {
        const result = await db.select({ formKerusakan, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn, sekolahKecamatan: sekolah.kecamatan })
            .from(formKerusakan).leftJoin(sekolah, eq(formKerusakan.sekolahId, sekolah.id)).where(eq(formKerusakan.id, id));
        return result[0] || null;
    },
    async create(data: typeof formKerusakan.$inferInsert, userId: string) {
        const r = await db.insert(formKerusakan).values({ ...data, uploadedBy: userId }).returning(); return r[0];
    },
    async updateFile(id: number, fileName: string, filePath: string, uploadStatus: string = 'done') {
        // Delete old GDrive file before replacing
        const existing = await db.select().from(formKerusakan).where(eq(formKerusakan.id, id));
        if (existing[0]) queueGDriveDelete(existing[0].filePath);
        return db.update(formKerusakan).set({ fileName, filePath, uploadStatus, status: 'Menunggu Verifikasi', updatedAt: new Date() }).where(eq(formKerusakan.id, id)).returning();
    },
    async delete(id: number) {
        // Delete GDrive file before removing DB record
        const existing = await db.select().from(formKerusakan).where(eq(formKerusakan.id, id));
        if (existing[0]) queueGDriveDelete(existing[0].filePath);
        await db.delete(formKerusakan).where(eq(formKerusakan.id, id));
    },
    async verify(id: number, userId: string) { return db.update(formKerusakan).set({ status: 'Diverifikasi', verifiedBy: userId, updatedAt: new Date() }).where(eq(formKerusakan.id, id)).returning(); },
    async reject(id: number, userId: string, alasan: string) { return db.update(formKerusakan).set({ status: 'Ditolak', verifiedBy: userId, alasanPenolakan: alasan, updatedAt: new Date() }).where(eq(formKerusakan.id, id)).returning(); },
    async unverify(id: number) { return db.update(formKerusakan).set({ status: 'Menunggu Verifikasi', verifiedBy: null, updatedAt: new Date() }).where(eq(formKerusakan.id, id)).returning(); },
    async getMissingSchools() {
        const uploaded = await db.select({ sekolahId: formKerusakan.sekolahId }).from(formKerusakan).where(isNotNull(formKerusakan.fileName));
        const uploadedIds = uploaded.map(u => u.sekolahId);
        if (uploadedIds.length === 0) return db.select().from(sekolah);
        return db.select().from(sekolah).where(notInArray(sekolah.id, uploadedIds));
    },
};
