# Build helpers for this static site. There's no app framework — these targets
# just run the small stdlib-Python scripts in scripts/. Nothing here is required
# to *serve* the site (Hostinger serves the committed files as-is); they only
# prepare the files before you commit.
#
# Everyday flow:   make            # cache-bust assets + run the skills check
# After adding a tool to the Toolbelt:   make icons && make
#
# (Tailwind is still its own step — see README "Rebuilding the CSS".)

.PHONY: all build stamp check icons

# Default: refresh the cache-busters, then verify the skills are consistent.
all: stamp check

# Content-hash the ?v= asset URLs in the HTML so returning visitors never get a
# stale file. Run this whenever you change a JS/CSS asset.
stamp:
	python3 scripts/stamp-assets.py
build: stamp

# Verify every skill chip has an icon/description and maps to a diagram node.
check:
	python3 scripts/check-skills.py

# Regenerate assets/js/skill-meta.js from scripts/skill-icons.jsonl.
# Run after editing the tool list, then re-run `make` to re-stamp.
icons:
	python3 scripts/gen-skill-meta.py
