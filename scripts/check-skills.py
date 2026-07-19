#!/usr/bin/env python3
"""Smoke test for the Skills Toolbelt: every chip in index.html must
  1. have a SKILL_META entry (so the click-popover has an icon + description), and
  2. map to at least one diagram node's `skills` (so hovering lights something up).

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
diagram  = read("assets/js/diagram.js")

# chips: data-skill only appears on the skill chips
chips = set(re.findall(r'data-skill="([^"]+)"', index))

# SKILL_META keys (the object is json.dumps output, so it parses cleanly)
m = re.search(r"window\.SKILL_META = (\{.*?\});\s*window\.SKILL_ROLE_ICONS", meta_js, re.S)
meta = json.loads(m.group(1)) if m else {}

# every skill token that appears in a node `skills:[...]` or DELIVERY_SKILLS
node_skills = set()
for arr in re.findall(r"skills:\s*\[([^\]]*)\]", diagram):
    node_skills.update(re.findall(r'"([^"]+)"', arr))
d = re.search(r"DELIVERY_SKILLS\s*=\s*\[([^\]]*)\]", diagram)
if d:
    node_skills.update(re.findall(r'"([^"]+)"', d.group(1)))

errors = []
for c in sorted(chips):
    if c not in meta:
        errors.append(f"chip '{c}' has no SKILL_META entry (popover would have no icon/description)")
    if c not in node_skills:
        errors.append(f"chip '{c}' maps to no diagram node (hovering it lights nothing)")

# informational: meta entries with no chip (harmless, but flags dead data)
orphans = sorted(k for k in meta if k not in chips)

print(f"chips: {len(chips)}  |  meta entries: {len(meta)}  |  diagram-mapped skills: {len(node_skills)}")
if orphans:
    print("note: SKILL_META keys with no chip (dead entries?):", ", ".join(orphans))

if errors:
    print("\nFAIL:")
    for e in errors:
        print("  -", e)
    sys.exit(1)

print("OK: every chip has an icon/description and lights a diagram node.")
