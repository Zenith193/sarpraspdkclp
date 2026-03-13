import { db } from '../db/index.js';
import { sarpras, sarprasFoto, sekolah } from '../db/schema/index.js';
import { eq, ilike, and, sql, asc } from 'drizzle-orm';
import { queueGDriveDelete } from '../utils/uploadQueue.js';

export const sarprasService = {
    async list(filters: { sekolahId?: number; kecamatan?: string; jenjang?: string; kondisi?: string; verified?: string; search?: string; page?: number; limit?: number }) {
        const { sekolahId, kecamatan, jenjang, kondisi, verified, search, page = 1, limit = 50 } = filters;
        const conditions = [];

        if (sekolahId) conditions.push(eq(sarpras.sekolahId, sekolahId));
        if (kecamatan) conditions.push(eq(sekolah.kecamatan, kecamatan));
        if (jenjang) conditions.push(eq(sekolah.jenjang, jenjang));
        if (kondisi) conditions.push(eq(sarpras.kondisi, kondisi));
        if (verified === 'true') conditions.push(eq(sarpras.verified, true));
        if (verified === 'false') conditions.push(eq(sarpras.verified, false));
        if (search) conditions.push(ilike(sarpras.namaRuang, `%${search}%`));

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const [data, countResult] = await Promise.all([
            db.select({
                sarpras,
                sekolahNama: sekolah.nama,
                sekolahNpsn: sekolah.npsn,
                sekolahKecamatan: sekolah.kecamatan,
                sekolahJenjang: sekolah.jenjang,
            })
                .from(sarpras)
                .leftJoin(sekolah, eq(sarpras.sekolahId, sekolah.id))
                .where(where)
                .orderBy(asc(sekolah.kecamatan), asc(sekolah.npsn))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)` }).from(sarpras).leftJoin(sekolah, eq(sarpras.sekolahId, sekolah.id)).where(where),
        ]);

        // Load foto counts and last foto timestamp in batch (no full foto data — too large for list)
        const sarprasIds = data.map(d => d.sarpras.id);
        let fotoCounts: Record<number, { count: number; lastAt: string | null }> = {};
        if (sarprasIds.length > 0) {
            const fotoStats = await db.select({
                sarprasId: sarprasFoto.sarprasId,
                count: sql<number>`count(*)`,
                lastAt: sql<string>`max(${sarprasFoto.createdAt})`,
            }).from(sarprasFoto)
              .where(sql`${sarprasFoto.sarprasId} IN (${sql.join(sarprasIds.map(id => sql`${id}`), sql`, `)})`)
              .groupBy(sarprasFoto.sarprasId);
            for (const row of fotoStats) {
                fotoCounts[row.sarprasId] = { count: Number(row.count), lastAt: row.lastAt };
            }
        }

        // Map foto counts onto sarpras items (no full foto data to keep payload small)
        const dataWithFotos = data.map(d => {
            const stats = fotoCounts[d.sarpras.id] || { count: 0, lastAt: null };
            return {
                ...d,
                sarpras: {
                    ...d.sarpras,
                    lastFotoAt: stats.lastAt ? new Date(stats.lastAt).toISOString() : null,
                    fotoCount: stats.count,
                    foto: [], // Empty array — detail view via getById() returns full fotos
                },
            };
        });

        return { data: dataWithFotos, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: number) {
        const result = await db.select({
            sarpras,
            sekolahNama: sekolah.nama,
            sekolahNpsn: sekolah.npsn,
            sekolahKecamatan: sekolah.kecamatan,
        })
            .from(sarpras)
            .leftJoin(sekolah, eq(sarpras.sekolahId, sekolah.id))
            .where(eq(sarpras.id, id));

        if (!result[0]) return null;

        const fotos = await db.select().from(sarprasFoto).where(eq(sarprasFoto.sarprasId, id));
        return { ...result[0], fotos };
    },

    async create(data: typeof sarpras.$inferInsert, userId: string) {
        const luas = (data.panjang || 0) * (data.lebar || 0);
        const result = await db.insert(sarpras).values({ ...data, luas, createdBy: userId }).returning();
        return result[0];
    },

    async batchCreate(items: (typeof sarpras.$inferInsert)[], userId: string) {
        const rows = items.map(item => ({
            ...item,
            luas: (item.panjang || 0) * (item.lebar || 0),
            createdBy: userId,
        }));
        const result = await db.insert(sarpras).values(rows).returning();
        return result;
    },

    async update(id: number, data: Partial<typeof sarpras.$inferInsert>) {
        const luas = (data.panjang && data.lebar) ? data.panjang * data.lebar : undefined;
        const result = await db.update(sarpras)
            .set({ ...data, ...(luas !== undefined ? { luas } : {}), updatedAt: new Date() })
            .where(eq(sarpras.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        // Delete GDrive files for all fotos of this sarpras
        const fotos = await db.select().from(sarprasFoto).where(eq(sarprasFoto.sarprasId, id));
        for (const f of fotos) {
            queueGDriveDelete(f.filePath);
        }
        await db.delete(sarpras).where(eq(sarpras.id, id));
    },

    async verify(id: number, userId: string) {
        return db.update(sarpras)
            .set({ verified: true, verifiedBy: userId, verifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(sarpras.id, id)).returning();
    },

    async unverify(id: number) {
        return db.update(sarpras)
            .set({ verified: false, verifiedBy: null, verifiedAt: null, updatedAt: new Date() })
            .where(eq(sarpras.id, id)).returning();
    },

    async addFoto(sarprasId: number, data: typeof sarprasFoto.$inferInsert) {
        const result = await db.insert(sarprasFoto).values({ ...data, sarprasId }).returning();
        return result[0];
    },

    async removeFoto(fotoId: number) {
        // Delete GDrive file before removing DB record
        const foto = await db.select().from(sarprasFoto).where(eq(sarprasFoto.id, fotoId));
        if (foto[0]) queueGDriveDelete(foto[0].filePath);
        await db.delete(sarprasFoto).where(eq(sarprasFoto.id, fotoId));
    },

    async getStats() {
        const stats = await db.select({
            total: sql<number>`count(*)`,
            baik: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'BAIK')`,
            rusakRingan: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK RINGAN')`,
            rusakSedang: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK SEDANG')`,
            rusakBerat: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK BERAT')`,
            verified: sql<number>`count(*) filter (where ${sarpras.verified} = true)`,
        }).from(sarpras);
        return stats[0];
    },
};
