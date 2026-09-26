/**
 * Foz Arrows leaderboard: a free backend on a Google Sheet.
 * Setup: see leaderboard/README.md.
 *
 * Endpoints (the web app URL):
 *   GET  ?action=top&id=<playerId>   -> { ok, top: [{name, score, level, me}], me: {rank, score, level}, players }
 *   POST {action:'submit', id, name, score, level} (as text/plain JSON) -> { ok, rank, players }
 *
 * One row per player. Player ids are never sent back to clients, so nobody
 * can post scores under someone else's name.
 */

const SHEET_NAME = 'Scores';
const TOP_N = 50;
const CACHE_SECONDS = 20;
const MIN_SECONDS_BETWEEN_SUBMITS = 3;

// Must match levelConfig() in src/main.js: cube size N for a level.
function levelN_(L) {
  return L === 1 ? 2 : L <= 4 ? 3 : L <= 9 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : L <= 40 ? 7 : 8;
}

// Most points a player could have after clearing levels 1..level-1:
// every arrow at the x5 combo (<= half the cells are arrows) + 3-star bonus.
function maxScore_(level) {
  let total = 0;
  for (let l = 1; l < level; l++) {
    const N = levelN_(l);
    total += 3 * N * N * 50 + 150 + 5 * l;
  }
  return total;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'top') return json_(top_(String(p.id || '')));
    return json_({ ok: true, hello: 'Foz Arrows leaderboard' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'submit') return json_(submit_(body));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function submit_(b) {
  const id = String(b.id || '');
  const name = cleanName_(b.name);
  const score = Math.floor(Number(b.score));
  const level = Math.floor(Number(b.level));
  if (!/^[0-9a-f]{16}$/.test(id)) throw new Error('bad id');
  if (!name) throw new Error('bad name');
  if (!(level >= 1 && level <= 100000)) throw new Error('bad level');
  if (!(score >= 0 && score <= maxScore_(level))) throw new Error('bad score');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const rows = rows_(sh);
    const now = new Date();
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) {
      const r = rows[i];
      if (now - r.updated < MIN_SECONDS_BETWEEN_SUBMITS * 1000) throw new Error('slow down');
      r.name = name;
      r.score = Math.max(r.score, score);
      r.level = Math.max(r.level, level);
      r.updated = now;
      sh.getRange(i + 2, 1, 1, 5).setValues([[r.id, r.name, r.score, r.level, r.updated]]);
    } else {
      rows.push({ id, name, score, level, updated: now });
      sh.appendRow([id, name, score, level, now]);
    }
    CacheService.getScriptCache().remove('rows');
    sort_(rows);
    return { ok: true, rank: rows.findIndex((r) => r.id === id) + 1, players: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function top_(id) {
  const cache = CacheService.getScriptCache();
  let rows;
  const hit = cache.get('rows');
  if (hit) rows = JSON.parse(hit);
  else {
    rows = rows_(sheet_()).map((r) => ({ id: r.id, name: r.name, score: r.score, level: r.level }));
    sort_(rows);
    try {
      cache.put('rows', JSON.stringify(rows), CACHE_SECONDS);
    } catch (e) {
      // Too big to cache (>100KB); just read the sheet each time.
    }
  }
  const top = rows.slice(0, TOP_N).map((r) => ({ name: r.name, score: r.score, level: r.level, me: r.id === id }));
  const i = id ? rows.findIndex((r) => r.id === id) : -1;
  const me = i >= 0 ? { rank: i + 1, score: rows[i].score, level: rows[i].level } : null;
  return { ok: true, top, me, players: rows.length };
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'name', 'score', 'level', 'updated']);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@'); // keep ids and names as plain text
  }
  return sh;
}

function rows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 5).getValues().map((v) => ({
    id: String(v[0]),
    name: String(v[1]),
    score: Number(v[2]) || 0,
    level: Number(v[3]) || 1,
    updated: v[4] instanceof Date ? v[4] : new Date(0),
  }));
}

function sort_(rows) {
  rows.sort((a, b) => b.score - a.score || b.level - a.level);
}

function cleanName_(s) {
  return String(s || '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/^[=+\-@\s]+/, '') // no spreadsheet formulas
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
