/* =============================================================
   plant.js — Heuvelland chocolate plant HMI (/plant/)
   Site → Packaging + Mixing tag browser; drawings switch by selection.
   Packaging Line1/Line2: live tags only (no drawing yet).
   State persists in localStorage until "Reset line".
   ============================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "samdonche.plant.v6";
  const TICK_MS = 1000;
  const PROVIDER = "[edge]";
  const SITE = "Heuvelland";
  const AREA = "Packaging";
  const MIXING_AREA = "Mixing";
  const TEMPERING_AREA = "Tempering";
  const LIVE_LINE = "Line3";
  const AREA_ROOT = `${SITE}/${AREA}`;
  const MIXING_ROOT = `${SITE}/${MIXING_AREA}`;
  const TEMPERING_ROOT = `${SITE}/${TEMPERING_AREA}`;

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

  /** Tempering tags — cooling tunnel Temper1. */
  const TEMPERING_TAGS = [
    { id: "Tempering/Running", name: "Running", type: "bool", live: true },
    { id: "Tempering/Mode", name: "Mode", type: "string", live: true },

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

  /** Prefixed stub tags: Line1/OEE, Line2/Infeed/Speed, … */
  const STUB_TAGS = STUB_LINES.flatMap((line) =>
    STUB_LINE_TAGS.map((t) => ({ ...t, id: `${line.id}/${t.id}` }))
  );

  const ALL_TAGS = LINE3_TAGS.concat(STUB_TAGS, MIXING_TAGS, TEMPERING_TAGS);
  const TAG_BY_ID = Object.fromEntries(ALL_TAGS.map((t) => [t.id, t]));

  function isStubTag(rel) {
    return rel.startsWith("Line1/") || rel.startsWith("Line2/");
  }

  function isMixingTag(rel) {
    return !!rel && rel.startsWith("Mixing/");
  }

  function isTemperingTag(rel) {
    return !!rel && rel.startsWith("Tempering/");
  }

  function drawingForTag(rel) {
    if (isMixingTag(rel)) return "mixing";
    if (isTemperingTag(rel)) return "tempering";
    return "packaging";
  }

  function pathOf(rel) {
    if (isMixingTag(rel) || isTemperingTag(rel)) return `${PROVIDER}${SITE}/${rel}`;
    if (isStubTag(rel)) return `${PROVIDER}${AREA_ROOT}/${rel}`;
    return `${PROVIDER}${AREA_ROOT}/${LIVE_LINE}/${rel}`;
  }

  /** Default open folders in the nested tree (node keys). */
  const DEFAULT_OPEN = [
    SITE,
    AREA_ROOT,
    `${AREA_ROOT}/Line3`,
    `${AREA_ROOT}/Line3/Cartoner`,
    `${AREA_ROOT}/Line3/Checkweigher`,
    MIXING_ROOT,
    `${MIXING_ROOT}/Mixer1`,
    TEMPERING_ROOT,
    `${TEMPERING_ROOT}/Temper1`,
  ];

  function defaultState() {
    return {
      scenario: /** @type {null|"jam"|"starved"} */ (null),
      mixScenario: /** @type {null|"overtemp"|"valve"} */ (null),
      cartonerJamCleared: false,
      rejectCount: 12,
      underCount: 3,
      overCount: 1,
      palletsDone: 47,
      selectedTag: "OEE",
      activeDrawing: /** @type {"packaging"|"mixing"|"tempering"} */ ("packaging"),
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
        activeDrawing: ["packaging", "mixing", "tempering"].includes(parsed.activeDrawing)
          ? parsed.activeDrawing
          : drawingForTag(TAG_BY_ID[parsed.selectedTag] ? parsed.selectedTag : base.selectedTag),
        mixScenario: parsed.mixScenario === "overtemp" || parsed.mixScenario === "valve"
          ? parsed.mixScenario
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
    const lineOk = !jam && !starved;

    const speedSp = 120;
    const cartonerSpeed = jam ? 0 : starved ? drift(38, 4, 1) : drift(118, 3, 1);
    const infeedSpeed = starved ? drift(4, 1.2, 2) : jam ? drift(22, 3, 2) : drift(28, 1.5, 2);
    const caseSpeed = jam ? 0 : starved ? drift(9, 1, 3) : drift(29.5, 0.8, 3);
    const oee = jam ? drift(42, 2, 0) : starved ? drift(61, 2.5, 0) : drift(87.4, 1.2, 0);
    const throughput = jam ? 0 : starved ? drift(36, 3, 4) : drift(116, 2.5, 4);
    const weight = jam ? 0 : drift(0.452, 0.008, 5);

    if (lineOk && Math.random() < 0.08) state.rejectCount += 1;
    if (lineOk && Math.random() < 0.03) state.underCount += 1;
    if (lineOk && tick % 48 === 0) state.palletsDone += 1;

    const photoIn = !starved && Math.random() > 0.15;
    const photoOut = lineOk && Math.random() > 0.25;
    const rejectActive = !lineOk ? false : Math.random() < 0.04;

    live = {
      Running: { value: lineOk, quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      Mode: { value: jam ? "FAULT" : starved ? "STARVED" : "AUTO", quality: jam ? "Bad" : "Good" },
      OEE: { value: clamp(oee, 0, 100), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      Throughput: { value: Math.max(0, throughput), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      SpeedSP: { value: speedSp, quality: "Good" },

      "Infeed/Running": { value: !starved, quality: starved ? "Uncertain" : "Good" },
      "Infeed/Speed": { value: Math.max(0, infeedSpeed), quality: starved ? "Uncertain" : "Good" },
      "Infeed/Jam": { value: false, quality: "Good" },
      "Infeed/Photoeye": { value: photoIn, quality: starved ? "Uncertain" : "Good" },
      "Infeed/Starved": { value: starved, quality: starved ? "Uncertain" : "Good" },

      "Cartoner/Running": { value: !jam && !starved, quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Cartoner/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Cartoner/Jam": { value: jam, quality: jam ? "Bad" : "Good" },
      "Cartoner/CartonsPerMin": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Cartoner/FaultCode": { value: jam ? 41 : 0, quality: jam ? "Bad" : "Good" },

      "Checkweigher/Running": { value: !jam, quality: jam ? "Stale" : starved ? "Uncertain" : "Good" },
      "Checkweigher/WeightKg": { value: Math.max(0, weight), quality: jam ? "Stale" : "Good" },
      "Checkweigher/InSpec": { value: !rejectActive && !jam, quality: jam ? "Stale" : "Good" },
      "Checkweigher/UnderCount": { value: state.underCount, quality: "Good" },
      "Checkweigher/OverCount": { value: state.overCount, quality: "Good" },

      "Checkweigher/Reject/Count": { value: state.rejectCount, quality: "Good" },
      "Checkweigher/Reject/Active": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },
      "Checkweigher/Reject/Divert": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },

      "CasePacker/Running": { value: !jam && !starved, quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "CasePacker/Speed": { value: Math.max(0, caseSpeed * 4), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "CasePacker/CasesPerMin": { value: Math.max(0, caseSpeed), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "CasePacker/Jam": { value: false, quality: "Good" },

      "Palletizer/Running": { value: !jam && !starved, quality: jam ? "Stale" : starved ? "Uncertain" : "Good" },
      "Palletizer/Layers": { value: jam ? 0 : Math.floor(((tick / 6) % 8) + 1), quality: jam ? "Stale" : "Good" },
      "Palletizer/PalletsDone": { value: state.palletsDone, quality: "Good" },
      "Palletizer/Jam": { value: false, quality: "Good" },

      "Outfeed/Running": { value: !jam && !starved, quality: jam ? "Stale" : starved ? "Uncertain" : "Good" },
      "Outfeed/Occupied": { value: photoOut, quality: jam ? "Stale" : "Good" },
      "Outfeed/Photoeye": { value: photoOut, quality: jam ? "Stale" : "Good" },
    };

    /* Sibling lines: independent healthy drift (scenarios only hit Line3). */
    STUB_LINES.forEach((line) => {
      const oee = clamp(drift(line.oeeBase, 1.4, line.phase), 0, 100);
      const thru = Math.max(0, drift(line.thruBase, 2.2, line.phase + 2));
      const infeed = Math.max(0, drift(24 + line.phase * 0.1, 1.4, line.phase + 4));
      const photo = Math.random() > 0.18;
      const occ = Math.random() > 0.3;
      const p = `${line.id}/`;
      live[`${p}Running`] = { value: true, quality: "Good" };
      live[`${p}Mode`] = { value: "AUTO", quality: "Good" };
      live[`${p}OEE`] = { value: oee, quality: "Good" };
      live[`${p}Throughput`] = { value: thru, quality: "Good" };
      live[`${p}SpeedSP`] = { value: line.speedSp, quality: "Good" };
      live[`${p}Infeed/Running`] = { value: true, quality: "Good" };
      live[`${p}Infeed/Speed`] = { value: infeed, quality: "Good" };
      live[`${p}Infeed/Photoeye`] = { value: photo, quality: "Good" };
      live[`${p}Outfeed/Running`] = { value: true, quality: "Good" };
      live[`${p}Outfeed/Occupied`] = { value: occ, quality: "Good" };
    });

    /* Mixing — chocolate mass mixer. */
    const mixOver = state.mixScenario === "overtemp";
    const mixValve = state.mixScenario === "valve";
    const mixFault = mixOver || mixValve;
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
    const outFlow = outletOpen ? Math.max(0, drift(980, 50, 13)) : 0;
    const batchN = 1400 + Math.floor(tick / 90);
    const mixMode = mixOver ? "FAULT" : mixValve ? "HOLD" : "AUTO";
    const mixQ = mixOver ? "Bad" : mixValve ? "Uncertain" : "Good";
    live["Mixing/Running"] = { value: mixRun, quality: mixQ };
    live["Mixing/Mode"] = { value: mixMode, quality: mixQ };
    live["Mixing/BatchId"] = { value: `B-${batchN}`, quality: "Good" };
    live["Mixing/Mixer1/Running"] = { value: mixRun, quality: mixQ };
    live["Mixing/Mixer1/LevelPct"] = { value: level, quality: mixValve ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/AgitatorRpm"] = { value: rpm, quality: mixFault ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/JacketTempC"] = { value: jacket, quality: mixOver ? "Bad" : jacket > 52 ? "Uncertain" : "Good" };
    live["Mixing/Mixer1/MassTempC"] = { value: massT, quality: mixOver ? "Bad" : "Good" };
    live["Mixing/CocoaLiquor/ValveOpen"] = { value: cocoaOpen, quality: mixValve ? "Bad" : "Good" };
    live["Mixing/CocoaLiquor/FlowKgH"] = { value: cocoaFlow, quality: mixValve ? "Bad" : "Good" };
    live["Mixing/Sugar/ValveOpen"] = { value: sugarOpen, quality: "Good" };
    live["Mixing/Sugar/FlowKgH"] = { value: sugarFlow, quality: "Good" };
    live["Mixing/Outlet/ValveOpen"] = { value: outletOpen, quality: "Good" };
    live["Mixing/Outlet/FlowKgH"] = { value: outFlow, quality: "Good" };
    live["Mixing/Drain/ValveOpen"] = { value: false, quality: "Good" };

    /* Tempering — cooling tunnel (downstream of Mixing). */
    const temperRun = true;
    const z1 = clamp(drift(32.5, 0.8, 14), 28, 36);
    const z2 = clamp(drift(29.0, 0.7, 15), 26, 33);
    const z3 = clamp(drift(27.2, 0.6, 16), 24, 31);
    const massOut = clamp(drift(28.4, 0.5, 17), 25, 32);
    const belt = clamp(drift(4.2, 0.25, 18), 2.5, 6);
    const inOpen = true;
    const outOpen = true;
    const inFlow = Math.max(0, drift(960, 40, 19));
    const tOutFlow = Math.max(0, drift(950, 35, 20));
    const cwFlow = clamp(drift(12.5, 0.8, 21), 8, 18);
    const cwSupply = clamp(drift(6.5, 0.4, 22), 4, 9);
    live["Tempering/Running"] = { value: temperRun, quality: "Good" };
    live["Tempering/Mode"] = { value: "AUTO", quality: "Good" };
    live["Tempering/Temper1/Running"] = { value: temperRun, quality: "Good" };
    live["Tempering/Temper1/BeltSpeed"] = { value: belt, quality: "Good" };
    live["Tempering/Temper1/Zone1TempC"] = { value: z1, quality: "Good" };
    live["Tempering/Temper1/Zone2TempC"] = { value: z2, quality: "Good" };
    live["Tempering/Temper1/Zone3TempC"] = { value: z3, quality: "Good" };
    live["Tempering/Temper1/MassTempC"] = { value: massOut, quality: "Good" };
    live["Tempering/Inlet/ValveOpen"] = { value: inOpen, quality: "Good" };
    live["Tempering/Inlet/FlowKgH"] = { value: inFlow, quality: "Good" };
    live["Tempering/Outlet/ValveOpen"] = { value: outOpen, quality: "Good" };
    live["Tempering/Outlet/FlowKgH"] = { value: tOutFlow, quality: "Good" };
    live["Tempering/ChilledWater/FlowM3H"] = { value: cwFlow, quality: "Good" };
    live["Tempering/ChilledWater/SupplyTempC"] = { value: cwSupply, quality: "Good" };

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
    const starved = state.scenario === "starved";
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
    return `<li>
      <button type="button" class="plant-tag${sel}" data-tag="${escapeHtml(relId)}" data-q="${escapeHtml(lv.quality)}" aria-pressed="${relId === state.selectedTag}">
        <span class="plant-q-dot-inline" aria-hidden="true"></span>
        <span class="plant-tag__name">${escapeHtml(def.name)}</span>
        <span class="plant-tag__val">${escapeHtml(formatValue(def, lv.value))}</span>
        <span class="plant-q plant-q--${escapeHtml(lv.quality.toLowerCase())}">${escapeHtml(lv.quality)}</span>
      </button>
    </li>`;
  }

  function renderFolder(nodeKey, label, innerHtml, extraClass) {
    const open = state.openNodes.includes(nodeKey);
    return `<li class="${extraClass || ""}">
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
    return renderFolder(MIXING_ROOT, MIXING_AREA, body, "plant-tree__area plant-tree__area--live");
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
    return renderFolder(TEMPERING_ROOT, TEMPERING_AREA, body, "plant-tree__area plant-tree__area--live");
  }

  function buildTree() {
    const root = document.getElementById("plant-tree");
    if (!root) return;

    const lines =
      STUB_LINES.map(renderStubLineFolder).join("") + renderLine3Folder();

    const packaging = renderFolder(AREA_ROOT, AREA, lines, "plant-tree__area");
    const mixing = renderMixingFolder();
    const tempering = renderTemperingFolder();
    root.innerHTML = renderFolder(SITE, SITE, packaging + mixing + tempering, "plant-tree__site");
    treeBuilt = true;
    updateTreeValues();

    const headPath = document.getElementById("plant-tree-path");
    if (headPath) headPath.textContent = `${PROVIDER}${SITE}`;
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
    if (isMixingTag(tagId) || isTemperingTag(tagId)) {
      const parts = tagId.split("/");
      // Mixing/Mixer1/LevelPct → Mixer1; Tempering/Temper1/Zone1TempC → Temper1
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
        <text class="pid-valve__pid" x="${cx + 16}" y="${mid + 4}" text-anchor="start">RJ-321</text>
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
    // Leave room on the left for the PRODUCT inlet label (no overlap with CV-301).
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
      <text class="pid-flow-label" x="${inletMid}" y="${midY - 22}" text-anchor="middle">PRODUCT</text>
      ${flowArrow(inletX1 - 12, midY)}`;

    const last = layout[layout.length - 1];
    const outletX1 = last.ports.right + 28;
    const outlet = `
      <line class="pid-pipe pid-pipe--main" x1="${last.ports.right}" y1="${midY}" x2="${outletX1}" y2="${midY}" />
      ${flange(last.ports.right, midY)}
      ${flowArrow(outletX1 - 2, midY)}`;

    const equips = layout.map((n) =>
      equipBlock(n.x, n.y, n.w, n.h, n.eq, "run")
    ).join("");

    const cart = layout[1];
    const balloons = [
      balloon(layout[0].ports.cx, 86, "SI", "301", "Infeed/Speed", layout[0].ports.cx, layout[0].ports.top, "Infeed"),
      balloon(cart.ports.cx - 26, 86, "SC", "310", "Cartoner/Speed", cart.ports.cx - 14, cart.ports.top, "Cartoner"),
      balloon(cart.ports.cx + 26, 86, "YA", "310", "Cartoner/Jam", cart.ports.cx + 14, cart.ports.top, "Cartoner"),
      balloon(weigh.ports.cx, 86, "WT", "320", "Checkweigher/WeightKg", weigh.ports.cx, weigh.ports.top, "Checkweigher"),
      balloon(rejectX + 54, (valveTop + valveBot) / 2, "XI", "321", "Checkweigher/Reject/Divert", rejectX + 12, (valveTop + valveBot) / 2, "Reject"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg is-running" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="Line 3 packaging P and ID">
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
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Heuvelland / Line3</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — PRIMARY PACK</text>
        <text class="pid-sheet__sub" x="24" y="52">Click equipment or instrument balloons to select tags</text>

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
    const tankX = 380;
    const tankY = 120;
    const tankW = 200;
    const tankH = 200;
    const tankCx = tankX + tankW / 2;
    const cocoaY = 160;
    const sugarY = 230;
    const outY = tankY + tankH / 2;
    const drainX = tankCx;
    const drainY0 = tankY + tankH;
    const drainY1 = 360;

    const balloons = [
      balloon(tankCx - 70, 70, "LI", "110", "Mixing/Mixer1/LevelPct", tankCx - 40, tankY, "Mixer1"),
      balloon(tankCx + 70, 70, "TI", "110", "Mixing/Mixer1/JacketTempC", tankCx + 40, tankY, "Mixer1"),
      balloon(tankCx, 70, "SI", "110", "Mixing/Mixer1/AgitatorRpm", tankCx, tankY, "Mixer1"),
      balloon(120, cocoaY - 50, "FI", "101", "Mixing/CocoaLiquor/FlowKgH", 200, cocoaY, "CocoaLiquor"),
      balloon(120, sugarY + 50, "FI", "102", "Mixing/Sugar/FlowKgH", 200, sugarY, "Sugar"),
      balloon(760, outY - 50, "FI", "130", "Mixing/Outlet/FlowKgH", 700, outY, "Outlet"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--mixing is-running" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="Heuvelland Mixing Mixer1 P and ID">
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
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Heuvelland / Mixing</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — CHOCOLATE MASS</text>
        <text class="pid-sheet__sub" x="24" y="52">Cocoa liquor + sugar → Mixer1 → mass out (tempering next)</text>

        <text class="pid-flow-label" x="28" y="${cocoaY - 10}" text-anchor="start">COCOA LIQUOR</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${cocoaY}" x2="${tankX}" y2="${cocoaY}" />
        ${flowArrow(140, cocoaY)}
        ${mixValve(220, cocoaY, "Mixing/CocoaLiquor/ValveOpen", "CocoaLiquor", "XV-101")}
        ${flange(tankX, cocoaY)}

        <text class="pid-flow-label" x="28" y="${sugarY - 10}" text-anchor="start">SUGAR</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${sugarY}" x2="${tankX}" y2="${sugarY}" />
        ${flowArrow(140, sugarY)}
        ${mixValve(220, sugarY, "Mixing/Sugar/ValveOpen", "Sugar", "XV-102")}
        ${flange(tankX, sugarY)}

        <g class="pid-tank pid-equip--run" data-equip="Mixer1" data-tag="Mixing/Mixer1/Running" role="button" tabindex="0">
          <rect class="pid-tank__shell" x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="8" />
          <rect class="pid-tank__jacket" x="${tankX + 10}" y="${tankY + 14}" width="${tankW - 20}" height="${tankH - 28}" rx="4" />
          <rect class="pid-tank__level" data-pid-level x="${tankX + 18}" y="${tankY + 80}" width="${tankW - 36}" height="110" rx="2" />
          <line class="pid-tank__agitator" x1="${tankCx}" y1="${tankY + 28}" x2="${tankCx}" y2="${tankY + tankH - 28}" />
          <circle class="pid-tank__hub" cx="${tankCx}" cy="${tankY + 40}" r="7" />
          <text class="pid-equip__pid" x="${tankCx}" y="${tankY - 10}" text-anchor="middle">MIX-110</text>
          <text class="pid-equip__name" x="${tankCx}" y="${tankY + tankH + 18}" text-anchor="middle">Mixer1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${tankX + tankW}" y1="${outY}" x2="860" y2="${outY}" />
        ${flange(tankX + tankW, outY)}
        ${mixValve(700, outY, "Mixing/Outlet/ValveOpen", "Outlet", "XV-130")}
        ${flowArrow(780, outY)}
        <text class="pid-flow-label" x="870" y="${outY - 10}" text-anchor="start">MASS OUT</text>

        <line class="pid-pipe pid-pipe--divert" x1="${drainX}" y1="${drainY0}" x2="${drainX}" y2="${drainY1}" />
        ${mixValve(drainX, drainY0 + 28, "Mixing/Drain/ValveOpen", "Drain", "XV-120")}
        <text class="pid-flow-label" x="${drainX + 18}" y="${drainY1}" text-anchor="start">DRAIN</text>

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildTemperingPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const vbW = 960;
    const vbH = 420;
    const tunnelX = 220;
    const tunnelY = 150;
    const tunnelW = 520;
    const tunnelH = 120;
    const zoneW = tunnelW / 3;
    const midY = tunnelY + tunnelH / 2;
    const inY = midY;
    const outY = midY;

    const zones = [0, 1, 2].map((i) => {
      const x = tunnelX + i * zoneW;
      const label = `Z${i + 1}`;
      return `
        <rect class="pid-tunnel__zone" x="${x}" y="${tunnelY}" width="${zoneW}" height="${tunnelH}" />
        <text class="pid-tunnel__zone-label" x="${x + zoneW / 2}" y="${tunnelY + 22}" text-anchor="middle">${label}</text>`;
    }).join("");

    const balloons = [
      balloon(tunnelX + zoneW * 0.5, 86, "TI", "211", "Tempering/Temper1/Zone1TempC", tunnelX + zoneW * 0.5, tunnelY, "Temper1"),
      balloon(tunnelX + zoneW * 1.5, 86, "TI", "212", "Tempering/Temper1/Zone2TempC", tunnelX + zoneW * 1.5, tunnelY, "Temper1"),
      balloon(tunnelX + zoneW * 2.5, 86, "TI", "213", "Tempering/Temper1/Zone3TempC", tunnelX + zoneW * 2.5, tunnelY, "Temper1"),
      balloon(tunnelX + tunnelW / 2, 320, "SI", "210", "Tempering/Temper1/BeltSpeed", tunnelX + tunnelW / 2, tunnelY + tunnelH, "Temper1"),
      balloon(110, inY - 50, "FI", "201", "Tempering/Inlet/FlowKgH", 170, inY, "Inlet"),
      balloon(820, outY - 50, "FI", "230", "Tempering/Outlet/FlowKgH", 760, outY, "Outlet"),
      balloon(480, 340, "TI", "240", "Tempering/ChilledWater/SupplyTempC", 480, tunnelY + tunnelH + 8, "ChilledWater"),
    ].join("");

    host.innerHTML = `
      <svg class="pid-svg pid-svg--tempering is-running" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="Heuvelland Tempering Temper1 P and ID">
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
          <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Heuvelland / Tempering</text>
          <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
        </g>

        <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — TEMPERING TUNNEL</text>
        <text class="pid-sheet__sub" x="24" y="52">Mass in from Mixing → three cooling zones → to Packaging</text>

        <text class="pid-flow-label" x="28" y="${inY - 10}" text-anchor="start">MASS IN</text>
        <line class="pid-pipe pid-pipe--main" x1="28" y1="${inY}" x2="${tunnelX}" y2="${inY}" />
        ${flowArrow(120, inY)}
        ${mixValve(170, inY, "Tempering/Inlet/ValveOpen", "Inlet", "XV-201")}
        ${flange(tunnelX, inY)}

        <g class="pid-tunnel pid-equip--run" data-equip="Temper1" data-tag="Tempering/Temper1/Running" role="button" tabindex="0">
          <rect class="pid-tunnel__shell" x="${tunnelX}" y="${tunnelY}" width="${tunnelW}" height="${tunnelH}" rx="4" />
          ${zones}
          <line class="pid-tunnel__belt" x1="${tunnelX + 16}" y1="${midY}" x2="${tunnelX + tunnelW - 16}" y2="${midY}" />
          <text class="pid-equip__pid" x="${tunnelX + tunnelW / 2}" y="${tunnelY - 10}" text-anchor="middle">TMP-210</text>
          <text class="pid-equip__name" x="${tunnelX + tunnelW / 2}" y="${tunnelY + tunnelH + 18}" text-anchor="middle">Temper1</text>
        </g>

        <line class="pid-pipe pid-pipe--main" x1="${tunnelX + tunnelW}" y1="${outY}" x2="900" y2="${outY}" />
        ${flange(tunnelX + tunnelW, outY)}
        ${mixValve(780, outY, "Tempering/Outlet/ValveOpen", "Outlet", "XV-230")}
        ${flowArrow(850, outY)}
        <text class="pid-flow-label" x="908" y="${outY - 10}" text-anchor="start">TO PACK</text>

        <text class="pid-flow-label" x="28" y="340" text-anchor="start">CHILLED WATER</text>
        <line class="pid-pipe pid-pipe--divert" x1="140" y1="340" x2="${tunnelX + 40}" y2="${tunnelY + tunnelH}" />
        <line class="pid-pipe pid-pipe--divert" x1="${tunnelX + tunnelW - 40}" y1="${tunnelY + tunnelH}" x2="700" y2="340" />

        ${balloons}
      </svg>`;

    pidBuilt = true;
  }

  function buildPid() {
    if (state.activeDrawing === "mixing") buildMixingPid();
    else if (state.activeDrawing === "tempering") buildTemperingPid();
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
    const mixing = state.activeDrawing === "mixing";
    const tempering = state.activeDrawing === "tempering";
    const mixOver = state.mixScenario === "overtemp";
    const mixValve = state.mixScenario === "valve";

    svg.classList.remove("is-running", "is-fault", "is-warn");
    if (mixing) svg.classList.add(mixOver ? "is-fault" : mixValve ? "is-warn" : "is-running");
    else if (tempering) svg.classList.add("is-running");
    else svg.classList.add(jam ? "is-fault" : starved ? "is-warn" : "is-running");

    const flow = svg.querySelector("[data-pid-flow]");
    if (flow) flow.style.display = (!mixing && !jam && !starved && !reducedMotion) ? "" : "none";

    if (!mixing) {
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
    } else if (mixing) {
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
        const tankH = 200 - 28;
        const h = Math.max(8, (tankH * level) / 100);
        const top = 120 + 14 + (tankH - h);
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
        tunnel.classList.remove("is-selected", "is-hover");
        if (state.selectedTag.startsWith("Tempering/Temper1")) tunnel.classList.add("is-selected");
      }
      svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
        const tagId = g.getAttribute("data-tag");
        const open = !!(live[tagId] || {}).value;
        g.classList.toggle("is-open", open);
        g.classList.toggle("is-selected", tagId === state.selectedTag);
        g.classList.remove("is-hover");
      });
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
    const mixing = state.activeDrawing === "mixing";
    const tempering = state.activeDrawing === "tempering";
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
    } else if (tempering) {
      const z1 = live["Tempering/Temper1/Zone1TempC"]?.value ?? 0;
      const z3 = live["Tempering/Temper1/Zone3TempC"]?.value ?? 0;
      const belt = live["Tempering/Temper1/BeltSpeed"]?.value ?? 0;
      setLabel("kpi-a-label", "Zone1");
      setLabel("kpi-b-label", "Zone3");
      setLabel("kpi-c-label", "Belt");
      setLabel("kpi-d-label", "Mode");
      setKpi("kpi-a", `${z1.toFixed(1)}°C`, "good");
      setKpi("kpi-b", `${z3.toFixed(1)}°C`, "good");
      setKpi("kpi-c", `${belt.toFixed(1)}`, "good");
      setKpi("kpi-d", String(live["Tempering/Mode"]?.value ?? "—"), "good");
    } else {
      const oee = live.OEE?.value ?? 0;
      setLabel("kpi-a-label", "OEE");
      setLabel("kpi-b-label", "Thru");
      setLabel("kpi-c-label", "Mode");
      setLabel("kpi-d-label", "Rejects");
      setKpi("kpi-a", `${oee.toFixed(1)}%`, jam ? "bad" : starved ? "warn" : oee >= 80 ? "good" : "warn");
      setKpi("kpi-b", String(Math.round(live.Throughput?.value ?? 0)), jam ? "bad" : starved ? "warn" : "good");
      setKpi("kpi-c", String(live.Mode?.value ?? "—"), jam ? "bad" : starved ? "warn" : "good");
      setKpi("kpi-d", String(Math.round(live["Checkweigher/Reject/Count"]?.value ?? 0)), "warn");
    }

    const pkgToolbar = document.querySelector('[data-toolbar-area="packaging"]');
    const mixToolbar = document.querySelector('[data-toolbar-area="mixing"]');
    if (pkgToolbar) pkgToolbar.hidden = mixing || tempering;
    if (mixToolbar) mixToolbar.hidden = !mixing;
    document.querySelectorAll("[data-toolbar-packaging-only]").forEach((el) => {
      el.hidden = mixing || tempering;
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

    const title = document.querySelector(".plant-hmi__title h1");
    if (title) {
      title.textContent = mixing
        ? "Heuvelland · Mixing"
        : tempering
          ? "Heuvelland · Tempering"
          : "Heuvelland · Line 3";
    }

    const scanDot = document.getElementById("plant-scan-dot");
    const scanLabel = document.getElementById("plant-scan-label");
    if (scanDot && scanLabel) {
      scanDot.classList.remove("is-fault", "is-warn");
      if (mixing && mixOver) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Overtemp"; }
      else if (mixing && mixValve) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Valve fault"; }
      else if (!mixing && !tempering && jam) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Fault"; }
      else if (!mixing && !tempering && starved) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved"; }
      else { scanLabel.textContent = mixing ? "Mixing" : tempering ? "Tempering" : "Scanning"; }
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
      if (isMixingTag(state.selectedTag) || isTemperingTag(state.selectedTag)) {
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
    if (nextDrawing !== state.activeDrawing) {
      state.activeDrawing = nextDrawing;
      pidBuilt = false;
      clearPidHover();
    }
    state.selectedTag = id;
    const open = new Set(state.openNodes);
    open.add(SITE);
    if (isMixingTag(id) || isTemperingTag(id)) {
      const root = isMixingTag(id) ? MIXING_ROOT : TEMPERING_ROOT;
      open.add(root);
      const parts = id.split("/");
      let acc = SITE;
      for (let i = 0; i < parts.length - 1; i++) {
        acc += "/" + parts[i];
        open.add(acc);
      }
    } else {
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
      if (btn && btn.getAttribute("data-tag")) selectTag(btn.getAttribute("data-tag"));
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
      const btn = e.target.closest("[data-action], [data-scenario], [data-mix-scenario]");
      if (!btn) return;
      const sc = btn.getAttribute("data-scenario");
      const mixSc = btn.getAttribute("data-mix-scenario");
      if (sc) { setScenario(sc); return; }
      if (mixSc) { setMixScenario(mixSc); return; }
      const action = btn.getAttribute("data-action");
      if (action === "ack-all") ackAll();
      else if (action === "reset-reject") resetReject();
      else if (action === "clear-jam") clearCartonerJam();
      else if (action === "reset-line") resetLine();
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
