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
  const writable = def.id === "SpeedSP";
  const numeric = def.type === "number";
  const writeBlock = writable ? `
    <form class="plant-faceplate__write" data-faceplate-write="SpeedSP">
      <label class="plant-faceplate__write-label">Write SpeedSP
        <input type="number" name="speed" min="20" max="60" step="1" value="${esc(String(Plant.state.speedSp))}" class="plant-faceplate__input" />
        <span class="plant-faceplate__unit">cpm</span>
      </label>
      <button type="submit" class="plant-btn plant-btn--ghost">Confirm write</button>
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
      </div>
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
    sp.innerHTML = `Setpoint <strong>${esc(Plant.liveReadout(spTag))}</strong> · deviation ${esc(dev)}`;
  }
  if (def.type === "number") Plant.paintTrend(el, def);
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

Plant.writeSpeedSp = function writeSpeedSp(next) {
  const n = Number(next);
  if (!Number.isFinite(n) || n < 20 || n > 60) return false;
  Plant.state.speedSp = Math.round(n);
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  return true;
}
