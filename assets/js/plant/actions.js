import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Actions ---------------- */

/* Simulate: inject or clear a fault condition on an area. Injecting latches the
   unit (units.js); clearing only removes the condition, the operator then
   brings the unit back with Restart / Unhold or Reset + Start. */
Plant.simulate = function simulate(drawing, name) {
  // Clear also brings back a failed transmitter in this area
  if (name === "recover" && Plant.sensorFailed(drawing)) Plant.toggleSensorFail(drawing, { quiet: true });
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

Plant.sensorFailed = function sensorFailed(drawing) {
  const sf = Plant.SENSOR_FAIL[drawing];
  return !!sf && Plant.state.sensorFail?.[sf.tag] != null;
}

/** Fail (or restore) the area's transmitter: value frozen at its last reading, quality Bad. */
Plant.toggleSensorFail = function toggleSensorFail(drawing, opts) {
  const sf = Plant.SENSOR_FAIL[drawing];
  if (!sf) return;
  const S = Plant.state;
  S.sensorFail = S.sensorFail || {};
  const area = Plant.UNIT_BY_DRAWING[drawing]?.area || "";
  if (S.sensorFail[sf.tag] != null) {
    delete S.sensorFail[sf.tag];
    Plant.logEvent({ kind: "sim", area, text: `SIM ${sf.isa} transmitter restored` });
  } else {
    const v = Plant.live[sf.tag]?.value;
    if (!Number.isFinite(v)) return;
    S.sensorFail[sf.tag] = v;
    Plant.logEvent({ kind: "sim", area, text: `SIM ${sf.isa} transmitter failed — value held at ${Plant.liveReadout(sf.tag)}` });
  }
  if (opts && opts.quiet) return;
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
}

Plant.setScenario = (name) => Plant.simulate("packaging", name);
Plant.setMixScenario = (name) => Plant.simulate("mixing", name);
Plant.setTemperScenario = (name) => Plant.simulate("tempering", name);
Plant.setRefineScenario = (name) => Plant.simulate("refining", name);
Plant.setConcheScenario = (name) => Plant.simulate("conching", name);
Plant.setMouldScenario = (name) => Plant.simulate("moulding", name);

Plant.resetReject = function resetReject() {
  Plant.logEvent({ kind: "op", area: "Packaging", text: `Reject counter reset (was ${Plant.state.rejectCount})` });
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
  Plant.state.sensorFail = {};
  // Every unit back to its run state; batch clocks carry on where they were
  for (const u of Plant.UNITS) Object.assign(Plant.unit(u.area), { st: Plant.runStateOf(u), next: null, why: null });
  Plant.logEvent({ kind: "sim", text: "SIM restore all — faults cleared, every unit back to running" });
  Plant.saveState();
  Plant.computeLive();
  Plant.renderAll();
  if (Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}

Plant.resetLine = function resetLine() {
  Plant.state = Plant.defaultState();
  Plant.tick = 0;
  Plant.logEvent({ kind: "sys", text: "Plant reset — new shift at 06:00" });
  Plant.trends = {};
  Plant.trendTick = null;
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
