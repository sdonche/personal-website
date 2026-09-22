/* =============================================================
   plant.js — Plant Live View (/plant/)
   Nested tag browser (Packaging / Line#) + P&ID mimic.
   State persists in localStorage until "Reset line".
   ============================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "samdonche.plant.v2";
  const TICK_MS = 1000;
  const PROVIDER = "[edge]";
  const AREA = "Packaging";
  const LIVE_LINE = "Line3";

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

  /** Offline placeholder lines — one Status tag each. */
  const OFFLINE_LINES = [
    { id: "Line1", label: "Line 1" },
    { id: "Line2", label: "Line 2" },
  ];

  /** Equipment folders under live Line3 (Reject nests under Checkweigher). */
  const EQUIPMENT = [
    { id: "Infeed", label: "Infeed", pid: "CV-301", kind: "conveyor" },
    { id: "Cartoner", label: "Cartoner", pid: "CT-310", kind: "machine" },
    { id: "Checkweigher", label: "Checkweigher", pid: "WT-320", kind: "scale" },
    { id: "CasePacker", label: "CasePacker", pid: "CP-330", kind: "machine" },
    { id: "Palletizer", label: "Palletizer", pid: "PL-340", kind: "machine" },
    { id: "Outfeed", label: "Outfeed", pid: "CV-350", kind: "conveyor" },
  ];

  /** @type {TagDef[]} — ids are relative to Packaging/Line3/ */
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

  const TAG_BY_ID = Object.fromEntries(LINE3_TAGS.map((t) => [t.id, t]));

  const pathOf = (rel) => `${PROVIDER}${AREA}/${LIVE_LINE}/${rel}`;

  /** Default open folders in the nested tree (node keys). */
  const DEFAULT_OPEN = [
    "Packaging",
    "Packaging/Line3",
    "Packaging/Line3/Cartoner",
    "Packaging/Line3/Checkweigher",
  ];

  function defaultState() {
    return {
      scenario: /** @type {null|"jam"|"starved"} */ (null),
      cartonerJamCleared: false,
      rejectCount: 12,
      underCount: 3,
      overCount: 1,
      palletsDone: 47,
      selectedTag: "OEE",
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

  function tagsUnder(prefix) {
    if (!prefix) {
      return LINE3_TAGS.filter((t) => !t.id.includes("/"));
    }
    const p = prefix.endsWith("/") ? prefix : prefix + "/";
    return LINE3_TAGS.filter((t) => {
      if (!t.id.startsWith(p)) return false;
      const rest = t.id.slice(p.length);
      return !rest.includes("/");
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
    const nodeKey = `Packaging/${LIVE_LINE}/${equipId}`;
    let body = tagsUnder(equipId).map((t) => renderTagButton(t.id, t)).join("");
    if (equipId === "Checkweigher") {
      const rejectTags = tagsUnder("Checkweigher/Reject")
        .map((t) => renderTagButton(t.id, t))
        .join("");
      body += renderFolder(`${nodeKey}/Reject`, "Reject", rejectTags);
    }
    return renderFolder(nodeKey, equipId, body);
  }

  function renderLine3Folder() {
    const nodeKey = `Packaging/${LIVE_LINE}`;
    const lineTags = tagsUnder("").map((t) => renderTagButton(t.id, t)).join("");
    const equips = EQUIPMENT.map((e) => renderEquipFolder(e.id)).join("");
    return renderFolder(nodeKey, "Line3", lineTags + equips, "plant-tree__line plant-tree__line--live");
  }

  function renderOfflineLine(line) {
    const nodeKey = `Packaging/${line.id}`;
    const body = `<li>
      <button type="button" class="plant-tag plant-tag--offline" data-tag="" data-q="Stale" disabled title="Offline placeholder">
        <span class="plant-q-dot-inline" aria-hidden="true"></span>
        <span class="plant-tag__name">Status</span>
        <span class="plant-tag__val">Offline</span>
        <span class="plant-q plant-q--stale">Stale</span>
      </button>
    </li>`;
    return renderFolder(nodeKey, line.id, body, "plant-tree__line plant-tree__line--offline");
  }

  function buildTree() {
    const root = document.getElementById("plant-tree");
    if (!root) return;

    const lines =
      OFFLINE_LINES.map(renderOfflineLine).join("") + renderLine3Folder();

    root.innerHTML = renderFolder("Packaging", "Packaging", lines, "plant-tree__area");
    treeBuilt = true;
    updateTreeValues();

    const headPath = document.getElementById("plant-tree-path");
    if (headPath) headPath.textContent = `${PROVIDER}${AREA}`;
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

  function balloon(cx, cy, top, bot, tagId, qClass) {
    const selected = tagId === state.selectedTag ? " is-selected" : "";
    return `
      <g class="pid-balloon${selected} ${qClass}" data-tag="${escapeHtml(tagId)}" role="button" tabindex="0" aria-label="${escapeHtml(top + " " + bot)}">
        <line class="pid-leader" x1="${cx}" y1="${cy + 18}" x2="${cx}" y2="${cy + 36}" />
        <circle class="pid-balloon__ring" cx="${cx}" cy="${cy}" r="18" />
        <line class="pid-balloon__split" x1="${cx - 18}" y1="${cy}" x2="${cx + 18}" y2="${cy}" />
        <text class="pid-balloon__top" x="${cx}" y="${cy - 4}" text-anchor="middle">${escapeHtml(top)}</text>
        <text class="pid-balloon__bot" x="${cx}" y="${cy + 11}" text-anchor="middle">${escapeHtml(bot)}</text>
      </g>`;
  }

  function equipBlock(x, y, w, h, eq, st) {
    const tagId = `${eq.id}/Running`;
    const selected = state.selectedTag.startsWith(eq.id + "/") || state.selectedTag === eq.id
      ? " is-selected" : "";
    let body;
    if (eq.kind === "conveyor") {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y + 8}" width="${w}" height="${h - 16}" rx="3" />
        <circle class="pid-equip__roller" cx="${x + 10}" cy="${y + h / 2}" r="7" />
        <circle class="pid-equip__roller" cx="${x + w - 10}" cy="${y + h / 2}" r="7" />
        <line class="pid-equip__belt" x1="${x + 10}" y1="${y + 12}" x2="${x + w - 10}" y2="${y + 12}" />
        <line class="pid-equip__belt" x1="${x + 10}" y1="${y + h - 12}" x2="${x + w - 10}" y2="${y + h - 12}" />`;
    } else if (eq.kind === "scale") {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" />
        <line class="pid-equip__detail" x1="${x + 8}" y1="${y + h - 10}" x2="${x + w - 8}" y2="${y + h - 10}" />
        <line class="pid-equip__detail" x1="${x + w / 2}" y1="${y + 8}" x2="${x + w / 2}" y2="${y + h - 10}" />
        <rect class="pid-equip__platen" x="${x + 14}" y="${y + 10}" width="${w - 28}" height="10" rx="1" />`;
    } else {
      body = `
        <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" />
        <rect class="pid-equip__detail" x="${x + 6}" y="${y + 8}" width="${w - 12}" height="${h - 16}" rx="1" />`;
    }
    return `
      <g class="pid-equip pid-equip--${st}${selected}" data-equip="${escapeHtml(eq.id)}" data-tag="${escapeHtml(tagId)}" role="button" tabindex="0">
        ${body}
        <text class="pid-equip__pid" x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle">${escapeHtml(eq.pid)}</text>
        <text class="pid-equip__name" x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle">${escapeHtml(eq.label)}</text>
      </g>`;
  }

  function qClassFor(tagId) {
    const q = (live[tagId] || {}).quality || "Stale";
    return `pid-q--${q.toLowerCase()}`;
  }

  function formatLive(id) {
    const def = TAG_BY_ID[id];
    const lv = live[id];
    if (!def || !lv) return "—";
    return formatValue(def, lv.value);
  }

  function renderPid() {
    const host = document.getElementById("plant-pid");
    if (!host) return;

    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    const flowClass = jam ? "is-fault" : starved ? "is-warn" : "is-running";

    // Layout coordinates (viewBox 0 0 920 360)
    const y = 168;
    const h = 56;
    const w = 88;
    const xs = [40, 180, 320, 480, 620, 760];
    const rejectX = xs[2] + w / 2;
    const rejectY = 280;

    const nozzles = xs.map((x, i) => {
      if (i === xs.length - 1) return "";
      const x1 = x + w;
      const x2 = xs[i + 1];
      return `<line class="pid-pipe" x1="${x1}" y1="${y + h / 2}" x2="${x2}" y2="${y + h / 2}" />`;
    }).join("");

    const flowAnim = (!jam && !starved && !reducedMotion)
      ? `<line class="pid-pipe-flow" x1="40" y1="${y + h / 2}" x2="848" y2="${y + h / 2}" />`
      : "";

    const equips = EQUIPMENT.map((eq, i) =>
      equipBlock(xs[i], y, w, h, eq, equipState(eq.id))
    ).join("");

    const balloons = [
      balloon(xs[0] + w / 2, 78, "SI", "301", "Infeed/Speed", qClassFor("Infeed/Speed")),
      balloon(xs[0] + w / 2 - 36, 118, "XS", "301", "Infeed/Photoeye", qClassFor("Infeed/Photoeye")),
      balloon(xs[1] + w / 2, 78, "SC", "310", "Cartoner/Speed", qClassFor("Cartoner/Speed")),
      balloon(xs[1] + w / 2 + 40, 118, "YA", "310", "Cartoner/Jam", qClassFor("Cartoner/Jam")),
      balloon(xs[2] + w / 2, 78, "WT", "320", "Checkweigher/WeightKg", qClassFor("Checkweigher/WeightKg")),
      balloon(xs[3] + w / 2, 78, "SC", "330", "CasePacker/CasesPerMin", qClassFor("CasePacker/CasesPerMin")),
      balloon(xs[4] + w / 2, 78, "CI", "340", "Palletizer/Layers", qClassFor("Palletizer/Layers")),
      balloon(xs[5] + w / 2, 78, "XS", "350", "Outfeed/Photoeye", qClassFor("Outfeed/Photoeye")),
    ].join("");

    const rejectActive = !!(live["Checkweigher/Reject/Active"] || {}).value;
    const rejectSel = state.selectedTag.startsWith("Checkweigher/Reject") ? " is-selected" : "";

    host.innerHTML = `
      <svg class="pid-svg ${flowClass}" viewBox="0 0 920 360" role="img" aria-label="Line 3 packaging P and ID">
        <title>Packaging Line 3 — P&amp;ID</title>
        <text class="pid-title" x="16" y="28">Packaging / Line3</text>
        <text class="pid-subtitle" x="16" y="46">Process flow · instrument balloons select tags</text>

        ${nozzles}
        ${flowAnim}
        ${equips}
        ${balloons}

        <!-- Reject divert -->
        <line class="pid-pipe pid-pipe--divert" x1="${rejectX}" y1="${y + h}" x2="${rejectX}" y2="${rejectY - 18}" />
        <g class="pid-reject${rejectSel}${rejectActive ? " is-active" : ""}" data-tag="Checkweigher/Reject/Count" role="button" tabindex="0">
          <polygon class="pid-reject__body" points="${rejectX - 28},${rejectY - 14} ${rejectX + 28},${rejectY - 14} ${rejectX + 22},${rejectY + 18} ${rejectX - 22},${rejectY + 18}" />
          <text class="pid-reject__pid" x="${rejectX}" y="${rejectY - 1}" text-anchor="middle">RJ-321</text>
          <text class="pid-reject__name" x="${rejectX}" y="${rejectY + 12}" text-anchor="middle">Reject · ${Math.round(live["Checkweigher/Reject/Count"]?.value ?? state.rejectCount)}</text>
        </g>
        ${balloon(rejectX + 52, rejectY - 8, "XI", "321", "Checkweigher/Reject/Divert", qClassFor("Checkweigher/Reject/Divert"))}
      </svg>`;
  }

  function renderKpis() {
    const jam = state.scenario === "jam" && !state.cartonerJamCleared;
    const starved = state.scenario === "starved";
    const setKpi = (id, text, tone) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      if (tone) el.setAttribute("data-tone", tone);
      else el.removeAttribute("data-tone");
    };
    const oee = live.OEE?.value ?? 0;
    setKpi("kpi-oee", `${oee.toFixed(1)}%`, jam ? "bad" : starved ? "warn" : oee >= 80 ? "good" : "warn");
    setKpi("kpi-thru", String(Math.round(live.Throughput?.value ?? 0)), jam ? "bad" : starved ? "warn" : "good");
    setKpi("kpi-mode", String(live.Mode?.value ?? "—"), jam ? "bad" : starved ? "warn" : "good");
    setKpi("kpi-reject", String(Math.round(live["Checkweigher/Reject/Count"]?.value ?? 0)), "warn");

    document.querySelectorAll("[data-scenario]").forEach((btn) => {
      const sc = btn.getAttribute("data-scenario");
      btn.classList.toggle("is-active", state.scenario === sc);
    });

    const scanDot = document.getElementById("plant-scan-dot");
    const scanLabel = document.getElementById("plant-scan-label");
    if (scanDot && scanLabel) {
      scanDot.classList.remove("is-fault", "is-warn");
      if (jam) { scanDot.classList.add("is-fault"); scanLabel.textContent = "Fault"; }
      else if (starved) { scanDot.classList.add("is-warn"); scanLabel.textContent = "Starved"; }
      else { scanLabel.textContent = "Scanning"; }
    }
  }

  function renderDetail() {
    const el = document.getElementById("plant-detail");
    if (!el) return;
    const def = TAG_BY_ID[state.selectedTag];
    const lv = live[state.selectedTag];
    if (!def || !lv) {
      el.innerHTML = `<p>Select a tag in the browser or on the P&amp;ID.</p>`;
      return;
    }
    const folder = state.selectedTag.includes("/")
      ? state.selectedTag.split("/").slice(0, -1).join(" / ")
      : "Line3";
    el.innerHTML = `
      <div class="plant-detail__path">${escapeHtml(pathOf(def.id))}</div>
      <dl class="plant-detail__grid">
        <dt>Value</dt><dd>${escapeHtml(formatValue(def, lv.value))}</dd>
        <dt>Quality</dt><dd><span class="plant-q plant-q--${escapeHtml(lv.quality.toLowerCase())}">${escapeHtml(lv.quality)}</span></dd>
        <dt>Type</dt><dd>${escapeHtml(def.type)}${def.unit ? ` · ${escapeHtml(def.unit)}` : ""}</dd>
        <dt>Node</dt><dd>${escapeHtml(folder)}</dd>
      </dl>`;
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
    if (!id || !TAG_BY_ID[id]) return;
    state.selectedTag = id;
    // Ensure ancestors open
    const parts = id.split("/");
    const nodes = ["Packaging", `Packaging/${LIVE_LINE}`];
    let acc = `Packaging/${LIVE_LINE}`;
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i];
      nodes.push(acc);
    }
    const open = new Set(state.openNodes);
    nodes.forEach((n) => open.add(n));
    state.openNodes = [...open];
    saveState();
    treeBuilt = false;
    renderTree();
    renderPid();
    renderDetail();
  }

  /* ---------------- Wire ---------------- */

  function wire() {
    document.getElementById("plant-tree")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (btn && btn.getAttribute("data-tag")) selectTag(btn.getAttribute("data-tag"));
    });

    document.getElementById("plant-tree")?.addEventListener("toggle", (e) => {
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

    document.getElementById("plant-pid")?.addEventListener("click", (e) => {
      const hit = e.target.closest("[data-tag]");
      if (hit && hit.getAttribute("data-tag")) selectTag(hit.getAttribute("data-tag"));
    });

    document.getElementById("plant-pid")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = e.target.closest("[data-tag]");
      if (hit && hit.getAttribute("data-tag")) {
        e.preventDefault();
        selectTag(hit.getAttribute("data-tag"));
      }
    });

    document.querySelector(".plant-toolbar")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action], [data-scenario]");
      if (!btn) return;
      const sc = btn.getAttribute("data-scenario");
      if (sc) { setScenario(sc); return; }
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
