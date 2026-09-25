import * as THREE from 'three';
import { dot, add, scale } from './cube.js';

// Visual constants, in world units (one cell = 1).
export const LINE_W = 0.2;
export const HEAD_W = 0.56;
export const HEAD_L = 0.46;
const LIFT = 0.015;

const v3 = (p) => new THREE.Vector3(p[0] / 2, p[1] / 2, p[2] / 2);

/**
 * The path an arrow travels along: its body, then straight ahead to the face
 * edge, then off the cube into the air. The arrow is drawn as a window of
 * length bodyLen sliding along this track.
 */
export class Track {
  constructor(arrow, N) {
    const pts = [v3(arrow.cells[0].p)];
    const normals = [];
    for (let i = 0; i < arrow.links.length; i++) {
      const { edge } = arrow.links[i];
      if (edge) {
        pts.push(v3(edge));
        normals.push(v3(arrow.cells[i].n).multiplyScalar(2));
        pts.push(v3(arrow.cells[i + 1].p));
        normals.push(v3(arrow.cells[i + 1].n).multiplyScalar(2));
      } else {
        pts.push(v3(arrow.cells[i + 1].p));
        normals.push(v3(arrow.cells[i].n).multiplyScalar(2));
      }
    }
    const head = arrow.cells[arrow.cells.length - 1];
    const edgePt = add(head.p, scale(arrow.dir, N - dot(head.p, arrow.dir)));
    const hn = v3(head.n).multiplyScalar(2);
    const segs = [];
    let s = 0;
    const push = (a, b, n) => {
      const len = a.distanceTo(b);
      if (len < 1e-6) return;
      const t = b.clone().sub(a).divideScalar(len);
      const last = segs[segs.length - 1];
      if (last && last.n.equals(n) && last.t.dot(t) > 0.999) {
        last.b = b;
        last.len += len;
      } else segs.push({ a, b, n, t, len, s0: s });
      s += len;
    };
    for (let i = 0; i < normals.length; i++) push(pts[i], pts[i + 1], normals[i]);
    this.bodyLen = s;
    const e = v3(edgePt);
    push(pts[pts.length - 1], e, hn);
    this.rayLen = s - this.bodyLen;
    const fly = N * 0.9 + this.bodyLen + 2;
    push(e, e.clone().addScaledVector(v3(arrow.dir).multiplyScalar(2), fly), hn);
    this.flyLen = fly;
    this.total = s;
    this.segs = segs;
  }

  /** Pieces of the track covering [s0, s1]. */
  window(s0, s1) {
    const out = [];
    for (const g of this.segs) {
      const a = Math.max(s0, g.s0);
      const b = Math.min(s1, g.s0 + g.len);
      if (b - a < 1e-6) continue;
      out.push({
        a: g.a.clone().addScaledVector(g.t, a - g.s0),
        b: g.a.clone().addScaledVector(g.t, b - g.s0),
        n: g.n,
        t: g.t,
      });
    }
    return out;
  }
}

const tmpSide = new THREE.Vector3();

/** Fills a geometry with a flat ribbon + arrow head for track window [s0, s1]. */
export function buildArrowGeometry(track, s0, s1, geom) {
  const pos = [];
  const nor = [];
  const quad = (a, b, c, d, n) => {
    // a-b-c-d counter-clockwise when viewed from the n side
    for (const p of [a, b, c, a, c, d]) pos.push(p.x, p.y, p.z);
    for (let i = 0; i < 6; i++) nor.push(n.x, n.y, n.z);
  };
  const tri = (a, b, c, n) => {
    for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
    for (let i = 0; i < 3; i++) nor.push(n.x, n.y, n.z);
  };

  const bodyEnd = Math.max(s0, s1 - HEAD_L * 0.5);
  const pieces = track.window(s0, bodyEnd);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const prev = pieces[i - 1];
    const next = pieces[i + 1];
    const ext = (o) => (!o ? 0 : o.n.equals(p.n) ? LINE_W / 2 : LIFT);
    const lift = p.n.clone().multiplyScalar(LIFT);
    const a = p.a.clone().addScaledVector(p.t, -ext(prev)).add(lift);
    const b = p.b.clone().addScaledVector(p.t, ext(next)).add(lift);
    tmpSide.crossVectors(p.n, p.t).multiplyScalar(LINE_W / 2);
    quad(a.clone().sub(tmpSide), b.clone().sub(tmpSide), b.clone().add(tmpSide), a.clone().add(tmpSide), p.n);
  }

  // Arrow head, centred on s1.
  const hp = track.window(Math.max(0, s1 - 1e-3), s1 + 1e-3);
  const h = hp[hp.length - 1] || track.window(s1 - 0.01, s1)[0];
  if (h) {
    const lift = h.n.clone().multiplyScalar(LIFT * 1.2);
    const c = h.b.clone().add(lift);
    const tip = c.clone().addScaledVector(h.t, HEAD_L * 0.5);
    const base = c.clone().addScaledVector(h.t, -HEAD_L * 0.5);
    tmpSide.crossVectors(h.n, h.t).multiplyScalar(HEAD_W / 2);
    tri(base.clone().sub(tmpSide), tip, base.clone().add(tmpSide), h.n);
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geom.computeBoundingSphere();
  return geom;
}
