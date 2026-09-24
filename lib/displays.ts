/** Canvas drawing for the live PFD, MFD and MD302 standby textures. */
import { D2R } from "./math";
import { casMessages, live, mapInHg, type Elec, type Sim } from "./sim/model";

type Ctx = CanvasRenderingContext2D;

export function drawPFD(ctx: Ctx, W: number, H: number, s: Sim, E: Elec) {
  const roll = -s.ctrl.roll * 25 * D2R, pitch = s.ctrl.pitch * 10;
  ctx.save();
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.rotate(roll); ctx.translate(0, pitch * 6);
  ctx.fillStyle = "#2F6FC8"; ctx.fillRect(-W, -H * 2, W * 2, H * 2);
  ctx.fillStyle = "#7A4A22"; ctx.fillRect(-W, 0, W * 2, H * 2);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(W, 0); ctx.stroke();
  for (let p = -20; p <= 20; p += 5) { if (!p) continue; const w = p % 10 ? 20 : 40; ctx.beginPath(); ctx.moveTo(-w, -p * 6); ctx.lineTo(w, -p * 6); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = "#FFD200"; ctx.fillRect(W / 2 - 60, H * 0.42 - 3, 40, 6); ctx.fillRect(W / 2 + 20, H * 0.42 - 3, 40, 6); ctx.fillRect(W / 2 - 4, H * 0.42 - 4, 8, 8);
  // tapes
  ctx.fillStyle = "rgba(20,24,28,.75)"; ctx.fillRect(40, 60, 78, 230); ctx.fillRect(W - 150, 60, 86, 230);
  ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillStyle = "#000"; ctx.fillRect(44, 160, 70, 30); ctx.fillRect(W - 146, 160, 78, 30);
  ctx.fillStyle = "#fff"; ctx.fillText(live.capsT >= 0 ? "—" : "124", 79, 183); ctx.fillText("4500", W - 107, 183);
  ctx.font = "13px monospace"; ctx.fillStyle = "#bbb"; ctx.fillText("TAS 131KT", 79, 305); ctx.fillStyle = "#0ff"; ctx.fillText("29.92IN", W - 107, 305);
  // HSI
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H + 30, 105, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillText("360", W / 2, H - 60);
  ctx.strokeStyle = "#E040C0"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, H - 50); ctx.lineTo(W / 2, H - 110); ctx.stroke();
  // CAS box
  const m = casMessages(s, E).slice(0, 5);
  ctx.fillStyle = "#000"; ctx.fillRect(W - 62, 60, 58, m.length * 20 + 6);
  ctx.font = "bold 10px monospace"; ctx.textAlign = "left";
  m.forEach(([c, t], i) => {
    const y = 64 + i * 20;
    if (c === "w") { ctx.fillStyle = "#E0263B"; ctx.fillRect(W - 60, y, 54, 16); ctx.fillStyle = "#fff"; }
    else if (c === "c") { ctx.fillStyle = "#E7B416"; ctx.fillRect(W - 60, y, 54, 16); ctx.fillStyle = "#000"; }
    else ctx.fillStyle = "#fff";
    ctx.fillText(t.slice(0, 8), W - 58, y + 12);
  });
  ctx.restore();
}

function drawStrip(ctx: Ctx, x: number, H: number, s: Sim, E: Elec) {
  ctx.fillStyle = "#0B0F12"; ctx.fillRect(x, 0, 120, H);
  ctx.textAlign = "left";
  const row = (l: string, v: string, y: number, col = "#fff") => {
    ctx.font = "11px monospace"; ctx.fillStyle = "#8FA3AF"; ctx.fillText(l, x + 8, y);
    ctx.font = "bold 17px monospace"; ctx.fillStyle = col; ctx.fillText(v, x + 8, y + 19);
  };
  const X = !E.eisPwr, red = "#E0263B";
  row("RPM", X ? "✕" : String(Math.round(live.rpm / 10) * 10), 24, X ? red : "#fff");
  row("MAP", X ? "✕" : mapInHg(s, live.rpm).toFixed(1), 68, X ? red : "#fff");
  row("FFLOW GPH", s.eng.running ? (3 + s.eng.lever * 13 * s.eng.mix).toFixed(1) : "0.0", 112);
  row("FUEL QTY L / R", `${Math.round(s.fuel.qL)} / ${Math.round(s.fuel.qR)}`, 156, s.fuel.qL < 8.2 || s.fuel.qR < 8.2 ? "#E7B416" : "#fff");
  row("M1 / M2 V", `${E.mdb1.toFixed(1)} ${E.mdb2.toFixed(1)}`, 200, E.mdb1 < 24.5 || E.mdb2 < 24.5 ? "#E7B416" : "#fff");
  row("ESS BUS V", E.ess1.toFixed(1), 244, E.ess1 < 24.5 ? red : "#fff");
  row("BAT 1 A", (E.b1 > 0 ? "+" : "") + E.b1, 288, E.b1 < 0 ? "#E7B416" : "#fff");
}

export function drawMFD(ctx: Ctx, W: number, H: number, s: Sim, E: Elec) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  if (s.avx.backup || s.avx.pfdFail) {
    ctx.save(); ctx.translate(120, 0); drawPFD(ctx, W - 120, H, s, E); ctx.restore();
    drawStrip(ctx, 0, H, s, E);
    return;
  }
  drawStrip(ctx, 0, H, s, E);
  ctx.fillStyle = "#10202A"; ctx.fillRect(120, 0, W - 120, H);
  ctx.strokeStyle = "#1E3A4A"; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(120 + i * 60, 0); ctx.lineTo(120 + i * 60, H); ctx.stroke(); }
  ctx.fillStyle = "#3B5A36"; ctx.beginPath(); ctx.ellipse(420, 260, 160, 90, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#E040C0"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(380, H); ctx.lineTo(420, 200); ctx.lineTo(560, 60); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(380, H - 40); ctx.lineTo(370, H - 20); ctx.lineTo(390, H - 20); ctx.fill();
  ctx.font = "bold 16px monospace"; ctx.fillText("MAP – NAVIGATION", 140, 26);
}

export function drawStandby(ctx: Ctx, W: number, H: number, s: Sim) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-s.ctrl.roll * 25 * D2R);
  ctx.fillStyle = "#2F6FC8"; ctx.fillRect(-W, -H, W * 2, H); ctx.fillStyle = "#7A4A22"; ctx.fillRect(-W, 0, W * 2, H);
  ctx.restore();
  ctx.fillStyle = "#FFD200"; ctx.fillRect(W / 2 - 40, H / 2 - 3, 80, 6);
  ctx.font = "bold 20px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
  ctx.fillText("124", 10, 30); ctx.fillText("4500", W - 58, 30);
}

export function drawOff(ctx: Ctx, W: number, H: number) {
  ctx.fillStyle = "#05070A"; ctx.fillRect(0, 0, W, H);
}
