import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Actions ---------------- */

Plant.setScenario = function setScenario(name) {
  if (name === "recover") {
    Plant.state.scenario = null;
    Plant.state.cartonerJamCleared = false;
  } else if (name === "jam") {
    Plant.state.scenario = "jam";
    Plant.state.cartonerJamCleared = false;
  } else if (name === "starved") {
    Plant.state.scenario = "starved";
    Plant.state.cartonerJamCleared = false;
  }
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setMixScenario = function setMixScenario(name) {
  if (name === "recover") Plant.state.mixScenario = null;
  else if (name === "overtemp" || name === "valve") Plant.state.mixScenario = name;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setTemperScenario = function setTemperScenario(name) {
  if (name === "recover") Plant.state.temperScenario = null;
  else {
    const resolved = Plant.normalizeTemperScenario(name);
    if (resolved) Plant.state.temperScenario = resolved;
  }
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setRefineScenario = function setRefineScenario(name) {
  if (name === "recover") Plant.state.refineScenario = null;
  else if (name === "pressure" || name === "particle") Plant.state.refineScenario = name;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setConcheScenario = function setConcheScenario(name) {
  if (name === "recover") Plant.state.concheScenario = null;
  else if (name === "overtemp" || name === "agitator") Plant.state.concheScenario = name;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setMouldScenario = function setMouldScenario(name) {
  if (name === "recover") Plant.state.mouldScenario = null;
  else if (name === "jam" || name === "cool") Plant.state.mouldScenario = name;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.resetReject = function resetReject() {
  Plant.state.rejectCount = 0;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
}

Plant.clearCartonerJam = function clearCartonerJam() {
  if (Plant.state.scenario === "jam") {
    Plant.state.cartonerJamCleared = true;
    Plant.state.scenario = null;
    Plant.state.alarms = Plant.state.alarms.filter((a) => a.id !== "alm-cartoner-jam");
  }
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.recoverAll = function recoverAll() {
  Plant.state.scenario = null;
  Plant.state.mixScenario = null;
  Plant.state.temperScenario = null;
  Plant.state.refineScenario = null;
  Plant.state.concheScenario = null;
  Plant.state.mouldScenario = null;
  Plant.state.cartonerJamCleared = false;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.resetLine = function resetLine() {
  Plant.state = Plant.defaultState();
  Plant.trends = {};
  Plant.saveState();
  Plant.tick = 0;
  Plant.treeBuilt = false;
  Plant.pidBuilt = false;
  Plant.clearPidHover();
  Plant.computeLive();
  Plant.renderAll();
  Plant.syncHash(Plant.state.activeDrawing);
}
