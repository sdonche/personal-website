# Personal Website — Sam Donche

A single-page personal site with an **Industry 4.0 / IIoT** aesthetic. Built with vanilla HTML/JS and Tailwind CSS v4, precompiled into a static stylesheet (no toolchain in the repo — one `npx` command regenerates it). Hosted on **Hostinger** at **[samdonche.com](https://samdonche.com)**, deployed automatically from this repo via Hostinger's Git integration.

The navigation borrows from **Ignition's tag browser**:

- A fixed left-sidebar **tag tree** with quality-value badges (`STALE` → `GOOD` → `LIVE`) that update live as you scroll.
- An **⌘K / Ctrl+K command palette** for type-ahead navigation over the same tags. Try paths like `experience/mustry` or just `contact`.

Both are driven by a single `SECTIONS` registry in [assets/js/script.js](assets/js/script.js) — add a section there and it appears in the sidebar, the palette, and the active-section observer.

---

## Quick start

```bash
# Clone (or just open the folder)
git clone https://github.com/sdonche/personal-website.git
cd personal-website

# Open locally — any static server works
python3 -m http.server 8080
# then visit http://localhost:8080
```

There is **no build step to view or deploy the site** — the compiled Tailwind stylesheet (`assets/css/tailwind.css`) is committed, fonts are self-hosted in `assets/fonts/`, everything else is hand-rolled. Just open `index.html`. The site makes **zero third-party requests**.

### Build scripts (`make`)

A few small stdlib-Python helpers in `scripts/` prepare files before you commit. None are needed to *serve* the site (Hostinger serves the committed files as-is); they just save manual work. **Run `make` before committing.** CI runs the same `make` on every push/PR and fails if the committed HTML is out of sync with the partials.

| command | what it does |
| --- | --- |
| `make` | sync shared chrome (`sync`) + cache-bust assets (`stamp`) + run checks (`check`) |
| `make sync` | expand `<!-- partial:… -->` blocks from [`partials/`](partials/) into every HTML page |
| `make icons` | regenerate `assets/js/skill-meta.js` from `scripts/skill-icons.jsonl` (after editing the Toolbelt tool list); then re-run `make` |
| `make portraits` | rebuild AVIF/WebP about-photo variants from `portrait.jpg` (needs `ffmpeg`); then update hashes in `index.html` |
| `make check` | assert partial markers are present + in sync, and every skill chip has an icon/description mapped to a diagram node |

`scripts/stamp-assets.py` stamps a **content hash** onto each `?v=` asset URL in the HTML, so returning visitors always fetch the current file — no more hand-bumping version strings.

### Rebuilding the CSS

The Tailwind stylesheet is generated from [assets/css/tailwind.input.css](assets/css/tailwind.input.css) (which also holds the design tokens). Rerun this **only when you add or remove Tailwind utility classes** in `index.html`, `404.html` or `script.js` — pure text/content edits don't need it:

```bash
npx --yes -p tailwindcss@4 -p @tailwindcss/cli@4 tailwindcss \
  -i assets/css/tailwind.input.css \
  -o assets/css/tailwind.css --minify
```

Then run `make` to re-stamp the cache-busters. (Requires Node; if the npx one-liner can't resolve `tailwindcss`, run `npm install --no-save --no-package-lock tailwindcss@4 @tailwindcss/cli@4` first and use `./node_modules/.bin/tailwindcss` — `node_modules/` is gitignored.)

---

## File map

```
.
├── index.html                # Single-page site, all sections inlined
├── partials/                 # Shared chrome (favicon, CSS/JS links, topbars, scripts)
│                             # Expanded into pages by `make sync` — edit here, not in each HTML file
├── assets/
│   ├── css/tailwind.input.css # Tailwind source: design tokens + @source globs (not served)
│   ├── css/tailwind.css      # Compiled Tailwind output — committed, regenerate via npx (see above)
│   ├── css/styles.css        # Custom styles (animations, network nav, timeline, etc.)
│   ├── css/fonts.css         # @font-face rules for the self-hosted fonts
│   ├── fonts/                # Inter + JetBrains Mono variable woff2 (latin, latin-ext)
│   ├── js/script.js          # Network nav builder, scroll behavior, contact form
│   └── img/                  # og-card.jpg (1200×630 social card, generated), portrait.jpg
│                             # (About photo + schema.org), og.jpg (source photo), favicons
├── scripts/                  # stdlib-Python helpers: sync-partials, stamp-assets, check-skills, …
├── .github/workflows/check.yml  # CI: `make` + dirty-tree guard
├── .htaccess                 # Apache config: HTTPS, custom 404, caching (Hostinger)
├── 404.html                  # Custom 404 (wired up via .htaccess)
├── robots.txt                # Crawler rules + sitemap pointer
├── sitemap.xml               # Page sitemap
├── .gitignore                # Keeps secrets / OS cruft out of the repo
└── README.md
```

---

## Editing your content

All content lives inline in [index.html](index.html) (the shipped HTML intentionally carries no editing-guide comments — this table is the map):

| Section       | Where to edit                                                                       |
| ------------- | ----------------------------------------------------------------------------------- |
| Hero          | `<section id="hero">` — headline, tagline, stat tiles                               |
| About         | `<section id="about">` — three paragraphs + sidebar facts                           |
| Experience    | `<section id="experience">` — duplicate `<li id="role-...">` per role               |
| Education     | `<section id="education">` — duplicate `<article class="edu-card">` per degree      |
| Skills        | `<section id="skills">` — each `<li class="skill" data-level="N">` (N = 0–100)      |
| Contact form  | `<form id="contact-form" action="...">` — Formspree ID (see below)                  |
| Footer / brand| Top bar handle, footer line, social links                                           |

The sidebar and command palette **automatically** pick up sections from the `SECTIONS` array at the top of [assets/js/script.js](assets/js/script.js).

### Adding / removing sections

1. Add or remove a `<section id="...">` in `index.html` (or a `<li id="role-...">` inside the experience timeline).
2. Add a matching entry to the `SECTIONS` array in `assets/js/script.js`:
   - **Top-level section**: `{ id: "blog", label: "blog" }`
   - **Nested role under experience**: `{ id: "role-acme", label: "acme", group: "experience", desc: "Senior Engineer" }`
3. Update the static fallback `<ul id="tag-nav-tree">` in `index.html` (used for SEO + no-JS users).

---

## Contact form — Formspree

The form submits to **Formspree** (form ID `maqrwrjd`, in the `action` attribute of `<form id="contact-form">` in [index.html](index.html)). Submissions are AJAX-posted by `script.js` and arrive by email; the `email` field becomes the reply-to and the `_subject` field becomes the notification's subject line. A honeypot (`_gotcha`) filters naive bots.

Form settings live at <https://formspree.io> → the form's Settings. Recommended there: restrict the allowed domain to `samdonche.com` so nobody else can post to the endpoint and burn the free-tier quota (50 submissions/month).

If the form ID is ever removed from the `action`, `script.js` auto-detects it and falls back to opening the visitor's mail client (`mailto:`) instead.

### Email anti-scrape

The contact email is **never written as plaintext** in the HTML — that keeps harvester bots (which don't run JS) from picking it up. It's stored **base64-encoded** in `data-email` attributes and assembled at runtime by `wireEmailLinks()` in [assets/js/script.js](assets/js/script.js). Two modes:

- **Click-to-reveal** (`data-email-reveal`, the "reveal email address" link): the address stays out of the DOM entirely until the visitor clicks — the first click swaps in the real address + a working `mailto:`, a second click opens the mail client.
- **Immediate** (default, e.g. the footer "email" link): the `mailto:` is wired on load; the visible label is replaced with the address unless `data-email-text="false"`.

To change the address, encode it and update **both** the `data-email` attributes in `index.html` and `B64_EMAIL` in `script.js`:

```bash
printf '%s' 'you@example.com' | base64
```

> Trade-off: visitors with JavaScript disabled won't see the address (the links read "reveal email address" / "email" and the contact form's `mailto:` fallback won't fire). The Formspree form remains the primary, JS-light path.

---

## Pages

The site is **English-only**. Beyond the single-page [index.html](index.html) there are standalone subpages that reuse the same CSS/JS and design language:

- [publications/](publications/index.html) — research output (relocated off the main page, linked from the About sentence + the UZ Gent timeline card).
- [case-studies/](case-studies/) — one directory per case study (e.g. `case-studies/factory-data-backbone/`); surfaced in the "Selected work" section of the main page.
- [notes/](notes/) — field notes on industrial digital architecture.

(A Dutch `/nl/` mirror existed briefly and was removed on 2026-07-18 — it's recoverable from git history if ever wanted.)

### Shared chrome (`partials/`)

Repeated markup — favicon links, CSS/font includes, decorative background, top bars, footers, and script tags — lives once under [`partials/`](partials/). Each HTML page keeps **markers** around those regions:

```html
<!-- partial:head-assets -->
  …generated — do not edit by hand…
<!-- /partial:head-assets -->
```

Edit the partial, then run `make` (which runs `sync` → `stamp` → `check`). Asset path prefixes (`assets/`, `../assets/`, `../../assets/`, `/assets/`) are derived from the page's depth automatically. Hostinger still serves the committed HTML; there is no runtime templating.

### Adding a note or case study

Copy an existing page in the same folder (it already has the right partial markers), then walk this checklist:

1. **Content** — write the new `…/your-slug/index.html` (title, description, OG tags, body). Keep the `<!-- partial:… -->` markers; don't hand-edit inside them.
2. **`SECTIONS`** — add an entry in [`assets/js/script.js`](assets/js/script.js) so the tag browser and ⌘K palette know about the page (see "Adding / removing sections" above).
3. **Index card** — add a card on [`notes/index.html`](notes/index.html) or [`case-studies/index.html`](case-studies/index.html), and on the home "Selected work" section if it's a case study.
4. **Sitemap** — add a `<url><loc>…</loc></url>` to [`sitemap.xml`](sitemap.xml).
5. **Related links** — optionally cross-link from sibling notes / the case study (topic cluster).
6. **`make`** — run before committing so chrome stays in sync and asset hashes are stamped.

For schema.org on long-form pages, copy the Article + BreadcrumbList block from an existing note or case study and update the fields.

---

## Analytics — GoatCounter

Pageviews are counted by **[GoatCounter](https://www.goatcounter.com)** (site code `samdonche` — dashboard at <https://samdonche.goatcounter.com>). It sets **no cookies** and stores no personal data, so no consent banner is needed.

The tracker script is **self-hosted** at [assets/js/goatcounter.js](assets/js/goatcounter.js) (a pinned copy of GoatCounter's `count.js`, ISC-licensed) so the only external request a visitor makes is the count ping to the GoatCounter endpoint. To refresh the pinned copy occasionally:

```bash
curl -s https://gc.zgo.at/count.js -o assets/js/goatcounter.js
```

The script ignores `localhost`, so local development doesn't pollute the stats. The 404 page logs hits under a `404-` path prefix, so broken inbound links surface in the dashboard.

---

## Hosting & deployment (Hostinger)

The site lives on a **Hostinger Business Web Hosting** plan, served from `public_html/` at the main domain **samdonche.com**. Because it's fully static, there's no build or runtime — Hostinger just serves the files.

### How a change goes live

```bash
# edit files locally, then:
git add -A
git commit -m "Update content"
git push origin main
```

Hostinger's Git integration (**hPanel → Advanced → GIT**) is connected to this GitHub repo with **auto-deployment on**, branch `main`, root directory `public_html`. Every push to `main` is pulled onto the server automatically — no manual step. (You can also click **Redeploy** in hPanel, or trigger a manual deploy any time.)

### Supporting config

- **[.htaccess](.htaccess)** — forces HTTPS, redirects `www` → apex (`samdonche.com`), wires up the custom `404.html`, sets gzip + cache headers, and ships security headers (CSP, HSTS, Permissions-Policy, …). HTML is cached only briefly so content edits appear quickly.
- **[_headers](_headers)** — same security headers for the Cloudflare Pages preview mirror (plus `noindex` so previews don't rank). Hostinger ignores this file.
- **Free SSL** — issued by Hostinger for samdonche.com (**hPanel → Security → SSL**); HTTPS is enforced via `.htaccess`.
- **CSP allowlist** — `'self'` plus Formspree (`formspree.io`) for the contact form and GoatCounter (`samdonche.goatcounter.com`) for the analytics ping. Inline script/style remain allowed for the head-boot snippet and JSON-LD.

### Caching gotcha

Hostinger runs **LiteSpeed cache** + a **CDN edge cache**. If an update doesn't show up after a deploy, purge the cache in hPanel (**Cache Manager** / **Purge cache**) — or wait for it to expire on its own.

### Custom domain note

samdonche.com is registered inside the same Hostinger account, so it's set as the plan's main domain in hPanel (**Websites → Domains → Main domain**) and its DNS points to Hostinger automatically — no external A/CNAME records needed.

---

## Theming & customization

All brand colors are defined in two places (kept in sync intentionally):

- **Tailwind tokens** — in [assets/css/tailwind.input.css](assets/css/tailwind.input.css), inside `@theme { ... }`. These power utility classes like `bg-brand-400`. Rebuild the CSS after changing them (see "Rebuilding the CSS").
- **CSS variables** — top of [assets/css/styles.css](assets/css/styles.css), under `:root`. These power custom components (network nav, timeline, etc.).

Change `--color-brand-400` (currently cyan) to re-skin the whole site. Use a vivid, single-channel accent — the IIoT aesthetic relies on that "active sensor" pop against the dark slate background.

The decorative HUD card in the hero (`<aside aria-hidden="true">`) is purely visual — delete it if you'd rather have a photo or simpler hero.

---

## Keyboard shortcuts

| Keys                           | Action                          |
| ------------------------------ | ------------------------------- |
| `⌘K` (Mac) · `Ctrl+K` (others) | Open / close the command palette |
| `/`                            | Same as ⌘K (when not focused in an input) |
| `↑` / `↓`                      | Move selection inside the palette |
| `↵` Enter                      | Jump to the selected tag         |
| `Esc`                          | Close the palette (or the mobile sidebar) |

## Accessibility & performance notes

- Skip link; the sidebar is a labelled plain list (deliberately no ARIA `tree` role — that would promise arrow-key semantics the nav doesn't implement) with `aria-current` marking the section in view; the palette keeps `role="dialog"` + `aria-modal` with full keyboard support.
- Mobile sidebar opens via a labeled hamburger and traps body scroll while open; `Esc` and backdrop-click close it.
- `prefers-reduced-motion` disables the LIVE pulse, reveal animations and palette enter animation.
- **Progressive enhancement:** scroll-reveal is hidden only when JS is available (an inline script sets `html.js`; the CSS hides `.reveal` exclusively under `.js`). With JS off, all content renders fully — nothing depends on the observer firing.
- **Cache-busting:** each CSS/JS include carries a `?v=<content-hash>` query, stamped automatically by `make` (`scripts/stamp-assets.py`). Editing an asset changes its hash, so returning visitors always get the new version despite the long asset cache in `.htaccess` — no manual version bumps.
- No JS frameworks and no runtime CSS compilation — one small JS file + three static stylesheets (Tailwind is precompiled to ~25 KB minified). Lighthouse should score near-100 out of the box.
- **About photo** ships as AVIF/WebP with a JPEG fallback (`<picture>` + `srcset` in `index.html`). Full-size JPEG is ~70 KB; AVIF is ~15 KB. Regenerate after replacing `assets/img/portrait.jpg` with `make portraits` (needs `ffmpeg` with libaom).
- **Fonts are self-hosted** ([assets/css/fonts.css](assets/css/fonts.css) + `assets/fonts/`): no visitor data ever reaches Google (GDPR — German courts have ruled Google Fonts embeds unlawful), and no third-party request can block rendering. Variable woff2 files, one per family+subset; `unicode-range` means the latin-ext files are only downloaded if a page actually uses those characters. The two latin files are preloaded in `index.html` (`crossorigin` is required on font preloads even same-origin). To change fonts or add weights outside Inter 300–800 / JetBrains Mono 400–600, fetch new woff2 files from Google Fonts (curl the CSS URL with a browser User-Agent to get woff2 sources) and update `fonts.css`.

---

## License

Personal site — use as a template if it's useful to you.
