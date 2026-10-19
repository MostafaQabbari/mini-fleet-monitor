import { query } from './lib/db.js';
import { logger } from './lib/logger.js';
import { moveRobot } from './services/robots.js';
import { broadcast } from './ws.js';

const TICK_MS = 2000;

let timer;
let running = false;
let current = Promise.resolve();

export function startSimulator() {
  running = true;
  schedule();
  logger.info({ tickMs: TICK_MS }, 'simulator started');
}

// waits for a tick that is still running, so shutdown doesn't close the pool under it
export async function stopSimulator() {
  running = false;
  clearTimeout(timer);
  await current;
}

// setTimeout instead of setInterval: the next tick is only scheduled once this one
// is done, so a slow database can never make ticks pile up
function schedule() {
  timer = setTimeout(() => {
    current = tick().finally(() => {
      if (running) schedule();
    });
  }, TICK_MS);
}

async function tick() {
  try {
    const { rows } = await query('SELECT id FROM robots ORDER BY id');
    for (const { id } of rows) {
      const robot = await moveRobot(id);
      if (robot) broadcast({ type: 'robot', robot });
    }
  } catch (err) {
    logger.error({ err }, 'simulator tick failed');
  }
}
