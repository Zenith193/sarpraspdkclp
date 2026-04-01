import { db } from '../db/index.js';
import { matrikKegiatan, sekolah, splGenerated, bastTemplate, user } from '../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';

export const matrikService = {
    async list(filters: { tahun?: number; sumberDana?: string; jenisPengadaan?: string; page?: number; limit?: number }) {
        const { tahun, sumberDana, jenisPengadaan, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (tahun) conditions.push(eq(matrikKegiatan.tahunAnggaran, tahun));
        if (sumberDana) conditions.push(eq(matrikKegiatan.sumberDana, sumberDana));
        if (jenisPengadaan) conditions.push(eq(matrikKegiatan.jenisPengadaan, jenisPengadaan));

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * limit;

        const data = await db.select().from(matrikKegiatan).where(where).limit(limit).offset(offset);
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(matrikKegiatan).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: number) {
        const result = await db.select().from(matrikKegiatan).where(eq(matrikKegiatan.id, id));
        return result[0] || null;
    },

    async create(data: typeof matrikKegiatan.$inferInsert) {
        const result = await db.insert(matrikKegiatan).values(data).returning();
        return result[0];
    },

    async update(id: number, data: Partial<typeof matrikKegiatan.$inferInsert>) {
        const result = await db.update(matrikKegiatan).set({ ...data, updatedAt: new Date() }).where(eq(matrikKegiatan.id, id)).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(matrikKegiatan).where(eq(matrikKegiatan.id, id));
    },

    async bulkCreate(items: (typeof matrikKegiatan.$inferInsert)[]) {
        return db.insert(matrikKegiatan).values(items).returning();
    },

    /**
     * List SPL data: matrik LEFT JOIN sekolah (for kepsek, nip)
     * Only return parent items (noMatrik without comma, or the root level)
     */
    async listSpl(filters: { tahun?: number } = {}) {
        const conditions: any[] = [];
        if (filters.tahun) conditions.push(eq(matrikKegiatan.tahunAnggaran, filters.tahun));

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        // Get all matrik items
        const allMatrik = await db.select({
            matrik: matrikKegiatan,
            kepsek: sekolah.kepsek,
            nipKs: sekolah.nip,
            kopSekolah: sekolah.kopSekolah,
            kecamatan: sekolah.kecamatan,
        }).from(matrikKegiatan)
            .leftJoin(sekolah, eq(matrikKegiatan.npsn, sekolah.npsn))
            .where(where)
            .orderBy(matrikKegiatan.noMatrik);

        // Group: parent items + their children
        // noMatrik child format: "87,1" or "87.1" — detect both separators
        const parentMap = new Map<string, any>();
        const children: any[] = [];

        // Detect if a noMatrik is a child: contains , or has a . followed by digits at the end
        // But a pure integer like "87" is a parent, "87.1" is a child
        const isChildNoMatrik = (nm: string) => {
            if (nm.includes(',')) return true;
            // Check for dot-separated child: "87.1", "87.2" etc.
            const dotMatch = nm.match(/^(\d+)\.(\d+)$/);
            return !!dotMatch;
        };

        const getParentNo = (nm: string) => {
            if (nm.includes(',')) return nm.split(',').slice(0, -1).join(',');
            const dotMatch = nm.match(/^(\d+)\.(\d+)$/);
            if (dotMatch) return dotMatch[1];
            return nm;
        };

        for (const row of allMatrik) {
            const noMatrik = row.matrik.noMatrik;
            const isChild = isChildNoMatrik(noMatrik);
            const item = {
                ...row.matrik,
                kepsek: row.kepsek || '',
                nipKs: row.nipKs || '',
                kopSekolah: row.kopSekolah || null,
                kecamatan: row.kecamatan || '',
            };

            if (isChild) {
                children.push(item);
            } else {
                parentMap.set(noMatrik, { ...item, children: [] });
            }
        }

        // Attach children to parents
        for (const child of children) {
            const parentNo = getParentNo(child.noMatrik);
            const parent = parentMap.get(parentNo);
            if (parent) {
                parent.children.push(child);
            } else {
                // Orphan child — treat as standalone
                parentMap.set(child.noMatrik, { ...child, children: [] });
            }
        }

        return Array.from(parentMap.values());
    },
};

export const splHistoryService = {
    async list() {
        return db.select({
            spl: splGenerated,
            matrikNo: matrikKegiatan.noMatrik,
            namaSekolah: matrikKegiatan.namaSekolah,
            namaPaket: matrikKegiatan.namaPaket,
            templateNama: bastTemplate.nama,
        }).from(splGenerated)
            .leftJoin(matrikKegiatan, eq(splGenerated.matrikId, matrikKegiatan.id))
            .leftJoin(bastTemplate, eq(splGenerated.templateId, bastTemplate.id))
            .orderBy(desc(splGenerated.createdAt));
    },

    async create(data: typeof splGenerated.$inferInsert) {
        const result = await db.insert(splGenerated).values(data).returning();
        return result[0];
    },

    async delete(id: number) {
        await db.delete(splGenerated).where(eq(splGenerated.id, id));
    },

    async update(id: number, data: Partial<typeof splGenerated.$inferInsert>) {
        const result = await db.update(splGenerated).set(data).where(eq(splGenerated.id, id)).returning();
        return result[0];
    },
};

