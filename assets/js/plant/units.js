import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Unit state machines ----------------
   Process units follow the ISA-88 procedural state model, the machine lines
   (Moulding, Line 3) follow PackML (ISA-TR88.00.02). The operator commands
   each unit; a fault latches the unit (ABORTED or HELD) and it stays there
   after the condition clears until the operator brings it back. A unit whose
   upstream supply is down shows PAUSED (ISA-88) or SUSPENDED (PackML). */

Plant.UNITS = [
  { area: "Mixing", drawing: "mixing", model: "ISA-88", equip: "MX-100", field: "mixScenario", latch: { overtemp: "ABORTED", valve: "HELD" } },
  { area: "Refining", drawing: "refining", model: "ISA-88", equip: "RF-200", field: "refineScenario", latch: { pressure: "ABORTED", particle: "HELD" } },
  { area: "Conching", drawing: "conching", model: "ISA-88", equip: "CN-300", field: "concheScenario", latch: { overtemp: "ABORTED", agitator: "HELD" } },
  { area: "Tempering", drawing: "tempering", model: "ISA-88", equip: "TP-400", field: "temperScenario", latch: { warm: "ABORTED", drive: "HELD" } },
  { area: "Moulding", drawing: "moulding", model: "PackML", equip: "MD-500", field: "mouldScenario", latch: { jam: "HELD", cool: "HELD" } },
  // Starved is an upstream condition, not a machine fault: Line 3 suspends, it doesn't latch
  { area: "Packaging", drawing: "packaging", model: "PackML", equip: "Line 3", field: "packScenario", latch: { jam: "HELD" } },
];
Plant.UNIT_BY_AREA = Object.fromEntries(Plant.UNITS.map((u) => [u.area, u]));
Plant.UNIT_BY_DRAWING = Object.fromEntries(Plant.UNITS.map((u) => [u.drawing, u]));

/** Plant minutes a transitional state (HOLDING, STOPPING, …) takes to complete. */
Plant.UNIT_TRANSIENT_TICKS = 2;

/* Commands per model: from-states → acting state → final state.
   ISA-88 Start and Reset complete at once; PackML has STARTING / RESETTING. */
Plant.UNIT_COMMANDS = {
  "ISA-88": [
    { cmd: "start", label: "Start", from: ["IDLE"], to: "RUNNING" },
    { cmd: "hold", label: "Hold", from: ["RUNNING"], via: "HOLDING", to: "HELD" },
    { cmd: "restart", label: "Restart", from: ["HELD"], via: "RESTARTING", to: "RUNNING" },
    { cmd: "stop", label: "Stop", from: ["RUNNING", "HELD"], via: "STOPPING", to: "STOPPED" },
    { cmd: "reset", label: "Reset", from: ["STOPPED", "ABORTED"], to: "IDLE" },
  ],
  PackML: [
    { cmd: "start", label: "Start", from: ["IDLE"], via: "STARTING", to: "EXECUTE" },
    { cmd: "hold", label: "Hold", from: ["EXECUTE"], via: "HOLDING", to: "HELD" },
    { cmd: "unhold", label: "Unhold", from: ["HELD"], via: "UNHOLDING", to: "EXECUTE" },
    { cmd: "stop", label: "Stop", from: ["EXECUTE", "HELD", "IDLE"], via: "STOPPING", to: "STOPPED" },
    { cmd: "reset", label: "Reset", from: ["STOPPED"], via: "RESETTING", to: "IDLE" },
  ],
};

Plant.runStateOf = function runStateOf(unit) {
  return unit.model === "PackML" ? "EXECUTE" : "RUNNING";
};

/** Default unit record: producing, batch clock in step with plant time. */
Plant.defaultUnits = function defaultUnits(tick) {
  const out = {};
  for (const u of Plant.UNITS) out[u.area] = { st: Plant.runStateOf(u), next: null, until: 0, clock: tick || 0 };
  return out;
};

/** Validate saved unit records; states saved before units existed derive from the active faults. */
Plant.loadUnits = function loadUnits(saved, S) {
  const units = Plant.defaultUnits(S.tick);
  for (const u of Plant.UNITS) {
    const r = saved && saved[u.area];
    const known = Plant.UNIT_COMMANDS[u.model].flatMap((c) => [c.to, c.via, ...c.from]).concat(["ABORTING", "ABORTED"]);
    if (r && known.includes(r.st)) {
      units[u.area] = {
        st: r.st,
        next: known.includes(r.next) ? r.next : null,
        until: Number(r.until) || 0,
        clock: Number.isFinite(Number(r.clock)) ? Number(r.clock) : S.tick || 0,
      };
    } else {
      const latched = u.latch[S[u.field]];
      if (latched) units[u.area].st = latched;
    }
  }
  return units;
};

Plant.unit = function unit(area) {
  const S = Plant.state;
  if (!S.units) S.units = Plant.defaultUnits(Plant.tick);
  return S.units[area];
};

/** Commanded state is the run state (EXECUTE / RUNNING). */
Plant.unitRunning = function unitRunning(area) {
  return Plant.unit(area).st === Plant.runStateOf(Plant.UNIT_BY_AREA[area]);
};

/** No mass arriving: a unit upstream in the mass path is not running (or Line 3's own infeed is starved). */
Plant.unitStarved = function unitStarved(area) {
  const i = Plant.UNITS.findIndex((u) => u.area === area);
  if (Plant.UNITS.slice(0, i).some((u) => !Plant.unitRunning(u.area))) return true;
  return area === "Packaging" && Plant.state.packScenario === "starved";
};

Plant.unitProducing = function unitProducing(area) {
  return Plant.unitRunning(area) && !Plant.unitStarved(area);
};

/** State shown to the operator: the commanded state, or PAUSED / SUSPENDED when starved. */
Plant.unitState = function unitState(area) {
  const u = Plant.UNIT_BY_AREA[area];
  const st = Plant.unit(area).st;
  if (st === Plant.runStateOf(u) && Plant.unitStarved(area)) return u.model === "PackML" ? "SUSPENDED" : "PAUSED";
  return st;
};

/** KPI / chip tone for a state: green only while producing (hybrid palette). */
Plant.stateTone = function stateTone(st) {
  if (st === "RUNNING" || st === "EXECUTE") return "run";
  if (st === "ABORTED" || st === "ABORTING") return "bad";
  if (["HELD", "HOLDING", "PAUSED", "SUSPENDED"].includes(st)) return "warn";
  return "good"; // IDLE, STOPPED and acting states: neutral
};

/** The fault condition that still blocks a restart, if any. */
Plant.unitInterlock = function unitInterlock(area) {
  const u = Plant.UNIT_BY_AREA[area];
  const fault = Plant.state[u.field];
  return fault && u.latch[fault] ? fault : null;
};

/** Every command of the unit's model, with whether it is allowed right now. */
Plant.unitCommands = function unitCommands(area) {
  const u = Plant.UNIT_BY_AREA[area];
  const st = Plant.unit(area).st;
  const lock = Plant.unitInterlock(area);
  return Plant.UNIT_COMMANDS[u.model].map((c) => {
    let reason = "";
    if (!c.from.includes(st)) reason = `Not available in ${st}`;
    else if (lock && c.cmd !== "stop" && c.cmd !== "hold") reason = `Interlock: ${lock} condition still active`;
    return { ...c, enabled: !reason, reason };
  });
};

Plant.unitCommand = function unitCommand(area, cmd) {
  const c = Plant.unitCommands(area).find((x) => x.cmd === cmd);
  if (!c || !c.enabled) return false;
  const rec = Plant.unit(area);
  const from = rec.st;
  if (c.via) {
    rec.st = c.via;
    rec.next = c.to;
    rec.until = Plant.tick + Plant.UNIT_TRANSIENT_TICKS;
  } else {
    rec.st = c.to;
    rec.next = null;
  }
  // Reset starts a fresh batch: the unit's sequence begins again from its first phase
  if (cmd === "reset") rec.clock = 0;
  Plant.logEvent?.({ kind: "cmd", area, text: `${Plant.UNIT_BY_AREA[area].equip} ${c.label.toUpperCase()} — ${from} → ${c.via || c.to}` });
  Plant.afterUnitChange();
  return true;
};

/** A fault drives the unit to its latched state (via ABORTING / HOLDING). */
Plant.latchFault = function latchFault(area, fault) {
  const u = Plant.UNIT_BY_AREA[area];
  const target = u.latch[fault];
  if (!target) return;
  const rec = Plant.unit(area);
  const runSt = Plant.runStateOf(u);
  const acting = Plant.UNIT_COMMANDS[u.model].some((c) => c.via === rec.st);
  // HELD only interrupts a producing unit; ABORTED interrupts anything that isn't already aborted
  if (target === "HELD" && rec.st !== runSt && !acting) return;
  if (target === "ABORTED" && (rec.st === "ABORTED" || rec.st === "ABORTING")) return;
  rec.st = target === "ABORTED" ? "ABORTING" : "HOLDING";
  rec.next = target;
  rec.until = Plant.tick + 1;
};

/** Once per plant minute: finish acting states, advance the clocks of producing units. */
Plant.advanceUnits = function advanceUnits() {
  for (const u of Plant.UNITS) {
    const rec = Plant.unit(u.area);
    if (rec.next && Plant.tick >= rec.until) {
      rec.st = rec.next;
      rec.next = null;
    }
  }
  for (const u of Plant.UNITS) {
    if (Plant.unitProducing(u.area)) Plant.unit(u.area).clock += 1;
  }
};

Plant.afterUnitChange = function afterUnitChange() {
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
};
