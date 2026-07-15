#!/usr/bin/env python3
"""Generate assets/img/og-card.jpg — the 1200x630 social share card.

Rerun after changing the name/title/tagline below (e.g. a role change),
then commit the regenerated JPEG. Rendered at 2x and downscaled for
crisp text. Requires Pillow (pip install Pillow) and the TTF fonts:

    curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=Inter:wght@600;800&family=JetBrains+Mono:wght@400;500" \
      | grep -o 'https://[^)]*\\.ttf'
    # download into tools/fonts/: inter-600.ttf inter-800.ttf jbm-400.ttf jbm-500.ttf
    # (order in the CSS matches the weight order requested above)

Run from the repo root:  python3 tools/generate-og-card.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ---- content -----------------------------------------------------------
NAME     = "Sam Donche"
TITLE    = "Industry 4.0 Consultant"
EYEBROW  = "DIGITAL BACKBONE FOR FACTORIES"
CTA      = "Get in touch →"
DOMAIN   = "samdonche.com"
PORTRAIT = "assets/img/portrait.jpg"
OUT      = "assets/img/og-card.jpg"
FONT_DIR = "tools/fonts"

# ---- palette (matches the site tokens) ---------------------------------
S = 2  # supersampling factor
W, H = 1200 * S, 630 * S
BG = (2, 6, 23); GRID = (12, 17, 34); CYAN = (34, 211, 238); CYAN_L = (103, 232, 249)
WHITE = (241, 245, 249); SLATE3 = (203, 213, 225); SLATE4 = (148, 163, 184)
SLATE5 = (100, 116, 139); BORDER = (30, 41, 59); CARD_BG = (10, 16, 34)
ACCENT = (52, 211, 153)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# background grid + soft cyan glow
for x in range(0, W, 48 * S):
    d.line([(x, 0), (x, H)], fill=GRID, width=S)
for y in range(0, H, 48 * S):
    d.line([(0, y), (W, y)], fill=GRID, width=S)
glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse([-300 * S, -350 * S, 900 * S, 450 * S], fill=26)
glow = glow.filter(ImageFilter.GaussianBlur(160 * S))
img = Image.composite(Image.new("RGB", (W, H), CYAN), img, glow)
d = ImageDraw.Draw(img)

F = lambda f, s: ImageFont.truetype(f"{FONT_DIR}/{f}", s * S)
eyebrow_f = F("jbm-500.ttf", 26); name_f = F("inter-800.ttf", 98)
title_f = F("inter-600.ttf", 44); mono_f = F("jbm-400.ttf", 28)
tiny_f = F("jbm-500.ttf", 18)

def tracked(draw, xy, text, font, fill, tracking=0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking * S
    return x

# left column
LX = 90 * S
ey_y = 160 * S
d.line([(LX, ey_y + 16 * S), (LX + 56 * S, ey_y + 16 * S)], fill=CYAN, width=2 * S)
tracked(d, (LX + 76 * S, ey_y), EYEBROW, eyebrow_f, CYAN, tracking=3)
d.text((LX, 215 * S), NAME, font=name_f, fill=WHITE)
d.text((LX, 345 * S), TITLE, font=title_f, fill=SLATE3)

# CTA styled like the site's primary button (cyan fill, dark text)
cta_f = F("inter-600.ttf", 30)
cta_y = 440 * S
pad_x, pad_y = 30 * S, 18 * S
cta_w = int(d.textlength(CTA, font=cta_f)) + 2 * pad_x
cta_h = 30 * S + 2 * pad_y
d.rounded_rectangle([LX, cta_y, LX + cta_w, cta_y + cta_h], radius=10 * S, fill=CYAN)
d.text((LX + pad_x, cta_y + pad_y - 2 * S), CTA, font=cta_f, fill=BG)

dot_y = 545 * S
dx = LX + cta_w + 40 * S
d.ellipse([dx, cta_y + cta_h // 2 - 7 * S, dx + 14 * S, cta_y + cta_h // 2 + 7 * S], fill=ACCENT)
d.text((dx + 28 * S, cta_y + cta_h // 2 - 17 * S), DOMAIN, font=mono_f, fill=SLATE4)

# right: portrait in the profile-inspector card treatment
card_w = 340 * S
photo = Image.open(PORTRAIT)
ph_h = int(card_w * photo.height / photo.width)
head_h = 48 * S
card_h = head_h + ph_h
cx1 = W - card_w - 80 * S
cy1 = (H - card_h) // 2
cx2, cy2 = cx1 + card_w, cy1 + card_h
d.rounded_rectangle([cx1, cy1, cx2, cy2], radius=14 * S, fill=CARD_BG, outline=BORDER, width=2 * S)
tracked(d, (cx1 + 20 * S, cy1 + 15 * S), "◇ samdonche/profile", tiny_f, CYAN_L, tracking=2)
d.line([(cx1, cy1 + head_h), (cx2, cy1 + head_h)], fill=BORDER, width=2 * S)
photo = photo.resize((card_w, ph_h), Image.LANCZOS)
mask = Image.new("L", (card_w, ph_h), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, -20 * S, card_w, ph_h], radius=13 * S, fill=255)
img.paste(photo, (cx1, cy1 + head_h), mask)
d.rounded_rectangle([cx1, cy1, cx2, cy2], radius=14 * S, outline=BORDER, width=2 * S)

img.resize((1200, 630), Image.LANCZOS).save(OUT, "JPEG", quality=90, optimize=True, progressive=True)
print(f"wrote {OUT}")
