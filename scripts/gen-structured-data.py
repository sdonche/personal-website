#!/usr/bin/env python3
"""Keep the pages' structured data (schema.org JSON-LD) and dates in step.

Run via `make seo` (or `make`, which includes it). For every article page
(notes/*/ and case-studies/*/):

  · dateModified follows the article's own text. A hash of the text inside
    <article> is kept in scripts/article-dates.json; when it changes, the
    article's modified date becomes today (UTC). Chrome, asset hashes and
    partials don't count as a change.
  · wordCount, articleSection, and author / publisher pointing at the one
    Person on the homepage (@id https://samdonche.com/#person).
  · Notes show their dates as <time> elements, plus "updated <date>" once
    the article has changed after it was published.

It also writes a CollectionPage + ItemList block for the notes and
case-studies indexes (in their listed order) and one for the publications
page (ScholarlyArticle per entry, DOI where there is one), between
<!-- ld:collection --> markers.

The feed generator reads article-dates.json, so the Atom <updated> matches.
"""
from __future__ import annotations

import datetime as dt
import glob
import hashlib
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(ROOT, "scripts", "article-dates.json")
SITE = "https://samdonche.com"
PERSON_ID = f"{SITE}/#person"
PERSON_REF = {"@type": "Person", "@id": PERSON_ID, "name": "Sam Donche", "url": f"{SITE}/"}

LD_RE = re.compile(r'(?P<indent>[ \t]*)<script type="application/ld\+json">\s*(?P<body>.*?)\s*</script>', re.S)
COLL_RE = re.compile(r"[ \t]*<!-- ld:collection -->.*?<!-- /ld:collection -->\n", re.S)


def read(rel: str) -> str:
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(rel: str, text: str) -> bool:
    if read(rel) == text:
        return False
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        f.write(text)
    return True


def ld_script(data: dict, indent: str) -> str:
    body = json.dumps(data, indent=2, ensure_ascii=False)
    body = "\n".join(indent + "  " + line for line in body.splitlines())
    return f'{indent}<script type="application/ld+json">\n{body}\n{indent}</script>'


def article_text(page: str) -> str:
    """The article's readable text, without the dates this script manages."""
    m = re.search(r"<article>(.*?)</article>", page, re.S)
    inner = m.group(1) if m else ""
    # The header date line is ours (publish / updated dates), not the article's text
    inner = re.sub(r'<p class="mt-4 font-mono text-xs tracking-wider text-slate-400">.*?</p>', "", inner, count=1, flags=re.S)
    inner = re.sub(r"<(script|style|svg)\b.*?</\1>", " ", inner, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", inner))
    return re.sub(r"\s+", " ", text).strip()


def stamp_article(rel: str, registry: dict, today: str) -> bool:
    page = read(rel)
    m = LD_RE.search(page)
    if not m:
        sys.exit(f"{rel}: no JSON-LD block")
    data = json.loads(m.group("body"))
    nodes = data.get("@graph", [data])
    art = next((n for n in nodes if n.get("@type") in ("Article", "BlogPosting")), None)
    if art is None:
        sys.exit(f"{rel}: no Article in its JSON-LD")

    text = article_text(page)
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
    entry = registry.get(rel)
    if entry is None:
        # First run: trust the date already on the page
        entry = {"hash": digest, "modified": art.get("dateModified") or art["datePublished"]}
    elif entry["hash"] != digest:
        entry = {"hash": digest, "modified": today}
    registry[rel] = entry

    art["dateModified"] = max(entry["modified"], art["datePublished"])
    art["wordCount"] = len(text.split())
    art["articleSection"] = "Notes" if rel.startswith("notes/") else "Case studies"
    art["author"] = dict(PERSON_REF)
    art["publisher"] = dict(PERSON_REF)
    page = page[: m.start()] + ld_script(data, m.group("indent")) + page[m.end():]

    if rel.startswith("notes/"):
        page = stamp_visible_dates(page, art["datePublished"], art["dateModified"])
    return write(rel, page)


def stamp_visible_dates(page: str, published: str, modified: str) -> str:
    """Header date line: <time> for the publish date, plus 'updated' once it changed."""
    m = re.search(r'(<p class="mt-4 font-mono text-xs tracking-wider text-slate-400">)(.*?)(</p>)', page, re.S)
    if not m:
        return page
    line = m.group(2)
    line = re.sub(r"<span data-updated>.*?</time></span>", "", line, flags=re.S)
    if "data-published" not in line:
        line = line.replace(published, f'<time datetime="{published}" data-published>{published}</time>', 1)
    if modified > published:
        upd = (f'<span data-updated> <span class="text-slate-700">·</span> updated '
               f'<time datetime="{modified}">{modified}</time></span>')
        line = line.replace("</time>", "</time>" + upd, 1)
    return page[: m.start(2)] + line + page[m.end(2):]


def collection(rel: str, url: str, name: str, items: list[dict]) -> bool:
    page = read(rel)
    desc = re.search(r'name="description" content="([^"]*)"', page).group(1)
    data = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": url,
        "url": url,
        "name": name,
        "description": html.unescape(desc),
        "author": dict(PERSON_REF),
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": len(items),
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "item": item} for i, item in enumerate(items)
            ],
        },
    }
    block = "  <!-- ld:collection -->\n" + ld_script(data, "  ") + "\n  <!-- /ld:collection -->\n"
    page = COLL_RE.sub("", page)
    page = page.replace("</head>", block + "</head>", 1)
    return write(rel, page)


def article_items(index_rel: str, section: str) -> list[dict]:
    """Articles in the order the index page lists them."""
    page = read(index_rel)
    main = page[page.index("<main"):]
    items = []
    for slug in dict.fromkeys(re.findall(r'href="([a-z0-9-]+)/"', main)):
        rel = f"{section}/{slug}/index.html"
        if not os.path.exists(os.path.join(ROOT, rel)):
            continue
        art = next(n for n in json.loads(LD_RE.search(read(rel)).group("body"))["@graph"] if n["@type"] == "Article")
        items.append({
            "@type": "Article",
            "@id": f"{SITE}/{section}/{slug}/",
            "url": f"{SITE}/{section}/{slug}/",
            "headline": art["headline"],
            "datePublished": art["datePublished"],
            "dateModified": art["dateModified"],
        })
    return items


def publication_items() -> list[dict]:
    """One ScholarlyArticle per entry on the publications page."""
    page = read("publications/index.html")
    items = []
    for li in re.findall(r"<li\b[^>]*>(.*?)</li>", page, re.S):
        title_m = re.search(r'<span class="block text-slate-200[^"]*">(.*?)</span>', li, re.S)
        meta_m = re.search(r'<span class="mt-1\.5 block[^"]*">(.*?)</span>\s*(?:</a>|$)', li.strip(), re.S)
        if not title_m or not meta_m:
            continue
        title = html.unescape(re.sub(r"<[^>]+>", "", title_m.group(1))).strip().rstrip(".")
        meta = html.unescape(re.sub(r"<[^>]+>", "", meta_m.group(1)))
        venue, year = [p.strip() for p in meta.split("·")[:2]]
        item = {
            "@type": "ScholarlyArticle",
            "headline": title,
            "datePublished": year,
            "isPartOf": {"@type": "Periodical", "name": venue},
            "author": dict(PERSON_REF),
        }
        doi = re.search(r'href="https://doi\.org/([^"]+)"', li)
        if doi:
            item["sameAs"] = f"https://doi.org/{doi.group(1)}"
            item["identifier"] = {"@type": "PropertyValue", "propertyID": "DOI", "value": doi.group(1)}
        else:
            item["genre"] = "Conference abstract"
        items.append(item)
    return items


def main() -> int:
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    registry = {}
    if os.path.exists(REGISTRY):
        with open(REGISTRY, encoding="utf-8") as f:
            registry = json.load(f)
    changed = []
    articles = sorted(glob.glob("notes/*/index.html", root_dir=ROOT) + glob.glob("case-studies/*/index.html", root_dir=ROOT))
    for rel in articles:
        if stamp_article(rel, registry, today):
            changed.append(rel)
    if collection("notes/index.html", f"{SITE}/notes/", "Notes", article_items("notes/index.html", "notes")):
        changed.append("notes/index.html")
    if collection("case-studies/index.html", f"{SITE}/case-studies/", "Case studies", article_items("case-studies/index.html", "case-studies")):
        changed.append("case-studies/index.html")
    if collection("publications/index.html", f"{SITE}/publications/", "Publications", publication_items()):
        changed.append("publications/index.html")
    registry = {k: registry[k] for k in sorted(registry) if k in articles}
    text = json.dumps(registry, indent=2) + "\n"
    if not os.path.exists(REGISTRY) or open(REGISTRY, encoding="utf-8").read() != text:
        with open(REGISTRY, "w", encoding="utf-8") as f:
            f.write(text)
        changed.append("scripts/article-dates.json")
    print(f"structured data: {len(articles)} articles, 3 index pages" + (f"; updated {', '.join(changed)}" if changed else "; no changes"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
