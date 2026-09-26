import * as THREE from 'three';
import { generate, blockersOf } from './generator.js';
import { key } from './cube.js';
import { Track, buildArrowGeometry } from './track.js';
import { sfx, audio, unlockAudio } from './audio.js';
import { leaderboardEnabled, submitScore, fetchTop, cleanName, newPlayerId } from './leaderboard.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- persistence
const SAVE_KEY = 'fozarrows.v1';
const save = { level: 1, score: 0, best: null, hints: 3, stars: {}, sound: true, vibe: true, dark: false, pid: '', name: '' };
try {
  Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
} catch {}
// Score = sum of the best result on each level, so replays can't farm points.
if (!save.best) save.best = {};
if (!save.pid) save.pid = newPlayerId();
const bestTotal = () => Object.values(save.best).reduce((a, b) => a + b, 0);
save.score = bestTotal();
const persist = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {}
};
audio.enabled = save.sound;
const vibrate = (p) => save.vibe && navigator.vibrate && navigator.vibrate(p);

// ---------------------------------------------------------------- levels
export function levelConfig(L) {
  const N = L === 1 ? 2 : L <= 4 ? 3 : L <= 9 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : L <= 40 ? 7 : 8;
  const maxLen = Math.min(3 + Math.floor(Math.sqrt(L) * 1.3), 2 * N + 4);
  return { N, seed: L * 7919 + 1013, minLen: L < 5 ? 2 : 3, maxLen, turnP: 0.35 + Math.min(0.2, L * 0.005) };
}

// ---------------------------------------------------------------- theme
const THEMES = {
  light: { face: '#fdfcfa', grid: '#efeae3', edge: 0xd9d1c5, arrow: 0x3a2620, hint: 0xf0b429, error: 0xe5484d },
  dark: { face: '#34313d', grid: '#3d3a47', edge: 0x4a4656, arrow: 0xf3ebdf, hint: 0xf5c04a, error: 0xff5c63 },
};
let theme = THEMES[save.dark ? 'dark' : 'light'];

// ---------------------------------------------------------------- three.js setup
const stage = $('stage');
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

const mats = {
  arrow: new THREE.MeshLambertMaterial({ color: theme.arrow }),
  hint: new THREE.MeshLambertMaterial({ color: theme.hint, emissive: theme.hint, emissiveIntensity: 0.2 }),
  error: new THREE.MeshLambertMaterial({ color: theme.error, emissive: theme.error, emissiveIntensity: 0.25 }),
};
for (const m of Object.values(mats)) {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
}

function faceTexture(N) {
  const cell = Math.max(48, Math.floor(768 / N));
  const size = cell * N;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = theme.face;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = theme.grid;
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
    if (o.geometry && o.geometry !== particleGeom) o.geometry.dispose();
    if (o.material && !Object.values(mats).includes(o.material)) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  cube.clear();
  particles.length = 0;
}

function startLevel(L) {
  disposeLevel();
  hideModals();
  const cfg = levelConfig(L);
  const puzzle = generate(cfg);
  const N = cfg.N;

  const box = new THREE.Mesh(new THREE.BoxGeometry(N, N, N), new THREE.MeshLambertMaterial({ map: faceTexture(N) }));
  cube.add(box);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color: theme.edge }),
  );
  edges.scale.setScalar(1.001);
  cube.add(edges);

  const occ = new Map();
  const arrows = puzzle.arrows.map((data) => {
    const track = new Track(data, N);
    const mesh = new THREE.Mesh(buildArrowGeometry(track, 0, track.bodyLen, new THREE.BufferGeometry()), mats.arrow);
    cube.add(mesh);
    for (const c of data.cells) occ.set(key(c.p), data.id);
    return { data, track, mesh, state: 'idle', s: 0, v: 0, flash: 0 };
  });

  game = {
    level: L, N, box, edges, occ, arrows,
    total: arrows.length, left: arrows.length,
    hearts: 3, mistakes: 0, combo: 0, lastFree: 0, gained: 0,
    hinted: null, over: false, started: performance.now(),
    intro: 0,
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
  showTutorial(L);
}

// ---------------------------------------------------------------- HUD
function updateHud(reset) {
  $('level').textContent = 'Level ' + game.level;
  $('left').textContent = game.left;
  const live = save.score - (save.best[game.level] || 0) + game.gained;
  $('score').textContent = Math.max(save.score, live).toLocaleString();
  $('hintCount').textContent = save.hints;
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

const tutorials = {
  1: 'Tap an arrow to slide it off the cube',
  2: 'Drag to spin the cube — arrows hide on every side',
  3: 'A blocked arrow costs a heart ❤️ Look before you tap!',
  5: 'Stuck? Tap the 💡 for a hint',
};
function showTutorial(L) {
  const el = $('tip');
  const msg = tutorials[L];
  el.classList.toggle('show', !!msg);
  if (msg) el.textContent = msg;
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

function headWorld(a) {
  const h = a.data.cells[a.data.cells.length - 1].p;
  return cube.localToWorld(new THREE.Vector3(h[0] / 2, h[1] / 2, h[2] / 2));
}

// ---------------------------------------------------------------- particles
const particles = [];
const particleGeom = new THREE.PlaneGeometry(0.14, 0.14);
function burst(pos, normal, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(particleGeom, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    m.position.copy(pos);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(4)
      .addScaledVector(normal, 2 + Math.random() * 2);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    cube.add(m);
    particles.push({ m, v, life: 0.5 + Math.random() * 0.3, t: 0 });
  }
}

// ---------------------------------------------------------------- gameplay
function clearHint() {
  if (game.hinted && game.hinted.state === 'idle') game.hinted.mesh.material = mats.arrow;
  game.hinted = null;
}

function tryFree(a) {
  if (game.over || a.state !== 'idle') return;
  unlockAudio();
  const wasHint = game.hinted === a;
  if (wasHint) clearHint();
  const block = blockersOf(a.data, game.occ, game.N);
  const now = performance.now();

  if (!block) {
    for (const c of a.data.cells) game.occ.delete(key(c.p));
    a.state = 'exit';
    a.s = 0;
    a.v = 7;
    a.burst = false;
    a.mesh.material = mats.arrow.clone();
    a.mesh.material.transparent = true;
    game.left--;
    game.combo = now - game.lastFree < 1600 ? game.combo + 1 : 1;
    game.lastFree = now;
    const mult = Math.min(game.combo, 5);
    const pts = 10 * mult;
    game.gained += pts;
    sfx.free(game.combo - 1);
    vibrate(8);
    const hw = headWorld(a);
    floatText('+' + pts, hw, mult > 1 ? 'combo' : '');
    if (game.combo >= 2) {
      $('comboBadge').textContent = 'x' + mult;
      $('comboBadge').classList.add('show');
      bump($('comboBadge'));
    }
    const praise = { 5: 'Nice!', 10: 'Great!', 15: 'Amazing!', 20: 'Unstoppable!', 30: 'Legendary!' }[game.combo];
    if (praise) shout(praise);
    if (game.level <= 2 && game.left < game.total) $('tip').classList.remove('show');
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
  const facing = (a) => {
    const n = a.data.cells[a.data.cells.length - 1].n;
    return new THREE.Vector3(...n).applyQuaternion(cube.quaternion).dot(camera.position.clone().normalize());
  };
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
  const n = a.data.cells[a.data.cells.length - 1].n;
  const nw = new THREE.Vector3(...n).applyQuaternion(cube.quaternion);
  const view = new THREE.Vector3(0.15, 0.35, 1).normalize();
  if (nw.dot(new THREE.Vector3(0, 0, 1)) > 0.6) return;
  const q = new THREE.Quaternion().setFromUnitVectors(nw, view);
  animateTo(q.multiply(cube.quaternion));
}

function checkWin() {
  if (game.over || game.left > 0) return;
  if (game.arrows.some((a) => a.state === 'exit')) return;
  game.over = true;
  const stars = Math.max(1, 3 - game.mistakes);
  const prev = save.stars[game.level] || 0;
  save.stars[game.level] = Math.max(prev, stars);
  const bonus = 50 * stars + game.level * 5;
  game.gained += bonus;
  const newBest = game.gained > (save.best[game.level] || 0);
  if (newBest) save.best[game.level] = game.gained;
  save.score = bestTotal();
  const hintReward = stars === 3 ? 1 : 0;
  save.hints += hintReward;
  const reachedNew = game.level + 1 > save.level;
  save.level = Math.max(save.level, game.level + 1);
  persist();
  if (newBest || reachedNew) pushScore();
  sfx.win();
  vibrate([20, 40, 20, 40, 60]);
  confetti();
  shout(['', 'Cleared!', 'Well done!', 'Perfect!'][stars]);
  spin.x = 700;
  setTimeout(() => showWin(stars, hintReward), 900);
}

// ---------------------------------------------------------------- modals
function hideModals() {
  document.querySelectorAll('.modal').forEach((m) => m.classList.remove('show'));
}

function showWin(stars, hintReward) {
  const secs = Math.round((performance.now() - game.started) / 1000);
  $('winTitle').textContent = ['', 'Cleared!', 'Great job!', 'Perfect!'][stars];
  $('winStats').innerHTML =
    `<div><b>+${game.gained}</b><span>points</span></div>` +
    `<div><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b><span>time</span></div>` +
    `<div><b>${game.total}</b><span>arrows</span></div>`;
  $('winReward').textContent = hintReward ? 'Flawless! +1 💡 hint' : 'No mistakes = +1 💡 hint';
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

function showLose() {
  sfx.lose();
  const pct = Math.round((1 - game.left / game.total) * 100);
  $('loseText').textContent = `You freed ${game.total - game.left} of ${game.total} arrows (${pct}%). So close!`;
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
    const t = performance.now();
    gesture.samples.push({ t, dx, dy });
    while (gesture.samples.length && t - gesture.samples[0].t > 90) gesture.samples.shift();
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
function toggleTheme() {
  save.dark = !save.dark;
  persist();
  applyTheme();
  if (game) {
    const old = game.box.material.map;
    game.box.material.map = faceTexture(game.N);
    old.dispose();
    game.edges.material.color.setHex(theme.edge);
  }
}
function applyTheme() {
  theme = THEMES[save.dark ? 'dark' : 'light'];
  document.documentElement.dataset.theme = save.dark ? 'dark' : 'light';
  mats.arrow.color.setHex(theme.arrow);
  mats.hint.color.setHex(theme.hint);
  mats.hint.emissive.setHex(theme.hint);
  mats.error.color.setHex(theme.error);
  mats.error.emissive.setHex(theme.error);
}
applyTheme();

const on = (id, fn) => $(id).addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
  sfx.click();
  fn();
});
on('themeBtn', toggleTheme);
on('hintBtn', useHint);
on('viewBtn', () => animateTo(ISO));
on('settingsBtn', () => {
  $('soundToggle').checked = save.sound;
  $('vibeToggle').checked = save.vibe;
  $('settings').classList.add('show');
});
on('closeSettings', () => $('settings').classList.remove('show'));
on('restartBtn', () => startLevel(game.level));
on('resetBtn', () => {
  if (!confirm('Reset all progress?')) return;
  Object.assign(save, { level: 1, score: 0, best: {}, hints: 3, stars: {} });
  persist();
  startLevel(1);
});
on('nextBtn', () => startLevel(game.level + 1));
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
on('replayBtn', () => startLevel(game.level));
on('retryBtn', () => startLevel(game.level));
$('soundToggle').addEventListener('change', (e) => {
  save.sound = audio.enabled = e.target.checked;
  persist();
});
$('vibeToggle').addEventListener('change', (e) => {
  save.vibe = e.target.checked;
  persist();
});

// ---------------------------------------------------------------- leaderboard
const lb = { rank: null, pending: false, error: false };

function pushScore() {
  if (!leaderboardEnabled || !save.name) return;
  lb.pending = true;
  lb.error = false;
  submitScore({ id: save.pid, name: save.name, score: save.score, level: save.level })
    .then((r) => (lb.rank = r.rank))
    .catch(() => (lb.error = true))
    .finally(() => {
      lb.pending = false;
      renderWinRank();
    });
}

function renderWinRank() {
  const el = $('winRank');
  if (!leaderboardEnabled) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (!save.name) {
    el.innerHTML = '<span>Join the world ranking 🏆</span>';
    el.onclick = openLeaderboard;
  } else if (lb.pending) {
    el.innerHTML = '<span>Updating ranking…</span>';
    el.onclick = null;
  } else if (lb.rank) {
    el.innerHTML = `<span>🏆 You're <b>#${lb.rank}</b> worldwide</span>`;
    el.onclick = openLeaderboard;
  } else {
    el.innerHTML = '<span>🏆 See the leaderboard</span>';
    el.onclick = openLeaderboard;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function openLeaderboard() {
  hideModals();
  $('lbName').value = save.name;
  $('lbJoin').hidden = !!save.name;
  $('lbList').innerHTML = '<p class="lb-msg">Loading…</p>';
  $('leaderboard').classList.add('show');
  loadLeaderboard();
}

function loadLeaderboard() {
  fetchTop(save.pid)
    .then(({ top, me, players }) => {
      const rows = top.map((r, i) => row(i + 1, r, r.me));
      if (me && me.rank > top.length) rows.push('<li class="gap">⋯</li>', row(me.rank, { name: save.name, ...me }, true));
      $('lbList').innerHTML = rows.length
        ? `<ol>${rows.join('')}</ol><p class="lb-msg">${players} player${players === 1 ? '' : 's'}</p>`
        : '<p class="lb-msg">No scores yet. Be the first!</p>';
      $('lbList').querySelector('.me')?.scrollIntoView({ block: 'nearest' });
    })
    .catch(() => ($('lbList').innerHTML = '<p class="lb-msg">Couldn\'t load the leaderboard. Check your connection.</p>'));
}

function row(rank, r, me) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1] || rank;
  return `<li class="${me ? 'me' : ''}"><span class="rk">${medal}</span><span class="nm">${esc(r.name)}</span>` +
    `<span class="lv">Lv ${r.level}</span><span class="sc">${Number(r.score).toLocaleString()}</span></li>`;
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
  $('lbList').innerHTML = '<p class="lb-msg">Saving…</p>';
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
const ease = (t) => 1 - Math.pow(1 - t, 3);
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
    mats.hint.emissiveIntensity = 0.25 + 0.25 * Math.sin(pulse * 8);

    for (const a of game.arrows) {
      if (a.state === 'exit') {
        a.v = Math.min(55, a.v + 80 * dt);
        a.s += a.v * dt;
        const t = a.track;
        if (!a.burst && a.s >= t.rayLen) {
          a.burst = true;
          const d = a.data.dir;
          const hp = t.window(t.bodyLen + t.rayLen - 0.01, t.bodyLen + t.rayLen)[0].b;
          burst(hp, new THREE.Vector3(d[0], d[1], d[2]), a.mesh.material.color, 8);
        }
        const end = t.total - t.bodyLen;
        if (a.s >= end) {
          a.state = 'gone';
          cube.remove(a.mesh);
          a.mesh.geometry.dispose();
          a.mesh.material.dispose();
          checkWin();
          continue;
        }
        a.mesh.material.opacity = 1 - Math.max(0, (a.s - t.rayLen) / (end - t.rayLen)) ** 1.5;
        buildArrowGeometry(t, a.s, a.s + t.bodyLen, a.mesh.geometry);
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
      } else if (a.flash > 0) {
        a.flash -= dt;
        if (a.flash <= 0 && a.state === 'idle') a.mesh.material = game.hinted === a ? mats.hint : mats.arrow;
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

// Debug/test hook.
window.__foz = { get game() { return game; }, tryFree, startLevel, blockersOf, headScreen: (a) => worldToScreen(headWorld(a)),
  facing: (a) => new THREE.Vector3(...a.data.cells[a.data.cells.length - 1].n).applyQuaternion(cube.quaternion).z };
