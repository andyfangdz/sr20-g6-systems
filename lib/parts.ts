/**
 * Declarative catalogue of every modelled component.
 * Geometry is built lazily (browser only). Positions are in airplane coordinates unless the
 * part has a `parent`, in which case they are relative to that moving group.
 */
import * as THREE from "three";
import {
  AB, EF, FIN, FW, HF, HH, HR, HZ, SSPAN, SY, WR, af, box, botY, cyl, fC, fLE, finCut, finHs, finSec, fus, fuselageGeo, hingeX,
  loft, pantGeo, planeRing, sC, sLE, sectionSlab, sph, stabSec, topY, tubeGeo, wC, wLE, wT, wY, wingP, wingSec, fRing,
} from "./geometry";
import { V, type Vec3 } from "./math";
import { AIL_DRIVE, AIL_SECTOR, CARR, ELEV_HORN, ETT, LEVER_ANG, PEDAL_TT, PULLEYS, RUD_HORN, RUD_HORN_AFT, alongCable, pulleyGeo, sectorGeo } from "./rig";
import type { SysId } from "./systems";
import type { Chan } from "./sim/model";

export type Anim = "plug" | "magR" | "magL" | "alt1" | "alt2" | "brakeR" | "brakeL" | "selPtr" | "altDoor" | "suction";

export interface PartSpec {
  id: string;
  geo: () => THREE.BufferGeometry;
  sys: SysId[];
  name?: string;
  note?: string;
  pin?: boolean;
  /** Intentionally outside the skin (gear, antennas, probes…). */
  ext?: boolean;
  color?: string;
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  parent?: string;
  anim?: Anim;
  mag?: "R" | "L";
  plate?: boolean;
  /** Flight-control channel(s) this part belongs to (for the channel focus view). */
  chan?: Chan[];
}

export interface ShellSpec { id: string; geo: () => THREE.BufferGeometry; name: string; note: string; skin?: boolean }
export interface SurfaceSpec { key: string; geo: () => THREE.BufferGeometry; pivot: Vec3; axis: Vec3; sys: SysId[]; name: string; note: string; chan?: Chan[] }
export const chanOfKey = (k: string): Chan[] | undefined => (k.startsWith("elev") || k.startsWith("el") ? ["elevator"] : k.startsWith("ail") ? ["aileron"] : k.startsWith("rud") ? ["rudder"] : undefined);

const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
let n = 0;
const uid = (s: string) => `${s}-${n++}`;

export const PARTS: PartSpec[] = [];
export const SHELLS: ShellSpec[] = [];
export const SURFACES: SurfaceSpec[] = [];

function part(geo: () => THREE.BufferGeometry, sys: SysId[], o: Omit<PartSpec, "id" | "geo" | "sys"> = {}) {
  const spec: PartSpec = { id: uid(o.name || "part"), geo, sys, ...o };
  PARTS.push(spec);
  return spec;
}
const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) => SHELLS.push({ id: uid(name), geo, name, note, skin });

/* ---------- airframe shells ---------- */
shell(fuselageGeo, "Fuselage", "Composite monocoque with integral roll cage. Cabin runs from the firewall (FS 100) to the aft baggage bulkhead (FS 222).", true);
shell(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.155 * Math.sqrt(1 - t * t * 0.97), t * 0.42)); }
  const g = new THREE.LatheGeometry(pts, 32); g.rotateZ(-Math.PI / 2); g.translate(3.74, -0.13, 0); return g;
}, "Spinner", "Covers the constant-speed propeller hub.");
const wingSpanSt = [WR, 0.9, 1.6, 2.4, 3.2, 4.0, 4.6, 5.2, 5.45, 5.65, 5.78, 5.84];
const sided = (secs: THREE.Vector3[][], s: number) => (s < 0 ? secs.map((r) => r.reverse()) : secs);
[1, -1].forEach((s) => {
  shell(() => loft(sided(wingSpanSt.map((z) => wingSec(s * z, 0, 0.75)), s)), s > 0 ? "Right wing" : "Left wing",
    "Composite torsion box: carbon spar, ribs and bonded skins. Holds a 29.3 gal integral fuel tank and the main gear.");
  [[WR, 0.94], [3.62, 3.68], [5.0, 5.2, 5.45, 5.65, 5.78, 5.84]].forEach((st) =>
    shell(() => loft(sided(st.map((z) => wingSec(s * z, 0.75, 1)), s)), "Wing trailing edge", ""));
  shell(() => loft(sided([...[0, 0.3, 1.0, 1.7, HZ - 0.002].map((z) => stabSec(s * z, 0, EF)), ...[HZ, SSPAN].map((z) => stabSec(s * z, 0, HF))], s)),
    "Horizontal stabilizer", "Single composite structure tip to tip.");
});
shell(() => loft(finHs.map((h) => finSec(h, 0, finCut(h)))), "Vertical stabilizer", "Composite, integral with the fuselage shell; swept leading edge blends into a dorsal fillet.");

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
function surface(key: string, secs: () => THREE.Vector3[][], a: THREE.Vector3, b: THREE.Vector3, sys: SysId[], name: string, note: string) {
  SURFACES.push({
    key, pivot: P(a), axis: P(b.clone().sub(a).normalize()), sys, name, note, chan: chanOfKey(key),
    geo: () => { const g = loft(secs()); g.translate(-a.x, -a.y, -a.z); return g; },
  });
}
const hp = (s: number, z: number, xc: number) => { const c = wC(z), [u, l] = af(xc, wT(z), 0.02); return V(wLE(z) - xc * c, wY(z) + ((u + l) / 2) * c, s * z); };
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  const fz = [0.94, 1.8, 2.7, 3.62], az = [3.68, 4.3, 5.0];
  surface("flap" + side, () => sided(fz.map((z) => wingSec(s * z, 0.75, 1)), s), hp(s, fz[0], 0.75), hp(s, fz[3], 0.75), ["flaps", "controls"],
    (s > 0 ? "Right" : "Left") + " flap", "Single-slotted aluminum flap on three hinges. 0% / 50% (16°) / 100% (32°).");
  surface("ail" + side, () => sided(az.map((z) => wingSec(s * z, 0.75, 1)), s), hp(s, az[0], 0.75), hp(s, az[2], 0.75), ["controls"],
    (s > 0 ? "Right" : "Left") + " aileron", "Aluminum, two hinge points. Driven by cable to a sector/crank arm in the wing." + (s > 0 ? " Right aileron carries the ground-adjustable trim tab." : ""));
  const ez = [0.1, 1.0, SSPAN];
  surface("elev" + side, () => sided([...[0.1, 1.0, HZ - 0.002].map((z) => stabSec(s * z, EF, 1)), ...[HZ, SSPAN].map((z) => stabSec(s * z, HF, 1))], s),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]), V(sLE(ez[2]) - EF * sC(ez[2]), SY, s * ez[2]), ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)", "Two-piece aluminum elevator, two hinges per half plus the control sector. Horn-balanced tip.");
});
surface("rudder", () => [-0.2, 0.05, 0.31, 0.52, 0.8, 1.1, HH - 0.002, HH, 1.42, 1.47].map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(-0.2), -0.2, 0), V(hingeX(1.44), 1.44, 0), ["controls"],
  "Rudder", "Aluminum, three hinge points on the fin rear shear web. Extends below the stabilizer to the tailcone tip.");
export const surfacePivot = (key: string) => SURFACES.find((s) => s.key === key)!.pivot;
/** Part attached to a moving control surface; `world` is converted to hinge-relative coords. */
function onSurf(key: string, world: THREE.Vector3, geo: () => THREE.BufferGeometry, o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] }) {
  const pv = surfacePivot(key);
  part(geo, o.sys || ["controls"], { chan: chanOfKey(key), ...o, parent: "surf:" + key, pos: [world.x - pv[0], world.y - pv[1], world.z - pv[2]] });
}

/* ---------- control-surface details (Costanzo deck photos) ---------- */
const wickNote = "Static wick: bleeds static charge off the trailing edge to cut radio noise. Check it's present on preflight.";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * 4.85, 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.13, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true, pin: s > 0 });
  onSurf("elev" + side, V(sLE(1.88) - sC(1.88) - 0.05, SY, s * 1.88), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true });
  onSurf("elev" + side, V(sLE(1.83) - (HF + 0.06) * sC(1.83), SY, s * 1.83), () => box(0.05, 0.03, 0.12), {
    color: "#6E7A84", name: "Elevator horn balance + weight", pin: s > 0,
    note: "The elevator tip reaches forward of the hinge line (horn) with a balance weight inside, reducing control forces and preventing flutter. (Costanzo deck)",
  });
  ([
    [1.0, "Flap hinge bracket + control arm", "Flap hinge bracket. The inboard bracket carries the control arm driven by the flap torque tube. Rub strips on the flap top leading edge protect the cove. (Costanzo deck)", ["flaps"]],
    [2.3, "Flap hinge bracket", "One of three hinges per flap.", ["flaps"]],
    [3.55, "Flap hinge bracket", "One of three hinges per flap.", ["flaps"]],
    [3.95, "Aileron hinge fairing", "One of two hinges per aileron.", ["controls"]],
    [4.85, "Aileron hinge fairing", "One of two hinges per aileron.", ["controls"]],
  ] as [number, string, string, SysId[]][]).forEach(([z, name, note, sys], i) =>
    part(() => box(0.34, 0.05, 0.025), sys, { pos: P(wingP(s * z, 0.74, -1).add(V(-0.02, -0.02, 0))), color: "#C9D0D5", name, note, ext: true, pin: s > 0 && i === 0, chan: sys[0] === "controls" ? ["aileron"] : undefined }));
});
onSurf("ailR", wingP(4.3, 0.99, 0).add(V(-0.03, 0, 0)), () => box(0.07, 0.004, 0.12), { color: "#8C99A3", name: "Aileron trim tab (ground-adjustable)", note: "Right aileron only. Factory-set; bent on the ground to trim out a wing-heavy tendency.", ext: true, pin: true });
onSurf("elevR", V(sLE(0.5) - sC(0.5) - 0.03, SY, 0.5), () => box(0.07, 0.004, 0.14), { color: "#8C99A3", name: "Elevator trim tab (ground-adjustable)", note: "Factory-set tab for small neutral-trim corrections. (Costanzo deck)", ext: true, pin: true });
onSurf("rudder", V(fLE(0.35) - fC(0.35) - 0.03, 0.35, 0), () => box(0.07, 0.14, 0.004), { color: "#8C99A3", name: "Rudder trim tab (ground-adjustable)", note: "Factory-set; the only yaw trim besides the pedal spring cartridge.", ext: true, pin: true });
onSurf("rudder", V(fLE(1.3) - fC(1.3) - 0.05, 1.3, 0), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true });
onSurf("rudder", V(fLE(1.42) - (HR + 0.05) * fC(1.42), 1.42, 0), () => box(0.06, 0.04, 0.03), { color: "#6E7A84", name: "Rudder horn balance + weight", note: "Top of the rudder extends forward of the hinge with a balance weight — reduces pedal force and flutter risk. (Costanzo deck)", pin: true });

/* ---------- cowl inlets ---------- */
[1, -1].forEach((s) => {
  part(() => { const g = new THREE.TorusGeometry(0.075, 0.018, 8, 20); g.rotateY(Math.PI / 2); g.translate(3.7, -0.13, s * 0.22); return g; }, ["engine", "airframe"], {
    color: "#1E2A33", ext: true, pin: true,
    name: s > 0 ? "Right cowl inlet — induction" : "Left cowl inlet — cooling",
    note: s > 0 ? "Primary induction intake: air passes the filter screen just inside this inlet. Cooling air also enters here. If it clogs, use ALT AIR. (Costanzo deck)" : "Cooling air over the cylinder baffles.",
  });
  part(() => { const g = new THREE.CircleGeometry(0.075, 20); g.rotateY(Math.PI / 2); g.translate(3.695, -0.13, s * 0.22); return g; }, ["engine", "airframe"], { color: "#0B1014", ext: true });
});

/* ---------- landing gear (track ≈ 2.8 m per POH Fig. 1-1) ---------- */
export const MG = { x: 1.12, y: -1.2, z: 1.42 };
[1, -1].forEach((s) => {
  const top = wingP(s * 1.0, 0.28, -1);
  part(() => tubeGeo([[top.x, top.y + 0.02, s * 1.0], [1.14, -0.9, s * 1.22], [MG.x, -1.1, s * 1.36]], 0.04), ["gear"], { name: "Main gear strut", note: "Composite strut bolted to the wing between spar and shear web.", ext: true });
  part(() => cyl(0.19, 0.15, "z", 28), ["gear"], { pos: [MG.x, MG.y, s * MG.z], color: "#2A2F33", name: "Main wheel", note: "15 × 6.00 × 6 tubeless tire.", ext: true });
  part(() => pantGeo(0.92, 0.19), ["gear"], { pos: [MG.x, -1.17, s * MG.z], scale: [1, 1, 0.62], name: "Wheel pant", note: "Removable; access plugs allow tire inflation checks.", ext: true });
  part(() => cyl(0.12, 0.03, "z", 20), ["gear"], {
    pos: [MG.x, MG.y, s * (MG.z - 0.1)], color: "#9AA3AA", ext: true, anim: s > 0 ? "brakeR" : "brakeL", name: "Disc brake",
    note: "Single-disc caliper with pads. An orange temperature tab on the caliper turns brown if the brake overheated — inspect. Brake temp sensor also feeds the CAS alerts.",
  });
  part(() => tubeGeo([[2.4, -0.6, s * 0.3], [1.8, -0.58, s * 0.34], [1.28, -0.6, s * 0.8], wingP(s * 1.0, 0.33, -1).add(V(0, 0.012, 0))], 0.011), ["gear"], { name: "Brake line (" + (s > 0 ? "R" : "L") + ")", note: "Master cylinder at each pedal → parking-brake valve → caliper." });
  part(() => tubeGeo([wingP(s * 1.0, 0.33, -1), [1.16, -0.9, s * 1.22], [MG.x, -1.12, s * (MG.z - 0.12)]], 0.011), ["gear"], { name: "Brake line (" + (s > 0 ? "R" : "L") + ")", note: "Runs down the gear leg to the caliper.", ext: true });
});
export const NOSE_GEAR: Vec3 = [3.06, -0.52, 0];
export const NOSE_CASTER: Vec3 = [0.22, -0.68, 0];
part(() => tubeGeo([[0, 0, 0], [0.09, -0.34, 0], [0.22, -0.66, 0]], 0.035), ["gear"], { parent: "noseGear", name: "Nose gear strut", note: "Tubular steel on the engine mount; oleo shock absorber. Plastic fairing.", ext: true });
part(() => cyl(0.17, 0.11, "z", 24), ["gear"], { parent: "caster", pos: [0.02, 0, 0], color: "#2A2F33", name: "Nose wheel", note: "5.00 × 5 tire. Free-castering ±85°; steer with differential braking.", ext: true });
part(() => pantGeo(0.7, 0.17), ["gear"], { parent: "caster", pos: [0.02, 0.02, 0], scale: [1, 1, 0.55], name: "Nose wheel pant", note: "", ext: true });
part(() => box(0.1, 0.08, 0.3), ["gear"], { pos: [2.22, -0.4, -0.26], name: "PARK BRAKE handle", note: "Right side kick plate by the pilot's right knee. Set toe brakes, then pull aft. Never set in flight.", pin: true });
[-0.36, -0.14, 0.14, 0.36].forEach((z) => {
  const parent = z < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.04, 0.18, 0.09), ["gear", "controls"], { chan: ["rudder"], parent, pos: [2.42, -0.52, z], rot: [0, 0, 0.35], name: "Rudder pedal / toe brake", note: "Top half is the toe brake. Either pilot's left or right toe brake applies that side's brake. Pushing a pedal forward pulls its rudder cable (POH Fig. 7-3)." });
  part(() => cyl(0.018, 0.1), ["gear"], { parent, pos: [2.45, -0.58, z], color: "#8C959C", name: "Brake master cylinder", note: "One per pedal. Pressing the toe brake pressurizes that side's brake line." });
});

/* ---------- propeller (74 in., 3 blade) ---------- */
export const PROP: Vec3 = [3.8, -0.14, 0];
const bladeGeo = () => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.06, 0.12); sh.quadraticCurveTo(-0.09, 0.5, -0.045, 0.94); sh.lineTo(0.03, 0.94); sh.quadraticCurveTo(0.075, 0.5, 0.06, 0.12); sh.lineTo(-0.06, 0.12);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }); g.translate(0, 0, -0.009); g.rotateY(Math.PI / 2); return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], { parent: "blade:" + i, color: "#3A4148", name: "Propeller blade", note: "Hartzell three-blade, 74 in. constant-speed. Metal standard, composite optional.", ext: true });

/* ---------- engine (IO-390, ~0.87 m wide, inside the cowl) ---------- */
const EY = -0.16;
part(() => box(0.78, 0.26, 0.26), ["engine"], { pos: [3.14, EY, 0], name: "Lycoming IO-390-C3B6", note: "Four-cylinder, horizontally opposed, fuel-injected. 215 hp at 2,700 RPM; 2,200 hr TBO.", pin: true });
part(() => box(0.55, 0.12, 0.26), ["engine"], { pos: [3.08, -0.38, 0], name: "Oil sump", note: "Wet sump, 7 quart capacity. Filler cap/dipstick at right rear via cowl door." });
export const CYLS = [{ n: 1, x: 3.36, s: 1 }, { n: 2, x: 3.22, s: -1 }, { n: 3, x: 2.99, s: 1 }, { n: 4, x: 2.85, s: -1 }];
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.085, 0.2, "z", 18), ["engine"], { parent, color: "#7C858C", name: "Cylinder " + c.n, note: (c.s > 0 ? "Right" : "Left") + " bank. Cooling fins; baffled ram-air cooling (no cowl flaps)." });
  for (let k = -2; k <= 2; k++) part(() => cyl(0.1, 0.01, "z", 18), ["engine"], { parent, pos: [0, 0, k * 0.035], color: "#8C959C" });
  part(() => box(0.19, 0.19, 0.07), ["engine"], { parent, pos: [0, 0, c.s * 0.13], color: "#6A737A", name: "Cylinder head " + c.n, note: "Two spark plugs, CHT probe; EGT probe in the exhaust." });
  ([["U", 0.065], ["L", -0.065]] as const).forEach(([pos, dy]) => {
    const mag = (c.s > 0) === (pos === "L") ? "R" : "L";
    part(() => cyl(0.017, 0.06, "x", 10), ["engine"], {
      parent, pos: [-0.12, dy, c.s * 0.13], color: "#DADFE2", anim: "plug", mag,
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`, note: `Fired by the ${mag === "R" ? "right" : "left"} magneto.`,
    });
  });
});
part(() => cyl(0.05, 0.13, "x"), ["engine"], { pos: [2.72, -0.04, 0.11], color: "#3E4A52", anim: "magR", name: "Right magneto", note: "Fires lower-right and upper-left plugs. Also the tachometer's RPM pickup.", pin: true });
part(() => cyl(0.05, 0.13, "x"), ["engine"], { pos: [2.72, -0.04, -0.11], color: "#3E4A52", anim: "magL", name: "Left magneto", note: "Fires lower-left and upper-right plugs.", pin: true });
part(() => box(0.1, 0.09, 0.12), ["engine", "propeller"], { pos: [3.55, -0.06, 0], color: "#C0602F", name: "Propeller governor", note: "Flyweights sense RPM; a cable from the power lever sets the target. Boosts engine oil pressure to move blade pitch.", pin: true });
part(() => box(0.08, 0.16, 0.12), ["engine"], { pos: [3.36, -0.1, -0.35], color: "#9A6A48", name: "Oil cooler", note: "Remote-mounted. Valve bypasses it below 170 °F or above an 18 psi pressure drop." });
part(() => box(0.1, 0.12, 0.14), ["engine"], { pos: [3.58, -0.15, 0.2], color: "#C9B98F", name: "Induction air filter", note: "Paper filter screen just inside the right cowl inlet. (Costanzo deck)", pin: true });
part(() => cyl(0.045, 0.11, "x"), ["engine"], { pos: [2.8, -0.02, 0.18], color: "#1F3A5A", name: "Oil filter (full-flow)", note: "Spin-on filter at the accessory case, next to the magnetos. (Costanzo deck)", pin: true });
part(() => cyl(0.055, 0.14, "x"), ["engine", "fuel"], { pos: [3.32, -0.4, 0], color: "#7E8A93", name: "Throttle body / fuel servo", note: "Butterfly meters air; servo meters fuel in proportion to airflow and mixture. MAP sensor sits nearby.", pin: true });
part(() => box(0.03, 0.08, 0.1), ["engine"], { pos: [3.5, -0.26, 0.2], color: "#E0B040", anim: "altDoor", name: "Alternate air door", note: "ALT AIR – PULL knob opens it: bypasses the filter with warm, unfiltered air." });
part(() => cyl(0.06, 0.28, "z"), ["engine", "environment"], { pos: [3.04, -0.44, 0.22], color: "#8A5A3C", name: "Muffler", note: "Single muffler; exhaust exits through the lower cowl. Placed on the right with the heat muff and mixing chamber per the POH environmental section and the Costanzo deck photo (the POH engine paragraph says left)." });
part(() => cyl(0.08, 0.2, "z"), ["environment", "engine"], { pos: [3.04, -0.44, 0.22], color: "#E0522B", name: "Heat exchanger (muff)", note: "Shroud around the muffler; heats ram air for the cabin." });
part(() => cyl(0.07, 0.12, "x"), ["electrical", "engine"], { pos: [3.5, -0.3, 0.22], color: "#D9960F", anim: "alt1", name: "ALT 1 — 100 A", note: "Belt-driven, right front. Regulated to 27.7 V. Feeds Main Distribution Bus 1.", pin: true });
part(() => cyl(0.06, 0.11, "x"), ["electrical", "engine"], { pos: [3.5, -0.3, -0.22], color: "#D9960F", anim: "alt2", name: "ALT 2 — 70 A", note: "Belt-driven, left front. Regulated to 28.7 V, so it carries the loads it shares with ALT 1.", pin: true });
part(() => box(0.1, 0.12, 0.14), ["engine"], { pos: [2.74, -0.24, 0], color: "#4B5860", name: "Starter / SlickSTART", note: "START energizes the starter and SlickSTART booster (retards timing, hotter spark). Spring-returns to BOTH." });

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe"], { plate: true, pin: true, name: "Firewall — FS 100", note: "Forward cabin boundary. Lower firewall has a 20° bevel for crashworthiness." });
part(() => planeRing(AB), ["airframe", "cabin"], { plate: true, pin: true, name: "Aft bulkhead — FS 222", note: "Rear of the baggage compartment. Avionics bay, BAT 2, ELT and CAPS sit aft of it." });
part(() => {
  const pts: THREE.Vector3[] = [];
  for (let z = -5.3; z <= 5.31; z += 0.5) { const az = Math.max(Math.abs(z), WR); pts.push(V(wLE(az) - 0.3 * wC(az), wY(az) + 0.02 * wC(az), z)); }
  return tubeGeo(pts, 0.04);
}, ["airframe"], { name: "Main spar", note: "Laminated carbon/epoxy C-section, continuous tip to tip. Passes under the front seats.", pin: true });
[0.75, 2.2].forEach((x) => part(() => tubeGeo(fRing(x, 0.93, 30, -0.25, Math.PI + 0.25, false), 0.025), ["airframe"], { name: "Composite roll cage", note: "Built into the fuselage to protect occupants in a rollover.", pin: x === 0.75 }));
([[1.3, -0.62, 0.4], [1.3, -0.62, -0.4], [0.2, -0.4, 0.49], [0.2, -0.4, -0.49]] as Vec3[]).forEach((p, i) =>
  part(() => sph(0.05), ["airframe"], { pos: p, color: "#E0522B", name: "Wing attach point", note: i < 2 ? "Spar attaches under the front seats." : "Rear shear web attaches to the sidewall just aft of the rear seats.", pin: i === 0 || i === 2 }));

/* ---------- cockpit / cabin ---------- */
part(() => sectionSlab(2.3, -0.18, 0.3, 0.97, 0.04, 2.32), ["avionics", "cabin"], { color: "#2B3238", name: "Instrument panel", note: "All-metal sectional panel under a composite glareshield." });
part(() => sectionSlab(2.24, 0.3, 0.35, 0.95, 0.2, 2.36), ["cabin"], { color: "#2B3238", name: "Glareshield", note: "Projects over the panel; windshield diffuser outlet runs along its base." });
part(() => sectionSlab(2.18, -0.32, -0.19, 0.95, 0.12, 2.24), ["cabin", "lighting", "electrical"], { color: "#39424A", name: "Bolster switch panel", note: "BAT 2, BAT 1, ALT 1, ALT 2, AVIONICS, PITOT HEAT and lighting controls. Standby instrument below." });
part(() => box(1.0, 0.26, 0.26), ["cabin"], { pos: [1.68, -0.4, 0], color: "#39424A", name: "Center console", note: "FMS keyboard, autopilot and audio controls, flap switch, fuel selector, power & mixture." });
part(() => box(0.4, 0.18, 0.02), ["electrical"], { pos: [1.78, -0.4, -0.14], color: "#5A4A1C", name: "Circuit breaker panel", note: "Left side of the center console. Holds ESS 1/2, MAIN 1/2/3, NON ESS, A/C 1/2 and AVIONICS bus breakers.", pin: true });
([[1.25, -0.33, "Pilot seat", 0.4], [1.25, 0.33, "Front passenger seat", 0.4], [0.35, -0.24, "Rear seat (2+1 bench)", 0.46], [0.35, 0.28, "Rear seat", 0.4]] as [number, number, string, number][]).forEach(([x, z, name, w], i) => {
  part(() => box(0.48, 0.1, w), ["cabin"], { pos: [x, -0.4, z], color: "#6B5A48", name, note: i < 2 ? "Adjusts fore/aft on an upward-angled track. Honeycomb core crushes to absorb vertical impact — never stand on it." : "Seat backs split 60/40 and fold forward for long cargo." });
  part(() => box(0.09, 0.58, w * 0.92), ["cabin"], { pos: [x - 0.27, -0.08, z], rot: [0, 0, 0.2], color: "#6B5A48", name, note: i < 2 ? "4-point harness with inflatable shoulder belt (airbag)." : "3-point harness on inertia reels at the rear bulkhead." });
});
export const YOKES = [{ side: "L", z: -0.46 }, { side: "R", z: 0.46 }];
export const YOKE_X = 2.02, YOKE_Y = -0.06;
YOKES.forEach(({ side }) => {
  part(() => cyl(0.018, 0.5, "x"), ["controls"], { parent: "yoke:" + side, chan: ["elevator", "aileron"], pos: [0.27, 0, 0], color: "#555E66", name: "Yoke tube", note: "Slides fore/aft in its bearing carriage for pitch (driving the elevator drop link) and rotates the carriage for roll." });
  part(() => box(0.05, 0.14, 0.045), ["controls"], { parent: "grip:" + side, chan: ["elevator", "aileron"], color: "#20262B", name: "Side yoke", note: "Conical trim button on top: fore/aft = pitch trim, left/right = roll trim. PTT switch for COM." });
  part(() => box(0.045, 0.045, 0.17), ["controls"], { parent: "grip:" + side, chan: ["elevator", "aileron"], pos: [0, 0.05, 0], color: "#20262B" });
});
part(() => box(0.08, 0.05, 0.05), ["controls"], { pos: [-2.66, 0.05, 0.04], color: "#9F85E6", chan: ["elevator"], name: "Pitch trim cartridge", note: "Electric motor shifts the spring cartridge's neutral point. 2 A PITCH TRIM breaker, ESS BUS 2." });
part(() => box(0.08, 0.04, 0.06), ["controls"], { pos: P(wingP(-3.4, 0.66, 0)), color: "#9F85E6", chan: ["aileron"], name: "Roll trim cartridge", note: "Spring cartridge at the left actuation pulley. Autopilot also uses it. 2 A ROLL TRIM, ESS BUS 2." });
part(() => box(0.08, 0.04, 0.06), ["controls"], { pos: [PEDAL_TT.x - 0.05, PEDAL_TT.y, -0.22], color: "#9F85E6", chan: ["rudder"], name: "Yaw trim spring cartridge", note: "Centering spring on the pedal torque tube. Ground-adjustable only." });
export const FT = { x: 0.66, y: -0.54 };
part(() => cyl(0.02, 1.9, "z"), ["flaps"], { pos: [FT.x, FT.y, 0], color: "#9F85E6", name: "Flap torque tube", note: "Mechanically ties both flaps to one actuator." });
part(() => box(0.24, 0.07, 0.09), ["flaps"], { pos: [FT.x + 0.02, FT.y + 0.02, 0], color: "#7C57CF", name: "Flap actuator", note: "Motorized linear actuator; proximity switches stop travel and drive the position lights. 10 A FLAPS, NON ESS BUS.", pin: true });
part(() => box(0.06, 0.08, 0.07), ["flaps"], { pos: [2.12, -0.36, 0.02], color: "#7C57CF", name: "FLAPS switch", note: "Airfoil-shaped knob with UP / 50% / 100% detents at the bottom of the console. UP light green, 50/100 lights amber.", pin: true });
part(() => cyl(0.045, 0.03, "y"), ["fuel"], { pos: [1.24, -0.25, 0], name: "Fuel selector valve", note: "LEFT / RIGHT / OFF at the rear of the console. Lift the release to select OFF.", pin: true });
part(() => box(0.09, 0.02, 0.02), ["fuel"], { pos: [1.24, -0.23, 0], color: "#F2F5F7", anim: "selPtr" });
part(() => box(0.04, 0.03, 0.04), ["fuel"], { pos: [1.34, -0.26, 0.08], name: "BOOST PUMP switch", note: "Next to the selector. On for takeoff, climb, maneuvering, landing and tank switching." });
part(() => new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), ["caps", "cabin"], { pos: [1.3, 0.63, -0.02], color: "#D32640", name: "CAPS activation T-handle", note: "Ceiling, centerline, above the pilot's right shoulder. Pull ~2 in. of slack, then pull straight down (up to 45 lb).", pin: true });
part(() => box(0.03, 0.02, 0.15), ["caps", "cabin"], { pos: [1.3, 0.58, -0.02], color: "#D32640" });
part(() => cyl(0.04, 0.24), ["cabin"], { pos: [2.18, -0.45, -0.5], color: "#D32640", name: "Fire extinguisher", note: "Halon 1211, class B & C. Forward outboard in the pilot footwell. About 2.5 lb; check gauge/pin preflight.", pin: true });
part(() => box(0.22, 0.05, 0.12), ["cabin"], { pos: [1.45, -0.24, 0], color: "#8A6A3A", name: "Armrest: egress hammer & hour meters", note: "8 oz ball-peen hammer for breaking the acrylic windows. HOBBS runs with BAT 1 + either ALT on; FLIGHT starts ~35 KIAS.", pin: true });
part(() => box(0.16, 0.09, 0.11), ["cabin", "caps"], { pos: [-0.8, -0.28, 0.13], color: "#EB7A12", name: "ELT — Artex ELT 1000", note: "406 MHz + 121.5 MHz. Triggers at 4–5 ft/s longitudinal Δv or on CAPS deployment. Removable for portable use.", pin: true });
part(() => box(0.05, 0.04, 0.02), ["cabin"], { pos: [1.92, -0.44, -0.14], color: "#EB7A12", name: "ELT remote switch (RCPI)", note: "ON – ARM/OFF – TEST, red LED flashes when transmitting. Below the ALT AIR knob by the pilot's right knee." });
part(() => box(0.05, 0.05, 0.03), ["engine"], { pos: [1.92, -0.36, -0.14], color: "#E0B040", name: "ALT AIR – PULL knob", note: "Press lock button, pull, release. Use if induction filter blockage is suspected." });

/* ---------- electrical ---------- */
part(() => box(0.07, 0.18, 0.14), ["electrical"], { pos: [2.66, -0.08, -0.33], name: "Master Control Unit", note: "Left firewall. Regulates both alternators, houses the three distribution buses, fuses, the MDB1→MDB2 diode and the starter/external-power relays.", pin: true });
part(() => box(0.13, 0.17, 0.2), ["electrical"], { pos: [2.7, -0.04, 0.34], name: "BAT 1 — 24 V, 10 Ah", note: "Lead-acid, right firewall. Charged from Main Dist Bus 1; used for starting.", pin: true });
part(() => box(0.2, 0.13, 0.26), ["electrical"], { pos: [-0.76, 0, 0], name: "BAT 2 — 2 × 12 V, 7 Ah", note: "Sealed lead-acid pair in series, aft of FS 222 below the parachute canister. Charged from ESS BUS 1.", pin: true });
part(() => box(0.08, 0.07, 0.02), ["electrical"], { pos: [2.45, -0.3, -0.6], name: "Ground service receptacle", note: "Left side just aft of the cowl. Regulated 28 V; works only with BAT 1 on.", ext: true });

/* ---------- avionics ---------- */
part(() => box(0.1, 0.09, 0.15), ["avionics", "pitot"], { pos: [2.43, 0.1, -0.24], name: "GSU 75 ADAHRS", note: "Behind the PFD: attitude/heading reference plus air data computer. ADAHRS 1 on ESS BUS 1.", pin: true });
part(() => box(0.12, 0.11, 0.15), ["avionics"], { pos: [2.44, 0.12, 0.2], name: "GIA 63W/64W ×2", note: "Integrated avionics units: WAAS GPS, VHF COM/NAV/GS, integration. GIA 1 on ESS BUS 1, GIA 2 on MAIN BUS 2.", pin: true });
part(() => box(0.1, 0.07, 0.1), ["avionics", "engine"], { pos: [2.44, -0.04, 0.3], name: "GEA 71 Engine Airframe Unit", note: "Digitizes fuel, CHT, EGT, MAP, RPM and other sensors. 3 A ENGINE INSTR on ESS BUS 2." });
part(() => box(0.2, 0.03, 0.18), ["avionics"], { pos: [2.02, -0.26, 0], name: "GCU 479 FMS keyboard", note: "Top of the console. Data entry, tuning, course. KEYPADS / AP CTRL on MAIN BUS 1." });
part(() => box(0.16, 0.09, 0.12), ["avionics"], { pos: [-1.15, -0.08, -0.1], name: "GTX 335/345 transponder", note: "In the empennage avionics bay. XPONDER breaker on the AVIONICS bus." });
const ANT = "#C8399F";
part(() => cyl(0.007, 0.3), ["avionics"], { pos: [0.45, 0.82, 0], rot: [0, 0, 0.45], color: ANT, name: "COM 1 antenna", note: "Rod on top above the passenger compartment.", ext: true });
part(() => cyl(0.007, 0.26), ["avionics"], { pos: [-0.35, -0.7, 0], rot: [0, 0, -0.45], color: ANT, name: "COM 2 antenna", note: "Rod below the baggage compartment.", ext: true });
part(() => cyl(0.05, 0.015), ["avionics"], { pos: [1.0, 0.72, 0], color: ANT, name: "GPS 1 antenna", note: "Above the passenger compartment (GPS/XM combo if XM installed).", ext: true });
part(() => cyl(0.05, 0.015), ["avionics"], { pos: [-0.28, 0.54, 0], color: ANT, name: "GPS 2 / Iridium antenna", note: "Just forward of the baggage-compartment window.", ext: true });
part(() => box(0.2, 0.015, 0.015), ["avionics"], { pos: [-3.36, 1.48, 0], color: ANT, name: "NAV antenna", note: "Top of the fin: VOR/LOC and glideslope for both GIAs.", ext: true });
part(() => box(0.08, 0.08, 0.01), ["avionics"], { pos: [-0.72, -0.57, 0.12], color: ANT, name: "Transponder antenna", note: "Belly, just aft of the baggage bulkhead, right side.", ext: true });
part(() => box(0.2, 0.012, 0.08), ["avionics"], { pos: [0.25, topY(0.25) + 0.004, 0], color: ANT, name: "Stormscope antenna (optional)", note: "Lightning-detection antenna directly above the passenger compartment.", ext: true });
part(() => box(0.14, 0.06, 0.012), ["avionics"], { pos: [1.45, topY(1.45) + 0.03, 0], color: ANT, name: "Traffic antenna, top (optional)", note: "Just above the pilot/copilot compartment; a second traffic antenna sits under the belly.", ext: true });
part(() => box(0.3, 0.012, 0.1), ["avionics"], { pos: [-0.25, botY(-0.25) - 0.004, 0], color: ANT, name: "Marker beacon antenna", note: "Sled type, below the baggage compartment floor.", ext: true });
part(() => box(0.1, 0.06, 0.012), ["avionics"], { pos: [2.3, botY(2.3) - 0.03, 0.1], color: ANT, name: "DME antenna (optional)", note: "Blade on the belly just aft and right of the firewall.", ext: true });
part(() => box(0.07, 0.04, 0.07), ["avionics"], { pos: P(wingP(-4.9, 0.45, 0)), color: ANT, name: "Magnetometer (MAG 1)", note: "Senses the local magnetic field for AHRS heading. Mounted out near a wing tip, away from ferrous masses. Exact location approximate.", pin: true });

/* ---------- pitot-static & stall ---------- */
export const PITOT_Z = -3.2;
export const pitotBase = wingP(PITOT_Z, 0.3, -1);
part(() => tubeGeo([pitotBase, [pitotBase.x, pitotBase.y - 0.16, PITOT_Z]], 0.013), ["pitot"], { name: "Pitot mast", note: "Single heated pitot, left wing underside.", ext: true });
part(() => cyl(0.016, 0.28, "x"), ["pitot"], { pos: [pitotBase.x + 0.11, pitotBase.y - 0.16, PITOT_Z], name: "Heated pitot tube", note: "Element heated when PITOT HEAT is on. 7.5 A breaker on NON ESS BUS; current sensor drives PITOT HEAT FAIL.", pin: true, ext: true });
export const SPX = -1.6;
export const statR = fus(SPX);
[1, -1].forEach((s) => part(() => cyl(0.025, 0.006, "z"), ["pitot"], { pos: [SPX, statR.cy, s * statR.hw], color: "#3A9448", name: "Static port (" + (s > 0 ? "R" : "L") + ")", note: "Dual static ports in the fuselage.", pin: s > 0, ext: true }));
part(() => box(0.05, 0.05, 0.03), ["pitot"], { pos: [1.84, -0.3, -0.14], color: "#3A9448", name: "Alternate static valve", note: "Console, right of the pilot's leg. Uses cabin pressure; apply Section 5 corrections.", pin: true });
part(() => box(0.05, 0.04, 0.05), ["pitot"], { pos: [0.9, -0.62, 0], color: "#3A9448", name: "Water traps", note: "Drains at pitot/static low points under the cabin floor. Drain at annual or when water suspected." });
export const STALL_Z = 3.0;
part(() => sph(0.025), ["pitot"], { pos: P(wingP(STALL_Z, 0, 0)), color: "#3A9448", name: "Stall warning inlet", note: "Right wing leading edge. Sucks as the low-pressure peak moves forward near stall → pressure switch → horn, red STALL, autopilot disconnect.", pin: true, ext: true });
part(() => sph(0.04), ["pitot"], { pos: P(wingP(STALL_Z, 0.3, 1)), color: "#E0263B", anim: "suction", name: "Low-pressure peak", note: "Moves forward around the leading edge as angle of attack increases.", ext: true });
[-2.15, -2.3].forEach((z, i) => {
  const b = wingP(z, 0.45, -1);
  part(() => tubeGeo([b.clone().add(V(0, 0.01, 0)), b.clone().add(V(0.01, -0.07, 0))], 0.006), ["pitot", "avionics"], { color: "#8C959C", name: "OAT probes", note: "Two outside-air-temperature probes under the left wing feed the air data computers (location per Costanzo deck photo).", ext: true, pin: i === 0 });
});

/* ---------- fuel system hardware (tanks are rendered separately) ---------- */
[1, -1].forEach((s) => {
  part(() => box(0.2, 0.07, 0.16), ["fuel"], { pos: P(wingP(s * 0.72, 0.45, 0)), name: (s > 0 ? "Right" : "Left") + " collector tank / sump", note: "Tank fuel gravity-feeds through strainers and a flapper valve into the collector. Flush drain." });
  part(() => box(0.08, 0.012, 0.12), ["fuel"], { pos: P(wingP(s * 5.1, 0.45, -1).add(V(0, -0.006, 0))), color: "#2F7FE6", name: "NACA fuel vent", note: "Under the wing near the tip. A blocked vent starves the engine — check it preflight.", ext: true });
  part(() => sph(0.025), ["fuel"], { pos: P(wingP(s * 1.3, 0.3, -1)), color: "#0B3A80", name: "Tank drain", note: "One of 5 drains: 2 tank, 2 collector, 1 gascolator. Sample before every flight.", ext: true });
  part(() => cyl(0.045, 0.012), ["fuel"], { pos: P(wingP(s * 2.7, 0.38, 1)), color: "#2F7FE6", name: "Filler cap", note: "Top of each wing. Filling to the tab = 13 gal usable per side.", ext: true });
});
part(() => box(0.1, 0.08, 0.1), ["fuel"], { pos: [1.66, -0.62, 0.1], name: "Electric boost pump", note: "Single-speed, continuous 23 psi boost for priming, vapor suppression and backup. 5 A FUEL PUMP, MAIN BUS 2.", pin: true });
part(() => cyl(0.045, 0.1), ["fuel"], { pos: [2.7, -0.52, 0.08], name: "Gascolator", note: "Filter/sump at the low point ahead of the firewall. Drain preflight.", pin: true });
part(() => cyl(0.045, 0.09, "x"), ["fuel", "engine"], { pos: [2.8, -0.3, 0.12], name: "Engine-driven fuel pump", note: "Draws fuel from the selected collector and pressure-feeds the servo." });
part(() => box(0.07, 0.05, 0.07), ["fuel", "engine"], { pos: [3.1, 0, 0], name: "Flow divider (“the spider”) + FF transducer", note: "Top of the engine. Distributes metered fuel to four injector nozzles; fuel flow is measured just upstream.", pin: true });

/* ---------- environmental ---------- */
part(() => box(0.1, 0.03, 0.02), ["environment"], { pos: [3.42, -0.38, 0.49], name: "NACA fresh-air inlet", note: "Lower right cowl. Ram air for ventilation and the heat muff.", pin: true, ext: true });
part(() => box(0.1, 0.12, 0.14), ["environment"], { pos: [2.54, -0.46, 0.3], name: "Mixing chamber", note: "Lower right firewall. Hot-air and fresh-air valves on the forward side set the blend.", pin: true });
part(() => box(0.08, 0.12, 0.28), ["environment"], { pos: [2.52, -0.25, 0], name: "Distribution manifold + fan", note: "Center, aft side of firewall. Butterfly valves feed floor and defrost; panel vents always fed. Optional 3-speed blower.", pin: true });
part(() => box(0.2, 0.07, 0.2), ["environment"], { pos: [1.25, -0.58, 0.33], color: "#6EC9E6", name: "A/C evaporator (optional)", note: "Under the front passenger seat. Condensate drains overboard through the belly." });

/* ---------- CAPS ---------- */
export const CAPS_BOX: Vec3 = [-0.76, 0.22, 0];
part(() => box(0.4, 0.18, 0.26), ["caps"], { pos: CAPS_BOX, name: "CAPS canister", note: "Composite box aft of the baggage bulkhead holding the 2,400 ft² canopy and solid-propellant rocket, under a thin composite cover.", pin: true });
export const HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = { fwdL: [2.55, 0.1, -0.4], fwdR: [2.55, 0.1, 0.4], aft: [AB, 0.2, 0] };
[-1, 1].forEach((s) => part(() => tubeGeo([[-0.6, 0.3, s * 0.12], [0, 0.5, s * 0.25], [1.2, 0.6, s * 0.3], [2.0, 0.45, s * 0.35], [2.55, 0.1, s * 0.4]], 0.012), ["caps"], { name: "Forward harness strap", note: "Runs just under the skin to the firewall; tears through the covering during deployment.", pin: s > 0 }));
part(() => tubeGeo([[-0.62, 0.24, 0], [AB, 0.2, 0]], 0.014), ["caps"], { name: "Aft harness strap", note: "Attaches at the aft baggage bulkhead." });

/* ---------- lights ---------- */
const tipAt = (s: number): Vec3 => [wLE(5.84) - 0.5 * wC(5.84), wY(5.84), s * 5.85];
export const LIGHTS = {
  tipL: tipAt(-1), tipR: tipAt(1), tail: [-3.38, -0.11, 0] as Vec3,
  dome: [1.2, 0.64, 0] as Vec3,
  foot: [[2.2, -0.55, -0.35], [2.2, -0.55, 0.35], [0.8, -0.56, -0.35], [0.8, -0.56, 0.35]] as Vec3[],
  step: [[1.55, -0.74, -0.52], [1.55, -0.74, 0.52]] as Vec3[],
  bag: [-0.3, 0.48, 0] as Vec3,
};
([["Dome light", LIGHTS.dome, false], ["Footwell light", LIGHTS.foot[0], false], ["Entry step light", LIGHTS.step[0], true], ["Baggage light", LIGHTS.bag, false]] as [string, Vec3, boolean][]).forEach(([name, pos, ext]) =>
  part(() => sph(0.022), ["lighting"], { pos, color: "#E8C46A", name, note: "Convenience lighting, 5 A CONV LIGHTS breaker on the CONV bus (BAT 1 direct).", pin: true, ext }));
([[LIGHTS.tipL, "Left nav/strobe (red)"], [LIGHTS.tipR, "Right nav/strobe (green)"], [LIGHTS.tail, "Tail position light"]] as [Vec3, string][]).forEach(([pos, name]) =>
  part(() => sph(0.035), ["lighting"], { pos, color: "#D9D9D9", name, note: "Exterior lighting is described in the Spectra wing tip light supplement (11934-S56). NAV and STROBE breakers on NON ESS BUS.", pin: true, ext: true }));


/* ---------- flight-control mechanisms (POH Figures 7-1, 7-2, 7-3) ---------- */
const CTL = "#7C57CF", STEEL = "#8C959C";
// elevator: lateral torque tube under the panel with end levers and the forward cable sector
part(() => cyl(0.016, ETT.half * 2, "z"), ["controls"], { chan: ["elevator"], parent: "rig:ett", color: STEEL, name: "Elevator torque tube", note: "Lateral torque tube under the panel. Drop links from both yoke tubes rotate it; its forward sector drives the elevator cables (POH Fig. 7-1).", pin: true });
[-1, 1].forEach((sd) => part(() => box(0.02, ETT.lever, 0.02), ["controls"], { chan: ["elevator"], parent: "rig:ett", pos: [Math.sin(LEVER_ANG) * ETT.lever / 2, Math.cos(LEVER_ANG) * ETT.lever / 2, sd * CARR.z], rot: [0, 0, -LEVER_ANG], color: STEEL, name: "Torque tube lever", note: "Lever arm at each end of the elevator torque tube; the yoke drop link attaches to its tip." }));
part(() => sectorGeo(ETT.sectorR), ["controls"], { chan: ["elevator"], parent: "rig:ett", pos: [0, 0, ETT.sectorZ], color: CTL, name: "Forward elevator sector", note: "Cable sector on the torque tube. The two elevator cables leave it as a crossed pair to the forward pulleys.", pin: true });
part(() => cyl(0.02, 0.05, "z"), ["controls"], { chan: ["elevator"], pos: [ETT.c[0], ETT.c[1], -0.25], color: "#5A636A", name: "Torque tube bearing block", note: "Bearing blocks support the elevator torque tube." });
part(() => cyl(0.02, 0.05, "z"), ["controls"], { chan: ["elevator"], pos: [ETT.c[0], ETT.c[1], 0.25], color: "#5A636A" });
// aileron: pivoting bearing carriages, central pulley sector
[-1, 1].forEach((sd) => {
  const parent = "rig:carr:" + (sd < 0 ? "L" : "R");
  part(() => box(0.2, 0.02, 0.05), ["controls"], { chan: ["aileron"], parent, pos: [0, -0.03, 0], color: STEEL, name: "Aileron bearing carriage", note: "The yoke tube rotates this pivoting carriage for roll and slides through it for pitch (POH Fig. 7-2).", pin: sd > 0 });
  part(() => box(0.02, CARR.arm, 0.02), ["controls"], { chan: ["aileron"], parent, pos: [CARR.armX, -CARR.arm / 2, 0], color: STEEL, name: "Carriage arm", note: "Drives the lateral push rod to the central aileron sector." });
});
part(() => { const g = new THREE.CylinderGeometry(AIL_SECTOR.r, AIL_SECTOR.r, 0.014, 32); g.rotateZ(Math.PI / 2); return g; }, ["controls"], { chan: ["aileron"], parent: "rig:ailSector", color: CTL, name: "Central aileron pulley sector", note: "Centrally located pulley sector: the push rod turns it and it drives both aileron cables down to the floor pulleys.", pin: true });
part(() => box(0.012, 0.02, 0.012), ["controls"], { chan: ["aileron"], parent: "rig:ailSector", pos: [0, AIL_SECTOR.r, 0], color: STEEL });
// rudder: pedal torque tube and cable horn
part(() => cyl(0.014, PEDAL_TT.half * 2, "z"), ["controls", "gear"], { chan: ["rudder"], pos: [PEDAL_TT.x, PEDAL_TT.y, 0], color: STEEL, name: "Rudder pedal torque tube", note: "Carries the four pedals; springs and a ground-adjustable spring cartridge here centre the rudder." , pin: true });
part(() => box(0.03, 0.02, RUD_HORN.half * 2 + 0.02), ["controls"], { chan: ["rudder"], parent: "rig:rudHorn", color: CTL, name: "Rudder cable horn", note: "Pedal links pivot this horn; its ends pull the two rudder cable strands.", pin: true });
part(() => cyl(0.008, 0.05, "y"), ["controls"], { chan: ["rudder"], pos: RUD_HORN.c, color: STEEL });
// arm from each pedal pair's inboard pedal across to its pedal link
[-1, 1].forEach((sd) => {
  const z0 = sd * 0.14, z1 = RUD_HORN.c[2] + sd * RUD_HORN.half;
  part(() => box(0.02, 0.015, Math.abs(z1 - z0) + 0.02), ["controls"], { chan: ["rudder"], parent: sd < 0 ? "rig:pedL" : "rig:pedR", pos: [PEDAL_TT.x, RUD_HORN.c[1], (z0 + z1) / 2], color: STEEL, name: "Pedal arm", note: "Ties each pedal pair to its pedal link; pushing a pedal forward pulls the horn." });
});
// pulleys (each in its own group so it can turn with cable travel)
Object.entries(PULLEYS).forEach(([k, d]) =>
  part(() => pulleyGeo(d.r, d.axis, d.double, d.gap), ["controls"], { chan: chanOfKey(k === "ef" || k === "em" || k === "ea" ? "el" : k.startsWith("a") ? "ail" : "rud"), parent: "rig:pul:" + k, color: k === "ea" || k === "ra" || k.startsWith("aw") ? CTL : "#A6AEB4", name: d.name, note: d.note, pin: true }));
// crank pins on the aft sectors
part(() => cyl(0.008, 0.03, "z"), ["controls"], { chan: ["elevator"], parent: "rig:pul:ea", pos: [0, -0.06, 0], color: STEEL });
part(() => cyl(0.008, 0.03, "y"), ["controls"], { chan: ["rudder"], parent: "rig:pul:ra", pos: [0, 0, 0.05], color: STEEL });
// bellcranks on the surfaces
{
  const pv = surfacePivot("elevR"), c = ELEV_HORN.c;
  part(() => box(0.02, ELEV_HORN.arm, 0.02), ["controls"], { parent: "surf:elevR", pos: [c[0] - pv[0], c[1] - ELEV_HORN.arm / 2 - pv[1], c[2] - pv[2]], color: CTL, name: "Elevator bellcrank", note: "Between the elevator halves; the push-pull tube from the aft sector pulley drives it.", pin: true });
  part(() => cyl(0.014, 0.2, "z"), ["controls"], { parent: "surf:elevR", pos: [c[0] - pv[0], c[1] - pv[1], c[2] - pv[2]], color: STEEL, name: "Elevator torque tube (tail)", note: "Joins the two elevator halves on the hinge line." });
  const rv = surfacePivot("rudder"), r = RUD_HORN_AFT.c;
  part(() => box(0.02, 0.02, RUD_HORN_AFT.arm), ["controls"], { parent: "surf:rudder", pos: [r[0] - rv[0], r[1] - rv[1], RUD_HORN_AFT.arm / 2 - rv[2]], color: CTL, name: "Rudder bellcrank", note: "Horn at the bottom of the rudder; the push-pull tube from the aft rudder sector drives it.", pin: true });
  [1, -1].forEach((sd) => {
    const key = "ail" + (sd > 0 ? "R" : "L"), av = surfacePivot(key);
    const hz = wingP(sd * AIL_DRIVE.z, 0.75, 0);
    part(() => box(0.012, AIL_DRIVE.arm, 0.012), ["controls"], { chan: ["aileron"], parent: "surf:" + key, pos: [hz.x - av[0], hz.y + AIL_DRIVE.arm / 2 - av[1], hz.z - av[2]], color: CTL, name: "Aileron conical drive arm", note: "Right-angle drive: the arm on the aileron hinge that the wing sector's crank turns." });
    part(() => box(0.012, 0.012, AIL_DRIVE.crank), ["controls"], { chan: ["aileron"], parent: "rig:pul:aw" + (sd > 0 ? "R" : "L"), pos: [0, AIL_DRIVE.lift, sd * AIL_DRIVE.crank / 2], color: STEEL, name: "Wing sector crank arm", note: "Swings fore-aft as the sector turns and drives the aileron's conical drive arm." });
  });
}
// turnbuckles and cable guides
([["elA", 3, 0.25], ["elB", 4, 0.25], ["elA", 3, 0.35], ["elB", 4, 0.35], ["rudR", 2, 0.3], ["rudL", 2, 0.3]] as [string, number, number][]).forEach(([k, i, t], j) =>
  part(() => cyl(0.009, 0.07, "x"), ["controls"], { chan: chanOfKey(k), pos: alongCable(k, i, t), color: "#C9B98F", name: "Turnbuckle", note: "Sets cable tension; safety-wired after rigging.", pin: j === 0 }));
[1, -1].forEach((sd) => [["ailBal", sd > 0 ? 1 : 6], ["ail" + (sd > 0 ? "R" : "L"), 7]].forEach(([k, i]) =>
  part(() => box(0.03, 0.03, 0.02), ["controls"], { chan: ["aileron"], pos: alongCable(k as string, i as number, 0.5), color: "#C9D0D5", name: "Cable guide", note: "Fairlead that keeps the aileron cable centred as it runs spanwise (the clips drawn in POH Fig. 7-2).", pin: sd > 0 && k === "ailBal" }))
);

/* ---------- lookups ---------- */
export const partsFor = (parent?: string) => PARTS.filter((p) => p.parent === parent);
/** Unique pinned, named parts for a system (labels and "tap to locate" lists). */
export function pinnedParts(sys: SysId) {
  const seen = new Set<string>();
  return PARTS.filter((p) => p.pin && p.name && p.sys.includes(sys) && !seen.has(p.name) && (seen.add(p.name), true));
}
export { FIN };
