import { db } from '../db/index.js';
import { perusahaan } from '../db/schema/index.js';
import { user, account } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { auth } from '../auth/index.js';

export const perusahaanService = {
    async register(data: any) {
        // Check if NPWP already registered
        const existing = await db.select().from(perusahaan).where(eq(perusahaan.npwp, data.npwp));
        if (existing.length > 0) {
            throw new Error('NPWP sudah terdaftar. Silakan cek status verifikasi.');
        }

        // Check if email already used
        const emailCheck = await db.select().from(user).where(eq(user.email, data.email));
        if (emailCheck.length > 0) {
            throw new Error('Email sudah digunakan. Gunakan email lain.');
        }

        // Create user account via Better Auth (inactive by default)
        const signUpResult = await auth.api.signUpEmail({
            body: {
                name: data.namaPerusahaan,
                email: data.email,
                password: data.password,
            },
        });

        if (!signUpResult?.user?.id) {
            throw new Error('Gagal membuat akun. Coba lagi.');
        }

        // Update user role and aktif status
        await db.update(user).set({
            role: 'Penyedia',
            aktif: false, // Inactive until admin verifies
        }).where(eq(user.id, signUpResult.user.id));

        // Save perusahaan data
        const [saved] = await db.insert(perusahaan).values({
            nikPemilik: data.nikPemilik || null,
            namaPemilik: data.namaPemilik || null,
            jabatanPemilik: data.jabatanPemilik || null,
            alamatPemilik: data.alamatPemilik || null,
            namaPerusahaan: data.namaPerusahaan,
            namaPerusahaanSingkat: data.namaPerusahaanSingkat || null,
            tipePerusahaan: data.tipePerusahaan || 'Penyedia',
            noAkta: data.noAkta || null,
            namaNotaris: data.namaNotaris || null,
            tanggalAkta: data.tanggalAkta || null,
            alamatPerusahaan: data.alamatPerusahaan || null,
            noTelp: data.noTelp || null,
            emailPerusahaan: data.emailPerusahaan || data.email || null,
            npwp: data.npwp,
            noRekening: data.noRekening || null,
            namaRekening: data.namaRekening || null,
            bank: data.bank || null,
            status: 'Menunggu',
            userId: signUpResult.user.id,
        }).returning();

        return saved;
    },

    async checkByNpwp(npwp: string) {
        const result = await db.select({
            namaPerusahaan: perusahaan.namaPerusahaan,
            npwp: perusahaan.npwp,
            status: perusahaan.status,
            keteranganVerifikasi: perusahaan.keteranganVerifikasi,
            createdAt: perusahaan.createdAt,
        }).from(perusahaan).where(eq(perusahaan.npwp, npwp));
        return result[0] || null;
    },

    async list() {
        return db.select().from(perusahaan).orderBy(desc(perusahaan.createdAt));
    },

    async getById(id: number) {
        const result = await db.select().from(perusahaan).where(eq(perusahaan.id, id));
        return result[0] || null;
    },

    async verify(id: number, status: string, keterangan?: string) {
        const p = await this.getById(id);
        if (!p) throw new Error('Perusahaan tidak ditemukan');

        // Update perusahaan status
        await db.update(perusahaan).set({
            status,
            keteranganVerifikasi: keterangan || null,
        }).where(eq(perusahaan.id, id));

        // Activate/deactivate user account
        if (p.userId) {
            await db.update(user).set({
                aktif: status === 'Diverifikasi',
            }).where(eq(user.id, p.userId));
        }

        return { success: true };
    },

    async update(id: number, data: Partial<typeof perusahaan.$inferInsert>) {
        const [updated] = await db.update(perusahaan).set(data).where(eq(perusahaan.id, id)).returning();
        return updated;
    },

    async delete(id: number) {
        const p = await this.getById(id);
        if (p?.userId) {
            // Delete user account too
            await db.delete(account).where(eq(account.userId, p.userId));
            await db.delete(user).where(eq(user.id, p.userId));
        }
        await db.delete(perusahaan).where(eq(perusahaan.id, id));
    },
};
