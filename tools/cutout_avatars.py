"""Cut the couple's 3D avatars out of their blue studio backdrops.

The reference renders sit on a smooth blue gradient. We fit that gradient
with a quadratic surface per channel (sampled from the empty side margins),
mark everything that is close to the fit AND connected to the image border
as background, then feather the edge so hair and dupatta keep soft outlines.
Output is a transparent WebP per look, all the same size and on the same
floor line, each centred on its own couple (pallu included), so every look
sits in the middle of the page's arch at the same scale.

Usage:  python tools/cutout_avatars.py
Reads:  references/wedding-couple*.png
Writes: assets/avatars/<look>.webp, js/avatar-frame.js, assets/og-image.jpg
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "references"
OUT = ROOT / "assets" / "avatars"

# One look per ceremony. (The everyday renders, subh_sneha*.png, stay in
# references/ as source art but are no longer shown on the page.)
LOOKS = {
    "wedding-couple2.png": "sangeet",
    "wedding-couple1.png": "haldi",
    "wedding-couple.png": "biye",
    "wedding-couple3.png": "reception",
}

# The couple (hems and pallus included) always stands within this x-range of
# the 1376px-wide renders; the Haldi saree trails out to about x=980.
COUPLE_X = (455, 1000)
# Rows above this hold heads and torsos only, so their extent is the couple's
# "core" width: what the page sizes the frame by. Hems below may overflow it.
CORE_ROWS = 520
# The image generator's four-point sparkle mark, bottom right.
SPARKLE_BOX = lambda xs, ys: (xs > 1200) & (xs < 1310) & (ys > 590) & (ys < 710)  # noqa: E731
# Holes smaller than this (px) are specks inside a figure and get filled;
# larger ones, like the gap between the legs, are real background.
MAX_HOLE = 350
# Mean colour distance from the backdrop below which an enclosed hole is a
# pocket of backdrop (see between an arm and the body), not a speck in fabric.
POCKET_DIST = 55
# Below this row only feet, shoes and hems remain; the studio floor there is
# strongly cyan (green and blue far above red), which jeans and shoes are not.
FLOOR_Y = 600
# Pockets of backdrop (between legs, under an arm, between shoulders) are
# caught with a strict sky-cyan test. None of the ceremony outfits is that
# colour; raise this row (e.g. to 440, knee height) for a render with blue
# clothing, since a blue kurta sits close to the threshold (g-r ~56).
LEGS_Y = 0

# How far in from the backdrop a rim glow may reach, and how much lighter than
# the fitted backdrop a cyan pixel must be to count as glow.
GLOW_PX = 9
GLOW_LIFT = 8

# Width of the edge band whose colour is replaced to remove backdrop spill.
EDGE_PX = 5

# Colour distance (0-441) below which a border-connected pixel is background,
# and the band over which the edge fades from transparent to opaque.
BG_THRESHOLD = 30
FEATHER_LO, FEATHER_HI = 18, 46


def fit_background(rgb: np.ndarray) -> np.ndarray:
    """Least-squares quadratic surface per channel from the empty margins."""
    h, w, _ = rgb.shape
    ys, xs = np.mgrid[0:h, 0:w]
    # Everything outside the column the couple stands in, floor included.
    margin = (xs < COUPLE_X[0]) | (xs > COUPLE_X[1])
    margin &= ~SPARKLE_BOX(xs, ys)
    sample = margin & ((xs + ys) % 5 == 0)
    xn, yn = xs / w, ys / h
    basis = np.stack(
        [np.ones_like(xn), xn, yn, xn * yn, xn**2, yn**2, xn**2 * yn, xn * yn**2, xn**3, yn**3],
        axis=-1,
    )
    a = basis[sample]
    model = np.empty_like(rgb, dtype=np.float64)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(a, rgb[..., c][sample], rcond=None)
        model[..., c] = basis @ coef
    return model


def cutout(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    model = fit_background(rgb)
    dist = np.linalg.norm(rgb - model, axis=-1)

    near_bg = dist < BG_THRESHOLD
    labels, _ = ndimage.label(near_bg)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    h, w = dist.shape
    ys, xs = np.mgrid[0:h, 0:w]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    floor = (ys > FLOOR_Y) & (g - r > 60) & (b - r > 70)
    floor |= (ys > LEGS_Y) & (g - r > 75) & (b - r > 90)
    background |= floor
    # Rim glow: some renders outline the couple with a bright cyan halo. Near
    # the backdrop, a pixel that is cyan AND lighter than the fitted backdrop is
    # glow, not clothing (blue fabric, like the kurta, is darker than it).
    band = ndimage.binary_dilation(background, iterations=GLOW_PX) & ~background
    lighter = rgb.mean(axis=-1) > model.mean(axis=-1) + GLOW_LIFT
    background |= band & lighter & (b - r > 40) & (g - r > 25)
    # Nothing outside the couple's column is ever foreground.
    background |= (xs < COUPLE_X[0] - 20) | (xs > COUPLE_X[1] + 20)

    foreground = ~background
    holes, n = ndimage.label(~foreground & ndimage.binary_fill_holes(foreground))
    idx = range(1, n + 1)
    sizes = ndimage.sum(np.ones_like(dist), holes, idx)
    # A small hole is filled only if it doesn't look like backdrop: a pocket of
    # sky between an arm and the body keeps its transparency.
    hole_dist = ndimage.mean(dist, holes, idx)
    fill = np.flatnonzero((np.asarray(sizes) < MAX_HOLE) & (np.asarray(hole_dist) > POCKET_DIST))
    foreground |= np.isin(holes, 1 + fill)
    foreground = ndimage.binary_opening(foreground, iterations=1)
    # Keep only the largest blob: the couple.
    blobs, n = ndimage.label(foreground)
    if n > 1:
        sizes = ndimage.sum(foreground, blobs, range(1, n + 1))
        foreground = blobs == 1 + int(np.argmax(sizes))

    # Soft edge: inside a thin ring around the silhouette, alpha follows distance.
    ring = ndimage.binary_dilation(foreground, iterations=2) & ~ndimage.binary_erosion(foreground, iterations=2)
    soft = np.clip((dist - FEATHER_LO) / (FEATHER_HI - FEATHER_LO), 0, 1)
    alpha = np.where(foreground, 1.0, 0.0)
    alpha = np.where(ring, np.maximum(soft, alpha * soft), alpha)
    alpha = np.where(floor, 0.0, alpha)

    # Colour decontamination: the outermost few pixels carry blue backdrop spill
    # (a cyan halo on navy). Give them the colour of the nearest pixel safely
    # inside the silhouette; alpha stays soft.
    interior = ndimage.binary_erosion(foreground, iterations=EDGE_PX)
    _, (iy, ix) = ndimage.distance_transform_edt(~interior, return_indices=True)
    edge = ~interior & (alpha > 0)
    rgb = np.where(edge[..., None], rgb[iy, ix], rgb)

    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(a)
    return im  # full frame; main() crops every look with the same box


def og_image() -> None:
    """1200x630 link-preview card from the Biye look, sparkle mark painted out."""
    im = Image.open(SRC / "wedding-couple.png").convert("RGB")
    # Paint out the sparkle by blending each column from just above it to just
    # below it; the backdrop is a smooth gradient, so the fill is invisible.
    px = np.asarray(im, dtype=np.float64).copy()
    y0, y1 = 590, 715
    t = np.linspace(0, 1, y1 - y0)[:, None, None]
    px[y0:y1, 1195:1320] = (1 - t) * px[y0 - 1, 1195:1320][None] + t * px[y1, 1195:1320][None]
    im = Image.fromarray(px.clip(0, 255).astype(np.uint8))
    im = im.crop((0, 12, 1376, 732)).resize((1200, 628), Image.LANCZOS)
    im.save(ROOT / "assets" / "og-image.jpg", quality=86, optimize=True)


def frame_boxes(images, pad=6):
    """A crop box per look: same size and same top/bottom for all, each
    centred horizontally on that look's own couple, pallu and hems included.

    Returns (boxes, core_width). The page lays the frame out by the widest
    upper-body "core", so every look renders at one scale and wide hems may
    overflow the arch rather than shrinking the couple.
    """
    bbs = [im.getbbox() for im in images]
    cores = [im.crop((0, 0, im.width, CORE_ROWS)).getbbox() for im in images]
    w, h = images[0].size
    width = max(bb[2] - bb[0] for bb in bbs) + 2 * pad
    top = max(0, min(bb[1] for bb in bbs) - pad)
    bottom = min(h, max(bb[3] for bb in bbs) + pad)
    boxes = []
    for bb in bbs:
        left = round((bb[0] + bb[2]) / 2 - width / 2)
        left = max(0, min(w - width, left))
        boxes.append((left, top, left + width, bottom))
    core_w = max(c[2] - c[0] for c in cores) + 2 * pad
    return boxes, core_w


def write_frame_js(box, core_w) -> None:  # box: any one of the (equal-sized) boxes
    """Frame sizes for js/wardrobe.js: the page lays the frame out by the core
    width and lets wide hems overflow, so every look renders at the same scale."""
    w, h = box[2] - box[0], box[3] - box[1]
    (ROOT / "js" / "avatar-frame.js").write_text(
        "// Generated by tools/cutout_avatars.py. Do not edit by hand.\n"
        f"window.INVITE_AVATAR_FRAME = {{ width: {w}, height: {h}, coreWidth: {core_w} }};\n",
        encoding="utf-8",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cut = {look: cutout(SRC / name) for name, look in LOOKS.items()}
    boxes, core_w = frame_boxes(list(cut.values()))
    print(f"frame {boxes[0][2] - boxes[0][0]}x{boxes[0][3] - boxes[0][1]}, core width {core_w}")
    write_frame_js(boxes[0], core_w)
    for (look, im), box in zip(cut.items(), boxes):
        im = im.crop(box)
        dest = OUT / f"{look}.webp"
        im.save(dest, "WEBP", quality=86, method=6)
        print(f"{dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB")
    og_image()
    print("assets/og-image.jpg")


if __name__ == "__main__":
    main()
