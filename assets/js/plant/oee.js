import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- OEE (Line 3) ----------------
   Shift OEE = Availability × Performance × Quality, accumulated per plant
   minute: A = run time / planned time, P = cartons / (run time × nameplate
   rate), Q = good cartons / cartons. Every minute Line 3 isn't producing is
   booked against a downtime reason, for the Pareto on the OEE faceplate. */

Plant.IDEAL_CPM = 40; // cartoner nameplate, cartons per minute
Plant.SHIFT_TICKS = 480; // 8 h shifts from 06:00
Plant.SHIFT_NAMES = ["Early", "Late", "Night"];

/** Operator-facing names for the simulated faults (downtime reasons). */
Plant.FAULT_LABEL = {
  packaging: { jam: "Cartoner jam", starved: "Infeed starved" },
  mixing: { overtemp: "Mixer overtemp", valve: "Liquor valve stuck" },
  refining: { pressure: "Refiner pressure loss", particle: "Fineness out of spec" },
  conching: { overtemp: "Conche overtemp", agitator: "Conche agitator trip" },
  tempering: { warm: "Temper zones warm", drive: "Temper drive fault" },
  moulding: { jam: "Moulder jam", cool: "Cooling air warm" },
};

Plant.shiftIndex = function shiftIndex(tick) {
  return Math.floor((tick ?? Plant.tick) / Plant.SHIFT_TICKS);
};

Plant.shiftName = function shiftName(idx) {
  return Plant.SHIFT_NAMES[((idx % 3) + 3) % 3];
};

Plant.defaultOee = function defaultOee(tick, rejects) {
  return { shift: Plant.shiftIndex(tick), planned: 0, run: 0, count: 0, good: 0, lastReject: rejects ?? 0, down: {} };
};

/** Why a unit is not running: the fault that latched it, else the operator's command. */
Plant.unitWhy = function unitWhy(area) {
  const u = Plant.UNIT_BY_AREA[area];
  const rec = Plant.unit(area);
  if (rec.why) return rec.why;
  const word = { HELD: "held", HOLDING: "held", STOPPED: "stopped", STOPPING: "stopped", IDLE: "idle", RESETTING: "idle",
    STARTING: "starting", RESTARTING: "starting", UNHOLDING: "starting", ABORTED: "aborted", ABORTING: "aborted" }[rec.st] || "down";
  return `${u.area} ${word}`;
};

/** Downtime reason for the minute just gone, or null while Line 3 produced. */
Plant.downtimeReason = function downtimeReason() {
  if (Plant.unitProducing("Packaging")) return null;
  if (!Plant.unitRunning("Packaging")) return Plant.unitWhy("Packaging");
  const up = Plant.UNITS.find((u) => u.area !== "Packaging" && !Plant.unitRunning(u.area));
  if (up) return Plant.unitWhy(up.area);
  return Plant.FAULT_LABEL.packaging.starved;
};

/** Book the plant minute that just elapsed (called once per tick, before the recompute). */
Plant.accountOee = function accountOee() {
  const S = Plant.state;
  const shift = Plant.shiftIndex(Plant.tick);
  if (!S.oee || S.oee.shift !== shift) {
    if (S.oee) Plant.logEvent({ kind: "sys", text: `Shift change — ${Plant.shiftName(shift)} shift, OEE counters reset` });
    S.oee = Plant.defaultOee(Plant.tick, S.rejectCount);
    return;
  }
  const o = S.oee;
  o.planned += 1;
  const reason = Plant.downtimeReason();
  const rejects = Math.max(0, S.rejectCount - o.lastReject);
  o.lastReject = S.rejectCount;
  if (reason) {
    // Starved minutes trickle a few cartons through, but they are lost time, not run time
    o.down[reason] = (o.down[reason] || 0) + 1;
    return;
  }
  o.run += 1;
  const cartons = Number(Plant.live["Cartoner/CartonsPerMin"]?.value) || 0;
  o.count += cartons;
  o.good += Math.max(0, cartons - rejects);
};

/** A, P, Q and OEE as fractions; before the first minute, the line's current rate. */
Plant.oeeFactors = function oeeFactors(cartonsNow) {
  const o = Plant.state.oee || Plant.defaultOee(Plant.tick, 0);
  const producing = Plant.unitProducing("Packaging");
  const A = o.planned ? o.run / o.planned : producing ? 1 : 0;
  const P = o.run ? Math.min(1, o.count / (o.run * Plant.IDEAL_CPM)) : Math.min(1, (cartonsNow || 0) / Plant.IDEAL_CPM);
  const Q = o.count ? o.good / o.count : 1;
  return { A, P, Q, oee: A * P * Q };
};

/** Downtime Pareto for the OEE faceplate. */
Plant.paretoHtml = function paretoHtml() {
  const esc = Plant.escapeHtml;
  const o = Plant.state.oee || Plant.defaultOee(Plant.tick, 0);
  const f = Plant.oeeFactors(Plant.live["Cartoner/CartonsPerMin"]?.value);
  const pct = (x) => `${(x * 100).toFixed(1)} %`;
  const shiftStart = Plant.shiftIndex(Plant.tick) * Plant.SHIFT_TICKS;
  const rows = Object.entries(o.down).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, m]) => s + m, 0);
  const max = rows.length ? rows[0][1] : 1;
  let cum = 0;
  const bars = rows.map(([why, min]) => {
    cum += min;
    return `<li>
        <span class="plant-pareto__why">${esc(why)}</span>
        <span class="plant-pareto__bar"><i style="width:${((min / max) * 100).toFixed(1)}%"></i></span>
        <span class="plant-pareto__min">${min} min</span>
        <span class="plant-pareto__cum">${Math.round((cum / total) * 100)} %</span>
      </li>`;
  }).join("");
  return `<p class="plant-pareto__apq">
      <span title="Availability: run time / planned time">A <strong>${pct(f.A)}</strong></span> ×
      <span title="Performance: cartons / (run time × ${Plant.IDEAL_CPM} cpm nameplate)">P <strong>${pct(f.P)}</strong></span> ×
      <span title="Quality: good cartons / cartons">Q <strong>${pct(f.Q)}</strong></span> =
      <span>OEE <strong>${pct(f.oee)}</strong></span>
    </p>
    <p class="plant-pareto__shift">${esc(Plant.shiftName(o.shift))} shift from ${Plant.plantTime(shiftStart)} · ${o.planned} min planned · ${o.run} run · ${total} down · ${Math.round(o.count)} cartons</p>
    ${rows.length
      ? `<p class="plant-pareto__head">Downtime reasons</p><ol class="plant-pareto">${bars}</ol>`
      : `<p class="plant-pareto__shift">No downtime booked this shift</p>`}`;
};
