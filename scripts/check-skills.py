#!/usr/bin/env python3
"""Smoke test for the Skills Toolbelt: every chip in index.html must
  1. have a SKILL_META entry (so it gets an icon and the click-popover has a
     description), and
  2. appear exactly once (each tool sits in one layer of the architecture).

This is the invariant we used to verify by hand in the browser. Pure stdlib, no
deps. Exits non-zero on any failure. Run via `make check`.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return f.read()

index    = read("index.html")
meta_js  = read("assets/js/skill-meta.js")

# chips: data-skill only appears on the skill chips
chip_list = re.findall(r'data-skill="([^"]+)"', index)
chips = set(chip_list)

# SKILL_META keys (the object is json.dumps output, so it parses cleanly)
m = re.search(r"window\.SKILL_META = (\{.*?\});\s*window\.SKILL_ROLE_ICONS", meta_js, re.S)
meta = json.loads(m.group(1)) if m else {}

errors = []
for c in sorted(chips):
    if c not in meta:
        errors.append(f"chip '{c}' has no SKILL_META entry (popover would have no icon/description)")
    if chip_list.count(c) > 1:
        errors.append(f"chip '{c}' appears {chip_list.count(c)} times (a tool belongs to one layer)")

# informational: meta entries with no chip (harmless, but flags dead data)
orphans = sorted(k for k in meta if k not in chips)

print(f"chips: {len(chips)}  |  meta entries: {len(meta)}")
if orphans:
    print("note: SKILL_META keys with no chip (dead entries?):", ", ".join(orphans))

if errors:
    print("\nFAIL:")
    for e in errors:
        print("  -", e)
    sys.exit(1)

print("OK: every chip has an icon/description and sits in exactly one layer.")
