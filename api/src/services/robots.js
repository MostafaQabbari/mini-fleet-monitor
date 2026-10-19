import { transaction } from '../lib/db.js';
import { publish, ROBOTS_CHANNEL } from '../lib/pubsub.js';
import { nextPosition } from './position.js';

export const ROBOT_COLUMNS = 'id, name, status, lat, lon, updated_at';

// no cache invalidation here: GET /robots is only the initial snapshot and live
// positions reach clients over the websocket, so a 10 s old list is fine and we
// don't want to drop the cache on every simulator tick
export async function moveRobot(id) {
  const robot = await transaction(async (client) => {
    // FOR UPDATE locks the row, so a manual move and a simulator tick on the same
    // robot run one after the other instead of both starting from the old position
    const { rows } = await client.query(
      'SELECT lat, lon FROM robots WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return null;

    const next = nextPosition(rows[0]);
    const { rows: updated } = await client.query(
      `UPDATE robots SET lat = $2, lon = $3, status = $4, updated_at = now()
       WHERE id = $1 RETURNING ${ROBOT_COLUMNS}`,
      [id, next.lat, next.lon, next.status],
    );
    await client.query(
      'INSERT INTO robot_positions (robot_id, lat, lon, status) VALUES ($1, $2, $3, $4)',
      [id, next.lat, next.lon, next.status],
    );
    return updated[0];
  });

  // publish after commit, so nobody hears about a move that was rolled back
  if (robot) await publish(ROBOTS_CHANNEL, robot);
  return robot;
}
