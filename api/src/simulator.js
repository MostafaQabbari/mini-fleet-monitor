// separate process: node src/simulator.js
// moves every robot each tick; moveRobot publishes the result on redis and the api
// forwards it to its websocket clients. no migrations and no http port here.
import { pool, query } from './lib/db.js';
import { redis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { moveRobot } from './services/robots.js';
import { isRunning } from './services/simulation.js';

const TICK_MS = 2000;

let timer;
let stopping = false;
let current = Promise.resolve();

// setTimeout instead of setInterval: the next tick is only scheduled once this one
// is done, so a slow database can never make ticks pile up
function schedule() {
  timer = setTimeout(() => {
    current = tick().finally(() => {
      if (!stopping) schedule();
    });
  }, TICK_MS);
}

async function tick() {
  try {
    if (!(await isRunning())) return;

    const { rows } = await query('SELECT id FROM robots ORDER BY id');
    for (const { id } of rows) {
      if (stopping) return;
      await moveRobot(id);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'simulator tick failed');
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'simulator stopping');
  clearTimeout(timer);

  // wait for a running tick, so it doesn't lose the pool halfway through a move
  await current;
  await Promise.allSettled([pool.end(), redis.quit()]);
  logger.info('simulator stopped');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

schedule();
logger.info({ tickMs: TICK_MS }, 'simulator started');
