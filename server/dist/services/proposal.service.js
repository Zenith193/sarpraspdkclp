import { db } from '../db/index.js';
import { proposal, proposalFoto, sekolah } from '../db/schema/index.js';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { queueGDriveDelete } from '../utils/uploadQueue.js';
export const proposalService = {
    async list(filters) {
        const { status, keranjang, kecamatan, jenjang, sekolahId, search, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (sekolahId)
            conditions.push(eq(proposal.sekolahId, sekolahId));
        if (status)
            conditions.push(eq(proposal.status, status));
        if (keranjang)
            conditions.push(eq(proposal.keranjang, keranjang));
        if (kecamatan)
            conditions.push(eq(sekolah.kecamatan, kecamatan));
        if (jenjang)
            conditions.push(eq(sekolah.jenjang, jenjang));
        if (search)
            conditions.push(ilike(proposal.subKegiatan, `%${search}%`));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;
        const [data, countResult] = await Promise.all([
            db.select({ proposal, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn, sekolahKecamatan: sekolah.kecamatan, sekolahJenjang: sekolah.jenjang })
                .from(proposal).leftJoin(sekolah, eq(proposal.sekolahId, sekolah.id)).where(where).limit(limit).offset(offset),
            db.select({ count: sql `count(*)` }).from(proposal).leftJoin(sekolah, eq(proposal.sekolahId, sekolah.id)).where(where),
        ]);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },
    async getById(id) {
        const result = await db.select({ proposal, sekolahNama: sekolah.nama, sekolahNpsn: sekolah.npsn })
            .from(proposal).leftJoin(sekolah, eq(proposal.sekolahId, sekolah.id)).where(eq(proposal.id, id));
        if (!result[0])
            return null;
        const fotos = await db.select().from(proposalFoto).where(eq(proposalFoto.proposalId, id));
        return { ...result[0], fotos };
    },
    async create(data, userId) {
        const result = await db.insert(proposal).values({ ...data, createdBy: userId }).returning();
        return result[0];
    },
    async update(id, data) {
        // Delete old GDrive file if filePath is being replaced
        if (data.filePath) {
            const existing = await db.select().from(proposal).where(eq(proposal.id, id));
            if (existing[0])
                queueGDriveDelete(existing[0].filePath);
        }
        const result = await db.update(proposal).set({ ...data, updatedAt: new Date() }).where(eq(proposal.id, id)).returning();
        return result[0];
    },
    async delete(id) {
        // Delete proposal PDF from GDrive
        const existing = await db.select().from(proposal).where(eq(proposal.id, id));
        if (existing[0])
            queueGDriveDelete(existing[0].filePath);
        // Delete all proposal fotos from GDrive
        const fotos = await db.select().from(proposalFoto).where(eq(proposalFoto.proposalId, id));
        for (const f of fotos)
            queueGDriveDelete(f.filePath);
        await db.delete(proposal).where(eq(proposal.id, id));
    },
    async updateStatus(id, status, userId) {
        return db.update(proposal).set({ status, verifiedBy: userId, updatedAt: new Date() }).where(eq(proposal.id, id)).returning();
    },
    async updateKeranjang(id, keranjang) {
        return db.update(proposal).set({ keranjang, updatedAt: new Date() }).where(eq(proposal.id, id)).returning();
    },
    async updateRanking(id, ranking, bintang) {
        return db.update(proposal).set({ ranking, bintang, updatedAt: new Date() }).where(eq(proposal.id, id)).returning();
    },
    async addFoto(proposalId, data) {
        const result = await db.insert(proposalFoto).values({ ...data, proposalId }).returning();
        return result[0];
    },
    async removeFoto(fotoId) {
        const foto = await db.select().from(proposalFoto).where(eq(proposalFoto.id, fotoId));
        if (foto[0])
            queueGDriveDelete(foto[0].filePath);
        await db.delete(proposalFoto).where(eq(proposalFoto.id, fotoId));
    },
};
