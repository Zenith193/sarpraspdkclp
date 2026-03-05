import 'dotenv/config';
import { db } from './index.js';
import { sekolah, proyeksiAnggaran, snpAcuan, bastTemplate, prestasiPointRule, appSettings } from './schema/index.js';
import { auth } from '../auth/index.js';

/**
 * Seed script to populate the database with initial data matching frontend mockData.js
 * Run: npm run db:seed
 */
async function seed() {
    console.log('🌱 Seeding database...\n');

    // 1. Seed Sekolah
    console.log('📚 Seeding sekolah...');
    const sekolahData = [
        { nama: 'SDN 01 Kroya', npsn: '20301001', jenjang: 'SD', kecamatan: 'Kroya', status: 'Negeri', alamat: 'Jl. Raya Kroya No. 1', kepsek: 'Suyanto, S.Pd', nip: '196701021992031003', noRek: '0012345678', namaBank: 'Bank Jateng', rombel: 12 },
        { nama: 'SDN 02 Kroya', npsn: '20301002', jenjang: 'SD', kecamatan: 'Kroya', status: 'Negeri', alamat: 'Jl. Pramuka No. 5', kepsek: 'Sumarni, S.Pd', nip: '197003121993042002', noRek: '0012345679', namaBank: 'Bank Jateng', rombel: 9 },
        { nama: 'SDN 01 Majenang', npsn: '20301003', jenjang: 'SD', kecamatan: 'Majenang', status: 'Negeri', alamat: 'Jl. Merdeka No. 10', kepsek: 'Ahmad Fauzi, S.Pd', nip: '196805151990031005', noRek: '0012345680', namaBank: 'Bank Jateng', rombel: 15 },
        { nama: 'SMPN 01 Cilacap Tengah', npsn: '20302001', jenjang: 'SMP', kecamatan: 'Cilacap Tengah', status: 'Negeri', alamat: 'Jl. Jend. Sudirman No. 20', kepsek: 'Budi Santoso, M.Pd', nip: '197201031995031001', noRek: '0012345681', namaBank: 'Bank Jateng', rombel: 24 },
        { nama: 'SMPN 02 Kesugihan', npsn: '20302002', jenjang: 'SMP', kecamatan: 'Kesugihan', status: 'Negeri', alamat: 'Jl. Kesugihan Raya No. 15', kepsek: 'Sri Wahyuni, M.Pd', nip: '198001152003042001', noRek: '0012345682', namaBank: 'Bank BRI', rombel: 18 },
        { nama: 'SDN 03 Adipala', npsn: '20301006', jenjang: 'SD', kecamatan: 'Adipala', status: 'Negeri', alamat: 'Jl. Adipala No. 8', kepsek: 'Hartono, S.Pd', nip: '197105201994031002', noRek: '0012345683', namaBank: 'Bank Jateng', rombel: 6 },
        { nama: 'SMP Maarif Gandrungmangu', npsn: '20302007', jenjang: 'SMP', kecamatan: 'Gandrungmangu', status: 'Swasta', alamat: 'Jl. Masjid No. 3', kepsek: 'Dwi Prasetyo, S.Pd', nip: '-', noRek: '0012345684', namaBank: 'Bank BRI', rombel: 6 },
        { nama: 'SDN 01 Sidareja', npsn: '20301008', jenjang: 'SD', kecamatan: 'Sidareja', status: 'Negeri', alamat: 'Jl. Sidareja No. 2', kepsek: 'Eko Purnomo, S.Pd.SD', nip: '198203102006041001', noRek: '0012345685', namaBank: 'Bank Jateng', rombel: 11 },
        { nama: 'SDN 02 Binangun', npsn: '20301009', jenjang: 'SD', kecamatan: 'Binangun', status: 'Negeri', alamat: 'Jl. Binangun No. 7', kepsek: 'Siti Nurjanah, S.Pd', nip: '197505201998032003', noRek: '0012345686', namaBank: 'Bank Jateng', rombel: 8 },
        { nama: 'SMPN 01 Maos', npsn: '20302010', jenjang: 'SMP', kecamatan: 'Maos', status: 'Negeri', alamat: 'Jl. Maos No. 12', kepsek: 'Teguh Wibowo, M.Pd', nip: '196909121994031004', noRek: '0012345687', namaBank: 'Bank Jateng', rombel: 21 },
    ];
    await db.insert(sekolah).values(sekolahData).onConflictDoNothing();
    console.log(`  ✅ ${sekolahData.length} sekolah seeded`);

    // 2. Seed Proyeksi Anggaran
    console.log('💰 Seeding proyeksi anggaran...');
    await db.insert(proyeksiAnggaran).values([
        { jenisPrasarana: 'Ruang Kelas', jenjang: 'SD', lantai: 1, rusakSedang: 75000000, rusakBerat: 100000000, pembangunan: 150000000 },
        { jenisPrasarana: 'Toilet', jenjang: 'SD', lantai: 1, rusakSedang: 50000000, rusakBerat: 75000000, pembangunan: 50000000 },
        { jenisPrasarana: 'Ruang Kelas', jenjang: 'SMP', lantai: 1, rusakSedang: 75000000, rusakBerat: 100000000, pembangunan: 175000000 },
        { jenisPrasarana: 'Ruang Laboratorium', jenjang: 'SMP', lantai: 1, rusakSedang: 100000000, rusakBerat: 150000000, pembangunan: 200000000 },
    ]).onConflictDoNothing();
    console.log('  ✅ Proyeksi anggaran seeded');

    // 3. Seed SNP Acuan
    console.log('📐 Seeding SNP acuan...');
    await db.insert(snpAcuan).values([
        { jenisPrasarana: 'Ruang Kelas', jenjang: 'SD', judulRehabilitasi: 'Rehabilitasi Ruang Kelas SD', judulPembangunan: 'Pembangunan Ruang Kelas Baru SD' },
        { jenisPrasarana: 'Ruang Kelas', jenjang: 'SMP', judulRehabilitasi: 'Rehabilitasi Ruang Kelas SMP', judulPembangunan: 'Pembangunan Ruang Kelas Baru SMP' },
        { jenisPrasarana: 'Toilet', jenjang: 'SD', judulRehabilitasi: 'Rehabilitasi Toilet SD', judulPembangunan: 'Pembangunan Toilet Baru SD' },
    ]).onConflictDoNothing();
    console.log('  ✅ SNP acuan seeded');

    // 4. Seed BAST Templates
    console.log('📝 Seeding BAST templates...');
    await db.insert(bastTemplate).values([
        { nama: 'BAST Pekerjaan Konstruksi', header: 'BERITA ACARA SERAH TERIMA\nPEKERJAAN KONSTRUKSI', deskripsi: 'Template untuk pekerjaan konstruksi', jenisCocok: 'Pekerjaan Konstruksi' },
        { nama: 'BAST Jasa Konsultansi', header: 'BERITA ACARA SERAH TERIMA\nJASA KONSULTANSI', deskripsi: 'Template untuk jasa konsultansi', jenisCocok: 'Jasa Konsultansi' },
        { nama: 'BAST Pengadaan Barang', header: 'BERITA ACARA SERAH TERIMA\nPENGADAAN BARANG', deskripsi: 'Template untuk pengadaan barang/peralatan', jenisCocok: 'Pengadaan Barang' },
    ]).onConflictDoNothing();
    console.log('  ✅ BAST templates seeded');

    // 5. Seed Prestasi Point Rules
    console.log('🏆 Seeding point rules...');
    await db.insert(prestasiPointRule).values([
        { tingkat: 'Kabupaten/Kota', kategori: 'Perorangan', capaian: 'Juara 1', poin: 10 },
        { tingkat: 'Kabupaten/Kota', kategori: 'Perorangan', capaian: 'Juara 2', poin: 8 },
        { tingkat: 'Kabupaten/Kota', kategori: 'Perorangan', capaian: 'Juara 3', poin: 6 },
        { tingkat: 'Kabupaten/Kota', kategori: 'Beregu', capaian: 'Juara 1', poin: 15 },
        { tingkat: 'Provinsi', kategori: 'Perorangan', capaian: 'Juara 1', poin: 20 },
        { tingkat: 'Nasional', kategori: 'Perorangan', capaian: 'Juara 1', poin: 30 },
        { tingkat: 'Nasional', kategori: 'Beregu', capaian: 'Juara 1', poin: 40 },
        { tingkat: 'Provinsi', kategori: 'Beregu', capaian: 'Juara 1', poin: 25 },
    ]).onConflictDoNothing();
    console.log('  ✅ Point rules seeded');

    // 6. Create default admin user via Better Auth
    console.log('👤 Creating admin user...');
    try {
        await auth.api.signUpEmail({
            body: {
                name: 'Admin Dinas',
                email: 'admin@cilacap.go.id',
                password: 'admin123',
                role: 'admin',
            },
        });
        console.log('  ✅ Admin user created (admin@cilacap.go.id / admin123)');
    } catch (e: any) {
        console.log('  ⚠️  Admin might already exist:', e.message || 'skipped');
    }

    console.log('\n✨ Seeding complete!');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
