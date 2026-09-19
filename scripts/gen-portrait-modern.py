#!/usr/bin/env python3
"""Regenerate modern portrait formats from assets/img/portrait.jpg.

Produces:
  portrait.webp / portrait.avif           (720×900, full)
  portrait-480.webp / portrait-480.avif   (480×600, mobile srcset)

Then rewrites the ?v=<hash> query strings on the <picture> sources in
index.html so cache-busting stays correct without a hand edit.

Requires ffmpeg with libaom (AV1). Run via `make portraits`.
"""
from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
SRC = os.path.join(IMG, "portrait.jpg")
INDEX = os.path.join(ROOT, "index.html")


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.check_call(cmd)


def sha10(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:10]


def main() -> int:
    if not os.path.exists(SRC):
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1

    full_webp = os.path.join(IMG, "portrait.webp")
    full_avif = os.path.join(IMG, "portrait.avif")
    sm_webp = os.path.join(IMG, "portrait-480.webp")
    sm_avif = os.path.join(IMG, "portrait-480.avif")

    run(["ffmpeg", "-y", "-i", SRC, "-q:v", "75", full_webp])
    run([
        "ffmpeg", "-y", "-i", SRC,
        "-c:v", "libaom-av1", "-crf", "30", "-still-picture", "1",
        full_avif,
    ])
    run([
        "ffmpeg", "-y", "-i", SRC,
        "-vf", "scale=480:-1", "-q:v", "75",
        sm_webp,
    ])
    run([
        "ffmpeg", "-y", "-i", SRC,
        "-vf", "scale=480:-1",
        "-c:v", "libaom-av1", "-crf", "32", "-still-picture", "1",
        sm_avif,
    ])

    hashes = {
        "portrait-480.avif": sha10(sm_avif),
        "portrait.avif": sha10(full_avif),
        "portrait-480.webp": sha10(sm_webp),
        "portrait.webp": sha10(full_webp),
        "portrait.jpg": sha10(SRC),
    }
    for name, h in hashes.items():
        print(f"  {name}: {h}")

    with open(INDEX, encoding="utf-8") as f:
        html = f.read()

    def stamp(name: str, text: str) -> str:
        # Match assets/img/<name>?v=<anything>
        return re.sub(
            rf'(assets/img/{re.escape(name)})\?v=[^"\s]+',
            rf'\1?v={hashes[name]}',
            text,
        )

    new = html
    for name in hashes:
        new = stamp(name, new)

    if new == html:
        print("index.html: hashes already current")
    else:
        with open(INDEX, "w", encoding="utf-8") as f:
            f.write(new)
        print("index.html: updated portrait ?v= hashes")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
