import { Plant } from "./ns.js?v=c600f295ec";


Plant.renderDetail = function renderDetail() {
  const el = document.getElementById("plant-detail");
  if (!el) return;
  const def = Plant.TAG_BY_ID[Plant.state.selectedTag];
  const lv = Plant.live[Plant.state.selectedTag];
  if (!def || !lv) {
    el.innerHTML = `<p class="plant-detail__empty">Select a tag in the browser or on the P&amp;ID.</p>`;
    return;
  }
  const path = Plant.pathOf(def.id);
  const writable = def.id === "SpeedSP";
  const numeric = def.type === "number";
  const spark = numeric ? Plant.sparklineSvg(Plant.trends[def.id] || []) : "";
  const sisterNote = Plant.isSisterSiteTag(def.id)
    ? (() => {
        const site = def.id.split("/")[0];
        const snap = Plant.siteSnapshot(site);
        if (snap.link === "flap") {
          return `<p class="plant-faceplate__note plant-faceplate__note--flap">Sister link flapping (Uncertain) — Heuvelland P&amp;ID still shown</p>`;
        }
        return `<p class="plant-faceplate__note">Sister site offline — last known values (Stale) · Heuvelland P&amp;ID still shown</p>`;
      })()
    : "";
  const writeBlock = writable ? `
    <form class="plant-faceplate__write" data-faceplate-write="SpeedSP">
      <label class="plant-faceplate__write-label">Write SpeedSP
        <input type="number" name="speed" min="20" max="60" step="1" value="${Plant.escapeHtml(String(Plant.state.speedSp))}" class="plant-faceplate__input" />
        <span class="plant-faceplate__unit">cpm</span>
      </label>
      <button type="submit" class="plant-btn plant-btn--ghost">Confirm write</button>
    </form>` : "";
  el.innerHTML = `
    <div class="plant-faceplate">
      <div class="plant-faceplate__main">
        <p class="plant-faceplate__path" title="${Plant.escapeHtml(path)}">${Plant.escapeHtml(path)}</p>
        ${sisterNote}
        <div class="plant-faceplate__row">
          <strong class="plant-faceplate__val">${Plant.escapeHtml(Plant.formatValue(def, lv.value))}</strong>
          <span class="plant-q plant-q--${Plant.escapeHtml(lv.quality.toLowerCase())}">${Plant.escapeHtml(lv.quality)}</span>
          <span class="plant-faceplate__meta">${Plant.escapeHtml(def.type)}${def.unit ? ` · ${Plant.escapeHtml(def.unit)}` : ""} · ${Plant.escapeHtml(def.name)}</span>
        </div>
        ${Plant.SETPOINT_FOR[def.id] ? `<p class="plant-faceplate__sp">Setpoint <strong>${Plant.escapeHtml(Plant.liveReadout(Plant.SETPOINT_FOR[def.id]))}</strong> · deviation ${Plant.escapeHtml((() => { const d = Number(lv.value) - Number(Plant.live[Plant.SETPOINT_FOR[def.id]]?.value); return Number.isFinite(d) ? `${d >= 0 ? "+" : ""}${d.toFixed(1)}${def.unit ? ` ${def.unit}` : ""}` : "—"; })())}</p>` : ""}
        ${writeBlock}
      </div>
      ${numeric ? `<div class="plant-faceplate__trend" title="Last ${Plant.TREND_LEN} samples">${spark}</div>` : ""}
    </div>`;
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
