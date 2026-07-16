#!/bin/bash
# Rasterize every plate SVG at its exact declared size (QA only; atlas embeds SVGs).
cd "$(dirname "$0")/.."
CHROME=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)
mkdir -p plates_png
for f in plates/*.svg; do
  n=$(basename "$f" .svg)
  read W H < <(python3 -c "import re,sys;s=open('$f').read();m=re.search(r'width=\"(\d+)\" height=\"(\d+)\"',s);print(m.group(1),m.group(2))")
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --screenshot="plates_png/$n.png" --window-size=$W,$H \
    --default-background-color=00000000 "file://$PWD/$f" 2>/dev/null
done
ls plates_png/ | wc -l
