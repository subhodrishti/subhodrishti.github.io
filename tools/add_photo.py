"""Prepare real photos for the "Real moments" gallery.

Applies EXIF rotation, then drops *all* metadata (GPS, camera, timestamps),
sizes the long edge to 1600px, and writes WebP into assets/photos/. Prints a
config line per photo for js/config.js; fill in the alt text by hand.

Usage:  python tools/add_photo.py IMG_1.jpg IMG_2.png --prefix 2024-puja
HEIC needs `pip install pillow-heif`.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageOps

try:  # optional HEIC support for iPhone photos
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "photos"
LONG_EDGE = 1600


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--prefix", default="moment", help="file name prefix, e.g. 2024-puja")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    start = len(list(OUT.glob(f"{args.prefix}-*.webp"))) + 1
    for i, src in enumerate(args.files, start):
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
            # Re-create the pixels in a fresh image so no metadata block survives.
            clean = Image.new("RGB", im.size)
            clean.paste(im)
            dest = OUT / f"{args.prefix}-{i}.webp"
            clean.save(dest, "WEBP", quality=82, method=6)
        rel = dest.relative_to(ROOT).as_posix()
        print(f'    {{ src: "{rel}", alt: {{ en: "TODO describe the photo", bn: "TODO" }}, caption: {{ en: "", bn: "" }}, w: {clean.width}, h: {clean.height} }},')


if __name__ == "__main__":
    main()
