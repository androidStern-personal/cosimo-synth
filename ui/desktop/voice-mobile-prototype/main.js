// PROTOTYPE — four throwaway mobile Voice layouts, switchable with ?variant=A|B|C|D.

const VARIANTS = {
    A: {
        name: "Visual + quick deck",
        thesis: "Keep one meaningful wavetable graphic, then place the five most-used oscillator moves directly beneath it.",
        direct: "Wavetable, Index, Warp, Level, Voices, Detune, Filter cutoff/Q",
        tradeoff: "Only the selected oscillator is visible; tuning and advanced unison remain in drawers.",
    },
    B: {
        name: "Control-first board",
        thesis: "Reduce the graphic to a live thumbnail and spend the first screen on a dense, labeled sound-design board.",
        direct: "Index, Warp, Level, Cutoff, tuning, Pan, Voices, Detune, Width, Play mode, Glide",
        tradeoff: "Much more is reachable immediately, but the voice surface reads more like an editor than an instrument.",
    },
    C: {
        name: "Three-oscillator mixer",
        thesis: "Treat Voice as one edge-to-edge instrument surface: three flat oscillator rows with only functional separators.",
        direct: "Per A/B/C: on/off letter, semitone, voices, wavetable, Warp mode, Solo, plus five named control pages",
        tradeoff: "The denser surface gives every pixel a job; separation now depends on rhythm and dividers rather than cards.",
    },
    D: {
        name: "Tabbed oscillator focus",
        thesis: "Use letter-only A/B/C tabs and Ableton-dense inline readouts; bottom-edge rails preserve base/modulation context and a fixed top-center HUD expands the active parameter into the FX dual-ring knob.",
        direct: "Selected oscillator: tab power, semitone, voices, wavetable strip, Warp mode, Solo, five numeric control pages, base/mod rails, X-base/Y-mod steering, fixed top-center HUD",
        tradeoff: "The compact row buys space, but range detail becomes transient during drag and cross-oscillator comparison still requires switching tabs.",
    },
};

const tableNames = ["Analog Stack", "Glass Choir", "Juno Saw", "PWM Drift", "Vox Hollow"];
const warpModes = ["Off", "Bend +/-", "PWM", "Asym +/-", "Mirror"];
const playModes = ["Poly", "Mono", "Legato"];
const filterModes = ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"];
const detuneModes = ["Linear", "Super", "Exp", "Inv", "Random"];
const stackModes = ["Off", "12", "12+7", "Center-12", "Center-24"];
const oscillatorControlPageNames = ["Shape", "Tune", "Unison", "Phase", "Modes"];
const mockModulationSource = { name: "MSEG 1", accent: "#f46bd9" };
const initialModulationDepths = {
    index: 0.16,
    warp: 0.22,
    level: 0.13,
    detune: 0.2,
    tune: 0.18,
    pan: 0.24,
    blend: 0.15,
    width: 0.2,
    wtSpread: 0.18,
    warpSpread: 0.12,
    phase: 0.16,
    random: 0.2,
};

const initialOscillator = (index) => ({
    table: tableNames[index],
    index: [0.38, 0.61, 0.18][index],
    warpMode: index === 1 ? 2 : 1,
    warp: [0.22, 0.46, 0.08][index],
    pan: [-0.22, 0.18, 0][index],
    octave: index === 2 ? -1 : 0,
    semitone: index === 1 ? 7 : 0,
    fine: [0, -7, 4][index],
    level: [-7.8, -12.4, -16.2][index],
    mute: false,
    solo: false,
    voices: [4, 3, 1][index],
    detune: [0.26, 0.14, 0.1][index],
    blend: 0.75,
    width: [0.88, 0.72, 0.55][index],
    phase: 0,
    random: [0.12, 0.28, 0][index],
    phaseMode: 1,
    detuneMode: index === 0 ? 1 : 0,
    stackMode: 0,
    wtSpread: [0.18, 0.34, 0][index],
    warpSpread: [0.09, 0.2, 0][index],
});

const state = {
    selectedOscillator: "A",
    oscillators: {
        A: initialOscillator(0),
        B: initialOscillator(1),
        C: initialOscillator(2),
    },
    playMode: 0,
    glide: 0.08,
    filterMode: 1,
    cutoff: 1240,
    resonance: 0.78,
    controlPageByOscillator: { A: 0, B: 0, C: 0 },
    modulationDepthByOscillator: {
        A: { ...initialModulationDepths },
        B: { ...initialModulationDepths, tune: 0.12, width: 0.28 },
        C: { ...initialModulationDepths, tune: 0.08, index: 0.24 },
    },
    pageTransition: null,
};

const app = document.querySelector("#app");

function activeVariant() {
    const requested = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
    return requested && VARIANTS[requested] ? requested : "A";
}

function formatPercent(value) {
    return `${Math.round(Number(value) * 100)}%`;
}

function formatSignedPercent(value) {
    const percent = Math.round(Number(value) * 100);
    return percent === 0 ? "C" : `${percent > 0 ? "+" : ""}${percent}`;
}

function formatCutoff(value) {
    const numeric = Number(value);
    return numeric >= 1000 ? `${(numeric / 1000).toFixed(numeric >= 10_000 ? 1 : 2)}k` : `${Math.round(numeric)}`;
}

function formatFor(key, value) {
    switch (key) {
        case "index": return Number(value).toFixed(3);
        case "warp":
        case "blend":
        case "width":
        case "phase":
        case "random":
        case "wtSpread":
        case "warpSpread": return formatPercent(value);
        case "pan": return formatSignedPercent(value);
        case "octave": return `${Number(value) > 0 ? "+" : ""}${Math.round(value)} oct`;
        case "semitone": return `${Number(value) > 0 ? "+" : ""}${Math.round(value)} st`;
        case "fine": return `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(0)} ct`;
        case "level": return `${Number(value).toFixed(1)} dB`;
        case "voices": return `${Math.round(value)}x`;
        case "detune": return `${Math.round(Number(value) * 50)} ct`;
        case "cutoff": return `${formatCutoff(value)} Hz`;
        case "resonance": return Number(value).toFixed(2);
        case "glide": return `${Number(value).toFixed(3)} s`;
        default: return String(value);
    }
}

function valueFor(key, oscillatorID = state.selectedOscillator) {
    return key in state ? state[key] : state.oscillators[oscillatorID][key];
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function modulationRouteKey(key) {
    return ["octave", "semitone", "fine"].includes(key) ? "tune" : key;
}

function readoutPresentation({ key, value, min, max, oscillatorID }) {
    const normalized = clamp((Number(value) - min) / (max - min), 0, 1);
    const origin = min < 0 && max > 0 ? clamp((0 - min) / (max - min), 0, 1) : 0;
    const routeKey = modulationRouteKey(key);
    const depth = state.modulationDepthByOscillator[oscillatorID]?.[routeKey] ?? 0;
    const low = clamp(normalized - depth, 0, 1);
    const high = clamp(normalized + depth, 0, 1);
    return {
        normalized,
        origin,
        low,
        high,
        depth,
        routeKey,
        lowValue: min + (low * (max - min)),
        highValue: min + (high * (max - min)),
    };
}

const HUD_KNOB_CENTER = 50;
const HUD_KNOB_START = 225;
const HUD_KNOB_SWEEP = 270;

function hudPoint(degrees, radius) {
    const radians = (degrees * Math.PI) / 180;
    return {
        x: HUD_KNOB_CENTER + (radius * Math.cos(radians)),
        y: HUD_KNOB_CENTER - (radius * Math.sin(radians)),
    };
}

function hudAngle(normalized) {
    return HUD_KNOB_START - (clamp(normalized, 0, 1) * HUD_KNOB_SWEEP);
}

function hudPointText(point) {
    return `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
}

function hudPieSector(fromNormalized, toNormalized, radius) {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * HUD_KNOB_SWEEP;
    if (extent <= 0.001) return "";
    const start = hudPoint(hudAngle(low), radius);
    const end = hudPoint(hudAngle(high), radius);
    return `M ${HUD_KNOB_CENTER} ${HUD_KNOB_CENTER} L ${hudPointText(start)} A ${radius} ${radius} 0 ${extent > 180 ? 1 : 0} 1 ${hudPointText(end)} Z`;
}

function hudAnnularSector(fromNormalized, toNormalized, innerRadius, outerRadius) {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * HUD_KNOB_SWEEP;
    if (extent <= 0.001) return "";
    const outerStart = hudPoint(hudAngle(low), outerRadius);
    const outerEnd = hudPoint(hudAngle(high), outerRadius);
    const innerStart = hudPoint(hudAngle(low), innerRadius);
    const innerEnd = hudPoint(hudAngle(high), innerRadius);
    const largeArc = extent > 180 ? 1 : 0;
    return `M ${hudPointText(outerStart)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${hudPointText(outerEnd)} L ${hudPointText(innerEnd)} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${hudPointText(innerStart)} Z`;
}

function waveform(id = state.selectedOscillator, compact = false) {
    const curves = {
        A: "M0 46 C18 10 36 82 54 38 S88 12 106 48 S140 78 160 28 S194 22 212 47 S246 78 280 34 S316 10 340 48",
        B: "M0 52 C26 50 28 18 54 20 S76 74 104 70 S130 20 156 24 S182 74 210 68 S238 16 266 22 S306 76 340 42",
        C: "M0 48 L28 18 L54 72 L80 24 L108 68 L138 20 L166 74 L194 22 L222 70 L252 18 L280 72 L310 24 L340 48",
    };
    return `<svg class="waveform${compact ? " is-compact" : ""}" viewBox="0 0 340 96" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="wave-${id}-${compact ? "c" : "f"}" x1="0" x2="1"><stop stop-color="#7de7ff"/><stop offset=".55" stop-color="#80f4cc"/><stop offset="1" stop-color="#f6c663"/></linearGradient></defs>
        <g class="wave-grid"><path d="M0 24H340M0 48H340M0 72H340M68 0V96M136 0V96M204 0V96M272 0V96"/></g>
        <path class="wave-glow" d="${curves[id]}"/>
        <path class="wave-line" stroke="url(#wave-${id}-${compact ? "c" : "f"})" d="${curves[id]}"/>
    </svg>`;
}

function oscTabs() {
    return `<div class="osc-tabs" role="tablist" aria-label="Oscillator">
        ${["A", "B", "C"].map((id) => `<button type="button" data-action="select-osc" data-osc="${id}" class="${state.selectedOscillator === id ? "is-active" : ""}" aria-selected="${state.selectedOscillator === id}">${id}</button>`).join("")}
    </div>`;
}

function rangeControl({
    key,
    label,
    min = 0,
    max = 1,
    step = 0.001,
    oscillatorID = state.selectedOscillator,
    className = "",
    shape = "knob",
}) {
    const value = valueFor(key, oscillatorID);
    const normalized = (Number(value) - min) / (max - min);
    const isReadout = shape === "readout";
    const presentation = isReadout ? readoutPresentation({ key, value, min, max, oscillatorID }) : null;
    const readoutStyle = presentation
        ? `;--base-position:${presentation.normalized * 100}%;--mod-low:${presentation.low * 100}%;--mod-high:${presentation.high * 100}%;--mod-accent:${mockModulationSource.accent}`
        : "";
    const readoutAttributes = presentation
        ? ` data-readout-control="true" data-min="${min}" data-max="${max}" data-step="${step}" data-mod-route="${presentation.routeKey}"`
        : "";
    return `<label class="control ${shape} ${className}" data-control="${key}" data-control-osc="${oscillatorID}"${readoutAttributes} style="--value:${Math.max(0, Math.min(1, normalized))}${readoutStyle}">
        <span class="control-label">${label}</span>
        <span class="control-face" aria-hidden="true"><i></i></span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-bind="${key}" data-osc="${oscillatorID}" aria-label="${label}" />
        <output data-readout-for="${key}" data-readout-osc="${oscillatorID}">${formatFor(key, value)}</output>
        ${isReadout ? `<span class="readout-rail" aria-hidden="true"><i class="readout-rail-track"></i><i class="readout-mod-band"></i><i class="readout-base-tick"></i></span>` : ""}
    </label>`;
}

function selectControl({ label, action, value, className = "" }) {
    return `<button type="button" class="choice-control ${className}" data-action="${action}">
        <span>${label}</span><strong>${value}</strong><i aria-hidden="true">›</i>
    </button>`;
}

function tablePicker(id = state.selectedOscillator) {
    return `<button type="button" class="table-picker" data-action="cycle-table" data-osc="${id}">
        <span>Wavetable</span><strong>${state.oscillators[id].table}</strong><i aria-hidden="true">⌄</i>
    </button>`;
}

function pageChoiceControl({ label, value, action, oscillatorID }) {
    return `<button type="button" class="page-choice-control" data-action="${action}" data-osc="${oscillatorID}">
        <span>${label}</span><strong>${value}</strong>
    </button>`;
}

function compactFilter() {
    return `<section class="filter-strip panel">
        <div class="filter-identity">
            <span class="eyebrow">Global filter</span>
            <button type="button" data-action="cycle-filter-mode">${filterModes[state.filterMode]}</button>
        </div>
        ${rangeControl({ key: "cutoff", label: "Cutoff", min: 20, max: 20000, step: 1, shape: "rail", className: "filter-cutoff" })}
        ${rangeControl({ key: "resonance", label: "Res", min: 0.1, max: 20, step: 0.01, shape: "rail", className: "filter-res" })}
    </section>`;
}

function secondaryDrawers(id = state.selectedOscillator, compact = false) {
    const osc = state.oscillators[id];
    return `<div class="secondary-drawers${compact ? " is-compact" : ""}">
        <details>
            <summary><span>Tuning + mix</span><em>Oct · Semi · Fine · Pan · M/S</em></summary>
            <div class="drawer-grid four">
                ${rangeControl({ key: "octave", label: "Octave", min: -4, max: 4, step: 1, oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "semitone", label: "Semi", min: -12, max: 12, step: 1, oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "fine", label: "Fine", min: -100, max: 100, step: 0.1, oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "pan", label: "Pan", min: -1, max: 1, oscillatorID: id, shape: "rail" })}
            </div>
            <div class="binary-row">
                <button type="button" data-action="toggle" data-key="mute" data-osc="${id}" class="${osc.mute ? "is-active" : ""}">Mute</button>
                <button type="button" data-action="toggle" data-key="solo" data-osc="${id}" class="${osc.solo ? "is-active" : ""}">Solo</button>
            </div>
        </details>
        <details>
            <summary><span>Unison detail</span><em>Blend · Phase · Modes · Spreads</em></summary>
            <div class="drawer-grid three">
                ${rangeControl({ key: "blend", label: "Blend", oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "width", label: "Width", oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "phase", label: "Phase", oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "random", label: "Random", oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "wtSpread", label: "WT spread", oscillatorID: id, shape: "rail" })}
                ${rangeControl({ key: "warpSpread", label: "Warp spread", oscillatorID: id, shape: "rail" })}
            </div>
            <div class="mode-grid">
                <button type="button" data-action="cycle-detune-mode" data-osc="${id}"><span>Detune mode</span><strong>${detuneModes[osc.detuneMode]}</strong></button>
                <button type="button" data-action="cycle-stack-mode" data-osc="${id}"><span>Stack</span><strong>${stackModes[osc.stackMode]}</strong></button>
                <button type="button" data-action="toggle-phase-mode" data-osc="${id}"><span>Phase</span><strong>${osc.phaseMode ? "Reset" : "Free"}</strong></button>
            </div>
        </details>
        <details>
            <summary><span>Voice behavior</span><em>${playModes[state.playMode]} · ${formatFor("glide", state.glide)}</em></summary>
            <div class="mode-grid two">
                <button type="button" data-action="cycle-play-mode"><span>Mode</span><strong>${playModes[state.playMode]}</strong></button>
                ${rangeControl({ key: "glide", label: "Glide", min: 0, max: 2, step: 0.001, shape: "rail" })}
            </div>
        </details>
    </div>`;
}

function variantA() {
    const id = state.selectedOscillator;
    const osc = state.oscillators[id];
    return `<div class="voice-content variant-a">
        <section class="source-hero panel">
            <div class="hero-top">${tablePicker(id)}${oscTabs()}<span class="frame-readout">Frame ${Math.round(osc.index * 255) + 1}</span></div>
            ${waveform(id)}
            <div class="hero-overlays">
                <button type="button" data-action="cycle-warp-mode" data-osc="${id}"><span>Warp</span><strong>${warpModes[osc.warpMode]}</strong></button>
                <span>Pan ${formatFor("pan", osc.pan)}</span>
            </div>
        </section>
        <section class="quick-deck panel">
            <header><span class="eyebrow">Direct controls</span><em>selected oscillator ${id}</em></header>
            <div class="knob-row five">
                ${rangeControl({ key: "index", label: "Index", oscillatorID: id })}
                ${rangeControl({ key: "warp", label: "Warp", oscillatorID: id })}
                ${rangeControl({ key: "level", label: "Level", min: -48, max: 6, step: 0.1, oscillatorID: id })}
                ${rangeControl({ key: "voices", label: "Voices", min: 1, max: 8, step: 1, oscillatorID: id })}
                ${rangeControl({ key: "detune", label: "Detune", oscillatorID: id })}
            </div>
        </section>
        ${compactFilter()}
        ${secondaryDrawers(id)}
    </div>`;
}

function horizontalField(key, label, options = {}) {
    return rangeControl({ key, label, shape: "horizontal", ...options });
}

function variantB() {
    const id = state.selectedOscillator;
    const osc = state.oscillators[id];
    return `<div class="voice-content variant-b">
        <section class="compact-source panel">
            <div class="compact-wave">${waveform(id, true)}</div>
            <div class="compact-source-copy">${tablePicker(id)}<span>Frame ${Math.round(osc.index * 255) + 1}</span></div>
            ${oscTabs()}
        </section>
        <section class="control-board panel">
            <header><span class="eyebrow">Sound</span><em>everything here is direct</em></header>
            <div class="horizontal-grid">
                ${horizontalField("index", "Index", { oscillatorID: id })}
                ${horizontalField("warp", "Warp", { oscillatorID: id })}
                ${horizontalField("level", "Level", { min: -48, max: 6, step: 0.1, oscillatorID: id })}
                ${horizontalField("cutoff", "Cutoff", { min: 20, max: 20000, step: 1 })}
            </div>
            <div class="compact-modes">
                <button type="button" data-action="cycle-warp-mode" data-osc="${id}"><span>Warp mode</span><strong>${warpModes[osc.warpMode]}</strong></button>
                <button type="button" data-action="cycle-filter-mode"><span>Filter</span><strong>${filterModes[state.filterMode]}</strong></button>
            </div>
        </section>
        <section class="direct-groups panel">
            <div class="direct-group">
                <header><span>Tune + place</span></header>
                <div class="mini-control-grid four">
                    ${rangeControl({ key: "octave", label: "Oct", min: -4, max: 4, step: 1, oscillatorID: id, shape: "mini" })}
                    ${rangeControl({ key: "semitone", label: "Semi", min: -12, max: 12, step: 1, oscillatorID: id, shape: "mini" })}
                    ${rangeControl({ key: "fine", label: "Fine", min: -100, max: 100, step: 0.1, oscillatorID: id, shape: "mini" })}
                    ${rangeControl({ key: "pan", label: "Pan", min: -1, max: 1, oscillatorID: id, shape: "mini" })}
                </div>
            </div>
            <div class="direct-group">
                <header><span>Unison</span></header>
                <div class="mini-control-grid three">
                    ${rangeControl({ key: "voices", label: "Voices", min: 1, max: 8, step: 1, oscillatorID: id, shape: "mini" })}
                    ${rangeControl({ key: "detune", label: "Detune", oscillatorID: id, shape: "mini" })}
                    ${rangeControl({ key: "width", label: "Width", oscillatorID: id, shape: "mini" })}
                </div>
            </div>
            <div class="direct-group voice-behavior-row">
                <button type="button" data-action="cycle-play-mode"><span>Play</span><strong>${playModes[state.playMode]}</strong></button>
                ${rangeControl({ key: "glide", label: "Glide", min: 0, max: 2, step: 0.001, shape: "mini" })}
                ${rangeControl({ key: "resonance", label: "Res", min: 0.1, max: 20, step: 0.01, shape: "mini" })}
            </div>
        </section>
        ${secondaryDrawers(id, true)}
    </div>`;
}

function oscillatorControlPage(id, presentation = "strip") {
    const osc = state.oscillators[id];
    const pageIndex = state.controlPageByOscillator[id];
    const pageName = oscillatorControlPageNames[pageIndex];
    const isReadout = presentation === "readout";
    const controlShape = isReadout ? "readout" : "strip";
    const label = (full, compact) => isReadout ? compact : full;
    const transitionClass = state.pageTransition?.oscillatorID === id
        ? state.pageTransition.direction > 0 ? "slide-forward" : "slide-back"
        : "";
    let controls;

    switch (pageIndex) {
        case 0:
            controls = [
                rangeControl({ key: "index", label: label("Index", "Idx"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "warp", label: label("Warp", "Warp"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "level", label: label("Level", "Level"), min: -48, max: 6, step: 0.1, oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "detune", label: label("Detune", "Det"), oscillatorID: id, shape: controlShape }),
            ];
            break;
        case 1:
            controls = [
                rangeControl({ key: "octave", label: label("Octave", "Oct"), min: -4, max: 4, step: 1, oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "semitone", label: label("Semitone", "Semi"), min: -12, max: 12, step: 1, oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "fine", label: label("Fine", "Fine"), min: -100, max: 100, step: 0.1, oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "pan", label: label("Pan", "Pan"), min: -1, max: 1, oscillatorID: id, shape: controlShape }),
            ];
            break;
        case 2:
            controls = [
                rangeControl({ key: "blend", label: label("Blend", "Blend"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "width", label: label("Width", "Width"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "wtSpread", label: label("WT spread", "WT"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "warpSpread", label: label("Warp spread", "Warp"), oscillatorID: id, shape: controlShape }),
            ];
            break;
        case 3:
            controls = [
                rangeControl({ key: "phase", label: label("Phase", "Phase"), oscillatorID: id, shape: controlShape }),
                rangeControl({ key: "random", label: label("Random", "Random"), oscillatorID: id, shape: controlShape }),
                pageChoiceControl({ label: "Phase mode", value: osc.phaseMode ? "Reset" : "Free", action: "toggle-phase-mode", oscillatorID: id }),
            ];
            break;
        default:
            controls = [
                pageChoiceControl({ label: "Detune mode", value: detuneModes[osc.detuneMode], action: "cycle-detune-mode", oscillatorID: id }),
                pageChoiceControl({ label: "Stack", value: stackModes[osc.stackMode], action: "cycle-stack-mode", oscillatorID: id }),
            ];
            break;
    }

    if (isReadout) {
        return `<div class="osc-control-pager is-inline-pager">
            <button type="button" class="osc-page-paddle is-previous" data-action="previous-osc-page" data-osc="${id}" aria-label="Previous ${id} control page"><b>‹</b><span>${pageName}</span></button>
            <div class="osc-control-page ${transitionClass} ${pageIndex === 4 ? "is-modes" : ""} ${pageIndex < 4 ? `is-readout-row control-count-${controls.length}` : ""}">${controls.join("")}</div>
            <button type="button" class="osc-page-paddle is-next" data-action="next-osc-page" data-osc="${id}" aria-label="Next ${id} control page"><em>${pageIndex + 1}/${oscillatorControlPageNames.length}</em><b>›</b></button>
        </div>`;
    }

    return `<div class="osc-control-pager">
        <header>
            <button type="button" data-action="previous-osc-page" data-osc="${id}" aria-label="Previous ${id} control page">‹</button>
            <span>${pageName}</span>
            <em>${pageIndex + 1}/${oscillatorControlPageNames.length}</em>
            <button type="button" data-action="next-osc-page" data-osc="${id}" aria-label="Next ${id} control page">›</button>
        </header>
        <div class="osc-control-page ${transitionClass} ${pageIndex === 4 ? "is-modes" : ""} ${presentation === "readout" && pageIndex < 4 ? `is-readout-row control-count-${controls.length}` : ""}">${controls.join("")}</div>
    </div>`;
}

function oscillatorStrip(id) {
    const osc = state.oscillators[id];
    return `<section class="osc-strip panel ${osc.mute ? "is-muted" : ""}" data-osc-strip="${id}">
        <div class="osc-strip-id">
            <button type="button" class="osc-select" data-action="toggle" data-key="mute" data-osc="${id}" aria-label="Turn oscillator ${id} ${osc.mute ? "on" : "off"}" aria-pressed="${!osc.mute}"><strong>${id}</strong></button>
            ${rangeControl({ key: "semitone", label: "Semi", min: -12, max: 12, step: 1, oscillatorID: id, shape: "identity" })}
            ${rangeControl({ key: "voices", label: "Voices", min: 1, max: 8, step: 1, oscillatorID: id, shape: "identity" })}
        </div>
        <div class="osc-strip-source">
            <button type="button" class="source-warp-mode" data-action="cycle-warp-mode" data-osc="${id}"><span>Warp</span><strong>${warpModes[osc.warpMode]}</strong></button>
            ${waveform(id, true)}
            ${tablePicker(id)}
        </div>
        ${oscillatorControlPage(id)}
        <button type="button" class="osc-solo ${osc.solo ? "is-active" : ""}" data-action="toggle" data-key="solo" data-osc="${id}" aria-label="Solo oscillator ${id}" aria-pressed="${osc.solo}">S</button>
    </section>`;
}

function variantC() {
    return `<div class="voice-content variant-c">
        <section class="shared-voice-strip panel">
            <button type="button" data-action="cycle-play-mode"><span>Voice</span><strong>${playModes[state.playMode]}</strong></button>
            ${rangeControl({ key: "cutoff", label: "Filter", min: 20, max: 20000, step: 1, shape: "strip" })}
            ${rangeControl({ key: "resonance", label: "Res", min: 0.1, max: 20, step: 0.01, shape: "strip" })}
            ${rangeControl({ key: "glide", label: "Glide", min: 0, max: 2, step: 0.001, shape: "strip" })}
        </section>
        <div class="oscillator-stack">
            ${["A", "B", "C"].map(oscillatorStrip).join("")}
        </div>
    </div>`;
}

function focusedOscillatorTabs() {
    return `<nav class="focused-osc-tabs" role="tablist" aria-label="Oscillator editor">
        ${["A", "B", "C"].map((id) => {
            const osc = state.oscillators[id];
            const isActive = state.selectedOscillator === id;
            const actionLabel = isActive
                ? `Turn oscillator ${id} ${osc.mute ? "on" : "off"}`
                : `Select oscillator ${id}`;
            return `<button type="button" role="tab" data-action="select-or-toggle-osc" data-osc="${id}" class="${isActive ? "is-active" : ""} ${osc.mute ? "is-muted" : ""}" aria-label="${actionLabel}" aria-selected="${isActive}" aria-pressed="${!osc.mute}"><strong>${id}</strong></button>`;
        }).join("")}
    </nav>`;
}

function precisionReadoutHud() {
    return `<div class="readout-precision-hud" data-role="readout-precision-hud" aria-hidden="true">
        <header>
            <span class="readout-hud-mode" data-hud-mode>BASE ↔</span>
            <strong data-hud-label>Index</strong>
            <span class="readout-hud-source" data-hud-source>${mockModulationSource.name}</span>
        </header>
        <div class="readout-hud-knob">
            <svg viewBox="-3 -3 106 106" aria-hidden="true">
                <defs>
                    <pattern id="hud-base-stipple" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#d5dcde" /></pattern>
                    <pattern id="hud-mod-stipple" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="${mockModulationSource.accent}" /></pattern>
                </defs>
                <path class="readout-hud-base-track" d="${hudPieSector(0, 1, 25)}" fill="url(#hud-base-stipple)" />
                <path class="readout-hud-base-fill" data-hud-base-fill d="" />
                <path class="readout-hud-mod-track" d="${hudAnnularSector(0, 1, 36, 48)}" fill="url(#hud-mod-stipple)" />
                <path class="readout-hud-mod-fill" data-hud-mod-fill d="" />
                <circle class="readout-hud-handle" data-hud-handle cx="50" cy="50" r="2.7" />
            </svg>
            <div class="readout-hud-center"><span>Base</span><strong data-hud-base-value>0.000</strong></div>
            <div class="readout-hud-limit is-low"><span>Low</span><strong data-hud-low>0.000</strong></div>
            <div class="readout-hud-limit is-high"><span>High</span><strong data-hud-high>0.000</strong></div>
        </div>
        <footer><span data-hud-base-hint>↔ Base</span><span data-hud-mod-hint>↕ Mod amount</span></footer>
    </div>`;
}

function variantD() {
    const id = state.selectedOscillator;
    const osc = state.oscillators[id];
    return `<div class="voice-content variant-d">
        <section class="shared-voice-strip panel">
            <button type="button" data-action="cycle-play-mode"><span>Voice</span><strong>${playModes[state.playMode]}</strong></button>
            ${rangeControl({ key: "cutoff", label: "Filter", min: 20, max: 20000, step: 1, shape: "strip" })}
            ${rangeControl({ key: "resonance", label: "Res", min: 0.1, max: 20, step: 0.01, shape: "strip" })}
            ${rangeControl({ key: "glide", label: "Glide", min: 0, max: 2, step: 0.001, shape: "strip" })}
        </section>
        ${focusedOscillatorTabs()}
        <section class="focused-osc-editor panel ${osc.mute ? "is-muted" : ""}" role="tabpanel" aria-label="Oscillator ${id}">
            <header class="focused-osc-header">
                ${rangeControl({ key: "semitone", label: "Semitone", min: -12, max: 12, step: 1, oscillatorID: id, shape: "focus-direct" })}
                ${rangeControl({ key: "voices", label: "Voices", min: 1, max: 8, step: 1, oscillatorID: id, shape: "focus-direct" })}
                <button type="button" class="focused-osc-solo ${osc.solo ? "is-active" : ""}" data-action="toggle" data-key="solo" data-osc="${id}" aria-label="Solo oscillator ${id}" aria-pressed="${osc.solo}">Solo</button>
            </header>
            <div class="focused-osc-source">
                ${waveform(id)}
                <div class="focused-source-strip">
                    <button type="button" class="source-warp-mode" data-action="cycle-warp-mode" data-osc="${id}"><span>Warp</span><strong>${warpModes[osc.warpMode]}</strong></button>
                    ${tablePicker(id)}
                    <span class="focused-frame-readout"><small>Frame</small><strong>${Math.round(osc.index * 255) + 1}</strong></span>
                </div>
            </div>
            <div class="focused-osc-pages">${oscillatorControlPage(id, "readout")}</div>
        </section>
    </div>`;
}

function phoneChrome(content) {
    return `<section class="phone is-variant-${activeVariant().toLowerCase()}" aria-label="Mobile Voice layout prototype">
        ${activeVariant() === "D" ? precisionReadoutHud() : ""}
        <div class="phone-status"><span>9:41</span><span class="prototype-tag">PROTOTYPE</span><span>5G&nbsp; 87%</span></div>
        <header class="preset-bar"><button type="button">‹</button><div><span>PRESET</span><strong>Arc Light / 014</strong></div><button type="button">···</button></header>
        <div class="workspace-toggle is-open"><span>VOICE</span><i>⌃</i></div>
        <div class="phone-scroll">${content}</div>
        <div class="collapsed-workspaces"><button type="button">FX</button><button type="button">MOD</button></div>
        <div class="keyboard" aria-hidden="true">${Array.from({ length: 13 }, (_, index) => `<i class="${[1, 3, 6, 8, 10].includes(index % 12) ? "black" : ""}"></i>`).join("")}</div>
    </section>`;
}

function statePanel() {
    const id = state.selectedOscillator;
    const osc = state.oscillators[id];
    return `<aside class="research-panel">
        <div class="research-kicker">Throwaway layout study</div>
        <h1>Mobile Voice</h1>
        <p>${VARIANTS[activeVariant()].thesis}</p>
        <dl class="variant-notes">
            <div><dt>Direct</dt><dd>${VARIANTS[activeVariant()].direct}</dd></div>
            <div><dt>Tradeoff</dt><dd>${VARIANTS[activeVariant()].tradeoff}</dd></div>
        </dl>
        <div class="inventory-callout"><strong>27 visible sound parameters</strong><span>22 selected-oscillator + 5 shared</span><a href="./INVENTORY.md" target="_blank" rel="noreferrer">Open source-backed inventory ↗</a></div>
        <section class="state-card" aria-live="polite">
            <header><span>Live mock state</span><strong>OSC ${id}</strong></header>
            <dl>
                <div><dt>Source</dt><dd>${osc.table}</dd></div>
                <div><dt>Index / Warp</dt><dd>${formatFor("index", osc.index)} / ${formatFor("warp", osc.warp)}</dd></div>
                <div><dt>Tune / Level</dt><dd>${formatFor("octave", osc.octave)}, ${formatFor("semitone", osc.semitone)} / ${formatFor("level", osc.level)}</dd></div>
                <div><dt>Unison</dt><dd>${formatFor("voices", osc.voices)}, ${formatFor("detune", osc.detune)}, ${formatFor("width", osc.width)}</dd></div>
                ${["C", "D"].includes(activeVariant()) ? `<div><dt>Oscillator</dt><dd>${osc.mute ? "Off" : "On"}${osc.solo ? ", Solo" : ""}</dd></div>` : ""}
                ${["C", "D"].includes(activeVariant()) ? `<div><dt>Control page</dt><dd>${oscillatorControlPageNames[state.controlPageByOscillator[id]]} ${state.controlPageByOscillator[id] + 1}/${oscillatorControlPageNames.length}</dd></div>` : ""}
                <div><dt>Voice</dt><dd>${playModes[state.playMode]}, ${formatFor("glide", state.glide)}</dd></div>
                <div><dt>Filter</dt><dd>${filterModes[state.filterMode]}, ${formatFor("cutoff", state.cutoff)}, Q ${formatFor("resonance", state.resonance)}</dd></div>
            </dl>
        </section>
        <p class="prototype-warning">No patch connection, persistence, or production component contract. This exists only to decide hierarchy.</p>
    </aside>`;
}

function switcher() {
    const ids = Object.keys(VARIANTS);
    const current = activeVariant();
    return `<nav class="prototype-switcher" aria-label="Prototype variants">
        <button type="button" data-action="previous-variant" aria-label="Previous variant">←</button>
        <div><span>VARIANT ${current}</span><strong>${VARIANTS[current].name}</strong></div>
        <button type="button" data-action="next-variant" aria-label="Next variant">→</button>
    </nav>`;
}

function render() {
    const variant = activeVariant();
    const content = variant === "A" ? variantA() : variant === "B" ? variantB() : variant === "C" ? variantC() : variantD();
    app.innerHTML = `<div class="prototype-shell">${statePanel()}${phoneChrome(content)}</div>${switcher()}`;
    document.title = `PROTOTYPE ${variant} — ${VARIANTS[variant].name}`;
    requestAnimationFrame(() => {
        state.pageTransition = null;
    });
}

function setVariant(direction) {
    const ids = Object.keys(VARIANTS);
    const currentIndex = ids.indexOf(activeVariant());
    const next = ids[(currentIndex + direction + ids.length) % ids.length];
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    render();
}

function cycle(value, length) {
    return (Number(value) + 1) % length;
}

let readoutGesture = null;
let readoutHudHideTimer = null;

const READOUT_CONTROL_SELECTOR = '.variant-d .control.readout[data-readout-control="true"]';
const READOUT_SCROLL_LOCK_CLASS = "is-readout-gesture-owned";
const READOUT_TOUCH_ACTIVATION_PX = 8;
const READOUT_POINTER_ACTIVATION_PX = 4;
const READOUT_INITIAL_DOMINANCE_RATIO = 1.3;
const READOUT_SWITCH_DOMINANCE_RATIO = 1.6;
const READOUT_SWITCH_EVIDENCE_PX = 4;
const READOUT_DIRECTION_WINDOW_MS = 36;
const READOUT_BASE_PIXELS_PER_RANGE = 220;
const READOUT_MOD_PIXELS_PER_RANGE = 360;
const READOUT_MOD_DEPTH_MAX = 0.45;

function snapReadoutValue(value, min, max, step) {
    const snapped = min + (Math.round((clamp(value, min, max) - min) / step) * step);
    return Number(clamp(snapped, min, max).toFixed(10));
}

function updateReadoutControlElement(control) {
    const key = control.dataset.control;
    const oscillatorID = control.dataset.controlOsc;
    const min = Number(control.dataset.min);
    const max = Number(control.dataset.max);
    const value = valueFor(key, oscillatorID);
    const presentation = readoutPresentation({ key, value, min, max, oscillatorID });
    control.style.setProperty("--value", String(presentation.normalized));
    control.style.setProperty("--base-position", `${presentation.normalized * 100}%`);
    control.style.setProperty("--mod-low", `${presentation.low * 100}%`);
    control.style.setProperty("--mod-high", `${presentation.high * 100}%`);
    const output = control.querySelector("output");
    const input = control.querySelector("input");
    if (output) output.textContent = formatFor(key, value);
    if (input) input.value = String(value);
}

function updateReadoutsForRoute(oscillatorID, routeKey) {
    app.querySelectorAll(`.control.readout[data-control-osc="${oscillatorID}"][data-mod-route="${routeKey}"]`)
        .forEach(updateReadoutControlElement);
}

function updatePrecisionHud(control, mode = "base") {
    const hud = app.querySelector('[data-role="readout-precision-hud"]');
    if (!hud) return;
    const key = control.dataset.control;
    const oscillatorID = control.dataset.controlOsc;
    const routeKey = control.dataset.modRoute;
    const min = Number(control.dataset.min);
    const max = Number(control.dataset.max);
    const value = valueFor(key, oscillatorID);
    const presentation = readoutPresentation({ key, value, min, max, oscillatorID });
    const handle = hudPoint(hudAngle(presentation.normalized), 18);
    const isModulation = mode === "modulation";
    hud.dataset.mode = mode;
    hud.setAttribute("aria-hidden", "false");
    hud.classList.add("is-visible");
    hud.querySelector("[data-hud-mode]").textContent = isModulation ? "MOD ↕" : "BASE ↔";
    hud.querySelector("[data-hud-label]").textContent = isModulation && routeKey === "tune"
        ? "Tune"
        : control.querySelector(".control-label")?.textContent ?? key;
    hud.querySelector("[data-hud-source]").textContent = `${mockModulationSource.name} · ${Math.round(presentation.depth * 100)}%`;
    hud.querySelector("[data-hud-base-value]").textContent = formatFor(key, value);
    hud.querySelector("[data-hud-low]").textContent = formatFor(key, presentation.lowValue);
    hud.querySelector("[data-hud-high]").textContent = formatFor(key, presentation.highValue);
    hud.querySelector("[data-hud-base-fill]").setAttribute("d", hudPieSector(presentation.origin, presentation.normalized, 25));
    hud.querySelector("[data-hud-mod-fill]").setAttribute("d", hudAnnularSector(presentation.low, presentation.high, 36, 48));
    hud.querySelector("[data-hud-handle]").setAttribute("cx", handle.x.toFixed(3));
    hud.querySelector("[data-hud-handle]").setAttribute("cy", handle.y.toFixed(3));
}

function hidePrecisionHud(immediate = false) {
    if (readoutHudHideTimer !== null) {
        clearTimeout(readoutHudHideTimer);
        readoutHudHideTimer = null;
    }
    const hide = () => {
        const hud = app.querySelector('[data-role="readout-precision-hud"]');
        hud?.classList.remove("is-visible");
        hud?.setAttribute("aria-hidden", "true");
        if (!readoutGesture && activeVariant() === "D") render();
    };
    if (immediate) hide();
    else readoutHudHideTimer = setTimeout(hide, 420);
}

function readoutActivationDistance(pointerType) {
    return pointerType === "touch" ? READOUT_TOUCH_ACTIVATION_PX : READOUT_POINTER_ACTIVATION_PX;
}

function readoutDirectionVector(gesture) {
    return gesture.directionHistory.reduce((vector, sample) => ({
        x: vector.x + sample.dx,
        y: vector.y + sample.dy,
    }), { x: 0, y: 0 });
}

function setReadoutGestureMode(gesture, mode) {
    gesture.mode = mode;
    gesture.active = true;
    gesture.directionHistory = [];
    gesture.control.dataset.dragging = mode;
    updatePrecisionHud(gesture.control, mode);
}

function resolveInitialReadoutMode(deltaX, deltaY) {
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);
    if (horizontal >= vertical * READOUT_INITIAL_DOMINANCE_RATIO) return "base";
    if (vertical >= horizontal * READOUT_INITIAL_DOMINANCE_RATIO) return "modulation";
    return "pending";
}

function shouldSwitchReadoutMode(mode, vector) {
    const horizontal = Math.abs(vector.x);
    const vertical = Math.abs(vector.y);
    if (mode === "base") {
        return vertical >= READOUT_SWITCH_EVIDENCE_PX
            && vertical >= horizontal * READOUT_SWITCH_DOMINANCE_RATIO;
    }
    return horizontal >= READOUT_SWITCH_EVIDENCE_PX
        && horizontal >= vertical * READOUT_SWITCH_DOMINANCE_RATIO;
}

function applyReadoutGestureDelta(gesture, deltaX, deltaY) {
    if (gesture.mode === "base") {
        gesture.baseNormalized = clamp(
            gesture.baseNormalized + (deltaX / READOUT_BASE_PIXELS_PER_RANGE),
            0,
            1,
        );
        const rawValue = gesture.min + (gesture.baseNormalized * (gesture.max - gesture.min));
        const nextValue = snapReadoutValue(rawValue, gesture.min, gesture.max, gesture.step);
        const target = gesture.key in state ? state : state.oscillators[gesture.oscillatorID];
        target[gesture.key] = nextValue;
    } else {
        gesture.modDepth = clamp(
            gesture.modDepth + ((deltaY / READOUT_MOD_PIXELS_PER_RANGE) * READOUT_MOD_DEPTH_MAX),
            0,
            READOUT_MOD_DEPTH_MAX,
        );
        state.modulationDepthByOscillator[gesture.oscillatorID][gesture.routeKey] = gesture.modDepth;
    }
    updateReadoutsForRoute(gesture.oscillatorID, gesture.routeKey);
    updatePrecisionHud(gesture.control, gesture.mode);
}

function updateReadoutGestureFromPoint(point) {
    const gesture = readoutGesture;
    if (!gesture) return;
    const deltaX = point.clientX - gesture.lastX;
    const deltaY = gesture.lastY - point.clientY;
    gesture.lastX = point.clientX;
    gesture.lastY = point.clientY;
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return;

    const timestamp = Number(point.timeStamp) || performance.now();
    gesture.directionHistory.push({ dx: deltaX, dy: deltaY, timestamp });
    gesture.directionHistory = gesture.directionHistory.filter(
        (sample) => timestamp - sample.timestamp <= READOUT_DIRECTION_WINDOW_MS,
    );

    if (!gesture.active) {
        const totalDeltaX = point.clientX - gesture.startX;
        const totalDeltaY = gesture.startY - point.clientY;
        if (Math.hypot(totalDeltaX, totalDeltaY) < readoutActivationDistance(gesture.pointerType)) return;
        const initialMode = resolveInitialReadoutMode(totalDeltaX, totalDeltaY);
        if (initialMode === "pending") return;
        setReadoutGestureMode(gesture, initialMode);
        return;
    }

    const vector = readoutDirectionVector(gesture);
    if (shouldSwitchReadoutMode(gesture.mode, vector)) {
        setReadoutGestureMode(gesture, gesture.mode === "base" ? "modulation" : "base");
        return;
    }

    applyReadoutGestureDelta(gesture, deltaX, deltaY);
}

function updateReadoutGesture(event) {
    const gesture = readoutGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
        finishReadoutGesture(event.pointerId);
        return;
    }
    event.preventDefault();
    const coalescedPoints = typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : [];
    const points = coalescedPoints.length > 0 ? coalescedPoints : [event];
    points.forEach(updateReadoutGestureFromPoint);
}

function readoutControlFromEvent(event) {
    return event.target instanceof Element ? event.target.closest(READOUT_CONTROL_SELECTOR) : null;
}

function holdReadoutScrollPosition(gesture) {
    if (gesture.scrollContainer && gesture.scrollContainer.scrollTop !== gesture.scrollTop) {
        gesture.scrollContainer.scrollTop = gesture.scrollTop;
    }
    if (window.scrollX !== gesture.windowScrollX || window.scrollY !== gesture.windowScrollY) {
        window.scrollTo(gesture.windowScrollX, gesture.windowScrollY);
    }
}

function suppressReadoutNativeTouch(event) {
    const touchesReadout = Boolean(readoutControlFromEvent(event));
    const ownsActiveTouch = readoutGesture?.pointerType === "touch";
    if (!touchesReadout && !ownsActiveTouch) return;
    if (event.cancelable) event.preventDefault();
    if (readoutGesture) holdReadoutScrollPosition(readoutGesture);
}

function finishReadoutGesture(pointerId, cancelled = false) {
    const gesture = readoutGesture;
    if (!gesture || (pointerId !== undefined && pointerId !== gesture.pointerId)) return;
    readoutGesture = null;
    delete gesture.control.dataset.dragging;
    gesture.scrollContainer?.classList.remove(READOUT_SCROLL_LOCK_CLASS);
    document.documentElement.classList.remove(READOUT_SCROLL_LOCK_CLASS);
    holdReadoutScrollPosition(gesture);
    try {
        if (gesture.control.hasPointerCapture(gesture.pointerId)) gesture.control.releasePointerCapture(gesture.pointerId);
    } catch {
        // The browser may already have released capture after cancellation.
    }
    hidePrecisionHud(cancelled);
}

app.addEventListener("pointerdown", (event) => {
    const control = readoutControlFromEvent(event);
    if (!control || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (readoutGesture !== null) return;
    const key = control.dataset.control;
    const oscillatorID = control.dataset.controlOsc;
    const min = Number(control.dataset.min);
    const max = Number(control.dataset.max);
    const routeKey = control.dataset.modRoute;
    const value = Number(valueFor(key, oscillatorID));
    const scrollContainer = control.closest(".phone-scroll");
    event.preventDefault();
    try { control.setPointerCapture(event.pointerId); } catch { /* Synthetic events may not own capture. */ }
    control.dataset.dragging = "pending";
    scrollContainer?.classList.add(READOUT_SCROLL_LOCK_CLASS);
    document.documentElement.classList.add(READOUT_SCROLL_LOCK_CLASS);
    readoutGesture = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        control,
        key,
        oscillatorID,
        routeKey,
        min,
        max,
        step: Number(control.dataset.step),
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        baseNormalized: clamp((value - min) / (max - min), 0, 1),
        modDepth: state.modulationDepthByOscillator[oscillatorID][routeKey] ?? 0,
        mode: "pending",
        directionHistory: [],
        active: false,
        scrollContainer,
        scrollTop: scrollContainer?.scrollTop ?? 0,
        windowScrollX: window.scrollX,
        windowScrollY: window.scrollY,
    };
    hidePrecisionHud(true);
});

app.addEventListener("touchstart", suppressReadoutNativeTouch, { capture: true, passive: false });
app.addEventListener("touchmove", suppressReadoutNativeTouch, { capture: true, passive: false });
app.addEventListener("touchend", (event) => {
    if (readoutGesture?.pointerType === "touch" && event.touches.length === 0) finishReadoutGesture();
}, true);
app.addEventListener("touchcancel", (event) => {
    if (readoutGesture?.pointerType === "touch" && event.touches.length === 0) finishReadoutGesture(undefined, true);
}, true);
window.addEventListener("pointermove", updateReadoutGesture, { capture: true, passive: false });
window.addEventListener("pointerup", (event) => finishReadoutGesture(event.pointerId), true);
window.addEventListener("pointercancel", (event) => finishReadoutGesture(event.pointerId, true), true);
window.addEventListener("blur", () => finishReadoutGesture(undefined, true));
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") finishReadoutGesture(undefined, true);
});

app.addEventListener("input", (event) => {
    const input = event.target.closest("[data-bind]");
    if (!input) return;
    const key = input.dataset.bind;
    const oscillatorID = input.dataset.osc;
    const target = key in state ? state : state.oscillators[oscillatorID];
    target[key] = Number(input.value);
    const control = input.closest("[data-control]");
    if (control) {
        const normalized = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
        control.style.setProperty("--value", String(Math.max(0, Math.min(1, normalized))));
        const output = control.querySelector("output");
        if (output) output.textContent = formatFor(key, input.value);
    }
});

app.addEventListener("change", (event) => {
    if (event.target.matches("[data-bind]")) render();
});

app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, osc: oscillatorID = state.selectedOscillator, key } = button.dataset;
    const osc = state.oscillators[oscillatorID];
    switch (action) {
        case "select-osc": state.selectedOscillator = oscillatorID; break;
        case "select-or-toggle-osc":
            if (state.selectedOscillator === oscillatorID) osc.mute = !osc.mute;
            else state.selectedOscillator = oscillatorID;
            break;
        case "cycle-table": osc.table = tableNames[(tableNames.indexOf(osc.table) + 1) % tableNames.length]; break;
        case "cycle-warp-mode": osc.warpMode = cycle(osc.warpMode, warpModes.length); break;
        case "cycle-filter-mode": state.filterMode = cycle(state.filterMode, filterModes.length); break;
        case "cycle-play-mode": state.playMode = cycle(state.playMode, playModes.length); break;
        case "cycle-detune-mode": osc.detuneMode = cycle(osc.detuneMode, detuneModes.length); break;
        case "cycle-stack-mode": osc.stackMode = cycle(osc.stackMode, stackModes.length); break;
        case "toggle-phase-mode": osc.phaseMode = osc.phaseMode ? 0 : 1; break;
        case "previous-osc-page":
            state.controlPageByOscillator[oscillatorID] = (
                state.controlPageByOscillator[oscillatorID] - 1 + oscillatorControlPageNames.length
            ) % oscillatorControlPageNames.length;
            state.pageTransition = { oscillatorID, direction: -1 };
            state.selectedOscillator = oscillatorID;
            break;
        case "next-osc-page":
            state.controlPageByOscillator[oscillatorID] = (
                state.controlPageByOscillator[oscillatorID] + 1
            ) % oscillatorControlPageNames.length;
            state.pageTransition = { oscillatorID, direction: 1 };
            state.selectedOscillator = oscillatorID;
            break;
        case "toggle": osc[key] = !osc[key]; break;
        case "previous-variant": setVariant(-1); return;
        case "next-variant": setVariant(1); return;
        default: return;
    }
    render();
});

window.addEventListener("popstate", render);
window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); setVariant(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); setVariant(1); }
});

render();
