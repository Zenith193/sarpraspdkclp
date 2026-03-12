import { db } from '../db/index.js';
import { sarpras, sarprasFoto, sekolah } from '../db/schema/index.js';
import { eq, ilike, and, sql } from 'drizzle-orm';
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
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)` }).from(sarpras).where(where),
        ]);

        // Load fotos for all sarpras in batch
        const sarprasIds = data.map(d => d.sarpras.id);
        let fotos: any[] = [];
        if (sarprasIds.length > 0) {
            fotos = await db.select().from(sarprasFoto).where(sql`${sarprasFoto.sarprasId} IN (${sql.join(sarprasIds.map(id => sql`${id}`), sql`, `)})`);
        }

        // Map fotos onto sarpras items
        const dataWithFotos = data.map(d => {
            const itemFotos = fotos.filter(f => f.sarprasId === d.sarpras.id);
            const fotoTimestamps = itemFotos.map(f => f.createdAt ? new Date(f.createdAt).getTime() : 0).filter(t => t > 0);
            const lastFotoAt = fotoTimestamps.length > 0 ? new Date(Math.max(...fotoTimestamps)).toISOString() : null;

            return {
                ...d,
                sarpras: {
                    ...d.sarpras,
                    lastFotoAt,
                    foto: itemFotos.map(f => {
                        const proxyUrl = `/api/foto/${f.id}`;
                        return {
                            id: f.id,
                            name: f.fileName,
                            url: proxyUrl,
                            proxyUrl,
                            size: f.fileSize || 0,
                            geo: (f.geoLat && f.geoLng) ? { lat: f.geoLat, lng: f.geoLng } : null,
                            geoLat: f.geoLat,
                            geoLng: f.geoLng,
                        };
                    }),
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
