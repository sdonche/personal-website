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

/* Process noise: every signal key gets its own slowly wandering AR(1) noise
   (≈10-tick correlation, standard deviation ≈ 0.6 × amp) instead of a shared
   sine, so trends look like instruments, not a metronome. */
Plant.noiseState = {};
Plant.drift = function drift(base, amp, key) {
  const a = 0.9;
  const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ≈ N(0, 1)
  const prev = Plant.noiseState[key] ?? 0;
  const next = prev * a + gauss * amp * 0.26;
  Plant.noiseState[key] = next;
  return base + next;
}

/* Process dynamics: numeric tags follow their computed target through a
   first-order lag (time constant in plant minutes = ticks), so a fault
   makes a temperature creep and a flow ramp instead of jumping. Setpoints,
   counters and batch clocks are not lagged. */
Plant.LAG_TAU = { "°C": 6, "kg/h": 1.2, "m³/h": 1.5, "rpm": 1.2, "%": 2, "µm": 3, "bar": 1.5, "kW": 1.5, "cpm": 1, "cases/min": 1, "cycles/min": 1, "m/min": 1 };
Plant.pvState = {};
Plant.applyProcessLag = function applyProcessLag() {
  for (const [id, lv] of Object.entries(Plant.live)) {
    const def = Plant.TAG_BY_ID[id];
    if (!def || def.type !== "number" || typeof lv.value !== "number") continue;
    const tau = Plant.LAG_TAU[def.unit];
    if (!tau || /SP$/.test(id)) continue;
    const prev = Plant.pvState[id];
    const next = prev == null ? lv.value : prev + (lv.value - prev) * (1 - Math.exp(-1 / tau));
    Plant.pvState[id] = next;
    lv.value = next;
  }
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

/** Any process unit upstream of Line 3 not running: the mass path is interrupted. */
Plant.isUpstreamHold = function isUpstreamHold() {
  return Plant.UNITS.some((u) => u.area !== "Packaging" && !Plant.unitRunning(u.area));
}

/** Packaging feed starved — its own infeed condition or a unit upstream not running. */
Plant.isFeedStarved = function isFeedStarved() {
  return Plant.unitStarved("Packaging");
}


Plant.equipState = function equipState(id) {
  const jam = Plant.state.packScenario === "jam";
  const down = !Plant.unitRunning("Packaging");
  const starved = Plant.isFeedStarved();
  if (id === "Cartoner" && jam) return "fault";
  if (id === "Infeed" && starved) return "warn";
  if (jam) {
    if (id === "Infeed") return "warn";
    // Downstream of the cartoner starves; nothing else is faulted
    return "idle";
  }
  if (down) return "idle";
  if (starved) return "warn";
  return "run";
}

Plant.getActiveFault = function getActiveFault(drawing) {
  const meta = Plant.DRAWING_FAULTS[drawing];
  if (!meta) return null;
  const v = Plant.state[meta.field];
  return meta.values.includes(v) ? v : null;
}

/** Set or clear an area's fault condition; a new fault latches the unit's state. */
Plant.setDrawingFault = function setDrawingFault(drawing, fault) {
  const meta = Plant.DRAWING_FAULTS[drawing];
  if (!meta) return false;
  if (fault == null || fault === "recover") {
    Plant.state[meta.field] = null;
    return true;
  }
  if (!meta.values.includes(fault)) return false;
  const was = Plant.state[meta.field];
  Plant.state[meta.field] = fault;
  const unit = Plant.UNIT_BY_DRAWING[drawing];
  if (unit && was !== fault) Plant.latchFault(unit.area, fault);
  return true;
}

/** Area health for overview sheet and drawing tone: run | fault | hold | starved */
Plant.areaHealth = function areaHealth(drawing) {
  const unit = Plant.UNIT_BY_DRAWING[drawing];
  if (!unit) return "run";
  const fault = Plant.getActiveFault(drawing);
  const critical = {
    packaging: { jam: true },
    mixing: { overtemp: true },
    refining: { pressure: true },
    conching: { overtemp: true },
    tempering: { warm: true },
    moulding: { jam: true },
  };
  if (fault && critical[drawing]?.[fault]) return "fault";
  const st = Plant.unitState(unit.area);
  if (st === "ABORTED" || st === "ABORTING") return "fault";
  if (!Plant.unitRunning(unit.area)) return "hold";
  if (Plant.unitStarved(unit.area)) return "starved";
  return "run";
}

/** Setpoint in force: the operator's write, else the recipe / default value. */
Plant.spValue = function spValue(tag, recipe) {
  if (tag === "SpeedSP") return Number(Plant.state.speedSp) > 0 ? Number(Plant.state.speedSp) : 38;
  const v = Plant.state.sp?.[tag];
  return Number.isFinite(v) ? v : recipe ?? Plant.SP_WRITE[tag]?.def;
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

/** Plant clock: the shift starts at 06:00 and one tick is one plant minute. */
Plant.plantTime = function plantTime(tick) {
  const mins = 6 * 60 + (Number(tick) || 0);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

Plant.isShelved = function isShelved(a) {
  return (Plant.state.shelved?.[a.id] ?? -1) > Plant.tick;
}

/** A consequential alarm is suppressed while an alarm in its source area is active. */
Plant.isSuppressed = function isSuppressed(a) {
  // Shelving the root doesn't release its consequences: the cause is still active
  return !!a.causedBy && Plant.state.alarms.some((r) => r.area === a.causedBy && !r.causedBy && !r.rtn);
}

/** Alarms the operator sees in the active list (not shelved, not suppressed). */
Plant.visibleAlarms = function visibleAlarms() {
  return Plant.state.alarms.filter((a) => !Plant.isShelved(a) && !Plant.isSuppressed(a));
}

/** Annunciated = visible and still active (RTN alarms no longer light the drawing). */
Plant.annunciatedAlarms = function annunciatedAlarms() {
  return Plant.visibleAlarms().filter((a) => !a.rtn);
}

Plant.firstOutAlarmId = function firstOutAlarmId(alarms) {
  const unacked = alarms.filter((a) => !a.acked && !a.rtn && !a.causedBy);
  if (!unacked.length) return null;
  return unacked.slice().sort((a, b) => (a.tick - b.tick) || (a.ts - b.ts))[0].id;
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

/** Current sister spark site name, or null. */
Plant.sparkSite = function sparkSite() {
  return Plant.live.__sparkSite?.value || null;
}

/**
 * Link snapshot for a site (Heuvelland or sister).
 * @returns {{ site: string, isHome: boolean, link: "live"|"flap"|"offline", mode: string, oee: number|null, lastContact: string, quality: string }}
 */
Plant.siteSnapshot = function siteSnapshot(site) {
  const isHome = site === Plant.SITE;
  const modeLv = Plant.live[`${site}/Mode`] || { value: "—", quality: "Stale" };
  const oeeLv = Plant.live[`${site}/OEE`];
  const contactLv = Plant.live[`${site}/LastContact`];
  const oee = typeof oeeLv?.value === "number" && Number.isFinite(oeeLv.value) ? oeeLv.value : null;
  let link = "live";
  if (!isHome) {
    link = Plant.sparkSite() === site ? "flap" : "offline";
  }
  return {
    site,
    isHome,
    link,
    mode: String(modeLv.value ?? "—"),
    oee,
    lastContact: String(contactLv?.value ?? "—"),
    quality: String(modeLv.quality || oeeLv?.quality || "Stale"),
  };
}

/** Sister fleet counts for KPI / scan. */
Plant.fleetSummary = function fleetSummary() {
  let offline = 0;
  let flap = 0;
  for (const site of Plant.SISTER_SITES) {
    if (Plant.siteSnapshot(site).link === "flap") flap += 1;
    else offline += 1;
  }
  return { offline, flap, total: Plant.SISTER_SITES.length };
}

Plant.fleetSummaryLabel = function fleetSummaryLabel() {
  const { offline, flap } = Plant.fleetSummary();
  if (flap) return `${offline} OFFLINE · ${flap} FLAP`;
  return `${offline} OFFLINE`;
}

/** Home site + sisters in display order. */
Plant.fleetSites = function fleetSites() {
  return [Plant.SITE, ...Plant.SISTER_SITES];
}
