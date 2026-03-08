/**
 * Script to reset all sekolah user passwords to their NPSN.
 * 
 * This script uses Better Auth's internal password hashing (via auth context).
 * Run from the server directory: npx tsx scripts/reset-sekolah-passwords.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

// Better Auth uses Scrypt from @better-auth/utils internally
// The hash format is: $scrypt$n=16384,r=8,p=1$<salt>$<hash>
// But the simplest approach is to use the same hash as used by the signup flow.
// We'll use Node.js built-in scrypt with the exact same parameters Better Auth uses.

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Better Auth default: uses @better-auth/utils which calls Web Crypto scryptSync
// The stored format in DB is a base64-encoded salt:hash string
async function hashPasswordBetterAuth(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    // Format used by better-auth: salt:hash (both hex)
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
            const hashedPassword = await hashPasswordBetterAuth(row.npsn);

            // Update password in the account table (Better Auth stores passwords there)
            const updateResult = await client.query(`
                UPDATE account
                SET password = $1
                WHERE user_id = $2 AND provider_id = 'credential'
            `, [hashedPassword, row.id]);

            if (updateResult.rowCount === 0) {
                console.log(`⚠️  ${row.name} (${row.email}) - No credential account found, skipping`);
            } else {
                console.log(`✅ ${row.name} (${row.email}) → password set to NPSN: ${row.npsn}`);
            }
        }

        console.log(`\nDone! Passwords updated.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
