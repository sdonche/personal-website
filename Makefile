# Build helpers for this static site. There's no app framework — these targets
# just run the small stdlib-Python scripts in scripts/. Nothing here is required
# to *serve* the site (Hostinger serves the committed files as-is); they only
# prepare the files before you commit.
#
# Everyday flow:   make            # sync chrome + cache-bust + sitemap/feed + checks
# After editing partials/:         make
# After adding a tool to the Toolbelt:   make icons && make
# After adding a note/case study:  update CARDS / NOTES / PAGES lists, then
#                                  make og-cards && make
#
# (Tailwind is still its own step — see README "Rebuilding the CSS".)

.PHONY: all build sync stamp check icons favicon portraits og-cards thumbs sitemap feed discover

# Default: expand shared chrome, refresh cache-busters, refresh discoverability
# artifacts, then verify consistency.
all: sync stamp discover check

# Expand <!-- partial:NAME --> blocks from partials/ into every HTML page.
# Edit the partial once; this rewrites the marked regions on every page.
sync:
	python3 scripts/sync-partials.py

# Content-hash the ?v= asset URLs in the HTML so returning visitors never get a
# stale file. Run this whenever you change a JS/CSS asset.
stamp:
	python3 scripts/stamp-assets.py
build: sync stamp

# Sitemap lastmod + notes Atom feed (committed XML; no runtime build).
sitemap:
	python3 scripts/gen-sitemap.py
feed:
	python3 scripts/gen-notes-feed.py
discover: sitemap feed

# Verify skills + that every page's partial markers are present and in sync.
check:
	python3 scripts/sync-partials.py --verify-markers
	python3 scripts/sync-partials.py --check
	python3 scripts/check-skills.py

# Regenerate assets/js/skill-meta.js from scripts/skill-icons.jsonl.
# Run after editing the tool list, then re-run `make` to re-stamp.
icons:
	python3 scripts/gen-skill-meta.py

# Regenerate the Safari/iOS PNG fallbacks from the "Terminal" favicon mark.
# Source of truth is partials/favicon.html. Needs Pillow.
favicon:
	python3 scripts/gen-favicon.py

# Rebuild AVIF/WebP portrait variants from assets/img/portrait.jpg (needs ffmpeg).
# Updates the ?v= hashes inside index.html's <picture> block.
portraits:
	python3 scripts/gen-portrait-modern.py

# Re-capture the "Selected work" thumbnails (assets/img/work/) from the live
# pages — run after the plant HMI's look changes. Needs Node + Playwright
# (see tools/capture-work-thumbs.mjs). Commit the new images.
thumbs:
	node tools/capture-work-thumbs.mjs

# Regenerate homepage + per-page Open Graph JPEGs (needs Pillow + tools/fonts).
# Then update og:image / twitter:image paths in the HTML if you added a new slug.
og-cards:
	python3 tools/generate-og-card.py
