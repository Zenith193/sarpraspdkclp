/**
 * SPL Document Generator v3 — Exact PDF match
 * 12-page document matching the reference PDF pixel-perfectly
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

function dot(v) { return v || '…………………………'; }
function fmtRp(v) { return v ? Number(v).toLocaleString('id-ID') : '0'; }

// ======== KOP HEADER ========
const KOP = `
<div style="display:flex;align-items:center;gap:14px;margin-bottom:2px">
    <img src="/cilacap-logo.png" alt="" style="width:65px;height:75px" onerror="this.style.display='none'"/>
    <div style="text-align:center;flex:1">
        <div style="font-size:12pt;font-weight:bold;font-style:italic">PEMERINTAH KABUPATEN CILACAP</div>
        <div style="font-size:15pt;font-weight:bold">DINAS PENDIDIKAN DAN KEBUDAYAAN</div>
        <div style="font-size:8.5pt">Jalan Kalimantan No. 51, Gunungsimping, Cilacap Tengah,Cilacap,Jawa Tengah 53224,</div>
        <div style="font-size:8.5pt">Telepon. (0282) 542797 Faksimile. (0282) 540579,</div>
        <div style="font-size:8.5pt">Laman :http://pdk.cilacapkab.go.id/ Pos-el : pdkclp@gmail.com</div>
    </div>
</div>
<div style="border-top:3px solid #000;margin:2px 0 0 0"></div>
<div style="border-top:1.5px solid #000;margin:2px 0 14px 0"></div>`;

const CSS = `
@page { size: A4; margin: 1.5cm 2cm; }
@media print {
    .page-break { page-break-after: always; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
* { box-sizing: border-box; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 0; }
table { border-collapse: collapse; width: 100%; }
td, th { vertical-align: top; }
.t td { border: none; padding: 2px 4px; }
.t td:first-child { white-space: nowrap; }
.t td:nth-child(2) { width: 14px; text-align: center; }
.bt td, .bt th { border: 1px solid #000; padding: 5px 8px; }
.bt th { font-weight: bold; text-align: center; }
h2 { text-align: center; margin: 0; }
.u { text-decoration: underline; font-weight: bold; }
.sp { height: 70px; }
.c { text-align: center; }
.r { text-align: right; }
.j { text-align: justify; }
.cover { border: 2px solid #000; padding: 20px 28px; min-height: 85vh; position: relative; }
.nbox { border: 2px solid #000; padding: 5px 18px; font-size: 22pt; font-weight: bold; font-style: italic; position: absolute; top: 18px; right: 18px; }
p { margin: 6px 0; }
`;

export function generateSplHtml(item, sekretaris = {}) {
    const d = item;
    const tahun = d.tahunAnggaran || new Date().getFullYear();
    const sek = { nama: sekretaris.name || sekretaris.nama || '…………………', nip: sekretaris.nip || '…………………' };

    const pages = [
        p1Cover(d, tahun),
        p2Spl(d, tahun),
        p3Struktur(d),
        p4DhPcm(d, sek),
        p5BaPcm(d, tahun, sek),
        p7DhMc0(d),
        p8BaMc0(d, tahun, sek),
        p10DhMc100(d),
        p11BaMc100(d, tahun, sek),
    ];

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SPL - ${d.namaPaket || ''}</title><style>${CSS}</style></head><body>${pages.join('')}</body></html>`;
}

// ============================= PAGE 1: COVER =============================
function p1Cover(d, tahun) {
    return `
<div class="page-break">
<div class="cover">
    <div class="nbox">${d.noMatrik || '-'}</div>
    <div class="c" style="margin-top:80px">
        <div style="font-size:14pt;font-weight:bold">${(d.namaSekolah || '').toUpperCase()}</div>
    </div>
    <div class="c" style="margin:28px 0 20px">
        <div style="font-size:13pt;font-weight:bold">KEGIATAN ${(d.sumberDana || 'APBD').toUpperCase()} TAHUN ANGGARAN ${tahun}</div>
    </div>
    <table class="bt" style="margin:0 auto 28px;width:92%">
        <thead><tr><th style="width:45%">NAMA PEKERJAAN</th><th style="width:25%">NILAI KONTRAK</th><th style="width:30%">JANGKA WAKTU</th></tr></thead>
        <tbody><tr>
            <td>${dot(d.namaPaket)}</td>
            <td class="c">${fmtRp(d.nilaiKontrak)}</td>
            <td class="c">${d.jangkaWaktu ? d.jangkaWaktu + ' Hari Kalender' : '-'}</td>
        </tr></tbody>
    </table>
    <table class="t" style="margin:28px auto 0;width:86%">
        <tr><td>PENYEDIA</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
        <tr><td>NAMA DIREKTUR</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr>
        <tr><td>NO HP</td><td>:</td><td>${dot(d.noHp)}</td></tr>
        <tr><td>TANGGAL PCM</td><td>:</td><td>………………………………………………</td></tr>
        <tr><td>TANGGAL MC-0</td><td>:</td><td>………………………………………………</td></tr>
        <tr><td>TANGGAL MC-100</td><td>:</td><td>………………………………………………</td></tr>
    </table>
</div>
</div>`;
}

// ============================= PAGE 2: SPL =============================
function p2Spl(d, tahun) {
    return `
<div class="page-break">
    <div class="c" style="margin-top:50px">
        <div style="font-size:14pt;font-weight:bold">SURAT PENYERAHAN LAPANGAN (SPL)</div>
        <div style="margin:6px 0">Nomor: .................................</div>
    </div>
    <div class="c" style="margin:20px 0">Kegiatan ${dot(d.namaPaket)}</div>
    <p style="text-indent:50px" class="j">
        Pada hari ini ........................... tanggal ........................... bulan ........................... tahun ${TAHUN_TERBILANG} (........- .......- ${tahun}) kami yang bertanda tangan dibawah ini Kepala ${d.namaSekolah || '.......'} Kab. Cilacap menyerahkan Lapangan kepada :
    </p>
    <table class="t" style="margin:10px 0 10px 50px">
        <tr><td style="width:80px">Nama</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr>
        <tr><td>Jabatan</td><td>:</td><td>Direktur ${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
    </table>
    <p style="text-indent:50px" class="j">
        Surat Penyerahan Lapangan (SPL) ini kami berikan untuk melaksanakan Kegiatan ${dot(d.namaPaket)} Kab. Cilacap Tahun Anggaran ${tahun}, dengan ketentuan sebagai berikut :
    </p>
    <ol style="margin-left:16px" class="j">
        <li>Untuk melaksanakan Pekerjaan Konstruksi ${dot(d.namaPaket)} sesuai kontrak dan segera melakukan koordinasi dengan pihak - pihak terkait yang ada hubungannya dengan pekerjaan ini;</li>
        <li>Melaksanakan pengamanan areal yang akan dilaksanakan;</li>
        <li>Memasang Papan nama Pekerjaan di lokasi;</li>
        <li>Membuat papan untuk menempelkan Gambar Kerja, Time schedule;</li>
        <li>Surat Penyerahan Lapangan ini berlaku mulai tanggal ........- ........- ${tahun} dan berakhir sampai dengan selesainya pekerjaan atau selambat-lambatnya tanggal ........- ........- ${tahun}.</li>
    </ol>
    <p>Demikian Surat Penyerahan Lapangan ini kami berikan untuk dilaksanakan sebagaimana mestinya.</p>
    <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <div class="c" style="min-width:260px">
            <div>KEPALA ${(d.namaSekolah || '').toUpperCase()}</div>
            <div>KAB. CILACAP</div>
            <div class="sp"></div>
            <div class="u">${dot(d.kepsek)}</div>
            <div>NIP. ${dot(d.nipKs)}</div>
        </div>
    </div>
</div>`;
}

// ============================= PAGE 3: STRUKTUR =============================
function p3Struktur(d) {
    return `
<div class="page-break">
    <h2 style="font-size:14pt;font-weight:bold;margin:36px 0 28px">STRUKTUR ORGANISASI PEKERJAAN</h2>
    <ul style="list-style:disc;margin-left:16px">
        <li><strong>PELAKSANA PEKERJAAN</strong>
            <ol style="margin-top:6px;list-style-type:decimal;margin-left:8px">
                <li><table class="t"><tr><td style="width:210px">Nama Perusahaan</td><td>:</td><td>${dot(d.penyedia)}</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Nama Direktur</td><td>:</td><td>${dot(d.namaPemilik)}</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Nama Pelaksana</td><td>:</td><td>…………………..</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Nama Mandor/<br>Kepala Tukang</td><td>:</td><td>…………………..</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Lokasi Pekerjaan</td><td>:</td><td>${(d.namaSekolah || '').toUpperCase()}</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Schedule Pekerjaan</td><td>:</td><td>Ada/Tidak (*Coret salah satu)</td></tr></table></li>
            </ol>
        </li>
    </ul>
    <ul style="list-style:disc;margin-left:16px;margin-top:28px">
        <li><strong>PENGAWAS PEKERJAAN</strong>
            <ol style="margin-top:6px;list-style-type:decimal;margin-left:8px">
                <li><table class="t"><tr><td style="width:210px">Nama Perusahaan</td><td>:</td><td>${dot(d.konsultanPengawas)}</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Nama Direktur</td><td>:</td><td>${dot(d.dirKonsultanPengawas)}</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Nama Pengawas<br>Lapangan</td><td>:</td><td>……………………</td></tr></table></li>
                <li><table class="t"><tr><td style="width:210px">Lokasi Pekerjaan</td><td>:</td><td>${(d.namaSekolah || '').toUpperCase()}</td></tr></table></li>
            </ol>
        </li>
    </ul>
</div>`;
}

// ============================= PAGE 4: DH PCM =============================
function p4DhPcm(d, sek) {
    const rows = [
        [PPKOM.nama, 'Pejabat Pembuat Komitmen (PPKom)'],
        [TIM_TEKNIS_KETUA.nama, 'Tim Teknis Pendukung PPK (Ketua)'],
        [dot(sek?.nama), 'Tim Teknis Pendukung PPK (Sekretaris)'],
        ['', `Konsultan Pengawas\n${dot(d.konsultanPengawas)}`],
        ['', `Kontraktor Pelaksana\n${dot(d.penyedia)}`],
        [dot(d.kepsek), d.namaSekolah || ''],
        ['', ''],
    ];
    return dhPage('DAFTAR HADIR', 'Berita Acara Rapat Persiapan Pelaksanaan Kontrak\n<i>(Pre Construction Meeting / PCM )</i>', d, rows, true);
}

// ============================= PAGE 7: DH MC-0 =============================
function p7DhMc0(d) {
    const rows = [
        [dot(d.kepsek), (d.namaSekolah || '').toUpperCase()],
        ['', `Konsultan Pengawas\n${dot(d.konsultanPengawas)}`],
        ['', `Kontraktor Pelaksana\n${dot(d.penyedia)}`],
        ['', ''], ['', ''], ['', ''], ['', ''],
    ];
    return dhPage('DAFTAR HADIR MC- 0%', '', d, rows, false);
}

// ============================= PAGE 10: DH MC-100 =============================
function p10DhMc100(d) {
    const rows = [
        [dot(d.kepsek), (d.namaSekolah || '').toUpperCase()],
        ['', `Konsultan Pengawas\n${dot(d.konsultanPengawas)}`],
        ['', `Kontraktor Pelaksana\n${dot(d.penyedia)}`],
        ['', ''], ['', ''], ['', ''], ['', ''],
    ];
    return dhPage('DAFTAR HADIR MC- 100%', '', d, rows, false);
}

// ============================= DH TEMPLATE =============================
function dhPage(mainTitle, subTitle, d, rows, showPpkomSign) {
    const rr = rows.map((r, i) => `
        <tr style="height:42px">
            <td class="c" style="border:1px solid #000;padding:4px 6px">${i+1}.</td>
            <td style="border:1px solid #000;padding:4px 6px">${r[0]}</td>
            <td style="border:1px solid #000;padding:4px 6px;white-space:pre-line">${r[1]}</td>
            <td style="border:1px solid #000;padding:4px 6px"></td>
            <td class="c" style="border:1px solid #000;padding:4px 6px">${i+1}.</td>
        </tr>`).join('');

    const sign = showPpkomSign ? `
    <div style="display:flex;justify-content:flex-end;margin-top:36px">
        <div class="c" style="min-width:260px">
            <div>Cilacap, …………………..</div>
            <div>Kepala Bidang Sarana dan Prasarana</div>
            <div>Selaku Pejabat Pembuat Komitmen</div>
            <div class="sp"></div>
            <div class="u">${PPKOM.nama}</div>
            <div>NIP. ${PPKOM.nip}</div>
        </div>
    </div>` : '';

    return `
<div class="page-break">
    <h2 style="font-size:14pt;font-weight:bold;margin-bottom:2px">${mainTitle}</h2>
    ${subTitle ? `<div class="c" style="font-weight:bold;white-space:pre-line;margin-bottom:20px">${subTitle}</div>` : '<div style="margin-bottom:20px"></div>'}
    <table class="t" style="margin-bottom:20px">
        <tr><td style="width:160px">Hari / Tanggal</td><td>:</td><td>…………………………………………..</td></tr>
        <tr><td>Paket/ Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Nomor Kontrak</td><td>:</td><td>${dot(d.noSpk)}</td></tr>
        <tr><td>Tempat</td><td>:</td><td>${showPpkomSign ? '…………………………………………..' : dot(d.namaSekolah)}</td></tr>
    </table>
    <table>
        <thead><tr>
            <th style="border:1px solid #000;padding:5px;width:32px;font-weight:bold">No.</th>
            <th style="border:1px solid #000;padding:5px;font-weight:bold">Nama</th>
            <th style="border:1px solid #000;padding:5px;font-weight:bold">Instansi/ Jabatan</th>
            <th style="border:1px solid #000;padding:5px;width:65px;font-weight:bold">No. Hp</th>
            <th style="border:1px solid #000;padding:5px;width:95px;font-weight:bold">Tanda Tangan</th>
        </tr></thead>
        <tbody>${rr}</tbody>
    </table>
    ${sign}
</div>`;
}

// ============================= PAGE 5-6: BA PCM =============================
function p5BaPcm(d, tahun, sek) {
    return `
<div class="page-break">
    ${KOP}
    <div class="c" style="margin-bottom:4px">
        <div style="font-weight:bold;font-size:13pt">Berita Acara Rapat Persiapan Pelaksanaan Kontrak</div>
        <div style="font-weight:bold;font-size:12pt;font-style:italic">(Pre Construction Meeting / PCM )</div>
        <div style="margin-top:4px">Nomor  : ${dot(d.noPcm)}</div>
    </div>
    <p style="text-indent:50px" class="j">
        Pada hari ini ………… tanggal ………… bulan ………… tahun ${TAHUN_TERBILANG} (……- ……- ${tahun}) telah dilaksanakan Rapat Persiapan Pelaksanaan Kontrak (<i>Pre Construction Meeting</i>) untuk paket pekerjaan :
    </p>
    <table class="t" style="margin:8px 0 8px 30px">
        <tr><td style="width:210px">Nama Paket</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
        <tr><td>Sumber Dana</td><td>:</td><td>${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun}</td></tr>
        <tr><td>Kontraktor Pelaksana</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
        <tr><td>Alamat Kontraktor Pelaksana</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
        <tr><td>Nilai Kontrak</td><td>:</td><td>Rp. ${fmtRp(d.nilaiKontrak)}</td></tr>
        <tr><td>Konsultan Pengawas</td><td>:</td><td>${dot(d.konsultanPengawas)}</td></tr>
    </table>
    <div style="margin:8px 0">
        <div><strong>I.&nbsp; Pelaksanaan Rapat :</strong></div>
        <ol style="margin:4px 0 0 24px">
            <li>Rapat dipimpin oleh Pejabat Pembuat Komitmen;</li>
            <li class="j">Rapat dihadiri oleh Pejabat Pembuat Komitmen, Tim Teknis Pendukung PPK, Konsultan Pengawas, Kontraktor Pelaksana, Pihak sekolah penerima manfaat bantuan Dana ${d.sumberDana || 'APBD'} Kab. Cilacap Tahun Anggaran ${tahun};</li>
            <li>Beberapa materi yang dibahas dalam rapat Pre Construction Meeting (PCM) antara lain adalah :
                <ol style="margin-top:2px">
                    <li>Kesamaan interpretasi atas semua hal-hal di dalam dokumen kontrak;</li>
                    <li>Koreksi dan persetujuan gambar rencana dan gambar kerja;</li>
                    <li>Prosedur permohonan (request) dan persetujuan gambar (approval);</li>
                    <li>Prosedur dan metode pelaksanaan;</li>
                    <li>Jadwal mobilisasi dan pelaksanaan fisik secara detail;</li>
                    <li>Prosedur administrasi, keuangan, pelaporan dan lain-lain.</li>
                </ol>
            </li>
        </ol>
    </div>
    <div style="margin:8px 0">
        <div><strong>II.&nbsp; Kesimpulan :</strong></div>
        <div style="text-indent:30px">Hasil kesepakatan rapat yang disetujui bersama adalah sebagai berikut :</div>
        <ol style="margin:4px 0 0 24px">
            <li class="j">Pihak Kontraktor segera membuat surat pemberitahuan pelaksanaan pekerjaan kepada sekolah.</li>
            <li class="j">Pihak kontraktor siap melaksanakan pekerjaan dan hal – hal yang tercantum dalam Kontrak dengan rasa tanggung jawab.</li>
            <li>Secepatnya akan dijadwalkan kegiatan MC 0.</li>
        </ol>
    </div>
    <p style="text-indent:50px" class="j">Demikian berita acara ini dibuat dan merupakan suatu kesatuan dengan Dokumen Kontrak.</p>
    ${signBlock(d, sek)}
</div>`;
}

// ============================= PAGE 8-9: BA MC-0 =============================
function p8BaMc0(d, tahun, sek) {
    return baMcPage(d, tahun, sek, 'MC-0', d.noMc0, d.tglMc0, 'MC- 0');
}

// ============================= PAGE 11-12: BA MC-100 =============================
function p11BaMc100(d, tahun, sek) {
    return baMcPage(d, tahun, sek, 'MC-100', d.noMc100, d.tglMc100, 'MC-100');
}

// ============================= BA MC TEMPLATE (with KOP) =============================
function baMcPage(d, tahun, sek, label, noMc, tglMc, labelText) {
    const fDate = tglMc ? new Date(tglMc).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '';
    return `
<div class="page-break">
    ${KOP}
    <table class="bt" style="margin-bottom:14px">
        <tr>
            <td style="width:55%">
                <table class="t"><tr><td>Kegiatan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr></table>
            </td>
            <td rowspan="2" class="c" style="font-weight:bold;font-size:13pt;vertical-align:middle">BERITA ACARA<br>MUTUAL CHECK &nbsp;(${label})</td>
        </tr>
        <tr>
            <td>
                <table class="t"><tr><td>Lokasi</td><td>:</td><td>${dot(d.namaSekolah)}</td></tr></table>
            </td>
        </tr>
        <tr>
            <td></td>
            <td>Nomor &nbsp;: ${dot(noMc)}<br>Tanggal : ${fDate}</td>
        </tr>
    </table>
    <p style="text-indent:50px" class="j">
        Pada hari ini ........................ tanggal ........................ bulan ........................ tahun ${TAHUN_TERBILANG} (.........- ........- ${tahun}), kami yang bertandatangan di bawah ini :
    </p>
    <div style="margin:8px 0 8px 16px">
        <div><strong>1.</strong></div>
        <table class="t" style="margin-left:16px">
            <tr><td style="width:160px">Nama</td><td>:</td><td>${PPKOM.nama}</td></tr>
            <tr><td>NIP</td><td>:</td><td>${PPKOM.nip}</td></tr>
            <tr><td>Jabatan</td><td>:</td><td>${PPKOM.jabatan}</td></tr>
            <tr><td>Berkedudukan di</td><td>:</td><td>${PPKOM.alamat}</td></tr>
        </table>
    </div>
    <p style="margin-left:16px">Dengan Kontraktor Pelaksana</p>
    <div style="margin:4px 0 8px 16px">
        <div><strong>2.</strong></div>
        <table class="t" style="margin-left:16px">
            <tr><td style="width:160px">Nama</td><td>:</td><td>${dot(d.penyedia)}</td></tr>
            <tr><td>Jabatan</td><td>:</td><td>Direktur</td></tr>
            <tr><td>Berkedudukan di</td><td>:</td><td>${dot(d.alamatKantor)}</td></tr>
        </table>
    </div>
    <p style="text-indent:50px" class="j">
        Dengan ini telah sepakat mengadakan penelitian dan perhitungan pekerjaan bersama di lapangan antara tim Teknis Pendukung Pejabat Pembuat Komitmen dan Konsultan Pengawas dengan Kontraktor Pelaksana Atas :
    </p>
    <table class="t" style="margin:8px 0 8px 30px">
        <tr><td style="width:210px">Pekerjaan</td><td>:</td><td>${dot(d.namaPaket)}</td></tr>
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
    <p style="text-indent:50px" class="j">Demikian Berita Acara ini dibuat dengan penuh rasa tanggungjawab untuk selanjutnya akan digunakan sebagai dasar bagi penyiapan ${labelText} untuk dipergunakan sebagaimana mestinya.</p>
    ${signBlock(d, sek)}
</div>`;
}

// ============================= SIGNATURE BLOCK (per reference) =============================
// Left: Kontraktor + Konsultan  |  Right: Tim Teknis (Ketua, Sekretaris, Anggota)
// Bottom center: PPKom
function signBlock(d, sek) {
    return `
    <table style="width:100%;border:none;margin-top:16px">
        <tr>
            <td style="border:none;width:44%;vertical-align:top;padding-right:10px">
                <div>&nbsp;</div>
                <div style="margin-top:8px">Kontraktor Pelaksana</div>
                <div>${dot(d.penyedia)}</div>
                <div class="sp"></div>
                <div class="u">${dot(d.namaPemilik)}</div>
                <div>Direktur</div>
                <div style="margin-top:40px">Konsultan Pengawas</div>
                <div>${dot(d.konsultanPengawas)}</div>
                <div class="sp"></div>
                <div class="u">${dot(d.dirKonsultanPengawas)}</div>
                <div>Kepala Cabang</div>
            </td>
            <td style="border:none;width:56%;vertical-align:top;padding-left:10px">
                <div style="text-align:right">Tim Teknis Pendukung Pejabat Pembuat Komitmen</div>
                <table style="margin-top:8px;width:100%;border:none">
                    <tr>
                        <td style="border:none;width:24px;vertical-align:top">1.</td>
                        <td style="border:none;vertical-align:top">
                            <div class="u">${TIM_TEKNIS_KETUA.nama}</div>
                            <div>NIP. ${TIM_TEKNIS_KETUA.nip}</div>
                        </td>
                        <td style="border:none;vertical-align:top;white-space:nowrap">( Ketua )………………</td>
                    </tr>
                </table>
                <table style="margin-top:40px;width:100%;border:none">
                    <tr>
                        <td style="border:none;width:24px;vertical-align:top">2.</td>
                        <td style="border:none;vertical-align:top">
                            <div class="u">${dot(sek?.nama)}</div>
                            <div>NIP. ${dot(sek?.nip)}</div>
                        </td>
                        <td style="border:none;vertical-align:top;white-space:nowrap">(Sekretaris)……………</td>
                    </tr>
                </table>
                <table style="margin-top:40px;width:100%;border:none">
                    <tr>
                        <td style="border:none;width:24px;vertical-align:top">3.</td>
                        <td style="border:none;vertical-align:top">
                            <div class="u">${dot(d.kepsek)}</div>
                            <div>NIP. ${dot(d.nipKs)}</div>
                        </td>
                        <td style="border:none;vertical-align:top;white-space:nowrap">(Anggota)……………..</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <div class="c" style="margin-top:30px">
        <div>Kepala Bidang Sarana dan Prasarana</div>
        <div>Selaku Pejabat Pembuat Komitmen</div>
        <div class="sp"></div>
        <div class="u">${PPKOM.nama}</div>
        <div>NIP. ${PPKOM.nip}</div>
    </div>`;
}
