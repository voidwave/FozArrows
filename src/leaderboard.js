// Global leaderboard backed by a Google Sheet + Apps Script web app
// (see leaderboard/README.md). The web app URL lives in index.html:
//   <meta name="leaderboard-url" content="https://script.google.com/macros/s/.../exec">
// so it can be changed without rebuilding. Empty = leaderboard hidden.

export const LEADERBOARD_URL = (document.querySelector('meta[name="leaderboard-url"]')?.content || '').trim();
export const leaderboardEnabled = !!LEADERBOARD_URL;

export function cleanName(s) {
  return String(s || '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/^[=+\-@\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

export function newPlayerId() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function call(req, timeout = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(LEADERBOARD_URL + (req.query || ''), {
      method: req.body ? 'POST' : 'GET',
      // text/plain keeps this a "simple" CORS request (no preflight), which Apps Script requires.
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: ctl.signal,
      redirect: 'follow',
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'failed');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends the player's best total. Resolves to { rank, players }. */
export function submitScore({ id, name, score, level }) {
  return call({ body: { action: 'submit', id, name, score, level } });
}

/** Resolves to { top: [{name, score, level}], me: {rank, score} | null, players }. */
export function fetchTop(id) {
  return call({ query: '?action=top&id=' + encodeURIComponent(id || '') });
}
