import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Guided tour: "Night shift on Line 3" ----------------
   Seven steps through one incident. The visitor does each step themselves
   (a "Do it for me" link covers the action steps). The tour runs on its own
   copy of the plant: the visitor's plant is set aside, nothing the tour does
   is saved, and closing the tour puts their own shift back. */

Plant.TOUR_HINT_KEY = "samdonche.plant.tourHint";
Plant.TOUR_START_TICK = 21 * 60 + 12 - 45; // 45 plant minutes of history before 03:12
Plant.TOUR_FAST_MS = 250; // plant clock while the fault develops (4× the normal scan)

Plant.tour = { active: false, step: 0, saved: null, raf: 0, rect: "", entered: -1 };

const ALARM_ID = "alm-conche-overtemp";
const TEMP_TAG = "Conching/Conche1/TempC";
const $ = (sel) => document.querySelector(sel);
const alarm = () => Plant.state.alarms.find((a) => a.id === ALARM_ID);

/* Each step: where to look (target), what to say, and when it is done.
   `enter` sets the plant up; `done` (if any) makes it an action step;
   `auto` performs that action for "Do it for me". */
Plant.TOUR_STEPS = [
  {
    title: () => `${Plant.plantTime(Plant.tick)} · Night shift`,
    body: () => `
      <p>You&rsquo;re the only operator on the Heuvelland night shift. The conche has been in its dry phase
      for an hour and nothing is happening. Good.</p>
      <p>On this HMI, quiet looks grey. Values are neutral, and green only marks a unit that&rsquo;s running.
      Colour means something needs you.</p>`,
    target: ".plant-mimic__canvas",
    enter() { Plant.setActiveDrawing("conching"); },
  },
  {
    title: () => `${Plant.plantTime(Plant.tick)} · Something breaks`,
    body: () => `
      <p>The conche&rsquo;s jacket water sticks hot and the chocolate mass starts to overheat. Watch
      <strong>TI-310</strong> climb.</p>
      <p>The unit trips to <strong>ABORTED</strong> straight away. The alarm follows once the temperature
      crosses its 79&nbsp;°C limit.</p>
      <p class="plant-tour__wait" data-tour-wait>Waiting for the alarm&hellip;</p>`,
    target: `.pid-balloon[data-tag="${TEMP_TAG}"]`,
    enter() {
      Plant.setActiveDrawing("conching");
      Plant.simulate("conching", "overtemp");
      Plant.setTickRate(Plant.TOUR_FAST_MS);
    },
    done: () => !!alarm() && !alarm().rtn,
    leave() { Plant.setTickRate(Plant.TICK_MS); },
    autoAdvance: true,
  },
  {
    title: () => `${Plant.plantTime(Plant.tick)} · Acknowledge`,
    body: () => `
      <p>The alarm is in: <strong>High</strong> priority, and marked <strong>1st</strong>. It&rsquo;s the
      first-out, the one that started it all.</p>
      <p>Everything downstream is now starving for chocolate, but those alarms are suppressed behind this one.
      You get one root cause instead of a wall of red.</p>
      <p><strong>Acknowledge it.</strong></p>`,
    target: `.plant-alarm[data-alarm-id="${ALARM_ID}"]`,
    enter() {
      Plant.state.alarmPane = "active";
      Plant.state.alarmFilter = "all";
      Plant.renderAlarms();
    },
    done: () => !!alarm()?.acked || !alarm(),
    auto() { Plant.ackOne(ALARM_ID); },
  },
  {
    title: () => "Look back first",
    body: () => `
      <p>Before fixing anything, check what happened. The faceplate trend holds the last plant hour: the
      temperature leaving its setpoint, and the red marker where the alarm came in.</p>
      <p>Hover the trend to read any minute.</p>`,
    target: "[data-fp-trend]",
    enter() { Plant.selectTag(TEMP_TAG); },
  },
  {
    title: () => `${Plant.plantTime(Plant.tick)} · Bring it back`,
    body: () => {
      const st = Plant.unit("Conching").st;
      const cleared = Plant.state.concheScenario == null;
      const reset = cleared && st !== "ABORTED" && st !== "ABORTING";
      const item = (ok, text) => `<li${ok ? ' class="is-done"' : ""}>${text}</li>`;
      return `
      <p>Maintenance has freed the valve. The unit is <strong>latched</strong>: it won&rsquo;t restart by
      itself, and it won&rsquo;t let you restart while the fault is still there.</p>
      <ol class="plant-tour__checklist">
        ${item(cleared, "Clear the fault <span>(Simulate → Clear)</span>")}
        ${item(reset, "Reset the unit")}
        ${item(Plant.unitRunning("Conching"), "Start it")}
      </ol>`;
    },
    target: () => {
      if (Plant.state.concheScenario != null) return '[data-conche-scenario="recover"]';
      const st = Plant.unit("Conching").st;
      return st === "ABORTED" || st === "ABORTING" ? '[data-unit-cmd="reset"]' : '[data-unit-cmd="start"]';
    },
    enter() { Plant.setActiveDrawing("conching"); },
    done: () => Plant.unitRunning("Conching"),
    auto() {
      if (Plant.state.concheScenario != null) Plant.simulate("conching", "recover");
      else if (!Plant.unitCommand("Conching", "reset")) Plant.unitCommand("Conching", "start");
    },
    live: true, // checklist follows each click
  },
  {
    title: () => "Count the cost",
    body: () => {
      const lost = Object.values(Plant.state.oee?.down || {}).reduce((s, m) => s + m, 0);
      return `
      <p>While the conche was down, Line&nbsp;3 ran out of chocolate. Every minute it stood still is booked
      against a reason${lost ? `, ${lost} so far this shift` : ""}.</p>
      <p>Here&rsquo;s the night&rsquo;s OEE (availability &times; performance &times; quality) and the
      downtime Pareto a morning meeting would argue about.</p>`;
    },
    target: "[data-fp-pareto]",
    enter() { Plant.selectTag("OEE"); },
  },
  {
    title: () => "The paper trail",
    body: () => `
      <p>Everything that happened is in the events journal, stamped with plant time: the fault, your
      acknowledgement, the reset and the start. That&rsquo;s what the morning shift reads first.</p>
      <p>That&rsquo;s the tour. <a href="../case-studies/plant-hmi/">How it&rsquo;s built &rarr;</a></p>`,
    target: ".plant-pane--alarms",
    enter() {
      Plant.state.alarmPane = "events";
      Plant.renderAlarms();
    },
    last: true,
  },
];

/* ---------------- Plant clock control ---------------- */

Plant.setTickRate = function setTickRate(ms) {
  if (Plant.timer) clearInterval(Plant.timer);
  Plant.timer = setInterval(Plant.tickOnce, ms);
};

/* ---------------- Start / stop ---------------- */

Plant.startTour = function startTour() {
  const T = Plant.tour;
  if (T.active) return;
  Plant.hideTourHint(true);
  // Set the visitor's plant aside; the tour runs on a fresh night shift
  T.saved = {
    state: JSON.stringify(Plant.state),
    trends: Plant.trends,
    pvState: Plant.pvState,
    noiseState: Plant.noiseState,
    tick: Plant.tick,
  };
  T.active = true;
  Plant.state = Plant.defaultState();
  Plant.state.activeDrawing = "conching";
  Plant.state.selectedTag = TEMP_TAG;
  Plant.trends = {};
  Plant.trendTick = null;
  Plant.pvState = {};
  Plant.noiseState = {};
  Plant.tick = Plant.TOUR_START_TICK;
  Plant.state.tick = Plant.tick;
  Plant.state.units = Plant.defaultUnits(Plant.tick);
  // The conche entered its dry phase an hour before 03:12 (DRY starts 90 min into a batch)
  Plant.unit("Conching").clock = 90 + 60 - 45;
  // A clean night shift so far: every minute since 22:00 ran at the line's usual rate
  const o = Plant.defaultOee(Plant.tick, Plant.state.rejectCount);
  const ran = Plant.tick - Plant.shiftIndex(Plant.tick) * Plant.SHIFT_TICKS;
  Object.assign(o, { planned: ran, run: ran, count: ran * 36, good: Math.round(ran * 36 * 0.998) });
  Plant.state.oee = o;
  // 45 quiet plant minutes, so the trend and the shift OEE have history
  Plant.computeLive();
  for (let i = 0; i < 45; i++) {
    Plant.tick += 1;
    Plant.state.tick = Plant.tick;
    Plant.accountOee();
    Plant.advanceUnits();
    Plant.computeLive();
  }
  Plant.state.events = [];
  Plant.treeBuilt = false;
  Plant.pidBuilt = false;
  Plant.alarmSig = null;
  Plant.renderAll();
  Plant.syncHash("conching");
  Plant.buildTourUi();
  Plant.gotoTourStep(0);
  T.raf = requestAnimationFrame(Plant.tourFrame);
};

/** keep: stay on the tour's plant (it becomes the visitor's); otherwise restore theirs. */
Plant.endTour = function endTour(keep) {
  const T = Plant.tour;
  if (!T.active) return;
  const step = Plant.TOUR_STEPS[T.step];
  step?.leave?.();
  Plant.setTickRate(Plant.TICK_MS);
  cancelAnimationFrame(T.raf);
  T.active = false;
  $("#plant-tour")?.remove();
  document.body.classList.remove("plant-tour-docked");
  if (!keep && T.saved) {
    Plant.state = JSON.parse(T.saved.state);
    Plant.trends = T.saved.trends;
    Plant.pvState = T.saved.pvState;
    Plant.noiseState = T.saved.noiseState;
    Plant.tick = T.saved.tick;
    Plant.trendTick = null;
  }
  T.saved = null;
  Plant.saveState();
  Plant.treeBuilt = false;
  Plant.pidBuilt = false;
  Plant.alarmSig = null;
  Plant.computeLive();
  Plant.renderAll();
  Plant.syncHash(Plant.state.activeDrawing);
  $("#plant-tour-btn")?.focus();
};

/* ---------------- Steps ---------------- */

Plant.gotoTourStep = function gotoTourStep(i) {
  const T = Plant.tour;
  const prev = Plant.TOUR_STEPS[T.step];
  if (T.entered === T.step && i !== T.step) prev?.leave?.();
  T.step = Math.max(0, Math.min(Plant.TOUR_STEPS.length - 1, i));
  const step = Plant.TOUR_STEPS[T.step];
  // Going back never re-runs a step's setup (the fault only breaks once)
  if (T.entered < T.step) {
    T.entered = T.step;
    step.enter?.();
  }
  T.rect = "";
  Plant.paintTourCard(true);
  Plant.scrollToTourTarget();
};

Plant.tourSelector = function tourSelector() {
  const step = Plant.TOUR_STEPS[Plant.tour.step];
  return typeof step.target === "function" ? step.target() : step.target;
};

Plant.tourTarget = function tourTarget() {
  const sel = Plant.tourSelector();
  return sel ? document.querySelector(sel) : null;
};

/** Bring the target into view: on phones up under the site bar, since the card docks below. */
Plant.scrollToTourTarget = function scrollToTourTarget() {
  const T = Plant.tour;
  T.scrolledTo = Plant.tourSelector();
  const target = Plant.tourTarget();
  if (!target) return;
  const r = target.getBoundingClientRect();
  const behavior = Plant.reducedMotion ? "auto" : "smooth";
  if (window.innerWidth < 640) {
    window.scrollBy({ top: r.top - 80, behavior });
  } else if (r.top < 0 || r.bottom > window.innerHeight) {
    target.scrollIntoView({ block: "center", behavior });
  }
};

/* ---------------- UI ---------------- */

Plant.buildTourUi = function buildTourUi() {
  $("#plant-tour")?.remove();
  const root = document.createElement("div");
  root.id = "plant-tour";
  root.className = "plant-tour";
  root.innerHTML = `
    <div class="plant-tour__spot" aria-hidden="true"></div>
    <section class="plant-tour__card" role="dialog" aria-modal="false" aria-labelledby="plant-tour-title">
      <p class="plant-tour__eyebrow"><span>Tour</span><span data-tour-count></span></p>
      <h2 id="plant-tour-title" class="plant-tour__title" tabindex="-1"></h2>
      <div class="plant-tour__body" data-tour-body aria-live="polite"></div>
      <div class="plant-tour__actions" data-tour-actions></div>
    </section>`;
  document.body.appendChild(root);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tour]");
    if (!b) return;
    const a = b.getAttribute("data-tour");
    const T = Plant.tour;
    const step = Plant.TOUR_STEPS[T.step];
    if (a === "next") Plant.gotoTourStep(T.step + 1);
    else if (a === "back") Plant.gotoTourStep(T.step - 1);
    else if (a === "auto") step.auto?.();
    else if (a === "skip") Plant.endTour(false);
    else if (a === "keep") Plant.endTour(true);
  });
};

/** Card content; rebuilt on step change and whenever a live step's progress moves. */
Plant.paintTourCard = function paintTourCard(stepChanged) {
  const T = Plant.tour;
  const root = $("#plant-tour");
  if (!root) return;
  const step = Plant.TOUR_STEPS[T.step];
  const done = step.done ? step.done() : true;
  const sig = `${T.step}|${done}|${step.live ? step.body() : ""}`;
  if (!stepChanged && root.dataset.sig === sig) return;
  root.dataset.sig = sig;
  root.querySelector("[data-tour-count]").textContent = `${T.step + 1} / ${Plant.TOUR_STEPS.length}`;
  root.querySelector("#plant-tour-title").textContent = step.title();
  root.querySelector("[data-tour-body]").innerHTML = step.body();
  const btn = (a, label, cls = "", disabled = false) =>
    `<button type="button" class="plant-btn ${cls}" data-tour="${a}"${disabled ? " disabled" : ""}>${label}</button>`;
  const actions = [];
  if (T.step > 0 && !step.last) actions.push(btn("back", "Back", "plant-btn--ghost"));
  if (step.last) {
    actions.push(btn("keep", "Explore this plant", "plant-btn--accent"));
    actions.push(btn("skip", "Back to my shift", "plant-btn--ghost"));
  } else {
    if (step.done && !done && step.auto) actions.push(btn("auto", "Do it for me", "plant-btn--ghost"));
    if (!step.autoAdvance || done) actions.push(btn("next", "Next", done ? "plant-btn--accent" : "plant-btn--ghost", !done));
    actions.push(btn("skip", "Close", "plant-btn--ghost plant-tour__close"));
  }
  root.querySelector("[data-tour-actions]").innerHTML = actions.join("");
  if (stepChanged) root.querySelector("#plant-tour-title").focus({ preventScroll: true });
};

/** Every frame: follow the target, advance finished auto steps, refresh live steps. */
Plant.tourFrame = function tourFrame() {
  const T = Plant.tour;
  if (!T.active) return;
  const step = Plant.TOUR_STEPS[T.step];
  if (step.autoAdvance && step.done()) {
    Plant.gotoTourStep(T.step + 1);
  } else {
    Plant.paintTourCard(false);
    // A step whose target moves (Clear → Reset → Start) follows it
    if (Plant.tourSelector() !== T.scrolledTo) Plant.scrollToTourTarget();
  }
  Plant.placeTour();
  T.raf = requestAnimationFrame(Plant.tourFrame);
};

/** Spotlight on the target; card beside it (desktop) or docked at the bottom (phones). */
Plant.placeTour = function placeTour() {
  const root = $("#plant-tour");
  if (!root) return;
  const spot = root.querySelector(".plant-tour__spot");
  const card = root.querySelector(".plant-tour__card");
  const t = Plant.tourTarget();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = t ? t.getBoundingClientRect() : null;
  const pad = 6;
  const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)},${vw},${vh}` : `none,${vw},${vh}`;
  if (key === Plant.tour.rect) return;
  Plant.tour.rect = key;
  if (r && r.width > 0) {
    spot.hidden = false;
    spot.style.left = `${r.left - pad}px`;
    spot.style.top = `${r.top - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;
  } else {
    spot.hidden = true;
  }
  root.classList.toggle("is-docked", vw < 640);
  // Room to scroll the last targets on the page clear of the docked card
  document.body.classList.toggle("plant-tour-docked", vw < 640);
  if (vw < 640) {
    card.style.left = "";
    card.style.top = "";
    return;
  }
  // Beside the target: below if it fits, else above, else to the side; always on screen
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const gap = 14;
  let left;
  let top;
  if (!r || r.width === 0) {
    left = (vw - cw) / 2;
    top = (vh - ch) / 2;
  } else if (r.bottom + gap + ch < vh - 8) {
    left = r.left;
    top = r.bottom + gap;
  } else if (r.top - gap - ch > 8) {
    left = r.left;
    top = r.top - gap - ch;
  } else {
    left = r.left - gap - cw > 8 ? r.left - gap - cw : r.right + gap;
    top = r.top + (r.height - ch) / 2;
  }
  card.style.left = `${Math.round(Math.max(8, Math.min(vw - cw - 8, left)))}px`;
  card.style.top = `${Math.round(Math.max(8, Math.min(vh - ch - 8, top)))}px`;
};

/* ---------------- Entry points ---------------- */

/** One-time hint next to the Tour button on a first visit; never opens the tour itself. */
Plant.maybeShowTourHint = function maybeShowTourHint() {
  let seen = true;
  try { seen = !!localStorage.getItem(Plant.TOUR_HINT_KEY); } catch (e) { /* storage off: no hint */ }
  // Visitors arriving on a deep link came for something specific
  if (seen || location.hash.includes("?")) return;
  const btn = $("#plant-tour-btn");
  if (!btn) return;
  const hint = document.createElement("div");
  hint.id = "plant-tour-hint";
  hint.className = "plant-tour-hint";
  hint.setAttribute("role", "status");
  hint.innerHTML = `<button type="button" class="plant-tour-hint__go">New here? Take the 90-second tour</button>
    <button type="button" class="plant-tour-hint__close" aria-label="Dismiss the tour hint">&times;</button>`;
  // Inline beside the button, so it never covers the area tabs below
  btn.insertAdjacentElement("beforebegin", hint);
  hint.querySelector(".plant-tour-hint__close").addEventListener("click", () => Plant.hideTourHint(true));
  hint.querySelector(".plant-tour-hint__go").addEventListener("click", () => Plant.startTour());
  // Shown once: a second visit gets the plain Tour button only
  try { localStorage.setItem(Plant.TOUR_HINT_KEY, "1"); } catch (e) { /* ignore */ }
};

Plant.hideTourHint = function hideTourHint(remember) {
  $("#plant-tour-hint")?.remove();
  if (remember) {
    try { localStorage.setItem(Plant.TOUR_HINT_KEY, "1"); } catch (e) { /* ignore */ }
  }
};

Plant.wireTour = function wireTour() {
  $("#plant-tour-btn")?.addEventListener("click", () => Plant.startTour());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && Plant.tour.active) Plant.endTour(false);
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#tour") Plant.startTour();
  });
};
