import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

export function createRedisClient(name) {
  const client = new Redis(config.redisUrl, {
    connectionName: name,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
  client.on('error', (err) => logger.warn({ err: err.message, name }, 'Redis error'));
  return client;
}

export const redis = createRedisClient('fleet-api');
