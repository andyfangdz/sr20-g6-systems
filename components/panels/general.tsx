"use client";
import { cabinLit, extLit } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { SYS, sysColor } from "@/lib/systems";
import { Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Seg, Small } from "../ui/controls";

export function Overview() {
  const select = useSim((x) => x.select);
  const theme = useSim((x) => x.theme);
  return (
    <>
      <p className="lead">A study model of POH Section 7 for the SR20 with Perspective+ avionics (G6). Pick a system to fly the camera to it, hover parts for their notes, and operate switches, levers and failures in the panel. Systems are linked: pull an alternator and watch buses, displays and the CAS window respond.</p>
      <H3>At a glance</H3>
      <Facts rows={[["Engine", "IO-390-C3B6 · 215 hp @ 2,700"], ["Propeller", "3-blade, 74 in., constant speed"], ["Fuel", "56 gal usable · 28 per wing"], ["Electrical", "28 V · ALT 100 A + 70 A · 2 batteries"], ["Flaps", "0 / 50% (16°) / 100% (32°)"], ["Avionics", "Garmin Perspective+, GFC 700 AP"], ["CAPS", "2,400 ft² canopy, rocket deployed"]]} />
      <H3>Systems</H3>
      <div className="overview-grid">
        {SYS.slice(1).map((s) => (
          <button key={s.id} type="button" style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => select(s.id)}>
            <b>{s.name}</b><span>{s.blurb}</span>
          </button>
        ))}
      </div>
      <p className="disc">Unofficial study aid built from POH P/N 11934-005 (Reissue A), Section 7, with a few Section 2 limits, plus photos and notes from the Costanzo Air Flight School “Cirrus SR20 Systems” deck (where the two differ, the POH wins and the page says so). Geometry is approximate and not to scale in detail. CAS message text is illustrative except where Section 7 names it (PITOT HEAT FAIL/REQD, STALL, STALL WARN FAIL). Always use the POH/AFM and supplements for your serial number.</p>
    </>
  );
}

export function Airframe() {
  return (
    <>
      <p className="lead">A composite monocoque fuselage with a built-in roll cage carries all flight loads through four wing attach points. One carbon spar runs uninterrupted from tip to tip beneath the front seats.</p>
      <Facts rows={[["Cabin", "FS 100 firewall → FS 222 bulkhead"], ["Seats", "Pilot + up to 4 passengers"], ["Wing attach", "4 points: 2 under front seats, 2 at sidewall aft of rear seats"], ["Main spar", "Carbon/epoxy C-section, tip to tip"], ["Each wing", "29.3 gal integral tank + main gear"], ["Firewall", "20° lower bevel for crashworthiness"], ["Elevator / rudder", "Aluminum"], ["Stabilizer / fin", "Composite; fin integral with shell"]]} />
      <H3>Structure — tap to locate</H3>
      <PartsList sys="airframe" />
      <H3>Notes</H3>
      <Notes items={["Wing skins bond to the spar, ribs and aft shear web to form a torsion box carrying all bending and torsion.", "The rear shear webs attach to the fuselage but, unlike the spar, don't carry through it.", "The avionics bay sits aft of FS 222, reached through an access panel on the right side of the tailcone."]} />
    </>
  );
}

export function Cabin() {
  return (
    <>
      <p className="lead">Seats, restraints and the emergency equipment you should be able to find with your eyes closed. Tap any item to locate it on the model.</p>
      <PartsList sys="cabin" />
      <H3>Restraints</H3>
      <Notes items={["Front: 4-point harness with an inflatable shoulder belt. A crash sensor under the floor fires the inflator; the bag deflates for egress. No slack between shoulder and strap.", "Rear: 3-point harness on inertia reels at the rear bulkhead. LATCH anchors in the outboard rear seats (2+1 bench).", "Seat bottoms have a honeycomb core that crushes to absorb vertical loads — don't kneel or stand on them."]} />
      <H3>ELT</H3>
      <Facts rows={[["Unit", "Artex ELT 1000, 406 MHz"], ["Auto trigger", "4–5 ft/s Δv or CAPS deploy"], ["121.5 MHz", "Sweeps until battery exhausted"], ["406 MHz", "Burst every 50 s for 24 h, with GPS"], ["Panel switch", "ON · ARM/OFF · TEST"], ["Battery", "2 × D-cell lithium"]]} />
      <H3>Other</H3>
      <Facts rows={[["Extinguisher", "Halon 1211, class B/C, ~2.5 lb"], ["Egress hammer", "8 oz ball-peen, in armrest"], ["HOBBS", "BAT 1 + either ALT on"], ["FLIGHT meter", "Starts ~35 KIAS"], ["12 V outlet", "3.5 A max"], ["USB", "4 charging ports, 5 V 2.1 A"]]} />
      <Caution title="Warning">Halon can be toxic in a closed cabin — ventilate (vents open, door unlatched) after discharging.</Caution>
    </>
  );
}

export function Lighting() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  const lit = cabinLit(s, E), x = extLit(s, E), L = s.lights;
  const on = (b: boolean) => (b ? "ON" : "off");
  // switch on but nothing lit means a pulled breaker or a dead bus
  const ext = (sw: boolean, b: boolean): [string, "" | "bad"] | string => (b ? "ON" : sw ? ["NO PWR", "bad"] : "off");
  const flip = (k: "nav" | "strobe" | "land" | "ice") => up((d) => { d.lights[k] = !d.lights[k]; });
  return (
    <>
      <p className="lead">Exterior lighting is all LED: each wingtip carries a position light, a strobe, a white aft position light and a leading-edge landing light, so there is no tail light and no cowl landing light. Ice inspection lights shine on the wing leading edges. Inside, convenience lighting (dome, baggage, footwell, entry-step) runs straight from BAT 1 through the CONV bus.</p>
      <H3>Exterior light switches</H3>
      <Ctl>
        <div className="switches">
          <Rocker label="NAV" on={L.nav} onToggle={() => flip("nav")} />
          <Rocker label="STROBE" on={L.strobe} onToggle={() => flip("strobe")} />
          <Rocker label="LAND" on={L.land} onToggle={() => flip("land")} />
          <Rocker label="ICE" on={L.ice} onToggle={() => flip("ice")} />
        </div>
        <Readouts items={[["Nav + aft position", ext(L.nav, x.nav)], ["Strobes", ext(L.strobe, x.strobe)], ["Wingtip landing", ext(L.land, x.land)], ["Ice inspection", ext(L.ice, x.ice)]]} />
      </Ctl>
      <Small>Exterior glows show in the Overview and Lighting views. Pull a breaker on the NON ESS BUS, or lose Main Dist Bus 2, to see a light drop out.</Small>
      <H3>Lights — tap to locate</H3>
      <PartsList sys="lighting" />
      <H3>Cabin light switch</H3>
      <Ctl>
        <Seg id="cabsw" label="Ceiling switch" options={[["OFF", "OFF"], ["ON", "ON"], ["AUTO", "AUTO"]]} value={L.cabin} onChange={(v) => up((d) => { d.lights.cabin = v; })} />
        <Check id="door" label="A cabin door is open" checked={L.door} onChange={(v) => up((d) => { d.lights.door = v; })} />
        <Check id="fob" label="Unlocked with key fob" checked={L.unlocked} onChange={(v) => up((d) => { d.lights.unlocked = v; })} />
        <Check id="bagdoor" label="Baggage door open" checked={L.bag} onChange={(v) => up((d) => { d.lights.bag = v; })} />
        <Readouts items={[["Dome", on(lit.dome)], ["Footwell", on(lit.foot)], ["Entry steps", on(lit.step)], ["Baggage", on(lit.bag)]]} />
      </Ctl>
      <Small>The key fob won&apos;t work the door locks while BAT 1 is on. With aircraft power off, convenience lights time out after a few minutes.</Small>
      <H3>Instrument dimmer</H3>
      <Notes items={["Full counter-clockwise is OFF = daytime mode: keypads, bolster and standby unlit; PFD/MFD brightness on photocell (full bright).", "Turning it on dims the displays to night levels and lights the keys, switches and standby bezels.", "PANEL knob controls red LED floods under the glareshield and dims the front reading lights."]} />
      <H3>Notes</H3>
      <Notes items={["There is no tail light: the rearward white position light is built into each wingtip trailing edge and comes on with NAV.", "LAND lights both wingtip landing lights together. There is no landing light in the cowl.", "Ice inspection lights are for checking the leading edges at night. Many pilots use them only for quick checks because they cost night vision."]} />
      <H3>Power</H3>
      <Facts rows={[["Instrument/panel/reading/dome", "5 A CABIN LIGHTS, MAIN BUS 1"], ["Convenience lights", "5 A CONV LIGHTS, CONV bus"], ["Nav / strobe", "NON ESS BUS"], ["Landing / ice inspection", "NON ESS BUS (model; check your breaker panel)"], ["Exterior detail", "Spectra wing tip light supplement"]]} />
    </>
  );
}

export function Avionics() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  return (
    <>
      <p className="lead">Garmin Perspective+: two 10 in. displays (12 in. optional), dual integrated avionics units, ADAHRS and an engine/airframe unit. The displays in the model are live — they go dark if their buses die and revert automatically.</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="dbackup" label="Press DISPLAY BACKUP" checked={s.avx.backup} onChange={(v) => up((d) => { d.avx.backup = v; })} />
        <Check id="pfdfail" label="PFD fails (auto reversion)" checked={s.avx.pfdFail} onChange={(v) => up((d) => { d.avx.pfdFail = v; })} />
        <Readouts items={[["PFD", E.pfd ? (s.avx.backup ? "Backup" : "ON") : ["OFF", "bad"]], ["MFD", E.mfd ? "ON" : ["OFF", "bad"]], ["Standby", E.stby ? "ON" : ["OFF", "bad"]], ["Avionics bus", E.avx > 0 ? "ON" : ["OFF", "warnc"]]]} />
      </Ctl>
      <H3>Dual power paths</H3>
      <Facts rows={[["PFD", "PFD A ESS 1 · PFD B MAIN 2"], ["MFD", "MFD A MAIN 3 · MFD B MAIN 1"], ["Standby MD302", "ESS 1 + MAIN 1 via diodes"], ["ADAHRS 1 / 2", "ESS 1 / MAIN 2"], ["GIA 1", "COM 1 + GPS NAV, ESS 1"], ["GIA 2", "COM 2 + GPS NAV, MAIN 2"], ["GEA 71", "3 A ENGINE INSTR, ESS 2"], ["Audio · XPDR", "AVIONICS bus"]]} />
      <H3>CAS colors</H3>
      <Facts rows={[["Red warning", "Immediate awareness and action"], ["Amber caution", "Immediate awareness, later action"], ["White advisory", "Awareness; action may follow"]]} />
      <H3>Notes</H3>
      <Notes items={["Typical alignment is 60 seconds after battery on.", "On a detected display failure the remaining screen shows PFD data plus engine indication with no pilot action. The red DISPLAY BACKUP button forces it.", "Baro-VNAV provides LNAV/VNAV guidance without SBAS (magenta pentagon). No SBAS→baro downgrade inside 60 s of the FAF.", "Three fans cool the stack: AVIONICS FAN 1 (NON ESS) and FAN 2 (MAIN 2)."]} />
      <PartsList sys="avionics" />
    </>
  );
}
