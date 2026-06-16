# Personal Website — Sam Donche

A single-page personal site with an **Industry 4.0 / IIoT** aesthetic. Built with vanilla HTML/JS and Tailwind CSS v4 (browser build, no toolchain). Hosted on **Hostinger** at **[samdonche.com](https://samdonche.com)**, deployed automatically from this repo via Hostinger's Git integration.

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

There is **no build step**. Tailwind is loaded via its v4 browser script, fonts via Google Fonts, and everything else is hand-rolled. Just open `index.html`.

---

## File map

```
.
├── index.html                # Single-page site, all sections inlined
├── assets/
│   ├── css/styles.css        # Custom styles (animations, network nav, timeline, etc.)
│   ├── js/script.js          # Network nav builder, scroll behavior, contact form
│   └── img/og.jpg            # 1200×630 social share image (Open Graph / Twitter)
├── .htaccess                 # Apache config: HTTPS, custom 404, caching (Hostinger)
├── 404.html                  # Custom 404 (wired up via .htaccess)
├── robots.txt                # Crawler rules + sitemap pointer
├── sitemap.xml               # Single-URL sitemap
├── .gitignore                # Keeps secrets / OS cruft out of the repo
└── README.md
```

---

## Editing your content

Look for `<!-- CONTENT: ... -->` comments inside [index.html](index.html). Every editable block is marked:

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

## Contact form — Formspree setup

The contact form ships with a **mailto fallback** so it works out of the box (it opens the visitor's mail client pre-filled). To make it submit silently:

1. Create a free form at <https://formspree.io>.
2. Copy your form ID (looks like `xyzabcde`).
3. In [index.html](index.html), replace `YOUR_FORM_ID` in this line:
   ```html
   <form id="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" ...>
   ```

The JS in `assets/js/script.js` auto-detects whether Formspree is configured and falls back to `mailto:` if not.

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

- **[.htaccess](.htaccess)** — forces HTTPS, wires up the custom `404.html`, and sets gzip + cache headers. HTML is cached only briefly so content edits appear quickly.
- **Free SSL** — issued by Hostinger for samdonche.com (**hPanel → Security → SSL**); HTTPS is enforced via `.htaccess`.

### Caching gotcha

Hostinger runs **LiteSpeed cache** + a **CDN edge cache**. If an update doesn't show up after a deploy, purge the cache in hPanel (**Cache Manager** / **Purge cache**) — or wait for it to expire on its own.

### Custom domain note

samdonche.com is registered inside the same Hostinger account, so it's set as the plan's main domain in hPanel (**Websites → Domains → Main domain**) and its DNS points to Hostinger automatically — no external A/CNAME records needed.

---

## Theming & customization

All brand colors are defined in two places (kept in sync intentionally):

- **Tailwind tokens** — top of `<head>` in [index.html](index.html), inside `@theme { ... }`. These power utility classes like `bg-brand-400`.
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

- Skip link, ARIA labels on the sidebar (`role="tree"`) and palette (`role="dialog"`, `aria-modal`).
- Mobile sidebar opens via a labeled hamburger and traps body scroll while open; `Esc` and backdrop-click close it.
- `prefers-reduced-motion` disables the LIVE pulse, reveal animations and palette enter animation.
- **Progressive enhancement:** scroll-reveal is hidden only when JS is available (an inline script sets `html.js`; the CSS hides `.reveal` exclusively under `.js`). With JS off, all content renders fully — nothing depends on the observer firing.
- **Cache-busting:** the `styles.css` / `script.js` includes carry a `?v=YYYY-MM-DD` query. Bump it whenever you edit those files so returning visitors get the new version despite the long asset cache in `.htaccess` (and purge the Hostinger cache after deploying).
- No JS frameworks; ~1 small JS file + 1 CSS file + Tailwind CDN. Lighthouse should score near-100 out of the box.
- Fonts are loaded with `preconnect`; consider self-hosting them if you want zero third-party requests.

---

## License

Personal site — use as a template if it's useful to you.
