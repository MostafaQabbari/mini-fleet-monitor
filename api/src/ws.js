import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './middleware/auth.js';
import { logger } from './lib/logger.js';
import { createRedisClient } from './lib/redis.js';
import { ROBOTS_CHANNEL, SIMULATION_CHANNEL } from './lib/pubsub.js';
import { isRunning } from './services/simulation.js';

const HEARTBEAT_MS = 30_000;
const UNAUTHORIZED = 4401;
// setTimeout fires immediately for delays above this (~24.8 days)
const MAX_TIMEOUT = 2 ** 31 - 1;

let wss;
let heartbeat;
let sub;

export function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', onConnection);
  heartbeat = setInterval(checkAlive, HEARTBEAT_MS);
  subscribe();
}

// a connection in subscriber mode can't run any other command, so it gets its own
// instead of sharing the client used for the cache and simulation state
function subscribe() {
  sub = createRedisClient('fleet-ws-sub');
  sub.on('message', onMessage);
  sub
    .subscribe(ROBOTS_CHANNEL, SIMULATION_CHANNEL)
    .catch((err) => logger.error({ err: err.message }, 'redis subscribe failed'));
}

function onMessage(channel, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.warn({ channel }, 'ignoring malformed pubsub message');
    return;
  }
  broadcast(channel === ROBOTS_CHANNEL ? { type: 'robot', robot: data } : data);
}

// browsers can't send headers on a websocket handshake, so the token comes as ?token=
function onConnection(ws, req) {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  try {
    ws.user = verifyToken(token ?? '');
  } catch {
    ws.close(UNAUTHORIZED, 'Unauthorized');
    return;
  }

  // the token was only checked once, so end the connection when it stops being valid
  if (ws.user.exp) {
    const ms = Math.min(ws.user.exp * 1000 - Date.now(), MAX_TIMEOUT);
    const expiry = setTimeout(() => ws.close(UNAUTHORIZED, 'Token expired'), ms);
    ws.on('close', () => clearTimeout(expiry));
  }

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('error', (err) => logger.warn({ err: err.message }, 'websocket error'));
  logger.debug({ user: ws.user.id }, 'websocket connected');

  sendState(ws);
}

async function sendState(ws) {
  try {
    const running = await isRunning();
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'simulation', running }));
  } catch (err) {
    logger.warn({ err: err.message }, 'could not send simulation state');
  }
}

// a client that didn't answer the last ping is gone (e.g. laptop lid closed)
function checkAlive() {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && ws.user) ws.send(data);
  }
}

export async function closeWebSocket() {
  clearInterval(heartbeat);
  if (!wss) return;
  // wss.close() leaves existing connections open, which would block server.close()
  for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
  wss.close();
  await sub.quit().catch(() => {});
}
