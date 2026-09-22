/* =============================================================
   plant.js — Heuvelland chocolate plant HMI (/plant/)
   Edge sites: Heuvelland (LIVE) + Gullegem / Ieper / Gent / Brugge (OFFLINE).
   Process order: Mixing → Refining → Conching → Tempering → Moulding → Packaging.
   Cross-area BatchId + Mixing/Tempering faults starve Packaging feed.
   State persists in localStorage until "Reset line".
   ============================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "samdonche.plant.v10";
  const TICK_MS = 1000;
  const PROVIDER = "[edge]";
  const EDGE_ROOT = "[edge]";
  const SITE = "Heuvelland";
  const SISTER_SITES = ["Gullegem", "Ieper", "Gent", "Brugge"];
  const AREA = "Packaging";
  const MIXING_AREA = "Mixing";
  const REFINING_AREA = "Refining";
  const CONCHING_AREA = "Conching";
  const TEMPERING_AREA = "Tempering";
  const MOULDING_AREA = "Moulding";
  const LIVE_LINE = "Line3";
  const AREA_ROOT = `${SITE}/${AREA}`;
  const MIXING_ROOT = `${SITE}/${MIXING_AREA}`;
  const REFINING_ROOT = `${SITE}/${REFINING_AREA}`;
  const CONCHING_ROOT = `${SITE}/${CONCHING_AREA}`;
  const TEMPERING_ROOT = `${SITE}/${TEMPERING_AREA}`;
  const MOULDING_ROOT = `${SITE}/${MOULDING_AREA}`;

  /**
   * Plant areas in mass-flow order (chocolate bars).
   * Every area has a live P&ID drawing.
   */
  const PLANT_AREAS = [
    { id: "Mixing", drawing: "mixing", live: true },
    { id: "Refining", drawing: "refining", live: true },
    { id: "Conching", drawing: "conching", live: true },
    { id: "Tempering", drawing: "tempering", live: true },
    { id: "Moulding", drawing: "moulding", live: true },
    { id: "Packaging", drawing: "packaging", live: true },
  ];

  const DRAWING_IDS = PLANT_AREAS.map((a) => a.drawing);

  /** @typedef {"Good"|"Uncertain"|"Bad"|"Stale"} Quality */

  /**
   * @typedef {{
   *   id: string,
   *   name: string,
   *   type: "bool"|"number"|"string",
   *   unit?: string,
   *   format?: (v: any) => string,
   *   live?: boolean
   * }} TagDef
   */

  /** Sibling lines — live tags, no P&ID yet (center pane stays Line3). */
  const STUB_LINES = [
    { id: "Line1", speedSp: 95, oeeBase: 81.5, thruBase: 92, phase: 11 },
    { id: "Line2", speedSp: 108, oeeBase: 76.2, thruBase: 101, phase: 23 },
  ];

  /** Thin tag set for stub lines (ids relative to the line). */
  const STUB_LINE_TAGS = [
    { id: "Running", name: "Running", type: "bool", live: true },
    { id: "Mode", name: "Mode", type: "string", live: true },
    { id: "OEE", name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
    { id: "Throughput", name: "Throughput", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "SpeedSP", name: "SpeedSP", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Infeed/Running", name: "Running", type: "bool", live: true },
    { id: "Infeed/Speed", name: "Speed", type: "number", unit: "m/min", format: (v) => v.toFixed(1), live: true },
    { id: "Infeed/Photoeye", name: "Photoeye", type: "bool", live: true },
    { id: "Outfeed/Running", name: "Running", type: "bool", live: true },
    { id: "Outfeed/Occupied", name: "Occupied", type: "bool", live: true },
  ];

  /** Equipment folders under live Line3 (Reject nests under Checkweigher). */
  const EQUIPMENT = [
    { id: "Infeed", label: "Infeed", pid: "CV-301", kind: "conveyor" },
    { id: "Cartoner", label: "Cartoner", pid: "CT-310", kind: "machine" },
    { id: "Checkweigher", label: "Checkweigher", pid: "WT-320", kind: "scale" },
    { id: "CasePacker", label: "Case packer", pid: "CP-330", kind: "machine" },
    { id: "Palletizer", label: "Palletizer", pid: "PL-340", kind: "palletizer" },
    { id: "Outfeed", label: "Outfeed", pid: "CV-350", kind: "conveyor" },
  ];

  /** @type {TagDef[]} — ids are relative to Heuvelland/Packaging/Line3/ */
  const LINE3_TAGS = [
    { id: "Running", name: "Running", type: "bool", live: true },
    { id: "Mode", name: "Mode", type: "string", live: true },
    { id: "OEE", name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
    { id: "Throughput", name: "Throughput", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "SpeedSP", name: "SpeedSP", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "BatchId", name: "BatchId", type: "string", live: true },

    { id: "Infeed/Running", name: "Running", type: "bool", live: true },
    { id: "Infeed/Speed", name: "Speed", type: "number", unit: "m/min", format: (v) => v.toFixed(1), live: true },
    { id: "Infeed/Jam", name: "Jam", type: "bool", live: true },
    { id: "Infeed/Photoeye", name: "Photoeye", type: "bool", live: true },
    { id: "Infeed/Starved", name: "Starved", type: "bool", live: true },

    { id: "Cartoner/Running", name: "Running", type: "bool", live: true },
    { id: "Cartoner/Speed", name: "Speed", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Cartoner/Jam", name: "Jam", type: "bool", live: true },
    { id: "Cartoner/CartonsPerMin", name: "CartonsPerMin", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Cartoner/FaultCode", name: "FaultCode", type: "number", format: (v) => String(v), live: true },

    { id: "Checkweigher/Running", name: "Running", type: "bool", live: true },
    { id: "Checkweigher/WeightKg", name: "WeightKg", type: "number", unit: "kg", format: (v) => v.toFixed(3), live: true },
    { id: "Checkweigher/InSpec", name: "InSpec", type: "bool", live: true },
    { id: "Checkweigher/UnderCount", name: "UnderCount", type: "number", format: (v) => String(Math.round(v)), live: true },
    { id: "Checkweigher/OverCount", name: "OverCount", type: "number", format: (v) => String(Math.round(v)), live: true },

    { id: "Checkweigher/Reject/Count", name: "Count", type: "number", format: (v) => String(Math.round(v)), live: true },
    { id: "Checkweigher/Reject/Active", name: "Active", type: "bool", live: true },
    { id: "Checkweigher/Reject/Divert", name: "Divert", type: "bool", live: true },

    { id: "CasePacker/Running", name: "Running", type: "bool", live: true },
    { id: "CasePacker/Speed", name: "Speed", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "CasePacker/CasesPerMin", name: "CasesPerMin", type: "number", unit: "cpm", format: (v) => v.toFixed(1), live: true },
    { id: "CasePacker/Jam", name: "Jam", type: "bool", live: true },

    { id: "Palletizer/Running", name: "Running", type: "bool", live: true },
    { id: "Palletizer/Layers", name: "Layers", type: "number", format: (v) => String(Math.round(v)), live: true },
    { id: "Palletizer/PalletsDone", name: "PalletsDone", type: "number", format: (v) => String(Math.round(v)), live: true },
    { id: "Palletizer/Jam", name: "Jam", type: "bool", live: true },

    { id: "Outfeed/Running", name: "Running", type: "bool", live: true },
    { id: "Outfeed/Occupied", name: "Occupied", type: "bool", live: true },
    { id: "Outfeed/Photoeye", name: "Photoeye", type: "bool", live: true },
  ];

  /** Mixing tags — ids prefixed Mixing/… (chocolate mass mixer). */
  const MIXING_TAGS = [
    { id: "Mixing/Running", name: "Running", type: "bool", live: true },
    { id: "Mixing/Mode", name: "Mode", type: "string", live: true },
    { id: "Mixing/BatchId", name: "BatchId", type: "string", live: true },

    { id: "Mixing/Mixer1/Running", name: "Running", type: "bool", live: true },
    { id: "Mixing/Mixer1/LevelPct", name: "LevelPct", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
    { id: "Mixing/Mixer1/AgitatorRpm", name: "AgitatorRpm", type: "number", unit: "rpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Mixing/Mixer1/JacketTempC", name: "JacketTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
    { id: "Mixing/Mixer1/MassTempC", name: "MassTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },

    { id: "Mixing/CocoaLiquor/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Mixing/CocoaLiquor/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Mixing/Sugar/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Mixing/Sugar/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Mixing/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Mixing/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Mixing/Drain/ValveOpen", name: "ValveOpen", type: "bool", live: true },
  ];

  /** Refining tags — five-roll Refiner1. */
  const REFINING_TAGS = [
    { id: "Refining/Running", name: "Running", type: "bool", live: true },
    { id: "Refining/Mode", name: "Mode", type: "string", live: true },
    { id: "Refining/BatchId", name: "BatchId", type: "string", live: true },

    { id: "Refining/Refiner1/Running", name: "Running", type: "bool", live: true },
    { id: "Refining/Refiner1/LoadPct", name: "LoadPct", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
    { id: "Refining/Refiner1/ParticleUm", name: "ParticleUm", type: "number", unit: "µm", format: (v) => v.toFixed(1), live: true },

    { id: "Refining/Inlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Refining/Inlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Refining/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Refining/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },
  ];

  /** Conching tags — Conche1 agitator tank. */
  const CONCHING_TAGS = [
    { id: "Conching/Running", name: "Running", type: "bool", live: true },
    { id: "Conching/Mode", name: "Mode", type: "string", live: true },
    { id: "Conching/BatchId", name: "BatchId", type: "string", live: true },

    { id: "Conching/Conche1/Running", name: "Running", type: "bool", live: true },
    { id: "Conching/Conche1/TempC", name: "TempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
    { id: "Conching/Conche1/AgitatorRpm", name: "AgitatorRpm", type: "number", unit: "rpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Conching/Conche1/TimeMin", name: "TimeMin", type: "number", unit: "min", format: (v) => String(Math.round(v)), live: true },

    { id: "Conching/Inlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Conching/Inlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Conching/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Conching/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },
  ];

  /** Tempering tags — cooling tunnel Temper1. */
  const TEMPERING_TAGS = [
    { id: "Tempering/Running", name: "Running", type: "bool", live: true },
    { id: "Tempering/Mode", name: "Mode", type: "string", live: true },
    { id: "Tempering/BatchId", name: "BatchId", type: "string", live: true },

    { id: "Tempering/Temper1/Running", name: "Running", type: "bool", live: true },
    { id: "Tempering/Temper1/BeltSpeed", name: "BeltSpeed", type: "number", unit: "m/min", format: (v) => v.toFixed(1), live: true },
    { id: "Tempering/Temper1/Zone1TempC", name: "Zone1TempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
    { id: "Tempering/Temper1/Zone2TempC", name: "Zone2TempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
    { id: "Tempering/Temper1/Zone3TempC", name: "Zone3TempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
    { id: "Tempering/Temper1/MassTempC", name: "MassTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },

    { id: "Tempering/Inlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Tempering/Inlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Tempering/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Tempering/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Tempering/ChilledWater/FlowM3H", name: "FlowM3H", type: "number", unit: "m³/h", format: (v) => v.toFixed(1), live: true },
    { id: "Tempering/ChilledWater/SupplyTempC", name: "SupplyTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
  ];

  /** Moulding tags — Moulder1 + cooling air. */
  const MOULDING_TAGS = [
    { id: "Moulding/Running", name: "Running", type: "bool", live: true },
    { id: "Moulding/Mode", name: "Mode", type: "string", live: true },
    { id: "Moulding/BatchId", name: "BatchId", type: "string", live: true },

    { id: "Moulding/Moulder1/Running", name: "Running", type: "bool", live: true },
    { id: "Moulding/Moulder1/CyclesPerMin", name: "CyclesPerMin", type: "number", unit: "cpm", format: (v) => String(Math.round(v)), live: true },
    { id: "Moulding/Moulder1/MouldTempC", name: "MouldTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },

    { id: "Moulding/Inlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Moulding/Inlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Moulding/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
    { id: "Moulding/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

    { id: "Moulding/Cooling/AirTempC", name: "AirTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
  ];

  /** Prefixed stub tags: Line1/OEE, Line2/Infeed/Speed, … */
  const STUB_TAGS = STUB_LINES.flatMap((line) =>
    STUB_LINE_TAGS.map((t) => ({ ...t, id: `${line.id}/${t.id}` }))
  );

  /** Offline sister sites — thin tag set each. */
  const SISTER_SITE_TAGS = SISTER_SITES.flatMap((site) => [
    { id: `${site}/Running`, name: "Running", type: "bool", live: false },
    { id: `${site}/Mode`, name: "Mode", type: "string", live: false },
    { id: `${site}/OEE`, name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1), live: false },
  ]);

  const ALL_TAGS = LINE3_TAGS.concat(
    STUB_TAGS,
    MIXING_TAGS,
    REFINING_TAGS,
    CONCHING_TAGS,
    TEMPERING_TAGS,
    MOULDING_TAGS,
    SISTER_SITE_TAGS
  );
  const TAG_BY_ID = Object.fromEntries(ALL_TAGS.map((t) => [t.id, t]));
  const SISTER_SITE_SET = new Set(SISTER_SITES);

  function isStubTag(rel) {
    return rel.startsWith("Line1/") || rel.startsWith("Line2/");
  }

  function isSisterSiteTag(rel) {
    if (!rel) return false;
    return SISTER_SITE_SET.has(rel.split("/")[0]);
  }

  function isMixingTag(rel) {
    return !!rel && rel.startsWith("Mixing/");
  }

  function isRefiningTag(rel) {
    return !!rel?.startsWith("Refining/");
  }

  function isConchingTag(rel) {
    return !!rel?.startsWith("Conching/");
  }

  function isTemperingTag(rel) {
    return !!rel && rel.startsWith("Tempering/");
  }

  function isMouldingTag(rel) {
    return !!rel?.startsWith("Moulding/");
  }

  function isProcessAreaTag(rel) {
    return isMixingTag(rel) || isRefiningTag(rel) || isConchingTag(rel)
      || isTemperingTag(rel) || isMouldingTag(rel);
  }

  function isPackagingTag(rel) {
    if (!rel) return false;
    if (isProcessAreaTag(rel) || isSisterSiteTag(rel)) return false;
    return true;
  }

  function drawingForTag(rel) {
    if (isMixingTag(rel)) return "mixing";
    if (isRefiningTag(rel)) return "refining";
    if (isConchingTag(rel)) return "conching";
    if (isTemperingTag(rel)) return "tempering";
    if (isMouldingTag(rel)) return "moulding";
    if (isSisterSiteTag(rel)) return null;
    if (isPackagingTag(rel)) return "packaging";
    return null;
  }

  function pathOf(rel) {
    if (isSisterSiteTag(rel)) return `${PROVIDER}${rel}`;
    if (isProcessAreaTag(rel)) return `${PROVIDER}${SITE}/${rel}`;
    if (isStubTag(rel)) return `${PROVIDER}${AREA_ROOT}/${rel}`;
    return `${PROVIDER}${AREA_ROOT}/${LIVE_LINE}/${rel}`;
  }

  /** Default open folders in the nested tree (node keys). */
  const DEFAULT_OPEN = [
    EDGE_ROOT,
    SITE,
    /* Land on Packaging drawing — keep other areas collapsed so sister sites stay in view. */
    AREA_ROOT,
    `${AREA_ROOT}/Line3`,
    `${AREA_ROOT}/Line3/Cartoner`,
    `${AREA_ROOT}/Line3/Checkweigher`,
  ];

  function defaultState() {
    return {
      scenario: /** @type {null|"jam"|"starved"} */ (null),
      mixScenario: /** @type {null|"overtemp"|"valve"} */ (null),
      temperScenario: /** @type {null|"warm"|"belt"} */ (null),
      cartonerJamCleared: false,
      rejectCount: 12,
      underCount: 3,
      overCount: 1,
      palletsDone: 47,
      selectedTag: "OEE",
      activeDrawing: /** @type {"packaging"|"mixing"|"refining"|"conching"|"tempering"|"moulding"} */ ("packaging"),
      alarms: /** @type {Alarm[]} */ ([]),
      openNodes: DEFAULT_OPEN.slice(),
    };
  }

  /**
   * @typedef {{
   *   id: string,
   *   path: string,
   *   message: string,
   *   severity: "critical"|"warning",
   *   acked: boolean,
   *   ts: number
   * }} Alarm
   */

  /** @type {ReturnType<typeof defaultState>} */
  let state = loadState();

  /** @type {Record<string, { value: any, quality: Quality }>} */
  let live = {};

  let tick = 0;
  let timer = null;
  let treeBuilt = false;
  let pidBuilt = false;
  let pidHover = null; // { tagId?, equip? }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        alarms: Array.isArray(parsed.alarms) ? parsed.alarms : [],
        openNodes: Array.isArray(parsed.openNodes) ? parsed.openNodes : base.openNodes,
        selectedTag: TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag,
        activeDrawing: DRAWING_IDS.includes(parsed.activeDrawing)
          ? parsed.activeDrawing
          : drawingForTag(TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag),
        mixScenario: parsed.mixScenario === "overtemp" || parsed.mixScenario === "valve"
          ? parsed.mixScenario
          : null,
        temperScenario: parsed.temperScenario === "warm" || parsed.temperScenario === "belt"
          ? parsed.temperScenario
          : null,
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function drift(base, amp, phase) {
    return base + Math.sin((tick + phase) / 4.2) * amp + (Math.random() - 0.5) * amp * 0.15;
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function computeLive() {
    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    const mixOver = state.mixScenario === "overtemp";
    const mixValve = state.mixScenario === "valve";
    const mixFault = mixOver || mixValve;
    const temperWarm = state.temperScenario === "warm";
    const temperBelt = state.temperScenario === "belt";
    const temperFault = temperWarm || temperBelt;
    /* Upstream hold starves packaging feed (shared chocolate mass path). */
    const upstreamHold = mixFault || temperBelt;
    const lineOk = !jam && !starved && !upstreamHold;
    const feedStarved = starved || upstreamHold;
    const batchId = `B-${1400 + Math.floor(tick / 90)}`;

    const speedSp = 120;
    const cartonerSpeed = jam ? 0 : feedStarved ? drift(38, 4, 1) : drift(118, 3, 1);
    const infeedSpeed = feedStarved ? drift(4, 1.2, 2) : jam ? drift(22, 3, 2) : drift(28, 1.5, 2);
    const caseSpeed = jam ? 0 : feedStarved ? drift(9, 1, 3) : drift(29.5, 0.8, 3);
    const oee = jam ? drift(42, 2, 0) : feedStarved ? drift(61, 2.5, 0) : drift(87.4, 1.2, 0);
    const throughput = jam ? 0 : feedStarved ? drift(36, 3, 4) : drift(116, 2.5, 4);
    const weight = jam ? 0 : drift(0.452, 0.008, 5);

    if (lineOk && Math.random() < 0.08) state.rejectCount += 1;
    if (lineOk && Math.random() < 0.03) state.underCount += 1;
    if (lineOk && tick % 48 === 0) state.palletsDone += 1;

    const photoIn = !feedStarved && Math.random() > 0.15;
    const photoOut = lineOk && Math.random() > 0.25;
    const rejectActive = !lineOk ? false : Math.random() < 0.04;
    const pkgMode = jam ? "FAULT" : feedStarved ? "STARVED" : "AUTO";
    const pkgQ = jam ? "Bad" : feedStarved ? "Uncertain" : "Good";

    live = {
      Running: { value: lineOk, quality: pkgQ },
      Mode: { value: pkgMode, quality: jam ? "Bad" : "Good" },
      OEE: { value: clamp(oee, 0, 100), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      Throughput: { value: Math.max(0, throughput), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      SpeedSP: { value: speedSp, quality: "Good" },
      BatchId: { value: batchId, quality: "Good" },

      "Infeed/Running": { value: !feedStarved, quality: feedStarved ? "Uncertain" : "Good" },
      "Infeed/Speed": { value: Math.max(0, infeedSpeed), quality: feedStarved ? "Uncertain" : "Good" },
      "Infeed/Jam": { value: false, quality: "Good" },
      "Infeed/Photoeye": { value: photoIn, quality: feedStarved ? "Uncertain" : "Good" },
      "Infeed/Starved": { value: feedStarved, quality: feedStarved ? "Uncertain" : "Good" },

      "Cartoner/Running": { value: !jam && !feedStarved, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "Cartoner/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "Cartoner/Jam": { value: jam, quality: jam ? "Bad" : "Good" },
      "Cartoner/CartonsPerMin": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "Cartoner/FaultCode": { value: jam ? 41 : 0, quality: jam ? "Bad" : "Good" },

      "Checkweigher/Running": { value: !jam, quality: jam ? "Stale" : feedStarved ? "Uncertain" : "Good" },
      "Checkweigher/WeightKg": { value: Math.max(0, weight), quality: jam ? "Stale" : "Good" },
      "Checkweigher/InSpec": { value: !rejectActive && !jam, quality: jam ? "Stale" : "Good" },
      "Checkweigher/UnderCount": { value: state.underCount, quality: "Good" },
      "Checkweigher/OverCount": { value: state.overCount, quality: "Good" },

      "Checkweigher/Reject/Count": { value: state.rejectCount, quality: "Good" },
      "Checkweigher/Reject/Active": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },
      "Checkweigher/Reject/Divert": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },

      "CasePacker/Running": { value: !jam && !feedStarved, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "CasePacker/Speed": { value: Math.max(0, caseSpeed * 4), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "CasePacker/CasesPerMin": { value: Math.max(0, caseSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
      "CasePacker/Jam": { value: false, quality: "Good" },

      "Palletizer/Running": { value: !jam && !feedStarved, quality: jam ? "Stale" : feedStarved ? "Uncertain" : "Good" },
      "Palletizer/Layers": { value: jam ? 0 : Math.floor(((tick / 6) % 8) + 1), quality: jam ? "Stale" : "Good" },
      "Palletizer/PalletsDone": { value: state.palletsDone, quality: "Good" },
      "Palletizer/Jam": { value: false, quality: "Good" },

      "Outfeed/Running": { value: !jam && !feedStarved, quality: jam ? "Stale" : feedStarved ? "Uncertain" : "Good" },
      "Outfeed/Occupied": { value: photoOut, quality: jam ? "Stale" : "Good" },
      "Outfeed/Photoeye": { value: photoOut, quality: jam ? "Stale" : "Good" },
    };

    STUB_LINES.forEach((line) => {
      const oeeS = clamp(drift(line.oeeBase, 1.4, line.phase), 0, 100);
      const thru = Math.max(0, drift(line.thruBase, 2.2, line.phase + 2));
      const infeed = Math.max(0, drift(24 + line.phase * 0.1, 1.4, line.phase + 4));
      const photo = Math.random() > 0.18;
      const occ = Math.random() > 0.3;
      const p = `${line.id}/`;
      live[`${p}Running`] = { value: true, quality: "Good" };
      live[`${p}Mode`] = { value: "AUTO", quality: "Good" };
      live[`${p}OEE`] = { value: oeeS, quality: "Good" };
      live[`${p}Throughput`] = { value: thru, quality: "Good" };
      live[`${p}SpeedSP`] = { value: line.speedSp, quality: "Good" };
      live[`${p}Infeed/Running`] = { value: true, quality: "Good" };
      live[`${p}Infeed/Speed`] = { value: infeed, quality: "Good" };
      live[`${p}Infeed/Photoeye`] = { value: photo, quality: "Good" };
      live[`${p}Outfeed/Running`] = { value: true, quality: "Good" };
      live[`${p}Outfeed/Occupied`] = { value: occ, quality: "Good" };
    });

    /* Mixing */
    const mixRun = !mixFault;
    const level = clamp(drift(mixValve ? 38 : 62, 4, 7), 18, 92);
    const jacket = mixOver ? clamp(drift(62, 1.5, 8), 58, 68) : clamp(drift(48.5, 1.2, 8), 40, 55);
    const massT = mixOver ? clamp(drift(58, 1.2, 9), 54, 64) : clamp(drift(46.2, 1.0, 9), 38, 52);
    const rpm = mixFault ? clamp(drift(8, 2, 10), 0, 15) : clamp(drift(42, 3, 10), 20, 60);
    let cocoaOpen = !mixValve && level < 85;
    const sugarOpen = !mixFault && level < 80;
    const outletOpen = !mixFault && level > 55;
    if (mixValve) cocoaOpen = false;
    const cocoaFlow = cocoaOpen ? Math.max(0, drift(820, 40, 11)) : 0;
    const sugarFlow = sugarOpen ? Math.max(0, drift(310, 25, 12)) : 0;
    const mixOutFlow = outletOpen ? Math.max(0, drift(980, 50, 13)) : 0;
    const mixMode = mixOver ? "FAULT" : mixValve ? "HOLD" : "AUTO";
    const mixQ = mixOver ? "Bad" : mixValve ? "Uncertain" : "Good";
    live["Mixing/Running"] = { value: mixRun, quality: mixQ };
    live["Mixing/Mode"] = { value: mixMode, quality: mixQ };
    live["Mixing/BatchId"] = { value: batchId, quality: "Good" };
    live["Mixing/Mixer1/Running"] = { value: mixRun, quality: mixQ };
    live["Mixing/Mixer1/LevelPct"] = { value: level, quality: mixValve ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/AgitatorRpm"] = { value: rpm, quality: mixFault ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/JacketTempC"] = { value: jacket, quality: mixOver ? "Bad" : jacket > 52 ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/MassTempC"] = { value: massT, quality: mixOver ? "Bad" : "Good" };
    live["Mixing/CocoaLiquor/ValveOpen"] = { value: cocoaOpen, quality: mixValve ? "Bad" : "Good" };
    live["Mixing/CocoaLiquor/FlowKgH"] = { value: cocoaFlow, quality: mixValve ? "Bad" : "Good" };
    live["Mixing/Sugar/ValveOpen"] = { value: sugarOpen, quality: "Good" };
    live["Mixing/Sugar/FlowKgH"] = { value: sugarFlow, quality: "Good" };
    live["Mixing/Outlet/ValveOpen"] = { value: outletOpen, quality: mixFault ? "Uncertain" : "Good" };
    live["Mixing/Outlet/FlowKgH"] = { value: mixOutFlow, quality: mixFault ? "Bad" : "Good" };
    live["Mixing/Drain/ValveOpen"] = { value: false, quality: "Good" };

    /* Refining — inlet tracks Mixing mass out. */
    const refineStarve = mixFault;
    const refineRun = !refineStarve;
    const refineLoad = refineStarve ? clamp(drift(12, 3, 23), 0, 25) : clamp(drift(62, 3.5, 23), 45, 78);
    const particle = refineStarve ? clamp(drift(38, 2, 24), 30, 45) : clamp(drift(22, 1.2, 24), 18, 28);
    const refineInOpen = !refineStarve;
    const refineOutOpen = refineRun;
    const refineInFlow = refineStarve ? 0 : Math.max(0, mixOutFlow * 0.99 + drift(0, 18, 25));
    const refineOutFlow = refineRun ? Math.max(0, mixOutFlow * 0.99 + drift(0, 22, 26)) : 0;
    const refineMode = refineStarve ? "STARVED" : "AUTO";
    const refineQ = refineStarve ? "Uncertain" : "Good";
    live["Refining/Running"] = { value: refineRun, quality: refineQ };
    live["Refining/Mode"] = { value: refineMode, quality: refineQ };
    live["Refining/BatchId"] = { value: batchId, quality: "Good" };
    live["Refining/Refiner1/Running"] = { value: refineRun, quality: refineQ };
    live["Refining/Refiner1/LoadPct"] = { value: refineLoad, quality: refineStarve ? "Uncertain" : "Good" };
    live["Refining/Refiner1/ParticleUm"] = { value: particle, quality: refineStarve ? "Uncertain" : "Good" };
    live["Refining/Inlet/ValveOpen"] = { value: refineInOpen, quality: refineStarve ? "Uncertain" : "Good" };
    live["Refining/Inlet/FlowKgH"] = { value: Math.max(0, refineInFlow), quality: refineStarve ? "Bad" : "Good" };
    live["Refining/Outlet/ValveOpen"] = { value: refineOutOpen, quality: refineStarve ? "Uncertain" : "Good" };
    live["Refining/Outlet/FlowKgH"] = { value: Math.max(0, refineOutFlow), quality: refineStarve ? "Bad" : "Good" };

    /* Conching — inlet from refining outlet. */
    const concheStarve = mixFault || refineStarve;
    const concheRun = !concheStarve;
    const concheTemp = concheStarve ? clamp(drift(48, 1.5, 27), 40, 55) : clamp(drift(65, 1.2, 27), 58, 72);
    const concheRpm = concheStarve ? clamp(drift(6, 2, 28), 0, 12) : clamp(drift(28, 2.5, 28), 18, 40);
    const concheTime = Math.floor((tick % 5400) / 60);
    const concheInOpen = !concheStarve;
    const concheOutOpen = concheRun;
    const concheInFlow = concheStarve ? 0 : Math.max(0, refineOutFlow * 0.98 + drift(0, 16, 29));
    const conchOutFlow = concheRun ? Math.max(0, concheInFlow * 0.99 + drift(0, 14, 30)) : 0;
    const concheMode = concheStarve ? "STARVED" : "AUTO";
    const concheQ = concheStarve ? "Uncertain" : "Good";
    live["Conching/Running"] = { value: concheRun, quality: concheQ };
    live["Conching/Mode"] = { value: concheMode, quality: concheQ };
    live["Conching/BatchId"] = { value: batchId, quality: "Good" };
    live["Conching/Conche1/Running"] = { value: concheRun, quality: concheQ };
    live["Conching/Conche1/TempC"] = { value: concheTemp, quality: concheStarve ? "Uncertain" : "Good" };
    live["Conching/Conche1/AgitatorRpm"] = { value: concheRpm, quality: concheStarve ? "Uncertain" : "Good" };
    live["Conching/Conche1/TimeMin"] = { value: concheTime, quality: "Good" };
    live["Conching/Inlet/ValveOpen"] = { value: concheInOpen, quality: concheStarve ? "Uncertain" : "Good" };
    live["Conching/Inlet/FlowKgH"] = { value: Math.max(0, concheInFlow), quality: concheStarve ? "Bad" : "Good" };
    live["Conching/Outlet/ValveOpen"] = { value: concheOutOpen, quality: concheStarve ? "Uncertain" : "Good" };
    live["Conching/Outlet/FlowKgH"] = { value: Math.max(0, conchOutFlow), quality: concheStarve ? "Bad" : "Good" };

    /* Tempering — inlet tracks Conching mass out; starve only on Mixing fault. */
    const temperStarve = mixFault;
    const temperRun = !temperBelt && !temperStarve;
    const z1 = temperWarm ? clamp(drift(38, 0.9, 14), 35, 42) : clamp(drift(32.5, 0.8, 14), 28, 36);
    const z2 = temperWarm ? clamp(drift(36, 0.8, 15), 33, 40) : clamp(drift(29.0, 0.7, 15), 26, 33);
    const z3 = temperWarm ? clamp(drift(34, 0.7, 16), 31, 38) : clamp(drift(27.2, 0.6, 16), 24, 31);
    const massOut = temperWarm ? clamp(drift(35, 0.6, 17), 32, 38) : clamp(drift(28.4, 0.5, 17), 25, 32);
    const belt = temperBelt ? 0 : temperStarve ? clamp(drift(1.2, 0.3, 18), 0.4, 2) : clamp(drift(4.2, 0.25, 18), 2.5, 6);
    const inOpen = !temperStarve;
    const outOpen = temperRun;
    const inFlow = temperStarve ? 0 : Math.max(0, conchOutFlow * 0.97 + drift(0, 20, 19));
    const tOutFlow = temperRun ? Math.max(0, inFlow * 0.98 + drift(0, 15, 20)) : 0;
    const cwFlow = clamp(drift(temperWarm ? 8 : 12.5, 0.8, 21), 6, 18);
    const cwSupply = clamp(drift(temperWarm ? 9.5 : 6.5, 0.4, 22), 4, 11);
    const temperMode = temperWarm ? "FAULT" : temperBelt ? "HOLD" : temperStarve ? "STARVED" : "AUTO";
    const temperQ = temperWarm ? "Bad" : temperBelt || temperStarve ? "Uncertain" : "Good";
    live["Tempering/Running"] = { value: temperRun, quality: temperQ };
    live["Tempering/Mode"] = { value: temperMode, quality: temperQ };
    live["Tempering/BatchId"] = { value: batchId, quality: "Good" };
    live["Tempering/Temper1/Running"] = { value: temperRun, quality: temperQ };
    live["Tempering/Temper1/BeltSpeed"] = { value: belt, quality: temperBelt ? "Bad" : temperStarve ? "Uncertain" : "Good" };
    live["Tempering/Temper1/Zone1TempC"] = { value: z1, quality: temperWarm ? "Bad" : "Good" };
    live["Tempering/Temper1/Zone2TempC"] = { value: z2, quality: temperWarm ? "Bad" : "Good" };
    live["Tempering/Temper1/Zone3TempC"] = { value: z3, quality: temperWarm ? "Bad" : "Good" };
    live["Tempering/Temper1/MassTempC"] = { value: massOut, quality: temperWarm ? "Bad" : "Good" };
    live["Tempering/Inlet/ValveOpen"] = { value: inOpen, quality: temperStarve ? "Uncertain" : "Good" };
    live["Tempering/Inlet/FlowKgH"] = { value: Math.max(0, inFlow), quality: temperStarve ? "Bad" : "Good" };
    live["Tempering/Outlet/ValveOpen"] = { value: outOpen, quality: temperBelt ? "Uncertain" : "Good" };
    live["Tempering/Outlet/FlowKgH"] = { value: Math.max(0, tOutFlow), quality: temperBelt || temperStarve ? "Bad" : "Good" };
    live["Tempering/ChilledWater/FlowM3H"] = { value: cwFlow, quality: temperWarm ? "Uncertain" : "Good" };
    live["Tempering/ChilledWater/SupplyTempC"] = { value: cwSupply, quality: temperWarm ? "Uncertain" : "Good" };

    /* Moulding — inlet from tempering outlet. */
    const mouldStarve = temperBelt || mixFault;
    const mouldRun = !mouldStarve;
    const cycles = mouldStarve ? clamp(drift(3, 1.2, 31), 0, 6) : clamp(drift(18, 1.5, 31), 12, 24);
    const mouldTemp = mouldStarve ? clamp(drift(18, 1.2, 32), 14, 24) : clamp(drift(12, 0.8, 32), 9, 16);
    const airTemp = mouldStarve ? clamp(drift(14, 1.0, 33), 10, 20) : clamp(drift(8, 0.6, 33), 5, 12);
    const mouldInOpen = !mouldStarve;
    const mouldOutOpen = mouldRun;
    const mouldInFlow = mouldStarve ? 0 : Math.max(0, tOutFlow * 0.98 + drift(0, 14, 34));
    const mouldOutFlow = mouldRun ? Math.max(0, mouldInFlow * 0.99 + drift(0, 12, 35)) : 0;
    const mouldMode = mouldStarve ? "STARVED" : "AUTO";
    const mouldQ = mouldStarve ? "Uncertain" : "Good";
    live["Moulding/Running"] = { value: mouldRun, quality: mouldQ };
    live["Moulding/Mode"] = { value: mouldMode, quality: mouldQ };
    live["Moulding/BatchId"] = { value: batchId, quality: "Good" };
    live["Moulding/Moulder1/Running"] = { value: mouldRun, quality: mouldQ };
    live["Moulding/Moulder1/CyclesPerMin"] = { value: cycles, quality: mouldStarve ? "Uncertain" : "Good" };
    live["Moulding/Moulder1/MouldTempC"] = { value: mouldTemp, quality: mouldStarve ? "Uncertain" : "Good" };
    live["Moulding/Inlet/ValveOpen"] = { value: mouldInOpen, quality: mouldStarve ? "Uncertain" : "Good" };
    live["Moulding/Inlet/FlowKgH"] = { value: Math.max(0, mouldInFlow), quality: mouldStarve ? "Bad" : "Good" };
    live["Moulding/Outlet/ValveOpen"] = { value: mouldOutOpen, quality: mouldStarve ? "Uncertain" : "Good" };
    live["Moulding/Outlet/FlowKgH"] = { value: Math.max(0, mouldOutFlow), quality: mouldStarve ? "Bad" : "Good" };
    live["Moulding/Cooling/AirTempC"] = { value: airTemp, quality: mouldStarve ? "Uncertain" : "Good" };

    SISTER_SITES.forEach((site) => {
      live[`${site}/Running`] = { value: false, quality: "Stale" };
      live[`${site}/Mode`] = { value: "OFFLINE", quality: "Stale" };
      live[`${site}/OEE`] = { value: 0, quality: "Stale" };
    });

    syncScenarioAlarms();
  }

  function syncScenarioAlarms() {
    const want = [];
    if (state.scenario === "jam" && !state.cartonerJamCleared) {
      want.push({
        id: "alm-cartoner-jam",
        path: pathOf("Cartoner/Jam"),
        message: "Cartoner jam — infeed accumulated, downstream waiting",
        severity: /** @type {const} */ ("critical"),
      });
    }
    if (state.scenario === "starved") {
      want.push({
        id: "alm-infeed-starved",
        path: pathOf("Infeed/Starved"),
        message: "Infeed starved — no product detected at photoeye",
        severity: /** @type {const} */ ("warning"),
      });
    }
    if (state.mixScenario === "overtemp") {
      want.push({
        id: "alm-mix-overtemp",
        path: pathOf("Mixing/Mixer1/JacketTempC"),
        message: "Mixer1 jacket overtemperature — mass at risk",
        severity: /** @type {const} */ ("critical"),
      });
    }
    if (state.mixScenario === "valve") {
      want.push({
        id: "alm-mix-valve",
        path: pathOf("Mixing/CocoaLiquor/ValveOpen"),
        message: "Cocoa liquor valve XV-101 stuck closed — mixer starving",
        severity: /** @type {const} */ ("warning"),
      });
    }
    if (state.mixScenario === "overtemp" || state.mixScenario === "valve") {
      want.push({
        id: "alm-temper-upstream",
        path: pathOf("Tempering/Inlet/FlowKgH"),
        message: "Tempering starved — Mixing mass out stopped",
        severity: /** @type {const} */ ("warning"),
      });
      want.push({
        id: "alm-pack-upstream",
        path: pathOf("Infeed/Starved"),
        message: "Packaging Line3 starved — upstream mass hold",
        severity: /** @type {const} */ ("warning"),
      });
    }
    if (state.temperScenario === "warm") {
      want.push({
        id: "alm-temper-warm",
        path: pathOf("Tempering/Temper1/Zone1TempC"),
        message: "Temper1 zones too warm — mass not set",
        severity: /** @type {const} */ ("critical"),
      });
    }
    if (state.temperScenario === "belt") {
      want.push({
        id: "alm-temper-belt",
        path: pathOf("Tempering/Temper1/BeltSpeed"),
        message: "Temper1 belt stopped — tunnel hold",
        severity: /** @type {const} */ ("warning"),
      });
      want.push({
        id: "alm-pack-temper",
        path: pathOf("Infeed/Starved"),
        message: "Packaging Line3 starved — Tempering belt hold",
        severity: /** @type {const} */ ("warning"),
      });
    }
    const byId = new Map(state.alarms.map((a) => [a.id, a]));
    state.alarms = want.map((w) => {
      const prev = byId.get(w.id);
      return { ...w, acked: prev ? prev.acked : false, ts: prev ? prev.ts : Date.now() };
    });
  }

  function formatValue(def, value) {
    if (def.type === "bool") return value ? "true" : "false";
    if (def.format) {
      const s = def.format(value);
      return def.unit ? `${s} ${def.unit}` : s;
    }
    return def.unit ? `${value} ${def.unit}` : String(value);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function equipState(id) {
    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved"
      || state.mixScenario != null
      || state.temperScenario === "belt";
    if (id === "Cartoner" && jam) return "fault";
    if (id === "Infeed" && starved) return "warn";
    if (jam) {
      if (id === "Infeed") return "warn";
      if (id === "Checkweigher" || id === "Outfeed" || id === "Palletizer") return "idle";
      return "fault";
    }
    if (starved) return "warn";
    return "run";
  }

  /* ---------------- Tag tree ---------------- */

  function tagsUnder(tagList, prefix) {
    if (!prefix) {
      return tagList.filter((t) => !t.id.includes("/"));
    }
    const p = prefix.endsWith("/") ? prefix : prefix + "/";
    return tagList.filter((t) => {
      if (!t.id.startsWith(p)) return false;
      const rest = t.id.slice(p.length);
      return !rest.includes("/");
    });
  }

  function stubTagsRelative(lineId) {
    const p = lineId + "/";
    return STUB_TAGS.filter((t) => t.id.startsWith(p)).map((t) => ({
      ...t,
      rel: t.id.slice(p.length),
    }));
  }

  function tagsUnderStub(lineId, equipPrefix) {
    const rels = stubTagsRelative(lineId);
    if (!equipPrefix) {
      return rels.filter((t) => !t.rel.includes("/"));
    }
    const p = equipPrefix.endsWith("/") ? equipPrefix : equipPrefix + "/";
    return rels.filter((t) => {
      if (!t.rel.startsWith(p)) return false;
      return !t.rel.slice(p.length).includes("/");
    });
  }

  function renderTagButton(relId, def) {
    const lv = live[relId] || { value: "—", quality: "Stale" };
    const sel = relId === state.selectedTag ? " is-selected" : "";
    const offline = isSisterSiteTag(relId) ? " plant-tag--offline" : "";
    return `<li>
      <button type="button" class="plant-tag${sel}${offline}" data-tag="${escapeHtml(relId)}" data-q="${escapeHtml(lv.quality)}" aria-pressed="${relId === state.selectedTag}">
        <span class="plant-q-dot-inline" aria-hidden="true"></span>
        <span class="plant-tag__name">${escapeHtml(def.name)}</span>
        <span class="plant-tag__val">${escapeHtml(formatValue(def, lv.value))}</span>
        <span class="plant-q plant-q--${escapeHtml(lv.quality.toLowerCase())}">${escapeHtml(lv.quality)}</span>
      </button>
    </li>`;
  }

  function renderFolder(nodeKey, label, innerHtml, extraClass, opts) {
    const open = state.openNodes.includes(nodeKey);
    const drawing = opts && opts.drawing ? ` data-drawing="${escapeHtml(opts.drawing)}"` : "";
    return `<li class="${extraClass || ""}"${drawing}>
      <details data-node="${escapeHtml(nodeKey)}" ${open ? "open" : ""}>
        <summary>
          <span class="plant-tree__chev" aria-hidden="true">▼</span>
          <span class="plant-tree__label">${escapeHtml(label)}</span>
        </summary>
        <ul>${innerHtml}</ul>
      </details>
    </li>`;
  }

  function renderEquipFolder(equipId) {
    const nodeKey = `${AREA_ROOT}/${LIVE_LINE}/${equipId}`;
    let body = tagsUnder(LINE3_TAGS, equipId).map((t) => renderTagButton(t.id, t)).join("");
    if (equipId === "Checkweigher") {
      const rejectTags = tagsUnder(LINE3_TAGS, "Checkweigher/Reject")
        .map((t) => renderTagButton(t.id, t))
        .join("");
      body += renderFolder(`${nodeKey}/Reject`, "Reject", rejectTags);
    }
    return renderFolder(nodeKey, equipId, body);
  }

  function renderLine3Folder() {
    const nodeKey = `${AREA_ROOT}/${LIVE_LINE}`;
    const lineTags = tagsUnder(LINE3_TAGS, "").map((t) => renderTagButton(t.id, t)).join("");
    const equips = EQUIPMENT.map((e) => renderEquipFolder(e.id)).join("");
    return renderFolder(nodeKey, "Line3", lineTags + equips, "plant-tree__line plant-tree__line--live");
  }

  function renderStubLineFolder(line) {
    const nodeKey = `${AREA_ROOT}/${line.id}`;
    const lineTags = tagsUnderStub(line.id, "")
      .map((t) => renderTagButton(t.id, t))
      .join("");
    const equips = ["Infeed", "Outfeed"].map((equipId) => {
      const body = tagsUnderStub(line.id, equipId)
        .map((t) => renderTagButton(t.id, t))
        .join("");
      return renderFolder(`${nodeKey}/${equipId}`, equipId, body);
    }).join("");
    return renderFolder(nodeKey, line.id, lineTags + equips, "plant-tree__line plant-tree__line--live");
  }

  function mixingTagsUnder(prefix) {
    const base = "Mixing/";
    if (!prefix) {
      return MIXING_TAGS.filter((t) => {
        const rest = t.id.slice(base.length);
        return !rest.includes("/");
      });
    }
    const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
    return MIXING_TAGS.filter((t) => {
      if (!t.id.startsWith(p)) return false;
      const rest = t.id.slice(p.length);
      return !rest.includes("/");
    });
  }

  function renderMixingFolder() {
    const areaTags = mixingTagsUnder("").map((t) => renderTagButton(t.id, t)).join("");
    const mixer = mixingTagsUnder("Mixer1").map((t) => renderTagButton(t.id, t)).join("");
    const cocoa = mixingTagsUnder("CocoaLiquor").map((t) => renderTagButton(t.id, t)).join("");
    const sugar = mixingTagsUnder("Sugar").map((t) => renderTagButton(t.id, t)).join("");
    const outlet = mixingTagsUnder("Outlet").map((t) => renderTagButton(t.id, t)).join("");
    const drain = mixingTagsUnder("Drain").map((t) => renderTagButton(t.id, t)).join("");
    const body =
      areaTags +
      renderFolder(`${MIXING_ROOT}/Mixer1`, "Mixer1", mixer) +
      renderFolder(`${MIXING_ROOT}/CocoaLiquor`, "CocoaLiquor", cocoa) +
      renderFolder(`${MIXING_ROOT}/Sugar`, "Sugar", sugar) +
      renderFolder(`${MIXING_ROOT}/Outlet`, "Outlet", outlet) +
      renderFolder(`${MIXING_ROOT}/Drain`, "Drain", drain);
    return renderFolder(MIXING_ROOT, MIXING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "mixing" });
  }

  function temperingTagsUnder(prefix) {
    const base = "Tempering/";
    if (!prefix) {
      return TEMPERING_TAGS.filter((t) => {
        const rest = t.id.slice(base.length);
        return !rest.includes("/");
      });
    }
    const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
    return TEMPERING_TAGS.filter((t) => {
      if (!t.id.startsWith(p)) return false;
      return !t.id.slice(p.length).includes("/");
    });
  }

  function renderTemperingFolder() {
    const areaTags = temperingTagsUnder("").map((t) => renderTagButton(t.id, t)).join("");
    const temper = temperingTagsUnder("Temper1").map((t) => renderTagButton(t.id, t)).join("");
    const inlet = temperingTagsUnder("Inlet").map((t) => renderTagButton(t.id, t)).join("");
    const outlet = temperingTagsUnder("Outlet").map((t) => renderTagButton(t.id, t)).join("");
    const chilled = temperingTagsUnder("ChilledWater").map((t) => renderTagButton(t.id, t)).join("");
    const body =
      areaTags +
      renderFolder(`${TEMPERING_ROOT}/Temper1`, "Temper1", temper) +
      renderFolder(`${TEMPERING_ROOT}/Inlet`, "Inlet", inlet) +
      renderFolder(`${TEMPERING_ROOT}/Outlet`, "Outlet", outlet) +
      renderFolder(`${TEMPERING_ROOT}/ChilledWater`, "ChilledWater", chilled);
    return renderFolder(TEMPERING_ROOT, TEMPERING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "tempering" });
  }

  function areaTagsUnder(tagList, areaPrefix, prefix) {
    const base = areaPrefix.endsWith("/") ? areaPrefix : areaPrefix + "/";
    if (!prefix) {
      return tagList.filter((t) => {
        if (!t.id.startsWith(base)) return false;
        return !t.id.slice(base.length).includes("/");
      });
    }
    const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
    return tagList.filter((t) => {
      if (!t.id.startsWith(p)) return false;
      return !t.id.slice(p.length).includes("/");
    });
  }

  function renderRefiningFolder() {
    const areaTags = areaTagsUnder(REFINING_TAGS, "Refining/", "").map((t) => renderTagButton(t.id, t)).join("");
    const refiner = areaTagsUnder(REFINING_TAGS, "Refining/", "Refiner1").map((t) => renderTagButton(t.id, t)).join("");
    const inlet = areaTagsUnder(REFINING_TAGS, "Refining/", "Inlet").map((t) => renderTagButton(t.id, t)).join("");
    const outlet = areaTagsUnder(REFINING_TAGS, "Refining/", "Outlet").map((t) => renderTagButton(t.id, t)).join("");
    const body =
      areaTags +
      renderFolder(`${REFINING_ROOT}/Refiner1`, "Refiner1", refiner) +
      renderFolder(`${REFINING_ROOT}/Inlet`, "Inlet", inlet) +
      renderFolder(`${REFINING_ROOT}/Outlet`, "Outlet", outlet);
    return renderFolder(REFINING_ROOT, REFINING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "refining" });
  }

  function renderConchingFolder() {
    const areaTags = areaTagsUnder(CONCHING_TAGS, "Conching/", "").map((t) => renderTagButton(t.id, t)).join("");
    const conche = areaTagsUnder(CONCHING_TAGS, "Conching/", "Conche1").map((t) => renderTagButton(t.id, t)).join("");
    const inlet = areaTagsUnder(CONCHING_TAGS, "Conching/", "Inlet").map((t) => renderTagButton(t.id, t)).join("");
    const outlet = areaTagsUnder(CONCHING_TAGS, "Conching/", "Outlet").map((t) => renderTagButton(t.id, t)).join("");
    const body =
      areaTags +
      renderFolder(`${CONCHING_ROOT}/Conche1`, "Conche1", conche) +
      renderFolder(`${CONCHING_ROOT}/Inlet`, "Inlet", inlet) +
      renderFolder(`${CONCHING_ROOT}/Outlet`, "Outlet", outlet);
    return renderFolder(CONCHING_ROOT, CONCHING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "conching" });
  }

  function renderMouldingFolder() {
    const areaTags = areaTagsUnder(MOULDING_TAGS, "Moulding/", "").map((t) => renderTagButton(t.id, t)).join("");
    const moulder = areaTagsUnder(MOULDING_TAGS, "Moulding/", "Moulder1").map((t) => renderTagButton(t.id, t)).join("");
    const inlet = areaTagsUnder(MOULDING_TAGS, "Moulding/", "Inlet").map((t) => renderTagButton(t.id, t)).join("");
    const outlet = areaTagsUnder(MOULDING_TAGS, "Moulding/", "Outlet").map((t) => renderTagButton(t.id, t)).join("");
    const cooling = areaTagsUnder(MOULDING_TAGS, "Moulding/", "Cooling").map((t) => renderTagButton(t.id, t)).join("");
    const body =
      areaTags +
      renderFolder(`${MOULDING_ROOT}/Moulder1`, "Moulder1", moulder) +
      renderFolder(`${MOULDING_ROOT}/Inlet`, "Inlet", inlet) +
      renderFolder(`${MOULDING_ROOT}/Outlet`, "Outlet", outlet) +
      renderFolder(`${MOULDING_ROOT}/Cooling`, "Cooling", cooling);
    return renderFolder(MOULDING_ROOT, MOULDING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "moulding" });
  }

  function renderSisterSiteFolder(site) {
    const tags = SISTER_SITE_TAGS.filter((t) => t.id.startsWith(`${site}/`))
      .map((t) => renderTagButton(t.id, t))
      .join("");
    return renderFolder(site, site, tags, "plant-tree__site plant-tree__site--offline");
  }

  function buildTree() {
    const root = document.getElementById("plant-tree");
    if (!root) return;

    const lines =
      STUB_LINES.map(renderStubLineFolder).join("") + renderLine3Folder();

    const packaging = renderFolder(AREA_ROOT, AREA, lines, "plant-tree__area plant-tree__area--live", { drawing: "packaging" });
    const mixing = renderMixingFolder();
    const refining = renderRefiningFolder();
    const conching = renderConchingFolder();
    const tempering = renderTemperingFolder();
    const moulding = renderMouldingFolder();

    /* Process order: Mixing → Refining → Conching → Tempering → Moulding → Packaging */
    const heuvellandAreas = mixing + refining + conching + tempering + moulding + packaging;
    const heuvelland = renderFolder(SITE, SITE, heuvellandAreas, "plant-tree__site plant-tree__site--live");
    const sisters = SISTER_SITES.map(renderSisterSiteFolder).join("");

    root.innerHTML = renderFolder(EDGE_ROOT, EDGE_ROOT, heuvelland + sisters, "plant-tree__edge");
    treeBuilt = true;
    updateTreeValues();

    const headPath = document.getElementById("plant-tree-path");
    if (headPath) headPath.textContent = EDGE_ROOT;
  }

  function updateTreeValues() {
    const root = document.getElementById("plant-tree");
    if (!root) return;
    root.querySelectorAll(".plant-tag[data-tag]").forEach((btn) => {
      const id = btn.getAttribute("data-tag");
      if (!id) return;
      const def = TAG_BY_ID[id];
      const lv = live[id] || { value: "—", quality: "Stale" };
      if (!def) return;
      btn.dataset.q = lv.quality;
      btn.classList.toggle("is-selected", id === state.selectedTag);
      btn.setAttribute("aria-pressed", id === state.selectedTag ? "true" : "false");
      const valEl = btn.querySelector(".plant-tag__val");
      const qEl = btn.querySelector(".plant-q");
      if (valEl) valEl.textContent = formatValue(def, lv.value);
      if (qEl) {
        qEl.textContent = lv.quality;
        qEl.className = `plant-q plant-q--${lv.quality.toLowerCase()}`;
      }
    });
  }

  function renderTree() {
    if (!treeBuilt) buildTree();
    else updateTreeValues();
  }

  /* ---------------- P&ID ---------------- */

  function liveReadout(tagId) {
    const def = TAG_BY_ID[tagId];
    const lv = live[tagId];
    if (!def || !lv) return "";
    return formatValue(def, lv.value);
  }

  /** Connection ports for each equipment kind — pipes must meet these exactly. */
  function portsFor(eq, x, y, w, h) {
    const midY = y + h / 2;
    if (eq.kind === "scale") {
      return {
        left: x + 6,
        right: x + w - 6,
        top: y + 4,
        bottom: y + h - 4,
        cx: x + w / 2,
        midY,
      };
    }
    if (eq.kind === "conveyor") {
      return {
        left: x,
        right: x + w,
        top: y + 10,
        bottom: y + h - 10,
        cx: x + w / 2,
        midY,
      };
    }
    return {
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      cx: x + w / 2,
      midY,
    };
  }

  function equipKeyForTag(tagId) {
    if (!tagId) return null;
    if (isProcessAreaTag(tagId)) {
      const parts = tagId.split("/");
      // Mixing/Mixer1/LevelPct → Mixer1; Refining/Refiner1/LoadPct → Refiner1
      return parts[1] || null;
    }
    let id = tagId;
    if (isStubTag(tagId)) id = tagId.split("/").slice(1).join("/");
    if (id.startsWith("Checkweigher/Reject")) return "Reject";
    if (!id.includes("/")) return null;
    return id.split("/")[0];
  }

  function balloon(cx, cy, top, bot, tagId, anchorX, anchorY, equipKey) {
    const q = (live[tagId] || {}).quality || "Stale";
    const qClass = `pid-q--${q.toLowerCase()}`;
    const selected = tagId === state.selectedTag ? " is-selected" : "";
    const val = liveReadout(tagId);
    const ax = anchorX != null ? anchorX : cx;
    const ay = anchorY != null ? anchorY : cy + 42;
    const railY = Math.min(cy + 26, ay - 6);
    const leader = Math.abs(ax - cx) < 0.5
      ? `M ${cx} ${cy + 17} V ${ay}`
      : `M ${cx} ${cy + 17} V ${railY} H ${ax} V ${ay}`;
    const ek = equipKey || equipKeyForTag(tagId) || "";
    return `
      <g class="pid-balloon${selected} ${qClass}" data-tag="${escapeHtml(tagId)}" data-equip="${escapeHtml(ek)}" role="button" tabindex="0" aria-label="${escapeHtml(top + "-" + bot + " " + val)}">
        <path class="pid-leader" d="${leader}" fill="none" />
        <circle class="pid-balloon__ring" cx="${cx}" cy="${cy}" r="17" />
        <line class="pid-balloon__split" x1="${cx - 17}" y1="${cy}" x2="${cx + 17}" y2="${cy}" />
        <text class="pid-balloon__top" x="${cx}" y="${cy - 4}" text-anchor="middle">${escapeHtml(top)}</text>
        <text class="pid-balloon__bot" x="${cx}" y="${cy + 11}" text-anchor="middle">${escapeHtml(bot)}</text>
        <text class="pid-balloon__val" data-pid-val="${escapeHtml(tagId)}" x="${cx + 22}" y="${cy + 4}" text-anchor="start">${escapeHtml(val)}</text>
      </g>`;
  }

  function flange(x, y) {
    return `<line class="pid-flange" x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" />`;
  }

  function flowArrow(x, y) {
    return `<polygon class="pid-arrow" points="${x},${y} ${x - 7},${y - 4.5} ${x - 7},${y + 4.5}" />`;
  }

  function equipBlock(x, y, w, h, eq, st) {
    const tagId = `${eq.id}/Running`;
    const selected = state.selectedTag.startsWith(eq.id + "/") || state.selectedTag === eq.id
      ? " is-selected" : "";
    const midY = y + h / 2;
    const p = portsFor(eq, x, y, w, h);
    let body;
    if (eq.kind === "conveyor") {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y + 10}" width="${w}" height="${h - 20}" rx="2" />
        <circle class="pid-equip__roller" cx="${x + 11}" cy="${midY}" r="8" />
        <circle class="pid-equip__roller" cx="${x + w - 11}" cy="${midY}" r="8" />
        <line class="pid-equip__belt" x1="${x + 11}" y1="${y + 14}" x2="${x + w - 11}" y2="${y + 14}" />
        <line class="pid-equip__belt" x1="${x + 11}" y1="${y + h - 14}" x2="${x + w - 11}" y2="${y + h - 14}" />
        <line class="pid-equip__hatch" x1="${x + 22}" y1="${midY}" x2="${x + w - 22}" y2="${midY}" />`;
    } else if (eq.kind === "scale") {
      body = `
        <rect class="pid-equip__body" x="${p.left}" y="${p.top}" width="${p.right - p.left}" height="${p.bottom - p.top}" rx="1" />
        <rect class="pid-equip__platen" x="${x + 16}" y="${y + 10}" width="${w - 32}" height="8" rx="1" />
        <line class="pid-equip__detail" x1="${p.cx}" y1="${y + 18}" x2="${p.cx}" y2="${p.bottom - 10}" />
        <line class="pid-equip__detail" x1="${x + 14}" y1="${p.bottom - 8}" x2="${x + w - 14}" y2="${p.bottom - 8}" />
        <line class="pid-equip__detail" x1="${x + 18}" y1="${p.bottom - 4}" x2="${x + w - 18}" y2="${p.bottom - 4}" />`;
    } else if (eq.kind === "palletizer") {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="1" />
        <rect class="pid-equip__stack" x="${x + 16}" y="${y + h - 18}" width="${w - 32}" height="6" />
        <rect class="pid-equip__stack" x="${x + 20}" y="${y + h - 26}" width="${w - 40}" height="6" />
        <rect class="pid-equip__stack" x="${x + 24}" y="${y + h - 34}" width="${w - 48}" height="6" />
        <line class="pid-equip__detail" x1="${x + 10}" y1="${y + 10}" x2="${x + w - 10}" y2="${y + 10}" />`;
    } else {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="1" />
        <rect class="pid-equip__detail" x="${x + 8}" y="${y + 10}" width="${w - 16}" height="${h - 20}" rx="1" />
        <line class="pid-equip__detail" x1="${x + 8}" y1="${midY}" x2="${x + w - 8}" y2="${midY}" />`;
    }
    return `
      <g class="pid-equip pid-equip--${st}${selected}" data-equip="${escapeHtml(eq.id)}" data-tag="${escapeHtml(tagId)}" role="button" tabindex="0">
        ${body}
        <text class="pid-equip__pid" x="${p.cx}" y="${p.top - 8}" text-anchor="middle">${escapeHtml(eq.pid)}</text>
        <text class="pid-equip__name" x="${p.cx}" y="${p.bottom + 14}" text-anchor="middle">${escapeHtml(eq.label)}</text>
      </g>`;
  }

  function divertValve(cx, cyTop, cyBot, active, selected) {
    const mid = (cyTop + cyBot) / 2;
    return `
      <g class="pid-valve${selected}${active ? " is-active" : ""}" data-tag="Checkweigher/Reject/Divert" data-equip="Reject" role="button" tabindex="0" aria-label="Reject divert valve RJ-321">
        <line class="pid-pipe pid-pipe--divert" x1="${cx}" y1="${cyTop}" x2="${cx}" y2="${mid - 10}" />
        <polygon class="pid-valve__body" points="${cx},${mid - 10} ${cx - 11},${mid + 10} ${cx + 11},${mid + 10}" />
        <line class="pid-pipe pid-pipe--divert" x1="${cx}" y1="${mid + 10}" x2="${cx}" y2="${cyBot}" />
        <text class="pid-mix-valve__pid" x="${cx + 16}" y="${mid + 4}" text-anchor="start">XV-321</text>
      </g>`;
  }

  function buildPackagingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const y = 178;
    const h = 58;
    const w = 92;
    // Leave room on the left for the FROM MOULD inlet label (no overlap with CV-301).
    const xs = [90, 228, 366, 522, 660, 798];

    const layout = EQUIPMENT.map((eq, i) => {
      const x = xs[i];
      return { eq, x, y, w, h, ports: portsFor(eq, x, y, w, h) };
    });

    const midY = layout[0].ports.midY;
    const weigh = layout[2];
    const rejectX = weigh.ports.cx;
    const valveTop = weigh.ports.bottom;
    const binTop = 332;
    const valveBot = binTop - 18;

    const pipes = layout.map((node, i) => {
      if (i === layout.length - 1) return "";
      const next = layout[i + 1];
      const x1 = node.ports.right;
      const x2 = next.ports.left;
      const mid = (x1 + x2) / 2;
      return `
        <line class="pid-pipe pid-pipe--main" x1="${x1}" y1="${midY}" x2="${x2}" y2="${midY}" />
        ${flange(x1, midY)}${flange(x2, midY)}
        ${flowArrow(mid + 3, midY)}`;
    }).join("");

    // Inlet stub left of CV-301: label sits above the stub, clear of the body.
    const inletX0 = 24;
    const inletX1 = layout[0].ports.left;
    const inletMid = (inletX0 + inletX1) / 2;
    const inlet = `
      <line class="pid-pipe pid-pipe--main" x1="${inletX0}" y1="${midY}" x2="${inletX1}" y2="${midY}" />
      ${flange(inletX1, midY)}
      <text class="pid-flow-label" x="${inletMid}" y="${midY - 22}" text-anchor="middle">FROM MOULD</text>
      ${flowArrow(inletX1 - 12, midY)}`;

    const last = layout[layout.length - 1];
    const outletX1 = last.ports.right + 48;
    const outlet = `
      <line class="pid-pipe pid-pipe--main" x1="${last.ports.right}" y1="${midY}" x2="${outletX1}" y2="${midY}" />
      ${flange(last.ports.right, midY)}
      ${flowArrow(outletX1 - 8, midY)}
      <text class="pid-flow-label" x="${outletX1}" y="${midY - 22}" text-anchor="middle">PALLETS</text>`;

    const equips = layout.map((n) =>
      equipBlock(n.x, n.y, n.w, n.h, n.eq, "run")
    ).join("");

    const cart = layout[1];
    const caseP = layout[3];
    const pal = layout[4];
    const outf = layout[5];
    const balloons = [
      balloon(layout[0].ports.cx, 86, "SI", "301", "Infeed/Speed", layout[0].ports.cx, layout[0].ports.top, "Infeed"),
      balloon(cart.ports.cx - 26, 86, "SC", "310", "Cartoner/Speed", cart.ports.cx - 14, cart.ports.top, "Cartoner"),
      balloon(cart.ports.cx + 26, 86, "YA", "310", "Cartoner/Jam", cart.ports.cx + 14, cart.ports.top, "Cartoner"),
      balloon(weigh.ports.cx, 86, "WT", "320", "Checkweigher/WeightKg", weigh.ports.cx, weigh.ports.top, "Checkweigher"),
      balloon(rejectX + 54, (valveTop + valveBot) / 2, "XI", "321", "Checkweigher/Reject/Divert", rejectX + 12, (valveTop + valveBot) / 2, "Reject"),
      balloon(caseP.ports.cx, 86, "SI", "330", "CasePacker/Speed", caseP.ports.cx, caseP.ports.top, "CasePacker"),
      balloon(pal.ports.cx, 86, "CI", "340", "Palletizer/PalletsDone", pal.ports.cx, pal.ports.top, "Palletizer"),
      balloon(outf.ports.cx, 86, "XI", "350", "Outfeed/Occupied", outf.ports.cx, outf.ports.top, "Outfeed"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line 3 packaging P and ID">
        <title>Heuvelland Packaging Line 3 — P&amp;ID</title>

        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">PKG-L3-001</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Packaging / Line3</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — PRIMARY PACK</text>
        <text class="pid-sheet__sub" x="24" y="52">Bars from Moulding → cartoner → weigh → case → pallet → outfeed</text>

        ${equips}
        ${inlet}
        ${pipes}
        ${outlet}
        <line class="pid-pipe-flow" data-pid-flow x1="${inletX0}" y1="${midY}" x2="${outletX1}" y2="${midY}" />

        ${divertValve(rejectX, valveTop, valveBot, false, false)}
        <g class="pid-bin" data-tag="Checkweigher/Reject/Count" data-equip="Reject" role="button" tabindex="0">
          <path class="pid-bin__body" d="M${rejectX - 26},${binTop} L${rejectX + 26},${binTop} L${rejectX + 20},${binTop + 30} L${rejectX - 20},${binTop + 30} Z" />
          <text class="pid-bin__label" x="${rejectX}" y="${binTop + 18}" text-anchor="middle">REJECT</text>
          <text class="pid-bin__count" data-pid-reject-count x="${rejectX}" y="${binTop + 44}" text-anchor="middle">0</text>
        </g>

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function mixValve(cx, cy, tagId, equip, pidLabel) {
    const selected = tagId === state.selectedTag ? " is-selected" : "";
    return `
      <g class="pid-mix-valve${selected}" data-tag="${escapeHtml(tagId)}" data-equip="${escapeHtml(equip)}" role="button" tabindex="0" aria-label="${escapeHtml(pidLabel)}">
        <polygon class="pid-mix-valve__body" points="${cx},${cy - 11} ${cx + 11},${cy} ${cx},${cy + 11} ${cx - 11},${cy}" />
        <text class="pid-mix-valve__pid" x="${cx}" y="${cy - 16}" text-anchor="middle">${escapeHtml(pidLabel)}</text>
      </g>`;
  }

  function buildMixingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const tankX = 340;
    const tankY = 88;
    const tankW = 260;
    const tankH = 240;
    const tankCx = tankX + tankW / 2;
    const cocoaY = 140;
    const sugarY = 230;
    const outY = tankY + tankH / 2;
    const drainX = tankCx;
    const drainY0 = tankY + tankH;
    const drainY1 = 372;
    const jacketInset = 12;
    const levelInset = 22;
    const levelTop = tankY + jacketInset + 8;
    const levelInnerH = tankH - jacketInset * 2 - 16;

    const balloons = [
      balloon(tankCx - 90, 52, "LI", "110", "Mixing/Mixer1/LevelPct", tankCx - 50, tankY, "Mixer1"),
      balloon(tankCx + 90, 52, "TI", "110", "Mixing/Mixer1/JacketTempC", tankCx + 50, tankY, "Mixer1"),
      balloon(tankCx, 52, "SI", "110", "Mixing/Mixer1/AgitatorRpm", tankCx, tankY, "Mixer1"),
      balloon(100, cocoaY - 48, "FI", "101", "Mixing/CocoaLiquor/FlowKgH", 190, cocoaY, "CocoaLiquor"),
      balloon(100, sugarY + 52, "FI", "102", "Mixing/Sugar/FlowKgH", 190, sugarY, "Sugar"),
      balloon(800, outY - 52, "FI", "110", "Mixing/Outlet/FlowKgH", 720, outY, "Outlet"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--mixing is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Mixing Mixer1 P and ID">
        <title>Heuvelland Mixing — Mixer1</title>
        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">MIX-110</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Mixing / Mixer1</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — CHOCOLATE MASS</text>
        <text class="pid-sheet__sub" x="24" y="52">Cocoa liquor + sugar → Mixer1 → mass out (refining next)</text>

        <text class="pid-flow-label" x="28" y="${cocoaY - 10}" text-anchor="start">COCOA LIQUOR</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${cocoaY}" x2="${tankX}" y2="${cocoaY}" />
        ${flowArrow(130, cocoaY)}
        ${mixValve(210, cocoaY, "Mixing/CocoaLiquor/ValveOpen", "CocoaLiquor", "XV-101")}
        ${flange(tankX, cocoaY)}

        <text class="pid-flow-label" x="28" y="${sugarY - 10}" text-anchor="start">SUGAR</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${sugarY}" x2="${tankX}" y2="${sugarY}" />
        ${flowArrow(130, sugarY)}
        ${mixValve(210, sugarY, "Mixing/Sugar/ValveOpen", "Sugar", "XV-102")}
        ${flange(tankX, sugarY)}

        <g class="pid-tank pid-equip--run" data-equip="Mixer1" data-tag="Mixing/Mixer1/Running" role="button" tabindex="0">
          <rect class="pid-tank__shell" x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="10" />
          <rect class="pid-tank__jacket" x="${tankX + jacketInset}" y="${tankY + jacketInset}" width="${tankW - jacketInset * 2}" height="${tankH - jacketInset * 2}" rx="5" />
          <rect class="pid-tank__level" data-pid-level data-tank-top="${levelTop}" data-tank-inner-h="${levelInnerH}" x="${tankX + levelInset}" y="${levelTop + levelInnerH * 0.4}" width="${tankW - levelInset * 2}" height="${levelInnerH * 0.6}" rx="2" />
          <line class="pid-tank__agitator" x1="${tankCx}" y1="${tankY + 32}" x2="${tankCx}" y2="${tankY + tankH - 32}" />
          <circle class="pid-tank__hub" cx="${tankCx}" cy="${tankY + 44}" r="8" />
          <text class="pid-equip__pid" x="${tankCx}" y="${tankY - 12}" text-anchor="middle">MIX-110</text>
          <text class="pid-equip__name" x="${tankCx}" y="${tankY + tankH + 20}" text-anchor="middle">Mixer1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${tankX + tankW}" y1="${outY}" x2="880" y2="${outY}" />
        ${flange(tankX + tankW, outY)}
        ${mixValve(720, outY, "Mixing/Outlet/ValveOpen", "Outlet", "XV-110")}
        ${flowArrow(800, outY)}
        <text class="pid-flow-label" x="888" y="${outY - 10}" text-anchor="start">TO REFINE</text>

        <line class="pid-pipe pid-pipe--divert" x1="${drainX}" y1="${drainY0}" x2="${drainX}" y2="${drainY1}" />
        ${mixValve(drainX, drainY0 + 32, "Mixing/Drain/ValveOpen", "Drain", "XV-119")}
        <text class="pid-flow-label" x="${drainX + 20}" y="${drainY1}" text-anchor="start">DRAIN</text>

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildTemperingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const tunnelX = 170;
    const tunnelY = 118;
    const tunnelW = 620;
    const tunnelH = 160;
    const zoneW = tunnelW / 3;
    const midY = tunnelY + tunnelH / 2;
    const inY = midY;
    const outY = midY;

    const zones = [0, 1, 2].map((i) => {
      const x = tunnelX + i * zoneW;
      const label = `Z${i + 1}`;
      return `
        <rect class="pid-tunnel__zone" data-zone="${i + 1}" x="${x}" y="${tunnelY}" width="${zoneW}" height="${tunnelH}" />
        <text class="pid-tunnel__zone-label" x="${x + zoneW / 2}" y="${tunnelY + 26}" text-anchor="middle">${label}</text>`;
    }).join("");

    const balloons = [
      balloon(tunnelX + zoneW * 0.5, 68, "TI", "211", "Tempering/Temper1/Zone1TempC", tunnelX + zoneW * 0.5, tunnelY, "Temper1"),
      balloon(tunnelX + zoneW * 1.5, 68, "TI", "212", "Tempering/Temper1/Zone2TempC", tunnelX + zoneW * 1.5, tunnelY, "Temper1"),
      balloon(tunnelX + zoneW * 2.5, 68, "TI", "213", "Tempering/Temper1/Zone3TempC", tunnelX + zoneW * 2.5, tunnelY, "Temper1"),
      balloon(tunnelX + tunnelW / 2, 330, "SI", "210", "Tempering/Temper1/BeltSpeed", tunnelX + tunnelW / 2, tunnelY + tunnelH, "Temper1"),
      balloon(90, inY - 52, "FI", "201", "Tempering/Inlet/FlowKgH", 140, inY, "Inlet"),
      balloon(850, outY - 52, "FI", "205", "Tempering/Outlet/FlowKgH", 800, outY, "Outlet"),
      balloon(200, 352, "FI", "206", "Tempering/ChilledWater/FlowM3H", 200, tunnelY + tunnelH + 10, "ChilledWater"),
      balloon(480, 352, "TI", "207", "Tempering/ChilledWater/SupplyTempC", 480, tunnelY + tunnelH + 10, "ChilledWater"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--tempering is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Tempering Temper1 P and ID">
        <title>Heuvelland Tempering — Temper1</title>
        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">TMP-210</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Tempering / Temper1</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — TEMPERING TUNNEL</text>
        <text class="pid-sheet__sub" x="24" y="52">Mass in from Conching → three cooling zones → to Moulding</text>

        <text class="pid-flow-label" x="28" y="${inY - 10}" text-anchor="start">FROM CONCHE</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${inY}" x2="${tunnelX}" y2="${inY}" />
        ${flowArrow(95, inY)}
        ${mixValve(140, inY, "Tempering/Inlet/ValveOpen", "Inlet", "XV-201")}
        ${flange(tunnelX, inY)}

        <g class="pid-tunnel pid-equip--run" data-equip="Temper1" data-tag="Tempering/Temper1/Running" role="button" tabindex="0">
          <rect class="pid-tunnel__shell" x="${tunnelX}" y="${tunnelY}" width="${tunnelW}" height="${tunnelH}" rx="5" />
          ${zones}
          <line class="pid-tunnel__belt" x1="${tunnelX + 20}" y1="${midY}" x2="${tunnelX + tunnelW - 20}" y2="${midY}" />
          <text class="pid-equip__pid" x="${tunnelX + tunnelW / 2}" y="${tunnelY - 12}" text-anchor="middle">TMP-210</text>
          <text class="pid-equip__name" x="${tunnelX + tunnelW / 2}" y="${tunnelY + tunnelH + 22}" text-anchor="middle">Temper1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${tunnelX + tunnelW}" y1="${outY}" x2="920" y2="${outY}" />
        ${flange(tunnelX + tunnelW, outY)}
        ${mixValve(820, outY, "Tempering/Outlet/ValveOpen", "Outlet", "XV-205")}
        ${flowArrow(875, outY)}
        <text class="pid-flow-label" x="932" y="${outY - 10}" text-anchor="end">TO MOULD</text>

        <text class="pid-flow-label" x="28" y="352" text-anchor="start">CHILLED WATER</text>
        <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${tunnelX + 50}" y2="${tunnelY + tunnelH}" />
        ${flange(tunnelX + 50, tunnelY + tunnelH)}
        <line class="pid-pipe pid-pipe--divert" x1="${tunnelX + tunnelW - 50}" y1="${tunnelY + tunnelH}" x2="720" y2="352" />
        ${flange(tunnelX + tunnelW - 50, tunnelY + tunnelH)}

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildRefiningPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const machineX = 220;
    const machineY = 118;
    const machineW = 520;
    const machineH = 160;
    const midY = machineY + machineH / 2;
    const machineCx = machineX + machineW / 2;
    const rollW = machineW / 5;

    const rolls = [0, 1, 2, 3, 4].map((i) => {
      const x = machineX + 16 + i * (rollW - 4);
      return `<rect class="pid-refiner__roll" x="${x}" y="${machineY + 36}" width="${rollW - 20}" height="${machineH - 72}" rx="4" />`;
    }).join("");

    const balloons = [
      balloon(90, midY - 52, "FI", "121", "Refining/Inlet/FlowKgH", 140, midY, "Inlet"),
      balloon(machineCx - 80, 68, "SI", "120", "Refining/Refiner1/LoadPct", machineCx - 40, machineY, "Refiner1"),
      balloon(machineCx + 80, 68, "QI", "122", "Refining/Refiner1/ParticleUm", machineCx + 40, machineY, "Refiner1"),
      balloon(850, midY - 52, "FI", "125", "Refining/Outlet/FlowKgH", 800, midY, "Outlet"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--refining is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Refining Refiner1 P and ID">
        <title>Heuvelland Refining — Refiner1</title>
        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">REF-120</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Refining / Refiner1</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — FIVE-ROLL REFINER</text>
        <text class="pid-sheet__sub" x="24" y="52">Mass in from Mixing → Refiner1 → mass out to Conching</text>

        <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM MIX</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${machineX}" y2="${midY}" />
        ${flowArrow(95, midY)}
        ${mixValve(140, midY, "Refining/Inlet/ValveOpen", "Inlet", "XV-121")}
        ${flange(machineX, midY)}

        <g class="pid-refiner pid-equip--run" data-equip="Refiner1" data-tag="Refining/Refiner1/Running" role="button" tabindex="0">
          <rect class="pid-refiner__shell" x="${machineX}" y="${machineY}" width="${machineW}" height="${machineH}" rx="5" />
          ${rolls}
          <text class="pid-equip__pid" x="${machineCx}" y="${machineY - 12}" text-anchor="middle">REF-120</text>
          <text class="pid-equip__name" x="${machineCx}" y="${machineY + machineH + 22}" text-anchor="middle">Refiner1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${machineX + machineW}" y1="${midY}" x2="920" y2="${midY}" />
        ${flange(machineX + machineW, midY)}
        ${mixValve(820, midY, "Refining/Outlet/ValveOpen", "Outlet", "XV-125")}
        ${flowArrow(875, midY)}
        <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO CONCHE</text>

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildConchingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const tankX = 340;
    const tankY = 88;
    const tankW = 260;
    const tankH = 240;
    const tankCx = tankX + tankW / 2;
    const midY = tankY + tankH / 2;

    const balloons = [
      balloon(tankCx - 90, 52, "TI", "130", "Conching/Conche1/TempC", tankCx - 50, tankY, "Conche1"),
      balloon(tankCx + 90, 52, "SI", "130", "Conching/Conche1/AgitatorRpm", tankCx + 50, tankY, "Conche1"),
      balloon(tankCx + 110, 340, "CI", "130", "Conching/Conche1/TimeMin", tankCx + 50, tankY + tankH, "Conche1"),
      balloon(90, midY - 52, "FI", "131", "Conching/Inlet/FlowKgH", 140, midY, "Inlet"),
      balloon(850, midY - 52, "FI", "135", "Conching/Outlet/FlowKgH", 800, midY, "Outlet"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--conching is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Conching Conche1 P and ID">
        <title>Heuvelland Conching — Conche1</title>
        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">CON-130</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Conching / Conche1</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — CONCHE</text>
        <text class="pid-sheet__sub" x="24" y="52">Mass in from Refining → Conche1 → mass out to Tempering</text>

        <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM REFINE</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${tankX}" y2="${midY}" />
        ${flowArrow(95, midY)}
        ${mixValve(140, midY, "Conching/Inlet/ValveOpen", "Inlet", "XV-131")}
        ${flange(tankX, midY)}

        <g class="pid-tank pid-equip--run" data-equip="Conche1" data-tag="Conching/Conche1/Running" role="button" tabindex="0">
          <rect class="pid-tank__shell" x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="10" />
          <rect class="pid-tank__jacket" x="${tankX + 12}" y="${tankY + 12}" width="${tankW - 24}" height="${tankH - 24}" rx="5" />
          <line class="pid-tank__agitator" x1="${tankCx}" y1="${tankY + 32}" x2="${tankCx}" y2="${tankY + tankH - 32}" />
          <circle class="pid-tank__hub" cx="${tankCx}" cy="${tankY + 44}" r="8" />
          <line class="pid-tank__agitator" x1="${tankCx - 40}" y1="${tankY + 100}" x2="${tankCx + 40}" y2="${tankY + 100}" />
          <line class="pid-tank__agitator" x1="${tankCx - 40}" y1="${tankY + 150}" x2="${tankCx + 40}" y2="${tankY + 150}" />
          <text class="pid-equip__pid" x="${tankCx}" y="${tankY - 12}" text-anchor="middle">CON-130</text>
          <text class="pid-equip__name" x="${tankCx}" y="${tankY + tankH + 20}" text-anchor="middle">Conche1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${tankX + tankW}" y1="${midY}" x2="920" y2="${midY}" />
        ${flange(tankX + tankW, midY)}
        ${mixValve(820, midY, "Conching/Outlet/ValveOpen", "Outlet", "XV-135")}
        ${flowArrow(875, midY)}
        <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO TEMPER</text>

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildMouldingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const machineX = 250;
    const machineY = 120;
    const machineW = 460;
    const machineH = 150;
    const midY = machineY + machineH / 2;
    const machineCx = machineX + machineW / 2;

    const cavities = [0, 1, 2].map((i) => {
      const x = machineX + 80 + i * 110;
      return `<rect class="pid-moulder__cavity" x="${x}" y="${machineY + 48}" width="70" height="54" rx="3" />`;
    }).join("");

    const balloons = [
      balloon(90, midY - 52, "FI", "221", "Moulding/Inlet/FlowKgH", 140, midY, "Inlet"),
      balloon(machineCx - 100, 68, "SI", "220", "Moulding/Moulder1/CyclesPerMin", machineCx - 60, machineY, "Moulder1"),
      balloon(machineCx + 40, 68, "TI", "220", "Moulding/Moulder1/MouldTempC", machineCx + 20, machineY, "Moulder1"),
      balloon(480, 352, "TI", "226", "Moulding/Cooling/AirTempC", 480, machineY + machineH + 8, "Cooling"),
      balloon(850, midY - 52, "FI", "225", "Moulding/Outlet/FlowKgH", 800, midY, "Outlet"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--moulding is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Moulding Moulder1 P and ID">
        <title>Heuvelland Moulding — Moulder1</title>
        <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
        <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

        <g class="pid-titleblock">
          <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
          <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
          <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">MLD-220</text>
          <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
          <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
          <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Moulding / Moulder1</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — MOULDING</text>
        <text class="pid-sheet__sub" x="24" y="52">Mass in from Tempering → Moulder1 → bars to Packaging</text>

        <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM TEMPER</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${machineX}" y2="${midY}" />
        ${flowArrow(95, midY)}
        ${mixValve(140, midY, "Moulding/Inlet/ValveOpen", "Inlet", "XV-221")}
        ${flange(machineX, midY)}

        <g class="pid-moulder pid-equip--run" data-equip="Moulder1" data-tag="Moulding/Moulder1/Running" role="button" tabindex="0">
          <rect class="pid-moulder__shell" x="${machineX}" y="${machineY}" width="${machineW}" height="${machineH}" rx="5" />
          ${cavities}
          <text class="pid-equip__pid" x="${machineCx}" y="${machineY - 12}" text-anchor="middle">MLD-220</text>
          <text class="pid-equip__name" x="${machineCx}" y="${machineY + machineH + 22}" text-anchor="middle">Moulder1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${machineX + machineW}" y1="${midY}" x2="920" y2="${midY}" />
        ${flange(machineX + machineW, midY)}
        ${mixValve(820, midY, "Moulding/Outlet/ValveOpen", "Outlet", "XV-225")}
        ${flowArrow(875, midY)}
        <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO PACK</text>

        <text class="pid-flow-label" x="28" y="352" text-anchor="start">COOLING AIR</text>
        <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${machineX + 60}" y2="${machineY + machineH}" />
        ${flange(machineX + 60, machineY + machineH)}
        <line class="pid-pipe pid-pipe--divert" x1="${machineX + machineW - 60}" y1="${machineY + machineH}" x2="720" y2="352" />
        ${flange(machineX + machineW - 60, machineY + machineH)}

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildPid() {
    if (state.activeDrawing === "mixing") buildMixingPid();
    else if (state.activeDrawing === "refining") buildRefiningPid();
    else if (state.activeDrawing === "conching") buildConchingPid();
    else if (state.activeDrawing === "tempering") buildTemperingPid();
    else if (state.activeDrawing === "moulding") buildMouldingPid();
    else buildPackagingPid();
  }

  function clearPidHover() {
    document.querySelectorAll(".is-hover").forEach((el) => el.classList.remove("is-hover"));
    pidHover = null;
  }

  function applyPidHover(tagId, equip) {
    clearPidHover();
    const ek = equip || equipKeyForTag(tagId);
    pidHover = { tagId: tagId || null, equip: ek || null };
    if (ek) {
      document.querySelectorAll(`#plant-pid [data-equip="${ek}"]`).forEach((el) => el.classList.add("is-hover"));
    }
    if (tagId) {
      document.querySelectorAll(`#plant-pid [data-tag="${CSS.escape(tagId)}"]`).forEach((el) => el.classList.add("is-hover"));
      document.querySelectorAll(`#plant-tree .plant-tag[data-tag="${CSS.escape(tagId)}"]`).forEach((el) => el.classList.add("is-hover"));
    }
  }

  function paintPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;
    if (!pidBuilt) buildPid();

    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    const svg = host.querySelector(".pid-svg");
    if (!svg) return;
    const drawing = state.activeDrawing;
    const mixing = drawing === "mixing";
    const refining = drawing === "refining";
    const conching = drawing === "conching";
    const tempering = drawing === "tempering";
    const moulding = drawing === "moulding";
    const processArea = mixing || refining || conching || tempering || moulding;
    const mixOver = state.mixScenario === "overtemp";
    const mixValve = state.mixScenario === "valve";

    const temperWarm = state.temperScenario === "warm";
    const temperBelt = state.temperScenario === "belt";

    svg.classList.remove("is-running", "is-fault", "is-warn");
    if (mixing) svg.classList.add(mixOver ? "is-fault" : mixValve ? "is-warn" : "is-running");
    else if (tempering) svg.classList.add(temperWarm ? "is-fault" : temperBelt ? "is-warn" : "is-running");
    else if (refining || conching || moulding) svg.classList.add("is-running");
    else svg.classList.add(jam ? "is-fault" : starved ? "is-warn" : "is-running");

    const flow = svg.querySelector("[data-pid-flow]");
    if (flow) flow.style.display = (!processArea && !jam && !starved && !reducedMotion) ? "" : "none";

    if (mixing) {
      const tank = svg.querySelector(".pid-tank");
      if (tank) {
        tank.classList.remove("is-selected", "is-hover", "is-fault", "is-warn");
        if (state.selectedTag.startsWith("Mixing/Mixer1")) tank.classList.add("is-selected");
        if (mixOver) tank.classList.add("is-fault");
        else if (mixValve) tank.classList.add("is-warn");
      }
      const level = (live["Mixing/Mixer1/LevelPct"] || {}).value ?? 50;
      const levelEl = svg.querySelector("[data-pid-level]");
      if (levelEl) {
        const tankTop = Number(levelEl.getAttribute("data-tank-top") || 134);
        const tankH = Number(levelEl.getAttribute("data-tank-inner-h") || 172);
        const h = Math.max(8, (tankH * level) / 100);
        const top = tankTop + (tankH - h);
        levelEl.setAttribute("y", String(top));
        levelEl.setAttribute("height", String(h));
      }
      svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
        const tagId = g.getAttribute("data-tag");
        const open = !!(live[tagId] || {}).value;
        g.classList.toggle("is-open", open);
        g.classList.toggle("is-fault", mixValve && tagId === "Mixing/CocoaLiquor/ValveOpen");
        g.classList.toggle("is-selected", tagId === state.selectedTag);
        g.classList.remove("is-hover");
      });
    } else if (tempering) {
      const tunnel = svg.querySelector(".pid-tunnel");
      if (tunnel) {
        tunnel.classList.remove("is-selected", "is-hover", "is-fault", "is-warn");
        if (state.selectedTag.startsWith("Tempering/Temper1")) tunnel.classList.add("is-selected");
        if (temperWarm) tunnel.classList.add("is-fault");
        else if (temperBelt) tunnel.classList.add("is-warn");
      }
      svg.querySelectorAll(".pid-tunnel__zone").forEach((z) => {
        z.classList.toggle("is-warm", temperWarm);
      });
      const belt = svg.querySelector(".pid-tunnel__belt");
      if (belt) belt.classList.toggle("is-stopped", temperBelt);
      svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
        const tagId = g.getAttribute("data-tag");
        const open = !!(live[tagId] || {}).value;
        g.classList.toggle("is-open", open);
        g.classList.toggle("is-selected", tagId === state.selectedTag);
        g.classList.remove("is-hover");
      });
    } else if (refining || conching || moulding) {
      const equipSel = refining
        ? "Refining/Refiner1"
        : conching
          ? "Conching/Conche1"
          : "Moulding/Moulder1";
      const equipEl = svg.querySelector(
        refining ? ".pid-refiner" : conching ? ".pid-tank" : ".pid-moulder"
      );
      if (equipEl) {
        equipEl.classList.remove("is-selected", "is-hover", "is-fault", "is-warn");
        if (state.selectedTag.startsWith(equipSel)) equipEl.classList.add("is-selected");
      }
      svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
        const tagId = g.getAttribute("data-tag");
        const open = !!(live[tagId] || {}).value;
        g.classList.toggle("is-open", open);
        g.classList.toggle("is-selected", tagId === state.selectedTag);
        g.classList.remove("is-hover");
      });
    } else {
      EQUIPMENT.forEach((eq) => {
        const g = svg.querySelector(`.pid-equip[data-equip="${eq.id}"]`);
        if (!g) return;
        const st = equipState(eq.id);
        g.classList.remove("pid-equip--run", "pid-equip--fault", "pid-equip--warn", "pid-equip--idle", "is-selected", "is-hover");
        g.classList.add(`pid-equip--${st}`);
        if (state.selectedTag.startsWith(eq.id + "/") || state.selectedTag === `${eq.id}/Running`) {
          g.classList.add("is-selected");
        }
      });

      const rejectActive = !!(live["Checkweigher/Reject/Active"] || {}).value;
      const rejectSel = state.selectedTag.startsWith("Checkweigher/Reject");
      const valve = svg.querySelector(".pid-valve");
      const bin = svg.querySelector(".pid-bin");
      if (valve) {
        valve.classList.toggle("is-active", rejectActive);
        valve.classList.toggle("is-selected", rejectSel);
        valve.classList.remove("is-hover");
      }
      if (bin) {
        bin.classList.toggle("is-selected", rejectSel);
        bin.classList.remove("is-hover");
        const count = bin.querySelector("[data-pid-reject-count]");
        if (count) count.textContent = String(Math.round(live["Checkweigher/Reject/Count"]?.value ?? state.rejectCount));
      }
    }

    svg.querySelectorAll(".pid-balloon").forEach((g) => {
      const tagId = g.getAttribute("data-tag");
      const q = (live[tagId] || {}).quality || "Stale";
      g.classList.remove("pid-q--good", "pid-q--uncertain", "pid-q--bad", "pid-q--stale", "is-selected", "is-hover");
      g.classList.add(`pid-q--${q.toLowerCase()}`);
      if (tagId === state.selectedTag) g.classList.add("is-selected");
      const valEl = g.querySelector("[data-pid-val]");
      if (valEl) valEl.textContent = liveReadout(tagId);
    });

    if (pidHover) applyPidHover(pidHover.tagId, pidHover.equip);
  }

  function renderPid() {
    paintPid();
  }

  function renderKpis() {
    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    const drawing = state.activeDrawing;
    const mixing = drawing === "mixing";
    const refining = drawing === "refining";
    const conching = drawing === "conching";
    const tempering = drawing === "tempering";
    const moulding = drawing === "moulding";
    const packaging = drawing === "packaging";
    const mixOver = state.mixScenario === "overtemp";
    const mixValve = state.mixScenario === "valve";
    const setKpi = (id, text, tone) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.removeAttribute("data-tone");
      if (tone) el.setAttribute("data-tone", tone);
    };
    const setLabel = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    const temperWarm = state.temperScenario === "warm";
    const temperBelt = state.temperScenario === "belt";
    const feedStarved = starved || state.mixScenario != null || temperBelt;

    if (mixing) {
      const level = live["Mixing/Mixer1/LevelPct"]?.value ?? 0;
      const jacket = live["Mixing/Mixer1/JacketTempC"]?.value ?? 0;
      const rpm = live["Mixing/Mixer1/AgitatorRpm"]?.value ?? 0;
      setLabel("kpi-a-label", "Level");
      setLabel("kpi-b-label", "Jacket");
      setLabel("kpi-c-label", "RPM");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", `${level.toFixed(1)}%`, mixValve ? "warn" : level > 88 ? "warn" : "good");
      setKpi("kpi-b", `${jacket.toFixed(1)}°C`, mixOver || jacket > 52 ? "bad" : "good");
      setKpi("kpi-c", String(Math.round(rpm)), mixOver || mixValve ? "warn" : "good");
      setKpi("kpi-d", String(live["Mixing/Mode"]?.value ?? "—"), mixOver ? "bad" : mixValve ? "warn" : "good");
    } else if (refining) {
      const load = live["Refining/Refiner1/LoadPct"]?.value ?? 0;
      const particle = live["Refining/Refiner1/ParticleUm"]?.value ?? 0;
      const outFlow = live["Refining/Outlet/FlowKgH"]?.value ?? 0;
      const mode = live["Refining/Mode"]?.value ?? "—";
      const starvedRefine = mode === "STARVED";
      setLabel("kpi-a-label", "Load");
      setLabel("kpi-b-label", "Particle");
      setLabel("kpi-c-label", "Outlet");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", `${load.toFixed(1)}%`, starvedRefine ? "warn" : "good");
      setKpi("kpi-b", `${particle.toFixed(1)} µm`, starvedRefine ? "warn" : "good");
      setKpi("kpi-c", String(Math.round(outFlow)), starvedRefine ? "warn" : "good");
      setKpi("kpi-d", String(mode), starvedRefine ? "warn" : "good");
    } else if (conching) {
      const temp = live["Conching/Conche1/TempC"]?.value ?? 0;
      const rpm = live["Conching/Conche1/AgitatorRpm"]?.value ?? 0;
      const timeMin = live["Conching/Conche1/TimeMin"]?.value ?? 0;
      const mode = live["Conching/Mode"]?.value ?? "—";
      const starvedConche = mode === "STARVED";
      setLabel("kpi-a-label", "Temp");
      setLabel("kpi-b-label", "RPM");
      setLabel("kpi-c-label", "Time");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", `${temp.toFixed(1)}°C`, starvedConche ? "warn" : "good");
      setKpi("kpi-b", String(Math.round(rpm)), starvedConche ? "warn" : "good");
      setKpi("kpi-c", `${Math.round(timeMin)} min`, "good");
      setKpi("kpi-d", String(mode), starvedConche ? "warn" : "good");
    } else if (tempering) {
      const z1 = live["Tempering/Temper1/Zone1TempC"]?.value ?? 0;
      const z3 = live["Tempering/Temper1/Zone3TempC"]?.value ?? 0;
      const belt = live["Tempering/Temper1/BeltSpeed"]?.value ?? 0;
      const temperStarve = state.mixScenario != null;
      setLabel("kpi-a-label", "Zone1");
      setLabel("kpi-b-label", "Zone3");
      setLabel("kpi-c-label", "Belt");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", `${z1.toFixed(1)}°C`, temperWarm ? "bad" : "good");
      setKpi("kpi-b", `${z3.toFixed(1)}°C`, temperWarm ? "bad" : "good");
      setKpi("kpi-c", `${belt.toFixed(1)}`, temperBelt ? "bad" : temperStarve ? "warn" : "good");
      setKpi("kpi-d", String(live["Tempering/Mode"]?.value ?? "—"), temperWarm ? "bad" : temperBelt || temperStarve ? "warn" : "good");
    } else if (moulding) {
      const cycles = live["Moulding/Moulder1/CyclesPerMin"]?.value ?? 0;
      const mouldTemp = live["Moulding/Moulder1/MouldTempC"]?.value ?? 0;
      const airTemp = live["Moulding/Cooling/AirTempC"]?.value ?? 0;
      const mode = live["Moulding/Mode"]?.value ?? "—";
      const starvedMould = mode === "STARVED";
      setLabel("kpi-a-label", "Cycles");
      setLabel("kpi-b-label", "Mould °C");
      setLabel("kpi-c-label", "Air °C");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", String(Math.round(cycles)), starvedMould ? "warn" : "good");
      setKpi("kpi-b", `${mouldTemp.toFixed(1)}°C`, starvedMould ? "warn" : "good");
      setKpi("kpi-c", `${airTemp.toFixed(1)}°C`, starvedMould ? "warn" : "good");
      setKpi("kpi-d", String(mode), starvedMould ? "warn" : "good");
    } else {
      const oee = live.OEE?.value ?? 0;
      setLabel("kpi-a-label", "OEE");
      setLabel("kpi-b-label", "Thru");
      setLabel("kpi-c-label", "Mode");
      setLabel("kpi-d-label", "Rejects");
      setKpi("kpi-a", `${oee.toFixed(1)}%`, jam ? "bad" : feedStarved ? "warn" : oee >= 80 ? "good" : "warn");
      setKpi("kpi-b", String(Math.round(live.Throughput?.value ?? 0)), jam ? "bad" : feedStarved ? "warn" : "good");
      setKpi("kpi-c", String(live.Mode?.value ?? "—"), jam ? "bad" : feedStarved ? "warn" : "good");
      setKpi("kpi-d", String(Math.round(live["Checkweigher/Reject/Count"]?.value ?? 0)), "warn");
    }

    const pkgToolbar = document.querySelector('[data-toolbar-area="packaging"]');
    const mixToolbar = document.querySelector('[data-toolbar-area="mixing"]');
    const temperToolbar = document.querySelector('[data-toolbar-area="tempering"]');
    if (pkgToolbar) pkgToolbar.hidden = !packaging;
    if (mixToolbar) mixToolbar.hidden = !mixing;
    if (temperToolbar) temperToolbar.hidden = !tempering;
    document.querySelectorAll("[data-toolbar-packaging-only]").forEach((el) => {
      el.hidden = !packaging;
    });

    document.querySelectorAll("[data-scenario]").forEach((btn) => {
      const sc = btn.getAttribute("data-scenario");
      const active = sc === "recover" ? state.scenario === null : state.scenario === sc;
      btn.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-mix-scenario]").forEach((btn) => {
      const sc = btn.getAttribute("data-mix-scenario");
      const active = sc === "recover" ? state.mixScenario === null : state.mixScenario === sc;
      btn.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-temper-scenario]").forEach((btn) => {
      const sc = btn.getAttribute("data-temper-scenario");
      const active = sc === "recover" ? state.temperScenario === null : state.temperScenario === sc;
      btn.classList.toggle("is-active", active);
    });

    const titleMap = {
      mixing: "Heuvelland · Mixing",
      refining: "Heuvelland · Refining",
      conching: "Heuvelland · Conching",
      tempering: "Heuvelland · Tempering",
      moulding: "Heuvelland · Moulding",
      packaging: "Heuvelland · Line 3",
    };
    const title = document.querySelector(".plant-hmi__title h1");
    if (title) title.textContent = titleMap[drawing] || titleMap.packaging;

    document.querySelectorAll(".plant-area-nav__btn[data-drawing]").forEach((btn) => {
      const d = btn.getAttribute("data-drawing");
      const on = d === state.activeDrawing;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    const scanDot = document.getElementById("plant-scan-dot");
    const scanLabel = document.getElementById("plant-scan-label");
    if (scanDot && scanLabel) {
      scanDot.classList.remove("is-fault", "is-warn");
      if (mixing && mixOver) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Overtemp"; }
      else if (mixing && mixValve) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Valve fault"; }
      else if (tempering && temperWarm) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Zone warm"; }
      else if (tempering && temperBelt) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Belt stop"; }
      else if (packaging && jam) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Fault"; }
      else if (packaging && feedStarved) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved"; }
      else {
        const healthyLabels = {
          mixing: "Mixing",
          refining: "Refining",
          conching: "Conching",
          tempering: "Tempering",
          moulding: "Moulding",
          packaging: "Scanning",
        };
        scanLabel.textContent = healthyLabels[drawing] || "Scanning";
      }
    }
  }

  function renderDetail() {
    const el = document.getElementById("plant-detail");
    if (!el) return;
    const def = TAG_BY_ID[state.selectedTag];
    const lv = live[state.selectedTag];
    if (!def || !lv) {
      el.innerHTML = `<p class="plant-detail__empty">Select a tag in the browser or on the P&amp;ID.</p>`;
      return;
    }
    const folder = (() => {
      if (isSisterSiteTag(state.selectedTag)) {
        return state.selectedTag.split("/")[0];
      }
      if (isProcessAreaTag(state.selectedTag)) {
        const parts = state.selectedTag.split("/");
        return parts.length > 2 ? parts.slice(0, -1).join(" / ") : parts[0];
      }
      if (isStubTag(state.selectedTag)) {
        const parts = state.selectedTag.split("/");
        return parts.length > 2 ? parts.slice(0, -1).join(" / ") : parts[0];
      }
      return state.selectedTag.includes("/")
        ? state.selectedTag.split("/").slice(0, -1).join(" / ")
        : "Line3";
    })();
    el.innerHTML = `
      <div class="plant-detail__compact">
        <span class="plant-detail__path" title="${escapeHtml(pathOf(def.id))}">${escapeHtml(pathOf(def.id))}</span>
        <span class="plant-detail__chips">
          <strong class="plant-detail__val">${escapeHtml(formatValue(def, lv.value))}</strong>
          <span class="plant-q plant-q--${escapeHtml(lv.quality.toLowerCase())}">${escapeHtml(lv.quality)}</span>
          <span class="plant-detail__muted">${escapeHtml(def.type)}${def.unit ? ` · ${escapeHtml(def.unit)}` : ""} · ${escapeHtml(folder)}</span>
        </span>
      </div>`;
  }

  function renderAlarms() {
    const list = document.getElementById("plant-alarms");
    const count = document.getElementById("plant-alarm-count");
    if (!list) return;
    if (count) count.textContent = String(state.alarms.length);

    if (!state.alarms.length) {
      list.innerHTML = `<li class="plant-alarms-empty">No active alarms · line healthy</li>`;
      return;
    }

    list.innerHTML = state.alarms
      .slice()
      .sort((a, b) => Number(a.acked) - Number(b.acked) || b.ts - a.ts)
      .map((a) => {
        const acked = a.acked ? " is-acked" : "";
        const ackBtn = a.acked
          ? ""
          : `<div class="plant-alarm__ack"><button type="button" class="plant-btn plant-btn--ghost" data-ack="${escapeHtml(a.id)}">Ack</button></div>`;
        return `<li class="plant-alarm${acked}" data-sev="${escapeHtml(a.severity)}">
          <div class="plant-alarm__top">
            <span class="plant-alarm__sev">${escapeHtml(a.severity)}</span>
            <span class="font-mono text-[10px] text-slate-500">${escapeHtml(timeAgo(a.ts))}</span>
          </div>
          <p class="plant-alarm__msg">${escapeHtml(a.message)}</p>
          <p class="plant-alarm__path">${escapeHtml(a.path)}</p>
          ${ackBtn}
        </li>`;
      })
      .join("");
  }

  function updateAlarmTimes() {
    const sorted = state.alarms.slice().sort((x, y) => Number(x.acked) - Number(y.acked) || y.ts - x.ts);
    document.querySelectorAll("#plant-alarms .plant-alarm").forEach((el, i) => {
      const a = sorted[i];
      if (!a) return;
      const t = el.querySelector(".plant-alarm__top span:last-child");
      if (t) t.textContent = timeAgo(a.ts);
    });
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 5) return "now";
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  }

  function renderAll(opts) {
    const forceAlarms = !opts || opts.alarms !== false;
    renderTree();
    renderPid();
    renderKpis();
    renderDetail();
    if (forceAlarms || tick % 5 === 0 || tick <= 1) renderAlarms();
    else updateAlarmTimes();
  }

  /* ---------------- Actions ---------------- */

  function setScenario(name) {
    if (name === "recover") {
      state.scenario = null;
      state.cartonerJamCleared = false;
    } else if (name === "jam") {
      state.scenario = "jam";
      state.cartonerJamCleared = false;
    } else if (name === "starved") {
      state.scenario = "starved";
      state.cartonerJamCleared = false;
    }
    saveState();
    computeLive();
    renderAll();
  }

  function setMixScenario(name) {
    if (name === "recover") state.mixScenario = null;
    else if (name === "overtemp" || name === "valve") state.mixScenario = name;
    saveState();
    computeLive();
    renderAll();
  }

  function setTemperScenario(name) {
    if (name === "recover") state.temperScenario = null;
    else if (name === "warm" || name === "belt") state.temperScenario = name;
    saveState();
    computeLive();
    renderAll();
  }

  const DRAWING_HOME_TAG = {
    packaging: "OEE",
    mixing: "Mixing/Mixer1/LevelPct",
    refining: "Refining/Refiner1/LoadPct",
    conching: "Conching/Conche1/TempC",
    tempering: "Tempering/Temper1/Zone1TempC",
    moulding: "Moulding/Moulder1/CyclesPerMin",
  };

  function setActiveDrawing(name) {
    if (!DRAWING_HOME_TAG[name]) return;
    if (name === state.activeDrawing && drawingForTag(state.selectedTag) === name) {
      renderKpis();
      return;
    }
    selectTag(DRAWING_HOME_TAG[name]);
  }

  function ackAll() {
    state.alarms = state.alarms.map((a) => ({ ...a, acked: true }));
    saveState();
    renderAlarms();
  }

  function ackOne(id) {
    state.alarms = state.alarms.map((a) => (a.id === id ? { ...a, acked: true } : a));
    saveState();
    renderAlarms();
  }

  function resetReject() {
    state.rejectCount = 0;
    saveState();
    computeLive();
    renderAll();
  }

  function clearCartonerJam() {
    if (state.scenario === "jam") {
      state.cartonerJamCleared = true;
      state.scenario = null;
      state.alarms = state.alarms.filter((a) => a.id !== "alm-cartoner-jam");
    }
    saveState();
    computeLive();
    renderAll();
  }

  function resetLine() {
    state = defaultState();
    saveState();
    tick = 0;
    treeBuilt = false;
    pidBuilt = false;
    clearPidHover();
    computeLive();
    renderAll();
  }

  function selectTag(id) {
    if (!id || !TAG_BY_ID[id]) return;
    const nextDrawing = drawingForTag(id);
    if (nextDrawing && nextDrawing !== state.activeDrawing) {
      state.activeDrawing = nextDrawing;
      pidBuilt = false;
      clearPidHover();
    }
    state.selectedTag = id;
    const open = new Set(state.openNodes);
    open.add(EDGE_ROOT);
    if (isSisterSiteTag(id)) {
      open.add(id.split("/")[0]);
    } else if (isProcessAreaTag(id)) {
      open.add(SITE);
      const parts = id.split("/");
      let acc = SITE;
      for (let i = 0; i < parts.length - 1; i++) {
        acc += "/" + parts[i];
        open.add(acc);
      }
    } else {
      open.add(SITE);
      open.add(AREA_ROOT);
      if (isStubTag(id)) {
        const parts = id.split("/");
        let acc = AREA_ROOT;
        for (let i = 0; i < parts.length - 1; i++) {
          acc += "/" + parts[i];
          open.add(acc);
        }
      } else {
        open.add(`${AREA_ROOT}/${LIVE_LINE}`);
        const parts = id.split("/");
        let acc = `${AREA_ROOT}/${LIVE_LINE}`;
        for (let i = 0; i < parts.length - 1; i++) {
          acc += "/" + parts[i];
          open.add(acc);
        }
      }
    }
    state.openNodes = [...open];
    saveState();
    treeBuilt = false;
    renderTree();
    paintPid();
    renderKpis();
    renderDetail();
  }

  /* ---------------- Wire ---------------- */

  function wire() {
    const tree = document.getElementById("plant-tree");
    tree?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (btn && btn.getAttribute("data-tag")) {
        selectTag(btn.getAttribute("data-tag"));
        return;
      }
      const areaLi = e.target.closest("li[data-drawing]");
      if (areaLi && e.target.closest("summary") && areaLi.querySelector(":scope > details > summary")?.contains(e.target)) {
        const drawing = areaLi.getAttribute("data-drawing");
        if (drawing) setActiveDrawing(drawing);
      }
    });

    tree?.addEventListener("toggle", (e) => {
      const det = e.target;
      if (!(det instanceof HTMLDetailsElement)) return;
      const node = det.getAttribute("data-node");
      if (!node) return;
      const open = new Set(state.openNodes);
      if (det.open) open.add(node);
      else open.delete(node);
      state.openNodes = [...open];
      saveState();
    }, true);

    tree?.addEventListener("pointerover", (e) => {
      const btn = e.target.closest(".plant-tag[data-tag]");
      if (!btn) return;
      const id = btn.getAttribute("data-tag");
      if (!id || isStubTag(id)) {
        clearPidHover();
        return;
      }
      if (drawingForTag(id) !== state.activeDrawing) {
        clearPidHover();
        return;
      }
      if (id) applyPidHover(id, equipKeyForTag(id));
    });
    tree?.addEventListener("pointerout", (e) => {
      if (!e.relatedTarget || !tree.contains(e.relatedTarget)) clearPidHover();
    });

    const pid = document.getElementById("plant-pid");
    pid?.addEventListener("click", (e) => {
      const hit = e.target.closest("[data-tag]");
      if (hit && hit.getAttribute("data-tag")) selectTag(hit.getAttribute("data-tag"));
    });

    pid?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = e.target.closest("[data-tag]");
      if (hit && hit.getAttribute("data-tag")) {
        e.preventDefault();
        selectTag(hit.getAttribute("data-tag"));
      }
    });

    pid?.addEventListener("pointerover", (e) => {
      const hit = e.target.closest("[data-tag], [data-equip]");
      if (!hit) return;
      applyPidHover(hit.getAttribute("data-tag"), hit.getAttribute("data-equip"));
    });
    pid?.addEventListener("pointerout", (e) => {
      if (!e.relatedTarget || !pid.contains(e.relatedTarget)) clearPidHover();
    });

    document.querySelector(".plant-toolbar")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action], [data-scenario], [data-mix-scenario], [data-temper-scenario]");
      if (!btn) return;
      const sc = btn.getAttribute("data-scenario");
      const mixSc = btn.getAttribute("data-mix-scenario");
      const temperSc = btn.getAttribute("data-temper-scenario");
      if (sc) { setScenario(sc); return; }
      if (mixSc) { setMixScenario(mixSc); return; }
      if (temperSc) { setTemperScenario(temperSc); return; }
      const action = btn.getAttribute("data-action");
      if (action === "ack-all") ackAll();
      else if (action === "reset-reject") resetReject();
      else if (action === "clear-jam") clearCartonerJam();
      else if (action === "reset-line") resetLine();
    });

    document.querySelector(".plant-area-nav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-drawing]");
      if (!btn) return;
      setActiveDrawing(btn.getAttribute("data-drawing"));
    });

    document.getElementById("plant-alarms")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ack]");
      if (btn) ackOne(btn.getAttribute("data-ack"));
    });
  }

  function tickOnce() {
    tick += 1;
    computeLive();
    saveState();
    renderAll({ alarms: false });
  }

  function startClock() {
    const el = document.getElementById("plant-clock");
    const paint = () => {
      if (!el) return;
      el.textContent = new Date().toLocaleTimeString(undefined, { hour12: false });
    };
    paint();
    setInterval(paint, 1000);
  }

  function init() {
    const root = document.getElementById("plant-app");
    if (!root) return;
    root.hidden = false;
    const noscript = document.getElementById("plant-noscript");
    if (noscript) noscript.hidden = true;

    wire();
    startClock();
    computeLive();
    renderAll();
    timer = setInterval(tickOnce, TICK_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
