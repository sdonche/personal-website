import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Actions ---------------- */

/* Simulate: inject or clear a fault condition on an area. Injecting latches the
   unit (units.js); clearing only removes the condition, the operator then
   brings the unit back with Restart / Unhold or Reset + Start. */
Plant.simulate = function simulate(drawing, name) {
  const before = Plant.getActiveFault(drawing);
  if (!Plant.setDrawingFault(drawing, name === "recover" ? null : name)) return;
  const after = Plant.getActiveFault(drawing);
  if (after !== before) {
    const unit = Plant.UNIT_BY_DRAWING[drawing];
    Plant.logEvent?.({ kind: "sim", area: unit.area, text: after ? `SIM fault injected — ${unit.equip} ${after}` : `SIM fault cleared — ${unit.equip} ${before}` });
  }
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.setScenario = (name) => Plant.simulate("packaging", name);
Plant.setMixScenario = (name) => Plant.simulate("mixing", name);
Plant.setTemperScenario = (name) => Plant.simulate("tempering", name);
Plant.setRefineScenario = (name) => Plant.simulate("refining", name);
Plant.setConcheScenario = (name) => Plant.simulate("conching", name);
Plant.setMouldScenario = (name) => Plant.simulate("moulding", name);

Plant.resetReject = function resetReject() {
  Plant.state.rejectCount = 0;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
}

/* Operator clears the jam at the machine; Line 3 stays HELD until Unhold. */
Plant.clearCartonerJam = function clearCartonerJam() {
  if (Plant.state.packScenario === "jam") {
    Plant.state.packScenario = null;
    Plant.logEvent?.({ kind: "op", area: "Packaging", text: "CT-620 jam cleared at the machine" });
  }
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.recoverAll = function recoverAll() {
  Plant.state.packScenario = null;
  Plant.state.mixScenario = null;
  Plant.state.temperScenario = null;
  Plant.state.refineScenario = null;
  Plant.state.concheScenario = null;
  Plant.state.mouldScenario = null;
  Plant.state.units = Plant.defaultUnits(Plant.tick);
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.resetLine = function resetLine() {
  Plant.state = Plant.defaultState();
  Plant.trends = {};
  Plant.pvState = {};
  Plant.noiseState = {};
  Plant.saveState();
  Plant.tick = 0;
  Plant.treeBuilt = false;
  Plant.pidBuilt = false;
  Plant.clearPidHover();
  Plant.computeLive();
  Plant.renderAll();
  Plant.syncHash(Plant.state.activeDrawing);
}
