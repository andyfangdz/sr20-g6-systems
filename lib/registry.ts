/** Handles to live three.js objects so UI code can locate parts in the scene. */
import * as THREE from "three";
import { flashFocus, useSim } from "./sim/store";

export const partObjects = new Map<string, THREE.Mesh>();
export const view: { camera: THREE.Camera | null; target: THREE.Vector3 | null } = { camera: null, target: null };

/** Fly the camera to a named part (keeping the current viewing direction) and flash it. */
export function focusPart(name: string) {
  flashFocus(name);
  const o = partObjects.get(name);
  if (!o) return;
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const c = o.localToWorld(g.boundingSphere!.center.clone());
  const dir = view.camera && view.target ? view.camera.position.clone().sub(view.target).normalize() : new THREE.Vector3(1, 0.6, 1).normalize();
  const p = c.clone().add(dir.multiplyScalar(2.6));
  useSim.getState().flyTo([p.x, p.y, p.z], [c.x, c.y, c.z]);
}
