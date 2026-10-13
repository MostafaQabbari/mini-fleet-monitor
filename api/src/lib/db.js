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
