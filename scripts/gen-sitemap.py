#!/usr/bin/env python3
"""Regenerate sitemap.xml from the known public page list.

lastmod is the latest git commit date touching that path (YYYY-MM-DD),
falling back to today's UTC date if git is unavailable.

Run via `make sitemap` (or `make`, which includes it).
"""
from __future__ import annotations

import datetime as dt
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sitemap.xml")

# path (site-relative URL) → repo file used for lastmod + priority/changefreq
PAGES = [
    {"loc": "https://samdonche.com/", "file": "index.html", "changefreq": "monthly", "priority": "1.0"},
    {"loc": "https://samdonche.com/case-studies/", "file": "case-studies/index.html", "changefreq": "monthly", "priority": "0.7"},
    {"loc": "https://samdonche.com/case-studies/factory-data-backbone/", "file": "case-studies/factory-data-backbone/index.html", "changefreq": "yearly", "priority": "0.7"},
    {"loc": "https://samdonche.com/notes/", "file": "notes/index.html", "changefreq": "monthly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-secrets/", "file": "notes/ignition-secrets/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-observability/", "file": "notes/ignition-observability/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-historian/", "file": "notes/ignition-historian/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-amqp/", "file": "notes/ignition-amqp/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-alarms/", "file": "notes/ignition-alarms/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-perspective/", "file": "notes/ignition-perspective/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-dark-mode/", "file": "notes/ignition-dark-mode/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-doom/", "file": "notes/ignition-doom/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-sdk-lessons/", "file": "notes/ignition-sdk-lessons/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/ignition-modules/", "file": "notes/ignition-modules/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/mqtt-sparkplug-b/", "file": "notes/mqtt-sparkplug-b/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/notes/mes-scada-vs-historian/", "file": "notes/mes-scada-vs-historian/index.html", "changefreq": "yearly", "priority": "0.6"},
    {"loc": "https://samdonche.com/publications/", "file": "publications/index.html", "changefreq": "yearly", "priority": "0.5"},
    {"loc": "https://samdonche.com/plant/", "file": "plant/index.html", "changefreq": "monthly", "priority": "0.7"},
]


def lastmod(rel: str) -> str:
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%cs", "--", rel],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    path = os.path.join(ROOT, rel)
    if os.path.exists(path):
        ts = os.path.getmtime(path)
        return dt.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
    return dt.datetime.utcnow().strftime("%Y-%m-%d")


def main() -> int:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for p in PAGES:
        lines.append("  <url>")
        lines.append(f"    <loc>{p['loc']}</loc>")
        lines.append(f"    <lastmod>{lastmod(p['file'])}</lastmod>")
        lines.append(f"    <changefreq>{p['changefreq']}</changefreq>")
        lines.append(f"    <priority>{p['priority']}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    text = "\n".join(lines)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({len(PAGES)} urls)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
