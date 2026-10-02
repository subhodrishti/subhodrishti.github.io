"""Cut the couple out of the family's looping clips, one clip per ceremony look.

The clips (references/motion/<look>.mp4, 6 s at 24 fps, made in Grok from the
stills) sit on black. Every frame goes through the same matting model as the
stills (rembg, BiRefNet) and keeps the couple. The matte is then smoothed over
time wherever the picture isn't moving, so hair and hems don't shimmer, edge
colours are re-estimated, and the same gold rim glow is baked in.

The clip is placed once, not per frame: frame 0's matte is registered to the
look's still (assets/avatars/<look>.webp), so the clip starts where the still
stands and the couple never jitters. Every frame lands in the stills' frame
(js/avatar-frame.js), so the page lays clip and still out the same way.

A clip loops natively (it ends where it began: the end is cut at the frame
closest to frame 0) or as a ping-pong (forward, then back).

Output is one H.264 MP4 per look with colour and alpha side by side: the left
half is the couple premultiplied onto black, the right half the alpha as grey,
each half HALF_W wide. js/alpha-video.js puts them back together on a canvas.
No single transparent video format plays on both iPhones and Android, and
H.264 plays everywhere.

Setup (dev only, not used by the site):  pip install "rembg[cpu]"
BiRefNet needs ~8 GB of RAM and ~25 s a frame on a 4-core CPU. Masks are cached
in tools/.cache/video/<look>/, so re-tuning after the first run is quick.

Usage:  python tools/cutout_videos.py [look ...]      (all clips by default)
        python tools/cutout_videos.py --masks [look ...]  (only fill the mask cache)
        python tools/cutout_videos.py --start-frames  (stills padded to 9:16 on black, for Grok)
Reads:  references/motion/<look>.mp4, assets/avatars/<look>.webp
Writes: assets/avatars/<look>.mp4, previews in tools/.cache/video/preview/
"""
import json
import re
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

from cutout_avatars import CACHE, EDGE_FADE, MODEL, NAVY, OUT, ROOT, with_glow

SRC = ROOT / "references" / "motion"
VCACHE = CACHE / "video"
PREVIEW = VCACHE / "preview"

# One entry per look with a clip. `watermark` is the box (x0, y0, x1, y1, in
# source px) around Grok's mark, which never belongs to the couple. Haldi and
# Reception wait for clips re-made on plain black (tools/avatar-prompts.md):
# the first ones cut to a petal storm and a banquet hall.
CLIPS = {
    "sangeet": {"loop": "native", "watermark": (636, 1232, 720, 1280)},
    "biye": {"loop": "pingpong", "watermark": (700, 1118, 784, 1160)},
}

FPS = 24
# Each half of the side-by-side frame is padded to this width (a multiple of
# 16, so the alpha half starts on a macroblock boundary and nothing bleeds
# across the seam). The frame's transparent margin keeps the seam black.
HALF_W = 640
# Partners standing apart are separate blobs: keep every blob at least this
# fraction of the largest, drop the specks.
KEEP_FRAC = 0.2
# Temporal smoothing: where a pixel's brightness changes less than this (0-255)
# from the frames either side, the matte takes the 3-frame median.
STILL_DIFF = 14
# A native loop ends on one of its last few frames, whichever is closest to frame 0.
SEAM_SEARCH = 6
# Size budget: ~250 KB a second of clip, at most 2 MB. CRF rises from the first
# value until the clip fits; above MAX_BYTES at the last one the tool stops.
KB_PER_S = 250
CAP_BYTES = 2_000_000
MAX_BYTES = 2_500_000
CRFS = (24, 26, 28, 30, 32)
EMERALD = (15, 82, 87)  # --emerald


def frame_size() -> tuple:
    """The stills' frame, from the file cutout_avatars.py generates."""
    text = (ROOT / "js" / "avatar-frame.js").read_text(encoding="utf-8")
    m = re.search(r"\bwidth:\s*(\d+),\s*height:\s*(\d+)", text)
    return int(m[1]), int(m[2])


def read_frames(src) -> np.ndarray:
    """Every frame as RGB uint8, (n, h, w, 3), decoded as the BT.709 the clips are tagged with."""
    info = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "json", str(src)], capture_output=True, check=True, text=True)
    s = json.loads(info.stdout)["streams"][0]
    w, h = s["width"], s["height"]
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-vf", "scale=in_color_matrix=bt709:in_range=tv",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def masks(look: str, frames: np.ndarray, src) -> np.ndarray:
    """The matting model's alpha (0-1) for every frame, cached per frame."""
    d = VCACHE / look
    d.mkdir(parents=True, exist_ok=True)
    session = None
    out = []
    for i, f in enumerate(frames):
        p = d / f"{i:04d}.png"
        if not p.exists() or p.stat().st_mtime < src.stat().st_mtime:
            if session is None:
                import onnxruntime as ort
                from rembg import new_session

                # Without these the CPU arena grows on every frame until the process is killed.
                opts = ort.SessionOptions()
                opts.enable_cpu_mem_arena = False
                opts.enable_mem_pattern = False
                session = new_session(MODEL, sess_opts=opts)
            from rembg import remove

            remove(Image.fromarray(f), session=session, only_mask=True).save(p)
            print(f"  {look} mask {i + 1}/{len(frames)}", flush=True)
        out.append(np.asarray(Image.open(p).convert("L"), dtype=np.float32) / 255)
    return np.stack(out)


def keep_couple(alpha: np.ndarray, watermark) -> np.ndarray:
    """Drop the watermark and specks, soften hems that run off the frame."""
    alpha = alpha.copy()
    x0, y0, x1, y1 = watermark
    alpha[y0:y1, x0:x1] = 0
    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, labels, range(1, n + 1))
        solid = np.isin(labels, np.flatnonzero(sizes >= KEEP_FRAC * sizes.max()) + 1)
    near = ndimage.binary_dilation(solid, iterations=4)
    alpha = np.where(near, alpha, 0)
    alpha[alpha < 0.03] = 0
    h, w = alpha.shape
    ramp = lambda d: np.clip(d / EDGE_FADE, 0, 1)  # noqa: E731
    xs, ys = np.arange(w)[None, :], np.arange(h)[:, None]
    return (alpha * ramp(xs) * ramp(w - 1 - xs) * ramp(h - 1 - ys)).astype(np.float32)


def seam(alphas: np.ndarray) -> int:
    """For a native loop: the frame to stop before, the one most like frame 0."""
    n = len(alphas)
    cands = range(n - SEAM_SEARCH, n)
    scores = {k: float(np.abs(alphas[k] - alphas[0]).mean()) for k in cands}
    end = min(scores, key=scores.get)
    print(f"  seam: loop frames 0..{end - 1} (frame {end} differs from frame 0 by {scores[end]:.4f})")
    return end


def steady(alphas: np.ndarray, frames: np.ndarray, loop: str) -> np.ndarray:
    """Median the matte over three frames where the picture is still, so the
    model's frame-to-frame noise on hair and edges doesn't shimmer. Where the
    picture moves (a turning hand) the frame keeps its own matte."""
    n = len(alphas)
    if loop == "native":
        nb = lambda i: ((i - 1) % n, (i + 1) % n)  # noqa: E731
    else:
        nb = lambda i: (abs(i - 1), n - 1 - abs(n - 2 - i))  # noqa: E731  (reflect at both ends)
    lum = [f.astype(np.float32).mean(-1) for f in frames]
    out = np.empty_like(alphas)
    for i in range(n):
        a, b = nb(i)
        x, y, z = alphas[a], alphas[i], alphas[b]
        med = x + y + z - np.maximum(np.maximum(x, y), z) - np.minimum(np.minimum(x, y), z)
        diff = np.maximum(np.abs(lum[i] - lum[a]), np.abs(lum[i] - lum[b]))
        w = np.clip(1 - ndimage.gaussian_filter(diff, 2) / STILL_DIFF, 0, 1)
        out[i] = w * med + (1 - w) * y
    return out


def cut(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """RGBA at source size, with edge colours re-estimated so hair and veils
    carry no black fringe (as cutout_avatars.cutout does)."""
    from pymatting import estimate_foreground_ml

    rgb = rgb.astype(np.float64)
    ys, xs = np.nonzero(alpha > 0)
    if len(ys):
        y0, y1 = max(ys.min() - 8, 0), ys.max() + 9
        x0, x1 = max(xs.min() - 8, 0), xs.max() + 9
        a = alpha[y0:y1, x0:x1].astype(np.float64)
        c = rgb[y0:y1, x0:x1]
        fg = estimate_foreground_ml(c / 255, a) * 255
        rgb[y0:y1, x0:x1] = np.where(((a > 0) & (a < 0.98))[..., None], fg, c)
    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def body(a: np.ndarray) -> np.ndarray:
    return a > 0.5


def bbox(m: np.ndarray):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def place(alpha0: np.ndarray, still: np.ndarray):
    """Scale and offset that land frame 0 on the still: start from matching
    heights, floor line and centre, then search nearby for the best overlap."""
    target = body(still)
    tx0, ty0, tx1, ty1 = bbox(target)
    src = body(alpha0)
    sx0, sy0, sx1, sy1 = bbox(src)
    s0 = (ty1 - ty0) / (sy1 - sy0)
    H, W = target.shape
    best = (-1.0, s0, 0, 0)
    for s in s0 * np.linspace(0.96, 1.04, 17):
        m = np.asarray(Image.fromarray(src).resize(
            (round(src.shape[1] * s), round(src.shape[0] * s)), Image.NEAREST))
        # Offset that matches floor line and centre at this scale.
        bx0, by0, bx1, by1 = bbox(m)
        ox = round((tx0 + tx1) / 2 - (bx0 + bx1) / 2)
        oy = ty1 - by1
        for dy in range(-10, 11, 2):
            for dx in range(-10, 11, 2):
                placed = paste_mask(m, ox + dx, oy + dy, W, H)
                inter = np.count_nonzero(placed & target)
                iou = inter / max(np.count_nonzero(placed | target), 1)
                if iou > best[0]:
                    best = (iou, s, ox + dx, oy + dy)
    iou, s, ox, oy = best
    print(f"  placement: scale {s:.4f}, offset ({ox}, {oy}), overlap with the still {iou:.3f}")
    return s, ox, oy


def paste_mask(m: np.ndarray, ox: int, oy: int, W: int, H: int) -> np.ndarray:
    out = np.zeros((H, W), bool)
    h, w = m.shape
    x0, y0 = max(ox, 0), max(oy, 0)
    x1, y1 = min(ox + w, W), min(oy + h, H)
    if x1 > x0 and y1 > y0:
        out[y0:y1, x0:x1] = m[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return out


def framed(im: Image.Image, s: float, ox: int, oy: int, W: int, H: int) -> Image.Image:
    """Scale a frame, put it in the stills' frame, and add the rim glow."""
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H))
    canvas.paste(im, (ox, oy))
    return with_glow(canvas)


def encode(look: str, frames: list, W: int, H: int) -> int:
    """Side-by-side H.264: premultiplied colour | alpha. Returns bytes written."""
    sbs = []
    for im in frames:
        px = np.asarray(im, dtype=np.float32)
        a = px[..., 3:4] / 255
        buf = np.zeros((H, 2 * HALF_W, 3), np.uint8)
        buf[:, :W] = np.round(px[..., :3] * a).astype(np.uint8)
        buf[:, HALF_W:HALF_W + W] = np.round(np.repeat(a, 3, -1) * 255).astype(np.uint8)
        sbs.append(buf.tobytes())
    raw = b"".join(sbs)
    dest = OUT / f"{look}.mp4"
    budget = min(KB_PER_S * 1000 * len(frames) / FPS, CAP_BYTES)
    for crf in CRFS:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{2 * HALF_W}x{H}", "-r", str(FPS), "-i", "-",
             "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
             # Level 4.0 (x264 caps its reference frames to fit), which every phone decodes in hardware.
             "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "veryslow", "-tune", "animation",
             "-crf", str(crf), "-g", str(2 * FPS),
             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
             "-movflags", "+faststart", "-an", str(dest)],
            input=raw, check=True)
        size = dest.stat().st_size
        print(f"  crf {crf}: {size // 1024} KB (budget {int(budget) // 1024} KB)")
        if size <= budget:
            break
    if size > MAX_BYTES:
        sys.exit(f"{dest.relative_to(ROOT)} is {size // 1024} KB, over {MAX_BYTES // 1024} KB at CRF {crf}")
    return size


def preview(look: str, W: int, H: int) -> None:
    """Decode the written MP4 and composite it on navy and emerald, as guests
    will see it (compression included): a clip and a contact sheet."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sbs = read_frames(OUT / f"{look}.mp4").astype(np.float32)
    c, a = sbs[:, :, :W], sbs[:, :, HALF_W:HALF_W + W, 1:2] / 255
    shots = []
    for bg in (NAVY, EMERALD):
        shots.append(np.clip(c + np.array(bg, np.float32) * (1 - a), 0, 255).astype(np.uint8))
    both = np.concatenate(shots, axis=2)  # navy | emerald
    n = len(both)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{2 * W}x{H}",
         "-r", str(FPS), "-i", "-", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p",
         "-c:v", "libx264", "-crf", "20", str(PREVIEW / f"{look}-preview.mp4")],
        input=both.tobytes(), check=True)
    picks = [round(i * (n - 1) / 5) for i in range(6)]
    sheet = np.concatenate([shots[0][i] for i in picks], axis=1)
    Image.fromarray(sheet).resize((sheet.shape[1] // 2, sheet.shape[0] // 2), Image.LANCZOS).save(
        PREVIEW / f"{look}-sheet.png")
    # The loop seam: last frame, first frame, and their difference.
    seam_img = np.concatenate([shots[0][-1], shots[0][0]], axis=1)
    Image.fromarray(seam_img).save(PREVIEW / f"{look}-seam.png")
    print(f"  previews: {PREVIEW.relative_to(ROOT)}/{look}-{{preview.mp4,sheet.png,seam.png}}")


def start_frames() -> None:
    """Each still on black in a 9:16 frame with room around the couple, to
    give Grok as the clip's first (and, if it allows, last) frame. Grok fits
    its input to 9:16 by cropping the sides, which clipped Sangeet's raised
    hand and lehenga; with this padding nothing is cropped."""
    out = VCACHE / "start"
    out.mkdir(parents=True, exist_ok=True)
    w, h = 720, 1280
    for still in sorted(OUT.glob("*.webp")):
        im = Image.open(still).convert("RGBA")
        f = 0.8 * w / im.width
        im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
        canvas.alpha_composite(im, ((w - im.width) // 2, round(h * 0.86) - im.height))
        canvas.convert("RGB").save(out / f"{still.stem}.png")
        print(f"{(out / f'{still.stem}.png').relative_to(ROOT)}")


def run(look: str, spec: dict, masks_only: bool) -> None:
    src = SRC / f"{look}.mp4"
    print(f"{look}: {src.relative_to(ROOT)}")
    frames = read_frames(src)
    raw = masks(look, frames, src)
    if masks_only:
        return
    alphas = np.stack([keep_couple(m, spec["watermark"]) for m in raw])
    if spec["loop"] == "native":
        end = seam(alphas)
        frames, alphas = frames[:end], alphas[:end]
    alphas = steady(alphas, frames, spec["loop"])

    W, H = frame_size()
    still = np.asarray(Image.open(OUT / f"{look}.webp").convert("RGBA"), dtype=np.float32)[..., 3] / 255
    s, ox, oy = place(alphas[0], still)
    out = []
    for i, (f, a) in enumerate(zip(frames, alphas)):
        out.append(framed(cut(f, a), s, ox, oy, W, H))
        if (i + 1) % 24 == 0:
            print(f"  cut {i + 1}/{len(frames)}", flush=True)
    edge = max(np.count_nonzero(np.asarray(im)[:, [0, -1], 3] > 128) for im in out)
    if edge > 40:
        print(f"  note: up to {edge} px of the couple touch the frame's side edges")
    if spec["loop"] == "pingpong":
        out = out + out[-2:0:-1]
    size = encode(look, out, W, H)
    print(f"{(OUT / f'{look}.mp4').relative_to(ROOT)}  {len(out)} frames, {len(out) / FPS:.1f} s, {size // 1024} KB")
    preview(look, W, H)


def main() -> None:
    args = sys.argv[1:]
    if "--start-frames" in args:
        start_frames()
        return
    masks_only = "--masks" in args
    looks = [a for a in args if not a.startswith("--")] or list(CLIPS)
    for look in looks:
        if look not in CLIPS:
            sys.exit(f"unknown clip {look!r}; known: {', '.join(CLIPS)}")
        run(look, CLIPS[look], masks_only)


if __name__ == "__main__":
    main()
