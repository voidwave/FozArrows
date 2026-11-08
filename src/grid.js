import { mulberry32, shuffle } from './rng.js';

// Directions: 0 up, 1 right, 2 down, 3 left. Cells are indexed y * W + x.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

function step(W, H, idx, d) {
  const x = (idx % W) + DX[d];
  const y = Math.floor(idx / W) + DY[d];
  return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
}

/** Cells in front of a head, up to the edge of the board. */
export function rayCells(W, H, idx, d) {
  const out = [];
  for (let c = step(W, H, idx, d); c >= 0; c = step(W, H, c, d)) out.push(c);
  return out;
}

/**
 * Builds a solvable arrow maze on a W×H board.
 *
 * Arrows are placed in reverse removal order: a new arrow only needs its exit
 * path to be clear of the arrows already placed, because those leave after
 * it. So every puzzle built this way can be cleared.
 *
 * An arrow is { id, cells: [tail ... head], dir }. It slides forward along its
 * own body and leaves the board in direction `dir`.
 */
export function generate({ W, H, seed, minLen = 2, maxLen = 8, turnP = 0.45, spread = 0.35 }) {
  const rng = mulberry32(seed);
  const N = W * H;
  const occ = new Int32Array(N).fill(-1);
  // Highest arrow id whose exit path crosses each cell. A cell may only be
  // given to arrow `id` if no arrow with id >= `id` needs to pass through it.
  const rayMax = new Int32Array(N).fill(-1);
  const arrows = [];

  const place = (cells, dir) => {
    const id = arrows.length;
    arrows.push({ id, cells, dir });
    for (const c of cells) occ[c] = id;
    for (const c of rayCells(W, H, cells[cells.length - 1], dir)) rayMax[c] = id;
  };

  const tryArrow = (head, target) => {
    for (const d of shuffle([0, 1, 2, 3], rng)) {
      const ray = rayCells(W, H, head, d);
      if (ray.some((c) => occ[c] >= 0)) continue;
      const onRay = new Set(ray);
      const body = [head];
      const used = new Set(body);
      let cur = head;
      let leave = d; // direction the body moves when leaving `cur`
      while (body.length < target) {
        let cands;
        if (body.length === 1) cands = [d];
        else {
          const turns = shuffle([(leave + 1) % 4, (leave + 3) % 4], rng);
          cands = rng() < turnP ? [...turns, leave] : [leave, ...turns];
        }
        let next = -1;
        for (const e of cands) {
          const p = step(W, H, cur, (e + 2) % 4);
          if (p < 0 || occ[p] >= 0 || used.has(p) || onRay.has(p)) continue;
          next = p;
          leave = e;
          break;
        }
        if (next < 0) break;
        body.unshift(next);
        used.add(next);
        cur = next;
      }
      if (body.length < Math.min(minLen, target)) continue;
      place(body, d);
      return true;
    }
    return false;
  };

  // Fill roughly from the centre outwards: arrows placed early (which leave
  // last) have long, open exit paths, and the ones placed late near the rim
  // only need short ones. This packs the board much more tightly.
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const R = Math.hypot(cx, cy) || 1;
  const order = Array.from({ length: N }, (_, i) => i)
    .map((i) => [i, Math.hypot((i % W) - cx, Math.floor(i / W) - cy) / R + rng() * spread])
    .sort((p, q) => p[1] - q[1])
    .map((p) => p[0]);
  for (let pass = 0; pass < 4; pass++) {
    const lo = pass < 2 ? minLen : 2;
    for (const c of pass === 0 ? order : shuffle(order.slice(), rng)) {
      if (occ[c] < 0) tryArrow(c, lo + Math.floor(rng() * (Math.max(lo, maxLen) - lo + 1)));
    }
  }

  // Fill leftover holes by stretching a neighbouring arrow into them: its tail
  // backwards, or its head straight forwards. Allowed only when no arrow that
  // leaves earlier (a higher id) has to pass through the hole.
  for (let grew = true; grew; ) {
    grew = false;
    for (let c = 0; c < N; c++) {
      if (occ[c] >= 0) continue;
      for (let d = 0; d < 4; d++) {
        const n = step(W, H, c, d);
        if (n < 0 || occ[n] < 0) continue;
        const a = arrows[occ[n]];
        if (a.cells[0] === n && rayMax[c] < a.id) {
          a.cells.unshift(c);
        } else if (a.cells[a.cells.length - 1] === n && a.dir === (d + 2) % 4 && rayMax[c] === a.id) {
          a.cells.push(c);
        } else continue;
        occ[c] = a.id;
        grew = true;
        break;
      }
    }
  }
  return { W, H, arrows };
}

/** First arrow standing in front of `arrow`'s head, and how many free cells come before it. */
export function blockersOf(W, H, arrow, occ) {
  const ray = rayCells(W, H, arrow.cells[arrow.cells.length - 1], arrow.dir);
  for (let i = 0; i < ray.length; i++) {
    const id = occ[ray[i]];
    if (id >= 0 && id !== arrow.id) return { id, dist: i };
  }
  return null;
}

/** Greedy solver: removing an arrow never blocks another, so greedy is exact. */
export function isSolvable({ W, H, arrows }) {
  const occ = new Int32Array(W * H).fill(-1);
  for (const a of arrows) for (const c of a.cells) occ[c] = a.id;
  const left = new Set(arrows.map((a) => a.id));
  for (let progress = true; progress && left.size; ) {
    progress = false;
    for (const id of left) {
      if (blockersOf(W, H, arrows[id], occ)) continue;
      for (const c of arrows[id].cells) occ[c] = -1;
      left.delete(id);
      progress = true;
    }
  }
  return left.size === 0;
}
