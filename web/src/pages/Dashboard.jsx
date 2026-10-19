import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { clearToken, getEmail } from '../auth.js';
import { useRobotSocket } from '../useRobotSocket.js';
import RobotList from '../components/RobotList.jsx';
import RobotMap from '../components/RobotMap.jsx';

const CONNECTION_LABELS = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
};

// GET /robots can be served from a 10 s cache, so a snapshot may be older than what
// the websocket already delivered; keep whichever version of a robot is newer
function merge(robots, updates) {
  let next = robots;
  for (const r of updates) {
    const current = robots[r.id];
    if (current && Date.parse(current.updated_at) > Date.parse(r.updated_at)) continue;
    if (next === robots) next = { ...robots };
    next[r.id] = r;
  }
  return next;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [robots, setRobots] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const loadRobots = useCallback(
    () =>
      api('/robots')
        .then((list) => {
          setRobots((prev) => merge(prev, list));
          setLoaded(true);
        })
        .catch((err) => setError(err.message)),
    [],
  );

  useEffect(() => {
    loadRobots();
    api('/simulation')
      .then((data) => setRunning(data.running))
      .catch((err) => setError(err.message));
  }, [loadRobots]);

  const onRobot = useCallback((robot) => setRobots((prev) => merge(prev, [robot])), []);

  const connection = useRobotSocket({
    onRobot,
    onSimulation: setRunning,
    onReconnect: loadRobots,
  });

  const list = useMemo(() => Object.values(robots).sort((a, b) => a.id - b.id), [robots]);

  async function toggleSimulation() {
    setToggling(true);
    setError('');
    try {
      const data = await api(`/simulation/${running ? 'stop' : 'start'}`, { method: 'POST' });
      setRunning(data.running);
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  }

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Mini-Fleet Monitor
        </div>

        <div className="controls">
          <span className={`connection connection-${connection}`} role="status">
            <span className="dot" aria-hidden="true" />
            {CONNECTION_LABELS[connection]}
          </span>

          <span className="simulation">
            <span className="muted">Simulation</span>
            <span className={`sim-state ${running ? 'on' : 'off'}`}>
              {running === null ? '…' : running ? 'Running' : 'Stopped'}
            </span>
            <button
              type="button"
              className={running ? 'secondary' : ''}
              onClick={toggleSimulation}
              disabled={running === null || toggling}
            >
              {running ? 'Stop' : 'Start'}
            </button>
          </span>

          <span className="user">
            <span className="email" title={getEmail() ?? ''}>
              {getEmail()}
            </span>
            <button type="button" className="ghost" onClick={logout}>
              Log out
            </button>
          </span>
        </div>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
          <button type="button" className="ghost" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <h2>
            Robots <span className="count">{list.length}</span>
          </h2>
          {loaded || list.length > 0 ? (
            <RobotList robots={list} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <p className="empty">Loading…</p>
          )}
        </aside>
        <RobotMap robots={robots} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}
