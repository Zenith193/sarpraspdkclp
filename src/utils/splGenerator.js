/**
 * SPL Document Generator
 * Generates full HTML document for printing - 9 sections:
 * 1. Cover Sheet
 * 2. Surat Penyerahan Lapangan (SPL)
 * 3. Struktur Organisasi Pekerjaan
 * 4. Daftar Hadir PCM
 * 5. Berita Acara PCM
 * 6. Daftar Hadir MC-0%
 * 7. Berita Acara MC-0
 * 8. Daftar Hadir MC-100%
 * 9. Berita Acara MC-100
 */

// Fixed PPKom and Tim Teknis data
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

const TAHUN = new Date().getFullYear();
const TAHUN_TERBILANG = 'Dua Ribu Dua Puluh Lima'; // TODO: dynamic

function dot(val) { return val || '…………………………'; }
function fmtRp(val) {
    if (!val) return 'Rp. 0';
    return 'Rp. ' + Number(val).toLocaleString('id-ID');
}
function fmtDate(d) {
    if (!d) return '………………………';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
}

const CSS = `
@page { size: A4; margin: 2cm 2.5cm; }
@media print { .page-break { page-break-after: always; } }
body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; line-height: 1.6; margin: 0; }
table { border-collapse: collapse; width: 100%; }
.info-table td { border: none; padding: 3px 0; vertical-align: top; }
.info-table td:first-child { width: 220px; }
.bordered td, .bordered th { border: 1px solid #000; padding: 6px 10px; }
.bordered th { background: #f5f5f5; font-weight: bold; text-align: center; }
h2, h3 { text-align: center; margin: 0; }
.sign-block { margin-top: 40px; }
.sign-name { text-decoration: underline; font-weight: bold; font-size: 12pt; }
.sign-nip { font-size: 11pt; }
.ttd-space { height: 80px; }
.center { text-align: center; }
.right { text-align: right; }
ol, ul { margin: 4px 0; }
ol li, ul li { margin-bottom: 4px; }
`;

/**
 * Generate full SPL HTML document
 * @param {Object} item - matrik record with sekolah data (kepsek, nipKs)
 * @param {Object} sekretaris - { nama, nip } selected verifikator
 */
export function generateSplHtml(item, sekretaris = {}) {
    const d = item;
    const tahun = d.tahunAnggaran || TAHUN;
    const sek = { nama: sekretaris.name || sekretaris.nama || '…………………', nip: sekretaris.nip || '…………………' };
    const namaSekolahUpper = (d.namaSekolah || '').toUpperCase();

    const sections = [
        coverPage(d, tahun),
        splPage(d, tahun),
        strukturPage(d),
        daftarHadirPcm(d, tahun, sek),
        beritaAcaraPcm(d, tahun, sek),
        daftarHadirMc0(d, tahun),
        beritaAcaraMc0(d, tahun, sek),
        daftarHadirMc100(d, tahun),
        beritaAcaraMc100(d, tahun, sek),
    ];

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SPL - ${d.namaPaket || 'Dokumen'}</title><style>${CSS}</style></head><body>${sections.join('')}</body></html>`;
}

// ==================== SECTION 1: COVER ====================
function coverPage(d, tahun) {
    return `
<div class="page-break">
    <div style="text-align:center;margin-top:60px">
        <h2 style="font-size:16pt">${dot(d.noMatrik)}</h2>
        <h3 style="font-size:14pt;margin-top:8px">${(d.namaSekolah || '').toUpperCase()}</h3>
    </div>
    <div style="text-align:center;margin:40px 0 30px">
        <h3>KEGIATAN ${(d.sumberDana || 'APBD').toUpperCase()} TAHUN ANGGARAN ${tahun}</h3>
    </div>
    <table class="bordered" style="margin-bottom:30px">
        <thead><tr><th>NAMA PEKERJAAN</th><th>NILAI KONTRAK</th><th>JANGKA WAKTU</th></tr></thead>
        <tbody><tr>
            <td>${dot(d.namaPaket)}</td>
            <td class="right">${fmtRp(d.nilaiKontrak)}</td>
            <td class="center">${d.jangkaWaktu ? d.jangkaWaktu + ' Hari Kalender' : '-'}</td>
        </tr></tbody>
    </table>
    <table class="info-table" style="margin-top:30px">
        <tr><td>PENYEDIA</td><td>: ${dot(d.penyedia)}</td></tr>
        <tr><td>NAMA DIREKTUR</td><td>: ${dot(d.namaPemilik)}</td></tr>
        <tr><td>NO HP</td><td>: ${dot(d.noHp)}</td></tr>
        <tr><td>TANGGAL PCM</td><td>: ${d.tglPcm ? fmtDate(d.tglPcm) : '…………………………………………………..'}</td></tr>
        <tr><td>TANGGAL MC-0</td><td>: ${d.tglMc0 ? fmtDate(d.tglMc0) : '…………………………………………………..'}</td></tr>
        <tr><td>TANGGAL MC-100</td><td>: ${d.tglMc100 ? fmtDate(d.tglMc100) : '…………………………………………………..'}</td></tr>
    </table>
</div>`;
}

// ==================== SECTION 2: SPL ====================
function splPage(d, tahun) {
    const namaSekolahUpper = (d.namaSekolah || '').toUpperCase();
    return `
<div class="page-break">
    <h2 style="font-size:14pt;margin-bottom:4px">SURAT PENYERAHAN LAPANGAN (SPL)</h2>
    <p class="center">Nomor: ${dot(d.noSpk)}</p>
    <p class="center" style="margin:16px 0">Kegiatan ${dot(d.namaPaket)}</p>
    <p style="text-indent:40px;text-align:justify">
        Pada hari ini ........................... tanggal ........................... bulan ........................... tahun ${TAHUN_TERBILANG} (........- .......- ${tahun}) kami yang bertanda tangan dibawah ini Kepala ${d.namaSekolah || '...'} Kab. Cilacap menyerahkan Lapangan kepada :
    </p>
    <table class="info-table" style="margin:16px 0 16px 30px">
        <tr><td>Nama</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr>
        <tr><td>Jabatan</td><td>:</td><td>Direktur ${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
    </table>
    <p style="text-indent:40px;text-align:justify">
        Surat Penyerahan Lapangan (SPL) ini kami berikan untuk melaksanakan Kegiatan ${dot(d.namaPaket)} Kab. Cilacap Tahun Anggaran ${tahun}, dengan ketentuan sebagai berikut :
    </p>
    <ol style="margin-left:20px">
        <li>Untuk melaksanakan Pekerjaan Konstruksi ${dot(d.namaPaket)} sesuai kontrak dan segera melakukan koordinasi dengan pihak - pihak terkait yang ada hubungannya dengan pekerjaan ini;</li>
        <li>Melaksanakan pengamanan areal yang akan dilaksanakan;</li>
        <li>Memasang Papan nama Pekerjaan di lokasi;</li>
        <li>Membuat papan untuk menempelkan Gambar Kerja, Time schedule;</li>
        <li>Surat Penyerahan Lapangan ini berlaku mulai tanggal ........- ........- ${tahun} dan berakhir sampai dengan selesainya pekerjaan atau selambat-lambatnya tanggal ........- ........- ${tahun}.</li>
    </ol>
    <p>Demikian Surat Penyerahan Lapangan ini kami berikan untuk dilaksanakan sebagaimana mestinya.</p>
    <div style="display:flex;justify-content:flex-end;margin-top:30px">
        <div style="text-align:center">
            <div>KEPALA ${namaSekolahUpper}</div>
            <div>KAB. CILACAP</div>
            <div class="ttd-space"></div>
            <div class="sign-name">${dot(d.kepsek)}</div>
            <div class="sign-nip">NIP. ${dot(d.nipKs)}</div>
        </div>
    </div>
</div>`;
}

// ==================== SECTION 3: STRUKTUR ORGANISASI ====================
function strukturPage(d) {
    return `
<div class="page-break">
    <h2 style="font-size:14pt;margin-bottom:24px">STRUKTUR ORGANISASI PEKERJAAN</h2>
    <h3 style="text-align:left;font-size:12pt;margin:20px 0 10px">* PELAKSANA PEKERJAAN</h3>
    <table class="info-table" style="margin-left:20px">
        <tr><td>1. Nama Perusahaan</td><td>: ${dot(d.penyedia)}</td></tr>
        <tr><td>2. Nama Direktur</td><td>: ${dot(d.namaPemilik)}</td></tr>
        <tr><td>3. Nama Pelaksana</td><td>: …………………..</td></tr>
        <tr><td>4. Nama Mandor / Kepala Tukang</td><td>: …………………..</td></tr>
        <tr><td>5. Lokasi Pekerjaan</td><td>: ${(d.namaSekolah || '').toUpperCase()}</td></tr>
        <tr><td>6. Schedule Pekerjaan</td><td>: Ada/Tidak (*Coret salah satu)</td></tr>
    </table>
    <h3 style="text-align:left;font-size:12pt;margin:30px 0 10px">* PENGAWAS PEKERJAAN</h3>
    <table class="info-table" style="margin-left:20px">
        <tr><td>1. Nama Perusahaan</td><td>: ${dot(d.konsultanPengawas)}</td></tr>
        <tr><td>2. Nama Direktur</td><td>: ${dot(d.dirKonsultanPengawas)}</td></tr>
        <tr><td>3. Nama Pengawas Lapangan</td><td>: ……………………</td></tr>
        <tr><td>4. Lokasi Pekerjaan</td><td>: ${(d.namaSekolah || '').toUpperCase()}</td></tr>
    </table>
</div>`;
}

// ==================== DAFTAR HADIR TEMPLATE ====================
function daftarHadirTemplate(title, d, tahun, sek, showSekretaris = true) {
    const rows = [
        { nama: PPKOM.nama, instansi: 'Pejabat Pembuat Komitmen (PPKom)' },
        { nama: TIM_TEKNIS_KETUA.nama, instansi: 'Tim Teknis Pendukung PPK (Ketua)' },
    ];
    if (showSekretaris) {
        rows.push({ nama: dot(sek?.nama), instansi: 'Tim Teknis Pendukung PPK (Sekretaris)' });
    }
    rows.push(
        { nama: '', instansi: `Konsultan Perencana\n${dot(d.konsultanPengawas)}` },
        { nama: '', instansi: `Kontraktor Pelaksana\n${dot(d.penyedia)}` },
        { nama: dot(d.kepsek), instansi: d.namaSekolah || '' },
        { nama: '', instansi: '' },
    );

    const rowsHtml = rows.map((r, i) => `
        <tr>
            <td class="center" style="border:1px solid #000;padding:6px">${i + 1}.</td>
            <td style="border:1px solid #000;padding:6px">${r.nama}</td>
            <td style="border:1px solid #000;padding:6px;white-space:pre-line">${r.instansi}</td>
            <td style="border:1px solid #000;padding:6px"></td>
            <td class="center" style="border:1px solid #000;padding:6px">${i + 1}.</td>
        </tr>`).join('');

    return `
<div class="page-break">
    <h2 style="font-size:14pt;margin-bottom:20px">DAFTAR HADIR</h2>
    <h3 style="font-size:13pt;margin-bottom:24px">${title}</h3>
    <table class="info-table" style="margin-bottom:20px">
        <tr><td>Hari / Tanggal</td><td>:</td><td>…………………………………………..</td></tr>
        <tr><td>Paket/ Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Nomor Kontrak</td><td>:</td><td>${dot(d.noSpk)}</td></tr>
        <tr><td>Tempat</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr>
    </table>
    <table style="width:100%">
        <thead><tr>
            <th style="border:1px solid #000;padding:6px;width:40px">No.</th>
            <th style="border:1px solid #000;padding:6px">Nama</th>
            <th style="border:1px solid #000;padding:6px">Instansi/ Jabatan</th>
            <th style="border:1px solid #000;padding:6px;width:80px">No. Hp</th>
            <th style="border:1px solid #000;padding:6px;width:100px">Tanda Tangan</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:40px">
        <div style="text-align:center">
            <div>Cilacap, …………………..</div>
            <div>Kepala Bidang Sarana dan Prasarana</div>
            <div>Selaku Pejabat Pembuat Komitmen</div>
            <div class="ttd-space"></div>
            <div class="sign-name">${PPKOM.nama}</div>
            <div class="sign-nip">NIP. ${PPKOM.nip}</div>
        </div>
    </div>
</div>`;
}

// ==================== SECTION 4: DAFTAR HADIR PCM ====================
function daftarHadirPcm(d, tahun, sek) {
    return daftarHadirTemplate('Berita Acara Rapat Persiapan Pelaksanaan Kontrak\n(Pre Construction Meeting / PCM )', d, tahun, sek);
}

// ==================== SECTION 5: BERITA ACARA PCM ====================
function beritaAcaraPcm(d, tahun, sek) {
    return `
<div class="page-break">
    <h2 style="font-size:14pt;margin-bottom:4px">Berita Acara Rapat Persiapan Pelaksanaan Kontrak</h2>
    <h3 style="font-size:13pt">(Pre Construction Meeting / PCM )</h3>
    <p class="center" style="margin:8px 0 20px">Nomor  : ${dot(d.noPcm)}</p>
    <p style="text-indent:40px;text-align:justify">
        Pada hari ini ………… tanggal ………… bulan ………… tahun ${TAHUN_TERBILANG} (…- …- ${tahun}) telah dilaksanakan Rapat Persiapan Pelaksanaan Kontrak (Pre Construction Meeting) untuk paket pekerjaan :
    </p>
    <table class="info-table" style="margin:16px 0 16px 30px">
        <tr><td>Nama Paket</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Sumber Dana</td><td>:</td><td>${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun}</td></tr>
        <tr><td>Kontraktor Pelaksana</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat Kontraktor Pelaksana</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
        <tr><td>Nilai Kontrak</td><td>:</td><td>${fmtRp(d.nilaiKontrak)}</td></tr>
        <tr><td>Konsultan Pengawas</td><td>:</td><td>${dot(d.konsultanPengawas)}</td></tr>
    </table>
    <ol style="margin:16px 0">
        <li><strong>Pelaksanaan Rapat :</strong>
            <ol type="1" style="margin-top:4px">
                <li>Rapat dipimpin oleh Pejabat Pembuat Komitmen;</li>
                <li>Rapat dihadiri oleh Pejabat Pembuat Komitmen, Tim Teknis Pendukung PPK, Konsultan Pengawas, Kontraktor Pelaksana, Pihak sekolah penerima manfaat bantuan Dana ${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun};</li>
                <li>Beberapa materi yang dibahas dalam rapat Pre Construction Meeting (PCM) antara lain adalah :
                    <ol type="1" style="margin-top:4px">
                        <li>Kesamaan interpretasi atas semua hal-hal di dalam dokumen kontrak;</li>
                        <li>Koreksi dan persetujuan gambar rencana dan gambar kerja;</li>
                        <li>Prosedur permohonan (request) dan persetujuan gambar (approval);</li>
                        <li>Prosedur dan metode pelaksanaan;</li>
                        <li>Jadwal mobilisasi dan pelaksanaan fisik secara detail;</li>
                        <li>Prosedur administrasi, keuangan, pelaporan dan lain-lain.</li>
                    </ol>
                </li>
            </ol>
        </li>
        <li style="margin-top:16px"><strong>Kesimpulan :</strong><br>Hasil kesepakatan rapat yang disetujui bersama adalah sebagai berikut :
            <ol type="1" style="margin-top:4px">
                <li>Pihak Kontraktor segera membuat surat pemberitahuan pelaksanaan pekerjaan kepada sekolah.</li>
                <li>Pihak kontraktor siap melaksanakan pekerjaan dan hal – hal yang tercantum dalam Kontrak dengan rasa tanggung jawab.</li>
                <li>Secepatnya akan dijadwalkan kegiatan MC 0.</li>
            </ol>
        </li>
    </ol>
    <p>Demikian berita acara ini dibuat dan merupakan suatu kesatuan dengan Dokumen Kontrak.</p>
    ${multiSignBlock(d, sek, tahun)}
</div>`;
}

// ==================== SECTION 6: DAFTAR HADIR MC-0 ====================
function daftarHadirMc0(d, tahun) {
    return daftarHadirTemplate('MC- 0%', d, tahun, null, false);
}

// ==================== SECTION 7: BERITA ACARA MC-0 ====================
function beritaAcaraMc0(d, tahun, sek) {
    return `
<div class="page-break">
    <table style="width:100%;border:none;margin-bottom:20px">
        <tr>
            <td style="border:none;width:50%">
                <table class="info-table">
                    <tr><td>Kegiatan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
                </table>
            </td>
            <td style="border:none;width:50%">
                <div style="text-align:center;font-weight:bold;font-size:14pt">BERITA ACARA</div>
                <div style="text-align:center;font-weight:bold;font-size:13pt">MUTUAL CHECK (MC-0)</div>
            </td>
        </tr>
        <tr>
            <td style="border:none">
                <table class="info-table">
                    <tr><td>Lokasi</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr>
                </table>
            </td>
            <td style="border:none">
                <table class="info-table">
                    <tr><td>Nomor</td><td>: ${dot(d.noMc0)}</td></tr>
                    <tr><td>Tanggal</td><td>: ${d.tglMc0 ? fmtDate(d.tglMc0) : ''}</td></tr>
                </table>
            </td>
        </tr>
    </table>
    <p style="text-indent:40px;text-align:justify">
        Pada hari ini ........................ tanggal ........................ bulan ........................ tahun ${TAHUN_TERBILANG} (.........- ........- ${tahun}), kami yang bertandatangan di bawah ini :
    </p>
    ${ppkomAndKontraktorBlock(d)}
    <p style="text-indent:40px;text-align:justify">
        Dengan ini telah sepakat mengadakan penelitian dan perhitungan pekerjaan bersama di lapangan antara tim Teknis Pendukung Pejabat Pembuat Komitmen dan Konsultan Pengawas dengan Kontraktor Pelaksana Atas :
    </p>
    <table class="info-table" style="margin:16px 0 16px 30px">
        <tr><td>Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Lokasi</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr>
        <tr><td>Nomor Kontrak</td><td>:</td><td>${dot(d.noSpk)}</td></tr>
        <tr><td>Jangka Waktu Pelaksanaan</td><td>:</td><td>${d.jangkaWaktu ? d.jangkaWaktu + ' Hari Kalender' : '-'}</td></tr>
    </table>
    <p>Dengan hasil sebagai berikut</p>
    <ol>
        <li>Penelitian dan perhitungan sebagaimana kuantitas pekerjaan terlampir</li>
        <li>........................................................................................................................................</li>
        <li>........................................................................................................................................</li>
        <li>........................................................................................................................................</li>
    </ol>
    <p>Demikian Berita Acara ini dibuat dengan penuh rasa tanggungjawab untuk selanjutnya akan digunakan sebagai dasar bagi penyiapan MC- 0 untuk dipergunakan sebagaimana mestinya.</p>
    ${multiSignBlock(d, sek, tahun)}
</div>`;
}

// ==================== SECTION 8: DAFTAR HADIR MC-100 ====================
function daftarHadirMc100(d, tahun) {
    return daftarHadirTemplate('MC- 100%', d, tahun, null, false);
}

// ==================== SECTION 9: BERITA ACARA MC-100 ====================
function beritaAcaraMc100(d, tahun, sek) {
    return `
<div class="page-break">
    <table style="width:100%;border:none;margin-bottom:20px">
        <tr>
            <td style="border:none;width:50%">
                <table class="info-table">
                    <tr><td>Kegiatan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
                </table>
            </td>
            <td style="border:none;width:50%">
                <div style="text-align:center;font-weight:bold;font-size:14pt">BERITA ACARA</div>
                <div style="text-align:center;font-weight:bold;font-size:13pt">MUTUAL CHECK (MC-100)</div>
            </td>
        </tr>
        <tr>
            <td style="border:none">
                <table class="info-table">
                    <tr><td>Lokasi</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr>
                </table>
            </td>
            <td style="border:none">
                <table class="info-table">
                    <tr><td>Nomor</td><td>: ${dot(d.noMc100)}</td></tr>
                    <tr><td>Tanggal</td><td>: ${d.tglMc100 ? fmtDate(d.tglMc100) : ''}</td></tr>
                </table>
            </td>
        </tr>
    </table>
    <p style="text-indent:40px;text-align:justify">
        Pada hari ini ........................ tanggal ........................ bulan ........................ tahun ${TAHUN_TERBILANG} (........- ........- ${tahun}), kami yang bertandatangan di bawah ini :
    </p>
    ${ppkomAndKontraktorBlock(d)}
    <p style="text-indent:40px;text-align:justify">
        Dengan ini telah sepakat mengadakan penelitian dan perhitungan pekerjaan bersama di lapangan antara tim Teknis Pendukung Pejabat Pembuat Komitmen dan Konsultan Pengawas dengan Kontraktor Pelaksana Atas :
    </p>
    <table class="info-table" style="margin:16px 0 16px 30px">
        <tr><td>Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Lokasi</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr>
        <tr><td>Nomor Kontrak</td><td>:</td><td>${dot(d.noSpk)}</td></tr>
        <tr><td>Jangka Waktu Pelaksanaan</td><td>:</td><td>${d.jangkaWaktu ? d.jangkaWaktu + ' Hari Kalender' : '-'}</td></tr>
    </table>
    <p>Dengan hasil sebagai berikut</p>
    <ol>
        <li>Penelitian dan perhitungan sebagaimana kuantitas pekerjaan terlampir</li>
        <li>........................................................................................................................................</li>
        <li>........................................................................................................................................</li>
        <li>........................................................................................................................................</li>
    </ol>
    <p>Demikian Berita Acara ini dibuat dengan penuh rasa tanggungjawab untuk selanjutnya akan digunakan sebagai dasar bagi penyiapan MC-100 untuk dipergunakan sebagaimana mestinya.</p>
    ${multiSignBlock(d, sek, tahun)}
</div>`;
}

// ==================== SHARED: PPKom + Kontraktor Info Block ====================
function ppkomAndKontraktorBlock(d) {
    return `
    <table class="info-table" style="margin:16px 0 16px 20px">
        <tr><td colspan="3"><strong>1.</strong></td></tr>
        <tr><td style="padding-left:30px">Nama</td><td>:</td><td>${PPKOM.nama}</td></tr>
        <tr><td style="padding-left:30px">NIP</td><td>:</td><td>${PPKOM.nip}</td></tr>
        <tr><td style="padding-left:30px">Jabatan</td><td>:</td><td>${PPKOM.jabatan}</td></tr>
        <tr><td style="padding-left:30px">Berkedudukan di</td><td>:</td><td>${PPKOM.alamat}</td></tr>
    </table>
    <p style="margin-left:20px">Dengan Kontraktor Pelaksana</p>
    <table class="info-table" style="margin:8px 0 16px 20px">
        <tr><td colspan="3"><strong>2.</strong></td></tr>
        <tr><td style="padding-left:30px">Nama</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
        <tr><td style="padding-left:30px">Jabatan</td><td>:</td><td>Direktur</td></tr>
        <tr><td style="padding-left:30px">Berkedudukan di</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
    </table>`;
}

// ==================== SHARED: Multi-Sign Block ====================
function multiSignBlock(d, sek, tahun) {
    return `
    <table style="width:100%;border:none;margin-top:30px">
        <tr>
            <td style="border:none;width:50%;vertical-align:top">
                <div>Tim Teknis Pendukung Pejabat Pembuat Komitmen</div>
                <div style="margin-top:16px">
                    <div>1. ${TIM_TEKNIS_KETUA.nama}</div>
                    <div style="margin-left:16px">( Ketua )………………</div>
                    <div style="font-size:11pt">NIP. ${TIM_TEKNIS_KETUA.nip}</div>
                </div>
                <div style="margin-top:50px">
                    <div>2. ${dot(sek?.nama)}</div>
                    <div style="margin-left:16px">(Sekretaris)……………</div>
                    <div style="font-size:11pt">NIP. ${dot(sek?.nip)}</div>
                </div>
                <div style="margin-top:50px">
                    <div>3. ${dot(d.kepsek)}</div>
                    <div style="margin-left:16px">(Anggota)……………..</div>
                    <div style="font-size:11pt">NIP. ${dot(d.nipKs)}</div>
                </div>
            </td>
            <td style="border:none;width:50%;vertical-align:top">
                <div>Kontraktor Pelaksana</div>
                <div style="margin-top:16px">${dot(d.penyedia)}</div>
                <div class="ttd-space"></div>
                <div class="sign-name">${dot(d.namaPemilik)}</div>
                <div>Direktur</div>
                <div style="margin-top:60px">Konsultan Perencana</div>
                <div style="margin-top:4px">${dot(d.konsultanPengawas)}</div>
                <div class="ttd-space"></div>
                <div class="sign-name">${dot(d.dirKonsultanPengawas)}</div>
                <div>Kepala Cabang</div>
            </td>
        </tr>
    </table>
    <div style="display:flex;justify-content:center;margin-top:40px">
        <div style="text-align:center">
            <div>Kepala Bidang Sarana dan Prasarana</div>
            <div>Selaku Pejabat Pembuat Komitmen</div>
            <div class="ttd-space"></div>
            <div class="sign-name">${PPKOM.nama}</div>
            <div class="sign-nip">NIP. ${PPKOM.nip}</div>
        </div>
    </div>`;
}


