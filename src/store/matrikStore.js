import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SUB_KEGIATAN } from '../utils/constants';

// Placeholder sekolah data for initial seed — will be replaced by API data
const _seedSekolah = [
    { npsn: '20301001', nama: 'SDN 01 Kroya' },
    { npsn: '20301002', nama: 'SDN 02 Kroya' },
    { npsn: '20301003', nama: 'SDN 01 Majenang' },
    { npsn: '20302001', nama: 'SMPN 01 Cilacap Tengah' },
    { npsn: '20302002', nama: 'SMPN 02 Kesugihan' },
];

// ===== DEFAULT CONSTANTS =====
const DEFAULT_SUMBER_DANA = ['APBD', 'DAK', 'BANKEU', 'APBD Perubahan', 'SG', 'Bantuan Pemerintah'];
const DEFAULT_JENIS_PENGADAAN = ['Jasa Konsultansi Perencanaan', 'Jasa Konsultansi Pengawasan', 'Pekerjaan Konstruksi', 'Pengadaan Barang'];
const DEFAULT_METODE_PEMILIHAN = ['E-Purchasing', 'Pengadaan Langsung', 'Swakelola', 'Tender'];
const DEFAULT_STATUS_PEMILIK = ['Direktur', 'Kepala Cabang'];
const DEFAULT_SUB_KEGIATAN = [
    { kode: '1.01.02.2.01.0003', nama: 'Pembangunan Ruang Guru/Kepala Sekolah/TU', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0006', nama: 'Pembangunan Sarana, Prasarana dan Utilitas Sekolah', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0009', nama: 'Rehabilitasi Sedang/Berat Ruang Guru/Kepala Sekolah/TU', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0011', nama: 'Rehabilitasi Sedang/Berat Perpustakaan Sekolah', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0014', nama: 'Pengadaan Mebel Sekolah', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0031', nama: 'Pembangunan Laboratorium Sekolah Dasar', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0032', nama: 'Rehabilitasi Sedang/Berat Laboratorium Sekolah Dasar', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0047', nama: 'Pembangunan Ruang Kelas Baru', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0048', nama: 'Rehabilitasi Sedang/Berat Sarana, Prasarana dan Utilitas Sekolah', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0051', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah', jenjang: 'SD' },
    { kode: '1.01.02.2.01.0055', nama: 'Pengadaan Alat Praktik dan Peraga Peserta Didik', jenjang: 'SD' },
    { kode: '1.01.02.2.02.0004', nama: 'Pembangunan Ruang Unit Kesehatan Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0006', nama: 'Pembangunan Laboratorium', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0012', nama: 'Pembangunan Sarana, Prasarana dan Utilitas Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0014', nama: 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0018', nama: 'Rehabilitasi Sedang/Berat Laboratorium', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0024', nama: 'Rehabilitasi Sedang/Berat Sarana, Prasarana dan Utilitas Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0025', nama: 'Pengadaan Mebel Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0027', nama: 'Pengadaan Perlengkapan Sekolah', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0059', nama: 'Pembangunan Ruang Kelas Baru', jenjang: 'SMP' },
    { kode: '1.01.02.2.02.0067', nama: 'Pengadaan Alat Praktik dan Peraga Peserta Didik', jenjang: 'SMP' },
];

// Backward-compat exports (will be overridden by store getters below)
let SUMBER_DANA = DEFAULT_SUMBER_DANA;
let JENIS_PENGADAAN = DEFAULT_JENIS_PENGADAAN;
let METODE_PEMILIHAN = DEFAULT_METODE_PEMILIHAN;
let STATUS_PEMILIK = DEFAULT_STATUS_PEMILIK;

export { SUMBER_DANA, JENIS_PENGADAAN, METODE_PEMILIHAN, STATUS_PEMILIK };

// ===== HELPERS =====
const currentYear = new Date().getFullYear();
const KODE_JENIS_MAP = { 'Jasa Konsultansi Perencanaan': 'A1', 'Jasa Konsultansi Pengawasan': 'A2', 'Pekerjaan Konstruksi': 'A3' };
const KODE_BARANG_MAP = { 'APBD': 'A4', 'APBD Perubahan': 'A4', 'BANKEU': 'B4', 'DAK': 'D4', 'SG': 'S4', 'Bantuan Pemerintah': 'BP4' };

export const generateNoSpk = (noMatrik, jenis, sumber, tahun) => {
    if (!noMatrik || !jenis || !tahun) return '';
    let kode = 'XX';
    if (jenis === 'Pengadaan Barang') { kode = KODE_BARANG_MAP[sumber] || 'X4'; } else { kode = KODE_JENIS_MAP[jenis] || 'XX'; }
    const cleanMatrik = String(noMatrik).replace(/\s/g, '');
    const parts = cleanMatrik.split(',');
    const mainPart = parts[0].padStart(3, '0');
    let formattedMatrik = mainPart;
    if (parts.length > 1) formattedMatrik = mainPart + ',' + parts.slice(1).join(',');
    return `400.3.13/${formattedMatrik}/${kode}/${tahun}`;
};

export const inferJenjang = (inputString) => {
    if (!inputString) return '-';
    const text = String(inputString).toUpperCase();
    if (text.includes('SMK') || text.includes('SEKOLAH MENENGAH KEJURUAN')) return 'SMK';
    if (text.includes('SMP') || text.includes('SLTP') || text.includes('SEKOLAH MENENGAH PERTAMA')) return 'SMP';
    if (text.includes('SMA') || text.includes('SMU') || text.includes('SLTA') || text.includes('SEKOLAH MENENGAH ATAS')) return 'SMA';
    if (text.includes('SD') || text.includes('SEKOLAH DASAR') || text.includes('MI ')) return 'SD';
    const prefix = text.replace(/\D/g, '').charAt(0);
    if (prefix === '1') return 'SD';
    if (prefix === '2') return 'SMP';
    if (prefix === '3') return 'SMA';
    if (prefix === '4') return 'SMK';
    return '-';
};

const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
const terbilangHelper = (n) => { if (n < 12) return angka[n]; if (n < 20) return terbilangHelper(n - 10) + ' Belas'; if (n < 100) return terbilangHelper(Math.floor(n / 10)) + ' Puluh ' + terbilangHelper(n % 10); if (n < 200) return 'Seratus ' + terbilangHelper(n - 100); if (n < 1000) return terbilangHelper(Math.floor(n / 100)) + ' Ratus ' + terbilangHelper(n % 100); if (n < 2000) return 'Seribu ' + terbilangHelper(n - 1000); if (n < 1000000) return terbilangHelper(Math.floor(n / 1000)) + ' Ribu ' + terbilangHelper(n % 1000); if (n < 1000000000) return terbilangHelper(Math.floor(n / 1000000)) + ' Juta ' + terbilangHelper(n % 1000000); return ''; };
export const fullTerbilang = (nilai) => { if (!nilai || nilai === 0) return 'Nol Rupiah'; return terbilangHelper(nilai).replace(/\s+/g, ' ').trim() + ' Rupiah'; };

export const formatNumberInput = (value) => { if (!value) return ''; return value.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
export const parseFormattedNumber = (value) => { if (!value) return null; const num = parseInt(value.toString().replace(/\./g, ''), 10); return isNaN(num) ? null : num; };

export const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export const isIndukan = (noMatrik) => {
    const nm = String(noMatrik || '');
    if (nm.includes(',')) return false;
    // Dot-separated child: "87.1", "87.2" etc.
    if (/^\d+\.\d+$/.test(nm)) return false;
    return true;
};

// ===== SEED DATA =====
const generateSeedData = () => {
    const data = [];
    const samples = [
        { no: "1", sub: "Pembangunan Utama" }, { no: "1,1", sub: "Pekerjaan Persiapan" },
        { no: "1,2", sub: "Pekerjaan Struktur" }, { no: "2", sub: "Rehabilitasi" }, { no: "11", sub: "Pengadaan IT" }
    ];
    for (let i = 0; i < samples.length; i++) {
        const sub = SUB_KEGIATAN[i % SUB_KEGIATAN.length] || { kode: '1.01', nama: 'Pembangunan' };
        const jenis = JENIS_PENGADAAN[i % JENIS_PENGADAAN.length];
        const sumber = SUMBER_DANA[i % SUMBER_DANA.length];
        const kontrak = 95000000 + (i * 1000000);
        const sekolah = _seedSekolah[i % _seedSekolah.length];
        data.push({
            id: i + 1, noMatrik: samples[i].no,
            npsn: sekolah.npsn, namaSekolah: sekolah.nama,
            subBidang: inferJenjang(`${sub.kode} ${sub.nama}`),
            noSubKegiatan: sub.kode, subKegiatan: sub.nama,
            rup: `RUP-${currentYear}-${i}`,
            namaPaket: `${samples[i].sub} - Lokasi ${i + 1}`,
            paguAnggaran: 150000000, paguPaket: 100000000 + (i * 1000000),
            hps: 90000000 + (i * 1000000),
            nilaiKontrak: kontrak, terbilangKontrak: fullTerbilang(kontrak),
            sumberDana: sumber, metode: METODE_PEMILIHAN[0], jenisPengadaan: jenis,
            penyedia: 'CV. Maju Jaya', namaPemilik: 'H. Budi', statusPemilik: STATUS_PEMILIK[0],
            alamatKantor: 'Jl. Contoh No. 10',
            noSpk: generateNoSpk(samples[i].no, jenis, sumber, currentYear),
            tanggalMulai: `${currentYear}-01-10`, tanggalSelesai: `${currentYear}-04-10`,
            jangkaWaktu: 90, tahunAnggaran: currentYear,
            honor: jenis === 'Pekerjaan Konstruksi' ? 2500000 : 0
        });
    }
    return data;
};

// Pencairan seed data keyed by matrik id
const generatePencairanSeed = () => {
    const map = {};
    const statuses = ['Clear', 'Keuangan', 'Belum Masuk', 'Clear', 'Masuk'];
    const pencairanVals = [100, 30, 0, 70, 10];
    for (let i = 1; i <= 5; i++) {
        map[i] = {
            pencairanPersen: pencairanVals[i - 1],
            status: statuses[i - 1],
            noRegister: pencairanVals[i - 1] === 100 ? `REG-00${i}` : '',
            noSp2d: pencairanVals[i - 1] === 100 ? `SP2D-00${i}` : '',
            tanggalSp2d: ''
        };
    }
    return map;
};

// ===== BAST NUMBERING =====
export const generateNoBAST = (noMatrik, jenis, sumber, tahun, n = 1) => {
    if (!noMatrik || !jenis || !tahun) return '';
    let kode = 'XX';
    if (jenis === 'Pengadaan Barang') { kode = KODE_BARANG_MAP[sumber] || 'X4'; } else { kode = KODE_JENIS_MAP[jenis] || 'XX'; }
    const cleanMatrik = String(noMatrik).replace(/\s/g, '');

    // Check if this is an anakan (e.g. "67.1", "67,2")
    const dotMatch = cleanMatrik.match(/^(\d+)[.,](\d+)$/);
    if (dotMatch) {
        // Anakan: use noMatrik directly → 400.3.13/067.1/A3/2026
        const mainPart = dotMatch[1].padStart(3, '0');
        return `400.3.13/${mainPart}.${dotMatch[2]}/${kode}/${tahun}`;
    }

    // Indukan: append .n sequence → 400.3.13/068.n/A3/2026
    const mainPart = cleanMatrik.padStart(3, '0');
    return `400.3.13/${mainPart}.${n}/${kode}/${tahun}`;
};

// ===== DEFAULT BAST TEMPLATES =====
const DEFAULT_TEMPLATES = [
    {
        id: 1, nama: 'BAST Pekerjaan Konstruksi',
        header: 'BERITA ACARA SERAH TERIMA\nPEKERJAAN KONSTRUKSI',
        deskripsi: 'Template untuk pekerjaan konstruksi (pembangunan, rehabilitasi)',
        jenisCocok: 'Pekerjaan Konstruksi',
    },
    {
        id: 2, nama: 'BAST Jasa Konsultansi',
        header: 'BERITA ACARA SERAH TERIMA\nJASA KONSULTANSI',
        deskripsi: 'Template untuk jasa konsultansi perencanaan & pengawasan',
        jenisCocok: 'Jasa Konsultansi',
    },
    {
        id: 3, nama: 'BAST Pengadaan Barang',
        header: 'BERITA ACARA SERAH TERIMA\nPENGADAAN BARANG',
        deskripsi: 'Template untuk pengadaan barang/peralatan',
        jenisCocok: 'Pengadaan Barang',
    },
];

// ===== STORE =====
const useMatrikStore = create(
    persist(
        (set, get) => ({
            matrikData: [],
            pencairanMap: {},
            bastData: [],
            bastTemplates: DEFAULT_TEMPLATES,
            _nextId: 100,

            // ===== MATRIK CRUD =====
            addMatrik: (item) => set((state) => {
                const newId = state._nextId;
                return {
                    matrikData: [...state.matrikData, { ...item, id: newId }],
                    _nextId: newId + 1
                };
            }),

            updateMatrik: (id, updates) => set((state) => ({
                matrikData: state.matrikData.map(d => d.id === id ? { ...d, ...updates } : d)
            })),

            deleteMatrik: (id) => set((state) => ({
                matrikData: state.matrikData.filter(d => d.id !== id)
            })),

            setMatrikData: (data) => set({ matrikData: data }),

            // ===== CONFIGURABLE LISTS =====
            configSumberDana: DEFAULT_SUMBER_DANA,
            configJenisPengadaan: DEFAULT_JENIS_PENGADAAN,
            configMetodePemilihan: DEFAULT_METODE_PEMILIHAN,
            configSubKegiatan: DEFAULT_SUB_KEGIATAN,

            // Short code map: { 'APBD': 'A', 'DAK': 'D', 'Jasa Konsultansi Perencanaan': '1', ... }
            configKodeMap: {
                'APBD': 'A', 'DAK': 'D', 'BANKEU': 'B', 'APBD Perubahan': 'AP', 'SG': 'S', 'Bantuan Pemerintah': 'BP',
                'Jasa Konsultansi Perencanaan': '1', 'Jasa Konsultansi Pengawasan': '2', 'Pekerjaan Konstruksi': '3', 'Pengadaan Barang': '4',
                'E-Purchasing': 'E', 'Pengadaan Langsung': 'PL', 'Swakelola': 'SW', 'Tender': 'T',
            },

            updateKode: (nama, kode) => set((state) => ({
                configKodeMap: { ...state.configKodeMap, [nama]: kode }
            })),

            addConfigItem: (listName, item) => set((state) => ({
                [listName]: [...(state[listName] || []), item]
            })),
            removeConfigItem: (listName, index) => set((state) => ({
                [listName]: (state[listName] || []).filter((_, i) => i !== index)
            })),
            updateConfigItem: (listName, index, newValue) => set((state) => ({
                [listName]: (state[listName] || []).map((item, i) => i === index ? newValue : item)
            })),
            setConfigList: (listName, list) => set({ [listName]: list }),
            resetConfigList: (listName) => {
                const defaults = {
                    configSumberDana: DEFAULT_SUMBER_DANA,
                    configJenisPengadaan: DEFAULT_JENIS_PENGADAAN,
                    configMetodePemilihan: DEFAULT_METODE_PEMILIHAN,
                    configSubKegiatan: DEFAULT_SUB_KEGIATAN,
                };
                const defaultKodes = {
                    'APBD': 'A', 'DAK': 'D', 'BANKEU': 'B', 'APBD Perubahan': 'AP', 'SG': 'S', 'Bantuan Pemerintah': 'BP',
                    'Jasa Konsultansi Perencanaan': '1', 'Jasa Konsultansi Pengawasan': '2', 'Pekerjaan Konstruksi': '3', 'Pengadaan Barang': '4',
                    'E-Purchasing': 'E', 'Pengadaan Langsung': 'PL', 'Swakelola': 'SW', 'Tender': 'T',
                };
                set((state) => ({
                    [listName]: defaults[listName] || [],
                    configKodeMap: { ...state.configKodeMap, ...defaultKodes }
                }));
            },

            // ===== PENCAIRAN =====
            getPencairan: (matrikId) => {
                const map = get().pencairanMap;
                return map[matrikId] || { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', tanggalSp2d: '' };
            },

            updatePencairan: (matrikId, updates) => set((state) => ({
                pencairanMap: {
                    ...state.pencairanMap,
                    [matrikId]: { ...(state.pencairanMap[matrikId] || {}), ...updates }
                }
            })),

            // ===== BAST CRUD =====
            addBAST: (item) => set((state) => ({
                bastData: [{ ...item, id: Date.now() }, ...state.bastData]
            })),

            updateBAST: (id, updates) => set((state) => ({
                bastData: state.bastData.map(b => b.id === id ? { ...b, ...updates } : b)
            })),

            deleteBAST: (id) => set((state) => ({
                bastData: state.bastData.filter(b => b.id !== id)
            })),

            revertBAST: (matrikId) => set((state) => ({
                bastData: state.bastData.filter(b => b.matrikId !== matrikId)
            })),

            getBastByNpsn: (npsn) => {
                return get().bastData.filter(b => b.npsn === npsn);
            },

            // ===== TEMPLATE CRUD =====
            addTemplate: (t) => set((state) => ({
                bastTemplates: [...state.bastTemplates, { ...t, id: Date.now() }]
            })),

            updateTemplate: (id, updates) => set((state) => ({
                bastTemplates: state.bastTemplates.map(t => t.id === id ? { ...t, ...updates } : t)
            })),

            deleteTemplate: (id) => set((state) => ({
                bastTemplates: state.bastTemplates.filter(t => t.id !== id)
            })),
        }),
        {
            name: 'SARDIKA-matrik',
            version: 2,
        }
    )
);

export default useMatrikStore;
