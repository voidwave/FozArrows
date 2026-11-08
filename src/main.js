import { generate, blockersOf } from './grid.js';
import { levelConfig, levelMax } from './levels.js';
import { Path } from './path.js';
import { sfx, audio, unlockAudio } from './audio.js';
import { leaderboardEnabled, submitScore, fetchTop, cleanName, newPlayerId } from './leaderboard.js';
import { t, fmt, fmtPlain, fmtTime, setLang, detectLang, lang } from './i18n.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- persistence
const SAVE_KEY = 'fozarrows.v1';
const save = {
  level: 1, score: 0, best: null, hints: 3, stars: {}, sound: true, vibe: true, dark: false,
  pid: '', name: '', lang: '', palette: 'classic', daily: null, ach: null,
};
try {
  Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
} catch {}
// Score = sum of the best result on each level, so replays can't farm points.
if (!save.best) save.best = {};
if (!save.pid) save.pid = newPlayerId();
if (!save.daily) save.daily = { last: '', streak: 0, done: {} };
if (!save.ach) save.ach = {};
const bestTotal = () => Object.values(save.best).reduce((a, b) => a + b, 0);
const starTotal = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
save.score = bestTotal();
const persist = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {}
};
audio.enabled = save.sound;
const vibrate = (p) => save.vibe && navigator.vibrate && navigator.vibrate(p);
setLang(detectLang(save.lang));

// ---------------------------------------------------------------- daily challenge
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterdayKey = () => dayKey(new Date(Date.now() - 864e5));
function dailyConfig() {
  let h = 2166136261;
  for (const c of dayKey()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return { W: 12, H: 19, seed: h >>> 0, minLen: 3, maxLen: 10, turnP: 0.5, spread: 0.2 };
}
const currentStreak = () => {
  const d = save.daily;
  return d.last === dayKey() || d.last === yesterdayKey() ? d.streak : 0;
};

// ---------------------------------------------------------------- colours
const PALETTES = [
  { id: 'classic', stars: 0, light: '#b08d4a', dark: '#d9bb7a' },
  { id: 'ink', stars: 10, light: '#3a2620', dark: '#f3ebdf' },
  { id: 'ocean', stars: 25, light: '#1f6fb2', dark: '#7cc0ff' },
  { id: 'rose', stars: 45, light: '#c2255c', dark: '#ff8fb8' },
  { id: 'forest', stars: 70, light: '#2f7d3f', dark: '#7ed68f' },
  { id: 'violet', stars: 100, light: '#6d3fd1', dark: '#b79cff' },
  { id: 'sunset', stars: 140, light: '#d9480f', dark: '#ffa94d' },
];
const COLORS = { moving: '#f0b060', hint: '#5fbf6a', badge: '#1e5b35', error: '#e5484d' };
const paletteOf = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
function arrowColor() {
  const p = paletteOf(save.palette);
  const ok = starTotal() >= p.stars ? p : PALETTES[0];
  return save.dark ? ok.dark : ok.light;
}

// ---------------------------------------------------------------- canvas & view
const stage = $('stage');
const canvas = document.createElement('canvas');
stage.appendChild(canvas);
const ctx = canvas.getContext('2d');
let dpr = 1;
let cw = 0;
let ch = 0;
const view = { zoom: 1, panX: 0, panY: 0, scale: 1, ox: 0, oy: 0, area: { x: 0, y: 0, w: 1, h: 1 } };
let dirty = true;
let game = null;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  cw = stage.clientWidth;
  ch = stage.clientHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  const top = $('statusRow').getBoundingClientRect().bottom + 6;
  const bottom = $('bottomBar').getBoundingClientRect().top - 10;
  view.area = { x: 14, y: top, w: Math.max(50, cw - 28), h: Math.max(50, bottom - top) };
  layout();
}
window.addEventListener('resize', resize);

const baseScale = () => (game ? Math.min(view.area.w / game.W, view.area.h / game.H) : 1);
const maxZoom = () => Math.max(1, 46 / baseScale());

function layout() {
  if (!game) return;
  view.scale = baseScale() * view.zoom;
  const bw = game.W * view.scale;
  const bh = game.H * view.scale;
  const mx = Math.max(0, (bw - view.area.w) / 2 + 30);
  const my = Math.max(0, (bh - view.area.h) / 2 + 30);
  view.panX = Math.max(-mx, Math.min(mx, view.panX));
  view.panY = Math.max(-my, Math.min(my, view.panY));
  view.ox = view.area.x + (view.area.w - bw) / 2 + view.panX;
  view.oy = view.area.y + (view.area.h - bh) / 2 + view.panY;
  dirty = true;
}

const toGrid = (px, py) => [(px - view.ox) / view.scale, (py - view.oy) / view.scale];
const toScreen = (gx, gy) => [view.ox + gx * view.scale, view.oy + gy * view.scale];

/** Zoom to `z`, keeping the board point under (px, py) where it is. */
function zoomAt(px, py, z) {
  const [gx, gy] = toGrid(px, py);
  view.zoom = Math.max(1, Math.min(maxZoom(), z));
  view.panX = view.panY = 0;
  layout();
  view.panX = px - (view.ox + gx * view.scale);
  view.panY = py - (view.oy + gy * view.scale);
  layout();
}

// ---------------------------------------------------------------- drawing
const LINE = 0.15;
const HEAD_L = 0.42;
const HEAD_W = 0.27;

function strokePts(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function drawArrow(a, color, width = LINE, head = 1) {
  const p = a.path;
  // Keep lines and heads a comfortable size in pixels on very large cells.
  width = Math.min(width, (width / LINE) * 6 / view.scale);
  head *= Math.min(1, 44 / view.scale);
  const end = a.s + p.bodyLen;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  strokePts(p.window(a.s, end - HEAD_L * 0.4 * head));
  const [hx, hy] = p.at(end);
  const [dx, dy] = p.dir;
  const tip = [hx + dx * HEAD_L * 0.55 * head, hy + dy * HEAD_L * 0.55 * head];
  const bx = hx - dx * HEAD_L * 0.45 * head;
  const by = hy - dy * HEAD_L * 0.45 * head;
  const w = HEAD_W * head;
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(bx - dy * w, by + dx * w);
  ctx.lineTo(bx + dy * w, by - dx * w);
  ctx.closePath();
  ctx.fill();
}

function drawBadge(a, n) {
  const [x, y] = a.path.at(a.s);
  const r = 0.24 * Math.min(1, 50 / view.scale);
  ctx.fillStyle = COLORS.badge;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - r, y - r, r * 2, r * 2, 0.07);
  else ctx.rect(x - r, y - r, r * 2, r * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${r * 1.35}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmt(n), x, y + 0.02);
}

function draw() {
  dirty = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!game) return;
  ctx.save();
  if (view.zoom > 1) {
    // Zoomed in: keep the board inside its area, clear of the drops and buttons.
    const r = view.area;
    ctx.beginPath();
    ctx.rect(0, r.y - 4, cw, r.h + 8);
    ctx.clip();
  }
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const base = arrowColor();
  for (const a of game.arrows) {
    if (a.state === 'gone' || a.state === 'exit' || game.hint.has(a.data.id)) continue;
    drawArrow(a, a.flash > 0 ? COLORS.error : base);
  }
  for (const [id, n] of game.hint) {
    const a = game.arrows[id];
    if (a.state === 'gone' || a.state === 'exit') continue;
    drawArrow(a, a.flash > 0 ? COLORS.error : COLORS.hint, 0.3, 1.15);
    drawBadge(a, n);
  }
  for (const a of game.arrows) {
    if (a.state !== 'exit') continue;
    ctx.globalAlpha = a.alpha;
    drawArrow(a, COLORS.moving);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- game state
function startLevel(L) {
  startGame({ mode: 'level', level: L, cfg: levelConfig(L) });
}
function startDaily() {
  startGame({ mode: 'daily', level: 0, cfg: dailyConfig() });
}
const restart = () => (game.mode === 'daily' ? startDaily() : startLevel(game.level));

function startGame({ mode, level: L, cfg }) {
  hideModals();
  const puzzle = generate(cfg);
  const { W, H } = cfg;
  const occ = new Int32Array(W * H).fill(-1);
  const arrows = puzzle.arrows.map((data) => {
    for (const c of data.cells) occ[c] = data.id;
    return { data, path: new Path(data, W).addExit(W, H), state: 'idle', s: 0, v: 0, flash: 0, alpha: 1 };
  });
  game = {
    mode, level: L, W, H, occ, arrows,
    total: arrows.length, left: arrows.length,
    lives: 3, mistakes: 0, combo: 0, lastFree: 0, gained: 0,
    hint: new Map(), over: false, started: performance.now(),
  };
  view.zoom = 1;
  view.panX = view.panY = 0;
  resize();
  updateHud(true);
  showTutorial(mode === 'level' ? L : 0);
  renderDailyBtn();
  stage.classList.remove('intro');
  void stage.offsetWidth;
  stage.classList.add('intro');
}

// ---------------------------------------------------------------- HUD
const levelScore = () => Math.min(game.gained, levelMax(Math.max(1, game.level)));

function updateHud(reset) {
  $('level').textContent = game.mode === 'daily' ? t('dailyTitle') : t('level', { n: fmtPlain(game.level) });
  $('left').textContent = fmt(game.left);
  $('hintCount').textContent = fmt(save.hints);
  $('hintBtn').classList.toggle('empty', save.hints <= 0);
  $('progress').style.width = ((1 - game.left / game.total) * 100).toFixed(1) + '%';
  const drops = $('lives').children;
  for (let i = 0; i < drops.length; i++) {
    const lost = i >= game.lives;
    if (reset) drops[i].classList.remove('lost', 'pop');
    else if (lost && !drops[i].classList.contains('lost')) drops[i].classList.add('lost', 'pop');
  }
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function showTutorial(L) {
  const el = $('tip');
  let key = { 1: 'tut1', 2: 'tut2', 3: 'tut3', 5: 'tut5' }[L];
  if (L > 1 && levelConfig(L).W >= 12 && levelConfig(L - 1).W < 12) key = 'tut4';
  el.classList.toggle('show', !!key);
  if (key) el.textContent = t(key);
}

function floatText(text, gx, gy, cls = '') {
  const [x, y] = toScreen(gx, gy);
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function shout(text) {
  const el = $('shout');
  el.textContent = text;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

function shake() {
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

// ---------------------------------------------------------------- gameplay
function tryFree(a) {
  if (game.over || a.state !== 'idle') return;
  unlockAudio();
  const { W, H, occ } = game;
  const block = blockersOf(W, H, a.data, occ);
  const now = performance.now();

  if (!block) {
    for (const c of a.data.cells) occ[c] = -1;
    game.hint.delete(a.data.id);
    a.state = 'exit';
    a.s = 0;
    a.v = 6;
    game.left--;
    game.combo = now - game.lastFree < 1600 ? game.combo + 1 : 1;
    game.lastFree = now;
    const mult = Math.min(game.combo, 5);
    const pts = 10 * mult;
    game.gained += pts;
    const [hx, hy] = a.path.head;
    floatText('+' + fmt(pts), hx, hy, mult > 1 ? 'combo' : '');
    sfx.free(game.combo - 1);
    vibrate(8);
    if (game.combo >= 20) achieve('combo20');
    if ([5, 10, 15, 20, 30].includes(game.combo)) shout(t('praise' + game.combo));
    if (game.mode === 'level' && game.level <= 2) $('tip').classList.remove('show');
    updateHud();
    bump($('leftPill'));
  } else {
    a.state = 'bump';
    a.s = 0;
    a.phase = 1;
    a.bumpTo = block.dist + 0.3;
    a.flash = 0.9;
    game.arrows[block.id].flash = 0.9;
    game.lives--;
    game.mistakes++;
    game.combo = 0;
    sfx.block();
    vibrate([40, 30, 40]);
    shake();
    updateHud();
    if (game.lives <= 0) {
      game.over = true;
      setTimeout(showLose, 800);
    }
  }
  dirty = true;
}

/**
 * Hint: number the next moves. A few arrows that can leave right now get a 1,
 * and arrows that those free up get a 2.
 */
function useHint() {
  unlockAudio();
  if (!game || game.over) return;
  if (game.hint.size) {
    sfx.click();
    return;
  }
  if (save.hints <= 0) {
    bump($('hintBtn'));
    sfx.click();
    return;
  }
  const { W, H } = game;
  const occ = game.occ.slice();
  const idle = game.arrows.filter((a) => a.state === 'idle' || a.state === 'bump');
  const free = idle.filter((a) => !blockersOf(W, H, a.data, occ));
  if (!free.length) return;
  free.sort((x, y) => y.data.id - x.data.id);
  const ones = free.slice(0, 3);
  for (const a of ones) {
    game.hint.set(a.data.id, 1);
    for (const c of a.data.cells) occ[c] = -1;
  }
  const twos = idle.filter((a) => !game.hint.has(a.data.id) && !free.includes(a) && !blockersOf(W, H, a.data, occ));
  for (const a of twos.slice(0, 2)) game.hint.set(a.data.id, 2);
  save.hints--;
  persist();
  sfx.hint();
  vibrate(10);
  updateHud();
  dirty = true;
  // Zoomed in? Bring the first hinted arrow into view.
  if (view.zoom > 1) {
    const [x, y] = toScreen(...ones[0].path.head);
    view.panX -= x - (view.area.x + view.area.w / 2);
    view.panY -= y - (view.area.y + view.area.h / 2);
    layout();
  }
}

function checkWin() {
  if (game.over || game.left > 0) return;
  if (game.arrows.some((a) => a.state === 'exit')) return;
  game.over = true;
  const stars = Math.max(1, 3 - game.mistakes);
  const secs = Math.round((performance.now() - game.started) / 1000);
  const starsBefore = starTotal();
  const hintReward = stars === 3 ? 1 : 0;
  let bonusHint = 0;

  if (game.mode === 'daily') {
    const d = save.daily;
    const today = dayKey();
    if (!d.done[today]) {
      d.streak = d.last === yesterdayKey() ? d.streak + 1 : d.last === today ? d.streak : 1;
      d.last = today;
    }
    const prev = d.done[today];
    if (!prev || stars > prev.stars || (stars === prev.stars && secs < prev.secs)) d.done[today] = { stars, secs };
    for (const k of Object.keys(d.done).sort().slice(0, -30)) delete d.done[k];
    achieve('daily');
    if (currentStreak() >= 7) achieve('streak7');
  } else {
    save.stars[game.level] = Math.max(save.stars[game.level] || 0, stars);
    game.gained += 50 * stars + game.level * 5;
    const newBest = levelScore() > (save.best[game.level] || 0);
    if (newBest) save.best[game.level] = levelScore();
    save.score = bestTotal();
    const reachedNew = game.level + 1 > save.level;
    save.level = Math.max(save.level, game.level + 1);
    // A bonus hint every 5 new levels: the big boards need them.
    if (reachedNew && game.level % 5 === 0) bonusHint = 1;
    if (newBest || reachedNew) pushScore();
    achieve('first');
    if (Object.values(save.stars).filter((v) => v === 3).length >= 10) achieve('flawless10');
    for (const n of [50, 100, 250, 500]) if (save.level >= n) achieve('level' + n);
  }
  if (game.total >= 30 && secs < 60) achieve('speed');
  save.hints += hintReward + bonusHint;
  persist();
  const unlocked = PALETTES.find((p) => p.stars > starsBefore && p.stars <= starTotal());
  sfx.win();
  vibrate([20, 40, 20, 40, 60]);
  confetti();
  shout(t('win' + stars));
  setTimeout(() => showWin(stars, secs, hintReward, bonusHint, unlocked), 900);
}

// ---------------------------------------------------------------- modals
function hideModals() {
  document.querySelectorAll('.modal').forEach((m) => m.classList.remove('show'));
}

function showWin(stars, secs, hintReward, bonusHint, unlocked) {
  const daily = game.mode === 'daily';
  $('winTitle').textContent = t('win' + stars);
  $('winStats').innerHTML =
    (daily
      ? `<div><b>🔥 ${fmt(currentStreak())}</b><span>${t('daily')}</span></div>`
      : `<div><b>+${fmt(levelScore())}</b><span>${t('points')}</span></div>`) +
    `<div><b>${fmtTime(secs)}</b><span>${t('time')}</span></div>` +
    `<div><b>${fmt(game.total)}</b><span>${t('arrows')}</span></div>`;
  $('winReward').textContent =
    (hintReward ? t('hintYes') : t('hintNo')) + (bonusHint ? ' · 🎁 +' + fmt(bonusHint) + ' 💡' : '');
  $('winUnlock').hidden = !unlocked;
  if (unlocked) $('winUnlock').textContent = t('newSkin', { name: t('pal_' + unlocked.id) });
  $('nextBtn').textContent = daily ? t('continueLevels') : t('next');
  $('shareBtn').hidden = !daily;
  game.lastWin = { stars, secs };
  const starEls = $('stars').children;
  for (let i = 0; i < 3; i++) {
    starEls[i].classList.remove('on');
    if (i < stars)
      setTimeout(() => {
        starEls[i].classList.add('on');
        sfx.star(i);
        vibrate(15);
      }, 350 + i * 280);
  }
  renderWinRank();
  $('win').classList.add('show');
  updateHud();
}

async function shareDaily() {
  const { stars, secs } = game.lastWin;
  const text =
    t('shareText', { date: dayKey(), stars: '⭐'.repeat(stars) + '☆'.repeat(3 - stars), time: fmtTime(secs), streak: currentStreak() }) +
    '\n' + location.href.split('#')[0];
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      shout(t('copied'));
    }
  } catch {}
}

function showLose() {
  sfx.lose();
  const freed = game.total - game.left;
  $('loseText').textContent = t('loseText', { a: freed, b: game.total, p: Math.round((freed / game.total) * 100) });
  $('lose').classList.add('show');
}

function confetti(count = 90) {
  const colors = ['#f0b429', '#e5484d', '#3e9bff', '#46c37b', '#a26bfa', '#ff8a3d'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
    el.style.setProperty('--r', Math.random() * 1080 - 540 + 'deg');
    el.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    el.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ---------------------------------------------------------------- level select
const LV_PER_PAGE = 100;
let lvPage = 0;
const lvPages = () => Math.max(10, Math.ceil((save.level + 1) / LV_PER_PAGE));

function openLevels() {
  hideModals();
  lvPage = Math.floor((save.level - 1) / LV_PER_PAGE);
  renderLevels();
  $('levels').classList.add('show');
  $('lvGrid').querySelector('.current')?.scrollIntoView({ block: 'center' });
}

function renderLevels() {
  lvPage = Math.max(0, Math.min(lvPages() - 1, lvPage));
  const from = lvPage * LV_PER_PAGE + 1;
  const to = from + LV_PER_PAGE - 1;
  $('lvRange').textContent = fmtPlain(from) + ' – ' + fmtPlain(to);
  $('lvStars').textContent = '★ ' + fmt(starTotal()) + '  ·  ' + fmt(save.score);
  $('lvPrev').disabled = lvPage === 0;
  $('lvNext').disabled = lvPage >= lvPages() - 1;
  let html = '';
  for (let n = from; n <= to; n++) {
    const st = save.stars[n] || 0;
    const locked = n > save.level;
    const cls = locked ? 'locked' : n === save.level ? 'current' : st ? 'done' : '';
    html += `<button class="lv ${cls}" data-lv="${n}"><b>${locked ? '🔒' : fmtPlain(n)}</b><small>${
      locked ? fmtPlain(n) : '★'.repeat(st) + '☆'.repeat(3 - st)
    }</small></button>`;
  }
  $('lvGrid').innerHTML = html;
}

// ---------------------------------------------------------------- daily button, palettes
function renderDailyBtn() {
  const done = !!save.daily.done[dayKey()];
  const streak = currentStreak();
  $('dailyStreak').textContent = done ? '✓ ' + t('daily') : streak ? '🔥' + fmt(streak) + ' ' + t('daily') : t('daily');
  $('dailyDay').textContent = fmt(new Date().getDate());
  $('dailyBtn').classList.toggle('todo', !done);
  $('dailyBtn').classList.toggle('active', game?.mode === 'daily');
}

function renderPalettes() {
  const have = starTotal();
  $('palStars').textContent = '★ ' + fmt(have);
  $('palettes').innerHTML = PALETTES.map((p) => {
    const locked = have < p.stars;
    const col = save.dark ? p.dark : p.light;
    return `<button class="pal${save.palette === p.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-pal="${p.id}">
      <svg viewBox="0 0 40 40"><path d="M8 34V20h16V10" fill="none" stroke="${col}" stroke-width="3.5" stroke-linejoin="round"/><path d="m24 3 6.5 8.5h-13z" fill="${col}"/></svg>
      <span>${locked ? '🔒 ' + fmt(p.stars) + '★' : t('pal_' + p.id)}</span></button>`;
  }).join('');
}

function pickPalette(id) {
  const p = paletteOf(id);
  if (starTotal() < p.stars) {
    shout(t('styleLocked', { n: p.stars }));
    return;
  }
  save.palette = id;
  persist();
  renderPalettes();
  dirty = true;
}

// ---------------------------------------------------------------- achievements
const ACHIEVEMENTS = [
  ['first', '🎯'], ['combo20', '🔥'], ['flawless10', '⭐'], ['daily', '☀️'], ['streak7', '💪'],
  ['speed', '⚡'], ['level50', '🥉'], ['level100', '🥈'], ['level250', '🥇'], ['level500', '👑'],
];
const toasts = [];
function achieve(id) {
  if (save.ach[id]) return;
  save.ach[id] = true;
  save.hints++;
  persist();
  toasts.push(id);
  if (toasts.length === 1) showToast();
  if (game) updateHud();
}
function showToast() {
  const id = toasts[0];
  if (!id) return;
  const icon = ACHIEVEMENTS.find((a) => a[0] === id)[1];
  const el = $('toast');
  el.innerHTML = `<span class="ic">${icon}</span><span><b>${t('ach_' + id)}</b><small>${t('achReward')}</small></span>`;
  el.classList.add('show');
  sfx.achieve();
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      toasts.shift();
      showToast();
    }, 400);
  }, 2600);
}
function renderAchievements() {
  const got = ACHIEVEMENTS.filter(([id]) => save.ach[id]).length;
  $('achCount').textContent = fmt(got) + ' / ' + fmt(ACHIEVEMENTS.length);
  $('achList').innerHTML = ACHIEVEMENTS.map(
    ([id, icon]) =>
      `<li class="${save.ach[id] ? 'got' : ''}"><span class="ic">${icon}</span><span><b>${t('ach_' + id)}</b><small>${t('achd_' + id)}</small></span></li>`,
  ).join('');
}

// ---------------------------------------------------------------- input
const pointers = new Map();
let gesture = null;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) gesture = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom0: view.zoom, moved: true };
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2 && gesture.pinch) {
    const [a, b] = [...pointers.values()];
    const z = (gesture.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.pinch;
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    view.panX += dx / 2;
    view.panY += dy / 2;
    layout();
    return;
  }
  if (!gesture.moved && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 10) gesture.moved = true;
  if (gesture.moved && view.zoom > 1) {
    view.panX += dx;
    view.panY += dy;
    layout();
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;
  if (pointers.size === 0) {
    if (!gesture.moved && performance.now() - gesture.t0 < 500) tap(e.clientX, e.clientY);
    gesture = null;
  } else gesture = { moved: true };
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, view.zoom * Math.exp(-e.deltaY * 0.002));
  },
  { passive: false },
);
document.addEventListener('gesturestart', (e) => e.preventDefault());

function tap(px, py) {
  if (!game || game.over) return;
  const { W, H, occ } = game;
  const [gx, gy] = toGrid(px, py);
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  // The cell under the finger first, then the nearest arrow next to it.
  let best = -1;
  let bestD = Infinity;
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const id = occ[y * W + x];
      if (id < 0) continue;
      const d = x === cx && y === cy ? 0 : Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
  }
  if (best >= 0 && bestD < 0.95) tryFree(game.arrows[best]);
}

// ---------------------------------------------------------------- buttons
function applyTheme() {
  document.documentElement.dataset.theme = save.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = save.dark ? '#1d1b23' : '#fbfaf8';
  dirty = true;
}
applyTheme();

function applyLang(l) {
  save.lang = l;
  persist();
  setLang(l);
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('sel', b.dataset.lang === lang));
  renderPalettes();
  renderAchievements();
  renderDailyBtn();
  if (game) {
    updateHud();
    renderWinRank();
    if ($('tip').classList.contains('show')) showTutorial(game.mode === 'level' ? game.level : 0);
  }
  if ($('levels').classList.contains('show')) renderLevels();
}

const on = (id, fn) =>
  $(id).addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    sfx.click();
    fn(e);
  });
on('backBtn', openLevels);
on('hintBtn', useHint);
on('dailyBtn', () => game.mode !== 'daily' && startDaily());
on('paletteBtn', () => {
  renderPalettes();
  $('palette').classList.add('show');
});
on('palClose', () => $('palette').classList.remove('show'));
on('settingsBtn', () => {
  $('soundToggle').checked = save.sound;
  $('vibeToggle').checked = save.vibe;
  $('darkToggle').checked = save.dark;
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('sel', b.dataset.lang === lang));
  renderAchievements();
  $('settings').classList.add('show');
});
on('closeSettings', () => $('settings').classList.remove('show'));
on('restartBtn', restart);
on('resetBtn', () => {
  if (!confirm(t('resetConfirm'))) return;
  Object.assign(save, {
    level: 1, score: 0, best: {}, hints: 3, stars: {}, palette: 'classic',
    daily: { last: '', streak: 0, done: {} }, ach: {},
  });
  persist();
  startLevel(1);
});
on('nextBtn', () => startLevel(game.mode === 'daily' ? save.level : game.level + 1));
on('shareBtn', shareDaily);
on('replayBtn', restart);
on('retryBtn', restart);
on('lbBtn', openLeaderboard);
on('lbClose', () => {
  $('leaderboard').classList.remove('show');
  if (game.over && game.left === 0) $('win').classList.add('show');
});
on('lbSave', saveName);
on('lbRename', () => {
  $('lbJoin').hidden = false;
  $('lbName').focus();
});
on('lvClose', () => $('levels').classList.remove('show'));
on('lvPrev', () => {
  lvPage--;
  renderLevels();
});
on('lvNext', () => {
  lvPage++;
  renderLevels();
});
$('lvGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lv]');
  if (!b) return;
  unlockAudio();
  sfx.click();
  const n = Number(b.dataset.lv);
  if (n > save.level) shout(t('levelLocked', { n: fmtPlain(save.level) }));
  else startLevel(n);
});
$('lbName').addEventListener('keydown', (e) => e.key === 'Enter' && saveName());
$('lbBtn').hidden = !leaderboardEnabled;
$('soundToggle').addEventListener('change', (e) => {
  save.sound = audio.enabled = e.target.checked;
  persist();
});
$('vibeToggle').addEventListener('change', (e) => {
  save.vibe = e.target.checked;
  persist();
});
$('darkToggle').addEventListener('change', (e) => {
  save.dark = e.target.checked;
  persist();
  applyTheme();
});
document.querySelectorAll('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    sfx.click();
    applyLang(b.dataset.lang);
  }),
);
$('palettes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pal]');
  if (!b) return;
  sfx.click();
  pickPalette(b.dataset.pal);
});

// ---------------------------------------------------------------- leaderboard
const lb = { rank: null, pending: false };

function pushScore() {
  if (!leaderboardEnabled || !save.name) return;
  lb.pending = true;
  submitScore({ id: save.pid, name: save.name, score: save.score, level: save.level })
    .then((r) => (lb.rank = r.rank))
    .catch(() => {})
    .finally(() => {
      lb.pending = false;
      renderWinRank();
    });
}

function renderWinRank() {
  const el = $('winRank');
  if (!leaderboardEnabled || !game || game.mode === 'daily') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (!save.name) {
    el.innerHTML = `<span>${t('joinRanking')}</span>`;
    el.onclick = openLeaderboard;
  } else if (lb.pending) {
    el.innerHTML = `<span>${t('updatingRank')}</span>`;
    el.onclick = null;
  } else if (lb.rank) {
    el.innerHTML = `<span>${t('yourRank', { n: lb.rank })}</span>`;
    el.onclick = openLeaderboard;
  } else {
    el.innerHTML = `<span>${t('seeLb')}</span>`;
    el.onclick = openLeaderboard;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function openLeaderboard() {
  hideModals();
  $('lbName').value = save.name;
  $('lbJoin').hidden = !!save.name;
  $('lbList').innerHTML = `<p class="lb-msg">${t('loading')}</p>`;
  $('leaderboard').classList.add('show');
  loadLeaderboard();
}

function loadLeaderboard() {
  fetchTop(save.pid)
    .then(({ top, me, players }) => {
      const rows = top.map((r, i) => row(i + 1, r, r.me));
      if (me && me.rank > top.length) rows.push('<li class="gap">⋯</li>', row(me.rank, { name: save.name, ...me }, true));
      $('lbList').innerHTML = rows.length
        ? `<ol>${rows.join('')}</ol><p class="lb-msg">${players === 1 ? t('player1') : t('players', { n: players })}</p>`
        : `<p class="lb-msg">${t('noScores')}</p>`;
      $('lbList').querySelector('.me')?.scrollIntoView({ block: 'nearest' });
    })
    .catch(() => ($('lbList').innerHTML = `<p class="lb-msg">${t('lbError')}</p>`));
}

function row(rank, r, me) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1] || fmt(rank);
  return (
    `<li class="${me ? 'me' : ''}"><span class="rk">${medal}</span><span class="nm"><bdi>${esc(r.name)}</bdi></span>` +
    `<span class="lv">${t('lv', { n: fmtPlain(Number(r.level)) })}</span><span class="sc">${fmt(Number(r.score))}</span></li>`
  );
}

function saveName() {
  const name = cleanName($('lbName').value);
  if (!name) {
    bump($('lbName'));
    return;
  }
  save.name = name;
  persist();
  $('lbJoin').hidden = true;
  $('lbList').innerHTML = `<p class="lb-msg">${t('saving')}</p>`;
  lb.pending = true;
  submitScore({ id: save.pid, name, score: save.score, level: save.level })
    .then((r) => (lb.rank = r.rank))
    .catch(() => {})
    .finally(() => {
      lb.pending = false;
      loadLeaderboard();
    });
}

// ---------------------------------------------------------------- main loop
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    for (const a of game.arrows) {
      if (a.state === 'exit') {
        a.v = Math.min(60, a.v + 70 * dt);
        a.s += a.v * dt;
        const p = a.path;
        a.alpha = Math.max(0, Math.min(1, (p.exitEnd - a.s) / Math.max(1, p.bodyLen)));
        if (a.s >= p.exitEnd) {
          a.state = 'gone';
          checkWin();
        }
        dirty = true;
      } else if (a.state === 'bump') {
        if (a.phase === 1) {
          a.s = Math.min(a.bumpTo, a.s + 16 * dt);
          if (a.s >= a.bumpTo) a.phase = 2;
        } else {
          a.s = Math.max(0, a.s - 10 * dt);
          if (a.s <= 0) a.state = 'idle';
        }
        dirty = true;
      }
      if (a.flash > 0) {
        a.flash -= dt;
        dirty = true;
      }
    }
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

resize();
startLevel(Math.max(1, save.level));
requestAnimationFrame(frame);
window.__fozReady = true;

// Debug/test hook.
window.__foz = {
  get game() {
    return game;
  },
  tryFree, startLevel, startDaily, blockersOf, applyLang, useHint,
  headScreen: (a) => toScreen(a.path.head[0], a.path.head[1]),
};
