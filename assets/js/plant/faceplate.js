import { Plant } from "./ns.js?v=c600f295ec";


/* Faceplate: built once per selected tag, then patched every tick so a
   half-typed setpoint or the trend cursor survives the scan. */

Plant.trendHover = null; // samples back from "now" under the pointer, or null

Plant.renderDetail = function renderDetail() {
  const el = document.getElementById("plant-detail");
  if (!el) return;
  const def = Plant.TAG_BY_ID[Plant.state.selectedTag];
  const lv = Plant.live[Plant.state.selectedTag];
  if (!def || !lv) {
    el.innerHTML = `<p class="plant-detail__empty">Select a tag in the browser or on the P&amp;ID.</p>`;
    el.dataset.fpTag = "";
    return;
  }
  if (el.dataset.fpTag !== def.id) {
    el.dataset.fpTag = def.id;
    Plant.trendHover = null;
    Plant.buildFaceplate(el, def);
  }
  Plant.patchFaceplate(el, def, lv);
}

Plant.buildFaceplate = function buildFaceplate(el, def) {
  const esc = Plant.escapeHtml;
  const path = Plant.pathOf(def.id);
  const numeric = def.type === "number";
  const spTag = Plant.writableSpFor(def.id);
  const w = spTag && Plant.SP_WRITE[spTag];
  const spDef = spTag && Plant.TAG_BY_ID[spTag];
  const writeBlock = w ? `
    <form class="plant-faceplate__write" data-faceplate-write="${esc(spTag)}" novalidate>
      <label class="plant-faceplate__write-label">${esc(w.loop)} SP
        <input type="number" name="sp" min="${w.min}" max="${w.max}" step="${w.step}" value="${esc(String(Plant.live[spTag]?.value ?? ""))}" class="plant-faceplate__input" />
        <span class="plant-faceplate__unit">${esc(spDef?.unit || "")}</span>
      </label>
      <button type="submit" class="plant-btn plant-btn--ghost" data-fp-step="stage">Write…</button>
      <span class="plant-faceplate__confirm" data-fp-confirm hidden>
        <span data-fp-confirm-text></span>
        <button type="submit" class="plant-btn plant-btn--accent" data-fp-step="confirm">Confirm</button>
        <button type="button" class="plant-btn plant-btn--ghost" data-fp-cancel>Cancel</button>
      </span>
      <span class="plant-faceplate__msg" data-fp-msg role="status"></span>
      <span class="plant-faceplate__hint">range ${esc(Plant.formatValue(spDef, w.min))} – ${esc(Plant.formatValue(spDef, w.max))}${w.phase ? " · overrides the recipe until the phase ends" : ""}</span>
    </form>` : "";
  el.innerHTML = `
    <div class="plant-faceplate">
      <div class="plant-faceplate__main">
        <p class="plant-faceplate__path" title="${esc(path)}">${esc(path)}</p>
        <div data-fp-note></div>
        <div class="plant-faceplate__row">
          <strong class="plant-faceplate__val" data-fp-val></strong>
          <span class="plant-q" data-fp-q></span>
          <span class="plant-faceplate__meta">${esc(def.type)}${def.unit ? ` · ${esc(def.unit)}` : ""} · ${esc(def.name)}</span>
        </div>
        ${Plant.SETPOINT_FOR[def.id] ? `<p class="plant-faceplate__sp" data-fp-sp></p>` : ""}
        ${writeBlock}
        ${Plant.isBatchTag(def.id) ? Plant.recipeHtml() : ""}
        ${["OEE", "Availability", "Performance", "Quality"].includes(def.id) ? `<div class="plant-pareto-wrap" data-fp-pareto></div>` : ""}
      </div>
      ${Plant.isBatchTag(def.id) ? `<section class="plant-gen" data-fp-gen aria-label="Batch genealogy"></section>` : ""}
      ${numeric ? `<figure class="plant-trend" data-fp-trend aria-label="Trend, last hour of plant time">
        <div class="plant-trend__plot" data-fp-plot></div>
        <figcaption class="plant-trend__legend" data-fp-legend></figcaption>
      </figure>` : ""}
    </div>`;
  const plot = el.querySelector("[data-fp-plot]");
  if (!plot) return;
  const hover = (e) => {
    const r = plot.getBoundingClientRect();
    const g = Plant.TREND_GEOM;
    const x = e.clientX - r.left;
    const w = r.width - g.left - g.right;
    const back = Math.round(((w - (x - g.left)) / w) * (Plant.TREND_LEN - 1));
    Plant.trendHover = back >= 0 && back < Plant.TREND_LEN ? back : null;
    Plant.paintTrend(el, def);
  };
  plot.addEventListener("pointermove", hover);
  plot.addEventListener("pointerdown", hover);
  plot.addEventListener("pointerleave", () => {
    Plant.trendHover = null;
    Plant.paintTrend(el, def);
  });
}

Plant.patchFaceplate = function patchFaceplate(el, def, lv) {
  const esc = Plant.escapeHtml;
  const val = el.querySelector("[data-fp-val]");
  if (val) val.textContent = Plant.formatValue(def, lv.value);
  const q = el.querySelector("[data-fp-q]");
  if (q) {
    q.className = `plant-q plant-q--${lv.quality.toLowerCase()}`;
    q.textContent = lv.quality;
  }
  const note = el.querySelector("[data-fp-note]");
  if (note) {
    let html = "";
    if (Plant.isSisterSiteTag(def.id)) {
      const snap = Plant.siteSnapshot(def.id.split("/")[0]);
      html = snap.link === "flap"
        ? `<p class="plant-faceplate__note plant-faceplate__note--flap">Sister link flapping (Uncertain) — Heuvelland P&amp;ID still shown</p>`
        : `<p class="plant-faceplate__note">Sister site offline — last known values (Stale) · Heuvelland P&amp;ID still shown</p>`;
    }
    if (note.innerHTML !== html) note.innerHTML = html;
  }
  const sp = el.querySelector("[data-fp-sp]");
  if (sp) {
    const spTag = Plant.SETPOINT_FOR[def.id];
    const d = Number(lv.value) - Number(Plant.live[spTag]?.value);
    const dev = Number.isFinite(d) ? `${d >= 0 ? "+" : ""}${d.toFixed(1)}${def.unit ? ` ${def.unit}` : ""}` : "—";
    // MES view: say when the SP in force is an operator value rather than the recipe's
    const w = Plant.SP_WRITE[spTag];
    const override = w && Plant.state.sp[spTag] != null;
    const recipe = override && w.def != null ? ` (recipe ${Plant.formatValue(Plant.TAG_BY_ID[spTag], w.def)})` : override ? " (recipe override)" : "";
    sp.innerHTML = `Setpoint <strong>${esc(Plant.liveReadout(spTag))}</strong>${esc(recipe)} · deviation ${esc(dev)}`;
  }
  // Follow the SP in force unless the operator is editing or confirming a write
  const form = el.querySelector("[data-faceplate-write]");
  const input = form?.querySelector('input[name="sp"]');
  if (input && document.activeElement !== input && form.dataset.staged == null) {
    const v = Plant.live[form.getAttribute("data-faceplate-write")]?.value;
    if (Number.isFinite(v) && Number(input.value) !== v) input.value = String(v);
  }
  if (def.type === "number") Plant.paintTrend(el, def);
  const pareto = el.querySelector("[data-fp-pareto]");
  if (pareto) {
    const html = Plant.paretoHtml();
    if (pareto.dataset.html !== html) {
      pareto.dataset.html = html;
      pareto.innerHTML = html;
    }
  }
  const gen = el.querySelector("[data-fp-gen]");
  if (gen) {
    const html = Plant.genealogyHtml(String(lv.value));
    if (gen.dataset.html !== html) {
      gen.dataset.html = html;
      gen.innerHTML = html;
    }
  }
}

/* ---------------- Recipe + batch genealogy (MES) ---------------- */

Plant.isBatchTag = function isBatchTag(tagId) {
  return /(^|\/)BatchId$/.test(tagId) && !Plant.isSisterSiteTag(tagId) && !Plant.isStubTag(tagId);
}

Plant.recipeHtml = function recipeHtml() {
  const r = Plant.RECIPE;
  const esc = Plant.escapeHtml;
  return `<div class="plant-recipe">
      <p class="plant-recipe__head">Recipe <strong>${esc(r.name)}</strong> · ${esc(r.id)} v${r.version}</p>
      <dl class="plant-recipe__targets">${r.targets.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    </div>`;
}

/** Mean of a trended tag over [start, end) plant ticks, from the historian buffer. */
Plant.trendAvg = function trendAvg(tagId, start, end) {
  const buf = Plant.trends[tagId];
  if (!buf || Plant.trendTick == null) return null;
  let sum = 0;
  let n = 0;
  for (let t = start; t < end; t++) {
    const i = buf.length - 1 - (Plant.trendTick - t);
    if (i >= 0 && i < buf.length) { sum += buf[i]; n += 1; }
  }
  return n ? sum / n : null;
}

/** Where batch B-n was, is and will be: each area holds a batch for 15 plant minutes. */
Plant.batchRoute = function batchRoute(n) {
  const base = (n - 1400) * 15;
  return Plant.BATCH_STEPS.map((drawing, i) => {
    const start = base + i * 15;
    const end = start + 15;
    const status = Plant.tick >= end ? "done" : Plant.tick >= start ? "here" : "planned";
    return { drawing, unit: Plant.UNIT_BY_DRAWING[drawing], start, end, status };
  });
}

Plant.genealogyHtml = function genealogyHtml(batchId) {
  const esc = Plant.escapeHtml;
  const n = Number(String(batchId).replace(/^B-/, ""));
  if (!Number.isFinite(n)) return "";
  const r = Plant.RECIPE;
  // Raw-material lots: a liquor tanker lasts 8 batches, a sugar silo lot 12
  const liquorLot = `CL-24-${100 + Math.floor(n / 8)}`;
  const sugarLot = `SG-${String(900 + Math.floor(n / 12)).padStart(4, "0")}`;
  const route = Plant.batchRoute(n);
  const steps = route.map((st) => {
    const qa = r.qa[st.drawing];
    let check = "";
    if (qa && st.status !== "planned") {
      const avg = Plant.trendAvg(qa.tag, st.start, Math.min(st.end, Plant.tick + 1));
      if (avg != null) {
        const ok = qa.ok(avg);
        check = `<span class="plant-gen__qa" data-ok="${ok}">${esc(qa.label)} ${esc(Plant.formatValue(Plant.TAG_BY_ID[qa.tag], avg))} ${ok ? "✓" : "✗"}</span>`;
      }
    }
    return `<li data-status="${st.status}">
        <span class="plant-gen__equip">${esc(st.unit.equip)}</span>
        <span class="plant-gen__time">${Plant.plantTime(st.start)}–${Plant.plantTime(st.end)}</span>
        ${st.status === "here" ? `<span class="plant-gen__here">here now</span>` : st.status === "planned" ? `<span class="plant-gen__here">planned</span>` : ""}
        ${check}
      </li>`;
  }).join("");
  // Line 3 closes a pallet every 20 plant minutes (60 cases at 3 cases/min)
  const pack = route[route.length - 1];
  const pallets = [];
  for (let t = Math.ceil(pack.start / 20) * 20; t < pack.end && t <= Plant.tick; t += 20) pallets.push(`P-${String(400 + t / 20).padStart(5, "0")}`);
  const packedMin = Math.max(0, Math.min(Plant.tick, pack.end) - pack.start);
  const out = pack.status === "planned"
    ? "not packed yet"
    : `${packedMin * 3} cases${pallets.length ? ` · pallet${pallets.length > 1 ? "s" : ""} ${pallets.join(", ")}` : ""}${pack.status === "here" ? " · in progress" : ""}`;
  return `<p class="plant-gen__head">Genealogy <strong>${esc(batchId)}</strong> · ${esc(r.name)} v${r.version}</p>
    <p class="plant-gen__row"><span class="plant-gen__k">In</span>Cocoa liquor ${esc(liquorLot)} · ${r.dose.liquor} kg — Sugar ${esc(sugarLot)} · ${r.dose.sugar} kg</p>
    <ol class="plant-gen__route">${steps}</ol>
    <p class="plant-gen__row"><span class="plant-gen__k">Out</span>${esc(out)}</p>`;
}

/** The setpoint an operator can write from this tag's faceplate (the SP itself or its PV). */
Plant.writableSpFor = function writableSpFor(tagId) {
  if (Plant.SP_WRITE[tagId]) return tagId;
  const sp = Plant.SETPOINT_FOR[tagId];
  return sp && Plant.SP_WRITE[sp] ? sp : null;
}

/* Two-step write: Write… validates and asks, Confirm writes. */
Plant.faceplateSubmit = function faceplateSubmit(form, submitter) {
  const tag = form.getAttribute("data-faceplate-write");
  const w = Plant.SP_WRITE[tag];
  const def = Plant.TAG_BY_ID[tag];
  const input = form.querySelector('input[name="sp"]');
  const msg = form.querySelector("[data-fp-msg]");
  const confirm = form.querySelector("[data-fp-confirm]");
  const stageBtn = form.querySelector('[data-fp-step="stage"]');
  if (!w || !def || !input) return;
  const step = submitter?.getAttribute("data-fp-step") || (form.dataset.staged != null ? "confirm" : "stage");
  if (step === "stage") {
    const n = Plant.roundSp(tag, input.value);
    if (n == null) {
      msg.textContent = `Out of range — ${Plant.formatValue(def, w.min)} to ${Plant.formatValue(def, w.max)}`;
      msg.dataset.tone = "bad";
      return;
    }
    form.dataset.staged = String(n);
    input.disabled = true;
    stageBtn.hidden = true;
    confirm.hidden = false;
    msg.textContent = "";
    confirm.querySelector("[data-fp-confirm-text]").textContent =
      `${w.loop} SP ${Plant.formatValue(def, Plant.live[tag]?.value)} → ${Plant.formatValue(def, n)}?`;
    confirm.querySelector('[data-fp-step="confirm"]').focus();
    return;
  }
  const n = Number(form.dataset.staged);
  Plant.faceplateCancel(form);
  if (Plant.writeSp(tag, n)) {
    msg.textContent = `Written ${Plant.plantTime(Plant.tick)}`;
    msg.dataset.tone = "good";
  }
}

Plant.faceplateCancel = function faceplateCancel(form) {
  delete form.dataset.staged;
  const input = form.querySelector('input[name="sp"]');
  input.disabled = false;
  form.querySelector('[data-fp-step="stage"]').hidden = false;
  form.querySelector("[data-fp-confirm]").hidden = true;
  form.querySelector("[data-fp-msg]").textContent = "";
}

/** Snap to the write step; null when outside the write range. */
Plant.roundSp = function roundSp(tag, raw) {
  const w = Plant.SP_WRITE[tag];
  const v = Number(raw);
  if (!w || String(raw).trim() === "" || !Number.isFinite(v)) return null;
  const n = Number((Math.round(v / w.step) * w.step).toFixed(2));
  return n >= w.min && n <= w.max ? n : null;
}

/* ---------------- Trend (historian-style, 1 h plant window) ---------------- */

Plant.TREND_GEOM = { left: 40, right: 8, top: 8, bottom: 16, height: 118 };

/** Analog alarm limits configured on this tag (ISA-18.2 table). */
Plant.trendLimits = function trendLimits(tagId) {
  return Plant.ALARM_ANALOG.filter((a) => a.tag === tagId);
}

/** Alarm activations / clears on this tag, as plant ticks. */
Plant.trendEvents = function trendEvents(tagId) {
  const ids = new Set(Plant.trendLimits(tagId).map((a) => a.id));
  const path = Plant.pathOf(tagId);
  const mine = (a) => ids.has(a.id) || a.path === path;
  const out = [];
  for (const a of Plant.state.alarms) {
    if (!mine(a)) continue;
    if (Number.isFinite(a.tick)) out.push({ tick: a.tick, kind: "on", severity: a.severity });
    if (a.rtn && Number.isFinite(a.rtnTick)) out.push({ tick: a.rtnTick, kind: "off", severity: a.severity });
  }
  for (const h of Plant.state.alarmHistory || []) {
    if (!mine(h)) continue;
    if (Number.isFinite(h.tick)) out.push({ tick: h.tick, kind: "on", severity: h.severity });
    const off = Number.isFinite(h.rtnTick) ? h.rtnTick : h.clearedTick;
    if (Number.isFinite(off)) out.push({ tick: off, kind: "off", severity: h.severity });
  }
  return out;
}

Plant.paintTrend = function paintTrend(el, def) {
  const plot = el.querySelector("[data-fp-plot]");
  const legend = el.querySelector("[data-fp-legend]");
  if (!plot) return;
  const g = Plant.TREND_GEOM;
  const W = Math.max(160, Math.round(plot.clientWidth || 360));
  const H = g.height;
  const pw = W - g.left - g.right;
  const ph = H - g.top - g.bottom;
  const N = Plant.TREND_LEN;
  const now = Plant.tick;
  const pv = Plant.trends[def.id] || [];
  const spTag = Plant.SETPOINT_FOR[def.id];
  const sp = spTag ? Plant.trends[spTag] || [] : [];
  const limits = Plant.trendLimits(def.id);
  const fmt = (v) => Plant.formatValue(def, v);
  const fmtBare = (v) => (def.format ? def.format(v) : String(v));

  // Scale: PV, SP and alarm limits all on the chart, padded
  const vals = [...pv, ...sp, ...limits.map((l) => l.limit)].filter(Number.isFinite);
  let lo = vals.length ? Math.min(...vals) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1;
  lo -= pad; hi += pad;
  if (Math.min(...vals) >= 0 && lo < 0) lo = 0;
  // Samples are one plant minute apart; the newest sits on the right edge
  const xOf = (back) => g.left + pw - (back / (N - 1)) * pw;
  const yOf = (v) => g.top + (1 - (v - lo) / (hi - lo)) * ph;
  const line = (buf) => buf.map((v, i) => `${xOf(buf.length - 1 - i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const stepLine = (buf) => buf.map((v, i) => {
    const x = xOf(buf.length - 1 - i).toFixed(1);
    const prev = i ? yOf(buf[i - 1]).toFixed(1) : yOf(v).toFixed(1);
    return `${x},${prev} ${x},${yOf(v).toFixed(1)}`;
  }).join(" ");

  let s = "";
  // Grid + value axis (3 ticks)
  for (let k = 0; k <= 2; k++) {
    const v = lo + ((hi - lo) * k) / 2;
    const y = yOf(v).toFixed(1);
    s += `<line class="plant-trend__grid" x1="${g.left}" x2="${W - g.right}" y1="${y}" y2="${y}"/>`;
    s += `<text class="plant-trend__axis" x="${g.left - 4}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="end">${Plant.escapeHtml(fmtBare(v))}</text>`;
  }
  // Time axis: plant clock every 15 min
  for (let back = 0; back < N; back++) {
    const t = now - back;
    if ((6 * 60 + t) % 15 !== 0) continue;
    const x = xOf(back).toFixed(1);
    s += `<line class="plant-trend__grid plant-trend__grid--v" x1="${x}" x2="${x}" y1="${g.top}" y2="${H - g.bottom}"/>`;
    s += `<text class="plant-trend__axis" x="${x}" y="${H - 4}" text-anchor="middle">${Plant.plantTime(t)}</text>`;
  }
  // Alarm limits
  for (const l of limits) {
    const y = yOf(l.limit).toFixed(1);
    s += `<line class="plant-trend__limit plant-trend__limit--${l.severity}" x1="${g.left}" x2="${W - g.right}" y1="${y}" y2="${y}"/>`;
    s += `<text class="plant-trend__limit-label plant-trend__limit-label--${l.severity}" x="${W - g.right - 2}" y="${(Number(y) + (l.dir === "HI" ? -3 : 9)).toFixed(1)}" text-anchor="end">${l.dir} ${Plant.escapeHtml(fmtBare(l.limit))}</text>`;
  }
  // Alarm markers: ▼ at activation, ▽ at return to normal
  for (const ev of Plant.trendEvents(def.id)) {
    const back = now - ev.tick;
    if (back < 0 || back > N - 1) continue;
    const x = xOf(back);
    const cls = `plant-trend__mark plant-trend__mark--${ev.kind} plant-trend__mark--${ev.severity}`;
    s += `<line class="${cls}" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${g.top}" y2="${H - g.bottom}"/>`;
    s += `<path class="${cls}" d="M${(x - 4).toFixed(1)} ${g.top} h8 l-4 6 z"/>`;
  }
  if (sp.length > 1) s += `<polyline class="plant-trend__sp" points="${stepLine(sp)}"/>`;
  if (pv.length > 1) s += `<polyline class="plant-trend__pv" points="${line(pv)}"/>`;
  else s += `<text class="plant-trend__axis" x="${g.left + 6}" y="${g.top + 14}">collecting…</text>`;

  // Cursor: time, PV and SP at the hovered sample
  const hb = Plant.trendHover;
  let readout = "";
  if (hb != null && hb < pv.length) {
    const x = xOf(hb).toFixed(1);
    const v = pv[pv.length - 1 - hb];
    s += `<line class="plant-trend__cursor" x1="${x}" x2="${x}" y1="${g.top}" y2="${H - g.bottom}"/>`;
    s += `<circle class="plant-trend__dot" cx="${x}" cy="${yOf(v).toFixed(1)}" r="2.6"/>`;
    const spv = sp.length > hb ? sp[sp.length - 1 - hb] : null;
    readout = `${Plant.plantTime(now - hb)} · ${fmt(v)}${spv != null ? ` · SP ${fmt(spv)}` : ""}`;
  }
  plot.innerHTML = `<svg class="plant-trend__svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${Plant.escapeHtml(def.name)} over the last hour">${s}</svg>`;
  if (legend) {
    const parts = [`<span class="plant-trend__key plant-trend__key--pv">PV</span>`];
    if (spTag) parts.push(`<span class="plant-trend__key plant-trend__key--sp">SP</span>`);
    if (limits.length) parts.push(`<span class="plant-trend__key plant-trend__key--limit">Alarm limit</span>`);
    parts.push(readout ? `<span class="plant-trend__readout">${Plant.escapeHtml(readout)}</span>` : `<span class="plant-trend__span">1 h · 1 sample / plant min</span>`);
    const html = parts.join("");
    if (legend.innerHTML !== html) legend.innerHTML = html;
  }
}

Plant.writeSp = function writeSp(tag, next) {
  const n = Plant.roundSp(tag, next);
  if (n == null) return false;
  const w = Plant.SP_WRITE[tag];
  const def = Plant.TAG_BY_ID[tag];
  const old = Plant.live[tag]?.value;
  if (tag === "SpeedSP") Plant.state.speedSp = n;
  else {
    Plant.state.sp[tag] = n;
    // A phase-bound SP holds only for the recipe phase it was written in
    if (w.phase) Plant.state.spPhase[tag] = String(Plant.live["Conching/Conche1/Phase"]?.value ?? "");
  }
  const area = tag === "SpeedSP" ? "Packaging" : tag.split("/")[0];
  Plant.logEvent({
    kind: "sp", area,
    text: `${w.loop} SP ${Number.isFinite(old) ? Plant.formatValue(def, old) : "—"} → ${Plant.formatValue(def, n)}${w.phase ? " (recipe override)" : ""}`,
  });
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  return true;
}
