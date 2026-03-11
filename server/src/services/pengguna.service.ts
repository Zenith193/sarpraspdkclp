import { db } from '../db/index.js';
import { user, sekolah } from '../db/schema/index.js';
import { eq, ilike, sql } from 'drizzle-orm';
import { auth } from '../auth/index.js';

export const penggunaService = {
    async list(filters: { search?: string; role?: string; page?: number; limit?: number }) {
        const { search, role, page = 1, limit = 50 } = filters;
        const conditions = [];
        if (search) conditions.push(ilike(user.name, `%${search}%`));
        if (role) conditions.push(eq(user.role, role));
        const where = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;
        const offset = (page - 1) * limit;

        let data;
        try {
            data = await db.select({
                id: user.id, name: user.name, email: user.email, role: user.role,
                sekolahId: user.sekolahId, aktif: user.aktif, createdAt: user.createdAt,
                plainPassword: user.plainPassword,
                npsn: sekolah.npsn, jenjang: sekolah.jenjang, kecamatan: sekolah.kecamatan,
                statusSekolah: sekolah.status, alamat: sekolah.alamat, kepsek: sekolah.kepsek,
                nip: sql<string>`COALESCE(${sekolah.nip}, ${user.nip})`.as('nip'),
                noRek: sekolah.noRek, namaBank: sekolah.namaBank, rombel: sekolah.rombel
            }).from(user)
                .leftJoin(sekolah, eq(user.sekolahId, sekolah.id))
                .where(where).limit(limit).offset(offset);
        } catch (_) {
            // Fallback if plain_password column doesn't exist yet
            data = await db.select({
                id: user.id, name: user.name, email: user.email, role: user.role,
                sekolahId: user.sekolahId, aktif: user.aktif, createdAt: user.createdAt,
                npsn: sekolah.npsn, jenjang: sekolah.jenjang, kecamatan: sekolah.kecamatan,
                statusSekolah: sekolah.status, alamat: sekolah.alamat, kepsek: sekolah.kepsek,
                nip: sql<string>`COALESCE(${sekolah.nip}, ${user.nip})`.as('nip'),
                noRek: sekolah.noRek, namaBank: sekolah.namaBank, rombel: sekolah.rombel
            }).from(user)
                .leftJoin(sekolah, eq(user.sekolahId, sekolah.id))
                .where(where).limit(limit).offset(offset);
        }
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(user).where(where);
        return { data, total: Number(countResult[0]?.count || 0), page, limit };
    },

    async getById(id: string) {
        const r = await db.select({
            id: user.id, name: user.name, email: user.email, role: user.role, sekolahId: user.sekolahId, aktif: user.aktif, createdAt: user.createdAt,
            npsn: sekolah.npsn, jenjang: sekolah.jenjang, kecamatan: sekolah.kecamatan,
            statusSekolah: sekolah.status, alamat: sekolah.alamat, kepsek: sekolah.kepsek,
            nip: sql<string>`COALESCE(${sekolah.nip}, ${user.nip})`.as('nip'),
            noRek: sekolah.noRek, namaBank: sekolah.namaBank, rombel: sekolah.rombel
        })
            .from(user)
            .leftJoin(sekolah, eq(user.sekolahId, sekolah.id))
            .where(eq(user.id, id));
        return r[0] || null;
    },

    async update(id: string, data: {
        name?: string; role?: string; sekolahId?: number; aktif?: boolean;
        jenjang?: string; kecamatan?: string; alamat?: string; kepsek?: string;
        nip?: string; noRek?: string; namaBank?: string; rombel?: number;
    }) {
        const { name, role, aktif, ...sekolahData } = data;

        // Only include defined user fields
        const userUpdate: Record<string, any> = { updatedAt: new Date() };
        if (name !== undefined) userUpdate.name = name;
        if (role !== undefined) userUpdate.role = role;
        if (aktif !== undefined) userUpdate.aktif = aktif;
        // Save NIP on user table too (for non-sekolah accounts)
        if (sekolahData.nip !== undefined) userUpdate.nip = sekolahData.nip;

        const r = await db.update(user).set(userUpdate).where(eq(user.id, id)).returning();
        const updatedUser = r[0];

        // Update sekolah table only with defined fields
        if (updatedUser?.sekolahId) {
            const sekolahUpdate: Record<string, any> = { updatedAt: new Date() };
            if (sekolahData.jenjang !== undefined) sekolahUpdate.jenjang = sekolahData.jenjang;
            if (sekolahData.kecamatan !== undefined) sekolahUpdate.kecamatan = sekolahData.kecamatan;
            if (sekolahData.alamat !== undefined) sekolahUpdate.alamat = sekolahData.alamat;
            if (sekolahData.kepsek !== undefined) sekolahUpdate.kepsek = sekolahData.kepsek;
            if (sekolahData.nip !== undefined) sekolahUpdate.nip = sekolahData.nip;
            if (sekolahData.noRek !== undefined) sekolahUpdate.noRek = sekolahData.noRek;
            if (sekolahData.namaBank !== undefined) sekolahUpdate.namaBank = sekolahData.namaBank;
            if (sekolahData.rombel !== undefined) sekolahUpdate.rombel = sekolahData.rombel;
            if (name !== undefined) sekolahUpdate.nama = name; // sync sekolah name too

            if (Object.keys(sekolahUpdate).length > 1) { // more than just updatedAt
                await db.update(sekolah).set(sekolahUpdate).where(eq(sekolah.id, updatedUser.sekolahId));
            }
        }

        return updatedUser;
    },

    async toggleActive(id: string) {
        const existing = await db.select({ aktif: user.aktif }).from(user).where(eq(user.id, id));
        if (!existing[0]) return null;
        const r = await db.update(user).set({ aktif: !existing[0].aktif, updatedAt: new Date() }).where(eq(user.id, id)).returning();
        return r[0];
    },

    async delete(id: string) {
        await db.delete(user).where(eq(user.id, id));
    },

    async batchCreate(users: Array<{
        name: string; email: string; password?: string; role?: string;
        npsn?: string; jenjang?: string; kecamatan?: string; statusSekolah?: string;
        alamat?: string; kepsek?: string; nip?: string; noRek?: string;
        namaBank?: string; rombel?: number;
    }>) {
        const results: Array<{ email: string; success: boolean; error?: string }> = [];
        for (const u of users) {
            try {
                let sekolahId: number | undefined;

                // Jika role adalah sekolah dan punya npsn, buat/update data sekolah dulu
                if (u.role?.toLowerCase() === 'sekolah' && u.npsn) {
                    const existingSekolah = await db.select().from(sekolah).where(eq(sekolah.npsn, u.npsn));
                    if (existingSekolah.length > 0) {
                        sekolahId = existingSekolah[0].id;
                        await db.update(sekolah).set({
                            nama: u.name,
                            jenjang: u.jenjang || existingSekolah[0].jenjang,
                            kecamatan: u.kecamatan || existingSekolah[0].kecamatan,
                            status: u.statusSekolah || existingSekolah[0].status,
                            alamat: u.alamat || existingSekolah[0].alamat,
                            kepsek: u.kepsek || existingSekolah[0].kepsek,
                            nip: u.nip || existingSekolah[0].nip,
                            noRek: u.noRek || existingSekolah[0].noRek,
                            namaBank: u.namaBank || existingSekolah[0].namaBank,
                            rombel: u.rombel !== undefined ? u.rombel : existingSekolah[0].rombel,
                            updatedAt: new Date()
                        }).where(eq(sekolah.id, sekolahId));
                    } else {
                        const newSekolah = await db.insert(sekolah).values({
                            nama: u.name,
                            npsn: u.npsn,
                            jenjang: u.jenjang || 'SD',
                            kecamatan: u.kecamatan || 'Kroya',
                            status: u.statusSekolah || 'Negeri',
                            alamat: u.alamat,
                            kepsek: u.kepsek,
                            nip: u.nip,
                            noRek: u.noRek,
                            namaBank: u.namaBank,
                            rombel: u.rombel || 0
                        }).returning({ id: sekolah.id });
                        sekolahId = newSekolah[0].id;
                    }
                }

                // Gunakan email jika ada, jika kosong gunakan npsn, lalu berikan domain default jika diperlukan
                let validEmail = u.email || u.npsn || `user${Date.now()}`;
                if (validEmail && !validEmail.includes('@')) {
                    validEmail = `${validEmail}@SARDIKA.cilacapkab.go.id`;
                }

                const plainPwd = u.password || (u.role?.toLowerCase() === 'sekolah' && u.npsn ? u.npsn : '12345678');

                const signUpResult = await auth.api.signUpEmail({
                    body: {
                        name: u.name,
                        email: validEmail,
                        password: plainPwd,
                        role: u.role || 'Sekolah',
                        sekolahId: sekolahId,
                        aktif: true
                    },
                });

                // Store plain password directly via Drizzle (not through Better Auth)
                if (signUpResult?.user?.id) {
                    try {
                        await db.update(user).set({ plainPassword: plainPwd }).where(eq(user.id, signUpResult.user.id));
                    } catch (_) { /* column may not exist yet, ignore */ }
                }

                results.push({ email: u.email, success: true });
            } catch (e: any) {
                results.push({ email: u.email, success: false, error: e.message || 'Gagal mendaftar' });
            }
        }
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        return { results, successCount, failCount, total: users.length };
    },
};
