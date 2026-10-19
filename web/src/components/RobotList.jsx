import { useEffect, useRef, useState } from 'react';

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function ago(timestamp, now) {
  // clamped because the server clock can be slightly ahead of the browser's
  const s = Math.max(0, Math.round((now - Date.parse(timestamp)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function RobotList({ robots, selectedId, onSelect }) {
  const now = useNow(1000);
  const listRef = useRef(null);

  // a robot picked on the map may be scrolled out of view in the list
  useEffect(() => {
    listRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (robots.length === 0) return <p className="empty">No robots yet.</p>;

  return (
    <ul className="robot-list" ref={listRef}>
      {robots.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className="robot"
            aria-pressed={r.id === selectedId}
            onClick={() => onSelect(r.id)}
          >
            <span className="robot-head">
              <span className="robot-name">{r.name}</span>
              <span className={`badge badge-${r.status}`}>{r.status}</span>
            </span>
            <span className="robot-meta">
              <span className="coords">
                {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
              </span>
              <span>updated {ago(r.updated_at, now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
