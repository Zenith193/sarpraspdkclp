import { db } from './src/db/index.js';
import { user, sekolah } from './src/db/schema/index.js';
import { eq, ilike } from 'drizzle-orm';

async function run() {
    try {
        console.log("Checking user SD NEGERI GOMBOLHARJO 02 ADIPALA:");
        const users = await db.select().from(user).where(ilike(user.name, '%GOMBOLHARJO%'));
        console.log("Users:", JSON.stringify(users, null, 2));

        console.log("\nChecking sekolah SD NEGERI GOMBOLHARJO 02 ADIPALA:");
        const schools = await db.select().from(sekolah).where(ilike(sekolah.nama, '%GOMBOLHARJO%'));
        console.log("Schools:", JSON.stringify(schools, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

run().catch(console.error);
