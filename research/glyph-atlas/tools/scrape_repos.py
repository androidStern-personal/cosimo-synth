#!/usr/bin/env python3
"""Discover GUI images via raw README parsing (raw.githubusercontent.com is unscoped)."""
import json, re, subprocess, sys, html
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "raw"; RAW.mkdir(exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
SKIP = re.compile(r"badge|shields\.io|/actions|travis|appveyor|codecov|discord|opencollective|sponsor|paypal|donate|patreon|snapcraft|flathub|weblate|repology|star-history|contrib\.rocks|avatars\.|img\.shields|dev\.azure|ci\.|\.svg", re.I)
IMG = re.compile(r"\.(png|jpe?g|gif|webp)(\?[^\s)\"']*)?$", re.I)

def curl(url, out=None, timeout=40):
    cmd = ["curl", "-sL", "-m", str(timeout), "-A", UA, url]
    if out:
        cmd += ["-o", str(out), "-w", "%{http_code}"]
        return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

def find_readme(repo):
    for br in ("main", "master", "develop"):
        for name in ("README.md", "Readme.md", "readme.md", "README.MD"):
            t = curl(f"https://raw.githubusercontent.com/{repo}/{br}/{name}")
            if t and not t.startswith("404") and "GitHub access to this repository" not in t and len(t) > 80:
                return br, t
    return None, None

def image_refs(md, repo, branch):
    refs = []
    for m in re.finditer(r"!\[[^\]]*\]\(([^)\s]+)", md):
        refs.append(m.group(1))
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)', md):
        refs.append(html.unescape(m.group(1)))
    out = []
    for r in refs:
        r = r.strip().strip('"').strip("'")
        if SKIP.search(r):
            continue
        if r.startswith("http"):
            if "raw.githubusercontent.com" in r or "camo.githubusercontent.com" in r:
                out.append({"url": r, "kind": "hosted-github"})
            elif re.search(r"github\.com/.+/(raw|blob)/", r):
                rr = re.sub(r"github\.com/(.+?)/(raw|blob)/", r"raw.githubusercontent.com/\1/", r)
                out.append({"url": rr, "kind": "hosted-github"})
            else:
                out.append({"url": r, "kind": "external-blocked"})
        else:
            p = r.lstrip("./")
            out.append({"url": f"https://raw.githubusercontent.com/{repo}/{branch}/{p}", "kind": "relative"})
    seen, ded = set(), []
    for c in out:
        if c["url"] not in seen:
            seen.add(c["url"]); ded.append(c)
    return ded

def main():
    corpus = json.loads(Path(sys.argv[1]).read_text())
    results = {}
    for p in corpus["plugins"]:
        if p["tier"] != "A":
            continue
        pid, repo = p["id"], p["repo"]
        br, md = find_readme(repo)
        if md is None:
            results[pid] = {"repo": repo, "error": "no readme found", "candidates": []}
            print(f"[{pid}] NO README", flush=True)
            continue
        cands = image_refs(md, repo, br)
        n = 0
        for i, c in enumerate(cands[:12]):
            if c["kind"] == "external-blocked":
                continue
            if not IMG.search(c["url"].split("?")[0]) and "camo" not in c["url"]:
                continue
            ext = ".png"
            mm = IMG.search(c["url"].split("?")[0])
            if mm:
                ext = "." + mm.group(1).lower().replace("jpeg", "jpg")
            dest = RAW / f"{pid}__cand{i}{ext}"
            code = curl(c["url"], out=dest)
            c["local"], c["http"] = dest.name, code
            if code == "200" and dest.exists() and dest.stat().st_size > 500:
                try:
                    from PIL import Image
                    with Image.open(dest) as im:
                        c["size"] = list(im.size); n += 1
                except Exception as e:
                    c["size"] = None; c["err"] = str(e)[:50]
            else:
                c["size"] = None
                dest.unlink(missing_ok=True)
        results[pid] = {"repo": repo, "branch": br, "candidates": cands}
        ok = [c for c in cands if c.get("size")]
        ext_ct = sum(1 for c in cands if c["kind"] == "external-blocked")
        print(f"[{pid}] br={br} refs={len(cands)} ok={len(ok)} extBlocked={ext_ct} :: " + ", ".join(f"{c['local']}{tuple(c['size'])}" for c in ok), flush=True)
    (BASE / "candidates.json").write_text(json.dumps(results, indent=1))

if __name__ == "__main__":
    main()
