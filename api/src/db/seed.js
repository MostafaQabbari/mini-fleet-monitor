import bcrypt from 'bcryptjs';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

// a few spots around Leipzig city centre
const robots = [
  ['Patrol-01', 51.3397, 12.3731],
  ['Patrol-02', 51.3431, 12.3812],
  ['Patrol-03', 51.3352, 12.3665],
  ['Patrol-04', 51.3460, 12.3690],
  ['Patrol-05', 51.3375, 12.3850],
];

export async function seed() {
  await seedUser(config.seed.email, config.seed.password);
  await seedRobots();
}

async function seedUser(email, password) {
  const hash = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
    [email.toLowerCase(), hash],
  );
  if (rowCount) logger.info('created demo user %s', email);
}

async function seedRobots() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM robots');

  // only fill an empty table, otherwise deleted robots would come back on every restart
  if (rows[0].n > 0) return;

  for (const [name, lat, lon] of robots) {
    await pool.query(
      'INSERT INTO robots (name, lat, lon) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, lat, lon],
    );
  }
  logger.info('created %d robots', robots.length);
}