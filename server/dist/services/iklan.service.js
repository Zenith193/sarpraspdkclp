import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { iklan } from '../db/schema/iklan';
export const iklanService = {
    // List all iklan (admin sees all, others see only aktif)
    async list(isAdmin = false) {
        if (isAdmin) {
            return db.select().from(iklan).orderBy(desc(iklan.prioritas), desc(iklan.createdAt));
        }
        // Non-admin: only active ads within date range
        const today = new Date().toISOString().split('T')[0];
        return db.select().from(iklan)
            .where(eq(iklan.status, 'aktif'))
            .orderBy(desc(iklan.prioritas), desc(iklan.createdAt));
    },
    async getById(id) {
        const rows = await db.select().from(iklan).where(eq(iklan.id, id));
        return rows[0] || null;
    },
    async create(data) {
        const rows = await db.insert(iklan).values({
            judul: data.judul,
            deskripsi: data.deskripsi || null,
            tipeIklan: data.tipeIklan || 'banner',
            gambarUrl: data.gambarUrl || null,
            targetUrl: data.targetUrl || null,
            advertiser: data.advertiser,
            biayaPerKlik: data.biayaPerKlik || 0,
            biayaPerTayang: data.biayaPerTayang || 0,
            budgetTotal: data.budgetTotal || 0,
            budgetTerpakai: 0,
            totalTayang: 0,
            totalKlik: 0,
            status: data.status || 'aktif',
            tanggalMulai: data.tanggalMulai || null,
            tanggalSelesai: data.tanggalSelesai || null,
            prioritas: data.prioritas || 0,
        }).returning();
        return rows[0];
    },
    async update(id, data) {
        const rows = await db.update(iklan).set({
            ...data,
            updatedAt: new Date(),
        }).where(eq(iklan.id, id)).returning();
        return rows[0];
    },
    async delete(id) {
        await db.delete(iklan).where(eq(iklan.id, id));
    },
    // Record a click
    async recordKlik(id) {
        const ad = await this.getById(id);
        if (!ad)
            return null;
        const newKlik = (ad.totalKlik || 0) + 1;
        const biayaKlik = ad.biayaPerKlik || 0;
        const newBudget = (ad.budgetTerpakai || 0) + biayaKlik;
        const newStatus = (ad.budgetTotal || 0) > 0 && newBudget >= (ad.budgetTotal || 0) ? 'habis' : ad.status;
        await db.update(iklan).set({
            totalKlik: newKlik,
            budgetTerpakai: newBudget,
            status: newStatus,
            updatedAt: new Date(),
        }).where(eq(iklan.id, id));
        return { totalKlik: newKlik, budgetTerpakai: newBudget };
    },
    // Record an impression
    async recordTayang(id) {
        const ad = await this.getById(id);
        if (!ad)
            return null;
        const newTayang = (ad.totalTayang || 0) + 1;
        const biayaTayang = (ad.biayaPerTayang || 0) / 1000; // CPM = per 1000
        const newBudget = (ad.budgetTerpakai || 0) + biayaTayang;
        const newStatus = (ad.budgetTotal || 0) > 0 && newBudget >= (ad.budgetTotal || 0) ? 'habis' : ad.status;
        await db.update(iklan).set({
            totalTayang: newTayang,
            budgetTerpakai: newBudget,
            status: newStatus,
            updatedAt: new Date(),
        }).where(eq(iklan.id, id));
        return { totalTayang: newTayang, budgetTerpakai: newBudget };
    },
    // Stats for admin dashboard
    async getStats() {
        const all = await db.select().from(iklan);
        const aktif = all.filter(a => a.status === 'aktif').length;
        const totalTayang = all.reduce((s, a) => s + (a.totalTayang || 0), 0);
        const totalKlik = all.reduce((s, a) => s + (a.totalKlik || 0), 0);
        const totalPendapatan = all.reduce((s, a) => s + (a.budgetTerpakai || 0), 0);
        const totalBudget = all.reduce((s, a) => s + (a.budgetTotal || 0), 0);
        const ctr = totalTayang > 0 ? ((totalKlik / totalTayang) * 100).toFixed(2) : '0.00';
        return {
            totalIklan: all.length,
            iklanAktif: aktif,
            totalTayang,
            totalKlik,
            ctr: parseFloat(ctr),
            totalPendapatan,
            totalBudget,
        };
    },
};
