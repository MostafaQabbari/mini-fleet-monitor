import { redis } from './redis.js';
import { logger } from './logger.js';

export const ROBOTS_CHANNEL = 'robots:updates';
export const SIMULATION_CHANNEL = 'simulation:state';

// a lost update is fine (the next tick sends a fresh position), a move that hangs
// until redis reconnects is not, so skip publishing while redis is down
export async function publish(channel, message) {
  try {
    if (redis.status !== 'ready') throw new Error(`redis not ready (${redis.status})`);
    await redis.publish(channel, JSON.stringify(message));
  } catch (err) {
    logger.warn({ err: err.message, channel }, 'publish failed');
  }
}
