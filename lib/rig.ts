/**
 * Flight-control mechanisms laid out after POH Figures 7-1 (elevator), 7-2 (aileron) and 7-3 (rudder).
 *
 * Elevator: yoke tubes → drop links → lever arms on a lateral torque tube under the panel → forward
 *   sector → crossed cable pair → forward double pulley (under floor) → intermediate double pulley →
 *   aft sector pulley → push-pull tube → elevator bellcrank between the elevator halves.
 * Aileron: yokes rotate in pivoting bearing carriages → lateral push rod → central pulley sector →
 *   floor double pulley → cables aft of the rear spar → turning pulleys → each wing → vertical sector /
 *   crank arm at the aileron (conical drive arm); a balance cable links the two wing sectors.
 * Rudder: four pedals on a pedal torque tube → cable horn → forward double pulley → intermediate
 *   double pulley → aft sector beside the elevator sector → push-pull tube → rudder bellcrank.
 */
import * as THREE from "three";
import { hingeX, sC, sLE, EF, SY, wingP } from "./geometry";
import { D2R, V, type Vec3 } from "./math";
import type { Sim } from "./sim/model";

export type Axis = "x" | "y" | "z";
export interface PulleyDef { c: Vec3; r: number; axis: Axis; double?: boolean; gap?: number }

/* ---------- geometry constants (airplane coordinates, metres) ---------- */
export const ETT = { c: [2.3, -0.36, 0] as Vec3, half: 0.48, lever: 0.1, sectorR: 0.12, sectorZ: 0.06 };
export const CARR = { x: 2.46, y: -0.06, z: 0.46, armX: 0.08, arm: 0.14 };
export const AIL_SECTOR = { c: [2.54, -0.3, 0] as Vec3, r: 0.1 };
export const RUD_HORN = { c: [2.4, -0.58, 0.13] as Vec3, half: 0.06 };
export const PEDAL_TT = { x: 2.46, y: -0.61, half: 0.4 };
export const ELEV_HORN = { c: [sLE(0) - EF * sC(0), SY, 0] as Vec3, arm: 0.1 };
const rudHingeH = -0.1;
export const RUD_HORN_AFT = { c: [hingeX(rudHingeH), rudHingeH, 0] as Vec3, arm: 0.06 };

/** Torque-tube levers point up-forward; drop links run forward-down to them at right angles (Fig. 7-1). */
export const LEVER_ANG = Math.PI / 4;
const TIP0 = [ETT.c[0] + ETT.lever * Math.sin(LEVER_ANG), ETT.c[1] + ETT.lever * Math.cos(LEVER_ANG)];
const EYE_Y = CARR.y - 0.02;
const DROP_LEN = (EYE_Y - TIP0[1]) / Math.sin(LEVER_ANG);
/** Drop-link eye on the yoke tube with the yoke at neutral. */
export const EYE_X0 = TIP0[0] - DROP_LEN * Math.cos(LEVER_ANG);
/** Yoke tube travel for full pitch input (the Yokes group slides by this much). */
export const YOKE_TRAVEL = 0.07;

/** Right-angle drive at each aileron: crank on the wing sector → link → short arm up from the aileron hinge. */
export const AIL_DRIVE = { crank: 0.075, lift: 0.016, arm: 0.025, z: 3.72 };

const wingSectorAt = (s: number) => { const p = wingP(s * 3.6, 0.66, 0); return [p.x, p.y, p.z] as Vec3; };
const turnAt = (s: number): Vec3 => [0.55, -0.6, s * 0.1];

export const PULLEYS: Record<string, PulleyDef & { name: string; note: string; sys: "controls" }> = {
  ef: { c: [2.22, -0.62, 0.06], r: 0.04, axis: "z", double: true, gap: 0.03, sys: "controls", name: "Forward elevator pulleys", note: "Double pulley under the cabin floor: turns the crossed cable pair from the forward sector aft (POH Fig. 7-1)." },
  em: { c: [0.35, -0.58, 0.06], r: 0.035, axis: "z", double: true, gap: 0.03, sys: "controls", name: "Intermediate elevator pulleys", note: "Double pulley aft of the rear spar where the cables start climbing into the tailcone." },
  ea: { c: [-2.45, -0.14, 0], r: 0.09, axis: "z", sys: "controls", name: "Aft elevator sector pulley", note: "Large pulley in the tailcone. Its crank pin drives the push-pull tube to the elevator bellcrank." },
  af: { c: [2.54, -0.62, -0.05], r: 0.035, axis: "z", double: true, gap: 0.03, sys: "controls", name: "Aileron floor pulleys", note: "Double pulley below the central sector; routes both aileron cables under the floor." },
  atR: { c: turnAt(1), r: 0.05, axis: "y", sys: "controls", name: "Aileron turning pulleys", note: "Aft of the rear spar the cables turn outboard into each wing." },
  atL: { c: turnAt(-1), r: 0.05, axis: "y", sys: "controls", name: "Aileron turning pulleys", note: "Aft of the rear spar the cables turn outboard into each wing." },
  awR: { c: wingSectorAt(1), r: 0.06, axis: "y", sys: "controls", name: "Aileron wing sector / crank arm", note: "Vertical sector at the inboard end of each aileron; drives the aileron through a right-angle conical drive arm." },
  awL: { c: wingSectorAt(-1), r: 0.06, axis: "y", sys: "controls", name: "Aileron wing sector / crank arm", note: "Vertical sector at the inboard end of each aileron; drives the aileron through a right-angle conical drive arm." },
  rf: { c: [2.1, -0.62, 0.13], r: 0.035, axis: "z", double: true, gap: 0.06, sys: "controls", name: "Forward rudder pulleys", note: "Double pulley just aft of the pedals (POH Fig. 7-3)." },
  rm: { c: [0.45, -0.58, 0.13], r: 0.035, axis: "z", double: true, gap: 0.06, sys: "controls", name: "Intermediate rudder pulleys", note: "Double pulley under the rear cabin floor." },
  ra: { c: [-2.58, -0.24, 0], r: 0.07, axis: "y", sys: "controls", name: "Aft rudder sector", note: "Sector beside the elevator sector pulley in the aft fuselage; push-pull tube to the rudder bellcrank." },
};

/** Grooved pulley (or double pulley) oriented on the given axis, centred at the origin. */
export function pulleyGeo(r: number, axis: Axis, double = false, gap = 0.03) {
  const w = 0.018;
  const prof = [[0.003, -w / 2], [r, -w / 2], [r, -w / 4], [r * 0.78, 0], [r, w / 4], [r, w / 2], [0.003, w / 2]].map(([a, b]) => new THREE.Vector2(a, b));
  const wheel = () => new THREE.LatheGeometry(prof, 28);
  const g = double ? mergeY([wheel().translate(0, -gap / 2, 0), wheel().translate(0, gap / 2, 0), new THREE.CylinderGeometry(0.006, 0.006, gap + w, 8)]) : wheel();
  if (axis === "z") g.rotateX(Math.PI / 2);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  return g;
}
function mergeY(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], idx: number[] = [];
  let off = 0;
  gs.forEach((g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.index;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

/** Pie-shaped cable sector in the x–y plane (axis z), pointing down. */
export function sectorGeo(r: number, spread = 0.6, t = 0.012) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.absarc(0, 0, r, -Math.PI / 2 - spread, -Math.PI / 2 + spread, false);
  sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  return g;
}

/* ---------- cable strands (each pair forms a closed loop through its sectors) ---------- */
const E = ETT, ef = PULLEYS.ef, em = PULLEYS.em, ea = PULLEYS.ea, af = PULLEYS.af, rf = PULLEYS.rf, rm = PULLEYS.rm, ra = PULLEYS.ra;
const FLOOR = -0.655;
const wp = (z: number, xc: number): Vec3 => { const p = wingP(z, xc, 0); return [p.x, p.y, p.z]; };
const sectorPt = (a: number, z: number): Vec3 => [E.c[0] + Math.sin(a) * E.sectorR, E.c[1] - Math.cos(a) * E.sectorR, z];
const aw = (s: number) => (s > 0 ? PULLEYS.awR : PULLEYS.awL).c;

export interface CableDef { key: string; name: string; note: string; pts: Vec3[] }
export const CABLES: CableDef[] = [
  // Elevator: crossed pair from the forward sector → forward double pulley → intermediate pulleys → aft sector pulley
  { key: "elA", name: "Elevator cable", note: "Single cable loop from the forward sector under the cabin floor to the aft sector pulley (POH Fig. 7-1). Turnbuckles set the tension.",
    pts: [sectorPt(0.35, E.sectorZ), [ef.c[0] - ef.r, ef.c[1], 0.045], [ef.c[0] - 0.02, FLOOR, 0.045], [em.c[0] + 0.05, em.c[1] - em.r, 0.045], [em.c[0], em.c[1] + em.r, 0.045], [ea.c[0] + 0.02, ea.c[1] + ea.r, 0.005]] },
  { key: "elB", name: "Elevator cable", note: "Return strand of the elevator loop — crosses the other strand between the forward sector and pulley.",
    pts: [sectorPt(-0.35, E.sectorZ), [ef.c[0] + ef.r, ef.c[1], 0.075], [ef.c[0] - 0.02, FLOOR, 0.075], [em.c[0] + 0.05, em.c[1] - em.r, 0.075], [em.c[0] - 0.03, em.c[1] - em.r, 0.075], [ea.c[0] + 0.02, ea.c[1] - ea.r, -0.005]] },
  // Aileron: central sector → floor pulleys → turning pulleys aft of the rear spar → each wing sector; balance cable between the wing sectors
  { key: "ailR", name: "Aileron cable (right wing)", note: "Central sector → floor pulleys → turning pulley aft of the rear spar → right wing sector (POH Fig. 7-2).",
    pts: [[AIL_SECTOR.c[0], AIL_SECTOR.c[1] - AIL_SECTOR.r + 0.01, 0.03], [af.c[0] + af.r, af.c[1], -0.035], [af.c[0] - 0.02, FLOOR, -0.035], [0.62, -0.62, 0.02], [0.52, -0.6, 0.1], [0.6, -0.6, 0.15], wp(0.45, 0.62), wp(1.2, 0.62), wp(2.4, 0.62), [aw(1)[0] + 0.06, aw(1)[1], aw(1)[2]]] },
  { key: "ailL", name: "Aileron cable (left wing)", note: "Central sector → floor pulleys → turning pulley aft of the rear spar → left wing sector (POH Fig. 7-2).",
    pts: [[AIL_SECTOR.c[0], AIL_SECTOR.c[1] - AIL_SECTOR.r + 0.01, -0.03], [af.c[0] + af.r, af.c[1], -0.065], [af.c[0] - 0.02, FLOOR, -0.065], [0.62, -0.62, -0.02], [0.52, -0.6, -0.1], [0.6, -0.6, -0.15], wp(-0.45, 0.62), wp(-1.2, 0.62), wp(-2.4, 0.62), [aw(-1)[0] + 0.06, aw(-1)[1], aw(-1)[2]]] },
  { key: "ailBal", name: "Aileron balance cable", note: "Joins the two wing sectors behind the main runs, closing the aileron loop; passes cable guides in each wing.",
    pts: [[aw(1)[0] - 0.06, aw(1)[1], aw(1)[2]], wp(2.4, 0.7), wp(1.2, 0.7), wp(0.45, 0.7), [0.7, -0.63, 0], wp(-0.45, 0.7), wp(-1.2, 0.7), wp(-2.4, 0.7), [aw(-1)[0] - 0.06, aw(-1)[1], aw(-1)[2]]] },
  // Rudder: cable horn → forward double pulley → intermediate pulleys → aft rudder sector
  { key: "rudR", name: "Rudder cable", note: "Pedal cable horn → forward and intermediate double pulleys under the floor → aft rudder sector (POH Fig. 7-3).",
    pts: [[RUD_HORN.c[0], RUD_HORN.c[1], RUD_HORN.c[2] + RUD_HORN.half], [rf.c[0], FLOOR, 0.16], [rm.c[0], rm.c[1] - rm.r, 0.16], [ra.c[0] + 0.02, ra.c[1], ra.r]] },
  { key: "rudL", name: "Rudder cable", note: "Other half of the rudder loop.",
    pts: [[RUD_HORN.c[0], RUD_HORN.c[1], RUD_HORN.c[2] - RUD_HORN.half], [rf.c[0], FLOOR, 0.1], [rm.c[0], rm.c[1] - rm.r, 0.1], [ra.c[0] + 0.02, ra.c[1], -ra.r]] },
];
export const cable = (key: string) => CABLES.find((c) => c.key === key)!;

/** Point a fraction t of the way along segment i of a cable (for turnbuckles and guides). */
export function alongCable(key: string, i: number, t: number): Vec3 {
  const p = cable(key).pts, a = p[i], b = p[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* ---------- kinematics ---------- */
export interface RigPose {
  ett: number; carr: number; ailSector: number; rudHorn: number; pedal: number;
  elevAng: number; rudAng: number; ailAng: number;
  pulley: Record<string, number>;
}

/** Where circle (c, r1) meets circle (e, r2) in a plane — the solution nearer (nx, ny). */
function meet(cx: number, cy: number, r1: number, ex: number, ey: number, r2: number, nx: number, ny: number): [number, number] {
  const dx = ex - cx, dy = ey - cy, d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const bx = cx + (a * dx) / d, by = cy + (a * dy) / d;
  const p: [number, number] = [bx - (h * dy) / d, by + (h * dx) / d], q: [number, number] = [bx + (h * dy) / d, by - (h * dx) / d];
  return Math.hypot(p[0] - nx, p[1] - ny) <= Math.hypot(q[0] - nx, q[1] - ny) ? p : q;
}

/** Bisection root of a monotonic f on [lo, hi]. */
function solve(f: (x: number) => number, lo: number, hi: number) {
  let flo = f(lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Aileron drive-arm pin: rotates with the aileron about its hinge line (same pivot/axis as the surface). */
function ailPin(side: number, ang: number) {
  const pv = wingP(side * 3.68, 0.75, 0), ax = wingP(side * 5.0, 0.75, 0).sub(pv).normalize();
  const h = wingP(side * AIL_DRIVE.z, 0.75, 0).add(V(0, AIL_DRIVE.arm, 0));
  return pv.clone().add(h.sub(pv).applyAxisAngle(ax, ang));
}
/** Crank pin on the wing sector, which turns about a vertical axis. */
function crankPin(side: number, a: number) {
  const c = (side > 0 ? PULLEYS.awR : PULLEYS.awL).c;
  return V(c[0] + side * AIL_DRIVE.crank * Math.sin(a), c[1] + AIL_DRIVE.lift, c[2] + side * AIL_DRIVE.crank * Math.cos(a));
}
const CONE_LEN = [-1, 1].map((sd) => ailPin(sd, 0).distanceTo(crankPin(sd, 0)));
const ailSurfAng = (roll: number) => -roll * 18 * D2R; // matches ControlSurface for both ailerons

export function rigPose(s: Sim): RigPose {
  const { pitch, roll, yaw } = s.ctrl;
  // elevator: the yoke eye slides aft; the lever turns so the drop link keeps its length
  const [tx, ty] = meet(ETT.c[0], ETT.c[1], ETT.lever, EYE_X0 - pitch * YOKE_TRAVEL, EYE_Y, DROP_LEN, TIP0[0], TIP0[1]);
  const ett = LEVER_ANG - Math.atan2(tx - ETT.c[0], ty - ETT.c[1]);
  const carr = roll * 0.6;                                  // bearing carriages rotate with the yokes
  const ailSector = Math.asin(Math.max(-1, Math.min(1, (-CARR.arm * Math.sin(carr)) / AIL_SECTOR.r)));
  // wing sectors turn until the drive link to each aileron arm is back at its rigged length
  const aw = [-1, 1].map((sd, i) => { const pin = ailPin(sd, ailSurfAng(roll)); return solve((a) => pin.distanceTo(crankPin(sd, a)) - CONE_LEN[i], -1.2, 1.2); });
  const rudHorn = yaw * 0.5;
  const tE = ett * ETT.sectorR, tA = ailSector * AIL_SECTOR.r, tR = rudHorn * RUD_HORN.half;
  const P = PULLEYS;
  return {
    ett, carr, ailSector, rudHorn, pedal: RUD_HORN.half * Math.sin(rudHorn),
    elevAng: pitch * 22 * D2R, rudAng: yaw * 22 * D2R, ailAng: roll * 18 * D2R,
    pulley: {
      ef: tE / P.ef.r, em: tE / P.em.r, ea: -tE / P.ea.r,
      af: tA / P.af.r, atR: tA / P.atR.r, atL: -tA / P.atL.r, awR: aw[1], awL: aw[0],
      rf: tR / P.rf.r, rm: tR / P.rm.r, ra: tR / P.ra.r,
    },
  };
}

/* ---------- dynamic link end points ---------- */
const rotX = (y: number, z: number, a: number): [number, number] => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];

export function linkPoints(s: Sim, p: RigPose) {
  const out: Record<string, [THREE.Vector3, THREE.Vector3]> = {};
  // elevator drop links: yoke eye → lever tip on the torque tube
  [-1, 1].forEach((side) => {
    const eye = V(EYE_X0 - s.ctrl.pitch * YOKE_TRAVEL, EYE_Y, side * CARR.z);
    const phi = LEVER_ANG - p.ett;
    const tip = V(ETT.c[0] + Math.sin(phi) * ETT.lever, ETT.c[1] + Math.cos(phi) * ETT.lever, side * CARR.z);
    out["drop" + side] = [eye, tip];
  });
  // aileron lateral push rod between the two carriage arms (passes the central sector pin)
  const tip = (side: number) => { const [y, z] = rotX(-CARR.arm, 0, p.carr); return V(CARR.x + CARR.armX, CARR.y + y, side * CARR.z + z); };
  out.ailRod = [tip(-1), tip(1)];
  // elevator push-pull tube: aft pulley crank pin → bellcrank arm (rotates with the elevator)
  const ea = PULLEYS.ea, pa = p.pulley.ea;
  const pin = V(ea.c[0] + Math.sin(pa) * 0.06, ea.c[1] - Math.cos(pa) * 0.06, ea.c[2]);
  const eh = ELEV_HORN, ea2 = -p.elevAng;
  const horn = V(eh.c[0] + Math.sin(ea2) * eh.arm, eh.c[1] - Math.cos(ea2) * eh.arm, 0);
  out.elevPush = [pin, horn];
  // rudder push-pull tube: aft sector crank pin → rudder horn (rotates with the rudder about ~vertical)
  const ra = PULLEYS.ra, pr = p.pulley.ra;
  const rpin = V(ra.c[0] + Math.sin(pr) * 0.05, ra.c[1], ra.c[2] + Math.cos(pr) * 0.05);
  const rh = RUD_HORN_AFT;
  const rhorn = V(rh.c[0] + Math.sin(p.rudAng) * rh.arm, rh.c[1], rh.c[2] + Math.cos(p.rudAng) * rh.arm);
  out.rudPush = [rpin, rhorn];
  // pedal links: fore-aft link from each pedal pair's arm to the matching end of the cable horn
  [-1, 1].forEach((side) => {
    const hz = RUD_HORN.c[2] + side * RUD_HORN.half;
    const end = V(RUD_HORN.c[0] + side * RUD_HORN.half * Math.sin(p.rudHorn), RUD_HORN.c[1], RUD_HORN.c[2] + side * RUD_HORN.half * Math.cos(p.rudHorn));
    out["ped" + side] = [V(PEDAL_TT.x + side * p.pedal, RUD_HORN.c[1], hz), end];
  });
  // aileron right-angle drives: wing-sector crank pin → arm on the aileron
  [-1, 1].forEach((side) => {
    out["cone" + side] = [crankPin(side, side > 0 ? p.pulley.awR : p.pulley.awL), ailPin(side, ailSurfAng(s.ctrl.roll))];
  });
  return out;
}
