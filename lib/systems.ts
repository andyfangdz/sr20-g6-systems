import type { Vec3 } from "./math";

export type SysId =
  | "overview" | "airframe" | "controls" | "flaps" | "gear" | "engine" | "propeller" | "fuel"
  | "electrical" | "lighting" | "environment" | "pitot" | "avionics" | "cabin" | "caps";

export type ColorKey = "accent" | "frame" | "ctrl" | "gear" | "oil" | "fuel" | "elec" | "air" | "pitot" | "avx" | "cabin" | "caps";

export interface SysDef { id: SysId; name: string; pg: string; key: ColorKey; cam: [Vec3, Vec3]; blurb: string }

export const SYS: SysDef[] = [
  { id: "overview", name: "Overview", pg: "7-5", key: "accent", cam: [[7.5, 4.2, 9.5], [0.5, -0.2, 0]], blurb: "" },
  { id: "airframe", name: "Airframe", pg: "7-5", key: "frame", cam: [[5.5, 5.5, 8], [0.6, -0.3, 0]], blurb: "Composite shell, carry-through spar" },
  { id: "controls", name: "Flight controls", pg: "7-6", key: "ctrl", cam: [[-7, 4.8, 7.5], [-0.6, -0.1, 0]], blurb: "Cables, push rods, spring trim" },
  { id: "flaps", name: "Wing flaps", pg: "7-22", key: "ctrl", cam: [[-3.8, 3.4, 6.8], [0.4, -0.5, 1.4]], blurb: "Three-position electric flaps" },
  { id: "gear", name: "Gear & brakes", pg: "7-25", key: "gear", cam: [[5.6, -0.3, 5.4], [1.8, -0.95, 0]], blurb: "Fixed tricycle, differential braking" },
  { id: "engine", name: "Engine", pg: "7-31", key: "oil", cam: [[5.6, 1.2, 2.9], [3.1, -0.2, 0]], blurb: "Controls, ignition, induction, oil" },
  { id: "propeller", name: "Propeller", pg: "7-38", key: "oil", cam: [[6.6, 1.0, -3.2], [3.5, -0.14, 0]], blurb: "Single-lever governor logic" },
  { id: "fuel", name: "Fuel", pg: "7-39", key: "fuel", cam: [[2.6, 7, 8], [1.0, -0.5, 0]], blurb: "Wet wings, selector, boost pump" },
  { id: "electrical", name: "Electrical", pg: "7-46", key: "elec", cam: [[4.6, 3.0, 4.9], [1.6, -0.1, 0]], blurb: "2 alts, 2 batteries, 10 buses" },
  { id: "lighting", name: "Lighting", pg: "7-56", key: "elec", cam: [[-4.5, 3.4, 8.5], [0.6, 0, 0]], blurb: "Wingtip, landing, ice and cabin lights" },
  { id: "environment", name: "Environmental", pg: "7-59", key: "air", cam: [[4.4, 1.8, 3.8], [2.0, -0.2, 0]], blurb: "Heat, fresh air, optional A/C" },
  { id: "pitot", name: "Pitot-static & stall", pg: "7-66", key: "pitot", cam: [[3.8, 2.8, -8], [0.4, -0.3, -0.6]], blurb: "Heated pitot, static, stall horn" },
  { id: "avionics", name: "Avionics", pg: "7-70", key: "avx", cam: [[0.55, 0.35, 0.42], [2.28, 0.06, -0.02]], blurb: "Displays, ADAHRS, GIAs, CAS" },
  { id: "cabin", name: "Cabin & safety", pg: "7-26", key: "cabin", cam: [[3.2, 4.6, 5.2], [0.5, 0, 0]], blurb: "Seats, restraints, ELT, egress" },
  { id: "caps", name: "CAPS", pg: "7-93", key: "caps", cam: [[-5.2, 4.0, 7.2], [-0.4, 0.2, 0]], blurb: "Parachute system and deployment" },
];
export const SYS_IDS = SYS.map((s) => s.id);
export const sysDef = (id: SysId) => SYS.find((s) => s.id === id)!;
export const CAPS_CAM: [Vec3, Vec3] = [[20, 9, 26], [0, 6, 0]];

/** Which palette colour a part takes from its first system. */
const SYS_COLOR: Record<SysId, ColorKey> = {
  overview: "accent", airframe: "frame", controls: "ctrl", flaps: "ctrl", gear: "gear", engine: "oil", propeller: "oil",
  fuel: "fuel", electrical: "elec", lighting: "elec", environment: "air", pitot: "pitot", avionics: "avx", cabin: "cabin", caps: "caps",
};

export type Theme = "light" | "dark";
type Palette = Record<ColorKey, string> & { scene: string; grid: string; shell: string };

const LIGHT: Palette = {
  accent: "#1B5E88", frame: "#3D5A73", ctrl: "#7C57CF", gear: "#5C6E7E", oil: "#B85A2A", fuel: "#2F7FE6",
  elec: "#D9960F", air: "#149C94", pitot: "#3A9448", avx: "#C8399F", cabin: "#6F7F8C", caps: "#D32640",
  scene: "#DCE3E7", grid: "#B9C4CB", shell: "#2A3B48",
};
const DARK: Palette = { ...LIGHT, accent: "#63B4E6", frame: "#8FB0CC", gear: "#8C9DAC", cabin: "#9AA8B3", scene: "#0C141B", grid: "#1D2A34", shell: "#9FB6C8" };

export const palette = (t: Theme) => (t === "dark" ? DARK : LIGHT);
export const sysColor = (id: SysId, t: Theme) => palette(t)[SYS_COLOR[id]];
