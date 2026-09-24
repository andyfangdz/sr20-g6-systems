"use client";
import dynamic from "next/dynamic";
import { useEffect, type ComponentType } from "react";
import { casMessages, live } from "@/lib/sim/model";
import { isSysId, useSim } from "@/lib/sim/store";
import { SYS, sysColor, sysDef, type SysId, type Theme } from "@/lib/systems";
import { Caps } from "./panels/caps";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Avionics, Cabin, Lighting, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { Environment, Pitot } from "./panels/air";
import { capsPhase } from "./scene/Parachute";
import { useTicker } from "./ui/controls";

// WebGL scene is client-only
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <div className="loading">Loading 3D model…</div> });

const PANELS: Record<SysId, ComponentType> = {
  overview: Overview, airframe: Airframe, controls: Controls, flaps: Flaps, gear: Gear, engine: Engine, propeller: Propeller,
  fuel: Fuel, electrical: Electrical, lighting: Lighting, environment: Environment, pitot: Pitot, avionics: Avionics, cabin: Cabin, caps: Caps,
};

function Rail() {
  const sys = useSim((x) => x.s.sys), theme = useSim((x) => x.theme), select = useSim((x) => x.select);
  return (
    <nav className="rail" aria-label="Systems">
      <div className="brand">
        <div className="eyebrow">POH §7 · Airplane &amp; Systems</div>
        <h1>SR20 G6</h1>
        <p>Perspective+ · IO-390 · 3D study model</p>
      </div>
      <ul className="syslist">
        {SYS.map((s) => (
          <li key={s.id}>
            <button type="button" aria-current={s.id === sys} style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => select(s.id)}>
              <span className="sw" /><span className="nm">{s.name}</span><span className="pg">{s.pg}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="foot">Drag to orbit · scroll or pinch to zoom · right-drag to pan. Hover a part for its note.</div>
    </nav>
  );
}

function Panel() {
  const sys = useSim((x) => x.s.sys), theme = useSim((x) => x.theme);
  const s = sysDef(sys), Body = PANELS[sys];
  useEffect(() => { if (matchMedia("(max-width:860px)").matches) document.querySelector(".panel")?.scrollTo(0, 0); }, [sys]);
  return (
    <aside className="panel">
      <div className="panel-inner" style={{ "--c": sysColor(sys, theme) } as React.CSSProperties}>
        <div className="ref"><i />POH §7 · p. {s.pg}</div>
        <h2>{sys === "overview" ? "Airplane & Systems" : s.name}</h2>
        <Body />
      </div>
    </aside>
  );
}

const SUN = <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>;
const MOON = <path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7z" />;

function Toolbar() {
  const s = useSim((x) => x.s), theme = useSim((x) => x.theme);
  const { update, setTheme, flyTo } = useSim.getState();
  const dark = theme === "dark";
  return (
    <div className="toolbar">
      <button className="tb" aria-pressed={s.xray} onClick={() => update((d) => { d.xray = !d.xray; })}>X-ray</button>
      <button className="tb" aria-pressed={s.labels} onClick={() => update((d) => { d.labels = !d.labels; })}>Labels</button>
      <button className="tb" aria-pressed={s.spin} onClick={() => update((d) => { d.spin = !d.spin; })}>Auto-rotate</button>
      <button className="tb tb-theme" title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">{dark ? SUN : MOON}</svg><span>{dark ? "Light" : "Dark"}</span>
      </button>
      <button className="tb" onClick={() => { const [p, t] = s.capsOn ? [[20, 9, 26], [0, 6, 0]] as const : sysDef(s.sys).cam; flyTo([...p], [...t]); }}>Reset view</button>
    </div>
  );
}

function CasWindow() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E);
  const powered = E.pfd || E.mfd;
  const m = powered ? casMessages(s, E) : [];
  return (
    <div className="cas" aria-live="polite">
      <div className="hd"><span>CAS</span><span>{powered ? `${m.length} ${m.length === 1 ? "msg" : "msgs"}` : "NO DISPLAY PWR"}</span></div>
      <ul>{m.length ? m.map(([c, t]) => <li key={t} className={c}>{t}</li>) : <li className="none">{powered ? "No alerts" : "—"}</li>}</ul>
    </div>
  );
}

function CapsHud() {
  useTicker(100);
  const sys = useSim((x) => x.s.sys);
  if (sys !== "caps") return null;
  const t = Math.max(0, live.capsT), [, title, sub] = live.capsT < 0 ? [0, "Ready", ""] : capsPhase(t);
  return <div className="caps-hud"><span>T + {t.toFixed(1)} s</span><b>{title}</b><span>{sub}</span></div>;
}

function Tooltip() {
  const hover = useSim((x) => x.hover);
  if (!hover) return null;
  const stage = document.querySelector(".stage") as HTMLElement | null;
  const w = stage?.clientWidth ?? 800, h = stage?.clientHeight ?? 600;
  return (
    <div className="tip" style={{ left: Math.min(hover.x + 14, w - 270), top: Math.min(hover.y + 14, h - 120) }}>
      <h4 style={{ color: hover.color }}>{hover.name}</h4>
      {hover.note && <p>{hover.note}</p>}
    </div>
  );
}

/** Restore theme and last-viewed system (URL hash wins). */
function useBoot() {
  useEffect(() => {
    const st = useSim.getState();
    let theme: Theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try { const t = localStorage.getItem("sr20theme"); if (t === "light" || t === "dark") theme = t; } catch {}
    st.setTheme(theme);
    const hash = location.hash.slice(1);
    let start: SysId | null = isSysId(hash) ? hash : null;
    if (!start) try { const v = localStorage.getItem("sr20sys"); if (isSysId(v)) start = v; } catch {}
    if (start && start !== "overview") st.select(start);
  }, []);
}

export default function App() {
  useBoot();
  return (
    <div className="app">
      <Rail />
      <main className="stage">
        <Scene />
        <div className="hint">Hover parts · drag to orbit</div>
        <Toolbar />
        <CasWindow />
        <CapsHud />
        <Tooltip />
      </main>
      <Panel />
    </div>
  );
}
