import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate } from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const router = Router();

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

// ===== GENERATE: fill DOCX → convert to PDF → return PDF for print preview =====
router.post('/generate/:id', requireAuth, async (req, res) => {
    let tempDocxPath = '';
    let tempPdfPath = '';
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
        const vars = buildVariableMap(item, sekretaris || {});
        console.log('[Template] Variables:', JSON.stringify(vars, null, 2).substring(0, 500));

        // Fill DOCX template with docxtemplater
        const PizZip = (await import('pizzip')).default;
        const Docxtemplater = (await import('docxtemplater')).default;

        const content = fs.readFileSync(tpl.filePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' },
        });

        doc.render(vars);

        const filledBuf = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        // Save filled DOCX to temp file
        const tempDir = path.join(os.tmpdir(), 'spl-generate');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const basename = `SPL_${Date.now()}_${item.noMatrik || 'doc'}`;
        tempDocxPath = path.join(tempDir, `${basename}.docx`);
        fs.writeFileSync(tempDocxPath, filledBuf);

        // Convert DOCX → PDF using LibreOffice
        try {
            execSync(`libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`, {
                timeout: 30000,
                stdio: 'pipe',
            });
        } catch (loErr: any) {
            console.error('[Template] LibreOffice conversion failed:', loErr.stderr?.toString() || loErr.message);
            // Fallback: return the DOCX directly
            const filename = `${basename}.docx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', filledBuf.length);
            return res.send(filledBuf);
        }

        tempPdfPath = path.join(tempDir, `${basename}.pdf`);
        if (!fs.existsSync(tempPdfPath)) {
            // Fallback: return DOCX
            const filename = `${basename}.docx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', filledBuf.length);
            return res.send(filledBuf);
        }

        // Send PDF for print preview
        const pdfBuf = fs.readFileSync(tempPdfPath);
        const pdfFilename = `SPL_${item.noMatrik || ''}_${(item.namaSekolah || 'dokumen').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${pdfFilename}"`);
        res.setHeader('Content-Length', pdfBuf.length);
        res.send(pdfBuf);
    } catch (e: any) {
        console.error('[Template Generate]', e);
        if (e.properties && e.properties.errors) {
            const errMessages = e.properties.errors.map((err: any) => `${err.properties?.id}: ${err.message}`).join('; ');
            return res.status(400).json({ error: `Error template: ${errMessages}` });
        }
        res.status(500).json({ error: e.message });
    } finally {
        // Cleanup temp files
        try { if (tempDocxPath && fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch {}
        try { if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
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
        const tpl = await templateService.getById(Number(req.params.id));
        if (tpl?.filePath && fs.existsSync(tpl.filePath)) {
            try { fs.unlinkSync(tpl.filePath); } catch {}
        }
        await templateService.delete(Number(req.params.id));
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// ===== VARIABLE MAP =====
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

function fmtRp(v: any) { return v ? Number(v).toLocaleString('id-ID') : '0'; }
function fmtDate(d: any) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
}

function buildVariableMap(item: any, sekretaris: any = {}) {
    const d = item;
    const sek = { nama: sekretaris.name || sekretaris.nama || '', nip: sekretaris.nip || '' };
    const tahun = d.tahunAnggaran || new Date().getFullYear();

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
        tanggalMulai: fmtDate(d.tanggalMulai),
        tanggalSelesai: fmtDate(d.tanggalSelesai),
        noPcm: d.noPcm || '',
        tglPcm: fmtDate(d.tglPcm),
        noMc0: d.noMc0 || '',
        tglMc0: fmtDate(d.tglMc0),
        noMc100: d.noMc100 || '',
        tglMc100: fmtDate(d.tglMc100),
        konsultanPengawas: d.konsultanPengawas || '',
        dirKonsultanPengawas: d.dirKonsultanPengawas || '',
        kepsek: d.kepsek || '',
        nipKs: d.nipKs || '',
        sekretaris: sek.nama,
        nipSekretaris: sek.nip,
        ppkom: PPKOM.nama,
        nipPpkom: PPKOM.nip,
        jabatanPpkom: PPKOM.jabatan,
        alamatPpkom: PPKOM.alamat,
        ketuaTimTeknis: TIM_TEKNIS_KETUA.nama,
        nipKetuaTimTeknis: TIM_TEKNIS_KETUA.nip,
        tahunTerbilang: 'Dua Ribu Dua Puluh Enam',
    };
}
