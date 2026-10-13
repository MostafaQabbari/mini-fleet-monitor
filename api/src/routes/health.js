import { Router } from 'express';
import { pool } from '../lib/db.js';
import { redis } from '../lib/redis.js';

export const healthRouter = Router();

// liveness
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// readiness – dependencies reachable?
healthRouter.get('/ready', async (_req, res) => {
  const [db, cache] = await Promise.allSettled([pool.query('SELECT 1'), redis.ping()]);
  const checks = {
    postgres: db.status === 'fulfilled' ? 'up' : 'down',
    redis: cache.status === 'fulfilled' ? 'up' : 'down',
  };
  const ready = Object.values(checks).every((s) => s === 'up');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded', checks });
});
