"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cabinAirColor, FLOWS, flowRates, isCabinAir } from "@/lib/flows";
import { curveOf } from "@/lib/geometry";
import { dotTex, mats } from "@/lib/materials";
import { useSim } from "@/lib/sim/store";
import { sysColor } from "@/lib/systems";
import type { PickInfo } from "./Part";

const noRaycast = () => {};

/** All pipes/wires/ducts/cables; one frame loop moves every particle. */
export function Flows() {
  const sys = useSim((x) => x.s.sys);
  const xray = useSim((x) => x.s.xray);
  const theme = useSim((x) => x.theme);

  const items = useMemo(() => FLOWS.map((f) => {
    const curve = curveOf(f.pts, f.tension ?? 0.3);
    const len = curve.getLength();
    const n = f.count ?? Math.max(6, Math.round(len * 9));
    const off = Float32Array.from({ length: n }, () => Math.random());
    const tube = f.tube === false ? null : new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 28)), f.r ?? 0.012, 6, false);
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ map: dotTex(), size: f.size ?? 0.08, transparent: true, depthWrite: false, sizeAttenuation: true }));
    pts.raycast = noRaycast;
    pts.visible = false;
    return { f, curve, len, n, off, tube, pts, t: 0 };
  }), []);

  const tmp = useRef(new THREE.Vector3());
  const air = useRef(new THREE.Color());
  useFrame((_, dt) => {
    const { s, E } = useSim.getState();
    const R = flowRates(s, E);
    cabinAirColor(s, air.current);
    for (const it of items) {
      const rate = R[it.f.key] ?? 0;
      const vis = rate !== 0 && (s.sys === "overview" || it.f.sys.includes(s.sys));
      it.pts.visible = vis;
      if (!vis) continue;
      const mat = it.pts.material as THREE.PointsMaterial;
      mat.color.set(isCabinAir(it.f.key) ? air.current : it.f.pcolor ?? it.f.color ?? sysColor(it.f.sys[0], theme));
      it.t += (dt * 0.9 * rate) / Math.max(it.len, 0.5);
      const a = it.pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < it.n; i++) {
        let u = (it.off[i] + it.t) % 1; if (u < 0) u += 1;
        it.curve.getPointAt(u, tmp.current);
        a.setXYZ(i, tmp.current.x, tmp.current.y, tmp.current.z);
      }
      a.needsUpdate = true;
    }
  });

  return (
    <>
      {items.map((it) => {
        const color = it.f.color ?? sysColor(it.f.sys[0], theme);
        const act = sys === "overview" || it.f.sys.includes(sys);
        const pick: PickInfo | undefined = it.f.name ? { name: it.f.name, note: it.f.note ?? "", color, sys: it.f.sys } : undefined;
        return (
          <group key={it.f.key}>
            {it.tube && <mesh geometry={it.tube} material={act || !xray ? mats(color).on : mats(color).dim} userData={{ pick }} />}
            <primitive object={it.pts} />
          </group>
        );
      })}
    </>
  );
}
