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
        "slug": "ignition-secrets",
        "title": "Ignition credentials belong in your secrets manager",
        "summary": (
            "Gateways still hold database passwords and script secrets. Why that "
            "breaks rotation and audits, and how a native secret-provider module "
            "resolves them from Vault, Azure, AWS or Google instead."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-observability",
        "title": "Put your Ignition gateway on the same dashboards as everything else",
        "summary": (
            "OpenTelemetry and Prometheus for Ignition 8.3: curated metrics, logs, "
            "and no wrapper.conf surgery."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-historian",
        "title": "Tag history that stays fast when retention gets long",
        "summary": (
            "TimescaleDB-backed historian for Ignition 8.3. Aggregates in tens of "
            "milliseconds over hundreds of millions of rows."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-amqp",
        "title": "Stop scripting RabbitMQ inside Ignition",
        "summary": (
            "Named AMQP broker connections as gateway config, Event Streams and "
            "system.amqp scripting. Replaces the client parked in getGlobals()."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-alarms",
        "title": "Page the channel the crew actually watches",
        "summary": (
            "Teams, Slack and webhook alarm notification profiles for Ignition 8.3, "
            "with acknowledgement, retry, fallback and a delivery audit trail."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-perspective",
        "title": "Fourteen Perspective components the platform never shipped",
        "summary": (
            "Free Apache-2.0 components: scheduling board, calendar, editable grid, "
            "pan-and-zoom, branching diagram, and the admin family Vision had."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-sdk-lessons",
        "title": "Five things the Ignition 8.3 SDK does not tell you",
        "summary": (
            "Lessons from a module that runs Doom on a gateway: routes that refuse to "
            "mount, WebSocket servlets, reused component stores, and a C bug that only "
            "appeared in Docker."
        ),
        "published": "2026-09-24",
        "updated": "2026-09-24",
    },
    {
        "slug": "ignition-doom",
        "title": "Yes, your Ignition gateway can run Doom",
        "summary": (
            "A free Perspective component that runs Doom inside SCADA. Tags fire "
            "the shotgun, alarms pause the marine. Industrially useless on purpose."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-dark-mode",
        "title": "A dark Ignition Designer from one menu item",
        "summary": (
            "Free FlatLaf dark mode for the Ignition 8.3 Designer. Tools → Dark Mode, "
            "remembered between launches, open source on GitHub."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
    {
        "slug": "ignition-modules",
        "title": "Ignition modules for the gaps the platform leaves",
        "summary": (
            "Secrets, RabbitMQ, Timescale, OpenTelemetry, alarm channels, "
            "Perspective UI, Designer dark mode, and Doom: Ignition 8.3 modules "
            "from Mustry, and where each one fits."
        ),
        "published": "2026-09-22",
        "updated": "2026-09-22",
    },
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
