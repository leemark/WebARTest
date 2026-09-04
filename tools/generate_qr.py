#!/usr/bin/env python3
"""Generate the QR code for the live GitHub Pages URL.

Output: qr-code.png (terminal preview printed too, if the console supports it).
"""

import os

import qrcode

URL = "https://leemark.github.io/WebARTest/"
OUT = os.path.join(os.path.dirname(__file__), "..", "qr-code.png")


def main():
    qr = qrcode.QRCode(box_size=12, border=4)
    qr.add_data(URL)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(OUT)
    print(f"saved {OUT} -> {URL}")

    # Terminal preview for a quick eyeball check (skip if the console can't
    # render block characters, e.g. Windows cp1252)
    try:
        qr.print_ascii(invert=True)
    except UnicodeEncodeError:
        print("(terminal preview skipped — console can't render block chars)")


if __name__ == "__main__":
    main()
