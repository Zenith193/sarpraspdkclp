import 'dotenv/config';
import * as schema from './schema/index.js';
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
export type Database = typeof db;
