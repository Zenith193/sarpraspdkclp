import { db } from '../db/index.js';
import { proyeksiAnggaran, snpAcuan, sarpras, sekolah } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

export const proyeksiService = {
    // ===== ANGGARAN CRUD =====
    async listAnggaran() {
        return db.select().from(proyeksiAnggaran);
    },
    async createAnggaran(data: typeof proyeksiAnggaran.$inferInsert) {
        const result = await db.insert(proyeksiAnggaran).values(data).returning();
        return result[0];
    },
    async updateAnggaran(id: number, data: Partial<typeof proyeksiAnggaran.$inferInsert>) {
        const result = await db.update(proyeksiAnggaran).set({ ...data, updatedAt: new Date() }).where(eq(proyeksiAnggaran.id, id)).returning();
        return result[0];
    },
    async deleteAnggaran(id: number) {
        await db.delete(proyeksiAnggaran).where(eq(proyeksiAnggaran.id, id));
    },

    // ===== SNP CRUD =====
    async listSnp() {
        return db.select().from(snpAcuan);
    },
    async createSnp(data: typeof snpAcuan.$inferInsert) {
        const result = await db.insert(snpAcuan).values(data).returning();
        return result[0];
    },
    async updateSnp(id: number, data: Partial<typeof snpAcuan.$inferInsert>) {
        const result = await db.update(snpAcuan).set(data).where(eq(snpAcuan.id, id)).returning();
        return result[0];
    },
    async deleteSnp(id: number) {
        await db.delete(snpAcuan).where(eq(snpAcuan.id, id));
    },

    // ===== REKAP (computed from sarpras + anggaran + sekolah) =====
    async getRekap() {
        // Get all schools with rombel
        const schools = await db.select().from(sekolah);
        // Get all sarpras with conditions
        const allSarpras = await db.select().from(sarpras);
        // Get anggaran costs
        const anggaranData = await db.select().from(proyeksiAnggaran);
        const snpData = await db.select().from(snpAcuan);

        // Build per-school calculation (mirrors frontend ProyeksiAnggaran.jsx logic)
        const sekolahMap: Record<number, any> = {};
        schools.forEach(s => {
            sekolahMap[s.id] = {
                ...s, jmlRuangKelas: 0, jmlToilet: 0,
                biayaRS: 0, biayaRB: 0, biayaKelas: 0, biayaToilet: 0,
                details: [],
            };
        });

        allSarpras.forEach(sp => {
            const sk = sekolahMap[sp.sekolahId];
            if (!sk) return;
            const angg = anggaranData.find(a => a.jenisPrasarana === sp.jenisPrasarana && a.jenjang === sk.jenjang);
            if (sp.jenisPrasarana === 'Ruang Kelas') sk.jmlRuangKelas++;
            if (sp.jenisPrasarana === 'Toilet') sk.jmlToilet++;

            if (sp.kondisi === 'RUSAK SEDANG' || sp.kondisi === 'RUSAK BERAT') {
                const isBerat = sp.kondisi === 'RUSAK BERAT';
                const cost = angg ? (isBerat ? angg.rusakBerat : angg.rusakSedang) : (isBerat ? 100_000_000 : 75_000_000);
                if (isBerat) sk.biayaRB += (cost || 0);
                else sk.biayaRS += (cost || 0);
            }
        });

        let totalRS = 0, totalRB = 0, totalBuild = 0;
        Object.values(sekolahMap).forEach((sk: any) => {
            const anggKelas = anggaranData.find(a => a.jenisPrasarana === 'Ruang Kelas' && a.jenjang === sk.jenjang);
            const anggToilet = anggaranData.find(a => a.jenisPrasarana === 'Toilet' && a.jenjang === sk.jenjang);

            const defKelas = (sk.rombel || 0) - sk.jmlRuangKelas;
            if (defKelas > 0) {
                sk.biayaKelas = defKelas * (anggKelas?.pembangunan || 150_000_000);
            }
            const targetToilet = Math.max(1, (sk.rombel || 0) - 1);
            const defToilet = targetToilet - sk.jmlToilet;
            if (defToilet > 0) {
                sk.biayaToilet = defToilet * (anggToilet?.pembangunan || 50_000_000);
            }

            totalRS += sk.biayaRS;
            totalRB += sk.biayaRB;
            totalBuild += (sk.biayaKelas + sk.biayaToilet);
        });

        return {
            schools: Object.values(sekolahMap),
            globalStats: { totalRS, totalRB, totalBuild, grandTotal: totalRS + totalRB + totalBuild },
        };
    },
};
