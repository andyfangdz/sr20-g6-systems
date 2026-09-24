"use client";
import { useSim } from "@/lib/sim/store";
import { Caution, Check, Ctl, Facts, H3, Notes, Readouts, Seg, Slider, Small } from "../ui/controls";

export function Environment() {
  const s = useSim((x) => x.s), up = useSim((x) => x.update);
  const env = s.env;
  return (
    <>
      <p className="lead">Ram air from a NACA inlet on the right cowl is split: some goes straight to the fresh-air valve, some through a muff around the exhaust muffler to the hot-air valve. The temperature knob blends the two in a mixing chamber on the firewall.</p>
      <H3>Climate panel</H3>
      <Ctl>
        <Seg id="fan" label="Airflow / fan knob" options={[[-1, "OFF"], [0, "0"], [1, "1"], [2, "2"], [3, "3"]]} value={env.fan}
          onChange={(v) => up((d) => { d.env.fan = v; if (v < 1) { d.env.ac = false; d.env.recirc = false; } })} />
        <Slider id="temp" label="Temperature (cool → hot)" min={0} max={1} step={0.01} value={env.temp} onChange={(v) => up((d) => { d.env.temp = v; })}
          fmt={(v) => (v < 0.15 ? "Full cool" : v > 0.85 ? "Full hot" : "Blend " + Math.round(v * 100) + "% hot")} />
        <Seg id="vent" label="Vents" options={[["P", "Panel"], ["PF", "Panel+Foot"], ["PFW", "P+F+Wind"], ["W", "Windshield"]]} value={env.vent} onChange={(v) => up((d) => { d.env.vent = v; })} />
        <Check id="ac" label="A/C on (optional, needs fan 1–3)" checked={env.ac} onChange={(v) => up((d) => { d.env.ac = v && d.env.fan >= 1; if (!d.env.ac) d.env.recirc = false; })} />
        <Check id="recirc" label="Recirculate (A/C only)" checked={env.recirc} onChange={(v) => up((d) => { d.env.recirc = v && d.env.ac; })} />
        <Readouts items={[
          ["Hot-air valve", env.ac || env.fan < 0 ? "Closed" : Math.round(env.temp * 100) + "%"],
          ["Fresh-air valve", env.recirc || env.fan < 0 ? "Closed" : Math.round((1 - env.temp) * 100) + "%"],
          ["Outlets", { P: "Panel", PF: "Panel · floor", PFW: "Panel · floor · wind", W: "Panel · windshield" }[env.vent]],
        ]} />
      </Ctl>
      <Caution title="Smoke & fumes">If the source is forward of the firewall, turn the airflow selector OFF.</Caution>
      <H3>How air is routed</H3>
      <Notes items={["Panel and armrest eyeball outlets are always fed; each occupant twists the nozzle to shut it off.", "Floor butterfly opens for Panel-Foot; the windshield butterfly adds defrost for Panel-Foot-Windshield; Windshield alone closes the floor valve for maximum defog.", "A/C (optional): R134a, engine-driven compressor, evaporator under the front passenger seat. Engine must be running; the snowflake closes the hot-air valve.", "A/C and recirculation are unavailable with the fan at 0; recirculation needs the A/C running.", "The G6 control panel knob reads OFF – 0 – 1 – 2 – 3: OFF shuts cabin airflow, 0 is ram air only, 1–3 add blower speed (Costanzo deck photo)."]} />
      <Facts rows={[["Control panel", "2 A CABIN AIR CONTROL, MAIN BUS 1"], ["Blower (opt)", "15 A CABIN FAN, A/C BUS 2"], ["A/C condenser", "15 A A/C COND, A/C BUS 1"], ["A/C compressor", "5 A A/C COMPR, A/C BUS 2"]]} />
    </>
  );
}

export function Pitot() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  const stalled = s.stall.aoa >= 14;
  return (
    <>
      <p className="lead">One heated pitot under the left wing and two fuselage static ports feed the air-data computers and standby. A separate pneumatic stall warner on the right wing leading edge sounds the horn about 5 knots before the stall.</p>
      <H3>Pitot heat</H3>
      <Ctl>
        <Check id="pheat" label="PITOT HEAT switch on" checked={s.pitot.heat} onChange={(v) => up((d) => { d.pitot.heat = v; })} />
        <Slider id="oat" label="Outside air temperature" min={-20} max={30} step={1} value={s.pitot.oat} onChange={(v) => up((d) => { d.pitot.oat = v; })} fmt={(v) => `${v} °C / ${Math.round((v * 9) / 5 + 32)} °F`} />
        <Check id="hfail" label="Heater element open (no current)" checked={s.pitot.heaterFail} onChange={(v) => up((d) => { d.pitot.heaterFail = v; })} />
        <Check id="altstat" label="Alternate static source selected" checked={s.pitot.alt} onChange={(v) => up((d) => { d.pitot.alt = v; })} />
      </Ctl>
      <H3>Stall warning</H3>
      <Ctl>
        <Slider id="aoa" label="Angle of attack (illustrative)" min={0} max={18} step={0.1} value={s.stall.aoa} onChange={(v) => up((d) => { d.stall.aoa = v; })} fmt={(v) => v.toFixed(1) + "°"} />
        <Check id="sfault" label="Inlet iced / contaminated (fault)" checked={s.stall.fault} onChange={(v) => up((d) => { d.stall.fault = v; })} />
        <Readouts items={[
          ["Horn", s.stall.fault ? ["MUTED", "warnc"] : stalled && E.stallPwr ? ["SOUNDING", "bad"] : "Quiet"],
          ["Autopilot", stalled && !s.stall.fault ? ["DISCONNECT", "bad"] : "—"],
          ["Static source", s.pitot.alt ? ["CABIN", "warnc"] : "Ports"],
        ]} />
      </Ctl>
      <H3>Annunciations</H3>
      <Facts rows={[["PITOT HEAT FAIL", "Switch on, heater drawing no current"], ["PITOT HEAT REQD", "OAT < 41 °F (5 °C) with switch off"], ["STALL (red)", "Horn + autopilot disconnect"], ["STALL WARN FAIL", "Fault detected; horn muted until clear"]]} />
      <H3>Details</H3>
      <Facts rows={[["Pitot heat", "7.5 A, NON ESS BUS"], ["Stall warning", "2 A, ESS BUS 2"], ["Horn margin", "~5 kt above stall, full flaps, idle, wings level"], ["OAT probes", "Two, under the left wing"], ["Water traps", "At each line low point; drain at annual"]]} />
      <Small>Section 7 puts the stall-warning inlet on the <b>right</b> wing leading edge (modeled here). The Costanzo training deck photographs it on the left wing — check the airplane you fly.</Small>
      <Caution title="Alternate static">Cabin pressure varies with heater and vents. Apply the Section 5 airspeed and altitude corrections. The standby altimeter has no automatic position-error correction, so it will differ from the PFD.</Caution>
    </>
  );
}
