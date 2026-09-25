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
