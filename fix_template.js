// Fix script: replace docxtemplater block with direct XML replacement
const fs = require('fs');
const f = 'server/src/routes/template.routes.ts';
let text = fs.readFileSync(f, 'utf8');

const oldStart = '        let doc: any;\r\n        try {\r\n            doc = new Docxtemplater(zip, docxOptions);\r\n        } catch (compileErr: any) {';

const newCode = `        // === DIRECT XML REPLACEMENT (bypass docxtemplater to preserve table structure) ===
        let doc: any;
        {
            console.log('[DOCX] Using direct XML replacement to preserve table/border structure');
            const xmlFilesToProcess = ['word/document.xml', ...Object.keys(zip.files).filter(f => /^word\\/(header|footer)\\d*\\.xml$/i.test(f))];
            for (const xf of xmlFilesToProcess) {
                let xfXml = zip.file(xf)?.asText();
                if (!xfXml) continue;
                // Replace {{key}} only inside <w:t> text nodes - never touch XML structure
                xfXml = xfXml.replace(/(<w:t[^>]*>)([^<]*)<\\/w:t>/g, (_m: string, tag: string, txt: string) => {
                    let replaced = txt;
                    for (const [key, val] of Object.entries(vars)) {
                        if (typeof val === 'string' && replaced.includes('{{')) {
                            replaced = replaced.split('{{' + key + '}}').join(val);
                        }
                    }
                    return tag + replaced + '</w:t>';
                });
                zip.file(xf, xfXml);
            }
            doc = { getZip: () => zip, getFullText: () => '', render: () => {} };
            console.log('[DOCX] Direct replacement complete');
        }
        if (false) // Keep old code as dead code for reference
        try {
            doc = new Docxtemplater(zip, docxOptions);
        } catch (compileErr: any) {`;

if (text.includes(oldStart)) {
    text = text.replace(oldStart, newCode);
    fs.writeFileSync(f, text, 'utf8');
    console.log('APPLIED - docxtemplater bypassed');
} else {
    console.log('NOT FOUND');
    const idx = text.indexOf('let doc: any;');
    console.log('let doc at idx:', idx);
    // Show context
    if (idx > 0) console.log('CONTEXT:', JSON.stringify(text.substring(idx, idx + 200)));
}
