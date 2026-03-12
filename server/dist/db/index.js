import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
export const db = drizzle(pool, { schema });
