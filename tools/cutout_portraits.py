"""Cut the bride and groom out of the family's portraits for "Our families".

The portraits (848x1258, illustrated, full length) are drawn like the
ceremony renders: near-black backdrop, an alpana floor mat and Gemini's
sparkle mark on the floor. So this reuses tools/cutout_avatars.py: the same
matting model, edge clean-up and gold rim glow.

The page shows them waist up in an arch (5:7), as on the family's card, so the
faces stay large on a phone. Both are laid out at one scale on one floor line,
then cropped through the same window, each centred on its own figure, so the
two sit level and the same size.

Setup (dev only):  pip install "rembg[cpu]"
Usage:  python tools/cutout_portraits.py
Reads:  references/families/{bride,groom}.png
Writes: assets/families/{bride,groom}.webp
"""
from PIL import Image

import cutout_avatars as ca

PORTRAITS = {
    "bride": {"src": "families/bride.png"},
    "groom": {"src": "families/groom.png"},
}
ASPECT = 5 / 7  # the page's .family__frame
SHOW = 0.46  # how much of the taller figure the window shows, from the top
HEADROOM = 0.06  # of the window, above the taller figure's crown
WIDTH_PX = 480  # the arch is at most 240 CSS px wide: covers a 2x screen
OUT = ca.ROOT / "assets" / "families"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    laid = ca.layout({k: ca.with_glow(ca.cutout(k, spec)) for k, spec in PORTRAITS.items()})
    tops = {k: im.getbbox()[1] for k, im in laid.items()}
    top = min(tops.values())
    floor = max(im.getbbox()[3] for im in laid.values())
    win_h = round((floor - top) * SHOW / (1 - HEADROOM))
    win_w = round(win_h * ASPECT)
    y0 = round(top - HEADROOM * win_h)
    for k, im in laid.items():
        # Centre on the head and shoulders, not on a pallu flaring to one side.
        x0, _, x1, _ = im.crop((0, tops[k], im.width, tops[k] + win_h // 2)).getbbox()
        cx = (x0 + x1) // 2
        win = im.crop((cx - win_w // 2, y0, cx - win_w // 2 + win_w, y0 + win_h))
        win = win.resize((WIDTH_PX, round(WIDTH_PX / ASPECT)), Image.LANCZOS)
        dest = OUT / f"{k}.webp"
        win.save(dest, "WEBP", quality=84, method=6)
        print(f"{dest.relative_to(ca.ROOT)}  {win.size[0]}x{win.size[1]}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
