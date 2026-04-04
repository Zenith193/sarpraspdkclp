import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { splHistoryService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate } from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const router = Router();

// Generated SPL output directory
const SPL_OUTPUT_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads', '_sistem', 'spl-output');
if (!fs.existsSync(SPL_OUTPUT_DIR)) fs.mkdirSync(SPL_OUTPUT_DIR, { recursive: true });

// List all templates
router.get('/', requireAuth, requireRole('admin', 'verifikator'), async (_req, res) => {
    try { res.json(await templateService.list()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Download original template file
router.get('/download/:id', requireAuth, async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl || !tpl.filePath) return res.status(404).json({ error: 'File not found' });
        if (fs.existsSync(tpl.filePath)) {
            res.download(tpl.filePath, (tpl.nama || 'template') + path.extname(tpl.filePath));
        } else {
            res.status(404).json({ error: 'File not found on disk' });
        }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== DOWNLOAD GENERATED SPL FILE (PDF or DOCX) =====
router.get('/spl-file/:format/:historyId', requireAuth, async (req, res) => {
    try {
        const format = req.params.format as string;
        const historyId = req.params.historyId as string;
        if (!['pdf', 'docx'].includes(format)) return res.status(400).json({ error: 'Format harus pdf atau docx' });

        // Find the file in spl-output directory (support both old spl_ and new naming)
        const files = fs.readdirSync(SPL_OUTPUT_DIR).filter(f => (f.startsWith(`${historyId}_`) || f.startsWith(`spl_${historyId}_`)) && f.endsWith(`.${format}`));
        if (files.length === 0) return res.status(404).json({ error: `File ${(format as string).toUpperCase()} tidak ditemukan` });

        const filePath = path.join(SPL_OUTPUT_DIR, files[0]);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });

        if (format === 'pdf') {
            // Inline for preview
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${files[0]}"`);
        } else {
            // Download DOCX
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
        }
        const buf = fs.readFileSync(filePath);
        res.setHeader('Content-Length', buf.length);
        res.send(buf);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ===== GENERATE: fill DOCX → save both DOCX & PDF → auto-save history → return JSON =====
router.post('/generate/:id', requireAuth, async (req, res) => {
    try {
        const tpl = await templateService.getById(Number(req.params.id));
        if (!tpl) return res.status(404).json({ error: 'Template not found' });
        if (!tpl.filePath) {
            return res.status(404).json({ error: 'Template belum memiliki file DOCX. Silakan upload file DOCX di Manajemen Template.' });
        }
        if (!fs.existsSync(tpl.filePath)) {
            return res.status(404).json({
                error: `File DOCX tidak ditemukan di server (path: ${tpl.filePath}). Silakan upload ulang file DOCX di Manajemen Template.`
            });
        }

        const { item, sekretaris } = req.body;
        if (!item) return res.status(400).json({ error: 'Data matrik diperlukan' });

        // Build variable map
        const refData = await getRefData();
        const vars = buildVariableMap(item, sekretaris || {}, refData);

        // Fill DOCX template with docxtemplater
        const PizZip = (await import('pizzip')).default;
        const Docxtemplater = (await import('docxtemplater')).default;

        const content = fs.readFileSync(tpl.filePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: false,
            delimiters: { start: '{{', end: '}}' },
        });

        doc.render(vars);

        // Post-process: strip empty Word Header sections that cause extra top spacing
        const generatedZip = doc.getZip();
        try {
            // Check each header file; remove if it only has empty paragraphs
            const headerFiles = Object.keys(generatedZip.files).filter(f => /^word\/header\d*\.xml$/i.test(f));
            const emptyHeaders: string[] = [];
            for (const hf of headerFiles) {
                const hxml = generatedZip.file(hf)?.asText() || '';
                // Strip all XML tags and check if any visible text remains
                const textOnly = hxml.replace(/<[^>]+>/g, '').trim();
                if (!textOnly) emptyHeaders.push(hf);
            }
            if (emptyHeaders.length > 0) {
                // Remove empty header files and their references from document.xml
                const docXml = generatedZip.file('word/document.xml')?.asText() || '';
                let cleaned = docXml;
                for (const hf of emptyHeaders) {
                    const basename = hf.replace('word/', '');
                    // Remove headerReference tags pointing to this file
                    const rIdRegex = new RegExp(`<w:headerReference[^>]*r:id="(rId\\d+)"[^>]*/?>`, 'g');
                    const relsXml = generatedZip.file('word/_rels/document.xml.rels')?.asText() || '';
                    // Find rId matching this header file
                    const relMatch = relsXml.match(new RegExp(`Id="(rId\\d+)"[^>]*Target="${basename}"`));
                    if (relMatch) {
                        const rId = relMatch[1];
                        cleaned = cleaned.replace(new RegExp(`<w:headerReference[^>]*r:id="${rId}"[^>]*/?>`, 'g'), '');
                    }
                    generatedZip.remove(hf);
                }
                generatedZip.file('word/document.xml', cleaned);
            }
        } catch (stripErr) {
            console.log('[Template] Header strip skipped:', (stripErr as any).message);
        }

        const filledBuf = generatedZip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        // Create history record first to get the ID
        const userId = (req as any).user?.id;
        const sanitize = (s: string) => (s || '').replace(/[^a-zA-Z0-9 .(),\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const penyediaStr = item.penyedia ? ` (${sanitize(item.penyedia)})` : '';
        const namaFile = `${item.noMatrik || ''}.${sanitize(item.namaPaket || '')}${penyediaStr}`.substring(0, 150);
        const historyRecord = await splHistoryService.create({
            matrikId: item.id,
            templateId: Number(req.params.id),
            namaFile: namaFile,
            createdBy: userId,
        });

        const historyId = historyRecord.id;
        const safeBasename = `${historyId}_${namaFile}`.substring(0, 200);

        // Save DOCX permanently  
        const docxPath = path.join(SPL_OUTPUT_DIR, `${safeBasename}.docx`);
        fs.writeFileSync(docxPath, filledBuf);
        console.log(`[Template] Saved DOCX: ${docxPath}`);

        // Convert DOCX → PDF using LibreOffice
        let hasPdf = false;
        try {
            execSync(`libreoffice --headless --convert-to pdf --outdir "${SPL_OUTPUT_DIR}" "${docxPath}"`, {
                timeout: 30000,
                stdio: 'pipe',
            });
            const pdfPath = path.join(SPL_OUTPUT_DIR, `${safeBasename}.pdf`);
            hasPdf = fs.existsSync(pdfPath);
            if (hasPdf) console.log(`[Template] Saved PDF: ${pdfPath}`);
        } catch (loErr: any) {
            console.error('[Template] LibreOffice conversion failed:', loErr.stderr?.toString()?.substring(0, 200) || loErr.message);
        }

        // Update history with file path
        await splHistoryService.update(historyId, { filePath: docxPath });

        // Return JSON with history info (not blob)
        res.json({
            success: true,
            historyId,
            namaFile,
            hasPdf,
            hasDocx: true,
            pdfUrl: hasPdf ? `/api/template/spl-file/pdf/${historyId}` : null,
            docxUrl: `/api/template/spl-file/docx/${historyId}`,
        });
    } catch (e: any) {
        console.error('[Template Generate]', e);
        if (e.properties && e.properties.errors) {
            const errMessages = e.properties.errors.map((err: any) => `${err.properties?.id}: ${err.message}`).join('; ');
            return res.status(400).json({ error: `Error template: ${errMessages}` });
        }
        res.status(500).json({ error: e.message });
    }
});

// Create template
router.post('/', requireAuth, requireRole('admin'), uploadTemplate.single('file'), async (req, res) => {
    try {
        const data: any = {
            nama: req.body.name || req.body.nama,
            jenisCocok: req.body.type || req.body.jenisCocok,
        };
        if (req.file) {
            data.filePath = req.file.path;
            data.uploadStatus = 'done';
        }
        res.status(201).json(await templateService.create(data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update template
router.put('/:id', requireAuth, requireRole('admin'), uploadTemplate.single('file'), async (req, res) => {
    try {
        const data: any = {};
        if (req.body.name || req.body.nama) data.nama = req.body.name || req.body.nama;
        if (req.body.type || req.body.jenisCocok) data.jenisCocok = req.body.type || req.body.jenisCocok;
        if (req.file) {
            const existing = await templateService.getById(Number(req.params.id));
            if (existing?.filePath && fs.existsSync(existing.filePath)) {
                try { fs.unlinkSync(existing.filePath); } catch {}
            }
            data.filePath = req.file.path;
            data.uploadStatus = 'done';
        }
        res.json(await templateService.update(Number(req.params.id), data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Delete template
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const templateId = Number(req.params.id);
        const tpl = await templateService.getById(templateId);
        if (tpl?.filePath && fs.existsSync(tpl.filePath)) {
            try { fs.unlinkSync(tpl.filePath); } catch {}
        }
        // Nullify references in spl_generated to avoid FK constraint
        const { db: database } = await import('../db/index.js');
        const { splGenerated } = await import('../db/schema/index.js');
        const { eq } = await import('drizzle-orm');
        await database.update(splGenerated).set({ templateId: null }).where(eq(splGenerated.templateId, templateId));
        
        await templateService.delete(templateId);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// ===== VARIABLE MAP =====
const TIM_TEKNIS_KETUA = {
    nama: 'M. TAKHMILUDDIN, ST.MT',
    nip: '19840525 200903 1 005',
};

async function getRefData() {
    const { dasarHukum, satuanKerja, ppkom } = await import('../db/schema/index.js');
    const { db: database } = await import('../db/index.js');
    const dhRows = await database.select().from(dasarHukum).orderBy(dasarHukum.id);
    const skRows = await database.select().from(satuanKerja).limit(1);
    const ppkRows = await database.select().from(ppkom).limit(1);
    return {
        dasarHukumText: dhRows.map(r => r.isi).join('\n'),
        satker: skRows[0] || {},
        ppkomData: ppkRows[0] || {},
    };
}

function fmtRp(v: any) { return v ? Number(v).toLocaleString('id-ID') : '0'; }

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

// Format: "06 April 2026"
function fmtDate(d: any) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return `${String(dt.getDate()).padStart(2, '0')} ${NAMA_BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
}

// Format: "Senin, 06 April 2026"
function fmtHariTanggal(d: any) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return `${NAMA_HARI[dt.getDay()]}, ${String(dt.getDate()).padStart(2, '0')} ${NAMA_BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
}

// Format: "06-04-2026"
function fmtDateDash(d: any) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
}

// Angka ke terbilang Indonesia
function terbilang(n: number): string {
    if (n < 0) return 'minus ' + terbilang(-n);
    if (n === 0) return 'nol';
    const satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
    if (n <= 11) return satuan[n];
    if (n < 20) return satuan[n - 10] + ' belas';
    if (n < 100) return satuan[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + satuan[n % 10] : '');
    if (n < 200) return 'seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 1000) return satuan[Math.floor(n / 100)] + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + terbilang(n % 1000000) : '');
    return terbilang(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + terbilang(n % 1000000000) : '');
}

// Capitalize first letter
function ucFirst(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// Format: "senin tanggal enam bulan April tahun dua ribu dua puluh enam (06-04-2026)"
function fmtTerbilangTanggal(d: any) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const hari = NAMA_HARI[dt.getDay()].toLowerCase();
    const tgl = terbilang(dt.getDate());
    const bln = NAMA_BULAN[dt.getMonth()];
    const thn = terbilang(dt.getFullYear());
    const dash = fmtDateDash(d);
    return `${hari} tanggal ${tgl} bulan ${bln} tahun ${ucFirst(thn)} (${dash})`;
}

// Get individual date parts
function getHari(d: any) { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : NAMA_HARI[dt.getDay()]; }
function getHariLower(d: any) { return getHari(d).toLowerCase(); }
function getTanggalTerbilang(d: any) { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : terbilang(dt.getDate()); }
function getBulan(d: any) { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : NAMA_BULAN[dt.getMonth()]; }
function getTahunTerbilang(d: any) { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : ucFirst(terbilang(dt.getFullYear())); }

function buildVariableMap(item: any, sekretaris: any = {}, refData: any = {}) {
    const d = item;
    const sek = { nama: sekretaris.name || sekretaris.nama || '', nip: sekretaris.nip || '' };
    const tahun = d.tahunAnggaran || new Date().getFullYear();
    const sk = refData.satker || {};
    const ppk = refData.ppkomData || {};

    return {
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
        subKegiatan: d.subKegiatan || '',
        noSubKegiatan: d.noSubKegiatan || '',
        paguAnggaran: fmtRp(d.paguAnggaran),
        paguAnggaranRaw: String(d.paguAnggaran || 0),
        terbilangPaguAnggaran: d.paguAnggaran ? ucFirst(terbilang(Number(d.paguAnggaran))) + ' rupiah' : '',
        paguPaket: fmtRp(d.paguPaket),
        hps: fmtRp(d.hps),
        hpsRaw: String(d.hps || 0),
        terbilangHps: d.hps ? ucFirst(terbilang(Number(d.hps))) + ' rupiah' : '',
        terbilangJangkaWaktu: d.jangkaWaktu ? ucFirst(terbilang(Number(d.jangkaWaktu))) : '',
        noAkta: d.noAkta || '',
        tanggalAkta: fmtDate(d.tanggalAkta),
        namaNotaris: d.namaNotaris || '',
        noDppl: d.noDppl || '',
        tanggalDppl: fmtDate(d.tanggalDppl),
        noBahpl: d.noBahpl || '',
        tanggalBahpl: fmtDate(d.tanggalBahpl),
        kodeLampiran: d.kodeLampiran || d.kodeSirup || '',
        bank: d.bank || '',
        noRekening: d.noRekening || '',
        namaRekening: d.namaRekening || '',
        emailPerusahaan: d.emailPerusahaan || '',

        // ===== TANGGAL MULAI =====
        tanggalMulai: fmtDate(d.tanggalMulai),
        hariTanggalMulai: fmtHariTanggal(d.tanggalMulai),
        terbilangTanggalMulai: fmtTerbilangTanggal(d.tanggalMulai),
        hariMulai: getHari(d.tanggalMulai),
        hariMulaiLower: getHariLower(d.tanggalMulai),
        tglMulaiTerbilang: getTanggalTerbilang(d.tanggalMulai),
        bulanMulai: getBulan(d.tanggalMulai),
        tahunMulaiTerbilang: getTahunTerbilang(d.tanggalMulai),
        tanggalMulaiDash: fmtDateDash(d.tanggalMulai),

        // ===== TANGGAL SELESAI =====
        tanggalSelesai: fmtDate(d.tanggalSelesai),
        hariTanggalSelesai: fmtHariTanggal(d.tanggalSelesai),
        terbilangTanggalSelesai: fmtTerbilangTanggal(d.tanggalSelesai),
        hariSelesai: getHari(d.tanggalSelesai),
        hariSelesaiLower: getHariLower(d.tanggalSelesai),
        tglSelesaiTerbilang: getTanggalTerbilang(d.tanggalSelesai),
        bulanSelesai: getBulan(d.tanggalSelesai),
        tahunSelesaiTerbilang: getTahunTerbilang(d.tanggalSelesai),
        tanggalSelesaiDash: fmtDateDash(d.tanggalSelesai),

        // ===== PCM =====
        noPcm: d.noPcm || '',
        tglPcm: fmtDate(d.tglPcm),
        hariTanggalPcm: fmtHariTanggal(d.tglPcm),
        terbilangTanggalPcm: fmtTerbilangTanggal(d.tglPcm),
        hariPcm: getHari(d.tglPcm),
        hariPcmLower: getHariLower(d.tglPcm),
        tglPcmTerbilang: getTanggalTerbilang(d.tglPcm),
        bulanPcm: getBulan(d.tglPcm),
        tahunPcmTerbilang: getTahunTerbilang(d.tglPcm),
        tglPcmDash: fmtDateDash(d.tglPcm),

        // ===== MC-0% =====
        noMc0: d.noMc0 || '',
        tglMc0: fmtDate(d.tglMc0),
        hariTanggalMc0: fmtHariTanggal(d.tglMc0),
        terbilangTanggalMc0: fmtTerbilangTanggal(d.tglMc0),
        hariMc0: getHari(d.tglMc0),
        hariMc0Lower: getHariLower(d.tglMc0),
        tglMc0Terbilang: getTanggalTerbilang(d.tglMc0),
        bulanMc0: getBulan(d.tglMc0),
        tahunMc0Terbilang: getTahunTerbilang(d.tglMc0),
        tglMc0Dash: fmtDateDash(d.tglMc0),

        // ===== MC-100% =====
        noMc100: d.noMc100 || '',
        tglMc100: fmtDate(d.tglMc100),
        hariTanggalMc100: fmtHariTanggal(d.tglMc100),
        terbilangTanggalMc100: fmtTerbilangTanggal(d.tglMc100),
        hariMc100: getHari(d.tglMc100),
        hariMc100Lower: getHariLower(d.tglMc100),
        tglMc100Terbilang: getTanggalTerbilang(d.tglMc100),
        bulanMc100: getBulan(d.tglMc100),
        tahunMc100Terbilang: getTahunTerbilang(d.tglMc100),
        tglMc100Dash: fmtDateDash(d.tglMc100),

        // ===== OTHER =====
        konsultanPengawas: d.konsultanPengawas || '',
        dirKonsultanPengawas: d.dirKonsultanPengawas || '',
        kepsek: d.kepsek || '',
        nipKs: d.nipKs || '',
        sekretaris: sek.nama,
        nipSekretaris: sek.nip,
        ppkom: ppk.nama || '',
        nipPpkom: ppk.nip || '',
        jabatanPpkom: ppk.jabatan || '',
        alamatPpkom: ppk.alamat || '',
        pangkatPpkom: ppk.pangkat || '',
        telpPpkom: ppk.noTelp || '',
        emailPpkom: ppk.email || '',
        nipSatker: sk.nip || '',
        namaSatker: sk.namaPimpinan || '',
        jabatanSatker: sk.jabatan || '',
        websiteSatker: sk.website || '',
        emailSatker: sk.email || '',
        teleponSatker: sk.telepon || '',
        klpdSatker: sk.klpd || '',
        dasarHukum: refData.dasarHukumText || '',
        ketuaTimTeknis: TIM_TEKNIS_KETUA.nama,
        nipKetuaTimTeknis: TIM_TEKNIS_KETUA.nip,
        tahunTerbilang: ucFirst(terbilang(Number(tahun) || 2026)),

        // ===== SPMK (Surat Perintah Mulai Kerja) =====
        noSpmk: d.noSp || d.noSpmk || '',
        tanggalSpmk: fmtDate(d.tanggalSp || d.tanggalSpmk),
        hariTanggalSpmk: fmtHariTanggal(d.tanggalSp || d.tanggalSpmk),
        terbilangTanggalSpmk: fmtTerbilangTanggal(d.tanggalSp || d.tanggalSpmk),
        hariSpmk: getHari(d.tanggalSp || d.tanggalSpmk),
        hariSpmkLower: getHariLower(d.tanggalSp || d.tanggalSpmk),
        tglSpmkTerbilang: getTanggalTerbilang(d.tanggalSp || d.tanggalSpmk),
        bulanSpmk: getBulan(d.tanggalSp || d.tanggalSpmk),
        tahunSpmkTerbilang: getTahunTerbilang(d.tanggalSp || d.tanggalSpmk),
        tanggalSpmkDash: fmtDateDash(d.tanggalSp || d.tanggalSpmk),
        idPaket: d.idPaket || '',

        // ===== SPK extras =====
        hariTanggalSpk: fmtHariTanggal(d.tanggalMulai),
        terbilangTanggalSpk: fmtTerbilangTanggal(d.tanggalMulai),

        // ===== KOP SEKOLAH =====
        kopSekolah: d.kopSekolah || '',
        kopSekolahAda: d.kopSekolah ? 'Ada' : 'Belum',

        // ===== BAST =====
        noBAST: generateNoBAST(d.noMatrik, d.jenisPengadaan, d.sumberDana, tahun),
        volume: d.volume || '',
        nilaiBAST: fmtRp(d.nilaiBAST),
        nilaiBastRaw: String(d.nilaiBAST || 0),
        terbilangBAST: d.terbilangBAST || (d.nilaiBAST ? ucFirst(terbilang(Number(d.nilaiBAST))) + ' rupiah' : ''),

        // ===== ANAKAN (children) =====
        jumlahAnakan: String((d.children || []).length),
        ...buildChildrenVars(d.children || [], d, tahun),
    };
}

// BAST kode mapping (same as frontend)
const KODE_JENIS_MAP: Record<string, string> = { 'Jasa Konsultansi Perencanaan': 'A1', 'Jasa Konsultansi Pengawasan': 'A2', 'Pekerjaan Konstruksi': 'A3' };
const KODE_BARANG_MAP: Record<string, string> = { 'APBD': 'A4', 'APBD Perubahan': 'A4', 'BANKEU': 'B4', 'DAK': 'D4', 'SG': 'S4', 'Bantuan Pemerintah': 'BP4' };

function generateNoBAST(noMatrik: string, jenis: string, sumber: string, tahun: string | number) {
    if (!noMatrik || !jenis) return '';
    let kode = 'XX';
    if (jenis === 'Pengadaan Barang') { kode = KODE_BARANG_MAP[sumber] || 'X4'; } else { kode = KODE_JENIS_MAP[jenis] || 'XX'; }
    const cleanMatrik = String(noMatrik).replace(/\s/g, '');
    // Anakan: "65.1" → 400.3.13/065.1.n/kode/tahun
    const dotMatch = cleanMatrik.match(/^(\d+)[.,](\d+)$/);
    if (dotMatch) {
        const mainPart = dotMatch[1].padStart(3, '0');
        return `400.3.13/${mainPart}.${dotMatch[2]}.n/${kode}/${tahun}`;
    }
    // Indukan: "63" → 400.3.13/063.n/kode/tahun
    const mainPart = cleanMatrik.padStart(3, '0');
    return `400.3.13/${mainPart}.n/${kode}/${tahun}`;
}

// Build variables for up to 15 children (school data only)
function buildChildrenVars(children: any[], parent: any, tahun: string | number) {
    const vars: Record<string, string> = {};
    const MAX = 15;
    for (let i = 0; i < MAX; i++) {
        const idx = i + 1;
        const c = children[i];
        vars[`anakan${idx}KopSekolah`]    = c?.kopSekolah || '';
        vars[`anakan${idx}Kepsek`]        = c?.kepsek || '';
        vars[`anakan${idx}NipKs`]         = c?.nipKs || '';
        vars[`anakan${idx}Kecamatan`]     = c?.kecamatan || '';
        vars[`anakan${idx}NamaSekolah`]   = c?.namaSekolah || '';
        vars[`anakan${idx}NamaPaket`]     = c?.namaPaket || '';
        vars[`anakan${idx}NoBAST`]        = c ? generateNoBAST(c.noMatrik, c.jenisPengadaan || parent?.jenisPengadaan, c.sumberDana || parent?.sumberDana, tahun) : '';
        vars[`anakan${idx}Volume`]         = c?.volume || '';
        vars[`anakan${idx}NilaiBAST`]      = c?.nilaiKontrak ? fmtRp(c.nilaiKontrak) : '';
        vars[`anakan${idx}NilaiBastRaw`]   = String(c?.nilaiKontrak || 0);
        vars[`anakan${idx}TerbilangBAST`]  = c?.nilaiKontrak ? ucFirst(terbilang(Number(c.nilaiKontrak))) + ' rupiah' : '';
    }

    return vars;
}

