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

Plant.equipState = function equipState(id) {
  const jam = Plant.state.scenario === "jam" && !Plant.state.cartonerJamCleared;
  const starved = Plant.state.scenario === "starved"
    || Plant.state.mixScenario != null
    || Plant.state.temperScenario === "belt"
    || Plant.state.refineScenario === "pressure"
    || Plant.state.concheScenario === "overtemp"
    || Plant.state.mouldScenario === "jam";
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
  if (!meta.values.includes(fault)) return false;
  Plant.state[meta.field] = fault;
  if (drawing === "packaging") Plant.state.cartonerJamCleared = false;
  return true;
}

/** Area health for overview sheet: run | fault | warn */
Plant.areaHealth = function areaHealth(drawing) {
  const fault = Plant.getActiveFault(drawing);
  if (!fault) {
    if (drawing === "packaging") {
      const upstream = Plant.state.mixScenario != null
        || Plant.state.temperScenario === "belt"
        || Plant.state.refineScenario === "pressure"
        || Plant.state.concheScenario === "overtemp"
        || Plant.state.mouldScenario === "jam";
      if (upstream) return "warn";
    }
    if (drawing === "tempering" && (Plant.state.mixScenario != null || Plant.state.refineScenario === "pressure" || Plant.state.concheScenario === "overtemp")) {
      return "warn";
    }
    if (drawing === "refining" && Plant.state.mixScenario != null) return "warn";
    if (drawing === "conching" && (Plant.state.mixScenario != null || Plant.state.refineScenario === "pressure")) return "warn";
    if (drawing === "moulding" && (
      Plant.state.mixScenario != null || Plant.state.temperScenario === "belt"
      || Plant.state.refineScenario === "pressure" || Plant.state.concheScenario === "overtemp"
    )) return "warn";
    return "run";
  }
  const critical = {
    packaging: { jam: true, starved: false },
    mixing: { overtemp: true, valve: false },
    refining: { pressure: true, particle: false },
    conching: { overtemp: true, agitator: false },
    tempering: { warm: true, belt: false },
    moulding: { jam: true, cool: false },
  };
  return critical[drawing]?.[fault] ? "fault" : "warn";
}

Plant.plantModeSummary = function plantModeSummary() {
  const modes = [];
  for (const a of Plant.PLANT_AREAS) {
    const h = Plant.areaHealth(a.drawing);
    if (h === "fault") modes.push(`${a.id}:FAULT`);
    else if (h === "warn") modes.push(`${a.id}:HOLD`);
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

Plant.firstOutAlarmId = function firstOutAlarmId(alarms) {
  const unacked = alarms.filter((a) => !a.acked);
  if (!unacked.length) return null;
  return unacked.slice().sort((a, b) => a.ts - b.ts)[0].id;
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
