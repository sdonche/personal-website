import { Plant } from "./ns.js?v=c600f295ec";


Plant.renderKpis = function renderKpis() {
  const jam = Plant.state.scenario === "jam" && !Plant.state.cartonerJamCleared;
  const drawing = Plant.state.activeDrawing;
  const mixing = drawing === "mixing";
  const refining = drawing === "refining";
  const conching = drawing === "conching";
  const tempering = drawing === "tempering";
  const moulding = drawing === "moulding";
  const packaging = drawing === "packaging";
  const mixOver = Plant.state.mixScenario === "overtemp";
  const mixValve = Plant.state.mixScenario === "valve";
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
  // Tag values in the strip are formatted exactly like the tree and faceplate
  // (Plant.formatValue: same units, decimals and spacing).
  const val = (tagId) => Plant.liveReadout(tagId) || "—";
  // Default tone follows the tag's OPC quality, so strip and tree never disagree.
  const qTone = (tagId) => {
    const q = Plant.live[tagId]?.quality;
    return q === "Bad" ? "bad" : q === "Uncertain" || q === "Stale" ? "warn" : "good";
  };

  const temperWarm = Plant.state.temperScenario === "warm";
  const temperBelt = Plant.state.temperScenario === "belt";
  const feedStarved = Plant.isFeedStarved();
  const overview = drawing === "overview";
  const areaHeld = (d) => {
    const h = Plant.areaHealth(d);
    return h === "hold" || h === "starved";
  };

  if (overview) {
    const oee = Plant.live.OEE?.value ?? 0;
    const batchId = String(Plant.live.__trackedBatch?.value ?? "—");
    const almN = Plant.state.alarms.length;
    const fleet = Plant.fleetSummaryLabel();
    const anyFault = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "fault");
    const anyWarn = Plant.PLANT_AREAS.some((a) => areaHeld(a.drawing));
    const flap = Plant.fleetSummary().flap > 0;
    setLabel("kpi-a-label", "Pkg OEE");
    setLabel("kpi-b-label", "Batch");
    setLabel("kpi-c-label", "Alarms");
    setLabel("kpi-d-label", "Sisters");
    setKpi("kpi-a", val("OEE"), anyFault ? "bad" : anyWarn || oee < 80 ? "warn" : "good");
    setKpi("kpi-b", batchId, "good");
    setKpi("kpi-c", String(almN), almN ? "bad" : "good");
    setKpi("kpi-d", fleet, flap ? "warn" : "good");
  } else if (mixing) {
    const level = Plant.live["Mixing/Mixer1/LevelPct"]?.value ?? 0;
    setLabel("kpi-a-label", "Level");
    setLabel("kpi-b-label", "Jacket");
    setLabel("kpi-c-label", "Agitator");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", val("Mixing/Mixer1/LevelPct"), mixValve || level > 88 ? "warn" : "good");
    setKpi("kpi-b", val("Mixing/Mixer1/JacketTempC"), mixOver ? "bad" : qTone("Mixing/Mixer1/JacketTempC"));
    setKpi("kpi-c", val("Mixing/Mixer1/AgitatorRpm"), mixOver || mixValve ? "warn" : "good");
    setKpi("kpi-d", String(Plant.live["Mixing/Mode"]?.value ?? "—"), mixOver ? "bad" : mixValve ? "warn" : "good");
  } else if (refining) {
    const mode = Plant.live["Refining/Mode"]?.value ?? "—";
    const refinePressure = Plant.state.refineScenario === "pressure";
    const refineParticle = Plant.state.refineScenario === "particle";
    const starvedRefine = mode === "STARVED";
    setLabel("kpi-a-label", "Load");
    setLabel("kpi-b-label", "Particle");
    setLabel("kpi-c-label", "Outlet");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", val("Refining/Refiner1/LoadPct"), refinePressure || starvedRefine ? "warn" : "good");
    setKpi("kpi-b", val("Refining/Refiner1/ParticleUm"), refineParticle ? "bad" : starvedRefine ? "warn" : "good");
    setKpi("kpi-c", val("Refining/Outlet/FlowKgH"), refinePressure || starvedRefine ? "warn" : "good");
    setKpi("kpi-d", String(mode), refinePressure ? "bad" : refineParticle || starvedRefine ? "warn" : "good");
  } else if (conching) {
    const mode = Plant.live["Conching/Mode"]?.value ?? "—";
    const concheOver = Plant.state.concheScenario === "overtemp";
    const concheAgit = Plant.state.concheScenario === "agitator";
    const starvedConche = mode === "STARVED";
    setLabel("kpi-a-label", "Temp");
    setLabel("kpi-b-label", "Agitator");
    setLabel("kpi-c-label", "Time");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", val("Conching/Conche1/TempC"), concheOver ? "bad" : starvedConche ? "warn" : "good");
    setKpi("kpi-b", val("Conching/Conche1/AgitatorRpm"), concheAgit ? "bad" : starvedConche ? "warn" : "good");
    setKpi("kpi-c", val("Conching/Conche1/TimeMin"), "good");
    setKpi("kpi-d", String(mode), concheOver ? "bad" : concheAgit || starvedConche ? "warn" : "good");
  } else if (tempering) {
    const temperStarve = (Plant.live["Tempering/Mode"]?.value ?? "") === "STARVED";
    setLabel("kpi-a-label", "Zone1");
    setLabel("kpi-b-label", "Zone3");
    setLabel("kpi-c-label", "Screw");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", val("Tempering/Temper1/Zone1TempC"), temperWarm ? "bad" : "good");
    setKpi("kpi-b", val("Tempering/Temper1/Zone3TempC"), temperWarm ? "bad" : "good");
    setKpi("kpi-c", val("Tempering/Temper1/ScrewRpm"), temperBelt ? "bad" : temperStarve ? "warn" : "good");
    setKpi("kpi-d", String(Plant.live["Tempering/Mode"]?.value ?? "—"), temperWarm ? "bad" : temperBelt || temperStarve ? "warn" : "good");
  } else if (moulding) {
    const mode = Plant.live["Moulding/Mode"]?.value ?? "—";
    const mouldJamSc = Plant.state.mouldScenario === "jam";
    const mouldCoolSc = Plant.state.mouldScenario === "cool";
    const starvedMould = mode === "STARVED";
    setLabel("kpi-a-label", "Cycles");
    setLabel("kpi-b-label", "Mould");
    setLabel("kpi-c-label", "Air");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", val("Moulding/Moulder1/CyclesPerMin"), mouldJamSc ? "bad" : starvedMould ? "warn" : "good");
    setKpi("kpi-b", val("Moulding/Moulder1/MouldTempC"), starvedMould ? "warn" : "good");
    setKpi("kpi-c", val("Moulding/Cooling/AirTempC"), mouldCoolSc ? "bad" : starvedMould ? "warn" : "good");
    setKpi("kpi-d", String(mode), mouldJamSc ? "bad" : mouldCoolSc || starvedMould ? "warn" : "good");
  } else {
    const oee = Plant.live.OEE?.value ?? 0;
    setLabel("kpi-a-label", "OEE");
    setLabel("kpi-b-label", "Thru");
    setLabel("kpi-c-label", "Mode");
    setLabel("kpi-d-label", "Rejects");
    setKpi("kpi-a", val("OEE"), jam ? "bad" : feedStarved ? "warn" : oee >= 80 ? "good" : "warn");
    setKpi("kpi-b", val("Throughput"), jam ? "bad" : feedStarved ? "warn" : "good");
    setKpi("kpi-c", String(Plant.live.Mode?.value ?? "—"), jam ? "bad" : feedStarved ? "warn" : "good");
    setKpi("kpi-d", String(Math.round(Plant.live["Checkweigher/Reject/Count"]?.value ?? 0)), "warn");
  }

  const overviewToolbar = document.querySelector('[data-toolbar-area="overview"]');
  const pkgToolbar = document.querySelector('[data-toolbar-area="packaging"]');
  const mixToolbar = document.querySelector('[data-toolbar-area="mixing"]');
  const temperToolbar = document.querySelector('[data-toolbar-area="tempering"]');
  const refineToolbar = document.querySelector('[data-toolbar-area="refining"]');
  const concheToolbar = document.querySelector('[data-toolbar-area="conching"]');
  const mouldToolbar = document.querySelector('[data-toolbar-area="moulding"]');
  if (overviewToolbar) overviewToolbar.hidden = !overview;
  if (pkgToolbar) pkgToolbar.hidden = !packaging;
  if (mixToolbar) mixToolbar.hidden = !mixing;
  if (temperToolbar) temperToolbar.hidden = !tempering;
  if (refineToolbar) refineToolbar.hidden = !refining;
  if (concheToolbar) concheToolbar.hidden = !conching;
  if (mouldToolbar) mouldToolbar.hidden = !moulding;
  document.querySelectorAll("[data-toolbar-packaging-only]").forEach((el) => {
    el.hidden = !packaging;
  });

  const fleetPanel = document.getElementById("plant-fleet-panel");
  if (fleetPanel) fleetPanel.hidden = !overview;
  if (overview) Plant.ensureFleet();

  const upstreamHold = Plant.isUpstreamHold();
  const paintRecover = (btn, hasLocalFault, opts) => {
    const blocked = opts && opts.blocked;
    btn.classList.toggle("is-active", false);
    btn.classList.toggle("plant-btn--ghost", !hasLocalFault || !!blocked);
  };

  document.querySelectorAll("[data-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-scenario");
    if (sc === "recover") {
      paintRecover(btn, Plant.state.scenario != null, { blocked: upstreamHold && Plant.state.scenario === null });
      btn.title = upstreamHold && Plant.state.scenario === null
        ? "Upstream hold — clear root cause first"
        : "Return packaging line to healthy AUTO";
      return;
    }
    btn.classList.toggle("is-active", Plant.state.scenario === sc);
  });
  document.querySelectorAll("[data-mix-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-mix-scenario");
    if (sc === "recover") {
      paintRecover(btn, Plant.state.mixScenario != null);
      return;
    }
    btn.classList.toggle("is-active", Plant.state.mixScenario === sc);
  });
  document.querySelectorAll("[data-temper-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-temper-scenario");
    const temperUpstream = (Plant.live["Tempering/Mode"]?.value ?? "") === "STARVED" && Plant.state.temperScenario === null;
    if (sc === "recover") {
      paintRecover(btn, Plant.state.temperScenario != null, { blocked: temperUpstream });
      return;
    }
    btn.classList.toggle("is-active", Plant.state.temperScenario === sc);
  });
  document.querySelectorAll("[data-refine-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-refine-scenario");
    const refineUpstream = (Plant.live["Refining/Mode"]?.value ?? "") === "STARVED" && Plant.state.refineScenario === null;
    if (sc === "recover") {
      paintRecover(btn, Plant.state.refineScenario != null, { blocked: refineUpstream });
      return;
    }
    btn.classList.toggle("is-active", Plant.state.refineScenario === sc);
  });
  document.querySelectorAll("[data-conche-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-conche-scenario");
    const concheUpstream = (Plant.live["Conching/Mode"]?.value ?? "") === "STARVED" && Plant.state.concheScenario === null;
    if (sc === "recover") {
      paintRecover(btn, Plant.state.concheScenario != null, { blocked: concheUpstream });
      return;
    }
    btn.classList.toggle("is-active", Plant.state.concheScenario === sc);
  });
  document.querySelectorAll("[data-mould-scenario]").forEach((btn) => {
    const sc = btn.getAttribute("data-mould-scenario");
    const mouldUpstream = (Plant.live["Moulding/Mode"]?.value ?? "") === "STARVED" && Plant.state.mouldScenario === null;
    if (sc === "recover") {
      paintRecover(btn, Plant.state.mouldScenario != null, { blocked: mouldUpstream });
      return;
    }
    btn.classList.toggle("is-active", Plant.state.mouldScenario === sc);
  });

  const recoverAllBtn = document.querySelector('[data-action="recover-all"]');
  if (recoverAllBtn) {
    const anyLocal = Plant.state.scenario != null || Plant.state.mixScenario != null
      || Plant.state.temperScenario != null || Plant.state.refineScenario != null
      || Plant.state.concheScenario != null || Plant.state.mouldScenario != null;
    paintRecover(recoverAllBtn, anyLocal);
  }

  const titleMap = {
    overview: "Heuvelland · Plant",
    mixing: "Heuvelland · Mixing",
    refining: "Heuvelland · Refining",
    conching: "Heuvelland · Conching",
    tempering: "Heuvelland · Tempering",
    moulding: "Heuvelland · Moulding",
    packaging: "Heuvelland · Packaging · Line 3",
  };
  const title = document.querySelector(".plant-hmi__title h1");
  if (title) title.textContent = titleMap[drawing] || titleMap.packaging;

  document.querySelectorAll(".plant-area-nav__btn[data-drawing]").forEach((btn) => {
    const d = btn.getAttribute("data-drawing");
    const on = d === Plant.state.activeDrawing;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });

  const scanDot = document.getElementById("plant-scan-dot");
  const scanLabel = document.getElementById("plant-scan-label");
  if (scanDot && scanLabel) {
    scanDot.classList.remove("is-fault", "is-warn");
    if (mixing && mixOver) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Overtemp"; }
    else if (mixing && mixValve) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Valve stuck"; }
    else if (refining && Plant.state.refineScenario === "pressure") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Pressure"; }
    else if (refining && Plant.state.refineScenario === "particle") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Particle"; }
    else if (conching && Plant.state.concheScenario === "overtemp") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Overtemp"; }
    else if (conching && Plant.state.concheScenario === "agitator") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Agitator"; }
    else if (tempering && temperWarm) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Zone warm"; }
    else if (tempering && temperBelt) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Drive stop"; }
    else if (moulding && Plant.state.mouldScenario === "jam") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Jam"; }
    else if (moulding && Plant.state.mouldScenario === "cool") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Cool air"; }
    else if (packaging && jam) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Jam"; }
    else if (packaging && feedStarved) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved"; }
    else if (overview) {
      const anyFault = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "fault");
      const anyWarn = Plant.PLANT_AREAS.some((a) => areaHeld(a.drawing));
      const flap = Plant.fleetSummary().flap > 0;
      if (anyFault) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Plant fault"; }
      else if (anyWarn) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Plant hold"; }
      else if (flap) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Sister flap"; }
      else scanLabel.textContent = "Plant healthy";
    } else if (!packaging && Plant.areaHealth(drawing) === "starved") {
      // Held by an upstream area: this area waits for mass
      scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved";
    } else {
      scanLabel.textContent = packaging ? "Line healthy" : "Area healthy";
    }
  }

  Plant.paintSiteChip();

  const headerAlarms = document.getElementById("plant-header-alarms");
  const headerAlarmCount = document.getElementById("plant-header-alarm-count");
  const almN = Plant.state.alarms.length;
  if (headerAlarms && headerAlarmCount) {
    headerAlarmCount.textContent = String(almN);
    const noun = document.getElementById("plant-header-alarm-noun");
    if (noun) noun.textContent = almN === 1 ? "alarm" : "alarms";
    headerAlarms.hidden = almN === 0;
  }
}

/** Link-mark SVG: chain for live/flap, slashed for offline. */
Plant.fleetLinkMark = function fleetLinkMark(link) {
  if (link === "offline") {
    return `<svg class="plant-fleet__mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5.5 6.5 L3.8 8.2a2.2 2.2 0 0 0 3.1 3.1L8.5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M10.5 9.5 L12.2 7.8a2.2 2.2 0 0 0-3.1-3.1L7.5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M3.5 3.5 L12.5 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg class="plant-fleet__mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M5.5 6.5 L3.8 8.2a2.2 2.2 0 0 0 3.1 3.1L8.5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M10.5 9.5 L12.2 7.8a2.2 2.2 0 0 0-3.1-3.1L7.5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M6.6 9.4 L9.4 6.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
}

Plant.ensureFleet = function ensureFleet() {
  const panel = document.getElementById("plant-fleet-panel");
  const host = document.getElementById("plant-fleet");
  const mapHost = document.getElementById("plant-site-map");
  if (!panel || !host) return;
  if (host.dataset.built !== "1") {
    host.innerHTML = Plant.fleetSites().map((site) => {
      const home = site === Plant.SITE;
      return `<button type="button" class="plant-fleet__cell" data-fleet-site="${Plant.escapeHtml(site)}" aria-label="${Plant.escapeHtml(site)} site">
        <span class="plant-fleet__head">
          <span class="plant-fleet__mark-wrap" data-fleet-mark></span>
          <span class="plant-fleet__name">${Plant.escapeHtml(site)}</span>
          <span class="plant-fleet__badge" data-fleet-badge>${home ? "LIVE" : "OFFLINE"}</span>
        </span>
        <span class="plant-fleet__mode" data-fleet-mode>—</span>
        <span class="plant-fleet__oee" data-fleet-oee>—</span>
        <span class="plant-fleet__contact" data-fleet-contact>—</span>
      </button>`;
    }).join("");
    host.dataset.built = "1";
  }
  if (mapHost && mapHost.dataset.built !== "map-v2") {
    mapHost.innerHTML = Plant.buildSiteMapSvg();
    mapHost.dataset.built = "map-v2";
  }
  Plant.paintFleet();
}

Plant.buildSiteMapSvg = function buildSiteMapSvg() {
  const links = (Plant.SITE_MAP_LINKS || []).map(([a, b], i) => {
    const pa = Plant.SITE_MAP[a];
    const pb = Plant.SITE_MAP[b];
    if (!pa || !pb) return "";
    return `<line class="plant-site-map__link" data-map-link="${i}" data-map-a="${Plant.escapeHtml(a)}" data-map-b="${Plant.escapeHtml(b)}" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" />`;
  }).join("");
  const nodes = Plant.fleetSites().map((site) => {
    const pos = Plant.SITE_MAP[site];
    if (!pos) return "";
    const home = !!pos.home || site === Plant.SITE;
    const r = home ? 9 : 7;
    const lx = pos.x + (pos.lx || 0);
    const ly = pos.y + (pos.ly || 0);
    const anchor = pos.anchor || "middle";
    const short = site === "Heuvelland" ? "Heuvelland" : site;
    return `<g class="plant-site-map__node${home ? " is-home" : ""}" data-fleet-site="${Plant.escapeHtml(site)}" tabindex="0" role="button" aria-label="${Plant.escapeHtml(site)}">
      <line class="plant-site-map__leader" x1="${pos.x}" y1="${pos.y}" x2="${lx}" y2="${ly}" />
      <circle class="plant-site-map__hit" cx="${pos.x}" cy="${pos.y}" r="${r + 10}" />
      <circle class="plant-site-map__ring" cx="${pos.x}" cy="${pos.y}" r="${r + 3}" />
      <circle class="plant-site-map__dot" cx="${pos.x}" cy="${pos.y}" r="${r}" />
      <path class="plant-site-map__slash" d="M${pos.x - r * 0.85} ${pos.y - r * 0.85} L${pos.x + r * 0.85} ${pos.y + r * 0.85}" />
      <g class="plant-site-map__callout" transform="translate(${lx}, ${ly})">
        <rect class="plant-site-map__plate" x="${anchor === "end" ? -72 : anchor === "start" ? 0 : -36}" y="-11" width="72" height="22" rx="1.5" />
        <text class="plant-site-map__label" x="${anchor === "end" ? -8 : anchor === "start" ? 8 : 0}" y="-1" text-anchor="${anchor}">${Plant.escapeHtml(short)}</text>
        <text class="plant-site-map__badge" data-map-badge x="${anchor === "end" ? -8 : anchor === "start" ? 8 : 0}" y="9" text-anchor="${anchor}">—</text>
      </g>
    </g>`;
  }).join("");
  // Title band on top (y 8–34); the map itself is shifted down 22 and clipped
  // below the band so coastline and labels never run through the title.
  return `<svg class="plant-site-map__svg" viewBox="0 0 340 244" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Schematic West Flanders site map">
    <title>Schematic site map — relative layout, not to scale</title>
    <defs>
      <linearGradient id="plant-map-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(14, 116, 144, 0.18)" />
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0)" />
      </linearGradient>
      <clipPath id="plant-map-clip"><rect x="8" y="12" width="324" height="214" /></clipPath>
    </defs>
    <rect class="plant-site-map__sheet" x="8" y="8" width="324" height="228" rx="2" />
    <text class="plant-site-map__title" x="18" y="25">SITES · WEST FLANDERS</text>
    <text class="plant-site-map__caption" x="322" y="25" text-anchor="end">SCHEMATIC · NOT TO SCALE</text>
    <line class="plant-site-map__rule" x1="8" y1="34" x2="332" y2="34" />
    <g transform="translate(0, 22)">
      <g clip-path="url(#plant-map-clip)">
        <polygon class="plant-site-map__sea" points="${Plant.SITE_MAP_SEA}" fill="url(#plant-map-sea)" />
        <text class="plant-site-map__sea-label" x="70" y="40">NORTH SEA</text>
        <polygon class="plant-site-map__land" points="${Plant.SITE_MAP_LAND}" />
      </g>
      <g class="plant-site-map__links">${links}</g>
      <g class="plant-site-map__nodes">${nodes}</g>
    </g>
  </svg>`;
}

Plant.paintFleet = function paintFleet() {
  const panel = document.getElementById("plant-fleet-panel");
  const host = document.getElementById("plant-fleet");
  if (!panel || panel.hidden || !host || host.dataset.built !== "1") return;
  const selectedSite = Plant.isSisterSiteTag(Plant.state.selectedTag)
    ? Plant.state.selectedTag.split("/")[0]
    : (String(Plant.state.selectedTag || "").startsWith(`${Plant.SITE}/`) ? Plant.SITE : null);
  host.querySelectorAll("[data-fleet-site]").forEach((cell) => {
    const site = cell.getAttribute("data-fleet-site");
    const snap = Plant.siteSnapshot(site);
    cell.classList.toggle("is-home", snap.isHome);
    cell.classList.toggle("is-offline", snap.link === "offline");
    cell.classList.toggle("is-flap", snap.link === "flap");
    cell.classList.toggle("is-live", snap.link === "live");
    cell.classList.toggle("is-selected", selectedSite === site);
    const badge = snap.isHome ? "LIVE" : snap.link === "flap" ? "FLAP" : "OFFLINE";
    const mark = cell.querySelector("[data-fleet-mark]");
    if (mark) mark.innerHTML = Plant.fleetLinkMark(snap.link);
    const badgeEl = cell.querySelector("[data-fleet-badge]");
    if (badgeEl) badgeEl.textContent = badge;
    const modeEl = cell.querySelector("[data-fleet-mode]");
    if (modeEl) modeEl.textContent = snap.mode;
    const oeeEl = cell.querySelector("[data-fleet-oee]");
    if (oeeEl) {
      const oeeTxt = snap.oee == null ? "—" : `${snap.oee.toFixed(1)} %`;
      oeeEl.textContent = snap.link === "offline" ? `Last OEE ${oeeTxt}` : `OEE ${oeeTxt}`;
    }
    const contactEl = cell.querySelector("[data-fleet-contact]");
    if (contactEl) {
      contactEl.textContent = snap.isHome || snap.link === "flap"
        ? `Contact ${snap.lastContact}`
        : `Last ${snap.lastContact}`;
      contactEl.title = snap.lastContact;
    }
    cell.setAttribute(
      "aria-label",
      `${site}: ${badge}, mode ${snap.mode}${snap.oee == null ? "" : `, OEE ${snap.oee.toFixed(1)}%`}`
    );
  });
  Plant.paintSiteMap(selectedSite);
}

Plant.paintSiteMap = function paintSiteMap(selectedSite) {
  const mapHost = document.getElementById("plant-site-map");
  if (!mapHost || mapHost.dataset.built !== "map-v2") return;
  mapHost.querySelectorAll(".plant-site-map__node[data-fleet-site]").forEach((g) => {
    const site = g.getAttribute("data-fleet-site");
    const snap = Plant.siteSnapshot(site);
    g.classList.toggle("is-home", snap.isHome);
    g.classList.toggle("is-offline", snap.link === "offline");
    g.classList.toggle("is-flap", snap.link === "flap");
    g.classList.toggle("is-live", snap.link === "live");
    g.classList.toggle("is-selected", selectedSite === site);
    const badge = snap.isHome ? "LIVE" : snap.link === "flap" ? "FLAP" : "OFFLINE";
    const badgeEl = g.querySelector("[data-map-badge]");
    if (badgeEl) badgeEl.textContent = badge;
    g.setAttribute("aria-label", `${site}: ${badge}`);
  });
  mapHost.querySelectorAll("[data-map-link]").forEach((line) => {
    const a = line.getAttribute("data-map-a");
    const b = line.getAttribute("data-map-b");
    const sa = Plant.siteSnapshot(a);
    const sb = Plant.siteSnapshot(b);
    const aUp = sa.link === "live" || sa.link === "flap";
    const bUp = sb.link === "live" || sb.link === "flap";
    const bothUp = aUp && bUp;
    const anyFlap = sa.link === "flap" || sb.link === "flap";
    line.classList.toggle("is-up", bothUp && !anyFlap);
    line.classList.toggle("is-flap", bothUp && anyFlap);
    line.classList.toggle("is-down", !bothUp);
  });
}

Plant.selectFleetSite = function selectFleetSite(site) {
  if (!site) return;
  const tagId = `${site}/Mode`;
  if (Plant.TAG_BY_ID[tagId]) Plant.selectTag(tagId);
}

Plant.paintSiteChip = function paintSiteChip() {
  const chip = document.getElementById("plant-site-chip");
  if (!chip) return;
  const tag = Plant.state.selectedTag;
  if (Plant.isSisterSiteTag(tag)) {
    const site = tag.split("/")[0];
    const snap = Plant.siteSnapshot(site);
    const linkTxt = snap.link === "flap" ? "flapping link" : "offline, last known values";
    chip.hidden = false;
    chip.textContent = `Viewing ${site} tags · ${linkTxt} · Heuvelland P&ID still shown`;
    chip.classList.toggle("is-flap", snap.link === "flap");
    chip.classList.toggle("is-offline", snap.link === "offline");
  } else {
    chip.hidden = true;
    chip.textContent = "";
    chip.classList.remove("is-flap", "is-offline");
  }
}

Plant.renderAll = function renderAll(opts) {
  const forceAlarms = !opts || opts.alarms !== false;
  Plant.renderTree();
  Plant.paintSisterSpark();
  Plant.renderPid();
  Plant.renderKpis();
  Plant.renderBatchTrail();
  Plant.renderDetail();
  if (forceAlarms || Plant.tick % 5 === 0 || Plant.tick <= 1) Plant.renderAlarms();
  else Plant.updateAlarmTimes();
}

Plant.renderBatchTrail = function renderBatchTrail() {
  const idBtn = document.getElementById("plant-batch-id");
  const steps = document.getElementById("plant-batch-steps");
  if (!idBtn || !steps) return;
  const batchId = String(Plant.live.__trackedBatch?.value ?? "—");
  idBtn.textContent = `BATCH ${batchId}`;
  const here = Plant.batchStepIndex(Plant.live.__batchPhase?.value ?? (Plant.tick % 90));
  steps.querySelectorAll("[data-batch-step]").forEach((btn) => {
    const step = btn.getAttribute("data-batch-step");
    const idx = Plant.BATCH_STEPS.indexOf(step);
    const li = btn.closest("li");
    if (!li) return;
    li.classList.remove("is-done", "is-here", "is-pending");
    if (idx < here) li.classList.add("is-done");
    else if (idx === here) li.classList.add("is-here");
    else li.classList.add("is-pending");
    btn.classList.toggle("is-active", step === Plant.state.activeDrawing || (Plant.state.activeDrawing === "overview" && idx === here));
    const pos = idx === here ? "batch position" : idx < here ? "completed" : "pending";
    btn.setAttribute("aria-label", `${step} — ${pos} (open sheet)`);
    btn.title = `${step}: batch position vs open sheet`;
  });
}

/* ---------------- Wire ---------------- */

Plant.wire = function wire() {
  const tree = document.getElementById("plant-tree");
  tree?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tag]");
    if (btn && btn.getAttribute("data-tag")) {
      Plant.selectTag(btn.getAttribute("data-tag"));
      return;
    }
    const areaLi = e.target.closest("li[data-drawing]");
    if (areaLi && e.target.closest("summary") && areaLi.querySelector(":scope > details > summary")?.contains(e.target)) {
      const drawing = areaLi.getAttribute("data-drawing");
      if (drawing) Plant.setActiveDrawing(drawing);
    }
  });

  tree?.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!(det instanceof HTMLDetailsElement)) return;
    const node = det.getAttribute("data-node");
    if (!node) return;
    const open = new Set(Plant.state.openNodes);
    if (det.open) open.add(node);
    else open.delete(node);
    Plant.state.openNodes = [...open];
    Plant.saveState();
  }, true);

  tree?.addEventListener("pointerover", (e) => {
    const btn = e.target.closest(".plant-tag[data-tag]");
    if (!btn) return;
    const id = btn.getAttribute("data-tag");
    if (!id || Plant.isStubTag(id)) {
      Plant.clearPidHover();
      return;
    }
    if (Plant.drawingForTag(id) !== Plant.state.activeDrawing) {
      Plant.clearPidHover();
      return;
    }
    if (id) Plant.applyPidHover(id, Plant.equipKeyForTag(id));
  });
  tree?.addEventListener("pointerout", (e) => {
    if (!e.relatedTarget || !tree.contains(e.relatedTarget)) Plant.clearPidHover();
  });

  const pid = document.getElementById("plant-pid");
  pid?.addEventListener("click", (e) => {
    const area = e.target.closest("[data-overview-area]");
    if (area) {
      const d = area.getAttribute("data-overview-area");
      if (d) Plant.setActiveDrawing(d);
      return;
    }
    const hit = e.target.closest("[data-tag]");
    if (hit && hit.getAttribute("data-tag")) Plant.selectTag(hit.getAttribute("data-tag"));
  });

  pid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const area = e.target.closest("[data-overview-area]");
    if (area) {
      e.preventDefault();
      const d = area.getAttribute("data-overview-area");
      if (d) Plant.setActiveDrawing(d);
      return;
    }
    const hit = e.target.closest("[data-tag]");
    if (hit && hit.getAttribute("data-tag")) {
      e.preventDefault();
      Plant.selectTag(hit.getAttribute("data-tag"));
    }
  });

  pid?.addEventListener("pointerover", (e) => {
    const hit = e.target.closest("[data-tag], [data-equip]");
    if (!hit) return;
    Plant.applyPidHover(hit.getAttribute("data-tag"), hit.getAttribute("data-equip"));
  });
  pid?.addEventListener("pointerout", (e) => {
    if (!e.relatedTarget || !pid.contains(e.relatedTarget)) Plant.clearPidHover();
  });

  document.getElementById("plant-fleet-panel")?.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-fleet-site]");
    if (!cell) return;
    Plant.selectFleetSite(cell.getAttribute("data-fleet-site"));
  });
  document.getElementById("plant-fleet-panel")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = e.target.closest("[data-fleet-site]");
    if (!cell) return;
    e.preventDefault();
    Plant.selectFleetSite(cell.getAttribute("data-fleet-site"));
  });

  document.querySelector(".plant-toolbar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action], [data-scenario], [data-mix-scenario], [data-temper-scenario], [data-refine-scenario], [data-conche-scenario], [data-mould-scenario]");
    if (!btn) return;
    const sc = btn.getAttribute("data-scenario");
    const mixSc = btn.getAttribute("data-mix-scenario");
    const temperSc = btn.getAttribute("data-temper-scenario");
    const refineSc = btn.getAttribute("data-refine-scenario");
    const concheSc = btn.getAttribute("data-conche-scenario");
    const mouldSc = btn.getAttribute("data-mould-scenario");
    if (sc) { Plant.setScenario(sc); return; }
    if (mixSc) { Plant.setMixScenario(mixSc); return; }
    if (temperSc) { Plant.setTemperScenario(temperSc); return; }
    if (refineSc) { Plant.setRefineScenario(refineSc); return; }
    if (concheSc) { Plant.setConcheScenario(concheSc); return; }
    if (mouldSc) { Plant.setMouldScenario(mouldSc); return; }
    const action = btn.getAttribute("data-action");
    if (action === "ack-all") Plant.ackAll();
    else if (action === "reset-reject") Plant.resetReject();
    else if (action === "clear-jam") Plant.clearCartonerJam();
    else if (action === "recover-all") Plant.recoverAll();
    else if (action === "reset-line") Plant.resetLine();
  });

  document.getElementById("plant-batch-trail")?.addEventListener("click", (e) => {
    const idBtn = e.target.closest("#plant-batch-id");
    if (idBtn) {
      // The tracked batch sits in exactly one area: select that area's BatchId
      const tag = Plant.BATCH_HOME_TAG[Plant.BATCH_STEPS[Plant.batchStepIndex(Plant.live.__batchPhase?.value ?? (Plant.tick % 90))]] || "BatchId";
      Plant.selectTag(tag);
      return;
    }
    const stepBtn = e.target.closest("[data-batch-step]");
    if (stepBtn) {
      const step = stepBtn.getAttribute("data-batch-step");
      if (step) Plant.setActiveDrawing(step);
    }
  });

  document.querySelector(".plant-area-nav")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-drawing]");
    if (!btn) return;
    Plant.setActiveDrawing(btn.getAttribute("data-drawing"));
  });

  document.getElementById("plant-header-alarms")?.addEventListener("click", () => {
    Plant.state.alarmPane = "active";
    Plant.saveState();
    Plant.renderAlarms();
    const pane = document.querySelector(".plant-pane--alarms");
    pane?.scrollIntoView({ behavior: Plant.reducedMotion ? "auto" : "smooth", block: "nearest" });
    document.getElementById("plant-alarms")?.focus?.();
  });

  document.getElementById("plant-alarms")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ack]");
    if (btn) {
      e.stopPropagation();
      Plant.ackOne(btn.getAttribute("data-ack"));
      return;
    }
    const row = e.target.closest(".plant-alarm[data-alarm-id]");
    if (!row) return;
    const id = row.getAttribute("data-alarm-id");
    const alarm = Plant.state.alarms.find((a) => a.id === id)
      || (Plant.state.alarmHistory || []).find((a) => a.id === id);
    if (alarm) Plant.navigateToAlarm(alarm);
  });

  document.getElementById("plant-alarms")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".plant-alarm[data-alarm-id]");
    if (!row) return;
    e.preventDefault();
    const id = row.getAttribute("data-alarm-id");
    const alarm = Plant.state.alarms.find((a) => a.id === id)
      || (Plant.state.alarmHistory || []).find((a) => a.id === id);
    if (alarm) Plant.navigateToAlarm(alarm);
  });

  document.querySelector(".plant-alarm-tools")?.addEventListener("click", (e) => {
    const pane = e.target.closest("[data-alarm-pane]");
    if (pane) {
      Plant.state.alarmPane = pane.getAttribute("data-alarm-pane") === "history" ? "history" : "active";
      Plant.saveState();
      Plant.renderAlarms();
      return;
    }
    const filt = e.target.closest("[data-alarm-filter]");
    if (filt) {
      const v = filt.getAttribute("data-alarm-filter");
      Plant.state.alarmFilter = v === "critical" || v === "warning" ? v : "all";
      Plant.saveState();
      Plant.renderAlarms();
    }
  });

  document.getElementById("plant-detail")?.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-faceplate-write]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input[name="speed"]');
    if (input) Plant.writeSpeedSp(input.value);
  });
}

Plant.tickOnce = function tickOnce() {
  Plant.tick += 1;
  Plant.computeLive();
  Plant.saveState();
  Plant.renderAll({ alarms: false });
}

Plant.startClock = function startClock() {
  const el = document.getElementById("plant-clock");
  const paint = () => {
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString(undefined, { hour12: false });
  };
  paint();
  setInterval(paint, 1000);
}
