// PROTOTYPE — throwaway mobile FX graph density studies, switchable with ?variant=A|B|C|D.

const VARIANTS = {
    A: { name: "Sideways tags", layout: "vertical" },
    B: { name: "Branch focus", layout: "vertical" },
    C: { name: "Horizontal flow", layout: "horizontal" },
    D: { name: "Natural-height map", layout: "vertical" },
};

const EFFECTS = {
    "CMP 1": { name: "Glue Compressor", accent: "#d4e0de", route: "TRUNK", values: ["42%", "3.1", "18ms", "+2.0"] },
    "DRV 1": { name: "Drive", accent: "#ff7b35", route: "LO", values: ["68%", "24%", "1.8k", "-2.1"] },
    "SAT 1": { name: "Saturator", accent: "#ff4f45", route: "LO", values: ["36%", "51%", "820", "+1.4"] },
    "OTT 1": { name: "OTT", accent: "#e4ca00", route: "MID / A", values: ["72%", "38%", "2.4k", "-4.8"] },
    "CHO 1": { name: "Chorus", accent: "#43d5ca", route: "MID / A", values: ["41%", "18ms", "0.7Hz", "82%"] },
    "PHS 1": { name: "Phaser", accent: "#a97cff", route: "MID / B", values: ["57%", "31%", "1.2Hz", "66%"] },
    "DLY 1": { name: "Delay", accent: "#55bfff", route: "MID / B", values: ["29%", "3/16", "42%", "7.2k"] },
    "CRS 1": { name: "Crusher", accent: "#ff78ad", route: "HI", values: ["46%", "12bit", "31%", "-1.8"] },
    "DLY 2": { name: "Delay", accent: "#55bfff", route: "HI", values: ["22%", "1/8", "28%", "9.1k"] },
    "EQ 1": { name: "Parametric EQ", accent: "#9ee493", route: "MID", values: ["+2.4", "860", "1.2", "71%"] },
    "EQ 2": { name: "Tilt EQ", accent: "#b4e778", route: "TRUNK", values: ["+1.8", "1.4k", "0.8", "64%"] },
    "FLT 1": { name: "Filter", accent: "#ff9b55", route: "HI", values: ["58%", "4.8k", "0.7", "24%"] },
    "REV 1": { name: "Reverb", accent: "#9b8cff", route: "PAR / A", values: ["38%", "2.8s", "41%", "6.4k"] },
    "DLY 3": { name: "Delay", accent: "#55bfff", route: "PAR / A", values: ["31%", "1/4", "47%", "8.2k"] },
    "PAN 1": { name: "Auto Pan", accent: "#ff78ad", route: "PAR / A", values: ["62%", "1/8", "180°", "52%"] },
    "FLG 1": { name: "Flanger", accent: "#62d7ba", route: "PAR / B", values: ["44%", "7ms", "0.4Hz", "68%"] },
    "LIM 1": { name: "Limiter", accent: "#75e28a", route: "TRUNK", values: ["63%", "-0.3", "54ms", "+1.1"] },
};

const state = {
    selectedEffect: "OTT 1",
    focusedBand: "mid",
    focusedNested: "a",
    recommendationScrollTop: 0,
};

const app = document.querySelector("#app");

function activeVariant() {
    const requested = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
    return requested && VARIANTS[requested] ? requested : "A";
}

function selectionClass(label) {
    return state.selectedEffect === label ? " is-selected" : "";
}

function stationVertical(x, y, label) {
    const effect = EFFECTS[label];
    return `<g class="station station-vertical${selectionClass(label)}" data-effect="${label}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <rect x="-10" y="-27" width="20" height="54" rx="10" />
        <text transform="rotate(-90)" text-anchor="middle" dominant-baseline="central">${label}</text>
    </g>`;
}

function stationPill(x, y, label, compact = false) {
    const effect = EFFECTS[label];
    const width = compact ? 40 : 46;
    return `<g class="station station-pill${compact ? " is-compact" : ""}${selectionClass(label)}" data-effect="${label}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <rect x="${-width / 2}" y="-11" width="${width}" height="22" rx="11" />
        <text text-anchor="middle" dominant-baseline="central">${label}</text>
    </g>`;
}

function stationStop(x, y, label) {
    const effect = EFFECTS[label];
    return `<g class="station station-stop${selectionClass(label)}" data-effect="${label}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <circle class="station-stop-hit" r="14" />
        <circle class="station-stop-core" r="4.5" />
    </g>`;
}

function stationGlyph(x, y, label, glyph) {
    const effect = EFFECTS[label];
    return `<g class="station station-glyph${selectionClass(label)}" data-effect="${label}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <circle class="station-glyph-hit" r="20" />
        <rect x="-11" y="-11" width="22" height="22" rx="7" />
        <text text-anchor="middle" dominant-baseline="central">${glyph}</text>
        <title>${effect.name} — ${label}</title>
    </g>`;
}

function insertion(x, y, active = true) {
    return `<g class="insertion${active ? " is-active" : ""}" transform="translate(${x} ${y})">
        <circle r="${active ? 8 : 5.5}" />
        <path d="M-3 0H3M0-3V3" />
    </g>`;
}

function commonSvgDefinitions() {
    return `<defs>
        <filter id="route-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
    </defs>`;
}

function sidewaysGraph() {
    return `<section class="map-stage map-stage-vertical" aria-label="Sideways tag FX graph">
        <svg class="graph-svg" viewBox="0 0 122 720" role="img" aria-label="Frequency split with a parallel split nested in the mid band">
            ${commonSvgDefinitions()}
            <g class="routes">
                <path class="route route-trunk" d="M61 0V86" />
                <path class="route route-lo" d="M61 86C61 108 18 106 18 136V526C18 548 61 548 61 574" />
                <path class="route route-mid" d="M61 86V166" />
                <path class="route route-mid" d="M61 166C61 184 49 187 49 210V446C49 463 61 464 61 478" />
                <path class="route route-mid" d="M61 166C61 184 73 187 73 210V446C73 463 61 464 61 478" />
                <path class="route route-mid" d="M61 478V574" />
                <path class="route route-hi" d="M61 86C61 108 104 106 104 136V526C104 548 61 548 61 574" />
                <path class="route route-trunk" d="M61 574V720" />
            </g>
            <g class="junctions">
                <rect class="split-diamond" x="55" y="80" width="12" height="12" rx="2" transform="rotate(45 61 86)" />
                <circle class="parallel-fork" cx="61" cy="166" r="7" />
                <circle class="merge-dot" cx="61" cy="478" r="7" />
                <circle class="merge-dot" cx="61" cy="574" r="7" />
            </g>
            <g class="band-labels">
                <text x="18" y="128">LO</text><text x="61" y="128">MID</text><text x="104" y="128">HI</text>
                <text class="nested-label" x="49" y="203">A</text><text class="nested-label" x="73" y="203">B</text>
            </g>
            ${stationVertical(61, 43, "CMP 1")}
            ${stationVertical(18, 190, "DRV 1")}
            ${stationVertical(18, 316, "SAT 1")}
            ${insertion(18, 432)}
            ${stationVertical(49, 248, "OTT 1")}
            ${stationVertical(49, 354, "CHO 1")}
            ${insertion(49, 426)}
            ${stationVertical(73, 276, "PHS 1")}
            ${stationVertical(73, 382, "DLY 1")}
            ${insertion(73, 450)}
            ${insertion(61, 520)}
            ${stationVertical(104, 214, "CRS 1")}
            ${stationVertical(104, 340, "DLY 2")}
            ${insertion(104, 456)}
            ${stationVertical(61, 634, "LIM 1")}
            ${insertion(61, 692)}
        </svg>
    </section>`;
}

function focusLayout() {
    if (state.focusedBand === "lo") {
        return { outer: { lo: 48, mid: 92, hi: 112 }, nested: { a: 86, b: 100 } };
    }
    if (state.focusedBand === "hi") {
        return { outer: { lo: 10, mid: 30, hi: 74 }, nested: { a: 24, b: 38 } };
    }
    return state.focusedNested === "a"
        ? { outer: { lo: 14, mid: 61, hi: 110 }, nested: { a: 52, b: 94 } }
        : { outer: { lo: 12, mid: 61, hi: 108 }, nested: { a: 28, b: 70 } };
}

function focusedOrStops(band, x, effects, ys) {
    if (state.focusedBand === band) {
        return effects.map((label, index) => stationPill(x, ys[index], label)).join("");
    }
    return effects.map((label, index) => stationStop(x, ys[index], label)).join("");
}

function focusGraph() {
    const { outer, nested } = focusLayout();
    const midActive = state.focusedBand === "mid";
    const nestedAActive = midActive && state.focusedNested === "a";
    const nestedBActive = midActive && state.focusedNested === "b";
    const nestedAStations = nestedAActive
        ? `${stationPill(nested.a, 260, "OTT 1")}${stationPill(nested.a, 360, "CHO 1")}`
        : `${stationStop(nested.a, 260, "OTT 1")}${stationStop(nested.a, 360, "CHO 1")}`;
    const nestedBStations = nestedBActive
        ? `${stationPill(nested.b, 260, "PHS 1")}${stationPill(nested.b, 360, "DLY 1")}`
        : `${stationStop(nested.b, 260, "PHS 1")}${stationStop(nested.b, 360, "DLY 1")}`;

    return `<section class="map-stage map-stage-vertical" aria-label="Focused branch FX graph">
        <svg class="graph-svg" viewBox="0 0 122 720" role="img" aria-label="One expanded frequency band, with other paths reduced to colored stops">
            ${commonSvgDefinitions()}
            <g class="routes">
                <path class="route route-trunk" d="M61 0V90" />
                <path class="route route-lo${state.focusedBand === "lo" ? " is-focus" : " is-muted"}" d="M61 90C61 116 ${outer.lo} 112 ${outer.lo} 144V530C${outer.lo} 552 61 548 61 578" />
                <path class="route route-mid${midActive ? " is-focus" : " is-muted"}" d="M61 90C61 116 ${outer.mid} 112 ${outer.mid} 144V176" />
                <path class="route route-mid${nestedAActive ? " is-focus" : " is-muted"}" d="M${outer.mid} 176C${outer.mid} 198 ${nested.a} 198 ${nested.a} 224V438C${nested.a} 458 ${outer.mid} 458 ${outer.mid} 474" />
                <path class="route route-mid${nestedBActive ? " is-focus" : " is-muted"}" d="M${outer.mid} 176C${outer.mid} 198 ${nested.b} 198 ${nested.b} 224V438C${nested.b} 458 ${outer.mid} 458 ${outer.mid} 474" />
                <path class="route route-mid${midActive ? " is-focus" : " is-muted"}" d="M${outer.mid} 474V530C${outer.mid} 552 61 548 61 578" />
                <path class="route route-hi${state.focusedBand === "hi" ? " is-focus" : " is-muted"}" d="M61 90C61 116 ${outer.hi} 112 ${outer.hi} 144V530C${outer.hi} 552 61 548 61 578" />
                <path class="route route-trunk" d="M61 578V720" />
            </g>
            <g class="junctions">
                <rect class="split-diamond" x="55" y="84" width="12" height="12" rx="2" transform="rotate(45 61 90)" />
                <circle class="parallel-fork" cx="${outer.mid}" cy="176" r="7" />
                <circle class="merge-dot" cx="${outer.mid}" cy="474" r="7" />
                <circle class="merge-dot" cx="61" cy="578" r="7" />
            </g>
            <g class="focus-choices">
                ${["lo", "mid", "hi"].map((band) => `<g class="focus-choice${state.focusedBand === band ? " is-active" : ""}" data-focus-band="${band}" transform="translate(${outer[band]} 132)"><circle r="15"/><text text-anchor="middle" dominant-baseline="central">${band.toUpperCase()}</text></g>`).join("")}
                <g class="nested-choice${nestedAActive ? " is-active" : ""}" data-focus-nested="a" transform="translate(${nested.a} 214)"><circle r="10"/><text text-anchor="middle" dominant-baseline="central">A</text></g>
                <g class="nested-choice${nestedBActive ? " is-active" : ""}" data-focus-nested="b" transform="translate(${nested.b} 214)"><circle r="10"/><text text-anchor="middle" dominant-baseline="central">B</text></g>
            </g>
            ${stationPill(61, 45, "CMP 1")}
            ${focusedOrStops("lo", outer.lo, ["DRV 1", "SAT 1"], [246, 366])}
            ${insertion(outer.lo, 490, state.focusedBand === "lo")}
            ${nestedAStations}${nestedBStations}
            ${insertion(nested.a, 420, nestedAActive)}${insertion(nested.b, 420, nestedBActive)}
            ${insertion(outer.mid, 515, midActive)}
            ${focusedOrStops("hi", outer.hi, ["CRS 1", "DLY 2"], [246, 366])}
            ${insertion(outer.hi, 490, state.focusedBand === "hi")}
            ${stationPill(61, 632, "LIM 1")}
            ${insertion(61, 690)}
        </svg>
    </section>`;
}

function horizontalGraph() {
    return `<section class="map-stage map-stage-horizontal" aria-label="Horizontal FX graph">
        <svg class="graph-svg" viewBox="0 0 390 292" role="img" aria-label="Frequency split flowing left to right with a parallel split nested in the mid band">
            ${commonSvgDefinitions()}
            <g class="routes">
                <path class="route route-trunk" d="M0 146H36" />
                <path class="route route-lo" d="M36 146C58 146 52 48 76 48H334C354 48 350 146 372 146" />
                <path class="route route-mid" d="M36 146H112" />
                <path class="route route-mid" d="M112 146C132 146 125 112 148 112H268C284 112 280 146 296 146" />
                <path class="route route-mid" d="M112 146C132 146 125 180 148 180H268C284 180 280 146 296 146" />
                <path class="route route-mid" d="M296 146H372" />
                <path class="route route-hi" d="M36 146C58 146 52 244 76 244H334C354 244 350 146 372 146" />
                <path class="route route-trunk" d="M372 146H390" />
            </g>
            <g class="junctions">
                <rect class="split-diamond" x="30" y="140" width="12" height="12" rx="2" transform="rotate(45 36 146)" />
                <circle class="parallel-fork" cx="112" cy="146" r="7" />
                <circle class="merge-dot" cx="296" cy="146" r="7" />
                <circle class="merge-dot" cx="372" cy="146" r="7" />
            </g>
            <g class="band-labels horizontal-labels">
                <text x="76" y="35">LO</text><text x="83" y="136">MID</text><text x="76" y="232">HI</text>
                <text class="nested-label" x="144" y="101">A</text><text class="nested-label" x="144" y="201">B</text>
            </g>
            ${stationPill(122, 48, "DRV 1")}${stationPill(212, 48, "SAT 1")}${insertion(286, 48)}
            ${stationPill(174, 112, "OTT 1", true)}${stationPill(226, 112, "CHO 1", true)}${insertion(268, 112)}
            ${stationPill(174, 180, "PHS 1", true)}${stationPill(226, 180, "DLY 1", true)}${insertion(268, 180)}
            ${insertion(329, 146)}
            ${stationPill(122, 244, "CRS 1")}${stationPill(212, 244, "DLY 2")}${insertion(286, 244)}
        </svg>
    </section>`;
}

function naturalHeightGraph() {
    return `<section class="map-stage map-stage-natural" aria-label="Natural-height FX graph">
        <div class="natural-scroll" data-root-graph-scroll>
          <svg class="graph-svg graph-svg-natural" viewBox="0 0 144 1540" role="img" aria-label="One vertically scrolling FX graph with a nested frequency split followed by an unequal parallel split">
            ${commonSvgDefinitions()}
            <g class="routes">
                <path class="route route-trunk" d="M72 0V112" />

                <path class="route route-lo" d="M72 112C72 132 20 132 20 166V690C20 714 72 714 72 742" />
                <path class="route route-mid" d="M72 112V236" />
                <path class="route route-mid nested-route" d="M72 236C72 256 54 256 54 282V604C54 626 72 626 72 648" />
                <path class="route route-mid nested-route" d="M72 236C72 256 90 256 90 282V604C90 626 72 626 72 648" />
                <path class="route route-mid" d="M72 648V742" />
                <path class="route route-hi" d="M72 112C72 132 124 132 124 166V690C124 714 72 714 72 742" />

                <path class="route route-trunk" d="M72 742V884" />

                <path class="route route-parallel" d="M72 884C72 906 38 906 38 936V1278C38 1302 72 1302 72 1328" />
                <path class="route route-parallel" d="M72 884C72 906 106 906 106 936V1278C106 1302 72 1302 72 1328" />

                <path class="route route-trunk" d="M72 1328V1540" />
            </g>

            <g class="junctions">
                <rect class="split-diamond" x="66" y="106" width="12" height="12" rx="2" transform="rotate(45 72 112)" />
                <circle class="parallel-fork" cx="72" cy="236" r="7" />
                <circle class="merge-dot" cx="72" cy="648" r="7" />
                <circle class="merge-dot" cx="72" cy="742" r="7" />
                <circle class="parallel-fork" cx="72" cy="884" r="7" />
                <circle class="merge-dot" cx="72" cy="1328" r="7" />
            </g>

            <g class="band-labels natural-labels">
                <text x="20" y="158">LO</text><text x="72" y="158">MID</text><text x="124" y="158">HI</text>
                <text class="nested-label" x="54" y="275">A</text><text class="nested-label" x="90" y="275">B</text>
                <text x="38" y="928">A</text><text x="106" y="928">B</text>
            </g>

            ${stationPill(72, 54, "CMP 1")}

            ${stationGlyph(20, 244, "DRV 1", "D")}
            ${stationGlyph(20, 366, "SAT 1", "S")}
            ${insertion(20, 522)}

            ${stationGlyph(72, 190, "EQ 1", "E")}
            ${stationStop(54, 330, "OTT 1")}
            ${stationStop(54, 446, "CHO 1")}
            ${insertion(54, 560)}
            ${stationStop(90, 312, "PHS 1")}
            ${stationStop(90, 406, "DLY 1")}
            ${stationStop(90, 500, "DLY 2")}
            ${insertion(90, 570)}
            ${insertion(72, 686)}

            ${stationGlyph(124, 274, "CRS 1", "C")}
            ${stationGlyph(124, 426, "FLT 1", "F")}
            ${insertion(124, 574)}

            ${stationPill(72, 810, "EQ 2")}

            ${stationPill(38, 982, "REV 1")}
            ${stationPill(38, 1088, "DLY 3")}
            ${stationPill(38, 1194, "PAN 1")}
            ${insertion(38, 1254)}
            ${stationPill(106, 1014, "FLG 1")}
            ${insertion(106, 1082)}

            ${stationPill(72, 1410, "LIM 1")}
            ${insertion(72, 1490)}
          </svg>
        </div>
        <div class="scroll-cue scroll-cue-top" aria-hidden="true"><span>⌃</span></div>
        <div class="scroll-cue scroll-cue-bottom" aria-hidden="true"><span>⌄</span></div>
    </section>`;
}

function editorPanel(layout) {
    const effect = EFFECTS[state.selectedEffect] ?? EFFECTS["OTT 1"];
    const labels = ["MIX", "SHAPE", "TIME", "TONE"];
    return `<section class="effect-panel effect-panel-${layout}" style="--effect-accent:${effect.accent}" aria-label="Selected effect controls">
        <header class="rack-toolbar">
            <span class="rack-mark">FX 07</span>
            <span class="rack-actions"><i></i><i></i><i></i></span>
        </header>
        <div class="effect-heading">
            <div><span class="effect-route">${effect.route}</span><h1>${state.selectedEffect}</h1><p>${effect.name}</p></div>
            <button type="button" class="power" aria-label="Effect power">◉</button>
        </div>
        <div class="effect-display" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="parameter-grid">
            ${labels.map((label, index) => `<div class="parameter"><div class="knob" style="--turn:${[68, 42, 57, 76][index]}%"><i></i></div><span>${label}</span><strong>${effect.values[index]}</strong></div>`).join("")}
        </div>
        <div class="effect-footer"><button type="button">PRESET</button><button type="button">MOD</button><button type="button">•••</button></div>
    </section>`;
}

function switcher(variant) {
    const keys = Object.keys(VARIANTS);
    return `<nav class="prototype-switcher" aria-label="Prototype variants">
        <button type="button" data-action="previous-variant" aria-label="Previous variant">‹</button>
        <div><span>PROTOTYPE ${keys.indexOf(variant) + 1}/${keys.length}</span><strong>${VARIANTS[variant].name}</strong></div>
        <button type="button" data-action="next-variant" aria-label="Next variant">›</button>
    </nav>`;
}

function render() {
    const variant = activeVariant();
    const graph = variant === "A"
        ? sidewaysGraph()
        : variant === "B"
            ? focusGraph()
            : variant === "C"
                ? horizontalGraph()
                : naturalHeightGraph();
    const layout = VARIANTS[variant].layout;
    app.innerHTML = `<div class="prototype-shell variant-${variant.toLowerCase()} layout-${layout}">${graph}${editorPanel(layout)}</div>${switcher(variant)}`;
    setupRecommendationScroller();
}

function setupRecommendationScroller() {
    const scroller = app.querySelector("[data-root-graph-scroll]");
    if (!scroller) { return; }

    scroller.scrollTop = state.recommendationScrollTop;
    const updateCues = () => {
        const atTop = scroller.scrollTop <= 2;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        scroller.classList.toggle("is-at-top", atTop);
        scroller.classList.toggle("is-at-bottom", atBottom);
        state.recommendationScrollTop = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", updateCues, { passive: true });
    updateCues();
}

function setVariant(direction) {
    const keys = Object.keys(VARIANTS);
    const currentIndex = keys.indexOf(activeVariant());
    const next = keys[(currentIndex + direction + keys.length) % keys.length];
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    render();
}

app.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "previous-variant") { setVariant(-1); return; }
    if (action === "next-variant") { setVariant(1); return; }

    const effectNode = event.target.closest("[data-effect]");
    if (effectNode) {
        state.selectedEffect = effectNode.dataset.effect;
        render();
        return;
    }

    const bandNode = event.target.closest("[data-focus-band]");
    if (bandNode) {
        state.focusedBand = bandNode.dataset.focusBand;
        state.selectedEffect = { lo: "DRV 1", mid: state.focusedNested === "a" ? "OTT 1" : "PHS 1", hi: "CRS 1" }[state.focusedBand];
        render();
        return;
    }

    const nestedNode = event.target.closest("[data-focus-nested]");
    if (nestedNode) {
        state.focusedBand = "mid";
        state.focusedNested = nestedNode.dataset.focusNested;
        state.selectedEffect = state.focusedNested === "a" ? "OTT 1" : "PHS 1";
        render();
    }
});

window.addEventListener("popstate", render);
window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setVariant(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); setVariant(1); }
});

render();
