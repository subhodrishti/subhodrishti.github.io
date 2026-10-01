"""Turn the family's generated decoration art into small transparent WebPs.

Each source image sits on a flat studio colour (navy or teal). We fit that
colour as a smooth surface from the image border, then either:

  * "solid" art (marigolds, paper, the terracotta arch): everything far enough
    from the backdrop is the object, holes are filled, and only a thin outer
    ring is feathered; or
  * "lace" art (shola chandmala, alpana): alpha follows colour distance, so
    the cut-outs between threads stay see-through, and colour is un-mixed
    from the backdrop so no navy or teal halo is left on the edges.

The image generator's four-point sparkle mark is painted out per image.

The curtain art (tassel, paan leaves) came with a grey-and-white "transparency"
checkerboard painted into opaque pixels instead; `checker` keys that out, and
the velvet is cut down to a seamless repeat.

The hero's courtyard (thakur dalan) is a full scene, not a cut-out: only its
sparkles are painted out.

Usage:  python tools/prepare_decorations.py
Reads:  references/decorations/*.png
Writes: assets/decor/*.webp (see the "Decorations" block in css/styles.css)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "references" / "decorations"
OUT = ROOT / "assets" / "decor"


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / name).convert("RGB"), dtype=np.float64)


def fit_backdrop(rgb: np.ndarray, band: int = 10) -> np.ndarray:
    """Quadratic surface per channel through the border pixels that look like
    backdrop (art touching the edge is rejected as an outlier)."""
    h, w, _ = rgb.shape
    ys, xs = np.mgrid[0:h, 0:w]
    edge = (ys < band) | (ys >= h - band) | (xs < band) | (xs >= w - band)
    med = np.median(rgb[edge], axis=0)
    sample = edge & (np.linalg.norm(rgb - med, axis=-1) < 28)
    xn, yn = xs / w, ys / h
    basis = np.stack([np.ones_like(xn), xn, yn, xn * yn, xn**2, yn**2], axis=-1)
    model = np.empty_like(rgb)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(basis[sample], rgb[..., c][sample], rcond=None)
        model[..., c] = basis @ coef
    return model


def solid(rgb, threshold=38, feather=(20, 60), max_hole=4000):
    bg = fit_backdrop(rgb)
    dist = np.linalg.norm(rgb - bg, axis=-1)
    mask = ndimage.binary_opening(dist > threshold, iterations=1)
    holes, n = ndimage.label(ndimage.binary_fill_holes(mask) & ~mask)
    if n:
        sizes = ndimage.sum(np.ones_like(dist), holes, range(1, n + 1))
        mask |= np.isin(holes, 1 + np.flatnonzero(np.asarray(sizes) < max_hole))
    ring = ndimage.binary_dilation(mask, iterations=2) & ~ndimage.binary_erosion(mask, iterations=2)
    soft = np.clip((dist - feather[0]) / (feather[1] - feather[0]), 0, 1)
    alpha = np.where(ring, soft, mask.astype(float))
    # Pull edge colour from just inside, so no backdrop spill rims the object.
    inner = ndimage.binary_erosion(mask, iterations=3)
    if inner.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
        rgb = np.where((~inner & (alpha > 0))[..., None], rgb[iy, ix], rgb)
    return rgb, alpha


def lace(rgb, lo=22, hi=120):
    bg = fit_backdrop(rgb)
    dist = np.linalg.norm(rgb - bg, axis=-1)
    alpha = np.clip((dist - lo) / (hi - lo), 0, 1)
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = bg + (rgb - bg) / a  # un-mix the backdrop out of half-covered pixels
    return np.clip(fg, 0, 255), alpha


def checker(rgb, chroma_min=26, dark=175, max_hole=600, trim=1):
    """Art on a painted-in checkerboard (neutral greys and whites): the object is
    anything coloured or dark. Small holes (glossy highlights) are filled; big
    ones (the tassel's rope loop) stay open. `trim` px come off the edge, where
    the checkerboard has bled into the outline."""
    chroma = rgb.max(axis=-1) - rgb.min(axis=-1)
    obj = (chroma > chroma_min) | (rgb.mean(axis=-1) < dark)
    obj = ndimage.binary_opening(obj, iterations=2)
    labels, n = ndimage.label(obj)
    sizes = ndimage.sum(obj, labels, range(1, n + 1))
    obj = np.isin(labels, 1 + np.flatnonzero(np.asarray(sizes) > 5000))  # drop specks
    holes, n = ndimage.label(ndimage.binary_fill_holes(obj) & ~obj)
    if n:
        sizes = ndimage.sum(np.ones(obj.shape), holes, range(1, n + 1))
        obj |= np.isin(holes, 1 + np.flatnonzero(np.asarray(sizes) < max_hole))
    if trim:
        obj = ndimage.binary_erosion(obj, iterations=trim)
    return rgb, ndimage.gaussian_filter(obj.astype(float), 0.8)


def rgba(rgb, alpha) -> Image.Image:
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8), "RGBA")
    im.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(0.5)))
    return im


def clear(alpha, box):
    x0, y0, x1, y1 = box
    alpha[y0:y1, x0:x1] = 0


def save(im: Image.Image, name: str, width=None, height=None, quality=82):
    if width or height:
        w, h = im.size
        size = (width, round(h * width / w)) if width else (round(w * height / h), height)
        im = im.resize(size, Image.LANCZOS)
    dest = OUT / name
    im.save(dest, "WEBP", quality=quality, method=6)
    print(f"{dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB")


def chandmala():
    rgb = load("Shola chandmala garland (section joins).png")
    rgb, alpha = lace(rgb, lo=40, hi=150)
    clear(alpha, (1250, 610, 1325, 690))  # sparkle
    im = rgba(rgb, alpha)
    # One repeat: from the centre of one hanging flower cluster to the next,
    # so the strip tiles seamlessly along a section's top edge.
    x0, x1 = 466, 936
    save(im.crop((x0, 170, x1, 600)), "chandmala.webp", height=240)


def marigold_thread():
    rgb = load("Marigold garland, vertical (events thread).png")
    rgb, alpha = solid(rgb)
    clear(alpha, (355, 1900, 430, 1985))  # sparkle
    alpha[:118] = 0  # the jute loop it hangs from
    im = rgba(rgb, alpha)
    # A seamless repeat for the events thread: the two rows (at least 500px
    # apart) that look most alike, so the strand runs on down a long list.
    px = np.asarray(im, dtype=np.float64)
    win = 6
    rows = np.stack([px[y:y + win].ravel() for y in range(150, px.shape[0] - 260 - win)])
    best = (np.inf, 0, 0)
    for i in range(0, len(rows), 2):
        for j in range(i + 500, len(rows), 2):
            cost = np.abs(rows[i] - rows[j]).mean()
            if cost < best[0]:
                best = (cost, 150 + i, 150 + j)
    _, y0, y1 = best
    print(f"  strand repeat rows {y0}-{y1}, mismatch {best[0]:.1f}")
    tile = im.crop((0, y0, im.width, y1))
    save(tile.crop((tile.getbbox()[0], 0, tile.getbbox()[2], tile.height)), "marigold-thread.webp", width=96)


def marigold_swag():
    rgb = load("Marigold swag, horizontal.png")
    rgb, alpha = solid(rgb, threshold=34)
    im = rgba(rgb, alpha)
    save(im.crop(im.getbbox()), "marigold-swag.webp", width=1400)


def alpana():
    """Four corners, kept as white masks so CSS can paint them in gold."""
    rgb = load("Alpana corner pieces.png")
    for i, (x0, y0) in enumerate([(12, 12), (518, 12), (12, 518), (518, 518)], 1):
        tile = rgb[y0:y0 + 494, x0:x0 + 494].copy()
        bg = np.median(tile[200:300, 300:480].reshape(-1, 3), axis=0) if i != 2 else np.median(
            tile[30:120, 300:480].reshape(-1, 3), axis=0)
        lum = tile.mean(axis=-1)
        alpha = np.clip((lum - bg.mean() - 25) / (235 - bg.mean() - 25), 0, 1)
        if i == 4:
            clear(alpha, (345, 345, 430, 430))  # sparkle, in tile coordinates
        # Each corner opens towards the bottom right, as the top-left corner of a card.
        im = rgba(np.full_like(tile, 255), alpha)
        save(im, f"alpana-{i}.webp", width=320)


def paper_tile():
    rgb = load("Handmade paper tile.png")
    # Paint out the faint sparkle with paper from just above it.
    rgb[930:985, 925:975] = rgb[830:885, 925:975]
    im = Image.fromarray(rgb.astype(np.uint8)).resize((512, 512), Image.LANCZOS)
    dest = OUT / "paper.webp"
    im.save(dest, "WEBP", quality=85, method=6)
    print(f"{dest.relative_to(ROOT)}  512x512  {dest.stat().st_size // 1024} KB")


def paper_sheet():
    rgb = load("Paper sheet with torn edge.png")
    # The photographed drop shadow is darker than the backdrop: drop it (the
    # page adds its own) by flattening anything darker to the backdrop colour.
    bg = fit_backdrop(rgb)
    dark = rgb.mean(axis=-1) < bg.mean(axis=-1) + 60
    rgb = np.where(dark[..., None], bg, rgb)
    rgb, alpha = solid(rgb, threshold=60, feather=(40, 110))
    clear(alpha, (740, 1045, 810, 1115))  # sparkle, on the backdrop
    im = rgba(rgb, alpha)
    save(im.crop(im.getbbox()), "paper-sheet.webp", width=640, quality=80)


def temple_arch():
    rgb = load("Terracotta temple arch.png")
    # The sparkle sits on the right pillar's base: the arch is symmetric, so
    # copy the left base across, mirrored.
    w = rgb.shape[1]
    y0, y1, x0, x1 = 1030, 1115, 740, 830
    rgb[y0:y1, x0:x1] = rgb[y0:y1, w - x1:w - x0][:, ::-1]
    rgb, alpha = solid(rgb, threshold=40, max_hole=1500)
    im = rgba(rgb, alpha)
    save(im.crop(im.getbbox()), "temple-arch.webp", width=600)


def gathbandhan():
    """The bride's red cloth tied to the groom's cream one, under "Our families".
    The source is framed in a gold border on cream paper: keep only the cloth,
    drop the frame's corner tassels, and fade the top where the cloth runs into
    the frame's top line."""
    rgb, alpha = solid(load("gathbandhan.png"), threshold=34, max_hole=3000)
    labels, n = ndimage.label(alpha > 0.5)
    sizes = ndimage.sum(alpha > 0.5, labels, range(1, n + 1))
    alpha = np.where(ndimage.binary_dilation(labels == 1 + int(np.argmax(sizes)), iterations=3), alpha, 0)
    h, w = alpha.shape
    clear(alpha, (0, 440, 186, h))
    clear(alpha, (w - 186, 440, w, h))
    top, fade = 26, 70
    alpha[:top] = 0
    alpha[top:top + fade] *= np.linspace(0, 1, fade)[:, None]
    im = rgba(rgb, alpha)
    save(im.crop(im.getbbox()), "gathbandhan.webp", width=900)


def tassel():
    """The gold tie-back that catches each curtain panel."""
    rgb, alpha = checker(load("Gold tassel tie-back.png"))
    im = rgba(rgb, alpha)
    save(im.crop(im.getbbox()), "tassel.webp", height=560)


def paan():
    """Two betel leaves held over the bride's face (shubho drishti), one file
    each so they can part in different directions."""
    rgb, alpha = checker(load("Pair of paan (betel) leaves.png"), trim=2)
    im = rgba(rgb, alpha)
    mid = im.width // 2
    for side, box in (("left", (0, 0, mid, im.height)), ("right", (mid, 0, im.width, im.height))):
        leaf = im.crop(box)
        save(leaf.crop(leaf.getbbox()), f"paan-{side}.webp", width=320)


def velvet():
    """The curtain's navy velvet with zari kalka buti, as a seamless tile.

    Across, columns 52 and 440 match almost exactly. Down, the tile spans six
    rows of buti, and its last 24 rows are crossfaded into the rows just above
    its top, both inside bare velvet between buti rows, so the shading runs on
    without a line and no buti is ghosted. (The sparkle, at x≈645, is outside.)"""
    rgb = load("Velvet with zari buti, tileable.png")
    x0, x1, y0, y1, k = 52, 440, 646, 1338, 24
    tile = rgb[y0:y1, x0:x1].copy()
    t = np.linspace(0, 1, k)[:, None, None]
    tile[-k:] = rgb[y1 - k:y1, x0:x1] * (1 - t) + rgb[y0 - k:y0, x0:x1] * t
    im = Image.fromarray(tile.clip(0, 255).astype(np.uint8))
    dest = OUT / "velvet.webp"
    im.save(dest, "WEBP", quality=78, method=6)
    print(f"{dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB")


def patch(rgb, box, src_x, feather=6):
    """Paint out a sparkle by blending in pixels from the same rows at `src_x`,
    with a soft elliptical edge."""
    x0, y0, x1, y1 = box
    src = rgb[y0:y1, src_x:src_x + (x1 - x0)].copy()
    ys, xs = np.mgrid[y0:y1, x0:x1]
    r = np.hypot((xs - (x0 + x1) / 2) / ((x1 - x0) / 2), (ys - (y0 + y1) / 2) / ((y1 - y0) / 2))
    k = np.clip((1 - r) * (x1 - x0) / 2 / feather, 0, 1)[..., None]
    rgb[y0:y1, x0:x1] = rgb[y0:y1, x0:x1] * (1 - k) + src * k


def unsparkle(rgb, cx, cy, rx, ry, pad=1.3):
    """Fill a four-point-star mask row by row, interpolating between the pixels
    just left and right of it. For a sparkle over horizontal structure (a
    plinth edge, a floor line, a lamp's light falling off) where no other
    pixels share the same light to copy from."""
    y0, y1 = int(cy - ry * pad), int(cy + ry * pad) + 1
    x0, x1 = int(cx - rx * pad), int(cx + rx * pad) + 1
    ys, xs = np.mgrid[y0:y1, x0:x1]
    star = (np.abs(xs - cx) / rx) ** (2 / 3) + (np.abs(ys - cy) / ry) ** (2 / 3)
    for row, y in enumerate(range(y0, y1)):
        cols = np.flatnonzero(star[row] <= pad)
        if not cols.size:
            continue
        a, b = x0 + cols[0] - 2, x0 + cols[-1] + 2
        left, right = rgb[y, a - 2:a + 1].mean(axis=0), rgb[y, b:b + 3].mean(axis=0)
        t = np.linspace(0, 1, b - a + 1)[:, None]
        rgb[y, a:b + 1] = left * (1 - t) + right * t
    # Soften the filled rows into each other.
    box = rgb[y0:y1, x0:x1]
    smooth = ndimage.gaussian_filter(box, (1.2, 0.6, 0))
    k = np.clip((pad + 0.15 - star) / 0.3, 0, 1)[..., None]
    rgb[y0:y1, x0:x1] = box * (1 - k) + smooth * k


def thakur_dalan():
    """The lamp-lit courtyard behind the hero: a wide one for desktop (the
    plain-doorway variant, so nothing busy sits behind the couple) and a tall
    one for phones. Night grading and the scrims behind the text are CSS."""
    rgb = load("background-optional.png")
    # Over the right pillar's floor light: no other pixels share that light.
    unsparkle(rgb, 1157.5, 695.5, 23, 25)
    im = Image.fromarray(rgb.clip(0, 255).astype(np.uint8))
    im.save(OUT / "thakur-dalan-wide.webp", "WEBP", quality=76, method=6)
    rgb = load("background-mobile.png")
    # On the rug's border: the same stripes run on to the left.
    patch(rgb, (612, 1222, 684, 1290), 530)
    im = Image.fromarray(rgb.clip(0, 255).astype(np.uint8))
    im.save(OUT / "thakur-dalan-tall.webp", "WEBP", quality=76, method=6)
    for name in ("thakur-dalan-wide.webp", "thakur-dalan-tall.webp"):
        dest = OUT / name
        print(f"{dest.relative_to(ROOT)}  {Image.open(dest).size}  {dest.stat().st_size // 1024} KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    chandmala()
    marigold_thread()
    marigold_swag()
    alpana()
    paper_tile()
    paper_sheet()
    temple_arch()
    gathbandhan()
    tassel()
    paan()
    velvet()
    thakur_dalan()


if __name__ == "__main__":
    main()
