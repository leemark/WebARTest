#!/usr/bin/env python3
"""Build the self-contained tiger welcome card and its print-ready PDF.

The card uses the original compiled target and QR PNG bytes.  The SVG keeps
those bytes as data URLs; the PDF draws the same 6 x 8 inch composition on a
US Letter page with the card centered at actual size.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth


ROOT = Path(__file__).resolve().parents[1]
TARGET_PATH = ROOT / 'targets' / 'tiger-card.png'
QR_PATH = ROOT / 'qr-code.png'
SVG_PATH = ROOT / 'targets' / 'tiger-experience-card.svg'
PDF_PATH = ROOT / 'output' / 'pdf' / 'tiger-experience-card-letter.pdf'

TARGET_SHA256 = 'cfcecd7b9c984fee5c9a8118576d1cba9668641e10ac67c0e4984a656179ea59'
QR_SHA256 = '55fc8254658756d3447135510f4c3e9001eb609666a201434b7288082f64546f'

CARD_W = 600
CARD_H = 800
TARGET_X = 50
TARGET_Y = 120
TARGET_SIZE = 500
QR_X = 50
QR_Y = 650
QR_SIZE = 112

CREAM = '#faf6ef'
GOLD = '#eab337'
DEEP_GOLD = '#a86f0b'
INK = '#262019'
MUTED = '#6d6255'
PANEL = '#fffdf9'
RULE = '#e7d9bf'


def read_sources() -> tuple[bytes, bytes]:
    target = TARGET_PATH.read_bytes()
    qr = QR_PATH.read_bytes()
    target_hash = hashlib.sha256(target).hexdigest()
    qr_hash = hashlib.sha256(qr).hexdigest()
    if target_hash != TARGET_SHA256:
        raise ValueError(f'Unexpected target PNG bytes: {target_hash}')
    if qr_hash != QR_SHA256:
        raise ValueError(f'Unexpected QR PNG bytes: {qr_hash}')
    with Image.open(BytesIO(target)) as image:
        if image.size != (1600, 1600):
            raise ValueError(f'Expected 1600x1600 target, got {image.size}')
    with Image.open(BytesIO(qr)) as image:
        if image.size != (444, 444):
            raise ValueError(f'Expected 444x444 QR, got {image.size}')
    return target, qr


def data_url(data: bytes) -> str:
    return 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')


def svg_text(x: int, y: int, text: str, size: float, *, weight: str = '400',
             fill: str = INK, anchor: str | None = None,
             letter_spacing: float | None = None) -> str:
    attrs = [f'x="{x}"', f'y="{y}"', f'font-size="{size:g}"',
             f'font-weight="{weight}"', f'fill="{fill}"']
    if anchor:
        attrs.append(f'text-anchor="{anchor}"')
    if letter_spacing is not None:
        attrs.append(f'letter-spacing="{letter_spacing:g}"')
    joined_attrs = ' '.join(attrs)
    return f'<text {joined_attrs}>{escape(text)}</text>'


def build_svg(target: bytes, qr: bytes) -> None:
    target_href = data_url(target)
    qr_href = data_url(qr)
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="6in" height="8in" viewBox="0 0 600 800" role="img" aria-labelledby="title desc">',
        '  <title id="title">Meet your tiny tiger.</title>',
        '  <desc id="desc">A Colorado College welcome card. Scan the QR, tap Start AR, lay the card flat, and point at the tiger artwork.</desc>',
        f'  <rect width="600" height="800" fill="{CREAM}"/>',
        f'  <rect x="28" y="28" width="544" height="744" rx="8" fill="none" stroke="{GOLD}" stroke-width="1.5"/>',
        f'  <g font-family="Arial, Helvetica, sans-serif" fill="{INK}">',
        '    ' + svg_text(50, 49, 'A COLORADO COLLEGE WELCOME', 10, weight='700', fill=DEEP_GOLD, letter_spacing=2.2),
        '    ' + svg_text(50, 90, 'Meet your tiny tiger.', 32, weight='700'),
        f'    <rect x="50" y="103" width="58" height="3" rx="1.5" fill="{GOLD}"/>',
        f'    <image x="{TARGET_X}" y="{TARGET_Y}" width="{TARGET_SIZE}" height="{TARGET_SIZE}" href="{target_href}"/>',
        f'    <rect x="50" y="640" width="500" height="122" rx="10" fill="{PANEL}" stroke="{RULE}" stroke-width="1"/>',
        f'    <image x="{QR_X}" y="{QR_Y}" width="{QR_SIZE}" height="{QR_SIZE}" href="{qr_href}"/>',
        f'    <line x1="178" y1="651" x2="178" y2="751" stroke="{GOLD}" stroke-width="3"/>',
        f'    <circle cx="196" cy="670" r="10" fill="{GOLD}"/>',
        '    ' + svg_text(196, 675, '1', 12, weight='700', anchor='middle'),
        '    ' + svg_text(216, 676, 'Scan the QR.', 16, weight='700'),
        f'    <circle cx="196" cy="704" r="10" fill="{GOLD}"/>',
        '    ' + svg_text(196, 709, '2', 12, weight='700', anchor='middle'),
        '    ' + svg_text(216, 710, 'Tap Start AR.', 16, weight='700'),
        f'    <circle cx="196" cy="738" r="10" fill="{GOLD}"/>',
        '    ' + svg_text(196, 743, '3', 12, weight='700', anchor='middle'),
        '    ' + svg_text(216, 743, 'Lay flat. Point at the tiger above.', 14, weight='400'),
        f'    <line x1="50" y1="776" x2="550" y2="776" stroke="{RULE}" stroke-width="1"/>',
        f'    <g stroke="{DEEP_GOLD}" stroke-width="1.5" fill="none" stroke-linecap="square" stroke-linejoin="miter">',
        '      <path d="M145 789h18m-18 0 5-4m-5 4 5 4"/>',
        '      <path d="M455 789h-18m18 0-5-4m5 4-5 4"/>',
        '    </g>',
        '    ' + svg_text(300, 792, 'VIEWING EDGE - FACE THIS EDGE TOWARD YOU', 8, weight='700', fill=MUTED, anchor='middle', letter_spacing=1.1),
        '  </g>',
        '</svg>',
    ]
    SVG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SVG_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')


def pdf_y(card_bottom: float, y_top: float, height: float, scale: float) -> float:
    return card_bottom + (CARD_H - y_top - height) * scale


def draw_pdf_text(c: canvas.Canvas, card_left: float, card_bottom: float,
                  x: float, y: float, text: str, size: float, scale: float,
                  *, bold: bool = False, fill: str = INK,
                  anchor: str | None = None, letter_spacing: float = 0) -> None:
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size * scale)
    c.setFillColor(colors.HexColor(fill))
    width = stringWidth(text, font, size * scale)
    px = card_left + x * scale
    if anchor == 'middle':
        px -= width / 2
    elif anchor == 'end':
        px -= width
    py = card_bottom + (CARD_H - y) * scale
    if letter_spacing:
        # ReportLab's standard fonts have no tracking API. Draw each glyph
        # separately to match the compact SVG eyebrow and viewing-edge label.
        cursor = px
        for char in text:
            c.drawString(cursor, py, char)
            cursor += stringWidth(char, font, size * scale) + letter_spacing * scale
    else:
        c.drawString(px, py, text)


def build_pdf(target: bytes, qr: bytes) -> None:
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    page_w, page_h = letter
    scale = 0.72  # 100 SVG units per inch -> 72 points per inch.
    card_w = CARD_W * scale
    card_h = CARD_H * scale
    card_left = (page_w - card_w) / 2
    card_bottom = (page_h - card_h) / 2

    c = canvas.Canvas(str(PDF_PATH), pagesize=letter, pageCompression=1,
                      invariant=1)
    c.setTitle('Meet your tiny tiger - printable welcome card')
    c.setAuthor('WebARTest')

    # The print note lives in the page margin, outside the 6 x 8 inch card.
    c.setFillColor(colors.HexColor(MUTED))
    c.setFont('Helvetica-Bold', 7.5)
    margin_note = 'PRINT AT 100% / ACTUAL SIZE  -  CARD 6 x 8 in  -  TARGET 5 x 5 in'
    c.drawCentredString(page_w / 2, card_bottom - 30, margin_note)

    c.setFillColor(colors.HexColor(CREAM))
    c.rect(card_left, card_bottom, card_w, card_h, stroke=0, fill=1)
    c.setStrokeColor(colors.HexColor(GOLD))
    c.setLineWidth(1.5 * scale)
    c.roundRect(card_left + 28 * scale, card_bottom + 28 * scale,
                544 * scale, 744 * scale, 8 * scale, stroke=1, fill=0)

    draw_pdf_text(c, card_left, card_bottom, 50, 49,
                  'A COLORADO COLLEGE WELCOME', 10, scale,
                  bold=True, fill=DEEP_GOLD, letter_spacing=2.2)
    draw_pdf_text(c, card_left, card_bottom, 50, 90,
                  'Meet your tiny tiger.', 32, scale, bold=True)
    c.setFillColor(colors.HexColor(GOLD))
    c.roundRect(card_left + 50 * scale, pdf_y(card_bottom, 103, 3, scale),
                58 * scale, 3 * scale, 1.5 * scale, stroke=0, fill=1)

    target_reader = ImageReader(BytesIO(target))
    qr_reader = ImageReader(BytesIO(qr))
    c.drawImage(target_reader, card_left + TARGET_X * scale,
                pdf_y(card_bottom, TARGET_Y, TARGET_SIZE, scale),
                TARGET_SIZE * scale, TARGET_SIZE * scale,
                preserveAspectRatio=False, mask='auto')

    panel_y = pdf_y(card_bottom, 640, 122, scale)
    c.setFillColor(colors.HexColor(PANEL))
    c.setStrokeColor(colors.HexColor(RULE))
    c.setLineWidth(scale)
    c.roundRect(card_left + 50 * scale, panel_y, 500 * scale, 122 * scale,
                10 * scale, stroke=1, fill=1)
    c.drawImage(qr_reader, card_left + QR_X * scale,
                pdf_y(card_bottom, QR_Y, QR_SIZE, scale),
                QR_SIZE * scale, QR_SIZE * scale,
                preserveAspectRatio=False, mask='auto')

    c.setStrokeColor(colors.HexColor(GOLD))
    c.setLineWidth(3 * scale)
    c.line(card_left + 178 * scale, pdf_y(card_bottom, 651, 100, scale),
           card_left + 178 * scale, pdf_y(card_bottom, 651, 0, scale))
    for cy, number, label, text_y, text_size in [
        (670, '1', 'Scan the QR.', 676, 16),
        (704, '2', 'Tap Start AR.', 710, 16),
        (738, '3', 'Lay flat. Point at the tiger above.', 743, 14),
    ]:
        c.setFillColor(colors.HexColor(GOLD))
        c.circle(card_left + 196 * scale,
                 pdf_y(card_bottom, cy, 0, scale), 10 * scale,
                 stroke=0, fill=1)
        draw_pdf_text(c, card_left, card_bottom, 196, cy + 4.5, number,
                      12, scale, bold=True, anchor='middle')
        draw_pdf_text(c, card_left, card_bottom, 216, text_y, label,
                      text_size, scale, bold=text_size == 16)

    c.setStrokeColor(colors.HexColor(RULE))
    c.setLineWidth(scale)
    c.line(card_left + 50 * scale, pdf_y(card_bottom, 776, 0, scale),
           card_left + 550 * scale, pdf_y(card_bottom, 776, 0, scale))
    c.setStrokeColor(colors.HexColor(DEEP_GOLD))
    c.setLineWidth(1.5 * scale)
    for x1, x2, direction in [(145, 163, 1), (455, 437, -1)]:
        y = pdf_y(card_bottom, 789, 0, scale)
        c.line(card_left + x1 * scale, y, card_left + x2 * scale, y)
        c.line(card_left + x1 * scale, y,
               card_left + (x1 + 5 * direction) * scale,
               y + 4 * scale)
        c.line(card_left + x1 * scale, y,
               card_left + (x1 + 5 * direction) * scale,
               y - 4 * scale)
    draw_pdf_text(c, card_left, card_bottom, 300, 792,
                  'VIEWING EDGE - FACE THIS EDGE TOWARD YOU', 8, scale,
                  bold=True, fill=MUTED, anchor='middle', letter_spacing=1.1)

    c.showPage()
    c.save()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--svg', action='store_true', help='write the SVG card')
    parser.add_argument('--pdf', action='store_true', help='write the US Letter PDF')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.svg and not args.pdf:
        args.svg = True
        args.pdf = True
    target, qr = read_sources()
    if args.svg:
        build_svg(target, qr)
        print(f'Wrote {SVG_PATH}')
    if args.pdf:
        build_pdf(target, qr)
        print(f'Wrote {PDF_PATH}')
    print(f'target sha256: {hashlib.sha256(target).hexdigest()}')
    print(f'qr sha256: {hashlib.sha256(qr).hexdigest()}')


if __name__ == '__main__':
    main()
