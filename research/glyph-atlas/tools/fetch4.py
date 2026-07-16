#!/usr/bin/env python3
"""Pass 3: PluginBoutique product pages (SSR) + relative-path retry on static vendor sites."""
import json, re, subprocess, html
from pathlib import Path
from urllib.parse import urljoin
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / "raw2"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

def curl(url, out=None, timeout=45):
    cmd = ["curl", "-sL", "-m", str(timeout), "-A", UA, url]
    if out:
        cmd += ["-o", str(out), "-w", "%{http_code}"]
        return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    return subprocess.run(cmd, capture_output=True, text=True).stdout

PB_WANT = {
 "massive-x": r"massive-x", "kontakt8": r"kontakt-8", "pigments": r"pigments",
 "jup8v": r"jup-8-v", "serum2": r"serum-2", "current": r"current",
 "vision4x": r"vision-4x", "shaperbox3": r"shaperbox", "transit": r"transit",
 "humanoid": r"humanoid", "ozone11": r"ozone-11", "smarteq4": r"smart-eq-4",
 "myth": r"(dawesome-)?myth", "novum": r"(dawesome-)?novum", "phaseplant": r"phase-plant",
 "soothe2": r"soothe-?2", "portal": r"portal", "kelvin": r"kelvin",
 "effectrix2": r"effectrix-2", "drumcomputer": r"drumcomputer",
}

STATIC_RETRY = [
 ("kelvin", "https://www.toneprojects.com/kelvin.html"),
 ("soothe2", "https://oeksound.com/plugins/soothe2/"),
 ("omnisphere", "https://www.spectrasonics.net/products/omnisphere/index.php"),
 ("humanoid", "https://babyaud.io/humanoid"),
 ("shaperbox3", "https://www.cableguys.com/shaperbox.html"),
 ("smarteq4", "https://www.sonible.com/smarteq4/"),
]

ANY_IMG = re.compile(r'(?:src|data-src|href|content|data-image|data-large_image)="([^"]+?\.(?:png|jpe?g|webp)(?:\?[^"]*)?)"', re.I)
ABS_IMG = re.compile(r'https?://[^\s"\'<>()\\]+?\.(?:png|jpe?g|webp)(?:\?[^\s"\'<>()\\]*)?', re.I)
BAD = re.compile(r"logo|icon|favicon|badge|avatar|sprite|footer|social|placeholder|\.svg|newsletter|award|testimonial|team|cookie|flag|banner-|cart|star|arrow|play-", re.I)

def harvest(tid, page_url, page_html, tag, cap=4, existing=0):
    urls, got = [], existing
    for m in ANY_IMG.finditer(page_html):
        urls.append(urljoin(page_url, html.unescape(m.group(1))))
    urls += ABS_IMG.findall(page_html)
    seen, kept = set(), []
    for u in urls:
        if u in seen or BAD.search(u): continue
        seen.add(u)
        score = 2 if re.search(r"screen|gui|interface|shot|gallery|product|large|full|2x|1600|1920", u, re.I) else 0
        kept.append((score, u))
    kept.sort(key=lambda t: -t[0])
    out = []
    for score, u in kept[:18]:
        if got >= cap: break
        ext = re.search(r"\.(png|jpe?g|webp)", u, re.I).group(1).lower().replace("jpeg", "jpg")
        dest = OUT / f"{tid}__{tag}{got}.{ext}"
        curl(u, out=dest)
        try:
            with Image.open(dest) as im:
                w, h = im.size
            if w >= 640 and 0.7 < w / max(h, 1) < 5.0:
                got += 1
                out.append({"id": tid, "status": "ok", "file": dest.name, "size": [w, h], "page": page_url, "src": u})
            else:
                dest.unlink(missing_ok=True)
        except Exception:
            dest.unlink(missing_ok=True)
    return out

def main():
    report = []
    # --- PluginBoutique sitemap walk
    idx = curl("https://www.pluginboutique.com/sitemap.xml")
    subs = re.findall(r"<loc>([^<]+)</loc>", idx)
    prod_urls = []
    for s in subs:
        if "product" in s or len(subs) <= 3:
            prod_urls += re.findall(r"<loc>(https://www\.pluginboutique\.com/products/[^<]+)</loc>", curl(s))
    print(f"PB sitemap products: {len(prod_urls)}", flush=True)
    pb_map = {}
    for tid, pat in PB_WANT.items():
        rx = re.compile(r"/products/\d+-" + pat + r"$", re.I)
        rx2 = re.compile(pat, re.I)
        exact = [u for u in prod_urls if rx.search(u)]
        loose = [u for u in prod_urls if rx2.search(u.rsplit("/", 1)[-1])]
        pick = (exact or sorted(loose, key=len))[:1]
        if pick:
            pb_map[tid] = pick[0]
    print("PB matches:", json.dumps(pb_map, indent=0), flush=True)
    for tid, purl in pb_map.items():
        page = curl(purl)
        if len(page) < 1000: continue
        res = harvest(tid, purl, page, "pb")
        report += res
        print(f"[{tid}] PB kept {len(res)}", flush=True)
    # --- static vendor retries with relative resolution
    for tid, page_url in STATIC_RETRY:
        page = curl(page_url)
        if len(page) < 500:
            print(f"[{tid}] static page failed", flush=True); continue
        res = harvest(tid, page_url, page, "s")
        report += res
        print(f"[{tid}] static kept {len(res)}", flush=True)
    with open(BASE / "agent_meta" / "fetch4.jsonl", "w") as f:
        f.write("\n".join(json.dumps(r) for r in report) + "\n")

if __name__ == "__main__":
    main()
