import { Plant } from "./ns.js?v=c600f295ec";


/** Connection ports for each equipment kind — pipes must meet these exactly. */
Plant.portsFor = function portsFor(eq, x, y, w, h) {
  const midY = y + h / 2;
  if (eq.kind === "scale") {
    return {
      left: x + 6,
      right: x + w - 6,
      top: y + 4,
      bottom: y + h - 4,
      cx: x + w / 2,
      midY,
    };
  }
  if (eq.kind === "conveyor") {
    return {
      left: x,
      right: x + w,
      top: y + 10,
      bottom: y + h - 10,
      cx: x + w / 2,
      midY,
    };
  }
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    cx: x + w / 2,
    midY,
  };
}

Plant.equipKeyForTag = function equipKeyForTag(tagId) {
  if (!tagId) return null;
  if (Plant.isProcessAreaTag(tagId)) {
    const parts = tagId.split("/");
    // Mixing/Mixer1/LevelPct → Mixer1; Refining/Refiner1/LoadPct → Refiner1
    return parts[1] || null;
  }
  let id = tagId;
  if (Plant.isStubTag(tagId)) id = tagId.split("/").slice(1).join("/");
  if (id.startsWith("Checkweigher/Reject")) return "Reject";
  if (!id.includes("/")) return null;
  return id.split("/")[0];
}

Plant.balloon = function balloon(cx, cy, top, bot, tagId, anchorX, anchorY, equipKey) {
  const q = (Plant.live[tagId] || {}).quality || "Stale";
  const qClass = `pid-q--${q.toLowerCase()}`;
  const selected = tagId === Plant.state.selectedTag ? " is-selected" : "";
  const val = Plant.liveReadout(tagId);
  const ax = anchorX != null ? anchorX : cx;
  const ay = anchorY != null ? anchorY : cy + 42;
  const railY = Math.min(cy + 26, ay - 6);
  const leader = Math.abs(ax - cx) < 0.5
    ? `M ${cx} ${cy + 17} V ${ay}`
    : `M ${cx} ${cy + 17} V ${railY} H ${ax} V ${ay}`;
  const ek = equipKey || Plant.equipKeyForTag(tagId) || "";
  return `
    <g class="pid-balloon${selected} ${qClass}" data-tag="${Plant.escapeHtml(tagId)}" data-equip="${Plant.escapeHtml(ek)}" role="button" tabindex="0" aria-label="${Plant.escapeHtml(top + "-" + bot + " " + val)}">
      <path class="pid-leader" d="${leader}" fill="none" />
      <circle class="pid-balloon__ring" cx="${cx}" cy="${cy}" r="17" />
      <line class="pid-balloon__split" x1="${cx - 17}" y1="${cy}" x2="${cx + 17}" y2="${cy}" />
      <text class="pid-balloon__top" x="${cx}" y="${cy - 4}" text-anchor="middle">${Plant.escapeHtml(top)}</text>
      <text class="pid-balloon__bot" x="${cx}" y="${cy + 11}" text-anchor="middle">${Plant.escapeHtml(bot)}</text>
      <text class="pid-balloon__val" data-pid-val="${Plant.escapeHtml(tagId)}" x="${cx + 22}" y="${cy + 4}" text-anchor="start">${Plant.escapeHtml(val)}</text>
    </g>`;
}

Plant.flange = function flange(x, y) {
  return `<line class="pid-flange" x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" />`;
}

Plant.flowArrow = function flowArrow(x, y) {
  return `<polygon class="pid-arrow" points="${x},${y} ${x - 7},${y - 4.5} ${x - 7},${y + 4.5}" />`;
}

Plant.equipBlock = function equipBlock(x, y, w, h, eq, st) {
  const tagId = `${eq.id}/Running`;
  const selected = Plant.state.selectedTag.startsWith(eq.id + "/") || Plant.state.selectedTag === eq.id
    ? " is-selected" : "";
  const midY = y + h / 2;
  const p = Plant.portsFor(eq, x, y, w, h);
  let body;
  if (eq.kind === "conveyor") {
    body = `
      <rect class="pid-equip__body" x="${x}" y="${y + 10}" width="${w}" height="${h - 20}" rx="2" />
      <circle class="pid-equip__roller" cx="${x + 11}" cy="${midY}" r="8" />
      <circle class="pid-equip__roller" cx="${x + w - 11}" cy="${midY}" r="8" />
      <line class="pid-equip__belt" x1="${x + 11}" y1="${y + 14}" x2="${x + w - 11}" y2="${y + 14}" />
      <line class="pid-equip__belt" x1="${x + 11}" y1="${y + h - 14}" x2="${x + w - 11}" y2="${y + h - 14}" />
      <line class="pid-equip__hatch" x1="${x + 22}" y1="${midY}" x2="${x + w - 22}" y2="${midY}" />`;
  } else if (eq.kind === "scale") {
    body = `
      <rect class="pid-equip__body" x="${p.left}" y="${p.top}" width="${p.right - p.left}" height="${p.bottom - p.top}" rx="1" />
      <rect class="pid-equip__platen" x="${x + 16}" y="${y + 10}" width="${w - 32}" height="8" rx="1" />
      <line class="pid-equip__detail" x1="${p.cx}" y1="${y + 18}" x2="${p.cx}" y2="${p.bottom - 10}" />
      <line class="pid-equip__detail" x1="${x + 14}" y1="${p.bottom - 8}" x2="${x + w - 14}" y2="${p.bottom - 8}" />
      <line class="pid-equip__detail" x1="${x + 18}" y1="${p.bottom - 4}" x2="${x + w - 18}" y2="${p.bottom - 4}" />`;
  } else if (eq.kind === "palletizer") {
    body = `
      <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="1" />
      <rect class="pid-equip__stack" x="${x + 16}" y="${y + h - 18}" width="${w - 32}" height="6" />
      <rect class="pid-equip__stack" x="${x + 20}" y="${y + h - 26}" width="${w - 40}" height="6" />
      <rect class="pid-equip__stack" x="${x + 24}" y="${y + h - 34}" width="${w - 48}" height="6" />
      <line class="pid-equip__detail" x1="${x + 10}" y1="${y + 10}" x2="${x + w - 10}" y2="${y + 10}" />`;
  } else {
    body = `
      <rect class="pid-equip__body" x="${x}" y="${y}" width="${w}" height="${h}" rx="1" />
      <rect class="pid-equip__detail" x="${x + 8}" y="${y + 10}" width="${w - 16}" height="${h - 20}" rx="1" />
      <line class="pid-equip__detail" x1="${x + 8}" y1="${midY}" x2="${x + w - 8}" y2="${midY}" />`;
  }
  return `
    <g class="pid-equip pid-equip--${st}${selected}" data-equip="${Plant.escapeHtml(eq.id)}" data-tag="${Plant.escapeHtml(tagId)}" role="button" tabindex="0">
      ${body}
      <text class="pid-equip__pid" x="${p.cx}" y="${p.top - 8}" text-anchor="middle">${Plant.escapeHtml(eq.pid)}</text>
      <text class="pid-equip__name" x="${p.cx}" y="${p.bottom + 14}" text-anchor="middle">${Plant.escapeHtml(eq.label)}</text>
    </g>`;
}

Plant.divertValve = function divertValve(cx, cyTop, cyBot, active, selected) {
  const mid = (cyTop + cyBot) / 2;
  return `
    <g class="pid-valve${selected}${active ? " is-active" : ""}" data-tag="Checkweigher/Reject/Divert" data-equip="Reject" role="button" tabindex="0" aria-label="Reject divert valve RJ-321">
      <line class="pid-pipe pid-pipe--divert" x1="${cx}" y1="${cyTop}" x2="${cx}" y2="${mid - 10}" />
      <polygon class="pid-valve__body" points="${cx},${mid - 10} ${cx - 11},${mid + 10} ${cx + 11},${mid + 10}" />
      <line class="pid-pipe pid-pipe--divert" x1="${cx}" y1="${mid + 10}" x2="${cx}" y2="${cyBot}" />
      <text class="pid-mix-valve__pid" x="${cx + 16}" y="${mid + 4}" text-anchor="start">XV-321</text>
    </g>`;
}

Plant.buildPackagingPid = function buildPackagingPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const y = 178;
  const h = 58;
  const w = 92;
  // Leave room on the left for the FROM MOULD inlet label (no overlap with CV-301).
  const xs = [90, 228, 366, 522, 660, 798];

  const layout = Plant.EQUIPMENT.map((eq, i) => {
    const x = xs[i];
    return { eq, x, y, w, h, ports: Plant.portsFor(eq, x, y, w, h) };
  });

  const midY = layout[0].ports.midY;
  const weigh = layout[2];
  const rejectX = weigh.ports.cx;
  const valveTop = weigh.ports.bottom;
  const binTop = 332;
  const valveBot = binTop - 18;

  const pipes = layout.map((node, i) => {
    if (i === layout.length - 1) return "";
    const next = layout[i + 1];
    const x1 = node.ports.right;
    const x2 = next.ports.left;
    const mid = (x1 + x2) / 2;
    return `
      <line class="pid-pipe pid-pipe--main" x1="${x1}" y1="${midY}" x2="${x2}" y2="${midY}" />
      ${Plant.flange(x1, midY)}${Plant.flange(x2, midY)}
      ${Plant.flowArrow(mid + 3, midY)}`;
  }).join("");

  // Inlet stub left of CV-301: label sits above the stub, clear of the body.
  const inletX0 = 24;
  const inletX1 = layout[0].ports.left;
  const inletMid = (inletX0 + inletX1) / 2;
  const inlet = `
    <line class="pid-pipe pid-pipe--main" x1="${inletX0}" y1="${midY}" x2="${inletX1}" y2="${midY}" />
    ${Plant.flange(inletX1, midY)}
    <text class="pid-flow-label" x="${inletMid}" y="${midY - 22}" text-anchor="middle">FROM MOULD</text>
    ${Plant.flowArrow(inletX1 - 12, midY)}`;

  const last = layout[layout.length - 1];
  const outletX1 = last.ports.right + 48;
  const outlet = `
    <line class="pid-pipe pid-pipe--main" x1="${last.ports.right}" y1="${midY}" x2="${outletX1}" y2="${midY}" />
    ${Plant.flange(last.ports.right, midY)}
    ${Plant.flowArrow(outletX1 - 8, midY)}
    <text class="pid-flow-label" x="${outletX1}" y="${midY - 22}" text-anchor="middle">PALLETS</text>`;

  const equips = layout.map((n) =>
    Plant.equipBlock(n.x, n.y, n.w, n.h, n.eq, "run")
  ).join("");

  const cart = layout[1];
  const caseP = layout[3];
  const pal = layout[4];
  const outf = layout[5];
  const balloons = [
    Plant.balloon(layout[0].ports.cx, 86, "SI", "301", "Infeed/Speed", layout[0].ports.cx, layout[0].ports.top, "Infeed"),
    Plant.balloon(cart.ports.cx - 26, 86, "SC", "310", "Cartoner/Speed", cart.ports.cx - 14, cart.ports.top, "Cartoner"),
    Plant.balloon(cart.ports.cx + 26, 86, "YA", "310", "Cartoner/Jam", cart.ports.cx + 14, cart.ports.top, "Cartoner"),
    Plant.balloon(weigh.ports.cx, 86, "WT", "320", "Checkweigher/WeightKg", weigh.ports.cx, weigh.ports.top, "Checkweigher"),
    Plant.balloon(rejectX + 54, (valveTop + valveBot) / 2, "XI", "321", "Checkweigher/Reject/Divert", rejectX + 12, (valveTop + valveBot) / 2, "Reject"),
    Plant.balloon(caseP.ports.cx, 86, "SI", "330", "CasePacker/Speed", caseP.ports.cx, caseP.ports.top, "CasePacker"),
    Plant.balloon(pal.ports.cx, 86, "CI", "340", "Palletizer/PalletsDone", pal.ports.cx, pal.ports.top, "Palletizer"),
    Plant.balloon(outf.ports.cx, 86, "XI", "350", "Outfeed/Occupied", outf.ports.cx, outf.ports.top, "Outfeed"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line 3 packaging P and ID">
      <title>Heuvelland Packaging Line 3 — P&amp;ID</title>

      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">PKG-L3-001</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Packaging / Line3</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — PRIMARY PACK</text>
      <text class="pid-sheet__sub" x="24" y="52">Bars from Moulding → cartoner → weigh → case → pallet → outfeed</text>

      ${equips}
      ${inlet}
      ${pipes}
      ${outlet}
      <line class="pid-pipe-flow" data-pid-flow x1="${inletX0}" y1="${midY}" x2="${outletX1}" y2="${midY}" />

      ${Plant.divertValve(rejectX, valveTop, valveBot, false, false)}
      <g class="pid-bin" data-tag="Checkweigher/Reject/Count" data-equip="Reject" role="button" tabindex="0">
        <path class="pid-bin__body" d="M${rejectX - 26},${binTop} L${rejectX + 26},${binTop} L${rejectX + 20},${binTop + 30} L${rejectX - 20},${binTop + 30} Z" />
        <text class="pid-bin__label" x="${rejectX}" y="${binTop + 18}" text-anchor="middle">REJECT</text>
        <text class="pid-bin__count" data-pid-reject-count x="${rejectX}" y="${binTop + 44}" text-anchor="middle">0</text>
      </g>

      ${balloons}
      ${Plant.batchBadge("BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.mixValve = function mixValve(cx, cy, tagId, equip, pidLabel) {
  const selected = tagId === Plant.state.selectedTag ? " is-selected" : "";
  return `
    <g class="pid-mix-valve${selected}" data-tag="${Plant.escapeHtml(tagId)}" data-equip="${Plant.escapeHtml(equip)}" role="button" tabindex="0" aria-label="${Plant.escapeHtml(pidLabel)}">
      <polygon class="pid-mix-valve__body" points="${cx},${cy - 11} ${cx + 11},${cy} ${cx},${cy + 11} ${cx - 11},${cy}" />
      <text class="pid-mix-valve__pid" x="${cx}" y="${cy - 16}" text-anchor="middle">${Plant.escapeHtml(pidLabel)}</text>
    </g>`;
}

/** Shared batch callout — same BatchId across every sheet. */
Plant.batchBadge = function batchBadge(tagId, vbH) {
  return `
    <g class="pid-batch" data-tag="${Plant.escapeHtml(tagId)}" role="button" tabindex="0" aria-label="Batch id">
      <text class="pid-batch__k" x="24" y="${vbH - 20}">BATCH</text>
      <text class="pid-batch__v" data-pid-batch="${Plant.escapeHtml(tagId)}" x="72" y="${vbH - 20}">—</text>
    </g>`;
}

/** Transfer-pump glyph on mass lines. */
Plant.pumpSymbol = function pumpSymbol(cx, cy) {
  return `
    <g class="pid-pump" aria-hidden="true">
      <circle class="pid-pump__body" cx="${cx}" cy="${cy}" r="11" />
      <polygon class="pid-pump__tri" points="${cx - 3},${cy - 6} ${cx + 7},${cy} ${cx - 3},${cy + 6}" />
    </g>`;
}

Plant.massFlowLine = function massFlowLine(x1, y1, x2, y2) {
  return `<line class="pid-pipe-flow" data-pid-flow x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
}

Plant.buildMixingPid = function buildMixingPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const tankX = 340;
  const tankY = 88;
  const tankW = 260;
  const tankH = 240;
  const tankCx = tankX + tankW / 2;
  const cocoaY = 140;
  const sugarY = 230;
  const outY = tankY + tankH / 2;
  const drainX = tankCx;
  const drainY0 = tankY + tankH;
  const drainY1 = 372;
  const jacketInset = 12;
  const levelInset = 22;
  const levelTop = tankY + jacketInset + 8;
  const levelInnerH = tankH - jacketInset * 2 - 16;

  const balloons = [
    Plant.balloon(tankCx - 90, 52, "LI", "110", "Mixing/Mixer1/LevelPct", tankCx - 50, tankY, "Mixer1"),
    Plant.balloon(tankCx + 90, 52, "TI", "110", "Mixing/Mixer1/JacketTempC", tankCx + 50, tankY, "Mixer1"),
    Plant.balloon(tankCx, 52, "SI", "110", "Mixing/Mixer1/AgitatorRpm", tankCx, tankY, "Mixer1"),
    Plant.balloon(100, cocoaY - 48, "FI", "101", "Mixing/CocoaLiquor/FlowKgH", 190, cocoaY, "CocoaLiquor"),
    Plant.balloon(100, sugarY + 52, "FI", "102", "Mixing/Sugar/FlowKgH", 190, sugarY, "Sugar"),
    Plant.balloon(800, outY - 52, "FI", "110", "Mixing/Outlet/FlowKgH", 720, outY, "Outlet"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg pid-svg--mixing is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Mixing Mixer1 P and ID">
      <title>Heuvelland Mixing — Mixer1</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">MIX-110</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Mixing / Mixer1</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — CHOCOLATE MASS</text>
      <text class="pid-sheet__sub" x="24" y="52">Cocoa liquor + sugar → Mixer1 → mass out (refining next)</text>

      <text class="pid-flow-label" x="28" y="${cocoaY - 10}" text-anchor="start">COCOA LIQUOR</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${cocoaY}" x2="${tankX}" y2="${cocoaY}" />
      ${Plant.flowArrow(130, cocoaY)}
      ${Plant.mixValve(210, cocoaY, "Mixing/CocoaLiquor/ValveOpen", "CocoaLiquor", "XV-101")}
      ${Plant.flange(tankX, cocoaY)}

      <text class="pid-flow-label" x="28" y="${sugarY - 10}" text-anchor="start">SUGAR</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${sugarY}" x2="${tankX}" y2="${sugarY}" />
      ${Plant.flowArrow(130, sugarY)}
      ${Plant.mixValve(210, sugarY, "Mixing/Sugar/ValveOpen", "Sugar", "XV-102")}
      ${Plant.flange(tankX, sugarY)}

      <g class="pid-tank pid-equip--run" data-equip="Mixer1" data-tag="Mixing/Mixer1/Running" role="button" tabindex="0">
        <rect class="pid-tank__shell" x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="10" />
        <rect class="pid-tank__jacket" x="${tankX + jacketInset}" y="${tankY + jacketInset}" width="${tankW - jacketInset * 2}" height="${tankH - jacketInset * 2}" rx="5" />
        <rect class="pid-tank__level" data-pid-level data-tank-top="${levelTop}" data-tank-inner-h="${levelInnerH}" x="${tankX + levelInset}" y="${levelTop + levelInnerH * 0.4}" width="${tankW - levelInset * 2}" height="${levelInnerH * 0.6}" rx="2" />
        <line class="pid-tank__agitator" x1="${tankCx}" y1="${tankY + 32}" x2="${tankCx}" y2="${tankY + tankH - 32}" />
        <circle class="pid-tank__hub" cx="${tankCx}" cy="${tankY + 44}" r="8" />
        <text class="pid-equip__pid" x="${tankCx}" y="${tankY - 12}" text-anchor="middle">MIX-110</text>
        <text class="pid-equip__name" x="${tankCx}" y="${tankY + tankH + 20}" text-anchor="middle">Mixer1</text>
      </g>

      <line class="pid-pipe pid-pipe--main" x1="${tankX + tankW}" y1="${outY}" x2="880" y2="${outY}" />
      ${Plant.flange(tankX + tankW, outY)}
      ${Plant.pumpSymbol(660, outY)}
      ${Plant.mixValve(720, outY, "Mixing/Outlet/ValveOpen", "Outlet", "XV-110")}
      ${Plant.flowArrow(800, outY)}
      <text class="pid-flow-label" x="888" y="${outY - 10}" text-anchor="start">TO REFINE</text>
      ${Plant.massFlowLine(tankX + tankW, outY, 880, outY)}

      <line class="pid-pipe pid-pipe--divert" x1="${drainX}" y1="${drainY0}" x2="${drainX}" y2="${drainY1}" />
      ${Plant.mixValve(drainX, drainY0 + 32, "Mixing/Drain/ValveOpen", "Drain", "XV-119")}
      <text class="pid-flow-label" x="${drainX + 20}" y="${drainY1}" text-anchor="start">DRAIN</text>

      ${balloons}
      ${Plant.batchBadge("Mixing/BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.buildTemperingPid = function buildTemperingPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const tunnelX = 170;
  const tunnelY = 118;
  const tunnelW = 620;
  const tunnelH = 160;
  const zoneW = tunnelW / 3;
  const midY = tunnelY + tunnelH / 2;
  const inY = midY;
  const outY = midY;

  const zones = [0, 1, 2].map((i) => {
    const x = tunnelX + i * zoneW;
    const label = `Z${i + 1}`;
    return `
      <rect class="pid-tunnel__zone" data-zone="${i + 1}" x="${x}" y="${tunnelY}" width="${zoneW}" height="${tunnelH}" />
      <text class="pid-tunnel__zone-label" x="${x + zoneW / 2}" y="${tunnelY + 26}" text-anchor="middle">${label}</text>`;
  }).join("");

  const balloons = [
    Plant.balloon(tunnelX + zoneW * 0.5, 68, "TI", "211", "Tempering/Temper1/Zone1TempC", tunnelX + zoneW * 0.5, tunnelY, "Temper1"),
    Plant.balloon(tunnelX + zoneW * 1.5, 68, "TI", "212", "Tempering/Temper1/Zone2TempC", tunnelX + zoneW * 1.5, tunnelY, "Temper1"),
    Plant.balloon(tunnelX + zoneW * 2.5, 68, "TI", "213", "Tempering/Temper1/Zone3TempC", tunnelX + zoneW * 2.5, tunnelY, "Temper1"),
    Plant.balloon(tunnelX + tunnelW / 2, 330, "SI", "210", "Tempering/Temper1/BeltSpeed", tunnelX + tunnelW / 2, tunnelY + tunnelH, "Temper1"),
    Plant.balloon(90, inY - 52, "FI", "201", "Tempering/Inlet/FlowKgH", 140, inY, "Inlet"),
    Plant.balloon(850, outY - 52, "FI", "205", "Tempering/Outlet/FlowKgH", 800, outY, "Outlet"),
    Plant.balloon(200, 352, "FI", "206", "Tempering/ChilledWater/FlowM3H", 200, tunnelY + tunnelH + 10, "ChilledWater"),
    Plant.balloon(480, 352, "TI", "207", "Tempering/ChilledWater/SupplyTempC", 480, tunnelY + tunnelH + 10, "ChilledWater"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg pid-svg--tempering is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Tempering Temper1 P and ID">
      <title>Heuvelland Tempering — Temper1</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">TMP-210</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Tempering / Temper1</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — TEMPERING TUNNEL</text>
      <text class="pid-sheet__sub" x="24" y="52">Mass in from Conching → three cooling zones → to Moulding</text>

      <text class="pid-flow-label" x="28" y="${inY - 10}" text-anchor="start">FROM CONCHE</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${inY}" x2="${tunnelX}" y2="${inY}" />
      ${Plant.flowArrow(95, inY)}
      ${Plant.mixValve(140, inY, "Tempering/Inlet/ValveOpen", "Inlet", "XV-201")}
      ${Plant.flange(tunnelX, inY)}

      <g class="pid-tunnel pid-equip--run" data-equip="Temper1" data-tag="Tempering/Temper1/Running" role="button" tabindex="0">
        <rect class="pid-tunnel__shell" x="${tunnelX}" y="${tunnelY}" width="${tunnelW}" height="${tunnelH}" rx="5" />
        ${zones}
        <line class="pid-tunnel__belt" x1="${tunnelX + 20}" y1="${midY}" x2="${tunnelX + tunnelW - 20}" y2="${midY}" />
        <text class="pid-equip__pid" x="${tunnelX + tunnelW / 2}" y="${tunnelY - 12}" text-anchor="middle">TMP-210</text>
        <text class="pid-equip__name" x="${tunnelX + tunnelW / 2}" y="${tunnelY + tunnelH + 22}" text-anchor="middle">Temper1</text>
      </g>

      <line class="pid-pipe pid-pipe--main" x1="${tunnelX + tunnelW}" y1="${outY}" x2="920" y2="${outY}" />
      ${Plant.flange(tunnelX + tunnelW, outY)}
      ${Plant.pumpSymbol(780, outY)}
      ${Plant.mixValve(820, outY, "Tempering/Outlet/ValveOpen", "Outlet", "XV-205")}
      ${Plant.flowArrow(875, outY)}
      <text class="pid-flow-label" x="932" y="${outY - 10}" text-anchor="end">TO MOULD</text>
      ${Plant.massFlowLine(28, inY, 920, outY)}

      <text class="pid-flow-label" x="28" y="352" text-anchor="start">CHILLED WATER</text>
      <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${tunnelX + 50}" y2="${tunnelY + tunnelH}" />
      ${Plant.flange(tunnelX + 50, tunnelY + tunnelH)}
      <line class="pid-pipe pid-pipe--divert" x1="${tunnelX + tunnelW - 50}" y1="${tunnelY + tunnelH}" x2="720" y2="352" />
      ${Plant.flange(tunnelX + tunnelW - 50, tunnelY + tunnelH)}

      ${balloons}
      ${Plant.batchBadge("Tempering/BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.buildRefiningPid = function buildRefiningPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const machineX = 220;
  const machineY = 118;
  const machineW = 520;
  const machineH = 160;
  const midY = machineY + machineH / 2;
  const machineCx = machineX + machineW / 2;
  const rollW = machineW / 5;

  const rolls = [0, 1, 2, 3, 4].map((i) => {
    const x = machineX + 16 + i * (rollW - 4);
    return `<rect class="pid-refiner__roll" x="${x}" y="${machineY + 36}" width="${rollW - 20}" height="${machineH - 72}" rx="4" />`;
  }).join("");

  const balloons = [
    Plant.balloon(90, midY - 52, "FI", "121", "Refining/Inlet/FlowKgH", 140, midY, "Inlet"),
    Plant.balloon(machineCx - 100, 68, "SI", "120", "Refining/Refiner1/LoadPct", machineCx - 50, machineY, "Refiner1"),
    Plant.balloon(machineCx, 68, "QI", "122", "Refining/Refiner1/ParticleUm", machineCx, machineY, "Refiner1"),
    Plant.balloon(machineCx + 100, 68, "PI", "123", "Refining/Refiner1/RollPressureBar", machineCx + 50, machineY, "Refiner1"),
    Plant.balloon(850, midY - 52, "FI", "125", "Refining/Outlet/FlowKgH", 800, midY, "Outlet"),
    Plant.balloon(480, 352, "PI", "126", "Refining/Hydraulic/PressureBar", 480, machineY + machineH + 8, "Hydraulic"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg pid-svg--refining is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Refining Refiner1 P and ID">
      <title>Heuvelland Refining — Refiner1</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">REF-120</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Refining / Refiner1</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — FIVE-ROLL REFINER</text>
      <text class="pid-sheet__sub" x="24" y="52">Mass in from Mixing → Refiner1 → mass out to Conching</text>

      <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM MIX</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${machineX}" y2="${midY}" />
      ${Plant.flowArrow(95, midY)}
      ${Plant.mixValve(140, midY, "Refining/Inlet/ValveOpen", "Inlet", "XV-121")}
      ${Plant.flange(machineX, midY)}

      <g class="pid-refiner pid-equip--run" data-equip="Refiner1" data-tag="Refining/Refiner1/Running" role="button" tabindex="0">
        <rect class="pid-refiner__shell" x="${machineX}" y="${machineY}" width="${machineW}" height="${machineH}" rx="5" />
        ${rolls}
        <text class="pid-equip__pid" x="${machineCx}" y="${machineY - 12}" text-anchor="middle">REF-120</text>
        <text class="pid-equip__name" x="${machineCx}" y="${machineY + machineH + 22}" text-anchor="middle">Refiner1</text>
      </g>

      <line class="pid-pipe pid-pipe--main" x1="${machineX + machineW}" y1="${midY}" x2="920" y2="${midY}" />
      ${Plant.flange(machineX + machineW, midY)}
      ${Plant.pumpSymbol(780, midY)}
      ${Plant.mixValve(820, midY, "Refining/Outlet/ValveOpen", "Outlet", "XV-125")}
      ${Plant.flowArrow(875, midY)}
      <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO CONCHE</text>
      ${Plant.massFlowLine(28, midY, 920, midY)}

      <text class="pid-flow-label" x="28" y="352" text-anchor="start">HYDRAULIC</text>
      <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${machineCx}" y2="${machineY + machineH}" />
      ${Plant.flange(machineCx, machineY + machineH)}

      ${balloons}
      ${Plant.batchBadge("Refining/BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.buildConchingPid = function buildConchingPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const tankX = 340;
  const tankY = 88;
  const tankW = 260;
  const tankH = 240;
  const tankCx = tankX + tankW / 2;
  const midY = tankY + tankH / 2;

  const balloons = [
    Plant.balloon(tankCx - 90, 52, "TI", "130", "Conching/Conche1/TempC", tankCx - 50, tankY, "Conche1"),
    Plant.balloon(tankCx + 90, 52, "SI", "130", "Conching/Conche1/AgitatorRpm", tankCx + 50, tankY, "Conche1"),
    Plant.balloon(tankCx + 120, 300, "CI", "130", "Conching/Conche1/TimeMin", tankCx + 60, tankY + tankH - 20, "Conche1"),
    Plant.balloon(90, midY - 52, "FI", "131", "Conching/Inlet/FlowKgH", 140, midY, "Inlet"),
    Plant.balloon(850, midY - 52, "FI", "135", "Conching/Outlet/FlowKgH", 800, midY, "Outlet"),
    Plant.balloon(200, 352, "FI", "136", "Conching/Jacket/FlowM3H", 200, tankY + tankH, "Jacket"),
    Plant.balloon(480, 352, "TI", "136", "Conching/Jacket/SupplyTempC", 480, tankY + tankH, "Jacket"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg pid-svg--conching is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Conching Conche1 P and ID">
      <title>Heuvelland Conching — Conche1</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">CON-130</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Conching / Conche1</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — CONCHE</text>
      <text class="pid-sheet__sub" x="24" y="52">Mass in from Refining → Conche1 → mass out to Tempering</text>

      <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM REFINE</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${tankX}" y2="${midY}" />
      ${Plant.flowArrow(95, midY)}
      ${Plant.mixValve(140, midY, "Conching/Inlet/ValveOpen", "Inlet", "XV-131")}
      ${Plant.flange(tankX, midY)}

      <g class="pid-tank pid-equip--run" data-equip="Conche1" data-tag="Conching/Conche1/Running" role="button" tabindex="0">
        <rect class="pid-tank__shell" x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="10" />
        <rect class="pid-tank__jacket" x="${tankX + 12}" y="${tankY + 12}" width="${tankW - 24}" height="${tankH - 24}" rx="5" />
        <line class="pid-tank__agitator" x1="${tankCx}" y1="${tankY + 32}" x2="${tankCx}" y2="${tankY + tankH - 32}" />
        <circle class="pid-tank__hub" cx="${tankCx}" cy="${tankY + 44}" r="8" />
        <line class="pid-tank__agitator" x1="${tankCx - 40}" y1="${tankY + 100}" x2="${tankCx + 40}" y2="${tankY + 100}" />
        <line class="pid-tank__agitator" x1="${tankCx - 40}" y1="${tankY + 150}" x2="${tankCx + 40}" y2="${tankY + 150}" />
        <text class="pid-equip__pid" x="${tankCx}" y="${tankY - 12}" text-anchor="middle">CON-130</text>
        <text class="pid-equip__name" x="${tankCx}" y="${tankY + tankH + 20}" text-anchor="middle">Conche1</text>
      </g>

      <line class="pid-pipe pid-pipe--main" x1="${tankX + tankW}" y1="${midY}" x2="920" y2="${midY}" />
      ${Plant.flange(tankX + tankW, midY)}
      ${Plant.pumpSymbol(780, midY)}
      ${Plant.mixValve(820, midY, "Conching/Outlet/ValveOpen", "Outlet", "XV-135")}
      ${Plant.flowArrow(875, midY)}
      <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO TEMPER</text>
      ${Plant.massFlowLine(28, midY, 920, midY)}

      <text class="pid-flow-label" x="28" y="352" text-anchor="start">JACKET WATER</text>
      <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${tankX + 40}" y2="${tankY + tankH}" />
      ${Plant.flange(tankX + 40, tankY + tankH)}
      <line class="pid-pipe pid-pipe--divert" x1="${tankX + tankW - 40}" y1="${tankY + tankH}" x2="720" y2="352" />
      ${Plant.flange(tankX + tankW - 40, tankY + tankH)}

      ${balloons}
      ${Plant.batchBadge("Conching/BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.buildMouldingPid = function buildMouldingPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;

  const vbW = 960;
  const vbH = 420;
  const machineX = 250;
  const machineY = 120;
  const machineW = 460;
  const machineH = 150;
  const midY = machineY + machineH / 2;
  const machineCx = machineX + machineW / 2;

  const cavities = [0, 1, 2].map((i) => {
    const x = machineX + 80 + i * 110;
    return `<rect class="pid-moulder__cavity" x="${x}" y="${machineY + 48}" width="70" height="54" rx="3" />`;
  }).join("");

  const balloons = [
    Plant.balloon(90, midY - 52, "FI", "221", "Moulding/Inlet/FlowKgH", 140, midY, "Inlet"),
    Plant.balloon(machineCx - 100, 68, "SI", "220", "Moulding/Moulder1/CyclesPerMin", machineCx - 60, machineY, "Moulder1"),
    Plant.balloon(machineCx + 40, 68, "TI", "220", "Moulding/Moulder1/MouldTempC", machineCx + 20, machineY, "Moulder1"),
    Plant.balloon(480, 352, "TI", "226", "Moulding/Cooling/AirTempC", 480, machineY + machineH + 8, "Cooling"),
    Plant.balloon(850, midY - 52, "FI", "225", "Moulding/Outlet/FlowKgH", 800, midY, "Outlet"),
  ].join("");

  host.innerHTML = `
    <svg class="pid-svg pid-svg--moulding is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland Moulding Moulder1 P and ID">
      <title>Heuvelland Moulding — Moulder1</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />

      <g class="pid-titleblock">
        <rect class="pid-titleblock__box" x="${vbW - 220}" y="${vbH - 56}" width="208" height="44" />
        <line class="pid-sheet__rule" x1="${vbW - 220}" y1="${vbH - 34}" x2="${vbW - 12}" y2="${vbH - 34}" />
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 42}">DWG</text>
        <text class="pid-titleblock__v" x="${vbW - 180}" y="${vbH - 42}">MLD-220</text>
        <text class="pid-titleblock__k" x="${vbW - 100}" y="${vbH - 42}">REV</text>
        <text class="pid-titleblock__v" x="${vbW - 72}" y="${vbH - 42}">A</text>
        <text class="pid-titleblock__k" x="${vbW - 212}" y="${vbH - 20}">TITLE</text>
        <text class="pid-titleblock__v" x="${vbW - 172}" y="${vbH - 20}">Moulding / Moulder1</text>
        <text class="pid-titleblock__sim" x="${vbW - 28}" y="${vbH - 20}" text-anchor="end">SIM</text>
      </g>

      <text class="pid-sheet__head" x="24" y="36">PROCESS FLOW — MOULDING</text>
      <text class="pid-sheet__sub" x="24" y="52">Mass in from Tempering → Moulder1 → bars to Packaging</text>

      <text class="pid-flow-label" x="28" y="${midY - 10}" text-anchor="start">FROM TEMPER</text>
      <line class="pid-pipe pid-pipe--main" x1="28" y1="${midY}" x2="${machineX}" y2="${midY}" />
      ${Plant.flowArrow(95, midY)}
      ${Plant.mixValve(140, midY, "Moulding/Inlet/ValveOpen", "Inlet", "XV-221")}
      ${Plant.flange(machineX, midY)}

      <g class="pid-moulder pid-equip--run" data-equip="Moulder1" data-tag="Moulding/Moulder1/Running" role="button" tabindex="0">
        <rect class="pid-moulder__shell" x="${machineX}" y="${machineY}" width="${machineW}" height="${machineH}" rx="5" />
        ${cavities}
        <text class="pid-equip__pid" x="${machineCx}" y="${machineY - 12}" text-anchor="middle">MLD-220</text>
        <text class="pid-equip__name" x="${machineCx}" y="${machineY + machineH + 22}" text-anchor="middle">Moulder1</text>
      </g>

      <line class="pid-pipe pid-pipe--main" x1="${machineX + machineW}" y1="${midY}" x2="920" y2="${midY}" />
      ${Plant.flange(machineX + machineW, midY)}
      ${Plant.pumpSymbol(780, midY)}
      ${Plant.mixValve(820, midY, "Moulding/Outlet/ValveOpen", "Outlet", "XV-225")}
      ${Plant.flowArrow(875, midY)}
      <text class="pid-flow-label" x="932" y="${midY - 10}" text-anchor="end">TO PACK</text>
      ${Plant.massFlowLine(28, midY, 920, midY)}

      <text class="pid-flow-label" x="28" y="352" text-anchor="start">COOLING AIR</text>
      <line class="pid-pipe pid-pipe--divert" x1="140" y1="352" x2="${machineX + 60}" y2="${machineY + machineH}" />
      ${Plant.flange(machineX + 60, machineY + machineH)}
      <line class="pid-pipe pid-pipe--divert" x1="${machineX + machineW - 60}" y1="${machineY + machineH}" x2="720" y2="352" />
      ${Plant.flange(machineX + machineW - 60, machineY + machineH)}

      ${balloons}
      ${Plant.batchBadge("Moulding/BatchId", vbH)}
    </svg>`;

  Plant.pidBuilt = true;
}

Plant.buildOverviewPid = function buildOverviewPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;
  const vbW = 960;
  const vbH = 420;
  const boxes = Plant.PLANT_AREAS.map((a, i) => {
    const x = 48 + i * 150;
    const y = 150;
    const w = 118;
    const h = 88;
    return { ...a, x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, left: x };
  });
  const connectors = boxes.slice(0, -1).map((b, i) => {
    const n = boxes[i + 1];
    const x1 = b.right + 2;
    const x2 = n.left - 2;
    const mid = (x1 + x2) / 2;
    const y = b.cy;
    return `
      <line class="pid-pipe pid-pipe--main pid-overview__pipe" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" />
      ${Plant.flowArrow(mid + 2, y)}`;
  }).join("");
  const nodes = boxes.map((b) => `
    <g class="pid-overview__area" data-overview-area="${b.drawing}" data-equip="${b.id}" tabindex="0" role="button" aria-label="Open ${b.id} drawing">
      <rect class="pid-overview__box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" />
      <text class="pid-overview__label" x="${b.cx}" y="${b.y + 36}" text-anchor="middle">${b.id}</text>
      <text class="pid-overview__health" data-overview-health="${b.drawing}" x="${b.cx}" y="${b.y + 58}" text-anchor="middle">—</text>
      <text class="pid-overview__hint" x="${b.cx}" y="${b.y + 74}" text-anchor="middle">OPEN</text>
    </g>`).join("");
  host.innerHTML = `
    <svg class="pid-svg pid-svg--overview is-running" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heuvelland plant overview">
      <title>Heuvelland plant overview — process flow</title>
      <rect class="pid-sheet" x="12" y="12" width="${vbW - 24}" height="${vbH - 24}" />
      <line class="pid-sheet__rule" x1="12" y1="${vbH - 56}" x2="${vbW - 12}" y2="${vbH - 56}" />
      <text class="pid-sheet__title" x="28" y="40">PLANT OVERVIEW</text>
      <text class="pid-sheet__meta" x="28" y="58">HEUVELLAND · MASS FLOW</text>
      <text class="pid-flow-label" x="48" y="130">RAW →</text>
      ${connectors}
      ${nodes}
      <text class="pid-sheet__rev" x="${vbW - 28}" y="${vbH - 28}" text-anchor="end">OVW-01</text>
    </svg>`;
  Plant.pidBuilt = true;
}

Plant.buildPid = function buildPid() {
  if (Plant.state.activeDrawing === "overview") Plant.buildOverviewPid();
  else if (Plant.state.activeDrawing === "mixing") Plant.buildMixingPid();
  else if (Plant.state.activeDrawing === "refining") Plant.buildRefiningPid();
  else if (Plant.state.activeDrawing === "conching") Plant.buildConchingPid();
  else if (Plant.state.activeDrawing === "tempering") Plant.buildTemperingPid();
  else if (Plant.state.activeDrawing === "moulding") Plant.buildMouldingPid();
  else Plant.buildPackagingPid();
}

Plant.clearPidHover = function clearPidHover() {
  document.querySelectorAll(".is-hover").forEach((el) => el.classList.remove("is-hover"));
  Plant.pidHover = null;
}

Plant.applyPidHover = function applyPidHover(tagId, equip) {
  Plant.clearPidHover();
  const ek = equip || Plant.equipKeyForTag(tagId);
  Plant.pidHover = { tagId: tagId || null, equip: ek || null };
  if (ek) {
    document.querySelectorAll(`#plant-pid [data-equip="${ek}"]`).forEach((el) => el.classList.add("is-hover"));
  }
  if (tagId) {
    document.querySelectorAll(`#plant-pid [data-tag="${CSS.escape(tagId)}"]`).forEach((el) => el.classList.add("is-hover"));
    document.querySelectorAll(`#plant-tree .plant-tag[data-tag="${CSS.escape(tagId)}"]`).forEach((el) => el.classList.add("is-hover"));
  }
}

Plant.paintPid = function paintPid() {
  const host = document.getElementById("plant-pid");
  if (!host) return;
  if (!Plant.pidBuilt) Plant.buildPid();

  const jam = Plant.state.scenario === "jam" && !Plant.state.cartonerJamCleared;
  const starved = Plant.state.scenario === "starved";
  const svg = host.querySelector(".pid-svg");
  if (!svg) return;
  const drawing = Plant.state.activeDrawing;

  if (drawing === "overview") {
    const here = Plant.batchStepIndex(Plant.live.__batchPhase?.value ?? (Plant.tick % 90));
    svg.classList.remove("is-running", "is-fault", "is-warn");
    const anyFault = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "fault");
    const anyWarn = Plant.PLANT_AREAS.some((a) => Plant.areaHealth(a.drawing) === "warn");
    svg.classList.add(anyFault ? "is-fault" : anyWarn ? "is-warn" : "is-running");
    svg.querySelectorAll("[data-pid-flow], .pid-overview__pipe").forEach((flow) => {
      flow.style.display = Plant.reducedMotion || anyFault ? "none" : "";
    });
    svg.querySelectorAll(".pid-overview__area").forEach((g) => {
      const d = g.getAttribute("data-overview-area");
      const health = Plant.areaHealth(d);
      g.classList.remove("is-run", "is-fault", "is-warn", "is-batch", "is-selected");
      g.classList.add(`is-${health === "run" ? "run" : health}`);
      const idx = Plant.BATCH_STEPS.indexOf(d);
      if (idx === here) g.classList.add("is-batch");
      const healthEl = g.querySelector("[data-overview-health]");
      if (healthEl) healthEl.textContent = health.toUpperCase();
    });
    const banner = document.getElementById("plant-pid-alarm");
    if (banner) {
      const crit = Plant.state.alarms.find((a) => a.severity === "critical") || Plant.state.alarms[0];
      if (!crit) {
        banner.hidden = true;
        banner.textContent = "";
      } else {
        banner.hidden = false;
        banner.dataset.severity = crit.severity;
        banner.textContent = crit.message;
      }
    }
    return;
  }

  const mixing = drawing === "mixing";
  const refining = drawing === "refining";
  const conching = drawing === "conching";
  const tempering = drawing === "tempering";
  const moulding = drawing === "moulding";
  const mixOver = Plant.state.mixScenario === "overtemp";
  const mixValve = Plant.state.mixScenario === "valve";

  const temperWarm = Plant.state.temperScenario === "warm";
  const temperBelt = Plant.state.temperScenario === "belt";
  const refinePressure = Plant.state.refineScenario === "pressure";
  const refineParticle = Plant.state.refineScenario === "particle";
  const concheOver = Plant.state.concheScenario === "overtemp";
  const concheAgit = Plant.state.concheScenario === "agitator";
  const mouldJam = Plant.state.mouldScenario === "jam";
  const mouldCool = Plant.state.mouldScenario === "cool";

  svg.classList.remove("is-running", "is-fault", "is-warn");
  if (mixing) svg.classList.add(mixOver ? "is-fault" : mixValve ? "is-warn" : "is-running");
  else if (tempering) svg.classList.add(temperWarm ? "is-fault" : temperBelt ? "is-warn" : "is-running");
  else if (refining) svg.classList.add(refinePressure ? "is-fault" : refineParticle ? "is-warn" : "is-running");
  else if (conching) svg.classList.add(concheOver ? "is-fault" : concheAgit ? "is-warn" : "is-running");
  else if (moulding) svg.classList.add(mouldJam ? "is-fault" : mouldCool ? "is-warn" : "is-running");
  else svg.classList.add(jam ? "is-fault" : starved ? "is-warn" : "is-running");

  const flowShow = (() => {
    if (Plant.reducedMotion) return false;
    if (mixing) return !mixOver && !mixValve;
    if (tempering) return !temperWarm && !temperBelt;
    if (refining) return !refinePressure && !refineParticle && (Plant.live["Refining/Mode"]?.value ?? "") !== "STARVED";
    if (conching) return !concheOver && !concheAgit && (Plant.live["Conching/Mode"]?.value ?? "") !== "STARVED";
    if (moulding) return !mouldJam && !mouldCool && (Plant.live["Moulding/Mode"]?.value ?? "") !== "STARVED";
    return !jam && !starved;
  })();
  svg.querySelectorAll("[data-pid-flow]").forEach((flow) => {
    flow.style.display = flowShow ? "" : "none";
  });

  const batchEl = svg.querySelector("[data-pid-batch]");
  if (batchEl) {
    const batchTag = batchEl.getAttribute("data-pid-batch");
    batchEl.textContent = String((Plant.live[batchTag] || {}).value ?? "—");
    const batchGroup = batchEl.closest(".pid-batch");
    if (batchGroup) {
      batchGroup.classList.toggle("is-selected", batchTag === Plant.state.selectedTag);
    }
  }

  if (mixing) {
    const tank = svg.querySelector(".pid-tank");
    if (tank) {
      tank.classList.remove("is-selected", "is-hover", "is-fault", "is-warn", "is-alarm");
      if (Plant.state.selectedTag.startsWith("Mixing/Mixer1")) tank.classList.add("is-selected");
      if (mixOver) tank.classList.add("is-fault");
      else if (mixValve) tank.classList.add("is-warn");
    }
    const level = (Plant.live["Mixing/Mixer1/LevelPct"] || {}).value ?? 50;
    const levelEl = svg.querySelector("[data-pid-level]");
    if (levelEl) {
      const tankTop = Number(levelEl.getAttribute("data-tank-top") || 134);
      const tankH = Number(levelEl.getAttribute("data-tank-inner-h") || 172);
      const h = Math.max(8, (tankH * level) / 100);
      const top = tankTop + (tankH - h);
      levelEl.setAttribute("y", String(top));
      levelEl.setAttribute("height", String(h));
    }
    svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
      const tagId = g.getAttribute("data-tag");
      const open = !!(Plant.live[tagId] || {}).value;
      g.classList.toggle("is-open", open);
      g.classList.toggle("is-fault", mixValve && tagId === "Mixing/CocoaLiquor/ValveOpen");
      g.classList.toggle("is-selected", tagId === Plant.state.selectedTag);
      g.classList.remove("is-hover", "is-alarm");
    });
  } else if (tempering) {
    const tunnel = svg.querySelector(".pid-tunnel");
    if (tunnel) {
      tunnel.classList.remove("is-selected", "is-hover", "is-fault", "is-warn", "is-alarm");
      if (Plant.state.selectedTag.startsWith("Tempering/Temper1")) tunnel.classList.add("is-selected");
      if (temperWarm) tunnel.classList.add("is-fault");
      else if (temperBelt) tunnel.classList.add("is-warn");
    }
    svg.querySelectorAll(".pid-tunnel__zone").forEach((z) => {
      z.classList.toggle("is-warm", temperWarm);
    });
    const belt = svg.querySelector(".pid-tunnel__belt");
    if (belt) belt.classList.toggle("is-stopped", temperBelt);
    svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
      const tagId = g.getAttribute("data-tag");
      const open = !!(Plant.live[tagId] || {}).value;
      g.classList.toggle("is-open", open);
      g.classList.toggle("is-selected", tagId === Plant.state.selectedTag);
      g.classList.remove("is-hover", "is-alarm");
    });
  } else if (refining || conching || moulding) {
    const equipSel = refining
      ? "Refining/Refiner1"
      : conching
        ? "Conching/Conche1"
        : "Moulding/Moulder1";
    const equipEl = svg.querySelector(
      refining ? ".pid-refiner" : conching ? ".pid-tank" : ".pid-moulder"
    );
    if (equipEl) {
      equipEl.classList.remove("is-selected", "is-hover", "is-fault", "is-warn", "is-alarm");
      if (Plant.state.selectedTag.startsWith(equipSel)) equipEl.classList.add("is-selected");
      if (refining && refinePressure) equipEl.classList.add("is-fault");
      else if (refining && refineParticle) equipEl.classList.add("is-warn");
      else if (conching && concheOver) equipEl.classList.add("is-fault");
      else if (conching && concheAgit) equipEl.classList.add("is-warn");
      else if (moulding && mouldJam) equipEl.classList.add("is-fault");
      else if (moulding && mouldCool) equipEl.classList.add("is-warn");
    }
    svg.querySelectorAll(".pid-mix-valve").forEach((g) => {
      const tagId = g.getAttribute("data-tag");
      const open = !!(Plant.live[tagId] || {}).value;
      g.classList.toggle("is-open", open);
      g.classList.toggle("is-selected", tagId === Plant.state.selectedTag);
      g.classList.remove("is-hover", "is-alarm");
    });
  } else {
    Plant.EQUIPMENT.forEach((eq) => {
      const g = svg.querySelector(`.pid-equip[data-equip="${eq.id}"]`);
      if (!g) return;
      const st = Plant.equipState(eq.id);
      g.classList.remove("pid-equip--run", "pid-equip--fault", "pid-equip--warn", "pid-equip--idle", "is-selected", "is-hover", "is-alarm");
      g.classList.add(`pid-equip--${st}`);
      if (Plant.state.selectedTag.startsWith(eq.id + "/") || Plant.state.selectedTag === `${eq.id}/Running`) {
        g.classList.add("is-selected");
      }
    });

    const rejectActive = !!(Plant.live["Checkweigher/Reject/Active"] || {}).value;
    const rejectSel = Plant.state.selectedTag.startsWith("Checkweigher/Reject");
    const valve = svg.querySelector(".pid-valve");
    const bin = svg.querySelector(".pid-bin");
    if (valve) {
      valve.classList.toggle("is-active", rejectActive);
      valve.classList.toggle("is-selected", rejectSel);
      valve.classList.remove("is-hover", "is-alarm");
    }
    if (bin) {
      bin.classList.toggle("is-selected", rejectSel);
      bin.classList.remove("is-hover", "is-alarm");
      const count = bin.querySelector("[data-pid-reject-count]");
      if (count) count.textContent = String(Math.round(Plant.live["Checkweigher/Reject/Count"]?.value ?? Plant.state.rejectCount));
    }
  }

  const sheetAlarms = Plant.state.alarms.filter((a) => Plant.ALARM_PID[a.id]?.drawing === drawing);
  sheetAlarms.forEach((a) => {
    const meta = Plant.ALARM_PID[a.id];
    if (!meta) return;
    const nodes = svg.querySelectorAll(`[data-equip="${CSS.escape(meta.equip)}"]`);
    nodes.forEach((el) => {
      el.classList.add("is-alarm");
      if (meta.severity === "critical") el.classList.add("is-fault");
      else el.classList.add("is-warn");
    });
  });
  const banner = document.getElementById("plant-pid-alarm");
  if (banner) {
    if (!sheetAlarms.length) {
      banner.hidden = true;
      banner.textContent = "";
    } else {
      banner.hidden = false;
      const top = sheetAlarms.find((a) => a.severity === "critical") || sheetAlarms[0];
      banner.dataset.severity = top.severity;
      banner.textContent = top.message;
    }
  }

  svg.querySelectorAll(".pid-balloon").forEach((g) => {
    const tagId = g.getAttribute("data-tag");
    const q = (Plant.live[tagId] || {}).quality || "Stale";
    g.classList.remove("pid-q--good", "pid-q--uncertain", "pid-q--bad", "pid-q--stale", "is-selected", "is-hover");
    g.classList.add(`pid-q--${q.toLowerCase()}`);
    if (tagId === Plant.state.selectedTag) g.classList.add("is-selected");
    const valEl = g.querySelector("[data-pid-val]");
    if (valEl) valEl.textContent = Plant.liveReadout(tagId);
  });

  if (Plant.pidHover) Plant.applyPidHover(Plant.pidHover.tagId, Plant.pidHover.equip);
}

Plant.renderPid = function renderPid() {
  Plant.paintPid();
}
