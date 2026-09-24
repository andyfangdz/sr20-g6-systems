"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { drawMFD, drawOff, drawPFD, drawStandby } from "@/lib/displays";
import { loft, wingSec, windowOutlines } from "@/lib/geometry";
import { dotTex, mats, outlineMat, shellMat, shellUniforms, solidMat } from "@/lib/materials";
import { D2R, V } from "@/lib/math";
import {
  CYLS, LIGHTS, NOSE_CASTER, NOSE_GEAR, PROP, SHELLS, SURFACES, YOKES, YOKE_X, YOKE_Y, partsFor, type SurfaceSpec,
} from "@/lib/parts";
import { bladeAngle, cabinLit, live } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { palette, sysColor } from "@/lib/systems";
import { Flows } from "./Flows";
import { Part, Pin, Shell, type PickInfo } from "./Part";

const Parts = ({ parent }: { parent?: string }) => <>{partsFor(parent).map((p) => <Part key={p.id} spec={p} />)}</>;

/* ---------- control surfaces rotate about their hinge lines ---------- */
function ControlSurface({ spec }: { spec: SurfaceSpec }) {
  const geo = useMemo(() => spec.geo(), [spec]);
  const ref = useRef<THREE.Group>(null!);
  const axis = useMemo(() => V(...spec.axis), [spec]);
  const sys = useSim((x) => x.s.sys);
  const xray = useSim((x) => x.s.xray);
  const theme = useSim((x) => x.theme);
  const active = sys !== "overview" && spec.sys.includes(sys);
  const color = sysColor(spec.sys[0], theme);
  useFrame(() => {
    const c = useSim.getState().s.ctrl, fl = live.flapAng * D2R;
    const ail = c.roll * 18 * D2R, el = c.pitch * 22 * D2R, rud = c.yaw * 22 * D2R;
    const a = ({ flapR: fl, flapL: -fl, ailR: -ail, ailL: -ail, elevR: -el, elevL: el, rudder: rud } as Record<string, number>)[spec.key] ?? 0;
    ref.current.quaternion.setFromAxisAngle(axis, a);
  });
  const pick: PickInfo = { name: spec.name, note: spec.note, color, sys: spec.sys };
  return (
    <group ref={ref} position={spec.pivot}>
      <mesh geometry={geo} material={active ? mats(color).hi : xray ? shellMat : solidMat} renderOrder={xray && !active ? 2 : 0} userData={{ pick }} />
      <Parts parent={"surf:" + spec.key} />
    </group>
  );
}

function NoseGear() {
  const caster = useRef<THREE.Group>(null!);
  useFrame(() => { caster.current.rotation.y = -useSim.getState().s.gear.diff * 85 * D2R; });
  return (
    <group position={NOSE_GEAR}>
      <Parts parent="noseGear" />
      <group ref={caster} position={NOSE_CASTER}><Parts parent="caster" /></group>
    </group>
  );
}

function Propeller() {
  const prop = useRef<THREE.Group>(null!);
  const blades = useRef<THREE.Group[]>([]);
  const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame((_, dt) => {
    prop.current.rotation.x -= (live.rpm / 60) * Math.PI * 2 * dt * (reduce ? 0.02 : 0.12);
    const ba = bladeAngle(useSim.getState().s) * D2R * 0.6;
    blades.current.forEach((b) => b && (b.rotation.y = ba));
  });
  return (
    <group ref={prop} position={PROP}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-x={(i * Math.PI * 2) / 3}>
          <group ref={(g) => { if (g) blades.current[i] = g; }}><Parts parent={"blade:" + i} /></group>
        </group>
      ))}
    </group>
  );
}

const Cylinders = () => <>{CYLS.map((c) => <group key={c.n} position={[c.x, -0.14, c.s * 0.25]}><Parts parent={"cyl:" + c.n} /></group>)}</>;

function Yokes() {
  const g = useRef<THREE.Group[]>([]), grip = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const c = useSim.getState().s.ctrl;
    g.current.forEach((y) => y && (y.position.x = YOKE_X - c.pitch * 0.07));
    grip.current.forEach((y) => y && (y.rotation.x = c.roll * 0.6));
  });
  return <>{YOKES.map((y, i) => (
    <group key={y.side} ref={(o) => { if (o) g.current[i] = o; }} position={[YOKE_X, YOKE_Y, y.z]}>
      <Parts parent={"yoke:" + y.side} />
      <group ref={(o) => { if (o) grip.current[i] = o; }}><Parts parent={"grip:" + y.side} /></group>
    </group>
  ))}</>;
}

/* ---------- wet-wing tanks: fuel level is a clipping plane ---------- */
function Tanks() {
  const fuel = useSim((x) => x.s.fuel);
  const sys = useSim((x) => x.s.sys);
  const labels = useSim((x) => x.s.labels);
  const theme = useSim((x) => x.theme);
  const tanks = useMemo(() => ([["L", -1], ["R", 1]] as const).map(([k, s]) => {
    const secs = [0.95, 1.6, 2.4, 3.2, 4.0, 4.5].map((z) => wingSec(s * z, 0.1, 0.6, 0.85));
    const geo = loft(s < 0 ? secs.map((r) => r.reverse()) : secs);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const plane = new THREE.Plane(V(0, -1, 0), 0);
    return {
      k, s, geo, plane, ymin: geo.boundingBox!.min.y, ymax: geo.boundingBox!.max.y,
      shell: new THREE.MeshStandardMaterial({ color: "#2F7FE6", transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
      fuel: new THREE.MeshStandardMaterial({ color: "#2F7FE6", transparent: true, opacity: 0.62, clippingPlanes: [plane], side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color("#0B3A80") }),
    };
  }), []);
  const act = sys === "overview" || sys === "fuel";
  return <>{tanks.map((t) => {
    const q = (t.k === "L" ? fuel.qL : fuel.qR) / 28;
    t.plane.constant = t.ymin + (t.ymax - t.ymin) * Math.pow(q, 0.8) + (q > 0 ? 0.004 : -0.1);
    t.shell.opacity = act ? 0.14 : 0.05;
    t.fuel.opacity = act ? 0.62 : 0.12;
    const name = (t.s > 0 ? "Right" : "Left") + " wing tank";
    return (
      <group key={t.k}>
        <mesh geometry={t.geo} material={t.shell} userData={{ pick: { name, note: "Integral wet-wing tank: 29.3 gal capacity, 28 gal usable. Float-type quantity sensor.", color: "#2F7FE6", sys: ["fuel"] } }}>
          {labels && sys === "fuel" && <Pin at={t.geo.boundingSphere!.center} label={name} color={sysColor("fuel", theme)} />}
        </mesh>
        {q > 0 && <mesh geometry={t.geo} material={t.fuel} raycast={() => null} />}
      </group>
    );
  })}</>;
}

/* ---------- live cockpit displays ---------- */
function Displays() {
  const sys = useSim((x) => x.s.sys);
  const labels = useSim((x) => x.s.labels);
  const theme = useSim((x) => x.theme);
  const screens = useMemo(() => {
    const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace; return { c, ctx: c.getContext("2d")!, tx }; };
    return { pfd: mk(640, 400), mfd: mk(640, 400), sby: mk(200, 200) };
  }, []);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const { s, E } = useSim.getState();
    const { pfd, mfd, sby } = screens;
    if (E.pfd) drawPFD(pfd.ctx, 640, 400, s, E); else drawOff(pfd.ctx, 640, 400);
    if (E.mfd) drawMFD(mfd.ctx, 640, 400, s, E); else drawOff(mfd.ctx, 640, 400);
    if (E.stby) drawStandby(sby.ctx, 200, 200, s); else drawOff(sby.ctx, 200, 200);
    pfd.tx.needsUpdate = mfd.tx.needsUpdate = sby.tx.needsUpdate = true;
  });
  const list = [
    { tx: screens.pfd.tx, w: 0.36, h: 0.225, pos: [2.275, 0.1, -0.24], sys: ["avionics"], name: "PFD — GDU 1050A", note: "Attitude, airspeed, altitude, HSI, CAS. PFD A (ESS BUS 1) and PFD B (MAIN BUS 2) — either one powers it." },
    { tx: screens.mfd.tx, w: 0.36, h: 0.225, pos: [2.275, 0.1, 0.2], sys: ["avionics"], name: "MFD — GDU 1050A", note: "Map, ENGINE page and Engine Strip. MFD A (MAIN BUS 3) or MFD B (MAIN BUS 1)." },
    { tx: screens.sby.tx, w: 0.075, h: 0.075, pos: [2.115, -0.27, -0.3], sys: ["avionics", "pitot"], name: "Standby — MD302", note: "Attitude, airspeed, altitude. STDBY ATTD A (ESS BUS 1) + STDBY ATTD B (MAIN BUS 1) through diodes." },
  ] as const;
  return <>{list.map((d) => (
    <mesh key={d.name} position={d.pos as unknown as THREE.Vector3Tuple} rotation-y={-Math.PI / 2}
      userData={{ pick: { name: d.name, note: d.note, color: sysColor("avionics", theme), sys: d.sys } }}>
      <planeGeometry args={[d.w, d.h]} />
      <meshBasicMaterial map={d.tx} toneMapped={false} />
      {labels && (d.sys as readonly string[]).includes(sys) && <Pin at={V(0, 0, 0)} label={d.name} color={sysColor(sys, theme)} />}
    </mesh>
  ))}</>;
}

/* ---------- exterior + cabin light glows ---------- */
function LightFX() {
  const refs = useRef<Record<string, THREE.Sprite | null>>({});
  const glow = (key: string, pos: THREE.Vector3Tuple, color: string, size: number) => (
    <sprite key={key} ref={(s) => { refs.current[key] = s; }} position={pos} scale={[size, size, size]} raycast={() => null}>
      <spriteMaterial map={dotTex()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
  useFrame(({ clock }) => {
    const { s, E } = useSim.getState(), R = refs.current;
    const ext = s.sys === "overview" || s.sys === "lighting", strobe = clock.elapsedTime % 1.2 < 0.06;
    ["navL", "navR", "navT"].forEach((k) => R[k] && (R[k]!.visible = ext && E.navPwr));
    ["strL", "strR"].forEach((k) => R[k] && (R[k]!.visible = ext && E.strobePwr && strobe));
    const cl = cabinLit(s, E), cab = s.sys === "lighting";
    if (R.dome) R.dome.visible = cab && cl.dome;
    if (R.bag) R.bag.visible = cab && cl.bag;
    LIGHTS.foot.forEach((_, i) => R["foot" + i] && (R["foot" + i]!.visible = cab && cl.foot));
    LIGHTS.step.forEach((_, i) => R["step" + i] && (R["step" + i]!.visible = cab && cl.step));
  });
  return (
    <>
      {glow("navL", LIGHTS.tipL, "#FF2A2A", 0.3)}{glow("navR", LIGHTS.tipR, "#22FF66", 0.3)}{glow("navT", LIGHTS.tail, "#FFFFFF", 0.25)}
      {glow("strL", LIGHTS.tipL, "#FFFFFF", 0.8)}{glow("strR", LIGHTS.tipR, "#FFFFFF", 0.8)}
      {glow("dome", LIGHTS.dome, "#FFE7B0", 0.6)}{glow("bag", LIGHTS.bag, "#FFE7B0", 0.5)}
      {LIGHTS.foot.map((p, i) => glow("foot" + i, p, "#FFE7B0", 0.35))}
      {LIGHTS.step.map((p, i) => glow("step" + i, p, "#FFE7B0", 0.4))}
    </>
  );
}

function WindowOutlines() {
  const lines = useMemo(() => windowOutlines().map((pts) => {
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), outlineMat);
    l.raycast = () => {};
    return l;
  }), []);
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}

/** Keeps shared shader/line materials in step with theme and x-ray mode. */
function MaterialSync() {
  const theme = useSim((x) => x.theme);
  const xray = useSim((x) => x.s.xray);
  useEffect(() => {
    shellUniforms.uColor.value.set(palette(theme).shell);
    shellUniforms.uOpacity.value = theme === "dark" ? 0.55 : 0.6;
    outlineMat.color.set(xray ? palette(theme).shell : "#10171C");
    outlineMat.opacity = xray ? 0.75 : 0.9;
  }, [theme, xray]);
  return null;
}

/* ---------- hover: prefer a real part over the ghost shell in front of it ---------- */
function usePicker() {
  const setHover = useSim((x) => x.setHover);
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.buttons) { setHover(null); return; }
    const sys = useSim.getState().s.sys;
    const cands = e.intersections.filter((h) => {
      const p = h.object.userData?.pick as PickInfo | undefined;
      return p && h.object.visible && (sys === "overview" || p.shell || p.sys.includes(sys));
    });
    const hit = cands.find((h) => !(h.object.userData.pick as PickInfo).shell) ?? cands[0];
    if (!hit) { setHover(null); return; }
    const p = hit.object.userData.pick as PickInfo;
    setHover({ name: p.name, note: p.note, color: p.color, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };
}

export function Airplane({ rootRef, modelRef }: { rootRef: RefObject<THREE.Group | null>; modelRef: RefObject<THREE.Group | null> }) {
  const onMove = usePicker();
  const setHover = useSim((x) => x.setHover);
  return (
    <group ref={rootRef} position={[1, 0, 0]}>
      <group ref={modelRef} position={[-1, 0, 0]} onPointerMove={onMove} onPointerOut={() => setHover(null)}>
        <MaterialSync />
        {SHELLS.map((s) => <Shell key={s.id} spec={s} />)}
        {SURFACES.map((s) => <ControlSurface key={s.key} spec={s} />)}
        <Parts />
        <NoseGear />
        <Propeller />
        <Cylinders />
        <Yokes />
        <Tanks />
        <Flows />
        <Displays />
        <LightFX />
        <WindowOutlines />
      </group>
    </group>
  );
}
