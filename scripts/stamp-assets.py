#!/usr/bin/env python3
"""Stamp content-hash cache-busters onto local ?v= asset URLs in the HTML.

Filenames stay stable (script.js); only the ?v=<hash> query updates. So Hostinger
keeps serving the same files, while returning visitors always fetch the current
version and never a stale cached one. Replaces the old hand-bumped date versions.

Also stamps ES module relative imports inside assets/js/plant.js and
assets/js/plant/**/*.js:  from "./….js" / from './….js' (optional ?v=).

Run before committing (see the Makefile: `make build`).
"""
import hashlib, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

HTML_FILES = ["index.html", "404.html", "publications/index.html", "log/index.html", "plant/index.html"] + \
             glob.glob("case-studies/**/index.html", recursive=True) + \
             glob.glob("notes/**/index.html", recursive=True)

# matches  href="....css?v=..."  and  src="....js?v=..."
PAT = re.compile(r'((?:href|src)=")([^"]+\.(?:css|js))\?v=[^"]*(")')

# ES module relative imports:
#   from "./foo.js" | from './foo.js?v=…'
#   import "./foo.js" | import './foo.js?v=…'  (side-effect imports in plant.js entry)
IMPORT_PAT = re.compile(
    r"""((?:import|from)\s+)(['"])(\./[^'"]+\.js)(?:\?v=[^'"]*)?(\2)"""
)

MODULE_JS_FILES = ["assets/js/plant.js"] + sorted(glob.glob("assets/js/plant/**/*.js", recursive=True))

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

# Stamp plant ES module graph FIRST (content-hash of the *target* file).
# Multiple passes: stamping import specifiers changes file bytes, which changes
# hashes of importers that point at them. Must finish before HTML stamping so
# plant/index.html's plant.js?v= hash matches the final entry file bytes.
module_changed = set()
for _pass in range(4):
    pass_changed = False
    _cache.clear()
    for rel in MODULE_JS_FILES:
        if not os.path.exists(rel):
            continue
        js_dir = os.path.dirname(os.path.abspath(rel))
        with open(rel) as f:
            src = f.read()

        def repl_import(m, js_dir=js_dir):
            pre, quote, asset_rel, _q2 = m.groups()
            abspath = os.path.normpath(os.path.join(js_dir, asset_rel))
            if not os.path.exists(abspath):
                return m.group(0)
            return f"{pre}{quote}{asset_rel}?v={asset_hash(abspath)}{quote}"

        new = IMPORT_PAT.sub(repl_import, src)
        if new != src:
            with open(rel, "w") as f:
                f.write(new)
            module_changed.add(rel)
            pass_changed = True
    if not pass_changed:
        break

_cache.clear()  # HTML stamps must see final module bytes

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

print("stamped:", ", ".join(changed) if changed else "(no html changes)")
print("modules:", ", ".join(sorted(module_changed)) if module_changed else "(no module changes)")
