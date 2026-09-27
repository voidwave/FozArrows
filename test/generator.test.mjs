import assert from 'node:assert/strict';
import { generate, isSolvable } from '../src/generator.js';
import { step, key, dot, allCells } from '../src/cube.js';

// Topology: stepping around a straight line returns to the start after 4N moves.
for (const N of [3, 5, 8]) {
  for (const c of allCells(N)) {
    const d = [1, 0, 0].some((_, i) => c.n[i] !== 0 && i === 0) ? [0, 1, 0] : [1, 0, 0];
    let s = { p: c.p, n: c.n, d };
    for (let i = 0; i < 4 * N; i++) s = step(s.p, s.n, s.d, N);
    assert.equal(key(s.p), key(c.p));
    assert.equal(dot(s.d, d), 1);
  }
}

let total = 0, cells = 0;
for (let seed = 1; seed <= 300; seed++) {
  const N = 3 + (seed % 6);
  const pz = generate({ N, seed, maxLen: 3 + (seed % 8) });
  assert.ok(isSolvable(pz), 'seed ' + seed);
  const seen = new Set();
  for (const a of pz.arrows) {
    assert.ok(a.cells.length >= 2);
    for (let i = 0; i < a.links.length; i++) {
      const c = a.cells[i];
      const s = step(c.p, c.n, a.links[i].d, N);
      assert.equal(key(s.p), key(a.cells[i + 1].p));
    }
    for (const c of a.cells) {
      assert.ok(!seen.has(key(c.p)));
      seen.add(key(c.p));
    }
  }
  total += pz.arrows.length;
  cells += seen.size / (6 * N * N);
}
console.log('ok: avg arrows', (total / 300).toFixed(1), 'avg coverage', (cells / 300).toFixed(2));

// Special arrows: with lock/key constraints every level must still be solvable.
import { assignKinds } from '../src/specials.js';
import { blockersOf } from '../src/generator.js';
let lockLevels = 0;
for (let L = 1; L <= 80; L++) {
  const N = L === 1 ? 2 : L <= 4 ? 3 : L <= 9 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : L <= 40 ? 7 : 8;
  const seed = L * 7919 + 1013;
  const pz = generate({ N, seed, maxLen: 6 });
  assignKinds(pz.arrows, L, seed);
  const locks = pz.arrows.filter((a) => a.kind === 'lock');
  for (const l of locks) assert.ok(pz.arrows[l.keyId].id > l.id && pz.arrows[l.keyId].kind === 'key');
  if (locks.length) lockLevels++;
  const occ = new Map();
  for (const a of pz.arrows) for (const c of a.cells) occ.set(key(c.p), a.id);
  const left = new Set(pz.arrows.map((a) => a.id));
  let progress = true;
  while (left.size && progress) {
    progress = false;
    for (const id of left) {
      const a = pz.arrows[id];
      if (a.kind === 'lock' && left.has(a.keyId)) continue;
      if (blockersOf(a, occ, N)) continue;
      for (const c of a.cells) occ.delete(key(c.p));
      left.delete(id);
      progress = true;
    }
  }
  assert.equal(left.size, 0, 'level ' + L + ' not solvable with locks');
}
console.log('ok: specials, levels with locks:', lockLevels);
