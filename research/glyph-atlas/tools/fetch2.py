#!/usr/bin/env python3
"""Inline fetcher: pull candidate GUI images for the quality-first corpus."""
import json, re, subprocess, html
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / "raw2"; OUT.mkdir(exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

TARGETS = [
 ("pigments", "https://www.arturia.com/products/software-instruments/pigments/media"),
 ("pigments2", "https://www.arturia.com/products/software-instruments/pigments/overview"),
 ("jup8v", "https://www.arturia.com/products/software-instruments/jup-8-v/media"),
 ("massive-x", "https://www.native-instruments.com/en/products/komplete/synths/massive-x/"),
 ("kontakt8", "https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/"),
 ("pro-q4", "https://www.fabfilter.com/products/pro-q-4-equalizer-plug-in"),
 ("saturn2", "https://www.fabfilter.com/products/saturn-2-multiband-distortion-saturation-plug-in"),
 ("drumcomputer", "https://sugar-bytes.de/drumcomputer"),
 ("effectrix2", "https://sugar-bytes.de/effectrix"),
 ("serum2", "https://xferrecords.com/products/serum-2"),
 ("current", "https://www.minimal.audio/products/current"),
 ("vision4x", "https://www.exciteaudio.com/products/vision-4x"),
 ("shaperbox3", "https://www.cableguys.com/shaperbox.html"),
 ("transit", "https://babyaud.io/transit"),
 ("humanoid", "https://babyaud.io/humanoid"),
 ("soothe2", "https://oeksound.com/plugins/soothe2/"),
 ("arcade", "https://output.com/products/arcade"),
 ("portal", "https://output.com/products/portal"),
 ("ozone11", "https://www.izotope.com/en/products/ozone.html"),
 ("smarteq4", "https://www.sonible.com/smarteq4/"),
 ("myth", "https://dawesome.instruments/myth/"),
 ("novum", "https://dawesome.instruments/novum/"),
 ("phaseplant", "https://kilohearts.com/products/phase_plant"),
 ("hive2", "https://u-he.com/products/hive/"),
 ("zebralette3", "https://u-he.com/products/zebralette3/"),
 ("klevgrand-reamp", "https://klevgrand.com/products/reamp2"),
 ("kelvin", "https://www.toneprojects.com/kelvin.html"),
 ("omnisphere", "https://www.spectrasonics.net/products/omnisphere/gallery.php"),
]

IMG_RE = re.compile(r'https?://[^\s"\'<>()]+?\.(?:png|jpe?g|webp)(?:\?[^\s"\'<>()]*)?', re.I)
BAD = re.compile(r"logo|icon|favicon|badge|avatar|thumb_|_thumb|sprite|footer|header_bg|banner_|social|og-default|placeholder|video|youtube|\.svg", re.I)
GOOD_HINT = re.compile(r"screen|gui|interface|ui[_\-./]|shot|product|plugin|synth|overview|media|gallery|full", re.I)

def curl(url, out=None, timeout=45):
    cmd = ["curl", "-sL", "-m", str(timeout), "-A", UA, "-H", "Accept: text/html,image/*,*/*", url]
    if out:
        cmd += ["-o", str(out), "-w", "%{http_code}"]
        return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

def main():
    report = []
    for tid, page in TARGETS:
        page_html = curl(page)
        if not page_html or len(page_html) < 400:
            report.append({"id": tid, "status": "page-failed", "page": page})
            print(f"[{tid}] PAGE FAILED", flush=True)
            continue
        page_html = html.unescape(page_html)
        urls = IMG_RE.findall(page_html)
        # resolve protocol-relative & rank
        seen, ranked = set(), []
        for u in urls:
            if u in seen or BAD.search(u): continue
            seen.add(u)
            score = 0
            if GOOD_HINT.search(u): score += 2
            if re.search(r"\d{3,4}x\d{3,4}|@2x|2000|1920|1600|large|full", u): score += 1
            ranked.append((score, u))
        ranked.sort(key=lambda t: -t[0])
        got = 0
        for score, u in ranked[:14]:
            if got >= 4: break
            ext = re.search(r"\.(png|jpe?g|webp)", u, re.I).group(1).lower().replace("jpeg", "jpg")
            dest = OUT / f"{tid}__c{got}.{ext}"
            code = curl(u, out=dest)
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
        print(f"[{tid}] kept {got} candidates", flush=True)
        if got == 0:
            report.append({"id": tid, "status": "no-image", "page": page})
    (BASE / "agent_meta" / "fetch2.jsonl").write_text("\n".join(json.dumps(r) for r in report) + "\n")

if __name__ == "__main__":
    main()
