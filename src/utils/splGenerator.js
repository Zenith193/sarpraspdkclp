/**
 * SPL Template Variable Replacer
 * Takes template HTML content from Manajemen Template and replaces
 * variables with actual matrik data.
 * 
 * Available variables (use {{variableName}} in template):
 * 
 * === Matrik Data ===
 * {{noMatrik}}              - No Matrik
 * {{namaPaket}}             - Nama Paket Pekerjaan
 * {{namaSekolah}}           - Nama Sekolah
 * {{namaSekolahUpper}}      - Nama Sekolah (UPPERCASE)
 * {{npsn}}                  - NPSN
 * {{nilaiKontrak}}          - Nilai Kontrak (formatted: 94.066.000)
 * {{nilaiKontrakRaw}}       - Nilai Kontrak (raw number)
 * {{terbilangKontrak}}      - Terbilang Kontrak
 * {{jangkaWaktu}}           - Jangka Waktu (angka)
 * {{jangkaWaktuText}}       - Jangka Waktu + " Hari Kalender"
 * {{sumberDana}}            - Sumber Dana (APBD, DAK, dll)
 * {{tahunAnggaran}}         - Tahun Anggaran
 * {{noSpk}}                 - Nomor SPK / Nomor Kontrak
 * {{penyedia}}              - Nama Penyedia (CV)
 * {{namaPemilik}}           - Nama Direktur
 * {{statusPemilik}}         - Status Pemilik
 * {{alamatKantor}}          - Alamat Kantor Penyedia
 * {{noHp}}                  - No HP
 * {{metode}}                - Metode Pemilihan
 * {{tanggalMulai}}          - Tanggal Mulai (formatted)
 * {{tanggalSelesai}}        - Tanggal Selesai (formatted)
 * 
 * === SPL/PCM/MC Fields ===
 * {{noPcm}}                 - Nomor PCM
 * {{tglPcm}}                - Tanggal PCM (formatted)
 * {{noMc0}}                 - Nomor MC-0
 * {{tglMc0}}                - Tanggal MC-0 (formatted)
 * {{noMc100}}               - Nomor MC-100
 * {{tglMc100}}              - Tanggal MC-100 (formatted)
 * {{konsultanPengawas}}     - Konsultan Pengawas
 * {{dirKonsultanPengawas}}  - Direktur Konsultan Pengawas
 * 
 * === Sekolah Data (from join) ===
 * {{kepsek}}                - Nama Kepala Sekolah
 * {{nipKs}}                 - NIP Kepala Sekolah
 * 
 * === Sekretaris (selected verifikator) ===
 * {{sekretaris}}            - Nama Sekretaris
 * {{nipSekretaris}}         - NIP Sekretaris
 * 
 * === Fixed Officials ===
 * {{ppkom}}                 - Nama PPKom
 * {{nipPpkom}}              - NIP PPKom
 * {{jabatanPpkom}}          - Jabatan PPKom
 * {{alamatPpkom}}           - Alamat PPKom
 * {{ketuaTimTeknis}}        - Nama Ketua Tim Teknis
 * {{nipKetuaTimTeknis}}     - NIP Ketua Tim Teknis
 * 
 * === Utility ===
 * {{tahunTerbilang}}        - Tahun dalam huruf
 * {{dot}}                   - Placeholder dots (…………………)
 * {{dotPanjang}}            - Longer dots
 */

// Fixed PPKom and Tim Teknis
const PPKOM = {
    nama: 'SUNGEB, S.Sos,. M.M.',
    nip: '19780908 199703 1 001',
    jabatan: 'Pejabat Pembuat Komitmen pada Bidang Sarpras Dinas P dan K Kab. Cilacap',
    alamat: 'Jl. Kalimantan No.51 Cilacap',
};
const TIM_TEKNIS_KETUA = {
    nama: 'M. TAKHMILUDDIN, ST.MT',
    nip: '19840525 200903 1 005',
};
const TAHUN_TERBILANG = 'Dua Ribu Dua Puluh Lima';

function fmtRp(v) {
    return v ? Number(v).toLocaleString('id-ID') : '0';
}

function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
}

function dot(v) { return v || '…………………………'; }

/**
 * Build the variable map from matrik data + sekretaris
 */
function buildVariableMap(item, sekretaris = {}) {
    const d = item;
    const sek = {
        nama: sekretaris.name || sekretaris.nama || '',
        nip: sekretaris.nip || '',
    };
    const tahun = d.tahunAnggaran || new Date().getFullYear();

    return {
        // Matrik
        noMatrik: d.noMatrik || '',
        namaPaket: d.namaPaket || '',
        namaSekolah: d.namaSekolah || '',
        namaSekolahUpper: (d.namaSekolah || '').toUpperCase(),
        npsn: d.npsn || '',
        nilaiKontrak: fmtRp(d.nilaiKontrak),
        nilaiKontrakRaw: String(d.nilaiKontrak || 0),
        terbilangKontrak: d.terbilangKontrak || '',
        jangkaWaktu: String(d.jangkaWaktu || ''),
        jangkaWaktuText: d.jangkaWaktu ? `${d.jangkaWaktu} Hari Kalender` : '',
        sumberDana: d.sumberDana || 'APBD',
        tahunAnggaran: String(tahun),
        noSpk: d.noSpk || '',
        penyedia: d.penyedia || '',
        namaPemilik: d.namaPemilik || '',
        statusPemilik: d.statusPemilik || '',
        alamatKantor: d.alamatKantor || '',
        noHp: d.noHp || '',
        metode: d.metode || '',
        tanggalMulai: fmtDate(d.tanggalMulai),
        tanggalSelesai: fmtDate(d.tanggalSelesai),

        // SPL/PCM/MC
        noPcm: d.noPcm || '',
        tglPcm: fmtDate(d.tglPcm),
        noMc0: d.noMc0 || '',
        tglMc0: fmtDate(d.tglMc0),
        noMc100: d.noMc100 || '',
        tglMc100: fmtDate(d.tglMc100),
        konsultanPengawas: d.konsultanPengawas || '',
        dirKonsultanPengawas: d.dirKonsultanPengawas || '',

        // Sekolah
        kepsek: d.kepsek || '',
        nipKs: d.nipKs || '',

        // Sekretaris
        sekretaris: sek.nama,
        nipSekretaris: sek.nip,

        // Fixed officials
        ppkom: PPKOM.nama,
        nipPpkom: PPKOM.nip,
        jabatanPpkom: PPKOM.jabatan,
        alamatPpkom: PPKOM.alamat,
        ketuaTimTeknis: TIM_TEKNIS_KETUA.nama,
        nipKetuaTimTeknis: TIM_TEKNIS_KETUA.nip,

        // Utility
        tahunTerbilang: TAHUN_TERBILANG,
        dot: '…………………………',
        dotPanjang: '………………………………………………………',
    };
}

/**
 * Replace all {{variable}} placeholders in template content with actual data
 * @param {string} templateContent - HTML content from the template
 * @param {Object} item - matrik record with sekolah data
 * @param {Object} sekretaris - { name/nama, nip }
 * @returns {string} - HTML with variables replaced
 */
export function replaceTemplateVariables(templateContent, item, sekretaris = {}) {
    const vars = buildVariableMap(item, sekretaris);
    
    // Replace {{variableName}} patterns
    return templateContent.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (vars.hasOwnProperty(varName)) {
            return vars[varName];
        }
        // Leave unknown variables as-is (or return empty)
        return match;
    });
}

/**
 * Generate printable HTML from template + data
 * @param {string} templateContent - HTML content from template
 * @param {Object} item - matrik data
 * @param {Object} sekretaris - verifikator data
 * @returns {string} - Complete HTML document for print
 */
export function generateFromTemplate(templateContent, item, sekretaris = {}) {
    const replaced = replaceTemplateVariables(templateContent, item, sekretaris);
    
    // Wrap in print-ready HTML if not already a full document
    if (replaced.trim().startsWith('<!DOCTYPE') || replaced.trim().startsWith('<html')) {
        return replaced;
    }
    
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SPL - ${item.namaPaket || 'Dokumen'}</title>
<style>
@page { size: A4; margin: 1.5cm 2cm; }
@media print {
    .page-break { page-break-after: always; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 0; }
table { border-collapse: collapse; width: 100%; }
td, th { vertical-align: top; }
</style>
</head>
<body>
${replaced}
</body>
</html>`;
}

/**
 * Get list of all available template variables
 * (for display in template editor help)
 */
export function getAvailableVariables() {
    return [
        { group: 'Data Matrik', vars: [
            { name: 'noMatrik', desc: 'No Matrik' },
            { name: 'namaPaket', desc: 'Nama Paket Pekerjaan' },
            { name: 'namaSekolah', desc: 'Nama Sekolah' },
            { name: 'namaSekolahUpper', desc: 'Nama Sekolah (HURUF BESAR)' },
            { name: 'npsn', desc: 'NPSN' },
            { name: 'nilaiKontrak', desc: 'Nilai Kontrak (format: 94.066.000)' },
            { name: 'nilaiKontrakRaw', desc: 'Nilai Kontrak (angka mentah)' },
            { name: 'terbilangKontrak', desc: 'Nilai Kontrak Terbilang' },
            { name: 'jangkaWaktu', desc: 'Jangka Waktu (angka)' },
            { name: 'jangkaWaktuText', desc: 'Jangka Waktu + Hari Kalender' },
            { name: 'sumberDana', desc: 'Sumber Dana' },
            { name: 'tahunAnggaran', desc: 'Tahun Anggaran' },
            { name: 'noSpk', desc: 'Nomor Kontrak / SPK' },
            { name: 'penyedia', desc: 'Nama Penyedia (CV)' },
            { name: 'namaPemilik', desc: 'Nama Direktur' },
            { name: 'statusPemilik', desc: 'Status Pemilik' },
            { name: 'alamatKantor', desc: 'Alamat Penyedia' },
            { name: 'noHp', desc: 'No HP Penyedia' },
            { name: 'metode', desc: 'Metode Pemilihan' },
        ]},
        { group: 'Tanggal Mulai Kontrak', vars: [
            { name: 'tanggalMulai', desc: '06 April 2026' },
            { name: 'hariTanggalMulai', desc: 'Senin, 06 April 2026' },
            { name: 'terbilangTanggalMulai', desc: 'senin tanggal enam bulan April tahun ... (06-04-2026)' },
            { name: 'hariMulai', desc: 'Senin' },
            { name: 'hariMulaiLower', desc: 'senin' },
            { name: 'tglMulaiTerbilang', desc: 'enam (tanggal dalam huruf)' },
            { name: 'bulanMulai', desc: 'April' },
            { name: 'tahunMulaiTerbilang', desc: 'Dua Ribu Dua Puluh Enam' },
            { name: 'tanggalMulaiDash', desc: '06-04-2026' },
        ]},
        { group: 'Tanggal Selesai Kontrak', vars: [
            { name: 'tanggalSelesai', desc: '06 April 2026' },
            { name: 'hariTanggalSelesai', desc: 'Senin, 06 April 2026' },
            { name: 'terbilangTanggalSelesai', desc: 'senin tanggal enam bulan April tahun ... (06-04-2026)' },
            { name: 'hariSelesai', desc: 'Senin' },
            { name: 'hariSelesaiLower', desc: 'senin' },
            { name: 'tglSelesaiTerbilang', desc: 'enam (tanggal dalam huruf)' },
            { name: 'bulanSelesai', desc: 'April' },
            { name: 'tahunSelesaiTerbilang', desc: 'Dua Ribu Dua Puluh Enam' },
            { name: 'tanggalSelesaiDash', desc: '06-04-2026' },
        ]},
        { group: 'Data PCM', vars: [
            { name: 'noPcm', desc: 'Nomor PCM' },
            { name: 'tglPcm', desc: '06 April 2026' },
            { name: 'hariTanggalPcm', desc: 'Senin, 06 April 2026' },
            { name: 'terbilangTanggalPcm', desc: 'senin tanggal enam bulan April tahun ... (06-04-2026)' },
            { name: 'hariPcm', desc: 'Senin' },
            { name: 'hariPcmLower', desc: 'senin' },
            { name: 'tglPcmTerbilang', desc: 'enam (tanggal dalam huruf)' },
            { name: 'bulanPcm', desc: 'April' },
            { name: 'tahunPcmTerbilang', desc: 'Dua Ribu Dua Puluh Enam' },
            { name: 'tglPcmDash', desc: '06-04-2026' },
        ]},
        { group: 'Data MC-0%', vars: [
            { name: 'noMc0', desc: 'Nomor MC-0' },
            { name: 'tglMc0', desc: '06 April 2026' },
            { name: 'hariTanggalMc0', desc: 'Senin, 06 April 2026' },
            { name: 'terbilangTanggalMc0', desc: 'senin tanggal enam bulan April tahun ... (06-04-2026)' },
            { name: 'hariMc0', desc: 'Senin' },
            { name: 'hariMc0Lower', desc: 'senin' },
            { name: 'tglMc0Terbilang', desc: 'enam (tanggal dalam huruf)' },
            { name: 'bulanMc0', desc: 'April' },
            { name: 'tahunMc0Terbilang', desc: 'Dua Ribu Dua Puluh Enam' },
            { name: 'tglMc0Dash', desc: '06-04-2026' },
        ]},
        { group: 'Data MC-100%', vars: [
            { name: 'noMc100', desc: 'Nomor MC-100' },
            { name: 'tglMc100', desc: '06 April 2026' },
            { name: 'hariTanggalMc100', desc: 'Senin, 06 April 2026' },
            { name: 'terbilangTanggalMc100', desc: 'senin tanggal enam bulan April tahun ... (06-04-2026)' },
            { name: 'hariMc100', desc: 'Senin' },
            { name: 'hariMc100Lower', desc: 'senin' },
            { name: 'tglMc100Terbilang', desc: 'enam (tanggal dalam huruf)' },
            { name: 'bulanMc100', desc: 'April' },
            { name: 'tahunMc100Terbilang', desc: 'Dua Ribu Dua Puluh Enam' },
            { name: 'tglMc100Dash', desc: '06-04-2026' },
        ]},
        { group: 'Lainnya', vars: [
            { name: 'konsultanPengawas', desc: 'Konsultan Pengawas' },
            { name: 'dirKonsultanPengawas', desc: 'Direktur Konsultan' },
        ]},
        { group: 'Data Sekolah', vars: [
            { name: 'kepsek', desc: 'Nama Kepala Sekolah' },
            { name: 'nipKs', desc: 'NIP Kepala Sekolah' },
        ]},
        { group: 'Kop Sekolah', vars: [
            { name: 'kopSekolah', desc: 'Path file kop sekolah' },
            { name: 'kopSekolahAda', desc: 'Status kop: "Ada" atau "Belum"' },
        ]},
        { group: 'Sekretaris', vars: [
            { name: 'sekretaris', desc: 'Nama Sekretaris (Verifikator)' },
            { name: 'nipSekretaris', desc: 'NIP Sekretaris' },
        ]},
        { group: 'Pejabat Tetap', vars: [
            { name: 'ppkom', desc: 'Nama PPKom' },
            { name: 'nipPpkom', desc: 'NIP PPKom' },
            { name: 'jabatanPpkom', desc: 'Jabatan PPKom' },
            { name: 'alamatPpkom', desc: 'Alamat PPKom' },
            { name: 'ketuaTimTeknis', desc: 'Nama Ketua Tim Teknis' },
            { name: 'nipKetuaTimTeknis', desc: 'NIP Ketua Tim Teknis' },
        ]},
        { group: 'Anakan (Sub Paket)', vars: [
            { name: 'jumlahAnakan', desc: 'Jumlah anakan (angka)' },
            { name: 'anakan1NamaPaket', desc: 'Nama Paket anakan ke-1' },
            { name: 'anakan1NamaSekolah', desc: 'Nama Sekolah anakan ke-1' },
            { name: 'anakan1Npsn', desc: 'NPSN anakan ke-1' },
            { name: 'anakan1NoMatrik', desc: 'No Matrik anakan ke-1' },
            { name: 'anakan1NilaiKontrak', desc: 'Nilai Kontrak anakan ke-1 (format Rp)' },
            { name: 'anakan1TerbilangKontrak', desc: 'Terbilang Kontrak anakan ke-1' },
            { name: 'anakan1PaguAnggaran', desc: 'Pagu Anggaran anakan ke-1' },
            { name: 'anakan1Hps', desc: 'HPS anakan ke-1' },
            { name: 'anakan1NoSpk', desc: 'No SPK anakan ke-1' },
            { name: 'anakan1Penyedia', desc: 'Penyedia anakan ke-1' },
            { name: 'anakan1NamaPemilik', desc: 'Direktur anakan ke-1' },
            { name: 'anakan1JangkaWaktu', desc: 'Jangka Waktu anakan ke-1' },
            { name: 'anakan1TanggalMulai', desc: 'Tgl Mulai anakan ke-1' },
            { name: 'anakan1TanggalSelesai', desc: 'Tgl Selesai anakan ke-1' },
            { name: 'anakan1Kepsek', desc: 'Kepala Sekolah anakan ke-1' },
            { name: 'anakan1NipKs', desc: 'NIP KS anakan ke-1' },
            { name: 'anakan1KopSekolah', desc: 'Kop Sekolah anakan ke-1' },
        ]},
        { group: 'Anakan 2-15 (pola sama)', vars: [
            { name: 'anakan2NamaPaket', desc: 'Nama Paket anakan ke-2 (dst sampai 15)' },
            { name: 'anakan2NilaiKontrak', desc: 'Nilai Kontrak anakan ke-2' },
            { name: 'anakan3NamaPaket', desc: '...dst: anakan3, anakan4, ... anakan15' },
        ]},
        { group: 'Total Anakan', vars: [
            { name: 'totalNilaiKontrakAnakan', desc: 'Total Nilai Kontrak semua anakan' },
            { name: 'totalPaguAnggaranAnakan', desc: 'Total Pagu Anggaran semua anakan' },
            { name: 'totalHpsAnakan', desc: 'Total HPS semua anakan' },
        ]},
        { group: 'Utilitas', vars: [
            { name: 'tahunTerbilang', desc: 'Tahun dalam huruf (Dua Ribu ...)' },
            { name: 'dot', desc: 'Placeholder titik-titik' },
            { name: 'dotPanjang', desc: 'Placeholder titik-titik panjang' },
        ]},
    ];
}

