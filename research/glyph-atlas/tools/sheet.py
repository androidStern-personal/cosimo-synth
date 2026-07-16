#!/usr/bin/env python3
"""Build a labeled contact sheet. Usage: sheet.py OUT.png GLOB [--cols 4 --cell 320]"""
import argparse, glob
from pathlib import Path
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("pattern")
ap.add_argument("--cols", type=int, default=4)
ap.add_argument("--cell", type=int, default=320)
a = ap.parse_args()

files = sorted(glob.glob(str(BASE / a.pattern)))
if not files:
    raise SystemExit("no files match " + a.pattern)
cell, cols = a.cell, a.cols
label_h = 22
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + label_h)), (24, 24, 28))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    try:
        im = Image.open(f).convert("RGB")
    except Exception:
        continue
    im.thumbnail((cell - 8, cell - 8))
    x = (i % cols) * cell; y = (i // cols) * (cell + label_h)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
    d.text((x + 6, y + cell + 3), f"[{i}] {Path(f).name[:40]}", fill=(220, 220, 100))
out = BASE / a.out
sheet.save(out)
print(out, sheet.size, f"{out.stat().st_size//1024}KB", len(files), "images")
for i, f in enumerate(files):
    print(f"[{i}] {Path(f).name}")
