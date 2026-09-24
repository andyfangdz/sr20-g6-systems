"use client";
import { useEffect, useReducer, type ReactNode } from "react";
import { pinnedParts } from "@/lib/parts";
import { focusPart } from "@/lib/registry";
import type { SysId } from "@/lib/systems";

/** Re-render on an interval — for readouts of values that live outside React state. */
export function useTicker(ms = 200) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { const id = setInterval(tick, ms); return () => clearInterval(id); }, [ms]);
}

export function Seg<T extends string | number>({ id, label, options, value, onChange }: {
  id: string; label: string; options: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="row">
      <div className="lbl"><span>{label}</span></div>
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, t]) => (
          <button key={String(v)} id={`${id}-${v}`} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

export function Slider({ id, label, min, max, step, value, onChange, fmt }: {
  id: string; label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="row">
      <label htmlFor={id}><span>{label}</span><output>{fmt(value)}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="chk"><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
  );
}

export function Rocker({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="rock" aria-label={label} aria-pressed={on} onClick={onToggle}>
      <div className="body" /><span>{label}</span>
    </button>
  );
}

export type Reading = string | [string, "" | "bad" | "warnc"];
export function Readouts({ items }: { items: [string, Reading][] }) {
  return (
    <div className="readouts">
      {items.map(([l, r]) => {
        const [t, c] = Array.isArray(r) ? r : [r, ""];
        return <div className="ro" key={l}><span>{l}</span><b className={c}>{t}</b></div>;
      })}
    </div>
  );
}

export const Facts = ({ rows }: { rows: [ReactNode, ReactNode][] }) => (
  <dl className="facts">{rows.map(([k, v], i) => <Frag key={i}><dt>{k}</dt><dd>{v}</dd></Frag>)}</dl>
);
const Frag = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Notes = ({ items }: { items: ReactNode[] }) => <ul className="notes">{items.map((n, i) => <li key={i}>{n}</li>)}</ul>;
export const Caution = ({ title, children }: { title: string; children: ReactNode }) => <div className="caution"><strong>{title}</strong>{children}</div>;
export const Small = ({ children }: { children: ReactNode }) => <p className="small">{children}</p>;
export const H3 = ({ children }: { children: ReactNode }) => <h3>{children}</h3>;
export const Ctl = ({ children }: { children: ReactNode }) => <div className="ctl">{children}</div>;
export const BtnRow = ({ children }: { children: ReactNode }) => <div className="btnrow">{children}</div>;

/** "Tap to locate": flies the camera to a part and highlights it briefly. */
export function PartsList({ sys }: { sys: SysId }) {
  const list = pinnedParts(sys);
  return (
    <ul className="parts">
      {list.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => focusPart(p.name!)}>
            <b>{p.name}</b><span>{p.note}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
