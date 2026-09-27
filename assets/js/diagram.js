/* Skills "Toolbelt" layered reference architecture.
   The layers themselves are static HTML in index.html (one band per layer,
   each holding its skill chips). This file only enhances them:
     - prepends each chip's icon from window.SKILL_META (assets/js/skill-meta.js)
     - opens a popover with the tool's one-liner when a chip is clicked
   Self-contained: no dependency on script.js. The broker button (MQTT egg)
   is wired in script.js alongside the other easter eggs. */
(() => {
  "use strict";

  const meta  = window.SKILL_META || {};
  const roles = window.SKILL_ROLE_ICONS || {};

  const iconSVG = (m, cls) => m.brand
    ? `<svg class="${cls} is-brand" viewBox="0 0 24 24" aria-hidden="true"><path d="${m.brand}"/></svg>`
    : `<svg class="${cls} is-role" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${roles[m.role] || ""}</svg>`;

  /* Give every chip its glyph so the bands read at a glance. The chip's text
     stays the accessible name; the icon is decorative. */
  function decorateChips(chips) {
    chips.forEach((c) => {
      const m = meta[c.dataset.skill];
      if (!m || c.querySelector(".skill-chip__icon")) return;
      c.insertAdjacentHTML("afterbegin", iconSVG(m, "skill-chip__icon"));
    });
  }

  /* Clicking a skill chip opens a popover: an on-brand icon plus a one-line
     "what it is". Data lives in skill-meta.js. */
  function initSkillPopover(chips) {
    const pop = document.createElement("div");
    pop.className = "skill-popover";
    pop.setAttribute("role", "dialog");
    pop.hidden = true;
    document.body.appendChild(pop);
    let current = null;

    function close() {
      if (!current) return;
      pop.hidden = true;
      current.setAttribute("aria-expanded", "false");
      current = null;
    }

    let ignoreScrollUntil = 0;
    function open(el) {
      const m = meta[el.dataset.skill];
      if (!m) return;
      pop.innerHTML =
        `<div class="skill-popover__head">${iconSVG(m, "skill-popover__glyph")}<span class="skill-popover__name">${m.name}</span></div>` +
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
    }

    chips.forEach((el) => {
      if (!meta[el.dataset.skill]) return;
      el.setAttribute("aria-haspopup", "dialog");
      el.setAttribute("aria-expanded", "false");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (current === el) { close(); return; }
        close();
        open(el);
      });
    });

    document.addEventListener("click", (e) => {
      if (!current || pop.hidden) return;
      if (pop.contains(e.target) || current.contains(e.target)) return;
      close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", close);
    window.addEventListener("scroll", () => {
      if (Date.now() < ignoreScrollUntil) return;
      close();
    }, true);
  }

  /* ---- init (no-op on pages without skill chips) ---- */
  function init() {
    const chips = Array.from(document.querySelectorAll(".skill-chip[data-skill]"));
    if (!chips.length) return;
    decorateChips(chips);
    initSkillPopover(chips);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
