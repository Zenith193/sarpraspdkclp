import { Router } from 'express';
import { templateService } from '../services/bast.service.js';
import { splHistoryService } from '../services/matrik.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadTemplate } from '../middleware/upload.js';
import { db } from '../db/index.js';
import { matrikKegiatan, sekolah } from '../db/schema/index.js';
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
        const historyId = Number(req.params.historyId);
        if (!['pdf', 'docx'].includes(format)) return res.status(400).json({ error: 'Format harus pdf atau docx' });
        if (!historyId || isNaN(historyId)) return res.status(400).json({ error: 'Invalid historyId' });

        // Get the history record
        const record = await splHistoryService.getById(historyId);
        if (!record) return res.status(404).json({ error: `Record #${historyId} tidak ditemukan` });

        console.log(`[SPL-DL] id=${historyId} format=${format} filePath=${record.filePath} namaFile=${record.namaFile}`);

        // If filePath contains GDrive path(s), stream from GDrive
        // Format: "gdrive://DOCX_ID" or "gdrive://DOCX_ID|gdrive://PDF_ID"
        if (record.filePath?.includes('gdrive://')) {
            try {
                const { streamFromGDrive, isGDriveEnabled } = await import('../utils/googleDriveClient.js');
                if (isGDriveEnabled()) {
                    const parts = record.filePath.split('|');
                    let targetFileId = '';
                    
                    if (parts.length >= 2 && format === 'pdf') {
                        // Use PDF GDrive ID (second part)
                        targetFileId = parts[1].replace('gdrive://', '');
                    } else {
                        // Use DOCX GDrive ID (first part)
                        targetFileId = parts[0].replace('gdrive://', '');
                    }
                    
                    console.log(`[SPL-DL] Streaming from GDrive: ${targetFileId} (format=${format})`);
                    const gResult = await streamFromGDrive(targetFileId);
                    if (gResult) {
                        const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        const disposition = format === 'pdf' ? 'inline' : 'attachment';
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Content-Disposition', `${disposition}; filename="${(record.namaFile || 'document')}.${format}"`);
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        gResult.stream.pipe(res);
                        return;
                    }
                }
            } catch (gErr: any) {
                console.error(`[SPL-DL] GDrive stream error:`, gErr.message);
            }
        }

        // Local file: the filePath stores the DOCX path
        // For PDF, replace .docx extension with .pdf
        let localFile = record.filePath || '';
        if (format === 'pdf') {
            localFile = localFile.replace(/\.docx$/i, '.pdf');
        }

        // Also try scanning SPL_OUTPUT_DIR by historyId prefix
        if (!localFile || !fs.existsSync(localFile)) {
            try {
                const candidates = fs.readdirSync(SPL_OUTPUT_DIR).filter(
                    f => f.startsWith(`${historyId}_`) && f.endsWith(`.${format}`)
                );
                if (candidates.length > 0) {
                    localFile = path.join(SPL_OUTPUT_DIR, candidates[0]);
                }
            } catch {}
        }

        if (!localFile || !fs.existsSync(localFile)) {
            console.error(`[SPL-DL] File not found: ${localFile}`);
            return res.status(404).json({ error: `File ${format.toUpperCase()} tidak ditemukan di server` });
        }

        const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const disposition = format === 'pdf' ? 'inline' : 'attachment';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `${disposition}; filename="${(record.namaFile || 'document')}.${format}"`);
        const buf = fs.readFileSync(localFile);
        res.setHeader('Content-Length', buf.length);
        res.send(buf);
    } catch (e: any) {
        console.error(`[SPL-DL] Error:`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// ===== GENERATE: fill DOCX Ã¢â€ â€™ save both DOCX & PDF Ã¢â€ â€™ auto-save history Ã¢â€ â€™ return JSON =====
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

        // Always refresh kopSekolah from DB (frontend data may be stale)
        if (item.npsn) {
            try {
                const freshSekolah = await db.select({ kopSekolah: sekolah.kopSekolah, kepsek: sekolah.kepsek, nip: sekolah.nip })
                    .from(sekolah).where(eq(sekolah.npsn, item.npsn)).limit(1);
                if (freshSekolah[0]) {
                    item.kopSekolah = freshSekolah[0].kopSekolah || null;
                    if (!item.kepsek) item.kepsek = freshSekolah[0].kepsek || '';
                    if (!item.nipKs) item.nipKs = freshSekolah[0].nip || '';
                    console.log(`[Generate] Refreshed kopSekolah from DB for NPSN ${item.npsn}:`, item.kopSekolah);
                }
            } catch (e: any) { console.error('[Generate] kopSekolah refresh error:', e.message); }
        }

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

        // Extract uraian singkat data
        const uraianItems: string[] = vars._uraianItems || [];
        delete vars._uraianItems;

        console.log('[Generate] rincianKontrak length:', vars.rincianKontrak?.length, 'rincianNama:', vars.rincianNama, 'rincianNilai:', vars.rincianNilai);

        // Fill DOCX template with docxtemplater
        const PizZip = (await import('pizzip')).default;
        const Docxtemplater = (await import('docxtemplater')).default;

        const content = fs.readFileSync(tpl.filePath, 'binary');
        const zip = new PizZip(content);

        // ===== PRE-PROCESS: Reassemble split {{tag}} per paragraph =====
        // Word splits {{tag}} across runs: <w:t>{</w:t><w:t>{name</w:t><w:t>}}</w:t>
        // We merge ALL text in a paragraph, do replacement, then put it back in first run
        try {
            const ppFiles = ['word/document.xml'];
            for (const fn of Object.keys(zip.files)) {
                if (/^word\/(header|footer)\d*\.xml$/i.test(fn)) ppFiles.push(fn);
            }
            for (const xf of ppFiles) {
                let xml = zip.file(xf)?.asText();
                if (!xml || (!xml.includes('{') && !xml.includes('}'))) continue;
                let changed = false;
                // Process each paragraph: extract all <w:t> text, merge, check for {{...}}
                xml = xml.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, (pXml) => {
                    // Get all text from <w:t> nodes
                    const tNodes = [...pXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
                    if (tNodes.length <= 1) return pXml;
                    const fullText = tNodes.map(m => m[1]).join('');
                    if (!fullText.includes('{{') || !fullText.includes('}}')) return pXml;
                    // Check if tags are already complete in individual nodes
                    const allComplete = tNodes.every(m => {
                        const t = m[1];
                        const opens = (t.match(/\{\{/g) || []).length;
                        const closes = (t.match(/\}\}/g) || []).length;
                        return opens === closes;
                    });
                    if (allComplete) return pXml;
                    // Tags are split - merge all text into first run, clear others
                    changed = true;
                    let result = pXml;
                    // Put full merged text in the FIRST <w:t> node
                    let firstDone = false;
                    result = result.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (m, attrs, txt) => {
                        if (!firstDone) {
                            firstDone = true;
                            return '<w:t xml:space="preserve">' + fullText + '</w:t>';
                        }
                        return '<w:t' + attrs + '></w:t>';
                    });
                    return result;
                });
                if (changed) {
                    zip.file(xf, xml);
                    console.log('[PreProcess] Reassembled split tags in ' + xf);
                }
            }
        } catch (ppErr) {
            console.error('[PreProcess] Tag reassembly error (non-fatal):', ppErr.message);
        }



        // ===== KOP: Normalize tag in template XML =====
        // Ensure kopSekolah tag is clean (not split across runs by Word)
        try {
            let docXmlRaw = zip.file('word/document.xml')?.asText() || '';
            if (docXmlRaw.includes('kopSekolah')) {
                // Remove any % prefix that was accidentally added
                docXmlRaw = docXmlRaw.replace(/\{\{%kopSekolah\}\}/g, '{{kopSekolah}}');
                docXmlRaw = docXmlRaw.replace(/\{%kopSekolah\}/g, '{{kopSekolah}}');
                zip.file('word/document.xml', docXmlRaw);
                console.log('[KOP] Normalized tag to {{kopSekolah}}');
            }
        } catch (e: any) { console.error('[KOP] Tag normalize error:', e.message); }

        // Add table markers as regular variables (post-processed after render)
        // Always set so {{tag}} is cleared even when no data exists
        vars.tabelRincian = rincianItems.length > 0 ? '__RINCIAN_TABLE__' : '';
        const isTender = ((item.metode || item.metodePengadaan || '') + ' ' + (item.jenisPengadaan || '')).toLowerCase().includes('tender');
        console.log('[Template] isTender:', isTender, 'metode:', item.metode, 'metodePengadaan:', item.metodePengadaan);
        vars.tabelPersonil = personilItems.length > 0 ? (isTender ? '__PERSONIL_TENDER_TABLE__' : '__PERSONIL_TABLE__') : '';
        vars.tabelPeralatan = peralatanItems.length > 0 ? (isTender ? '__PERALATAN_TENDER_TABLE__' : '__PERALATAN_TABLE__') : '';
        vars.tabelUraianSingkat = uraianItems.length > 0 ? '__URAIAN_TABLE__' : '';

        // ===== KOP SEKOLAH: Pre-download image =====
        let kopImageBuffer: Buffer | null = null;
        if (item.kopSekolah) {
            try {
                if (item.kopSekolah.startsWith('gdrive://')) {
                    const { streamFromGDrive: streamKop, isGDriveEnabled: isGDE } = await import('../utils/googleDriveClient.js');
                    if (isGDE()) {
                        const fileId = item.kopSekolah.replace('gdrive://', '');
                        const gResult = await streamKop(fileId);
                        if (gResult) {
                            const chunks: Buffer[] = [];
                            await new Promise<void>((resolve, reject) => {
                                gResult.stream.on('data', (c: Buffer) => chunks.push(c));
                                gResult.stream.on('end', resolve);
                                gResult.stream.on('error', reject);
                            });
                            kopImageBuffer = Buffer.concat(chunks);
                        }
                    }
                } else if (fs.existsSync(item.kopSekolah)) {
                    kopImageBuffer = fs.readFileSync(item.kopSekolah);
                }
                if (kopImageBuffer) console.log(`[KOP] Pre-downloaded image: ${kopImageBuffer.length} bytes`);
            } catch (e: any) { console.error('[KOP] Pre-download error:', e.message); }
        }

        // Set kopSekolah as text marker for post-render injection
        vars.kopSekolah = (kopImageBuffer && kopImageBuffer.length > 100) ? '__KOP_IMAGE__' : '';

        const docxOptions: any = {
            paragraphLoop: false,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' },
            nullGetter(part: any) {
                if (!part.module) {
                    console.log('[DOCX] Missing var:', part.value);
                }
                return '';
            },
        };

        // Helper: conservatively clean loop syntax from DOCX XML
        function cleanLoopTags(zipObj: any) {
            let xml = zipObj.file('word/document.xml')?.asText() || '';
            // Only remove complete {{#tag}} and {{/tag}} loop markers
            // Do NOT touch fragments like #word or /word as these destroy real content
            xml = xml.replace(/(<w:t[^>]*>)([^<]*)<\/w:t>/g, (match: string, openTag: string, text: string) => {
                let cleaned = text;
                cleaned = cleaned.replace(/\{\{[#\/][^}]*\}\}/g, ''); // only full {{#tag}} {{/tag}}
                return openTag + cleaned + '</w:t>';
            });
            zipObj.file('word/document.xml', xml);
            console.log('[Template] Cleaned loop tags from XML');
        }

        let doc: any;
        {
            console.log('[DOCX] Direct XML replace (preserves tables)');
            const xmlFiles = ['word/document.xml'];
            for (const fn of Object.keys(zip.files)) {
                if (/^word\/(header|footer)\d*\.xml$/i.test(fn)) xmlFiles.push(fn);
            }
            for (const xf of xmlFiles) {
                let x = zip.file(xf)?.asText();
                if (!x) continue;
                x = x.replace(/(<w:t[^>]*>)([^<]*)<\/w:t>/g, (_m: string, tag: string, txt: string) => {
                    let r = txt;
                    for (const [k, v] of Object.entries(vars)) {
                        if (typeof v === 'string') r = r.split('{{' + k + '}}').join(v as string);
                    }
                    // Handle newlines: split into multiple runs with <w:br/> between them
                    if (r.includes('\n')) {
                        const lines = r.split('\n');
                        // Extract rPr (run properties) from before <w:t> tag for consistent formatting
                        return tag + lines.join('</w:t><w:br/>' + tag) + '</w:t>';
                    }
                    return tag + r + '</w:t>';
                });
                zip.file(xf, x);
            }
            doc = { getZip: () => zip, getFullText: () => '', render: () => {} };
        }
        if (false)
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
                    // LAST RESORT: skip docxtemplater entirely, replace only {{key}} in text nodes
                    console.log('[DOCX] All retries failed, using safe XML replacement...');
                    const zip4 = new PizZip(content);
                    cleanLoopTags(zip4);
                    let rawXml = zip4.file('word/document.xml')?.asText() || '';
                    // SAFE replacement: only replace {{key}} wrapped tags inside <w:t> nodes
                    // Never replace raw key names as they can match XML attributes
                    rawXml = rawXml.replace(/(<w:t[^>]*>)([^<]*)<\/w:t>/g, (_m: string, tag: string, txt: string) => {
                        let replaced = txt;
                        for (const [key, val] of Object.entries(vars)) {
                            if (typeof val === 'string') {
                                replaced = replaced.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
                            }
                        }
                        return tag + replaced + '</w:t>';
                    });
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

            // Inject personil TENDER table
            if (personilItems.length > 0 && docXml.includes('__PERSONIL_TENDER_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__PERSONIL_TENDER_TABLE__');
                docXml = injectTable(docXml, '__PERSONIL_TENDER_TABLE__', buildPersonilTenderTableXml(personilItems, fi));
                console.log('[Template] Injected TENDER personil table with', personilItems.length, 'rows');
                changed = true;
            }

            // Inject peralatan TENDER table
            if (peralatanItems.length > 0 && docXml.includes('__PERALATAN_TENDER_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__PERALATAN_TENDER_TABLE__');
                docXml = injectTable(docXml, '__PERALATAN_TENDER_TABLE__', buildPeralatanTenderTableXml(peralatanItems, fi));
                console.log('[Template] Injected TENDER peralatan table with', peralatanItems.length, 'rows');
                changed = true;
            }

            // Inject uraian singkat table
            if (uraianItems.length > 0 && docXml.includes('__URAIAN_TABLE__')) {
                const fi = extractFontFromParagraph(docXml, '__URAIAN_TABLE__');
                docXml = injectTable(docXml, '__URAIAN_TABLE__', buildUraianTableXml(uraianItems, fi));
                console.log('[Template] Injected uraian table with', uraianItems.length, 'items');
                changed = true;
            }

            if (changed) generatedZip.file('word/document.xml', docXml);
        } catch (tblErr: any) {
            console.error('[Template] Table injection error:', tblErr.message);
        }

        // ===== KOP SEKOLAH IMAGE INJECTION =====
        try {
            let docXml = generatedZip.file('word/document.xml')?.asText() || '';
            const KOP_MARKER = '__KOP_IMAGE__';

            if (docXml.includes(KOP_MARKER) && kopImageBuffer && kopImageBuffer.length > 100) {
                console.log(`[KOP] Found marker, injecting image (${kopImageBuffer.length} bytes)`);
                
                // Validate image magic bytes
                const isPng = kopImageBuffer[0] === 0x89 && kopImageBuffer[1] === 0x50;
                const isJpeg = kopImageBuffer[0] === 0xFF && kopImageBuffer[1] === 0xD8;
                if (!isPng && !isJpeg) {
                    console.log('[KOP] Not a valid PNG/JPEG, skipping');
                    docXml = docXml.replace(new RegExp(KOP_MARKER, 'g'), '');
                    generatedZip.file('word/document.xml', docXml);
                } else {
                    try {
                        // Read image dimensions directly from binary header (no external deps)
                        let imgW = 0, imgH = 0;
                        const buf = kopImageBuffer;
                        
                        if (buf[0] === 0xFF && buf[1] === 0xD8) {
                            // JPEG: find SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
                            let pos = 2;
                            while (pos < buf.length - 8) {
                                if (buf[pos] === 0xFF) {
                                    const marker = buf[pos + 1];
                                    if (marker === 0xC0 || marker === 0xC2) {
                                        // SOF: skip marker(2) + length(2) + precision(1), then height(2) + width(2)
                                        imgH = (buf[pos + 5] << 8) | buf[pos + 6];
                                        imgW = (buf[pos + 7] << 8) | buf[pos + 8];
                                        break;
                                    }
                                    // Skip this segment
                                    const segLen = (buf[pos + 2] << 8) | buf[pos + 3];
                                    pos += 2 + segLen;
                                } else {
                                    pos++;
                                }
                            }
                            console.log(`[KOP] JPEG SOF dimensions: ${imgW}x${imgH}px`);
                        } else if (buf[0] === 0x89 && buf[1] === 0x50) {
                            // PNG: IHDR is at offset 8 (after 8-byte signature), skip length(4)+type(4)
                            imgW = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
                            imgH = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
                            console.log(`[KOP] PNG IHDR dimensions: ${imgW}x${imgH}px`);
                        }
                        
                        // Fallback if parsing failed
                        if (!imgW || !imgH || imgW < 10 || imgH < 10) {
                            imgW = 1950; imgH = 500;
                            console.log(`[KOP] Dimension parse failed, using fallback: ${imgW}x${imgH}px`);
                        }

                        // Read original template margins and calculate kop width
                        const KOP_MARGIN_TW = 1080; // desired kop margin: 0.75in in twips
                        let TARGET_WIDTH_INCHES = 6.77; // default
                        let origMarginL = 1134, origMarginR = 1134; // template defaults
                        try {
                            const pgSzMatch = docXml.match(/w:pgSz\s[^>]*w:w="(\d+)"/);
                            const pgMarMatch = docXml.match(/<w:pgMar[^/]*\/>/); 
                            if (pgMarMatch) {
                                const ml = pgMarMatch[0].match(/w:left="(\d+)"/);
                                const mr = pgMarMatch[0].match(/w:right="(\d+)"/);
                                if (ml) origMarginL = parseInt(ml[1]);
                                if (mr) origMarginR = parseInt(mr[1]);
                            }
                            if (pgSzMatch) {
                                const pgW = parseInt(pgSzMatch[1]);
                                // Kop uses 0.75in margin; extend via negative indent
                                TARGET_WIDTH_INCHES = (pgW - KOP_MARGIN_TW * 2) / 1440;
                                console.log(`[KOP] Page: ${pgW}tw, origMargins L=${origMarginL} R=${origMarginR}, kopWidth=${TARGET_WIDTH_INCHES.toFixed(2)}in`);
                            }
                        } catch {}
                        
                        const targetDPI = Math.round(imgW / TARGET_WIDTH_INCHES);
                        const ratio = imgH / imgW;
                        
                        // EMU (1 inch = 914400 EMU)
                        const emuW = Math.round(TARGET_WIDTH_INCHES * 914400);
                        const emuH = Math.round(emuW * ratio);

                        console.log(`[KOP] Image ${imgW}x${imgH}px, target DPI=${targetDPI} for ${TARGET_WIDTH_INCHES}in width`);

                        // ===== MODIFY DPI IN IMAGE BUFFER =====
                        let finalBuffer = kopImageBuffer;
                        
                        if (isJpeg) {
                            finalBuffer = Buffer.from(kopImageBuffer);
                            let jfifPos = -1;
                            for (let i = 0; i < finalBuffer.length - 10; i++) {
                                if (finalBuffer[i] === 0xFF && finalBuffer[i+1] === 0xE0 &&
                                    finalBuffer[i+4] === 0x4A && finalBuffer[i+5] === 0x46 && 
                                    finalBuffer[i+6] === 0x49 && finalBuffer[i+7] === 0x46) {
                                    jfifPos = i; break;
                                }
                            }
                            if (jfifPos >= 0) {
                                finalBuffer[jfifPos + 9] = 1;
                                finalBuffer[jfifPos + 10] = (targetDPI >> 8) & 0xFF;
                                finalBuffer[jfifPos + 11] = targetDPI & 0xFF;
                                finalBuffer[jfifPos + 12] = (targetDPI >> 8) & 0xFF;
                                finalBuffer[jfifPos + 13] = targetDPI & 0xFF;
                                console.log(`[KOP] JPEG: Modified JFIF DPI to ${targetDPI}`);
                            } else {
                                const jfifSeg = Buffer.alloc(20);
                                jfifSeg[0] = 0xFF; jfifSeg[1] = 0xE0;
                                jfifSeg[2] = 0x00; jfifSeg[3] = 0x10;
                                jfifSeg[4] = 0x4A; jfifSeg[5] = 0x46; jfifSeg[6] = 0x49; jfifSeg[7] = 0x46;
                                jfifSeg[8] = 0x00; jfifSeg[9] = 0x01; jfifSeg[10] = 0x01;
                                jfifSeg[11] = 0x01;
                                jfifSeg[12] = (targetDPI >> 8) & 0xFF; jfifSeg[13] = targetDPI & 0xFF;
                                jfifSeg[14] = (targetDPI >> 8) & 0xFF; jfifSeg[15] = targetDPI & 0xFF;
                                jfifSeg[16] = 0x00; jfifSeg[17] = 0x00;
                                finalBuffer = Buffer.concat([kopImageBuffer.subarray(0, 2), jfifSeg, kopImageBuffer.subarray(2)]);
                                console.log(`[KOP] JPEG: Injected JFIF APP0 with DPI=${targetDPI}`);
                            }
                        } else if (isPng) {
                            // PNG pHYs chunk with inline CRC32
                            const ppuX = Math.round(targetDPI / 0.0254);
                            
                            // Inline CRC32 (no external dependency)
                            const crc32Table: number[] = [];
                            for (let n = 0; n < 256; n++) {
                                let c = n;
                                for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                                crc32Table[n] = c;
                            }
                            const calcCrc32 = (buf: Buffer): number => {
                                let crc = 0xFFFFFFFF;
                                for (let i = 0; i < buf.length; i++) crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
                                return (crc ^ 0xFFFFFFFF) >>> 0;
                            };

                            // pHYs data: type(4) + Xppu(4) + Yppu(4) + unit(1) = 13 bytes
                            const phData = Buffer.alloc(13);
                            phData.write('pHYs', 0);
                            phData.writeUInt32BE(ppuX, 4);
                            phData.writeUInt32BE(ppuX, 8);
                            phData[12] = 1;
                            const crcVal = calcCrc32(phData);
                            
                            // Full chunk: length(4) + data(13) + crc(4) = 21 bytes
                            const phChunk = Buffer.alloc(21);
                            phChunk.writeUInt32BE(9, 0); // data length (excluding type)
                            phData.copy(phChunk, 4);
                            phChunk.writeUInt32BE(crcVal, 17);
                            
                            // Find IDAT
                            let idatPos = -1;
                            for (let i = 8; i < kopImageBuffer.length - 4; i++) {
                                if (kopImageBuffer[i] === 0x49 && kopImageBuffer[i+1] === 0x44 &&
                                    kopImageBuffer[i+2] === 0x41 && kopImageBuffer[i+3] === 0x54) {
                                    idatPos = i - 4; break;
                                }
                            }
                            if (idatPos > 0) {
                                finalBuffer = Buffer.concat([kopImageBuffer.subarray(0, idatPos), phChunk, kopImageBuffer.subarray(idatPos)]);
                                console.log(`[KOP] PNG: Injected pHYs (${ppuX} px/m = ${targetDPI} DPI)`);
                            }
                        }

                        const imgExt = isJpeg ? 'jpeg' : 'png';
                        const imgFilename = `kop_sekolah.${imgExt}`;
                        
                        // Add DPI-modified image to ZIP
                        generatedZip.file(`word/media/${imgFilename}`, finalBuffer);
                        
                        // Content type
                        const ctXml = generatedZip.file('[Content_Types].xml')?.asText() || '';
                        if (!ctXml.includes(`Extension="${imgExt}"`)) {
                            const mime = isJpeg ? 'image/jpeg' : 'image/png';
                            generatedZip.file('[Content_Types].xml', ctXml.replace('</Types>', `<Default Extension="${imgExt}" ContentType="${mime}"/></Types>`));
                        }
                        
                        // Relationship
                        const relsXml = generatedZip.file('word/_rels/document.xml.rels')?.asText() || '';
                        const maxRId = Math.max(...[...relsXml.matchAll(/rId(\d+)/g)].map(m => parseInt(m[1])), 50);
                        const newRId = `rId${maxRId + 1}`;
                        generatedZip.file('word/_rels/document.xml.rels', 
                            relsXml.replace('</Relationships>', `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFilename}"/></Relationships>`));

                        console.log(`[KOP] Image ${imgW}x${imgH}px â†’ ${emuW}x${emuH} EMU (${(emuW/360000).toFixed(1)}x${(emuH/360000).toFixed(1)}cm), rId=${newRId}`);

                        // Build DrawingML XML
                        const imgXml = [
                            `<w:p><w:pPr><w:spacing w:after="0" w:before="0"/><w:ind w:left="-${origMarginL - KOP_MARGIN_TW}" w:right="-${origMarginR - KOP_MARGIN_TW}"/><w:jc w:val="center"/></w:pPr>`,
                            `<w:r><w:drawing>`,
                            `<wp:inline distT="0" distB="0" distL="0" distR="0">`,
                            `<wp:extent cx="${emuW}" cy="${emuH}"/>`,
                            `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
                            `<wp:docPr id="${maxRId + 1}" name="KopSekolah"/>`,
                            `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr>`,
                            `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
                            `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
                            `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
                            `<pic:nvPicPr><pic:cNvPr id="0" name="${imgFilename}"/><pic:cNvPicPr/></pic:nvPicPr>`,
                            `<pic:blipFill>`,
                            `<a:blip r:embed="${newRId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
                            `<a:stretch><a:fillRect/></a:stretch>`,
                            `</pic:blipFill>`,
                            `<pic:spPr>`,
                            `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>`,
                            `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`,
                            `</pic:spPr>`,
                            `</pic:pic></a:graphicData></a:graphic>`,
                            `</wp:inline></w:drawing></w:r></w:p>`,
                        ].join('');

                        // Replace marker
                        const markerIdx = docXml.indexOf(KOP_MARKER);
                        if (markerIdx > -1) {
                            // Check if inside table
                            const before = docXml.substring(0, markerIdx);
                            const inTable = before.lastIndexOf('<w:tc') > before.lastIndexOf('</w:tc>');
                            
                            if (inTable) {
                                // Find table start and inject before it
                                let tblStart = -1;
                                for (let i = markerIdx; i >= 0; i--) {
                                    if (docXml.substring(i, i + 6) === '<w:tbl') { tblStart = i; break; }
                                }
                                if (tblStart > -1) {
                                    docXml = docXml.substring(0, tblStart) + imgXml + docXml.substring(tblStart);
                                    docXml = docXml.replace(new RegExp(KOP_MARKER, 'g'), '');
                                    console.log('[KOP] Injected before table');
                                }
                            } else {
                                // Replace the paragraph containing the marker
                                // MUST match <w:p> or <w:p ... NOT <w:pPr, <w:pBdr, etc
                                let pStart = -1;
                                for (let i = markerIdx; i >= 0; i--) {
                                    if (docXml[i] === '<' && docXml.substring(i, i + 4) === '<w:p' &&
                                        (docXml[i + 4] === '>' || docXml[i + 4] === ' ')) {
                                        pStart = i;
                                        break;
                                    }
                                }
                                const pEnd = docXml.indexOf('</w:p>', markerIdx);
                                if (pStart > -1 && pEnd > -1) {
                                    docXml = docXml.substring(0, pStart) + imgXml + docXml.substring(pEnd + 6);
                                } else {
                                    docXml = docXml.replace(KOP_MARKER, '');
                                }
                                console.log('[KOP] Replaced marker paragraph (pStart=' + pStart + ')');
                            }
                        }
                        // Page margins are NOT modified - kept as template original
                        console.log('[KOP] Page margins kept as template (no modification)');

                        // Ensure root document element has required namespaces for DrawingML
                        const nsMap: Record<string, string> = {
                            'xmlns:wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
                            'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                            'xmlns:pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
                            'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                        };
                        for (const [attr, val] of Object.entries(nsMap)) {
                            if (!docXml.includes(attr + '=')) {
                                docXml = docXml.replace('<w:document ', `<w:document ${attr}="${val}" `);
                            }
                        }
                        
                        generatedZip.file('word/document.xml', docXml);
                        console.log('[KOP] Image injected + namespaces verified');
                    } catch (imgErr: any) {
                        console.error('[KOP] Image inject error:', imgErr.message);
                        docXml = docXml.replace(new RegExp(KOP_MARKER, 'g'), '');
                        generatedZip.file('word/document.xml', docXml);
                    }
                }
            } else if (docXml.includes(KOP_MARKER)) {
                docXml = docXml.replace(new RegExp(KOP_MARKER, 'g'), '');
                generatedZip.file('word/document.xml', docXml);
                console.log('[KOP] No image, cleaned markers');
            }
        } catch (kopErr: any) {
            console.error('[KOP] Error (non-fatal):', kopErr.message);
            try {
                let xml = generatedZip.file('word/document.xml')?.asText() || '';
                xml = xml.replace(/__KOP_IMAGE__/g, '');
                generatedZip.file('word/document.xml', xml);
            } catch {}
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
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

        // Convert DOCX to PDF using LibreOffice
        let hasPdf = false;
        try {
            const loProfile = `/tmp/lo_profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const loCmd = `libreoffice --headless -env:UserInstallation=file://${loProfile} --convert-to pdf --outdir "${SPL_OUTPUT_DIR}" "${docxPath}"`;
            console.log('[Template] LO cmd:', loCmd);
            const loResult = execSync(loCmd, {
                timeout: 60000,
                stdio: 'pipe',
            });
            console.log('[Template] LO stdout:', loResult?.toString()?.substring(0, 300));
            const pdfPath = path.join(SPL_OUTPUT_DIR, `${safeBasename}.pdf`);
            hasPdf = fs.existsSync(pdfPath);
            if (hasPdf) console.log(`[Template] Saved PDF: ${pdfPath}`);
            else {
                console.error('[Template] PDF not found, expected:', pdfPath);
                try {
                    const files = fs.readdirSync(SPL_OUTPUT_DIR).filter((f: string) => f.endsWith('.pdf'));
                    console.log('[Template] PDF files:', files.slice(-5));
                } catch {}
            }
            try { execSync(`rm -rf "${loProfile}"`, { timeout: 5000 }); } catch {}
        } catch (loErr: any) {
            console.error('[Template] LO failed:', loErr.stderr?.toString()?.substring(0, 500) || loErr.message);
            console.error('[Template] LO stdout:', loErr.stdout?.toString()?.substring(0, 300));
        }

        // Update history with file path
        await splHistoryService.update(historyId, { filePath: docxPath });

        // ===== UPLOAD TO GDRIVE (fire-and-forget, non-blocking) =====
        // Files stay local until background queue confirms GDrive sync
        (async () => {
            try {
                const { uploadToGDrive, isGDriveEnabled } = await import('../utils/googleDriveClient.js');
                if (!isGDriveEnabled()) return;
                const tahun = String(item.tahunAnggaran || new Date().getFullYear());
                const sanitizeFolderName = (s: string) => (s || '').replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
                const paketFolder = `${item.noMatrik || ''}. ${sanitizeFolderName(item.namaPaket || '')}`;
                const tplNameLower = (tpl.nama || '').toLowerCase();
                let subFolder = 'SPL';
                if (tplNameLower.includes('bast')) subFolder = 'BAST';
                else if (tplNameLower.includes('kontrak') || tplNameLower.includes('spk')) subFolder = 'Kontrak';
                const gDrivePath = `Kontrak/${tahun}/${paketFolder}/${subFolder}`;
                console.log(`[GDrive] Background uploading to: ${gDrivePath}`);

                const docxResult = await uploadToGDrive(docxPath, gDrivePath, `${safeBasename}.docx`);
                if (docxResult.success) {
                    console.log(`[GDrive] DOCX uploaded: ${docxResult.path}`);
                    // Don't update filePath yet - keep local path so PDF download still works
                    // Background queue (section 10) will update path + cleanup local files
                }
                if (hasPdf) {
                    const pdfLocalPath = path.join(SPL_OUTPUT_DIR, `${safeBasename}.pdf`);
                    if (fs.existsSync(pdfLocalPath)) {
                        const pdfResult = await uploadToGDrive(pdfLocalPath, gDrivePath, `${safeBasename}.pdf`);
                        if (pdfResult.success) console.log(`[GDrive] PDF uploaded: ${pdfResult.path}`);
                    }
                }
            } catch (gErr: any) { console.error('[GDrive] Background upload error:', gErr.message); }
        })();

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
router.post('/', requireAuth, requireRole('admin', 'verifikator'), uploadTemplate.single('file'), async (req, res) => {
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
router.put('/:id', requireAuth, requireRole('admin', 'verifikator'), uploadTemplate.single('file'), async (req, res) => {
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
router.delete('/:id', requireAuth, requireRole('admin', 'verifikator'), async (req, res) => {
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
        kopSekolah: d.kopSekolah ? '__KOP_IMAGE__' : '',
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

        // ===== URAIAN SINGKAT (Lingkup Pekerjaan) =====
        ...buildUraianSingkatVars(d),
    };
}

function parseJsonSafe(str: any): any[] {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
}

// Build uraian singkat (lingkup pekerjaan) variables
function buildUraianSingkatVars(d: any) {
    // Priority: uraianSingkatArr (from generate payload) > uraianSingkat (JSON string from DB)
    let items: string[] = [];
    if (d.uraianSingkatArr && Array.isArray(d.uraianSingkatArr) && d.uraianSingkatArr.length > 0) {
        items = d.uraianSingkatArr.filter((s: any) => typeof s === 'string' && s.trim());
    } else if (d.uraianSingkat) {
        try {
            const parsed = typeof d.uraianSingkat === 'string' ? JSON.parse(d.uraianSingkat) : d.uraianSingkat;
            if (Array.isArray(parsed)) items = parsed.filter((s: any) => typeof s === 'string' && s.trim());
        } catch { /* ignore */ }
    }

    if (items.length === 0) {
        return {
            uraianSingkat: '',
            uraianSingkatList: [],
            jumlahUraian: '0',
        };
    }

    // Numbered text (e.g. "1. Pekerjaan Persiapan\n2. Pekerjaan Tanah\n...")
    const uraianSingkat = items.map((item, i) => `${i + 1}. ${item}`).join('\n');

    // Loop array for docxtemplater: {{#uraianSingkatList}}{{no}}. {{uraian}}{{/uraianSingkatList}}
    const uraianSingkatList = items.map((item, i) => ({
        no: String(i + 1),
        uraian: item,
    }));

    // Indexed variables: uraian1, uraian2, etc.
    const indexedVars: Record<string, string> = {};
    items.forEach((item, i) => {
        indexedVars[`uraian${i + 1}`] = item;
    });

    return {
        uraianSingkat,
        uraianSingkatList,
        jumlahUraian: String(items.length),
        ...indexedVars,
        _uraianItems: items,
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
    // Anakan: "65.1" Ã¢â€ â€™ 400.3.13/065.1.n/kode/tahun
    const dotMatch = cleanMatrik.match(/^(\d+)[.,](\d+)$/);
    if (dotMatch) {
        const mainPart = dotMatch[1].padStart(3, '0');
        return `400.3.13/${mainPart}.${dotMatch[2]}.n/${kode}/${tahun}`;
    }
    // Indukan: "63" Ã¢â€ â€™ 400.3.13/063.n/kode/tahun
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

    const grid = '<w:tblGrid><w:gridCol w:w="700"/><w:gridCol w:w="2900"/><w:gridCol w:w="2100"/><w:gridCol w:w="3300"/></w:tblGrid>';

    const headerRow = '<w:tr>' +
        cell('No', 400, { bold: true, center: true }) +
        cell('Nama Personel', 1600, { bold: true, center: true }) +
        cell('Posisi', 1200, { bold: true, center: true }) +
        cell('Sertifikat Kompetensi', 1800, { bold: true, center: true }) +
        '</w:tr>';

    const dataRows = items.map((it, i) =>
        '<w:tr>' +
        cell(String(i + 1), 400, { center: true }) +
        cell(it.nama || '', 1600) +
        cell(it.posisi || '', 1200) +
        cell(it.sertifikasi || '', 1800) +
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

// Build Personil TENDER table (7 columns, font 10pt)
// Table spans full text area width (left margin to right margin)
function buildPersonilTenderTableXml(items: any[], fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
    const SZ = '20';
    const FONT = fontInfo.font || 'Arial';

    function rpr(opts: { bold?: boolean; sup?: boolean } = {}): string {
        const p: string[] = [];
        if (FONT) p.push('<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:cs="' + FONT + '"/>');
        p.push('<w:sz w:val="' + SZ + '"/><w:szCs w:val="' + SZ + '"/>');
        if (opts.bold) p.push('<w:b/><w:bCs/>');
        if (opts.sup) p.push('<w:vertAlign w:val="superscript"/>');
        return '<w:rPr>' + p.join('') + '</w:rPr>';
    }

    function r(text: string, opts: { bold?: boolean; sup?: boolean } = {}): string {
        return '<w:r>' + rpr(opts) + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r>';
    }

    function tc(runs: string[], w: number, opts: { bold?: boolean; center?: boolean } = {}): string {
        const tcPr = '<w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>';
        const pp: string[] = [];
        if (opts.center) pp.push('<w:jc w:val="center"/>');
        pp.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
        pp.push(rpr({ bold: opts.bold }));
        return '<w:tc>' + tcPr + '<w:p><w:pPr>' + pp.join('') + '</w:pPr>' + runs.join('') + '</w:p></w:tc>';
    }

    // tblInd=0 -> start at left margin, width=9029 -> span to right margin
    const W = 10500;
    const tblPr = '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + W + '" w:type="dxa"/>' +
        '<w:tblInd w:w="-700" w:type="dxa"/>' + stdBorders() +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';

    // Widths in twips (total=9029), proportions from reference full page
    // No=380, Nama=1380, Jabatan=1280, Pendidikan=920, Pengalaman=1100, Sertifikat=2669, Ket=1300
    const C = [500, 1529, 1418, 1050, 1500, 3165, 1338];
    const grid = '<w:tblGrid>' + C.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';

    const hdr = '<w:tr>' +
        tc([r('No', {bold:true})], C[0], {bold:true, center:true}) +
        tc([r('Nama Personel Manajerial', {bold:true})], C[1], {bold:true, center:true}) +
        tc([r('Jabatan dalam Pekerjaan ini', {bold:true}), r('*)', {bold:true, sup:true})], C[2], {bold:true, center:true}) +
        tc([r('Tingkat Pendidikan/ Ijazah', {bold:true})], C[3], {bold:true, center:true}) +
        tc([r('Pengalaman Kerja Profesional (Tahun)', {bold:true}), r('*)', {bold:true, sup:true})], C[4], {bold:true, center:true}) +
        tc([r('Sertifikat Kompetensi Kerja', {bold:true}), r('*)', {bold:true, sup:true})], C[5], {bold:true, center:true}) +
        tc([r('Ket.', {bold:true})], C[6], {bold:true, center:true}) +
        '</w:tr>';

    const rows = items.map((it: any, i: number) =>
        '<w:tr>' +
        tc([r(String(i+1))], C[0], {center:true}) +
        tc([r(it.nama || '')], C[1]) +
        tc([r(it.posisi || '')], C[2]) +
        tc([r(it.pendidikan || '')], C[3], {center:true}) +
        tc([r(it.pengalaman ? it.pengalaman + ' Tahun' : '0 Tahun')], C[4], {center:true}) +
        tc([r(it.sertifikasi || '')], C[5]) +
        tc([r(it.keterangan || 'Masih Berlaku')], C[6]) +
        '</w:tr>'
    ).join('');

    return '<w:tbl>' + tblPr + grid + hdr + rows + '</w:tbl>';
}

// Build Peralatan TENDER table (8 columns, font 10pt)
// Table spans full text area width (left margin to right margin)
function buildPeralatanTenderTableXml(items: any[], fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
    const SZ = '20';
    const FONT = fontInfo.font || 'Arial';

    function rpr(opts: { bold?: boolean; sup?: boolean } = {}): string {
        const p: string[] = [];
        if (FONT) p.push('<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:cs="' + FONT + '"/>');
        p.push('<w:sz w:val="' + SZ + '"/><w:szCs w:val="' + SZ + '"/>');
        if (opts.bold) p.push('<w:b/><w:bCs/>');
        if (opts.sup) p.push('<w:vertAlign w:val="superscript"/>');
        return '<w:rPr>' + p.join('') + '</w:rPr>';
    }

    function r(text: string, opts: { bold?: boolean; sup?: boolean } = {}): string {
        return '<w:r>' + rpr(opts) + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r>';
    }

    function tc(runs: string[], w: number, opts: { bold?: boolean; center?: boolean } = {}): string {
        const tcPr = '<w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>';
        const pp: string[] = [];
        if (opts.center) pp.push('<w:jc w:val="center"/>');
        pp.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
        pp.push(rpr({ bold: opts.bold }));
        return '<w:tc>' + tcPr + '<w:p><w:pPr>' + pp.join('') + '</w:pPr>' + runs.join('') + '</w:p></w:tc>';
    }

    const W = 10500;
    const tblPr = '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + W + '" w:type="dxa"/>' +
        '<w:tblInd w:w="-700" w:type="dxa"/>' + stdBorders() +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';

    // Widths in twips (total=9029), proportions from reference full page
    // No=360, Nama=1280, Merk=1050, Kapasitas=980, Jumlah=870, Kondisi=1050, Status=2039, Ket=1400
    const C = [700, 1500, 1300, 1600, 1100, 1164, 1950, 1186];
    const grid = '<w:tblGrid>' + C.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';

    const hdr = '<w:tr>' +
        tc([r('No', {bold:true})], C[0], {bold:true, center:true}) +
        tc([r('Nama Peralatan Utama', {bold:true}), r('*)', {bold:true, sup:true})], C[1], {bold:true, center:true}) +
        tc([r('Merk dan Tipe', {bold:true}), r('**)', {bold:true, sup:true})], C[2], {bold:true, center:true}) +
        tc([r('Kapasitas', {bold:true}), r('**)', {bold:true, sup:true})], C[3], {bold:true, center:true}) +
        tc([r('Jumlah', {bold:true}), r('**)', {bold:true, sup:true})], C[4], {bold:true, center:true}) +
        tc([r('Kondisi', {bold:true}), r('*)', {bold:true, sup:true})], C[5], {bold:true, center:true}) +
        tc([r('Status Kepemilikan', {bold:true}), r('**)', {bold:true, sup:true})], C[6], {bold:true, center:true}) +
        tc([r('Ket.', {bold:true})], C[7], {bold:true, center:true}) +
        '</w:tr>';

    const rows = items.map((it: any, i: number) => {
        const merk = [it.merk, it.type].filter(Boolean).join(' ');
        return '<w:tr>' +
            tc([r(String(i+1))], C[0], {center:true}) +
            tc([r(it.nama || '')], C[1]) +
            tc([r(merk || '-')], C[2], {center:true}) +
            tc([r(it.kapasitas || '')], C[3], {center:true}) +
            tc([r(String(it.jumlah || '1'))], C[4], {center:true}) +
            tc([r(it.kondisi || 'Baik')], C[5], {center:true}) +
            tc([r(it.statusKepemilikan || '')], C[6], {center:true}) +
            tc([r(it.keterangan || '-')], C[7], {center:true}) +
            '</w:tr>';
    }).join('');

    return '<w:tbl>' + tblPr + grid + hdr + rows + '</w:tbl>';
}

// Build Uraian Singkat table (Lingkup Pekerjaan - numbered list)
function buildUraianTableXml(items: string[], fontInfo: { font: string; sz: string } = { font: '', sz: '' }): string {
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

    const grid = '<w:tblGrid><w:gridCol w:w="600"/><w:gridCol w:w="8400"/></w:tblGrid>';

    const headerRow = '<w:tr>' +
        cell('No', 400, { bold: true, center: true }) +
        cell('Uraian Pekerjaan', 4600, { bold: true, center: true }) +
        '</w:tr>';

    const dataRows = items.map((item, i) => {
        return '<w:tr>' +
            cell(String(i + 1), 400, { center: true }) +
            cell(item, 4600) +
            '</w:tr>';
    }).join('');

    return '<w:tbl>' + tblPr + grid + headerRow + dataRows + '</w:tbl>';
}
