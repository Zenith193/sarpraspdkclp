import { penggunaService } from './src/services/pengguna.service.js';

async function run() {
    try {
        console.log("Fetching users from DB with joined sekolah fields...");
        const result = await penggunaService.list({ limit: 5 });
        console.log(JSON.stringify(result.data, null, 2));
    } catch (e) {
        console.error("Test function error:", e);
    }
}

run().catch(console.error);
