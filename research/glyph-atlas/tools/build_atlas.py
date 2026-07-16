#!/usr/bin/env python3
"""Assemble the Plugin Glyph Atlas: single self-contained HTML + provenance.json."""
import base64, io, json, html as H
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
CROPS, PLATES, RAW = BASE / "crops", BASE / "plates", BASE / "raw"
OUT_HTML = Path("/home/user/cosimo-synth/research/glyph-atlas/plugin-glyph-atlas.html")
OUT_PROV = Path("/home/user/cosimo-synth/research/glyph-atlas/provenance.json")

crop_meta = {json.loads(l)["crop_id"]: json.loads(l) for l in (CROPS / "crops.jsonl").read_text().splitlines() if l.strip()}

# ------------------------------------------------------------------ groups
GROUPS = [
 ("skeuo", "Hardware Skeuomorph & Panel Silkscreen",
  "Legends silkscreened onto rendered hardware: letterspaced grotesque caps, waveform end-stop glyphs at knob extremes, double-rule section headers, LED-and-rocker iconography, red 14-segment readouts. Depth cues — brushed metal, screws, bevels — carry the semantics of permanence.",
  "Lineage: Minimoog and OB-X panel graphics, Roland color-coded section bands, SSL console legend, phototypesetting-era spec sheets."),
 ("eurorack", "Eurorack & Panel-Legend Modular",
  "Faceplate graphics as pure information design: mono-line jack legends, boxed I/O wells, schematic arrows and bus symbols, module nameplates set in engineering grotesques, text outlined to paths so the panel survives any renderer.",
  "Lineage: Doepfer→Befaco→Mutable Instruments faceplate silkscreen; ANSI/IEC schematic symbol vocabulary; 70s test-equipment front panels."),
 ("flat", "Flat Geometric Minimalism",
  "Bauhaus-grade reduction: uniform-stroke curve iconography (bell, shelf, notch, cut), interpunct-divided wordmarks, one or two accent hues on a disciplined field, and type doing the work of chrome. Controls are circles, rules and numerals — nothing pretends to be metal.",
  "Lineage: Braun/Rams product graphics, Swiss typographic grid, Scandinavian digital product design. FabFilter's band-shape icon strip is the genre's Rosetta stone; Valhalla's color-block cards are its poster."),
 ("hud", "Sci-Fi HUD & Vector Futurism",
  "Instrument-panel futurism: hairline ring gauges, orbital and particle motifs, glow as state, spline editors with node jewelry, letterspaced small-caps telemetry on near-black. Gradient light does the work bevels once did.",
  "Lineage: NASA graphics-standards optimism, avionics and game-HUD affordances, Syd Mead vehicle canopies; the 2010s Output/iZotope school."),
 ("util", "Brutalist & Utilitarian Precision",
  "Interface as engineering document: dense value plates, mono numerals, routing schematics, chips and ladders, color admitted only as signal. The aesthetic is the ostensible absence of one — which itself photographs as a style.",
  "Lineage: test-and-measurement software, mixing-console channel strips, IBM data-entry forms. Airwindows' prose-and-numbers window is the limit case; TDR's tooltip-grade precision the refined one."),
 ("vintage", "Vintage Instrument & Engraved Panel",
  "Cream VU faces, black arc scales with red overload wedges, serif and small-cap engraved legends, chicken-head pointers, variable-mu romance. Ornament earns its place by imitating instruments that were themselves beautiful.",
  "Lineage: Teletronix/Fairchild broadcast faceplates, letterpress spec plates, brass engraving, 1950s–70s studio hardware photography."),
 ("retro", "Retro-Digital: LCD, Pixel & Phosphor",
  "The display is the ornament: 5×7 dot-matrix type, segment numerals, teal/green backlit LCD panes with scanline texture, phosphor scopes with decay smear, membrane-button color keys.",
  "Lineage: DX7 membrane-and-LCD graphics, late-80s workstation screens (M1), CRT test instruments and vector monitors, chiptune hardware."),
 ("playful", "Playful, Toy-Like & Typographic Digital-Native",
  "Candy palettes, outline mascots, glassy toy buttons, hand-wobble lines, sticker-sheet iconography — and type-as-control, where the number is the knob. Deliberately rejects hardware cosplay to lower the intimidation floor.",
  "Lineage: Memphis Group color, Teenage Engineering product graphics, indie-game UI, the Goodhertz school of typographic instrument design."),
]

# --------------------------------------------------- crop → group assignment
PREFIX_GROUP = {
 "jc303": "skeuo", "obxd": "skeuo", "odin2": "skeuo", "calf": "skeuo",
 "cardinal": "eurorack",
 "proq3": "flat", "supermassive": "flat", "helm": "flat", "octasine": "flat",
 "ripplerx": "flat", "zleq": "flat",
 "serum": "hud", "vital": "hud", "lsp": "hud",
 "surge": "util", "geonkick": "util", "wolfshaper": "util", "paulx": "util",
 "grace": "util", "stochas": "util", "vaporizer2": "util", "airwin": "util",
 "monique": "util", "diva-redux": "util", "kontakt": "util",
 "dexed": "retro", "signalizer": "retro",
 "valentine": "playful", "bespoke": "playful", "chowtape": "playful",
 "dragonfly": "playful", "microtonic": "playful",
}
X42_VINTAGE = {"x42__vu-classic", "x42__db-black", "x42__din-arc", "x42__corr-meter", "x42__vu-pair"}
X42_RETRO = {"x42__phasewheel", "x42__goniometer", "x42__spectrum", "x42__ebur128", "x42__bitmeter"}

def crop_group(cid):
    if cid in X42_VINTAGE: return "vintage"
    if cid in X42_RETRO: return "retro"
    return PREFIX_GROUP.get(cid.split("__")[0])

# crop prefix → (plugin label, vendor)
CROP_PLUGIN = {
 "jc303": ("JC303", "midilab"), "obxd": ("OB-Xd", "discoDSP / reales"),
 "odin2": ("Odin 2", "TheWaveWarden"), "calf": ("Calf Studio Gear", "Calf"),
 "cardinal": ("Cardinal", "DISTRHO"),
 "proq3": ("Pro-Q 3", "FabFilter"), "supermassive": ("Supermassive", "Valhalla DSP"),
 "helm": ("Helm", "Matt Tytel"), "octasine": ("OctaSine", "Joakim Frostegård"),
 "ripplerx": ("RipplerX", "tiagolr"), "zleq": ("ZL Equalizer", "ZL Audio"),
 "serum": ("Serum", "Xfer Records"), "vital": ("Vital", "Vital Audio"),
 "lsp": ("MB Compressor", "Linux Studio Plugins"),
 "surge": ("Surge XT", "Surge Synth Team"), "geonkick": ("Geonkick", "Geonkick"),
 "wolfshaper": ("Wolf Shaper", "P. Desaulniers"), "paulx": ("PaulXStretch", "Sonosaurus"),
 "grace": ("Grace", "One Small Clue"), "stochas": ("Stochas", "Surge Synth Team"),
 "vaporizer2": ("Vaporizer2", "VAST Dynamics"), "airwin": ("Consolidated", "Airwindows"),
 "monique": ("Monique", "Surge Synth Team"), "diva-redux": ("Diva (Redux theme)", "u-he"),
 "kontakt": ("Kontakt", "Native Instruments"),
 "dexed": ("Dexed", "Digital Suburban"), "signalizer": ("Signalizer", "J. Thorborg"),
 "x42": ("meters.lv2", "Robin Gareus (x42)"),
 "valentine": ("Valentine", "Tote Bag Labs"), "bespoke": ("Bespoke Synth", "Ryan Challinor"),
 "chowtape": ("CHOW Tape Model", "Chowdhury DSP"), "dragonfly": ("Dragonfly Reverb", "M. Willis"),
 "microtonic": ("Microtonic", "Sonic Charge"),
}

# facsimile plates → group, label, vendor, reference URL
PLATE_INFO = {
 "diva": ("skeuo", "Diva (stock idiom)", "u-he", "https://u-he.com/products/diva/"),
 "tal-u-no-lx": ("skeuo", "TAL-U-NO-LX", "TAL Software", "https://tal-software.com/products/tal-u-no-lx"),
 "la2a": ("skeuo", "Teletronix LA-2A", "Universal Audio", "https://www.uaudio.com/uad-plugins/compressors-limiters/teletronix-la-2a-collection.html"),
 "ssl-e-channel": ("skeuo", "SSL E-Channel", "Waves", "https://www.waves.com/plugins/ssl-e-channel"),
 "nepheton": ("skeuo", "Nepheton 2 (808 idiom)", "D16 Group", "https://d16.pl/nepheton2"),
 "softube-tape": ("skeuo", "Tape", "Softube", "https://www.softube.com/tape"),
 "mini-v": ("skeuo", "Mini V", "Arturia", "https://www.arturia.com/products/software-instruments/v-collection/overview"),
 "pro-q4": ("flat", "Pro-Q 4", "FabFilter", "https://www.fabfilter.com/products/pro-q-4-equalizer-plug-in"),
 "vintageverb": ("flat", "VintageVerb", "Valhalla DSP", "https://valhalladsp.com/shop/reverb/valhalla-vintage-verb/"),
 "phase-plant": ("flat", "Phase Plant", "Kilohearts", "https://kilohearts.com/products/phase_plant"),
 "serum2": ("hud", "Serum 2", "Xfer Records", "https://xferrecords.com/products/serum-2"),
 "omnisphere": ("hud", "Omnisphere 2", "Spectrasonics", "https://www.spectrasonics.net/products/omnisphere/"),
 "portal": ("hud", "Portal", "Output", "https://output.com/products/portal"),
 "ozone11": ("hud", "Ozone 11", "iZotope", "https://www.izotope.com/en/products/ozone.html"),
 "pigments": ("hud", "Pigments", "Arturia", "https://www.arturia.com/products/software-instruments/pigments/overview"),
 "massive-x": ("hud", "Massive X", "Native Instruments", "https://www.native-instruments.com/en/products/komplete/synths/massive-x/"),
 "kotelnikov": ("util", "TDR Kotelnikov", "Tokyo Dawn Records", "https://www.tokyodawn.net/tdr-kotelnikov/"),
 "span": ("util", "SPAN", "Voxengo", "https://www.voxengo.com/product/span/"),
 "mjuc": ("vintage", "MJUC", "Klanghelm", "https://klanghelm.com/contents/products/MJUC"),
 "decapitator": ("vintage", "Decapitator", "Soundtoys", "https://www.soundtoys.com/product/decapitator/"),
 "pulsar-mu": ("vintage", "Mu", "Pulsar Audio", "https://pulsar.audio/mu/"),
 "chipsynth-md": ("retro", "chipsynth MD", "Plogue", "https://www.plogue.com/products/chipsynth-md.html"),
 "korg-m1": ("retro", "KORG Collection M1", "KORG", "https://www.korg.com/us/products/software/korg_collection/"),
 "spaced-out": ("playful", "Spaced Out", "Baby Audio", "https://babyaud.io/spaced-out"),
 "lossy": ("playful", "Lossy", "Goodhertz", "https://goodhertz.com/lossy/"),
 "xo": ("playful", "XO", "XLN Audio", "https://www.xlnaudio.com/products/xo"),
}

# Eurorack panel SVGs (authentic vector artwork from repos) → rendered PNGs
PANELS = [
 ("vcv-fundamental__VCO", "VCO", "VCV (Fundamental)"),
 ("vcv-fundamental__LFO", "LFO", "VCV (Fundamental)"),
 ("vcv-fundamental__ADSR", "ADSR", "VCV (Fundamental)"),
 ("vcv-fundamental__Scope", "Scope", "VCV (Fundamental)"),
 ("vcv-befaco__EvenVCO", "EvenVCO", "Befaco"),
 ("vcv-befaco__Rampage", "Rampage", "Befaco"),
 ("vcv-audible__Plaits", "Plaits", "Mutable Instruments (Audible)"),
 ("vcv-audible__Clouds", "Clouds", "Mutable Instruments (Audible)"),
 ("vcv-audible__Rings", "Rings", "Mutable Instruments (Audible)"),
 ("cardinal-own__HostAudio", "Host Audio", "DISTRHO Cardinal"),
]

def b64_img(path, max_w=860, jpeg_threshold=90_000):
    im = Image.open(path)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im2 = im.convert("RGB") if im.mode != "RGB" else im
    im.save(buf, "PNG", optimize=True)
    png = buf.getvalue()
    if len(png) > jpeg_threshold:
        jb = io.BytesIO(); im2.save(jb, "JPEG", quality=82)
        if len(jb.getvalue()) < len(png) * 0.75:
            return "data:image/jpeg;base64," + base64.b64encode(jb.getvalue()).decode(), im.size
    return "data:image/png;base64," + base64.b64encode(png).decode(), im.size

def svg_inline(path, height=340):
    s = Path(path).read_text()
    return s.replace("<svg ", f'<svg style="max-height:{height}px;width:auto;max-width:100%" ', 1)

# --------------------------------------------------------------- provenance
def load_jsonl(name):
    p = BASE / "agent_meta" / name
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []

srcs = {}
for rec in load_jsonl("siterepos.jsonl") + load_jsonl("commercial.jsonl"):
    if rec.get("status") == "ok":
        srcs[rec["id"]] = rec
panel_meta = load_jsonl("panels.jsonl")

PLUGINS = [
 # (name, vendor, category, groups, status, source_page, img_note)
 ("JC303", "midilab", "bass synth (303)", ["skeuo"], "authentic", "https://github.com/midilab/jc303", "repo README image"),
 ("OB-Xd", "discoDSP / reales", "synth (VA)", ["skeuo"], "authentic", "https://github.com/reales/OB-Xd", "README image via GitHub camo (canonical: discodsp.com)"),
 ("Odin 2", "TheWaveWarden", "synth", ["skeuo"], "authentic", "https://github.com/TheWaveWarden/odin2", "repo README image"),
 ("Calf Studio Gear", "Calf", "channel strip / fx suite", ["skeuo"], "authentic", "https://github.com/calf-studio-gear/calf", "official manual images in repo"),
 ("Diva", "u-he", "synth (VA)", ["skeuo", "util"], "facsimile + authentic (custom theme)", "https://u-he.com/products/diva/", "vendor site egress-blocked; stock idiom redrawn; genuine screenshot of community Redux theme from github.com/drzhnn/diva-redux"),
 ("TAL-U-NO-LX", "TAL Software", "synth (VA)", ["skeuo"], "facsimile", "https://tal-software.com/products/tal-u-no-lx", "vendor site egress-blocked; no legitimate GitHub-hosted capture found"),
 ("Teletronix LA-2A Collection", "Universal Audio", "fx (compressor)", ["skeuo"], "facsimile", "https://www.uaudio.com/uad-plugins/compressors-limiters/teletronix-la-2a-collection.html", "vendor site egress-blocked"),
 ("SSL E-Channel", "Waves", "channel strip", ["skeuo"], "facsimile", "https://www.waves.com/plugins/ssl-e-channel", "vendor site egress-blocked"),
 ("Nepheton 2", "D16 Group", "drum machine", ["skeuo"], "facsimile", "https://d16.pl/nepheton2", "vendor site egress-blocked"),
 ("Tape", "Softube", "fx (tape)", ["skeuo"], "facsimile", "https://www.softube.com/tape", "vendor site egress-blocked"),
 ("Mini V", "Arturia", "synth (VA)", ["skeuo"], "facsimile", "https://www.arturia.com/products/software-instruments/v-collection/overview", "vendor site egress-blocked"),
 ("Cardinal", "DISTRHO", "modular", ["eurorack"], "authentic", "https://github.com/DISTRHO/Cardinal", "repo doc screenshots + res/ panel SVGs"),
 ("VCV Rack Fundamental", "VCV", "modular", ["eurorack"], "authentic (panel SVGs)", "https://github.com/VCVRack/Fundamental", "res/*.svg faceplates, text outlined"),
 ("Befaco (VCV ports)", "Befaco", "modular", ["eurorack"], "authentic (panel SVGs)", "https://github.com/VCVRack/Befaco", "res/panels/*.svg faceplates"),
 ("Audible Instruments", "Mutable Instruments / VCV", "modular", ["eurorack"], "authentic (panel SVGs)", "https://github.com/VCVRack/AudibleInstruments", "res/*.svg faceplates"),
 ("Pro-Q 3", "FabFilter", "fx (EQ)", ["flat"], "authentic", "https://www.fabfilter.com/products/pro-q-3-equalizer-plug-in", "official fabfilter.com screenshot obtained via GitHub camo proxy (OpGuides page render)"),
 ("Pro-Q 4", "FabFilter", "fx (EQ)", ["flat"], "facsimile", "https://www.fabfilter.com/products/pro-q-4-equalizer-plug-in", "current version redrawn as study"),
 ("Supermassive", "Valhalla DSP", "fx (reverb)", ["flat"], "authentic", "https://valhalladsp.com/shop/reverb/valhalla-supermassive/", "official product image via GitHub camo proxy (canonical valhalladsp.com)"),
 ("VintageVerb", "Valhalla DSP", "fx (reverb)", ["flat"], "facsimile", "https://valhalladsp.com/shop/reverb/valhalla-vintage-verb/", "vendor site egress-blocked"),
 ("Helm", "Matt Tytel", "synth", ["flat"], "authentic", "https://github.com/mtytel/helm", "README image via camo (canonical tytel.org)"),
 ("OctaSine", "Joakim Frostegård", "synth (FM)", ["flat"], "authentic", "https://github.com/greatest-ape/OctaSine", "repo README images"),
 ("RipplerX", "tiagolr", "synth (physical modeling)", ["flat"], "authentic", "https://github.com/tiagolr/ripplerx", "repo README images"),
 ("ZL Equalizer", "ZL Audio", "fx (EQ)", ["flat"], "authentic", "https://github.com/ZL-Audio/ZLEqualizer", "README image via camo (canonical Google Drive)"),
 ("Phase Plant", "Kilohearts", "synth", ["flat"], "facsimile", "https://kilohearts.com/products/phase_plant", "vendor site egress-blocked"),
 ("Serum", "Xfer Records", "synth (wavetable)", ["hud"], "authentic (community skin, stock layout)", "https://xferrecords.com/products/serum", "github.com/andzeil/serum-nord-skin screenshots"),
 ("Serum 2", "Xfer Records", "synth (wavetable)", ["hud"], "facsimile", "https://xferrecords.com/products/serum-2", "current version redrawn as study"),
 ("Vital", "Vital Audio", "synth (wavetable)", ["hud"], "authentic (near-stock community skin)", "https://vital.audio", "github.com/Nikug/vital-skins preview"),
 ("LSP Multiband Compressor", "Linux Studio Plugins", "fx + metering", ["hud"], "authentic", "https://github.com/lsp-plugins/lsp-plugins", "official site-repo screenshot (lsp-site)"),
 ("Omnisphere 2", "Spectrasonics", "synth", ["hud"], "facsimile", "https://www.spectrasonics.net/products/omnisphere/", "vendor site egress-blocked; no legitimate GitHub capture found"),
 ("Portal", "Output", "fx (granular)", ["hud"], "facsimile", "https://output.com/products/portal", "vendor site egress-blocked"),
 ("Ozone 11", "iZotope", "mastering + metering", ["hud"], "facsimile", "https://www.izotope.com/en/products/ozone.html", "vendor site egress-blocked"),
 ("Pigments", "Arturia", "synth", ["hud"], "facsimile", "https://www.arturia.com/products/software-instruments/pigments/overview", "vendor site egress-blocked"),
 ("Massive X", "Native Instruments", "synth", ["hud"], "facsimile", "https://www.native-instruments.com/en/products/komplete/synths/massive-x/", "vendor site egress-blocked"),
 ("Surge XT", "Surge Synth Team", "synth (hybrid)", ["util"], "authentic", "https://github.com/surge-synthesizer/surge", "site-repo manual image"),
 ("Geonkick", "Geonkick (Iurie Nistor)", "drum synth", ["util"], "authentic", "https://github.com/Geonkick-Synthesizer/geonkick", "repo README images"),
 ("Wolf Shaper", "Patrick Desaulniers", "fx (waveshaper)", ["util"], "authentic", "https://github.com/pdesaulniers/wolf-shaper", "repo README image"),
 ("PaulXStretch", "Sonosaurus", "fx (spectral stretch)", ["util"], "authentic", "https://github.com/essej/paulxstretch", "README image via camo (canonical sonosaurus.com)"),
 ("Grace", "One Small Clue", "sampler", ["util"], "authentic", "https://github.com/s-oram/Grace", "repo README image"),
 ("Stochas", "Surge Synth Team", "sequencer", ["util"], "authentic", "https://github.com/surge-synthesizer/stochas", "site-repo screenshot (stochas.org)"),
 ("Vaporizer2", "VAST Dynamics", "synth (wavetable)", ["util"], "authentic", "https://github.com/VASTDynamics/Vaporizer2", "repo README images"),
 ("Airwindows Consolidated", "Airwindows", "fx suite", ["util"], "authentic", "https://github.com/baconpaul/airwin2rack", "repo doc image (plugin in Bitwig)"),
 ("Monique", "Surge Synth Team (orig. Monoplugs)", "synth (mono)", ["util"], "authentic", "https://github.com/surge-synthesizer/monique-monosynth", "repo resources/high_res.png"),
 ("Kontakt", "Native Instruments", "sampler", ["util"], "authentic (partial header)", "https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/", "instrument header via github.com/raffadrummer/uimacros4ksp"),
 ("TDR Kotelnikov", "Tokyo Dawn Records", "fx (compressor)", ["util"], "facsimile", "https://www.tokyodawn.net/tdr-kotelnikov/", "vendor site egress-blocked"),
 ("SPAN", "Voxengo", "metering", ["util"], "facsimile", "https://www.voxengo.com/product/span/", "vendor site egress-blocked"),
 ("meters.lv2", "Robin Gareus (x42)", "metering", ["vintage", "retro"], "authentic", "https://github.com/x42/meters.lv2", "repo doc images (8 meter types)"),
 ("MJUC", "Klanghelm", "fx (compressor)", ["vintage"], "facsimile", "https://klanghelm.com/contents/products/MJUC", "vendor site egress-blocked"),
 ("Decapitator", "Soundtoys", "fx (saturation)", ["vintage"], "facsimile", "https://www.soundtoys.com/product/decapitator/", "vendor site egress-blocked"),
 ("Mu", "Pulsar Audio", "fx (compressor)", ["vintage"], "facsimile", "https://pulsar.audio/mu/", "vendor site egress-blocked"),
 ("Dexed", "Digital Suburban", "synth (FM)", ["retro"], "authentic", "https://github.com/asb2m10/dexed", "third-party GitHub capture (eldun.github.io repo); official repo/site embed no screenshot"),
 ("Signalizer", "Janus Thorborg", "visual / analyzer", ["retro"], "authentic", "https://github.com/jthorborg/signalizer", "README image via camo (canonical jthorborg.com)"),
 ("chipsynth MD", "Plogue", "synth (chip)", ["retro"], "facsimile", "https://www.plogue.com/products/chipsynth-md.html", "vendor site egress-blocked"),
 ("KORG Collection M1", "KORG", "synth (rompler)", ["retro"], "facsimile", "https://www.korg.com/us/products/software/korg_collection/", "vendor site egress-blocked"),
 ("Valentine", "Tote Bag Labs", "fx (compressor)", ["playful"], "authentic", "https://github.com/tote-bag-labs/valentine", "repo README image"),
 ("Bespoke Synth", "Ryan Challinor", "modular environment", ["playful"], "authentic", "https://github.com/BespokeSynth/BespokeSynth", "repo README images"),
 ("CHOW Tape Model", "Chowdhury DSP", "fx (tape)", ["playful"], "authentic", "https://github.com/jatinchowdhury18/AnalogTapeModel", "repo Plugin/Screenshots/full_gui.png"),
 ("Dragonfly Reverb", "Michael Willis", "fx (reverb)", ["playful"], "authentic", "https://github.com/michaelwillis/dragonfly-reverb", "repo README image"),
 ("Microtonic", "Sonic Charge", "drum machine", ["playful"], "authentic (factory skin)", "https://soniccharge.com/microtonic", "github.com/malstrom72/microtonic-skins (developer's own account)"),
 ("Spaced Out", "Baby Audio", "fx (reverb/delay)", ["playful"], "facsimile", "https://babyaud.io/spaced-out", "vendor site egress-blocked"),
 ("Lossy", "Goodhertz", "fx (degrade)", ["playful"], "facsimile", "https://goodhertz.com/lossy/", "vendor site egress-blocked"),
 ("XO", "XLN Audio", "drum sampler", ["playful"], "facsimile", "https://www.xlnaudio.com/products/xo", "vendor site egress-blocked"),
 ("MTurboComp", "MeldaProduction", "fx (compressor)", [], "surveyed (discussed)", "https://www.meldaproduction.com/MTurboComp", "community-criticized GUI discussed in field notes; imagery inaccessible"),
 ("Dumpster Fire", "Freakshow Industries", "fx (glitch)", [], "surveyed (discussed)", "https://freakshowindustries.com/dumpster-fire", "divisive collage-illustrative style; facsimile would misrepresent"),
 ("Drumvolution", "Wave Alchemy", "drum machine", [], "surveyed (discussed)", "https://www.wavealchemy.co.uk/drumvolution", "community-praised GUI; imagery inaccessible"),
]

# notable specimen captions
NOTABLE = {
 "jc303__logo": "Acid-smiley counter in the zero — a subculture badge doing logo duty.",
 "proq3__band-panel": "The floating band inspector: seven verbs of EQ compressed into 30px of icons.",
 "supermassive__delay-card": "A knob reduced to two shapes and one tick — and still unmistakably a knob.",
 "x42__vu-classic": "The cream VU face: the industry's most durable single glyph, here in faithful LV2 form.",
 "dexed__algorithm": "FM routing as teal pixel calligraphy — the DX7's most feared screen made friendly.",
 "microtonic__pattern-row": "Glass-candy step ovals: toy affordance carrying professional sequencing.",
 "airwin__prose": "The manual is the interface: brutalism as radical documentation.",
 "cardinal__qnt": "A piano keyboard abstracted to pink cells — pitch as pattern, not furniture.",
 "vital__lfo": "Spline-with-jewelry: the node-handle editor as the new signature control.",
 "bespoke__fubble": "A scribble as a modulation source — hand-drawn ethos taken literally.",
 "serum__wavetable3d": "The receding wavetable stack: one render that became a whole genre's shorthand.",
 "monique__arp-row": "Sixteen red arcs: state as typography, no bezels anywhere.",
}

def build():
    css = """
:root{--bg:#0b0b0e;--panel:#131318;--ink:#e8e6e0;--sub:#9a97a0;--line:#26262e;--acc:#c8a24a;--auth:#4a9e6f;--fac:#b06a3a}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.6 Georgia,'Times New Roman',serif;padding:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px 120px}
header.cover{padding:110px 0 70px;border-bottom:1px solid var(--line);margin-bottom:60px}
.kicker{font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:4px;color:var(--acc);text-transform:uppercase;margin-bottom:18px}
h1{font-size:52px;line-height:1.08;font-weight:normal;letter-spacing:.5px;margin-bottom:22px}
.lede{font-size:18px;color:var(--sub);max-width:820px}
.meta-row{display:flex;gap:28px;flex-wrap:wrap;margin-top:34px;font-family:Arial,sans-serif;font-size:12px;color:var(--sub)}
.meta-row b{color:var(--ink);font-size:20px;display:block;font-weight:normal}
.note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);padding:18px 22px;margin:40px 0;font-size:13.5px;color:var(--sub);line-height:1.7}
.note code{font-family:'Courier New',monospace;color:var(--ink);font-size:12.5px}
h2{font-size:30px;font-weight:normal;margin:90px 0 6px;letter-spacing:.4px}
h2 .idx{color:var(--acc);font-size:16px;vertical-align:18px;letter-spacing:2px;font-family:Arial,sans-serif;margin-right:10px}
.ann{max-width:860px;color:var(--ink);font-size:16px;margin:14px 0 4px}
.lineage{max-width:860px;color:var(--sub);font-size:13.5px;font-style:italic;margin-bottom:8px}
.vendors{font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:var(--sub);text-transform:uppercase;margin-bottom:26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.card.wide{grid-column:span 2}
@media(max-width:640px){.card.wide{grid-column:span 1}}
.imgbox{background:#0e0e12;display:flex;align-items:center;justify-content:center;padding:10px;min-height:120px}
.imgbox img,.imgbox svg{max-width:100%;height:auto;display:block}
.cap{padding:10px 12px;border-top:1px solid var(--line)}
.cap .pl{font-family:Arial,sans-serif;font-size:12.5px;color:var(--ink)}
.cap .vd{font-family:Arial,sans-serif;font-size:11px;color:var(--sub)}
.cap .ds{font-size:12px;color:var(--sub);margin-top:5px;line-height:1.5}
.cap .nb{font-size:12px;color:var(--acc);margin-top:6px;font-style:italic}
.badge{display:inline-block;font-family:Arial,sans-serif;font-size:9px;letter-spacing:1.5px;padding:2px 7px;border-radius:3px;margin-left:8px;vertical-align:2px}
.badge.auth{color:var(--auth);border:1px solid var(--auth)}
.badge.fac{color:var(--fac);border:1px solid var(--fac)}
table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12.5px;margin-top:26px}
th{ text-align:left;color:var(--sub);font-weight:normal;letter-spacing:1.5px;text-transform:uppercase;font-size:10.5px;padding:10px 12px;border-bottom:1px solid var(--acc)}
td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
td a{color:#8fb4d8;text-decoration:none;word-break:break-all}
tr:hover td{background:#141419}
.fieldnotes p{max-width:860px;margin:16px 0;color:var(--ink)}
.fieldnotes h3{font-size:19px;font-weight:normal;color:var(--acc);margin-top:44px;letter-spacing:.5px}
.small{font-size:12px;color:var(--sub)}
.toc{font-family:Arial,sans-serif;font-size:13px;column-count:2;column-gap:40px;margin-top:20px}
.toc a{color:var(--ink);text-decoration:none;display:block;padding:7px 0;border-bottom:1px solid var(--line)}
.toc span{color:var(--acc);margin-right:10px}
footer{margin-top:110px;border-top:1px solid var(--line);padding-top:28px;color:var(--sub);font-size:12.5px;font-family:Arial,sans-serif}
"""
    # collect specimens per group
    group_cards = {g[0]: [] for g in GROUPS}
    group_vendors = {g[0]: set() for g in GROUPS}
    unassigned = []
    for cid, m in sorted(crop_meta.items()):
        g = crop_group(cid)
        if not g:
            unassigned.append(cid); continue
        pref = cid.split("__")[0]
        label, vendor = CROP_PLUGIN.get(pref, (pref, "?"))
        f = CROPS / f"{cid}.png"
        if not f.exists(): continue
        uri, (w, h) = b64_img(f)
        wide = ' wide' if w / max(h, 1) > 3.2 else ''
        nb = f'<div class="nb">{H.escape(NOTABLE[cid])}</div>' if cid in NOTABLE else ""
        group_cards[g].append(
            f'<div class="card{wide}"><div class="imgbox"><img loading="lazy" src="{uri}" alt="{H.escape(cid)}"></div>'
            f'<div class="cap"><span class="pl">{H.escape(label)}<span class="badge auth">AUTHENTIC CROP</span></span>'
            f'<div class="vd">{H.escape(vendor)}</div><div class="ds">{H.escape(m["desc"])}</div>{nb}</div></div>')
        group_vendors[g].add(vendor)
    # eurorack panels (rasterized from authentic SVGs)
    for slug, mod, vendor in PANELS:
        png = BASE / "plates_png" / f"{slug}.png"
        svg = RAW / f"{slug}.svg"
        if png.exists():
            uri, _ = b64_img(png, max_w=320)
        elif svg.exists():
            continue
        else:
            continue
        group_cards["eurorack"].append(
            f'<div class="card"><div class="imgbox"><img loading="lazy" src="{uri}" alt="{H.escape(slug)}"></div>'
            f'<div class="cap"><span class="pl">{H.escape(mod)}<span class="badge auth">AUTHENTIC PANEL SVG</span></span>'
            f'<div class="vd">{H.escape(vendor)}</div><div class="ds">Faceplate artwork as shipped in the repo; text outlined to paths.</div></div></div>')
        group_vendors["eurorack"].add(vendor)
    # facsimile plates
    for slug, (g, label, vendor, url) in PLATE_INFO.items():
        svg = PLATES / f"{slug}.svg"
        if not svg.exists(): continue
        group_cards[g].append(
            f'<div class="card wide"><div class="imgbox">{svg_inline(svg)}</div>'
            f'<div class="cap"><span class="pl">{H.escape(label)}<span class="badge fac">FACSIMILE STUDY</span></span>'
            f'<div class="vd">{H.escape(vendor)}</div>'
            f'<div class="ds">Redrawn glyph study — not a screenshot. Vendor imagery unreachable from this environment; drawn from documented knowledge of the interface. Reference: <a style="color:#8fb4d8" href="{url}">{url.split("//")[1].split("/")[0]}</a></div></div></div>')
        group_vendors[g].add(vendor)

    # sections
    toc = "".join(f'<a href="#g-{gid}"><span>{i+1:02d}</span>{H.escape(title)}</a>' for i, (gid, title, _, _) in enumerate(GROUPS))
    sections = ""
    for i, (gid, title, ann, lineage) in enumerate(GROUPS):
        vend = sorted(group_vendors[gid])
        sections += (f'<section id="g-{gid}"><h2><span class="idx">{i+1:02d}</span>{H.escape(title)}</h2>'
                     f'<p class="ann">{H.escape(ann)}</p><p class="lineage">{H.escape(lineage)}</p>'
                     f'<p class="vendors">{len(group_cards[gid])} specimens · {len(vend)} vendors — {H.escape(", ".join(vend))}</p>'
                     f'<div class="grid">{"".join(group_cards[gid])}</div></section>')

    # provenance table
    rows = ""
    gtitle = {g[0]: g[1] for g in GROUPS}
    for name, vendor, cat, gs, status, page, note in PLUGINS:
        gl = ", ".join(gtitle[g].split(" ")[0].rstrip(":,") for g in gs) or "—"
        badge = "auth" if status.startswith("authentic") else ("fac" if status.startswith("facsimile") else "")
        stat = f'<span class="badge {badge}" style="margin-left:0">{H.escape(status.upper())}</span>' if badge else H.escape(status)
        rows += (f'<tr><td>{H.escape(name)}</td><td>{H.escape(vendor)}</td><td>{H.escape(cat)}</td>'
                 f'<td>{H.escape(gl)}</td><td>{stat}</td><td><a href="{page}">{H.escape(page)}</a>'
                 f'<div class="small">{H.escape(note)}</div></td></tr>')

    n_specimens = sum(len(v) for v in group_cards.values())
    n_plugins = len(PLUGINS)
    n_vendors = len({p[1] for p in PLUGINS})
    n_auth = sum(1 for p in PLUGINS if p[4].startswith("authentic"))

    html_doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Plugin Glyph Atlas</title><style>{css}</style></head><body><div class="wrap">
<header class="cover">
<div class="kicker">Cosimo Synth · Design Research · 2026-07-16</div>
<h1>The Plugin Glyph Atlas</h1>
<p class="lede">A comparative iconography audit of audio-plugin interfaces — waveform symbols, filter curves, panel silkscreen, logo lockups, meter faces, ornament — clustered by visual style rather than function, as raw material for a new synthesizer's visual identity.</p>
<div class="meta-row"><div><b>{n_specimens}</b>specimens</div><div><b>{n_plugins}</b>plugins surveyed</div><div><b>{n_vendors}</b>vendors</div><div><b>8</b>style groups</div><div><b>{n_auth}</b>plugins with authentic imagery</div></div>
<p class="lede" style="margin-top:36px;font-size:15.5px">The industry's mark-making today runs on eight currents. Two inherit hardware wholesale — photoreal skeuomorphism and its modular cousin, the Eurorack panel legend. Two subtract: Bauhaus flat-minimalism and brutalist engineering utilitarianism. Two add light: sci-fi HUD futurism and the retro-digital cult of the LCD and the phosphor trace. And two decorate on purpose: the engraved-vintage school and a fast-growing playful, typographic, digital-native camp. The strongest identities commit to one current and mine it exhaustively; the weakest sample all of them.</p>
<div class="note"><b style="color:var(--ink)">Methodology &amp; constraint disclosure.</b> This audit ran inside a sandboxed environment whose egress policy allows only GitHub-family hosts; every vendor site, KVR page, and marketplace was policy-blocked (403). Acquisition therefore used two tiers. <code>AUTHENTIC CROP</code> = pixels from real GUI imagery reached via GitHub (open-source repos, official site-repos, developer-owned skin repos, and GitHub's camo image proxy for vendor-hosted originals), cropped per the extraction methodology. <code>FACSIMILE STUDY</code> = an SVG glyph study redrawn from documented knowledge where no legitimate image was reachable — explicitly a study, never pixel-accurate, with the vendor page retained as reference. Community curation signals (KVR, Gearspace, Sound&nbsp;on&nbsp;Sound, BPB and forum threads) were gathered via web search; thread URLs are in the repository's <code>community-wisdom.md</code>. Piracy-adjacent sources were skipped on sight. All crops are citation-grade reference specimens for private design research, credited to their vendors.</div>
<nav class="toc">{toc}</nav>
</header>
{sections}
<section id="provenance"><h2><span class="idx">IX</span>Provenance Index</h2>
<p class="ann">Every plugin surveyed, its acquisition status, and where its imagery (or reference) lives. Gaps are recorded, not hidden.</p>
<table><thead><tr><th>Plugin</th><th>Vendor</th><th>Category</th><th>Style group(s)</th><th>Status</th><th>Source</th></tr></thead><tbody>{rows}</tbody></table></section>
<section id="fieldnotes" class="fieldnotes"><h2><span class="idx">X</span>Designer's Field Notes</h2>
<h3>Which styles own which categories</h3>
<p>Compressors, tape machines and channel strips remain the deepest skeuomorph/vintage territory — the hardware being imitated was itself iconic, and the cream-VU-face is the single most durable glyph in the industry. EQs and meters cluster hard toward flat minimalism and utilitarian precision (FabFilter, ZL, TDR, Voxengo): where the data display is the hero, ornament retreats. Wavetable synths standardized on technical futurism — the 3D wavetable stack (Serum) and the node-handled spline (Vital) are now genre-mandatory glyphs. Drum machines split between 808 lineage worship (D16) and toy-like friendliness (Microtonic's glass ovals, XO's constellation). Modular lives in its own panel-legend world, so internally consistent that Cardinal, VCV, Befaco and Mutable panels read as one typographic species.</p>
<h3>Currents in motion</h3>
<p>Three convergences stand out. First, the <i>ring-knob</i> — a thin progress arc around a minimal circle — has become the cross-style lingua franca (Vital, Monique, Pigments, CHOW, LSP), displacing both the rendered knob and the flat dot. Second, <i>type-as-control</i> is spreading from Goodhertz outward: Valhalla's mode menus and Airwindows' prose window treat words and numerals as the interface itself. Third, <i>skinnability</i> (Vital, Microtonic, Surge skin systems, the Diva Redux community theme) means a glyph system must now survive recolor and re-theme — marks with strong silhouettes outlive marks that lean on rendering.</p>
<h3>Community wisdom, distilled</h3>
<p>Across KVR and Gearspace threads the praised interfaces share one trait regardless of style: a single committed visual thesis (FabFilter's forward-looking minimalism, Valhalla's "Bauhaus" color blocks, Omnisphere's cinematic HUD, Kotelnikov's instrument-grade precision, Microtonic's toy perfection). The criticized ones (Melda's engineering sprawl, legacy Waves' shrinking bitmaps, Kontakt's tiny buttons) fail on discipline, not on style choice. Divisive-by-design interfaces (Freakshow's collage chaos) prove ornament can be a brand even when half the audience hates it.</p>
<h3>Open territory for a new synthesizer</h3>
<p>Four spaces look genuinely under-claimed. <b>(1) Engraved-vintage × modern editors:</b> the letterpress/engraved vocabulary is owned by compressors and saturators; no serious synthesizer speaks it while still offering spline-and-ring modernity. <b>(2) Phosphor-scope revival:</b> x42's meters and Signalizer show how gorgeous decay-smear phosphor rendering is, yet no mainstream synth builds its identity on instrument-grade scope graphics with modern typography. <b>(3) Panel-legend without the rack:</b> Eurorack's mono-line jack-legend language applied to a non-modular synth would read instantly as "instrument," at almost no rendering cost, and would survive theming. <b>(4) A mascot with a day job:</b> playful marks (Totie, the Airwindows dog, dragonflies) are confined to effects and toys; a synthesizer that commits to a character system while keeping utilitarian editors would stand alone. The crowded lanes — generic dark-flat-with-cyan and photoreal-vintage-console — are best avoided entirely.</p>
</section>
<footer>Private research mood board for the Cosimo Synth project. All plugin imagery © its respective vendors and authors; crops are citation-grade reference specimens with full attribution in the Provenance Index. Facsimile plates are original redrawn studies and are labeled as such. Built 2026-07-16 in a GitHub-only-egress environment; see research/glyph-atlas/ in the repository for methodology files.</footer>
</div></body></html>"""
    OUT_HTML.write_text(html_doc)
    prov = {"generated": "2026-07-16", "specimens": n_specimens, "plugins": [
        {"name": p[0], "vendor": p[1], "category": p[2], "style_groups": p[3],
         "status": p[4], "source_page": p[5], "imagery_note": p[6]} for p in PLUGINS]}
    OUT_PROV.write_text(json.dumps(prov, indent=1))
    print(f"HTML: {OUT_HTML} ({OUT_HTML.stat().st_size/1e6:.1f} MB)")
    print(f"specimens={n_specimens} unassigned_crops={unassigned}")

if __name__ == "__main__":
    build()
