import { db } from '../db/index.js';
import { pencairan, matrikKegiatan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export const pencairanService = {
    async list() {
        return db.select({
            pencairan,
            matrikNoMatrik: matrikKegiatan.noMatrik,
            matrikNamaSekolah: matrikKegiatan.namaSekolah,
            matrikNamaPaket: matrikKegiatan.namaPaket,
            matrikNilaiKontrak: matrikKegiatan.nilaiKontrak,
        })
            .from(pencairan)
            .leftJoin(matrikKegiatan, eq(pencairan.matrikId, matrikKegiatan.id));
    },

    async getByMatrikId(matrikId: number) {
        const result = await db.select().from(pencairan).where(eq(pencairan.matrikId, matrikId));
        return result[0] || { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', tanggalSp2d: '' };
    },

    async upsert(matrikId: number, data: Partial<typeof pencairan.$inferInsert>) {
        const existing = await db.select().from(pencairan).where(eq(pencairan.matrikId, matrikId));
        if (existing[0]) {
            const result = await db.update(pencairan).set({ ...data, updatedAt: new Date() }).where(eq(pencairan.matrikId, matrikId)).returning();
            return result[0];
        } else {
            const result = await db.insert(pencairan).values({ ...data, matrikId }).returning();
            return result[0];
        }
    },
};
