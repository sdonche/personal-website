#!/usr/bin/env python3
"""Search-result hygiene for every page in sitemap.xml (part of `make check`).

  · <title> at most 60 characters, so Google shows it whole
  · meta description 70–160 characters (longer ones get cut off)
  · canonical URL matches the sitemap
  · every JSON-LD block parses; articles credit the homepage Person
    (@id https://samdonche.com/#person) and never claim dateModified < datePublished
"""
from __future__ import annotations

import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://samdonche.com/"
PERSON_ID = "https://samdonche.com/#person"
TITLE_MAX = 60
DESC_MIN, DESC_MAX = 70, 160


def main() -> int:
    with open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8") as f:
        locs = re.findall(r"<loc>(.*?)</loc>", f.read())
    errors = []
    for loc in locs:
        rel = loc.removeprefix(SITE) + "index.html"
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            page = f.read()
        err = lambda msg: errors.append(f"{rel}: {msg}")  # noqa: E731

        title = html.unescape(re.search(r"<title>(.*?)</title>", page, re.S).group(1))
        if len(title) > TITLE_MAX:
            err(f"title is {len(title)} characters (max {TITLE_MAX}): {title!r}")
        desc = re.search(r'<meta name="description" content="([^"]*)"', page)
        if not desc:
            err("no meta description")
        else:
            n = len(html.unescape(desc.group(1)))
            if not DESC_MIN <= n <= DESC_MAX:
                err(f"meta description is {n} characters (want {DESC_MIN}–{DESC_MAX})")
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', page)
        if not canon or canon.group(1) != loc:
            err(f"canonical should be {loc}")

        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
            try:
                data = json.loads(block)
            except json.JSONDecodeError as e:
                err(f"JSON-LD does not parse: {e}")
                continue
            for node in data.get("@graph", [data]):
                if node.get("@type") != "Article":
                    continue
                if node.get("author", {}).get("@id") != PERSON_ID:
                    err("Article author is not linked to the homepage Person")
                if node.get("dateModified", "") < node.get("datePublished", ""):
                    err("dateModified is before datePublished")

    if errors:
        print("\n".join(errors))
        print(f"check-seo: {len(errors)} problem(s)")
        return 1
    print(f"check-seo: {len(locs)} pages OK (titles ≤ {TITLE_MAX}, descriptions {DESC_MIN}–{DESC_MAX}, JSON-LD valid)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
