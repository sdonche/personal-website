/* =============================================================
   plant.js — Plant Live View (/plant/)
   Simulated packaging line: tag tree, mimic, alarms, scenarios.
   State persists in localStorage until "Reset line".
   ============================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "samdonche.plant.v1";
  const TICK_MS = 1000;
  const PROVIDER = "[edge]";
  const LINE = "Line3";

  const AREAS = [
    "Line",
    "Infeed",
    "Cartoner",
    "Checkweigher",
    "Reject",
    "CasePacker",
    "Palletizer",
    "Outfeed",
  ];

  const STAGES = [
    { id: "Infeed", label: "Infeed" },
    { id: "Cartoner", label: "Cartoner" },
    { id: "Checkweigher", label: "Checkweigher" },
    { id: "CasePacker", label: "Case packer" },
    { id: "Palletizer", label: "Palletizer" },
    { id: "Outfeed", label: "Outfeed" },
  ];

  /** @typedef {"Good"|"Uncertain"|"Bad"|"Stale"} Quality */

  /**
   * @typedef {{
   *   id: string,
   *   area: string,
   *   name: string,
   *   type: "bool"|"number"|"string",
   *   unit?: string,
   *   format?: (v: any) => string
   * }} TagDef
   */

  /** @type {TagDef[]} */
  const TAG_DEFS = [
    { id: "Line/Running", area: "Line", name: "Running", type: "bool" },
    { id: "Line/Mode", area: "Line", name: "Mode", type: "string" },
    { id: "Line/OEE", area: "Line", name: "OEE", type: "number", unit: "%", format: (v) => v.toFixed(1) },
    { id: "Line/Throughput", area: "Line", name: "Throughput", type: "number", unit: "cpm", format: (v) => String(Math.round(v)) },
    { id: "Line/SpeedSP", area: "Line", name: "SpeedSP", type: "number", unit: "cpm", format: (v) => String(Math.round(v)) },

    { id: "Infeed/Running", area: "Infeed", name: "Running", type: "bool" },
    { id: "Infeed/Speed", area: "Infeed", name: "Speed", type: "number", unit: "m/min", format: (v) => v.toFixed(1) },
    { id: "Infeed/Jam", area: "Infeed", name: "Jam", type: "bool" },
    { id: "Infeed/Photoeye", area: "Infeed", name: "Photoeye", type: "bool" },
    { id: "Infeed/Starved", area: "Infeed", name: "Starved", type: "bool" },

    { id: "Cartoner/Running", area: "Cartoner", name: "Running", type: "bool" },
    { id: "Cartoner/Speed", area: "Cartoner", name: "Speed", type: "number", unit: "cpm", format: (v) => String(Math.round(v)) },
    { id: "Cartoner/Jam", area: "Cartoner", name: "Jam", type: "bool" },
    { id: "Cartoner/CartonsPerMin", area: "Cartoner", name: "CartonsPerMin", type: "number", unit: "cpm", format: (v) => String(Math.round(v)) },
    { id: "Cartoner/FaultCode", area: "Cartoner", name: "FaultCode", type: "number", format: (v) => String(v) },

    { id: "Checkweigher/Running", area: "Checkweigher", name: "Running", type: "bool" },
    { id: "Checkweigher/WeightKg", area: "Checkweigher", name: "WeightKg", type: "number", unit: "kg", format: (v) => v.toFixed(3) },
    { id: "Checkweigher/InSpec", area: "Checkweigher", name: "InSpec", type: "bool" },
    { id: "Checkweigher/UnderCount", area: "Checkweigher", name: "UnderCount", type: "number", format: (v) => String(Math.round(v)) },
    { id: "Checkweigher/OverCount", area: "Checkweigher", name: "OverCount", type: "number", format: (v) => String(Math.round(v)) },

    { id: "Reject/Count", area: "Reject", name: "Count", type: "number", format: (v) => String(Math.round(v)) },
    { id: "Reject/Active", area: "Reject", name: "Active", type: "bool" },
    { id: "Reject/Divert", area: "Reject", name: "Divert", type: "bool" },

    { id: "CasePacker/Running", area: "CasePacker", name: "Running", type: "bool" },
    { id: "CasePacker/Speed", area: "CasePacker", name: "Speed", type: "number", unit: "cpm", format: (v) => String(Math.round(v)) },
    { id: "CasePacker/CasesPerMin", area: "CasePacker", name: "CasesPerMin", type: "number", unit: "cpm", format: (v) => v.toFixed(1) },
    { id: "CasePacker/Jam", area: "CasePacker", name: "Jam", type: "bool" },

    { id: "Palletizer/Running", area: "Palletizer", name: "Running", type: "bool" },
    { id: "Palletizer/Layers", area: "Palletizer", name: "Layers", type: "number", format: (v) => String(Math.round(v)) },
    { id: "Palletizer/PalletsDone", area: "Palletizer", name: "PalletsDone", type: "number", format: (v) => String(Math.round(v)) },
    { id: "Palletizer/Jam", area: "Palletizer", name: "Jam", type: "bool" },

    { id: "Outfeed/Running", area: "Outfeed", name: "Running", type: "bool" },
    { id: "Outfeed/Occupied", area: "Outfeed", name: "Occupied", type: "bool" },
    { id: "Outfeed/Photoeye", area: "Outfeed", name: "Photoeye", type: "bool" },
  ];

  const pathOf = (id) => `${PROVIDER}${LINE}/${id}`;

  function defaultState() {
    return {
      scenario: /** @type {null|"jam"|"starved"} */ (null),
      cartonerJamCleared: false,
      rejectCount: 12,
      underCount: 3,
      overCount: 1,
      palletsDone: 47,
      selectedTag: "Line/OEE",
      alarms: /** @type {Alarm[]} */ ([]),
      openAreas: ["Line", "Cartoner", "Checkweigher"],
    };
  }

  /**
   * @typedef {{
   *   id: string,
   *   path: string,
   *   message: string,
   *   severity: "critical"|"warning",
   *   acked: boolean,
   *   ts: number,
   *   sticky?: boolean
   * }} Alarm
   */

  /** @type {ReturnType<typeof defaultState>} */
  let state = loadState();

  /** Live computed tag values + quality for this tick */
  /** @type {Record<string, { value: any, quality: Quality }>} */
  let live = {};

  let tick = 0;
  let timer = null;
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
        openAreas: Array.isArray(parsed.openAreas) ? parsed.openAreas : base.openAreas,
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota / private mode */ }
  }

  function drift(base, amp, phase) {
    return base + Math.sin((tick + phase) / 4.2) * amp + (Math.random() - 0.5) * amp * 0.15;
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

    /** @type {Record<string, { value: any, quality: Quality }>} */
    const next = {
      "Line/Running": { value: lineOk, quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Line/Mode": { value: jam ? "FAULT" : starved ? "STARVED" : "AUTO", quality: jam ? "Bad" : "Good" },
      "Line/OEE": { value: clamp(oee, 0, 100), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Line/Throughput": { value: Math.max(0, throughput), quality: jam ? "Bad" : starved ? "Uncertain" : "Good" },
      "Line/SpeedSP": { value: speedSp, quality: "Good" },

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

      "Reject/Count": { value: state.rejectCount, quality: "Good" },
      "Reject/Active": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },
      "Reject/Divert": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },

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

    live = next;
    syncScenarioAlarms();
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function syncScenarioAlarms() {
    const want = [];
    if (state.scenario === "jam" && !state.cartonerJamCleared) {
      want.push({
        id: "alm-cartoner-jam",
        path: pathOf("Cartoner/Jam"),
        message: "Cartoner jam — infeed accumulated, downstream waiting",
        severity: /** @type {const} */ ("critical"),
        sticky: true,
      });
    }
    if (state.scenario === "starved") {
      want.push({
        id: "alm-infeed-starved",
        path: pathOf("Infeed/Starved"),
        message: "Infeed starved — no product detected at photoeye",
        severity: /** @type {const} */ ("warning"),
        sticky: true,
      });
    }

    const byId = new Map(state.alarms.map((a) => [a.id, a]));
    const next = [];
    for (const w of want) {
      const prev = byId.get(w.id);
      next.push({
        ...w,
        acked: prev ? prev.acked : false,
        ts: prev ? prev.ts : Date.now(),
      });
    }
    // Keep non-sticky historical acked? We only keep active scenario alarms for clarity.
    state.alarms = next;
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

  /* ---------------- Render ---------------- */

  let treeBuilt = false;

  function buildTree() {
    const root = document.getElementById("plant-tree");
    if (!root) return;
    const open = new Set(state.openAreas);

    root.innerHTML = AREAS.map((area) => {
      const tags = TAG_DEFS.filter((t) => t.area === area);
      const isOpen = open.has(area);
      const rows = tags
        .map((def) => {
          return `<li>
            <button type="button" class="plant-tag" data-tag="${escapeHtml(def.id)}" data-q="Stale" aria-pressed="false">
              <span class="plant-q-dot-inline" aria-hidden="true"></span>
              <span class="plant-tag__name">${escapeHtml(def.name)}</span>
              <span class="plant-tag__val">—</span>
              <span class="plant-q plant-q--stale">Stale</span>
            </button>
          </li>`;
        })
        .join("");

      return `<li>
        <details data-area="${escapeHtml(area)}" ${isOpen ? "open" : ""}>
          <summary>
            <span class="plant-tree__chev" aria-hidden="true">▼</span>
            <span>${escapeHtml(area)}</span>
            <span class="plant-tree__count">${tags.length}</span>
          </summary>
          <ul>${rows}</ul>
        </details>
      </li>`;
    }).join("");
    treeBuilt = true;
    updateTreeValues();
  }

  function updateTreeValues() {
    const root = document.getElementById("plant-tree");
    if (!root) return;
    const selected = state.selectedTag;
    root.querySelectorAll(".plant-tag").forEach((btn) => {
      const id = btn.getAttribute("data-tag");
      const def = TAG_DEFS.find((t) => t.id === id);
      const lv = live[id] || { value: "—", quality: "Stale" };
      if (!def) return;
      const q = lv.quality;
      btn.dataset.q = q;
      btn.classList.toggle("is-selected", id === selected);
      btn.setAttribute("aria-pressed", id === selected ? "true" : "false");
      const valEl = btn.querySelector(".plant-tag__val");
      const qEl = btn.querySelector(".plant-q");
      if (valEl) valEl.textContent = formatValue(def, lv.value);
      if (qEl) {
        qEl.textContent = q;
        qEl.className = `plant-q plant-q--${q.toLowerCase()}`;
      }
    });
  }

  function renderTree() {
    if (!treeBuilt) buildTree();
    else updateTreeValues();
  }

  function stageState(id) {
    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    if (id === "Cartoner" && jam) return { state: "fault", badge: "Jam", stat: "Fault 41" };
    if (id === "Infeed" && starved) return { state: "warn", badge: "Starved", stat: formatLive("Infeed/Speed") };
    if (jam) {
      if (id === "Infeed") return { state: "warn", badge: "Hold", stat: formatLive("Infeed/Speed") };
      if (id === "Checkweigher" || id === "Outfeed" || id === "Palletizer") {
        return { state: "idle", badge: "Wait", stat: "Stale" };
      }
      return { state: "fault", badge: "Down", stat: "0" };
    }
    if (starved) {
      if (id === "Infeed") return { state: "warn", badge: "Starved", stat: formatLive("Infeed/Speed") };
      return { state: "warn", badge: "Slow", stat: formatLive(id === "Cartoner" ? "Cartoner/Speed" : id === "CasePacker" ? "CasePacker/CasesPerMin" : id === "Palletizer" ? "Palletizer/Layers" : "Outfeed/Occupied") };
    }
    const runningKey = `${id}/Running`;
    const running = live[runningKey] ? live[runningKey].value : true;
    if (!running) return { state: "idle", badge: "Idle", stat: "—" };
    const statKey =
      id === "Infeed" ? "Infeed/Speed" :
      id === "Cartoner" ? "Cartoner/CartonsPerMin" :
      id === "Checkweigher" ? "Checkweigher/WeightKg" :
      id === "CasePacker" ? "CasePacker/CasesPerMin" :
      id === "Palletizer" ? "Palletizer/Layers" :
      "Outfeed/Occupied";
    return { state: "run", badge: "Run", stat: formatLive(statKey) };
  }

  function formatLive(id) {
    const def = TAG_DEFS.find((t) => t.id === id);
    const lv = live[id];
    if (!def || !lv) return "—";
    return formatValue(def, lv.value);
  }

  function renderMimic() {
    const line = document.getElementById("plant-line");
    const stagesEl = document.getElementById("plant-stages");
    const rejectEl = document.getElementById("plant-reject");
    if (!stagesEl) return;

    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";

    if (line) {
      line.classList.toggle("is-running", !jam && !starved && !reducedMotion);
      line.classList.toggle("is-fault", jam);
      line.classList.toggle("is-warn", starved && !jam);
    }

    stagesEl.innerHTML = STAGES.map((s) => {
      const st = stageState(s.id);
      return `<div class="plant-stage" data-stage="${escapeHtml(s.id)}" data-state="${st.state}">
        <div class="plant-stage__node">
          <div class="plant-stage__name">${escapeHtml(s.label)}</div>
          <div class="plant-stage__stat">${escapeHtml(st.stat)}</div>
        </div>
        <span class="plant-stage__badge">${escapeHtml(st.badge)}</span>
      </div>`;
    }).join("");

    if (rejectEl) {
      rejectEl.textContent = `Reject · ${Math.round(live["Reject/Count"]?.value ?? state.rejectCount)}`;
    }

    const setKpi = (id, text, tone) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      if (tone) el.setAttribute("data-tone", tone);
      else el.removeAttribute("data-tone");
    };

    const oee = live["Line/OEE"]?.value ?? 0;
    setKpi("kpi-oee", `${oee.toFixed(1)}%`, jam ? "bad" : starved ? "warn" : oee >= 80 ? "good" : "warn");
    setKpi("kpi-thru", String(Math.round(live["Line/Throughput"]?.value ?? 0)), jam ? "bad" : starved ? "warn" : "good");
    setKpi("kpi-mode", String(live["Line/Mode"]?.value ?? "—"), jam ? "bad" : starved ? "warn" : "good");
    setKpi("kpi-reject", String(Math.round(live["Reject/Count"]?.value ?? 0)), "warn");

    // Scenario button active states
    document.querySelectorAll("[data-scenario]").forEach((btn) => {
      const sc = btn.getAttribute("data-scenario");
      btn.classList.toggle("is-active", state.scenario === sc);
    });
  }

  function renderDetail() {
    const el = document.getElementById("plant-detail");
    if (!el) return;
    const def = TAG_DEFS.find((t) => t.id === state.selectedTag);
    const lv = live[state.selectedTag];
    if (!def || !lv) {
      el.innerHTML = `<p>Select a tag in the browser.</p>`;
      return;
    }
    el.innerHTML = `
      <div class="plant-detail__path">${escapeHtml(pathOf(def.id))}</div>
      <dl class="plant-detail__grid">
        <dt>Value</dt><dd>${escapeHtml(formatValue(def, lv.value))}</dd>
        <dt>Quality</dt><dd><span class="plant-q plant-q--${escapeHtml(lv.quality.toLowerCase())}">${escapeHtml(lv.quality)}</span></dd>
        <dt>Type</dt><dd>${escapeHtml(def.type)}${def.unit ? ` · ${escapeHtml(def.unit)}` : ""}</dd>
        <dt>Area</dt><dd>${escapeHtml(def.area)}</dd>
      </dl>`;
  }

  function renderAlarms() {
    const list = document.getElementById("plant-alarms");
    const count = document.getElementById("plant-alarm-count");
    if (!list) return;

    const unacked = state.alarms.filter((a) => !a.acked).length;
    if (count) count.textContent = String(state.alarms.length);

    const scanDot = document.getElementById("plant-scan-dot");
    const scanLabel = document.getElementById("plant-scan-label");
    if (scanDot && scanLabel) {
      scanDot.classList.remove("is-fault", "is-warn");
      if (state.scenario === "jam" && !state.cartonerJamCleared) {
        scanDot.classList.add("is-fault");
        scanLabel.textContent = "Fault";
      } else if (state.scenario === "starved") {
        scanDot.classList.add("is-warn");
        scanLabel.textContent = "Starved";
      } else {
        scanLabel.textContent = "Scanning";
      }
    }

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

    void unacked;
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
    renderMimic();
    renderDetail();
    if (forceAlarms || tick % 5 === 0 || tick <= 1) renderAlarms();
    else updateAlarmTimes();
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

  /* ---------------- Actions ---------------- */

  function setScenario(name) {
    if (name === "recover") {
      state.scenario = null;
      state.cartonerJamCleared = false;
      state.alarms = [];
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
      // Clearing jam locally — if scenario still jam but cleared, treat as recovered cartoner
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
    computeLive();
    renderAll();
  }

  function selectTag(id) {
    state.selectedTag = id;
    saveState();
    updateTreeValues();
    renderDetail();
  }

  /* ---------------- Wire ---------------- */

  function wire() {
    document.getElementById("plant-tree")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (btn) {
        selectTag(btn.getAttribute("data-tag"));
        return;
      }
    });

    document.getElementById("plant-tree")?.addEventListener("toggle", (e) => {
      const det = e.target;
      if (!(det instanceof HTMLDetailsElement)) return;
      const area = det.getAttribute("data-area");
      if (!area) return;
      const open = new Set(state.openAreas);
      if (det.open) open.add(area);
      else open.delete(area);
      state.openAreas = [...open];
      saveState();
    }, true);

    document.querySelector(".plant-toolbar")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action], [data-scenario]");
      if (!btn) return;
      const sc = btn.getAttribute("data-scenario");
      if (sc) {
        setScenario(sc);
        return;
      }
      const action = btn.getAttribute("data-action");
      if (action === "ack-all") ackAll();
      else if (action === "reset-reject") resetReject();
      else if (action === "clear-jam") clearCartonerJam();
      else if (action === "reset-line") resetLine();
    });

    document.getElementById("plant-alarms")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ack]");
      if (!btn) return;
      ackOne(btn.getAttribute("data-ack"));
    });
  }

  function tickOnce() {
    tick += 1;
    computeLive();
    // Persist counters that drift
    saveState();
    renderAll({ alarms: false });
  }

  function startClock() {
    const el = document.getElementById("plant-clock");
    const paint = () => {
      if (!el) return;
      const d = new Date();
      el.textContent = d.toLocaleTimeString(undefined, { hour12: false });
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
