const fs = require('fs');
let t = fs.readFileSync('server/src/routes/template.routes.ts', 'utf8');
// Fix 1: double backslashes in regex
t = t.replace("if (/^word\\\\/(header|footer)\\\\d*\\\\.xml$/i.test(fn))", "if (/^word\\/(header|footer)\\d*\\.xml$/i.test(fn))");
// Fix 2: extra closing brace before if(false)
t = t.replace("        }\n        if (false)", "        if (false)");
t = t.replace("        }\r\n        if (false)", "        if (false)");
fs.writeFileSync('server/src/routes/template.routes.ts', t);
console.log('fixed');
