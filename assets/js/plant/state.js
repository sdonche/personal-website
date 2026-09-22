import { Plant } from "./ns.js?v=c600f295ec";


Plant.defaultState = function defaultState() {
  return {
    scenario: /** @type {null|"jam"|"starved"} */ (null),
    mixScenario: /** @type {null|"overtemp"|"valve"} */ (null),
    temperScenario: /** @type {null|"warm"|"belt"} */ (null),
    refineScenario: /** @type {null|"pressure"|"particle"} */ (null),
    concheScenario: /** @type {null|"overtemp"|"agitator"} */ (null),
    mouldScenario: /** @type {null|"jam"|"cool"} */ (null),
    cartonerJamCleared: false,
    rejectCount: 12,
    underCount: 3,
    overCount: 1,
    palletsDone: 47,
    speedSp: 120,
    selectedTag: "OEE",
    activeDrawing: /** @type {"overview"|"packaging"|"mixing"|"refining"|"conching"|"tempering"|"moulding"} */ ("packaging"),
    alarms: /** @type {Alarm[]} */ ([]),
    alarmHistory: /** @type {AlarmHistoryEntry[]} */ ([]),
    alarmFilter: /** @type {"all"|"critical"|"warning"} */ ("all"),
    alarmPane: /** @type {"active"|"history"} */ ("active"),
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
    const alarmFilter = parsed.alarmFilter === "critical" || parsed.alarmFilter === "warning"
      ? parsed.alarmFilter
      : "all";
    const alarmPane = parsed.alarmPane === "history" ? "history" : "active";
    const alarmHistory = Array.isArray(parsed.alarmHistory)
      ? parsed.alarmHistory.slice(0, 30).map((h) => ({
          id: String(h.id || ""),
          path: String(h.path || ""),
          message: String(h.message || ""),
          severity: h.severity === "critical" ? "critical" : "warning",
          acked: !!h.acked,
          ts: Number(h.ts) || Date.now(),
          clearedTs: Number(h.clearedTs) || Date.now(),
        }))
      : [];
    return {
      ...base,
      ...parsed,
      alarms: Array.isArray(parsed.alarms) ? parsed.alarms : [],
      alarmHistory,
      alarmFilter,
      alarmPane,
      speedSp: Number.isFinite(speedSp) && speedSp > 0 ? speedSp : 120,
      openNodes: Array.isArray(parsed.openNodes) ? parsed.openNodes : base.openNodes,
      selectedTag: Plant.TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag,
      activeDrawing: Plant.ALL_DRAWING_IDS.includes(parsed.activeDrawing)
        ? parsed.activeDrawing
        : Plant.drawingForTag(Plant.TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag) || "packaging",
      scenario: parsed.scenario === "jam" || parsed.scenario === "starved" ? parsed.scenario : null,
      mixScenario: parsed.mixScenario === "overtemp" || parsed.mixScenario === "valve"
        ? parsed.mixScenario
        : null,
      temperScenario: parsed.temperScenario === "warm" || parsed.temperScenario === "belt"
        ? parsed.temperScenario
        : null,
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
  } catch (e) {
    return Plant.defaultState();
  }
}

Plant.saveState = function saveState() {
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
