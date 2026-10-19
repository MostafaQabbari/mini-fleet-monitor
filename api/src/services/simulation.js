import { redis } from '../lib/redis.js';
import { HttpError } from '../lib/errors.js';
import { publish, SIMULATION_CHANNEL } from '../lib/pubsub.js';

const KEY = 'simulation:running';

// fail fast instead of letting ioredis queue the command until redis is back
function ensureRedis() {
  if (redis.status !== 'ready') throw new HttpError(503, 'Simulation state unavailable');
}

// a missing key means running, so a fresh redis starts with a moving fleet
export async function isRunning() {
  ensureRedis();
  return (await redis.get(KEY)) !== 'false';
}

export async function setRunning(running) {
  ensureRedis();
  // SET ... GET returns the old value in the same command, so two requests at once
  // can't both think they changed the state
  const prev = await redis.set(KEY, String(running), 'GET');
  if ((prev !== 'false') !== running) {
    await publish(SIMULATION_CHANNEL, { type: 'simulation', running });
  }
  return running;
}
