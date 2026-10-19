const TOKEN_KEY = 'fleet.token';
const EMAIL_KEY = 'fleet.email';

// localStorage survives page reloads and new tabs. the trade-off is that any script
// running on the page (XSS) can read it; an httpOnly cookie would be safer.

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired(token)) {
    clearToken();
    return null;
  }
  return token;
}

export function setToken(token, email) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function getEmail() {
  return getToken() ? localStorage.getItem(EMAIL_KEY) : null;
}

// only reads exp so the ui doesn't show a session that is already over;
// the signature is checked by the api, not here
function isExpired(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
