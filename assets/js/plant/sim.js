import { Plant } from "./ns.js?v=c600f295ec";


Plant.computeLive = function computeLive() {
  const jam = Plant.state.packScenario === "jam";
  const starved = Plant.state.packScenario === "starved";
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
  /* Upstream hold starves packaging feed (shared chocolate mass path). */
  const upstreamHold = mixFault || temperDrive || temperWarm || refinePressure || refineParticle
    || concheOver || concheAgit || mouldJam || mouldCool;
  const lineOk = !jam && !starved && !upstreamHold;
  const feedStarved = starved || upstreamHold;
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
  const speedSp = Number(Plant.state.speedSp) > 0 ? Number(Plant.state.speedSp) : 38;
  const cartonerSpeed = jam ? 0 : feedStarved ? Plant.drift(11, 1.5, 1) : Plant.drift(36, 0.9, 1);
  const infeedSpeed = feedStarved ? Plant.drift(4, 1.2, 2) : jam ? Plant.drift(22, 3, 2) : Plant.drift(28, 1.5, 2);
  const caseSpeed = cartonerSpeed / 12;
  const oee = jam ? Plant.drift(42, 2, 0) : feedStarved ? Plant.drift(61, 2.5, 0) : Plant.drift(87.4, 1.2, 0);
  const throughput = cartonerSpeed;
  const weight = jam ? 0 : Plant.drift(0.452, 0.008, 5);

  if (lineOk && Math.random() < 0.08) Plant.state.rejectCount += 1;
  if (lineOk && Math.random() < 0.03) Plant.state.underCount += 1;
  if (lineOk && Math.random() < 0.015) Plant.state.overCount += 1;
  if (lineOk && Plant.tick % 20 === 0) Plant.state.palletsDone += 1;

  const photoIn = !feedStarved && Math.random() > 0.15;
  const photoOut = lineOk && Math.random() > 0.25;
  const rejectActive = !lineOk ? false : Math.random() < 0.04;
  const pkgMode = jam ? "FAULT" : feedStarved ? "STARVED" : "AUTO";
  const pkgQ = jam ? "Bad" : feedStarved ? "Uncertain" : "Good";

  Plant.live = {
    Running: { value: lineOk, quality: pkgQ },
    Mode: { value: pkgMode, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    OEE: { value: Plant.clamp(oee, 0, 100), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    Throughput: { value: Math.max(0, throughput), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    SpeedSP: { value: speedSp, quality: "Good" },
    BatchId: { value: batchId, quality: "Good" },

    "Infeed/Running": { value: !feedStarved, quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Speed": { value: Math.max(0, infeedSpeed), quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Jam": { value: false, quality: "Good" },
    "Infeed/Photoeye": { value: photoIn, quality: feedStarved ? "Uncertain" : "Good" },
    "Infeed/Starved": { value: feedStarved, quality: feedStarved ? "Uncertain" : "Good" },

    "Cartoner/Running": { value: !jam && !feedStarved, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/Jam": { value: jam, quality: jam ? "Bad" : "Good" },
    "Cartoner/CartonsPerMin": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "Cartoner/FaultCode": { value: jam ? 41 : 0, quality: jam ? "Bad" : "Good" },

    "Checkweigher/Running": { value: !jam, quality: feedStarved ? "Uncertain" : "Good" },
    "Checkweigher/WeightKg": { value: Math.max(0, weight), quality: "Good" },
    "Checkweigher/InSpec": { value: !rejectActive && !jam, quality: "Good" },
    "Checkweigher/UnderCount": { value: Plant.state.underCount, quality: "Good" },
    "Checkweigher/OverCount": { value: Plant.state.overCount, quality: "Good" },

    "Checkweigher/Reject/Count": { value: Plant.state.rejectCount, quality: "Good" },
    "Checkweigher/Reject/Active": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },
    "Checkweigher/Reject/Divert": { value: rejectActive, quality: rejectActive ? "Uncertain" : "Good" },

    "CasePacker/Running": { value: !jam && !feedStarved, quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/Speed": { value: Math.max(0, cartonerSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/CasesPerMin": { value: Math.max(0, caseSpeed), quality: jam ? "Bad" : feedStarved ? "Uncertain" : "Good" },
    "CasePacker/Jam": { value: false, quality: "Good" },

    "Palletizer/Running": { value: !jam && !feedStarved, quality: feedStarved ? "Uncertain" : "Good" },
    "Palletizer/Layers": { value: jam ? 0 : Math.floor(((Plant.tick / 6) % 8) + 1), quality: "Good" },
    "Palletizer/PalletsDone": { value: Plant.state.palletsDone, quality: "Good" },
    "Palletizer/Jam": { value: false, quality: "Good" },

    "Outfeed/Running": { value: !jam && !feedStarved, quality: feedStarved ? "Uncertain" : "Good" },
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
    Plant.live[`${p}Mode`] = { value: "AUTO", quality: "Good" };
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
     into the refiner feed buffer, i.e. 440 kg / 30 min ≈ 880 kg/h. A stuck
     liquor valve holds the batch in DOSE; an overtemp holds it in MIX. */
  const mixRun = !mixFault;
  const mt = Plant.tick % 30;
  const mixPhase = mixValve ? "DOSE" : mixOver ? "MIX" : mt < 10 ? "DOSE" : mt < 25 ? "MIX" : "DISCHARGE";
  const doseFrac = mixPhase === "DOSE" ? (mixValve ? 1 : (mt + 1) / 10) : 1;
  const liquorKg = mixValve ? 0 : 260 * doseFrac;
  const sugarKg = 180 * doseFrac;
  const batchKg = liquorKg + sugarKg;
  const mixWeight = mixPhase === "DISCHARGE" ? batchKg * (1 - (mt - 24) / 5) : batchKg + Plant.drift(0, 1.5, 7);
  const dosing = mixPhase === "DOSE" && !mixValve;
  const cocoaOpen = dosing;
  const sugarOpen = mixPhase === "DOSE" && doseFrac < 1 || dosing;
  const outletOpen = mixPhase === "DISCHARGE";
  const jacket = mixOver ? Plant.clamp(Plant.drift(62, 1.5, 8), 58, 68) : Plant.clamp(Plant.drift(48.5, 0.6, 8), 44, 55);
  const massT = mixOver ? Plant.clamp(Plant.drift(58, 1.2, 9), 54, 64) : Plant.clamp(Plant.drift(46.2, 0.5, 9), 40, 52);
  const rpm = mixFault ? Plant.clamp(Plant.drift(8, 2, 10), 0, 15)
    : mixPhase === "MIX" ? Plant.clamp(Plant.drift(42, 2, 10), 30, 55) : Plant.clamp(Plant.drift(24, 2, 10), 15, 35);
  const cocoaFlow = cocoaOpen ? Math.max(0, Plant.drift(1560, 40, 11)) : 0;
  const sugarFlow = sugarOpen ? Math.max(0, Plant.drift(1080, 30, 12)) : 0;
  const mixOutFlow = outletOpen ? Math.max(0, Plant.drift(5280, 120, 13)) : 0;
  const mixMode = mixOver ? "FAULT" : mixValve ? "HOLD" : "AUTO";
  const mixQ = mixOver ? "Bad" : mixValve ? "Uncertain" : "Good";
  Plant.live["Mixing/Running"] = { value: mixRun, quality: mixQ };
  Plant.live["Mixing/Mode"] = { value: mixMode, quality: mixQ };
  Plant.live["Mixing/BatchId"] = { value: areaBatch(0), quality: "Good" };
  Plant.live["Mixing/Mixer1/Running"] = { value: mixRun, quality: mixQ };
  Plant.live["Mixing/Mixer1/Phase"] = { value: mixPhase, quality: mixQ };
  Plant.live["Mixing/Mixer1/WeightKg"] = { value: Math.max(0, mixWeight), quality: mixValve ? "Uncertain" : "Good" };
  Plant.live["Mixing/Mixer1/JacketTempSP"] = { value: 48.5, quality: "Good" };
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
  const refineStarve = mixFault || refinePressure;
  const refineRun = !refineStarve && !refineParticle;
  const refineLoad = refineStarve
    ? Plant.clamp(Plant.drift(12, 3, 23), 0, 25)
    : refineParticle
      ? Plant.clamp(Plant.drift(48, 3, 23), 35, 58)
      : Plant.clamp(Plant.drift(62, 3.5, 23), 45, 78);
  const particle = refineParticle
    ? Plant.clamp(Plant.drift(42, 2.5, 24), 34, 52)
    : refineStarve
      ? Plant.clamp(Plant.drift(38, 2, 24), 30, 45)
      : Plant.clamp(Plant.drift(22, 1.2, 24), 18, 28);
  const refineInOpen = !refineStarve;
  const refineOutOpen = refineRun;
  // Fed continuously from the refiner feed buffer that the batch mixer discharges into
  const refineInFlow = refineStarve ? 0 : Math.max(0, Plant.drift(880, 18, 25));
  /* Particle HOLD zeros outlet so downstream Modes go STARVED. */
  const refineOutFlow = refineRun ? Math.max(0, refineInFlow * 0.99 + Plant.drift(0, 8, 26)) : 0;
  const rollTemp = refinePressure ? Plant.clamp(Plant.drift(31, 0.8, 46), 26, 36) : Plant.clamp(Plant.drift(38, 0.5, 46), 34, 42);
  const rollPressure = refinePressure
    ? Plant.clamp(Plant.drift(8, 1.5, 47), 2, 14)
    : refineStarve
      ? Plant.clamp(Plant.drift(18, 2, 47), 10, 25)
      : Plant.clamp(Plant.drift(42, 2.5, 47), 32, 52);
  const hydPressure = refinePressure
    ? Plant.clamp(Plant.drift(28, 4, 48), 12, 40)
    : refineStarve
      ? Plant.clamp(Plant.drift(55, 3, 48), 40, 70)
      : Plant.clamp(Plant.drift(118, 4, 48), 100, 135);
  const refineMode = refinePressure ? "FAULT" : refineParticle ? "HOLD" : refineStarve ? "STARVED" : "AUTO";
  const refineQ = refinePressure ? "Bad" : refineParticle || refineStarve ? "Uncertain" : "Good";
  Plant.live["Refining/Running"] = { value: refineRun, quality: refineQ };
  Plant.live["Refining/Mode"] = { value: refineMode, quality: refineQ };
  Plant.live["Refining/BatchId"] = { value: areaBatch(1), quality: "Good" };
  Plant.live["Refining/Refiner1/Running"] = { value: refineRun, quality: refineQ };
  Plant.live["Refining/Refiner1/LoadPct"] = { value: refineLoad, quality: refineStarve || refineParticle ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/ParticleSP"] = { value: 22, quality: "Good" };
  Plant.live["Refining/Refiner1/RollTempC"] = { value: rollTemp, quality: refinePressure ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/ParticleUm"] = { value: particle, quality: refineParticle ? "Bad" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Refiner1/RollPressureBar"] = { value: rollPressure, quality: refinePressure ? "Bad" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Inlet/ValveOpen"] = { value: refineInOpen, quality: refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Inlet/FlowKgH"] = { value: Math.max(0, refineInFlow), quality: refineStarve ? "Bad" : "Good" };
  Plant.live["Refining/Outlet/ValveOpen"] = { value: refineOutOpen, quality: refinePressure || refineParticle ? "Uncertain" : refineStarve ? "Uncertain" : "Good" };
  Plant.live["Refining/Outlet/FlowKgH"] = { value: Math.max(0, refineOutFlow), quality: refineStarve || refinePressure || refineParticle ? "Bad" : "Good" };
  Plant.live["Refining/Hydraulic/PressureBar"] = { value: hydPressure, quality: refinePressure ? "Bad" : refineStarve ? "Uncertain" : "Good" };

  /* Conching — inlet from refining outlet; local overtemp/agitator scenarios. */
  const concheStarve = mixFault || refinePressure || refineParticle || refineStarve;
  const concheRun = !concheStarve && !concheAgit && !concheOver;
  /* Conche1 runs a 6.5 h batch (one tick = one plant minute): FILL 90 min at the
     refiner's rate (≈1.3 t) → DRY 120 → PASTY 90 → LIQUEFY 60 → EMPTY 30 to the
     storage tank that feeds Tempering. The refiner fills the other conches
     while Conche1 is not in FILL. */
  const ct = Plant.tick % 390;
  const conchePhase = ct < 90 ? "FILL" : ct < 210 ? "DRY" : ct < 300 ? "PASTY" : ct < 360 ? "LIQUEFY" : "EMPTY";
  const concheSp = { FILL: 55, DRY: 70, PASTY: 74, LIQUEFY: 65, EMPTY: 60 }[conchePhase];
  const concheTemp = concheOver
    ? Plant.clamp(Plant.drift(82, 1.8, 27), 76, 90)
    : concheStarve
      ? Plant.clamp(Plant.drift(48, 1.5, 27), 40, 55)
      : Plant.clamp(Plant.drift(concheSp, 0.6, 27), concheSp - 4, concheSp + 4);
  const concheRpmBase = { FILL: 20, DRY: 32, PASTY: 18, LIQUEFY: 36, EMPTY: 24 }[conchePhase];
  const concheRpm = concheAgit
    ? Plant.clamp(Plant.drift(2, 1, 28), 0, 5)
    : concheStarve
      ? Plant.clamp(Plant.drift(6, 2, 28), 0, 12)
      : Plant.clamp(Plant.drift(concheRpmBase, 1.5, 28), 10, 45);
  // Motor load peaks in the pasty phase (thick mass), trips out on an agitator stall
  const powerBase = { FILL: 26, DRY: 40, PASTY: 56, LIQUEFY: 33, EMPTY: 18 }[conchePhase];
  const conchePower = concheAgit ? Plant.clamp(Plant.drift(3, 1, 45), 0, 6)
    : concheStarve ? Plant.clamp(Plant.drift(8, 2, 45), 2, 14)
      : Plant.clamp(Plant.drift(powerBase, 2, 45), 10, 70);
  const concheTime = ct / 60; // hours into this batch
  const concheInOpen = !concheStarve && conchePhase === "FILL";
  const concheOutOpen = !concheOver && !concheAgit && conchePhase === "EMPTY";
  const concheInFlow = concheInOpen ? Math.max(0, refineOutFlow * 0.99 + Plant.drift(0, 10, 29)) : 0;
  const conchOutFlow = concheOutOpen ? Math.max(0, Plant.drift(2600, 60, 30)) : 0;
  const jacketSupply = concheOver
    ? Plant.clamp(Plant.drift(68, 1.5, 49), 60, 78)
    : concheStarve
      ? Plant.clamp(Plant.drift(42, 1.2, 49), 35, 50)
      : Plant.clamp(Plant.drift(55, 1.0, 49), 48, 62);
  const jacketFlow = concheStarve ? Plant.clamp(Plant.drift(0.4, 0.15, 50), 0, 0.8) : Plant.clamp(Plant.drift(2.4, 0.2, 50), 1.6, 3.2);
  const concheMode = concheOver ? "FAULT" : concheAgit ? "HOLD" : concheStarve ? "STARVED" : "AUTO";
  const concheQ = concheOver ? "Bad" : concheAgit || concheStarve ? "Uncertain" : "Good";
  Plant.live["Conching/Running"] = { value: concheRun, quality: concheQ };
  Plant.live["Conching/Mode"] = { value: concheMode, quality: concheQ };
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
  const temperStarve = mixFault || refinePressure || refineParticle || concheOver || concheAgit;
  const temperRun = !temperDrive && !temperWarm && !temperStarve;
  const z1 = temperWarm ? Plant.clamp(Plant.drift(52, 0.9, 14), 48, 56) : Plant.clamp(Plant.drift(45.0, 0.8, 14), 42, 48);
  const z2 = temperWarm ? Plant.clamp(Plant.drift(36, 0.8, 15), 33, 40) : Plant.clamp(Plant.drift(28.0, 0.7, 15), 26, 30);
  const z3 = temperWarm ? Plant.clamp(Plant.drift(38, 0.7, 16), 35, 42) : Plant.clamp(Plant.drift(32.0, 0.6, 16), 30, 34);
  const massOut = temperWarm ? Plant.clamp(Plant.drift(37, 0.6, 17), 34, 40) : Plant.clamp(Plant.drift(31.5, 0.5, 17), 29, 34);
  const screw = temperDrive ? 0 : temperStarve ? Plant.clamp(Plant.drift(2.5, 0.6, 18), 0.5, 4.5) : Plant.clamp(Plant.drift(18, 1.2, 18), 12, 26);
  const inOpen = !temperStarve;
  const outOpen = temperRun;
  // Drawn continuously from the storage tank that the conches empty into
  const inFlow = temperStarve ? 0 : Math.max(0, Plant.drift(875, 15, 19));
  // Temper index (temper meter slope): 4–6 is well tempered; warm zones under-temper
  const temperIndex = temperWarm ? Plant.clamp(Plant.drift(2.4, 0.3, 44), 1.5, 3.4)
    : temperStarve ? Plant.clamp(Plant.drift(4.6, 0.3, 44), 3.5, 5.5)
      : Plant.clamp(Plant.drift(5.1, 0.25, 44), 4.3, 5.8);
  const tOutFlow = temperRun ? Math.max(0, inFlow * 0.98 + Plant.drift(0, 15, 20)) : 0;
  const cwFlow = Plant.clamp(Plant.drift(temperWarm ? 8 : 12.5, 0.8, 21), 6, 18);
  const cwSupply = Plant.clamp(Plant.drift(temperWarm ? 9.5 : 6.5, 0.4, 22), 4, 11);
  const temperMode = temperWarm ? "FAULT" : temperDrive ? "HOLD" : temperStarve ? "STARVED" : "AUTO";
  const temperQ = temperWarm ? "Bad" : temperDrive || temperStarve ? "Uncertain" : "Good";
  Plant.live["Tempering/Running"] = { value: temperRun, quality: temperQ };
  Plant.live["Tempering/Mode"] = { value: temperMode, quality: temperQ };
  Plant.live["Tempering/BatchId"] = { value: areaBatch(3), quality: "Good" };
  Plant.live["Tempering/Temper1/Running"] = { value: temperRun, quality: temperQ };
  Plant.live["Tempering/Temper1/ScrewRpm"] = { value: screw, quality: temperDrive ? "Bad" : temperStarve ? "Uncertain" : "Good" };
  Plant.live["Tempering/Temper1/Zone1TempC"] = { value: z1, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Temper1/Zone2TempC"] = { value: z2, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Temper1/Zone3TempC"] = { value: z3, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Temper1/TemperIndex"] = { value: temperIndex, quality: temperWarm ? "Bad" : temperStarve ? "Uncertain" : "Good" };
  Plant.live["Tempering/Temper1/Zone1SP"] = { value: 45, quality: "Good" };
  Plant.live["Tempering/Temper1/Zone2SP"] = { value: 28, quality: "Good" };
  Plant.live["Tempering/Temper1/Zone3SP"] = { value: 31.5, quality: "Good" };
  Plant.live["Tempering/Temper1/MassTempC"] = { value: massOut, quality: temperWarm ? "Bad" : "Good" };
  Plant.live["Tempering/Inlet/ValveOpen"] = { value: inOpen, quality: temperStarve ? "Uncertain" : "Good" };
  Plant.live["Tempering/Inlet/FlowKgH"] = { value: Math.max(0, inFlow), quality: temperStarve ? "Bad" : "Good" };
  Plant.live["Tempering/Outlet/ValveOpen"] = { value: outOpen, quality: temperDrive || temperWarm ? "Uncertain" : "Good" };
  Plant.live["Tempering/Outlet/FlowKgH"] = { value: Math.max(0, tOutFlow), quality: temperDrive || temperWarm || temperStarve ? "Bad" : "Good" };
  Plant.live["Tempering/ChilledWater/FlowM3H"] = { value: cwFlow, quality: temperWarm ? "Uncertain" : "Good" };
  Plant.live["Tempering/ChilledWater/SupplyTempC"] = { value: cwSupply, quality: temperWarm ? "Uncertain" : "Good" };

  /* Moulding — inlet from tempering; local jam / cool-air scenarios. */
  const mouldStarve = temperDrive || temperWarm || mixFault || refinePressure || refineParticle || concheOver || concheAgit;
  const mouldRun = !mouldStarve && !mouldJam && !mouldCool;
  const cycles = mouldJam || mouldCool
    ? 0
    : mouldStarve
      ? Plant.clamp(Plant.drift(3, 1.2, 31), 0, 6)
      : Plant.clamp(Plant.drift(18, 1.5, 31), 12, 24);
  // Moulds are pre-warmed just below the tempered mass (~28 °C); they cool when idle
  const mouldTemp = mouldStarve || mouldJam ? Plant.clamp(Plant.drift(24.5, 0.6, 32), 21, 27) : Plant.clamp(Plant.drift(28, 0.4, 32), 26, 30);
  const airTemp = mouldCool
    ? Plant.clamp(Plant.drift(22, 1.2, 33), 18, 28)
    : mouldStarve
      ? Plant.clamp(Plant.drift(14, 1.0, 33), 10, 20)
      : Plant.clamp(Plant.drift(10, 0.5, 33), 7, 13);
  const mouldInOpen = !mouldStarve;
  const mouldOutOpen = mouldRun;
  const mouldInFlow = mouldStarve ? 0 : Math.max(0, tOutFlow * 0.98 + Plant.drift(0, 14, 34));
  const mouldOutFlow = mouldRun ? Math.max(0, mouldInFlow * 0.99 + Plant.drift(0, 12, 35)) : 0;
  const mouldMode = mouldJam ? "FAULT" : mouldCool ? "HOLD" : mouldStarve ? "STARVED" : "AUTO";
  const mouldQ = mouldJam ? "Bad" : mouldCool || mouldStarve ? "Uncertain" : "Good";
  Plant.live["Moulding/Running"] = { value: mouldRun, quality: mouldQ };
  Plant.live["Moulding/Mode"] = { value: mouldMode, quality: mouldQ };
  Plant.live["Moulding/BatchId"] = { value: areaBatch(4), quality: "Good" };
  Plant.live["Moulding/Moulder1/Running"] = { value: mouldRun, quality: mouldQ };
  Plant.live["Moulding/Moulder1/CyclesPerMin"] = { value: cycles, quality: mouldJam ? "Bad" : mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Moulder1/MouldTempC"] = { value: mouldTemp, quality: mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Inlet/ValveOpen"] = { value: mouldInOpen, quality: mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Inlet/FlowKgH"] = { value: Math.max(0, mouldInFlow), quality: mouldStarve ? "Bad" : "Good" };
  Plant.live["Moulding/Outlet/ValveOpen"] = { value: mouldOutOpen, quality: mouldJam || mouldStarve ? "Uncertain" : "Good" };
  Plant.live["Moulding/Outlet/FlowKgH"] = { value: Math.max(0, mouldOutFlow), quality: mouldJam || mouldStarve ? "Bad" : "Good" };
  Plant.live["Moulding/Cooling/AirTempSP"] = { value: 10, quality: "Good" };
  Plant.live["Moulding/Cooling/AirTempC"] = { value: airTemp, quality: mouldCool ? "Bad" : mouldStarve ? "Uncertain" : "Good" };

  /* Heuvelland site meta — worst area state wins: FAULT > HOLD > STARVED > AUTO. */
  const siteFault = mixOver || temperWarm || jam || refinePressure || concheOver || mouldJam;
  const siteHold = mixValve || temperDrive || refineParticle || concheAgit || mouldCool;
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

  Plant.syncScenarioAlarms();
  Plant.recordTrends();
}

Plant.recordTrends = function recordTrends() {
  for (const def of Plant.ALL_TAGS) {
    if (def.type !== "number") continue;
    const lv = Plant.live[def.id];
    if (!lv || typeof lv.value !== "number" || !Number.isFinite(lv.value)) continue;
    const buf = Plant.trends[def.id] || (Plant.trends[def.id] = []);
    buf.push(lv.value);
    if (buf.length > Plant.TREND_LEN) buf.splice(0, buf.length - Plant.TREND_LEN);
  }
}

Plant.syncScenarioAlarms = function syncScenarioAlarms() {
  const want = [];
  const mixFault = Plant.state.mixScenario === "overtemp" || Plant.state.mixScenario === "valve";
  const refinePressure = Plant.state.refineScenario === "pressure";
  const refineParticle = Plant.state.refineScenario === "particle";
  const concheOver = Plant.state.concheScenario === "overtemp";
  const concheAgit = Plant.state.concheScenario === "agitator";
  const temperWarm = Plant.state.temperScenario === "warm";
  const temperDrive = Plant.state.temperScenario === "drive";

  if (Plant.state.packScenario === "jam") {
    want.push({
      id: "alm-cartoner-jam",
      path: Plant.pathOf("Cartoner/Jam"),
      message: "Cartoner jam — infeed accumulated, downstream waiting",
      severity: /** @type {const} */ ("critical"),
    });
  }
  if (Plant.state.packScenario === "starved") {
    want.push({
      id: "alm-infeed-starved",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Infeed starved — no product detected at photoeye",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (Plant.state.mixScenario === "overtemp") {
    want.push({
      id: "alm-mix-overtemp",
      path: Plant.pathOf("Mixing/Mixer1/JacketTempC"),
      message: "Mixer1 jacket overtemperature — mass at risk",
      severity: /** @type {const} */ ("critical"),
    });
  }
  if (Plant.state.mixScenario === "valve") {
    want.push({
      id: "alm-mix-valve",
      path: Plant.pathOf("Mixing/CocoaLiquor/ValveOpen"),
      message: "Cocoa liquor valve XV-101 stuck closed — mixer starving",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (mixFault) {
    want.push({
      id: "alm-pack-upstream",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Mixing hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  /* Upstream starve — every area downstream of a held area raises one warning
     naming the first held area upstream of it. */
  const localHold = [
    ["Mixing", mixFault],
    ["Refining", refinePressure || refineParticle],
    ["Conching", concheOver || concheAgit],
    ["Tempering", temperWarm || temperDrive],
    ["Moulding", Plant.state.mouldScenario === "jam" || Plant.state.mouldScenario === "cool"],
  ];
  [["Refining", "refine"], ["Conching", "conche"], ["Tempering", "temper"], ["Moulding", "mould"]].forEach(([area, key]) => {
    const i = localHold.findIndex(([name]) => name === area);
    const source = localHold.slice(0, i).find(([, held]) => held);
    if (!source) return;
    want.push({
      id: `alm-${key}-upstream`,
      path: Plant.pathOf(`${area}/Inlet/FlowKgH`),
      message: `${area} starved — no mass from ${source[0]}`,
      severity: /** @type {const} */ ("warning"),
    });
  });
  if (temperWarm) {
    want.push({
      id: "alm-temper-warm",
      path: Plant.pathOf("Tempering/Temper1/Zone1TempC"),
      message: "Temper1 zones too warm — mass not set",
      severity: /** @type {const} */ ("critical"),
    });
    want.push({
      id: "alm-pack-temper",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Tempering zone warm",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (temperDrive) {
    want.push({
      id: "alm-temper-drive",
      path: Plant.pathOf("Tempering/Temper1/ScrewRpm"),
      message: "Temper1 screw drive stopped — mass hold",
      severity: /** @type {const} */ ("warning"),
    });
    want.push({
      id: "alm-pack-temper",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Tempering drive hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (refinePressure) {
    want.push({
      id: "alm-refine-pressure",
      path: Plant.pathOf("Refining/Hydraulic/PressureBar"),
      message: "Refiner1 hydraulic pressure collapse — rolls unloading",
      severity: /** @type {const} */ ("critical"),
    });
    want.push({
      id: "alm-pack-refine",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Refining pressure hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (refineParticle) {
    want.push({
      id: "alm-refine-particle",
      path: Plant.pathOf("Refining/Refiner1/ParticleUm"),
      message: "Refiner1 particle size out of spec — hold and rework",
      severity: /** @type {const} */ ("warning"),
    });
    want.push({
      id: "alm-pack-refine",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Refining particle hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (concheOver) {
    want.push({
      id: "alm-conche-overtemp",
      path: Plant.pathOf("Conching/Conche1/TempC"),
      message: "Conche1 mass overtemperature — outlet held",
      severity: /** @type {const} */ ("critical"),
    });
    want.push({
      id: "alm-pack-conche",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Conching overtemp hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (concheAgit) {
    want.push({
      id: "alm-conche-agitator",
      path: Plant.pathOf("Conching/Conche1/AgitatorRpm"),
      message: "Conche1 agitator stall — mass not developing",
      severity: /** @type {const} */ ("warning"),
    });
    want.push({
      id: "alm-pack-conche",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Conching agitator hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (Plant.state.mouldScenario === "jam") {
    want.push({
      id: "alm-mould-jam",
      path: Plant.pathOf("Moulding/Moulder1/CyclesPerMin"),
      message: "Moulder1 jam — cycles stopped, bars not releasing",
      severity: /** @type {const} */ ("critical"),
    });
    want.push({
      id: "alm-pack-mould",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Moulding jam",
      severity: /** @type {const} */ ("warning"),
    });
  }
  if (Plant.state.mouldScenario === "cool") {
    want.push({
      id: "alm-mould-cool",
      path: Plant.pathOf("Moulding/Cooling/AirTempC"),
      message: "Moulder1 cooling air too warm — set risk",
      severity: /** @type {const} */ ("warning"),
    });
    want.push({
      id: "alm-pack-mould",
      path: Plant.pathOf("Infeed/Starved"),
      message: "Line 3 starved — Moulding cool-air hold",
      severity: /** @type {const} */ ("warning"),
    });
  }
  const byId = new Map(Plant.state.alarms.map((a) => [a.id, a]));
  const wantIds = new Set(want.map((w) => w.id));
  const cleared = Plant.state.alarms.filter((a) => !wantIds.has(a.id));
  if (cleared.length) {
    const now = Date.now();
    const hist = cleared.map((a) => ({ ...a, clearedTs: now }));
    Plant.state.alarmHistory = [...hist, ...(Plant.state.alarmHistory || [])].slice(0, 30);
  }
  Plant.state.alarms = want.map((w) => {
    const prev = byId.get(w.id);
    return { ...w, acked: prev ? prev.acked : false, ts: prev ? prev.ts : Date.now() };
  });
}
