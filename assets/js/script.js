/* =============================================================
   script.js — vanilla JS, no dependencies. Page chrome + interactions,
   run on DOMContentLoaded:
     1. Clock in top bar
     2. Footer year + computed industry-years stat
     3. Tag-browser sidebar (Ignition-style nav) from the SECTIONS
        registry, with per-node Quality-Value status
        (STALE = unseen · GOOD = visited · LIVE = in viewport)
     4. Mobile nav toggle (open/close sidebar overlay)
     5. Active-section detection (IntersectionObserver)
     6. Command palette (⌘K / Ctrl+K)
     7. Career historian trend chart (Experience section)
     8. Scroll-reveal animation
     9. Contact form (Formspree + mailto fallback) with bot honeypot

   The Skills "Toolbelt" reference-architecture diagram + skill popover
   live in their own file, assets/js/diagram.js.
   ============================================================= */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
  let motionHalted = false;   // E-STOP freezes the clock (CSS motion via .line-stopped)

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
    // "work" is a home section AND a folder of case-study pages
    { id: "work",                 label: "work", parent: "work" },
    { id: "cs-factory",           label: "factory-data-backbone", group: "work", page: true, href: "case-studies/factory-data-backbone/", desc: "Case study" },
    // "notes" is a page (a writing index) that also folders the articles
    { id: "notes",                label: "notes", parent: "notes", page: true, href: "notes/" },
    { id: "note-mes",             label: "mes-scada-vs-historian", group: "notes", page: true, href: "notes/mes-scada-vs-historian/", desc: "Article" },
    { id: "publications",         label: "publications", page: true, href: "publications/", desc: "Research output" },
    { id: "contact",              label: "contact" },
  ];

  /* Top-level sections that scroll-snap the page (used by the active-section
     observer to highlight the right parent in the sidebar). */
  const TOP_LEVEL_IDS = new Set([
    "hero", "about", "experience", "skills", "work", "contact",
  ]);

  /* Visited tracker — drives QV badges. Persisted in sessionStorage so a
     visit to a real page (notes, publications, case study) still reads GOOD
     when you come back to the home nav. */
  const visited = new Set();
  let activeId = "hero";
  const VISITED_KEY = "samdonche.visited";
  function loadVisited() {
    try { JSON.parse(sessionStorage.getItem(VISITED_KEY) || "[]").forEach(id => visited.add(id)); } catch (e) {}
  }
  function saveVisited() {
    try { sessionStorage.setItem(VISITED_KEY, JSON.stringify([...visited])); } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    startClock();
    setFooterYear();
    loadVisited();
    buildTagBrowser();
    wireMobileNav();
    wireCommandPalette();
    buildCareerTrend();
    observeActiveSection();
    observeReveals();
    wireContactForm();
    wireEmailLinks();
    wireEasterEggs();
  }

  /* ----------------------------------------------------
     1. Clock
     ---------------------------------------------------- */
  function startClock() {
    const el = document.getElementById("local-time");
    if (!el) return;
    const tick = () => {
      if (motionHalted) return;            // frozen while the line is stopped
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
    a.className = "tag-nav__item" + (section.page ? " tag-nav__item--page" : "");
    a.dataset.section = section.id;
    a.dataset.qv = "stale";
    a.href = section.page ? section.href : `#${section.id}`;
    a.setAttribute("aria-label", section.page ? `Open ${section.label}` : `Go to ${section.label}`);
    a.innerHTML = `
      <span class="qv-dot" aria-hidden="true"></span>
      <span class="tag-nav__name">${escapeHtml(section.label)}</span>
      <span class="qv-badge" aria-hidden="true">STALE</span>
    `;
    if (section.page) {
      // Real page: let the browser navigate, just record the visit first.
      a.addEventListener("click", () => { visited.add(section.id); saveVisited(); });
    } else {
      a.addEventListener("click", (e) => { e.preventDefault(); scrollToSection(section.id); });
    }

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
      // Chevron toggles; clicking the label jumps (scroll) or navigates (page)
      if (e.target.classList.contains("tag-nav__name")) {
        e.preventDefault();
        if (parentSection.page) {
          visited.add(parentSection.id); saveVisited();
          location.assign(parentSection.href);
        } else {
          scrollToSection(parentSection.id);
        }
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
    checkPlantTour();
  }

  /* Easter egg: mark the "full plant tour" once every visitable tag has been
     seen. Group-parent rows (e.g. "trajectory") aren't destinations — their
     children are — so exclude them; that leaves the 11 real tags. */
  const TOUR_IDS = SECTIONS.filter(s => !s.parent && !s.page).map(s => s.id);
  let tourDone = false;
  function checkPlantTour() {
    if (tourDone) return;
    if (!TOUR_IDS.every(id => visited.has(id))) return;
    tourDone = true;
    discoverEgg("tour");
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
    saveVisited();
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
      saveVisited();
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
      page:  s.page,
      href:  s.href,
      // Path forms a Sparkplug-ish tag string
      path:  s.group
              ? `samdonche/${s.group}/${s.label}`
              : `samdonche/${s.label}`,
    }));

    // Secret commands — hidden until you type a matching verb. `run` marks a
    // row as a command (vs a tag), handled in choose().
    const commands = [
      { id: "cmd-hire",   path: "hire",        desc: "route to the contact channel", run: () => scrollToSection("contact") },
      { id: "cmd-sudo",   path: "sudo",        desc: "make me a sandwich",            run: () => eggToast("Okay. &nbsp;🥪") },
      { id: "cmd-whoami", path: "whoami",      desc: "sam.donche@edge",               run: () => eggToast("sam.donche@edge &middot; Industry 4.0") },
      { id: "cmd-42",     path: "42",          desc: "life, the universe & everything", run: () => eggToast("42.") },
      { id: "cmd-ship",    path: "deploy",      desc: "ship it",                       run: () => eggToast("🚀 shipped · GitOps did the rest") },
      { id: "cmd-ping",    path: "ping",        desc: "are you there?",                run: () => eggToast("pong") },
      { id: "cmd-frituur", path: "frituur",     desc: "Ieper's finest",                run: () => eggToast("🍟 order up") },
      { id: "cmd-uptime", path: "uptime",      desc: "years on the plant floor",      run: () => eggToast(industryYears() + "+ yrs on the floor") },
      { id: "cmd-konami", path: "konami",      desc: "↑↑↓↓←→←→ B A", run: () => eggToast("↑ ↑ ↓ ↓ ← → ← → B A") },
      { id: "cmd-night",  path: "night shift", desc: "toggle amber HMI mode",         run: () => toggleNightShift() },
      { id: "cmd-estop",  path: "estop",       desc: "emergency stop the line",       run: () => toggleEStop() },
      { id: "cmd-boot",   path: "boot",        desc: "replay the cold-start sequence", run: () => runBootSequence() },
      { id: "cmd-log",    path: "log",         desc: "open the operator log",         run: () => location.assign("log/") },
    ];

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
        li.className = "cmdk__item" + (item.run ? " cmdk__item--cmd" : "") + (idx === selected ? " is-selected" : "");
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
      const cmd = commands.find(c => c.id === id);
      if (cmd) { discoverEgg("commands"); cmd.run(); return; }
      const it = items.find(i => i.id === id);
      if (it && it.page) { visited.add(id); saveVisited(); location.assign(it.href); return; }
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

    // Filter on input — case-insensitive substring on the path/desc. Secret
    // commands only surface once something is typed (never on an empty palette).
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const match = list => list.filter(i =>
        i.path.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
      filtered = q ? match(items).concat(match(commands)) : items.slice();
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
    const readyAt = Date.now();   // for the too-fast-submit bot check

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Bot filters: honeypot fields a human can't see, and a submit that lands
      // suspiciously fast. Pretend success so the bot moves on without retrying.
      const trapped = form.querySelector('[name="_gotcha"]')?.value ||
                      form.querySelector('[name="website"]')?.value ||
                      (Date.now() - readyAt < 3000);
      if (trapped) { form.reset(); setStatus(T.ok, "ok"); return; }

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

  /* ----------------------------------------------------
     10. Easter eggs — for the curious. All optional, on-theme.
         · dev-console greeting + window.samdonche API
         · Konami (↑↑↓↓←→←→BA) → amber "night shift" HMI mode
         · ?boot / samdonche.boot() → edge-gateway cold-start
         (⌘K secret commands are wired in wireCommandPalette.)
     ---------------------------------------------------- */
  function wireEasterEggs() {
    consoleGreeting();
    sparkplugConsole();
    wireKonami();
    wireEStop();
    wireTelemetry();
    wireDiagramEgg();
    if (/[?&]boot\b/.test(location.search)) runBootSequence();
  }

  /* Records a discovery in localStorage (via eggs.js) and, the first time,
     shows a star toast — kept separate from eggToast so they never collide. */
  function discoverEgg(id) {
    if (!window.EGGS || !window.EGGS.unlock(id)) return;
    const found = window.EGGS.discovered().size;
    const total = window.EGGS.REGISTRY.length;
    if (found >= total) { celebrateComplete(); return; }   // the capstone wins over the ★ toast
    const e = window.EGGS.REGISTRY.find(x => x.id === id);
    discoverToast((e ? e.name : id), found, total);
  }

  /* Capstone: fires once, when the final egg is discovered on the site. */
  function celebrateComplete() {
    if (document.getElementById("capstone-fx")) return;
    const fx = document.createElement("div");
    fx.id = "capstone-fx";
    fx.className = "capstone-fx";
    fx.innerHTML =
      '<div class="capstone-fx__card">' +
        '<div class="capstone-fx__seal" aria-hidden="true">◆</div>' +
        '<p class="capstone-fx__kicker">all systems discovered</p>' +
        '<p class="capstone-fx__rank">Plant Architect</p>' +
        '<p class="capstone-fx__sub">You found every last one. 9 / 9.</p>' +
        '<a class="capstone-fx__cta" href="log/">open the operator log &rsaquo;</a>' +
      "</div>";
    document.body.appendChild(fx);
    void fx.offsetWidth;
    fx.classList.add("is-visible");
    const done = () => { fx.classList.remove("is-visible"); setTimeout(() => fx.remove(), 500); };
    fx.addEventListener("click", (e) => { if (e.target === fx) done(); });   // backdrop closes
    setTimeout(done, 6500);
  }

  let discoverTimer = null;
  function discoverToast(name, found, total) {
    let el = document.getElementById("egg-discover");
    if (!el) {
      el = document.createElement("a");
      el.id = "egg-discover";
      el.className = "egg-discover";
      el.href = "log/";
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<span class="egg-discover__star">★</span>' +
      '<span class="egg-discover__body"><b>' + name + '</b> discovered' +
      '<span class="egg-discover__meta">' + found + " / " + total + " · operator log ›</span></span>";
    void el.offsetWidth;
    el.classList.add("is-visible");
    clearTimeout(discoverTimer);
    discoverTimer = setTimeout(() => el.classList.remove("is-visible"), 4200);
  }

  // Sparkplug B birth/death certificates — an IIoT in-joke for the console.
  function sparkplugConsole() {
    const s = "color:#22d3ee";
    console.log("%cNBIRTH%c samdonche/edge · node online", "color:#34d399;font-weight:bold", s);
    window.addEventListener("beforeunload", () => {
      console.log("%cNDEATH%c samdonche/edge · node offline", "color:#f43f5e;font-weight:bold", s);
    });
  }

  /* ---- E-STOP: a hidden red button that halts all page motion ---- */
  function wireEStop() {
    const btn = document.createElement("button");
    btn.id = "estop";
    btn.className = "estop";
    btn.type = "button";
    btn.setAttribute("aria-label", "Emergency stop");
    btn.title = "Emergency stop";
    btn.innerHTML = '<span class="estop__label">STOP</span>';
    btn.addEventListener("click", toggleEStop);
    document.body.appendChild(btn);
  }

  function toggleEStop() {
    const on = document.documentElement.classList.toggle("line-stopped");
    motionHalted = on;
    // CSS animation-play-state (via .line-stopped) can't touch SMIL, so pause
    // the SVG timelines too — that's what freezes the diagram's flow particles.
    document.querySelectorAll("svg").forEach((s) => {
      if (typeof s.pauseAnimations !== "function") return;
      try { on ? s.pauseAnimations() : s.unpauseAnimations(); } catch (e) {}
    });
    document.getElementById("estop")?.classList.toggle("is-active", on);
    let bar = document.getElementById("line-banner");
    if (on) {
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "line-banner";
        bar.className = "line-banner";
        bar.setAttribute("role", "status");
        bar.innerHTML = '<span class="line-banner__dot"></span> ⏹ Line stopped &mdash; press the E-STOP again to resume';
        document.body.appendChild(bar);
      }
      bar.classList.add("is-visible");
      discoverEgg("estop");
    } else if (bar) {
      bar.classList.remove("is-visible");
    }
  }

  /* ---- Telemetry: click "SYSTEM: ONLINE" for a live SCADA readout ---- */
  function wireTelemetry() {
    const status = document.getElementById("sys-status");
    if (!status) return;
    status.style.cursor = "pointer";
    status.setAttribute("role", "button");
    status.setAttribute("tabindex", "0");
    status.title = "Telemetry";
    const loadedAt = Date.now();
    let panel = null, timer = null;

    function rows() {
      const h = new Date().getHours();
      const shift = h >= 6 && h < 14 ? "morning" : h >= 14 && h < 22 ? "afternoon" : "night";
      const sess = Math.floor((Date.now() - loadedAt) / 1000);
      const mm = String(Math.floor(sess / 60)).padStart(2, "0");
      const ss = String(sess % 60).padStart(2, "0");
      const found = window.EGGS ? window.EGGS.discovered().size : 0;
      const total = window.EGGS ? window.EGGS.REGISTRY.length : 0;
      return [
        ["uptime",  industryYears() + "y on the floor"],
        ["tags",    "500,000 streaming"],
        ["shift",   shift],
        ["session", mm + ":" + ss],
        ["secrets", found + " / " + total + " found"],
      ];
    }
    function paint() {
      if (!panel) return;
      panel.innerHTML =
        '<p class="telemetry__title">// live telemetry</p>' +
        rows().map(([k, v]) =>
          '<div class="telemetry__row"><span>' + k + '</span><b>' + v + "</b></div>").join("");
    }
    function toggle() {
      if (panel) { close(); return; }
      discoverEgg("telemetry");
      panel = document.createElement("div");
      panel.className = "telemetry";
      document.body.appendChild(panel);
      paint();
      requestAnimationFrame(() => panel.classList.add("is-visible"));
      timer = setInterval(paint, 1000);
      setTimeout(() => document.addEventListener("click", onDoc), 0);
    }
    function close() {
      clearInterval(timer);
      document.removeEventListener("click", onDoc);
      panel?.remove();
      panel = null;
    }
    function onDoc(e) {
      if (panel && !panel.contains(e.target) && e.target !== status && !status.contains(e.target)) close();
    }
    status.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    status.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  }

  /* ---- MQTT publish: click the broker node → it "publishes" a burst ---- */
  const MQTT_PAYLOADS = [
    "samdonche/deploy ▸ shipped",
    "samdonche/ping ▸ pong",
    "samdonche/frituur ▸ order up",
    "samdonche/status ▸ shipping",
    "samdonche/hire ▸ available",
    "samdonche/uptime ▸ nominal",
    "samdonche/floor ▸ legible",
  ];
  let mqttIdx = 0;
  function wireDiagramEgg() {
    const svg = document.getElementById("stack-svg");
    const broker = svg && svg.querySelector('.stack-node[data-node="mqtt"]');
    if (!broker) return;
    broker.style.cursor = "pointer";
    broker.addEventListener("click", () => {
      svg.classList.add("is-publishing");
      setTimeout(() => svg.classList.remove("is-publishing"), 1400);
      eggToast("▲ publish · " + MQTT_PAYLOADS[mqttIdx % MQTT_PAYLOADS.length]);
      mqttIdx++;
      discoverEgg("mqtt");
    });
  }

  // Years since entering industry (Jan 2022 — data engineer @ Clarebout).
  function industryYears() {
    const start = Date.UTC(2022, 0, 1);
    return Math.max(1, Math.floor((Date.now() - start) / (365.25 * 24 * 3600 * 1000)));
  }

  // Small ephemeral HMI-style status readout (⌘K command feedback).
  let eggToastTimer = null;
  function eggToast(msg) {
    let el = document.getElementById("egg-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "egg-toast";
      el.className = "egg-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.innerHTML = msg;
    void el.offsetWidth;           // restart the transition
    el.classList.add("is-visible");
    clearTimeout(eggToastTimer);
    eggToastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  // Konami code toggles night-shift HMI mode.
  function wireKonami() {
    const SEQ = ["arrowup","arrowup","arrowdown","arrowdown",
                 "arrowleft","arrowright","arrowleft","arrowright","b","a"];
    let pos = 0;
    document.addEventListener("keydown", (e) => {
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      pos = key === SEQ[pos] ? pos + 1 : (key === SEQ[0] ? 1 : 0);
      if (pos === SEQ.length) { pos = 0; toggleNightShift(); }
    });
  }

  function toggleNightShift() {
    const on = document.documentElement.classList.toggle("hmi-night");
    showScadaAlarm(on);
    discoverEgg("konami");
    return on;
  }

  let scadaTimer = null;
  function showScadaAlarm(on) {
    let bar = document.getElementById("scada-alarm");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "scada-alarm";
      bar.setAttribute("role", "status");
      document.body.appendChild(bar);
    }
    bar.className = "scada-alarm" + (on ? "" : " scada-alarm--ok");
    bar.innerHTML = on
      ? '<span class="scada-alarm__dot"></span> ⚠ Alarm &middot; unauthorized access on <b>samdonche/edge</b> &mdash; night shift engaged'
      : '<span class="scada-alarm__dot scada-alarm__dot--ok"></span> System nominal &middot; alarm cleared';
    void bar.offsetWidth;
    bar.classList.add("is-visible");
    clearTimeout(scadaTimer);
    scadaTimer = setTimeout(() => bar.classList.remove("is-visible"), 4200);
  }

  // Edge-gateway cold-start: types out a boot log, then reveals the site.
  function runBootSequence() {
    if (document.getElementById("boot-seq")) return;    // already running
    discoverEgg("boot");
    const lines = [
      "sam.donche@edge : cold start",
      "[ ok ] linux kernel",
      "[ ok ] docker runtime",
      "[ ok ] mqtt broker (mosquitto) :: online",
      "[ ok ] sparkplug b :: devices self-describing",
      "[ ok ] unified namespace :: synced",
      "[ ok ] historian :: 500,000 tags streaming",
      "[ ok ] scada :: production lines visible",
      "",
      "system ready.",
    ];
    const overlay = document.createElement("div");
    overlay.id = "boot-seq";
    overlay.className = "boot-seq";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "System boot sequence");
    overlay.innerHTML =
      '<pre class="boot-seq__log"></pre>' +
      '<p class="boot-seq__hint">press any key to enter &rsaquo;</p>';
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    const log  = overlay.querySelector(".boot-seq__log");
    const hint = overlay.querySelector(".boot-seq__hint");

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      overlay.classList.add("is-leaving");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", finish);
      setTimeout(() => overlay.remove(), 600);
    }

    if (prefersReducedMotion) {
      log.textContent = lines.join("\n");
      hint.classList.add("is-ready");
    } else {
      let i = 0;
      (function type() {
        if (i < lines.length) {
          log.textContent += (i ? "\n" : "") + lines[i];
          i++;
          setTimeout(type, 240);
        } else {
          hint.classList.add("is-ready");
        }
      })();
    }
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    document.addEventListener("keydown", finish);
    overlay.addEventListener("click", finish);
  }

  // Greet developers who open the console, and expose a tiny playful API.
  function consoleGreeting() {
    const cyan = "color:#22d3ee;font-weight:bold";
    const dim  = "color:#64748b";
    const art =
      "\n" +
      "   ┌───────────────────────────┐\n" +
      "   │   sam.donche @ edge        │\n" +
      "   │   >_  systems online       │\n" +
      "   └───────────────────────────┘\n";
    console.log("%c" + art, cyan);
    console.log("%cYou found the console. This site keeps a few secrets.", dim);
    console.log("%cTry %csamdonche.help()%c — or the Konami code on the page.", dim, cyan, dim);

    window.samdonche = {
      help() {
        console.log("%csamdonche.*", cyan);
        console.log("  hire()    — route to the contact channel");
        console.log("  stack()   — print the toolbelt");
        console.log("  uptime()  — years on the plant floor");
        console.log("  ship()    — 🚀 ship it");
        console.log("  ping()    — pong");
        console.log("  frituur() — 🍟 Ieper's finest");
        console.log("  boot()    — replay the cold-start sequence");
        console.log("  secrets() — open the operator log (found so far)");
        return "↑ pick one";
      },
      hire() {
        scrollToSection("contact");
        return "Routing to sam.donche@edge — let's build something.";
      },
      stack() {
        const chips = [...document.querySelectorAll(".skill-chip")].map(c => c.textContent.trim());
        console.log("%ctoolbelt (" + chips.length + ")", cyan);
        console.log(chips.join(" · "));
        return chips;
      },
      uptime() {
        return industryYears() + "+ years on the plant floor (and counting).";
      },
      ship() {
        console.log("%c   ┌─────┐\n   │ ▸▸▸ │  shipped\n   └─────┘", "color:#34d399;font-weight:bold");
        return "🚀 shipped. GitOps did the rest.";
      },
      ping() {
        console.log("%cpong", "color:#22d3ee;font-weight:bold");
        return "pong · round-trip < 1ms (probably).";
      },
      frituur() {
        console.log("%c   🍟  order up", "font-size:1.1em");
        return "🍟 Ieper's finest. back to the backbone.";
      },
      boot() {
        runBootSequence();
        return "cold start…";
      },
      secrets() {
        location.assign("log/");
        return "opening the operator log…";
      },
    };

    // Any API call counts as discovering the console egg.
    Object.keys(window.samdonche).forEach((k) => {
      const fn = window.samdonche[k];
      window.samdonche[k] = function (...args) { discoverEgg("console"); return fn.apply(this, args); };
    });
  }
})();
