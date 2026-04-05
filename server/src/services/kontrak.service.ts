import { db } from '../db/index.js';
import { permohonanKontrak, realisasi, perusahaan, matrikKegiatan, user } from '../db/schema/index.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export const kontrakService = {
    // Search matrik by RUP/SiRUP code
    async searchSirup(kode: string) {
        const results = await db.select({
            id: matrikKegiatan.id,
            rup: matrikKegiatan.rup,
            namaPaket: matrikKegiatan.namaPaket,
            metode: matrikKegiatan.metode,
            jenisPengadaan: matrikKegiatan.jenisPengadaan,
            namaSekolah: matrikKegiatan.namaSekolah,
            npsn: matrikKegiatan.npsn,
            paguAnggaran: matrikKegiatan.paguAnggaran,
            hps: matrikKegiatan.hps,
        }).from(matrikKegiatan).where(eq(matrikKegiatan.rup, kode));
        if (!results[0]) return null;

        const matrik = results[0];

        // Check if any active permohonan exists for this kode sirup or matrikId
        const existingPermohonan = await db.select({
            id: permohonanKontrak.id,
            status: permohonanKontrak.status,
        }).from(permohonanKontrak)
          .where(
              and(
                  eq(permohonanKontrak.kodeSirup, kode),
                  sql`${permohonanKontrak.status} IN ('Menunggu', 'Diverifikasi')`
              )
          );

        if (existingPermohonan.length > 0) {
            const status = existingPermohonan[0].status;
            const reason = status === 'Diverifikasi'
                ? 'Paket ini sudah berkontrak'
                : 'Paket ini sedang dalam masa pengajuan kontrak';
            return { ...matrik, blocked: true, blockedReason: reason };
        }

        return matrik;
    },

    // Find all matrik with same RUP or same noMatrik parent (siblings/anakan)
    async searchSiblings(rup: string) {
        // First try exact RUP match
        let results = await db.select({
            id: matrikKegiatan.id,
            noMatrik: matrikKegiatan.noMatrik,
            rup: matrikKegiatan.rup,
            namaPaket: matrikKegiatan.namaPaket,
            namaSekolah: matrikKegiatan.namaSekolah,
            nilaiKontrak: matrikKegiatan.nilaiKontrak,
            hps: matrikKegiatan.hps,
            paguAnggaran: matrikKegiatan.paguAnggaran,
        }).from(matrikKegiatan).where(eq(matrikKegiatan.rup, rup));
        console.log(`[Siblings] RUP="${rup}" found ${results.length} entries by RUP match`);
        
        // If only 1 result, try to find siblings via noMatrik prefix
        if (results.length === 1) {
            const parentNoMatrik = results[0].noMatrik;
            // Get base number (e.g. "87" from "87" or "87.1")
            const baseNoMatrik = parentNoMatrik.includes('.') ? parentNoMatrik.split('.')[0] : parentNoMatrik;
            
            const allMatrik = await db.select({
                id: matrikKegiatan.id,
                noMatrik: matrikKegiatan.noMatrik,
                rup: matrikKegiatan.rup,
                namaPaket: matrikKegiatan.namaPaket,
                namaSekolah: matrikKegiatan.namaSekolah,
                nilaiKontrak: matrikKegiatan.nilaiKontrak,
                hps: matrikKegiatan.hps,
                paguAnggaran: matrikKegiatan.paguAnggaran,
            }).from(matrikKegiatan);
            
            const siblings = allMatrik.filter(m => 
                m.noMatrik === baseNoMatrik || m.noMatrik.startsWith(baseNoMatrik + '.')
            );
            
            if (siblings.length > 1) {
                console.log(`[Siblings] Found ${siblings.length} entries by noMatrik prefix "${baseNoMatrik}":`, siblings.map(r => `${r.noMatrik}: ${r.namaPaket}`));
                return siblings;
            }
        }
        
        console.log(`[Siblings] Final: ${results.length} entries:`, results.map(r => `${r.noMatrik}: ${r.namaPaket}`));
        return results;
    },

    // Create permohonan (by penyedia)
    async createPermohonan(data: any, userId: string) {
        // Find perusahaan linked to this user
        const perusahaanList = await db.select().from(perusahaan).where(eq(perusahaan.userId, userId));
        const myPerusahaan = perusahaanList[0];
        if (!myPerusahaan) throw new Error('Perusahaan tidak ditemukan untuk akun ini');
        if (myPerusahaan.status !== 'Diverifikasi') throw new Error('Perusahaan belum diverifikasi');

        const [created] = await db.insert(permohonanKontrak).values({
            perusahaanId: myPerusahaan.id,
            matrikId: data.matrikId || null,
            kodeSirup: data.kodeSirup,
            namaPaket: data.namaPaket,
            metodePengadaan: data.metodePengadaan,
            jenisPengadaan: data.jenisPengadaan,
            noDppl: data.noDppl || null,
            tanggalDppl: data.tanggalDppl || null,
            noBahpl: data.noBahpl || null,
            tanggalBahpl: data.tanggalBahpl || null,
            berkasPenawaranPath: data.berkasPenawaranPath || null,
            timPenugasan: data.timPenugasan || null,
            peralatanUtama: data.peralatanUtama || null,
            status: 'Menunggu',
            createdBy: userId,
        }).returning();
        return created;
    },

    // List permohonan: admin=all, penyedia=own only
    async listPermohonan(userId: string, role: string) {
        const isAdmin = ['admin', 'verifikator'].includes(role.toLowerCase());

        // Common select fields with matrik override via COALESCE
        const selectFields = {
            id: permohonanKontrak.id,
            kodeSirup: permohonanKontrak.kodeSirup,
            namaPaket: sql<string>`COALESCE(${matrikKegiatan.namaPaket}, ${permohonanKontrak.namaPaket})`.as('namaPaket'),
            metodePengadaan: sql<string>`COALESCE(${matrikKegiatan.metode}, ${permohonanKontrak.metodePengadaan})`.as('metodePengadaan'),
            jenisPengadaan: sql<string>`COALESCE(${matrikKegiatan.jenisPengadaan}, ${permohonanKontrak.jenisPengadaan})`.as('jenisPengadaan'),
            status: permohonanKontrak.status,
            nilaiKontrak: sql<number>`COALESCE(${matrikKegiatan.nilaiKontrak}, ${permohonanKontrak.nilaiKontrak})`.as('nilaiKontrak'),
            noSpk: sql<string>`COALESCE(${matrikKegiatan.noSpk}, ${permohonanKontrak.noSpk})`.as('noSpk'),
            createdAt: permohonanKontrak.createdAt,
            namaPerusahaan: perusahaan.namaPerusahaan,
            perusahaanId: permohonanKontrak.perusahaanId,
            matrikId: permohonanKontrak.matrikId,
        };

        if (isAdmin) {
            return db.select(selectFields).from(permohonanKontrak)
              .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
              .leftJoin(matrikKegiatan, eq(permohonanKontrak.matrikId, matrikKegiatan.id))
              .orderBy(desc(permohonanKontrak.createdAt));
        }

        // Penyedia: only own
        const myPerusahaan = await db.select().from(perusahaan).where(eq(perusahaan.userId, userId));
        if (!myPerusahaan[0]) return [];

        return db.select(selectFields).from(permohonanKontrak)
          .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
          .leftJoin(matrikKegiatan, eq(permohonanKontrak.matrikId, matrikKegiatan.id))
          .where(eq(permohonanKontrak.perusahaanId, myPerusahaan[0].id))
          .orderBy(desc(permohonanKontrak.createdAt));
    },

    // Get single permohonan detail
    async getById(id: number) {
        const results = await db.select({
            kontrak: permohonanKontrak,
            namaPerusahaan: perusahaan.namaPerusahaan,
            namaPerusahaanSingkat: perusahaan.namaPerusahaanSingkat,
            nikPemilik: perusahaan.nikPemilik,
            namaPemilik: perusahaan.namaPemilik,
            alamatPemilik: perusahaan.alamatPemilik,
            alamatPerusahaan: perusahaan.alamatPerusahaan,
            noTelp: perusahaan.noTelp,
            emailPerusahaan: perusahaan.emailPerusahaan,
            noAkta: perusahaan.noAkta,
            namaNotaris: perusahaan.namaNotaris,
            tanggalAkta: perusahaan.tanggalAkta,
            npwp: perusahaan.npwp,
            noRekening: perusahaan.noRekening,
            namaRekening: perusahaan.namaRekening,
            bank: perusahaan.bank,
            // Matrik data
            matrikNoSpk: matrikKegiatan.noSpk,
            matrikNilaiKontrak: matrikKegiatan.nilaiKontrak,
            matrikTerbilangKontrak: matrikKegiatan.terbilangKontrak,
            matrikTanggalMulai: matrikKegiatan.tanggalMulai,
            matrikTanggalSelesai: matrikKegiatan.tanggalSelesai,
            matrikJangkaWaktu: matrikKegiatan.jangkaWaktu,
            matrikPaguAnggaran: matrikKegiatan.paguAnggaran,
            matrikHps: matrikKegiatan.hps,
            matrikSubKegiatan: matrikKegiatan.subKegiatan,
            matrikSumberDana: matrikKegiatan.sumberDana,
            matrikTahunAnggaran: matrikKegiatan.tahunAnggaran,
            matrikPaguPaket: matrikKegiatan.paguPaket,
            matrikNoMatrik: matrikKegiatan.noMatrik,
            matrikNamaSekolah: matrikKegiatan.namaSekolah,
            matrikPenyedia: matrikKegiatan.penyedia,
            matrikNamaPemilik: matrikKegiatan.namaPemilik,
            matrikAlamatKantor: matrikKegiatan.alamatKantor,
            matrikNoHp: matrikKegiatan.noHp,
            matrikMetode: matrikKegiatan.metode,
            matrikNamaPaket: matrikKegiatan.namaPaket,
        }).from(permohonanKontrak)
          .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
          .leftJoin(matrikKegiatan, eq(permohonanKontrak.matrikId, matrikKegiatan.id))
          .where(eq(permohonanKontrak.id, id));
        if (!results[0]) return null;
        const r = results[0];
        // Get verifikator name separately
        let verifikatorName = null;
        if (r.kontrak.verifiedBy) {
            const vRows = await db.select({ name: user.name }).from(user).where(eq(user.id, r.kontrak.verifiedBy));
            verifikatorName = vRows[0]?.name || null;
        }
        return {
            ...r.kontrak,
            perusahaan: { ...r },
            matrik: {
                noSpk: r.matrikNoSpk,
                nilaiKontrak: r.matrikNilaiKontrak,
                terbilangKontrak: r.matrikTerbilangKontrak,
                tanggalMulai: r.matrikTanggalMulai,
                tanggalSelesai: r.matrikTanggalSelesai,
                jangkaWaktu: r.matrikJangkaWaktu,
                paguAnggaran: r.matrikPaguAnggaran,
                hps: r.matrikHps,
                subKegiatan: r.matrikSubKegiatan,
                sumberDana: r.matrikSumberDana,
                tahunAnggaran: r.matrikTahunAnggaran,
                paguPaket: r.matrikPaguPaket,
                noMatrik: r.matrikNoMatrik,
                namaSekolah: r.matrikNamaSekolah,
                penyedia: r.matrikPenyedia,
                namaPemilik: r.matrikNamaPemilik,
                alamatKantor: r.matrikAlamatKantor,
                noHp: r.matrikNoHp,
                metode: r.matrikMetode,
                namaPaket: r.matrikNamaPaket,
            },
            verifikatorName,
        };
    },

    // Verifikator: update SPK, SP/SPMK, verify
    async updateByVerifikator(id: number, data: any, userId: string) {
        const [updated] = await db.update(permohonanKontrak).set({
            noSpk: data.noSpk,
            nilaiKontrak: data.nilaiKontrak ? Number(data.nilaiKontrak) : undefined,
            terbilangKontrak: data.terbilangKontrak,
            tanggalMulai: data.tanggalMulai,
            tanggalSelesai: data.tanggalSelesai,
            waktuPenyelesaian: data.waktuPenyelesaian,
            tataCaraPembayaran: data.tataCaraPembayaran,
            uangMuka: data.uangMuka,
            nilaiItems: data.nilaiItems !== undefined ? data.nilaiItems : undefined,
            noSp: data.noSp,
            tanggalSp: data.tanggalSp,
            idPaket: data.idPaket,
            noDppl: data.noDppl !== undefined ? data.noDppl : undefined,
            tanggalDppl: data.tanggalDppl !== undefined ? data.tanggalDppl : undefined,
            noBahpl: data.noBahpl !== undefined ? data.noBahpl : undefined,
            tanggalBahpl: data.tanggalBahpl !== undefined ? data.tanggalBahpl : undefined,
            timPenugasan: data.timPenugasan !== undefined ? data.timPenugasan : undefined,
            peralatanUtama: data.peralatanUtama !== undefined ? data.peralatanUtama : undefined,
            status: data.status || undefined,
            catatan: data.catatan,
            verifiedBy: data.status === 'Diverifikasi' ? userId : undefined,
            updatedAt: new Date(),
        }).where(eq(permohonanKontrak.id, id)).returning();

        // === Sync to matrik_kegiatan on every save (not just verification) ===
        if (updated) {
            try {
                // Get full permohonan with perusahaan info
                const full = await db.select({
                    kontrak: permohonanKontrak,
                    namaPerusahaan: perusahaan.namaPerusahaan,
                    namaPemilik: perusahaan.namaPemilik,
                    alamatPerusahaan: perusahaan.alamatPerusahaan,
                    noTelp: perusahaan.noTelp,
                }).from(permohonanKontrak)
                  .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
                  .where(eq(permohonanKontrak.id, id));
                const k = full[0];
                if (!k) throw new Error('Kontrak not found after update');

                const matrikData: any = {
                    noSpk: k.kontrak.noSpk || null,
                    nilaiKontrak: k.kontrak.nilaiKontrak || null,
                    terbilangKontrak: k.kontrak.terbilangKontrak || null,
                    tanggalMulai: k.kontrak.tanggalMulai || null,
                    tanggalSelesai: k.kontrak.tanggalSelesai || null,
                    jangkaWaktu: k.kontrak.waktuPenyelesaian ? parseInt(k.kontrak.waktuPenyelesaian) : null,
                    penyedia: k.namaPerusahaan || null,
                    namaPemilik: k.namaPemilik || null,
                    alamatKantor: k.alamatPerusahaan || null,
                    noHp: k.noTelp || null,
                    metode: k.kontrak.metodePengadaan || null,
                    jenisPengadaan: k.kontrak.jenisPengadaan || null,
                    updatedAt: new Date(),
                };

                if (k.kontrak.matrikId) {
                    // Update existing matrik
                    await db.update(matrikKegiatan).set(matrikData)
                        .where(eq(matrikKegiatan.id, k.kontrak.matrikId));
                    console.log(`[Kontrak→Matrik] Updated matrik #${k.kontrak.matrikId} from kontrak #${id}`);

                    // Sync nilaiItems to child matrik entries (anakan)
                    if (k.kontrak.nilaiItems) {
                        try {
                            const items = typeof k.kontrak.nilaiItems === 'string'
                                ? JSON.parse(k.kontrak.nilaiItems) : k.kontrak.nilaiItems;
                            if (Array.isArray(items) && items.length > 0) {
                                // Get parent noMatrik
                                const parentRow = await db.select({ noMatrik: matrikKegiatan.noMatrik })
                                    .from(matrikKegiatan).where(eq(matrikKegiatan.id, k.kontrak.matrikId));
                                if (parentRow[0]) {
                                    const baseNo = parentRow[0].noMatrik.includes('.')
                                        ? parentRow[0].noMatrik.split('.')[0]
                                        : parentRow[0].noMatrik;
                                    // Find all anakan matrik
                                    const allMatrik = await db.select({
                                        id: matrikKegiatan.id,
                                        noMatrik: matrikKegiatan.noMatrik,
                                        namaPaket: matrikKegiatan.namaPaket,
                                    }).from(matrikKegiatan);
                                    const children = allMatrik.filter((m: any) =>
                                        m.noMatrik.startsWith(baseNo + '.'));
                                    // Match by namaPaket and update nilaiKontrak
                                    for (const item of items) {
                                        const match = children.find((c: any) =>
                                            c.namaPaket && item.nama &&
                                            c.namaPaket.toLowerCase().trim() === item.nama.toLowerCase().trim());
                                        if (match && item.nilai) {
                                            await db.update(matrikKegiatan).set({
                                                nilaiKontrak: Number(item.nilai) || null,
                                                updatedAt: new Date(),
                                            }).where(eq(matrikKegiatan.id, match.id));
                                            console.log(`[Kontrak→Matrik] Synced nilaiKontrak=${item.nilai} to anakan ${match.noMatrik}`);
                                        }
                                    }
                                }
                            }
                        } catch (syncErr: any) {
                            console.error('[Kontrak→Matrik] nilaiItems sync error:', syncErr.message);
                        }
                    }
                } else if (data.status === 'Diverifikasi') {
                    // Create new matrik entry only on first verification
                    const [newMatrik] = await db.insert(matrikKegiatan).values({
                        noMatrik: 'K-' + id,
                        rup: k.kontrak.kodeSirup || '',
                        namaPaket: k.kontrak.namaPaket || '',
                        jenisPengadaan: k.kontrak.jenisPengadaan || '',
                        metode: k.kontrak.metodePengadaan || '',
                        tahunAnggaran: new Date().getFullYear(),
                        ...matrikData,
                    }).returning();
                    // Link matrik to kontrak
                    await db.update(permohonanKontrak).set({ matrikId: newMatrik.id })
                        .where(eq(permohonanKontrak.id, id));
                    console.log(`[Kontrak→Matrik] Created new matrik #${newMatrik.id} for kontrak #${id}`);
                }
            } catch (e: any) {
                console.error('[Kontrak→Matrik] Sync error:', e.message);
            }
        }

        return updated;
    },

    // Delete permohonan
    async deletePermohonan(id: number) {
        await db.delete(permohonanKontrak).where(eq(permohonanKontrak.id, id));
    },

    // ===== REALISASI =====
    async listRealisasi(kontrakId: number) {
        return db.select().from(realisasi)
            .where(eq(realisasi.kontrakId, kontrakId))
            .orderBy(desc(realisasi.tahun), desc(realisasi.bulan));
    },

    // List realisasi by matrikId (direct matrik link)
    async listRealisasiByMatrik(matrikId: number) {
        return db.select().from(realisasi)
            .where(eq(realisasi.matrikId, matrikId))
            .orderBy(desc(realisasi.tahun), desc(realisasi.bulan));
    },

    // All realisasi for admin/verifikator monitoring
    async listAllRealisasi() {
        return db.select({
            realisasi: realisasi,
            namaPerusahaan: sql<string>`COALESCE(${perusahaan.namaPerusahaan}, ${matrikKegiatan.penyedia})`.as('namaPerusahaan'),
            namaPaket: sql<string>`COALESCE(${matrikKegiatan.namaPaket}, ${permohonanKontrak.namaPaket})`.as('namaPaket'),
            noSpk: sql<string>`COALESCE(${matrikKegiatan.noSpk}, ${permohonanKontrak.noSpk})`.as('noSpk'),
            jenisPengadaan: sql<string>`COALESCE(${matrikKegiatan.jenisPengadaan}, ${permohonanKontrak.jenisPengadaan})`.as('jenisPengadaan'),
        }).from(realisasi)
          .leftJoin(permohonanKontrak, eq(realisasi.kontrakId, permohonanKontrak.id))
          .leftJoin(perusahaan, eq(permohonanKontrak.perusahaanId, perusahaan.id))
          .leftJoin(matrikKegiatan, eq(realisasi.matrikId, matrikKegiatan.id))
          .orderBy(desc(realisasi.createdAt));
    },

    // List matrik by jenis pengadaan (for penyedia realisasi page)
    async listMatrikByJenis(jenisList: string[], userId?: string) {
        // If userId provided (penyedia), filter by their company name
        let penyediaName: string | null = null;
        if (userId) {
            const myPerusahaan = await db.select({ namaPerusahaan: perusahaan.namaPerusahaan })
                .from(perusahaan).where(eq(perusahaan.userId, userId));
            if (myPerusahaan[0]) {
                penyediaName = myPerusahaan[0].namaPerusahaan;
            }
        }

        const allMatrik = await db.select({
            id: matrikKegiatan.id,
            noMatrik: matrikKegiatan.noMatrik,
            namaPaket: matrikKegiatan.namaPaket,
            namaSekolah: matrikKegiatan.namaSekolah,
            npsn: matrikKegiatan.npsn,
            jenisPengadaan: matrikKegiatan.jenisPengadaan,
            penyedia: matrikKegiatan.penyedia,
            nilaiKontrak: matrikKegiatan.nilaiKontrak,
            noSpk: matrikKegiatan.noSpk,
            tahunAnggaran: matrikKegiatan.tahunAnggaran,
        }).from(matrikKegiatan);

        // Filter: only indukan (parent) — noMatrik tanpa titik (bukan x.1, x.2, etc.)
        const parents = allMatrik.filter((m: any) => {
            const nm = m.noMatrik;
            const isChild = /^\d+\.\d+/.test(nm) || nm.includes(',');
            if (isChild) return false;
            if (!jenisList.some(j => (m.jenisPengadaan || '').includes(j))) return false;
            // If penyedia filter, match company name (case-insensitive)
            if (penyediaName) {
                return (m.penyedia || '').toLowerCase().includes(penyediaName.toLowerCase());
            }
            return true;
        });

        // For each parent, find its children
        const result = parents.map((p: any) => {
            const children = allMatrik.filter((m: any) => {
                const nm = m.noMatrik;
                return (nm.startsWith(p.noMatrik + '.') || nm.startsWith(p.noMatrik + ',')) && nm !== p.noMatrik;
            });
            return { ...p, anakan: children };
        });

        return result;
    },

    // Get anakan by matrikId directly
    async getAnakanByMatrik(matrikId: number) {
        const parentRow = await db.select({
            noMatrik: matrikKegiatan.noMatrik,
        }).from(matrikKegiatan).where(eq(matrikKegiatan.id, matrikId));
        if (!parentRow[0]) return [];

        const baseNo = parentRow[0].noMatrik;

        const allMatrik = await db.select({
            id: matrikKegiatan.id,
            noMatrik: matrikKegiatan.noMatrik,
            namaPaket: matrikKegiatan.namaPaket,
            namaSekolah: matrikKegiatan.namaSekolah,
            npsn: matrikKegiatan.npsn,
            nilaiKontrak: matrikKegiatan.nilaiKontrak,
        }).from(matrikKegiatan);

        return allMatrik.filter((m: any) =>
            (m.noMatrik.startsWith(baseNo + '.') || m.noMatrik.startsWith(baseNo + ',')) && m.noMatrik !== baseNo
        );
    },

    // Get anakan (child matrik entries) for a kontrak
    async getAnakan(kontrakId: number) {
        const kontrakRow = await db.select({
            matrikId: permohonanKontrak.matrikId,
        }).from(permohonanKontrak).where(eq(permohonanKontrak.id, kontrakId));
        if (!kontrakRow[0] || !kontrakRow[0].matrikId) return [];

        return this.getAnakanByMatrik(kontrakRow[0].matrikId);
    },

    async createRealisasi(kontrakId: number | null, data: any, userId: string) {
        const [created] = await db.insert(realisasi).values({
            kontrakId: kontrakId || null,
            matrikId: data.matrikId ? Number(data.matrikId) : null,
            namaSekolah: data.namaSekolah,
            tahun: Number(data.tahun),
            bulan: Number(data.bulan),
            targetPersen: String(data.targetPersen || 0),
            realisasiPersen: String(data.realisasiPersen || 0),
            dokumentasiPaths: data.dokumentasiPaths || null,
            keterangan: data.keterangan || null,
            createdBy: userId,
        }).returning();
        return created;
    },

    async updateRealisasi(id: number, data: any) {
        const [updated] = await db.update(realisasi).set({
            namaSekolah: data.namaSekolah,
            matrikId: data.matrikId !== undefined ? (data.matrikId ? Number(data.matrikId) : null) : undefined,
            tahun: data.tahun ? Number(data.tahun) : undefined,
            bulan: data.bulan ? Number(data.bulan) : undefined,
            targetPersen: data.targetPersen !== undefined ? String(data.targetPersen) : undefined,
            realisasiPersen: data.realisasiPersen !== undefined ? String(data.realisasiPersen) : undefined,
            dokumentasiPaths: data.dokumentasiPaths,
            keterangan: data.keterangan,
        }).where(eq(realisasi.id, id)).returning();
        return updated;
    },

    async deleteRealisasi(id: number) {
        await db.delete(realisasi).where(eq(realisasi.id, id));
    },

    // Dashboard stats for penyedia
    async getStats(userId: string) {
        const myPerusahaan = await db.select().from(perusahaan).where(eq(perusahaan.userId, userId));
        if (!myPerusahaan[0]) return { total: 0, menunggu: 0, diverifikasi: 0, ditolak: 0 };

        const pId = myPerusahaan[0].id;
        const all = await db.select({ status: permohonanKontrak.status })
            .from(permohonanKontrak).where(eq(permohonanKontrak.perusahaanId, pId));

        return {
            total: all.length,
            menunggu: all.filter(r => r.status === 'Menunggu').length,
            diverifikasi: all.filter(r => r.status === 'Diverifikasi').length,
            ditolak: all.filter(r => r.status === 'Ditolak').length,
        };
    },
};
