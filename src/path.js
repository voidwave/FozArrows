import { DX, DY } from './grid.js';

/**
 * The route an arrow travels: along its own body, then straight out past the
 * edge of the board. The arrow is drawn as a window of length bodyLen sliding
 * along this route; s = 0 is its resting position. Units are cells.
 */
export class Path {
  constructor(arrow, W) {
    const raw = arrow.cells.map((c) => [(c % W) + 0.5, Math.floor(c / W) + 0.5]);
    const pts = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const p = raw[i];
      const n = pts.length;
      if (n >= 2) {
        const [a, b] = [pts[n - 2], pts[n - 1]];
        if ((b[0] - a[0]) * (p[1] - b[1]) === (b[1] - a[1]) * (p[0] - b[0])) {
          pts[n - 1] = p;
          continue;
        }
      }
      pts.push(p);
    }
    this.segs = [];
    this.len = 0;
    for (let i = 0; i + 1 < pts.length; i++) this.push(pts[i], pts[i + 1]);
    this.bodyLen = this.len;
    this.head = raw[raw.length - 1];
    this.dir = [DX[arrow.dir], DY[arrow.dir]];
  }

  push(a, b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) return;
    this.segs.push({ a, b, len, s0: this.len, t: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
    this.len += len;
  }

  /** Adds the exit run: `toEdge` cells to the board edge, then far enough for the tail to clear it. */
  addExit(W, H) {
    const [hx, hy] = this.head;
    const [dx, dy] = this.dir;
    this.toEdge = dx > 0 ? W - hx : dx < 0 ? hx : dy > 0 ? H - hy : hy;
    const far = this.toEdge + this.bodyLen + 1;
    this.push(this.head, [hx + dx * far, hy + dy * far]);
    this.exitEnd = this.toEdge + this.bodyLen + 0.6;
    return this;
  }

  at(s) {
    for (const g of this.segs) {
      if (s <= g.s0 + g.len + 1e-9) {
        const k = Math.max(0, s - g.s0);
        return [g.a[0] + g.t[0] * k, g.a[1] + g.t[1] * k];
      }
    }
    const g = this.segs[this.segs.length - 1];
    return g.b.slice();
  }

  /** Points of the route between s0 and s1. */
  window(s0, s1) {
    const out = [this.at(s0)];
    for (const g of this.segs) if (g.s0 > s0 && g.s0 < s1) out.push(g.a);
    out.push(this.at(s1));
    return out;
  }
}
