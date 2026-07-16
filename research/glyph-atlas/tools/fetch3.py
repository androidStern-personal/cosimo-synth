#!/usr/bin/env python3
"""Pass 2: headless-Chromium DOM dumps for JS-rendered product pages."""
import json, re, subprocess, html, glob, os
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / "raw2"
CHROME = glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome")[0]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

TARGETS = [
 ("pigments", ["https://www.arturia.com/products/software-instruments/pigments/overview"]),
 ("jup8v", ["https://www.arturia.com/products/software-instruments/jup-8-v/overview"]),
 ("massive-x", ["https://www.native-instruments.com/en/products/komplete/synths/massive-x/"]),
 ("kontakt8", ["https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/"]),
 ("current", ["https://www.minimal.audio/products/current"]),
 ("vision4x", ["https://exciteaudio.com/products/vision-4x", "https://www.exciteaudio.com/"]),
 ("shaperbox3", ["https://www.cableguys.com/shaperbox.html"]),
 ("humanoid", ["https://babyaud.io/humanoid"]),
 ("soothe2", ["https://oeksound.com/plugins/soothe2/", "https://oeksound.com/"]),
 ("smarteq4", ["https://www.sonible.com/smarteq4/"]),
 ("myth", ["https://www.tracktion.com/products/myth", "https://www.tracktion.com/products/dawesome-myth"]),
 ("novum", ["https://www.tracktion.com/products/novum"]),
 ("phaseplant", ["https://kilohearts.com/products/phase_plant"]),
 ("kelvin", ["https://www.toneprojects.com/kelvin.html", "https://www.toneprojects.com/"]),
 ("omnisphere", ["https://www.spectrasonics.net/products/omnisphere/", "https://www.spectrasonics.net/products/omnisphere/interface.php"]),
]

IMG_RE = re.compile(r'https?://[^\s"\'<>()\\]+?\.(?:png|jpe?g|webp)(?:\?[^\s"\'<>()\\]*)?', re.I)
REL_RE = re.compile(r'(?:src|data-src|data-lazy|content|href)="(/[^"]+?\.(?:png|jpe?g|webp)(?:\?[^"]*)?)"', re.I)
SRCSET_RE = re.compile(r'(?:srcset|data-srcset)="([^"]+)"', re.I)
BAD = re.compile(r"logo|icon|favicon|badge|avatar|thumb_|_thumb|sprite|footer|social|placeholder|\.svg|newsletter|award|artist|testimonial|team|cookie|flag", re.I)
GOOD = re.compile(r"screen|gui|interface|ui[_\-./]|shot|product|plugin|overview|gallery|full|hero|feature|main", re.I)

def dump_dom(url):
    r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                        f"--proxy-server={os.environ.get('HTTPS_PROXY','')}",
                        f"--user-agent={UA}", "--virtual-time-budget=12000",
                        "--dump-dom", url], capture_output=True, text=True, timeout=90)
    return r.stdout

def curl_img(u, dest):
    return subprocess.run(["curl", "-sL", "-m", "45", "-A", UA, u, "-o", str(dest), "-w", "%{http_code}"],
                          capture_output=True, text=True).stdout.strip()

def extract(dom, base_url):
    origin = re.match(r"(https?://[^/]+)", base_url).group(1)
    urls = set(IMG_RE.findall(dom))
    for m in REL_RE.finditer(dom):
        urls.add(origin + m.group(1))
    for m in SRCSET_RE.finditer(dom):
        cands = [c.strip().split(" ")[0] for c in m.group(1).split(",")]
        for c in cands:
            if c.startswith("/"): c = origin + c
            if re.search(r"\.(png|jpe?g|webp)", c, re.I): urls.add(c)
    ranked = []
    for u in urls:
        u = html.unescape(u)
        if BAD.search(u): continue
        score = (2 if GOOD.search(u) else 0) + (1 if re.search(r"@2x|1600|1920|2000|large|full|xl", u) else 0)
        ranked.append((score, u))
    ranked.sort(key=lambda t: -t[0])
    return ranked

def main():
    report = []
    for tid, pages in TARGETS:
        got = 0
        for page in pages:
            if got >= 4: break
            try:
                dom = dump_dom(page)
            except Exception:
                continue
            if not dom or len(dom) < 500: continue
            for score, u in extract(dom, page)[:20]:
                if got >= 4: break
                ext_m = re.search(r"\.(png|jpe?g|webp)", u, re.I)
                ext = ext_m.group(1).lower().replace("jpeg", "jpg")
                dest = OUT / f"{tid}__d{got}.{ext}"
                curl_img(u, dest)
                try:
                    with Image.open(dest) as im:
                        w, h = im.size
                    if w >= 700 and 0.8 < w / max(h, 1) < 4.5:
                        got += 1
                        report.append({"id": tid, "status": "ok", "file": dest.name, "size": [w, h], "page": page, "src": u})
                    else:
                        dest.unlink(missing_ok=True)
                except Exception:
                    dest.unlink(missing_ok=True)
        print(f"[{tid}] kept {got}", flush=True)
        if got == 0:
            report.append({"id": tid, "status": "no-image", "page": pages[0]})
    with open(BASE / "agent_meta" / "fetch3.jsonl", "w") as f:
        f.write("\n".join(json.dumps(r) for r in report) + "\n")

if __name__ == "__main__":
    main()
