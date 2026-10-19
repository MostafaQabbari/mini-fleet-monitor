import { redis } from './redis.js';
import { logger } from './logger.js';

// the cache is optional: if redis is down these log a warning and behave like a miss,
// so callers fall back to the database instead of failing the request.
// while disconnected ioredis would queue commands until it reconnects (many seconds),
// so we skip redis entirely unless the connection is ready.

async function attempt(op, key, fn) {
  try {
    if (redis.status !== 'ready') throw new Error(`redis not ready (${redis.status})`);
    return await fn();
  } catch (err) {
    logger.warn({ err: err.message, key }, `cache ${op} failed`);
    return null;
  }
}

export async function getJson(key) {
  const value = await attempt('get', key, () => redis.get(key));
  return value === null ? null : JSON.parse(value);
}

export function setJson(key, value, ttlSeconds) {
  return attempt('set', key, () => redis.set(key, JSON.stringify(value), 'EX', ttlSeconds));
}

export function del(key) {
  return attempt('del', key, () => redis.del(key));
}
