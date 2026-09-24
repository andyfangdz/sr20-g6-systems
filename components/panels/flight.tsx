"use client";
import { live } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, useTicker } from "../ui/controls";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);

export function Controls() {
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  return (
    <>
      <p className="lead">Two single-handed side yokes drive conventional ailerons, elevator and rudder through push rods, cables and bellcranks. Pitch and roll trim move the neutral point of spring cartridges electrically; yaw trim is set on the ground.</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="ctlPitch" label="Yoke pitch (push ↔ pull)" min={-1} max={1} step={0.01} value={s.ctrl.pitch} onChange={(v) => up((d) => { d.ctrl.pitch = v; })} fmt={(v) => dir(v, "Nose up", "Nose down", "Neutral")} />
        <Slider id="ctlRoll" label="Yoke roll" min={-1} max={1} step={0.01} value={s.ctrl.roll} onChange={(v) => up((d) => { d.ctrl.roll = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="ctlYaw" label="Rudder pedals" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((d) => { d.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <BtnRow><button type="button" className="btn" onClick={() => up((d) => { d.ctrl = { pitch: 0, roll: 0, yaw: 0 }; })}>Center controls</button></BtnRow>
        <Readouts items={[["Pitch trim", E.pitchTrim ? "ESS 2 · ON" : ["NO PWR", "bad"]], ["Roll trim", E.rollTrim ? "ESS 2 · ON" : ["NO PWR", "bad"]], ["Yaw trim", "Ground adj."]]} />
      </Ctl>
      <H3>Surface details — tap to locate</H3>
      <PartsList sys="controls" />
      <H3>Details</H3>
      <Facts rows={[["Pitch", "Yoke slides in carriage → cable under floor → push-pull tube"], ["Roll", "Yoke rotates → push rods → sector → cable in each wing"], ["Yaw", "Pedals → single cable → push-pull tube"], ["Trim switch", "Conical button on each yoke"], ["Pitch / roll trim", "2 A each, ESS BUS 2"], ["Takeoff trim", "Mark on yoke tube aligns with bolster tab"], ["Trim tabs", "Ground-adjustable on elevator, right aileron, rudder"]]} />
      <H3>Pilot notes</H3>
      <Notes items={["Normal control force easily overrides full trim or autopilot inputs.", "Pitch and roll trim double as backup control if a primary cable fails — as long as the surface isn't jammed.", "There are no gust locks: the trim spring cartridges damp gusts without locking the surfaces."]} />
    </>
  );
}

export function Flaps() {
  useTicker(200);
  const s = useSim((x) => x.s), E = useSim((x) => x.E), up = useSim((x) => x.update);
  const at = Math.abs(live.flapAng - s.flaps.cmd * 0.32) < 0.3 && E.flapsPwr;
  return (
    <>
      <p className="lead">Electric single-slotted flaps are driven by one linear actuator through a torque tube, so both sides always move together. Proximity switches stop travel at each detent and light the matching position lamp.</p>
      <H3>FLAPS switch</H3>
      <Ctl>
        <Seg id="flapSel" label="Select" options={[[0, "UP 0%"], [50, "50% · VFE 150"], [100, "100% · VFE 110"]]} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v as 0 | 50 | 100; })} />
        <div className="lights3">
          {([[0, "UP", "g"], [50, "50%", "y"], [100, "100%", "y"]] as const).map(([v, t, k]) => (
            <span key={v}><i className={at && s.flaps.cmd === v ? k : ""} />{t}</span>
          ))}
        </div>
        <Readouts items={[["Position", live.flapAng.toFixed(1) + "°"], ["FLAPS 10 A", E.flapsPwr ? "NON ESS OK" : ["NO POWER", "bad"]]]} />
      </Ctl>
      {!E.flapsPwr && <Caution title="No power">The flaps have no power (NON ESS BUS dead or FLAPS breaker pulled) — they won&apos;t move. Fix it in Electrical.</Caution>}
      <H3>Details</H3>
      <Facts rows={[["Positions", "0% · 50% (16°) · 100% (32°)"], ["VFE 50%", "150 KIAS"], ["VFE 100%", "110 KIAS"], ["Hinges", "3 per flap, rub strips at cove"], ["Lights", "UP green · 50/100 amber"], ["Power", "10 A FLAPS, NON ESS BUS"]]} />
    </>
  );
}

export function Gear() {
  const s = useSim((x) => x.s), up = useSim((x) => x.update);
  return (
    <>
      <p className="lead">Fixed tricycle gear: composite main struts bolted to the wing, a steel nose strut with an oleo on the engine mount. The nose wheel free-casters — you steer on the ground with differential toe brakes.</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="gearDiff" label="Differential braking" min={-1} max={1} step={0.01} value={s.gear.diff} onChange={(v) => up((d) => { d.gear.diff = v; })} fmt={(v) => dir(v, "Right brake", "Left brake", "Even", 0.05)} />
        <Check id="parkBrake" label="PARK BRAKE handle pulled" checked={s.gear.park} onChange={(v) => up((d) => { d.gear.park = v; })} />
        <Readouts items={[["Nose caster", Math.round(s.gear.diff * 85) + "°"], ["Turning", dir(s.gear.diff, "Right", "Left", "Straight", 0.05)]]} />
      </Ctl>
      <Caution title="Caution">Don&apos;t set the parking brake in flight. Landing with it set holds whatever pressure you apply after touchdown.</Caution>
      <H3>Details</H3>
      <Facts rows={[["Main tires", "15 × 6.00 × 6 tubeless"], ["Nose tire", "5.00 × 5 tubeless"], ["Nose caster", "~170° arc (±85°)"], ["Brakes", "Single disc, hydraulic, per main wheel"], ["Fluid", "MIL-PRF-87257"], ["Brake temp", "Sensor on each brake → CAS; orange tab turns brown if overheated"]]} />
      <H3>Warning signs</H3>
      <Notes items={["Fading braking action, noisy or dragging brakes, soft/spongy pedals or excess travel mean maintenance now.", "If braking fades on the roll, release and reapply firmly; if spongy, pumping may rebuild pressure."]} />
    </>
  );
}
