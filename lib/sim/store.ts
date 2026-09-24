"use client";
import { create } from "zustand";
import type { Vec3 } from "../math";
import { CAPS_CAM, SYS_IDS, sysDef, type SysId, type Theme } from "../systems";
import { initialSim, live, solveElec, type Elec, type Sim } from "./model";

export interface HoverInfo { name: string; note: string; color: string; x: number; y: number }
export interface CamRequest { p: Vec3; t: Vec3; id: number }

interface Store {
  s: Sim;
  E: Elec;
  theme: Theme;
  cam: CamRequest | null;
  hover: HoverInfo | null;
  /** Mutate a draft of the sim state; the electrical solution is recomputed. */
  update: (fn: (d: Sim) => void) => void;
  select: (id: SysId, fly?: boolean) => void;
  flyTo: (p: Vec3, t: Vec3) => void;
  setTheme: (t: Theme) => void;
  setHover: (h: HoverInfo | null) => void;
  startCaps: () => void;
  resetCaps: () => void;
}

let camId = 0;
let focusTimer: ReturnType<typeof setTimeout> | undefined;

export const useSim = create<Store>((set, get) => ({
  s: initialSim,
  E: solveElec(initialSim),
  theme: "light",
  cam: null,
  hover: null,

  update: (fn) => {
    const d = structuredClone(get().s);
    fn(d);
    set({ s: d, E: solveElec(d) });
  },

  select: (id, fly = true) => {
    const { update, resetCaps } = get();
    if (id !== "caps" && get().s.capsOn) resetCaps();
    update((d) => { d.sys = id; d.focus = null; });
    if (fly) { const [p, t] = sysDef(id).cam; get().flyTo(p, t); }
    try { localStorage.setItem("sr20sys", id); } catch {}
  },

  flyTo: (p, t) => set({ cam: { p, t, id: ++camId } }),

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("sr20theme", theme); } catch {}
  },

  setHover: (hover) => set({ hover }),

  startCaps: () => {
    live.capsT = 0; live.capsPlaying = true;
    get().update((d) => { d.capsOn = true; });
    get().flyTo(...CAPS_CAM);
  },

  resetCaps: () => {
    live.capsT = -1; live.capsPlaying = false;
    get().update((d) => { d.capsOn = false; });
  },
}));

/** Highlight a part by name for a moment (used by "tap to locate" lists). */
export function flashFocus(name: string) {
  useSim.getState().update((d) => { d.focus = name; });
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => useSim.getState().update((d) => { d.focus = null; }), 2600);
}

export const isSysId = (v: unknown): v is SysId => typeof v === "string" && (SYS_IDS as string[]).includes(v);
