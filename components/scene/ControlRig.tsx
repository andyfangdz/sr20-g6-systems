"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mats } from "@/lib/materials";
import { V } from "@/lib/math";
import { partsFor } from "@/lib/parts";
import { AIL_SECTOR, CARR, ETT, PULLEYS, RUD_HORN, linkPoints, rigPose } from "@/lib/rig";
import type { Chan } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { sysColor } from "@/lib/systems";
import { Part, type PickInfo } from "./Part";

const Parts = ({ parent }: { parent: string }) => <>{partsFor(parent).map((p) => <Part key={p.id} spec={p} />)}</>;

/** Links whose end points move every frame: name, pick note, radius, channel. */
const LINKS: Record<string, [string, string, number, Chan]> = {
  "drop-1": ["Elevator drop link", "Push-pull link from the yoke tube to the lever on the elevator torque tube (POH Fig. 7-1).", 0.007, "elevator"],
  drop1: ["Elevator drop link", "Push-pull link from the yoke tube to the lever on the elevator torque tube (POH Fig. 7-1).", 0.007, "elevator"],
  ailRod: ["Aileron push rod", "Links both pivoting yoke carriages to the central pulley sector (POH Fig. 7-2).", 0.006, "aileron"],
  elevPush: ["Elevator push-pull tube", "From the aft sector pulley's crank pin to the elevator bellcrank.", 0.01, "elevator"],
  rudPush: ["Rudder push-pull tube", "From the aft rudder sector to the rudder bellcrank.", 0.009, "rudder"],
  "ped-1": ["Pedal link", "Connects the left pedal pair to its end of the rudder cable horn.", 0.006, "rudder"],
  ped1: ["Pedal link", "Connects the right pedal pair to its end of the rudder cable horn.", 0.006, "rudder"],
  "cone-1": ["Aileron drive link", "Right-angle drive: the wing sector's crank swings fore-aft and this link turns the aileron's drive arm about the hinge.", 0.006, "aileron"],
  cone1: ["Aileron drive link", "Right-angle drive: the wing sector's crank swings fore-aft and this link turns the aileron's drive arm about the hinge.", 0.006, "aileron"],
};

const UP = new THREE.Vector3(0, 1, 0);

/** Animated cable-control mechanisms from POH Figures 7-1 (elevator), 7-2 (aileron), 7-3 (rudder). */
export function ControlRig() {
  const sys = useSim((x) => x.s.sys);
  const xray = useSim((x) => x.s.xray);
  const cf = useSim((x) => x.s.ctrlFocus);
  const theme = useSim((x) => x.theme);
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const links = useRef<Record<string, THREE.Mesh | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => { g.current[k] = o; };
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const tmp = useMemo(() => ({ mid: new THREE.Vector3(), dir: new THREE.Vector3() }), []);

  useFrame(() => {
    const s = useSim.getState().s, p = rigPose(s), G = g.current;
    if (G.ett) G.ett.rotation.z = p.ett;
    if (G.carrL) G.carrL.rotation.x = p.carr;
    if (G.carrR) G.carrR.rotation.x = p.carr;
    if (G.ailSector) G.ailSector.rotation.x = p.ailSector;
    if (G.rudHorn) G.rudHorn.rotation.y = p.rudHorn;
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
    for (const [k, d] of Object.entries(PULLEYS)) {
      const o = G["pul:" + k];
      if (o) o.rotation[d.axis] = p.pulley[k];
    }
    const L = linkPoints(s, p);
    for (const [k, [a, b]] of Object.entries(L)) {
      const m = links.current[k];
      if (!m) continue;
      tmp.dir.subVectors(b, a);
      const len = tmp.dir.length();
      m.position.copy(tmp.mid.addVectors(a, b).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(UP, tmp.dir.normalize());
      const r = LINKS[k][2];
      m.scale.set(r, len, r);
    }
  });

  const color = sysColor("controls", theme);
  const all = sys === "overview";
  return (
    <>
      <group ref={set("ett")} position={ETT.c}><Parts parent="rig:ett" /></group>
      <group ref={set("carrL")} position={[CARR.x, CARR.y, -CARR.z]}><Parts parent="rig:carr:L" /></group>
      <group ref={set("carrR")} position={[CARR.x, CARR.y, CARR.z]}><Parts parent="rig:carr:R" /></group>
      <group ref={set("ailSector")} position={AIL_SECTOR.c}><Parts parent="rig:ailSector" /></group>
      <group ref={set("rudHorn")} position={RUD_HORN.c}><Parts parent="rig:rudHorn" /></group>
      <group ref={set("pedL")}><Parts parent="rig:pedL" /></group>
      <group ref={set("pedR")}><Parts parent="rig:pedR" /></group>
      {Object.entries(PULLEYS).map(([k, d]) => (
        <group key={k} ref={set("pul:" + k)} position={d.c}><Parts parent={"rig:pul:" + k} /></group>
      ))}
      {Object.entries(LINKS).map(([k, [name, note, , chan]]) => {
        const dim = sys === "controls" && cf !== "all" && cf !== chan;
        const act = (all || sys === "controls" || (sys === "gear" && k.startsWith("ped"))) && !dim;
        const pick: PickInfo = { name, note, color, sys: ["controls"] };
        return (
          <mesh key={k} ref={(m) => { links.current[k] = m; }} geometry={geo} position={V(0, -10, 0)}
            material={act || !xray ? mats("#8C959C").on : mats("#8C959C").dim} userData={{ pick }} />
        );
      })}
    </>
  );
}
