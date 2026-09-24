"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { dotTex } from "@/lib/materials";
import { D2R, V, clamp, ease, lerp } from "@/lib/math";
import { CAPS_BOX, HARNESS } from "@/lib/parts";
import { live } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";

/** CAPS phases shown in the HUD: [start time s, title, detail]. */
export const CAPS_PHASES: [number, string, string][] = [
  [0, "Handle pulled", "Igniter fires the rocket"],
  [0.3, "Rocket extraction", "Deployment bag pulled up and aft; harness strips out of the skin"],
  [1.6, "Lines taut", "Risers and suspension lines stretched; bag releases canopy"],
  [2, "Inflation", "Orange slider rides down the lines to meter opening; < 3 g"],
  [3.6, "Nose-low hang", "Rear riser snubbed short"],
  [8, "Snub line cut", "Tail drops to ~level"],
  [9.8, "Descent", "< 1,700 fpm, drifting with wind"],
];
export const capsPhase = (t: number) => [...CAPS_PHASES].reverse().find((p) => t >= p[0])!;

/** Airplane pitch (deg, + nose up) during deployment. */
function pitchAt(t: number) {
  if (t < 2) return 0;
  if (t < 3) return lerp(0, 8, t - 2);
  if (t < 4.5) return lerp(8, -28, (t - 3) / 1.5);
  if (t < 8) return -28 + Math.sin((t - 4.5) * 1.6) * 2;
  if (t < 9.8) return lerp(-28, -3, ease((t - 8) / 1.8));
  return -3 + Math.sin((t - 9.8) * 1.1) * 2;
}

export function Parachute({ rootRef, modelRef, gridRef }: {
  rootRef: RefObject<THREE.Group | null>; modelRef: RefObject<THREE.Group | null>; gridRef: RefObject<THREE.GridHelper | null>;
}) {
  const canopy = useRef<THREE.Mesh>(null!);
  const pack = useRef<THREE.Mesh>(null!);
  const flame = useRef<THREE.Sprite>(null!);
  const slider = useRef<THREE.Mesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(3 * 2 * (16 + 3)), 3));
    return g;
  }, []);
  const goreGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.SphereGeometry(5.52, 16, 4, 0, Math.PI * 2, 0, Math.PI * 0.42)), []);
  const wasOn = useRef(false);

  useFrame(() => {
    const on = useSim.getState().s.capsOn && live.capsT >= 0;
    const root = rootRef.current, model = modelRef.current;
    if (!root || !model) return;
    if (!on) {
      if (wasOn.current) { root.rotation.set(0, 0, 0); if (gridRef.current) gridRef.current.visible = true; }
      wasOn.current = false;
      group.current.visible = false;
      return;
    }
    wasOn.current = true;
    group.current.visible = true;
    const t = live.capsT;
    root.rotation.z = pitchAt(t) * D2R;
    root.rotation.x = t > 9.8 ? Math.sin((t - 9.8) * 0.8) * 0.04 : 0;
    if (gridRef.current) gridRef.current.visible = t < 1.5;
    model.updateMatrixWorld(true);
    const can = model.localToWorld(V(...CAPS_BOX));
    const top = V(-0.3, 11.5, 0), mid = V(-2.4, 9.5, 0);
    const packPos = t < 1.6 ? can.clone().lerp(mid, ease(clamp((t - 0.3) / 1.3, 0, 1))) : mid.clone().lerp(top, clamp((t - 1.6) / 1.2, 0, 1));
    pack.current.position.copy(packPos);
    pack.current.visible = t < 2.4;
    flame.current.visible = t >= 0.3 && t < 1.5;
    flame.current.position.copy(packPos).add(V(0.3, -0.6, 0));
    const inf = t < 2 ? 0 : clamp(ease((t - 2) / 1.8), 0, 1);
    canopy.current.visible = inf > 0.01;
    canopy.current.position.copy(packPos).add(V(0, -inf, 0));
    canopy.current.scale.set(0.15 + 0.85 * inf, 0.25 + 0.75 * inf, 0.15 + 0.85 * inf);
    // suspension lines to the confluence, risers to the three harness points
    const hp = (["fwdL", "fwdR", "aft"] as const).map((k) => model.localToWorld(V(...HARNESS[k])));
    const pos = lineGeo.attributes.position as THREE.BufferAttribute;
    let i = 0;
    const rimR = 5.5 * Math.sin(Math.PI * 0.42) * (0.15 + 0.85 * inf), rimY = canopy.current.position.y + 5.5 * Math.cos(Math.PI * 0.42) * (0.25 + 0.75 * inf);
    const conf = V(canopy.current.position.x, lerp(packPos.y - 1, (hp[0].y + hp[2].y) / 2 + 3.2, inf), 0);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const rp = inf > 0.01 ? V(canopy.current.position.x + Math.cos(a) * rimR, rimY, Math.sin(a) * rimR) : packPos;
      pos.setXYZ(i++, rp.x, rp.y, rp.z); pos.setXYZ(i++, conf.x, conf.y, conf.z);
    }
    const anchor = t < 1.6 ? packPos : conf;
    hp.forEach((p) => { pos.setXYZ(i++, p.x, p.y, p.z); pos.setXYZ(i++, anchor.x, anchor.y, anchor.z); });
    if (t < 0.3) for (let k = 0; k < i; k++) pos.setXYZ(k, can.x, can.y, can.z);
    pos.needsUpdate = true;
    lineGeo.computeBoundingSphere();
    // slider rides down the suspension lines from the skirt toward the confluence
    slider.current.visible = t >= 2 && inf > 0.01;
    if (slider.current.visible) {
      const u = clamp((t - 2) / 2.2, 0, 1) * 0.75, rr = Math.max(0.15, rimR * (1 - u));
      slider.current.position.set(canopy.current.position.x, lerp(rimY, conf.y, u), 0);
      slider.current.scale.set(rr, rr, rr);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={canopy} raycast={() => {}}>
        <sphereGeometry args={[5.5, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        <meshStandardMaterial color="#F2F2EE" side={THREE.DoubleSide} roughness={0.8} transparent opacity={0.95} />
        <lineSegments geometry={goreGeo}><lineBasicMaterial color="#D32640" /></lineSegments>
      </mesh>
      <mesh ref={pack}><cylinderGeometry args={[0.22, 0.22, 0.5, 12]} /><meshStandardMaterial color="#D32640" /></mesh>
      <mesh ref={slider} rotation-x={Math.PI / 2}><torusGeometry args={[1, 0.06, 6, 40]} /><meshStandardMaterial color="#FF8A1F" /></mesh>
      <lineSegments geometry={lineGeo} frustumCulled={false}><lineBasicMaterial color="#8A8F94" /></lineSegments>
      <sprite ref={flame} scale={[1.2, 1.2, 1.2]}><spriteMaterial map={dotTex()} color="#FFB020" blending={THREE.AdditiveBlending} transparent depthWrite={false} /></sprite>
    </group>
  );
}
