"use client";
import { bladeAngle, fuelAvail, live, mapInHg } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "../ui/controls";

const lever = (v: number) => (v < 0.03 ? "IDLE" : v > 0.97 ? "MAX" : Math.round(v * 100) + "%");
const rpm10 = () => String(Math.round(live.rpm / 10) * 10);

export function Engine() {
  useTicker(200);
  const s = useSim((x) => x.s), up = useSim((x) => x.update);
  const g = s.eng;
  return (
    <>
      <p className="lead">A Lycoming IO-390 with continuous-flow fuel injection. One power lever sets the throttle and the governor&apos;s RPM target at the same time; mixture is manual. Two magnetos fire two plugs per cylinder.</p>
      <H3>Engine controls</H3>
      <Ctl>
        <Seg id="key" label="Ignition key" options={[["OFF", "OFF"], ["R", "R"], ["L", "L"], ["BOTH", "BOTH"], ["START", "START"]]} value={g.key}
          onChange={(v) => { if (v === "START") { live.startTimer = 1.8; live.crankT = 0; } up((d) => { d.eng.key = v; }); }} />
        <Slider id="power" label="Power lever (IDLE → MAX)" min={0} max={1} step={0.01} value={g.lever} onChange={(v) => up((d) => { d.eng.lever = v; })} fmt={lever} />
        <Slider id="mix" label="Mixture — red knob (CUTOFF → RICH)" min={0} max={1} step={0.01} value={g.mix} onChange={(v) => up((d) => { d.eng.mix = v; })} fmt={(v) => (v <= 0.05 ? "CUTOFF" : v > 0.95 ? "FULL RICH" : "Leaned")} />
        <Check id="altAir" label="ALT AIR pulled (bypass filter)" checked={g.altAir} onChange={(v) => up((d) => { d.eng.altAir = v; })} />
        <Readouts items={[
          ["Engine", g.running ? "RUNNING" : g.key === "START" ? ["CRANKING", "warnc"] : ["STOPPED", "bad"]],
          ["RPM", rpm10()], ["MAP in", mapInHg(s, live.rpm).toFixed(1)],
          ["Plugs firing", live.rpm < 100 ? "—" : g.key === "R" ? "R mag · 4" : g.key === "L" ? "L mag · 4" : "Both · 8"],
        ]} />
      </Ctl>
      <Small>RPM follows the POH governor schedule (2,500 from idle through cruise, 2,700 at full power); MAP is illustrative. Starting needs BAT 1, fuel at the selected tank and mixture out of cutoff.</Small>
      <H3>Ignition wiring</H3>
      <Facts rows={[["Right magneto", "Lower-right + upper-left plugs"], ["Left magneto", "Lower-left + upper-right plugs"], ["START", "Starter + SlickSTART, both mags; springs to BOTH"], ["Starter power", "2 A STARTER, NON ESS BUS"]]} />
      <H3>Engine data</H3>
      <Facts rows={[["Rating", "215 hp @ 2,700 RPM"], ["TBO", "2,200 hr"], ["Oil sump", "7 qt, wet sump"], ["Cooler bypass", "< 170 °F or > 18 psi Δp"], ["Cooling", "Baffled ram air, no cowl flaps"], ["Induction", "Right cowl inlet → filter (Costanzo deck)"], ["Exhaust", "Single muffler → lower cowl"], ["Oil pressure", "55–95 psi normal · < 25 red"], ["CHT", "240–435 °F green · > 465 red"]]} />
      <H3>Mixture management</H3>
      <Notes items={["Full rich for takeoff, climb and power above ~75%; lean on the placarded fuel-flow schedule as you climb (roughness from over-richness is common above 5,000 ft).", "Best power: 100 °F rich of peak EGT. Best economy: 50 °F lean of peak, or the cyan target-fuel-flow mark (shown below 75% power).", "Lean for max RPM while taxiing to prevent plug fouling; richen on descent to keep EGT ~1,300–1,500 °F."]} />
    </>
  );
}

export function Propeller() {
  useTicker(200);
  const s = useSim((x) => x.s), up = useSim((x) => x.update);
  return (
    <>
      <p className="lead">The governor senses RPM with flyweights and senses the power-lever position through its own cable, then meters boosted engine oil into the hub to hold RPM. There&apos;s no separate prop lever.</p>
      <H3>Power lever</H3>
      <Ctl>
        <Slider id="power2" label="Power lever (IDLE → MAX)" min={0} max={1} step={0.01} value={s.eng.lever} onChange={(v) => up((d) => { d.eng.lever = v; })} fmt={lever} />
        <Readouts items={[["Governor target", s.eng.lever >= 0.93 ? "2,700" : "2,500"], ["RPM", rpm10()], ["Blade angle", bladeAngle(s).toFixed(0) + "°"]]} />
      </Ctl>
      <Small>Blade angle here is illustrative — it coarsens as power rises so the governor can hold RPM.</Small>
      <H3>How the hub moves</H3>
      <Notes items={["Lever forward: governor meters less high-pressure oil to the hub; centrifugal force twists blades to lower pitch for higher RPM.", "Lever back: more oil to the hub forces blades to higher pitch and lower RPM.", "Lose oil pressure and the blades go to flat (low) pitch — expect high RPM. (Costanzo deck)", "In steady flight, any change in airspeed or load is absorbed by a pitch change, not an RPM change."]} />
      <Facts rows={[["Standard", "Metal, 3-blade, 74 in."], ["Optional", "Composite, 3-blade, 74 in."], ["RPM schedule", "2,500 idle→cruise · 2,700 full"], ["Max RPM", "2,700 (brief overshoot is normal)"]]} />
    </>
  );
}

export function Fuel() {
  useTicker(500);
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  const f = s.fuel;
  return (
    <>
      <p className="lead">Each wing is a sealed tank that gravity-feeds a collector sump. The engine-driven pump pulls from whichever collector the selector points at; the electric boost pump is for priming, vapor suppression and backup.</p>
      <H3>Try it</H3>
      <Ctl>
        <Seg id="fsel" label="Fuel selector" options={[["L", "LEFT"], ["R", "RIGHT"], ["OFF", "OFF"]]} value={f.sel} onChange={(v) => up((d) => { d.fuel.sel = v; })} />
        <Check id="boost" label="BOOST PUMP on" checked={f.boost} onChange={(v) => up((d) => { d.fuel.boost = v; })} />
        <Slider id="qL" label="Left tank" min={0} max={28} step={0.1} value={f.qL} onChange={(v) => up((d) => { d.fuel.qL = v; })} fmt={(v) => v.toFixed(1) + " gal"} />
        <Slider id="qR" label="Right tank" min={0} max={28} step={0.1} value={f.qR} onChange={(v) => up((d) => { d.fuel.qR = v; })} fmt={(v) => v.toFixed(1) + " gal"} />
        <BtnRow>
          {([["Full · 56", 28, 28], ["Tabs · 26", 13, 13], ["Low · 7 / 6", 7, 6], ["Imbalance", 20, 6]] as const).map(([t, l, r]) => (
            <button key={t} type="button" className="btn" onClick={() => up((d) => { d.fuel.qL = l; d.fuel.qR = r; })}>{t}</button>
          ))}
        </BtnRow>
        <Readouts items={[
          ["Total usable", (f.qL + f.qR).toFixed(1)],
          ["Feeding", f.sel === "OFF" ? ["OFF", "bad"] : fuelAvail(s) ? (f.sel === "L" ? "LEFT" : "RIGHT") : ["DRY TANK", "bad"]],
          ["Boost", f.boost ? (E.boostPwr ? "23 psi" : ["NO PWR", "bad"]) : "OFF"],
          ["Engine", s.eng.running ? "RUNNING" : ["STOPPED", "bad"]],
        ]} />
      </Ctl>
      <Small>Selecting OFF or a dry tank with the engine running stops it after a few seconds — restart from the Engine panel.</Small>
      <H3>Annunciations</H3>
      <Facts rows={[["White advisory", "Either tank < 8.2 gal"], ["Amber caution", "Both tanks < 8.2 gal"], ["Red warning", "Total (sensed or totalizer) < 7 gal"]]} />
      <Caution title="Caution">At ¼ tank or less, prolonged slips or skids can unport the tank outlet. With a tank that low (or one dry), stay coordinated — no more than 30 seconds uncoordinated.</Caution>
      <H3>Details</H3>
      <Facts rows={[["Capacity", "29.3 gal per tank · 28 usable"], ["Total usable", "56 gal"], ["Filled to tabs", "13 gal/side · 26 total"], ["Boost pump", "23 psi · 5 A, MAIN BUS 2"], ["Training deck", "Lists 26.5 gal usable/side — this G6 POH says 28"], ["Drains", "5: 2 tank, 2 collector, gascolator"], ["Vents", "NACA vent under each wing near tip"], ["Gauge", "0–28 gal · yellow 0–8.2"], ["Totalizer", "Independent of float sensors"]]} />
      <H3>Components</H3>
      <PartsList sys="fuel" />
    </>
  );
}
