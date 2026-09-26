import * as THREE from 'three';
import { generate, blockersOf } from './generator.js';
import { key } from './cube.js';
import { mulberry32 } from './rng.js';
import { Track, buildArrowGeometry } from './track.js';
import { sfx, audio, unlockAudio } from './audio.js';
import { leaderboardEnabled, submitScore, fetchTop, cleanName, newPlayerId } from './leaderboard.js';
import { t, fmt, fmtTime, setLang, detectLang, lang } from './i18n.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- persistence
const SAVE_KEY = 'fozarrows.v1';
const save = {
  level: 1, score: 0, best: null, hints: 3, stars: {}, sound: true, vibe: true, dark: false,
  pid: '', name: '', lang: '', skin: 'classic', daily: null,
};
try {
  Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
} catch {}
// Score = sum of the best result on each level, so replays can't farm points.
if (!save.best) save.best = {};
if (!save.pid) save.pid = newPlayerId();
if (!save.daily) save.daily = { last: '', streak: 0, done: {} };
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

// ---------------------------------------------------------------- levels
export function levelN(L) {
  return L === 1 ? 2 : L <= 4 ? 3 : L <= 9 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : L <= 40 ? 7 : 8;
}
export function levelConfig(L) {
  const N = levelN(L);
  const maxLen = Math.min(3 + Math.floor(Math.sqrt(L) * 1.3), 2 * N + 4);
  return { N, seed: L * 7919 + 1013, minLen: L < 5 ? 2 : 3, maxLen, turnP: 0.35 + Math.min(0.2, L * 0.005) };
}
// Must match maxScore_() in leaderboard/Code.gs: a level never counts for more than this.
const levelMax = (L) => 3 * levelN(L) ** 2 * 50 + 150 + 5 * L;

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterdayKey = () => dayKey(new Date(Date.now() - 864e5));
function dailyConfig() {
  const k = dayKey();
  let h = 2166136261;
  for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const N = 5 + ((h >>> 3) % 2);
  return { N, seed: h >>> 0, minLen: 3, maxLen: 9, turnP: 0.45 };
}
const currentStreak = () => {
  const d = save.daily;
  return d.last === dayKey() || d.last === yesterdayKey() ? d.streak : 0;
};

/** Gives some arrows special powers, deterministically per level. */
function assignKinds(arrows, L, seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const pGold = L >= 3 ? 0.07 : 0;
  const pIce = L >= 6 ? 0.1 : 0;
  const pBomb = L >= 8 ? 0.05 : 0;
  const maxBombs = Math.max(1, Math.floor(arrows.length / 14));
  let bombs = 0;
  for (const a of arrows) {
    const r = rng();
    if (r < pBomb && bombs < maxBombs) {
      a.kind = 'bomb';
      bombs++;
    } else if (r < pBomb + pIce) a.kind = 'ice';
    else if (r < pBomb + pIce + pGold) a.kind = 'gold';
    else a.kind = 'normal';
  }
  // Make sure the level that introduces a special arrow actually has one.
  const intro = { 3: 'gold', 6: 'ice', 8: 'bomb' }[L];
  if (intro && !arrows.some((a) => a.kind === intro)) arrows[Math.floor(rng() * arrows.length)].kind = intro;
}

// ---------------------------------------------------------------- themes & skins
const THEMES = {
  light: { face: '#fdfcfa', grid: '#efeae3', edge: 0xd9d1c5, arrow: 0x3a2620 },
  dark: { face: '#34313d', grid: '#3d3a47', edge: 0x4a4656, arrow: 0xf3ebdf },
};
const SKINS = [
  { id: 'classic', stars: 0 },
  { id: 'candy', stars: 12, face: '#fff0f6', grid: '#ffdeeb', edge: 0xf7b6cf, arrow: 0xc2255c },
  { id: 'ocean', stars: 30, face: '#e7f5ff', grid: '#d0ebff', edge: 0xa5d8ff, arrow: 0x1c4f82 },
  { id: 'oasis', stars: 50, face: '#f6e7c8', grid: '#ecd7ac', edge: 0xd4b77e, arrow: 0x7a4b1e },
  { id: 'neon', stars: 75, face: '#15172b', grid: '#20233d', edge: 0x2f3357, arrow: 0x22e3ff },
  { id: 'royal', stars: 110, face: '#2b1b4a', grid: '#382660', edge: 0x4c3780, arrow: 0xffd24a },
];
let theme = THEMES[save.dark ? 'dark' : 'light'];
const skinOf = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
const cubeColors = () => {
  const s = skinOf(save.skin);
  return s.id === 'classic' || starTotal() < s.stars ? theme : s;
};

// ---------------------------------------------------------------- three.js setup
const stage = $('stage');
// three.js needs WebGL 2 (Safari/iPadOS 15+). Without it, show the "update your browser" message.
if (!document.createElement('canvas').getContext('webgl2')) {
  window.__fozFail?.();
  throw new Error('WebGL 2 is not available');
}
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
scene.add(camera);
scene.add(new THREE.AmbientLight(0xffffff, 1.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-0.35, 1, 0.55);
camera.add(sun);
camera.add(sun.target);
sun.target.position.set(0, 0, -1);

const cube = new THREE.Group();
scene.add(cube);

const lambert = (color, emissive = 0) =>
  new THREE.MeshLambertMaterial({ color, emissive: emissive ? color : 0, emissiveIntensity: emissive });
const mats = {
  arrow: lambert(theme.arrow),
  hint: lambert(0x22c55e, 0.3),
  error: lambert(0xe5484d, 0.25),
  gold: lambert(0xffc800, 0.4),
  ice: lambert(0x74c8f2, 0.3),
  bomb: lambert(0xf76707, 0.3),
  bombCore: new THREE.MeshBasicMaterial({ color: 0x241a17 }),
  bombRing: new THREE.MeshBasicMaterial({ color: 0xf76707 }),
};
for (const m of Object.values(mats)) {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
}
const baseMat = (a) => (a.ice ? mats.ice : a.data.kind === 'gold' ? mats.gold : a.data.kind === 'bomb' ? mats.bomb : mats.arrow);
const ringGeom = new THREE.CircleGeometry(0.3, 24);
const coreGeom = new THREE.CircleGeometry(0.19, 20);
const sharedGeoms = new Set([ringGeom, coreGeom]);

function faceTexture(N) {
  const col = cubeColors();
  const cell = Math.max(48, Math.floor(768 / N));
  const size = cell * N;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = col.face;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = col.grid;
  g.lineWidth = Math.max(1, cell * 0.02);
  for (let i = 1; i < N; i++) {
    g.beginPath();
    g.moveTo(i * cell, 0);
    g.lineTo(i * cell, size);
    g.moveTo(0, i * cell);
    g.lineTo(size, i * cell);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ---------------------------------------------------------------- game state
const ISO = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.68, 0, 'XYZ'));
let game = null;

function disposeLevel() {
  if (!game) return;
  cube.traverse((o) => {
    if (o.geometry && o.geometry !== particleGeom && !sharedGeoms.has(o.geometry)) o.geometry.dispose();
    if (o.material && !Object.values(mats).includes(o.material)) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  cube.clear();
  particles.length = 0;
}

function startLevel(L) {
  startGame({ mode: 'level', level: L, cfg: levelConfig(L) });
}
function startDaily() {
  startGame({ mode: 'daily', level: 30, cfg: dailyConfig() });
}
const restart = () => (game.mode === 'daily' ? startDaily() : startLevel(game.level));

function startGame({ mode, level: L, cfg }) {
  disposeLevel();
  hideModals();
  endFever(true);
  const puzzle = generate(cfg);
  assignKinds(puzzle.arrows, L, cfg.seed);
  const N = cfg.N;

  const box = new THREE.Mesh(new THREE.BoxGeometry(N, N, N), new THREE.MeshLambertMaterial({ map: faceTexture(N) }));
  cube.add(box);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color: cubeColors().edge }),
  );
  edges.scale.setScalar(1.001);
  cube.add(edges);

  const occ = new Map();
  const arrows = puzzle.arrows.map((data) => {
    const track = new Track(data, N);
    const a = { data, track, state: 'idle', s: 0, v: 0, flash: 0, ice: data.kind === 'ice' };
    a.mesh = new THREE.Mesh(buildArrowGeometry(track, 0, track.bodyLen, new THREE.BufferGeometry()), baseMat(a));
    cube.add(a.mesh);
    if (data.kind === 'bomb') {
      // A little bomb sits on the arrow's tail.
      a.marker = new THREE.Group();
      const ring = new THREE.Mesh(ringGeom, mats.bombRing);
      const core = new THREE.Mesh(coreGeom, mats.bombCore);
      core.position.z = 0.004;
      a.marker.add(ring, core);
      cube.add(a.marker);
      placeMarker(a);
    }
    for (const c of data.cells) occ.set(key(c.p), data.id);
    return a;
  });

  game = {
    mode, level: L, N, box, edges, occ, arrows,
    total: arrows.length, left: arrows.length,
    hearts: 3, mistakes: 0, combo: 0, lastFree: 0, gained: 0,
    hinted: null, over: false, started: performance.now(),
    intro: 0, blasts: [],
  };
  cube.quaternion.copy(ISO).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -2.2));
  rot.from = cube.quaternion.clone();
  rot.to = ISO.clone();
  rot.t = 0;
  rot.dur = 1.1;
  spin.x = spin.y = 0;
  zoom = 1;
  fitCamera();
  $('comboBadge').classList.remove('show');
  updateHud(true);
  showTutorial(mode === 'level' ? L : 0);
  renderDailyBtn();
}

const zAxis = new THREE.Vector3(0, 0, 1);
function placeMarker(a) {
  const { p, n } = a.track.pointAt(a.s);
  a.marker.position.copy(p).addScaledVector(n, 0.02);
  a.marker.quaternion.setFromUnitVectors(zAxis, n);
}

// ---------------------------------------------------------------- HUD
const levelScore = () => Math.min(game.gained, levelMax(game.level));

function updateHud(reset) {
  $('level').textContent = game.mode === 'daily' ? t('dailyTitle') : t('level', { n: game.level });
  $('left').textContent = fmt(game.left);
  let shown = save.score;
  if (game.mode === 'level') shown = Math.max(save.score, save.score - (save.best[game.level] || 0) + levelScore());
  $('score').textContent = fmt(shown);
  $('hintCount').textContent = fmt(save.hints);
  $('hintBtn').classList.toggle('empty', save.hints <= 0);
  $('progress').style.width = ((1 - game.left / game.total) * 100).toFixed(1) + '%';
  const hearts = $('hearts').children;
  for (let i = 0; i < hearts.length; i++) {
    const lost = i >= game.hearts;
    if (reset) hearts[i].classList.remove('lost', 'pop');
    else if (lost && !hearts[i].classList.contains('lost')) hearts[i].classList.add('lost', 'pop');
  }
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function showTutorial(L) {
  const el = $('tip');
  const has = L >= 1 && L <= 8;
  el.classList.toggle('show', has);
  if (has) el.textContent = t('tut' + L);
}

function worldToScreen(v) {
  const p = v.clone().project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}

function floatText(text, world, cls = '') {
  const s = worldToScreen(world);
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

const cellLocal = (p) => new THREE.Vector3(p[0] / 2, p[1] / 2, p[2] / 2);
const headOf = (a) => a.data.cells[a.data.cells.length - 1];
const headWorld = (a) => cube.localToWorld(cellLocal(headOf(a).p));

// ---------------------------------------------------------------- particles
const particles = [];
const particleGeom = new THREE.PlaneGeometry(0.14, 0.14);
function burst(pos, normal, color, count = 10, speed = 1) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(particleGeom, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    m.position.copy(pos);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(4 * speed)
      .addScaledVector(normal, (2 + Math.random() * 2) * speed);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    cube.add(m);
    particles.push({ m, v, life: 0.5 + Math.random() * 0.3, t: 0 });
  }
}

// ---------------------------------------------------------------- gameplay
function clearHint() {
  const h = game.hinted;
  game.hinted = null;
  if (h && h.state === 'idle') h.mesh.material = baseMat(h);
}

/** Points for clearing one arrow at the current combo. */
function award(a, at) {
  const mult = Math.min(game.combo, 5);
  const gold = a.data.kind === 'gold' ? 3 : 1;
  const fever = game.fever > 0 ? 2 : 1;
  const pts = 10 * mult * gold * fever;
  game.gained += pts;
  floatText((gold > 1 ? '✨+' : '+') + fmt(pts), at, mult > 1 || gold > 1 || fever > 1 ? 'combo' : '');
  if (gold > 1) sfx.gold();
}

function tryFree(a) {
  if (game.over || a.state !== 'idle') return;
  unlockAudio();
  if (game.hinted === a) clearHint();

  if (a.ice) {
    a.ice = false;
    a.mesh.material = baseMat(a);
    const h = headOf(a);
    for (const c of a.data.cells) burst(cellLocal(c.p), cellLocal(h.n).multiplyScalar(2), 0xcfeeff, 3, 0.7);
    floatText(t('crack'), headWorld(a), 'ice');
    sfx.crack();
    vibrate(15);
    return;
  }

  const block = blockersOf(a.data, game.occ, game.N);
  const now = performance.now();

  if (!block) {
    for (const c of a.data.cells) game.occ.delete(key(c.p));
    a.state = 'exit';
    a.s = 0;
    a.v = 7;
    a.burst = false;
    a.mesh.material = baseMat(a).clone();
    a.mesh.material.transparent = true;
    game.left--;
    game.combo = now - game.lastFree < 1600 ? game.combo + 1 : 1;
    game.lastFree = now;
    award(a, headWorld(a));
    sfx.free(game.combo - 1);
    vibrate(8);
    if (game.combo >= 2) {
      $('comboBadge').textContent = '×' + fmt(Math.min(game.combo, 5));
      $('comboBadge').classList.add('show');
      bump($('comboBadge'));
    }
    if (game.fever > 0) game.fever = Math.min(8, game.fever + 0.5);
    else if (game.combo >= 8) startFever();
    const praise = { 5: 1, 10: 1, 15: 1, 20: 1, 30: 1 }[game.combo];
    if (praise && game.combo !== 8) shout(t('praise' + game.combo));
    if (a.data.kind === 'bomb') explode(a);
    if (game.mode === 'level' && game.level <= 2 && game.left < game.total) $('tip').classList.remove('show');
    updateHud();
    bump($('leftPill'));
  } else {
    a.state = 'bump';
    a.s = 0;
    a.phase = 1;
    a.bumpTo = block.dist + 0.3;
    a.mesh.material = mats.error;
    const blocker = game.arrows[block.id];
    if (blocker.state === 'idle') {
      blocker.mesh.material = mats.error;
      blocker.flash = 0.7;
    }
    game.hearts--;
    game.mistakes++;
    game.combo = 0;
    endFever();
    $('comboBadge').classList.remove('show');
    sfx.block();
    vibrate([40, 30, 40]);
    shake();
    updateHud();
    if (game.hearts <= 0) {
      game.over = true;
      setTimeout(showLose, 800);
    }
  }
}

/** A freed bomb blows up every arrow touching its body; bombs set off chains. */
function explode(bomb) {
  if (bomb.marker) {
    cube.remove(bomb.marker);
    bomb.marker = null;
  }
  const cells = bomb.data.cells.map((c) => c.p);
  const victims = new Set();
  for (const [k, id] of game.occ) {
    const p = k.split(',').map(Number);
    if (cells.some((q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 <= 9)) victims.add(id);
  }
  const n = cellLocal(headOf(bomb).n).multiplyScalar(2);
  for (const c of bomb.data.cells) burst(cellLocal(c.p), n, 0xf76707, 5, 1.5);
  sfx.boom();
  vibrate([60, 30, 90]);
  shake();
  floatText(t('boom'), headWorld(bomb), 'boom');
  for (const id of victims) {
    const v = game.arrows[id];
    if (v.state !== 'idle') continue;
    if (game.hinted === v) clearHint();
    for (const c of v.data.cells) game.occ.delete(key(c.p));
    v.state = 'pop';
    v.t = 0;
    v.mesh.material = baseMat(v).clone();
    v.mesh.material.transparent = true;
    game.left--;
    award(v, headWorld(v));
    for (const c of v.data.cells) burst(cellLocal(c.p), cellLocal(c.n).multiplyScalar(2), v.mesh.material.color, 3, 1.2);
    if (v.data.kind === 'bomb') game.blasts.push({ a: v, t: 0.18 });
  }
}

function startFever() {
  game.fever = 6;
  document.body.classList.add('fever');
  shout(t('fever'));
  sfx.fever();
  vibrate([20, 20, 20, 20, 40]);
}
function endFever(silent) {
  if (game) game.fever = 0;
  document.body.classList.remove('fever');
  mats.arrow.emissive.setHex(0);
  if (!silent) $('heat').classList.remove('on');
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

function useHint() {
  unlockAudio();
  if (!game || game.over) return;
  if (game.hinted) {
    showArrow(game.hinted);
    return;
  }
  if (save.hints <= 0) {
    bump($('hintBtn'));
    sfx.click();
    return;
  }
  const free = game.arrows.filter((a) => a.state === 'idle' && !blockersOf(a.data, game.occ, game.N));
  if (!free.length) return;
  // Prefer an arrow that already faces the player.
  const facing = (a) => new THREE.Vector3(...headOf(a).n).applyQuaternion(cube.quaternion).z;
  free.sort((x, y) => facing(y) - facing(x));
  const a = free[0];
  save.hints--;
  persist();
  game.hinted = a;
  a.mesh.material = mats.hint;
  sfx.hint();
  vibrate(10);
  showArrow(a);
  updateHud();
}

function showArrow(a) {
  const nw = new THREE.Vector3(...headOf(a).n).applyQuaternion(cube.quaternion);
  const view = new THREE.Vector3(0.15, 0.35, 1).normalize();
  if (nw.dot(zAxis) > 0.6) return;
  const q = new THREE.Quaternion().setFromUnitVectors(nw, view);
  animateTo(q.multiply(cube.quaternion));
}

function checkWin() {
  if (game.over || game.left > 0) return;
  if (game.arrows.some((a) => a.state === 'exit' || a.state === 'pop')) return;
  game.over = true;
  endFever();
  const stars = Math.max(1, 3 - game.mistakes);
  const secs = Math.round((performance.now() - game.started) / 1000);
  const starsBefore = starTotal();
  const hintReward = stars === 3 ? 1 : 0;
  save.hints += hintReward;

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
  } else {
    save.stars[game.level] = Math.max(save.stars[game.level] || 0, stars);
    game.gained += 50 * stars + game.level * 5;
    const newBest = levelScore() > (save.best[game.level] || 0);
    if (newBest) save.best[game.level] = levelScore();
    save.score = bestTotal();
    const reachedNew = game.level + 1 > save.level;
    save.level = Math.max(save.level, game.level + 1);
    if (newBest || reachedNew) pushScore();
  }
  persist();
  const unlocked = SKINS.find((s) => s.stars > starsBefore && s.stars <= starTotal());
  sfx.win();
  vibrate([20, 40, 20, 40, 60]);
  confetti();
  shout(t('win' + stars));
  spin.x = 700;
  setTimeout(() => showWin(stars, secs, hintReward, unlocked), 900);
}

// ---------------------------------------------------------------- modals
function hideModals() {
  document.querySelectorAll('.modal').forEach((m) => m.classList.remove('show'));
}

function showWin(stars, secs, hintReward, unlocked) {
  const daily = game.mode === 'daily';
  $('winTitle').textContent = t('win' + stars);
  $('winStats').innerHTML =
    (daily
      ? `<div><b>🔥 ${fmt(currentStreak())}</b><span>${t('daily')}</span></div>`
      : `<div><b>+${fmt(levelScore())}</b><span>${t('points')}</span></div>`) +
    `<div><b>${fmtTime(secs)}</b><span>${t('time')}</span></div>` +
    `<div><b>${fmt(game.total)}</b><span>${t('arrows')}</span></div>`;
  $('winReward').textContent = hintReward ? t('hintYes') : t('hintNo');
  $('winUnlock').hidden = !unlocked;
  if (unlocked) $('winUnlock').textContent = t('newSkin', { name: t('skin_' + unlocked.id) });
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

function confetti() {
  const colors = ['#f0b429', '#e5484d', '#3e9bff', '#46c37b', '#a26bfa', '#ff8a3d'];
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
    el.style.setProperty('--r', (Math.random() * 1080 - 540) + 'deg');
    el.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    el.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ---------------------------------------------------------------- daily button & skins
function renderDailyBtn() {
  const done = !!save.daily.done[dayKey()];
  const streak = currentStreak();
  $('dailyStreak').textContent = done ? '✓' : streak ? '🔥' + fmt(streak) : '!';
  $('dailyDay').textContent = fmt(new Date().getDate());
  $('dailyBtn').classList.toggle('todo', !done);
  $('dailyBtn').classList.toggle('active', game?.mode === 'daily');
}

function renderSkins() {
  const have = starTotal();
  $('skinStars').textContent = '★ ' + fmt(have);
  $('skins').innerHTML = SKINS.map((s) => {
    const col = s.id === 'classic' ? theme : s;
    const locked = have < s.stars;
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    return `<button class="skin${save.skin === s.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-skin="${s.id}"
      style="--f:${col.face};--g:${col.grid};--a:${hex(col.arrow)}" aria-label="${t('skin_' + s.id)}">
      <i class="sw"><b></b></i><span>${locked ? '🔒 ' + fmt(s.stars) + '★' : t('skin_' + s.id)}</span></button>`;
  }).join('');
}

function pickSkin(id) {
  const s = skinOf(id);
  if (starTotal() < s.stars) {
    shout(t('styleLocked', { n: s.stars }));
    return;
  }
  save.skin = id;
  persist();
  applyTheme();
  renderSkins();
}

// ---------------------------------------------------------------- camera & rotation
let zoom = 1;
const rot = { from: null, to: null, t: 1, dur: 0.5 };
const spin = { x: 0, y: 0 };

function animateTo(q, dur = 0.55) {
  rot.from = cube.quaternion.clone();
  rot.to = q.clone();
  rot.t = 0;
  rot.dur = dur;
  spin.x = spin.y = 0;
}

function fitCamera() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!game) return;
  const r = (game.N / 2) * Math.sqrt(3);
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = (r * 1.08) / Math.sin(Math.min(vf, hf) / 2) / zoom;
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
}
window.addEventListener('resize', fitCamera);

function rotateBy(dx, dy) {
  const k = 5 / Math.min(stage.clientWidth, stage.clientHeight);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
  cube.quaternion.premultiply(qy).premultiply(qx);
}

// ---------------------------------------------------------------- input
const pointers = new Map();
let gesture = null;
const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    gesture = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, samples: [] };
    spin.x = spin.y = 0;
    rot.t = 1;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom0: zoom, moved: true, samples: [] };
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
    zoom = THREE.MathUtils.clamp((gesture.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.pinch, 0.7, 2.2);
    fitCamera();
    return;
  }
  if (!gesture.moved && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 8) gesture.moved = true;
  if (gesture.moved) {
    rotateBy(dx, dy);
    const now = performance.now();
    gesture.samples.push({ t: now, dx, dy });
    while (gesture.samples.length && now - gesture.samples[0].t > 90) gesture.samples.shift();
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;
  if (pointers.size === 0) {
    if (!gesture.moved && performance.now() - gesture.t0 < 450) tap(e.clientX, e.clientY);
    else if (gesture.samples.length > 1) {
      const s = gesture.samples;
      const dt = Math.max(16, s[s.length - 1].t - s[0].t) / 1000;
      spin.x = s.reduce((acc, v) => acc + v.dx, 0) / dt;
      spin.y = s.reduce((acc, v) => acc + v.dy, 0) / dt;
    }
    gesture = null;
  } else gesture = { moved: true, samples: [] };
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom = THREE.MathUtils.clamp(zoom * Math.exp(-e.deltaY * 0.001), 0.7, 2.2);
  fitCamera();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

const raycaster = new THREE.Raycaster();
function tap(x, y) {
  if (!game || game.over) return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(game.box)[0];
  if (!hit) return;
  const N = game.N;
  const l = cube.worldToLocal(hit.point.clone()).multiplyScalar(2);
  const c = [l.x, l.y, l.z];
  let ax = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(c[i]) > Math.abs(c[ax])) ax = i;
  const snap = (v) => 2 * THREE.MathUtils.clamp(Math.floor((v + N) / 2), 0, N - 1) - N + 1;
  const base = c.map((v, i) => (i === ax ? Math.sign(v) * N : snap(v)));
  // Exact cell first, then the nearest arrow in the neighbouring cells.
  let best = null;
  let bestD = Infinity;
  const [u, w] = [0, 1, 2].filter((i) => i !== ax);
  for (const du of [0, -2, 2]) {
    for (const dw of [0, -2, 2]) {
      const p = base.slice();
      p[u] += du;
      p[w] += dw;
      if (Math.abs(p[u]) > N - 1 || Math.abs(p[w]) > N - 1) continue;
      const id = game.occ.get(key(p));
      if (id === undefined) continue;
      const d = Math.hypot(p[u] - c[u], p[w] - c[w]);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
  }
  if (best !== null && bestD < 1.9) tryFree(game.arrows[best]);
}

// ---------------------------------------------------------------- buttons
function applyTheme() {
  theme = THEMES[save.dark ? 'dark' : 'light'];
  document.documentElement.dataset.theme = save.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = save.dark ? '#1d1b23' : '#efe7da';
  const col = cubeColors();
  mats.arrow.color.setHex(col.arrow);
  if (game) {
    const old = game.box.material.map;
    game.box.material.map = faceTexture(game.N);
    old.dispose();
    game.edges.material.color.setHex(col.edge);
  }
}
applyTheme();

function applyLang(l) {
  save.lang = l;
  persist();
  setLang(l);
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('sel', b.dataset.lang === lang));
  renderSkins();
  if (game) {
    updateHud();
    renderWinRank();
    if ($('tip').classList.contains('show')) showTutorial(game.mode === 'level' ? game.level : 0);
  }
}

const on = (id, fn) => $(id).addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
  sfx.click();
  fn(e);
});
on('themeBtn', () => {
  save.dark = !save.dark;
  persist();
  applyTheme();
});
on('hintBtn', useHint);
on('viewBtn', () => animateTo(ISO));
on('dailyBtn', () => (game.mode === 'daily' ? animateTo(ISO) : startDaily()));
on('settingsBtn', () => {
  $('soundToggle').checked = save.sound;
  $('vibeToggle').checked = save.vibe;
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('sel', b.dataset.lang === lang));
  renderSkins();
  $('settings').classList.add('show');
});
on('closeSettings', () => $('settings').classList.remove('show'));
on('restartBtn', restart);
on('resetBtn', () => {
  if (!confirm(t('resetConfirm'))) return;
  Object.assign(save, { level: 1, score: 0, best: {}, hints: 3, stars: {}, skin: 'classic', daily: { last: '', streak: 0, done: {} } });
  persist();
  applyTheme();
  startLevel(1);
});
on('nextBtn', () => startLevel(game.mode === 'daily' ? save.level : game.level + 1));
on('shareBtn', shareDaily);
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
$('lbName').addEventListener('keydown', (e) => e.key === 'Enter' && saveName());
$('lbBtn').hidden = !leaderboardEnabled;
on('replayBtn', restart);
on('retryBtn', restart);
$('soundToggle').addEventListener('change', (e) => {
  save.sound = audio.enabled = e.target.checked;
  persist();
});
$('vibeToggle').addEventListener('change', (e) => {
  save.vibe = e.target.checked;
  persist();
});
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  sfx.click();
  applyLang(b.dataset.lang);
}));
$('skins').addEventListener('click', (e) => {
  const b = e.target.closest('[data-skin]');
  if (!b) return;
  sfx.click();
  pickSkin(b.dataset.skin);
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
  return `<li class="${me ? 'me' : ''}"><span class="rk">${medal}</span><span class="nm"><bdi>${esc(r.name)}</bdi></span>` +
    `<span class="lv">${t('lv', { n: Number(r.level) })}</span><span class="sc">${fmt(Number(r.score))}</span></li>`;
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
const ease = (x) => 1 - Math.pow(1 - x, 3);
let last = performance.now();
let pulse = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pulse += dt;

  if (rot.t < 1) {
    rot.t = Math.min(1, rot.t + dt / rot.dur);
    cube.quaternion.slerpQuaternions(rot.from, rot.to, ease(rot.t));
  } else if (!gesture && (spin.x || spin.y)) {
    rotateBy(spin.x * dt, spin.y * dt);
    const decay = Math.exp(-3.2 * dt);
    spin.x *= decay;
    spin.y *= decay;
    if (Math.abs(spin.x) + Math.abs(spin.y) < 2) spin.x = spin.y = 0;
  }

  if (game) {
    const introT = Math.min(1, (game.intro += dt / 0.7));
    cube.scale.setScalar(0.6 + 0.4 * ease(introT));
    mats.hint.emissiveIntensity = 0.3 + 0.3 * Math.sin(pulse * 8);
    mats.gold.emissiveIntensity = 0.3 + 0.15 * Math.sin(pulse * 5);
    mats.bombRing.color.setHSL(0.07, 1, 0.5 + 0.12 * Math.sin(pulse * 10));

    // Fever timer and heat meter.
    const heat = $('heat');
    if (game.fever > 0) {
      game.fever -= dt;
      mats.arrow.emissive.setHSL((pulse * 0.6) % 1, 1, 0.5);
      mats.arrow.emissiveIntensity = 0.35;
      heat.classList.add('on');
      $('heatFill').style.transform = `scaleX(${Math.max(0, game.fever / 8)})`;
      if (game.fever <= 0) endFever();
    } else {
      heat.classList.remove('on');
      const warm = now - game.lastFree < 1600 && !game.over ? Math.min(game.combo, 8) / 8 : 0;
      $('heatFill').style.transform = `scaleX(${warm})`;
    }

    for (let i = game.blasts.length - 1; i >= 0; i--) {
      const b = game.blasts[i];
      b.t -= dt;
      if (b.t <= 0) {
        game.blasts.splice(i, 1);
        explode(b.a);
        updateHud();
      }
    }

    for (const a of game.arrows) {
      if (a.state === 'exit') {
        a.v = Math.min(55, a.v + 80 * dt);
        a.s += a.v * dt;
        const tr = a.track;
        if (!a.burst && a.s >= tr.rayLen) {
          a.burst = true;
          const d = a.data.dir;
          const hp = tr.window(tr.bodyLen + tr.rayLen - 0.01, tr.bodyLen + tr.rayLen)[0].b;
          burst(hp, new THREE.Vector3(d[0], d[1], d[2]), a.mesh.material.color, 8);
        }
        const end = tr.total - tr.bodyLen;
        if (a.s >= end) {
          a.state = 'gone';
          cube.remove(a.mesh);
          a.mesh.geometry.dispose();
          a.mesh.material.dispose();
          checkWin();
          continue;
        }
        a.mesh.material.opacity = 1 - Math.max(0, (a.s - tr.rayLen) / (end - tr.rayLen)) ** 1.5;
        buildArrowGeometry(tr, a.s, a.s + tr.bodyLen, a.mesh.geometry);
      } else if (a.state === 'pop') {
        a.t += dt;
        a.mesh.material.opacity = Math.max(0, 1 - a.t / 0.35);
        if (a.marker) a.marker.visible = a.t < 0.1;
        if (a.t >= 0.35) {
          a.state = 'gone';
          cube.remove(a.mesh);
          a.mesh.geometry.dispose();
          a.mesh.material.dispose();
          checkWin();
        }
      } else if (a.state === 'bump') {
        if (a.phase === 1) {
          a.s = Math.min(a.bumpTo, a.s + 18 * dt);
          if (a.s >= a.bumpTo) a.phase = 2;
        } else {
          a.s = Math.max(0, a.s - 11 * dt);
          if (a.s <= 0) {
            a.state = 'idle';
            a.flash = 0.5;
          }
        }
        buildArrowGeometry(a.track, a.s, a.s + a.track.bodyLen, a.mesh.geometry);
        if (a.marker) placeMarker(a);
      } else if (a.flash > 0) {
        a.flash -= dt;
        if (a.flash <= 0 && a.state === 'idle') a.mesh.material = game.hinted === a ? mats.hint : baseMat(a);
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    p.v.multiplyScalar(Math.exp(-2 * dt));
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 6;
    p.m.material.opacity = Math.max(0, 1 - p.t / p.life);
    if (p.t >= p.life) {
      cube.remove(p.m);
      p.m.material.dispose();
      particles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

fitCamera();
startLevel(save.level);
requestAnimationFrame(frame);
window.__fozReady = true;

// Debug/test hook.
window.__foz = {
  get game() { return game; }, tryFree, startLevel, startDaily, blockersOf, applyLang,
  headScreen: (a) => worldToScreen(headWorld(a)),
  facing: (a) => new THREE.Vector3(...headOf(a).n).applyQuaternion(cube.quaternion).z,
};
