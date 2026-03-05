import { KECAMATAN, JENJANG, KONDISI, JENIS_PRASARANA } from '../utils/constants.js';

const sekolahList = [
    { id: 1, nama: 'SDN 01 Kroya', npsn: '20301001', jenjang: 'SD', kecamatan: 'Kroya', status: 'Negeri', alamat: 'Jl. Raya Kroya No. 1', kepsek: 'Suyanto, S.Pd', nip: '196701021992031003', noRek: '0012345678', namaBank: 'Bank Jateng', rombel: 12 },
    { id: 2, nama: 'SDN 02 Kroya', npsn: '20301002', jenjang: 'SD', kecamatan: 'Kroya', status: 'Negeri', alamat: 'Jl. Pramuka No. 5', kepsek: 'Sumarni, S.Pd', nip: '197003121993042002', noRek: '0012345679', namaBank: 'Bank Jateng', rombel: 9 },
    { id: 3, nama: 'SDN 01 Majenang', npsn: '20301003', jenjang: 'SD', kecamatan: 'Majenang', status: 'Negeri', alamat: 'Jl. Merdeka No. 10', kepsek: 'Ahmad Fauzi, S.Pd', nip: '196805151990031005', noRek: '0012345680', namaBank: 'Bank Jateng', rombel: 15 },
    { id: 4, nama: 'SMPN 01 Cilacap Tengah', npsn: '20302001', jenjang: 'SMP', kecamatan: 'Cilacap Tengah', status: 'Negeri', alamat: 'Jl. Jend. Sudirman No. 20', kepsek: 'Budi Santoso, M.Pd', nip: '197201031995031001', noRek: '0012345681', namaBank: 'Bank Jateng', rombel: 24 },
    { id: 5, nama: 'SMPN 02 Kesugihan', npsn: '20302002', jenjang: 'SMP', kecamatan: 'Kesugihan', status: 'Negeri', alamat: 'Jl. Kesugihan Raya No. 15', kepsek: 'Sri Wahyuni, M.Pd', nip: '198001152003042001', noRek: '0012345682', namaBank: 'Bank BRI', rombel: 18 },
    { id: 6, nama: 'SDN 03 Adipala', npsn: '20301006', jenjang: 'SD', kecamatan: 'Adipala', status: 'Negeri', alamat: 'Jl. Adipala No. 8', kepsek: 'Hartono, S.Pd', nip: '197105201994031002', noRek: '0012345683', namaBank: 'Bank Jateng', rombel: 6 },
    { id: 7, nama: 'SMP Maarif Gandrungmangu', npsn: '20302007', jenjang: 'SMP', kecamatan: 'Gandrungmangu', status: 'Swasta', alamat: 'Jl. Masjid No. 3', kepsek: 'Dwi Prasetyo, S.Pd', nip: '-', noRek: '0012345684', namaBank: 'Bank BRI', rombel: 6 },
    { id: 8, nama: 'SDN 01 Sidareja', npsn: '20301008', jenjang: 'SD', kecamatan: 'Sidareja', status: 'Negeri', alamat: 'Jl. Sidareja No. 2', kepsek: 'Eko Purnomo, S.Pd.SD', nip: '198203102006041001', noRek: '0012345685', namaBank: 'Bank Jateng', rombel: 11 },
    { id: 9, nama: 'SDN 02 Binangun', npsn: '20301009', jenjang: 'SD', kecamatan: 'Binangun', status: 'Negeri', alamat: 'Jl. Binangun No. 7', kepsek: 'Siti Nurjanah, S.Pd', nip: '197505201998032003', noRek: '0012345686', namaBank: 'Bank Jateng', rombel: 8 },
    { id: 10, nama: 'SMPN 01 Maos', npsn: '20302010', jenjang: 'SMP', kecamatan: 'Maos', status: 'Negeri', alamat: 'Jl. Maos No. 12', kepsek: 'Teguh Wibowo, M.Pd', nip: '196909121994031004', noRek: '0012345687', namaBank: 'Bank Jateng', rombel: 21 },
];

const generateSarprasData = () => {
    const data = [];
    let id = 1;
    sekolahList.forEach(sekolah => {
        const count = Math.floor(Math.random() * 8) + 3;
        for (let i = 0; i < count; i++) {
            const panjang = +(Math.random() * 10 + 5).toFixed(2);
            const lebar = +(Math.random() * 8 + 4).toFixed(2);
            const kondisiIdx = Math.random();
            let kondisi;
            if (kondisiIdx < 0.43) kondisi = 'BAIK';
            else if (kondisiIdx < 0.69) kondisi = 'RUSAK RINGAN';
            else if (kondisiIdx < 0.98) kondisi = 'RUSAK SEDANG';
            else kondisi = 'RUSAK BERAT';

            const jenisPrasarana = JENIS_PRASARANA[Math.floor(Math.random() * JENIS_PRASARANA.length)];
            const masaBangunan = String.fromCharCode(65 + Math.floor(Math.random() * 10));

            data.push({
                id: id++,
                sekolahId: sekolah.id,
                namaSekolah: sekolah.nama,
                npsn: sekolah.npsn,
                jenjang: sekolah.jenjang,
                kecamatan: sekolah.kecamatan,
                masaBangunan,
                jenisPrasarana,
                namaRuang: `${jenisPrasarana} ${String.fromCharCode(65 + i)}`,
                lantai: Math.floor(Math.random() * 2) + 1,
                panjang,
                lebar,
                luas: +(panjang * lebar).toFixed(2),
                foto: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, fi) => ({
                    id: `foto-${id}-${fi}`,
                    url: `https://picsum.photos/seed/sarpras${id}f${fi}/800/600`,
                    nama: `Foto ${fi + 1} - ${jenisPrasarana} ${String.fromCharCode(65 + i)}.jpg`,
                    geoLat: -7.6 + Math.random() * 0.1,
                    geoLng: 109.0 + Math.random() * 0.2,
                })),
                kondisi,
                keterangan: kondisi !== 'BAIK' ? 'Perlu perbaikan' : 'Kondisi baik',
                verified: Math.random() > 0.3,
                createdAt: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
            });
        }
    });
    return data;
};

const generateProposalData = () => {
    const subKegiatanList = [
        { kode: '1.01.02.2.01.0047', nama: 'Pembangunan Ruang Kelas Baru SD' },
        { kode: '1.01.02.2.01.0051', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah SD' },
        { kode: '1.01.02.2.02.0014', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah SMP' },
        { kode: '1.01.02.2.01.0009', nama: 'Rehabilitasi Sedang/Berat Ruang Guru/Kepala Sekolah/TU SD' },
        { kode: '1.01.02.2.02.0059', nama: 'Pembangunan Ruang Kelas Baru SMP' },
    ];
    const statuses = ['Menunggu Verifikasi', 'Disetujui', 'Ditolak', 'Revisi'];
    const keranjangStages = [
        'Keranjang Usulan Sekolah',
        'Keranjang Usulan Korwil',
        'Keranjang Usulan Kabupaten',
        'Keranjang Usulan Provinsi',
        'Keranjang Usulan Pusat'
    ];

    return sekolahList.slice(0, 8).map((sekolah, i) => {
        const subKeg = subKegiatanList[i % subKegiatanList.length];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        return {
            id: i + 1,
            sekolahId: sekolah.id,
            namaSekolah: sekolah.nama,
            npsn: sekolah.npsn,
            kecamatan: sekolah.kecamatan,
            jenjang: sekolah.jenjang,
            subKegiatan: `${subKeg.kode} ${subKeg.nama}`,
            nilaiPengajuan: Math.floor(Math.random() * 200_000_000) + 50_000_000,
            target: Math.random() > 0.5 ? '1 Paket' : '1 Lokal',
            noAgendaSurat: status === 'Disetujui' ? `AG/${i + 1}/2025` : '',
            tanggalSurat: status === 'Disetujui' ? '2025-06-15' : '',
            statusUsulan: status === 'Disetujui' ? 'Belum dapat bantuan' : '',
            fotoKerusakan: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, fi) => ({
                id: `fprop-${i}-${fi}`,
                url: `https://picsum.photos/seed/prop${i}f${fi}/800/600`,
                nama: `Foto Kerusakan ${fi + 1}.jpg`,
            })),
            keterangan: 'Atap baja ringan keropos, perlu perbaikan segera',
            status,
            bintang: Math.floor(Math.random() * 5) + 1,
            keranjang: keranjangStages[Math.floor(Math.random() * keranjangStages.length)],
            ranking: i + 1,
            createdAt: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        };
    });
};

const generateAktivitasData = () => {
    const aktivitasList = [
        { user: 'Admin Dinas', jenis: 'Admin', aktivitas: 'Login berhasil' },
        { user: 'Admin Dinas', jenis: 'Admin', aktivitas: 'Mengedit data sarpras SDN 01 Kroya' },
        { user: 'Verifikator 1', jenis: 'Verifikator', aktivitas: 'Memverifikasi proposal SDN 02 Kroya' },
        { user: 'Korwil Kroya', jenis: 'Korwil', aktivitas: 'Login berhasil' },
        { user: 'SDN 01 Majenang', jenis: 'Sekolah', aktivitas: 'Mengajukan proposal baru' },
        { user: 'SDN 02 Binangun', jenis: 'Sekolah', aktivitas: 'Menambah data sarpras' },
        { user: 'Verifikator 1', jenis: 'Verifikator', aktivitas: 'Menyetujui sarpras SMPN 01 Cilacap Tengah' },
        { user: 'Korwil Majenang', jenis: 'Korwil', aktivitas: 'Meranking proposal SDN 01 Majenang' },
        { user: 'Admin Dinas', jenis: 'Admin', aktivitas: 'Menghapus data sarpras lama' },
        { user: 'SMPN 02 Kesugihan', jenis: 'Sekolah', aktivitas: 'Login gagal' },
    ];

    return aktivitasList.map((a, i) => ({
        id: i + 1,
        namaAkun: a.user,
        jenisAkun: a.jenis,
        aktivitas: a.aktivitas,
        keterangan: a.aktivitas,
        waktu: new Date(2025, 5, 15, 8 + i, Math.floor(Math.random() * 60)).toISOString(),
    }));
};

export const mockSekolah = sekolahList;
export const mockSarpras = generateSarprasData();
export const mockProposal = generateProposalData();
export const mockAktivitas = generateAktivitasData();

export const mockUsers = [
    { id: 1, namaAkun: 'Admin Dinas', role: 'Admin', email: 'admin@cilacap.go.id', password: 'admin123', kepsek: '-', nip: '-', noRek: '-', namaBank: '-', rombel: 0, aktif: true },
    { id: 2, namaAkun: 'Verifikator 1', role: 'Verifikator', email: 'verifikator@cilacap.go.id', password: 'verif123', kepsek: '-', nip: '-', noRek: '-', namaBank: '-', rombel: 0, aktif: true },
    { id: 3, namaAkun: 'Korwil Kroya', role: 'Korwil', email: 'korwil.kroya@cilacap.go.id', password: 'korwil123', wilayah: ['Kroya', 'Adipala'], kepsek: '-', nip: '-', noRek: '-', namaBank: '-', rombel: 0, aktif: true, jenjang: 'SD' },
    ...sekolahList.map((s, i) => ({
        id: 10 + i, namaAkun: s.nama, role: 'Sekolah', email: s.npsn, password: 'sekolah123', kepsek: s.kepsek, nip: s.nip, noRek: s.noRek, namaBank: s.namaBank, rombel: s.rombel, aktif: true, sekolahId: s.id, npsn: s.npsn, kecamatan: s.kecamatan, jenjang: s.jenjang
    }))
];

export const mockRiwayatBantuan = [
    { id: 1, namaSekolah: 'SDN 01 Kroya', npsn: '20301001', namaPaket: 'Rehabilitasi Ruang Kelas A', nilaiPaket: 100000000, volumePaket: '1 Paket', bast: null },
    { id: 2, namaSekolah: 'SMPN 01 Cilacap Tengah', npsn: '20302001', namaPaket: 'Pembangunan Ruang Kelas Baru', nilaiPaket: 250000000, volumePaket: '1 Lokal', bast: null },
];

export const mockProyeksiAnggaran = [
    { id: 1, jenisPrasarana: 'Ruang Kelas', jenjang: 'SD', lantai: 1, baik: 0, rusakRingan: 0, rusakSedang: 75000000, rusakBerat: 100000000, pembangunan: 150000000 },
    { id: 2, jenisPrasarana: 'Toilet', jenjang: 'SD', lantai: 1, baik: 0, rusakRingan: 0, rusakSedang: 50000000, rusakBerat: 75000000, pembangunan: 50000000 },
    { id: 3, jenisPrasarana: 'Ruang Kelas', jenjang: 'SMP', lantai: 1, baik: 0, rusakRingan: 0, rusakSedang: 75000000, rusakBerat: 100000000, pembangunan: 175000000 },
    { id: 4, jenisPrasarana: 'Ruang Laboratorium', jenjang: 'SMP', lantai: 1, baik: 0, rusakRingan: 0, rusakSedang: 100000000, rusakBerat: 150000000, pembangunan: 200000000 },
];
