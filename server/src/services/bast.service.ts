import { db } from '../db/index.js';
import { bast, bastTemplate, matrikKegiatan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { queueGDriveDelete } from '../utils/uploadQueue.js';

export const bastService = {
    async list() {
        const rows = await db.select({
            bast: bast,
            matrikNilaiKontrak: matrikKegiatan.nilaiKontrak,
            matrikHonor: matrikKegiatan.honor,
            matrikNamaPaket: matrikKegiatan.namaPaket,
            matrikJenisPengadaan: matrikKegiatan.jenisPengadaan,
        }).from(bast)
          .leftJoin(matrikKegiatan, eq(bast.matrikId, matrikKegiatan.id));
        return rows.map(r => {
            const rawKontrak = (r.bast.nilaiKontrak && r.bast.nilaiKontrak > 0) ? r.bast.nilaiKontrak : (r.matrikNilaiKontrak || 0);
            const honor = r.bast.honor || r.matrikHonor || 0;
            const nilaiBAST = r.matrikJenisPengadaan === 'Pekerjaan Konstruksi' ? rawKontrak + honor : rawKontrak;
            return {
                ...r.bast,
                nilaiKontrak: nilaiBAST,
                honor,
                namaPaket: r.bast.namaPaket || r.matrikNamaPaket,
                jenisPengadaan: r.matrikJenisPengadaan,
            };
        });
    },

    async getById(id: number) {
        const result = await db.select().from(bast).where(eq(bast.id, id));
        return result[0] || null;
    },

    async create(data: typeof bast.$inferInsert, userId: string) {
        // Delete any existing BAST for this matrikId to prevent duplicates
        if (data.matrikId) {
            await db.delete(bast).where(eq(bast.matrikId, data.matrikId));
        }
        const result = await db.insert(bast).values({ ...data, createdBy: userId }).returning();
        return result[0];
    },

    async update(id: number, data: Partial<typeof bast.$inferInsert>) {
        const result = await db.update(bast).set(data).where(eq(bast.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(bast).where(eq(bast.id, id));
    },

    async revertByMatrikId(matrikId: number) {
        await db.delete(bast).where(eq(bast.matrikId, matrikId));
    },

    async getByNpsn(npsn: string) {
        const rows = await db.select({
            bast: bast,
            matrikNilaiKontrak: matrikKegiatan.nilaiKontrak,
            matrikHonor: matrikKegiatan.honor,
            matrikNamaPaket: matrikKegiatan.namaPaket,
            matrikJenisPengadaan: matrikKegiatan.jenisPengadaan,
        }).from(bast)
          .leftJoin(matrikKegiatan, eq(bast.matrikId, matrikKegiatan.id))
          .where(eq(bast.npsn, npsn));
        return rows.map(r => {
            const rawKontrak = (r.bast.nilaiKontrak && r.bast.nilaiKontrak > 0) ? r.bast.nilaiKontrak : (r.matrikNilaiKontrak || 0);
            const honor = r.matrikHonor || 0;
            // For Pekerjaan Konstruksi, nilaiBAST includes honor
            const nilaiBAST = r.matrikJenisPengadaan === 'Pekerjaan Konstruksi' ? rawKontrak + honor : rawKontrak;
            return {
                ...r.bast,
                nilaiKontrak: nilaiBAST,
                honor,
                namaPaket: r.bast.namaPaket || r.matrikNamaPaket,
                jenisPengadaan: r.matrikJenisPengadaan,
            };
        });
    },

    async getByMatrikId(matrikId: number) {
        const result = await db.select().from(bast).where(eq(bast.matrikId, matrikId));
        return result[0] || null;
    },

    async updateByMatrikId(matrikId: number, data: Partial<typeof bast.$inferInsert>) {
        const result = await db.update(bast).set(data).where(eq(bast.matrikId, matrikId)).returning();
        return result[0];
    },
};

export const templateService = {
    async list() { return db.select().from(bastTemplate); },
    async getById(id: number) {
        const result = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
        return result[0] || null;
    },
    async create(data: typeof bastTemplate.$inferInsert) {
        const result = await db.insert(bastTemplate).values(data).returning();
        return result[0];
    },
    async update(id: number, data: Partial<typeof bastTemplate.$inferInsert>) {
        // Delete old GDrive file if replacing
        if (data.filePath) {
            const existing = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
            if (existing[0]) queueGDriveDelete(existing[0].filePath);
        }
        const result = await db.update(bastTemplate).set({ ...data, updatedAt: new Date() }).where(eq(bastTemplate.id, id)).returning();
        return result[0];
    },
    async delete(id: number) {
        const existing = await db.select().from(bastTemplate).where(eq(bastTemplate.id, id));
        if (existing[0]) queueGDriveDelete(existing[0].filePath);
        await db.delete(bastTemplate).where(eq(bastTemplate.id, id));
    },
};
