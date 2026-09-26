import { Plant } from "./ns.js?v=c600f295ec";


Plant.navigateToAlarm = function navigateToAlarm(alarm) {
  if (!alarm) return;
  if (alarm.causedBy) {
    Plant.setActiveDrawing(alarm.causedBy.toLowerCase());
    return;
  }
  const meta = Plant.ALARM_PID[alarm.id];
  if (meta?.navTag && Plant.TAG_BY_ID[meta.navTag]) {
    Plant.selectTag(meta.navTag);
    return;
  }
  if (meta?.navDrawing) {
    Plant.setActiveDrawing(meta.navDrawing);
    return;
  }
  const tag = Plant.tagFromAlarmPath(alarm.path);
  if (tag) {
    Plant.selectTag(tag);
    return;
  }
  if (meta?.drawing) Plant.setActiveDrawing(meta.drawing);
}

Plant.sortActiveAlarms = function sortActiveAlarms(alarms) {
  const firstOut = Plant.firstOutAlarmId(alarms);
  const rank = (a) => (a.id === firstOut ? 0 : !a.acked && !a.rtn ? 1 : a.rtn ? 2 : 3);
  const prio = { critical: 0, warning: 1, low: 2 };
  return alarms.slice().sort((a, b) => rank(a) - rank(b) || prio[a.severity] - prio[b.severity] || a.tick - b.tick);
}

/* One alarm row. State follows ISA-18.2: UNACK (active, not acknowledged),
   ACKED (active, acknowledged), RTN UNACK (cleared, still to acknowledge). */
Plant.alarmRow = function alarmRow(a, opts) {
  const o = opts || {};
  const pr = Plant.ALARM_PRIORITY[a.severity] || a.severity;
  const state = a.rtn ? "RTN UNACK" : a.acked ? "ACKED" : "UNACK";
  const fo = o.firstOut ? `<span class="plant-alarm__firstout" title="First-out alarm">1st</span>` : "";
  const supp = o.suppressed && o.suppressed.length
    ? `<p class="plant-alarm__supp" title="${Plant.escapeHtml(o.suppressed.map((c) => c.message).join("\n"))}">+${o.suppressed.length} consequential alarm${o.suppressed.length === 1 ? "" : "s"} suppressed</p>`
    : "";
  const when = o.history
    ? `${Plant.plantTime(a.tick)} → ${Plant.plantTime(a.clearedTick)}`
    : o.shelved
      ? `shelved until ${Plant.plantTime(Plant.state.shelved[a.id])}`
      : Plant.plantTime(a.tick);
  const buttons = [];
  if (!o.history && !a.acked) buttons.push(`<button type="button" class="plant-btn plant-btn--ghost" data-ack="${Plant.escapeHtml(a.id)}">Ack</button>`);
  if (!o.history && !o.shelved && !a.rtn) buttons.push(`<button type="button" class="plant-btn plant-btn--ghost" data-shelve="${Plant.escapeHtml(a.id)}" title="Hide this alarm for one plant hour">Shelve</button>`);
  if (o.shelved) buttons.push(`<button type="button" class="plant-btn plant-btn--ghost" data-unshelve="${Plant.escapeHtml(a.id)}">Unshelve</button>`);
  const cls = `plant-alarm${a.acked || o.history ? " is-acked" : ""}${a.rtn && !o.history ? " is-rtn" : ""}${o.history ? " plant-alarm--history" : ""}`;
  return `<li class="${cls}" data-sev="${Plant.escapeHtml(a.severity)}" data-alarm-id="${Plant.escapeHtml(a.id)}" role="button" tabindex="0">
        <div class="plant-alarm__top">
          <span class="plant-alarm__sev">${Plant.escapeHtml(pr)}</span>
          ${fo}
          <span class="plant-alarm__state">${o.history ? "CLEARED" : state}</span>
          <span class="plant-alarm__time">${Plant.escapeHtml(when)}</span>
        </div>
        <p class="plant-alarm__msg">${Plant.escapeHtml(a.message)}</p>
        <p class="plant-alarm__path">${Plant.escapeHtml(a.path)}</p>
        ${supp}
        ${buttons.length ? `<div class="plant-alarm__ack">${buttons.join("")}</div>` : ""}
      </li>`;
}

Plant.renderAlarms = function renderAlarms() {
  const list = document.getElementById("plant-alarms");
  const count = document.getElementById("plant-alarm-count");
  if (!list) return;
  Plant.alarmsDirty = false;
  const visible = Plant.visibleAlarms();
  const shelved = Plant.state.alarms.filter((a) => Plant.isShelved(a));
  if (count) count.textContent = String(visible.length);

  document.querySelectorAll("[data-alarm-pane]").forEach((btn) => {
    const pane = btn.getAttribute("data-alarm-pane");
    btn.classList.toggle("is-active", pane === Plant.state.alarmPane);
    if (pane === "shelved") btn.textContent = shelved.length ? `Shelved (${shelved.length})` : "Shelved";
  });
  document.querySelectorAll("[data-alarm-filter]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-alarm-filter") === Plant.state.alarmFilter);
  });

  // Priority filters only apply to alarms, not to the journal
  const filterRow = document.querySelector('.plant-alarm-tools__row[aria-label="Priority filter"]');
  if (filterRow) filterRow.hidden = Plant.state.alarmPane === "events";
  if (Plant.state.alarmPane === "events") return Plant.renderEvents(list);

  const filterSev = (a) => Plant.state.alarmFilter === "all" || a.severity === Plant.state.alarmFilter;
  const empty = (msg) => { list.innerHTML = `<li class="plant-alarms-empty">${msg}</li>`; };

  if (Plant.state.alarmPane === "history") {
    const hist = (Plant.state.alarmHistory || []).filter(filterSev);
    if (!hist.length) return empty("No cleared alarms in history");
    list.innerHTML = hist.map((a) => Plant.alarmRow(a, { history: true })).join("");
    return;
  }
  if (Plant.state.alarmPane === "shelved") {
    const sh = shelved.filter(filterSev);
    if (!sh.length) return empty("No shelved alarms");
    list.innerHTML = sh.map((a) => Plant.alarmRow(a, { shelved: true })).join("");
    return;
  }

  const active = visible.filter(filterSev);
  if (!active.length) return empty(visible.length ? "No alarms match filter" : "No active alarms");
  const firstOut = Plant.firstOutAlarmId(visible);
  const suppressedFor = (root) => (root.causedBy || root.rtn)
    ? []
    : Plant.state.alarms.filter((c) => c.causedBy === root.area && Plant.isSuppressed(c));
  const shownSupp = new Set();
  list.innerHTML = Plant.sortActiveAlarms(active).map((a) => {
    // Attach the suppressed count to one root alarm per area
    const supp = shownSupp.has(a.area) ? [] : suppressedFor(a);
    if (supp.length) shownSupp.add(a.area);
    return Plant.alarmRow(a, { firstOut: a.id === firstOut, suppressed: supp });
  }).join("");
}

/* Plant-time stamps don't tick like "7s ago" did, so only a changed alarm set re-renders. */
Plant.updateAlarmTimes = function updateAlarmTimes() {
  if (Plant.alarmsDirty) Plant.renderAlarms();
}

/* ---------------- Event journal ----------------
   What the operator did, and what the control system did on its own, stamped
   with plant time: commands, setpoint writes, acks, shelving, simulated faults. */

Plant.EVENT_KINDS = { cmd: "CMD", sp: "SP", ack: "ACK", shelve: "SHELVE", sim: "SIM", op: "OP", sys: "SYS" };

Plant.logEvent = function logEvent(ev) {
  const S = Plant.state;
  S.events = [{ tick: Plant.tick, kind: ev.kind, area: ev.area || "", text: ev.text }, ...(S.events || [])].slice(0, Plant.EVENT_MAX);
  Plant.alarmsDirty = true;
}

/** Alarm tag + description without the value part: "TI-310 Conche1 mass temperature HI". */
Plant.alarmShort = function alarmShort(a) {
  return String(a.message || a.id).split(" — ")[0];
}

Plant.renderEvents = function renderEvents(list) {
  const ev = Plant.state.events || [];
  if (!ev.length) {
    list.innerHTML = `<li class="plant-alarms-empty">No operator actions yet this shift</li>`;
    return;
  }
  list.innerHTML = ev.map((e) => `<li class="plant-event" data-kind="${Plant.escapeHtml(e.kind)}">
      <span class="plant-event__time">${Plant.plantTime(e.tick)}</span>
      <span class="plant-event__kind">${Plant.escapeHtml(Plant.EVENT_KINDS[e.kind] || e.kind.toUpperCase())}</span>
      <span class="plant-event__text">${Plant.escapeHtml(e.text)}</span>
      ${e.area ? `<span class="plant-event__area">${Plant.escapeHtml(e.area)}</span>` : ""}
    </li>`).join("");
}

Plant.ackAlarm = function ackAlarm(a) {
  if (!a.rtn) return { ...a, acked: true };
  // Acknowledging a returned alarm completes it: it moves to history
  Plant.state.alarmHistory = [{ ...a, acked: true, clearedTick: a.rtnTick ?? Plant.tick, clearedTs: Date.now() }, ...(Plant.state.alarmHistory || [])].slice(0, 30);
  return null;
}

Plant.ackAll = function ackAll() {
  const n = Plant.state.alarms.filter((a) => !a.acked && !Plant.isShelved(a) && !Plant.isSuppressed(a)).length;
  if (n) Plant.logEvent({ kind: "ack", text: `ACK ALL — ${n} alarm${n === 1 ? "" : "s"}` });
  Plant.state.alarms = Plant.state.alarms
    .map((a) => (Plant.isShelved(a) || Plant.isSuppressed(a) ? a : Plant.ackAlarm(a)))
    .filter(Boolean);
  Plant.saveState();
  Plant.renderAlarms();
  Plant.renderAll({ alarms: false });
}

Plant.ackOne = function ackOne(id) {
  const hit = Plant.state.alarms.find((a) => a.id === id && !a.acked);
  if (hit) Plant.logEvent({ kind: "ack", area: hit.area, text: `ACK ${Plant.alarmShort(hit)}${hit.rtn ? " (RTN)" : ""}` });
  Plant.state.alarms = Plant.state.alarms.map((a) => (a.id === id ? Plant.ackAlarm(a) : a)).filter(Boolean);
  Plant.saveState();
  Plant.renderAlarms();
  Plant.renderAll({ alarms: false });
}

/** Shelve for one plant hour (60 ticks). */
Plant.shelveAlarm = function shelveAlarm(id) {
  const hit = Plant.state.alarms.find((a) => a.id === id);
  if (hit) Plant.logEvent({ kind: "shelve", area: hit.area, text: `SHELVE ${Plant.alarmShort(hit)} until ${Plant.plantTime(Plant.tick + 60)}` });
  Plant.state.shelved = { ...(Plant.state.shelved || {}), [id]: Plant.tick + 60 };
  Plant.saveState();
  Plant.renderAll();
}

Plant.unshelveAlarm = function unshelveAlarm(id) {
  const hit = Plant.state.alarms.find((a) => a.id === id);
  if (hit) Plant.logEvent({ kind: "shelve", area: hit.area, text: `UNSHELVE ${Plant.alarmShort(hit)}` });
  const next = { ...(Plant.state.shelved || {}) };
  delete next[id];
  Plant.state.shelved = next;
  Plant.saveState();
  Plant.renderAll();
}
