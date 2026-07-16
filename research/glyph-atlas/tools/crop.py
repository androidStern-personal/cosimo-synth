#!/usr/bin/env python3
"""Crop a glyph-bearing region from a raw screenshot using fractional coords.

Usage:
  crop.py RAW_FILE OUT_ID X0 Y0 X1 Y1 --desc "..." [--maxw 900]

Coordinates are fractions of width/height (0..1). Appends metadata to
crops/crops.jsonl. Overwrites existing crop with same OUT_ID (idempotent).
"""
import argparse, json, sys
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("raw"); ap.add_argument("out_id")
    ap.add_argument("x0", type=float); ap.add_argument("y0", type=float)
    ap.add_argument("x1", type=float); ap.add_argument("y1", type=float)
    ap.add_argument("--desc", required=True)
    ap.add_argument("--maxw", type=int, default=900)
    a = ap.parse_args()
    src = BASE / "raw" / a.raw if not a.raw.startswith("/") else Path(a.raw)
    im = Image.open(src)
    if im.mode in ("P", "CMYK"):
        im = im.convert("RGBA" if "A" in im.mode or im.mode == "P" else "RGB")
    W, H = im.size
    box = (round(a.x0 * W), round(a.y0 * H), round(a.x1 * W), round(a.y1 * H))
    box = (max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))
    if box[2] - box[0] < 8 or box[3] - box[1] < 8:
        sys.exit(f"crop too small: {box}")
    c = im.crop(box)
    if c.width > a.maxw:
        c = c.resize((a.maxw, round(c.height * a.maxw / c.width)), Image.LANCZOS)
    outdir = BASE / "crops"; outdir.mkdir(exist_ok=True)
    out = outdir / f"{a.out_id}.png"
    c.save(out, optimize=True)
    meta = {"crop_id": a.out_id, "raw": src.name, "frac_box": [a.x0, a.y0, a.x1, a.y1],
            "px_box": list(box), "out_size": list(c.size), "desc": a.desc}
    log = outdir / "crops.jsonl"
    lines = [l for l in (log.read_text().splitlines() if log.exists() else [])
             if json.loads(l)["crop_id"] != a.out_id]
    lines.append(json.dumps(meta))
    log.write_text("\n".join(lines) + "\n")
    print(f"{a.out_id}: {box} -> {c.size} ({out.stat().st_size//1024}KB)")

if __name__ == "__main__":
    main()
