// PROTOTYPE — throwaway mobile FX graph density studies, switchable with ?variant=A|B|C|D.

const VARIANTS = {
    A: { name: "Sideways tags", layout: "vertical" },
    B: { name: "Branch focus", layout: "vertical" },
    C: { name: "Horizontal flow", layout: "horizontal" },
    D: { name: "Natural + focus", layout: "vertical" },
};

const EFFECTS = {
    "CMP 1": { name: "Glue Compressor", icon: "cmp", accent: "#d4e0de", route: "TRUNK", values: ["42%", "3.1", "18ms", "+2.0"] },
    "DRV 1": { name: "Drive", icon: "drive", accent: "#ff7b35", route: "LO", values: ["68%", "24%", "1.8k", "-2.1"] },
    "SAT 1": { name: "Saturator", icon: "saturator", accent: "#ff4f45", route: "LO", values: ["36%", "51%", "820", "+1.4"] },
    "OTT 1": { name: "OTT", icon: "ott", accent: "#e4ca00", route: "MID / A", values: ["72%", "38%", "2.4k", "-4.8"] },
    "CHO 1": { name: "Chorus", icon: "chorus", accent: "#43d5ca", route: "MID / A", values: ["41%", "18ms", "0.7Hz", "82%"] },
    "PHS 1": { name: "Phaser", icon: "phaser", accent: "#a97cff", route: "MID / B", values: ["57%", "31%", "1.2Hz", "66%"] },
    "DLY 1": { name: "Delay", icon: "delay", accent: "#55bfff", route: "MID / B", values: ["29%", "3/16", "42%", "7.2k"] },
    "CRS 1": { name: "Crusher", icon: "crusher", accent: "#ff78ad", route: "HI", values: ["46%", "12bit", "31%", "-1.8"] },
    "DLY 2": { name: "Delay", icon: "delay", accent: "#55bfff", route: "HI", values: ["22%", "1/8", "28%", "9.1k"] },
    "EQ 1": { name: "Parametric EQ", icon: "eq", accent: "#9ee493", route: "MID", values: ["+2.4", "860", "1.2", "71%"] },
    "EQ 2": { name: "Tilt EQ", icon: "eq", accent: "#b4e778", route: "TRUNK", values: ["+1.8", "1.4k", "0.8", "64%"] },
    "FLT 1": { name: "Filter", icon: "filter", accent: "#ff9b55", route: "HI", values: ["58%", "4.8k", "0.7", "24%"] },
    "REV 1": { name: "Reverb", icon: "reverb", accent: "#9b8cff", route: "PAR / A", values: ["38%", "2.8s", "41%", "6.4k"] },
    "DLY 3": { name: "Delay", icon: "delay", accent: "#55bfff", route: "PAR / A", values: ["31%", "1/4", "47%", "8.2k"] },
    "PAN 1": { name: "Auto Pan", icon: "pan", accent: "#ff78ad", route: "PAR / A", values: ["62%", "1/8", "180°", "52%"] },
    "FLG 1": { name: "Flanger", icon: "flanger", accent: "#62d7ba", route: "PAR / B", values: ["44%", "7ms", "0.4Hz", "68%"] },
    "LIM 1": { name: "Limiter", icon: "limiter", accent: "#75e28a", route: "TRUNK", values: ["63%", "-0.3", "54ms", "+1.1"] },
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
    return requested && VARIANTS[requested] ? requested : "D";
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

function stationGlyph(x, y, label, glyph) {
    const effect = EFFECTS[label];
    return `<g class="station station-glyph${selectionClass(label)}" data-effect="${label}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <circle class="station-glyph-hit" r="20" />
        <rect x="-11" y="-11" width="22" height="22" rx="7" />
        <text text-anchor="middle" dominant-baseline="central">${glyph}</text>
        <title>${effect.name} — ${label}</title>
    </g>`;
}

function effectIconHref(label) {
    return `./assets/effect-icons/${EFFECTS[label].icon}.png`;
}

function stationDetail(x, y, label, availableWidth = 58) {
    const effect = EFFECTS[label];
    const width = Math.max(44, Math.min(58, availableWidth - 4));
    const hitWidth = Math.max(48, width);
    return `<g class="station station-detail${selectionClass(label)}" data-effect="${label}" data-representation="detail" role="button" tabindex="0" aria-label="Select ${effect.name}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <rect class="station-detail-hit" x="${-hitWidth / 2}" y="-24" width="${hitWidth}" height="48" rx="6" />
        <rect class="station-detail-frame" x="${-width / 2}" y="-13" width="${width}" height="26" rx="13" />
        <image class="station-image" href="${effectIconHref(label)}" x="${-width / 2 + 5}" y="-8" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
        <text x="${-width / 2 + 24}" text-anchor="start" dominant-baseline="central">${label}</text>
        <title>${effect.name} — ${effect.route}</title>
    </g>`;
}

function stationIcon(x, y, label, availableWidth = 24, canvasWidth = 144) {
    const effect = EFFECTS[label];
    const hitWidth = Math.max(48, availableWidth);
    const hitLeft = Math.min(Math.max(-hitWidth / 2, -x), canvasWidth - x - hitWidth);
    return `<g class="station station-icon${selectionClass(label)}" data-effect="${label}" data-representation="icon" role="button" tabindex="0" aria-label="Select ${effect.name}" style="--accent:${effect.accent}" transform="translate(${x} ${y})">
        <rect class="station-icon-hit" x="${hitLeft}" y="-24" width="${hitWidth}" height="48" rx="6" />
        <rect class="station-icon-frame" x="-10" y="-10" width="20" height="20" rx="7" />
        <image class="station-image" href="${effectIconHref(label)}" x="-7" y="-7" width="14" height="14" preserveAspectRatio="xMidYMid meet" />
        <title>${effect.name} — tap to expand ${effect.route}</title>
    </g>`;
}

function branchBadge(x, y, label, className = "", connection = null) {
    const connectionAttributes = connection
        ? ` data-branch-node="${connection.node}" data-anchor-x="${x}" data-anchor-y="${y}" data-child-anchor="${connection.childAnchor}"`
        : "";
    const childPort = connection ? '<path class="branch-badge-child-port" d="M0 9V18" />' : "";
    return `<g class="branch-badge ${className}"${connectionAttributes} transform="translate(${x} ${y})" aria-hidden="true">
        <circle r="9" />
        ${childPort}
        <text text-anchor="middle" dominant-baseline="central">${label}</text>
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
    return effects.map((label, index) => stationIcon(x, ys[index], label, 24, 122)).join("");
}

function focusGraph() {
    const { outer, nested } = focusLayout();
    const midActive = state.focusedBand === "mid";
    const nestedAActive = midActive && state.focusedNested === "a";
    const nestedBActive = midActive && state.focusedNested === "b";
    const nestedAStations = nestedAActive
        ? `${stationPill(nested.a, 260, "OTT 1")}${stationPill(nested.a, 360, "CHO 1")}`
        : `${stationIcon(nested.a, 260, "OTT 1", 24, 122)}${stationIcon(nested.a, 360, "CHO 1", 24, 122)}`;
    const nestedBStations = nestedBActive
        ? `${stationPill(nested.b, 260, "PHS 1")}${stationPill(nested.b, 360, "DLY 1")}`
        : `${stationIcon(nested.b, 260, "PHS 1", 24, 122)}${stationIcon(nested.b, 360, "DLY 1", 24, 122)}`;

    return `<section class="map-stage map-stage-vertical" aria-label="Focused branch FX graph">
        <svg class="graph-svg" viewBox="0 0 122 720" role="img" aria-label="One expanded frequency band, with other paths reduced to effect icons">
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

function selectedNaturalPath() {
    const route = EFFECTS[state.selectedEffect]?.route ?? "TRUNK";
    if (route === "LO") { return { outer: "lo", nested: null }; }
    if (route === "HI") { return { outer: "hi", nested: null }; }
    if (route === "MID / A") { return { outer: "mid", nested: "a" }; }
    if (route === "MID / B") { return { outer: "mid", nested: "b" }; }
    if (route === "MID") { return { outer: "mid", nested: null }; }
    return { outer: null, nested: null };
}

function allocateHorizontalBands(widths) {
    let left = 0;
    return Object.fromEntries(Object.entries(widths).map(([name, width]) => {
        const band = { left, width, x: left + width / 2 };
        left += width;
        return [name, band];
    }));
}

function naturalOuterLayout(focus) {
    if (focus === "lo") { return allocateHorizontalBands({ lo: 70, mid: 50, hi: 24 }); }
    if (focus === "mid") { return allocateHorizontalBands({ lo: 24, mid: 96, hi: 24 }); }
    if (focus === "hi") { return allocateHorizontalBands({ lo: 24, mid: 50, hi: 70 }); }
    return allocateHorizontalBands({ lo: 34, mid: 76, hi: 34 });
}

function naturalNestedLayout(mid, focus) {
    const compactWidth = 24;
    if (focus === "a") {
        return allocateHorizontalBands({ a: mid.width - compactWidth, b: compactWidth });
    }
    if (focus === "b") {
        return allocateHorizontalBands({ a: compactWidth, b: mid.width - compactWidth });
    }
    return allocateHorizontalBands({ a: mid.width / 2, b: mid.width / 2 });
}

function offsetBand(band, offset) {
    return { ...band, left: band.left + offset, x: band.x + offset };
}

function naturalStation(mode, band, y, label) {
    return mode === "detail"
        ? stationDetail(band.x, y, label, band.width)
        : stationIcon(band.x, y, label, band.width);
}

function focusedParentChildRoute(outer, nested, focus) {
    if (focus.outer !== "mid" || !focus.nested) { return ""; }

    const child = nested[focus.nested];
    return `<g class="selected-hierarchy-route-layer" aria-hidden="true">
        <path class="route route-mid selected-hierarchy-route" data-route-role="parent-child-continuous" data-parent-branch="mid" data-child-branch="${focus.nested}" data-child-x="${child.x}" data-start="72,112" data-end="72,770" d="M72 112C72 136 ${outer.mid.x} 136 ${outer.mid.x} 166V272C${outer.mid.x} 294 ${child.x} 294 ${child.x} 322V674C${child.x} 700 ${outer.mid.x} 698 ${outer.mid.x} 718V724C${outer.mid.x} 744 72 744 72 770" />
    </g>`;
}

function naturalHeightGraph() {
    const focus = selectedNaturalPath();
    const outer = naturalOuterLayout(focus.outer);
    const nestedRelative = naturalNestedLayout(outer.mid, focus.nested);
    const nested = {
        a: offsetBand(nestedRelative.a, outer.mid.left),
        b: offsetBand(nestedRelative.b, outer.mid.left),
    };
    const modeForOuter = (branch) => focus.outer === branch ? "detail" : "icon";
    const modeForNested = (branch) => focus.outer === "mid" && focus.nested === branch ? "detail" : "icon";
    const focusClass = (branch) => focus.outer === branch ? " is-focus" : "";
    const nestedFocusClass = (branch) => focus.nested === branch ? " is-focus" : "";

    return `<section class="map-stage map-stage-natural" aria-label="Natural-height focus-spine FX graph">
        <div class="natural-scroll" data-root-graph-scroll data-scroll-owner="root">
          <svg class="graph-svg graph-svg-natural" viewBox="0 0 144 1548" data-focus-outer="${focus.outer ?? "none"}" data-focus-nested="${focus.nested ?? "none"}" role="img" aria-label="One vertically scrolling FX graph where the selected branch expands and siblings become icon rails">
            ${commonSvgDefinitions()}

            <g class="branch-zones" aria-hidden="true">
                <rect class="branch-zone branch-zone-lo${focusClass("lo")}" data-branch="lo" data-width="${outer.lo.width}" x="${outer.lo.left + 1}" y="145" width="${outer.lo.width - 2}" height="610" rx="9" />
                <rect class="branch-zone branch-zone-mid${focusClass("mid")}" data-branch="mid" data-width="${outer.mid.width}" x="${outer.mid.left + 1}" y="145" width="${outer.mid.width - 2}" height="610" rx="9" />
                <rect class="branch-zone branch-zone-hi${focusClass("hi")}" data-branch="hi" data-width="${outer.hi.width}" x="${outer.hi.left + 1}" y="145" width="${outer.hi.width - 2}" height="610" rx="9" />
                <rect class="nested-zone${nestedFocusClass("a")}" data-branch="mid-a" data-width="${nested.a.width}" x="${nested.a.left + 1}" y="292" width="${nested.a.width - 2}" height="415" rx="8" />
                <rect class="nested-zone${nestedFocusClass("b")}" data-branch="mid-b" data-width="${nested.b.width}" x="${nested.b.left + 1}" y="292" width="${nested.b.width - 2}" height="415" rx="8" />
            </g>

            <g class="routes">
                <path class="route route-trunk" data-route-id="root-in" d="M72 0V112" />

                <path class="route route-lo${focusClass("lo")}" data-route-id="outer-lo" data-start="72,112" data-end="72,770" d="M72 112C72 136 ${outer.lo.x} 136 ${outer.lo.x} 166V708C${outer.lo.x} 742 72 742 72 770" />
                <path class="route route-mid${focusClass("mid")}" data-route-id="outer-mid-in" data-start="72,112" data-end="${outer.mid.x},272" d="M72 112C72 136 ${outer.mid.x} 136 ${outer.mid.x} 166V272" />
                <path class="route route-mid nested-route${nestedFocusClass("a")}" data-route-id="nested-a" data-start="${outer.mid.x},272" data-end="${outer.mid.x},718" d="M${outer.mid.x} 272C${outer.mid.x} 294 ${nested.a.x} 294 ${nested.a.x} 322V674C${nested.a.x} 700 ${outer.mid.x} 698 ${outer.mid.x} 718" />
                <path class="route route-mid nested-route${nestedFocusClass("b")}" data-route-id="nested-b" data-start="${outer.mid.x},272" data-end="${outer.mid.x},718" d="M${outer.mid.x} 272C${outer.mid.x} 294 ${nested.b.x} 294 ${nested.b.x} 322V674C${nested.b.x} 700 ${outer.mid.x} 698 ${outer.mid.x} 718" />
                <path class="route route-mid${focusClass("mid")}" data-route-id="outer-mid-out" data-start="${outer.mid.x},718" data-end="72,770" d="M${outer.mid.x} 718V724C${outer.mid.x} 744 72 744 72 770" />
                <path class="route route-hi${focusClass("hi")}" data-route-id="outer-hi" data-start="72,112" data-end="72,770" d="M72 112C72 136 ${outer.hi.x} 136 ${outer.hi.x} 166V708C${outer.hi.x} 742 72 742 72 770" />

                <path class="route route-trunk" data-route-id="between-splits" d="M72 770V920" />

                <path class="route route-parallel" data-route-id="later-a" data-start="72,920" data-end="72,1350" d="M72 920C72 944 40 944 40 976V1292C40 1320 72 1320 72 1350" />
                <path class="route route-parallel" data-route-id="later-b" data-start="72,920" data-end="72,1350" d="M72 920C72 944 104 944 104 976V1292C104 1320 72 1320 72 1350" />

                <path class="route route-trunk" data-route-id="root-out" d="M72 1350V1548" />
            </g>

            <g class="junctions">
                <rect class="split-diamond" data-junction="outer-split" x="66" y="106" width="12" height="12" rx="2" transform="rotate(45 72 112)" />
                <circle class="parallel-fork" data-junction="nested-split" cx="${outer.mid.x}" cy="272" r="7" />
                <circle class="merge-dot" data-junction="nested-merge" cx="${outer.mid.x}" cy="718" r="7" />
                <circle class="merge-dot" data-junction="outer-merge" cx="72" cy="770" r="7" />
                <circle class="parallel-fork" data-junction="later-split" cx="72" cy="920" r="7" />
                <circle class="merge-dot" data-junction="later-merge" cx="72" cy="1350" r="7" />
            </g>

            ${focusedParentChildRoute(outer, nested, focus)}

            <g class="branch-badges">
                ${branchBadge(outer.lo.x, 158, "LO", focus.outer === "lo" ? "is-focus" : "")}
                ${branchBadge(outer.mid.x, 158, "MID", focus.outer === "mid" ? "is-focus is-parent-node" : "is-parent-node", { node: "mid-parent", childAnchor: `${outer.mid.x},272` })}
                ${branchBadge(outer.hi.x, 158, "HI", focus.outer === "hi" ? "is-focus" : "")}
                ${branchBadge(nested.a.x, 310, "A", focus.nested === "a" ? "is-focus" : "")}
                ${branchBadge(nested.b.x, 310, "B", focus.nested === "b" ? "is-focus" : "")}
                ${branchBadge(40, 968, "A")}
                ${branchBadge(104, 968, "B")}
            </g>

            ${stationDetail(72, 54, "CMP 1", 64)}

            ${naturalStation(modeForOuter("lo"), outer.lo, 270, "DRV 1")}
            ${naturalStation(modeForOuter("lo"), outer.lo, 330, "SAT 1")}
            ${insertion(outer.lo.x, 650, focus.outer === "lo")}

            ${naturalStation(focus.outer === "mid" ? "detail" : "icon", outer.mid, 210, "EQ 1")}
            ${naturalStation(modeForNested("a"), nested.a, 450, "OTT 1")}
            ${naturalStation(modeForNested("a"), nested.a, 570, "CHO 1")}
            ${insertion(nested.a.x, 642, focus.nested === "a")}
            ${naturalStation(modeForNested("b"), nested.b, 390, "PHS 1")}
            ${naturalStation(modeForNested("b"), nested.b, 510, "DLY 1")}
            ${naturalStation(modeForNested("b"), nested.b, 630, "DLY 2")}
            ${insertion(nested.b.x, 656, focus.nested === "b")}
            ${insertion(outer.mid.x, 744, focus.outer === "mid")}

            ${naturalStation(modeForOuter("hi"), outer.hi, 270, "CRS 1")}
            ${naturalStation(modeForOuter("hi"), outer.hi, 330, "FLT 1")}
            ${insertion(outer.hi.x, 650, focus.outer === "hi")}

            ${stationDetail(72, 844, "EQ 2", 64)}

            ${stationDetail(40, 1030, "REV 1", 62)}
            ${stationDetail(40, 1138, "DLY 3", 62)}
            ${stationDetail(40, 1246, "PAN 1", 62)}
            ${insertion(40, 1306)}
            ${stationDetail(104, 1050, "FLG 1", 62)}
            ${insertion(104, 1132)}

            ${stationDetail(72, 1432, "LIM 1", 64)}
            ${insertion(72, 1512)}
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
            <div class="effect-heading-copy">
                <img class="effect-heading-icon" src="${effectIconHref(state.selectedEffect)}" alt="" />
                <div><span class="effect-route">${effect.route}</span><h1>${state.selectedEffect}</h1><p>${effect.name}</p></div>
            </div>
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

app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    const effectNode = event.target.closest("[data-effect]");
    if (!effectNode) { return; }
    event.preventDefault();
    effectNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

window.addEventListener("popstate", render);
window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setVariant(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); setVariant(1); }
});

render();
