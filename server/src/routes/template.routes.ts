import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { splHistoryService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate } from '../middleware/upload.js';
import { db } from '../db/index.js';
import { matrikKegiatan } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
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

        // Auto-fetch siblings if nilaiItemsArr is empty but matrikId exists
        if ((!item.nilaiItemsArr || item.nilaiItemsArr.length === 0) && item.id) {
            try {
                // Get the current matrik to find noMatrik
                const currentMatrik = await db.select({
                    noMatrik: matrikKegiatan.noMatrik,
                    rup: matrikKegiatan.rup,
                }).from(matrikKegiatan).where(eq(matrikKegiatan.id, item.id));

                if (currentMatrik[0]) {
                    const noMatrik = currentMatrik[0].noMatrik || '';
                    const baseNo = noMatrik.includes('.') ? noMatrik.split('.')[0] : noMatrik;

                    // Find siblings by noMatrik prefix
                    const allMatrik = await db.select({
                        noMatrik: matrikKegiatan.noMatrik,
                        namaPaket: matrikKegiatan.namaPaket,
                        nilaiKontrak: matrikKegiatan.nilaiKontrak,
                        namaSekolah: matrikKegiatan.namaSekolah,
                        rup: matrikKegiatan.rup,
                    }).from(matrikKegiatan);

                    const siblings = allMatrik.filter((m: any) =>
                        m.noMatrik === baseNo || m.noMatrik.startsWith(baseNo + '.')
                    );

                    if (siblings.length > 1) {
                        // Only include anakan (with dot in noMatrik), exclude indukan
                        const anakan = siblings.filter((s: any) => s.noMatrik.includes('.'));
                        if (anakan.length > 0) {
                            item.nilaiItemsArr = anakan.map((s: any) => ({
                                nama: s.namaPaket || '',
                                nilai: String(s.nilaiKontrak || 0),
                            }));
                        } else {
                            item.nilaiItemsArr = siblings.map((s: any) => ({
                                nama: s.namaPaket || '',
                                nilai: String(s.nilaiKontrak || 0),
                            }));
                        }
                        console.log(`[Generate] Auto-fetched ${siblings.length} siblings (${anakan.length} anakan) for matrik ${baseNo}:`, siblings.map((s: any) => s.noMatrik));
                    } else {
                        // Try by RUP
                        const rup = currentMatrik[0].rup;
                        if (rup) {
                            const rupSiblings = allMatrik.filter((m: any) => m.rup === rup);
                            if (rupSiblings.length > 1) {
                                item.nilaiItemsArr = rupSiblings.map((s: any) => ({
                                    nama: s.namaPaket || '',
                                    nilai: String(s.nilaiKontrak || 0),
                                }));
                                console.log(`[Generate] Auto-fetched ${rupSiblings.length} siblings by RUP ${rup}`);
                            }
                        }
                    }
                }
            } catch (e: any) {
                console.error('[Generate] Auto-fetch siblings error:', e.message);
            }
        }

        console.log('[Generate] nilaiItemsArr:', JSON.stringify(item.nilaiItemsArr), 'children:', JSON.stringify(item.children?.length));
        const vars = buildVariableMap(item, sekretaris || {}, refData) as any;

        // Extract internal data before passing vars to docxtemplater
        const rincianItems = vars._rincianItems || [];
        const rincianTotal = vars._rincianTotal || 0;
        delete vars._rincianItems;
        delete vars._rincianTotal;

        // Extract personil & peralatan data
        const personilItems = vars._personilItems || [];
        const peralatanItems = vars._peralatanItems || [];
        delete vars._personilItems;
        delete vars._peralatanItems;

        console.log('[Generate] rincianKontrak length:', vars.rincianKontrak?.length, 'rincianNama:', vars.rincianNama, 'rincianNilai:', vars.rincianNilai);

        // Fill DOCX template with docxtemplater
        const PizZip = (await import('pizzip')).default;
        const Docxtemplater = (await import('docxtemplater')).default;

        const content = fs.readFileSync(tpl.filePath, 'binary');
        const zip = new PizZip(content);

        // Add table markers as regular variables (post-processed after render)
        if (rincianItems.length > 0) vars.tabelRincian = '__RINCIAN_TABLE__';
        if (personilItems.length > 0) vars.tabelPersonil = '__PERSONIL_TABLE__';
        if (peralatanItems.length > 0) vars.tabelPeralatan = '__PERALATAN_TABLE__';

        const docxOptions: any = {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' },
            nullGetter(part: any) {
                if (!part.module) {
                    console.log('[DOCX] Missing var:', part.value);
                }
                return '';
            },
        };

        // Helper: aggressively clean loop syntax from DOCX XML
        function cleanLoopTags(zipObj: any) {
            let xml = zipObj.file('word/document.xml')?.asText() || '';
            // Remove #tagName and /tagName from inside <w:t> text nodes
            // This handles both intact {{#tag}} and split-across-runs cases
            xml = xml.replace(/(<w:t[^>]*>)([^<]*)<\/w:t>/g, (match: string, openTag: string, text: string) => {
                // Remove loop markers: {{#xxx}} {{/xxx}} and fragments like #xxx /xxx
                let cleaned = text;
                cleaned = cleaned.replace(/\{\{[#\/][^}]*\}\}/g, ''); // full tags
                cleaned = cleaned.replace(/#\w+/g, '');                // fragment: #tagName
                cleaned = cleaned.replace(/\/\w+/g, (m: string) => {   // fragment: /tagName (but not file paths)
                    return /^\/[A-Z]/.test(m) || /^\/[a-z]{1,2}$/.test(m) ? m : ''; // keep short words, remove camelCase tags
                });
                return openTag + cleaned + '</w:t>';
            });
            zipObj.file('word/document.xml', xml);
            console.log('[Template] Cleaned loop tags from XML');
        }

        let doc: any;
        try {
            doc = new Docxtemplater(zip, docxOptions);
        } catch (compileErr: any) {
            if (compileErr.properties?.errors) {
                for (const e of compileErr.properties.errors) {
                    console.error('[DOCX] Template error:', e.properties?.explanation || e.message);
                }
            }
            // Aggressively clean and retry
            console.log('[DOCX] Cleaning loop tags and retrying...');
            const zip2 = new PizZip(content);
            cleanLoopTags(zip2);
            try {
                doc = new Docxtemplater(zip2, docxOptions);
            } catch (compileErr2: any) {
                console.log('[DOCX] Still failing, retry without paragraphLoop...');
                try {
                    const zip3 = new PizZip(content);
                    cleanLoopTags(zip3);
                    doc = new Docxtemplater(zip3, { ...docxOptions, paragraphLoop: false });
                } catch (compileErr3: any) {
                    // LAST RESORT: skip docxtemplater entirely, just do string replacement on XML
                    console.log('[DOCX] All retries failed, using direct XML replacement...');
                    const zip4 = new PizZip(content);
                    cleanLoopTags(zip4);
                    let rawXml = zip4.file('word/document.xml')?.asText() || '';
                    // Simple variable replacement: replace {{varName}} in text nodes
                    for (const [key, val] of Object.entries(vars)) {
                        if (typeof val === 'string') {
                            rawXml = rawXml.replace(new RegExp(key, 'g'), val);
                        }
                    }
                    zip4.file('word/document.xml', rawXml);
                    // Create a fake doc object with getZip() and getFullText()
                    doc = { getZip: () => zip4, getFullText: () => '', render: () => {} };
                }
            }
        }

        // Log all tags found in template
        try {
            const fullText = doc.getFullText();
            const tagRegex = /\{\{[^}]+\}\}/g;
            const foundTags = fullText.match(tagRegex);
            console.log('[DOCX] Tags found in template:', foundTags?.join(', ') || 'NONE');
        } catch (e) { /* ignore */ }

        try { doc.render(vars); } catch (renderErr: any) {
            console.error('[DOCX] Render error (continuing):', renderErr.message);
        }

        // Helper: find correct <w:p> opening (not <w:pPr> etc.) before a marker index
        function findParagraphStart(xml: string, markerPos: number): number {
            let searchPos = markerPos;
            while (searchPos > 0) {
                const pos = xml.lastIndexOf('<w:p', searchPos - 1);
                if (pos === -1) return -1;
                const nextChar = xml[pos + 4];
                if (nextChar === '>' || nextChar === ' ') return pos;
                searchPos = pos;
            }
            return -1;
        }

        // Helper: replace paragraph containing marker with table XML
        // Also extracts font info from the paragraph's run properties
        function extractFontFromParagraph(xml: string, marker: string): { font: string; sz: string } {
            const idx = xml.indexOf(marker);
            if (idx === -1) return { font: '', sz: '' };
            const pStart = findParagraphStart(xml, idx);
            if (pStart === -1) return { font: '', sz: '' };
            const pFragment = xml.substring(pStart, idx);
            // Extract font name from rFonts
            const fontMatch = pFragment.match(/w:ascii="([^"]+)"/);
            // Extract font size from sz
            const szMatch = pFragment.match(/<w:sz\s+w:val="(\d+)"/);
            return {
                font: fontMatch ? fontMatch[1] : '',
                sz: szMatch ? szMatch[1] : '',
            };
        }

        function injectTable(xml: string, marker: string, tableXml: string): string {
            const idx = xml.indexOf(marker);
            if (idx === -1) return xml;
            const pStart = findParagraphStart(xml, idx);
            const pEnd = xml.indexOf('</w:p>', idx);
            if (pStart > -1 && pEnd > -1) {
                return xml.substring(0, pStart) + tableXml + xml.substring(pEnd + '</w:p>'.length);
            }
            return xml;
        }

        // Post-process table injection
        const generatedZip = doc.getZip();
        try {
            let docXml = generatedZip.file('word/document.xml')?.asText() || '';
            let changed = false;

            // Inject rincian table
            if (rincianItems.length > 0 && docXml.includes('__RINCIAN_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__RINCIAN_TABLE__');
                docXml = injectTable(docXml, '__RINCIAN_TABLE__', buildWordTableXml(rincianItems, rincianTotal, fi));
                console.log('[Template] Injected rincian table with', rincianItems.length, 'rows, font:', fi.font || 'inherit', fi.sz || 'inherit');
                changed = true;
            }

            // Inject personil table
            if (personilItems.length > 0 && docXml.includes('__PERSONIL_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__PERSONIL_TABLE__');
                docXml = injectTable(docXml, '__PERSONIL_TABLE__', buildPersonilTableXml(personilItems, fi));
                console.log('[Template] Injected personil table with', personilItems.length, 'rows, font:', fi.font || 'inherit', fi.sz || 'inherit');
                changed = true;
            }

            // Inject peralatan table
            if (peralatanItems.length > 0 && docXml.includes('__PERALATAN_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__PERALATAN_TABLE__');
                docXml = injectTable(docXml, '__PERALATAN_TABLE__', buildPeralatanTableXml(peralatanItems, fi));
                console.log('[Template] Injected peralatan table with', peralatanItems.length, 'rows, font:', fi.font || 'inherit', fi.sz || 'inherit');
                changed = true;
            }

            if (changed) generatedZip.file('word/document.xml', docXml);
        } catch (tblErr: any) {
            console.error('[Template] Table injection error:', tblErr.message);
        }

        // Post-process: strip empty Word Header sections that cause extra top spacing
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
function ucFirst(s: string) {
    if (!s) return '';
    // Ensure only the very first letter is uppercase, rest stays lowercase
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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
        subKegiatan: stripLeadingCode(d.subKegiatan || ''),
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

        // ===== RINCIAN KONTRAK (for anakan/multi-paket) =====
        ...buildRincianVars(d),

        // ===== PERSONIL & PERALATAN =====
        _personilItems: parseJsonSafe(d.timPenugasan),
        _peralatanItems: parseJsonSafe(d.peralatanUtama),
    };
}

function parseJsonSafe(str: any): any[] {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
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

// Build rincian kontrak variables for paket with anakan
// Uses nilaiItemsArr (from ManajemenKontrak) or children (from MatriksKegiatan SPL)
function buildRincianVars(d: any) {
    console.log('[buildRincianVars] nilaiItemsArr:', JSON.stringify(d.nilaiItemsArr), 
        'children:', d.children?.length, 
        'nilaiItemsArr type:', typeof d.nilaiItemsArr, 
        'isArray:', Array.isArray(d.nilaiItemsArr));
    // Priority: nilaiItemsArr (from kontrak generate) > children (from SPL)
    let items: { nama: string; nilai: number }[] = [];

    if (d.nilaiItemsArr && Array.isArray(d.nilaiItemsArr) && d.nilaiItemsArr.length > 0) {
        items = d.nilaiItemsArr.map((it: any) => ({
            nama: it.nama || '',
            nilai: Number(it.nilai) || 0,
        }));
    } else if (d.children && Array.isArray(d.children) && d.children.length > 0) {
        items = d.children.map((c: any) => ({
            nama: c.namaPaket || '',
            nilai: Number(c.nilaiKontrak || c.hps || 0),
        }));
    }

    if (items.length === 0) {
        return {
            rincianKontrak: [],
            lingkupPekerjaan: '',
            totalRincian: fmtRp(d.nilaiKontrak),
            totalRincianRaw: String(d.nilaiKontrak || 0),
            terbilangTotalRincian: d.nilaiKontrak ? ucFirst(terbilang(Number(d.nilaiKontrak))) + ' rupiah' : '',
            jumlahRincian: '0',
            adaRincian: '',
        };
    }

    const total = items.reduce((sum, it) => sum + it.nilai, 0);

    // Helper: format value with Rp. prefix, empty if 0
    const fmtRpFull = (v: number) => v ? 'Rp. ' + fmtRp(v) : '';

    // rincianKontrak: loop array for docxtemplater {{#rincianKontrak}}...{{/rincianKontrak}}
    const rincianKontrak = items.map((it, i) => ({
        no: String(i + 1),
        rincianNama: it.nama,
        nama: it.nama,
        rincianNilai: fmtRpFull(it.nilai),
        nilai: fmtRpFull(it.nilai),
        rincianNilaiRaw: String(it.nilai),
        nilaiRaw: String(it.nilai),
    }));

    // lingkupPekerjaan: numbered list text
    const lingkupPekerjaan = items.map((it, i) => `${i + 1}. ${it.nama}`).join('\n');

    // Top-level rincian variables (first item for non-loop templates)
    const first = items[0] || { nama: '', nilai: 0 };

    // Indexed variables: rincian1Nama, rincian1Nilai, rincian2Nama, rincian2Nilai, etc.
    const indexedVars: Record<string, string> = {};
    items.forEach((it, i) => {
        const idx = i + 1;
        indexedVars[`rincian${idx}Nama`] = it.nama;
        indexedVars[`rincian${idx}Nilai`] = fmtRpFull(it.nilai);
        indexedVars[`rincian${idx}NilaiRaw`] = String(it.nilai);
    });

    // Filter items with actual values for combined text
    const itemsWithValue = items.filter(it => it.nilai > 0);

    // Combined text variables (all items joined with newlines, skip 0 values)
    const rincianNamaAll = itemsWithValue.map((it) => it.nama).join('\n');
    const rincianNilaiAll = itemsWithValue.map((it) => fmtRpFull(it.nilai)).join('\n');

    return {
        rincianKontrak,
        lingkupPekerjaan,
        totalRincian: fmtRp(total),
        totalRincianRaw: String(total),
        terbilangTotalRincian: ucFirst(terbilang(total)) + ' rupiah',
        jumlahRincian: String(items.length),
        adaRincian: 'Ya',
        // Top-level aliases (so {{rincianNama}} works outside loop too)
        rincianNama: first.nama,
        rincianNilai: fmtRpFull(first.nilai),
        rincianNilaiRaw: String(first.nilai),
        // Combined text (all items as newline-separated text)
        rincianNamaAll,
        rincianNilaiAll,
        // Indexed: rincian1Nama, rincian1Nilai, rincian2Nama, etc.
        ...indexedVars,
        // Store items data for pre-processing (extracted before docxtemplater)
        _rincianItems: items,
        _rincianTotal: total,
    };
}


// XML-escape text for OOXML
function xmlEscape(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Strip leading code like "1.01.02.2.01.0051 " from text
function stripLeadingCode(text: string): string {
    if (!text) return '';
    // Match pattern: digits and dots at start, followed by space
    return text.replace(/^[\d.]+\s+/, '');
}

// Format number as Indonesian currency string
function fmtCurrency(v: number): string {
    if (!v) return '';
    const n = Math.abs(Number(v));
    const parts = n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp. ' + parts;
}

// Build a proper Word OOXML table for rincian kontrak
function buildWordTableXml(items: { nama: string; nilai: number }[], total: number, fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
    const SZ = fontInfo.sz || '24'; // default 12pt
    const FONT = fontInfo.font || ''; // inherit from doc if empty

    const tblPr = '<w:tblPr>' +
        '<w:tblStyle w:val="TableGrid"/>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        '<w:tblBorders>' +
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
        '</w:tblBorders>' +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
        '</w:tblPr>';

    // 70% for nama, 30% for nilai
    const tblGrid = '<w:tblGrid><w:gridCol w:w="6300"/><w:gridCol w:w="2700"/></w:tblGrid>';

    function cell(text: string, widthPct: number, opts: { bold?: boolean; center?: boolean; right?: boolean } = {}): string {
        const safe = xmlEscape(text);
        const tcPr = `<w:tcPr><w:tcW w:w="${widthPct}" w:type="pct"/></w:tcPr>`;

        // Run properties: size + optional bold + font from template
        const rPrParts: string[] = [];
        if (FONT) rPrParts.push(`<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>`);
        rPrParts.push(`<w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/>`);
        if (opts.bold) rPrParts.push('<w:b/><w:bCs/>');
        const rPr = '<w:rPr>' + rPrParts.join('') + '</w:rPr>';

        const pPrParts: string[] = [];
        if (opts.center) pPrParts.push('<w:jc w:val="center"/>');
        if (opts.right) pPrParts.push('<w:jc w:val="right"/>');
        pPrParts.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
        pPrParts.push(rPr);
        const pPr = '<w:pPr>' + pPrParts.join('') + '</w:pPr>';

        return '<w:tc>' + tcPr + '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + safe + '</w:t></w:r></w:p></w:tc>';
    }

    const headerRow = '<w:tr>' +
        cell('RINCIAN KONTRAK', 3500, { bold: true, center: true }) +
        cell('NILAI', 1500, { bold: true, center: true }) +
        '</w:tr>';

    const dataRows = items.map(it =>
        '<w:tr>' +
        cell(it.nama, 3500) +
        cell(fmtCurrency(it.nilai), 1500, { right: true }) +
        '</w:tr>'
    ).join('');

    const totalRow = '<w:tr>' +
        cell('TOTAL', 3500, { bold: true, center: true }) +
        cell(fmtCurrency(total), 1500, { bold: true, right: true }) +
        '</w:tr>';

    return '<w:tbl>' + tblPr + tblGrid + headerRow + dataRows + totalRow + '</w:tbl>';
}

// Helper: build a bold title paragraph
function buildTitleParagraph(text: string, font: string, sz: string): string {
    const rPrParts: string[] = [];
    if (font) rPrParts.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`);
    rPrParts.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
    rPrParts.push('<w:b/><w:bCs/>');
    const rPr = '<w:rPr>' + rPrParts.join('') + '</w:rPr>';
    return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/>' + rPr + '</w:pPr>' +
        '<w:r>' + rPr + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r></w:p>';
}

// Helper: build empty paragraph (spacer)
function buildEmptyParagraph(): string {
    return '<w:p><w:pPr><w:spacing w:after="200" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
}

// Standard table borders (visible, 1pt black)
function stdBorders(): string {
    const b = '<w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/>' +
        '<w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/>' +
        '<w:bottom w:val="single" w:sz="12" w:space="0" w:color="000000"/>' +
        '<w:right w:val="single" w:sz="12" w:space="0" w:color="000000"/>' +
        '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>' +
        '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>';
    return '<w:tblBorders>' + b + '</w:tblBorders>';
}

// Build Personil table (Personil Inti yang ditugaskan)
function buildPersonilTableXml(items: any[], fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
    const SZ = fontInfo.sz || '24';
    const FONT = fontInfo.font || '';

    function cell(text: string, widthPct: number, opts: { bold?: boolean; center?: boolean } = {}): string {
        const safe = xmlEscape(text);
        const tcPr = `<w:tcPr><w:tcW w:w="${widthPct}" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>`;
        const rPrParts: string[] = [];
        if (FONT) rPrParts.push(`<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>`);
        rPrParts.push(`<w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/>`);
        if (opts.bold) rPrParts.push('<w:b/><w:bCs/>');
        const rPr = '<w:rPr>' + rPrParts.join('') + '</w:rPr>';
        const pPrParts: string[] = [];
        if (opts.center) pPrParts.push('<w:jc w:val="center"/>');
        pPrParts.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
        pPrParts.push(rPr);
        const pPr = '<w:pPr>' + pPrParts.join('') + '</w:pPr>';
        return '<w:tc>' + tcPr + '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + safe + '</w:t></w:r></w:p></w:tc>';
    }

    const tblPr = '<w:tblPr>' +
        '<w:tblStyle w:val="TableGrid"/>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        stdBorders() +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
        '</w:tblPr>';

    const grid = '<w:tblGrid><w:gridCol w:w="500"/><w:gridCol w:w="3000"/><w:gridCol w:w="2200"/><w:gridCol w:w="3300"/></w:tblGrid>';

    const headerRow = '<w:tr>' +
        cell('No', 280, { bold: true, center: true }) +
        cell('Nama Personel', 1650, { bold: true, center: true }) +
        cell('Posisi', 1220, { bold: true, center: true }) +
        cell('Sertifikat Kompetensi', 1850, { bold: true, center: true }) +
        '</w:tr>';

    const dataRows = items.map((it, i) =>
        '<w:tr>' +
        cell(String(i + 1), 280) +
        cell(it.nama || '', 1650) +
        cell(it.posisi || '', 1220) +
        cell(it.sertifikasi || '', 1850) +
        '</w:tr>'
    ).join('');

    // Table only (title is already in the template)
    return '<w:tbl>' + tblPr + grid + headerRow + dataRows + '</w:tbl>';
}

// Build Peralatan table (Peralatan yang digunakan)
function buildPeralatanTableXml(items: any[], fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
    const SZ = fontInfo.sz || '24';
    const FONT = fontInfo.font || '';

    function cell(text: string, widthPct: number, opts: { bold?: boolean; center?: boolean } = {}): string {
        const safe = xmlEscape(text);
        const tcPr = `<w:tcPr><w:tcW w:w="${widthPct}" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>`;
        const rPrParts: string[] = [];
        if (FONT) rPrParts.push(`<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>`);
        rPrParts.push(`<w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/>`);
        if (opts.bold) rPrParts.push('<w:b/><w:bCs/>');
        const rPr = '<w:rPr>' + rPrParts.join('') + '</w:rPr>';
        const pPrParts: string[] = [];
        if (opts.center) pPrParts.push('<w:jc w:val="center"/>');
        pPrParts.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
        pPrParts.push(rPr);
        const pPr = '<w:pPr>' + pPrParts.join('') + '</w:pPr>';
        return '<w:tc>' + tcPr + '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + safe + '</w:t></w:r></w:p></w:tc>';
    }

    const tblPr = '<w:tblPr>' +
        '<w:tblStyle w:val="TableGrid"/>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        stdBorders() +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
        '</w:tblPr>';

    const grid = '<w:tblGrid><w:gridCol w:w="450"/><w:gridCol w:w="1500"/><w:gridCol w:w="1200"/><w:gridCol w:w="1100"/><w:gridCol w:w="900"/><w:gridCol w:w="1100"/><w:gridCol w:w="1250"/></w:tblGrid>';

    const headerRow = '<w:tr>' +
        cell('No', 300, { bold: true, center: true }) +
        cell('Nama Alat', 1000, { bold: true, center: true }) +
        cell('Merk & Tipe', 800, { bold: true, center: true }) +
        cell('Kapasitas', 730, { bold: true, center: true }) +
        cell('Jumlah', 600, { bold: true, center: true }) +
        cell('Kondisi', 730, { bold: true, center: true }) +
        cell('Status Milik', 840, { bold: true, center: true }) +
        '</w:tr>';

    const dataRows = items.map((it, i) => {
        const merkTipe = [it.merk, it.type].filter(Boolean).join(' ');
        return '<w:tr>' +
            cell(String(i + 1), 300, { center: true }) +
            cell(it.nama || '', 1000) +
            cell(merkTipe, 800, { center: true }) +
            cell(it.kapasitas || '', 730, { center: true }) +
            cell(String(it.jumlah || ''), 600, { center: true }) +
            cell(it.kondisi || '', 730, { center: true }) +
            cell(it.statusKepemilikan || '', 840, { center: true }) +
            '</w:tr>';
    }).join('');

    // Table only (title is already in the template)
    return '<w:tbl>' + tblPr + grid + headerRow + dataRows + '</w:tbl>';
}