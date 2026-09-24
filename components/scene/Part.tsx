"use client";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { wingP } from "@/lib/geometry";
import { mats, plateMat, shellMat, skinMat, solidMat } from "@/lib/materials";
import { clamp } from "@/lib/math";
import { STALL_Z, pinnedParts, type PartSpec, type ShellSpec } from "@/lib/parts";
import { partObjects } from "@/lib/registry";
import { live } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { palette, sysColor, type SysId } from "@/lib/systems";

/** What the hover tooltip needs to know about a mesh. */
export interface PickInfo { name: string; note: string; color: string; sys: SysId[]; shell?: boolean }

const pinCache = new Map<SysId, Set<string>>();
const pinSet = (sys: SysId) => {
  let s = pinCache.get(sys);
  if (!s) { s = new Set(pinnedParts(sys).map((p) => p.id)); pinCache.set(sys, s); }
  return s;
};

export function Pin({ at, label, color }: { at: THREE.Vector3; label: string; color: string }) {
  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="pin" style={{ "--c": color } as React.CSSProperties}>{label}</div>
    </Html>
  );
}

const centerOf = (g: THREE.BufferGeometry) => { if (!g.boundingSphere) g.computeBoundingSphere(); return g.boundingSphere!.center.clone(); };
const sparkPhase = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h % 100) / 10; };

export function Part({ spec }: { spec: PartSpec }) {
  const geo = useMemo(() => spec.geo(), [spec]);
  const ref = useRef<THREE.Mesh>(null!);
  const sys = useSim((x) => x.s.sys);
  const xray = useSim((x) => x.s.xray);
  const focus = useSim((x) => x.s.focus);
  const labels = useSim((x) => x.s.labels);
  const theme = useSim((x) => x.theme);

  const color = spec.color ?? sysColor(spec.sys[0], theme);
  const all = sys === "overview";
  const act = all || spec.sys.includes(sys);
  const material = spec.plate ? (act ? plateMat.on : plateMat.dim)
    : focus && focus === spec.name ? mats(color).hi
    : act || !xray ? mats(color).on : mats(color).dim;
  const pick: PickInfo | undefined = spec.name ? { name: spec.name, note: spec.note ?? "", color, sys: spec.sys } : undefined;
  const showPin = labels && !all && pinSet(sys).has(spec.id);
  const phase = useMemo(() => sparkPhase(spec.id), [spec.id]);

  useEffect(() => {
    const name = spec.name, m = ref.current;
    if (!name || partObjects.has(name)) return;
    partObjects.set(name, m);
    return () => { if (partObjects.get(name) === m) partObjects.delete(name); };
  }, [spec.name]);

  useFrame(({ clock }) => {
    if (!spec.anim) return;
    const m = ref.current;
    const { s, E } = useSim.getState();
    const engSys = s.sys === "engine" || s.sys === "overview";
    const firing = live.rpm > 100 && s.eng.key !== "OFF";
    switch (spec.anim) {
      case "plug": {
        const on = s.eng.key === "BOTH" || s.eng.key === "START" || s.eng.key === spec.mag;
        const flash = firing && on && Math.sin(clock.elapsedTime * 18 + phase) > 0.3;
        m.material = engSys && flash ? mats("#6FD8FF").hi : engSys || s.sys === "propeller" ? mats("#DADFE2").on : mats("#DADFE2").dim;
        break;
      }
      case "magR": case "magL": {
        const on = firing && (s.eng.key === "BOTH" || s.eng.key === "START" || s.eng.key === (spec.anim === "magR" ? "R" : "L"));
        m.material = engSys ? (on ? mats("#6FD8FF").on : mats("#3E4A52").on) : mats("#3E4A52").dim;
        break;
      }
      case "alt1": case "alt2": {
        const up = spec.anim === "alt1" ? E.alt1 : E.alt2;
        const show = s.sys === "overview" || s.sys === "electrical" || s.sys === "engine";
        m.material = !show ? mats("#D9960F").dim : up ? mats("#D9960F").hi : mats("#5A5040").on;
        break;
      }
      case "brakeR": case "brakeL": {
        const amt = s.gear.park ? 0.6 : spec.anim === "brakeR" ? Math.max(0, s.gear.diff) : Math.max(0, -s.gear.diff);
        m.material = amt > 0.05 ? mats("#FF6A2A").hi : mats("#9AA3AA").on;
        break;
      }
      case "selPtr":
        m.rotation.y = s.fuel.sel === "L" ? Math.PI / 2 : s.fuel.sel === "R" ? -Math.PI / 2 : Math.PI;
        break;
      case "altDoor":
        m.position.x = spec.pos![0] - (s.eng.altAir ? 0.05 : 0);
        break;
      case "suction": {
        const aoa = s.stall.aoa, xc = clamp(0.32 - (aoa / 14) * 0.32, 0, 0.32);
        m.position.copy(wingP(STALL_Z, xc, aoa >= 14 ? 0 : 1));
        m.visible = s.sys === "pitot";
        break;
      }
    }
  });

  return (
    <mesh ref={ref} geometry={geo} material={material} position={spec.pos} rotation={spec.rot} scale={spec.scale} userData={{ pick }}>
      {showPin && spec.name && <Pin at={centerOf(geo)} label={spec.name} color={sysColor(sys, theme)} />}
    </mesh>
  );
}

/** Airframe skin: x-ray ghost, painted skin or plain white. */
export function Shell({ spec }: { spec: ShellSpec }) {
  const geo = useMemo(() => spec.geo(), [spec]);
  const xray = useSim((x) => x.s.xray);
  const theme = useSim((x) => x.theme);
  const material = xray ? shellMat : spec.skin ? skinMat() : solidMat;
  const pick: PickInfo | undefined = spec.name ? { name: spec.name, note: spec.note, color: palette(theme).frame, sys: ["airframe"], shell: true } : undefined;
  return <mesh geometry={geo} material={material} renderOrder={xray ? 2 : 0} userData={{ pick }} />;
}

