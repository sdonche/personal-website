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
    { id: "experience",           label: "experience", parent: "experience" },
    { id: "role-mustry",          label: "mustry",          group: "experience", desc: "Industry 4.0 Consultant" },
    { id: "role-vandemoortele",   label: "vandemoortele",   group: "experience", desc: "MES Project Engineer" },
    { id: "role-clarebout",       label: "clarebout",       group: "experience", desc: "Data Engineer" },
    { id: "role-united-experts",  label: "united_experts",  group: "experience", desc: "Env. & Noise Consultant" },
    { id: "role-uz-gent",         label: "uz_gent",         group: "experience", desc: "PhD / Imaging Research" },
    { id: "education",            label: "education" },
    { id: "skills",               label: "skills" },
    { id: "contact",              label: "contact" },
  ];

  /* Top-level sections that scroll-snap the page (used by the active-section
     observer to highlight the right parent in the sidebar). */
  const TOP_LEVEL_IDS = new Set([
    "hero", "about", "experience", "education", "skills", "contact",
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
    observeActiveSection();
    observeReveals();
    observeSkills();
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
      // Expose the live section to assistive tech
      if (qv === "live") el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
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
    const target = document.getElementById(id);
    if (!target) return;
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
     6b. Stack diagram — decorative tech-stack pipeline
         Left → right flow across 5 stages:
           FIELD   → EDGE → BROKER → SERVER → CONSUMERS
         Particles travel source→target along each edge to
         convey directional data flow. Pure visual; no
         interaction. Coordinates are in the 720×300 viewBox.
     ---------------------------------------------------- */

  const STACK_STAGES = [
    { x:  60, label: "FIELD" },
    { x: 180, label: "EDGE" },
    { x: 300, label: "BROKER" },
    { x: 420, label: "BACKEND" },
    { x: 540, label: "FRONTEND" },
    { x: 660, label: "CONSUMERS" },
  ];

  /* Node visual presets per kind */
  const STACK_KINDS = {
    field:    { ringR: 7,  coreR: 2.5 },
    edge:     { ringR: 10, coreR: 3.5 },
    broker:   { ringR: 15, coreR: 6, isCenter: true },
    server:   { ringR: 11, coreR: 4   },
    storage:  { ringR: 9,  coreR: 3   },
    consumer: { ringR: 8,  coreR: 3   },
  };

  /* Nodes — id keyed for easy edge references.
     The main flow (field → edge → broker → backend → frontend) sits on ONE
     centerline (y=170) so the spine reads as a straight left-to-right line;
     the two storage nodes hang below the backend in a symmetric V. */
  const STACK_NODES = {
    plc:      { x:  60, y:  95, label: "PLC / RTU",     kind: "field"    },
    sensor:   { x:  60, y: 170, label: "Sensor",        kind: "field"    },
    opcua:    { x:  60, y: 245, label: "OPC UA",        kind: "field"    },
    edge:     { x: 180, y: 170, label: "Ignition Edge", kind: "edge"     },
    mqtt:     { x: 300, y: 170, label: "MQTT",          kind: "broker"   },
    backend:  { x: 420, y: 170, label: "Backend",       kind: "server", labelAbove: true },
    sql:      { x: 368, y: 258, label: "SQL DB",        kind: "storage"  },
    tsdb:     { x: 472, y: 258, label: "Timeseries DB", kind: "storage"  },
    frontend: { x: 540, y: 170, label: "Frontend",      kind: "server"   },
    hmi:      { x: 660, y:  80, label: "HMI",           kind: "consumer" },
    scada:    { x: 660, y: 125, label: "SCADA",         kind: "consumer" },
    mes:      { x: 660, y: 170, label: "MES",           kind: "consumer" },
    graf:     { x: 660, y: 215, label: "Grafana",       kind: "consumer" },
    apps:     { x: 660, y: 260, label: "Apps",          kind: "consumer" },
  };

  /* Edges as [fromId, toId] — particles flow from→to.
     spine: true marks the main data path, drawn with more emphasis. */
  const STACK_EDGES = [
    ["plc",      "edge"],
    ["sensor",   "edge",     { spine: true }],
    ["opcua",    "edge"],
    ["edge",     "mqtt",     { spine: true }],
    ["mqtt",     "backend",  { spine: true }],
    ["backend",  "frontend", { spine: true }],
    ["backend",  "sql"],
    ["backend",  "tsdb"],
    ["frontend", "hmi"],
    ["frontend", "scada"],
    ["frontend", "mes",      { spine: true }],
    ["frontend", "graf"],
    ["frontend", "apps"],
  ];

  function buildStackDiagram() {
    const svg = document.getElementById("stack-svg");
    if (!svg) return;

    const svgNS      = "http://www.w3.org/2000/svg";
    const stagesG    = svg.querySelector(".stack-svg__stages");
    const edgesG     = svg.querySelector(".stack-svg__edges");
    const particlesG = svg.querySelector(".stack-svg__particles");
    const nodesG     = svg.querySelector(".stack-svg__nodes");

    /* ---- Stage labels at top + faint column dividers ---- */
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
          x2: midX, y2: 305,
        });
      }
    });

    /* ---- Edges ---- */
    STACK_EDGES.forEach(([fromId, toId, opts]) => {
      const from = STACK_NODES[fromId];
      const to   = STACK_NODES[toId];
      if (!from || !to) return;
      append(svgNS, edgesG, "path", {
        d: edgePath(fromId, toId, from, to),
        class: opts && opts.spine ? "is-spine" : "",
      });
    });

    /* ---- Particles per edge, flowing from → to ---- */
    if (!prefersReducedMotion) {
      STACK_EDGES.forEach(([fromId, toId], i) => {
        const from = STACK_NODES[fromId];
        const to   = STACK_NODES[toId];
        if (!from || !to) return;

        const dot = append(svgNS, particlesG, "circle", {
          r: 2.4,
          cx: from.x,
          cy: from.y,
        });
        const anim = append(svgNS, dot, "animateMotion", {
          dur:        `${2.4 + (i * 0.27) % 1.6}s`,
          repeatCount: "indefinite",
          begin:      `${(i * 0.35) % 2}s`,
          path:       relativePath(fromId, toId, from, to),
        });
        // animateMotion has no fill attr; SVG default keeps the dot at origin.
        void anim;
      });
    }

    /* ---- Nodes (ring + core + halo for broker + label) ---- */
    Object.entries(STACK_NODES).forEach(([id, n]) => {
      const kind = STACK_KINDS[n.kind];

      if (kind.isCenter) {
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__center-halo",
          cx: n.x, cy: n.y, r: kind.ringR + 4,
        });
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__center-ring",
          cx: n.x, cy: n.y, r: kind.ringR,
        });
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__center-core",
          cx: n.x, cy: n.y, r: kind.coreR,
        });
      } else {
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__node-ring",
          cx: n.x, cy: n.y, r: kind.ringR,
        });
        append(svgNS, nodesG, "circle", {
          class: "stack-svg__node-core",
          cx: n.x, cy: n.y, r: kind.coreR,
        });
      }

      // Label below the node (or above, where edges below would cross it)
      const labelY = n.labelAbove ? n.y - kind.ringR - 8 : n.y + kind.ringR + 14;
      const label = append(svgNS, nodesG, "text", {
        class: "stack-svg__node-label",
        x: n.x, y: labelY,
      });
      label.textContent = n.label;
    });
  }

  /* Straight-line edge between two nodes, and the same in
     origin-relative form for use inside <animateMotion>. */
  function edgePath(_fromId, _toId, a, b) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  function relativePath(_fromId, _toId, a, b) {
    return `M 0 0 L ${b.x - a.x} ${b.y - a.y}`;
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
     8. Skill bars
     ---------------------------------------------------- */
  function observeSkills() {
    const skills = document.querySelectorAll(".skill[data-level]");
    if (!skills.length) return;

    skills.forEach(s => {
      const level = Math.max(0, Math.min(100, parseInt(s.dataset.level, 10) || 0));
      s.style.setProperty("--level", `${level}%`);
    });

    if (prefersReducedMotion) {
      skills.forEach(s => s.classList.add("is-animated"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-animated");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.25 });

    skills.forEach(s => io.observe(s));
  }

  /* ----------------------------------------------------
     8b. Email links
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

      setStatus("Transmitting…", "pending");

      if (!useFormspree) {
        const data = new FormData(form);
        const subject = encodeURIComponent(data.get("_subject") || "Hello from your website");
        const body = encodeURIComponent(
          `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`
        );
        window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${subject}&body=${body}`;
        setStatus("Opened your mail client — finish & send to deliver.", "ok");
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
          setStatus("Message delivered. I&rsquo;ll reply soon.", "ok");
        } else {
          const j = await res.json().catch(() => ({}));
          setStatus(j.error || "Transmission failed. Please try again.", "err");
        }
      } catch {
        setStatus("Network error. Please try again or use email.", "err");
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
