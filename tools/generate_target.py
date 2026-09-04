#!/usr/bin/env python3
"""Generate a print-ready MindAR image target for the Tiger AR prototype.

The card is designed to track well (MindAR wants rich, asymmetric,
high-contrast detail) while still looking like a piece of premium
admitted-student print collateral: a chunky pixel-tiger face with
diagonal tiger stripes on warm cream stock.

Output: targets/tiger-card.png  (1600x1600, ~300dpi at ~5in square)

Compile it for the app with the MindAR image target compiler:
https://hiukim.github.io/mind-ar-js-doc/tools/compile
and save the result as targets/tiger-card.mind

No official institutional artwork is used — this is an original,
generic blocky tiger motif matching the AR mascot.
"""

import os
import random

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


def main():
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

    # --- caption -------------------------------------------------------------
    title = font(96)
    small = font(44)
    tw = draw.textlength("TIGER AR", font=title)
    draw.text(((SIZE - tw) / 2, 1250), "TIGER AR", font=title, fill=BLACK)
    caption = "SCAN  \u2022  POINT  \u2022  DANCE"
    cw = draw.textlength(caption, font=small)
    draw.text(((SIZE - cw) / 2, 1390), caption, font=small, fill=GOLD_DEEP)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, dpi=(300, 300))

    # --- quick tracking-quality sanity check --------------------------------
    gray = np.asarray(img.convert("L"), dtype=np.float32)
    gx = np.abs(np.diff(gray, axis=1)).mean()
    gy = np.abs(np.diff(gray, axis=0)).mean()
    print(f"saved {OUT} ({SIZE}x{SIZE})")
    print(f"mean |dI/dx|={gx:.2f}  |dI/dy|={gy:.2f}  std={gray.std():.1f} "
          "(higher = more texture; std > 50 tracks well)")


if __name__ == "__main__":
    main()
