import { db } from '../db/index.js';
import { sekolah, sarpras, proposal, user } from '../db/schema/index.js';
import { eq, sql, inArray } from 'drizzle-orm';

export const dashboardService = {
    async getAdminStats() {
        const [sekolahCount, sarprasStats, proposalStats, userCount] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(sekolah),
            db.select({
                total: sql<number>`count(*)`,
                baik: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'BAIK' and ${sarpras.verified} = true)`,
                rusakRingan: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK RINGAN' and ${sarpras.verified} = true)`,
                rusakSedang: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK SEDANG' and ${sarpras.verified} = true)`,
                rusakBerat: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'RUSAK BERAT' and ${sarpras.verified} = true)`,
                verified: sql<number>`count(*) filter (where ${sarpras.verified} = true)`,
                unverified: sql<number>`count(*) filter (where ${sarpras.verified} = false or ${sarpras.verified} is null)`,
            }).from(sarpras),
            db.select({
                total: sql<number>`count(*)`,
                menunggu: sql<number>`count(*) filter (where ${proposal.status} = 'Menunggu Verifikasi')`,
                disetujui: sql<number>`count(*) filter (where ${proposal.status} = 'Disetujui')`,
                ditolak: sql<number>`count(*) filter (where ${proposal.status} = 'Ditolak')`,
                revisi: sql<number>`count(*) filter (where ${proposal.status} = 'Revisi')`,
            }).from(proposal),
            db.select({ count: sql<number>`count(*)` }).from(user),
        ]);

        return {
            totalSekolah: Number(sekolahCount[0]?.count || 0),
            sarpras: sarprasStats[0],
            proposal: proposalStats[0],
            totalUser: Number(userCount[0]?.count || 0),
        };
    },

    async getKorwilStats(kecamatanList: string[]) {
        if (kecamatanList.length === 0) return { totalSekolah: 0, sarpras: { total: 0 }, proposal: { total: 0 } };

        const schoolsInArea = await db.select().from(sekolah).where(inArray(sekolah.kecamatan, kecamatanList));
        const schoolIds = schoolsInArea.map(s => s.id);
        if (schoolIds.length === 0) return { totalSekolah: 0, sarpras: { total: 0 }, proposal: { total: 0 } };

        const sarprasStats = await db.select({
            total: sql<number>`count(*)`,
            verified: sql<number>`count(*) filter (where ${sarpras.verified} = true)`,
        }).from(sarpras).where(inArray(sarpras.sekolahId, schoolIds));

        return { totalSekolah: schoolsInArea.length, sarpras: sarprasStats[0] };
    },

    async getSekolahStats(sekolahId: number) {
        const sarprasStats = await db.select({
            total: sql<number>`count(*)`,
            baik: sql<number>`count(*) filter (where ${sarpras.kondisi} = 'BAIK' and ${sarpras.verified} = true)`,
            rusak: sql<number>`count(*) filter (where ${sarpras.kondisi} != 'BAIK' and ${sarpras.verified} = true)`,
            verified: sql<number>`count(*) filter (where ${sarpras.verified} = true)`,
            unverified: sql<number>`count(*) filter (where ${sarpras.verified} = false or ${sarpras.verified} is null)`,
        }).from(sarpras).where(eq(sarpras.sekolahId, sekolahId));

        const proposalStats = await db.select({ total: sql<number>`count(*)` }).from(proposal).where(eq(proposal.sekolahId, sekolahId));
        return { sarpras: sarprasStats[0], proposal: proposalStats[0] };
    },
};
