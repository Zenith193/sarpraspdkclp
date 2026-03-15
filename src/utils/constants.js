export const KECAMATAN = [
    'Adipala', 'Bantarsari', 'Binangun', 'Cilacap Selatan', 'Cilacap Tengah',
    'Cilacap Utara', 'Cimanggu', 'Cipari', 'Dayeuhluhur', 'Gandrungmangu',
    'Jeruklegi', 'Kampung Laut', 'Karangpucung', 'Kawunganten', 'Kedungreja',
    'Kesugihan', 'Kroya', 'Majenang', 'Maos', 'Nusawungu',
    'Patimuan', 'Sampang', 'Sidareja', 'Wanareja'
];

export const JENJANG = ['SD', 'SMP'];

export const STATUS_SEKOLAH = ['Negeri', 'Swasta'];

export const MASA_BANGUNAN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const JENIS_PRASARANA = [
    'Ruang Kelas',
    'Toilet',
    'Ruang Administrasi',
    'Lainnya',
    'Ruang Perpustakaan',
    'Ruang Ibadah',
    'Ruang UKS',
    'Tempat Bermain atau Berolahraga',
    'Ruang Laboratorium',
    'Kantin',
    'Ruang Pusat Sumber Pendidikan Inklusif'
];

export const KONDISI = ['BAIK', 'RUSAK RINGAN', 'RUSAK SEDANG', 'RUSAK BERAT'];

export const LANTAI_OPTIONS = [1, 2, 3, 4, 5, 6];

export const ROLES = {
    ADMIN: 'admin',
    VERIFIKATOR: 'verifikator',
    KORWIL: 'korwil',
    SEKOLAH: 'sekolah'
};

export const SUB_KEGIATAN = [
    { kode: '1.01.02.2.01.0003', nama: 'Pembangunan Ruang Guru/Kepala Sekolah/TU SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0006', nama: 'Pembangunan Sarana, Prasarana dan Utilitas Sekolah SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0009', nama: 'Rehabilitasi Sedang/Berat Ruang Guru/Kepala Sekolah/TU SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0011', nama: 'Rehabilitasi Sedang/Berat Perpustakaan Sekolah SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0014', nama: 'Pengadaan Mebel Sekolah SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0031', nama: 'Pembangunan Laboratorium Sekolah Dasar SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0032', nama: 'Rehabilitasi Sedang/Berat Laboratorium Sekolah Dasar SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0047', nama: 'Pembangunan Ruang Kelas Baru SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0048', nama: 'Rehabilitasi Sedang/Berat Sarana, Prasarana dan Utilitas Sekolah SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0051', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah SD', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0055', nama: 'Pengadaan Alat Praktik dan Peraga Peserta Didik SD', jenjang: 'SD' },
    { kode: '1.01.02.2.02.0004', nama: 'Pembangunan Ruang Unit Kesehatan Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0006', nama: 'Pembangunan Laboratorium SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0012', nama: 'Pembangunan Sarana, Prasarana dan Utilitas Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0014', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0018', nama: 'Rehabilitasi Sedang/Berat Laboratorium SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0024', nama: 'Rehabilitasi Sedang/Berat Sarana, Prasarana dan Utilitas Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0025', nama: 'Pengadaan Mebel Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0027', nama: 'Pengadaan Perlengkapan Sekolah SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0059', nama: 'Pembangunan Ruang Kelas Baru SMP', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0067', nama: 'Pengadaan Alat Praktik dan Peraga Peserta Didik SMP', jenjang: 'SMP' },
];

export const STATUS_PROPOSAL = ['Menunggu Verifikasi', 'Disetujui', 'Diterima', 'Ditolak', 'Revisi', 'Terealisasi'];

export const KERANJANG = [
    'Keranjang Usulan Sekolah',
    'Keranjang Usulan Korwil',
    'Keranjang Usulan Kabupaten',
    'Keranjang Usulan Provinsi',
    'Keranjang Usulan Pusat'
];

export const TINGKAT_LOMBA = ['Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'];

export const JENIS_AKUN = ['Admin', 'Verifikator', 'Korwil', 'Sekolah'];
