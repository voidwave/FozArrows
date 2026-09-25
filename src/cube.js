// Cube surface topology.
// Coordinates are "doubled" integers: the cube spans [-N, N] on every axis,
// cell centres sit on odd offsets inside a face, and the face plane is at ±N.
// A cell is identified by its centre point p; its face normal n is implied.

export const AXES = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const neg = (a) => [-a[0], -a[1], -a[2]];
export const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
export const key = (p) => p[0] + ',' + p[1] + ',' + p[2];

/** Directions tangent to the face with normal n. */
export function tangents(n) {
  return AXES.filter((a) => dot(a, n) === 0);
}

/** Face normal of a cell centre (the axis whose coordinate is ±N). */
export function normalOf(p, N) {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(p[i]) === N) {
      const n = [0, 0, 0];
      n[i] = Math.sign(p[i]);
      return n;
    }
  }
  throw new Error('not a surface cell: ' + p);
}

export function allCells(N) {
  const cells = [];
  for (const n of AXES) {
    const [a, b] = tangents(n).filter((t) => t[0] + t[1] + t[2] > 0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = add(add(scale(n, N), scale(a, 2 * i - N + 1)), scale(b, 2 * j - N + 1));
        cells.push({ p, n });
      }
    }
  }
  return cells;
}

/**
 * Move one cell from (p, n) in direction d, wrapping over cube edges.
 * Returns the new cell, the direction of travel on arrival and, when an
 * edge was crossed, the edge point that was passed.
 */
export function step(p, n, d, N) {
  const q = add(p, scale(d, 2));
  if (dot(q, d) <= N - 1) return { p: q, n, d, edge: null };
  return { p: sub(add(p, d), n), n: d, d: neg(n), edge: add(p, d) };
}

/** Cells in front of a head, on its own face, up to the face edge. */
export function rayCells(p, n, d, N) {
  const out = [];
  let q = add(p, scale(d, 2));
  while (dot(q, d) <= N - 1) {
    out.push(q);
    q = add(q, scale(d, 2));
  }
  return out;
}
