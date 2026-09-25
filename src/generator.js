import { allCells, step, rayCells, tangents, neg, eq, key } from './cube.js';
import { mulberry32, shuffle } from './rng.js';

/**
 * Builds a solvable arrow puzzle on the surface of an N×N×N cube.
 *
 * Arrows are placed in reverse removal order: a new arrow only needs its exit
 * ray to be clear of the arrows already placed, since those leave after it.
 * Every arrow placed this way can therefore be cleared, so the whole puzzle is
 * guaranteed to be solvable.
 *
 * An arrow is { id, cells: [{p, n}] (tail → head), links: [{d, edge}], dir }.
 * links[i] describes the move from cells[i] to cells[i + 1].
 */
export function generate({ N, seed, minLen = 2, maxLen = 6, turnP = 0.4, fill = 1 }) {
  const rng = mulberry32(seed);
  const occ = new Map();
  const arrows = [];
  const cells = allCells(N);

  const tryArrow = (head, target) => {
    const dirs = shuffle(tangents(head.n).slice(), rng);
    for (const d of dirs) {
      const ray = rayCells(head.p, head.n, d, N);
      if (ray.some((q) => occ.has(key(q)))) continue;
      const blocked = new Set(ray.map(key));
      const body = [head];
      const links = [];
      const used = new Set([key(head.p)]);
      let cur = head;
      let leave = d;
      while (body.length < target) {
        let cands;
        if (body.length === 1) cands = [d];
        else {
          const turns = shuffle(tangents(cur.n).filter((e) => !eq(e, leave) && !eq(e, neg(leave))), rng);
          cands = rng() < turnP ? [...turns, leave] : [leave, ...turns];
        }
        let next = null;
        for (const e of cands) {
          const b = step(cur.p, cur.n, neg(e), N);
          const k = key(b.p);
          if (occ.has(k) || used.has(k) || blocked.has(k)) continue;
          next = { cell: { p: b.p, n: b.n }, link: { d: neg(b.d), edge: b.edge } };
          break;
        }
        if (!next) break;
        body.unshift(next.cell);
        links.unshift(next.link);
        used.add(key(next.cell.p));
        cur = next.cell;
        leave = next.link.d;
      }
      if (body.length < Math.min(minLen, target)) continue;
      const arrow = { id: arrows.length, cells: body, links, dir: d };
      arrows.push(arrow);
      for (const c of body) occ.set(key(c.p), arrow.id);
      return true;
    }
    return false;
  };

  const lenRange = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  for (let pass = 0; pass < 4; pass++) {
    const lo = pass < 2 ? minLen : 2;
    for (const c of shuffle(cells.slice(), rng)) {
      if (occ.has(key(c.p))) continue;
      if (rng() > fill) continue;
      tryArrow(c, lenRange(lo, maxLen));
    }
  }
  return { N, arrows };
}

/** Cells in front of an arrow's head that are occupied, in order. */
export function blockersOf(arrow, occ, N) {
  const head = arrow.cells[arrow.cells.length - 1];
  const ray = rayCells(head.p, head.n, arrow.dir, N);
  for (let i = 0; i < ray.length; i++) {
    const id = occ.get(key(ray[i]));
    if (id !== undefined && id !== arrow.id) return { id, dist: i };
  }
  return null;
}

/** Greedy solver: removing an arrow never blocks another, so greedy is exact. */
export function isSolvable(puzzle) {
  const occ = new Map();
  for (const a of puzzle.arrows) for (const c of a.cells) occ.set(key(c.p), a.id);
  let left = new Set(puzzle.arrows.map((a) => a.id));
  let progress = true;
  while (left.size && progress) {
    progress = false;
    for (const id of left) {
      const a = puzzle.arrows[id];
      if (!blockersOf(a, occ, puzzle.N)) {
        for (const c of a.cells) occ.delete(key(c.p));
        left.delete(id);
        progress = true;
      }
    }
  }
  return left.size === 0;
}
