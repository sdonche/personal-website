import { Plant } from "./ns.js?v=c600f295ec";


Plant.computeLive = function computeLive() {
  const jam = Plant.state.packScenario === "jam";
  const mixOver = Plant.state.mixScenario === "overtemp";
  const mixValve = Plant.state.mixScenario === "valve";
  const mixFault = mixOver || mixValve;
  const temperWarm = Plant.state.temperScenario === "warm";
  const temperDrive = Plant.state.temperScenario === "drive";
  const refinePressure = Plant.state.refineScenario === "pressure";
  const refineParticle = Plant.state.refineScenario === "particle";
  const concheOver = Plant.state.concheScenario === "overtemp";
  const concheAgit = Plant.state.concheScenario === "agitator";
  const mouldJam = Plant.state.mouldScenario === "jam";
  const mouldCool = Plant.state.mouldScenario === "cool";
  /* The fault flags above are process conditions (what the sensors see); whether a
     unit produces follows its commanded ISA-88 / PackML state (units.js). A unit
     upstream that isn't running starves everything after it on the mass path. */
  const pkgDown = !Plant.unitRunning("Packaging");
  const feedStarved = Plant.unitStarved("Packaging");
  const lineOk = !pkgDown && !feedStarved;
  /* Batch pipeline: every area holds its own batch and batches advance one area
     every 15 ticks, so area i holds B-(1400 + ⌊tick/15⌋ − i). The batch trail
     follows one batch through all six areas (every 6th batch). */
  const batchPhase = Plant.tick % 90;
  const pipe = Math.floor(Plant.tick / 15);
  const areaBatch = (i) => `B-${1400 + pipe - i}`;
  const trackedBatch = `B-${1400 + 6 * Math.floor(Plant.tick / 90)}`;
  const batchId = areaBatch(5); // Packaging / Line3

  /* Line 3 runs at the line's mass rate: Moulding makes 18 moulds/min × 8 bars
     of 100 g = 144 bars/min → 36 cartons of 4 bars (≈ 865 kg/h), 12 cartons
     per case → 3 cases/min, 60 cases per pallet → a pallet every 20 min. */
  const speedSp = Plant.spValue("SpeedSP");
  const cartonerSpeed = pkgDown ? 0 : feedStarved ? Plant.drift(11, 1.5, 1) : Plant.drift(36, 0.9, 1);
  const infeedSpeed = feedStarved ? Plant.drift(4, 1.2, 2) : jam ? Plant.drift(22, 3, 2) : pkgDown ? 0 : Plant.drift(28, 1.5, 2);
  const caseSpeed = cartonerSpeed / 12;
  const oee = pkgDown ? Plant.drift(42, 2, 0) : feedStarved ? Plant.drift(61, 2.5, 0) : Plant.drift(87.4, 1.2, 0);
  const throughput = cartonerSpeed;
  const weight = pkgDown ? 0 : Plant.drift(0.452, 0.008, 5);

  if (lineOk && Math.random() < 0.08) Plant.state.rejectCount += 1;
  if (lineOk && Math.random() < 0.03) Plant.state.underCount += 1;
  if (lineOk && Math.random() < 0.015) Plant.state.overCount += 1;
  if (lineOk && Plant.tick % 20 === 0) Plant.state.palletsDone += 1;

  const photoIn = !feedStarved && Math.random() > 0.15;
  const photoOut = lineOk && Math.random() > 0.25;
  const rejectActive = !lineOk ? false : Math.random() < 0.04;
  // Line 3 follows PackML: internal fault → HELD, starved from upstream → SUSPENDED
  const pkgState = Plant.unitState("Packaging");
  const pkgQ = jam ? "Bad" : feedStarved ? "Uncertain" : "Good";

  Plant.live = {
    Running: { value: lineOk, quality: pkgQ },
    Mode: { value: "PRODUCTION", quality: "Good" }, // PackML unit mode
    State: { value: pkgState, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    OEE: { value: Plant.clamp(oee, 0, 100), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    Throughput: { value: Math.max(0, throughput), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    SpeedSP: { value: speedSp, quality: "Good" },
    BatchId: { value: batchId, quality: "Good" },

    "Infeed/Running": { value: !feedStarved, quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Speed": { value: Math.max(0, infeedSpeed), quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Jam": { value: false, quality: "Good" },
    "Infeed/Photoeye": { value: photoIn, quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Starved": { value: feedStarved, quality: feedStarved ? "Uncertain" : "Good" },

    "Cartoner/Running": { value: lineOk, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/Jam": { value: jam, quality: jam ? "Bad" : "Good" },
    "Cartoner/CartonsPerMin": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/FaultCode": { value: jam ? 41 : 0, quality: jam ? "Bad" : "Good" },

    "Checkweigher/Running": { value: !pkgDown, quality: feedStarved ? "Uncertain" : "Good" },
    "Checkweigher/WeightKg": { value: Math.max(0, weight), quality: "Good" },
    "Checkweigher/InSpec": { value: !rejectActive && !pkgDown, quality: "Good" },
    "Checkweigher/UnderCount": { value: Plant.state.underCount, quality: "Good" },
    "Checkweigher/OverCount": { value: Plant.state.overCount, quality: "Good" },

    "Checkweigher/Reject/Count": { value: Plant.state.rejectCount, quality: "Good" },
    "Checkweigher/Reject/Active": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },
    "Checkweigher/Reject/Divert": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },

    "CasePacker/Running": { value: lineOk, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/CasesPerMin": { value: Math.max(0, caseSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/Jam": { value: false, quality: "Good" },

    "Palletizer/Running": { value: lineOk, quality: feedStarved ? "Uncertain" : "Good" },
    "Palletizer/Layers": { value: pkgDown ? 0 : Math.floor(((Plant.tick / 6) % 8) + 1), quality: "Good" },
    "Palletizer/PalletsDone": { value: Plant.state.palletsDone, quality: "Good" },
    "Palletizer/Jam": { value: false, quality: "Good" },

    "Outfeed/Running": { value: lineOk, quality: feedStarved ? "Uncertain" : "Good" },
    "Outfeed/Occupied": { value: photoOut, quality: "Good" },
    "Outfeed/Photoeye": { value: photoOut, quality: "Good" },
  };

  Plant.STUB_LINES.forEach((line) => {
    const oeeS = Plant.clamp(Plant.drift(line.oeeBase, 1.4, line.phase), 0, 100);
    const thru = Math.max(0, Plant.drift(line.thruBase, 2.2, line.phase + 2));
    const infeed = Math.max(0, Plant.drift(24 + line.phase * 0.1, 1.4, line.phase + 4));
    const photo = Math.random() > 0.18;
    const occ = Math.random() > 0.3;
    const p = `${line.id}/`;
    Plant.live[`${p}Running`] = { value: true, quality: "Good" };
    Plant.live[`${p}Mode`] = { value: "PRODUCTION", quality: "Good" };
    Plant.live[`${p}State`] = { value: "EXECUTE", quality: "Good" };
    Plant.live[`${p}OEE`] = { value: oeeS, quality: "Good" };
    Plant.live[`${p}Throughput`] = { value: thru, quality: "Good" };
    Plant.live[`${p}SpeedSP`] = { value: line.speedSp, quality: "Good" };
    Plant.live[`${p}Infeed/Running`] = { value: true, quality: "Good" };
    Plant.live[`${p}Infeed/Speed`] = { value: infeed, quality: "Good" };
    Plant.live[`${p}Infeed/Photoeye`] = { value: photo, quality: "Good" };
    Plant.live[`${p}Outfeed/Running`] = { value: true, quality: "Good" };
    Plant.live[`${p}Outfeed/Occupied`] = { value: occ, quality: "Good" };
  });

  /* Mixing — weigh-dosed batch mixer on load cells. One batch every 30 min:
     DOSE (10 min: 260 kg cocoa liquor + 180 kg sugar) → MIX (15) → DISCHARGE (5)
     into the refiner feed buffer, i.e. 440 kg / 30 min ≈ 880 kg/h. The sequence
     runs on the unit's own clock, so it freezes while the unit is held; a stuck
     liquor valve holds the batch in DOSE. After a Reset the mixer is empty. */
  const mixRun = Plant.unitRunning("Mixing");
  const mixDown = !mixRun;
  const mixSt = Plant.unitState("Mixing");
  const mixEmpty = mixSt === "IDLE" || mixSt === "STOPPED";
  const mt = Plant.unit("Mixing").clock % 30;
  const mixPhase = mixEmpty ? "IDLE" : mixValve ? "DOSE" : mt < 10 ? "DOSE" : mt < 25 ? "MIX" : "DISCHARGE";
  const doseFrac = mixEmpty ? 0 : mixPhase === "DOSE" ? (mixValve ? 1 : (mt + 1) / 10) : 1;
  const liquorKg = mixValve ? 0 : 260 * doseFrac;
  const sugarKg = 180 * doseFrac;
  const batchKg = liquorKg + sugarKg;
  const mixWeight = mixPhase === "DISCHARGE" ? batchKg * (1 - (mt - 24) / 5) : batchKg + Plant.drift(0, 1.5, 7);
  const dosing = mixPhase === "DOSE" && !mixValve && !mixDown;
  const cocoaOpen = dosing;
  const sugarOpen = dosing;
  const outletOpen = mixPhase === "DISCHARGE" && !mixDown;
  // Controlled loops track the setpoint in force (operator writes via the faceplate)
  const jacketSp = Plant.spValue("Mixing/Mixer1/JacketTempSP");
  const jacket = mixOver ? Plant.clamp(Plant.drift(62, 1.5, 8), 58, 68) : Plant.clamp(Plant.drift(jacketSp, 0.6, 8), jacketSp - 4.5, jacketSp + 6.5);
  const massT = mixOver ? Plant.clamp(Plant.drift(58, 1.2, 9), 54, 64) : Plant.clamp(Plant.drift(jacketSp - 2.3, 0.5, 9), jacketSp - 8.5, jacketSp + 3.5);
  const rpm = mixEmpty ? 0 : mixDown ? Plant.clamp(Plant.drift(8, 2, 10), 0, 15)
    : mixPhase === "MIX" ? Plant.clamp(Plant.drift(42, 2, 10), 30, 55) : Plant.clamp(Plant.drift(24, 2, 10), 15, 35);
  const cocoaFlow = cocoaOpen ? Math.max(0, Plant.drift(1560, 40, 11)) : 0;
  const sugarFlow = sugarOpen ? Math.max(0, Plant.drift(1080, 30, 12)) : 0;
  const mixOutFlow = outletOpen ? Math.max(0, Plant.drift(5280, 120, 13)) : 0;
  const mixState = mixSt;
  const mixQ = mixOver ? "Bad" : mixValve ? "Uncertain" : "Good";
  Plant.live["Mixing/Running"] = { value: mixRun, quality: mixQ };
  Plant.live["Mixing/Mode"] = { value: "AUTO", quality: "Good" };
  Plant.live["Mixing/State"] = { value: mixState, quality: mixQ };
  Plant.live["Mixing/BatchId"] = { value: areaBatch(0), quality: "Good" };
  Plant.live["Mixing/Mixer1/Running"] = { value: mixRun, quality: mixQ };
  Plant.live["Mixing/Mixer1/Phase"] = { value: mixPhase, quality: mixQ };
  Plant.live["Mixing/Mixer1/WeightKg"] = { value: Math.max(0, mixWeight), quality: mixValve ? "Uncertain" : "Good" };
  Plant.live["Mixing/Mixer1/JacketTempSP"] = { value: jacketSp, quality: "Good" };
  Plant.live["Mixing/CocoaLiquor/DosedKg"] = { value: liquorKg, quality: mixValve ? "Bad" : "Good" };
  Plant.live["Mixing/Sugar/DosedKg"] = { value: sugarKg, quality: "Good" };
  Plant.live["Mixing/Mixer1/AgitatorRpm"] = { value: rpm, quality: mixFault ? "Uncertain" : "Good" };
  Plant.live["Mixing/Mixer1/JacketTempC"] = { value: jacket, quality: mixOver ? "Bad" : jacket > 52 ? "Uncertain" : "Good" };
  Plant.live["Mixing/Mixer1/MassTempC"] = { value: massT, quality: mixOver ? "Bad" : "Good" };
  Plant.live["Mixing/CocoaLiquor/ValveOpen"] = { value: cocoaOpen, quality: mixValve ? "Bad" : "Good" };
  Plant.live["Mixing/CocoaLiquor/FlowKgH"] = { value: cocoaFlow, quality: mixValve ? "Bad" : "Good" };
  Plant.live["Mixing/Sugar/ValveOpen"] = { value: sugarOpen, quality: "Good" };
  Plant.live["Mixing/Sugar/FlowKgH"] = { value: sugarFlow, quality: "Good" };
  Plant.live["Mixing/Outlet/ValveOpen"] = { value: outletOpen, quality: mixFault ? "Uncertain" : "Good" };
  Plant.live["Mixing/Outlet/FlowKgH"] = { value: mixOutFlow, quality: mixFault ? "Bad" : "Good" };
  Plant.live["Mixing/Drain/ValveOpen"] = { value: false, quality: "Good" };

  /* Refining — inlet tracks Mixing mass out; local pressure/particle scenarios. */
  // refineStarve keeps its old meaning for the qualities: no feed, from upstream or the pressure loss
  const refineUp = Plant.unitStarved("Refining");
  const refineStarve = refineUp || refinePressure;
  const refineRun = Plant.unitProducing("Refining");
  const refineLoad = refineParticle
    ? Plant.clamp(Plant.drift(48, 3, 23), 35, 58)
    : !refineRun
      ? Plant.clamp(Plant.drift(12, 3, 23), 0, 25)
      : Plant.clamp(Plant.drift(62, 3.5, 23), 45, 78);
  const particleSp = Plant.spValue("Refining/Refiner1/ParticleSP");
  const particle = refineParticle
    ? Plant.clamp(Plant.drift(42, 2.5, 24), 34, 52)
    : !refineRun
      ? Plant.clamp(Plant.drift(particleSp + 2, 1, 24), particleSp - 2, particleSp + 6)
      : Plant.clamp(Plant.drift(particleSp, 1.2, 24), particleSp - 4, particleSp + 6);
  const refineInOpen = refineRun;
  const refineOutOpen = refineRun;
  // Fed continuously from the refiner feed buffer that the batch mixer discharges into
  const refineInFlow = refineRun ? Math.max(0, Plant.drift(880, 18, 25)) : 0;
  /* Particle HOLD zeros outlet so downstream Modes go STARVED. */
  const refineOutFlow = refineRun ? Math.max(0, refineInFlow * 0.99 + Plant.drift(0, 8, 26)) : 0;
  const rollTemp = refinePressure ? Plant.clamp(Plant.drift(31, 0.8, 46), 26, 36) : Plant.clamp(Plant.drift(38, 0.5, 46), 34, 42);
  const rollPressure = refinePressure
    ? Plant.clamp(Plant.drift(8, 1.5, 47), 2, 14)
    : !refineRun
      ? Plant.clamp(Plant.drift(18, 2, 47), 10, 25)
      : Plant.clamp(Plant.drift(42, 2.5, 47), 32, 52);
  const hydPressure = refinePressure
    ? Plant.clamp(Plant.drift(28, 4, 48), 12, 40)
    : !refineRun
      ? Plant.clamp(Plant.drift(88, 3, 48), 72, 100)
      : Plant.clamp(Plant.drift(118, 4, 48), 100, 135);
  const refineState = Plant.unitState("Refining");
  const refineQ = refinePressure ? "Bad" : refineParticle || refineStarve ? "Uncertain" : "Good";
  Plant.live["Refining/Running"] = { value: refineRun, quality: refineQ };
  Plant.live["Refining/Mode"] = { value: "AUTO", quality: "Good" };
  Plant.live["Refining/State"] = { value: refineState, quality: refineQ };
  Plant.live["Refining/BatchId"] = { value: areaBatch(1), quality: "Good" };
  Plant.live["Refining/Refiner1/Running"] = { value: refineRun, quality: refineQ };
  Plant.live["Refining/Refiner1/LoadPct"] = { value: refineLoad, quality: refineStarve || refineParticle ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/ParticleSP"] = { value: particleSp, quality: "Good" };
  Plant.live["Refining/Refiner1/RollTempC"] = { value: rollTemp, quality: refinePressure ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/ParticleUm"] = { value: particle, quality: refineParticle ? "Bad" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/RollPressureBar"] = { value: rollPressure, quality: refinePressure ? "Bad" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Inlet/ValveOpen"] = { value: refineInOpen, quality: refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Inlet/FlowKgH"] = { value: Math.max(0, refineInFlow), quality: refineStarve ? "Bad" : "Good" };
  Plant.live["Refining/Outlet/ValveOpen"] = { value: refineOutOpen, quality: refinePressure || refineParticle ? "Uncertain" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Outlet/FlowKgH"] = { value: Math.max(0, refineOutFlow), quality: refineStarve || refinePressure || refineParticle ? "Bad" : "Good" };
  Plant.live["Refining/Hydraulic/PressureBar"] = { value: hydPressure, quality: refinePressure ? "Bad" : refineStarve ? "Uncertain" : "Good" };

  /* Conching — inlet from refining outlet; local overtemp/agitator scenarios. */
  const concheStarve = Plant.unitStarved("Conching");
  const concheRun = Plant.unitProducing("Conching");
  const concheSt = Plant.unitState("Conching");
  const concheEmpty = concheSt === "IDLE" || concheSt === "STOPPED";
  /* Conche1 runs a 6.5 h batch (one tick = one plant minute): FILL 90 min at the
     refiner's rate (≈1.3 t) → DRY 120 → PASTY 90 → LIQUEFY 60 → EMPTY 30 to the
     storage tank that feeds Tempering. The refiner fills the other conches
     while Conche1 is not in FILL. */
  const ct = Plant.unit("Conching").clock % 390;
  const conchePhase = concheEmpty ? "IDLE" : ct < 90 ? "FILL" : ct < 210 ? "DRY" : ct < 300 ? "PASTY" : ct < 360 ? "LIQUEFY" : "EMPTY";
  // Recipe SP per phase; an operator override holds until the phase changes
  const concheSpTag = "Conching/Conche1/TempSP";
  if (Plant.state.sp[concheSpTag] != null && Plant.state.spPhase[concheSpTag] !== conchePhase) {
    delete Plant.state.sp[concheSpTag];
    Plant.logEvent?.({ kind: "sys", area: "Conching", text: `TIC-310 override released — recipe SP for ${conchePhase}` });
  }
  const concheSp = Plant.spValue(concheSpTag, { IDLE: 55, FILL: 55, DRY: 70, PASTY: 74, LIQUEFY: 65, EMPTY: 60 }[conchePhase]);
  const concheTemp = concheOver
    ? Plant.clamp(Plant.drift(82, 1.8, 27), 76, 90)
    : concheStarve || concheEmpty
      ? Plant.clamp(Plant.drift(48, 1.5, 27), 40, 55)
      : Plant.clamp(Plant.drift(concheSp, 0.6, 27), concheSp - 4, concheSp + 4);
  const concheRpmBase = { IDLE: 0, FILL: 20, DRY: 32, PASTY: 18, LIQUEFY: 36, EMPTY: 24 }[conchePhase];
  const concheRpm = concheAgit
    ? Plant.clamp(Plant.drift(2, 1, 28), 0, 5)
    : concheEmpty ? 0 : !concheRun
      ? Plant.clamp(Plant.drift(6, 2, 28), 0, 12)
      : Plant.clamp(Plant.drift(concheRpmBase, 1.5, 28), 10, 45);
  // Motor load peaks in the pasty phase (thick mass), trips out on an agitator stall
  const powerBase = { IDLE: 2, FILL: 26, DRY: 40, PASTY: 56, LIQUEFY: 33, EMPTY: 18 }[conchePhase];
  const conchePower = concheAgit ? Plant.clamp(Plant.drift(3, 1, 45), 0, 6)
    : !concheRun ? Plant.clamp(Plant.drift(concheEmpty ? 2 : 8, 2, 45), 0, 14)
      : Plant.clamp(Plant.drift(powerBase, 2, 45), 10, 70);
  const concheTime = ct / 60; // hours into this batch
  const concheInOpen = concheRun && conchePhase === "FILL";
  const concheOutOpen = concheRun && conchePhase === "EMPTY";
  const concheInFlow = concheInOpen ? Math.max(0, refineOutFlow * 0.99 + Plant.drift(0, 10, 29)) : 0;
  const conchOutFlow = concheOutOpen ? Math.max(0, Plant.drift(2600, 60, 30)) : 0;
  const jacketSupply = concheOver
    ? Plant.clamp(Plant.drift(68, 1.5, 49), 60, 78)
    : concheStarve
      ? Plant.clamp(Plant.drift(42, 1.2, 49), 35, 50)
      : Plant.clamp(Plant.drift(55, 1.0, 49), 48, 62);
  const jacketFlow = concheStarve ? Plant.clamp(Plant.drift(0.4, 0.15, 50), 0, 0.8) : Plant.clamp(Plant.drift(2.4, 0.2, 50), 1.6, 3.2);
  const concheState = concheSt;
  const concheQ = concheOver ? "Bad" : concheAgit || concheStarve ? "Uncertain" : "Good";
  Plant.live["Conching/Running"] = { value: concheRun, quality: concheQ };
  Plant.live["Conching/Mode"] = { value: "AUTO", quality: "Good" };
  Plant.live["Conching/State"] = { value: concheState, quality: concheQ };
  Plant.live["Conching/BatchId"] = { value: areaBatch(2), quality: "Good" };
  Plant.live["Conching/Conche1/Running"] = { value: concheRun, quality: concheQ };
  Plant.live["Conching/Conche1/Phase"] = { value: conchePhase, quality: concheQ };
  Plant.live["Conching/Conche1/TempSP"] = { value: concheSp, quality: "Good" };
  Plant.live["Conching/Conche1/PowerKw"] = { value: conchePower, quality: concheAgit ? "Bad" : concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Conche1/TempC"] = { value: concheTemp, quality: concheOver ? "Bad" : concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Conche1/AgitatorRpm"] = { value: concheRpm, quality: concheAgit ? "Bad" : concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Conche1/BatchTimeH"] = { value: concheTime, quality: "Good" };
  Plant.live["Conching/Inlet/ValveOpen"] = { value: concheInOpen, quality: concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Inlet/FlowKgH"] = { value: Math.max(0, concheInFlow), quality: concheStarve ? "Bad" : "Good" };
  Plant.live["Conching/Outlet/ValveOpen"] = { value: concheOutOpen, quality: concheOver || concheAgit || concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Outlet/FlowKgH"] = { value: Math.max(0, conchOutFlow), quality: concheStarve || concheOver || concheAgit ? "Bad" : "Good" };
  Plant.live["Conching/Jacket/SupplyTempC"] = { value: jacketSupply, quality: concheOver ? "Bad" : concheStarve ? "Uncertain" : "Good" };
  Plant.live["Conching/Jacket/FlowM3H"] = { value: jacketFlow, quality: concheStarve ? "Uncertain" : "Good" };

  /* Tempering — temper machine zones; starve on mix / refine / conche cascade. */
  const temperStarve = Plant.unitStarved("Tempering");
  const temperRun = Plant.unitProducing("Tempering");
  const z1Sp = Plant.spValue("Tempering/Temper1/Zone1SP");
  const z2Sp = Plant.spValue("Tempering/Temper1/Zone2SP");
  const z3Sp = Plant.spValue("Tempering/Temper1/Zone3SP");
  const z1 = temperWarm ? Plant.clamp(Plant.drift(52, 0.9, 14), 48, 56) : Plant.clamp(Plant.drift(z1Sp, 0.8, 14), z1Sp - 3, z1Sp + 3);
  const z2 = temperWarm ? Plant.clamp(Plant.drift(36, 0.8, 15), 33, 40) : Plant.clamp(Plant.drift(z2Sp, 0.35, 15), z2Sp - 1.2, z2Sp + 1.2);
  const z3 = temperWarm ? Plant.clamp(Plant.drift(38, 0.7, 16), 35, 42) : Plant.clamp(Plant.drift(z3Sp + 0.5, 0.6, 16), z3Sp - 1.5, z3Sp + 2.5);
  const massOut = temperWarm ? Plant.clamp(Plant.drift(37, 0.6, 17), 34, 40) : Plant.clamp(Plant.drift(z3Sp, 0.5, 17), z3Sp - 2.5, z3Sp + 2.5);
  const screw = temperDrive ? 0 : !temperRun ? Plant.clamp(Plant.drift(2.5, 0.6, 18), 0.5, 4.5) : Plant.clamp(Plant.drift(18, 1.2, 18), 12, 26);
  const inOpen = temperRun;
  const outOpen = temperRun;
  // Drawn continuously from the storage tank that the conches empty into
  const inFlow = temperRun ? Math.max(0, Plant.drift(875, 15, 19)) : 0;
  // Temper index (temper meter slope): 4–6 is well tempered; warm zones under-temper
  const temperIndex = temperWarm ? Plant.clamp(Plant.drift(2.4, 0.3, 44), 1.5, 3.4)
    : temperStarve ? Plant.clamp(Plant.drift(4.6, 0.3, 44), 3.5, 5.5)
      // A warmer cooling zone grows fewer stable crystals: the temper index drops
      : Plant.clamp(Plant.drift(5.1 - 1.1 * (z2Sp - 28) - 0.4 * (z3Sp - 31.5), 0.25, 44), 1.5, 6.8);
  const tOutFlow = temperRun ? Math.max(0, inFlow * 0.98 + Plant.drift(0, 15, 20)) : 0;
  const cwFlow = Plant.clamp(Plant.drift(temperWarm ? 8 : 12.5, 0.8, 21), 6, 18);
  const cwSupply = Plant.clamp(Plant.drift(temperWarm ? 9.5 : 6.5, 0.4, 22), 4, 11);
  const temperState = Plant.unitState("Tempering");
  const temperQ = temperWarm ? "Bad" : temperDrive || temperStarve ? "Uncertain" : "Good";
  Plant.live["Tempering/Running"] = { value: temperRun, quality: temperQ };
  Plant.live["Tempering/Mode"] = { value: "AUTO", quality: "Good" };
  Plant.live["Tempering/State"] = { value: temperState, quality: temperQ };
  Plant.live["Tempering/BatchId"] = { value: areaBatch(3), quality: "Good" };
  Plant.live["Tempering/Temper1/Running"] = { value: temperRun, quality: temperQ };
  Plant.live["Tempering/Temper1/ScrewRpm"] = { value: screw, quality: temperDrive ? "Bad" : temperStarve ? "Uncertain" : "Good" };
  Plant.live["Tempering/Temper1/Zone1TempC"] = { value: z1, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Temper1/Zone2TempC"] = { value: z2, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Temper1/Zone3TempC"] = { value: z3, quality: temperWarm ? "Bad" : "Good" };
  // 4–6 is well tempered; outside it the reading is flagged for the QA check
  Plant.live["Tempering/Temper1/TemperIndex"] = { value: temperIndex, quality: temperWarm ? "Bad" : temperStarve || temperIndex < 4 || temperIndex > 6 ? "Uncertain" : "Good" };
  Plant.live["Tempering/Temper1/Zone1SP"] = { value: z1Sp, quality: "Good" };
  Plant.live["Tempering/Temper1/Zone2SP"] = { value: z2Sp, quality: "Good" };
  Plant.live["Tempering/Temper1/Zone3SP"] = { value: z3Sp, quality: "Good" };
  Plant.live["Tempering/Temper1/MassTempC"] = { value: massOut, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Inlet/ValveOpen"] = { value: inOpen, quality: temperStarve ? "Uncertain" : "Good" };
  Plant.live["Tempering/Inlet/FlowKgH"] = { value: Math.max(0, inFlow), quality: temperStarve ? "Bad" : "Good" };
  Plant.live["Tempering/Outlet/ValveOpen"] = { value: outOpen, quality: temperDrive || temperWarm ? "Uncertain" : "Good" };
  Plant.live["Tempering/Outlet/FlowKgH"] = { value: Math.max(0, tOutFlow), quality: temperDrive || temperWarm || temperStarve ? "Bad" : "Good" };
  Plant.live["Tempering/ChilledWater/FlowM3H"] = { value: cwFlow, quality: temperWarm ? "Uncertain" : "Good" };
  Plant.live["Tempering/ChilledWater/SupplyTempC"] = { value: cwSupply, quality: temperWarm ? "Uncertain" : "Good" };

  /* Moulding — inlet from tempering; local jam / cool-air scenarios. */
  const mouldStarve = Plant.unitStarved("Moulding");
  const mouldRun = Plant.unitProducing("Moulding");
  const cycles = !Plant.unitRunning("Moulding")
    ? 0
    : mouldStarve
      ? Plant.clamp(Plant.drift(3, 1.2, 31), 0, 6)
      : Plant.clamp(Plant.drift(18, 1.5, 31), 12, 24);
  // Moulds are pre-warmed just below the tempered mass (~28 °C); they cool when idle
  const mouldTemp = !mouldRun && !mouldCool ? Plant.clamp(Plant.drift(24.5, 0.6, 32), 21, 27) : Plant.clamp(Plant.drift(28, 0.4, 32), 26, 30);
  const airSp = Plant.spValue("Moulding/Cooling/AirTempSP");
  const airTemp = mouldCool
    ? Plant.clamp(Plant.drift(22, 1.2, 33), 18, 28)
    : mouldStarve
      ? Plant.clamp(Plant.drift(airSp + 2, 0.8, 33), airSp - 1, airSp + 4)
      : Plant.clamp(Plant.drift(airSp, 0.5, 33), airSp - 3, airSp + 3);
  const mouldInOpen = mouldRun;
  const mouldOutOpen = mouldRun;
  const mouldInFlow = mouldRun ? Math.max(0, tOutFlow * 0.98 + Plant.drift(0, 14, 34)) : 0;
  const mouldOutFlow = mouldRun ? Math.max(0, mouldInFlow * 0.99 + Plant.drift(0, 12, 35)) : 0;
  const mouldState = Plant.unitState("Moulding");
  const mouldQ = mouldJam ? "Bad" : mouldCool || mouldStarve ? "Uncertain" : "Good";
  Plant.live["Moulding/Running"] = { value: mouldRun, quality: mouldQ };
  Plant.live["Moulding/Mode"] = { value: "PRODUCTION", quality: "Good" };
  Plant.live["Moulding/State"] = { value: mouldState, quality: mouldQ };
  Plant.live["Moulding/BatchId"] = { value: areaBatch(4), quality: "Good" };
  Plant.live["Moulding/Moulder1/Running"] = { value: mouldRun, quality: mouldQ };
  Plant.live["Moulding/Moulder1/CyclesPerMin"] = { value: cycles, quality: mouldJam ? "Bad" : mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Moulder1/MouldTempC"] = { value: mouldTemp, quality: mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Inlet/ValveOpen"] = { value: mouldInOpen, quality: mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Inlet/FlowKgH"] = { value: Math.max(0, mouldInFlow), quality: mouldStarve ? "Bad" : "Good" };
  Plant.live["Moulding/Outlet/ValveOpen"] = { value: mouldOutOpen, quality: mouldJam || mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Outlet/FlowKgH"] = { value: Math.max(0, mouldOutFlow), quality: mouldJam || mouldStarve ? "Bad" : "Good" };
  Plant.live["Moulding/Cooling/AirTempSP"] = { value: airSp, quality: "Good" };
  Plant.live["Moulding/Cooling/AirTempC"] = { value: airTemp, quality: mouldCool ? "Bad" : mouldStarve ? "Uncertain" : "Good" };

  /* Heuvelland site meta — worst area state wins: FAULT > HOLD > STARVED > AUTO. */
  const health = Plant.PLANT_AREAS.map((a) => Plant.areaHealth(a.drawing));
  const siteFault = health.includes("fault");
  const siteHold = health.includes("hold");
  const plantMode = siteFault ? "FAULT" : siteHold ? "HOLD" : feedStarved ? "STARVED" : "AUTO";
  const contactStamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  // Site Running = the site is shipping product (Line3 producing)
  Plant.live[`${Plant.SITE}/Running`] = { value: lineOk, quality: siteFault ? "Bad" : feedStarved ? "Uncertain" : "Good" };
  Plant.live[`${Plant.SITE}/Mode`] = { value: plantMode, quality: siteFault ? "Bad" : feedStarved ? "Uncertain" : "Good" };
  Plant.live[`${Plant.SITE}/OEE`] = { value: oee, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" };
  Plant.live[`${Plant.SITE}/LastContact`] = { value: contactStamp, quality: "Good" };

  /* Sister spark: one offline site flaps live for ~8s every ~50s. */
  const sparkWindow = 50;
  const sparkHold = 8;
  const sparkActive = Plant.tick % sparkWindow < sparkHold;
  const sparkSite = sparkActive ? Plant.SISTER_SITES[Math.floor(Plant.tick / sparkWindow) % Plant.SISTER_SITES.length] : null;
  Plant.SISTER_SITES.forEach((site) => {
    if (site === sparkSite) {
      const sparkOee = Plant.clamp(Plant.drift(72, 2.5, 60), 60, 85);
      Plant.live[`${site}/Running`] = { value: true, quality: "Good" };
      Plant.live[`${site}/Mode`] = { value: "AUTO", quality: "Good" };
      Plant.live[`${site}/OEE`] = { value: sparkOee, quality: "Uncertain" };
      Plant.live[`${site}/LastContact`] = { value: contactStamp, quality: "Good" };
      Plant.live[`${site}/Mixing/Running`] = { value: true, quality: "Good" };
      Plant.live[`${site}/Mixing/Mode`] = { value: "AUTO", quality: "Uncertain" };
      Plant.live[`${site}/Packaging/Running`] = { value: true, quality: "Good" };
      Plant.live[`${site}/Packaging/OEE`] = { value: sparkOee, quality: "Uncertain" };
    } else {
      Plant.live[`${site}/Running`] = { value: false, quality: "Stale" };
      Plant.live[`${site}/Mode`] = { value: "OFFLINE", quality: "Stale" };
      Plant.live[`${site}/OEE`] = { value: Plant.SISTER_LAST_OEE[site], quality: "Stale" };
      Plant.live[`${site}/LastContact`] = { value: Plant.SISTER_LAST_CONTACT[site], quality: "Stale" };
      Plant.live[`${site}/Mixing/Running`] = { value: false, quality: "Stale" };
      Plant.live[`${site}/Mixing/Mode`] = { value: "OFFLINE", quality: "Stale" };
      Plant.live[`${site}/Packaging/Running`] = { value: false, quality: "Stale" };
      Plant.live[`${site}/Packaging/OEE`] = { value: Plant.SISTER_LAST_OEE[site], quality: "Stale" };
    }
  });
  Plant.live.__sparkSite = { value: sparkSite, quality: "Good" };
  Plant.live.__batchPhase = { value: batchPhase, quality: "Good" };
  Plant.live.__trackedBatch = { value: trackedBatch, quality: "Good" };

  Plant.applyProcessLag();

  Plant.syncScenarioAlarms();
  Plant.recordTrends();
}

/* Historian: one sample per plant minute. A recompute within the same minute
   (an operator action) overwrites that minute's sample, so the time axis holds. */
Plant.recordTrends = function recordTrends() {
  const sameMinute = Plant.trendTick === Plant.tick;
  Plant.trendTick = Plant.tick;
  for (const def of Plant.ALL_TAGS) {
    if (def.type !== "number") continue;
    const lv = Plant.live[def.id];
    if (!lv || typeof lv.value !== "number" || !Number.isFinite(lv.value)) continue;
    const buf = Plant.trends[def.id] || (Plant.trends[def.id] = []);
    if (sameMinute && buf.length) buf[buf.length - 1] = lv.value;
    else buf.push(lv.value);
    if (buf.length > Plant.TREND_LEN) buf.splice(0, buf.length - Plant.TREND_LEN);
  }
}

/* Alarm engine (ISA-18.2 lifecycle)
   · analog alarms come from the PV crossing its limit (Plant.ALARM_ANALOG),
     discrete ones from equipment states; messages record the value at activation
   · a cleared alarm that nobody acknowledged stays listed as RTN (returned to
     normal), unacknowledged, until it is acknowledged
   · starve alarms downstream of a held area are low-priority consequential
     alarms, suppressed while their root cause is annunciated
   · shelved alarms are hidden for one plant hour */
Plant.syncScenarioAlarms = function syncScenarioAlarms() {
  const S = Plant.state;
  const want = new Map();
  const add = (w) => want.set(w.id, w);

  for (const def of Plant.ALARM_ANALOG) {
    const v = Plant.live[def.tag]?.value;
    if (typeof v !== "number") continue;
    const active = S.alarms.some((a) => a.id === def.id && !a.rtn);
    const beyond = def.dir === "HI" ? v > def.limit : v < def.limit;
    const holding = active && (def.dir === "HI" ? v > def.limit - def.db : v < def.limit + def.db);
    if (!beyond && !holding) continue;
    const tagDef = Plant.TAG_BY_ID[def.tag];
    const f = (x) => Plant.formatValue(tagDef, x);
    add({
      id: def.id, area: def.area, severity: def.severity, path: Plant.pathOf(def.tag),
      message: `${def.isa} ${def.desc} ${def.dir} — ${f(v)} (limit ${f(def.limit)})`,
    });
  }

  if (S.packScenario === "jam") add({ id: "alm-cartoner-jam", area: "Packaging", severity: "critical", path: Plant.pathOf("Cartoner/Jam"), message: "CT-620 cartoner jam — fault code 41, infeed backing up" });
  if (S.packScenario === "starved") add({ id: "alm-infeed-starved", area: "Packaging", severity: "warning", path: Plant.pathOf("Infeed/Starved"), message: "CV-610 infeed starved — no product at photoeye" });
  if (S.mixScenario === "valve") add({ id: "alm-mix-valve", area: "Mixing", severity: "warning", path: Plant.pathOf("Mixing/CocoaLiquor/ValveOpen"), message: "XV-101 cocoa liquor valve failed to open — dosing stopped" });
  if (S.concheScenario === "agitator") add({ id: "alm-conche-agitator", area: "Conching", severity: "warning", path: Plant.pathOf("Conching/Conche1/AgitatorRpm"), message: "Conche1 agitator motor tripped — overload" });
  if (S.temperScenario === "drive") add({ id: "alm-temper-drive", area: "Tempering", severity: "warning", path: Plant.pathOf("Tempering/Temper1/ScrewRpm"), message: "Temper1 screw drive stopped — VFD fault" });
  if (S.mouldScenario === "jam") add({ id: "alm-mould-jam", area: "Moulding", severity: "critical", path: Plant.pathOf("Moulding/Moulder1/CyclesPerMin"), message: "MD-500 moulder jam — bars not releasing" });

  // Consequential: every area downstream of a held area, naming the first held one
  // An area counts as the source only once its own (root) alarm is active, so
  // follow-on alarms never annunciate ahead of their cause
  const rootActive = (area) => [...want.values()].some((w) => w.area === area && !w.causedBy);
  const held = [
    ["Mixing", S.mixScenario != null && rootActive("Mixing")],
    ["Refining", S.refineScenario != null && rootActive("Refining")],
    ["Conching", S.concheScenario != null && rootActive("Conching")],
    ["Tempering", S.temperScenario != null && rootActive("Tempering")],
    ["Moulding", S.mouldScenario != null && rootActive("Moulding")],
  ];
  const sourceOf = (area) => {
    const i = held.findIndex(([name]) => name === area);
    const hit = held.slice(0, i < 0 ? held.length : i).find(([, h]) => h);
    return hit ? hit[0] : null;
  };
  [["Refining", "refine"], ["Conching", "conche"], ["Tempering", "temper"], ["Moulding", "mould"]].forEach(([area, key]) => {
    const src = sourceOf(area);
    if (src) add({ id: `alm-${key}-upstream`, area, causedBy: src, severity: "low", path: Plant.pathOf(`${area}/Inlet/FlowKgH`), message: `${area} starved — no mass from ${src}` });
  });
  const pkSrc = sourceOf("Packaging");
  if (pkSrc) add({ id: "alm-pack-upstream", area: "Packaging", causedBy: pkSrc, severity: "low", path: Plant.pathOf("Infeed/Starved"), message: `Line 3 starved — no bars from ${pkSrc}` });

  // Lifecycle: active → acked → cleared; cleared-but-unacked stays as RTN
  const tick = Plant.tick;
  const next = [];
  const toHistory = [];
  for (const a of S.alarms) {
    const w = want.get(a.id);
    if (w) {
      want.delete(a.id);
      // Returned and came back: a new occurrence that needs a new acknowledgement
      if (a.rtn) next.push({ ...w, acked: false, rtn: false, tick, ts: Date.now() });
      else next.push({ ...a, severity: w.severity, area: w.area, causedBy: w.causedBy });
    } else if (a.acked || Plant.isSuppressed(a)) {
      // Acknowledged, or cleared while suppressed by design (never shown): done
      toHistory.push({ ...a, rtn: true, clearedTick: tick, clearedTs: Date.now() });
    } else {
      next.push(a.rtn ? a : { ...a, rtn: true, rtnTick: tick });
    }
  }
  for (const w of want.values()) next.push({ ...w, acked: false, rtn: false, tick, ts: Date.now() });
  if (toHistory.length) S.alarmHistory = [...toHistory, ...(S.alarmHistory || [])].slice(0, 30);
  S.shelved = S.shelved || {};
  for (const [id, until] of Object.entries(S.shelved)) {
    if (until <= tick || !next.some((a) => a.id === id)) delete S.shelved[id];
  }
  const sig = next.map((a) => `${a.id}:${a.acked ? 1 : 0}${a.rtn ? 1 : 0}`).join(",") + "|" + Object.keys(S.shelved).join(",");
  if (sig !== Plant.alarmSig) Plant.alarmsDirty = true;
  Plant.alarmSig = sig;
  S.alarms = next;
}
