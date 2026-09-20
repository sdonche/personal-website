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
     Stack diagram — architecture behind the toolbelt.
     Three tiers, kept deliberately sparse so the spine reads:
       1. DATA FLOW   field → edge → broker → gateway →
                      stores → consumers (left→right)
       2. PLATFORM    Linux / Docker / K8s / Cloud
       3. DELIVERY    GitOps tag under the platform slab
     Every block can carry a `skills` list; hovering a chip
     below lights its block(s) and vice-versa. Coordinates
     are in the 860×400 viewBox. Particles travel source→target.
     ---------------------------------------------------- */

  const STACK_STAGES = [
    { x:  72, label: "FIELD" },
    { x: 210, label: "EDGE" },
    { x: 350, label: "BROKER" },
    { x: 520, label: "GATEWAY" },
    { x: 780, label: "CONSUMERS" },
  ];

  /* Nodes are labeled blocks (schematic style). Width is derived from the
     label unless `w` is given. `skills` ties a block to the chip index below. */
  const STACK_NODES = {
    /* Field: one physical OT box + one protocols box (was four crowded nodes). */
    field:    { x:  72, y: 130, label: "Field devices", kind: "field",    w: 92 },
    ot:       { x:  72, y: 200, label: "OT protocols",  kind: "field",    skills: ["opc-ua", "sparkplug-b"], w: 92 },
    /* Single edge gateway — Node-RED removed from the public toolbelt. */
    edge:     { x: 210, y: 165, label: "Ignition Edge", kind: "edge",     skills: ["ignition", "ot-it", "kepware"] },
    /* skills = chips that locate this block. Keep membership exclusive where
       a shared slug would otherwise light a neighbour (e.g. data-pipelines).
       Multi-home chips (Sparkplug B, Ignition) still intentionally span nodes. */
    mqtt:     { x: 350, y: 165, label: "MQTT",          kind: "broker",   skills: ["mqtt", "sparkplug-b", "unified-namespace", "kafka", "mosquitto", "emqx"] },
    backend:  { x: 520, y: 130, label: "Ignition",      kind: "server",   skills: ["ignition", "traefik"] },
    svc:      { x: 520, y: 200, label: "Services",      kind: "server",   skills: ["python", "fastapi", "pydantic", "sqlalchemy", "data-pipelines"] },
    /* One stores block — Redis / InfluxDB dropped from the chip index. */
    stores:   { x: 520, y: 278, label: "Data stores",   kind: "storage",  skills: ["postgresql", "sql-server", "timescaledb", "factry"], w: 96 },
    mes:      { x: 780, y: 100, label: "MES",           kind: "consumer", w: 64, skills: ["mes"] },
    hmi:      { x: 780, y: 165, label: "HMI / SCADA",   kind: "consumer", w: 90, skills: ["hmi-scada"], popover: "hmi-scada" },
    graf:     { x: 780, y: 230, label: "Grafana",       kind: "consumer", w: 64, skills: ["grafana", "prometheus", "loki"] },

    linux:    { x: 285, y: 348, label: "Linux",         kind: "platform", skills: ["linux"], w: 58 },
    docker:   { x: 425, y: 348, label: "Docker",        kind: "platform", skills: ["docker"] },
    k8s:      { x: 565, y: 348, label: "Kubernetes",    kind: "platform", skills: ["kubernetes"] },
    cloud:    { x: 705, y: 348, label: "Cloud",         kind: "platform", skills: ["cloud"], w: 60, popover: "cloud" },
  };

  /* Skills routed to the "provisioned & shipped via GitOps" tag rather than to
     a data-flow block — they describe how the platform is built and deployed. */
  const DELIVERY_SKILLS = ["gitops", "terraform", "argo-cd", "ci-cd", "git", "github-actions", "azure-devops", "helm"];
  const DELIVERY_POPOVER = "gitops";

  /* Edges as [fromId, toId, opts] — particles flow from→to.
       spine: true   main data path, drawn heavier
       route:        "elbow" | "tbranch" | "comb" | "over" | "bigL" | "bigLr" | "spk"
       lane:         integer offset so parallel routes don't share a corridor
       out: true     downstream of the gateway — particles turn emerald */
  const STACK_EDGES = [
    ["field",    "edge",     { route: "elbow", lane: -1 }],
    ["ot",       "edge",     { route: "elbow", lane:  1 }],
    ["ot",       "mqtt",     { route: "spk" }],              // Sparkplug B straight to the bus
    ["edge",     "mqtt",     { spine: true }],
    ["edge",     "backend",  { route: "over" }],             // Ignition Gateway Network
    ["mqtt",     "backend",  { route: "elbow", spine: true, bidir: true, lane: 0 }],
    ["mqtt",     "stores",   { route: "tbranch", lane: -2 }],
    ["mes",      "mqtt",     { route: "bigL",  bidir: true, out: true, lane: -1 }],
    ["mes",      "backend",  { route: "bigLr", bidir: true, out: true, lane: -1 }],
    ["backend",  "stores",   { route: "tbranch", lane: -1 }],
    ["svc",      "stores",   { route: "tbranch", lane: 1 }],
    ["backend",  "hmi",      { route: "comb", out: true, spine: true }],
    ["stores",   "graf",     { route: "elbow", out: true, lane: 1 }],
  ];

  /* Block geometry helpers */
  const BLOCK_H = 26;
  const BROKER_H = 34;
  function blockRect(n) {
    const w = n.w || Math.max(56, n.label.length * 6.4 + 22);
    const h = n.kind === "broker" ? BROKER_H : BLOCK_H;
    return { w, h, x1: n.x - w / 2, y1: n.y - h / 2, x2: n.x + w / 2, y2: n.y + h / 2 };
  }

  /* Orthogonal (right-angle) waypoints from one block edge to another.
     `lane` fans parallel routes so shared corridors stay readable. */
  function edgePoints(from, to, opts) {
    const a = blockRect(from), b = blockRect(to);
    const route = opts && opts.route;
    const lane = (opts && opts.lane) || 0;
    if (route === "elbow") {
      // leave right side, turn in the column gap, enter left side —
      // lane spreads the mid-column and the entry row
      const gap = b.x1 - a.x2;
      const xm = a.x2 + gap * (0.45 + lane * 0.12);
      const yIn = to.y + lane * 10;
      return [[a.x2, from.y], [xm, from.y], [xm, yIn], [b.x1, yIn]];
    }
    if (route === "tbranch") {
      // drop from the block bottom, run a horizontal lane, enter target top.
      // lane shifts both the mid-row and the entry x so same-column drops
      // (Ignition / Services → Data stores) don't stack on one vertical.
      const baseYm = (a.y2 + b.y1) / 2;
      const ym = baseYm + lane * 8;
      const xIn = to.x + lane * 22;
      return [[from.x, a.y2], [from.x, ym], [xIn, ym], [xIn, b.y1]];
    }
    if (route === "over") {
      // arc clear above the broker AND above the MES→Ignition run (~y 77)
      const yTop = Math.min(a.y1, b.y1, 100) - 40;
      const xIn = to.x + lane * 16;
      return [[from.x, a.y1], [from.x, yTop], [xIn, yTop], [xIn, b.y1]];
    }
    if (route === "bigL") {
      // run west along the source row, drop into the target top at a lane offset
      // so we don't share the broker's centerline with mqtt→stores
      const xIn = to.x + lane * 20;
      return [[a.x1, from.y], [xIn, from.y], [xIn, b.y1]];
    }
    if (route === "bigLr") {
      // Leave MES via the top, run west above the MES→MQTT row, then drop
      // into Ignition's right side — clear of the comb trunk (x2+12).
      const yRun = a.y1 - 10;
      const xt = b.x2 + 34;
      return [[from.x, a.y1], [from.x, yRun], [xt, yRun], [xt, to.y], [b.x2, to.y]];
    }
    if (route === "spk") {
      // Leave OT via the bottom so we don't share the eastbound stub with
      // the OT→Edge elbow; then under the edge tier into the broker.
      const turnX = to.x - 64;
      return [[from.x, a.y2], [from.x, from.y + 28], [turnX, from.y + 28], [turnX, b.y2], [b.x1, b.y2]];
    }
    if (route === "comb") {
      // shared vertical trunk just right of the source, teeth into each target
      if (from.y === to.y) return [[a.x2, from.y], [b.x1, to.y]];
      const xt = a.x2 + 12;
      return [[a.x2, from.y], [xt, from.y], [xt, to.y], [b.x1, to.y]];
    }
    // Default: same-row stays a clean horizontal; otherwise orthogonal elbow
    if (Math.abs(from.y - to.y) < 1) return [[a.x2, from.y], [b.x1, to.y]];
    const xm = (a.x2 + b.x1) / 2;
    return [[a.x2, from.y], [xm, from.y], [xm, to.y], [b.x1, to.y]];
  }

  /* Platform slab under the software span (edge → consumers). Shared so the
     build and the GitOps tag tap the same geometry. */
  const PLATFORM_SLAB = { x1: 150, y1: 325, x2: 810, y2: 372 };

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
      class: "stack-svg__otit", x1: 145, y1: 40, x2: 145, y2: 250,
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

      if (i < STACK_STAGES.length - 1) {
        const midX = (stage.x + STACK_STAGES[i + 1].x) / 2;
        append(svgNS, stagesG, "line", {
          class: "stack-svg__stage-divider",
          x1: midX, y1: 45,
          x2: midX, y2: 250,
        });
      }
    });

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

    // "runs on" accolade — bracket over the software span, stem into the slab
    append(svgNS, stagesG, "path", {
      class: "stack-svg__runson",
      d: `M 195 298 L 195 304 L 810 304 L 810 298 M 500 304 L 500 ${b.y1}`,
    });

    // "provisioned & shipped via GitOps" — tag that taps up into the slab.
    const gitTag = append(svgNS, nodesG, "g", {
      class: "stack-node stack-node--tag",
      "data-skills": DELIVERY_SKILLS.join(" "),
      "data-popover": DELIVERY_POPOVER,
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap", d: `M 180 392 L 180 ${b.y2}`,
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap-head", d: `M 176 376 L 180 ${b.y2} L 184 376`,
    });
    const gitText = append(svgNS, gitTag, "text", {
      class: "stack-svg__tag-label", x: 194, y: 392,
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

      const g = append(svgNS, nodesG, "g", {
        class: "stack-node",
        "data-node": nodeId,
        ...(n.skills ? { "data-skills": n.skills.join(" ") } : {}),
        ...(n.popover ? { "data-popover": n.popover } : {}),
      });

      // Halo + larger invisible hit target live inside the broker group so
      // taps on the glow (or near it) still fire the MQTT publish egg.
      if (n.kind === "broker") {
        append(svgNS, g, "circle", {
          class: "stack-svg__center-halo",
          cx: n.x, cy: n.y, r: 30,
        });
        append(svgNS, g, "circle", {
          class: "stack-svg__hit",
          cx: n.x, cy: n.y, r: 42,
          fill: "transparent",
        });
      }

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

  /* Cross-highlight: chip → every block tagged with that skill; block → that
     block only + its chips. Node hover must NOT re-activate shared skill slugs
     across other nodes (that made Services light Data stores via data-pipelines,
     and MQTT light OT/Edge via sparkplug-b / ot-it). */
  function wireStackHighlight(svg) {
    const chips = Array.from(document.querySelectorAll(".skill-chip[data-skill]"));
    const nodes = Array.from(svg.querySelectorAll(".stack-node[data-skills]"));
    if (!chips.length || !nodes.length) return;

    const syncSpotlight = () => {
      svg.classList.toggle("is-spotlighting", svg.querySelector(".is-linked") != null);
    };

    /* Chip hover: light every node that lists this skill (multi-home OK). */
    const setChipActive = (slug, on) => {
      nodes.forEach((g) => {
        if (g.dataset.skills.split(" ").includes(slug)) g.classList.toggle("is-linked", on);
      });
      chips.forEach((c) => {
        if (c.dataset.skill === slug) c.classList.toggle("is-linked", on);
      });
      syncSpotlight();
    };

    /* Node hover: light this node + matching chips only — never sibling nodes. */
    const setNodeActive = (node, on) => {
      node.classList.toggle("is-linked", on);
      const slugs = new Set((node.dataset.skills || "").split(" ").filter(Boolean));
      chips.forEach((c) => {
        if (slugs.has(c.dataset.skill)) c.classList.toggle("is-linked", on);
      });
      syncSpotlight();
    };

    chips.forEach((c) => {
      const slug = c.dataset.skill;
      c.addEventListener("mouseenter", () => setChipActive(slug, true));
      c.addEventListener("mouseleave", () => setChipActive(slug, false));
    });
    nodes.forEach((g) => {
      g.addEventListener("mouseenter", () => setNodeActive(g, true));
      g.addEventListener("mouseleave", () => setNodeActive(g, false));
    });
  }

  /* Clicking a skill chip OR a diagram node opens a popover: an on-brand icon
     plus a one-line "what it is". Data lives in skill-meta.js. Chips and nodes
     share the same popover so diagram-only labels (e.g. Linux) still explain
     themselves after we trim the chip index. Hover still drives cross-highlight. */
  function initSkillPopover() {
    const meta  = window.SKILL_META || {};
    const roles = window.SKILL_ROLE_ICONS || {};
    const chips = Array.from(document.querySelectorAll(".skill-chip[data-skill]"));
    const svg   = document.getElementById("stack-svg");
    const nodes = svg
      ? Array.from(svg.querySelectorAll(".stack-node[data-skills], .stack-node[data-popover]"))
      : [];
    if (!chips.length && !nodes.length) return;

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
      if (current.getAttribute) current.setAttribute("aria-expanded", "false");
      current = null;
    }

    /* Resolve which SKILL_META slug a trigger should show. */
    function slugFor(el) {
      if (el.dataset && el.dataset.skill) return el.dataset.skill;
      if (el.dataset && el.dataset.popover && meta[el.dataset.popover]) return el.dataset.popover;
      const slugs = ((el.dataset && el.dataset.skills) || "").split(/\s+/).filter(Boolean);
      return slugs.find((s) => meta[s]) || null;
    }

    function bindTrigger(el) {
      if (!slugFor(el)) return;
      el.setAttribute("aria-haspopup", "dialog");
      el.setAttribute("aria-expanded", "false");
      // Don't add tabindex to SVG nodes — focusing them scrolls the page and
      // our scroll-to-close handler would dismiss the popover immediately.
      // Chips are already buttons; MQTT keeps its own egg tabindex.
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (current === el) { close(); return; }
        close();
        open(el);
      });
    }

    let ignoreScrollUntil = 0;
    const open = (el) => {
      const slug = slugFor(el);
      const m = slug && meta[slug];
      if (!m) return;
      pop.innerHTML =
        `<div class="skill-popover__head">${iconSVG(m)}<span class="skill-popover__name">${m.name}</span></div>` +
        (m.full ? `<p class="skill-popover__full">${m.full}</p>` : "") +
        `<p class="skill-popover__desc">${m.desc}</p>`;
      pop.hidden = false;

      const r = el.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      const vw = document.documentElement.clientWidth;
      let left = r.left + window.scrollX + r.width / 2 - pw / 2;
      left = Math.max(window.scrollX + 10, Math.min(left, window.scrollX + vw - pw - 10));
      let top = r.bottom + window.scrollY + 8;
      if (r.bottom + 8 + ph > window.innerHeight && r.top - 8 - ph > 0) {
        top = r.top + window.scrollY - ph - 8;
        pop.classList.add("is-above");
      } else {
        pop.classList.remove("is-above");
      }
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top  = `${Math.round(top)}px`;
      el.setAttribute("aria-expanded", "true");
      current = el;
      // Focus/layout can emit scroll right after open — don't dismiss for that.
      ignoreScrollUntil = Date.now() + 500;
    };

    chips.forEach(bindTrigger);
    nodes.forEach(bindTrigger);

    document.addEventListener("click", (e) => {
      if (!current || pop.hidden) return;
      if (pop.contains(e.target)) return;
      if (current === e.target) return;
      if (typeof current.contains === "function" && current.contains(e.target)) return;
      close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", close);
    window.addEventListener("scroll", () => {
      if (Date.now() < ignoreScrollUntil) return;
      close();
    }, true);
  }

  /* ---- init (self-contained; no-op on pages without #stack-svg) ---- */
  function init() {
    buildStackDiagram();
    initSkillPopover();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
