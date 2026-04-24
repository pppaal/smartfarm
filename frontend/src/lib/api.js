const TOKEN_KEY = 'smartfarm_token';
const REFRESH_KEY = 'smartfarm_refresh';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); }
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
export function setRefreshToken(t) { localStorage.setItem(REFRESH_KEY, t); }

let refreshInFlight = null;

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) { clearToken(); return false; }
    const data = await res.json();
    setToken(data.token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    return true;
  })();
  const r = await refreshInFlight;
  refreshInFlight = null;
  return r;
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`/api${path}`, { ...options, headers });

  // 401 → refresh 시도 후 1회 재시도 (auth 엔드포인트는 제외)
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) {
      headers.Authorization = `Bearer ${getToken()}`;
      res = await fetch(`/api${path}`, { ...options, headers });
    }
  }

  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/auth')) window.location.href = '/login';
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  // 204 or empty body
  const ct = res.headers.get('content-type') || '';
  if (res.status === 204 || !ct.includes('json')) return null;
  return res.json();
}

export function openSocket(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch {} };
  return ws;
}
