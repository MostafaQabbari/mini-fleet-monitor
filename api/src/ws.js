import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './middleware/auth.js';
import { logger } from './lib/logger.js';

const HEARTBEAT_MS = 30_000;
const UNAUTHORIZED = 4401;

let wss;
let heartbeat;

export function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', onConnection);
  heartbeat = setInterval(checkAlive, HEARTBEAT_MS);
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

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('error', (err) => logger.warn({ err: err.message }, 'websocket error'));
  logger.debug({ user: ws.user.id }, 'websocket connected');
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

export function broadcast(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && ws.user) ws.send(data);
  }
}

export function closeWebSocket() {
  clearInterval(heartbeat);
  if (!wss) return;
  // wss.close() leaves existing connections open, which would block server.close()
  for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
  wss.close();
}
