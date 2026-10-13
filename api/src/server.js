import http from 'node:http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { pool } from './lib/db.js';
import { redis } from './lib/redis.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'API listening');
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    await Promise.allSettled([pool.end(), redis.quit()]);
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
