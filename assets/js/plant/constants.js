import { Plant } from "./ns.js?v=c600f295ec";


"use strict";

Plant.STORAGE_KEY = "samdonche.plant.v15";
Plant.TICK_MS = 1000;
Plant.PROVIDER = "[edge]";
Plant.EDGE_ROOT = "[edge]";
Plant.SITE = "Heuvelland";
Plant.SISTER_SITES = ["Gullegem", "Ieper", "Gent", "Brugge"];
Plant.AREA = "Packaging";
Plant.MIXING_AREA = "Mixing";
Plant.REFINING_AREA = "Refining";
Plant.CONCHING_AREA = "Conching";
Plant.TEMPERING_AREA = "Tempering";
Plant.MOULDING_AREA = "Moulding";
Plant.LIVE_LINE = "Line3";
Plant.AREA_ROOT = `${Plant.SITE}/${Plant.AREA}`;
Plant.MIXING_ROOT = `${Plant.SITE}/${Plant.MIXING_AREA}`;
Plant.REFINING_ROOT = `${Plant.SITE}/${Plant.REFINING_AREA}`;
Plant.CONCHING_ROOT = `${Plant.SITE}/${Plant.CONCHING_AREA}`;
Plant.TEMPERING_ROOT = `${Plant.SITE}/${Plant.TEMPERING_AREA}`;
Plant.MOULDING_ROOT = `${Plant.SITE}/${Plant.MOULDING_AREA}`;

/**
 * Plant areas in mass-flow order (chocolate bars).
 * Every area has a live P&ID drawing.
 */
Plant.PLANT_AREAS = [
  { id: "Mixing", drawing: "mixing", live: true },
  { id: "Refining", drawing: "refining", live: true },
  { id: "Conching", drawing: "conching", live: true },
  { id: "Tempering", drawing: "tempering", live: true },
  { id: "Moulding", drawing: "moulding", live: true },
  { id: "Packaging", drawing: "packaging", live: true },
];

Plant.DRAWING_IDS = Plant.PLANT_AREAS.map((a) => a.drawing);
Plant.ALL_DRAWING_IDS = ["overview", ...Plant.DRAWING_IDS];

/** Fault query values per drawing for #drawing?fault=… deep-links. */
Plant.DRAWING_FAULTS = {
  packaging: { field: "scenario", values: ["jam", "starved"] },
  mixing: { field: "mixScenario", values: ["overtemp", "valve"] },
  refining: { field: "refineScenario", values: ["pressure", "particle"] },
  conching: { field: "concheScenario", values: ["overtemp", "agitator"] },
  tempering: { field: "temperScenario", values: ["warm", "belt"] },
  moulding: { field: "mouldScenario", values: ["jam", "cool"] },
};

Plant.TREND_LEN = 60;

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
Plant.STUB_LINES = [
  { id: "Line1", speedSp: 95, oeeBase: 81.5, thruBase: 92, phase: 11 },
  { id: "Line2", speedSp: 108, oeeBase: 76.2, thruBase: 101, phase: 23 },
];

/** Thin tag set for stub lines (ids relative to the line). */
Plant.STUB_LINE_TAGS = [
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
Plant.EQUIPMENT = [
  { id: "Infeed", label: "Infeed", pid: "CV-301", kind: "conveyor" },
  { id: "Cartoner", label: "Cartoner", pid: "CT-310", kind: "machine" },
  { id: "Checkweigher", label: "Checkweigher", pid: "WT-320", kind: "scale" },
  { id: "CasePacker", label: "Case packer", pid: "CP-330", kind: "machine" },
  { id: "Palletizer", label: "Palletizer", pid: "PL-340", kind: "palletizer" },
  { id: "Outfeed", label: "Outfeed", pid: "CV-350", kind: "conveyor" },
];

/** @type {TagDef[]} — ids are relative to Heuvelland/Packaging/Line3/ */
Plant.LINE3_TAGS = [
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
Plant.MIXING_TAGS = [
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
Plant.REFINING_TAGS = [
  { id: "Refining/Running", name: "Running", type: "bool", live: true },
  { id: "Refining/Mode", name: "Mode", type: "string", live: true },
  { id: "Refining/BatchId", name: "BatchId", type: "string", live: true },

  { id: "Refining/Refiner1/Running", name: "Running", type: "bool", live: true },
  { id: "Refining/Refiner1/LoadPct", name: "LoadPct", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
  { id: "Refining/Refiner1/ParticleUm", name: "ParticleUm", type: "number", unit: "µm", format: (v) => v.toFixed(1), live: true },
  { id: "Refining/Refiner1/RollPressureBar", name: "RollPressureBar", type: "number", unit: "bar", format: (v) => v.toFixed(1), live: true },

  { id: "Refining/Inlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
  { id: "Refining/Inlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

  { id: "Refining/Outlet/ValveOpen", name: "ValveOpen", type: "bool", live: true },
  { id: "Refining/Outlet/FlowKgH", name: "FlowKgH", type: "number", unit: "kg/h", format: (v) => String(Math.round(v)), live: true },

  { id: "Refining/Hydraulic/PressureBar", name: "PressureBar", type: "number", unit: "bar", format: (v) => v.toFixed(1), live: true },
];

/** Conching tags — Conche1 agitator tank. */
Plant.CONCHING_TAGS = [
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

  { id: "Conching/Jacket/SupplyTempC", name: "SupplyTempC", type: "number", unit: "°C", format: (v) => v.toFixed(1), live: true },
  { id: "Conching/Jacket/FlowM3H", name: "FlowM3H", type: "number", unit: "m³/h", format: (v) => v.toFixed(1), live: true },
];

/** Tempering tags — temper machine Temper1 (heat / cool / reheat zones + screw). */
Plant.TEMPERING_TAGS = [
  { id: "Tempering/Running", name: "Running", type: "bool", live: true },
  { id: "Tempering/Mode", name: "Mode", type: "string", live: true },
  { id: "Tempering/BatchId", name: "BatchId", type: "string", live: true },

  { id: "Tempering/Temper1/Running", name: "Running", type: "bool", live: true },
  { id: "Tempering/Temper1/ScrewRpm", name: "ScrewRpm", type: "number", unit: "rpm", format: (v) => v.toFixed(1), live: true },
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
Plant.MOULDING_TAGS = [
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
Plant.STUB_TAGS = Plant.STUB_LINES.flatMap((line) =>
  Plant.STUB_LINE_TAGS.map((t) => ({ ...t, id: `${line.id}/${t.id}` }))
);

/** Site-level meta tags shared by Heuvelland + sisters (Running / Mode / OEE / LastContact). */
Plant.SITE_META_NAMES = ["Running", "Mode", "OEE", "LastContact"];

/** Offline sister sites — site tags + stub Mixing/Packaging areas. */
Plant.SISTER_AREAS = [
  { id: "Mixing", tags: [
    { name: "Running", type: "bool" },
    { name: "Mode", type: "string" },
  ]},
  { id: "Packaging", tags: [
    { name: "Running", type: "bool" },
    { name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1) },
  ]},
];
Plant.SISTER_LAST_CONTACT = {
  Gullegem: "2026-09-19 22:14 UTC",
  Ieper: "2026-09-18 06:41 UTC",
  Gent: "2026-09-20 14:02 UTC",
  Brugge: "2026-09-17 23:55 UTC",
};

/**
 * Schematic West Flanders layout (viewBox 0–340 × 220).
 * Relative placement only — not cartographic.
 */
Plant.SITE_MAP = {
  Brugge: { x: 118, y: 52, anchor: "end", lx: -14, ly: -2 },
  Gent: { x: 268, y: 78, anchor: "start", lx: 14, ly: -2 },
  Gullegem: { x: 168, y: 112, anchor: "start", lx: 14, ly: 2 },
  Ieper: { x: 78, y: 148, anchor: "end", lx: -14, ly: 2 },
  Heuvelland: { x: 158, y: 172, anchor: "start", lx: 16, ly: 4, home: true },
};
/** Soft hinterland + North Sea edge (schematic). */
Plant.SITE_MAP_LAND = "48,38 92,18 148,14 210,22 278,40 312,78 318,128 292,168 248,196 178,208 108,200 58,172 36,118 32,72";
Plant.SITE_MAP_SEA = "32,72 48,38 92,18 148,14 210,22 210,8 120,4 40,16 18,48";
/** Link mesh (hub = Heuvelland / Gullegem corridor). */
Plant.SITE_MAP_LINKS = [
  ["Heuvelland", "Gullegem"],
  ["Heuvelland", "Ieper"],
  ["Gullegem", "Brugge"],
  ["Gullegem", "Gent"],
  ["Brugge", "Gent"],
  ["Ieper", "Gullegem"],
];

Plant.HEUVELLAND_SITE_TAGS = [
  { id: `${Plant.SITE}/Running`, name: "Running", type: "bool", live: true },
  { id: `${Plant.SITE}/Mode`, name: "Mode", type: "string", live: true },
  { id: `${Plant.SITE}/OEE`, name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1), live: true },
  { id: `${Plant.SITE}/LastContact`, name: "LastContact", type: "string", live: true },
];
Plant.SISTER_SITE_TAGS = Plant.SISTER_SITES.flatMap((site) => {
  const top = Plant.SITE_META_NAMES.map((name) => {
    if (name === "OEE") {
      return { id: `${site}/OEE`, name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1), live: false };
    }
    if (name === "Running") {
      return { id: `${site}/Running`, name: "Running", type: "bool", live: false };
    }
    return { id: `${site}/${name}`, name, type: "string", live: false };
  });
  const areas = Plant.SISTER_AREAS.flatMap((area) =>
    area.tags.map((t) => ({
      id: `${site}/${area.id}/${t.name}`,
      name: t.name,
      type: t.type,
      unit: t.unit,
      format: t.format,
      live: false,
    }))
  );
  return top.concat(areas);
});

Plant.ALL_TAGS = Plant.LINE3_TAGS.concat(
  Plant.STUB_TAGS,
  Plant.HEUVELLAND_SITE_TAGS,
  Plant.MIXING_TAGS,
  Plant.REFINING_TAGS,
  Plant.CONCHING_TAGS,
  Plant.TEMPERING_TAGS,
  Plant.MOULDING_TAGS,
  Plant.SISTER_SITE_TAGS
);
Plant.TAG_BY_ID = Object.fromEntries(Plant.ALL_TAGS.map((t) => [t.id, t]));
Plant.SISTER_SITE_SET = new Set(Plant.SISTER_SITES);

/** Default open folders in the nested tree (node keys). */
Plant.DEFAULT_OPEN = [
  Plant.EDGE_ROOT,
  Plant.SITE,
  /* Areas stay collapsed so Gullegem/Ieper/Gent/Brugge stay on-screen. */
];

/** Alarm → drawing / equipment for P&ID callouts. Optional navDrawing/navTag jump to root cause. */
Plant.ALARM_PID = {
  "alm-cartoner-jam": { drawing: "packaging", equip: "Cartoner", severity: "critical" },
  "alm-infeed-starved": { drawing: "packaging", equip: "Infeed", severity: "warning" },
  "alm-pack-upstream": { drawing: "packaging", equip: "Infeed", severity: "warning", navDrawing: "mixing", navTag: "Mixing/Mixer1/Running" },
  "alm-pack-temper": { drawing: "packaging", equip: "Infeed", severity: "warning", navDrawing: "tempering", navTag: "Tempering/Temper1/ScrewRpm" },
  "alm-pack-refine": { drawing: "packaging", equip: "Infeed", severity: "warning", navDrawing: "refining", navTag: "Refining/Refiner1/LoadPct" },
  "alm-pack-conche": { drawing: "packaging", equip: "Infeed", severity: "warning", navDrawing: "conching", navTag: "Conching/Conche1/TempC" },
  "alm-pack-mould": { drawing: "packaging", equip: "Infeed", severity: "warning", navDrawing: "moulding", navTag: "Moulding/Moulder1/CyclesPerMin" },
  "alm-mix-overtemp": { drawing: "mixing", equip: "Mixer1", severity: "critical" },
  "alm-mix-valve": { drawing: "mixing", equip: "CocoaLiquor", severity: "warning" },
  "alm-temper-warm": { drawing: "tempering", equip: "Temper1", severity: "critical" },
  "alm-temper-belt": { drawing: "tempering", equip: "Temper1", severity: "warning" },
  "alm-temper-upstream": { drawing: "tempering", equip: "Inlet", severity: "warning" },
  "alm-refine-pressure": { drawing: "refining", equip: "Refiner1", severity: "critical" },
  "alm-refine-particle": { drawing: "refining", equip: "Refiner1", severity: "warning" },
  "alm-conche-overtemp": { drawing: "conching", equip: "Conche1", severity: "critical" },
  "alm-conche-agitator": { drawing: "conching", equip: "Conche1", severity: "warning" },
  "alm-mould-jam": { drawing: "moulding", equip: "Moulder1", severity: "critical" },
  "alm-mould-cool": { drawing: "moulding", equip: "Cooling", severity: "warning" },
};

Plant.BATCH_STEPS = ["mixing", "refining", "conching", "tempering", "moulding", "packaging"];
Plant.BATCH_HOME_TAG = {
  mixing: "Mixing/BatchId",
  refining: "Refining/BatchId",
  conching: "Conching/BatchId",
  tempering: "Tempering/BatchId",
  moulding: "Moulding/BatchId",
  packaging: "BatchId",
};

Plant.DRAWING_HOME_TAG = {
  packaging: "OEE",
  mixing: "Mixing/Mixer1/LevelPct",
  refining: "Refining/Refiner1/LoadPct",
  conching: "Conching/Conche1/TempC",
  tempering: "Tempering/Temper1/Zone1TempC",
  moulding: "Moulding/Moulder1/CyclesPerMin",
};
