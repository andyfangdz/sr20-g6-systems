/**
 * Simulation model: discrete state, the electrical solver and derived logic.
 * Everything here is pure so it can run in the store, in useFrame, or in tests.
 */
import type { SysId } from "../systems";

export type Key = "OFF" | "R" | "L" | "BOTH" | "START";
export type FuelSel = "L" | "R" | "OFF";
export type Vent = "P" | "PF" | "PFW" | "W";
export type CabinSwitch = "OFF" | "ON" | "AUTO";
export type Chan = "elevator" | "aileron" | "rudder";

export interface Sim {
  sys: SysId;
  xray: boolean;
  labels: boolean;
  spin: boolean;
  focus: string | null;
  /** Flight-controls view: highlight one control channel. */
  ctrlFocus: Chan | "all";
  eng: { running: boolean; key: Key; lever: number; mix: number; altAir: boolean };
  elec: { bat1: boolean; bat2: boolean; alt1: boolean; alt2: boolean; avionics: boolean; fail: { alt1: boolean; alt2: boolean; bat1: boolean }; tBat: number };
  /** Pulled circuit breakers keyed by breaker label. */
  cb: Record<string, boolean>;
  fuel: { sel: FuelSel; boost: boolean; qL: number; qR: number };
  flaps: { cmd: 0 | 50 | 100 };
  ctrl: { pitch: number; roll: number; yaw: number };
  gear: { diff: number; park: boolean };
  /** fan: -1 OFF, 0 ram air, 1–3 blower */
  env: { fan: number; temp: number; vent: Vent; ac: boolean; recirc: boolean };
  pitot: { heat: boolean; oat: number; heaterFail: boolean; alt: boolean };
  stall: { aoa: number; fault: boolean };
  lights: { cabin: CabinSwitch; door: boolean; unlocked: boolean; bag: boolean };
  avx: { backup: boolean; pfdFail: boolean };
  /** CAPS deployment active (time itself lives in `live`). */
  capsOn: boolean;
}

export const initialSim: Sim = {
  sys: "overview", xray: true, labels: true, spin: false, focus: null, ctrlFocus: "all",
  eng: { running: true, key: "BOTH", lever: 0.72, mix: 0.85, altAir: false },
  elec: { bat1: true, bat2: true, alt1: true, alt2: true, avionics: true, fail: { alt1: false, alt2: false, bat1: false }, tBat: 0 },
  cb: {},
  fuel: { sel: "L", boost: false, qL: 24, qR: 22 },
  flaps: { cmd: 0 },
  ctrl: { pitch: 0, roll: 0, yaw: 0 },
  gear: { diff: 0, park: false },
  env: { fan: 1, temp: 0.35, vent: "PF", ac: false, recirc: false },
  pitot: { heat: true, oat: 8, heaterFail: false, alt: false },
  stall: { aoa: 6, fault: false },
  lights: { cabin: "AUTO", door: false, unlocked: false, bag: false },
  avx: { backup: false, pfdFail: false },
  capsOn: false,
};

/** Fast-changing values advanced every frame; kept out of React state on purpose. */
export const live = {
  rpm: 2500,
  flapAng: 0,
  capsT: -1,
  capsPlaying: false,
  startTimer: 0,
  crankT: 0,
  starve: 0,
};

export type BusId = "mdb1" | "mdb2" | "edb" | "ess1" | "ess2" | "main1" | "main2" | "main3" | "nonEss" | "ac1" | "ac2" | "avx" | "conv";

export interface Elec extends Record<BusId, number> {
  alt1: boolean; alt2: boolean; bat1ok: boolean; bat2ok: boolean; bat1Dead: boolean; bat2Dead: boolean;
  bat1Charging: boolean; bat2Charging: boolean; bat2Supplying: boolean;
  a1: number; a2: number; b1: number;
  pfd: boolean; mfd: boolean; stby: boolean;
  flapsPwr: boolean; pitotPwr: boolean; stallPwr: boolean; boostPwr: boolean; starterPwr: boolean;
  pitchTrim: boolean; rollTrim: boolean; navPwr: boolean; strobePwr: boolean; eisPwr: boolean; convPwr: boolean;
}

/**
 * Electrical solver (POH §7 Power Distribution).
 * Diode-ORed distribution buses in the MCU; CB-panel buses hang off them. Pulled breakers
 * remove individual loads. Battery endurance uses the Costanzo training deck's rule of thumb:
 * ALT 1 fail → BAT 1 carries MDB 1 ~30 min; dual ALT fail → BAT 1 ~15 min, then BAT 2 ~45 min.
 */
export function solveElec(s: Sim): Elec {
  const e = s.elec, run = s.eng.running, t = e.tBat;
  const cb = (name: string) => !s.cb[name];
  const alt1 = run && e.alt1 && !e.fail.alt1 && e.bat1 && cb("ALT 1"); // ALT 1 field needs BAT 1 on
  const alt2 = run && e.alt2 && !e.fail.alt2 && (e.bat1 || e.bat2) && cb("ALT 2"); // ALT 2 field from ESS BUS 2
  const bat1Life = alt2 ? 30 : 15;
  const bat1Dead = e.fail.bat1 || (run && !alt1 && e.bat1 && t >= bat1Life);
  const bat2Dead = run && !alt1 && !alt2 && t >= 60;
  const bat1ok = e.bat1 && !bat1Dead;
  const bat2ok = e.bat2 && !bat2Dead && cb("BAT 2");
  const D = 0.7; // diode drop
  const mdb1 = Math.max(alt1 ? 27.7 : 0, bat1ok ? 24.3 : 0);
  const mdb2 = Math.max(alt2 ? 28.7 : 0, mdb1 ? mdb1 - D : 0); // MDB1 → MDB2 only
  const edb = Math.max(mdb1, mdb2) ? Math.max(mdb1, mdb2) - D : 0;
  const ess = Math.max(edb, bat2ok ? 24.2 : 0);
  const r = (v: number) => Math.round(v * 10) / 10;
  const buses: Record<BusId, number> = {
    mdb1: r(mdb1), mdb2: r(mdb2), edb: r(edb), ess1: r(ess), ess2: r(ess),
    main1: r(mdb2), main2: r(mdb2), nonEss: r(mdb2), main3: r(mdb1), ac1: r(mdb1), ac2: r(mdb1),
    avx: e.avionics && mdb2 && cb("AVIONICS") ? r(mdb2) : 0,
    conv: bat1Dead ? 0 : 24.4,
  };
  const pw = (bus: BusId, name: string) => buses[bus] > 0 && cb(name);
  return {
    ...buses,
    alt1, alt2, bat1ok, bat2ok, bat1Dead, bat2Dead,
    bat1Charging: bat1ok && mdb1 > 26,
    bat2Charging: bat2ok && edb > 26,
    bat2Supplying: bat2ok && edb < 26,
    // illustrative currents (normal readout from the training deck: ALT1 +23, ALT2 +13, BAT1 +1)
    a1: alt1 ? (alt2 ? 23 : 36) : 0,
    a2: alt2 ? (alt1 ? 13 : 22) : 0,
    b1: !bat1ok ? 0 : alt1 ? 1 : alt2 ? -14 : -36,
    pfd: !s.avx.pfdFail && (pw("ess1", "PFD A") || pw("main2", "PFD B")),
    mfd: pw("main3", "MFD A") || pw("main1", "MFD B"),
    stby: pw("ess1", "STDBY ATTD A") || pw("main1", "STDBY ATTD B"),
    flapsPwr: pw("nonEss", "FLAPS"), pitotPwr: pw("nonEss", "PITOT HEAT"), stallPwr: pw("ess2", "STALL WARNING"),
    boostPwr: pw("main2", "FUEL PUMP"), starterPwr: pw("nonEss", "STARTER") && bat1ok,
    pitchTrim: pw("ess2", "PITCH TRIM"), rollTrim: pw("ess2", "ROLL TRIM"),
    navPwr: pw("nonEss", "NAV LIGHTS"), strobePwr: pw("nonEss", "STROBE LIGHTS"), eisPwr: pw("ess2", "ENGINE INSTR"),
    convPwr: buses.conv > 0 && cb("CONV LIGHTS"),
  };
}

export const fuelAvail = (s: Sim) => s.fuel.sel !== "OFF" && (s.fuel.sel === "L" ? s.fuel.qL : s.fuel.qR) > 0.05;
export const mapInHg = (s: Sim, rpm: number) => (rpm < 200 ? 29.9 : +(11.5 + s.eng.lever * 17.8 - (s.eng.altAir ? 0.6 : 0)).toFixed(1));
export const bladeAngle = (s: Sim) => 14 + s.eng.lever * 20;

export function cabinLit(s: Sim, E: Elec) {
  const L = s.lights, off = { dome: false, foot: false, step: false, bag: false };
  if (!E.convPwr || L.cabin === "OFF") return off;
  const trig = L.door || L.unlocked;
  if (L.cabin === "ON") return { dome: true, foot: true, step: trig, bag: L.bag };
  return { dome: trig, foot: trig, step: trig, bag: L.bag };
}

export type CasLevel = "w" | "c" | "a";
/** Crew Alerting System messages. G6 electrical names per the Costanzo training deck. */
export function casMessages(s: Sim, E: Elec): [CasLevel, string][] {
  const m: [CasLevel, string][] = [], f = s.fuel;
  if (s.stall.aoa >= 14 && !s.stall.fault && E.stallPwr) m.push(["w", "STALL"]);
  if (E.ess1 < 24.5) m.push(["w", "ESS BUS"]);
  if (f.qL + f.qR < 7) m.push(["w", "FUEL QTY < 7 GAL TOTAL"]);
  if (E.mdb1 < 24.5) m.push(["c", "M BUS 1"]);
  if (E.mdb2 < 24.5) m.push(["c", "M BUS 2"]);
  if (s.eng.running && !E.alt1) m.push(["c", "ALT 1"]);
  if (s.eng.running && !E.alt2) m.push(["c", "ALT 2"]);
  if (s.eng.running && s.elec.bat1 && !E.bat1Charging) m.push(["c", "BAT 1"]);
  if (f.qL < 8.2 && f.qR < 8.2) m.push(["c", "FUEL LOW BOTH TANKS"]);
  if (s.pitot.heat && (s.pitot.heaterFail || !E.pitotPwr)) m.push(["c", "PITOT HEAT FAIL"]);
  if (!s.pitot.heat && s.pitot.oat < 5) m.push(["c", "PITOT HEAT REQD"]);
  if (s.stall.fault) m.push(["c", "STALL WARN FAIL"]);
  if (s.gear.park) m.push(["c", "PARK BRAKE SET"]);
  if (f.qL < 8.2 !== f.qR < 8.2) m.push(["a", (f.qL < 8.2 ? "L" : "R") + " FUEL < 8.2 GAL"]);
  if (s.fuel.boost && E.boostPwr) m.push(["a", "FUEL PUMP ON"]);
  if (s.avx.backup || s.avx.pfdFail) m.push(["a", "DISPLAY BACKUP"]);
  return m;
}

/** Circuit-breaker buses as shown on the panel: [bus, label, source, loads]. */
export const BUSES: [BusId, string, string, [string, number?][]][] = [
  ["ess1", "ESS BUS 1", "Ess Dist Bus + BAT 2", [["PFD A", 5], ["ADAHRS 1", 5], ["COM 1", 7.5], ["GPS NAV GIA 1", 5], ["STDBY ATTD A", 5], ["BAT 2", 20]]],
  ["ess2", "ESS BUS 2", "Ess Dist Bus + BAT 2", [["PITCH TRIM", 2], ["ROLL TRIM", 2], ["STALL WARNING", 2], ["ENGINE INSTR", 3], ["ALT 2", 5]]],
  ["main1", "MAIN BUS 1", "Main Dist Bus 2", [["MFD B", 5], ["STDBY ATTD B", 5], ["KEYPADS / AP CTRL", 5], ["CABIN LIGHTS", 5], ["CABIN AIR CONTROL", 2], ["FUEL QTY", 5], ["AP SERVOS"], ["AVIONICS", 10]]],
  ["main2", "MAIN BUS 2", "Main Dist Bus 2", [["PFD B", 5], ["FUEL PUMP", 5], ["COM 2", 7.5], ["GPS NAV GIA 2", 5], ["ADAHRS 2", 5], ["AVIONICS FAN 2", 5]]],
  ["nonEss", "NON ESS BUS", "Main Dist Bus 2", [["FLAPS", 10], ["PITOT HEAT", 7.5], ["STARTER", 2], ["AVIONICS FAN 1", 5], ["NAV LIGHTS"], ["STROBE LIGHTS"]]],
  ["avx", "AVIONICS BUS", "MAIN BUS 1 via AVIONICS switch", [["AUDIO PANEL", 5], ["XPONDER", 2], ["DATA LINK/WX", 5], ["TRAFFIC", 5], ["DME/ADF", 3]]],
  ["main3", "MAIN BUS 3", "Main Dist Bus 1", [["MFD A", 5], ["12V & USB", 5], ["EVS CAMERA", 5]]],
  ["ac1", "A/C BUS 1", "Main Dist Bus 1", [["ALT 1", 5], ["A/C COND", 15]]],
  ["ac2", "A/C BUS 2", "Main Dist Bus 1", [["CABIN FAN", 15], ["A/C COMPR", 5]]],
  ["conv", "CONV BUS", "BAT 1 direct, 5 A fuse", [["CONV LIGHTS", 5]]],
];
