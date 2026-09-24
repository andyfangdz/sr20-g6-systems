# SR20 G6 Systems

An interactive 3D study model of the Cirrus SR20 (Perspective+, "G6") airplane systems, built from **POH Section 7 – Airplane and Systems**. Pick a system to fly the camera to it, hover parts for notes, and operate switches, levers and failures. The systems are linked: pull an alternator and the buses, displays and CAS window respond.

Built with **Next.js 16 (App Router)**, **React Three Fiber**, **drei** and **zustand**.

> Unofficial study aid. Always use the POH/AFM and supplements for your serial number.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

## What's modelled

| System | Interactive |
| --- | --- |
| Flight controls | Cable runs from POH Figs 7-1/7-2/7-3: torque tube, sectors, pulleys, push-pull tubes and bellcranks move with the yokes and pedals; per-channel focus (elevator / aileron / rudder); horn balances, trim tabs, static wicks |
| Wing flaps | UP / 50% / 100% with position lights and VFE; needs the FLAPS breaker and NON ESS bus |
| Gear & brakes | Differential braking castering the nose wheel, parking brake |
| Engine & propeller | Ignition key (magneto → plug mapping), power lever (governor schedule), mixture, alternate air |
| Fuel | Selector, boost pump, tank quantities (clipped fuel level), starvation |
| Electrical | Master switches, failures, battery endurance, **pullable circuit breakers**, G6 CAS names |
| Environmental | OFF–0–1–2–3 fan knob, temperature blend, vent modes, A/C, recirculation |
| Pitot-static & stall | Pitot heat logic and annunciations, stall-warning suction peak and horn |
| Avionics | Live PFD / MFD / standby textures that go dark with their buses; display backup |
| CAPS | Scrubbable deployment: rocket extraction, slider, snubbed riser, line cut, descent |

## Project structure

```
app/                  Next.js App Router entry (layout, page, global CSS)
components/
  App.tsx             Shell: system rail, toolbar, CAS window, HUD, tooltip, panel router
  scene/              React Three Fiber scene
    Scene.tsx         Canvas, lights, orbit controls, camera flights, sim clock
    Airplane.tsx      Airframe shells, control surfaces, moving assemblies, tanks, displays, lights
    Part.tsx          Generic part: emphasis per system, animation hooks, labels, hover picking
    Flows.tsx         Pipes / wires / ducts / cables with moving particles
    ControlRig.tsx    Animated flight-control linkages (sectors, pulleys, push rods)
    Parachute.tsx     CAPS deployment animation
  panels/             Per-system explanation + controls (React)
  ui/controls.tsx     Seg, Slider, Check, Rocker, Readouts, Facts, …
lib/
  geometry.ts         Airframe geometry (lofts, airfoils, fuselage profile, windows, painted skin)
  parts.ts            Declarative catalogue of every component
  flows.ts            Flow paths and the rules that drive them
  rig.ts              Flight-control cable routing and linkage kinematics (POH Figs 7-1 to 7-3)
  displays.ts         Canvas drawing for PFD / MFD / standby
  sim/model.ts        Sim state, electrical solver, CAS logic, bus table (pure functions)
  sim/store.ts        zustand store (discrete state + derived electrical solution)
  sim/tick.ts         Per-frame engine / flap motor / CAPS clock
```

### State model

- **Discrete state** (switches, levers, selections) lives in a zustand store as an immutable `Sim` object. Every update recomputes the electrical solution `E` with `solveElec`, a pure function that is easy to test.
- **Continuous values** (RPM, flap angle, CAPS time) live in a mutable `live` object advanced in `useFrame`, so animation doesn't re-render React. Panels that show them use a small `useTicker` hook.

## Sources

- Cirrus SR20 POH, P/N 11934-005 Reissue A — Section 7 (systems), Section 1 Figure 1-1 (three view, used for the fuselage profile), and a few Section 2 limits.
- Side photos of SR20 G6 OO-CBB (s/n 2347), Wikimedia Commons — tailcone, fin and window outlines.
- Costanzo Air Flight School, *Cirrus SR20 Systems* deck — G6 CAS names, electrical readouts, battery-endurance rule of thumb, and photo detail (horn balances, static wicks, OAT probes, ECS knob). Where it differs from the POH, the POH wins and the page says so.

Geometry is approximate. CAS text is illustrative except where Section 7 names it.
