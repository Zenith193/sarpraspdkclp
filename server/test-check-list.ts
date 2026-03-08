import { db } from './src/db/index.js';
import { user } from './src/db/schema/index.js';
import { penggunaService } from './src/services/pengguna.service.js';

async function run() {
    try {
        console.log("=== DB RAW USERS ===");
        const rawUsers = await db.select().from(user).limit(20);
        console.log(`Total raw users in DB: ${rawUsers.length}`);

        console.log("\n=== API response (penggunaService.list) ===");
        const apiResult = await penggunaService.list({ limit: 20 });
        console.log(`Total users returned by API: ${apiResult.data.length}`);
        console.log(JSON.stringify(apiResult.data.slice(0, 3), null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

run().catch(console.error);
