import { API_URL } from './config.js';
import { getToken, clearToken } from './auth.js';

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server');
  }

  const data = await res.json().catch(() => null);

  // only when we sent a token: a 401 from the login form is a wrong password,
  // not an expired session, and should be shown as an error instead
  if (res.status === 401 && token) {
    clearToken();
    // full page load on purpose, it also drops any state from the old session
    window.location.assign('/login');
  }

  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
