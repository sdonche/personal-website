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
    const batchId = String(Plant.live.BatchId?.value ?? "—");
    const almN = Plant.state.alarms.length;
    const mode = Plant.plantModeSummary();
    const anyFault = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "fault");
    const anyWarn = Plant.PLANT_AREAS.some((a) => areaHeld(a.drawing));
    setLabel("kpi-a-label", "Line3 OEE");
    setLabel("kpi-b-label", "Batch");
    setLabel("kpi-c-label", "Alarms");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", `${oee.toFixed(1)}%`, anyFault ? "bad" : anyWarn || oee < 80 ? "warn" : "good");
    setKpi("kpi-b", batchId, "good");
    setKpi("kpi-c", String(almN), almN ? "bad" : "good");
    setKpi("kpi-d", mode, anyFault ? "bad" : anyWarn ? "warn" : "good");
  } else if (mixing) {
    const level = Plant.live["Mixing/Mixer1/LevelPct"]?.value ?? 0;
    const jacket = Plant.live["Mixing/Mixer1/JacketTempC"]?.value ?? 0;
    const rpm = Plant.live["Mixing/Mixer1/AgitatorRpm"]?.value ?? 0;
    setLabel("kpi-a-label", "Level");
    setLabel("kpi-b-label", "Jacket");
    setLabel("kpi-c-label", "RPM");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", `${level.toFixed(1)}%`, mixValve ? "warn" : level > 88 ? "warn" : "good");
    setKpi("kpi-b", `${jacket.toFixed(1)}°C`, mixOver || jacket > 52 ? "bad" : "good");
    setKpi("kpi-c", String(Math.round(rpm)), mixOver || mixValve ? "warn" : "good");
    setKpi("kpi-d", String(Plant.live["Mixing/Mode"]?.value ?? "—"), mixOver ? "bad" : mixValve ? "warn" : "good");
  } else if (refining) {
    const load = Plant.live["Refining/Refiner1/LoadPct"]?.value ?? 0;
    const particle = Plant.live["Refining/Refiner1/ParticleUm"]?.value ?? 0;
    const outFlow = Plant.live["Refining/Outlet/FlowKgH"]?.value ?? 0;
    const mode = Plant.live["Refining/Mode"]?.value ?? "—";
    const refinePressure = Plant.state.refineScenario === "pressure";
    const refineParticle = Plant.state.refineScenario === "particle";
    const starvedRefine = mode === "STARVED";
    setLabel("kpi-a-label", "Load");
    setLabel("kpi-b-label", "Particle");
    setLabel("kpi-c-label", "Outlet");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", `${load.toFixed(1)}%`, refinePressure || starvedRefine ? "warn" : "good");
    setKpi("kpi-b", `${particle.toFixed(1)} µm`, refineParticle ? "bad" : starvedRefine ? "warn" : "good");
    setKpi("kpi-c", String(Math.round(outFlow)), refinePressure || starvedRefine ? "warn" : "good");
    setKpi("kpi-d", String(mode), refinePressure ? "bad" : refineParticle || starvedRefine ? "warn" : "good");
  } else if (conching) {
    const temp = Plant.live["Conching/Conche1/TempC"]?.value ?? 0;
    const rpm = Plant.live["Conching/Conche1/AgitatorRpm"]?.value ?? 0;
    const timeMin = Plant.live["Conching/Conche1/TimeMin"]?.value ?? 0;
    const mode = Plant.live["Conching/Mode"]?.value ?? "—";
    const concheOver = Plant.state.concheScenario === "overtemp";
    const concheAgit = Plant.state.concheScenario === "agitator";
    const starvedConche = mode === "STARVED";
    setLabel("kpi-a-label", "Temp");
    setLabel("kpi-b-label", "RPM");
    setLabel("kpi-c-label", "Time");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", `${temp.toFixed(1)}°C`, concheOver ? "bad" : starvedConche ? "warn" : "good");
    setKpi("kpi-b", String(Math.round(rpm)), concheAgit ? "bad" : starvedConche ? "warn" : "good");
    setKpi("kpi-c", `${Math.round(timeMin)} min`, "good");
    setKpi("kpi-d", String(mode), concheOver ? "bad" : concheAgit || starvedConche ? "warn" : "good");
  } else if (tempering) {
    const z1 = Plant.live["Tempering/Temper1/Zone1TempC"]?.value ?? 0;
    const z3 = Plant.live["Tempering/Temper1/Zone3TempC"]?.value ?? 0;
    const screw = Plant.live["Tempering/Temper1/ScrewRpm"]?.value ?? 0;
    const temperStarve = (Plant.live["Tempering/Mode"]?.value ?? "") === "STARVED";
    setLabel("kpi-a-label", "Zone1");
    setLabel("kpi-b-label", "Zone3");
    setLabel("kpi-c-label", "Screw");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", `${z1.toFixed(1)}°C`, temperWarm ? "bad" : "good");
    setKpi("kpi-b", `${z3.toFixed(1)}°C`, temperWarm ? "bad" : "good");
    setKpi("kpi-c", `${screw.toFixed(1)} rpm`, temperBelt ? "bad" : temperStarve ? "warn" : "good");
    setKpi("kpi-d", String(Plant.live["Tempering/Mode"]?.value ?? "—"), temperWarm ? "bad" : temperBelt || temperStarve ? "warn" : "good");
  } else if (moulding) {
    const cycles = Plant.live["Moulding/Moulder1/CyclesPerMin"]?.value ?? 0;
    const mouldTemp = Plant.live["Moulding/Moulder1/MouldTempC"]?.value ?? 0;
    const airTemp = Plant.live["Moulding/Cooling/AirTempC"]?.value ?? 0;
    const mode = Plant.live["Moulding/Mode"]?.value ?? "—";
    const mouldJamSc = Plant.state.mouldScenario === "jam";
    const mouldCoolSc = Plant.state.mouldScenario === "cool";
    const starvedMould = mode === "STARVED";
    setLabel("kpi-a-label", "Cycles");
    setLabel("kpi-b-label", "Mould °C");
    setLabel("kpi-c-label", "Air °C");
    setLabel("kpi-d-label", "Mode");
    setKpi("kpi-a", String(Math.round(cycles)), mouldJamSc ? "bad" : starvedMould ? "warn" : "good");
    setKpi("kpi-b", `${mouldTemp.toFixed(1)}°C`, starvedMould ? "warn" : "good");
    setKpi("kpi-c", `${airTemp.toFixed(1)}°C`, mouldCoolSc ? "bad" : starvedMould ? "warn" : "good");
    setKpi("kpi-d", String(mode), mouldJamSc ? "bad" : mouldCoolSc || starvedMould ? "warn" : "good");
  } else {
    const oee = Plant.live.OEE?.value ?? 0;
    setLabel("kpi-a-label", "OEE");
    setLabel("kpi-b-label", "Thru");
    setLabel("kpi-c-label", "Mode");
    setLabel("kpi-d-label", "Rejects");
    setKpi("kpi-a", `${oee.toFixed(1)}%`, jam ? "bad" : feedStarved ? "warn" : oee >= 80 ? "good" : "warn");
    setKpi("kpi-b", String(Math.round(Plant.live.Throughput?.value ?? 0)), jam ? "bad" : feedStarved ? "warn" : "good");
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
    packaging: "Heuvelland · Line 3",
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
    else if (mixing && mixValve) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Valve fault"; }
    else if (refining && Plant.state.refineScenario === "pressure") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Pressure"; }
    else if (refining && Plant.state.refineScenario === "particle") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Particle"; }
    else if (conching && Plant.state.concheScenario === "overtemp") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Overtemp"; }
    else if (conching && Plant.state.concheScenario === "agitator") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Agitator"; }
    else if (tempering && temperWarm) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Zone warm"; }
    else if (tempering && temperBelt) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Drive stop"; }
    else if (moulding && Plant.state.mouldScenario === "jam") { scanDot.classList.add("is-fault"); scanLabel.textContent = "Jam"; }
    else if (moulding && Plant.state.mouldScenario === "cool") { scanDot.classList.add("is-warn"); scanLabel.textContent = "Cool air"; }
    else if (packaging && jam) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Fault"; }
    else if (packaging && feedStarved) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved"; }
    else if (overview) {
      const anyFault = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "fault");
      const anyWarn = Plant.PLANT_AREAS.some((a) => areaHeld(a.drawing));
      if (anyFault) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Plant fault"; }
      else if (anyWarn) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Plant hold"; }
      else scanLabel.textContent = "Line healthy";
    } else {
      scanLabel.textContent = "Line healthy";
    }
  }

  const headerAlarms = document.getElementById("plant-header-alarms");
  const headerAlarmCount = document.getElementById("plant-header-alarm-count");
  const almN = Plant.state.alarms.length;
  if (headerAlarms && headerAlarmCount) {
    headerAlarmCount.textContent = String(almN);
    headerAlarms.hidden = almN === 0;
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
  const batchId = String(Plant.live.BatchId?.value ?? Plant.live["Mixing/BatchId"]?.value ?? "—");
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
      const tag = Plant.BATCH_HOME_TAG[Plant.state.activeDrawing] || Plant.BATCH_HOME_TAG[Plant.BATCH_STEPS[Plant.batchStepIndex(Plant.live.__batchPhase?.value ?? (Plant.tick % 90))]] || "BatchId";
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
