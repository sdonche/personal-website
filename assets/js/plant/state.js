import { Plant } from "./ns.js?v=c600f295ec";


Plant.defaultState = function defaultState() {
  return {
    packScenario: /** @type {null|"jam"|"starved"} */ (null),
    mixScenario: /** @type {null|"overtemp"|"valve"} */ (null),
    temperScenario: /** @type {null|"warm"|"drive"} */ (null),
    refineScenario: /** @type {null|"pressure"|"particle"} */ (null),
    concheScenario: /** @type {null|"overtemp"|"agitator"} */ (null),
    mouldScenario: /** @type {null|"jam"|"cool"} */ (null),
    rejectCount: 12,
    underCount: 3,
    overCount: 1,
    palletsDone: 47,
    speedSp: 38,
    selectedTag: "OEE",
    activeDrawing: /** @type {"overview"|"packaging"|"mixing"|"refining"|"conching"|"tempering"|"moulding"} */ ("packaging"),
    alarms: /** @type {Alarm[]} */ ([]),
    alarmHistory: /** @type {AlarmHistoryEntry[]} */ ([]),
    alarmFilter: /** @type {"all"|"critical"|"warning"|"low"} */ ("all"),
    alarmPane: /** @type {"active"|"shelved"|"history"|"events"} */ ("active"),
    shelved: /** @type {Record<string, number>} alarm id → plant tick it unshelves */ ({}),
    tick: 0, // plant minutes since the shift started; persists so plant time carries on
    units: Plant.defaultUnits(0), // ISA-88 / PackML state per area (units.js)
    sp: /** @type {Record<string, number>} operator-written setpoints (Plant.SP_WRITE) */ ({}),
    spPhase: /** @type {Record<string, string>} recipe phase a phase-bound SP override belongs to */ ({}),
    sensorFail: /** @type {Record<string, number>} failed transmitter tag → frozen value */ ({}),
    oee: Plant.defaultOee(0, 12), // shift OEE accumulators (oee.js)
    events: /** @type {{tick: number, kind: string, area: string, text: string}[]} operator journal, newest first */ ([]),
    openNodes: Plant.DEFAULT_OPEN.slice(),
  };
}

Plant.loadState = function loadState() {
  try {
    const raw = localStorage.getItem(Plant.STORAGE_KEY);
    if (!raw) return Plant.defaultState();
    const parsed = JSON.parse(raw);
    const base = Plant.defaultState();
    const speedSp = Number(parsed.speedSp);
    const alarmFilter = ["critical", "warning", "low"].includes(parsed.alarmFilter)
      ? parsed.alarmFilter
      : "all";
    const alarmPane = ["shelved", "history", "events"].includes(parsed.alarmPane) ? parsed.alarmPane : "active";
    const tick = Number.isFinite(Number(parsed.tick)) && Number(parsed.tick) >= 0 ? Number(parsed.tick) : 0;
    const alarmHistory = Array.isArray(parsed.alarmHistory)
      ? parsed.alarmHistory.slice(0, 30).map((h) => ({
          id: String(h.id || ""),
          path: String(h.path || ""),
          message: String(h.message || ""),
          severity: ["critical", "warning", "low"].includes(h.severity) ? h.severity : "warning",
          acked: !!h.acked,
          ts: Number(h.ts) || Date.now(),
          clearedTs: Number(h.clearedTs) || Date.now(),
          // Plant ticks: the trend draws alarm markers from these
          tick: Number.isFinite(h.tick) ? h.tick : undefined,
          rtnTick: Number.isFinite(h.rtnTick) ? h.rtnTick : undefined,
          clearedTick: Number.isFinite(h.clearedTick) ? h.clearedTick : undefined,
        }))
      : [];
    const out = {
      ...base,
      ...parsed,
      // Alarms saved before plant time existed have no tick: let them re-raise from live conditions
      alarms: Array.isArray(parsed.alarms) ? parsed.alarms.filter((x) => Number.isFinite(x?.tick)) : [],
      alarmHistory,
      alarmFilter,
      alarmPane,
      tick,
      shelved: parsed.shelved && typeof parsed.shelved === "object" ? parsed.shelved : {},
      speedSp: Number.isFinite(speedSp) && speedSp >= 20 && speedSp <= 60 ? speedSp : 38,
      openNodes: Array.isArray(parsed.openNodes) ? parsed.openNodes : base.openNodes,
      selectedTag: Plant.TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag,
      activeDrawing: Plant.ALL_DRAWING_IDS.includes(parsed.activeDrawing)
        ? parsed.activeDrawing
        : Plant.drawingForTag(Plant.TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag) || "packaging",
      // packScenario was "scenario" before; accept states saved by older versions
      packScenario: [parsed.packScenario, parsed.scenario].find((v) => v === "jam" || v === "starved") ?? null,
      scenario: undefined,
      cartonerJamCleared: undefined,
      mixScenario: parsed.mixScenario === "overtemp" || parsed.mixScenario === "valve"
        ? parsed.mixScenario
        : null,
      temperScenario: parsed.temperScenario === "warm" || parsed.temperScenario === "drive"
        ? parsed.temperScenario
        : parsed.temperScenario === "belt" ? "drive" : null, // legacy id
      refineScenario: parsed.refineScenario === "pressure" || parsed.refineScenario === "particle"
        ? parsed.refineScenario
        : null,
      concheScenario: parsed.concheScenario === "overtemp" || parsed.concheScenario === "agitator"
        ? parsed.concheScenario
        : null,
      mouldScenario: parsed.mouldScenario === "jam" || parsed.mouldScenario === "cool"
        ? parsed.mouldScenario
        : null,
    };
    out.units = Plant.loadUnits(parsed.units, out);
    const known = new Set(Object.values(Plant.SENSOR_FAIL).map((x) => x.tag));
    out.sensorFail = Object.fromEntries(Object.entries(parsed.sensorFail && typeof parsed.sensorFail === "object" ? parsed.sensorFail : {})
      .filter(([tag, v]) => known.has(tag) && Number.isFinite(v)));
    const o = parsed.oee;
    out.oee = o && Number.isFinite(o.planned) && Number.isFinite(o.run) && Number.isFinite(o.count) && Number.isFinite(o.good)
      && Number.isFinite(o.shift) && o.down && typeof o.down === "object"
      ? { shift: o.shift, planned: o.planned, run: o.run, count: o.count, good: o.good, lastReject: Number(o.lastReject) || 0, down: o.down }
      : Plant.defaultOee(out.tick, out.rejectCount);
    // Setpoints: only known writable tags, inside their write range
    out.sp = {};
    for (const [tag, v] of Object.entries(parsed.sp && typeof parsed.sp === "object" ? parsed.sp : {})) {
      const w = Plant.SP_WRITE[tag];
      if (w && tag !== "SpeedSP" && Number.isFinite(v) && v >= w.min && v <= w.max) out.sp[tag] = v;
    }
    out.spPhase = parsed.spPhase && typeof parsed.spPhase === "object" ? parsed.spPhase : {};
    out.events = Array.isArray(parsed.events)
      ? parsed.events.slice(0, Plant.EVENT_MAX).filter((e) => e && Number.isFinite(e.tick)).map((e) => ({
          tick: e.tick, kind: String(e.kind || "op"), area: String(e.area || ""), text: String(e.text || ""),
        }))
      : [];
    return out;
  } catch (e) {
    return Plant.defaultState();
  }
}

Plant.saveState = function saveState() {
  // The guided tour runs on a scratch plant: never let it overwrite the visitor's
  if (Plant.tour?.active) return;
  try {
    localStorage.setItem(Plant.STORAGE_KEY, JSON.stringify(Plant.state));
  } catch (e) { /* ignore */ }
}
Plant.state = null;

/** @type {Record<string, { value: any, quality: Quality }>} */
Plant.live = {};

/** @type {Record<string, number[]>} — ring buffers for numeric faceplate sparklines */
Plant.trends = {};

Plant.tick = 0;
Plant.timer = null;
Plant.treeBuilt = false;
Plant.pidBuilt = false;
Plant.pidHover = null; // { tagId?, equip? }
Plant.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
