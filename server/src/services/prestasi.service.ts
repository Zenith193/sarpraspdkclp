import { db } from '../db/index.js';
import { prestasi, prestasiPointRule, sekolah } from '../db/schema/index.js';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { deleteGDriveFile } from '../utils/googleDriveClient.js';

export const prestasiService = {
    async list(filters: { sekolahId?: number; search?: string; page?: number; limit?: number }) {
        const { sekolahId, search, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (sekolahId) conditions.push(eq(prestasi.sekolahId, sekolahId));
        if (search) conditions.push(ilike(prestasi.jenisPrestasi, `%${search}%`));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select({ prestasi, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn, sekolahKecamatan: sekolah.kecamatan })
            .from(prestasi).leftJoin(sekolah, eq(prestasi.sekolahId, sekolah.id)).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(prestasi).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async create(data: typeof prestasi.$inferInsert, userId: string) {
        const result = await db.insert(prestasi).values({ ...data, createdBy: userId }).returning();
        return result[0];
    },
    async update(id: number, data: Partial<typeof prestasi.$inferInsert>) {
        const result = await db.update(prestasi).set({ ...data, updatedAt: new Date() }).where(eq(prestasi.id, id)).returning();
        return result[0];
    },
    async delete(id: number) {
        const existing = await db.select().from(prestasi).where(eq(prestasi.id, id));
        if (existing[0]) await deleteGDriveFile(existing[0].sertifikatPath);
        await db.delete(prestasi).where(eq(prestasi.id, id));
    },

    async verify(id: number, userId: string) {
        return db.update(prestasi).set({ status: 'Diverifikasi', verifiedBy: userId, updatedAt: new Date() }).where(eq(prestasi.id, id)).returning();
    },
    async reject(id: number, userId: string, alasan: string) {
        return db.update(prestasi).set({ status: 'Ditolak', verifiedBy: userId, alasanPenolakan: alasan, updatedAt: new Date() }).where(eq(prestasi.id, id)).returning();
    },
    async unverify(id: number) {
        return db.update(prestasi).set({ status: 'Menunggu Verifikasi', verifiedBy: null, updatedAt: new Date() }).where(eq(prestasi.id, id)).returning();
    },

    // ===== POINT RULES =====
    async listPointRules() { return db.select().from(prestasiPointRule); },
    async createPointRule(data: typeof prestasiPointRule.$inferInsert) {
        const r = await db.insert(prestasiPointRule).values(data).returning(); return r[0];
    },
    async updatePointRule(id: number, data: Partial<typeof prestasiPointRule.$inferInsert>) {
        const r = await db.update(prestasiPointRule).set(data).where(eq(prestasiPointRule.id, id)).returning(); return r[0];
    },
    async deletePointRule(id: number) { await db.delete(prestasiPointRule).where(eq(prestasiPointRule.id, id)); },

    // ===== REKAP =====
    async getRekap() {
        const allPrestasi = await db.select({ prestasi, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn })
            .from(prestasi).leftJoin(sekolah, eq(prestasi.sekolahId, sekolah.id)).where(eq(prestasi.status, 'Diverifikasi'));
        const rules = await db.select().from(prestasiPointRule);

        const schoolMap: Record<string, { namaSekolah: string; npsn: string; jumlahPrestasi: number; totalPoin: number }> = {};
        allPrestasi.forEach(p => {
            const key = p.sekolahNpsn || '';
            if (!schoolMap[key]) schoolMap[key] = { namaSekolah: p.sekolahNama || '', npsn: key, jumlahPrestasi: 0, totalPoin: 0 };
            const rule = rules.find(r => r.tingkat === p.prestasi.tingkat && r.kategori === p.prestasi.kategori && r.capaian === p.prestasi.capaian);
            schoolMap[key].jumlahPrestasi++;
            schoolMap[key].totalPoin += rule?.poin || 0;
        });
        return Object.values(schoolMap).sort((a, b) => b.totalPoin - a.totalPoin);
    },
};
