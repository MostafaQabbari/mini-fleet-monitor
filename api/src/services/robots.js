import { query } from '../lib/db.js';

export const ROBOT_COLUMNS = 'id, name, status, lat, lon, updated_at';

const MAX_STEP = 0.0005; // degrees, roughly 50 m
const MOVING_CHANCE = 0.7;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// pure so it can be tested without a database; pass your own rand for deterministic tests
export function nextPosition({ lat, lon }, rand = Math.random) {
  if (rand() >= MOVING_CHANCE) return { lat, lon, status: 'idle' };

  // random direction and distance, so a step never exceeds MAX_STEP
  const angle = rand() * 2 * Math.PI;
  const dist = rand() * MAX_STEP;
  return {
    lat: clamp(lat + Math.sin(angle) * dist, -90, 90),
    lon: clamp(lon + Math.cos(angle) * dist, -180, 180),
    status: 'moving',
  };
}

// no cache invalidation here: GET /robots is only the initial snapshot and live
// positions reach clients over the websocket, so a 10 s old list is fine and we
// don't want to drop the cache on every simulator tick
export async function moveRobot(id) {
  const { rows } = await query('SELECT lat, lon FROM robots WHERE id = $1', [id]);
  if (!rows[0]) return null;

  const next = nextPosition(rows[0]);
  const { rows: updated } = await query(
    `UPDATE robots SET lat = $2, lon = $3, status = $4, updated_at = now()
     WHERE id = $1 RETURNING ${ROBOT_COLUMNS}`,
    [id, next.lat, next.lon, next.status],
  );
  return updated[0] ?? null;
}
