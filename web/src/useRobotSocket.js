import { useEffect, useRef, useState } from 'react';
import { WS_URL } from './config.js';
import { clearToken, getToken } from './auth.js';

const MIN_DELAY = 1000;
const MAX_DELAY = 10_000;
const UNAUTHORIZED = 4401;

// status: 'connecting' until the first open, then 'live' or 'reconnecting'
export function useRobotSocket({ onRobot, onSimulation, onReconnect }) {
  const [status, setStatus] = useState('connecting');

  // handlers live in a ref so new callbacks don't tear down the connection
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { onRobot, onSimulation, onReconnect };
  });

  useEffect(() => {
    let ws;
    let timer;
    let attempt = 0;
    let wasOpen = false;
    let stopped = false;

    function connect() {
      const token = getToken();
      if (!token) return logout();

      ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        // the snapshot may have missed updates while we were away
        if (wasOpen) handlers.current.onReconnect?.();
        wasOpen = true;
        attempt = 0;
        setStatus('live');
      };

      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === 'robot') handlers.current.onRobot?.(msg.robot);
        if (msg.type === 'simulation') handlers.current.onSimulation?.(msg.running);
      };

      ws.onclose = (e) => {
        if (stopped) return;
        // bad or expired token: reconnecting would only be rejected again
        if (e.code === UNAUTHORIZED) return logout();

        setStatus('reconnecting');
        const delay = Math.min(MIN_DELAY * 2 ** attempt, MAX_DELAY);
        attempt++;
        timer = setTimeout(connect, delay);
      };
    }

    function logout() {
      clearToken();
      // same as api.js: a full page load also drops the old session's state
      window.location.assign('/login');
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close(1000);
    };
  }, []);

  return status;
}
