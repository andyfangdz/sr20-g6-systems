/** Pipes, wires, ducts and cables with moving particles, plus the rules that drive them. */
import * as THREE from "three";
import { V, type Vec3 } from "./math";
import { CYLS, FT, PITOT_Z, SPX, STALL_Z, chanOfKey, pitotBase, statR } from "./parts";
import { CABLES } from "./rig";
import { wingP } from "./geometry";
import { fuelAvail, live, type Elec, type Sim } from "./sim/model";
import type { SysId } from "./systems";

export interface FlowSpec {
  key: string;
  pts: (Vec3 | THREE.Vector3)[];
  sys: SysId[];
  name?: string;
  note?: string;
  color?: string;
  pcolor?: string;
  r?: number;
  tube?: boolean;
  count?: number;
  size?: number;
  tension?: number;
  ext?: boolean;
  chan?: ReturnType<typeof chanOfKey>;
}

const F: FlowSpec[] = [];
const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) => F.push({ key, pts, sys, ...o });

// electrical wiring
flow("alt1", [[3.5, -0.3, 0.16], [3.25, -0.46, 0.18], [2.9, -0.4, -0.1], [2.68, -0.12, -0.29]], ["electrical"], { name: "ALT 1 output", note: "100 A fuse into Main Distribution Bus 1." });
flow("alt2", [[3.5, -0.3, -0.16], [3.25, -0.46, -0.22], [2.9, -0.3, -0.34], [2.68, -0.06, -0.33]], ["electrical"], { name: "ALT 2 output", note: "80 A fuse into Main Distribution Bus 2." });
flow("bat1", [[2.7, -0.04, 0.24], [2.66, 0.1, 0], [2.67, -0.04, -0.26]], ["electrical"], { name: "BAT 1 feed", note: "BAT 1 relay connects the battery to the MCU distribution buses and starter relay." });
flow("cb", [[2.62, -0.14, -0.33], [2.45, -0.48, -0.32], [2.1, -0.55, -0.2], [1.8, -0.42, -0.15]], ["electrical"], { name: "MCU → breaker panel", note: "30 A fuses in the MCU feed each circuit-breaker bus.", r: 0.016 });
flow("bat2", [[-0.76, -0.02, 0], [-0.45, -0.52, -0.08], [0.6, -0.62, -0.12], [1.55, -0.55, -0.15], [1.78, -0.42, -0.15]], ["electrical"], { name: "BAT 2 feed", note: "Through the 20 A BAT 2 breaker to ESS BUS 1." });

// fuel
const collector = (s: number) => wingP(s * 0.72, 0.45, 0);
const tankOut = (s: number) => wingP(s * 1.15, 0.35, -1).add(V(0, 0.03, 0));
flow("fuelL", [tankOut(-1), collector(-1), [1.2, -0.62, -0.3], [1.24, -0.28, 0]], ["fuel"], { name: "Left feed line", note: "Collector → selector valve." });
flow("fuelR", [tankOut(1), collector(1), [1.2, -0.62, 0.3], [1.24, -0.28, 0]], ["fuel"], { name: "Right feed line", note: "Collector → selector valve." });
flow("fuelMain", [[1.24, -0.28, 0], [1.4, -0.62, 0.08], [1.66, -0.62, 0.1], [2.2, -0.62, 0.08], [2.7, -0.52, 0.08], [2.8, -0.3, 0.12], [3.05, -0.42, 0.05], [3.32, -0.4, 0.05], [3.28, -0.12, 0.05], [3.1, 0, 0]], ["fuel", "engine"], { name: "Fuel supply", note: "Selector → boost pump → gascolator → firewall → engine pump → servo → flow divider.", r: 0.014 });
CYLS.forEach((c) => flow("inj" + c.n, [[3.1, 0, 0], [c.x, -0.04, c.s * 0.14], [c.x, -0.1, c.s * 0.33]], ["fuel", "engine"], { name: "Injector line, cyl " + c.n, note: "Continuous-flow nozzle at each intake port.", r: 0.007, count: 5 }));

// induction & exhaust
flow("intake", [[3.76, -0.13, 0.22], [3.58, -0.15, 0.2], [3.45, -0.3, 0.1], [3.32, -0.4, 0], [3.14, -0.4, 0]], ["engine"], { tube: false, pcolor: "#8FD3E8", size: 0.07 });
CYLS.forEach((c) => flow("man" + c.n, [[3.14, -0.4, 0], [c.x, -0.34, c.s * 0.15], [c.x, -0.22, c.s * 0.27]], ["engine"], { r: 0.016, color: "#8A969E", pcolor: "#8FD3E8", count: 4, name: "Intake manifold tube", note: "Four-tube manifold to the intake ports." }));
CYLS.forEach((c) => flow("exh" + c.n, [[c.x, -0.2, c.s * 0.36], [c.x, -0.4, c.s * 0.3], [3.04, -0.44, 0.1]], ["engine"], { r: 0.016, color: "#8A5A3C", pcolor: "#FF8A4A", count: 4, name: "Exhaust riser", note: "To the muffler." }));
flow("tailpipe", [[3.04, -0.44, 0.36], [2.95, -0.56, 0.3], [2.85, -0.68, 0.22]], ["engine"], { r: 0.024, color: "#8A5A3C", pcolor: "#FF8A4A", name: "Exhaust tailpipe", note: "Exits through the lower cowl.", ext: true });
flow("oil", [[3.08, -0.38, 0], [3.28, -0.32, -0.3], [3.36, -0.1, -0.35], [3.45, -0.02, -0.2], [3.55, -0.06, 0], [3.25, -0.02, 0], [2.95, -0.1, 0]], ["engine", "propeller"], { r: 0.01, color: "#B85A2A", name: "Oil circuit", note: "Sump → suction screen → oil cooler → full-flow filter → galleries, and to the prop governor." });

// environmental
const AIR = "#149C94";
flow("fresh", [[3.4, -0.37, 0.44], [3.1, -0.5, 0.4], [2.75, -0.48, 0.34], [2.56, -0.46, 0.3]], ["environment"], { r: 0.025, color: AIR, pcolor: "#5FC8F0", name: "Fresh-air duct", note: "NACA inlet → fresh-air valve on the forward firewall." });
flow("hot", [[3.62, -0.06, 0.28], [3.3, -0.3, 0.34], [3.04, -0.44, 0.22], [2.8, -0.5, 0.3], [2.56, -0.46, 0.3]], ["environment"], { r: 0.025, color: "#E0522B", pcolor: "#FF7A3D", name: "Heat duct", note: "Ram air → heat muff → hot-air valve → mixing chamber." });
flow("toMan", [[2.54, -0.46, 0.3], [2.53, -0.36, 0.15], [2.52, -0.25, 0]], ["environment"], { r: 0.03, color: AIR, name: "Mixing chamber → manifold" });
const E0: Vec3 = [2.52, -0.25, 0];
flow("panelL", [E0, [2.42, 0, -0.32], [2.3, 0.2, -0.44]], ["environment"], { r: 0.018, color: AIR, name: "Panel vent duct (L)", note: "Panel eyeball outlets are always fed." });
flow("panelR", [E0, [2.42, 0, 0.32], [2.3, 0.2, 0.44]], ["environment"], { r: 0.018, color: AIR, name: "Panel vent duct (R)" });
flow("armL", [E0, [1.8, -0.62, -0.4], [0.5, -0.3, -0.55], [0.4, 0, -0.55]], ["environment"], { r: 0.014, color: AIR, name: "Armrest vent (rear L)", note: "Chest-high passenger outlets in the cabin wall armrests." });
flow("armR", [E0, [1.8, -0.62, 0.4], [0.5, -0.3, 0.55], [0.4, 0, 0.55]], ["environment"], { r: 0.014, color: AIR, name: "Armrest vent (rear R)" });
flow("floorF", [E0, [2.36, -0.55, -0.35]], ["environment"], { r: 0.014, color: AIR, name: "Front floor outlets", note: "Under each kick plate." });
flow("floorF2", [E0, [2.36, -0.55, 0.35]], ["environment"], { r: 0.014, color: AIR });
flow("floorR", [E0, [1.6, -0.62, -0.15], [0.8, -0.58, -0.4]], ["environment"], { r: 0.014, color: AIR, name: "Rear foot-warmer diffusers" });
flow("floorR2", [E0, [1.6, -0.62, 0.15], [0.8, -0.58, 0.4]], ["environment"], { r: 0.014, color: AIR });
flow("defrost", [E0, [2.5, 0.15, 0], [2.36, 0.33, 0], [2.34, 0.34, 0.26]], ["environment"], { r: 0.018, color: AIR, name: "Windshield diffuser duct", note: "Glareshield diffuser blows on the windshield base." });
flow("defrost2", [[2.36, 0.33, 0], [2.34, 0.34, -0.26]], ["environment"], { r: 0.018, color: AIR });

// pitot-static
const ADAHRS: Vec3 = [2.43, 0.1, -0.24];
flow("pitot", [pitotBase.clone().add(V(0, 0.015, 0)), wingP(PITOT_Z, 0.35, 0), wingP(-1.0, 0.4, 0), [1.5, -0.62, -0.2], [2.2, -0.5, -0.25], ADAHRS], ["pitot"], { r: 0.009, name: "Pitot line", note: "Pitot pressure to ADAHRS (and standby)." });
flow("static", [[SPX, statR.cy, statR.hw - 0.01], [SPX + 0.2, -0.2, 0], [SPX, statR.cy, -statR.hw + 0.01]], ["pitot"], { r: 0.009, name: "Static crossover", note: "Dual static ports tied together." });
flow("static2", [[SPX + 0.2, -0.2, 0], [0.9, -0.62, 0], [2.0, -0.55, -0.1], ADAHRS], ["pitot"], { r: 0.009, name: "Static line", note: "To ADAHRS and standby, with water traps at the low points." });
flow("stall", [wingP(STALL_Z, 0.02, 0), wingP(STALL_Z, 0.3, 0), wingP(0.9, 0.4, 0)], ["pitot"], { r: 0.009, name: "Stall warning line", note: "Inlet → pressure switch." });

// control cables — laid out after POH Figures 7-1 / 7-2 / 7-3 (see lib/rig.ts)
CABLES.forEach((c) => flow(c.key, c.pts, ["controls"], { r: 0.005, size: 0.045, tension: 0.05, name: c.name, note: c.note, count: 18, chan: chanOfKey(c.key) }));
flow("flapPush", [[FT.x, FT.y, 0], [FT.x, FT.y, 0.9], wingP(1.2, 0.74, 0)], ["flaps"], { tube: false, pcolor: "#B9A3F0" });
flow("flapPush2", [[FT.x, FT.y, 0], [FT.x, FT.y, -0.9], wingP(-1.2, 0.74, 0)], ["flaps"], { tube: false, pcolor: "#B9A3F0" });

export const FLOWS = F;

const CABIN_AIR = ["toMan", "panelL", "panelR", "armL", "armR", "floorF", "floorF2", "floorR", "floorR2", "defrost", "defrost2"];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/** Particle speed multiplier per flow (0 = stopped; negative = reversed). */
export function flowRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running;
  R.alt1 = E.alt1 ? 1 : 0;
  R.alt2 = E.alt2 ? 1 : 0;
  R.bat1 = !E.bat1ok ? 0 : E.bat1Charging ? -0.6 : 1;
  R.cb = E.mdb1 || E.mdb2 ? 1 : 0;
  R.bat2 = !s.elec.bat2 ? 0 : E.bat2Charging ? -0.6 : 1;
  const feed = run || (s.fuel.boost && E.boostPwr), ok = fuelAvail(s);
  R.fuelL = feed && ok && s.fuel.sel === "L" ? 1 : 0;
  R.fuelR = feed && ok && s.fuel.sel === "R" ? 1 : 0;
  R.fuelMain = feed && ok ? (s.fuel.boost ? 1.4 : 1) : 0;
  CYLS.forEach((c) => { R["inj" + c.n] = run && ok ? 1 : 0; R["man" + c.n] = run ? 1 : 0; R["exh" + c.n] = run ? 1.2 : 0; });
  R.intake = run && !s.eng.altAir ? 1 : 0;
  R.tailpipe = run ? 1.2 : 0;
  R.oil = run ? 0.7 : 0;
  const fan = s.env.fan, air = fan < 0 ? 0 : fan === 0 ? 0.45 : 0.6 + fan * 0.4;
  R.fresh = air && !s.env.recirc ? air * (1 - s.env.temp * 0.8) : 0;
  R.hot = air && !s.env.ac && run ? air * s.env.temp : 0;
  R.toMan = air;
  ["panelL", "panelR", "armL", "armR"].forEach((k) => (R[k] = air));
  const floor = s.env.vent === "PF" || s.env.vent === "PFW", wind = s.env.vent === "PFW" || s.env.vent === "W";
  ["floorF", "floorF2", "floorR", "floorR2"].forEach((k) => (R[k] = floor ? air : 0));
  R.defrost = R.defrost2 = wind ? air : 0;
  R.pitot = 0.4; R.static = R.static2 = 0.4;
  R.stall = s.stall.aoa >= 14 && !s.stall.fault ? -1 : 0;
  // each cable loop: one strand pays out while the other takes up
  R.elA = s.ctrl.pitch * 2; R.elB = -s.ctrl.pitch * 2;
  R.ailR = s.ctrl.roll * 2; R.ailL = -s.ctrl.roll * 2; R.ailBal = -s.ctrl.roll * 2;
  R.rudR = -s.ctrl.yaw * 2; R.rudL = s.ctrl.yaw * 2;
  const flapMoving = Math.abs(live.flapAng - s.flaps.cmd * 0.32) > 0.2 && E.flapsPwr;
  R.flapPush = R.flapPush2 = flapMoving ? 1 : 0;
  return R;
}

/** Cabin-air particle colour follows the temperature knob (or A/C). */
export function cabinAirColor(s: Sim, out: THREE.Color) {
  if (s.env.ac) return out.set("#6EC9E6");
  return out.set("#5FC8F0").lerp(new THREE.Color("#FF7A3D"), s.env.temp);
}
