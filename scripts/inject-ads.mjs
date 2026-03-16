/**
 * Post-build script: Inject active ad scripts from DB into dist/index.html
 * Runs automatically after `vite build`.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Use pg from server/node_modules
const pg = require(path.resolve('server', 'node_modules', 'pg'));

const distIndex = path.resolve('dist', 'index.html');

async function main() {
    if (!fs.existsSync(distIndex)) {
        console.log('[inject-ads] dist/index.html not found, skipping.');
        return;
    }

    // Load .env from server directory
    const envPath = path.resolve('server', '.env');
    const envVars = {};
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
            const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/);
            if (match) envVars[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
        });
    }

    const dbUrl = envVars.DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log('[inject-ads] No DATABASE_URL found, skipping.');
        return;
    }

    let client;
    try {
        client = new pg.Client({ connectionString: dbUrl });
        await client.connect();

        const result = await client.query(
            `SELECT id, script_code, posisi FROM iklan WHERE aktif = true ORDER BY prioritas DESC`
        );

        if (result.rows.length === 0) {
            console.log('[inject-ads] No active ad scripts found.');
            return;
        }

        let html = fs.readFileSync(distIndex, 'utf-8');

        const headScripts = result.rows
            .filter(s => s.script_code && (s.posisi === 'head' || !s.posisi))
            .map(s => `    <!-- iklan:${s.id} -->\n    ${s.script_code}`)
            .join('\n');

        const bodyScripts = result.rows
            .filter(s => s.script_code && s.posisi === 'body')
            .map(s => `    <!-- iklan:${s.id} -->\n    ${s.script_code}`)
            .join('\n');

        if (headScripts) html = html.replace('</head>', `${headScripts}\n  </head>`);
        if (bodyScripts) html = html.replace('</body>', `${bodyScripts}\n  </body>`);

        fs.writeFileSync(distIndex, html, 'utf-8');
        console.log(`[inject-ads] ✅ Injected ${result.rows.length} ad script(s) into dist/index.html`);
    } catch (err) {
        console.error('[inject-ads] Error:', err.message);
        console.log('[inject-ads] Skipping (build still succeeded).');
    } finally {
        if (client) await client.end().catch(() => {});
    }
}

main();
