/**
 * SPL Document Generator v2
 * Matches the reference PDF format exactly (12 pages)
 * Pages: Cover | SPL | Struktur | DH-PCM | BA-PCM (2pg) | DH-MC0 | BA-MC0 (2pg) | DH-MC100 | BA-MC100 (2pg)
 */

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

function dot(val) { return val || '…………………………'; }
function fmtRp(val) {
    if (!val) return '0';
    return Number(val).toLocaleString('id-ID');
}

const KOP_HTML = `
<div style="display:flex;align-items:center;gap:16px;margin-bottom:4px">
    <img src="/cilacap-logo.png" alt="Logo" style="width:70px;height:80px" onerror="this.style.display='none'"/>
    <div style="text-align:center;flex:1">
        <div style="font-size:13pt;font-weight:bold">PEMERINTAH KABUPATEN CILACAP</div>
        <div style="font-size:16pt;font-weight:bold">DINAS PENDIDIKAN DAN KEBUDAYAAN</div>
        <div style="font-size:9pt">Jalan Kalimantan No. 51, Gunungsimping, Cilacap Tengah,Cilacap,Jawa Tengah 53224,</div>
        <div style="font-size:9pt">Telepon. (0282) 542797 Faksimile. (0282) 540579,</div>
        <div style="font-size:9pt">Laman :http://pdk.cilacapkab.go.id/ Pos-el : pdkclp@gmail.com</div>
    </div>
</div>
<div style="border-top:3px double #000;border-bottom:1px solid #000;height:4px;margin-bottom:16px"></div>`;

const CSS = `
@page { size: A4; margin: 1.5cm 2cm; }
@media print { .page-break { page-break-after: always; } }
body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 0; }
table { border-collapse: collapse; width: 100%; }
.info-table td { border: none; padding: 2px 4px; vertical-align: top; }
.info-table td:first-child { width: 200px; white-space: nowrap; }
.info-table td:nth-child(2) { width: 15px; text-align: center; }
.bordered td, .bordered th { border: 1px solid #000; padding: 6px 10px; }
.bordered th { background: #e8e8e8; font-weight: bold; text-align: center; }
h2, h3 { text-align: center; margin: 0; }
.sign-name { text-decoration: underline; font-weight: bold; }
.ttd-space { height: 70px; }
.center { text-align: center; }
.right { text-align: right; }
.cover-border { border: 2px solid #000; padding: 20px 30px; min-height: 85vh; position: relative; }
.no-box { border: 2px solid #000; padding: 6px 20px; font-size: 22pt; font-weight: bold; font-style: italic; position: absolute; top: 20px; right: 20px; }
`;

export function generateSplHtml(item, sekretaris = {}) {
    const d = item;
    const tahun = d.tahunAnggaran || new Date().getFullYear();
    const sek = { nama: sekretaris.name || sekretaris.nama || '…………………', nip: sekretaris.nip || '…………………' };

    const pages = [
        pageCover(d, tahun),
        pageSpl(d, tahun),
        pageStruktur(d),
        pageDaftarHadirPCM(d, tahun, sek),
        pageBA_PCM(d, tahun, sek),
        pageDaftarHadirMC0(d, tahun),
        pageBA_MC0(d, tahun, sek),
        pageDaftarHadirMC100(d, tahun),
        pageBA_MC100(d, tahun, sek),
    ];

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SPL - ${d.namaPaket || 'Dokumen'}</title><style>${CSS}</style></head><body>${pages.join('')}</body></html>`;
}

// ======================== PAGE 1: COVER ========================
function pageCover(d, tahun) {
    return `
<div class="page-break">
    <div class="cover-border">
        <div class="no-box">${d.noMatrik || '-'}</div>
        <div style="text-align:center;margin-top:80px">
            <div style="font-size:14pt;font-weight:bold">${(d.namaSekolah || '').toUpperCase()}</div>
        </div>
        <div style="text-align:center;margin:30px 0 24px">
            <div style="font-size:13pt;font-weight:bold">KEGIATAN ${(d.sumberDana || 'APBD').toUpperCase()} TAHUN ANGGARAN ${tahun}</div>
        </div>
        <table class="bordered" style="margin:0 auto 30px;width:90%">
            <thead><tr>
                <th style="width:45%">NAMA PEKERJAAN</th>
                <th style="width:25%">NILAI KONTRAK</th>
                <th style="width:30%">JANGKA WAKTU</th>
            </tr></thead>
            <tbody><tr>
                <td>${dot(d.namaPaket)}</td>
                <td class="center">${fmtRp(d.nilaiKontrak)}</td>
                <td class="center">${d.jangkaWaktu ? d.jangkaWaktu + ' Hari Kalender' : '-'}</td>
            </tr></tbody>
        </table>
        <table class="info-table" style="margin:30px auto 0;width:85%">
            <tr><td>PENYEDIA</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
            <tr><td>NAMA DIREKTUR</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr>
            <tr><td>NO HP</td><td>:</td><td>${dot(d.noHp)}</td></tr>
            <tr><td>TANGGAL PCM</td><td>:</td><td>…………………………………………………..</td></tr>
            <tr><td>TANGGAL MC-0</td><td>:</td><td>…………………………………………………..</td></tr>
            <tr><td>TANGGAL MC-100</td><td>:</td><td>…………………………………………………..</td></tr>
        </table>
    </div>
</div>`;
}

// ======================== PAGE 2: SPL ========================
function pageSpl(d, tahun) {
    return `
<div class="page-break">
    <div style="text-align:center;margin-top:60px">
        <div style="font-size:14pt;font-weight:bold">SURAT PENYERAHAN LAPANGAN (SPL)</div>
        <div style="margin:8px 0">Nomor: .................................</div>
    </div>
    <div style="text-align:center;margin:24px 0">
        Kegiatan ${dot(d.namaPaket)}
    </div>
    <p style="text-indent:50px;text-align:justify">
        Pada hari ini ........................... tanggal ........................... bulan ........................... tahun ${TAHUN_TERBILANG} (........- .......- ${tahun}) kami yang bertanda tangan dibawah ini Kepala ${d.namaSekolah || '.......'} Kab. Cilacap menyerahkan Lapangan kepada :
    </p>
    <table class="info-table" style="margin:12px 0 12px 50px">
        <tr><td style="width:100px">Nama</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr>
        <tr><td>Jabatan</td><td>:</td><td>Direktur ${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
    </table>
    <p style="text-indent:50px;text-align:justify">
        Surat Penyerahan Lapangan (SPL) ini kami berikan untuk melaksanakan Kegiatan ${dot(d.namaPaket)} Kab. Cilacap Tahun Anggaran ${tahun}, dengan ketentuan sebagai berikut :
    </p>
    <ol style="margin-left:20px;text-align:justify">
        <li>Untuk melaksanakan Pekerjaan Konstruksi ${dot(d.namaPaket)} sesuai kontrak dan segera melakukan koordinasi dengan pihak - pihak terkait yang ada hubungannya dengan pekerjaan ini;</li>
        <li>Melaksanakan pengamanan areal yang akan dilaksanakan;</li>
        <li>Memasang Papan nama Pekerjaan di lokasi;</li>
        <li>Membuat papan untuk menempelkan Gambar Kerja, Time schedule;</li>
        <li>Surat Penyerahan Lapangan ini berlaku mulai tanggal ........- ........- ${tahun} dan berakhir sampai dengan selesainya pekerjaan atau selambat-lambatnya tanggal ........- ........- ${tahun}.</li>
    </ol>
    <p>Demikian Surat Penyerahan Lapangan ini kami berikan untuk dilaksanakan sebagaimana mestinya.</p>
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
        <div style="text-align:center;min-width:280px">
            <div>KEPALA ${(d.namaSekolah || '').toUpperCase()}</div>
            <div>KAB. CILACAP</div>
            <div class="ttd-space"></div>
            <div class="sign-name">${dot(d.kepsek)}</div>
            <div>NIP. ${dot(d.nipKs)}</div>
        </div>
    </div>
</div>`;
}

// ======================== PAGE 3: STRUKTUR ORGANISASI ========================
function pageStruktur(d) {
    return `
<div class="page-break">
    <h2 style="font-size:14pt;font-weight:bold;margin:40px 0 30px">STRUKTUR ORGANISASI PEKERJAAN</h2>
    <ul style="list-style:disc;margin-left:20px">
        <li><strong>PELAKSANA PEKERJAAN</strong>
            <ol style="margin-top:8px;list-style:decimal;margin-left:10px">
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Perusahaan</span><span>: ${dot(d.penyedia)}</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Direktur</span><span>: ${dot(d.namaPemilik)}</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Pelaksana</span><span>: …………………..</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Mandor/<br>Kepala Tukang</span><span>: …………………..</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Lokasi Pekerjaan</span><span>: ${(d.namaSekolah || '').toUpperCase()}</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Schedule Pekerjaan</span><span>: Ada/Tidak (*Coret salah satu)</span></li>
            </ol>
        </li>
    </ul>
    <ul style="list-style:disc;margin-left:20px;margin-top:30px">
        <li><strong>PENGAWAS PEKERJAAN</strong>
            <ol style="margin-top:8px;list-style:decimal;margin-left:10px">
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Perusahaan</span><span>: ${dot(d.konsultanPengawas)}</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Direktur</span><span>: ${dot(d.dirKonsultanPengawas)}</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Nama Pengawas<br>Lapangan</span><span>: ……………………</span></li>
                <li style="display:flex;gap:10px"><span style="min-width:200px">Lokasi Pekerjaan</span><span>: ${(d.namaSekolah || '').toUpperCase()}</span></li>
            </ol>
        </li>
    </ul>
</div>`;
}

// ======================== DAFTAR HADIR (reusable) ========================
function daftarHadirPage(title, d, tahun, sek, type) {
    // PCM: PPKom, Tim Teknis Ketua, Sekretaris, Konsultan, Kontraktor, KS, (blank)
    // MC0/MC100: KS, Konsultan, Kontraktor, blank x4
    let rows;
    if (type === 'pcm') {
        rows = [
            { nama: PPKOM.nama, instansi: 'Pejabat Pembuat Komitmen (PPKom)' },
            { nama: TIM_TEKNIS_KETUA.nama, instansi: 'Tim Teknis Pendukung PPK (Ketua)' },
            { nama: dot(sek?.nama), instansi: 'Tim Teknis Pendukung PPK (Sekretaris)' },
            { nama: '', instansi: `Konsultan Perencana\n${dot(d.konsultanPengawas)}` },
            { nama: '', instansi: `Kontraktor Pelaksana\n${dot(d.penyedia)}` },
            { nama: dot(d.kepsek), instansi: d.namaSekolah || '' },
            { nama: '', instansi: '' },
        ];
    } else {
        rows = [
            { nama: dot(d.kepsek), instansi: (d.namaSekolah || '').toUpperCase() },
            { nama: '', instansi: `Konsultan Pengawas\n${dot(d.konsultanPengawas)}` },
            { nama: '', instansi: `Kontraktor Pelaksana\n${dot(d.penyedia)}` },
            { nama: '', instansi: '' },
            { nama: '', instansi: '' },
            { nama: '', instansi: '' },
            { nama: '', instansi: '' },
        ];
    }

    const rowsHtml = rows.map((r, i) => `
        <tr style="height:45px">
            <td class="center" style="border:1px solid #000;padding:4px 8px">${i + 1}.</td>
            <td style="border:1px solid #000;padding:4px 8px">${r.nama}</td>
            <td style="border:1px solid #000;padding:4px 8px;white-space:pre-line">${r.instansi}</td>
            <td style="border:1px solid #000;padding:4px 8px"></td>
            <td class="center" style="border:1px solid #000;padding:4px 8px">${i + 1}.</td>
        </tr>`).join('');

    return `
<div class="page-break">
    <h2 style="font-size:14pt;font-weight:bold;margin-bottom:4px">DAFTAR HADIR</h2>
    <h3 style="font-size:12pt;font-weight:bold;font-style:italic;margin-bottom:24px;white-space:pre-line">${title}</h3>
    <table class="info-table" style="margin-bottom:24px">
        <tr><td>Hari / Tanggal</td><td>:</td><td>…………………………………………..</td></tr>
        <tr><td>Paket/ Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Nomor Kontrak</td><td>:</td><td>${dot(d.noSpk)}</td></tr>
        <tr><td>Tempat</td><td>:</td><td>${type === 'pcm' ? '…………………………………………..' : dot(d.namaSekolah)}</td></tr>
    </table>
    <table style="width:100%">
        <thead><tr>
            <th style="border:1px solid #000;padding:6px;width:35px;font-weight:bold">No.</th>
            <th style="border:1px solid #000;padding:6px;font-weight:bold">Nama</th>
            <th style="border:1px solid #000;padding:6px;font-weight:bold">Instansi/ Jabatan</th>
            <th style="border:1px solid #000;padding:6px;width:70px;font-weight:bold">No. Hp</th>
            <th style="border:1px solid #000;padding:6px;width:100px;font-weight:bold">Tanda Tangan</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:40px">
        <div style="text-align:center;min-width:280px">
            <div>Cilacap, …………………..</div>
            <div>Kepala Bidang Sarana dan Prasarana</div>
            <div>Selaku Pejabat Pembuat Komitmen</div>
            <div class="ttd-space"></div>
            <div class="sign-name">${PPKOM.nama}</div>
            <div>NIP. ${PPKOM.nip}</div>
        </div>
    </div>
</div>`;
}

// ======================== PAGE 4: DAFTAR HADIR PCM ========================
function pageDaftarHadirPCM(d, tahun, sek) {
    return daftarHadirPage('Berita Acara Rapat Persiapan Pelaksanaan Kontrak\n(Pre Construction Meeting / PCM )', d, tahun, sek, 'pcm');
}

// ======================== PAGE 5-6: BERITA ACARA PCM ========================
function pageBA_PCM(d, tahun, sek) {
    return `
<div class="page-break">
    <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:14pt;font-weight:bold">Berita Acara Rapat Persiapan Pelaksanaan Kontrak</div>
        <div style="font-size:13pt;font-weight:bold;font-style:italic">(Pre Construction Meeting / PCM )</div>
        <div style="margin-top:8px">Nomor  : ${dot(d.noPcm)}</div>
    </div>
    <p style="text-indent:50px;text-align:justify">
        Pada hari ini ………… tanggal ………… bulan ………… tahun ${TAHUN_TERBILANG} (…- …- ${tahun}) telah dilaksanakan Rapat Persiapan Pelaksanaan Kontrak (Pre Construction Meeting) untuk paket pekerjaan :
    </p>
    <table class="info-table" style="margin:12px 0 12px 30px">
        <tr><td>Nama Paket</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Sumber Dana</td><td>:</td><td>${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun}</td></tr>
        <tr><td>Kontraktor Pelaksana</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat Kontraktor Pelaksana</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
        <tr><td>Nilai Kontrak</td><td>:</td><td>Rp. ${fmtRp(d.nilaiKontrak)}</td></tr>
        <tr><td>Konsultan Pengawas</td><td>:</td><td>${dot(d.konsultanPengawas)}</td></tr>
    </table>
    <ol style="margin:16px 0">
        <li><strong>Pelaksanaan Rapat :</strong>
            <ol type="1" style="margin-top:4px">
                <li>Rapat dipimpin oleh Pejabat Pembuat Komitmen;</li>
                <li style="text-align:justify">Rapat dihadiri oleh Pejabat Pembuat Komitmen, Tim Teknis Pendukung PPK, Konsultan Pengawas, Kontraktor Pelaksana, Pihak sekolah penerima manfaat bantuan Dana ${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun};</li>
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
        <li style="margin-top:12px"><strong>Kesimpulan :</strong><br>Hasil kesepakatan rapat yang disetujui bersama adalah sebagai berikut :
            <ol type="1" style="margin-top:4px">
                <li>Pihak Kontraktor segera membuat surat pemberitahuan pelaksanaan pekerjaan kepada sekolah.</li>
                <li>Pihak kontraktor siap melaksanakan pekerjaan dan hal – hal yang tercantum dalam Kontrak dengan rasa tanggung jawab.</li>
                <li>Secepatnya akan dijadwalkan kegiatan MC 0.</li>
            </ol>
        </li>
    </ol>
    <p>Demikian berita acara ini dibuat dan merupakan suatu kesatuan dengan Dokumen Kontrak.</p>
    ${multiSignBlock(d, sek)}
</div>`;
}

// ======================== PAGE 7: DAFTAR HADIR MC-0 ========================
function pageDaftarHadirMC0(d, tahun) {
    return daftarHadirPage('MC- 0%', d, tahun, null, 'mc');
}

// ======================== PAGE 8-9: BERITA ACARA MC-0 ========================
function pageBA_MC0(d, tahun, sek) {
    return beritaAcaraMC(d, tahun, sek, '0', d.noMc0, d.tglMc0, 'MC- 0');
}

// ======================== PAGE 10: DAFTAR HADIR MC-100 ========================
function pageDaftarHadirMC100(d, tahun) {
    return daftarHadirPage('MC- 100%', d, tahun, null, 'mc');
}

// ======================== PAGE 11-12: BERITA ACARA MC-100 ========================
function pageBA_MC100(d, tahun, sek) {
    return beritaAcaraMC(d, tahun, sek, '100', d.noMc100, d.tglMc100, 'MC-100');
}

// ======================== SHARED: BERITA ACARA MC (with KOP) ========================
function beritaAcaraMC(d, tahun, sek, persen, noMc, tglMc, label) {
    return `
<div class="page-break">
    ${KOP_HTML}
    <table class="bordered" style="margin-bottom:16px">
        <tr>
            <td style="width:55%">Kegiatan &nbsp;: ${dot(d.namaPaket)}</td>
            <td rowspan="2" style="text-align:center;font-weight:bold;font-size:13pt;vertical-align:middle">BERITA ACARA<br>MUTUAL CHECK &nbsp;(${label})</td>
        </tr>
        <tr>
            <td>Lokasi &nbsp;&nbsp;&nbsp;&nbsp;: ${dot(d.namaSekolah)}</td>
        </tr>
        <tr>
            <td></td>
            <td>Nomor &nbsp;: ${dot(noMc)}<br>Tanggal : ${tglMc ? new Date(tglMc).toLocaleDateString('id-ID') : ''}</td>
        </tr>
    </table>
    <p style="text-indent:50px;text-align:justify">
        Pada hari ini ........................ tanggal ........................ bulan ........................ tahun ${TAHUN_TERBILANG} (........- ........- ${tahun}), kami yang bertandatangan di bawah ini :
    </p>
    ${ppkomKontraktorInfo(d)}
    <p style="text-indent:50px;text-align:justify">
        Dengan ini telah sepakat mengadakan penelitian dan perhitungan pekerjaan bersama di lapangan antara tim Teknis Pendukung Pejabat Pembuat Komitmen dan Konsultan Pengawas dengan Kontraktor Pelaksana Atas :
    </p>
    <table class="info-table" style="margin:12px 0 12px 30px">
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
    <p style="text-align:justify">Demikian Berita Acara ini dibuat dengan penuh rasa tanggungjawab untuk selanjutnya akan digunakan sebagai dasar bagi penyiapan ${label} untuk dipergunakan sebagaimana mestinya.</p>
    ${multiSignBlock(d, sek)}
</div>`;
}

// ======================== SHARED BLOCKS ========================
function ppkomKontraktorInfo(d) {
    return `
    <div style="margin:12px 0 12px 20px">
        <div><strong>1.</strong></div>
        <table class="info-table" style="margin-left:20px">
            <tr><td>Nama</td><td>:</td><td>${PPKOM.nama}</td></tr>
            <tr><td>NIP</td><td>:</td><td>${PPKOM.nip}</td></tr>
            <tr><td>Jabatan</td><td>:</td><td>${PPKOM.jabatan}</td></tr>
            <tr><td>Berkedudukan di</td><td>:</td><td>${PPKOM.alamat}</td></tr>
        </table>
    </div>
    <p style="margin-left:20px">Dengan Kontraktor Pelaksana</p>
    <div style="margin:8px 0 12px 20px">
        <div><strong>2.</strong></div>
        <table class="info-table" style="margin-left:20px">
            <tr><td>Nama</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
            <tr><td>Jabatan</td><td>:</td><td>Direktur</td></tr>
            <tr><td>Berkedudukan di</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
        </table>
    </div>`;
}

function multiSignBlock(d, sek) {
    return `
    <table style="width:100%;border:none;margin-top:24px">
        <tr>
            <td style="border:none;width:50%;vertical-align:top">
                <div style="font-weight:bold;margin-bottom:8px">Tim Teknis Pendukung Pejabat Pembuat Komitmen</div>
                <div style="margin-top:8px">
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
            <td style="border:none;width:50%;vertical-align:top;padding-left:20px">
                <div style="font-weight:bold;margin-bottom:8px">Kontraktor Pelaksana</div>
                <div style="margin-top:8px">${dot(d.penyedia)}</div>
                <div class="ttd-space"></div>
                <div class="sign-name">${dot(d.namaPemilik)}</div>
                <div>Direktur</div>
                <div style="margin-top:50px;font-weight:bold">Konsultan Perencana</div>
                <div style="margin-top:4px">${dot(d.konsultanPengawas)}</div>
                <div class="ttd-space"></div>
                <div class="sign-name">${dot(d.dirKonsultanPengawas)}</div>
                <div>Kepala Cabang</div>
            </td>
        </tr>
    </table>
    <div style="text-align:center;margin-top:30px">
        <div>Kepala Bidang Sarana dan Prasarana</div>
        <div>Selaku Pejabat Pembuat Komitmen</div>
        <div class="ttd-space"></div>
        <div class="sign-name">${PPKOM.nama}</div>
        <div>NIP. ${PPKOM.nip}</div>
    </div>`;
}
