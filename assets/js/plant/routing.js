import { Plant } from "./ns.js?v=c600f295ec";


Plant.parseHash = function parseHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return { drawing: null, fault: null };
  const qIdx = raw.indexOf("?");
  const drawingPart = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).toLowerCase();
  const query = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  const drawing = Plant.ALL_DRAWING_IDS.includes(drawingPart) ? drawingPart : null;
  let fault = null;
  if (query) {
    try {
      fault = new URLSearchParams(query).get("fault");
    } catch (e) {
      fault = null;
    }
  }
  return { drawing, fault };
}

Plant.drawingFromHash = function drawingFromHash() {
  return Plant.parseHash().drawing;
}

Plant.syncHash = function syncHash(drawing) {
  if (!drawing || !Plant.ALL_DRAWING_IDS.includes(drawing)) return;
  let want = `#${drawing}`;
  if (drawing !== "overview") {
    const fault = Plant.getActiveFault(drawing);
    if (fault) want += `?fault=${fault}`;
  }
  if (location.hash !== want) {
    history.replaceState(null, "", `${location.pathname}${location.search}${want}`);
  }
}

Plant.applyHashState = function applyHashState(opts) {
  const skipHash = opts && opts.skipHash;
  const { drawing, fault } = Plant.parseHash();
  if (!drawing) return false;
  let faultChanged = false;
  if (drawing !== "overview") {
    const meta = Plant.DRAWING_FAULTS[drawing];
    let resolvedFault = fault;
    if (drawing === "tempering" && fault) {
      resolvedFault = Plant.normalizeTemperScenario(fault) || fault;
    }
    if (meta && resolvedFault && meta.values.includes(resolvedFault)) {
      if (Plant.state[meta.field] !== resolvedFault) {
        Plant.setDrawingFault(drawing, resolvedFault);
        faultChanged = true;
      } else if (drawing === "packaging" && resolvedFault === "jam" && Plant.state.cartonerJamCleared) {
        /* Deep-link re-arms a jam even if the operator had cleared it this session. */
        Plant.state.cartonerJamCleared = false;
        faultChanged = true;
      }
    }
  }
  if (faultChanged) {
    Plant.saveState();
    Plant.computeLive();
  }
  Plant.setActiveDrawing(drawing, { skipHash: true });
  if (faultChanged) Plant.renderAll();
  if (!skipHash) Plant.syncHash(drawing);
  return true;
}

Plant.setActiveDrawing = function setActiveDrawing(name, opts) {
  const skipHash = opts && opts.skipHash;
  if (name === "overview") {
    if (Plant.state.activeDrawing !== "overview") {
      Plant.state.activeDrawing = "overview";
      Plant.pidBuilt = false;
      Plant.clearPidHover();
      Plant.saveState();
    }
    if (!skipHash) Plant.syncHash("overview");
    Plant.renderAll();
    return;
  }
  if (!Plant.DRAWING_HOME_TAG[name]) return;
  if (name === Plant.state.activeDrawing && Plant.drawingForTag(Plant.state.selectedTag) === name) {
    if (!skipHash) Plant.syncHash(name);
    Plant.renderKpis();
    return;
  }
  Plant.selectTag(Plant.DRAWING_HOME_TAG[name], { skipHash });
  if (!skipHash) Plant.syncHash(name);
}

Plant.selectTag = function selectTag(id, opts) {
  if (!id || !Plant.TAG_BY_ID[id]) return;
  const skipHash = opts && opts.skipHash;
  const nextDrawing = Plant.drawingForTag(id);
  if (nextDrawing && nextDrawing !== Plant.state.activeDrawing) {
    Plant.state.activeDrawing = nextDrawing;
    Plant.pidBuilt = false;
    Plant.clearPidHover();
  }
  Plant.state.selectedTag = id;
  const open = new Set(Plant.state.openNodes);
  open.add(Plant.EDGE_ROOT);
  if (Plant.isSisterSiteTag(id)) {
    open.add(id.split("/")[0]);
    const parts = id.split("/");
    let acc = parts[0];
    for (let i = 1; i < parts.length - 1; i++) {
      acc += "/" + parts[i];
      open.add(acc);
    }
  } else if (Plant.isHeuvellandSiteTag(id)) {
    open.add(Plant.SITE);
  } else if (Plant.isProcessAreaTag(id)) {
    open.add(Plant.SITE);
    const parts = id.split("/");
    let acc = Plant.SITE;
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i];
      open.add(acc);
    }
  } else {
    open.add(Plant.SITE);
    open.add(Plant.AREA_ROOT);
    if (Plant.isStubTag(id)) {
      const parts = id.split("/");
      let acc = Plant.AREA_ROOT;
      for (let i = 0; i < parts.length - 1; i++) {
        acc += "/" + parts[i];
        open.add(acc);
      }
    } else {
      open.add(`${Plant.AREA_ROOT}/${Plant.LIVE_LINE}`);
      const parts = id.split("/");
      let acc = `${Plant.AREA_ROOT}/${Plant.LIVE_LINE}`;
      for (let i = 0; i < parts.length - 1; i++) {
        acc += "/" + parts[i];
        open.add(acc);
      }
    }
  }
  Plant.state.openNodes = [...open];
  Plant.saveState();
  Plant.treeBuilt = false;
  Plant.renderTree();
  Plant.paintPid();
  Plant.renderKpis();
  Plant.renderDetail();
  if (!skipHash && Plant.state.activeDrawing) Plant.syncHash(Plant.state.activeDrawing);
}
