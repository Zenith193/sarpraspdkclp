/**
 * Script to reset all sekolah user passwords to their NPSN.
 * Run from the server directory: npx tsx scripts/reset-sekolah-passwords.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { scryptSync, randomBytes } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Better Auth uses scrypt hashing by default
async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

async function main() {
    const client = await pool.connect();
    try {
        // Get all sekolah users with their linked school NPSN
        const result = await client.query(`
            SELECT u.id, u.name, u.email, s.npsn
            FROM "user" u
            JOIN sekolah s ON u.sekolah_id = s.id
            WHERE u.role = 'sekolah'
        `);

        console.log(`Found ${result.rows.length} sekolah users to update\n`);

        for (const row of result.rows) {
            const hashedPassword = await hashPassword(row.npsn);

            // Update password in the account table (Better Auth stores passwords there)
            await client.query(`
                UPDATE account
                SET password = $1
                WHERE user_id = $2 AND provider_id = 'credential'
            `, [hashedPassword, row.id]);

            console.log(`✅ ${row.name} (${row.email}) → password set to NPSN: ${row.npsn}`);
        }

        console.log(`\nDone! ${result.rows.length} passwords updated.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
