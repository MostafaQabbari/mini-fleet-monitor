import pg from 'pg';
import { config } from '../config.js';
import { logger } from './logger.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// idle clients can emit errors (e.g. db restart) – don't let that crash the process
pool.on('error', (err) => logger.error({ err }, 'Unexpected Postgres pool error'));

export function query(text, params) {
  return pool.query(text, params);
}

// runs fn(client) between BEGIN and COMMIT on a single connection, rolls back if it throws
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
