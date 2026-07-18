/* =============================================================
   script.js — vanilla JS, no dependencies
   Modules (run on DOMContentLoaded):
     1. Clock in top bar
     2. Footer year
     3. Tag-browser sidebar (Ignition-style nav)
        - Builds the tree from the SECTIONS registry
        - Tracks Quality-Value status per node:
            STALE = not yet visited in this session
            GOOD  = visited at least once
            LIVE  = currently in viewport
     4. Mobile nav toggle (open/close sidebar overlay)
     5. Active-section detection (IntersectionObserver)
        - drives QV state on sidebar + selected state in palette
     6. Command palette (⌘K / Ctrl+K)
        - Hidden modal with type-ahead over the same tag tree
     7. Scroll-reveal animation
     8. Skill bar fill-on-view
     9. Contact form (Formspree with mailto fallback)
   ============================================================= */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);

  /* Dynamic strings for JS-generated UI (static copy lives in the HTML). */
  const T = {
    pending: "Transmitting…",
    mailto:  "Opened your mail client — finish & send to deliver.",
    ok:      "Message delivered. I&rsquo;ll reply soon.",
    err:     "Transmission failed. Please try again.",
    net:     "Network error. Please try again or use email.",
    subject: "Hello from your website",
    qv: { stale: "Not yet viewed", good: "Visited", live: "On screen now" },
  };

  /* ----------------------------------------------------
     Section registry — single source of truth.
       id          : matches the section anchor in index.html
       label       : shown in nav, palette and aria-label
       group       : optional — items with the same group key become
                     children of that group's parent
       parent      : (only on group rows) marks this row as the group
                     header; children with matching `group` nest under it.
     ---------------------------------------------------- */
  const SECTIONS = [
    { id: "hero",                 label: "home" },
    { id: "about",                label: "about" },
    { id: "experience",           label: "trajectory", parent: "experience" },
    { id: "role-mustry",          label: "mustry",          group: "experience", desc: "Industry 4.0 Consultant" },
    { id: "role-vandemoortele",   label: "vandemoortele",   group: "experience", desc: "MES Project Engineer" },
    { id: "role-clarebout",       label: "clarebout",       group: "experience", desc: "Data Engineer" },
    { id: "role-united-experts",  label: "united_experts",  group: "experience", desc: "Env. & Noise Consultant" },
    { id: "role-uz-gent",         label: "uz_gent",         group: "experience", desc: "PhD / Imaging Research" },
    { id: "edu-ugent",            label: "ugent",           group: "experience", desc: "Bio-Science Engineering" },
    { id: "skills",               label: "skills" },
    { id: "work",                 label: "work" },
    { id: "contact",              label: "contact" },
  ];

  /* Top-level sections that scroll-snap the page (used by the active-section
     observer to highlight the right parent in the sidebar). */
  const TOP_LEVEL_IDS = new Set([
    "hero", "about", "experience", "skills", "work", "contact",
  ]);

  /* Visited tracker — drives QV badges. */
  const visited = new Set();
  let activeId = "hero";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    startClock();
    setFooterYear();
    setIndustryYears();
    buildTagBrowser();
    wireMobileNav();
    wireCommandPalette();
    buildStackDiagram();
    initSkillPopover();
    buildCareerTrend();
    observeActiveSection();
    observeReveals();
    wireContactForm();
    wireEmailLinks();
  }

  /* ----------------------------------------------------
     1. Clock
     ---------------------------------------------------- */
  function startClock() {
    const el = document.getElementById("local-time");
    if (!el) return;
    const tick = () => {
      const d = new Date();
      const pad = n => String(n).padStart(2, "0");
      el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ----------------------------------------------------
     2. Footer year
     ---------------------------------------------------- */
  function setFooterYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------
     2b. Industry-years stat — computed so it never goes stale.
         Started in industry Jan 2022 (data engineer, Clarebout).
     ---------------------------------------------------- */
  function setIndustryYears() {
    const el = document.getElementById("stat-industry-yrs");
    if (!el) return;
    const INDUSTRY_START = Date.UTC(2022, 0, 1);
    const years = Math.floor((Date.now() - INDUSTRY_START) / (365.25 * 24 * 3600 * 1000));
    if (years > 0) el.textContent = `${years}+`;
  }

  /* ----------------------------------------------------
     3. Tag-browser sidebar
        Builds the tree, then exposes refreshQV() to update
        per-item status based on visited + activeId.
     ---------------------------------------------------- */
  function buildTagBrowser() {
    const tree = document.getElementById("tag-nav-tree");
    if (!tree) return;

    // Bucket items into top-level vs group-children
    const groups = new Map();   // parentId -> [child, ...]
    const topLevel = [];
    for (const s of SECTIONS) {
      if (s.group) {
        if (!groups.has(s.group)) groups.set(s.group, []);
        groups.get(s.group).push(s);
      } else {
        topLevel.push(s);
      }
    }

    // Replace the static SEO fallback with the rendered tree
    tree.innerHTML = "";

    for (const s of topLevel) {
      if (s.parent && groups.has(s.parent)) {
        tree.appendChild(renderGroup(s, groups.get(s.parent)));
      } else {
        tree.appendChild(renderLeaf(s));
      }
    }

    refreshQV();
  }

  function renderLeaf(section) {
    const li = document.createElement("li");

    const a = document.createElement("a");
    a.className = "tag-nav__item";
    a.dataset.section = section.id;
    a.dataset.qv = "stale";
    a.href = `#${section.id}`;
    a.setAttribute("aria-label", `Go to ${section.label}`);
    a.innerHTML = `
      <span class="qv-dot" aria-hidden="true"></span>
      <span class="tag-nav__name">${escapeHtml(section.label)}</span>
      <span class="qv-badge" aria-hidden="true">STALE</span>
    `;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToSection(section.id);
    });

    li.appendChild(a);
    return li;
  }

  function renderGroup(parentSection, children) {
    const li = document.createElement("li");

    // <details>/<summary> natively conveys expanded/collapsed state
    const details = document.createElement("details");
    details.className = "tag-nav__group";
    details.open = true;

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="tag-nav__chev" aria-hidden="true">▼</span>
      <span class="tag-nav__name">${escapeHtml(parentSection.label)}</span>
      <span class="tag-nav__group-count">[${children.length}]</span>
    `;
    summary.addEventListener("click", (e) => {
      // Allow chevron toggle, but also jump on click of the label area
      // — only if the group is currently open and the click is on the name
      if (e.target.classList.contains("tag-nav__name")) {
        e.preventDefault();
        scrollToSection(parentSection.id);
      }
    });
    details.appendChild(summary);

    const ul = document.createElement("ul");
    children.forEach(c => ul.appendChild(renderLeaf(c)));
    details.appendChild(ul);

    li.appendChild(details);
    return li;
  }

  /* Refresh QV badges on every sidebar item based on visited + activeId */
  function refreshQV() {
    const items = document.querySelectorAll(".tag-nav__item");
    items.forEach((el) => {
      const id = el.dataset.section;
      let qv = "stale";
      if (id === activeId) qv = "live";
      else if (visited.has(id)) qv = "good";
      el.dataset.qv = qv;
      // Expose the live section to assistive tech + explain the state on hover
      if (qv === "live") el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
      el.title = T.qv[qv];
      const badge = el.querySelector(".qv-badge");
      if (badge) badge.textContent = qv.toUpperCase();
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ----------------------------------------------------
     scrollToSection — shared by nav, palette, links
     ---------------------------------------------------- */
  function scrollToSection(id) {
    let target = document.getElementById(id);
    if (!target) return;
    // Role cards live inside the experience inspector — the card may be
    // hidden, so select it in the chart and scroll to the section instead.
    if (ROLE_IDS.has(id) && document.querySelector(".role-detail")) {
      selectRole(id);
      target = document.getElementById("experience") || target;
    }
    // Close the mobile nav BEFORE scrolling: while it's open the body is
    // scroll-locked (overflow: hidden), which silently cancels scrollIntoView.
    const nav = document.getElementById("tag-nav");
    if (nav && nav.classList.contains("is-open")) closeMobileNav();
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    // Eagerly mark visited so the QV badge updates without waiting for IO
    visited.add(id);
    refreshQV();
  }

  /* ----------------------------------------------------
     4. Mobile nav toggle
     ---------------------------------------------------- */
  function wireMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const close  = document.getElementById("nav-close");
    const nav    = document.getElementById("tag-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    });

    close?.addEventListener("click", closeMobileNav);

    // Tapping the backdrop (the ::before pseudo-element area outside the panel) closes it.
    // Since pseudo-elements can't take clicks, we wire clicks on the nav root and treat
    // any click whose target ISN'T inside the panel as a backdrop click.
    nav.addEventListener("click", (e) => {
      const panel = nav.querySelector(".tag-nav__panel");
      if (panel && !panel.contains(e.target)) closeMobileNav();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) closeMobileNav();
    });
  }

  function closeMobileNav() {
    const nav    = document.getElementById("tag-nav");
    const toggle = document.getElementById("nav-toggle");
    if (!nav) return;
    nav.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  /* ----------------------------------------------------
     5. Active-section detection
     ---------------------------------------------------- */
  function observeActiveSection() {
    const targets = SECTIONS
      .map(s => document.getElementById(s.id))
      .filter(Boolean);
    if (!targets.length) return;

    const setActive = (id) => {
      if (id === activeId) return;
      activeId = id;
      visited.add(id);
      refreshQV();
    };

    const io = new IntersectionObserver((entries) => {
      // Pick the entry with the largest intersection ratio currently in view
      let best = null;
      entries.forEach(e => {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) {
          best = e;
        }
      });
      if (best) setActive(best.target.id);
    }, {
      rootMargin: "-40% 0px -50% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    targets.forEach(t => io.observe(t));
  }

  /* ----------------------------------------------------
     6. Command palette (⌘K / Ctrl+K)
        - Builds a flat list of tag paths
        - Filters as you type
        - Keyboard: ↑↓ to select, Enter to navigate, Esc to close
     ---------------------------------------------------- */
  function wireCommandPalette() {
    const root    = document.getElementById("cmdk");
    const input   = document.getElementById("cmdk-input");
    const list    = document.getElementById("cmdk-list");
    const opener  = document.getElementById("cmdk-open");
    if (!root || !input || !list) return;

    // Build the flat tag path list once
    const items = SECTIONS.map(s => ({
      id:    s.id,
      label: s.label,
      desc:  s.desc || "",
      // Path forms a Sparkplug-ish tag string
      path:  s.group
              ? `samdonche/${s.group}/${s.label}`
              : `samdonche/${s.label}`,
    }));

    let selected = 0;
    let filtered = items.slice();

    function open() {
      root.hidden = false;
      input.value = "";
      filtered = items.slice();
      selected = 0;
      render();
      // Defer focus so the browser registers the unhidden element
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
      document.body.style.overflow = "hidden";
    }

    function close() {
      root.hidden = true;
      document.body.style.overflow = "";
    }

    function render() {
      list.innerHTML = "";
      if (!filtered.length) {
        const li = document.createElement("li");
        li.className = "cmdk__empty";
        li.textContent = "no tags match.";
        list.appendChild(li);
        return;
      }
      const query = input.value.trim().toLowerCase();
      filtered.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "cmdk__item" + (idx === selected ? " is-selected" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", idx === selected ? "true" : "false");
        li.dataset.id = item.id;
        li.innerHTML = `
          <span class="cmdk__item-dot" aria-hidden="true"></span>
          <span class="cmdk__item-path">${highlight(item.path, query)}</span>
          <span class="cmdk__item-desc">${escapeHtml(item.desc)}</span>
        `;
        li.addEventListener("click", () => choose(item.id));
        li.addEventListener("mouseenter", () => {
          selected = idx;
          updateSelection();
        });
        list.appendChild(li);
      });
    }

    function updateSelection() {
      list.querySelectorAll(".cmdk__item").forEach((el, i) => {
        const sel = i === selected;
        el.classList.toggle("is-selected", sel);
        el.setAttribute("aria-selected", sel ? "true" : "false");
        if (sel) el.scrollIntoView({ block: "nearest" });
      });
    }

    function choose(id) {
      close();
      scrollToSection(id);
    }

    function highlight(text, query) {
      if (!query) return escapeHtml(text);
      const lower = text.toLowerCase();
      const idx = lower.indexOf(query);
      if (idx === -1) return escapeHtml(text);
      return (
        escapeHtml(text.slice(0, idx)) +
        "<b>" + escapeHtml(text.slice(idx, idx + query.length)) + "</b>" +
        escapeHtml(text.slice(idx + query.length))
      );
    }

    // Filter on input — simple case-insensitive substring on the path
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      filtered = q
        ? items.filter(i => i.path.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q))
        : items.slice();
      selected = 0;
      render();
    });

    // Keyboard inside palette
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length) {
          selected = (selected + 1) % filtered.length;
          updateSelection();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length) {
          selected = (selected - 1 + filtered.length) % filtered.length;
          updateSelection();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selected]) choose(filtered[selected].id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    // Backdrop click closes
    root.querySelectorAll("[data-cmdk-close]").forEach((el) => {
      el.addEventListener("click", close);
    });

    // Global hotkey: ⌘K (Mac) / Ctrl+K (others). Also `/` works.
    document.addEventListener("keydown", (e) => {
      const isCmdK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !isEditableTarget(e.target);
      if (isCmdK || isSlash) {
        e.preventDefault();
        if (root.hidden) open(); else close();
      } else if (e.key === "Escape" && !root.hidden) {
        e.preventDefault();
        close();
      }
    });

    // Sidebar button opens the palette
    opener?.addEventListener("click", open);
  }

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
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
         (wireStackHighlight). Coordinates are in the 720×410
         viewBox. Particles travel source→target to convey flow.
     ---------------------------------------------------- */

  const STACK_STAGES = [
    { x:  70, label: "FIELD" },
    { x: 190, label: "EDGE" },
    { x: 315, label: "BROKER" },
    { x: 450, label: "GATEWAY" },
    { x: 645, label: "CONSUMERS" },
  ];

  /* Nodes are labeled blocks (schematic style, like Ignition designer views).
     Width is derived from the label unless `w` is given. `skills` ties a block
     to the chips below it for the hover cross-highlight. */
  const STACK_NODES = {
    /* --- data-flow tier (field devices are physical OT, so they sit OFF
           the platform slab; everything from the edge rightward runs on it).
           One Ignition gateway both persists data and serves the consumers —
           the earlier split into two "Ignition" boxes was misleading. --- */
    plc:      { x:  70, y:  95, label: "PLC / RTU",     kind: "field"    },
    sensor:   { x:  70, y: 170, label: "Sensor",        kind: "field"    },
    opcua:    { x:  70, y: 245, label: "OPC UA",        kind: "field",    skills: ["opc-ua"] },
    edge:     { x: 190, y: 150, label: "Ignition Edge", kind: "edge",     skills: ["ignition", "ot-it", "kepware"] },
    nodered:  { x: 190, y: 210, label: "Node-RED",      kind: "edge",     skills: ["node-red"] },
    mqtt:     { x: 315, y: 170, label: "MQTT",          kind: "broker",   skills: ["mqtt", "sparkplug-b", "unified-namespace", "ot-it", "kafka"] },
    backend:  { x: 450, y: 160, label: "Ignition",      kind: "server",   skills: ["ignition", "traefik"] },
    svc:      { x: 450, y: 216, label: "Services",      kind: "server",   skills: ["python", "fastapi", "pydantic", "sqlalchemy", "data-pipelines"] },
    sql:      { x: 385, y: 272, label: "PostgreSQL",    kind: "storage",  skills: ["postgresql", "sql-server"] },
    redis:    { x: 457, y: 272, label: "Redis",         kind: "storage",  skills: ["redis"], w: 56 },
    tsdb:     { x: 525, y: 272, label: "Historian",     kind: "storage",  skills: ["influxdb", "timescaledb", "data-pipelines"] },
    hmi:      { x: 645, y:  80, label: "HMI",           kind: "consumer", w: 64, skills: ["hmi"] },
    scada:    { x: 645, y: 122, label: "SCADA",         kind: "consumer", w: 64, skills: ["scada"] },
    mes:      { x: 645, y: 164, label: "MES",           kind: "consumer", w: 64, skills: ["mes"] },
    graf:     { x: 645, y: 206, label: "Grafana",       kind: "consumer", w: 64, skills: ["grafana", "prometheus"] },
    apps:     { x: 645, y: 248, label: "Apps",          kind: "consumer", w: 64 },

    /* --- platform tier: a single foundation slab the whole software stack
           runs on (field devices excepted). "Cloud" stays generic — multiple
           cloud platforms, not just one. --- */
    linux:    { x: 255, y: 349, label: "Linux",         kind: "platform", skills: ["linux"], w: 58 },
    docker:   { x: 365, y: 349, label: "Docker",        kind: "platform", skills: ["docker"] },
    k8s:      { x: 475, y: 349, label: "Kubernetes",    kind: "platform", skills: ["kubernetes"] },
    cloud:    { x: 590, y: 349, label: "Cloud",         kind: "platform", skills: ["azure", "gcp"], w: 60 },
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
    ["plc",      "edge",     { route: "elbow" }],
    ["sensor",   "edge",     { route: "elbow" }],
    ["opcua",    "nodered",  { route: "elbow" }],
    ["edge",     "mqtt",     { spine: true }],
    ["nodered",  "mqtt",     { route: "elbow" }],
    ["mqtt",     "backend",  { spine: true }],
    ["backend",  "svc",      { route: "tbranch" }],
    ["backend",  "tsdb",     { route: "tbranch" }],
    ["svc",      "sql",      { route: "tbranch" }],
    ["svc",      "redis",    { route: "tbranch" }],
    // consumers fan out from the single Ignition gateway
    ["backend",  "hmi",      { route: "comb", out: true }],
    ["backend",  "scada",    { route: "comb", out: true }],
    ["backend",  "mes",      { route: "comb", out: true, spine: true }],
    ["backend",  "graf",     { route: "comb", out: true }],
    ["backend",  "apps",     { route: "comb", out: true }],
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
  const PLATFORM_SLAB = { x1: 150, y1: 326, x2: 705, y2: 374 };

  function buildStackDiagram() {
    const svg = document.getElementById("stack-svg");
    if (!svg) return;

    const svgNS      = "http://www.w3.org/2000/svg";
    const stagesG    = svg.querySelector(".stack-svg__stages");
    const edgesG     = svg.querySelector(".stack-svg__edges");
    const particlesG = svg.querySelector(".stack-svg__particles");
    const nodesG     = svg.querySelector(".stack-svg__nodes");

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
          x2: midX, y2: 296,
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
      class: "stack-svg__tier-label", x: b.x1, y: b.y1 - 12,
    });
    platLabel.textContent = "// platform · runs on";

    // "runs on" — short dashed drops from the software tier onto the slab,
    // placed to the right of the label so nothing crosses the title
    [400, 500, 600].forEach((x) => {
      append(svgNS, stagesG, "line", {
        class: "stack-svg__runson",
        x1: x, y1: 298, x2: x, y2: b.y1,
      });
    });

    // "provisioned & shipped via GitOps" — a tag that taps up into the slab.
    // Grouped as a stack-node so every delivery/IaC chip lights it up.
    const gitTag = append(svgNS, nodesG, "g", {
      class: "stack-node stack-node--tag", "data-skills": DELIVERY_SKILLS.join(" "),
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap", d: `M 180 397 L 180 ${b.y2}`,
    });
    append(svgNS, gitTag, "path", {
      class: "stack-svg__tap-head", d: `M 176 379 L 180 ${b.y2} L 184 379`,
    });
    const gitText = append(svgNS, gitTag, "text", {
      class: "stack-svg__tag-label", x: 194, y: 397,
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

    /* ---- Particles: data flow only (the delivery rail stays static) ---- */
    if (!prefersReducedMotion) {
      STACK_EDGES.forEach(([fromId, toId, opts], i) => {
        const from = STACK_NODES[fromId];
        const to   = STACK_NODES[toId];
        if (!from || !to) return;
        const pts = edgePoints(from, to, opts);

        const dot = append(svgNS, particlesG, "circle", {
          r: 2.4,
          cx: pts[0][0],
          cy: pts[0][1],
          class: opts && opts.out ? "is-out" : "",
        });
        append(svgNS, dot, "animateMotion", {
          dur:        `${2.4 + (i * 0.27) % 1.6}s`,
          repeatCount: "indefinite",
          begin:      `${(i * 0.35) % 2}s`,
          path:       pathRel(pts),
        });
      });
    }

    /* ---- Nodes: labeled blocks wrapped in a group so the whole block
           (rect + label) highlights together and carries its skill tags ---- */
    Object.values(STACK_NODES).forEach((n) => {
      const r = blockRect(n);

      if (n.kind === "broker") {
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__center-halo",
          cx: n.x, cy: n.y, r: 30,
        });
      }

      const g = append(svgNS, nodesG, "g", {
        class: "stack-node",
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

  /* ----------------------------------------------------
     6c. Career historian trend — the Experience section's
         overview chart. Each role is a trend-pen span on a
         2011→now time axis; the current role runs to a live
         emerald "now" edge (cyan = past, emerald = live,
         slate = education). Clicking a lane jumps to the
         matching card. Dates: [year, month].
     ---------------------------------------------------- */
  const CAREER_LANES = [
    { id: "role-mustry",         label: "mustry",         spans: [[[2026, 5],  null]],       live: true },
    { id: "role-vandemoortele",  label: "vandemoortele",  spans: [[[2025, 9],  [2026, 4]]] },
    { id: "role-clarebout",      label: "clarebout",      spans: [[[2022, 1],  [2025, 9]]] },
    { id: "role-united-experts", label: "united_experts", spans: [[[2021, 4],  [2022, 1]]] },
    { id: "role-uz-gent",        label: "uz_gent",        spans: [[[2017, 11], [2021, 4]]] },
    { id: "edu-ugent",           label: "ugent",          spans: [[[2011, 9], [2014, 7]], [[2014, 9], [2016, 7]]], edu: true },
  ];

  const ROLE_IDS = new Set(CAREER_LANES.map(l => l.id));

  /* Show exactly one card below the chart (inspector pattern) — roles and
     education alike. All cards stay in the DOM for SEO, print and no-JS. */
  function selectRole(id) {
    document.querySelectorAll(".role-detail .timeline-item").forEach(li => {
      const on = li.id === id;
      li.classList.toggle("is-selected", on);
      // the card may have been display:none when the reveal observer ran, so
      // force it visible on selection rather than leaving it at opacity 0
      if (on) li.classList.add("is-visible");
    });
    document.querySelectorAll(".career-svg__lane").forEach(g => {
      g.classList.toggle("is-selected", g.dataset.role === id);
    });
  }

  function buildCareerTrend() {
    const svg = document.getElementById("career-svg");
    if (!svg) return;

    const svgNS  = "http://www.w3.org/2000/svg";
    const gridG  = svg.querySelector(".career-svg__grid");
    const lanesG = svg.querySelector(".career-svg__lanes");
    const figure = svg.closest("figure");

    const toT = ([y, m]) => y + (m - 1) / 12;
    const nowD = new Date();
    const NOW  = nowD.getFullYear() + nowD.getMonth() / 12;

    const X0 = 120, X1 = 688;          // chart area
    const T0 = 2011.5, T1 = NOW + 0.4; // time domain (pad the right edge)
    const X  = t => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);

    const LANE_Y0 = 38, LANE_H = 26, BAR_H = 14;
    const yBottom = LANE_Y0 + CAREER_LANES.length * LANE_H;

    /* ---- year grid + axis labels (every 3rd year labeled) ---- */
    for (let y = 2012; y <= Math.floor(NOW); y++) {
      append(svgNS, gridG, "line", {
        class: "career-svg__gridline",
        x1: X(y), y1: 28, x2: X(y), y2: yBottom + 4,
      });
      if ((y - 2012) % 3 === 0) {
        const t = append(svgNS, gridG, "text", {
          class: "career-svg__axis-label",
          x: X(y), y: yBottom + 18,
        });
        t.textContent = y;
      }
    }

    /* ---- live "now" edge ---- */
    append(svgNS, gridG, "line", {
      class: "career-svg__now-line",
      x1: X(NOW), y1: 28, x2: X(NOW), y2: yBottom + 4,
    });
    if (!prefersReducedMotion) {
      append(svgNS, gridG, "circle", {
        class: "career-svg__now-dot",
        cx: X(NOW), cy: 22, r: 3,
      });
    }
    const nowLabel = append(svgNS, gridG, "text", {
      class: "career-svg__now-label",
      x: X(NOW) + 8, y: 25,
    });
    nowLabel.textContent = "now";

    /* ---- hover popover (content pulled from the role cards, so it's
            already in the page's language) ---- */
    const tip = document.createElement("div");
    tip.className = "trend-tip";
    tip.setAttribute("aria-hidden", "true");
    figure.appendChild(tip);

    function tipContent(lane) {
      if (lane.edu) {
        const nl = document.documentElement.lang === "nl";
        return { title: nl ? "Universiteit Gent" : "Ghent University", meta: "2011 — 2016" };
      }
      const li = document.getElementById(lane.id);
      return {
        title: li?.querySelector("h3")?.textContent || lane.label,
        meta:  li?.querySelector("h3 + span")?.textContent || "",
      };
    }

    function showTip(lane, evt) {
      const c = tipContent(lane);
      tip.innerHTML = `${escapeHtml(c.title)}<span class="trend-tip__meta">${escapeHtml(c.meta)}</span>`;
      const r = figure.getBoundingClientRect();
      const x = Math.min(evt.clientX - r.left + 14, r.width - 190);
      tip.style.left = `${Math.max(x, 8)}px`;
      tip.style.top  = `${evt.clientY - r.top + 16}px`;
      tip.classList.add("is-visible");
    }
    const hideTip = () => tip.classList.remove("is-visible");

    /* ---- lanes: label + span bars; hover = popover, click = inspect ---- */
    CAREER_LANES.forEach((lane, i) => {
      const yMid = LANE_Y0 + i * LANE_H + LANE_H / 2;
      const g = append(svgNS, lanesG, "g", { class: "career-svg__lane" });
      g.dataset.role = lane.id;

      // full-row hit target (behind label + bars)
      append(svgNS, g, "rect", {
        class: "career-svg__hit",
        x: 4, y: yMid - LANE_H / 2 + 1,
        width: 712, height: LANE_H - 2, rx: 5,
      });

      const label = append(svgNS, g, "text", {
        class: "career-svg__lane-label",
        x: X0 - 12, y: yMid + 3.5,
      });
      label.textContent = lane.label;

      lane.spans.forEach(([from, to]) => {
        const x1 = X(toT(from));
        const x2 = X(to ? toT(to) : NOW);
        append(svgNS, g, "rect", {
          class: "career-svg__bar" +
            (lane.live ? " career-svg__bar--live" : "") +
            (lane.edu  ? " career-svg__bar--edu"  : ""),
          x: x1, y: yMid - BAR_H / 2,
          width: Math.max(x2 - x1, 6), height: BAR_H, rx: 4,
        });
      });

      g.addEventListener("mousemove", (e) => showTip(lane, e));
      g.addEventListener("mouseleave", hideTip);
      g.addEventListener("click", () => {
        hideTip();
        selectRole(lane.id);
        visited.add(lane.id);
        refreshQV();
      });
    });

    /* Default selection: the live role */
    if (document.querySelector(".role-detail")) selectRole("role-mustry");
  }

  /* Waypoint list → SVG path string (absolute, and origin-relative
     for use inside <animateMotion>). */
  function pathAbs(pts) {
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  }
  function pathRel(pts) {
    const [x0, y0] = pts[0];
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${x - x0} ${y - y0}`).join(" ");
  }

  /* Small SVG helper — set attributes from an object and append */
  function append(ns, parent, tag, attrs) {
    const el = document.createElementNS(ns, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el);
    return el;
  }

  /* ----------------------------------------------------
     7. Scroll-reveal
     ---------------------------------------------------- */
  function observeReveals() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    if (prefersReducedMotion) {
      els.forEach(el => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    els.forEach(el => io.observe(el));
  }

  /* ----------------------------------------------------
     8. Email links
     ---------------------------------------------------- */
  const B64_EMAIL = "c2FtLmRvbmNoZUBtdXN0cnlzb2x1dGlvbnMuY29t";

  function decodeEmail(b64) {
    try { return atob(b64 || B64_EMAIL); } catch { return ""; }
  }

  function wireEmailLinks() {
    document.querySelectorAll("[data-email]").forEach(el => {
      const addr = decodeEmail(el.getAttribute("data-email"));
      if (!addr) return;

      // Click-to-reveal: address stays out of the DOM until the user clicks.
      // First click swaps the label for the real address + a working mailto;
      // a second click (now a normal mailto link) opens the mail client.
      if (el.hasAttribute("data-email-reveal")) {
        el.addEventListener("click", (e) => {
          if (el.dataset.revealed) return;
          e.preventDefault();
          el.textContent = addr;
          el.setAttribute("href", `mailto:${addr}`);
          el.dataset.revealed = "1";
          el.removeAttribute("data-email");
        });
        return;
      }

      // Immediate mode (e.g. footer "email"): wire the mailto on load.
      el.setAttribute("href", `mailto:${addr}`);
      // data-email-text="false" keeps the existing label (e.g. "email")
      if (el.getAttribute("data-email-text") !== "false") el.textContent = addr;
      el.removeAttribute("data-email");
    });
  }

  /* ----------------------------------------------------
     9. Contact form — Formspree with mailto fallback
     ---------------------------------------------------- */
  function wireContactForm() {
    const form   = document.getElementById("contact-form");
    const status = document.getElementById("form-status");
    if (!form) return;

    const FALLBACK_EMAIL = decodeEmail();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (form.querySelector('[name="_gotcha"]')?.value) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const action = form.getAttribute("action") || "";
      const useFormspree = action.includes("formspree.io/f/") && !action.includes("YOUR_FORM_ID");

      setStatus(T.pending, "pending");

      if (!useFormspree) {
        const data = new FormData(form);
        const subject = encodeURIComponent(data.get("_subject") || T.subject);
        const body = encodeURIComponent(
          `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`
        );
        window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${subject}&body=${body}`;
        setStatus(T.mailto, "ok");
        return;
      }

      try {
        const res = await fetch(action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          form.reset();
          setStatus(T.ok, "ok");
        } else {
          const j = await res.json().catch(() => ({}));
          setStatus(j.error || T.err, "err");
        }
      } catch {
        setStatus(T.net, "err");
      }
    });

    function setStatus(msg, kind) {
      if (!status) return;
      const colors = {
        pending: "text-brand-300",
        ok:      "text-accent",
        err:     "text-rose-400",
      };
      status.className = `font-mono text-xs ${colors[kind] || "text-slate-500"}`;
      status.innerHTML = msg;
    }
  }
})();
