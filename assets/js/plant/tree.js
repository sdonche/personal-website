import { Plant } from "./ns.js?v=c600f295ec";


/* ---------------- Tag tree ---------------- */

Plant.tagsUnder = function tagsUnder(tagList, prefix) {
  if (!prefix) {
    return tagList.filter((t) => !t.id.includes("/"));
  }
  const p = prefix.endsWith("/") ? prefix : prefix + "/";
  return tagList.filter((t) => {
    if (!t.id.startsWith(p)) return false;
    const rest = t.id.slice(p.length);
    return !rest.includes("/");
  });
}

Plant.stubTagsRelative = function stubTagsRelative(lineId) {
  const p = lineId + "/";
  return Plant.STUB_TAGS.filter((t) => t.id.startsWith(p)).map((t) => ({
    ...t,
    rel: t.id.slice(p.length),
  }));
}

Plant.tagsUnderStub = function tagsUnderStub(lineId, equipPrefix) {
  const rels = Plant.stubTagsRelative(lineId);
  if (!equipPrefix) {
    return rels.filter((t) => !t.rel.includes("/"));
  }
  const p = equipPrefix.endsWith("/") ? equipPrefix : equipPrefix + "/";
  return rels.filter((t) => {
    if (!t.rel.startsWith(p)) return false;
    return !t.rel.slice(p.length).includes("/");
  });
}

Plant.renderTagButton = function renderTagButton(relId, def) {
  const lv = Plant.live[relId] || { value: "—", quality: "Stale" };
  const sel = relId === Plant.state.selectedTag ? " is-selected" : "";
  const sister = Plant.isSisterSiteTag(relId);
  const site = sister ? relId.split("/")[0] : null;
  const sparking = !!(site && Plant.sparkSite() === site);
  const offline = sister && !sparking ? " plant-tag--offline" : "";
  return `<li>
    <button type="button" class="plant-tag${sel}${offline}" data-tag="${Plant.escapeHtml(relId)}" data-q="${Plant.escapeHtml(lv.quality)}" aria-pressed="${relId === Plant.state.selectedTag}">
      <span class="plant-q-dot-inline" aria-hidden="true"></span>
      <span class="plant-tag__name">${Plant.escapeHtml(def.name)}</span>
      <span class="plant-tag__val">${Plant.escapeHtml(Plant.formatValue(def, lv.value))}</span>
      <span class="plant-q plant-q--${Plant.escapeHtml(lv.quality.toLowerCase())}">${Plant.escapeHtml(lv.quality)}</span>
    </button>
  </li>`;
}

Plant.renderFolder = function renderFolder(nodeKey, label, innerHtml, extraClass, opts) {
  const open = Plant.state.openNodes.includes(nodeKey);
  const drawing = opts && opts.drawing ? ` data-drawing="${Plant.escapeHtml(opts.drawing)}"` : "";
  const site = opts && opts.site ? ` data-site="${Plant.escapeHtml(opts.site)}"` : "";
  const meta = opts && opts.metaHtml ? opts.metaHtml : "";
  return `<li class="${extraClass || ""}"${drawing}${site}>
    <details data-node="${Plant.escapeHtml(nodeKey)}" ${open ? "open" : ""}>
      <summary>
        <span class="plant-tree__chev" aria-hidden="true">▼</span>
        <span class="plant-tree__label">${Plant.escapeHtml(label)}</span>
        ${meta}
      </summary>
      <ul>${innerHtml}</ul>
    </details>
  </li>`;
}

Plant.renderEquipFolder = function renderEquipFolder(equipId) {
  const nodeKey = `${Plant.AREA_ROOT}/${Plant.LIVE_LINE}/${equipId}`;
  let body = Plant.tagsUnder(Plant.LINE3_TAGS, equipId).map((t) => Plant.renderTagButton(t.id, t)).join("");
  if (equipId === "Checkweigher") {
    const rejectTags = Plant.tagsUnder(Plant.LINE3_TAGS, "Checkweigher/Reject")
      .map((t) => Plant.renderTagButton(t.id, t))
      .join("");
    body += Plant.renderFolder(`${nodeKey}/Reject`, "Reject", rejectTags);
  }
  return Plant.renderFolder(nodeKey, equipId, body);
}

Plant.renderLine3Folder = function renderLine3Folder() {
  const nodeKey = `${Plant.AREA_ROOT}/${Plant.LIVE_LINE}`;
  const lineTags = Plant.tagsUnder(Plant.LINE3_TAGS, "").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const equips = Plant.EQUIPMENT.map((e) => Plant.renderEquipFolder(e.id)).join("");
  return Plant.renderFolder(nodeKey, "Line3", lineTags + equips, "plant-tree__line plant-tree__line--live");
}

Plant.renderStubLineFolder = function renderStubLineFolder(line) {
  const nodeKey = `${Plant.AREA_ROOT}/${line.id}`;
  const lineTags = Plant.tagsUnderStub(line.id, "")
    .map((t) => Plant.renderTagButton(t.id, t))
    .join("");
  const equips = ["Infeed", "Outfeed"].map((equipId) => {
    const body = Plant.tagsUnderStub(line.id, equipId)
      .map((t) => Plant.renderTagButton(t.id, t))
      .join("");
    return Plant.renderFolder(`${nodeKey}/${equipId}`, equipId, body);
  }).join("");
  return Plant.renderFolder(nodeKey, line.id, lineTags + equips, "plant-tree__line plant-tree__line--live");
}

Plant.mixingTagsUnder = function mixingTagsUnder(prefix) {
  const base = "Mixing/";
  if (!prefix) {
    return Plant.MIXING_TAGS.filter((t) => {
      const rest = t.id.slice(base.length);
      return !rest.includes("/");
    });
  }
  const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
  return Plant.MIXING_TAGS.filter((t) => {
    if (!t.id.startsWith(p)) return false;
    const rest = t.id.slice(p.length);
    return !rest.includes("/");
  });
}

Plant.renderMixingFolder = function renderMixingFolder() {
  const areaTags = Plant.mixingTagsUnder("").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const mixer = Plant.mixingTagsUnder("Mixer1").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const cocoa = Plant.mixingTagsUnder("CocoaLiquor").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const sugar = Plant.mixingTagsUnder("Sugar").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const outlet = Plant.mixingTagsUnder("Outlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const drain = Plant.mixingTagsUnder("Drain").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const body =
    areaTags +
    Plant.renderFolder(`${Plant.MIXING_ROOT}/Mixer1`, "Mixer1", mixer) +
    Plant.renderFolder(`${Plant.MIXING_ROOT}/CocoaLiquor`, "CocoaLiquor", cocoa) +
    Plant.renderFolder(`${Plant.MIXING_ROOT}/Sugar`, "Sugar", sugar) +
    Plant.renderFolder(`${Plant.MIXING_ROOT}/Outlet`, "Outlet", outlet) +
    Plant.renderFolder(`${Plant.MIXING_ROOT}/Drain`, "Drain", drain);
  return Plant.renderFolder(Plant.MIXING_ROOT, Plant.MIXING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "mixing" });
}

Plant.temperingTagsUnder = function temperingTagsUnder(prefix) {
  const base = "Tempering/";
  if (!prefix) {
    return Plant.TEMPERING_TAGS.filter((t) => {
      const rest = t.id.slice(base.length);
      return !rest.includes("/");
    });
  }
  const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
  return Plant.TEMPERING_TAGS.filter((t) => {
    if (!t.id.startsWith(p)) return false;
    return !t.id.slice(p.length).includes("/");
  });
}

Plant.renderTemperingFolder = function renderTemperingFolder() {
  const areaTags = Plant.temperingTagsUnder("").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const temper = Plant.temperingTagsUnder("Temper1").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const inlet = Plant.temperingTagsUnder("Inlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const outlet = Plant.temperingTagsUnder("Outlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const chilled = Plant.temperingTagsUnder("ChilledWater").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const body =
    areaTags +
    Plant.renderFolder(`${Plant.TEMPERING_ROOT}/Temper1`, "Temper1", temper) +
    Plant.renderFolder(`${Plant.TEMPERING_ROOT}/Inlet`, "Inlet", inlet) +
    Plant.renderFolder(`${Plant.TEMPERING_ROOT}/Outlet`, "Outlet", outlet) +
    Plant.renderFolder(`${Plant.TEMPERING_ROOT}/ChilledWater`, "ChilledWater", chilled);
  return Plant.renderFolder(Plant.TEMPERING_ROOT, Plant.TEMPERING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "tempering" });
}

Plant.areaTagsUnder = function areaTagsUnder(tagList, areaPrefix, prefix) {
  const base = areaPrefix.endsWith("/") ? areaPrefix : areaPrefix + "/";
  if (!prefix) {
    return tagList.filter((t) => {
      if (!t.id.startsWith(base)) return false;
      return !t.id.slice(base.length).includes("/");
    });
  }
  const p = base + (prefix.endsWith("/") ? prefix : prefix + "/");
  return tagList.filter((t) => {
    if (!t.id.startsWith(p)) return false;
    return !t.id.slice(p.length).includes("/");
  });
}

Plant.renderRefiningFolder = function renderRefiningFolder() {
  const areaTags = Plant.areaTagsUnder(Plant.REFINING_TAGS, "Refining/", "").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const refiner = Plant.areaTagsUnder(Plant.REFINING_TAGS, "Refining/", "Refiner1").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const inlet = Plant.areaTagsUnder(Plant.REFINING_TAGS, "Refining/", "Inlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const outlet = Plant.areaTagsUnder(Plant.REFINING_TAGS, "Refining/", "Outlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const hydraulic = Plant.areaTagsUnder(Plant.REFINING_TAGS, "Refining/", "Hydraulic").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const body =
    areaTags +
    Plant.renderFolder(`${Plant.REFINING_ROOT}/Refiner1`, "Refiner1", refiner) +
    Plant.renderFolder(`${Plant.REFINING_ROOT}/Inlet`, "Inlet", inlet) +
    Plant.renderFolder(`${Plant.REFINING_ROOT}/Outlet`, "Outlet", outlet) +
    Plant.renderFolder(`${Plant.REFINING_ROOT}/Hydraulic`, "Hydraulic", hydraulic);
  return Plant.renderFolder(Plant.REFINING_ROOT, Plant.REFINING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "refining" });
}

Plant.renderConchingFolder = function renderConchingFolder() {
  const areaTags = Plant.areaTagsUnder(Plant.CONCHING_TAGS, "Conching/", "").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const conche = Plant.areaTagsUnder(Plant.CONCHING_TAGS, "Conching/", "Conche1").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const inlet = Plant.areaTagsUnder(Plant.CONCHING_TAGS, "Conching/", "Inlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const outlet = Plant.areaTagsUnder(Plant.CONCHING_TAGS, "Conching/", "Outlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const jacket = Plant.areaTagsUnder(Plant.CONCHING_TAGS, "Conching/", "Jacket").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const body =
    areaTags +
    Plant.renderFolder(`${Plant.CONCHING_ROOT}/Conche1`, "Conche1", conche) +
    Plant.renderFolder(`${Plant.CONCHING_ROOT}/Inlet`, "Inlet", inlet) +
    Plant.renderFolder(`${Plant.CONCHING_ROOT}/Outlet`, "Outlet", outlet) +
    Plant.renderFolder(`${Plant.CONCHING_ROOT}/Jacket`, "Jacket", jacket);
  return Plant.renderFolder(Plant.CONCHING_ROOT, Plant.CONCHING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "conching" });
}

Plant.renderMouldingFolder = function renderMouldingFolder() {
  const areaTags = Plant.areaTagsUnder(Plant.MOULDING_TAGS, "Moulding/", "").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const moulder = Plant.areaTagsUnder(Plant.MOULDING_TAGS, "Moulding/", "Moulder1").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const inlet = Plant.areaTagsUnder(Plant.MOULDING_TAGS, "Moulding/", "Inlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const outlet = Plant.areaTagsUnder(Plant.MOULDING_TAGS, "Moulding/", "Outlet").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const cooling = Plant.areaTagsUnder(Plant.MOULDING_TAGS, "Moulding/", "Cooling").map((t) => Plant.renderTagButton(t.id, t)).join("");
  const body =
    areaTags +
    Plant.renderFolder(`${Plant.MOULDING_ROOT}/Moulder1`, "Moulder1", moulder) +
    Plant.renderFolder(`${Plant.MOULDING_ROOT}/Inlet`, "Inlet", inlet) +
    Plant.renderFolder(`${Plant.MOULDING_ROOT}/Outlet`, "Outlet", outlet) +
    Plant.renderFolder(`${Plant.MOULDING_ROOT}/Cooling`, "Cooling", cooling);
  return Plant.renderFolder(Plant.MOULDING_ROOT, Plant.MOULDING_AREA, body, "plant-tree__area plant-tree__area--live", { drawing: "moulding" });
}

Plant.renderSisterSiteFolder = function renderSisterSiteFolder(site) {
  const top = Plant.SISTER_SITE_TAGS.filter((t) => {
    if (!t.id.startsWith(`${site}/`)) return false;
    return !t.id.slice(site.length + 1).includes("/");
  })
    .map((t) => Plant.renderTagButton(t.id, t))
    .join("");
  const areas = Plant.SISTER_AREAS.map((area) => {
    const tags = Plant.SISTER_SITE_TAGS.filter((t) => t.id.startsWith(`${site}/${area.id}/`))
      .map((t) => Plant.renderTagButton(t.id, t))
      .join("");
    return Plant.renderFolder(`${site}/${area.id}`, area.id, tags, "plant-tree__area plant-tree__area--stub");
  }).join("");
  const meta = `<span class="plant-tree__site-meta" data-site-meta="${Plant.escapeHtml(site)}"></span>`;
  return Plant.renderFolder(site, site, top + areas, "plant-tree__site plant-tree__site--offline", { site, metaHtml: meta });
}

Plant.buildTree = function buildTree() {
  const root = document.getElementById("plant-tree");
  if (!root) return;

  const lines =
    Plant.STUB_LINES.map(Plant.renderStubLineFolder).join("") + Plant.renderLine3Folder();

  const packaging = Plant.renderFolder(Plant.AREA_ROOT, Plant.AREA, lines, "plant-tree__area plant-tree__area--live", { drawing: "packaging" });
  const mixing = Plant.renderMixingFolder();
  const refining = Plant.renderRefiningFolder();
  const conching = Plant.renderConchingFolder();
  const tempering = Plant.renderTemperingFolder();
  const moulding = Plant.renderMouldingFolder();

  /* Process order: Mixing → Refining → Conching → Tempering → Moulding → Packaging */
  const siteMeta = Plant.HEUVELLAND_SITE_TAGS.map((t) => Plant.renderTagButton(t.id, t)).join("");
  const heuvellandAreas = mixing + refining + conching + tempering + moulding + packaging;
  const heuvMeta = `<span class="plant-tree__site-meta" data-site-meta="${Plant.escapeHtml(Plant.SITE)}"></span>`;
  const heuvelland = Plant.renderFolder(
    Plant.SITE,
    Plant.SITE,
    siteMeta + heuvellandAreas,
    "plant-tree__site plant-tree__site--live",
    { site: Plant.SITE, metaHtml: heuvMeta }
  );
  const sisters = Plant.SISTER_SITES.map(Plant.renderSisterSiteFolder).join("");

  root.innerHTML = Plant.renderFolder(Plant.EDGE_ROOT, Plant.EDGE_ROOT, heuvelland + sisters, "plant-tree__edge");
  Plant.treeBuilt = true;
  Plant.updateTreeValues();

  const headPath = document.getElementById("plant-tree-path");
  if (headPath) headPath.textContent = Plant.EDGE_ROOT;
}

Plant.updateTreeValues = function updateTreeValues() {
  const root = document.getElementById("plant-tree");
  if (!root) return;
  const spark = Plant.sparkSite();
  root.querySelectorAll(".plant-tag[data-tag]").forEach((btn) => {
    const id = btn.getAttribute("data-tag");
    if (!id) return;
    const def = Plant.TAG_BY_ID[id];
    const lv = Plant.live[id] || { value: "—", quality: "Stale" };
    if (!def) return;
    btn.dataset.q = lv.quality;
    btn.classList.toggle("is-selected", id === Plant.state.selectedTag);
    btn.setAttribute("aria-pressed", id === Plant.state.selectedTag ? "true" : "false");
    if (Plant.isSisterSiteTag(id)) {
      const site = id.split("/")[0];
      btn.classList.toggle("plant-tag--offline", site !== spark);
    }
    const valEl = btn.querySelector(".plant-tag__val");
    const qEl = btn.querySelector(".plant-q");
    if (valEl) valEl.textContent = Plant.formatValue(def, lv.value);
    if (qEl) {
      qEl.textContent = lv.quality;
      qEl.className = `plant-q plant-q--${lv.quality.toLowerCase()}`;
    }
  });
}

Plant.renderTree = function renderTree() {
  if (!Plant.treeBuilt) Plant.buildTree();
  else Plant.updateTreeValues();
}

Plant.paintSisterSpark = function paintSisterSpark() {
  const spark = Plant.sparkSite();
  document.querySelectorAll(".plant-tree__site[data-site]").forEach((li) => {
    const site = li.getAttribute("data-site");
    if (!site) return;
    const snap = Plant.siteSnapshot(site);
    const isSister = !snap.isHome;
    li.classList.toggle("plant-tree__site--spark", isSister && snap.link === "flap");
    const meta = li.querySelector(`[data-site-meta="${CSS.escape(site)}"]`);
    if (meta) {
      const oeeTxt = snap.oee == null ? "—" : `${snap.oee.toFixed(1)} %`;
      if (snap.isHome) {
        meta.textContent = `${snap.mode} · ${oeeTxt}`;
      } else if (snap.link === "flap") {
        meta.textContent = `${snap.mode} · ${oeeTxt}`;
      } else {
        meta.textContent = `offline · last ${oeeTxt}`;
      }
    }
  });
  Plant.paintFleet();
}
