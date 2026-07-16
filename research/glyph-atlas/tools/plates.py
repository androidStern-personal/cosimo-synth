#!/usr/bin/env python3
"""Facsimile glyph-study plates for policy-blocked commercial plugins.

Each plate is a self-contained SVG drawn from documented knowledge of the
interface — a style study of the glyph vocabulary, NOT a screenshot and not
pixel-accurate. Plates are badged as facsimiles by the atlas HTML.
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "plates"
OUT.mkdir(exist_ok=True)

SANS = "Arial, Helvetica, sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"
MONO = "'Courier New', Courier, monospace"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;")


def text(x, y, s, size=11, fill="#eee", font=SANS, ls=0, anchor="middle", weight="normal", style="normal", opacity=1):
    return (f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" fill="{fill}" '
            f'letter-spacing="{ls}" text-anchor="{anchor}" font-weight="{weight}" '
            f'font-style="{style}" opacity="{opacity}">{esc(s)}</text>')


def knob(cx, cy, r, angle_deg=-40, body="#22242a", rim="#111", pointer="#f2f0e6", cap=None, pointer_w=2.5):
    """Rotary knob, pointer at angle_deg (0 = up, positive clockwise)."""
    a = math.radians(angle_deg)
    px, py = cx + (r * 0.72) * math.sin(a), cy - (r * 0.72) * math.cos(a)
    s = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{body}" stroke="{rim}" stroke-width="1.5"/>'
    if cap:
        s += f'<circle cx="{cx}" cy="{cy}" r="{r*0.62}" fill="{cap}"/>'
    s += f'<line x1="{cx}" y1="{cy}" x2="{px:.1f}" y2="{py:.1f}" stroke="{pointer}" stroke-width="{pointer_w}" stroke-linecap="round"/>'
    return s


def ticks(cx, cy, r0, r1, n=11, a0=-135, a1=135, color="#ddd", w=1.4):
    out = []
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / (n - 1))
        out.append(f'<line x1="{cx + r0*math.sin(a):.1f}" y1="{cy - r0*math.cos(a):.1f}" '
                   f'x2="{cx + r1*math.sin(a):.1f}" y2="{cy - r1*math.cos(a):.1f}" '
                   f'stroke="{color}" stroke-width="{w}"/>')
    return "".join(out)


def screw(cx, cy, r=5, tone="#888"):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#scr)" stroke="#333" stroke-width="0.8"/>'
            f'<line x1="{cx-r*0.6}" y1="{cy+r*0.35}" x2="{cx+r*0.6}" y2="{cy-r*0.35}" stroke="#444" stroke-width="1.2"/>')


def led(cx, cy, r=3.5, color="#ff3b30", on=True):
    glow = f'<circle cx="{cx}" cy="{cy}" r="{r*2}" fill="{color}" opacity="0.25"/>' if on else ""
    return glow + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color if on else "#3a1210"}" stroke="#222" stroke-width="0.8"/>'


def toggle(cx, cy, w=16, h=26, up=True, plate="#2a2a2a", lever="#d8d5c8"):
    ly = cy - h * 0.28 if up else cy + h * 0.28
    return (f'<rect x="{cx-w/2}" y="{cy-h/2}" width="{w}" height="{h}" rx="3" fill="{plate}" stroke="#111"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{w*0.32}" fill="#151515"/>'
            f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{ly}" stroke="{lever}" stroke-width="5" stroke-linecap="round"/>')


def wave_path(kind, x, y, w, h, cycles=2):
    """Return an SVG path 'd' for sine/tri/saw/square/noise centred in box."""
    pts = []
    steps = 64
    for i in range(steps + 1):
        t = i / steps
        ph = (t * cycles) % 1.0
        if kind == "sine":
            v = math.sin(t * cycles * 2 * math.pi)
        elif kind == "tri":
            v = 4 * abs(ph - 0.5) - 1
        elif kind == "saw":
            v = 2 * ph - 1
        elif kind == "square":
            v = 1 if ph < 0.5 else -1
        elif kind == "ramp-":
            v = 1 - 2 * ph
        else:
            v = 0
        pts.append((x + t * w, y + h / 2 - v * h / 2 * 0.85))
    if kind == "square":
        d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
        for i in range(1, len(pts)):
            d += f" L{pts[i][0]:.1f},{pts[i-1][1]:.1f} L{pts[i][0]:.1f},{pts[i][1]:.1f}"
        return d
    return "M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in pts)


def vu_meter(cx, cy, w, h, face="#f4ecd4", needle_deg=-18):
    """Classic VU: cream face, black arc scale, red zone, needle from bottom pivot."""
    x0, y0 = cx - w / 2, cy - h / 2
    pivot_y = y0 + h * 1.05
    r_arc = h * 0.78
    def arc_pt(deg, r):
        a = math.radians(deg)
        return (cx + r * math.sin(a), pivot_y - r * math.cos(a))
    a_start, a_red, a_end = -42, 18, 38
    p1, p2 = arc_pt(a_start, r_arc), arc_pt(a_red, r_arc)
    p3 = arc_pt(a_end, r_arc)
    s = f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="4" fill="{face}" stroke="#221d14" stroke-width="2"/>'
    s += (f'<path d="M{p1[0]:.1f},{p1[1]:.1f} A{r_arc},{r_arc} 0 0 1 {p2[0]:.1f},{p2[1]:.1f}" '
          f'fill="none" stroke="#221d14" stroke-width="2"/>')
    s += (f'<path d="M{p2[0]:.1f},{p2[1]:.1f} A{r_arc},{r_arc} 0 0 1 {p3[0]:.1f},{p3[1]:.1f}" '
          f'fill="none" stroke="#a01c14" stroke-width="3"/>')
    for i, deg in enumerate(range(a_start, a_end + 1, 10)):
        q0, q1 = arc_pt(deg, r_arc - 1), arc_pt(deg, r_arc + 5)
        s += f'<line x1="{q0[0]:.1f}" y1="{q0[1]:.1f}" x2="{q1[0]:.1f}" y2="{q1[1]:.1f}" stroke="#221d14" stroke-width="1.3"/>'
    for deg, lab in [(-40, "20"), (-25, "10"), (-12, "5"), (0, "3"), (10, "1"), (18, "0"), (30, "+3")]:
        lx, ly = arc_pt(deg, r_arc + 13)
        s += text(lx, ly + 3, lab, 7.5, "#221d14", SANS, weight="bold")
    n = arc_pt(needle_deg, r_arc + 2)
    s += f'<line x1="{cx}" y1="{pivot_y - h*0.12}" x2="{n[0]:.1f}" y2="{n[1]:.1f}" stroke="#111" stroke-width="2"/>'
    s += text(cx, y0 + h - 8, "VU", 11, "#221d14", SANS, weight="bold")
    return s


def slider_v(cx, cy, h, cap="#4aa3ff", pos=0.6, track="#111"):
    return (f'<rect x="{cx-2}" y="{cy-h/2}" width="4" height="{h}" rx="2" fill="{track}"/>'
            f'<rect x="{cx-11}" y="{cy+h/2 - pos*h - 7}" width="22" height="14" rx="2" fill="{cap}" stroke="#000" stroke-width="0.8"/>'
            f'<line x1="{cx-11}" y1="{cy+h/2 - pos*h}" x2="{cx+11}" y2="{cy+h/2 - pos*h}" stroke="#fff" stroke-width="1.6"/>')


def lcd_text(x, y, s, size=15, color="#ff4a3d", bg=None, w=None, h=None, font=MONO):
    out = ""
    if bg and w and h:
        out += f'<rect x="{x - w/2}" y="{y - h*0.72}" width="{w}" height="{h}" rx="3" fill="{bg}" stroke="#000" stroke-width="1.5"/>'
    out += f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" fill="{color}" text-anchor="middle" letter-spacing="2" font-weight="bold" opacity="0.92">{esc(s)}</text>'
    return out


def plate(name, w, h, body, bg="#101014"):
    defs = ('<defs>'
            '<radialGradient id="scr" cx="35%" cy="30%"><stop offset="0%" stop-color="#c9c9c9"/><stop offset="100%" stop-color="#5f5f5f"/></radialGradient>'
            '<linearGradient id="brush" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0%" stop-color="#d9d9d9"/><stop offset="18%" stop-color="#c3c3c3"/>'
            '<stop offset="50%" stop-color="#cfcfcf"/><stop offset="82%" stop-color="#b7b7b7"/>'
            '<stop offset="100%" stop-color="#a8a8a8"/></linearGradient>'
            '<linearGradient id="navy" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0%" stop-color="#2b3644"/><stop offset="100%" stop-color="#1d2530"/></linearGradient>'
            '<linearGradient id="tapewarm" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0%" stop-color="#3a3733"/><stop offset="100%" stop-color="#26241f"/></linearGradient>'
            '</defs>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
           f'viewBox="0 0 {w} {h}">{defs}<rect width="{w}" height="{h}" fill="{bg}"/>{body}</svg>')
    (OUT / f"{name}.svg").write_text(svg)
    print(name, f"{len(svg)//1024}KB")


# ---------------------------------------------------------------- DIVA (u-he)
def diva():
    W, H = 760, 240
    b = f'<rect x="8" y="8" width="{W-16}" height="{H-16}" rx="6" fill="url(#navy)" stroke="#0c1118" stroke-width="2"/>'
    b += screw(26, 26) + screw(W - 26, 26) + screw(26, H - 26) + screw(W - 26, H - 26)
    b += text(96, 52, "Diva", 40, "#efe9da", SERIF, style="italic", weight="bold")
    b += text(96, 70, "THE SPIRIT OF ANALOGUE", 7.5, "#b9c2cc", SANS, ls=2.2)
    # oscillator section: silkscreen frame, waveform rocker legends
    b += f'<rect x="200" y="34" width="250" height="170" fill="none" stroke="#8f9aa6" stroke-width="1.2" rx="4"/>'
    b += text(325, 28, "MAIN OSCILLATOR", 10, "#e8e2d2", SANS, ls=3)
    b += ticks(265, 110, 34, 40, 13) + knob(265, 110, 28, -55, "#1a222c", "#0a0f16", "#f2f0e6")
    b += text(265, 165, "TUNE", 9, "#e8e2d2", SANS, ls=1.5)
    for i, (kind, xx) in enumerate([("saw", 330), ("square", 370), ("tri", 410)]):
        b += f'<path d="{wave_path(kind, xx-14, 92, 28, 18, 1)}" fill="none" stroke="#e8e2d2" stroke-width="1.6"/>'
        b += toggle(xx, 140, up=(i != 1))
        b += text(xx, 172, ["SAW", "PWM", "TRI"][i], 8, "#b9c2cc", SANS, ls=1)
    b += text(325, 195, "VOLUME  ·  TUNING  ·  SHAPE", 7, "#8f9aa6", SANS, ls=1.5)
    # filter section
    b += f'<rect x="470" y="34" width="264" height="170" fill="none" stroke="#8f9aa6" stroke-width="1.2" rx="4"/>'
    b += text(602, 28, "LADDER FILTER", 10, "#e8e2d2", SANS, ls=3)
    b += ticks(560, 110, 40, 47, 15) + knob(560, 110, 33, 30, "#1a222c", "#0a0f16", "#f2f0e6")
    b += text(560, 172, "FREQUENCY", 9, "#e8e2d2", SANS, ls=1.5)
    b += ticks(662, 110, 26, 31, 9) + knob(662, 110, 21, -10, "#1a222c", "#0a0f16", "#f2f0e6")
    b += text(662, 155, "RESONANCE", 8, "#e8e2d2", SANS, ls=1)
    b += text(662, 185, "24 dB", 8, "#b9c2cc", SANS)
    b += text(W - 30, H - 22, "DINOSAUR IMPERSONATING VIRTUAL ANALOGUE", 6.5, "#7c8894", SANS, ls=1.2, anchor="end")
    plate("diva", W, H, b, "#0d1117")


# ------------------------------------------------------- TAL-U-NO-LX (Juno)
def tal_uno():
    W, H = 760, 230
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="4" fill="#23252a" stroke="#101114" stroke-width="2"/>'
    b += text(30, 40, "TAL-U-NO-LX", 21, "#e9e9ea", SANS, ls=1, anchor="start", weight="bold")
    b += text(30, 58, "VIRTUAL ANALOG SYNTHESIZER", 7, "#9aa0a8", SANS, ls=2.4, anchor="start")
    # Juno color-coded section band
    sections = [("#37b6e9", "LFO", 200, 90), ("#e94f37", "DCO", 290, 150), ("#f2c14e", "HPF", 440, 60), ("#69d25a", "VCF", 500, 150), ("#c9a0ff", "ENV", 650, 84)]
    for color, lab, x0, wds in sections:
        b += f'<rect x="{x0}" y="70" width="{wds}" height="3.5" fill="{color}"/>'
        b += text(x0 + wds / 2, 63, lab, 9, color, SANS, ls=2, weight="bold")
    # sliders with colored caps (Juno idiom)
    for i, (x, cap, pos) in enumerate([(215, "#37b6e9", .62), (255, "#37b6e9", .35),
                                        (310, "#e94f37", .78), (350, "#e94f37", .5), (390, "#e94f37", .5),
                                        (460, "#f2c14e", .3),
                                        (520, "#69d25a", .66), (560, "#69d25a", .44), (600, "#69d25a", .58),
                                        (665, "#c9a0ff", .7), (705, "#c9a0ff", .52)]):
        b += slider_v(x, 130, 88, cap, pos)
    for x, lab in [(215, "RATE"), (255, "DELAY"), (310, "LFO"), (350, "PWM"), (390, "SUB"),
                   (460, "FREQ"), (520, "FREQ"), (560, "RES"), (600, "ENV"), (665, "A"), (705, "R")]:
        b += text(x, 196, lab, 7.5, "#c9ccd2", SANS, ls=1)
    # chorus buttons — Juno signature
    b += f'<rect x="52" y="96" width="46" height="30" rx="3" fill="#2e3138" stroke="#0f1013"/>'
    b += f'<rect x="106" y="96" width="46" height="30" rx="3" fill="#2e3138" stroke="#0f1013"/>'
    b += led(75, 104, 3, "#ffb14a") + led(129, 104, 3, "#552e10", on=False)
    b += text(75, 119, "I", 11, "#e9e9ea", SANS, weight="bold") + text(129, 119, "II", 11, "#e9e9ea", SANS, weight="bold")
    b += text(102, 145, "CHORUS", 8, "#9aa0a8", SANS, ls=2.5)
    b += text(102, 168, "◁ juno 60 voice", 7.5, "#6f7580", SANS)
    plate("tal-u-no-lx", W, H, b, "#141519")


# ------------------------------------------------------------- UAD LA-2A
def la2a():
    W, H = 760, 250
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="5" fill="url(#brush)" stroke="#5c5c5c" stroke-width="2"/>'
    for x, y in [(26, 26), (W - 26, 26), (26, H - 26), (W - 26, H - 26), (W / 2, 26)]:
        b += screw(x, y, 6)
    b += vu_meter(200, 120, 210, 120, needle_deg=-14)
    b += ticks(470, 118, 44, 51, 21, color="#222", w=1.2) + knob(470, 118, 38, 40, "#efe6cc", "#8a7f63", "#3a2f1c", pointer_w=3)
    b += text(470, 186, "PEAK REDUCTION", 9.5, "#1d1a12", SANS, ls=1.5, weight="bold")
    b += ticks(610, 118, 44, 51, 21, color="#222", w=1.2) + knob(610, 118, 38, -30, "#efe6cc", "#8a7f63", "#3a2f1c", pointer_w=3)
    b += text(610, 186, "GAIN", 9.5, "#1d1a12", SANS, ls=2, weight="bold")
    b += toggle(700, 110, 18, 34, up=False, plate="#4a4a4a")
    b += text(700, 76, "LIMIT", 8, "#1d1a12", SANS, weight="bold") + text(700, 152, "COMPRESS", 7, "#1d1a12", SANS, weight="bold")
    b += f'<rect x="112" y="196" width="530" height="30" rx="3" fill="#15130e"/>'
    b += text(377, 216, "T E L E T R O N I X      LA-2A      LEVELING  AMPLIFIER", 11, "#e9dfc4", SERIF, ls=1)
    b += f'<path d="M60,196 l24,15 l-24,15 z" fill="#8c1d18"/>'
    b += text(60, 240, "UNIVERSAL AUDIO", 6.5, "#333", SANS, ls=1.4, anchor="start")
    plate("la2a", W, H, b, "#1a1a1c")


# ---------------------------------------------------- Waves SSL E-Channel
def ssl_echannel():
    W, H = 760, 240
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="3" fill="#b9b4a3" stroke="#6e6a5c" stroke-width="2"/>'
    b += f'<rect x="6" y="6" width="{W-12}" height="34" fill="#8f8a79"/>'
    b += text(30, 28, "SSL 4000 E", 15, "#26241d", SANS, weight="bold", anchor="start", ls=1)
    b += text(W - 30, 28, "E - CHANNEL", 10, "#26241d", SANS, ls=2, anchor="end")
    caps = [("#c03a2b", "HF", "kHz"), ("#2e7d43", "HMF", "kHz"), ("#28527a", "LMF", "kHz"), ("#26241d", "LF", "Hz")]
    for i, (cap, lab, unit) in enumerate(caps):
        cx = 90 + i * 90
        b += ticks(cx, 100, 30, 36, 11, color="#26241d", w=1.1)
        b += knob(cx, 100, 24, [-50, 20, -15, 45][i], "#dedad0", "#4a463a", "#fff", cap=cap)
        b += text(cx, 150, lab, 9, "#26241d", SANS, weight="bold", ls=1)
        b += text(cx, 162, unit, 7, "#4a463a", SANS)
        b += text(cx - 32, 72, "−", 9, "#26241d", SANS) + text(cx + 32, 72, "+", 9, "#26241d", SANS)
    b += f'<rect x="452" y="64" width="120" height="110" rx="4" fill="none" stroke="#26241d" stroke-width="1.4"/>'
    b += text(512, 58, "DYNAMICS", 9, "#26241d", SANS, ls=2, weight="bold")
    b += knob(492, 106, 20, 10, "#dedad0", "#4a463a", "#fff", cap="#c03a2b")
    b += knob(543, 106, 20, -35, "#dedad0", "#4a463a", "#fff", cap="#26241d")
    b += text(492, 140, "RATIO", 7.5, "#26241d", SANS) + text(543, 140, "THRESH", 7.5, "#26241d", SANS)
    b += f'<rect x="470" y="148" width="34" height="16" rx="2" fill="#dedad0" stroke="#4a463a"/>' + led(478, 156, 2.5, "#d8b40a")
    b += text(492, 159.5, "IN", 7, "#26241d", SANS)
    b += f'<rect x="596" y="64" width="130" height="110" rx="4" fill="none" stroke="#26241d" stroke-width="1.4"/>'
    b += text(661, 58, "ROUTING", 9, "#26241d", SANS, ls=2, weight="bold")
    for j, lab in enumerate(["FLT ▸ DYN", "SPLIT", "DYN S-C"]):
        yy = 84 + j * 28
        b += f'<rect x="612" y="{yy}" width="14" height="14" rx="2" fill="#dedad0" stroke="#4a463a"/>'
        b += (f'<rect x="614.5" y="{yy+2.5}" width="9" height="9" fill="#2e7d43"/>' if j == 1 else "")
        b += text(636, yy + 11, lab, 8, "#26241d", SANS, anchor="start")
    b += text(30, 208, "DYN  •  FILTERS  •  EQ  •  OUTPUT", 8, "#4a463a", SANS, ls=2, anchor="start")
    b += text(W - 30, 208, "console silkscreen · colour-coded caps", 7.5, "#6e6a5c", SANS, anchor="end", style="italic")
    plate("ssl-e-channel", W, H, b, "#17171a")


# ------------------------------------------------------- D16 Nepheton (808)
def nepheton():
    W, H = 760, 250
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="5" fill="#181614" stroke="#000" stroke-width="2"/>'
    b += f'<rect x="6" y="6" width="{W-12}" height="40" fill="#242020"/>'
    b += text(30, 32, "NEPHETON", 17, "#f2ede4", SANS, weight="bold", anchor="start", ls=3)
    b += text(230, 32, "Rhythm Composer", 11, "#c8402a", SERIF, style="italic", anchor="start")
    b += text(W - 30, 32, "COMPUTER CONTROLLED", 7.5, "#8d867c", SANS, ls=2.4, anchor="end")
    # instrument knob rows: level knobs with 808 cream caps
    for i, lab in enumerate(["BD", "SD", "LT", "MT", "HT", "RS", "HC", "OH", "CH", "CY"]):
        cx = 62 + i * 70
        b += ticks(cx, 92, 22, 26, 11, color="#8d867c", w=1)
        b += knob(cx, 92, 17, [-60, -20, 15, 40, -35, 0, 25, -50, 10, 55][i], "#0d0c0b", "#000", "#f2ede4")
        b += text(cx, 130, lab, 9, "#f2ede4", SANS, weight="bold", ls=1)
        b += text(cx, 141, "LEVEL", 6, "#8d867c", SANS, ls=1)
    # 16-step button row in 808 quad colours
    cols = ["#c8402a"] * 4 + ["#d9782d"] * 4 + ["#e3c53a"] * 4 + ["#efe9dc"] * 4
    for i, c in enumerate(cols):
        x0 = 40 + i * 43
        b += f'<rect x="{x0}" y="170" width="34" height="46" rx="3" fill="{c}" stroke="#000" stroke-width="1.4"/>'
        b += f'<rect x="{x0}" y="170" width="34" height="10" rx="3" fill="#fff" opacity="0.18"/>'
        b += led(x0 + 17, 162, 3, "#ff5533", on=(i % 4 == 0))
        b += text(x0 + 17, 232, str(i + 1), 7, "#8d867c", SANS)
    plate("nepheton", W, H, b, "#100f0e")


# ---------------------------------------------------------- Softube Tape
def softube_tape():
    W, H = 760, 240
    b = f'<rect x="6" y="6" width="{W-12}" height="{H-12}" rx="6" fill="url(#tapewarm)" stroke="#141210" stroke-width="2"/>'
    b += text(34, 44, "TAPE", 26, "#efe7d6", SANS, weight="bold", anchor="start", ls=6)
    b += text(34, 62, "SOFTUBE", 8, "#9a9184", SANS, ls=4, anchor="start")
    # twin tape reels with spokes
    for rx in (140, 262):
        b += f'<circle cx="{rx}" cy="130" r="50" fill="#14120f" stroke="#5c554a" stroke-width="2.5"/>'
        for k in range(3):
            a = math.radians(k * 60 + 15)
            b += (f'<line x1="{rx - 38*math.cos(a):.1f}" y1="{130 - 38*math.sin(a):.1f}" '
                  f'x2="{rx + 38*math.cos(a):.1f}" y2="{130 + 38*math.sin(a):.1f}" stroke="#3b362e" stroke-width="7"/>')
        b += f'<circle cx="{rx}" cy="130" r="13" fill="#282420" stroke="#5c554a" stroke-width="1.5"/>'
    b += f'<path d="M140,180 Q201,196 262,180" fill="none" stroke="#6b6154" stroke-width="3"/>'
    # machine type selector — Tape signature
    for i, lab in enumerate(["A", "B", "C"]):
        x0 = 370 + i * 64
        on = i == 0
        b += (f'<rect x="{x0}" y="86" width="52" height="40" rx="4" fill="{"#e8dcbf" if on else "#242019"}" '
              f'stroke="#0f0d0a" stroke-width="1.5" opacity="{1 if on else 0.9}"/>')
        b += text(x0 + 26, 112, lab, 16, "#1d1a12" if on else "#8a8072", SANS, weight="bold")
    b += text(466, 148, "TAPE  TYPE", 8.5, "#9a9184", SANS, ls=3)
    b += ticks(640, 120, 40, 47, 11, color="#9a9184", w=1.2)
    b += knob(640, 120, 32, 25, "#efe7d6", "#8a8072", "#3a3229", pointer_w=3)
    b += text(640, 182, "AMOUNT", 9, "#efe7d6", SANS, ls=2)
    b += text(370, 205, "machine models A / B / C · switchable transport", 8, "#6b6154", SANS, anchor="start", style="italic")
    plate("softube-tape", W, H, b)


# ------------------------------------------------------ FabFilter Pro-Q 4
def proq4():
    W, H = 760, 250
    b = ""
    for gx in range(40, W, 60):
        b += f'<line x1="{gx}" y1="30" x2="{gx}" y2="190" stroke="#232830" stroke-width="1"/>'
    for gy in range(30, 200, 32):
        b += f'<line x1="20" y1="{gy}" x2="{W-20}" y2="{gy}" stroke="#232830" stroke-width="1"/>'
    b += f'<line x1="20" y1="110" x2="{W-20}" y2="110" stroke="#39414d" stroke-width="1.4"/>'
    # spectrum ghost
    spec = "M20,190 " + " ".join(f"L{20 + i*(W-40)/48:.0f},{190 - 60*math.exp(-((i-12)/14)**2) - 40*math.exp(-((i-30)/8)**2) - (8 if i%3 else 16):.0f}" for i in range(49)) + f" L{W-20},190 Z"
    b += f'<path d="{spec}" fill="#2a313c" opacity="0.5"/>'
    # yellow bell band + blue shelf
    bell = f"M20,110 L60,110 " + " ".join(f"C{200},110 {230},52 {300},52 C{370},52 {400},110 {540},110" for _ in range(1)) + f" L{W-20},110"
    b += f'<path d="{bell}" fill="none" stroke="#e8c33a" stroke-width="2.5"/>'
    b += f'<path d="M20,110 C160,110 480,110 560,110 C640,110 660,88 {W-20},88" fill="none" stroke="#4aa3e8" stroke-width="2"/>'
    b += f'<circle cx="300" cy="52" r="7" fill="#e8c33a"/><text x="300" y="56" font-family="{SANS}" font-size="8" fill="#16191e" text-anchor="middle" font-weight="bold">1</text>'
    b += f'<circle cx="660" cy="88" r="7" fill="#4aa3e8"/><text x="660" y="92" font-family="{SANS}" font-size="8" fill="#16191e" text-anchor="middle" font-weight="bold">2</text>'
    # band-shape icon strip (FabFilter idiom)
    shapes = {
        "bell": "M2,14 C7,14 8,4 12,4 C16,4 17,14 22,14",
        "loshelf": "M2,16 L8,16 C13,16 14,7 22,7",
        "hishelf": "M2,7 C10,7 11,16 16,16 L22,16",
        "notch": "M2,6 C8,6 9,16 12,16 C15,16 16,6 22,6",
        "locut": "M4,18 L14,6 L22,6",
        "hicut": "M2,6 L10,6 L20,18",
        "tilt": "M3,15 L21,7",
    }
    for i, (k, d) in enumerate(shapes.items()):
        x0 = 226 + i * 46
        b += f'<rect x="{x0}" y="203" width="34" height="26" rx="4" fill="{"#2c3440" if i==0 else "#1b2028"}" stroke="#39414d" stroke-width="1"/>'
        b += f'<g transform="translate({x0+5},{206})"><path d="{d}" fill="none" stroke="{"#e8c33a" if i==0 else "#9fb0c4"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>'
    b += text(30, 222, "Pro-Q 4", 15, "#e6ebf2", SANS, anchor="start", weight="bold")
    b += text(30, 236, "FabFilter", 8.5, "#8494a8", SANS, anchor="start", ls=1)
    # piano strip fragment
    for i in range(24):
        x0 = 600 + i * 6
        black = i % 12 in (1, 3, 6, 8, 10)
        b += f'<rect x="{x0}" y="206" width="5" height="22" fill="{"#0c0e12" if black else "#d7dde6"}" stroke="#39414d" stroke-width="0.4"/>'
    plate("pro-q4", W, H, b, "#16191e")


# ------------------------------------------------- Valhalla VintageVerb
def vintageverb():
    W, H = 760, 240
    teal = "#3d8a99"
    b = f'<rect width="{W}" height="{H}" fill="{teal}"/>'
    b += f'<rect x="0" y="0" width="{W}" height="54" fill="#347885"/>'
    b += text(24, 34, "ValhallaVintageVerb", 21, "#eef4f4", SANS, anchor="start", weight="bold", ls=0.5)
    b += text(W - 24, 34, "valhalladsp.com", 9, "#bfd8dc", SANS, anchor="end", ls=1)
    for i, (lab, ang) in enumerate([("MIX", -30), ("PREDELAY", -60), ("DECAY", 15), ("SIZE", 40), ("ATTACK", -15), ("DAMPEN", 60)]):
        cx = 80 + i * 120
        b += f'<circle cx="{cx}" cy="120" r="34" fill="#e9f1f1"/>'
        a = math.radians(ang)
        b += f'<line x1="{cx}" y1="120" x2="{cx + 24*math.sin(a):.1f}" y2="{120 - 24*math.cos(a):.1f}" stroke="{teal}" stroke-width="4" stroke-linecap="round"/>'
        b += text(cx, 172, lab, 9.5, "#eef4f4", SANS, ls=2)
    b += text(24, 210, "REVERB MODE", 8, "#bfd8dc", SANS, anchor="start", ls=2)
    b += text(24, 226, "Concert Hall ▾", 12, "#eef4f4", SANS, anchor="start")
    b += text(W - 24, 210, "COLOR", 8, "#bfd8dc", SANS, anchor="end", ls=2)
    b += text(W - 24, 226, "1970s   1980s   NOW", 11, "#eef4f4", SANS, anchor="end", ls=1)
    b += f'<rect x="{W-24-142}" y="216" width="46" height="13" rx="2" fill="none" stroke="#eef4f4" stroke-width="1.2"/>'
    plate("vintageverb", W, H, b, teal)


# ---------------------------------------------- Kilohearts Phase Plant
def phase_plant():
    W, H = 760, 240
    b = f'<rect width="{W}" height="{H}" fill="#25272b"/>'
    b += f'<path d="M40,36 l0,-20 M40,36 l17,10 M40,36 l-17,10 M40,16 l-8,-5 M40,16 l8,-5 M57,46 l0,10 M57,46 l9,-6 M23,46 l0,10 M23,46 l-9,-6" stroke="#e8eaee" stroke-width="3" fill="none" stroke-linecap="round"/>'
    b += text(80, 34, "PHASE PLANT", 16, "#e8eaee", SANS, anchor="start", weight="bold", ls=3)
    b += text(80, 50, "KILOHEARTS", 8, "#8a8f99", SANS, anchor="start", ls=4)
    gens = [("ANALOG", "saw"), ("WAVETABLE", "sine"), ("NOISE", None), ("SAMPLE", None)]
    for i, (lab, wk) in enumerate(gens):
        y0 = 76 + i * 38
        b += f'<rect x="40" y="{y0}" width="300" height="30" rx="4" fill="#2d3036" stroke="#3a3e46" stroke-width="1"/>'
        if wk:
            b += f'<path d="{wave_path(wk, 52, y0+7, 30, 16, 2)}" fill="none" stroke="#62d2a2" stroke-width="1.8"/>'
        elif lab == "NOISE":
            import random
            random.seed(4)
            pts = " ".join(f"L{52+j*2.3:.0f},{y0+15 + random.uniform(-7,7):.0f}" for j in range(14))
            b += f'<path d="M52,{y0+15} {pts}" fill="none" stroke="#62d2a2" stroke-width="1.5"/>'
        else:
            b += f'<path d="M54,{y0+22} l6,-12 l5,8 l4,-6 l6,10" fill="none" stroke="#62d2a2" stroke-width="1.8" stroke-linejoin="round"/><rect x="52" y="{y0+6}" width="26" height="18" fill="none" stroke="#62d2a2" stroke-width="1"/>'
        b += text(92, y0 + 20, lab, 10, "#c9ced8", SANS, anchor="start", ls=2)
        b += text(330, y0 + 20, "▾", 9, "#8a8f99", SANS, anchor="end")
    # snapin chain (Kilohearts ecosystem glyphs)
    for i, lab in enumerate(["DISTORTION", "FILTER", "DELAY", "REVERB"]):
        x0 = 420 + (i % 2) * 160
        y0 = 90 + (i // 2) * 64
        b += f'<rect x="{x0}" y="{y0}" width="140" height="48" rx="6" fill="#2d3036" stroke="#3a3e46"/>'
        icon = {
            "DISTORTION": f'<path d="M{x0+18},{y0+32} L{x0+26},{y0+14} L{x0+34},{y0+32}" fill="none" stroke="#e8a04c" stroke-width="2.2" stroke-linejoin="round"/>',
            "FILTER": f'<path d="M{x0+16},{y0+18} L{x0+30},{y0+18} L{x0+38},{y0+32}" fill="none" stroke="#5aa7e8" stroke-width="2.2"/>',
            "DELAY": f'<circle cx="{x0+22}" cy="{y0+24}" r="8" fill="none" stroke="#c78ae8" stroke-width="2"/><circle cx="{x0+34}" cy="{y0+24}" r="4" fill="none" stroke="#c78ae8" stroke-width="1.5" opacity="0.6"/>',
            "REVERB": f'<path d="M{x0+16},{y0+30} q8,-18 12,0 q6,-12 10,0" fill="none" stroke="#62d2a2" stroke-width="2"/>',
        }[lab]
        b += icon + text(x0 + 52, y0 + 28, lab, 8.5, "#c9ced8", SANS, anchor="start", ls=1.5)
    plate("phase-plant", W, H, b, "#1e2023")


# ----------------------------------------------------------- Xfer Serum 2
def serum2():
    W, H = 760, 250
    b = f'<rect width="{W}" height="{H}" fill="#1b1d21"/>'
    b += f'<rect x="0" y="0" width="{W}" height="34" fill="#26292f"/>'
    for i, tabb in enumerate(["OSC", "MIX", "FX", "MATRIX", "GLOBAL"]):
        x0 = 24 + i * 78
        b += f'<rect x="{x0}" y="7" width="66" height="21" rx="3" fill="{"#3b4d66" if i==0 else "#1f2227"}" stroke="#0e0f12"/>'
        b += text(x0 + 33, 21, tabb, 9, "#cfe0f2" if i == 0 else "#7c8697", SANS, ls=1.5)
    b += text(W - 24, 22, "SERUM 2", 14, "#69b7f2", SANS, anchor="end", weight="bold", ls=3)
    # wavetable 3D stack — Serum signature
    b += f'<rect x="40" y="58" width="330" height="150" rx="4" fill="#131417" stroke="#2c3038"/>'
    for k in range(6):
        t = k / 5
        y_off = 182 - t * 100
        x_off = 58 + t * 30
        wpath = wave_path("sine" if k % 2 else "saw", x_off, y_off - 15, 230, 30, 2 + (k % 2))
        op = 0.25 + t * 0.75
        col = "#3fa9f5" if k < 5 else "#8fd0ff"
        b += f'<path d="{wpath}" fill="none" stroke="{col}" stroke-width="{1.1 + t*1.3:.1f}" opacity="{op:.2f}"/>'
    b += text(205, 224, "WT POS", 8, "#7c8697", SANS, ls=2)
    b += f'<circle cx="285" cy="222" r="9" fill="none" stroke="#3fa9f5" stroke-width="2"/><line x1="285" y1="222" x2="290" y2="215" stroke="#3fa9f5" stroke-width="2"/>'
    # right: unison / detune micro block
    for i, (lab, val) in enumerate([("UNISON", "7"), ("DETUNE", "0.18"), ("BLEND", "0.62"), ("PHASE", "RND")]):
        y0 = 70 + i * 36
        b += text(420, y0 + 4, lab, 8.5, "#7c8697", SANS, anchor="start", ls=2)
        b += f'<rect x="500" y="{y0-10}" width="70" height="20" rx="3" fill="#26292f" stroke="#3a3f49"/>'
        b += text(535, y0 + 4, val, 10, "#cfe0f2", MONO)
    b += ticks(660, 120, 34, 40, 11, color="#4a5160", w=1.2)
    b += knob(660, 120, 27, 65, "#26292f", "#0e0f12", "#69b7f2")
    b += text(660, 175, "MORPH", 9, "#cfe0f2", SANS, ls=2)
    b += text(660, 208, "wavetable position", 7.5, "#5c6474", SANS, style="italic")
    plate("serum2", W, H, b, "#131417")


# ------------------------------------------------- Spectrasonics Omnisphere
def omnisphere():
    W, H = 760, 250
    b = f'<rect width="{W}" height="{H}" fill="#0b0e16"/>'
    b += f'<ellipse cx="{W/2}" cy="200" rx="360" ry="90" fill="#101828" opacity="0.7"/>'
    # glowing orb
    b += ('<defs><radialGradient id="orb" cx="42%" cy="38%">'
          '<stop offset="0%" stop-color="#cfeaff"/><stop offset="35%" stop-color="#5fb0e8"/>'
          '<stop offset="75%" stop-color="#173a5e"/><stop offset="100%" stop-color="#0b1526"/>'
          '</radialGradient></defs>')
    b += f'<circle cx="130" cy="120" r="64" fill="url(#orb)"/>'
    b += f'<ellipse cx="130" cy="120" rx="88" ry="26" fill="none" stroke="#3f7fb8" stroke-width="1.5" opacity="0.8" transform="rotate(-18 130 120)"/>'
    b += f'<circle cx="130" cy="120" r="64" fill="none" stroke="#7fc4f2" stroke-width="1" opacity="0.5"/>'
    b += text(240, 96, "OMNISPHERE", 25, "#dfeaf5", SANS, anchor="start", ls=7)
    b += text(240, 116, "POWER  SYNTH", 9, "#6f87a3", SANS, anchor="start", ls=6)
    for i, tabb in enumerate(["MAIN", "EDIT", "FX", "ARP", "ORB"]):
        x0 = 240 + i * 78
        b += f'<rect x="{x0}" y="136" width="66" height="22" rx="11" fill="{"#1d3654" if i==4 else "#131c2b"}" stroke="#2a4463" stroke-width="1"/>'
        b += text(x0 + 33, 151, tabb, 9, "#bcd2e8" if i == 4 else "#5f7893", SANS, ls=2)
    b += f'<rect x="240" y="178" width="456" height="30" rx="4" fill="#0f1624" stroke="#243a57"/>'
    b += text(256, 197, "◆  Luminous Strings — Aurora", 11, "#9fc4e8", SANS, anchor="start")
    b += text(680, 197, "▸", 12, "#5f7893", SANS, anchor="end")
    b += text(240, 232, "STEAM  ENGINE", 7, "#44586f", SANS, anchor="start", ls=4)
    plate("omnisphere", W, H, b, "#0b0e16")


# ------------------------------------------------------------ Output Portal
def portal():
    W, H = 760, 250
    b = f'<rect width="{W}" height="{H}" fill="#0d0f14"/>'
    b += ('<defs><radialGradient id="pring" cx="50%" cy="50%">'
          '<stop offset="70%" stop-color="#0d0f14" stop-opacity="0"/>'
          '<stop offset="86%" stop-color="#28c8c8"/><stop offset="100%" stop-color="#0d0f14" stop-opacity="0"/>'
          '</radialGradient><radialGradient id="pring2" cx="50%" cy="50%">'
          '<stop offset="70%" stop-color="#0d0f14" stop-opacity="0"/>'
          '<stop offset="86%" stop-color="#e8734a"/><stop offset="100%" stop-color="#0d0f14" stop-opacity="0"/>'
          '</radialGradient></defs>')
    for cx, grad, r in [(220, "pring", 88), (540, "pring2", 88)]:
        b += f'<circle cx="{cx}" cy="128" r="{r}" fill="url(#{grad})"/>'
        b += f'<circle cx="{cx}" cy="128" r="{r*0.74}" fill="none" stroke="{"#28c8c8" if grad=="pring" else "#e8734a"}" stroke-width="2.5"/>'
        b += f'<circle cx="{cx}" cy="128" r="{r*0.74}" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.4"/>'
        for k in range(24):
            a = math.radians(k * 15)
            r0, r1 = r * 0.80, r * 0.88
            b += (f'<line x1="{cx + r0*math.sin(a):.1f}" y1="{128 - r0*math.cos(a):.1f}" '
                  f'x2="{cx + r1*math.sin(a):.1f}" y2="{128 - r1*math.cos(a):.1f}" stroke="#5a6272" stroke-width="1" opacity="0.7"/>')
    b += f'<line x1="220" y1="128" x2="252" y2="86" stroke="#28c8c8" stroke-width="2.5" stroke-linecap="round"/>'
    b += f'<line x1="540" y1="128" x2="510" y2="170" stroke="#e8734a" stroke-width="2.5" stroke-linecap="round"/>'
    b += text(220, 236, "WARP", 9, "#7d8698", SANS, ls=4) + text(540, 236, "GRAIN SIZE", 9, "#7d8698", SANS, ls=4)
    b += text(682, 60, "PORTAL", 17, "#e8ecf2", SANS, ls=8)
    b += text(682, 78, "OUTPUT", 8, "#7d8698", SANS, ls=5)
    b += f'<path d="M660,96 l14,8 l-14,8 z" fill="#28c8c8"/>'
    b += text(694, 108, "granular", 8, "#4d5462", SANS, style="italic")
    plate("portal", W, H, b, "#0d0f14")


# -------------------------------------------------------- iZotope Ozone 11
def ozone11():
    W, H = 760, 240
    b = f'<rect width="{W}" height="{H}" fill="#14161b"/>'
    spec = "M30,190 " + " ".join(f"L{30 + i*(W-60)/60:.0f},{190 - 70*math.exp(-((i-16)/16)**2) - 45*math.exp(-((i-40)/10)**2)*(0.7 + 0.3*math.sin(i)):.0f}" for i in range(61)) + f" L{W-30},190 Z"
    b += ('<defs><linearGradient id="ozg" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0%" stop-color="#38b6e8" stop-opacity="0.85"/>'
          '<stop offset="100%" stop-color="#1a3d5c" stop-opacity="0.25"/></linearGradient></defs>')
    b += f'<path d="{spec}" fill="url(#ozg)"/>'
    b += f'<path d="M30,132 C180,120 300,96 420,101 C540,106 640,88 730,92" fill="none" stroke="#e8ecf2" stroke-width="2"/>'
    b += text(30, 34, "Ozone 11", 17, "#e8ecf2", SANS, anchor="start", weight="bold")
    b += text(140, 34, "Mastering", 10, "#7a8698", SANS, anchor="start")
    mods = [("EQ", "M4,16 C9,16 9,6 13,6 C17,6 17,16 22,16"),
            ("DYN", "M4,18 L11,18 L15,6 L22,6"),
            ("IMG", "M13,4 L13,20 M6,9 q7,-6 14,0 M8,15 q5,-4 10,0"),
            ("MAX", "M4,18 L10,8 L14,12 L22,4")]
    for i, (lab, icon) in enumerate(mods):
        x0 = 420 + i * 82
        b += f'<rect x="{x0}" y="16" width="70" height="30" rx="15" fill="{"#22405c" if i==3 else "#1b2129"}" stroke="#2e3948" stroke-width="1"/>'
        b += f'<g transform="translate({x0+8},{20})"><path d="{icon}" fill="none" stroke="{"#5fc6f2" if i==3 else "#8fa2b8"}" stroke-width="1.8" stroke-linecap="round"/></g>'
        b += text(x0 + 46, 36, lab, 9, "#c8d4e2" if i == 3 else "#7a8698", SANS, ls=1.5)
    b += f'<rect x="30" y="204" width="{W-60}" height="10" rx="5" fill="#1b2129"/>'
    b += f'<rect x="30" y="204" width="420" height="10" rx="5" fill="#38b6e8" opacity="0.75"/>'
    b += text(30, 230, "-14.2 LUFS", 9, "#8fa2b8", MONO, anchor="start")
    b += text(W - 30, 230, "TRUE PEAK  -1.0 dB", 9, "#8fa2b8", MONO, anchor="end")
    plate("ozone11", W, H, b, "#14161b")


# ------------------------------------------------------- Arturia Pigments
def pigments():
    W, H = 760, 250
    b = f'<rect width="{W}" height="{H}" fill="#17181c"/>'
    b += ('<defs><linearGradient id="pgrad" x1="0" y1="0" x2="1" y2="0">'
          '<stop offset="0%" stop-color="#e8443f"/><stop offset="50%" stop-color="#e88a2e"/>'
          '<stop offset="100%" stop-color="#31b8c4"/></linearGradient></defs>')
    b += f'<circle cx="52" cy="40" r="15" fill="#e8443f"/><circle cx="66" cy="40" r="15" fill="#31b8c4" opacity="0.85"/>'
    b += text(96, 46, "PIGMENTS", 17, "#eceef2", SANS, anchor="start", ls=4, weight="bold")
    for i, tabb in enumerate(["SYNTH", "FX", "SEQ"]):
        x0 = 320 + i * 92
        b += text(x0, 44, tabb, 11, "#eceef2" if i == 0 else "#616876", SANS, ls=3)
        if i == 0:
            b += f'<rect x="{x0-34}" y="52" width="68" height="3" fill="url(#pgrad)"/>'
    b += text(W - 30, 44, "A R T U R I A", 9, "#8a91a0", SANS, anchor="end", ls=2)
    # knob with modulation ring arcs — Pigments signature
    for i, (lab, col, frac) in enumerate([("CUTOFF", "#31b8c4", 0.66), ("RESONANCE", "#e88a2e", 0.4), ("MORPH", "#c05ae8", 0.8)]):
        cx = 120 + i * 150
        r = 36
        b += knob(cx, 140, 26, -140 + 280 * frac, "#24262c", "#0d0e11", "#eceef2")
        circ = 2 * math.pi * r
        b += (f'<circle cx="{cx}" cy="140" r="{r}" fill="none" stroke="#2c2f37" stroke-width="4"/>'
              f'<circle cx="{cx}" cy="140" r="{r}" fill="none" stroke="{col}" stroke-width="4" '
              f'stroke-dasharray="{circ*frac*0.75:.1f} {circ:.1f}" stroke-linecap="round" '
              f'transform="rotate(135 {cx} 140)"/>')
        b += f'<circle cx="{cx + (r+9)*math.sin(math.radians(60)):.1f}" cy="{140 - (r+9)*math.cos(math.radians(60)):.1f}" r="3.5" fill="{col}"/>'
        b += text(cx, 202, lab, 9, "#aeb6c4", SANS, ls=2)
    # gradient waveform field
    b += f'<rect x="520" y="80" width="210" height="130" rx="6" fill="#101116" stroke="#2c2f37"/>'
    b += f'<path d="{wave_path("sine", 535, 110, 180, 70, 3)}" fill="none" stroke="url(#pgrad)" stroke-width="2.5"/>'
    b += text(625, 226, "WAVETABLE", 8, "#616876", SANS, ls=3)
    plate("pigments", W, H, b, "#17181c")


# --------------------------------------------------------- NI Massive X
def massive_x():
    W, H = 760, 240
    b = f'<rect width="{W}" height="{H}" fill="#2e2e30"/>'
    b += f'<rect x="0" y="0" width="{W}" height="44" fill="#242426"/>'
    b += f'<path d="M28,12 l9,10 l9,-10 M28,32 l9,-10 l9,10" stroke="#e85d3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    b += text(60, 28, "MASSIVE X", 14, "#d8d8da", SANS, anchor="start", ls=3, weight="bold")
    b += text(W - 24, 28, "NATIVE INSTRUMENTS", 8, "#77777c", SANS, anchor="end", ls=2.5)
    b += f'<rect x="30" y="64" width="300" height="120" rx="3" fill="#1d1d1f" stroke="#3c3c40"/>'
    b += f'<path d="{wave_path("saw", 44, 96, 272, 54, 6)}" fill="none" stroke="#e8e8ea" stroke-width="1.4"/>'
    b += text(44, 176, "WAVETABLE — GORILLA", 7.5, "#77777c", SANS, anchor="start", ls=2)
    for i, lab in enumerate(["PHASE", "WT POS", "AUX"]):
        cx = 380 + i * 70
        b += knob(cx, 100, 22, [-20, 40, 0][i], "#3a3a3e", "#141416", "#e8e8ea")
        b += text(cx, 140, lab, 8, "#a8a8ac", SANS, ls=1.5)
    # routing dot matrix
    for r_ in range(3):
        for c_ in range(6):
            on = (r_ * 6 + c_) % 4 == 0
            b += f'<circle cx="{380 + c_*34}" cy="{170 + r_*22}" r="{5 if on else 3}" fill="{"#e85d3a" if on else "#4a4a4e"}"/>'
    b += text(620, 226, "modulation routing", 8, "#77777c", SANS, anchor="start", style="italic")
    plate("massive-x", W, H, b, "#242426")


if __name__ == "__main__":
    diva(); tal_uno(); la2a(); ssl_echannel(); nepheton(); softube_tape()
    proq4(); vintageverb(); phase_plant(); serum2(); omnisphere(); portal(); ozone11(); pigments(); massive_x()
