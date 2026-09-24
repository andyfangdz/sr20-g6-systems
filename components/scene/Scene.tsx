"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GROUND_Y } from "@/lib/geometry";
import { V, clamp, ease } from "@/lib/math";
import { simTick } from "@/lib/sim/tick";
import { useSim } from "@/lib/sim/store";
import { palette, sysDef } from "@/lib/systems";
import { view } from "@/lib/registry";
import { Airplane } from "./Airplane";
import { Parachute } from "./Parachute";

/** Animates the camera to the latest requested view; any user drag cancels the flight. */
function CameraRig() {
  const cam = useSim((x) => x.cam);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ fp: THREE.Vector3; ft: THREE.Vector3; tp: THREE.Vector3; tt: THREE.Vector3; t0: number } | null>(null);

  useEffect(() => {
    if (!cam || !controls) return;
    const tp = V(...cam.p), tt = V(...cam.t);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.position.copy(tp); controls.target.copy(tt); return; }
    flight.current = { fp: camera.position.clone(), ft: controls.target.clone(), tp, tt, t0: performance.now() };
  }, [cam, controls, camera]);

  useEffect(() => { view.camera = camera; view.target = controls?.target ?? null; }, [camera, controls]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => { flight.current = null; };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useFrame(() => {
    const f = flight.current;
    if (!f || !controls) return;
    const u = clamp((performance.now() - f.t0) / 1000, 0, 1), e = ease(u);
    camera.position.lerpVectors(f.fp, f.tp, e);
    controls.target.lerpVectors(f.ft, f.tt, e);
    if (u >= 1) flight.current = null;
  });
  return null;
}

function SimClock() {
  useFrame((_, dt) => simTick(Math.min(dt, 0.05)));
  return null;
}

export default function Scene() {
  const theme = useSim((x) => x.theme);
  const spin = useSim((x) => x.s.spin);
  const pal = palette(theme);
  const rootRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const gridRef = useRef<THREE.GridHelper>(null);
  const [startPos, startTarget] = sysDef(useSim.getState().s.sys).cam;

  useEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    (g.material as THREE.LineBasicMaterial).color.set(pal.grid);
  }, [pal.grid]);

  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 400, position: startPos }}
      onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
      onPointerMissed={() => useSim.getState().setHover(null)}
      aria-label="3D model of the SR20 and its systems"
    >
      <color attach="background" args={[pal.scene]} />
      {/* pre-r155 light intensities × π for physically-based lighting */}
      <hemisphereLight args={["#ffffff", "#445566", 0.85 * Math.PI]} />
      <directionalLight position={[6, 10, 5]} intensity={0.9 * Math.PI} />
      <directionalLight position={[-6, 3, -6]} intensity={0.35 * Math.PI} />
      <gridHelper ref={gridRef} args={[40, 40, "#ffffff", "#ffffff"]} position-y={GROUND_Y}
        onUpdate={(g) => { const m = g.material as THREE.LineBasicMaterial; m.transparent = true; m.opacity = 0.5; m.color.set(pal.grid); }} />
      <Airplane rootRef={rootRef} modelRef={modelRef} />
      <Parachute rootRef={rootRef} modelRef={modelRef} gridRef={gridRef} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.4} maxDistance={70} autoRotate={spin} autoRotateSpeed={0.6} target={startTarget} />
      <CameraRig />
      <SimClock />
    </Canvas>
  );
}
