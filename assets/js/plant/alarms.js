import { Plant } from "./ns.js?v=c600f295ec";


Plant.navigateToAlarm = function navigateToAlarm(alarm) {
  if (!alarm) return;
  const meta = Plant.ALARM_PID[alarm.id];
  const tag = Plant.tagFromAlarmPath(alarm.path);
  if (tag) {
    Plant.selectTag(tag);
    return;
  }
  if (meta?.drawing) Plant.setActiveDrawing(meta.drawing);
}

Plant.renderAlarms = function renderAlarms() {
  const list = document.getElementById("plant-alarms");
  const count = document.getElementById("plant-alarm-count");
  if (!list) return;
  if (count) count.textContent = String(Plant.state.alarms.length);

  document.querySelectorAll("[data-alarm-pane]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-alarm-pane") === Plant.state.alarmPane);
  });
  document.querySelectorAll("[data-alarm-filter]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-alarm-filter") === Plant.state.alarmFilter);
  });

  const filterSev = (a) => Plant.state.alarmFilter === "all" || a.severity === Plant.state.alarmFilter;

  if (Plant.state.alarmPane === "history") {
    const hist = (Plant.state.alarmHistory || []).filter(filterSev);
    if (!hist.length) {
      list.innerHTML = `<li class="plant-alarms-empty">No cleared alarms in history</li>`;
      return;
    }
    list.innerHTML = hist.map((a) => {
      return `<li class="plant-alarm plant-alarm--history is-acked" data-sev="${Plant.escapeHtml(a.severity)}" data-alarm-id="${Plant.escapeHtml(a.id)}" role="button" tabindex="0">
        <div class="plant-alarm__top">
          <span class="plant-alarm__sev">${Plant.escapeHtml(a.severity)}</span>
          <span class="plant-alarm__badge">cleared</span>
          <span class="font-mono text-[10px] text-slate-500">${Plant.escapeHtml(Plant.timeAgo(a.clearedTs || a.ts))}</span>
        </div>
        <p class="plant-alarm__msg">${Plant.escapeHtml(a.message)}</p>
        <p class="plant-alarm__path">${Plant.escapeHtml(a.path)}</p>
      </li>`;
    }).join("");
    return;
  }

  const active = Plant.state.alarms.filter(filterSev);
  if (!active.length) {
    list.innerHTML = `<li class="plant-alarms-empty">${Plant.state.alarms.length ? "No alarms match filter" : "No active alarms · line healthy"}</li>`;
    return;
  }

  const firstOut = Plant.firstOutAlarmId(Plant.state.alarms);
  list.innerHTML = active
    .slice()
    .sort((a, b) => Number(a.acked) - Number(b.acked) || b.ts - a.ts)
    .map((a) => {
      const acked = a.acked ? " is-acked" : "";
      const fo = a.id === firstOut && !a.acked ? `<span class="plant-alarm__firstout" title="First-out">1st</span>` : "";
      const ackBtn = a.acked
        ? ""
        : `<div class="plant-alarm__ack"><button type="button" class="plant-btn plant-btn--ghost" data-ack="${Plant.escapeHtml(a.id)}">Ack</button></div>`;
      return `<li class="plant-alarm${acked}" data-sev="${Plant.escapeHtml(a.severity)}" data-alarm-id="${Plant.escapeHtml(a.id)}" role="button" tabindex="0">
        <div class="plant-alarm__top">
          <span class="plant-alarm__sev">${Plant.escapeHtml(a.severity)}</span>
          ${fo}
          <span class="font-mono text-[10px] text-slate-500">${Plant.escapeHtml(Plant.timeAgo(a.ts))}</span>
        </div>
        <p class="plant-alarm__msg">${Plant.escapeHtml(a.message)}</p>
        <p class="plant-alarm__path">${Plant.escapeHtml(a.path)}</p>
        ${ackBtn}
      </li>`;
    })
    .join("");
}

Plant.updateAlarmTimes = function updateAlarmTimes() {
  if (Plant.state.alarmPane === "history") return;
  const filterSev = (a) => Plant.state.alarmFilter === "all" || a.severity === Plant.state.alarmFilter;
  const sorted = Plant.state.alarms.filter(filterSev).slice().sort((x, y) => Number(x.acked) - Number(y.acked) || y.ts - x.ts);
  document.querySelectorAll("#plant-alarms .plant-alarm").forEach((el, i) => {
    const a = sorted[i];
    if (!a) return;
    const t = el.querySelector(".plant-alarm__top span:last-child");
    if (t) t.textContent = Plant.timeAgo(a.ts);
  });
}

Plant.ackAll = function ackAll() {
  Plant.state.alarms = Plant.state.alarms.map((a) => ({ ...a, acked: true }));
  Plant.saveState();
  Plant.renderAlarms();
}

Plant.ackOne = function ackOne(id) {
  Plant.state.alarms = Plant.state.alarms.map((a) => (a.id === id ? { ...a, acked: true } : a));
  Plant.saveState();
  Plant.renderAlarms();
}
