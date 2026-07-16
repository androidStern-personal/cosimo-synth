#!/usr/bin/env python3
"""Assemble Plugin Glyph Atlas v2 — quality-first corpus, mark-level specimens."""
import base64, io, json, html as H
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
CROPS = BASE / "crops2"
OUT_HTML = Path("/home/user/cosimo-synth/research/glyph-atlas/plugin-glyph-atlas.html")
OUT_PROV = Path("/home/user/cosimo-synth/research/glyph-atlas/provenance.json")

meta = [json.loads(l) for l in (CROPS / "crops.jsonl").read_text().splitlines() if l.strip()]

PLUG = {
 "s2": ("Serum 2", "Xfer Records", "https://xferrecords.com/products/serum-2"),
 "dc": ("DrumComputer", "Sugar Bytes", "https://sugar-bytes.de/drumcomputer"),
 "fx": ("Effectrix", "Sugar Bytes", "https://sugar-bytes.de/effectrix"),
 "pq4": ("Pro-Q 4", "FabFilter", "https://www.fabfilter.com/products/pro-q-4-equalizer-plug-in"),
 "sat2": ("Saturn 2", "FabFilter", "https://www.fabfilter.com/products/saturn-2-multiband-distortion-saturation-plug-in"),
 "pig": ("Pigments", "Arturia", "https://www.arturia.com/products/software-instruments/pigments/overview"),
 "oz11": ("Ozone 11", "iZotope", "https://www.izotope.com/en/products/ozone.html"),
 "mx": ("Massive X", "Native Instruments", "https://www.native-instruments.com/en/products/komplete/synths/massive-x/"),
 "myth": ("Myth", "Dawesome / Tracktion", "https://dawesome.instruments/myth/"),
 "hum": ("Humanoid", "Baby Audio", "https://babyaud.io/humanoid"),
 "pp": ("Phase Plant", "Kilohearts", "https://kilohearts.com/products/phase_plant"),
 "hive": ("Hive 2", "u-he", "https://u-he.com/products/hive/"),
 "sb3": ("ShaperBox 3", "Cableguys", "https://www.cableguys.com/shaperbox.html"),
 "seq4": ("smart:EQ 4", "Sonible", "https://www.sonible.com/smarteq4/"),
 "v4x": ("Vision 4X", "Excite Audio", "https://www.pluginboutique.com/products/9301-VISION-4X"),
 "por": ("Portal", "Output", "https://output.com/products/portal"),
}

SECTIONS = [
 ("logos", "Logotypes & Lockups", ["logo-lockup", "type-specimen"],
  "How the current masters sign their work: two-weight camelcase (shaperBox, phaseplant), stencil-slab engineering caps (SERUM 2, MASSIVE X), glitch-cut display (ΞMYTH, PORTAL), chromatic extrusion (EFFECTRIX), and the interpunct-superscript house style of FabFilter. Nearly every mark is built to survive one-color reproduction — silhouettes first, effects second.",
  "Note the recurring companions: a version numeral worn openly, a vendor micro-signature in the opposite corner, and letterspacing doing the luxury work."),
 ("wave-icons", "Waveform & Curve Iconography", ["waveform-icon", "filter-curve"],
  "The genre's native pictography: oscillator shapes as paired mini-cells (Serum 2), effects as thick-stroke wave portraits in signature colors (ShaperBox's Time/Pitch/Drive/Noise set — the strongest single icon system surveyed), filter responses as dropdown chips (Pro-Q 4's bell), and named-curve thumbnail cards (Hive 2).",
  "Stroke weight is the register: hairline = data, mid = control, thick + color = invitation."),
 ("ui-icons", "Pictograms & Utility Icons", ["ui-icon"],
  "Where each house voice shows most: iZotope's metaphor set (sprout for Stem EQ, eye for Clarity), Baby Audio's icons-inside-knobs (de-ess scissors, freeze snowflake, android face), Myth's circular alchemy chips, Massive X's hand-drawn squiggle arc, FabFilter's scissors and stereo-rings, Serum 2's anchor and note-value glyphs.",
  "The current grammar is mono-line, rounded caps, optically corrected — Material-era discipline applied to studio hardware memory."),
 ("nav-badges", "Navigation, Badges & Chips", ["nav-glyph", "badge"],
  "State-carrying marks: radio-dot page tabs (Serum 2), power-glyph section pills (Pigments), dot-lamp rail tabs (Myth), color-coded channel chips (DrumComputer's 1–8, Effectrix's rainbow lane plates), pennant flags (DrumComputer's Filter), key-signature fraction badges (Humanoid).",
  "Color is doing taxonomy work everywhere — hue = lane identity, saturation = active state."),
 ("legends", "Legends, Value Plates & Indicators", ["legend", "indicator"],
  "The typographic substrate: boxed mono value plates (Effectrix, Phase Plant, Kotelnikov-descended), circled-S solo tags and dB numeral rails, soundstage spine labels (smart:EQ 4's rotated Front/Middle/Back), mod-count ring badges (Serum 2), colored routing pins (Massive X), node jewelry (Pro-Q 4).",
  "Values read as UI chrome now: label small-caps gray above, numeral white below — an emerging cross-vendor standard."),
 ("displays", "Display Glyphs & Identity Graphics", ["display-glyph", "ornament"],
  "Displays engineered as brand: Myth's IRIS particle bloom, Hive 2's hexagon pane, Serum 2's path-editor orbit with node jewelry, Vision 4X's phosphor-teal spectrogram and diamond vectorscope, Humanoid's outline-keyboard, Phase Plant's ghost-type wayfinding, DrumComputer's chevron progress ornament.",
  "The lesson for a new synth: pick one display geometry and own it — hexagon, iris, orbit, diamond."),
]

# surveyed but not cropped (gaps recorded, not hidden)
EXTRA = [
 ("Jup-8 V", "Arturia", "acquired (full GUI on file), not cropped this pass", "https://www.pluginboutique.com/products/7147-Jup-8-V"),
 ("Transit 2", "Baby Audio", "acquired, not cropped this pass", "https://www.pluginboutique.com/products/13431-Transit-2"),
 ("Arcade", "Output", "acquired (small marketing frame only)", "https://output.com/products/arcade"),
 ("Kontakt 8", "Native Instruments", "gap — PB gallery held only a 3D logo card", "https://www.pluginboutique.com/products/13195-Kontakt-8"),
 ("Novum", "Dawesome / Tracktion", "gap — PB gallery held installer dialogs only", "https://www.pluginboutique.com/products/9238-Dawesome-Novum"),
 ("soothe2", "Oeksound", "gap — site serves a JS shell to non-browser fetchers", "https://oeksound.com/plugins/soothe2/"),
 ("Current", "Minimal Audio", "gap — site is a client-side app; no static imagery", "https://www.minimal.audio/products/current"),
 ("Kelvin", "Tone Projects", "gap — product page 404 (site restructured)", "https://www.toneprojects.com/"),
]

def b64(path, max_w=880):
    im = Image.open(path)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    png = buf.getvalue()
    if len(png) > 90_000:
        jb = io.BytesIO(); im.convert("RGB").save(jb, "JPEG", quality=84)
        if len(jb.getvalue()) < len(png) * 0.75:
            return "data:image/jpeg;base64," + base64.b64encode(jb.getvalue()).decode()
    return "data:image/png;base64," + base64.b64encode(png).decode()

CSS = """
:root{--bg:#0b0b0e;--panel:#131318;--ink:#e8e6e0;--sub:#9a97a0;--line:#26262e;--acc:#c8a24a}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.6 Georgia,'Times New Roman',serif}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px 120px}
header.cover{padding:100px 0 60px;border-bottom:1px solid var(--line);margin-bottom:50px}
.kicker{font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;color:var(--acc);text-transform:uppercase;margin-bottom:16px}
h1{font-size:50px;line-height:1.08;font-weight:normal;margin-bottom:20px}
.lede{font-size:18px;color:var(--sub);max-width:820px}
.meta-row{display:flex;gap:28px;flex-wrap:wrap;margin-top:30px;font-family:Arial,sans-serif;font-size:12px;color:var(--sub)}
.meta-row b{color:var(--ink);font-size:20px;display:block;font-weight:normal}
.note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);padding:16px 20px;margin:36px 0;font-size:13.5px;color:var(--sub);line-height:1.7}
h2{font-size:28px;font-weight:normal;margin:80px 0 6px}
h2 .idx{color:var(--acc);font-size:15px;vertical-align:16px;letter-spacing:2px;font-family:Arial,sans-serif;margin-right:10px}
.ann{max-width:860px;font-size:15.5px;margin:12px 0 4px}
.lineage{max-width:860px;color:var(--sub);font-size:13px;font-style:italic;margin-bottom:8px}
.vendors{font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:var(--sub);text-transform:uppercase;margin-bottom:22px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:13px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.card.wide{grid-column:span 2}
@media(max-width:640px){.card.wide{grid-column:span 1}}
.imgbox{background:#0e0e12;display:flex;align-items:center;justify-content:center;padding:12px;min-height:96px}
.imgbox img{max-width:100%;height:auto;display:block}
.cap{padding:9px 12px;border-top:1px solid var(--line)}
.cap .pl{font-family:Arial,sans-serif;font-size:12.5px}
.cap .vd{font-family:Arial,sans-serif;font-size:11px;color:var(--sub)}
.cap .ds{font-size:12px;color:var(--sub);margin-top:4px;line-height:1.5}
.tag{display:inline-block;font-family:Arial,sans-serif;font-size:9px;letter-spacing:1.2px;padding:1.5px 6px;border:1px solid #4a9e6f;color:#4a9e6f;border-radius:3px;margin-left:7px;vertical-align:1px}
table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12.5px;margin-top:24px}
th{text-align:left;color:var(--sub);font-weight:normal;letter-spacing:1.5px;text-transform:uppercase;font-size:10.5px;padding:9px 12px;border-bottom:1px solid var(--acc)}
td{padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
td a{color:#8fb4d8;text-decoration:none;word-break:break-all}
.fieldnotes p{max-width:860px;margin:15px 0}
.fieldnotes h3{font-size:18px;font-weight:normal;color:var(--acc);margin-top:38px}
footer{margin-top:100px;border-top:1px solid var(--line);padding-top:26px;color:var(--sub);font-size:12.5px;font-family:Arial,sans-serif}
.small{font-size:11.5px;color:var(--sub)}
"""

def build():
    sec_cards = {s[0]: [] for s in SECTIONS}
    sec_vend = {s[0]: set() for s in SECTIONS}
    tag2sec = {}
    for sid, _, tags, _, _ in SECTIONS:
        for t in tags:
            tag2sec[t] = sid
    n = 0
    for m in sorted(meta, key=lambda r: r["crop_id"]):
        sid = tag2sec.get(m.get("mark", ""))
        if not sid: continue
        pref = m["crop_id"].split("__")[0]
        plug, vend, url = PLUG.get(pref, (pref, "?", "#"))
        f = CROPS / (m["crop_id"] + ".png")
        if not f.exists(): continue
        with Image.open(f) as im:
            w, h = im.size
        wide = " wide" if w / max(h, 1) > 3.0 else ""
        sec_cards[sid].append(
            f'<div class="card{wide}"><div class="imgbox"><img loading="lazy" src="{b64(f)}" alt=""></div>'
            f'<div class="cap"><span class="pl">{H.escape(plug)}<span class="tag">AUTHENTIC</span></span>'
            f'<div class="vd">{H.escape(vend)}</div><div class="ds">{H.escape(m["desc"])}</div></div></div>')
        sec_vend[sid].add(vend); n += 1
    secs = ""
    for i, (sid, title, tags, ann, lin) in enumerate(SECTIONS):
        vend = sorted(sec_vend[sid])
        secs += (f'<section id="{sid}"><h2><span class="idx">{i+1:02d}</span>{H.escape(title)}</h2>'
                 f'<p class="ann">{H.escape(ann)}</p><p class="lineage">{H.escape(lin)}</p>'
                 f'<p class="vendors">{len(sec_cards[sid])} specimens · {len(vend)} vendors — {H.escape(", ".join(vend))}</p>'
                 f'<div class="grid">{"".join(sec_cards[sid])}</div></section>')
    rows = ""
    for pref, (plug, vend, url) in PLUG.items():
        cnt = sum(1 for m in meta if m["crop_id"].startswith(pref + "__"))
        rows += (f'<tr><td>{H.escape(plug)}</td><td>{H.escape(vend)}</td><td>{cnt} specimens</td>'
                 f'<td><a href="{url}">{H.escape(url)}</a></td></tr>')
    for plug, vend, note, url in EXTRA:
        rows += (f'<tr><td>{H.escape(plug)}</td><td>{H.escape(vend)}</td><td class="small">{H.escape(note)}</td>'
                 f'<td><a href="{url}">{H.escape(url)}</a></td></tr>')
    vendors = {v for _, (p, v, u) in PLUG.items()}
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Plugin Glyph Atlas — v2</title><style>{CSS}</style></head><body><div class="wrap">
<header class="cover">
<div class="kicker">Cosimo Synth · Design Research · v2 · 2026-07-16</div>
<h1>The Plugin Glyph Atlas</h1>
<p class="lede">Mark-level iconography from the plugins the industry currently holds up as its best-designed — logotypes, waveform pictography, utility icons, badges, legends and identity displays. Every specimen is an authentic crop from current-generation vendor imagery. No freeware filler, no redrawn facsimiles.</p>
<div class="meta-row"><div><b>{n}</b>specimens</div><div><b>{len(PLUG)}</b>plugins cropped</div><div><b>{len(vendors)}</b>vendors</div><div><b>6</b>mark families</div><div><b>100%</b>authentic imagery</div></div>
<div class="note"><b style="color:var(--ink)">v2 method.</b> Corpus chosen strictly by design merit and currency (vendor list approved before rebuild); imagery pulled from vendor sites and standardized PluginBoutique product galleries over open network; every crop passed a mark-level gate — icons, glyphs, logotypes, legends, ornaments only, no knobs, sliders or panel furniture. Acquisition gaps are listed in the provenance index rather than backfilled. v1 of this document (open-source-skewed, since retracted) is preserved in git history.</div>
</header>
{secs}
<section id="prov"><h2><span class="idx">07</span>Provenance Index</h2>
<table><thead><tr><th>Plugin</th><th>Vendor</th><th>Coverage</th><th>Source</th></tr></thead><tbody>{rows}</tbody></table></section>
<section class="fieldnotes"><h2><span class="idx">08</span>Designer's Field Notes</h2>
<h3>What the current masters agree on</h3>
<p>Across sixteen flagship interfaces the consensus grammar is: mono-line pictograms at uniform stroke weight; one signature accent hue per product (Serum's cyan, ShaperBox's per-effect rainbow, Pigments' gradient trio); values set as white numerals over gray small-caps labels; state carried by dots and rings rather than lit bevels; and a wordmark engineered to survive one-color reproduction. Type is the chrome — panels are nearly empty of decoration so the marks can do the talking.</p>
<h3>Where identities diverge</h3>
<p>The differentiators are almost always a single owned geometry: Hive's hexagon, Myth's particle iris, Serum 2's orbital path editor, Vision 4X's diamond vectorscope, Humanoid's android medallion, Massive X's hand-sketched squiggle arc. Sugar Bytes and Cableguys own <i>pictographic exuberance</i> — every function gets a bespoke colored glyph — while FabFilter and Sonible own <i>restraint</i>, spending their entire identity budget on one curve display and a lockup.</p>
<h3>Open territory for Cosimo</h3>
<p>(1) Nobody in this cohort owns an <b>engraved/print-heritage mark language</b> executed at modern fidelity — the field is uniformly screen-native. (2) <b>Icon-in-knob</b> is only Baby Audio's; a full system of parameter pictograms embedded in controls is unclaimed at synth scale. (3) A <b>display geometry not yet taken</b>: triangle, superellipse, or waveform-woven monogram. (4) Every surveyed nav system is dots-and-pills; a genuinely typographic navigation (in the Goodhertz spirit) remains open in the synth category.</p>
</section>
<footer>Private research mood board for the Cosimo Synth project. All imagery © its respective vendors; crops are citation-grade reference specimens with sources in the Provenance Index. Built 2026-07-16.</footer>
</div></body></html>"""
    OUT_HTML.write_text(doc)
    OUT_PROV.write_text(json.dumps({
        "version": 2, "generated": "2026-07-16", "specimens": n,
        "plugins": [{"name": p, "vendor": v, "source": u,
                     "specimens": sum(1 for m in meta if m["crop_id"].startswith(k + "__"))}
                    for k, (p, v, u) in PLUG.items()] +
                   [{"name": p, "vendor": v, "status": s, "source": u} for p, v, s, u in EXTRA]}, indent=1))
    print(f"HTML {OUT_HTML.stat().st_size/1e6:.1f} MB, specimens={n}")

if __name__ == "__main__":
    build()
