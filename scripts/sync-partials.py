#!/usr/bin/env python3
"""Sync shared HTML chrome from partials/ into the committed pages.

Each page keeps its unique content, but shared chrome lives once under
partials/ and is expanded into <!-- partial:NAME --> … <!-- /partial:NAME -->
blocks. Hostinger still serves the committed HTML as-is — no runtime build.

  make sync     # rewrite every marked block from partials/
  make          # sync → stamp asset hashes → check

Edit a partial, run `make`, commit the updated HTML. CI fails if the
committed HTML is out of sync with the partials.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTIALS_DIR = os.path.join(ROOT, "partials")

# Stamp ?v= inside rendered partials so `make sync` is idempotent with `make stamp`.
ASSET_V_RE = re.compile(r'((?:href|src)=")([^"]+\.(?:css|js))\?v=[^"]*(")')
_hash_cache: dict[str, str] = {}

# Every HTML page that participates in the chrome sync.
# 404 uses root-relative assets; log skips the tag-browser scripts.
HTML_FILES = [
    "index.html",
    "404.html",
    "publications/index.html",
    "log/index.html",
    *sorted(glob.glob("case-studies/**/index.html", root_dir=ROOT, recursive=True)),
    *sorted(glob.glob("notes/**/index.html", root_dir=ROOT, recursive=True)),
]

# Partials every non-404 page should declare (404 is special-cased below).
REQUIRED = {
    "index.html": {
        "head-boot", "favicon", "head-assets", "site-bg",
        "home-topbar", "home-scripts",
    },
    "404.html": {"favicon", "head-assets-404", "goatcounter-404"},
    "log/index.html": {
        "head-boot", "favicon", "head-assets", "site-bg",
        "log-topbar", "log-scripts",
    },
}
DEFAULT_REQUIRED = {
    "head-boot", "favicon", "head-assets", "site-bg",
    "subpage-topbar", "subpage-footer", "site-scripts",
}

BLOCK_RE = re.compile(
    r"<!-- partial:([a-z0-9-]+) -->\n?(.*?)\n?<!-- /partial:\1 -->",
    re.DOTALL,
)
VAR_RE = re.compile(r"\{\{([A-Z0-9_]+)\}\}")


def context_for(rel: str) -> dict[str, str]:
    """Derive path prefixes for a page relative to the site root."""
    if rel == "404.html":
        return {"ASSET": "/assets", "HOME": "/"}
    # Depth = number of directories under the site root.
    depth = rel.count("/")
    if depth == 0:
        return {"ASSET": "assets", "HOME": "./"}
    prefix = "../" * depth
    return {"ASSET": f"{prefix}assets", "HOME": prefix}


def load_partials() -> dict[str, str]:
    partials = {}
    for name in os.listdir(PARTIALS_DIR):
        if not name.endswith(".html"):
            continue
        path = os.path.join(PARTIALS_DIR, name)
        with open(path, encoding="utf-8") as f:
            partials[name[:-5]] = f.read().rstrip("\n")
    return partials


def render(template: str, ctx: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in ctx:
            raise KeyError(f"unknown partial variable {{{{{key}}}}}")
        return ctx[key]
    return VAR_RE.sub(repl, template)


def asset_hash(abspath: str) -> str:
    if abspath not in _hash_cache:
        with open(abspath, "rb") as f:
            _hash_cache[abspath] = hashlib.sha1(f.read()).hexdigest()[:10]
    return _hash_cache[abspath]


def stamp_body(body: str, html_rel: str) -> str:
    """Replace ?v= placeholders with content hashes (same scheme as stamp-assets)."""
    html_dir = os.path.dirname(os.path.join(ROOT, html_rel))

    def repl(m: re.Match[str]) -> str:
        pre, asset_rel, post = m.groups()
        base = ROOT if asset_rel.startswith("/") else html_dir
        abspath = os.path.normpath(os.path.join(base, asset_rel.lstrip("/")))
        if not os.path.exists(abspath):
            return m.group(0)
        return f"{pre}{asset_rel}?v={asset_hash(abspath)}{post}"

    return ASSET_V_RE.sub(repl, body)


def sync_file(rel: str, partials: dict[str, str], check_only: bool) -> bool:
    """Return True if the file would change (or did change)."""
    path = os.path.join(ROOT, rel)
    with open(path, encoding="utf-8") as f:
        src = f.read()

    ctx = context_for(rel)
    missing = []

    def repl(m: re.Match[str]) -> str:
        name = m.group(1)
        if name not in partials:
            missing.append(name)
            return m.group(0)
        body = stamp_body(render(partials[name], ctx), rel)
        # Keep a trailing newline inside the markers so diffs stay readable.
        return f"<!-- partial:{name} -->\n{body}\n<!-- /partial:{name} -->"

    new = BLOCK_RE.sub(repl, src)
    if missing:
        raise SystemExit(f"{rel}: unknown partial(s): {', '.join(missing)}")

    if new == src:
        return False
    if check_only:
        return True
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    return True


def required_for(rel: str) -> set[str]:
    return REQUIRED.get(rel, DEFAULT_REQUIRED)


def verify_markers(rel: str) -> list[str]:
    path = os.path.join(ROOT, rel)
    with open(path, encoding="utf-8") as f:
        src = f.read()
    found = {m.group(1) for m in BLOCK_RE.finditer(src)}
    missing = required_for(rel) - found
    if missing:
        return [f"{rel}: missing partial markers: {', '.join(sorted(missing))}"]
    return []


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if any page is out of sync (no writes)",
    )
    ap.add_argument(
        "--verify-markers",
        action="store_true",
        help="exit 1 if required partial markers are missing",
    )
    args = ap.parse_args()

    os.chdir(ROOT)
    partials = load_partials()
    if not partials:
        print("no partials found in partials/", file=sys.stderr)
        return 1

    if args.verify_markers:
        errors = []
        for rel in HTML_FILES:
            if not os.path.exists(rel):
                errors.append(f"{rel}: file missing")
                continue
            errors.extend(verify_markers(rel))
        if errors:
            print("\n".join(errors), file=sys.stderr)
            return 1
        print(f"markers ok: {len(HTML_FILES)} pages")
        return 0

    changed = []
    for rel in HTML_FILES:
        if not os.path.exists(rel):
            print(f"skip missing: {rel}", file=sys.stderr)
            continue
        if sync_file(rel, partials, check_only=args.check):
            changed.append(rel)

    if args.check:
        if changed:
            print("out of sync:", ", ".join(changed), file=sys.stderr)
            print("run `make sync` (or `make`) and commit the result", file=sys.stderr)
            return 1
        print(f"partials in sync: {len(HTML_FILES)} pages")
        return 0

    print("synced:", ", ".join(changed) if changed else "(no changes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
