"""Cut the couple out of the family's themed renders, one look per ceremony.

The renders (848x1258, illustrated) sit on near-black backgrounds; Sangeet
adds curtains, fairy lights and a stage mat, and three of them stand on an
alpana floor mat. An ML matting model (rembg, BiRefNet) finds the couple,
then we keep the largest blob, add back the Haldi stool the model drops,
soften the edges where a hem runs off the render, and re-estimate edge
colours so hair and veils carry no black fringe. Gemini's sparkle watermark
is un-blended first, so the zari underneath shows again.

Each look gets a soft gold rim glow baked in, so the navy suit and emerald
lehenga stay readable on the navy hero and the emerald events band. Its
alpha stays below the 140 that js/transitions.js samples, so the pixel swirl
only ever carries the couple.

Output is a transparent WebP per look, all the same size and on the same
floor line, each centred on its own couple, so every look sits in the middle
of the page's arch at the same scale.

Setup (dev only, not used by the site):  pip install "rembg[cpu]"
The first run downloads the BiRefNet model (~1 GB) to ~/.rembg; masks are
cached in tools/.cache/ so re-tuning is quick.

Usage:  python tools/cutout_avatars.py
Reads:  references/{sangeet,haldi,wedding,Reception}.png
Writes: assets/avatars/<look>.webp, js/avatar-frame.js, assets/og-image.jpg
"""
import os
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# rembg and pymatting JIT-compile with numba, whose cache must live on a short,
# writable path (the default one in site-packages fails on Windows Store Python).
os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(tempfile.gettempdir()) / "nbc"))

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "references"
OUT = ROOT / "assets" / "avatars"
CACHE = Path(__file__).resolve().parent / ".cache"

MODEL = "birefnet-general"

# One look per ceremony. `scale` evens out how large each render draws the
# couple (by head size and shoulder-to-feet height, against Biye), so they
# don't grow or shrink as the outfit changes. `sparkle` is the centre of
# Gemini's watermark when it sits on the couple (on the floor it goes with the
# background anyway). `stool` is the box where Haldi's wooden stool stands;
# the model treats it as background, so it is keyed back in from the black.
LOOKS = {
    "sangeet": {"src": "sangeet.png", "scale": 1.22},
    "haldi": {"src": "haldi.png", "scale": 0.88, "stool": (60, 840, 790, 1110)},
    "biye": {"src": "wedding.png", "scale": 1.0, "sparkle": (722, 1140)},
    "reception": {"src": "Reception.png", "scale": 1.0, "sparkle": (726, 1142)},
}

# The page sizes the frame by the hero look's "core": its widest row in the
# top CORE_FRAC of its height (heads, shoulders, arms). Other poses, Sangeet's
# raised arms and every hem, may overflow it, so all looks share one scale.
CORE_LOOK = "biye"
CORE_FRAC = 0.55
# Output scale: the core comes out this many px wide (the page shows the
# couple at most ~300 CSS px wide, so this covers a 1.5x screen).
CORE_PX = 440
# Transparent margin added around every render, so the edge fade and the glow
# never run into the render's edge.
MARGIN = 48
# Where a hem runs off the render (Haldi's saree, the Biye veil), fade it out
# over this many px instead of ending on a hard straight cut.
EDGE_FADE = 28
# Black-key ramp for the stool: max channel at/below LO is background, at/above HI solid.
STOOL_LO, STOOL_HI = 14, 42
# The rim glow: width (Gaussian sigma, output px) and peak opacity.
GLOW_SIGMA = 4
GLOW_ALPHA = 0.38
GOLD = np.array([212, 175, 55], dtype=np.float64)  # --gold
NAVY = (27, 59, 95)  # --navy
NAVY_DEEP = (15, 36, 64)  # --navy-deep


def _smooth_fill(v: np.ndarray, known: np.ndarray, sigma=6) -> np.ndarray:
    """Normalised convolution: estimate unknown pixels from known neighbours."""
    num = ndimage.gaussian_filter(v * known, sigma)
    den = ndimage.gaussian_filter(known.astype(np.float64), sigma)
    return num / np.maximum(den, 1e-6)


def unsparkle(rgb: np.ndarray, cx: int, cy: int, r=40) -> None:
    """Un-blend the semi-transparent white sparkle watermark in place.

    The star is found by its low saturation, the fabric under it estimated from
    the ring around it, and each pixel's overlay strength from how far its
    darkest channel rises above that estimate; reversing the blend brings the
    woven pattern back, clamped near the estimate so no speck pops out.
    """
    y0, x0 = cy - r, cx - r
    p = rgb[y0:cy + r, x0:cx + r]
    mx, mn = p.max(-1), p.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    yy, xx = np.mgrid[-r:r, -r:r]
    star = (np.hypot(yy, xx) < 30) & (sat < 0.42) & (mn > 95)
    labels, n = ndimage.label(star)
    if not n:
        return
    sizes = ndimage.sum(star, labels, range(1, n + 1))
    star = labels == 1 + int(np.argmax(sizes))
    star = ndimage.binary_fill_holes(ndimage.binary_closing(star, iterations=3))
    soft = ndimage.binary_dilation(star, iterations=3)
    est = np.stack([_smooth_fill(p[..., c], ~soft) for c in range(3)], -1)
    base_mn = est.min(-1)
    a = np.clip((mn - base_mn) / np.maximum(255 - base_mn, 1), 0, 0.8)
    a = ndimage.gaussian_filter(a * soft, 0.7)[..., None]
    rec = np.clip((p - a * 255) / (1 - a), est - 55, est + 55)
    rgb[y0:cy + r, x0:cx + r] = np.where(soft[..., None], rec, p)


def model_mask(name: str, im: Image.Image) -> np.ndarray:
    """The matting model's alpha (0-1), cached per source file and model."""
    CACHE.mkdir(exist_ok=True)
    src = SRC / name
    cached = CACHE / f"{src.stem}.{MODEL}.png"
    if not cached.exists() or cached.stat().st_mtime < src.stat().st_mtime:
        from rembg import new_session, remove

        remove(im, session=new_session(MODEL), only_mask=True).save(cached)
    return np.asarray(Image.open(cached).convert("L"), dtype=np.float64) / 255


def cutout(look: str, spec: dict) -> Image.Image:
    im = Image.open(SRC / spec["src"]).convert("RGB")
    alpha = model_mask(spec["src"], im)
    rgb = np.asarray(im, dtype=np.float64).copy()
    if "sparkle" in spec:
        unsparkle(rgb, *spec["sparkle"])
    h, w = alpha.shape

    if "stool" in spec:
        x0, y0, x1, y1 = spec["stool"]
        key = np.clip((rgb.max(-1) - STOOL_LO) / (STOOL_HI - STOOL_LO), 0, 1)
        box = np.zeros_like(alpha, dtype=bool)
        box[y0:y1, x0:x1] = True
        alpha = np.where(box, np.maximum(alpha, key), alpha)

    # Keep only the couple: the largest solid blob, plus the soft edge around it.
    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, labels, range(1, n + 1))
        solid = labels == 1 + int(np.argmax(sizes))
    near = ndimage.binary_dilation(solid, iterations=4)
    alpha = np.where(near, alpha, 0.0)
    alpha[alpha < 0.03] = 0

    # Hems that run off the render fade out rather than ending on a straight cut.
    ramp = lambda d: np.clip(d / EDGE_FADE, 0, 1)  # noqa: E731
    xs, ys = np.arange(w)[None, :], np.arange(h)[:, None]
    alpha = alpha * ramp(xs) * ramp(w - 1 - xs) * ramp(h - 1 - ys)

    # Edge colours: re-estimate the foreground where alpha is partial, so hair
    # and veil edges don't carry the black backdrop.
    from pymatting import estimate_foreground_ml

    fg = estimate_foreground_ml(rgb / 255, alpha) * 255
    rgb = np.where(((alpha > 0) & (alpha < 0.98))[..., None], fg, rgb)

    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    canvas = Image.new("RGBA", (w + 2 * MARGIN, h + 2 * MARGIN))
    canvas.paste(Image.fromarray(rgba, "RGBA"), (MARGIN, MARGIN))
    return canvas


def with_glow(im: Image.Image) -> Image.Image:
    """Composite a soft gold glow under the couple (outside the silhouette)."""
    px = np.asarray(im, dtype=np.float64)
    a = px[..., 3] / 255
    body = ndimage.binary_dilation(a > 0.5, iterations=2).astype(np.float64)
    g = np.clip(ndimage.gaussian_filter(body, GLOW_SIGMA) * 1.6, 0, 1) * GLOW_ALPHA
    out_a = a + g * (1 - a)
    rgb = (px[..., :3] * a[..., None] + GOLD * (g * (1 - a))[..., None]) / np.maximum(out_a, 1e-6)[..., None]
    return Image.fromarray(np.dstack([rgb, out_a * 255]).clip(0, 255).astype(np.uint8), "RGBA")


def og_image(biye: Image.Image) -> None:
    """1200x628 link-preview card: the Biye couple on navy, a gold glow at their feet."""
    w, h = 1200, 628
    yy, xx = np.mgrid[0:h, 0:w]
    t = (yy / h)[..., None]
    bg = np.array(NAVY_DEEP) * (1 - t) + np.array(NAVY) * t
    # Mixing gold into navy turns olive; adding a warm amber light stays warm.
    glow = np.exp(-(((xx - w / 2) / 300) ** 2 + ((yy - h * 0.97) / 70) ** 2))
    bg = bg + np.array([150, 95, 20]) * glow[..., None]
    card = Image.fromarray(bg.clip(0, 255).astype(np.uint8)).convert("RGBA")
    fig = biye.crop(biye.getbbox())
    scale = (h - 40) / fig.height
    fig = fig.resize((round(fig.width * scale), round(fig.height * scale)), Image.LANCZOS)
    card.alpha_composite(fig, ((w - fig.width) // 2, h - fig.height - 8))
    card.convert("RGB").save(ROOT / "assets" / "og-image.jpg", quality=86, optimize=True)


def core_width(im: Image.Image) -> int:
    """Widest extent of the couple in the top CORE_FRAC of its own height."""
    x0, y0, x1, y1 = im.getbbox()
    cx0, _, cx1, _ = im.crop((0, y0, im.width, y0 + round((y1 - y0) * CORE_FRAC))).getbbox()
    return cx1 - cx0


def layout(images: dict, pad=6):
    """Put every look on one canvas size: each centred horizontally on its own
    couple (pallu and hems included) and standing on the same floor line, so
    the outfit changes in place."""
    figs = {k: im.crop(im.getbbox()) for k, im in images.items()}
    w = max(f.width for f in figs.values()) + 2 * pad
    h = max(f.height for f in figs.values()) + 2 * pad
    out = {}
    for k, f in figs.items():
        canvas = Image.new("RGBA", (w, h))
        canvas.paste(f, ((w - f.width) // 2, h - pad - f.height))
        out[k] = canvas
    return out


def write_frame_js(w, h, core_w) -> None:
    """Frame sizes for js/wardrobe.js: the page lays the frame out by the core
    width and lets wide hems overflow, so every look renders at the same scale."""
    (ROOT / "js" / "avatar-frame.js").write_text(
        "// Generated by tools/cutout_avatars.py. Do not edit by hand.\n"
        f"window.INVITE_AVATAR_FRAME = {{ width: {w}, height: {h}, coreWidth: {core_w} }};\n",
        encoding="utf-8",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cut = {look: cutout(look, spec) for look, spec in LOOKS.items()}
    # One factor brings the hero look's core to CORE_PX; each look's own
    # `scale` then evens out how large its render draws the couple.
    k = CORE_PX / core_width(cut[CORE_LOOK])
    sized = {}
    for look, im in cut.items():
        f = k * LOOKS[look]["scale"]
        sized[look] = with_glow(im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS))
    framed = layout(sized)
    any_im = next(iter(framed.values()))
    core_w = core_width(framed[CORE_LOOK]) + 12
    print(f"frame {any_im.width}x{any_im.height}, core width {core_w}")
    write_frame_js(any_im.width, any_im.height, core_w)
    for look, im in framed.items():
        dest = OUT / f"{look}.webp"
        im.save(dest, "WEBP", quality=86, method=6)
        print(f"{dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB")
    og_image(with_glow(cut["biye"]))  # full resolution for the card
    print("assets/og-image.jpg")


if __name__ == "__main__":
    main()
