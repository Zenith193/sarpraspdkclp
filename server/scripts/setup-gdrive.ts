// Standalone script to set up Google Drive config directly in the database.
// Run with: npx tsx scripts/setup-gdrive.ts
//
// Usage:
//   npx tsx scripts/setup-gdrive.ts \
//     --clientId "xxx.apps.googleusercontent.com" \
//     --clientSecret "GOCSPX-xxx" \
//     --refreshToken "1//xxx" \
//     --folderId "xxx"

import { db } from '../src/db/index.js';
import { appSettings } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function main() {
    // Parse args
    const args = process.argv.slice(2);
    const getArg = (name: string) => {
        const idx = args.indexOf(`--${name}`);
        return idx >= 0 && args[idx + 1] ? args[idx + 1] : '';
    };

    const config = {
        enabled: true,
        clientId: getArg('clientId'),
        clientSecret: getArg('clientSecret'),
        refreshToken: getArg('refreshToken'),
        folderId: getArg('folderId'),
    };

    if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.folderId) {
        console.error('Usage: npx tsx scripts/setup-gdrive.ts --clientId "..." --clientSecret "..." --refreshToken "..." --folderId "..."');
        process.exit(1);
    }

    console.log('Setting up Google Drive config...');
    console.log('  clientId:', config.clientId.substring(0, 20) + '...');
    console.log('  clientSecret: SET');
    console.log('  refreshToken: SET');
    console.log('  folderId:', config.folderId);

    // Check if exists
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, 'gdrive_config'));

    if (existing.length > 0) {
        await db.update(appSettings)
            .set({ value: config, updatedAt: new Date() })
            .where(eq(appSettings.key, 'gdrive_config'));
        console.log('\n✅ Config UPDATED in database');
    } else {
        await db.insert(appSettings)
            .values({ key: 'gdrive_config', value: config });
        console.log('\n✅ Config INSERTED into database');
    }

    // Verify
    const verify = await db.select().from(appSettings).where(eq(appSettings.key, 'gdrive_config'));
    console.log('\nVerification:', JSON.stringify(verify[0]?.value, null, 2));

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
