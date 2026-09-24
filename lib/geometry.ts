/**
 * Airframe geometry for the SR20 G6 model.
 *
 * Axes: x forward, y up, z toward the right wing. Units: metres.
 * Fuselage profile traced from POH Figure 1-1 (three view); tailcone, fin and window
 * outlines traced from a G6 side photo (OO-CBB, s/n 2347, Wikimedia Commons).
 */
import * as THREE from "three";
import { V, clamp, lerp, toV, type Vec3 } from "./math";

type Ring = THREE.Vector3[];

/* ---------- generic builders ---------- */

/** Skins a list of point rings into a mesh. Rings must all have the same point count. */
export function loft(sections: Ring[], { closed = true, caps = true } = {}) {
  const N = sections[0].length, M = sections.length;
  const pos: number[] = [], idx: number[] = [];
  sections.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)));
  const J = closed ? N : N - 1;
  for (let i = 0; i < M - 1; i++)
    for (let j = 0; j < J; j++) {
      const a = i * N + j, b = i * N + ((j + 1) % N), c = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
      idx.push(a, c, b, b, c, d);
    }
  if (caps && closed) {
    [0, M - 1].forEach((i) => {
      const r = sections[i], c = new THREE.Vector3();
      r.forEach((p) => c.add(p));
      c.multiplyScalar(1 / N);
      const ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      for (let j = 0; j < N; j++) idx.push(ci, i * N + j, i * N + ((j + 1) % N));
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** NACA 4-digit style airfoil: returns [upper, lower] surface height as a fraction of chord. */
export function af(x: number, t: number, m: number): [number, number] {
  x = clamp(x, 0, 1);
  const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const p = 0.4;
  const yc = m === 0 ? 0 : x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
  return [yc + yt, yc - yt];
}

/** Closed airfoil outline between chord fractions c0..c1 (cosine-spaced). */
export function afRing(c0: number, c1: number, t: number, m: number, n = 16): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = c0 + (c1 - c0) * (1 - Math.cos(((1 - u) * Math.PI) / 2));
    pts.push([x, af(x, t, m)[0]]);
  }
  for (let i = 1; i <= n; i++) {
    const u = i / n, x = c0 + (c1 - c0) * (1 - Math.cos((u * Math.PI) / 2));
    pts.push([x, af(x, t, m)[1]]);
  }
  return pts;
}

/** Catmull-Rom interpolation over a table sorted by descending first column. */
function interp(tab: number[][], col: number, x: number) {
  const xs = tab.map((r) => r[0]);
  let i = 0;
  if (x >= xs[0]) return tab[0][col];
  if (x <= xs[xs.length - 1]) return tab[tab.length - 1][col];
  while (i < xs.length - 1 && !(x <= xs[i] && x >= xs[i + 1])) i++;
  const p0 = tab[Math.max(i - 1, 0)][col], p1 = tab[i][col], p2 = tab[i + 1][col], p3 = tab[Math.min(i + 2, tab.length - 1)][col];
  const t = (xs[i] - x) / (xs[i] - xs[i + 1]);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/* ---------- fuselage ---------- */

/** Firewall (FS 100) and aft baggage bulkhead (FS 222) stations. */
export const FW = 2.61, AB = -0.49;
export const GROUND_Y = -1.39;

// x, halfWidth, halfHeight, centerY — cowl & cabin from POH Fig. 1-1, tailcone from the G6 side photo
const FUS = [
  [3.74, 0.32, 0.155, -0.125], [3.66, 0.42, 0.24, -0.16], [3.52, 0.5, 0.3, -0.19], [3.3, 0.55, 0.35, -0.2], [2.96, 0.6, 0.4, -0.22], [2.61, 0.62, 0.45, -0.23],
  [2.31, 0.625, 0.575, -0.13], [2.01, 0.635, 0.654, -0.06], [1.71, 0.64, 0.7, -0.02], [1.26, 0.65, 0.718, 0.0], [0.65, 0.645, 0.69, -0.006],
  [0.05, 0.61, 0.623, -0.015], [-0.25, 0.54, 0.56, -0.03], [-0.55, 0.47, 0.485, -0.045], [-0.85, 0.39, 0.443, -0.047], [-1.15, 0.31, 0.398, -0.063],
  [-1.6, 0.2, 0.368, -0.062], [-2.05, 0.145, 0.355, -0.045], [-2.4, 0.12, 0.33, -0.05], [-2.8, 0.1, 0.27, -0.07], [-3.1, 0.08, 0.2, -0.1],
  [-3.3, 0.04, 0.09, -0.11], [-3.36, 0.015, 0.03, -0.11],
];
export const fus = (x: number) => ({ hw: interp(FUS, 1, x), hh: interp(FUS, 2, x), cy: interp(FUS, 3, x) });
export const topY = (x: number) => fus(x).cy + fus(x).hh;
export const botY = (x: number) => fus(x).cy - fus(x).hh;

// Cross-section: rounder top (n 2.4) with tumblehome, flatter belly (n 3)
export const NT = 2.4, NB = 3.0, TUMBLE = 0.2;

export function fRing(x: number, s = 1, N = 40, th0 = 0, th1 = Math.PI * 2, closed = true): Ring {
  const { hw, hh, cy } = fus(x), pts: Ring = [], cnt = closed ? N : N + 1;
  for (let j = 0; j < cnt; j++) {
    const th = closed ? (j / N) * Math.PI * 2 : th0 + ((th1 - th0) * j) / N;
    const c = Math.cos(th), sn = Math.sin(th), n = sn >= 0 ? NT : NB;
    const py = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), pz = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    pts.push(V(x, cy + s * hh * py, s * hw * (1 - TUMBLE * Math.max(0, py)) * pz));
  }
  return pts;
}

/** Is a point inside the fuselage skin (with margin m, metres)? */
export function inFus(p: THREE.Vector3, m = 0) {
  if (p.x > 3.74 || p.x < -3.36) return false;
  const { hw, hh, cy } = fus(p.x);
  const py = (p.y - cy) / (hh - m);
  if (Math.abs(py) > 1) return false;
  const n = py >= 0 ? NT : NB, w = (hw - m) * (1 - TUMBLE * Math.max(0, py));
  return Math.pow(Math.abs(p.z) / w, n) + Math.pow(Math.abs(py), n) <= 1;
}

/** Point on the outer skin at (x, y) on the given side (+1 right, -1 left). */
export function onSkin(x: number, y: number, side: number, push = 1.006) {
  const { hw, hh, cy } = fus(x);
  const py = clamp((y - cy) / hh, -1, 1), n = py >= 0 ? NT : NB;
  const w = hw * (1 - TUMBLE * Math.max(0, py));
  return V(x, y, side * w * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(py), n)), 1 / n) * push);
}

/* ---------- wing: root buried at z 0.35, rounded tip from z 5.2, ~5° dihedral ---------- */
export const WR = 0.35, WTIP = 5.84, WSPAN = WTIP - WR;
const tipCut = (z: number) => { const a = Math.abs(z); return a > 5.2 ? 0.28 * Math.pow((a - 5.2) / 0.64, 2) : 0; };
export const wLE = (z: number) => 1.75 - (Math.abs(z) - WR) * 0.04 - tipCut(z);
export const wC = (z: number) => 1.5 - ((Math.abs(z) - WR) / WSPAN) * 0.7 - tipCut(z);
export const wY = (z: number) => -0.6 + (Math.abs(z) - WR) * 0.09;
export const wT = (z: number) => 0.15 - ((Math.abs(z) - WR) / WSPAN) * 0.04;

/** Point on the wing at span z and chord fraction xc; up = +1 upper, -1 lower, 0 mean line. */
export const wingP = (z: number, xc: number, up = 0) => {
  const c = wC(z), [u, l] = af(xc, wT(z), 0.02);
  return V(wLE(z) - xc * c, wY(z) + (up > 0 ? u : up < 0 ? l : (u + l) / 2) * c, z);
};
export const wingSec = (z: number, c0: number, c1: number, scale = 1): Ring => {
  const c = wC(z);
  return afRing(c0, c1, wT(z) * scale, 0.02).map(([x, y]) => V(wLE(z) - x * c, wY(z) + y * c, z));
};

/* ---------- horizontal tail: root from the G6 photo, tip from POH plan view (~3.9 m span) ---------- */
export const sLE = (z: number) => -2.23 - Math.abs(z) * 0.215;
export const sC = (z: number) => 0.9 - (Math.abs(z) / 1.95) * 0.35;
export const SY = -0.02, SSPAN = 1.95, EF = 0.68;
/** Elevator horn balance: outboard of HZ the elevator reaches forward to HF chord. */
export const HZ = 1.72, HF = 0.5;
/** Rudder horn balance: above HH the rudder reaches forward to HR chord. */
export const HH = 1.36, HR = 0.45;
export const stabSec = (z: number, c0: number, c1: number): Ring => {
  const c = sC(z);
  return afRing(c0, c1, 0.1, 0).map(([x, y]) => V(sLE(z) - x * c, SY + y * c, z));
};

/* ---------- fin: dorsal fillet from x -1.95, swept LE, flat top ---------- */
// [height, leading edge x, trailing edge x] traced from the G6 side photo
export const FIN = [
  [-0.25, -2.95, -3.25], [-0.1, -2.7, -3.36], [0.05, -2.45, -3.41], [0.2, -2.15, -3.43], [0.31, -1.95, -3.44], [0.35, -2.14, -3.445],
  [0.4, -2.29, -3.45], [0.45, -2.42, -3.455], [0.52, -2.56, -3.465], [0.8, -2.7, -3.52], [1.1, -2.88, -3.585], [1.32, -3.0, -3.63], [1.42, -3.1, -3.65], [1.47, -3.24, -3.66],
];
const finAt = (h: number) => {
  let i = 0;
  while (i < FIN.length - 2 && h > FIN[i + 1][0]) i++;
  const [h0, a0, b0] = FIN[i], [h1, a1, b1] = FIN[i + 1], t = clamp((h - h0) / (h1 - h0), 0, 1);
  return [lerp(a0, a1, t), lerp(b0, b1, t)];
};
export const fLE = (h: number) => finAt(h)[0];
export const fC = (h: number) => finAt(h)[0] - finAt(h)[1];
const RH = [[-0.2, -2.98], [1.44, -3.44]]; // rudder hinge line (height, x)
export const hingeX = (h: number) => lerp(RH[0][1], RH[1][1], (h - RH[0][0]) / (RH[1][0] - RH[0][0]));
const rFrac = (h: number) => (h < RH[0][0] || h > RH[1][0] ? 1 : clamp((fLE(h) - hingeX(h)) / fC(h), 0.05, 1));
export const finCut = (h: number) => (h >= HH ? HR : rFrac(h));
export const finSec = (h: number, c0: number, c1: number): Ring => {
  const c = fC(h), t = Math.min(0.11, 0.1 / c);
  return afRing(c0, c1, t, 0).map(([x, y]) => V(fLE(h) - x * c, h, y * c));
};
export const finHs = [...FIN.map((r) => r[0]).filter((h) => h < HH), HH - 0.002, HH, ...FIN.map((r) => r[0]).filter((h) => h > HH)];

/* ---------- small primitives ---------- */
export const box = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz);
export const cyl = (r: number, h: number, axis: "x" | "y" | "z" = "y", seg = 20) => {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  return g;
};
export const sph = (r: number) => new THREE.SphereGeometry(r, 16, 12);

export function curveOf(points: (Vec3 | THREE.Vector3)[], tension = 0.15) {
  return new THREE.CatmullRomCurve3(points.map(toV), false, "catmullrom", tension);
}
export function tubeGeo(points: (Vec3 | THREE.Vector3)[], r: number, tension = 0.15) {
  const curve = curveOf(points, tension);
  return new THREE.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 24)), r, 8, false);
}

/** Flat plate filling the fuselage cross-section at x. */
export function planeRing(x: number, s = 0.98) {
  const r = fRing(x, s, 40);
  const g = new THREE.ShapeGeometry(new THREE.Shape(r.map((p) => new THREE.Vector2(p.z, p.y))));
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/** Slab filling the section at xr, clipped to the band y0..y1, extruded by depth around x. */
export function sectionSlab(x: number, y0: number, y1: number, s: number, depth: number, xr = x) {
  const clipY = (poly: THREE.Vector2[], yc: number, keepAbove: boolean) => {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const ina = keepAbove ? A.y >= yc : A.y <= yc, inb = keepAbove ? B.y >= yc : B.y <= yc;
      if (ina) out.push(A);
      if (ina !== inb) { const t = (yc - A.y) / (B.y - A.y); out.push(new THREE.Vector2(A.x + (B.x - A.x) * t, yc)); }
    }
    return out;
  };
  const pts = clipY(clipY(fRing(xr, s, 72).map((p) => new THREE.Vector2(p.z, p.y)), y0, true), y1, false);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(x - depth / 2, 0, 0);
  return g;
}

/** Teardrop wheel fairing: blunt nose, pointed tail, widest at the axle. */
export function pantGeo(len: number, r: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const h = (i / 24) * len, u = 1 - h / len;
    pts.push(new THREE.Vector2(r * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.55)), 0.8) + 1e-4, h));
  }
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateZ(-Math.PI / 2);
  g.translate(-len * 0.72, 0, 0);
  return g;
}

/* ---------- windows & painted skin ---------- */
export const SK = { x0: -3.45, x1: 4.2, y0: -0.95, y1: 1.0, W: 2048, H: 512 };

export function roundPoly(pts: number[][], cut = 0.14, it = 2) {
  let p: number[][] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    p.push(a, [lerp(a[0], b[0], cut), lerp(a[1], b[1], cut)], [lerp(a[0], b[0], 1 - cut), lerp(a[1], b[1], 1 - cut)]);
  });
  for (let k = 0; k < it; k++) {
    const o: number[][] = [];
    p.forEach((a, i) => {
      const b = p[(i + 1) % p.length];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    });
    p = o;
  }
  return p;
}

export const WIN = {
  /** Gull-wing door window: slanted front edge parallel to the A-pillar, near-vertical rear edge. */
  front: roundPoly([[1.64, 0.12], [1.43, 0.575], [0.93, 0.59], [0.99, 0.11]], 0.16),
  /** Fixed rear window: straight front edge, top follows the roof, large rounded aft edge. */
  rear: roundPoly([[0.79, 0.11], [0.78, 0.4], [0.72, 0.5], [0.62, 0.535], [0.4, 0.505], [0.18, 0.44], [0.06, 0.38], [0.015, 0.3], [0.04, 0.22], [0.12, 0.16], [0.3, 0.125], [0.6, 0.1]], 0.3, 2),
  /** Wrap-around windshield: lower side edge then A-pillar up to the roof. */
  windLower: [[2.45, 0.24], [1.93, 0.12], [1.73, 0.6]],
};

export const densify = (pts: number[][], step = 0.03, close = true) => {
  const o: number[][] = [];
  const N = close ? pts.length : pts.length - 1;
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) o.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  if (!close) o.push(pts[pts.length - 1]);
  return o;
};

/** Window outline loops projected onto the skin (both sides + windshield). */
export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [];
  [1, -1].forEach((s) => [WIN.front, WIN.rear].forEach((w) => loops.push(densify(w).map(([x, y]) => onSkin(x, y, s)))));
  const thAt = (x: number, y: number) => { const { hh, cy } = fus(x); return Math.asin(Math.pow(clamp((y - cy) / hh, 0, 1), NT / 2)); };
  const side = (s: number) => densify(WIN.windLower, 0.03, false).map(([x, y]) => onSkin(x, y, s));
  const ta = thAt(1.73, 0.6), tb = thAt(2.45, 0.24);
  loops.push([...side(1), ...fRing(1.73, 1.006, 40, ta, Math.PI - ta, false), ...side(-1).reverse(), ...fRing(2.45, 1.006, 40, Math.PI - tb, tb, false)]);
  return loops;
}

/** Fuselage loft with side-projected UVs for the painted skin texture. */
export function fuselageGeo() {
  const secs: Ring[] = [];
  for (let x = 3.74; x > -3.36; x -= 0.06) secs.push(fRing(x, 1, 48));
  secs.push(fRing(-3.36, 1, 48));
  const g = loft(secs);
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = (pos.getX(i) - SK.x0) / (SK.x1 - SK.x0);
    uv[2 * i + 1] = (pos.getY(i) - SK.y0) / (SK.y1 - SK.y0);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Paints window shapes, door seam and G6 pinstripes (browser only). */
export function paintSkin(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = SK.W; c.height = SK.H;
  const g = c.getContext("2d")!;
  const P = ([x, y]: number[]) => [((x - SK.x0) / (SK.x1 - SK.x0)) * SK.W, (1 - (y - SK.y0) / (SK.y1 - SK.y0)) * SK.H];
  const path = (pts: number[][], close = true) => {
    g.beginPath();
    pts.forEach((q, i) => { const [a, b] = P(q); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
    if (close) g.closePath();
  };
  g.fillStyle = "#F3F5F6"; g.fillRect(0, 0, SK.W, SK.H);
  path(roundPoly([[1.96, -0.3], [1.94, 0.12], [1.74, 0.64], [0.84, 0.67], [0.8, -0.3]], 0.12)); g.strokeStyle = "#A9B2B9"; g.lineWidth = 2; g.stroke();
  path([[3.25, -0.37], [2.42, -0.25], [1.66, -0.15], [0.9, -0.03], [0.14, 0.12], [-0.75, 0.1], [-1.77, 0.15], [-2.79, 0.2], [-3.45, 0.23]], false); g.strokeStyle = "#C8313B"; g.lineWidth = 4; g.stroke();
  path([[3.2, -0.4], [2.16, -0.28], [1.4, -0.2], [0.64, -0.05], [-0.5, 0.04], [-1.77, 0.1], [-3.45, 0.18]], false); g.strokeStyle = "#20262B"; g.lineWidth = 6; g.stroke();
  const glass = () => { const gr = g.createLinearGradient(0, P([0, 0.7])[1], 0, P([0, 0.1])[1]); gr.addColorStop(0, "#3A4C5A"); gr.addColorStop(1, "#131C24"); return gr; };
  path([[2.45, 0.24], [1.93, 0.12], [1.73, 0.6], [1.72, 1.0], [2.47, 1.0]]); g.fillStyle = glass(); g.fill();
  [WIN.front, WIN.rear].forEach((w) => { path(w); g.fillStyle = glass(); g.fill(); g.strokeStyle = "#0B1014"; g.lineWidth = 3; g.stroke(); });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
