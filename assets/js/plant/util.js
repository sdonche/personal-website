import { Plant } from "./ns.js?v=c600f295ec";


Plant.isStubTag = function isStubTag(rel) {
  return rel.startsWith("Line1/") || rel.startsWith("Line2/");
}

Plant.isSisterSiteTag = function isSisterSiteTag(rel) {
  if (!rel) return false;
  return Plant.SISTER_SITE_SET.has(rel.split("/")[0]);
}

Plant.isHeuvellandSiteTag = function isHeuvellandSiteTag(rel) {
  if (!rel) return false;
  const parts = rel.split("/");
  return parts.length === 2 && parts[0] === Plant.SITE && Plant.SITE_META_NAMES.includes(parts[1]);
}

Plant.isMixingTag = function isMixingTag(rel) {
  return !!rel && rel.startsWith("Mixing/");
}

Plant.isRefiningTag = function isRefiningTag(rel) {
  return !!rel?.startsWith("Refining/");
}

Plant.isConchingTag = function isConchingTag(rel) {
  return !!rel?.startsWith("Conching/");
}

Plant.isTemperingTag = function isTemperingTag(rel) {
  return !!rel && rel.startsWith("Tempering/");
}

Plant.isMouldingTag = function isMouldingTag(rel) {
  return !!rel?.startsWith("Moulding/");
}

Plant.isProcessAreaTag = function isProcessAreaTag(rel) {
  return Plant.isMixingTag(rel) || Plant.isRefiningTag(rel) || Plant.isConchingTag(rel)
    || Plant.isTemperingTag(rel) || Plant.isMouldingTag(rel);
}

Plant.isPackagingTag = function isPackagingTag(rel) {
  if (!rel) return false;
  if (Plant.isProcessAreaTag(rel) || Plant.isSisterSiteTag(rel) || Plant.isHeuvellandSiteTag(rel)) return false;
  return true;
}

Plant.drawingForTag = function drawingForTag(rel) {
  if (Plant.isMixingTag(rel)) return "mixing";
  if (Plant.isRefiningTag(rel)) return "refining";
  if (Plant.isConchingTag(rel)) return "conching";
  if (Plant.isTemperingTag(rel)) return "tempering";
  if (Plant.isMouldingTag(rel)) return "moulding";
  if (Plant.isSisterSiteTag(rel) || Plant.isHeuvellandSiteTag(rel)) return null;
  if (Plant.isPackagingTag(rel)) return "packaging";
  return null;
}

Plant.pathOf = function pathOf(rel) {
  if (Plant.isSisterSiteTag(rel) || Plant.isHeuvellandSiteTag(rel)) return `${Plant.PROVIDER}${rel}`;
  if (Plant.isProcessAreaTag(rel)) return `${Plant.PROVIDER}${Plant.SITE}/${rel}`;
  if (Plant.isStubTag(rel)) return `${Plant.PROVIDER}${Plant.AREA_ROOT}/${rel}`;
  return `${Plant.PROVIDER}${Plant.AREA_ROOT}/${Plant.LIVE_LINE}/${rel}`;
}

Plant.drift = function drift(base, amp, phase) {
  return base + Math.sin((Plant.tick + phase) / 4.2) * amp + (Math.random() - 0.5) * amp * 0.15;
}

Plant.clamp = function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

Plant.batchStepIndex = function batchStepIndex(phase) {
  return Math.min(Plant.BATCH_STEPS.length - 1, Math.floor((phase ?? 0) / 15));
}

Plant.formatValue = function formatValue(def, value) {
  if (def.type === "bool") return value ? "true" : "false";
  if (def.format) {
    const s = def.format(value);
    return def.unit ? `${s} ${def.unit}` : s;
  }
  return def.unit ? `${value} ${def.unit}` : String(value);
}

Plant.escapeHtml = function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mixing local fault (overtemp or cocoa valve). */
Plant.isMixFault = function isMixFault() {
  return Plant.state.mixScenario === "overtemp" || Plant.state.mixScenario === "valve";
}

/** Normalize temper scenario ids (`belt` legacy → `drive`). */
Plant.normalizeTemperScenario = function normalizeTemperScenario(v) {
  if (v === "warm") return "warm";
  if (v === "drive" || v === "belt") return "drive";
  return null;
}

Plant.isTemperDrive = function isTemperDrive() {
  return Plant.state.temperScenario === "drive";
}

/** Upstream mass-path hold that starves Packaging feed (and mid-line areas further downstream). */
Plant.isUpstreamHold = function isUpstreamHold() {
  return Plant.isMixFault()
    || Plant.isTemperDrive()
    || Plant.state.temperScenario === "warm"
    || Plant.state.refineScenario === "pressure"
    || Plant.state.refineScenario === "particle"
    || Plant.state.concheScenario === "overtemp"
    || Plant.state.concheScenario === "agitator"
    || Plant.state.mouldScenario === "jam"
    || Plant.state.mouldScenario === "cool";
}

/** Packaging feed starved — local scenario or upstream hold. */
Plant.isFeedStarved = function isFeedStarved() {
  return Plant.state.scenario === "starved" || Plant.isUpstreamHold();
}

/** Packaging P&ID svg / flow: local starve or upstream hold. */
Plant.packagingSvgStarved = function packagingSvgStarved() {
  return Plant.state.scenario === "starved" || Plant.isUpstreamHold();
}

Plant.equipState = function equipState(id) {
  const jam = Plant.state.scenario === "jam" && !Plant.state.cartonerJamCleared;
  const starved = Plant.isFeedStarved();
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

Plant.getActiveFault = function getActiveFault(drawing) {
  const meta = Plant.DRAWING_FAULTS[drawing];
  if (!meta) return null;
  const v = Plant.state[meta.field];
  return meta.values.includes(v) ? v : null;
}

Plant.setDrawingFault = function setDrawingFault(drawing, fault) {
  const meta = Plant.DRAWING_FAULTS[drawing];
  if (!meta) return false;
  if (fault == null || fault === "recover") {
    Plant.state[meta.field] = null;
    if (drawing === "packaging") Plant.state.cartonerJamCleared = false;
    return true;
  }
  let resolved = fault;
  if (drawing === "tempering") resolved = Plant.normalizeTemperScenario(fault) || fault;
  if (!meta.values.includes(resolved)) return false;
  Plant.state[meta.field] = resolved;
  if (drawing === "packaging") Plant.state.cartonerJamCleared = false;
  return true;
}

/** Keep document title + OG/Twitter tags in sync with the active area. */
Plant.updateShareMeta = function updateShareMeta(pageTitle) {
  const label = pageTitle || "Heuvelland · Chocolate plant HMI";
  document.title = `${label} · Sam Donche`;
  const setMeta = (sel, attr, value) => {
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  };
  setMeta('meta[property="og:title"]', "content", label);
  setMeta('meta[name="twitter:title"]', "content", label);
  setMeta('meta[property="og:image:alt"]', "content", `${label} · Sam Donche`);
}

/** Display label for live line id (`Line3` → `Line 3`). */
Plant.liveLineLabel = function liveLineLabel() {
  return String(Plant.LIVE_LINE).replace(/(\D)(\d)/g, "$1 $2");
}

/** Area health for overview sheet: run | fault | hold | starved */
Plant.areaHealth = function areaHealth(drawing) {
  const fault = Plant.getActiveFault(drawing);
  const critical = {
    packaging: { jam: true, starved: false },
    mixing: { overtemp: true, valve: false },
    refining: { pressure: true, particle: false },
    conching: { overtemp: true, agitator: false },
    tempering: { warm: true, drive: false },
    moulding: { jam: true, cool: false },
  };
  if (fault) {
    if (critical[drawing]?.[fault]) return "fault";
    if (drawing === "packaging" && fault === "starved") return "starved";
    return "hold";
  }
  const mixFault = Plant.isMixFault();
  const refinePressure = Plant.state.refineScenario === "pressure";
  const refineParticle = Plant.state.refineScenario === "particle";
  const concheOver = Plant.state.concheScenario === "overtemp";
  const concheAgit = Plant.state.concheScenario === "agitator";
  const temperDrive = Plant.isTemperDrive();
  const temperWarm = Plant.state.temperScenario === "warm";
  if (drawing === "packaging" && Plant.isUpstreamHold()) return "starved";
  if (drawing === "refining" && mixFault) return "starved";
  if (drawing === "conching" && (mixFault || refinePressure || refineParticle)) return "starved";
  if (drawing === "tempering" && (mixFault || refinePressure || refineParticle || concheOver || concheAgit)) {
    return "starved";
  }
  if (drawing === "moulding" && (
    mixFault || temperDrive || temperWarm || refinePressure || refineParticle || concheOver || concheAgit
  )) return "starved";
  return "run";
}

Plant.plantModeSummary = function plantModeSummary() {
  const modes = [];
  for (const a of Plant.PLANT_AREAS) {
    const h = Plant.areaHealth(a.drawing);
    if (h === "fault") modes.push(`${a.id}:FAULT`);
    else if (h === "starved") modes.push(`${a.id}:STARVED`);
    else if (h === "hold") modes.push(`${a.id}:HOLD`);
  }
  return modes.length ? modes.slice(0, 2).join(" · ") : "AUTO";
}

/* ---------------- P&ID ---------------- */

Plant.liveReadout = function liveReadout(tagId) {
  const def = Plant.TAG_BY_ID[tagId];
  const lv = Plant.live[tagId];
  if (!def || !lv) return "";
  return Plant.formatValue(def, lv.value);
}

Plant.sparklineSvg = function sparklineSvg(samples) {
  if (!samples || samples.length < 2) {
    return `<svg class="plant-sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true"><text x="4" y="18" class="plant-sparkline__empty">no trend</text></svg>`;
  }
  const w = 120;
  const h = 28;
  const pad = 2;
  let min = Math.min(...samples);
  let max = Math.max(...samples);
  if (min === max) { min -= 1; max += 1; }
  const pts = samples.map((v, i) => {
    const x = pad + (i / (samples.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="plant-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline class="plant-sparkline__line" points="${pts}" fill="none" /></svg>`;
}

/** Cascade / consequence alarms — lose FO ties to root-cause alarms. */
Plant.isCascadeAlarm = function isCascadeAlarm(id) {
  return /^alm-pack-/.test(id) || /-upstream$/.test(id);
}

/**
 * First-out: oldest unacked. Equal ts → critical before warning,
 * then root-cause before cascade, then id for stability.
 */
Plant.firstOutAlarmId = function firstOutAlarmId(alarms) {
  const unacked = alarms.filter((a) => !a.acked);
  if (!unacked.length) return null;
  const sevRank = (s) => (s === "critical" ? 0 : 1);
  const cascadeRank = (id) => (Plant.isCascadeAlarm(id) ? 1 : 0);
  return unacked.slice().sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (sevRank(a.severity) !== sevRank(b.severity)) return sevRank(a.severity) - sevRank(b.severity);
    if (cascadeRank(a.id) !== cascadeRank(b.id)) return cascadeRank(a.id) - cascadeRank(b.id);
    return String(a.id).localeCompare(String(b.id));
  })[0].id;
}

/** Resolve alarm → drawing/tag jump (scenario-aware pack-* roots). */
Plant.alarmNavTarget = function alarmNavTarget(alarm) {
  if (!alarm) return null;
  if (alarm.navTag || alarm.navDrawing) {
    return { navDrawing: alarm.navDrawing || null, navTag: alarm.navTag || null };
  }
  const id = alarm.id;
  if (id === "alm-pack-temper") {
    if (Plant.state.temperScenario === "warm") {
      return { navDrawing: "tempering", navTag: "Tempering/Temper1/Zone1TempC" };
    }
    return { navDrawing: "tempering", navTag: "Tempering/Temper1/ScrewRpm" };
  }
  if (id === "alm-pack-mould") {
    if (Plant.state.mouldScenario === "cool") {
      return { navDrawing: "moulding", navTag: "Moulding/Cooling/AirTempC" };
    }
    return { navDrawing: "moulding", navTag: "Moulding/Moulder1/CyclesPerMin" };
  }
  if (id === "alm-pack-refine") {
    if (Plant.state.refineScenario === "particle") {
      return { navDrawing: "refining", navTag: "Refining/Refiner1/ParticleUm" };
    }
    return { navDrawing: "refining", navTag: "Refining/Hydraulic/PressureBar" };
  }
  if (id === "alm-pack-conche") {
    if (Plant.state.concheScenario === "agitator") {
      return { navDrawing: "conching", navTag: "Conching/Conche1/AgitatorRpm" };
    }
    return { navDrawing: "conching", navTag: "Conching/Conche1/TempC" };
  }
  const meta = Plant.ALARM_PID[id];
  if (!meta) return null;
  return { navDrawing: meta.navDrawing || null, navTag: meta.navTag || null };
}

Plant.tagFromAlarmPath = function tagFromAlarmPath(path) {
  if (!path) return null;
  const bare = String(path).replace(/^\[edge\]/, "");
  const pkgPrefix = `${Plant.SITE}/${Plant.AREA}/${Plant.LIVE_LINE}/`;
  if (bare.startsWith(pkgPrefix)) {
    const rel = bare.slice(pkgPrefix.length);
    return Plant.TAG_BY_ID[rel] ? rel : null;
  }
  const sitePrefix = `${Plant.SITE}/`;
  if (bare.startsWith(sitePrefix)) {
    const rel = bare.slice(sitePrefix.length);
    return Plant.TAG_BY_ID[rel] ? rel : null;
  }
  return Plant.TAG_BY_ID[bare] ? bare : null;
}

Plant.timeAgo = function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}
