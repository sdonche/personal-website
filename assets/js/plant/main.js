import { Plant } from "./ns.js?v=c600f295ec";


Plant.init = function init() {
  const root = document.getElementById("plant-app");
  if (!root) return;
  root.hidden = false;
  const noscript = document.getElementById("plant-noscript");
  if (noscript) noscript.hidden = true;

  Plant.tick = Plant.state.tick || 0;
  const wantTour = location.hash === "#tour"; // before the hash is normalised below
  Plant.wire();
  Plant.wireTour();
  Plant.startClock();
  Plant.computeLive();

  if (!Plant.applyHashState({ skipHash: true })) {
    Plant.syncHash(Plant.state.activeDrawing);
    Plant.renderAll();
  }

  Plant.timer = setInterval(Plant.tickOnce, Plant.TICK_MS);
  if (wantTour) Plant.startTour();
  else Plant.maybeShowTourHint();

  window.addEventListener("hashchange", () => {
    Plant.applyHashState({ skipHash: true });
  });
}

Plant.boot = function boot() {
  if (Plant.state == null) Plant.state = Plant.loadState();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Plant.init());
  } else {
    Plant.init();
  }
};

export function boot() {
  Plant.boot();
}
