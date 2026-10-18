import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const dir = fileURLToPath(new URL('../../migrations', import.meta.url));

// any number works, it just has to be the same in every instance
const LOCK_ID = 727001;

export async function migrate() {
  const client = await pool.connect();

  try {
    // if several api containers start at once only one of them migrates,
    // the others wait here until it's done
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await ensureTable(client);

    const done = await appliedMigrations(client);
    const files = await migrationFiles();

    for (const file of files) {
      if (done.has(file)) continue;
      await apply(client, file);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

function ensureTable(client) {
  return client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

async function migrationFiles() {
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function apply(client, file) {
  const sql = await fs.readFile(path.join(dir, file), 'utf8');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    err.message = `migration ${file} failed: ${err.message}`;
    throw err;
  }

  logger.info('applied migration %s', file);
}