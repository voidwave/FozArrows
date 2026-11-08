import assert from 'node:assert/strict';
import { generate, isSolvable, rayCells } from '../src/grid.js';
import { levelConfig } from '../src/levels.js';

const levels = [1, 2, 3, 5, 8, 12, 20, 35, 50, 80, 120, 200, 300, 450, 600, 999];
for (let L = 1; L <= 150; L++) if (!levels.includes(L)) levels.push(L);
let worst = 1;
for (const L of levels) {
  const cfg = levelConfig(L);
  const t0 = Date.now();
  const pz = generate(cfg);
  const ms = Date.now() - t0;
  const { W, H } = cfg;
  assert.ok(isSolvable(pz), 'level ' + L + ' not solvable');
  const seen = new Set();
  for (const a of pz.arrows) {
    assert.ok(a.cells.length >= 2, 'level ' + L + ' has a 1-cell arrow');
    for (let i = 0; i < a.cells.length; i++) {
      const c = a.cells[i];
      assert.ok(!seen.has(c), 'overlap');
      seen.add(c);
      if (i) {
        const p = a.cells[i - 1];
        assert.equal(Math.abs((p % W) - (c % W)) + Math.abs(Math.floor(p / W) - Math.floor(c / W)), 1, 'gap in arrow');
      }
    }
    // The head's direction continues its last segment.
    const [p, h] = a.cells.slice(-2);
    assert.equal(rayCells(W, H, p, a.dir)[0], h, 'head direction mismatch');
  }
  const cover = seen.size / (W * H);
  worst = Math.min(worst, cover);
  if ([1, 20, 100, 300, 999].includes(L))
    console.log(`L${L}: ${W}x${H}, ${pz.arrows.length} arrows, ${(cover * 100).toFixed(1)}% filled, ${ms}ms`);
}
console.log('ok:', levels.length, 'levels solvable; lowest fill', (worst * 100).toFixed(1) + '%');
