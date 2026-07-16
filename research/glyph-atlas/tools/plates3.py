#!/usr/bin/env python3
"""Facsimile plates, batch 3: vintage-engraved, retro-digital, playful, precision."""
import math, random
from plates import plate, text, knob, ticks, screw, led, toggle, wave_path, vu_meter, slider_v, lcd_text, SANS, SERIF, MONO


# --------------------------------------------------------- Klanghelm MJUC
def mjuc():
    W, H = 760, 250
    b = ('<defs><linearGradient id="creamv" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0%" stop-color="#e6dcc3"/><stop offset="100%" stop-color="#d3c5a4"/></linearGradient></defs>')
    b += f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="8" fill="url(#creamv)" stroke="#4a3d28" stroke-width="2.5"/>'
    for x, y in [(28, 28), (W - 28, 28), (28, H - 28), (W - 28, H - 28)]:
        b += screw(x, y, 6)
    b += text(W / 2, 44, "M J U C", 24, "#3a2f1c", SERIF, ls=6, weight="bold")
    b += text(W / 2, 62, "· VARIABLE - MU · COMPRESSOR ·", 8.5, "#6b5b3d", SERIF, ls=2)
    b += vu_meter(W / 2, 130, 170, 96, face="#f3ecd4", needle_deg=-8)
    for cx, lab, ang in [(120, "COMPRESSION", 30), (640, "MAKE-UP", -20)]:
        b += ticks(cx, 128, 44, 51, 21, color="#3a2f1c", w=1.1)
        b += knob(cx, 128, 36, ang, "#241d12", "#0d0a06", "#e6dcc3", pointer_w=3)
        b += text(cx, 196, lab, 9, "#3a2f1c", SERIF, ls=2, weight="bold")
    b += toggle(255, 210, 15, 26, up=True, plate="#5a4c33", lever="#efe6cf")
    b += text(255, 240, "SLOW · FAST", 7, "#6b5b3d", SERIF, ls=1)
    b += toggle(505, 210, 15, 26, up=False, plate="#5a4c33", lever="#efe6cf")
    b += text(505, 240, "MK I · MK II · MK III", 7, "#6b5b3d", SERIF, ls=1)
    b += text(W / 2, 226, "KLANGHELM", 9, "#3a2f1c", SERIF, ls=5)
    plate("mjuc", W, H, b, "#171410")


# ------------------------------------------------------ Soundtoys Decapitator
def decapitator():
    W, H = 760, 250
    b = ('<defs><linearGradient id="stcream" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0%" stop-color="#efe8d8"/><stop offset="100%" stop-color="#ddd2b8"/></linearGradient></defs>')
    b += f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="10" fill="url(#stcream)" stroke="#8a7f66" stroke-width="2"/>'
    b += text(38, 52, "DECAPITATOR", 27, "#2e2a22", SANS, anchor="start", weight="bold", ls=1)
    b += text(40, 72, "ANALOG SATURATION MODELER", 8.5, "#8c1f18", SANS, anchor="start", ls=3)
    b += ticks(150, 158, 48, 56, 11, color="#2e2a22", w=1.6)
    b += knob(150, 158, 40, 55, "#efe8d8", "#6a604a", "#8c1f18", pointer_w=4)
    b += text(150, 232, "DRIVE", 11, "#2e2a22", SANS, ls=3, weight="bold")
    for i, (lab, on) in enumerate([("A", True), ("E", False), ("N", False), ("T", False), ("P", False)]):
        cx = 280 + i * 44
        b += f'<circle cx="{cx}" cy="140" r="15" fill="{"#8c1f18" if on else "#efe8d8"}" stroke="#6a604a" stroke-width="1.5"/>'
        b += text(cx, 145, lab, 11, "#f5efe2" if on else "#2e2a22", SANS, weight="bold")
    b += text(368, 172, "STYLE", 8.5, "#6a604a", SANS, ls=3)
    b += f'<rect x="540" y="112" width="88" height="56" rx="6" fill="#8c1f18" stroke="#5e120d" stroke-width="2"/>'
    b += text(584, 146, "PUNISH", 11, "#f5efe2", SANS, weight="bold", ls=1)
    b += ticks(690, 140, 26, 31, 9, color="#2e2a22", w=1.2)
    b += knob(690, 140, 20, -25, "#efe8d8", "#6a604a", "#8c1f18", pointer_w=3)
    b += text(690, 184, "MIX", 9, "#2e2a22", SANS, ls=2, weight="bold")
    b += text(W - 36, 234, "SOUNDTOYS", 9, "#8a7f66", SANS, ls=4, anchor="end", weight="bold")
    b += text(280, 220, "silkscreen: A/E/N/T/P = modeled hardware voicings", 7.5, "#8a7f66", SANS, anchor="start", style="italic")
    plate("decapitator", W, H, b, "#191713")


# ------------------------------------------------------------- Pulsar Mu
def pulsar_mu():
    W, H = 760, 240
    b = ('<defs><linearGradient id="pmgold" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#1b1b20"/></linearGradient></defs>')
    b += f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="6" fill="url(#pmgold)" stroke="#0b0b0e" stroke-width="2"/>'
    b += vu_meter(190, 110, 200, 110, face="#f6e7bd", needle_deg=4)
    b += text(190, 196, "PULSAR  Mu", 13, "#d9c07c", SERIF, ls=3, weight="bold")
    b += text(190, 214, "VARI-MU LEVELLING AMPLIFIER", 7, "#8f8462", SANS, ls=2)
    for i, (lab, ang) in enumerate([("INPUT", 20), ("THRESHOLD", -35), ("ATTACK", 10), ("RELEASE", 45)]):
        cx = 420 + i * 86
        b += ticks(cx, 110, 32, 38, 13, color="#8f8462", w=1)
        b += knob(cx, 110, 25, ang, "#101014", "#000", "#d9c07c", pointer_w=2.5)
        b += text(cx, 166, lab, 8, "#d9c07c", SANS, ls=1.5)
    b += toggle(470, 205, 14, 24, up=True, plate="#101014", lever="#d9c07c") + text(470, 236, "DUAL / LINK", 6.5, "#8f8462", SANS, ls=1)
    b += toggle(580, 205, 14, 24, up=False, plate="#101014", lever="#d9c07c") + text(580, 236, "MID / SIDE", 6.5, "#8f8462", SANS, ls=1)
    b += text(700, 220, "engraved brass legends", 7, "#6f6547", SANS, anchor="end", style="italic")
    plate("pulsar-mu", W, H, b, "#121215")


# ------------------------------------------------------- Plogue chipsynth MD
def chipsynth_md():
    W, H = 760, 240
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="4" fill="#20242a" stroke="#0c0e11" stroke-width="2"/>'
    # pixel wordmark
    def px_text(x0, y0, s, c="#79e6a3", cell=3):
        out, glyphs = "", {
            "C": ["###", "#..", "#..", "#..", "###"], "H": ["#.#", "#.#", "###", "#.#", "#.#"],
            "I": ["###", ".#.", ".#.", ".#.", "###"], "P": ["###", "#.#", "###", "#..", "#.."],
            "S": ["###", "#..", "###", "..#", "###"], "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
            "N": ["#.#", "###", "###", "#.#", "#.#"], "T": ["###", ".#.", ".#.", ".#.", ".#."],
            "M": ["#.#", "###", "###", "#.#", "#.#"], "D": ["##.", "#.#", "#.#", "#.#", "##."],
            " ": ["...", "...", "...", "...", "..."]}
        cx = x0
        for ch in s:
            g = glyphs.get(ch, glyphs[" "])
            for r, row in enumerate(g):
                for cidx, v in enumerate(row):
                    if v == "#":
                        out += f'<rect x="{cx + cidx*cell}" y="{y0 + r*cell}" width="{cell-0.5}" height="{cell-0.5}" fill="{c}"/>'
            cx += cell * 4
        return out
    b += px_text(30, 26, "CHIPSYNTH MD", "#79e6a3", 4)
    b += text(30, 72, "FM CHIP EMULATION · YM2612", 7.5, "#5a636e", MONO, anchor="start", ls=2)
    # LCD register grid
    b += f'<rect x="30" y="88" width="330" height="120" rx="3" fill="#0d1a12" stroke="#1e3626" stroke-width="2"/>'
    for r in range(4):
        y = 108 + r * 26
        b += text(46, y, f"OP{r+1}", 10, "#79e6a3", MONO, anchor="start")
        for c in range(6):
            val = ["1F", "0A", "07", "00", "1C", "02"][c]
            b += text(96 + c * 42, y, val, 10, "#4fd684" if (r + c) % 3 else "#2e7a4d", MONO)
    # scanline overlay
    for yy in range(90, 206, 4):
        b += f'<line x1="32" y1="{yy}" x2="358" y2="{yy}" stroke="#000" stroke-width="1" opacity="0.22"/>'
    # pixel envelope display
    b += f'<rect x="390" y="88" width="200" height="120" rx="3" fill="#101418" stroke="#232a32" stroke-width="2"/>'
    pts = [(0, 40), (8, 2), (20, 14), (36, 14), (48, 30), (64, 34), (80, 38)]
    for i in range(len(pts) - 1):
        (xa, ya), (xb, yb) = pts[i], pts[i + 1]
        steps = 6
        for sidx in range(steps):
            t0 = sidx / steps
            px = 398 + (xa + (xb - xa) * t0) * 2.2
            py = 104 + (ya + (yb - ya) * t0) * 2.2
            b += f'<rect x="{px:.0f}" y="{py:.0f}" width="4" height="4" fill="#e8c04a"/>'
    b += text(490, 224, "ADSSR", 8, "#5a636e", MONO, ls=3)
    for i, lab in enumerate(["ALG", "FB", "MUL", "DT"]):
        cx = 630 + (i % 2) * 60
        cy = 110 + (i // 2) * 60
        b += knob(cx, cy, 18, [-40, 20, 60, -10][i], "#181c22", "#0a0c0f", "#79e6a3", pointer_w=2)
        b += text(cx, cy + 34, lab, 8, "#79e6a3", MONO, ls=1)
    plate("chipsynth-md", W, H, b, "#14171b")


# ------------------------------------------------------------ KORG M1
def korg_m1():
    W, H = 760, 230
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="6" fill="#22201e" stroke="#0d0c0b" stroke-width="2"/>'
    b += text(34, 48, "KORG", 26, "#e8e4dc", SANS, anchor="start", weight="bold", ls=2)
    b += text(34, 70, "M1  MUSIC  WORKSTATION", 9, "#a09a8e", SANS, anchor="start", ls=3)
    # teal LCD
    b += f'<rect x="250" y="30" width="360" height="110" rx="4" fill="#0e2f2b" stroke="#000" stroke-width="3"/>'
    b += f'<rect x="256" y="36" width="348" height="98" rx="2" fill="#12403a"/>'
    b += text(276, 66, "COMBI  I11  Universe", 14, "#9be8d8", MONO, anchor="start", ls=1)
    b += text(276, 92, "OSC: Bell+Choir   FX: Hall", 11, "#63bfae", MONO, anchor="start")
    b += text(276, 116, "▸ EDIT   ▸ WRITE   ▸ COMPARE", 10, "#63bfae", MONO, anchor="start")
    for yy in range(38, 132, 3):
        b += f'<line x1="257" y1="{yy}" x2="603" y2="{yy}" stroke="#0a231f" stroke-width="1" opacity="0.5"/>'
    # membrane buttons
    for i, lab in enumerate(["COMBI", "PROG", "EDIT", "GLOBAL", "SEQ"]):
        x0 = 250 + i * 74
        b += f'<rect x="{x0}" y="158" width="60" height="26" rx="3" fill="#33302c" stroke="#0d0c0b" stroke-width="1.5"/>'
        b += text(x0 + 30, 175, lab, 8, "#d8d2c6", SANS, ls=1)
        b += f'<rect x="{x0}" y="190" width="60" height="3" fill="{["#c8402a","#d9782d","#e3c53a","#69a05a","#4a7fc0"][i]}"/>'
    b += text(658, 120, "◉", 22, "#8c1d18", SANS)
    b += text(658, 150, "VALUE", 7.5, "#a09a8e", SANS, ls=2)
    b += text(W - 34, 210, "1988 workstation LCD idiom", 7.5, "#6e675c", SANS, anchor="end", style="italic")
    plate("korg-m1", W, H, b, "#151412")


# --------------------------------------------------------- Baby Audio Spaced Out
def spaced_out():
    W, H = 760, 250
    b = ('<defs><linearGradient id="bagrad" x1="0" y1="0" x2="1" y2="1">'
         '<stop offset="0%" stop-color="#20203f"/><stop offset="100%" stop-color="#3d2b52"/></linearGradient></defs>')
    b += f'<rect width="{W}" height="{H}" fill="url(#bagrad)"/>'
    random.seed(7)
    for _ in range(70):
        x, y = random.uniform(10, W - 10), random.uniform(10, H - 10)
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(0.5,1.6):.1f}" fill="#cdd3ff" opacity="{random.uniform(0.2,0.8):.2f}"/>'
    b += text(40, 52, "SPACED OUT", 22, "#eef0ff", SANS, anchor="start", ls=6, weight="bold")
    b += text(40, 72, "BABY audio.", 10, "#9fa6d8", SANS, anchor="start", ls=1)
    # constellation trigger grid
    b += f'<rect x="40" y="92" width="300" height="130" rx="10" fill="#1a1a33" stroke="#4a4a78" stroke-width="1"/>'
    pts = [(70, 190), (120, 150), (170, 175), (230, 120), (300, 160)]
    for i in range(len(pts) - 1):
        b += f'<line x1="{pts[i][0]}" y1="{pts[i][1]}" x2="{pts[i+1][0]}" y2="{pts[i+1][1]}" stroke="#8f9bff" stroke-width="1.2" opacity="0.8"/>'
    for i, (x, y) in enumerate(pts):
        b += f'<circle cx="{x}" cy="{y}" r="{6 if i%2 else 4}" fill="{"#e8ecff" if i%2 else "#8f9bff"}"/>'
        b += f'<circle cx="{x}" cy="{y}" r="{10 if i%2 else 7}" fill="none" stroke="#8f9bff" stroke-width="0.8" opacity="0.5"/>'
    b += text(190, 240, "GENERATIVE WET-VERB GRID", 7.5, "#7a82b8", SANS, ls=2)
    # right: pill sliders + smiley moon
    for i, lab in enumerate(["ECHO", "SPACE", "MOD"]):
        y0 = 100 + i * 40
        b += f'<rect x="420" y="{y0}" width="200" height="14" rx="7" fill="#1a1a33"/>'
        b += f'<rect x="420" y="{y0}" width="{80 + i*40}" height="14" rx="7" fill="#8f9bff" opacity="0.85"/>'
        b += f'<circle cx="{420 + 80 + i*40}" cy="{y0+7}" r="10" fill="#eef0ff"/>'
        b += text(640, y0 + 12, lab, 9, "#cdd3ff", SANS, anchor="start", ls=2)
    b += f'<circle cx="700" cy="60" r="26" fill="#f2e9c8"/><circle cx="691" cy="52" r="26" fill="#3d2b52" opacity="0.92"/>'
    plate("spaced-out", W, H, b, "#20203f")


# ------------------------------------------------------------ Goodhertz Lossy
def lossy():
    W, H = 760, 240
    b = f'<rect width="{W}" height="{H}" fill="#f4f4f2"/>'
    b += f'<rect x="0" y="0" width="{W}" height="52" fill="#1d1d1f"/>'
    b += text(28, 33, "Lossy", 20, "#f4f4f2", SANS, anchor="start", weight="bold")
    b += text(96, 33, "— Goodhertz", 11, "#9a9aa0", SANS, anchor="start")
    b += text(W - 28, 33, "① ② ③ 〜 ⚙", 13, "#9a9aa0", SANS, anchor="end", ls=4)
    for i, (lab, val, unit) in enumerate([("QUALITY", "0.38", ""), ("PACKET LOSS", "24", "%"), ("JITTER", "180", "ms")]):
        x0 = 40 + i * 240
        b += text(x0, 96, lab, 10, "#6a6a70", SANS, anchor="start", ls=3)
        b += text(x0, 138, val + unit, 30, "#1d1d1f", SANS, anchor="start", weight="bold")
        b += f'<rect x="{x0}" y="156" width="190" height="6" rx="3" fill="#dcdcda"/>'
        b += f'<rect x="{x0}" y="156" width="{60 + i*45}" height="6" rx="3" fill="#2f6fed"/>'
        b += f'<circle cx="{x0 + 60 + i*45}" cy="159" r="9" fill="#fff" stroke="#2f6fed" stroke-width="2"/>'
    b += f'<rect x="40" y="192" width="132" height="26" rx="13" fill="#2f6fed"/>'
    b += text(106, 209, "AUTO  ·  ON", 9.5, "#fff", SANS, ls=2)
    b += f'<rect x="188" y="192" width="150" height="26" rx="13" fill="none" stroke="#c9c9c6" stroke-width="1.5"/>'
    b += text(263, 209, "MP3  ·  128 kbps", 9.5, "#4a4a50", SANS, ls=1)
    b += text(W - 28, 212, "typographic controls — the number IS the knob", 8, "#9a9aa0", SANS, anchor="end", style="italic")
    plate("lossy", W, H, b, "#f4f4f2")


# ----------------------------------------------------------------- XLN XO
def xo():
    W, H = 760, 250
    b = f'<rect width="{W}" height="{H}" fill="#17181c"/>'
    random.seed(11)
    cls = {"kick": "#e85d4a", "snare": "#4aa3e8", "hat": "#e8c04a", "perc": "#69d2a2"}
    import itertools
    centers = {"kick": (150, 150), "snare": (280, 100), "hat": (390, 170), "perc": (300, 190)}
    for fam, (fx, fy) in centers.items():
        for _ in range(26):
            ang, dist = random.uniform(0, 6.28), random.gauss(0, 34)
            x, y = fx + math.cos(ang) * abs(dist), fy + math.sin(ang) * abs(dist) * 0.7
            if 30 < x < 480 and 60 < y < 235:
                b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(1.5,3.2):.1f}" fill="{cls[fam]}" opacity="{random.uniform(0.35,0.95):.2f}"/>'
    kx, ky = centers["kick"]
    b += f'<circle cx="{kx}" cy="{ky}" r="11" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="{kx}" cy="{ky}" r="4" fill="#e85d4a"/>'
    b += text(40, 40, "XO", 24, "#eceef2", SANS, anchor="start", weight="bold", ls=2)
    b += text(88, 40, "· XLN AUDIO", 9, "#7a8090", SANS, anchor="start", ls=2)
    b += text(255, 56, "THE SPACE — similar sounds cluster together", 8, "#7a8090", SANS, ls=1)
    for i, (fam, col) in enumerate(cls.items()):
        x0 = 530 + (i % 2) * 105
        y0 = 84 + (i // 2) * 34
        b += f'<circle cx="{x0}" cy="{y0}" r="5" fill="{col}"/>'
        b += text(x0 + 14, y0 + 4, fam.upper(), 9, "#c9cdd8", SANS, anchor="start", ls=2)
    # sequencer lane chips
    for i in range(16):
        x0 = 520 + (i % 8) * 27
        y0 = 168 + (i // 8) * 30
        on = i in (0, 3, 6, 8, 11, 14)
        b += f'<rect x="{x0}" y="{y0}" width="22" height="22" rx="6" fill="{"#e85d4a" if on else "#24262c"}" stroke="#33363e" stroke-width="1"/>'
    b += text(628, 232, "BEAT LANES", 7.5, "#7a8090", SANS, ls=3)
    plate("xo", W, H, b, "#17181c")


# ---------------------------------------------------------- TDR Kotelnikov
def kotelnikov():
    W, H = 760, 240
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="4" fill="#3a3d42" stroke="#1d1f22" stroke-width="2"/>'
    b += f'<rect x="6" y="6" width="{W-12}" height="34" fill="#2e3136"/>'
    b += text(26, 28, "TDR", 14, "#e8b74a", SANS, anchor="start", weight="bold", ls=1)
    b += text(64, 28, "KOTELNIKOV", 13, "#d8dade", SANS, anchor="start", ls=3)
    b += text(W - 26, 28, "WIDEBAND DYNAMICS PROCESSOR", 7.5, "#8f939a", SANS, anchor="end", ls=2)
    for i, (lab, val) in enumerate([("THRESHOLD", "-18.0 dB"), ("PEAK CREST", "6.0 dB"), ("RELEASE PEAK", "80 ms"), ("RELEASE RMS", "300 ms")]):
        cx = 105 + i * 130
        b += ticks(cx, 110, 34, 40, 13, color="#9aa0a8", w=1)
        b += knob(cx, 110, 26, [-30, 10, 35, -10][i], "#26282c", "#101113", "#e8e9ec")
        b += text(cx, 164, lab, 7.5, "#c8ccd2", SANS, ls=1)
        b += f'<rect x="{cx-38}" y="172" width="76" height="15" rx="2" fill="#222428" stroke="#4a4e55"/>'
        b += text(cx, 183, val, 8.5, "#e8b74a", MONO)
    # gain reduction meter strip
    b += f'<rect x="620" y="70" width="110" height="130" rx="3" fill="#222428" stroke="#4a4e55"/>'
    for i in range(14):
        y0 = 82 + i * 8
        on = i < 5
        b += f'<rect x="632" y="{y0}" width="40" height="5" fill="{"#e8b74a" if on else "#3a3d42"}"/>'
        if i % 3 == 0:
            b += text(686, y0 + 5, f"-{i*2}", 7, "#8f939a", MONO, anchor="start")
    b += text(675, 216, "GR", 8, "#c8ccd2", SANS, ls=2)
    b += text(26, 216, "equal-loudness bypass · delta preview · sci-grade tooltips", 7.5, "#8f939a", SANS, anchor="start", style="italic")
    plate("kotelnikov", W, H, b, "#212327")


# ------------------------------------------------------------ Voxengo SPAN
def span():
    W, H = 760, 240
    b = f'<rect width="{W}" height="{H}" fill="#1e2226"/>'
    b += f'<rect x="0" y="0" width="{W}" height="30" fill="#2a2f35"/>'
    b += text(20, 20, "SPAN", 13, "#d8dce2", SANS, anchor="start", weight="bold", ls=2)
    b += text(80, 20, "Voxengo", 9, "#7c848e", SANS, anchor="start")
    b += text(W - 20, 20, "UNDERLAY  ·  SLOPE 4.5  ·  BLOCK 8192", 8, "#7c848e", MONO, anchor="end")
    random.seed(3)
    path = f"M20,200 "
    prev = 200
    for i in range(1, 60):
        x = 20 + i * (W - 40) / 59
        base = 200 - 90 * math.exp(-((i - 18) / 13) ** 2) - 60 * math.exp(-((i - 40) / 9) ** 2)
        y = base + random.uniform(-8, 8) + (i * 0.5 if i > 45 else 0)
        path += f"L{x:.0f},{y:.0f} "
        prev = y
    b += f'<path d="{path} L{W-20},210 L20,210 Z" fill="#2e6b3f" opacity="0.55"/>'
    b += f'<path d="{path}" fill="none" stroke="#6fe08a" stroke-width="1.6"/>'
    for db in range(0, 5):
        y = 50 + db * 38
        b += f'<line x1="20" y1="{y}" x2="{W-20}" y2="{y}" stroke="#2c3238" stroke-width="1"/>'
        b += text(W - 24, y - 3, f"-{db*12}", 7.5, "#7c848e", MONO, anchor="end")
    for i, f in enumerate(["50", "100", "500", "1k", "5k", "10k"]):
        b += text(60 + i * 116, 214, f, 7.5, "#7c848e", MONO)
    b += f'<rect x="20" y="222" width="240" height="12" rx="2" fill="#2a2f35"/>'
    b += text(140, 231, "RMS -14.3  ·  TRUE PEAK -0.8  ·  CREST 12.1", 7.5, "#a8e8b8", MONO)
    plate("span", W, H, b, "#1e2226")


# --------------------------------------------------------- Arturia Mini V
def mini_v():
    W, H = 760, 250
    b = ('<defs><linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0%" stop-color="#6b4226"/><stop offset="50%" stop-color="#54331d"/>'
         '<stop offset="100%" stop-color="#3f2513"/></linearGradient></defs>')
    b += f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="6" fill="url(#wood)" stroke="#241305" stroke-width="3"/>'
    b += f'<rect x="26" y="26" width="{W-52}" height="{H-52}" rx="4" fill="#16181a" stroke="#000" stroke-width="2"/>'
    b += text(52, 62, "Mini V", 24, "#e8e4da", SERIF, anchor="start", style="italic", weight="bold")
    b += text(54, 80, "ARTURIA · after the classic Model D", 8, "#9a948a", SANS, anchor="start", ls=1)
    for i, (lab, ang) in enumerate([("TUNE", -20), ("CUTOFF FREQUENCY", 30), ("EMPHASIS", -45), ("AMOUNT OF CONTOUR", 10)]):
        cx = 330 + i * 105
        b += ticks(cx, 100, 30, 37, 11, color="#d8d2c6", w=1.3)
        b += knob(cx, 100, 23, ang, "#101113", "#000", "#e8e4da", pointer_w=2.5)
        b += text(cx, 150, lab, 6.8, "#d8d2c6", SANS, ls=0.5)
    for i, (lab, up) in enumerate([("OSCILLATOR-1", True), ("OSC. 2", False), ("OSC. 3", True), ("NOISE", False)]):
        cx = 90 + i * 60
        b += toggle(cx, 185, 14, 26, up=up, plate="#26282c", lever="#4a90d9")
        b += text(cx, 222, lab, 6.5, "#d8d2c6", SANS)
    b += f'<circle cx="600" cy="190" r="22" fill="#101113" stroke="#d8d2c6" stroke-width="1.5"/>'
    b += f'<path d="M600,190 l10,-14" stroke="#e8e4da" stroke-width="2.5" stroke-linecap="round"/>'
    b += text(600, 230, "GLIDE", 7, "#d8d2c6", SANS, ls=1.5)
    b += text(W - 44, 226, "walnut end-cheeks · Moog panel idiom", 7, "#8a7660", SANS, anchor="end", style="italic")
    plate("mini-v", W, H, b, "#171310")


if __name__ == "__main__":
    mjuc(); decapitator(); pulsar_mu(); chipsynth_md(); korg_m1()
    spaced_out(); lossy(); xo(); kotelnikov(); span(); mini_v()
