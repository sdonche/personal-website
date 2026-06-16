# Personal Website — Sam Donche

A single-page personal site with an **Industry 4.0 / IIoT** aesthetic. Built with vanilla HTML/JS and Tailwind CSS v4 (browser build, no toolchain). Designed to be hosted on **GitHub Pages**.

The navigation borrows from **Ignition's tag browser**:

- A fixed left-sidebar **tag tree** with quality-value badges (`STALE` → `GOOD` → `LIVE`) that update live as you scroll.
- An **⌘K / Ctrl+K command palette** for type-ahead navigation over the same tags. Try paths like `experience/mustry` or just `contact`.

Both are driven by a single `SECTIONS` registry in [assets/js/script.js](assets/js/script.js) — add a section there and it appears in the sidebar, the palette, and the active-section observer.

---

## Quick start

```bash
# Clone (or just open the folder)
git clone https://github.com/<your-user>/<repo>.git
cd <repo>

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
│   └── img/                  # Drop your favicon / photos here
├── 404.html                  # Custom 404 used by GitHub Pages
├── .nojekyll                 # Disables Jekyll processing on GH Pages
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

---

## Deploying to GitHub Pages

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin main
```

### 2. Enable Pages

In your repo on GitHub:

1. **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` · folder: `/ (root)`
4. Save. After ~30s your site is live at `https://<your-user>.github.io/<repo>/`.

`.nojekyll` is included so GitHub Pages serves files as-is without Jekyll processing.

### 3. Custom domain (optional)

If you own a domain (e.g. `samdonche.dev`):

1. In your DNS provider, add:
   - **Apex domain** (`samdonche.dev`): four A records pointing to GitHub's IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - **Or `www` subdomain**: a CNAME record pointing to `<your-user>.github.io`.
2. Add a `CNAME` file at the repo root containing just your domain:
   ```
   samdonche.dev
   ```
3. In **Settings → Pages → Custom domain**, enter your domain and tick **Enforce HTTPS** once the cert is issued (usually a few minutes).

> ℹ️ The `CNAME` file is **not** included in this repo by default — add it only when you have a domain ready. GitHub may create/update it for you when you save the domain in the UI.

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
- No JS frameworks; ~1 small JS file + 1 CSS file + Tailwind CDN. Lighthouse should score near-100 out of the box.
- Fonts are loaded with `preconnect`; consider self-hosting them if you want zero third-party requests.

---

## License

Personal site — use as a template if it's useful to you.
