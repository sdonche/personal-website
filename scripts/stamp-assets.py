#!/usr/bin/env python3
"""Stamp content-hash cache-busters onto local ?v= asset URLs in the HTML.

Filenames stay stable (script.js); only the ?v=<hash> query updates. So Hostinger
keeps serving the same files, while returning visitors always fetch the current
version and never a stale cached one. Replaces the old hand-bumped date versions.

Run before committing (see the Makefile: `make build`).
"""
import hashlib, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

HTML_FILES = ["index.html", "404.html", "publications/index.html"] + \
             glob.glob("case-studies/**/index.html", recursive=True)

# matches  href="....css?v=..."  and  src="....js?v=..."
PAT = re.compile(r'((?:href|src)=")([^"]+\.(?:css|js))\?v=[^"]*(")')

_cache = {}
def asset_hash(abspath):
    if abspath not in _cache:
        with open(abspath, "rb") as f:
            _cache[abspath] = hashlib.sha1(f.read()).hexdigest()[:10]
    return _cache[abspath]

def resolve(html_dir, asset_rel):
    base = ROOT if asset_rel.startswith("/") else html_dir
    return os.path.normpath(os.path.join(base, asset_rel.lstrip("/")))

changed = []
for rel in HTML_FILES:
    if not os.path.exists(rel):
        continue
    html_dir = os.path.dirname(os.path.abspath(rel))
    with open(rel) as f:
        src = f.read()

    def repl(m):
        pre, asset_rel, post = m.groups()
        abspath = resolve(html_dir, asset_rel)
        if not os.path.exists(abspath):
            return m.group(0)          # leave external / unresolved refs alone
        return f"{pre}{asset_rel}?v={asset_hash(abspath)}{post}"

    new = PAT.sub(repl, src)
    if new != src:
        with open(rel, "w") as f:
            f.write(new)
        changed.append(rel)

print("stamped:", ", ".join(changed) if changed else "(no changes)")
