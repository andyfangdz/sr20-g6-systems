/** Shared materials. Everything is cached so hundreds of parts share a handful of materials. */
import * as THREE from "three";
import { paintSkin } from "./geometry";

export interface MatSet { on: THREE.MeshStandardMaterial; hi: THREE.MeshStandardMaterial; dim: THREE.MeshStandardMaterial }
const cache = new Map<string, MatSet>();

/** Normal / highlighted / dimmed materials for a colour. */
export function mats(hex: string): MatSet {
  let m = cache.get(hex);
  if (!m) {
    const c = new THREE.Color(hex);
    m = {
      on: new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.1, emissive: c.clone().multiplyScalar(0.18) }),
      hi: new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1, emissive: c.clone().multiplyScalar(0.55) }),
      dim: new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: true, opacity: 0.1, depthWrite: false }),
    };
    cache.set(hex, m);
  }
  return m;
}

/** X-ray "ghost" shell: rim-lit, transparent, no depth writes. */
export const shellUniforms = { uColor: { value: new THREE.Color("#2A3B48") }, uOpacity: { value: 0.6 } };
export const shellMat = new THREE.ShaderMaterial({
  uniforms: shellUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
    void main(){
      float r = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      gl_FragColor = vec4(uColor, uOpacity * (0.05 + pow(r, 2.4) * 0.95));
      #include <colorspace_fragment>
    }`,
});

export const solidMat = new THREE.MeshStandardMaterial({ color: "#F1F3F4", roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });

export const plateMat = {
  on: new THREE.MeshStandardMaterial({ color: "#6F8FAA", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  dim: new THREE.MeshStandardMaterial({ color: "#6F8FAA", transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }),
};

export const outlineMat = new THREE.LineBasicMaterial({ color: "#10171C", transparent: true, opacity: 0.9 });

let _skin: THREE.MeshStandardMaterial | null = null;
/** Painted fuselage skin (windows, door seam, pinstripes) for solid mode. */
export function skinMat() {
  if (!_skin) _skin = new THREE.MeshStandardMaterial({ map: paintSkin(), roughness: 0.36, metalness: 0.05, side: THREE.DoubleSide });
  return _skin;
}

let _dot: THREE.CanvasTexture | null = null;
/** Soft round sprite used for particles and light glows. */
export function dotTex() {
  if (!_dot) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.7)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    _dot = new THREE.CanvasTexture(c);
  }
  return _dot;
}
