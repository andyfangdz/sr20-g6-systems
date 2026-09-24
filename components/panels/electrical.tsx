"use client";
import { BUSES, fuelAvail, type BusId, type Sim } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, Readouts, Rocker, Slider, Small } from "../ui/controls";

function Bus({ id, name, src, loads }: { id: BusId; name: string; src: string; loads?: [string, number?][] }) {
  const E = useSim((x) => x.E), cb = useSim((x) => x.s.cb), up = useSim((x) => x.update);
  const v = E[id], on = v > 0;
  return (
    <div className={"bus" + (on ? " on" : "")}>
      <div className="top"><span className="lamp" /><span className="nm">{name}</span><span className="v">{on ? v.toFixed(1) + " V" : "0 V"}</span></div>
      <div className="src">{src}</div>
      {loads && (
        <div className="loads">
          {loads.map(([n, a]) => (
            <button key={n} type="button" className={"chip" + (cb[n] ? " pulled" : "")} aria-pressed={!!cb[n]} title={`Pull / reset the ${n} breaker`}
              onClick={() => up((d) => { if (d.cb[n]) delete d.cb[n]; else d.cb[n] = true; })}>
              {n}{a ? ` ${a}A` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const resetElec = (d: Sim) => { d.elec = { bat1: true, bat2: true, alt1: true, alt2: true, avionics: true, fail: { alt1: false, alt2: false, bat1: false }, tBat: 0 }; };

export function Electrical() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  const e = s.elec;
  const scen = (label: string, fn: (d: Sim) => void) => (
    <button key={label} type="button" className="btn" onClick={() => up((d) => { resetElec(d); fn(d); })}>{label}</button>
  );
  const amp = (a: number) => (a > 0 ? "+" : "") + a;
  return (
    <>
      <p className="lead">Two alternators and two batteries feed three distribution buses inside the Master Control Unit. A diode lets Main Dist Bus 1 back up Bus 2 but never the reverse, and the essential buses can be fed from every source — so a single failure never takes out the flight-critical loads.</p>
      <H3>Bolster master switches</H3>
      <Ctl>
        <div className="switches">
          <Rocker label="BAT 2" on={e.bat2} onToggle={() => up((d) => { d.elec.bat2 = !d.elec.bat2; })} />
          <Rocker label="BAT 1" on={e.bat1} onToggle={() => up((d) => { d.elec.bat1 = !d.elec.bat1; })} />
          <Rocker label="ALT 1" on={e.alt1} onToggle={() => up((d) => { d.elec.alt1 = !d.elec.alt1; })} />
          <Rocker label="ALT 2" on={e.alt2} onToggle={() => up((d) => { d.elec.alt2 = !d.elec.alt2; })} />
          <Rocker label="AVIONICS" on={e.avionics} onToggle={() => up((d) => { d.elec.avionics = !d.elec.avionics; })} />
        </div>
        <div className="row">
          <div className="lbl"><span>Failures</span></div>
          <BtnRow>
            <Check id="fA1" label="ALT 1 fails" checked={e.fail.alt1} onChange={(v) => up((d) => { d.elec.fail.alt1 = v; })} />
            <Check id="fA2" label="ALT 2 fails" checked={e.fail.alt2} onChange={(v) => up((d) => { d.elec.fail.alt2 = v; })} />
            <Check id="fB1" label="BAT 1 dead" checked={e.fail.bat1} onChange={(v) => up((d) => { d.elec.fail.bat1 = v; })} />
          </BtnRow>
        </div>
        <div className="row">
          <div className="lbl"><span>Scenarios</span></div>
          <BtnRow>
            {scen("Normal cruise", (d) => { d.cb = {}; d.eng.running = true; d.eng.key = "BOTH"; if (d.eng.mix < 0.1) d.eng.mix = 0.85; if (!fuelAvail(d)) d.fuel.sel = d.fuel.qL > 0 ? "L" : "R"; })}
            {scen("ALT 1 fails", (d) => { d.eng.running = true; d.elec.fail.alt1 = true; })}
            {scen("ALT 2 fails", (d) => { d.eng.running = true; d.elec.fail.alt2 = true; })}
            {scen("Both ALTs fail", (d) => { d.eng.running = true; d.elec.fail.alt1 = d.elec.fail.alt2 = true; })}
            {scen("BAT 2-only ground check", (d) => { d.eng.running = false; d.eng.key = "OFF"; d.elec.bat1 = d.elec.alt1 = d.elec.alt2 = d.elec.avionics = false; })}
            {scen("Everything lost but BAT 2", (d) => { d.eng.running = true; d.elec.fail.alt1 = d.elec.fail.alt2 = d.elec.fail.bat1 = true; })}
          </BtnRow>
        </div>
        <Slider id="tBat" label="Time on batteries (after ALT failure)" min={0} max={75} step={1} value={e.tBat} onChange={(v) => up((d) => { d.elec.tBat = v; })} fmt={(v) => v + " min"} />
        <Readouts items={[
          ["Engine", s.eng.running ? "RUNNING" : ["STOPPED", "bad"]],
          ["ESS V", [E.ess1.toFixed(1), E.ess1 < 24.5 ? "bad" : ""]],
          ["M1 V", [E.mdb1.toFixed(1), E.mdb1 < 24.5 ? "warnc" : ""]],
          ["M2 V", [E.mdb2.toFixed(1), E.mdb2 < 24.5 ? "warnc" : ""]],
          ["ALT 1 A", [amp(E.a1), E.a1 ? "" : "warnc"]],
          ["ALT 2 A", [amp(E.a2), E.a2 ? "" : "warnc"]],
          ["BAT 1 A", E.bat1Dead ? ["DEPLETED", "bad"] : !E.bat1ok ? ["OFF", "bad"] : [amp(E.b1), E.b1 < 0 ? "warnc" : ""]],
          ["BAT 2", E.bat2Dead ? ["DEPLETED", "bad"] : !E.bat2ok ? ["OFF", "bad"] : E.bat2Charging ? "Charging" : ["Supplying", "warnc"]],
        ]} />
      </Ctl>
      <Small>Currents are illustrative, anchored to a normal G6 readout (ALT 1 +23 A, ALT 2 +13 A, BAT 1 +1 A, ESS 28.0 V, M1 27.7 V, M2 28.7 V). Battery times use the Costanzo training deck&apos;s rule of thumb — actual endurance depends on load shedding.</Small>
      <H3>Battery endurance (rule of thumb)</H3>
      <Facts rows={[["ALT 2 fails", "ALT 1 powers Main Dist Bus 2 through the diode — no time limit"], ["ALT 1 fails", "BAT 1 carries Main Dist Bus 1 ≈ 30 min, then it drops off"], ["Both fail", "BAT 1 carries both main buses ≈ 15 min, then BAT 2 carries the essential buses ≈ 45 min"]]} />
      <H3>MCU distribution buses</H3>
      <div className="mcu">
        <Bus id="mdb1" name="MAIN DIST 1" src="ALT 1 · BAT 1" />
        <Bus id="mdb2" name="MAIN DIST 2" src="ALT 2 · MDB 1 via diode" />
        <Bus id="edb" name="ESS DIST" src="MDB 1 + MDB 2" />
      </div>
      <H3>Circuit-breaker buses</H3>
      <Small>Tap a breaker to pull it (white collar showing) or reset it. Pulled breakers remove that load everywhere in the model — try FLAPS, PFD A + PFD B, ALT 1, or STALL WARNING.</Small>
      <div className="buses">{BUSES.map(([id, name, src, loads]) => <Bus key={id} id={id} name={name} src={src} loads={loads} />)}</div>
      <H3>Details</H3>
      <Facts rows={[["ALT 1", "100 A, right front, 27.7 V"], ["ALT 2", "70 A, left front, 28.7 V"], ["BAT 1", "24 V, 10 Ah, right firewall"], ["BAT 2", "2 × 12 V, 7 Ah, aft of FS 222"], ["ALT 1 start", "Needs BAT 1 on"], ["ALT 2 start", "Needs BAT 1 or BAT 2 on"], ["External power", "28 V regulated; BAT 1 must be on"], ["Lightning", "TVS suppressors at bus entry points"]]} />
      <Caution title="Caution">Running with the alternators off drains the batteries until the battery relay opens, removing alternator field power and preventing a restart.</Caution>
      <H3>CAS by failure (G6)</H3>
      <Facts rows={[["ALT 2 fails", "ALT 2"], ["ALT 1 fails", "M BUS 1 · ALT 1 · BAT 1"], ["Both fail", "M BUS 1 · M BUS 2 · ALT 1 · ALT 2 · BAT 1 · ESS BUS (red)"]]} />
      <H3>Ground check logic</H3>
      <Notes items={["BAT 2 alone should power only ESS BUS 1 and 2. Anything else lit means the interconnect diode has failed.", "Turn AVIONICS off before master switches, engine start or external power."]} />
    </>
  );
}
