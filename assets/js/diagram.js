/* Skills "Toolbelt" reference-architecture diagram.
   Split out of script.js so this ~430-line SVG component lives on its own.
   Self-contained: no dependency on script.js. Builds the diagram, wires the
   chip <-> block hover highlight and the click popover once the DOM is ready.
   Reads the DOM and window.SKILL_META (assets/js/skill-meta.js). */
(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Small SVG helpers (same shape as the copies in script.js; kept here so this
     file stands alone without a bundler). */
  function append(ns, parent, tag, attrs) {
    const el = document.createElementNS(ns, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el);
    return el;
  }
  function pathAbs(pts) {
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  }
  function pathRel(pts) {
    const [x0, y0] = pts[0];
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${x - x0} ${y - y0}`).join(" ");
  }

  /* ----------------------------------------------------
     6b. Stack diagram — the real architecture behind the
         toolbelt, in three tiers:
           1. DATA FLOW   field → edge → broker → backend →
                          stores → consumers (left→right)
           2. PLATFORM    the band it all runs on (K8s, Docker,
                          Azure, Linux)
           3. DELIVERY    the GitOps rail that ships it
         Every block carries a `skills` list; hovering a skill
         chip below lights up its block(s) here and vice-versa
         (wireStackHighlight). Coordinates are in the 860×430
         viewBox. Particles travel source→target to convey flow.
     ---------------------------------------------------- */

  const STACK_STAGES = [
    { x:  72, label: "FIELD" },
    { x: 210, label: "EDGE" },
    { x: 350, label: "BROKER" },
    { x: 520, label: "GATEWAY" },
    { x: 780, label: "CONSUMERS" },
  ];

  /* Nodes are labeled blocks (schematic style, like Ignition designer views).
     Width is derived from the label unless `w` is given. `skills` ties a block
     to the chips below it for the hover cross-highlight. */
  const STACK_NODES = {
    /* --- MQTT-hub / Unified-Namespace model. Field devices are physical OT
           (off the platform slab). MQTT is the central bus that the edge, the
           Ignition gateway, MES and the data lake all publish/subscribe to. --- */
    plc:      { x:  72, y:  92, label: "PLC / RTU",     kind: "field"    },
    sensor:   { x:  72, y: 150, label: "Sensor",        kind: "field"    },
    opcua:    { x:  72, y: 208, label: "OPC UA",        kind: "field",    skills: ["opc-ua"] },
    spdev:    { x:  72, y: 266, label: "Smart sensor",  kind: "field",    skills: ["sparkplug-b"] },
    edge:     { x: 210, y: 150, label: "Ignition Edge", kind: "edge",     skills: ["ignition", "ot-it", "kepware"] },
    nodered:  { x: 210, y: 208, label: "Node-RED",      kind: "edge",     skills: ["node-red"] },
    mqtt:     { x: 350, y: 172, label: "MQTT",          kind: "broker",   skills: ["mqtt", "sparkplug-b", "unified-namespace", "ot-it", "kafka", "mosquitto", "emqx", "rabbitmq"] },
    backend:  { x: 520, y: 158, label: "Ignition",      kind: "server",   skills: ["ignition", "traefik"] },
    svc:      { x: 520, y: 216, label: "Services",      kind: "server",   skills: ["python", "fastapi", "pydantic", "sqlalchemy", "data-pipelines"] },
    /* storage / data tier, spread along the bottom */
    lake:     { x: 355, y: 292, label: "Data Lake",     kind: "storage" },
    sql:      { x: 468, y: 292, label: "SQL database",  kind: "storage",  skills: ["postgresql", "sql-server"] },
    redis:    { x: 562, y: 292, label: "Redis",         kind: "storage",  skills: ["redis"], w: 56 },
    tsdb:     { x: 650, y: 292, label: "Historian",     kind: "storage",  skills: ["influxdb", "timescaledb", "factry", "data-pipelines"] },
    /* consumers column, MES on top */
    mes:      { x: 780, y:  92, label: "MES",           kind: "consumer", w: 64, skills: ["mes"] },
    hmi:      { x: 780, y: 150, label: "HMI",           kind: "consumer", w: 64, skills: ["hmi"] },
    scada:    { x: 780, y: 208, label: "SCADA",         kind: "consumer", w: 64, skills: ["scada"] },
    graf:     { x: 780, y: 266, label: "Grafana",       kind: "consumer", w: 64, skills: ["grafana", "prometheus", "loki"] },

    /* --- platform tier: a single foundation slab the whole software stack
           runs on (field devices excepted). "Cloud" stays generic — multiple
           cloud platforms, not just one. --- */
    linux:    { x: 285, y: 371, label: "Linux",         kind: "platform", skills: ["linux"], w: 58 },
    docker:   { x: 425, y: 371, label: "Docker",        kind: "platform", skills: ["docker"] },
    k8s:      { x: 565, y: 371, label: "Kubernetes",    kind: "platform", skills: ["kubernetes"] },
    cloud:    { x: 705, y: 371, label: "Cloud",         kind: "platform", skills: ["azure", "gcp"], w: 60 },
  };

  /* Skills routed to the "provisioned & shipped via GitOps" tag rather than to
     a data-flow block — they describe how the platform is built and deployed. */
  const DELIVERY_SKILLS = ["terraform", "argo-cd", "gitops", "ci-cd", "git", "github-actions", "azure-devops", "helm"];

  /* Edges as [fromId, toId, opts] — particles flow from→to.
       spine: true   main data path, drawn heavier
       route:        "elbow" (H-V-H between columns), "tbranch" (drop from the
                     block bottom, then split), "comb" (shared trunk fan-out);
                     omitted = straight horizontal
       out: true     downstream of the gateway — particles turn emerald
                     (data becomes decisions) */
  const STACK_EDGES = [
    // acquisition into the broker
    ["plc",      "edge",     { route: "elbow" }],
    ["sensor",   "edge",     { route: "elbow" }],
    ["opcua",    "nodered",  { route: "elbow" }],
    ["edge",     "mqtt",     { spine: true }],
    ["nodered",  "mqtt",     { route: "elbow" }],
    ["spdev",    "mqtt",     { route: "spk" }],             // smart sensor straight to MQTT (Sparkplug B)
    // Ignition Gateway Network — edge talks to the gateway directly, over the top
    ["edge",     "backend",  { route: "over" }],
    // the gateway publishes AND subscribes on MQTT; the data lake ingests from it
    ["mqtt",     "backend",  { spine: true, bidir: true }],
    ["mqtt",     "lake",     { route: "tbranch" }],
    // MES is a bus participant — reads and writes over MQTT (big L) and the gateway
    ["mes",      "mqtt",     { route: "bigL",  bidir: true, out: true }],
    ["mes",      "backend",  { route: "bigLr", bidir: true, out: true }],
    // Ignition persists to the historian directly; services handle the rest
    ["backend",  "tsdb",     { route: "tbranch" }],
    ["svc",      "sql",      { route: "tbranch" }],
    ["svc",      "redis",    { route: "tbranch" }],
    // consumers, each from its real source
    ["backend",  "hmi",      { route: "comb", out: true }],
    ["backend",  "scada",    { route: "comb", out: true, spine: true }],
    ["tsdb",     "graf",     { route: "elbow", out: true }],   // Grafana reads the historian
  ];

  /* Block geometry helpers */
  const BLOCK_H = 26;
  const BROKER_H = 34;
  function blockRect(n) {
    const w = n.w || Math.max(56, n.label.length * 6.4 + 22);
    const h = n.kind === "broker" ? BROKER_H : BLOCK_H;
    return { w, h, x1: n.x - w / 2, y1: n.y - h / 2, x2: n.x + w / 2, y2: n.y + h / 2 };
  }

  /* Orthogonal (right-angle) waypoints from one block edge to another */
  function edgePoints(from, to, opts) {
    const a = blockRect(from), b = blockRect(to);
    const route = opts && opts.route;
    if (route === "elbow") {
      // leave right side, turn in the column gap, enter left side —
      // offset the entry row so parallel elbows don't pile onto one point
      const xm = (a.x2 + b.x1) / 2;
      const yIn = to.y + (from.y < to.y ? -7 : 7);
      return [[a.x2, from.y], [xm, from.y], [xm, yIn], [b.x1, yIn]];
    }
    if (route === "tbranch") {
      // drop from the block bottom, split sideways, drop into the target top
      const ym = (a.y2 + b.y1) / 2;
      return [[from.x, a.y2], [from.x, ym], [to.x, ym], [to.x, b.y1]];
    }
    if (route === "over") {
      // arc just over the broker: leave source top, run across, drop into target top
      const yTop = Math.min(a.y1, b.y1) - 20;
      return [[from.x, a.y1], [from.x, yTop], [to.x, yTop], [to.x, b.y1]];
    }
    if (route === "bigL") {
      // one clean L: run left along the source's own row, then straight down
      // into the target's top edge
      return [[a.x1, from.y], [to.x, from.y], [to.x, b.y1]];
    }
    if (route === "bigLr") {
      // like bigL, but enter the target's right side (target sits higher up)
      const xt = b.x2 + 18;
      return [[a.x1, from.y], [xt, from.y], [xt, to.y], [b.x2, to.y]];
    }
    if (route === "spk") {
      // sparkplug device in the field column: run right under the edge tier,
      // then up into the broker's bottom-left corner (bypasses the edge)
      const turnX = to.x - 58;
      return [[a.x2, from.y], [turnX, from.y], [turnX, b.y2], [b.x1, b.y2]];
    }
    if (route === "comb") {
      // shared vertical trunk just right of the source, teeth into each target
      if (from.y === to.y) return [[a.x2, from.y], [b.x1, to.y]];
      const xt = a.x2 + 14;
      return [[a.x2, from.y], [xt, from.y], [xt, to.y], [b.x1, to.y]];
    }
    return [[a.x2, from.y], [b.x1, to.y]];
  }

  /* Tier scaffolding — a single platform slab under the whole software span
     (edge → consumers), plus a "provisioned & shipped via GitOps" tag. Kept as
     constants so the build and the highlight share them. */
  const PLATFORM_SLAB = { x1: 150, y1: 348, x2: 810, y2: 394 };

  function buildStackDiagram() {
    const svg = document.getElementById("stack-svg");
    if (!svg) return;

    const svgNS      = "http://www.w3.org/2000/svg";
    const stagesG    = svg.querySelector(".stack-svg__stages");
    const edgesG     = svg.querySelector(".stack-svg__edges");
    const particlesG = svg.querySelector(".stack-svg__particles");
    const nodesG     = svg.querySelector(".stack-svg__nodes");

    /* ---- OT ↔ IT boundary: field devices are physical OT, the rest is software IT ---- */
    append(svgNS, stagesG, "line", {
      class: "stack-svg__otit", x1: 145, y1: 40, x2: 145, y2: 310,
    });
    ["OT", "IT"].forEach((t, i) => {
      const lbl = append(svgNS, stagesG, "text", {
        class: "stack-svg__otit-label", x: i === 0 ? 137 : 153,
        y: 38, "text-anchor": i === 0 ? "end" : "start",
      });
      lbl.textContent = t;
    });

    /* ---- Stage labels at top + faint column dividers (data-flow tier only) ---- */
    STACK_STAGES.forEach((stage, i) => {
      const t = append(svgNS, stagesG, "text", {
        class: "stack-svg__stage-label",
        x: stage.x,
        y: 22,
      });
      t.textContent = stage.label;

      // Dashed divider between stages (skip after the last)
      if (i < STACK_STAGES.length - 1) {
        const midX = (stage.x + STACK_STAGES[i + 1].x) / 2;
        append(svgNS, stagesG, "line", {
          class: "stack-svg__stage-divider",
          x1: midX, y1: 45,
          x2: midX, y2: 272,
        });
      }
    });

    /* ---- Data-stores slab (behind the blocks) — same slab style as the
           platform tier, but sized snug around the four stores so it doesn't
           collide with the feed lines routing past it ---- */
    append(svgNS, stagesG, "rect", {
      class: "stack-svg__slab",
      x: 304, y: 276, width: 400, height: 33, rx: 10,
    });
    const dataLabel = append(svgNS, stagesG, "text", {
      class: "stack-svg__tier-label", x: 304, y: 270,
    });
    dataLabel.textContent = "// data stores";

    /* ---- Platform slab scaffolding (behind the blocks) ---- */
    const b = PLATFORM_SLAB;
    append(svgNS, stagesG, "rect", {
      class: "stack-svg__slab",
      x: b.x1, y: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1, rx: 10,
    });
    const platLabel = append(svgNS, stagesG, "text", {
      class: "stack-svg__tier-label", x: b.x1, y: b.y1 - 6,
    });
    platLabel.textContent = "// platform · runs on";

    // "runs on" accolade — a dashed bracket that embraces the software span
    // (end-caps point up towards it) with a centre stem pointing down to the
    // slab. Sits above the (short, left) title so nothing crosses the text.
    append(svgNS, stagesG, "path", {
      class: "stack-svg__runson",
      d: `M 195 320 L 195 326 L 810 326 L 810 320 M 500 326 L 500 ${b.y1}`,
    });

    // "provisioned & shipped via GitOps" — a tag that taps up into the slab.
    // Grouped as a stack-node so every delivery/IaC chip lights it up.
    const gitTag = append(svgNS, nodesG, "g", {
      class: "stack-node stack-node--tag", "data-skills": DELIVERY_SKILLS.join(" "),
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap", d: `M 180 415 L 180 ${b.y2}`,
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap-head", d: `M 176 399 L 180 ${b.y2} L 184 399`,
    });
    const gitText = append(svgNS, gitTag, "text", {
      class: "stack-svg__tag-label", x: 194, y: 415,
    });
    gitText.textContent = "provisioned & shipped via GitOps";

    /* ---- Edges (orthogonal polylines): the data flow ---- */
    STACK_EDGES.forEach(([fromId, toId, opts]) => {
      const from = STACK_NODES[fromId];
      const to   = STACK_NODES[toId];
      if (!from || !to) return;
      append(svgNS, edgesG, "path", {
        d: pathAbs(edgePoints(from, to, opts)),
        class: opts && opts.spine ? "is-spine" : "",
      });
    });

    /* ---- Particles: constant speed on every edge (duration ∝ path length),
           with more dots on longer paths so spacing stays even. Bidir edges
           get a return stream too. ---- */
    if (!prefersReducedMotion) {
      const SPEED = 46;    // px/sec, shared by every edge so dots move in step
      const GAP   = 130;   // target spacing between dots along a path
      const pathLen = (pts) => {
        let L = 0;
        for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        return L;
      };
      const addStream = (pts, opts, i) => {
        const len   = pathLen(pts);
        const dur   = Math.max(1.6, len / SPEED);
        const count = Math.min(4, Math.max(1, Math.round(len / GAP)));
        const rel   = pathRel(pts);
        for (let k = 0; k < count; k++) {
          const dot = append(svgNS, particlesG, "circle", {
            r: 2.4, cx: pts[0][0], cy: pts[0][1],
            class: opts && opts.out ? "is-out" : "",
          });
          // negative begin spreads the dots evenly along the path; the per-edge
          // term keeps different edges from pulsing in lockstep
          const begin = -(dur * (k / count)) - ((i * 0.37) % 1);
          append(svgNS, dot, "animateMotion", {
            dur: `${dur.toFixed(2)}s`, repeatCount: "indefinite",
            begin: `${begin.toFixed(2)}s`, path: rel,
          });
        }
      };
      STACK_EDGES.forEach(([fromId, toId, opts], i) => {
        const from = STACK_NODES[fromId];
        const to   = STACK_NODES[toId];
        if (!from || !to) return;
        const pts = edgePoints(from, to, opts);
        addStream(pts, opts, i);
        if (opts && opts.bidir) addStream([...pts].reverse(), opts, i + 0.5);
      });
    }

    /* ---- Nodes: labeled blocks wrapped in a group so the whole block
           (rect + label) highlights together and carries its skill tags ---- */
    Object.entries(STACK_NODES).forEach(([nodeId, n]) => {
      const r = blockRect(n);

      if (n.kind === "broker") {
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__center-halo",
          cx: n.x, cy: n.y, r: 30,
        });
      }

      const g = append(svgNS, nodesG, "g", {
        class: "stack-node",
        "data-node": nodeId,
        ...(n.skills ? { "data-skills": n.skills.join(" ") } : {}),
      });

      append(svgNS, g, "rect", {
        class: `stack-svg__block stack-svg__block--${n.kind}`,
        x: r.x1, y: r.y1, width: r.w, height: r.h, rx: 6,
      });

      const label = append(svgNS, g, "text", {
        class: `stack-svg__block-label stack-svg__block-label--${n.kind}`,
        x: n.x, y: n.y, dy: "0.35em",
      });
      label.textContent = n.label;
    });

    wireStackHighlight(svg);
  }

  /* Cross-highlight: hovering a skill chip lights its block(s) in the diagram,
     and hovering a block lights its chip(s). Pure progressive enhancement —
     the chips and blocks are fully legible without it. */
  function wireStackHighlight(svg) {
    const chips = Array.from(document.querySelectorAll(".skill-chip[data-skill]"));
    const nodes = Array.from(svg.querySelectorAll(".stack-node[data-skills]"));
    if (!chips.length || !nodes.length) return;

    const setActive = (slug, on) => {
      nodes.forEach((g) => {
        if (g.dataset.skills.split(" ").includes(slug)) g.classList.toggle("is-linked", on);
      });
      chips.forEach((c) => {
        if (c.dataset.skill === slug) c.classList.toggle("is-linked", on);
      });
      svg.classList.toggle("is-spotlighting", on ? true : svg.querySelector(".is-linked") != null);
    };

    chips.forEach((c) => {
      const slug = c.dataset.skill;
      c.addEventListener("mouseenter", () => setActive(slug, true));
      c.addEventListener("mouseleave", () => setActive(slug, false));
    });
    nodes.forEach((g) => {
      const slugs = g.dataset.skills.split(" ");
      g.addEventListener("mouseenter", () => slugs.forEach((s) => setActive(s, true)));
      g.addEventListener("mouseleave", () => slugs.forEach((s) => setActive(s, false)));
    });
  }

  /* Clicking a skill chip opens a popover: an on-brand icon (a real brand glyph
     recoloured to the site cyan, or a cyan role-icon) plus a one-line "what it
     is". Data lives in skill-meta.js. Hover still drives the diagram highlight;
     click drives the description — and on touch, where hover is dead, this is
     the interaction. */
  function initSkillPopover() {
    const meta  = window.SKILL_META || {};
    const roles = window.SKILL_ROLE_ICONS || {};
    const chips = Array.from(document.querySelectorAll(".skill-chip[data-skill]"));
    if (!chips.length) return;

    const pop = document.createElement("div");
    pop.className = "skill-popover";
    pop.setAttribute("role", "dialog");
    pop.hidden = true;
    document.body.appendChild(pop);
    let current = null;

    const iconSVG = (m) => m.brand
      ? `<svg class="skill-popover__glyph is-brand" viewBox="0 0 24 24" aria-hidden="true"><path d="${m.brand}"/></svg>`
      : `<svg class="skill-popover__glyph is-role" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${roles[m.role] || ""}</svg>`;

    function close() {
      if (!current) return;
      pop.hidden = true;
      current.setAttribute("aria-expanded", "false");
      current = null;
    }

    function open(chip) {
      const m = meta[chip.dataset.skill];
      if (!m) return;
      pop.innerHTML =
        `<div class="skill-popover__head">${iconSVG(m)}<span class="skill-popover__name">${m.name}</span></div>` +
        (m.full ? `<p class="skill-popover__full">${m.full}</p>` : "") +
        `<p class="skill-popover__desc">${m.desc}</p>`;
      pop.hidden = false;

      const r = chip.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      const vw = document.documentElement.clientWidth;
      let left = r.left + window.scrollX + r.width / 2 - pw / 2;
      left = Math.max(window.scrollX + 10, Math.min(left, window.scrollX + vw - pw - 10));
      // default below the chip; flip above if it would overflow the viewport
      let top = r.bottom + window.scrollY + 8;
      if (r.bottom + 8 + ph > window.innerHeight && r.top - 8 - ph > 0) {
        top = r.top + window.scrollY - ph - 8;
        pop.classList.add("is-above");
      } else {
        pop.classList.remove("is-above");
      }
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top  = `${Math.round(top)}px`;
      chip.setAttribute("aria-expanded", "true");
      current = chip;
    }

    chips.forEach((chip) => {
      chip.setAttribute("aria-haspopup", "dialog");
      chip.setAttribute("aria-expanded", "false");
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        if (current === chip) { close(); return; }
        close();
        open(chip);
      });
    });

    document.addEventListener("click", (e) => { if (current && !pop.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
  }

  /* ---- init (self-contained; no-op on pages without #stack-svg) ---- */
  function init() {
    buildStackDiagram();
    initSkillPopover();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
