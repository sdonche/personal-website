#!/usr/bin/env python3
"""Generate notes/feed.xml — Atom feed for the notes section.

Entries are defined below (keep in sync when adding a note). Run via
`make feed` (or `make`).
"""
from __future__ import annotations

import os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "notes", "feed.xml")

SITE = "https://samdonche.com"
AUTHOR = "Sam Donche"

# Newest first
NOTES = [
    {
        "slug": "mqtt-sparkplug-b",
        "title": "MQTT and Sparkplug B: why factories stopped polling",
        "summary": (
            "Polling sets a ceiling on every factory data project. MQTT flips "
            "the direction; Sparkplug B adds the contract that makes it an "
            "architecture instead of topic soup."
        ),
        "published": "2026-07-25",
        "updated": "2026-07-25",
    },
    {
        "slug": "mes-scada-vs-historian",
        "title": "MES vs SCADA vs historian: what actually goes where",
        "summary": (
            "Three layers of a factory's data stack, each answering a different "
            "question, and most stalled data projects got the layering wrong."
        ),
        "published": "2026-07-23",
        "updated": "2026-07-23",
    },
]


def atom_date(d: str) -> str:
    """YYYY-MM-DD → RFC3339 date-time at noon UTC."""
    return f"{d}T12:00:00Z"


def main() -> int:
    updated = max(n["updated"] for n in NOTES)
    entries = []
    for n in NOTES:
        url = f"{SITE}/notes/{n['slug']}/"
        entries.append(
            f"""  <entry>
    <title>{escape(n['title'])}</title>
    <link href="{url}" rel="alternate" type="text/html"/>
    <id>{url}</id>
    <published>{atom_date(n['published'])}</published>
    <updated>{atom_date(n['updated'])}</updated>
    <summary>{escape(n['summary'])}</summary>
    <author><name>{escape(AUTHOR)}</name></author>
  </entry>"""
        )

    feed = f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sam Donche — Notes</title>
  <subtitle>Field notes on industrial digital architecture</subtitle>
  <link href="{SITE}/notes/feed.xml" rel="self" type="application/atom+xml"/>
  <link href="{SITE}/notes/" rel="alternate" type="text/html"/>
  <id>{SITE}/notes/</id>
  <updated>{atom_date(updated)}</updated>
  <author><name>{escape(AUTHOR)}</name></author>
{chr(10).join(entries)}
</feed>
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(feed)
    print(f"wrote notes/feed.xml ({len(NOTES)} entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
