#!/usr/bin/env python3
"""Render the "Terminal" favicon mark to PNG fallbacks.

Modern browsers use the inline SVG favicon embedded in each page's <head>.
Safari and iOS ignore SVG favicons, so we ship raster fallbacks that must
match the SVG exactly. This script is the source of truth for those PNGs:

    assets/img/favicon-32.png      32x32, rounded slate chip, transparent corners
    assets/img/apple-touch-icon.png 180x180, full-bleed square (iOS masks corners)

The mark (32-unit coordinate system, same as the SVG):
  - rounded-rect background        fill #020617
  - chevron  M9 11 L14 16 L9 21    stroke #22d3ee, width 2.6, round caps/joins
  - cursor bar  x16 y18.7 w7.5 h2.6 rx1.3   fill #22d3ee

Run:  python3 scripts/gen-favicon.py   (or `make favicon`)
Needs Pillow (`python3 -m pip install pillow`).
"""

from pathlib import Path
from PIL import Image, ImageDraw

SLATE = (2, 6, 23, 255)      # #020617
CYAN = (34, 211, 238, 255)   # #22d3ee
SS = 16                      # supersample factor for crisp antialiasing

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"

# Mark geometry in the 32-unit design space.
CHEVRON = [(9, 11), (14, 16), (9, 21)]
STROKE = 2.6
CURSOR = (16, 18.7, 23.5, 21.3)  # x0, y0, x1, y1  (w=7.5, h=2.6)
CURSOR_R = 1.3
BG_RADIUS = 6                    # rounded-chip corner radius


def render(size: int, rounded_bg: bool) -> Image.Image:
    """Draw the mark at `size` px. rounded_bg=True gives a rounded chip on a
    transparent field; False fills the whole square (for apple-touch-icon)."""
    px = size * SS
    s = px / 32.0  # design-unit -> pixel scale
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background
    if rounded_bg:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=BG_RADIUS * s, fill=SLATE)
    else:
        d.rectangle([0, 0, px, px], fill=SLATE)

    # Chevron: round-capped, round-jointed polyline. PIL's `joint="curve"`
    # rounds the interior vertex; we add disks at every point for round caps.
    w = STROKE * s
    pts = [(x * s, y * s) for x, y in CHEVRON]
    d.line(pts, fill=CYAN, width=round(w), joint="curve")
    r = w / 2.0
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=CYAN)

    # Cursor bar
    x0, y0, x1, y1 = CURSOR
    d.rounded_rectangle(
        [x0 * s, y0 * s, x1 * s, y1 * s], radius=CURSOR_R * s, fill=CYAN
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    targets = [
        ("favicon-32.png", 32, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, rounded in targets:
        render(size, rounded).save(OUT / name)
        print(f"wrote {OUT / name}  ({size}x{size})")


if __name__ == "__main__":
    main()
