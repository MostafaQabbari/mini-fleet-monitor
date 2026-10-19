import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { clearToken, getEmail } from '../auth.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [robots, setRobots] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // strict mode runs effects twice in dev; ignore the answer of the discarded run
    let active = true;
    api('/robots')
      .then((data) => active && setRobots(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <header className="topbar">
        <strong>Mini-Fleet Monitor</strong>
        <span className="user">
          <span className="muted">{getEmail()}</span>
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </span>
      </header>

      <main className="content">
        <h2>Robots</h2>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!robots && !error && <p className="muted">Loading…</p>}
        {robots && (
          <ul className="robots">
            {robots.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong> · {r.status} · {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
