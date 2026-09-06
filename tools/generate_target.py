#!/usr/bin/env python3
"""Generate a print-ready MindAR image target for the Tiger AR prototype.

The card is designed to track well (MindAR wants rich, asymmetric,
high-contrast detail) while still looking like a piece of premium print
collateral: a faceted mascot face with diagonal tiger stripes on
warm cream stock.

Output: targets/tiger-card.png  (1600x1600, ~300dpi at ~5in square)

Compile it for the app with the MindAR image target compiler:
https://hiukim.github.io/mind-ar-js-doc/tools/compile
and save the result as targets/tiger-card.mind

No pre-existing artwork is used — this is an original, generic blocky
tiger motif matching the AR mascot.
"""

import os
import random
import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SIZE = 1600
OUT = os.path.join(os.path.dirname(__file__), "..", "targets", "tiger-card.png")

CREAM = (250, 246, 239)
ORANGE = (232, 150, 28)
GOLD_DEEP = (198, 123, 14)
BLACK = (26, 20, 14)
WHITE = (255, 255, 255)

# ---------------------------------------------------------------------------
# 16x16 pixel-art tiger face ('.'=skip, O=orange, B=black, W=white)
# Symmetric enough to read as a face; surrounding stripes break symmetry
# for the tracker. Blocky on purpose — it matches the voxel mascot.
# ---------------------------------------------------------------------------
TIGER = [
    "................",
    ".OO..........OO.",
    ".OBO........OBO.",
    ".OOO........OOO.",
    ".OOOOOOOOOOOOOO.",
    ".OBBBOOOOOOBBBO.",
    ".OOOOOOOOOOOOOO.",
    ".OWBOOOOOOOOBWO.",
    ".OWBOOWWWWOOBWO.",
    ".OOOOOWBBWOOOOO.",
    ".OOOOOWWWWOOOOO.",
    ".OOOOOOOOOOOOOO.",
    ".OBBOOOOOOOOBBO.",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOOO...",
    "................",
]


def font(size):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_mascot_face(draw):
    """Original faceted portrait using the procedural character's palette/features."""
    gold, light, shade = '#eab337', '#ffdc65', '#bb8826'
    ink, ivory, teal = '#2a2118', '#f7f1e3', '#2d8b78'

    def poly(points, fill):
        draw.polygon([(380 + x * 1.05, 320 + y * 1.05) for x, y in points], fill=fill)

    def box(x, y, w, h, fill):
        poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], fill)

    # A slight three-quarter facet gives the printed portrait the toy's depth.
    draw.rectangle([326, 274, 1274, 1222], fill=WHITE, outline=BLACK, width=10)
    poly([(115, 685), (685, 685), (738, 651), (177, 651)], '#e6dfd2')
    for x in (120, 510):
        poly([(x, 35), (x + 35, 10), (x + 170, 10), (x + 135, 35)], light)
        poly([(x + 135, 35), (x + 170, 10), (x + 170, 180), (x + 135, 205)], shade)
        box(x, 35, 135, 170, gold)
        box(x + 34, 76, 67, 94, ivory)
        box(x + 34, 76, 67, 17, '#d7c9a7')
    poly([(80, 180), (140, 140), (725, 140), (665, 180)], light)
    poly([(665, 180), (725, 140), (725, 625), (665, 665)], shade)
    box(80, 180, 585, 485, gold)
    box(80, 180, 585, 20, '#f5c94c')
    # Forehead markings and softly angled brows echo the animated figure.
    poly([(320, 180), (350, 180), (350, 262), (320, 262)], ink)
    poly([(230, 180), (261, 180), (281, 251), (250, 260)], ink)
    poly([(405, 180), (436, 180), (416, 260), (385, 251)], ink)
    poly([(147, 287), (270, 269), (277, 297), (152, 315)], ink)
    poly([(441, 270), (565, 291), (560, 318), (436, 298)], ink)
    # Large outlined teal eyes, dark pupils and square catchlights.
    for x, y in ((143, 335), (438, 338)):
        box(x, y, 151, 166, ink)
        box(x + 20, y + 18, 111, 134, teal)
        box(x + 20, y + 18, 111, 19, '#58ad92')
        box(x + 52, y + 62, 57, 91, '#1c1410')
        box(x + 34, y + 39, 33, 47, ivory)
        box(x + 93, y + 124, 18, 22, ivory)
    # Stepped white cheek ruff and a projecting, shaded muzzle.
    poly([(80, 490), (125, 490), (125, 465), (180, 465), (180, 521),
          (570, 521), (570, 467), (620, 467), (620, 493), (665, 493),
          (665, 620), (610, 620), (610, 653), (135, 653), (135, 620), (80, 620)], ivory)
    poly([(80, 620), (135, 620), (135, 653), (610, 653), (610, 620),
          (665, 620), (665, 665), (80, 665)], '#dbd4c5')
    poly([(194, 506), (230, 479), (588, 479), (552, 506)], '#fffdf7')
    box(194, 506, 358, 110, ivory)
    poly([(552, 506), (588, 479), (588, 589), (552, 616)], '#d7cdb9')
    box(323, 496, 106, 60, '#1c1410')
    box(323, 496, 106, 12, '#554237')
    box(362, 556, 22, 28, ink)
    poly([(321, 583), (344, 590), (402, 590), (427, 580), (427, 604),
          (404, 614), (342, 614), (321, 603)], ink)
    # Short cheek stripes remain readable when printed; the sides differ.
    poly([(80, 414), (127, 435), (127, 463), (80, 444)], ink)
    poly([(616, 433), (665, 409), (665, 441), (616, 464)], ink)
    poly([(674, 326), (725, 292), (725, 326), (674, 358)], ink)
    poly([(680, 386), (725, 358), (725, 383), (680, 416)], ink)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--face', choices=['pixel', 'mascot'], default='mascot')
    args = parser.parse_args()
    out = OUT if args.face == 'mascot' else OUT.replace('.png', '-pixel.png')
    rng = random.Random(20260903)  # deterministic layout
    img = Image.new("RGB", (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(img)

    # --- border frame ------------------------------------------------------
    m = 26
    draw.rectangle([m, m, SIZE - m, SIZE - m], outline=BLACK, width=22)
    draw.rectangle([m + 40, m + 40, SIZE - m - 40, SIZE - m - 40],
                   outline=GOLD_DEEP, width=4)

    # --- diagonal tiger stripes (asymmetric detail = happy tracker) --------
    stripes = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    sdraw = ImageDraw.Draw(stripes)
    y = -150
    while y < SIZE + 150:
        w = rng.randint(46, 96)
        gap = rng.randint(120, 210)
        col = BLACK if rng.random() < 0.72 else GOLD_DEEP
        sdraw.polygon(
            [(0, y), (SIZE, y - 420), (SIZE, y - 420 + w), (0, y + w)],
            fill=col,
        )
        y += w + gap
    stripes = stripes.rotate(-24, resample=Image.BILINEAR, center=(SIZE // 2, SIZE // 2))

    # keep stripes inside a band, away from the central face and the corners
    mask = Image.new("L", (SIZE, SIZE), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rectangle([120, 120, SIZE - 120, SIZE - 120], fill=255)
    mdraw.rectangle([420, 330, SIZE - 420, 1150], fill=0)      # face zone
    for cx, cy in [(120, 120), (SIZE - 120, 120), (120, SIZE - 120), (SIZE - 120, SIZE - 120)]:
        mdraw.ellipse([cx - 190, cy - 190, cx + 190, cy + 190], fill=0)  # corner marks
    mdraw.rectangle([120, 1180, SIZE - 120, SIZE - 120], fill=0)         # text zone
    img.paste(stripes, (0, 0), mask)

    # --- corner registration diamonds (3, asymmetric) ----------------------
    def diamond(cx, cy, r, color):
        draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=color)

    for cx, cy in [(150, 150), (SIZE - 150, 150), (150, SIZE - 150)]:
        diamond(cx, cy, 74, BLACK)
        diamond(cx, cy, 34, ORANGE)
    # fourth corner deliberately different: concentric squares
    cx, cy = SIZE - 150, SIZE - 150
    draw.rectangle([cx - 74, cy - 74, cx + 74, cy + 74], fill=BLACK)
    draw.rectangle([cx - 36, cy - 36, cx + 36, cy + 36], fill=ORANGE)

    # --- pixel tiger face ---------------------------------------------------
    cell = 56
    grid = len(TIGER)
    ox = (SIZE - grid * cell) // 2
    oy = 300
    pad = 26
    draw.rectangle(
        [ox - pad, oy - pad, ox + grid * cell + pad, oy + grid * cell + pad],
        fill=WHITE, outline=BLACK, width=10,
    )
    colors = {"O": ORANGE, "B": BLACK, "W": WHITE}
    for r, row in enumerate(TIGER):
        assert len(row) == grid, f"row {r} has {len(row)} cells"
        for c, ch in enumerate(row):
            if ch == ".":
                continue
            x0, y0 = ox + c * cell, oy + r * cell
            draw.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=colors[ch])

    if args.face == 'mascot':
        draw_mascot_face(draw)

    # --- caption -------------------------------------------------------------
    title = font(96)
    small = font(44)
    tw = draw.textlength("TIGER AR", font=title)
    draw.text(((SIZE - tw) / 2, 1250), "TIGER AR", font=title, fill=BLACK)
    caption = "SCAN  \u2022  POINT  \u2022  DANCE"
    cw = draw.textlength(caption, font=small)
    draw.text(((SIZE - cw) / 2, 1390), caption, font=small, fill=GOLD_DEEP)

    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, dpi=(300, 300))

    # --- quick tracking-quality sanity check --------------------------------
    gray = np.asarray(img.convert("L"), dtype=np.float32)
    gx = np.abs(np.diff(gray, axis=1)).mean()
    gy = np.abs(np.diff(gray, axis=0)).mean()
    print(f"saved {out} ({SIZE}x{SIZE})")
    print(f"mean |dI/dx|={gx:.2f}  |dI/dy|={gy:.2f}  std={gray.std():.1f} "
          "(texture summary only; compilation and phone testing determine tracking quality)")


if __name__ == "__main__":
    main()
