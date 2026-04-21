const fs = require('fs');
const f = 'server/src/routes/template.routes.ts';
let t = fs.readFileSync(f, 'utf8');
const old = '        let doc: any;\r\n        try {\r\n            doc = new Docxtemplater(zip, docxOptions);';
const rep = `        let doc: any;
        {
            console.log('[DOCX] Direct XML replacement (preserves tables)');
            for (const xf of ['word/document.xml', ...Object.keys(zip.files).filter(f => /^word\\/(header|footer)\\d*\\.xml$/i.test(f))]) {
                let x = zip.file(xf)?.asText(); if (!x) continue;
                x = x.replace(/(<w:t[^>]*>)([^<]*)<\\/w:t>/g, (_m, tag, txt) => {
                    let r = txt;
                    for (const [k, v] of Object.entries(vars)) {
                        if (typeof v === 'string') r = r.split('{{' + k + '}}').join(v);
                    }
                    return tag + r + '</w:t>';
                });
                zip.file(xf, x);
            }
            doc = { getZip: () => zip, getFullText: () => '', render: () => {} };
        }
        if (false) // dead code
        try {
            doc = new Docxtemplater(zip, docxOptions);`;
if (t.includes(old)) { t = t.replace(old, rep); fs.writeFileSync(f, t); console.log('OK'); } else { console.log('MISS'); }
