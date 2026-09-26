import { Plant } from "./ns.js?v=c600f295ec";


Plant.parseHash = function parseHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return { drawing: null, fault: null, tag: null, pane: null };
  const qIdx = raw.indexOf("?");
  const drawingPart = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).toLowerCase();
  const query = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  const drawing = Plant.ALL_DRAWING_IDS.includes(drawingPart) ? drawingPart : null;
  let fault = null;
  let tag = null;
  let pane = null;
  if (query) {
    try {
      const q = new URLSearchParams(query);
      fault = q.get("fault");
      if (fault === "belt") fault = "drive"; // legacy deep links
      // One-shot deep-link extras (from the notes): open a tag's faceplate, pick an alarm-pane view
      tag = q.get("tag");
      pane = q.get("pane");
    } catch (e) {
      fault = null;
    }
  }
  return { drawing, fault, tag, pane };
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
  const { drawing, fault, tag, pane } = Plant.parseHash();
  if (!drawing) return false;
  let faultChanged = false;
  if (drawing !== "overview") {
    const meta = Plant.DRAWING_FAULTS[drawing];
    if (meta && fault && meta.values.includes(fault)) {
      if (Plant.state[meta.field] !== fault) {
        Plant.setDrawingFault(drawing, fault);
        faultChanged = true;
      }
    }
  }
  if (faultChanged) {
    Plant.saveState();
    Plant.computeLive();
  }
  Plant.setActiveDrawing(drawing, { skipHash: true });
  // A tag on this drawing (or any Heuvelland tag from the overview) opens its faceplate
  if (tag && Plant.TAG_BY_ID[tag] && (drawing === "overview" || Plant.drawingForTag(tag) === drawing)) {
    Plant.selectTag(tag, { skipHash: true });
  }
  if (["active", "shelved", "history", "events"].includes(pane) && Plant.state.alarmPane !== pane) {
    Plant.state.alarmPane = pane;
    Plant.saveState();
    Plant.renderAlarms();
  }
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
