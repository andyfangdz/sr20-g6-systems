import * as THREE from "three";

export type Vec3 = [number, number, number];

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const D2R = Math.PI / 180;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Accepts either a tuple or a Vector3 and returns a fresh Vector3. */
export const toV = (p: Vec3 | THREE.Vector3) => (Array.isArray(p) ? V(p[0], p[1], p[2]) : p.clone());
