// PROTOTYPE — readable mobile FX graph recommendation. Deliberately isolated from production.

// ---------------------------------------------------------------------------
// WIDTH LEDGER
//
// Every horizontal number in this file is spent out of VIEW_WIDTH here. Read
// this before changing any of them.
//
//   VIEW_WIDTH ......... 176  the narrow graph column beside the effect panel
//   DETAIL_CHIP_WIDTH ..  76  the one chip anatomy: 24px well + 20px icon + 13px label
//   DETAIL_LANE_MIN ....  80  chip + 2px lane padding per side
//   MIN_TOUCH_TARGET ...  44  minimum tappable lane body
//   RAIL_WIDTH .........  26  a folded lane: one 24px icon module + 1px margin per side
//
// Three interactive lanes fit the column: 88 + 44 + 44 = 176.
// Four DO NOT: 4 x 44 = 176 leaves zero width for a chip. MID hosts a nested
// parallel split, so focusing MID really means four simultaneous logical lanes
// (LO, nested A, nested B, HI). The rejected repair tried to survive that by
// shrinking the chip's icon well, icon, padding and type until a chip fitted in
// 56px. That is artwork compression, not allocation, and it is banned.
//
// The rule instead changes ownership by depth: when the focused branch of a
// split itself opens a deeper split, that split's UNFOCUSED siblings FOLD. A
// folded lane surrenders its 44px body, drops to a RAIL_WIDTH overview rail of
// context-only summary marks, and hands its tap ownership up to its badge,
// which keeps a full 44x44 handle on the badge row. That buys the corridor:
//
//   frequency, MID focused (nested split open, four logical lanes):
//       26 LO rail + 124 MID corridor + 26 HI rail = 176
//       124 MID = 80 focused nested lane + 44 nested icon lane
//       80 focused nested lane = 76 chip + 2px padding per side
//   frequency, LO or HI focused (three logical lanes, nothing folds):
//       88 focused + 44 icon + 44 icon = 176
//   trunk-level parallel split (no focus, both lanes are chips):
//       80 + 80 centred in 176
//
// Vertical pitch never participates: folding only reallocates width, so the
// graph height is identical in every focus state.
// ---------------------------------------------------------------------------
const VIEW_WIDTH = 176;
const ROOT_X = VIEW_WIDTH / 2;
const ROW_HEIGHT = 48;
const SPLIT_BEFORE = 8;
const FORK_LEAD = 24;
const BRANCH_LABEL_HEIGHT = 22;
const MERGE_LEAD = 18;
const SPLIT_AFTER = 8;
const MIN_TOUCH_TARGET = 44;
const COMPACT_ICON_SIZE = 28;
const COMPACT_WELL_SIZE = 32;
const ICON_SIZE = 20;
const ICON_WELL_WIDTH = 24;
const ICON_WELL_HEIGHT = 26;
const DETAIL_CHIP_WIDTH = 76;
const DETAIL_LANE_MIN = DETAIL_CHIP_WIDTH + 4;
const RAIL_WIDTH = ICON_WELL_WIDTH + 2;
const BADGE_CENTER_Y = 9;
const BADGE_HANDLE_RISE = MIN_TOUCH_TARGET - BRANCH_LABEL_HEIGHT;

if (BADGE_HANDLE_RISE > FORK_LEAD) {
    throw new Error(`badge handle needs ${BADGE_HANDLE_RISE}px of fork lead, only ${FORK_LEAD}px exists`);
}
const VARIANTS = {
    A: { label: "A", name: "Max restraint" },
    B: { label: "B", name: "Sharp routing" },
    C: { label: "C", name: "Machined" },
};
const requestedVariant = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
const activeVariant = requestedVariant in VARIANTS ? requestedVariant : "A";

document.documentElement.dataset.fxGraphVariant = activeVariant;

const ICON_URLS = {
    chorus: new URL("./assets/effect-icons/chorus-v2.png", import.meta.url).href,
    cmp: new URL("./assets/effect-icons/cmp-v2.png", import.meta.url).href,
    crusher: new URL("./assets/effect-icons/crusher-v2.png", import.meta.url).href,
    delay: new URL("./assets/effect-icons/delay-v2.png", import.meta.url).href,
    drive: new URL("./assets/effect-icons/drive-v2.png", import.meta.url).href,
    eq: new URL("./assets/effect-icons/eq-v2.png", import.meta.url).href,
    filter: new URL("./assets/effect-icons/filter-v2.png", import.meta.url).href,
    flanger: new URL("./assets/effect-icons/flanger-v2.png", import.meta.url).href,
    limiter: new URL("./assets/effect-icons/limiter-v2.png", import.meta.url).href,
    ott: new URL("./assets/effect-icons/ott-v2.png", import.meta.url).href,
    pan: new URL("./assets/effect-icons/pan-v2.png", import.meta.url).href,
    phaser: new URL("./assets/effect-icons/phaser-v2.png", import.meta.url).href,
    reverb: new URL("./assets/effect-icons/reverb-v2.png", import.meta.url).href,
    saturator: new URL("./assets/effect-icons/saturator-v2.png", import.meta.url).href,
};

const EFFECT_TEMPLATES = {
    cmp: { code: "CMP", name: "Glue Compressor", icon: "cmp", accent: "#54d5c2", values: ["42%", "3.1", "18ms", "+2.0"] },
    drive: { code: "DRV", name: "Drive", icon: "drive", accent: "#ff7b35", values: ["68%", "24%", "1.8k", "-2.1"] },
    saturator: { code: "SAT", name: "Saturator", icon: "saturator", accent: "#ff4f45", values: ["36%", "51%", "820", "+1.4"] },
    ott: { code: "OTT", name: "OTT", icon: "ott", accent: "#f2ca00", values: ["72%", "38%", "2.4k", "-4.8"] },
    chorus: { code: "CHO", name: "Chorus", icon: "chorus", accent: "#43d5ca", values: ["41%", "18ms", "0.7Hz", "82%"] },
    phaser: { code: "PHS", name: "Phaser", icon: "phaser", accent: "#a97cff", values: ["57%", "31%", "1.2Hz", "66%"] },
    delay: { code: "DLY", name: "Delay", icon: "delay", accent: "#55bfff", values: ["29%", "3/16", "42%", "7.2k"] },
    crusher: { code: "CRS", name: "Crusher", icon: "crusher", accent: "#ff78ad", values: ["46%", "12bit", "31%", "-1.8"] },
    eq: { code: "EQ", name: "Parametric EQ", icon: "eq", accent: "#9ee493", values: ["+2.4", "860", "1.2", "71%"] },
    filter: { code: "FLT", name: "Filter", icon: "filter", accent: "#ff9b55", values: ["58%", "4.8k", "0.7", "24%"] },
    reverb: { code: "REV", name: "Reverb", icon: "reverb", accent: "#9b8cff", values: ["38%", "2.8s", "41%", "6.4k"] },
    pan: { code: "PAN", name: "Auto Pan", icon: "pan", accent: "#ff78ad", values: ["62%", "1/8", "180deg", "52%"] },
    flanger: { code: "FLG", name: "Flanger", icon: "flanger", accent: "#62d7ba", values: ["44%", "7ms", "0.4Hz", "68%"] },
    limiter: { code: "LIM", name: "Limiter", icon: "limiter", accent: "#75e28a", values: ["63%", "-0.3", "54ms", "+1.1"] },
};

const EFFECTS = {};
const instanceCounts = {};

function registerEffect(label, templateName, overrides = {}) {
    const template = EFFECT_TEMPLATES[templateName];
    EFFECTS[label] = { ...template, ...overrides, templateName };
    const instance = Number(label.match(/\d+$/)?.[0] ?? 0);
    instanceCounts[template.code] = Math.max(instanceCounts[template.code] ?? 0, instance);
    return { type: "effect", label };
}

const loNodes = [
    registerEffect("DRV 1", "drive"),
    registerEffect("SAT 1", "saturator"),
];
const nestedANodes = [
    registerEffect("OTT 1", "ott"),
    registerEffect("CHO 1", "chorus"),
];
const nestedBNodes = [
    registerEffect("PHS 1", "phaser"),
    registerEffect("DLY 1", "delay"),
    registerEffect("DLY 2", "delay", { values: ["22%", "1/8", "28%", "9.1k"] }),
];
const hiNodes = [
    registerEffect("CRS 1", "crusher"),
    registerEffect("FLT 1", "filter"),
];
const laterANodes = [
    registerEffect("REV 1", "reverb"),
    registerEffect("DLY 3", "delay", { values: ["31%", "1/4", "47%", "8.2k"] }),
    registerEffect("PAN 1", "pan"),
];
const laterBNodes = [registerEffect("FLG 1", "flanger")];

const nestedSplit = {
    type: "split",
    id: "nested",
    kind: "parallel",
    branches: [
        { id: "a", label: "A", path: "freq/mid/nested/a", tone: "mid", nodes: nestedANodes },
        { id: "b", label: "B", path: "freq/mid/nested/b", tone: "mid", nodes: nestedBNodes },
    ],
};

const midNodes = [registerEffect("EQ 1", "eq"), nestedSplit];
const frequencySplit = {
    type: "split",
    id: "frequency",
    kind: "frequency",
    branches: [
        { id: "lo", label: "LO", path: "freq/lo", tone: "lo", nodes: loNodes },
        { id: "mid", label: "MID", path: "freq/mid", tone: "mid", nodes: midNodes },
        { id: "hi", label: "HI", path: "freq/hi", tone: "hi", nodes: hiNodes },
    ],
};

const laterSplit = {
    type: "split",
    id: "later",
    kind: "parallel",
    branches: [
        { id: "a", label: "A", path: "parallel/a", tone: "parallel", nodes: laterANodes },
        { id: "b", label: "B", path: "parallel/b", tone: "parallel", nodes: laterBNodes },
    ],
};

const rootNodes = [
    registerEffect("CMP 1", "cmp"),
    frequencySplit,
    registerEffect("EQ 2", "eq", { name: "Tilt EQ", accent: "#b4e778", values: ["+1.8", "1.4k", "0.8", "64%"] }),
    laterSplit,
    registerEffect("LIM 1", "limiter"),
];

const SEQUENCES = new Map([
    ["root", rootNodes],
    ["freq/lo", loNodes],
    ["freq/mid", midNodes],
    ["freq/mid/nested/a", nestedANodes],
    ["freq/mid/nested/b", nestedBNodes],
    ["freq/hi", hiNodes],
    ["parallel/a", laterANodes],
    ["parallel/b", laterBNodes],
]);

const PATH_LABELS = {
    root: "TRUNK",
    "freq/lo": "LO",
    "freq/mid": "MID",
    "freq/mid/nested/a": "MID / A",
    "freq/mid/nested/b": "MID / B",
    "freq/hi": "HI",
    "parallel/a": "PAR / A",
    "parallel/b": "PAR / B",
};

const state = {
    selectedEffect: "OTT 1",
    selectedOwner: "freq/mid/nested/a",
    expandedOuter: "mid",
    expandedNested: "a",
    pickerPath: null,
    graphScrollTop: 0,
    scrollToEffect: null,
};

const app = document.querySelector("#app");
let currentLayout = null;

function effectIconHref(label) {
    return ICON_URLS[EFFECTS[label].icon];
}

function measureSequence(nodes, includeTail) {
    const contentHeight = nodes.reduce((height, node) => (
        height + (node.type === "effect" ? ROW_HEIGHT : measureSplit(node))
    ), 0);
    return contentHeight + (includeTail ? ROW_HEIGHT : 0);
}

function measureSplit(split) {
    const longestBranch = Math.max(...split.branches.map((branch) => (
        BRANCH_LABEL_HEIGHT + measureSequence(branch.nodes, true)
    )));
    return SPLIT_BEFORE + FORK_LEAD + longestBranch + MERGE_LEAD + SPLIT_AFTER;
}

function allocateBands(widths, left) {
    let cursor = left;
    return Object.fromEntries(Object.entries(widths).map(([id, width]) => {
        const band = { left: cursor, width, x: cursor + width / 2 };
        cursor += width;
        return [id, band];
    }));
}

// Centre the allocated widths inside the bounds they were spent from, so a
// split that does not consume its whole corridor stays symmetric about the
// parent route instead of drifting to one edge.
function bandsFromWidths(widths, bounds) {
    const total = Object.values(widths).reduce((sum, width) => sum + width, 0);
    return allocateBands(widths, bounds.left + (bounds.width - total) / 2);
}

// Which branch of this split currently holds focus. `null` means the split has
// no focus notion at all — every branch of it is a peer that draws chips.
function focusedBranchId(split) {
    if (split.id === "frequency") { return state.expandedOuter; }
    if (split.id === "nested") { return state.expandedNested; }
    return null;
}

// A branch "opens" a deeper split when its own sequence contains one. Focusing
// such a branch means the deeper split is live too, so this split can no longer
// afford a 44px body for every sibling — they fold. This is the deeper
// ownership rule the four-lane case needs; widths alone cannot solve it.
function branchOpensSplit(branch) {
    return branch.nodes.some((node) => node.type === "split");
}

function evenWidths(split, width) {
    return Object.fromEntries(split.branches.map((branch) => [branch.id, width]));
}

// Lane bodies: what each branch actually draws its content inside.
function splitBodyWidths(split, bounds, parentMode) {
    if (parentMode !== "detail") {
        return evenWidths(split, bounds.width / split.branches.length);
    }

    const focusedId = focusedBranchId(split);
    if (focusedId === null) {
        return evenWidths(split, DETAIL_LANE_MIN);
    }

    const focusedBranch = split.branches.find((branch) => branch.id === focusedId);
    const siblingWidth = branchOpensSplit(focusedBranch) ? RAIL_WIDTH : MIN_TOUCH_TARGET;
    const focusedWidth = bounds.width - siblingWidth * (split.branches.length - 1);
    if (focusedWidth < DETAIL_LANE_MIN) {
        throw new Error(`${split.id}/${focusedId} was allocated ${focusedWidth}px, but a chip lane needs ${DETAIL_LANE_MIN}px`);
    }
    return Object.fromEntries(split.branches.map((branch) => [
        branch.id,
        branch.id === focusedId ? focusedWidth : siblingWidth,
    ]));
}

// Badge handles: the branch labels sit on their own row above every lane body,
// so they can keep a full 44px target even when the body below them folded to a
// 26px rail. This is the only place where hit width intentionally differs from
// body width, and it is safe because the badge row owns that row exclusively.
function splitHandleWidths(split, bounds, parentMode) {
    const focusedId = focusedBranchId(split);
    if (parentMode !== "detail" || focusedId === null) {
        return splitBodyWidths(split, bounds, parentMode);
    }
    const focusedWidth = bounds.width - MIN_TOUCH_TARGET * (split.branches.length - 1);
    return Object.fromEntries(split.branches.map((branch) => [
        branch.id,
        branch.id === focusedId ? focusedWidth : MIN_TOUCH_TARGET,
    ]));
}

// detail — on the focus chain, draws full chips and owns its whole lane body.
// icon   — an unfolded sibling: 44px body, compact 28px artwork, still tappable.
// rail   — a folded sibling: RAIL_WIDTH of context-only summary marks, tap
//          ownership handed to its badge.
// context— the entire split sits inside a collapsed ancestor; the ancestor owns
//          every tap in here.
function laneTier(split, branch, parentMode, bodyWidth) {
    if (parentMode === "icon" || parentMode === "summary") { return "context"; }
    const focusedId = focusedBranchId(split);
    if (focusedId === null || focusedId === branch.id) { return "detail"; }
    return bodyWidth >= MIN_TOUCH_TARGET ? "icon" : "rail";
}

const TIER_MODES = { detail: "detail", icon: "icon", rail: "summary", context: "summary" };

function summaryWellSize(bounds) {
    return Math.min(ICON_WELL_WIDTH, bounds.width);
}

function assertDetailLane(bounds, path) {
    if (bounds.width < DETAIL_LANE_MIN) {
        throw new Error(`${path} draws chips in ${bounds.width}px, but the chip anatomy needs ${DETAIL_LANE_MIN}px`);
    }
}

function createLayout() {
    return {
        branchLanes: [],
        routes: [],
        junctions: [],
        badges: [],
        effects: [],
        insertions: [],
        effectOwners: new Map(),
        foldedLanes: [],
        height: 0,
    };
}

function addRoute(layout, { id, d, tone, owner, focused, start, end }) {
    layout.routes.push({ id, d, tone, owner, focused, start, end });
}

function layoutSequence({
    nodes,
    x,
    bounds,
    y,
    path,
    mode,
    tone,
    focused,
    includeTail,
    layout,
    handlePath = null,
    summaryFocusPath = null,
    routeStartY = y,
}) {
    if (mode === "detail") { assertDetailLane(bounds, path); }

    let cursor = y;
    let segmentStart = routeStartY;
    let segmentIndex = 0;

    for (const node of nodes) {
        if (node.type === "effect") {
            const effectY = cursor + ROW_HEIGHT / 2;
            layout.effects.push({ label: node.label, x, routeX: x, y: effectY, bounds, mode, path, summaryFocusPath });
            layout.effectOwners.set(node.label, path);
            cursor += ROW_HEIGHT;
            continue;
        }

        const splitY = cursor + SPLIT_BEFORE;
        if (splitY > segmentStart) {
            addRoute(layout, {
                id: `${path}-segment-${segmentIndex++}`,
                d: `M${x} ${segmentStart}V${splitY}`,
                tone,
                owner: path,
                focused,
                start: { x, y: segmentStart },
                end: { x, y: splitY },
            });
        }
        const mergeY = layoutSplit({ split: node, x, bounds, splitY, path, parentMode: mode, parentTone: tone, parentHandlePath: handlePath, layout });
        cursor = mergeY + SPLIT_AFTER;
        segmentStart = mergeY;
    }

    if (includeTail) {
        const insertionY = cursor + ROW_HEIGHT / 2;
        layout.insertions.push({ x, routeX: x, y: insertionY, bounds, path, mode, summaryFocusPath });
        cursor += ROW_HEIGHT;
    }

    if (cursor > segmentStart) {
        addRoute(layout, {
            id: `${path}-segment-${segmentIndex}`,
            d: `M${x} ${segmentStart}V${cursor}`,
            tone,
            owner: path,
            focused,
            start: { x, y: segmentStart },
            end: { x, y: cursor },
        });
    }

    return cursor;
}

function branchIngressPath({ splitX, splitY, branchX, contentY }) {
    if (branchX === splitX) { return `M${splitX} ${splitY}V${contentY}`; }

    if (activeVariant === "B") {
        return `M${splitX} ${splitY}V${splitY + 7}L${branchX} ${splitY + 17}V${contentY}`;
    }

    if (activeVariant === "C") {
        const direction = Math.sign(branchX - splitX);
        const radius = Math.min(8, Math.abs(branchX - splitX) / 2);
        const turnY = splitY + 14;
        return `M${splitX} ${splitY}V${turnY - radius}Q${splitX} ${turnY} ${splitX + direction * radius} ${turnY}H${branchX - direction * radius}Q${branchX} ${turnY} ${branchX} ${turnY + radius}V${contentY}`;
    }

    const direction = Math.sign(branchX - splitX);
    const radius = Math.min(4, Math.abs(branchX - splitX) / 2);
    const turnY = splitY + 13;
    return `M${splitX} ${splitY}V${turnY - radius}Q${splitX} ${turnY} ${splitX + direction * radius} ${turnY}H${branchX - direction * radius}Q${branchX} ${turnY} ${branchX} ${turnY + radius}V${contentY}`;
}

function branchEgressPath({ branchX, branchEnd, branchBottom, mergeX, mergeY }) {
    if (branchX === mergeX) { return `M${branchX} ${branchEnd}V${mergeY}`; }

    if (activeVariant === "B") {
        return `M${branchX} ${branchEnd}V${branchBottom + 2}L${mergeX} ${branchBottom + 12}V${mergeY}`;
    }

    if (activeVariant === "C") {
        const direction = Math.sign(mergeX - branchX);
        const radius = Math.min(8, Math.abs(mergeX - branchX) / 2);
        const turnY = branchBottom + 10;
        return `M${branchX} ${branchEnd}V${turnY - radius}Q${branchX} ${turnY} ${branchX + direction * radius} ${turnY}H${mergeX - direction * radius}Q${mergeX} ${turnY} ${mergeX} ${turnY + radius}V${mergeY}`;
    }

    const direction = Math.sign(mergeX - branchX);
    const radius = Math.min(4, Math.abs(mergeX - branchX) / 2);
    const turnY = branchBottom + 10;
    return `M${branchX} ${branchEnd}V${turnY - radius}Q${branchX} ${turnY} ${branchX + direction * radius} ${turnY}H${mergeX - direction * radius}Q${mergeX} ${turnY} ${mergeX} ${turnY + radius}V${mergeY}`;
}

function layoutSplit({ split, x, bounds, splitY, path, parentMode, parentTone, parentHandlePath, layout }) {
    const bodyBands = bandsFromWidths(splitBodyWidths(split, bounds, parentMode), bounds);
    const handleBands = bandsFromWidths(splitHandleWidths(split, bounds, parentMode), bounds);
    const branchTop = splitY + FORK_LEAD;
    const branchHeights = split.branches.map((branch) => (
        BRANCH_LABEL_HEIGHT + measureSequence(branch.nodes, true)
    ));
    const branchBottom = branchTop + Math.max(...branchHeights);
    const mergeY = branchBottom + MERGE_LEAD;

    layout.junctions.push({
        id: `${split.id}-split`,
        kind: split.kind === "frequency" ? "frequency-split" : "parallel-split",
        x,
        y: splitY,
        tone: parentTone,
    });

    const contentY = branchTop + BRANCH_LABEL_HEIGHT;

    split.branches.forEach((branch) => {
        const band = bodyBands[branch.id];
        const handle = handleBands[branch.id];
        const branchX = band.x;
        const tier = laneTier(split, branch, parentMode, band.width);
        const mode = TIER_MODES[tier];
        const branchFocused = tier === "detail";
        // Tap ownership. A lane body only claims taps when it can hold a full
        // 44px target; a folded rail hands its taps to its own badge, and a
        // context lane hands them further up to whichever ancestor is still
        // interactive.
        const laneOwnsTaps = tier === "detail" || tier === "icon";
        const handlePath = tier === "context" ? parentHandlePath : branch.path;
        if (tier === "rail") { layout.foldedLanes.push(branch.path); }
        layout.branchLanes.push({
            bounds: band,
            top: contentY,
            bottom: branchBottom,
            path: branch.path,
            tier,
            interactive: laneOwnsTaps,
        });
        addRoute(layout, {
            id: `${split.id}-${branch.id}-in`,
            d: branchIngressPath({ splitX: x, splitY, branchX, contentY }),
            tone: branch.tone,
            owner: branch.path,
            focused: branchFocused,
            start: { x, y: splitY },
            end: { x: branchX, y: contentY },
        });

        layout.badges.push({
            x: band.x,
            y: branchTop + BADGE_CENTER_Y,
            bounds: handle,
            label: branch.label,
            path: branch.path,
            tone: branch.tone,
            focused: branchFocused,
            tier,
            interactive: tier !== "context",
        });

        const branchEnd = layoutSequence({
            nodes: branch.nodes,
            x: branchX,
            bounds: band,
            y: contentY,
            path: branch.path,
            mode,
            tone: branch.tone,
            focused: branchFocused,
            includeTail: true,
            layout,
            handlePath,
            summaryFocusPath: mode === "summary" ? handlePath : null,
        });

        addRoute(layout, {
            id: `${split.id}-${branch.id}-out`,
            d: branchEgressPath({ branchX, branchEnd, branchBottom, mergeX: x, mergeY }),
            tone: branch.tone,
            owner: branch.path,
            focused: branchFocused,
            start: { x: branchX, y: branchEnd },
            end: { x, y: mergeY },
        });
    });

    layout.junctions.push({
        id: `${split.id}-merge`,
        kind: split.kind === "frequency" ? "frequency-merge" : "parallel-merge",
        x,
        y: mergeY,
        tone: parentTone,
    });
    return mergeY;
}

function buildGraphLayout() {
    const layout = createLayout();
    // The trunk owns the whole column: its chips are centred at ROOT_X and every
    // split it contains spends the full VIEW_WIDTH, not a chip-sized slice of it.
    const rootBounds = { left: 0, width: VIEW_WIDTH, x: ROOT_X };
    const contentEnd = layoutSequence({
        nodes: rootNodes,
        x: ROOT_X,
        bounds: rootBounds,
        y: 10,
        path: "root",
        mode: "detail",
        tone: "trunk",
        focused: true,
        includeTail: true,
        layout,
        routeStartY: 0,
    });
    layout.height = Math.ceil(contentEnd + 14);
    return layout;
}

function routeMarkup(route) {
    return `<path class="route route-${route.tone}${route.focused ? " is-focus" : " is-context"}" data-route-id="${route.id}" data-owner-path="${route.owner}" data-start-x="${route.start.x}" data-start-y="${route.start.y}" data-end-x="${route.end.x}" data-end-y="${route.end.y}" d="${route.d}" />`;
}

function junctionMarkup(junction) {
    const common = `data-junction-id="${junction.id}" data-junction-x="${junction.x}" data-junction-y="${junction.y}"`;
    return `<g class="junction junction-${junction.kind}" ${common} aria-hidden="true">
        <rect class="junction-symbol junction-square" x="${junction.x - 3}" y="${junction.y - 3}" width="6" height="6" />
        <path class="junction-symbol junction-bar" d="M${junction.x - 6} ${junction.y}H${junction.x + 6}" />
        <path class="junction-symbol junction-diamond" d="M${junction.x - 4} ${junction.y}L${junction.x} ${junction.y - 3}L${junction.x + 4} ${junction.y}L${junction.x} ${junction.y + 3}Z" />
    </g>`;
}

function branchLaneMarkup(lane) {
    if (!lane.interactive) {
        return `<rect class="branch-lane-hit is-context-only" data-lane-tier="${lane.tier}" data-owner-path="${lane.path}" x="${lane.bounds.left}" y="${lane.top}" width="${lane.bounds.width}" height="${lane.bottom - lane.top}" />`;
    }
    return `<g class="branch-lane" data-branch-lane="${lane.path}" data-lane-tier="${lane.tier}" data-focus-path="${lane.path}" data-owner-path="${lane.path}" role="button" tabindex="0" aria-label="Focus ${PATH_LABELS[lane.path]}">
        <rect class="branch-lane-hit" x="${lane.bounds.left}" y="${lane.top}" width="${lane.bounds.width}" height="${lane.bottom - lane.top}" rx="4" />
    </g>`;
}

function badgeMarkup(badge) {
    const plateWidth = badge.label.length > 2 ? 30 : badge.label.length > 1 ? 24 : 20;
    if (!badge.interactive) {
        return `<g class="branch-label branch-label-${badge.tone} is-context-only" data-lane-tier="${badge.tier}" data-owner-path="${badge.path}" transform="translate(${badge.x} ${badge.y})" aria-hidden="true">
            <rect class="branch-label-plate" x="${-plateWidth / 2}" y="-9" width="${plateWidth}" height="18" />
            <text text-anchor="middle" dominant-baseline="central">${badge.label}</text>
        </g>`;
    }
    // The handle rises into the fork lead above the label band so it is a full
    // 44px tall without ever reaching the first content row at `contentY`.
    return `<g class="branch-label branch-label-${badge.tone}${badge.focused ? " is-focus" : ""}" data-focus-path="${badge.path}" data-lane-tier="${badge.tier}" data-owner-path="${badge.path}" transform="translate(${badge.x} ${badge.y})" role="button" tabindex="0" aria-label="Focus ${PATH_LABELS[badge.path]}">
        <rect class="branch-label-hit" data-handle-left="${badge.bounds.left}" data-handle-width="${badge.bounds.width}" x="${badge.bounds.left - badge.x}" y="${-(BADGE_HANDLE_RISE + BADGE_CENTER_Y)}" width="${badge.bounds.width}" height="${BADGE_HANDLE_RISE + BRANCH_LABEL_HEIGHT}" />
        <rect class="branch-label-plate" x="${-plateWidth / 2}" y="-9" width="${plateWidth}" height="18" />
        <text text-anchor="middle" dominant-baseline="central">${badge.label}</text>
    </g>`;
}

function effectMarkup(effectNode) {
    const effect = EFFECTS[effectNode.label];
    const selected = state.selectedEffect === effectNode.label;
    if (effectNode.mode === "summary") {
        // Overview rail. The artwork keeps its standard ICON_SIZE; only the well
        // tightens to the rail, so nothing is ever scaled down to fit.
        const wellSize = summaryWellSize(effectNode.bounds);
        return `<g class="effect-node effect-node-summary" data-summary-effect="${effectNode.label}" data-summary-focus-path="${effectNode.summaryFocusPath}" data-owner-path="${effectNode.path}" data-representation="summary" data-visual-size="${ICON_SIZE}" style="--accent:${effect.accent}" transform="translate(${effectNode.x} ${effectNode.y})" aria-hidden="true">
            <rect class="effect-icon-well effect-icon-well-summary" x="${-wellSize / 2}" y="${-wellSize / 2}" width="${wellSize}" height="${wellSize}" />
            <image class="effect-icon effect-icon-summary" href="${effectIconHref(effectNode.label)}" x="${-ICON_SIZE / 2}" y="${-ICON_SIZE / 2}" width="${ICON_SIZE}" height="${ICON_SIZE}" preserveAspectRatio="xMidYMid meet" />
        </g>`;
    }

    const hitInset = effectNode.bounds.width > MIN_TOUCH_TARGET ? 2 : 0;
    const hitLeft = effectNode.bounds.left + hitInset - effectNode.x;
    const hitWidth = Math.max(MIN_TOUCH_TARGET, effectNode.bounds.width - hitInset * 2);
    const common = `class="effect-node effect-node-${effectNode.mode}${selected ? " is-selected" : ""}" data-effect="${effectNode.label}" data-owner-path="${effectNode.path}" data-representation="${effectNode.mode}" data-hit-left="${effectNode.bounds.left + hitInset}" data-hit-width="${hitWidth}" style="--accent:${effect.accent}" transform="translate(${effectNode.x} ${effectNode.y})" role="button" tabindex="0" aria-label="Select ${effect.name}, ${PATH_LABELS[effectNode.path]}"`;
    const hit = `<rect class="effect-hit" x="${hitLeft}" y="${-ROW_HEIGHT / 2}" width="${hitWidth}" height="${ROW_HEIGHT}" rx="3" />`;
    if (effectNode.mode === "icon") {
        return `<g ${common} data-visual-size="${COMPACT_ICON_SIZE}">
            ${hit}
            <rect class="effect-icon-well effect-icon-well-compact" x="${-COMPACT_WELL_SIZE / 2}" y="${-COMPACT_WELL_SIZE / 2}" width="${COMPACT_WELL_SIZE}" height="${COMPACT_WELL_SIZE}" />
            <image class="effect-icon effect-icon-compact" href="${effectIconHref(effectNode.label)}" x="${-COMPACT_ICON_SIZE / 2}" y="${-COMPACT_ICON_SIZE / 2}" width="${COMPACT_ICON_SIZE}" height="${COMPACT_ICON_SIZE}" preserveAspectRatio="xMidYMid meet" />
            <title>${effect.name} — ${PATH_LABELS[effectNode.path]}</title>
        </g>`;
    }

    // One chip anatomy at every depth. The lane allocator guarantees the room,
    // so nothing here ever adapts to a lane that is too narrow.
    const chipWidth = DETAIL_CHIP_WIDTH;
    const chipLeft = -chipWidth / 2;
    const chipRight = chipWidth / 2;
    const chipShape = activeVariant === "B"
        ? `<path class="effect-chip" d="M${chipLeft + 7} -16H${chipRight}V9L${chipRight - 7} 16H${chipLeft}V-9Z" />`
        : activeVariant === "C"
            ? `<path class="effect-chip" d="M${chipLeft} -16H${chipRight - 7}Q${chipRight} -16 ${chipRight} -9V9Q${chipRight} 16 ${chipRight - 7} 16H${chipLeft}Z" />`
            : `<rect class="effect-chip" x="${chipLeft}" y="-16" width="${chipWidth}" height="32" />`;
    return `<g ${common} data-visual-size="${chipWidth}" data-label-layout="icon-and-text">
        ${hit}
        ${chipShape}
        <path class="effect-chip-hairline effect-chip-hairline-top" d="M${chipLeft + 1} -15H${chipRight - 7}" />
        <path class="effect-chip-hairline effect-chip-hairline-bottom" d="M${chipLeft + 1} 15H${chipRight - 7}" />
        <path class="effect-selection-mark" d="M${chipLeft + 2} -11V11" />
        <rect class="effect-icon-well effect-icon-well-detail" x="${chipLeft + 3}" y="${-ICON_WELL_HEIGHT / 2}" width="${ICON_WELL_WIDTH}" height="${ICON_WELL_HEIGHT}" />
        <image class="effect-icon effect-icon-detail" href="${effectIconHref(effectNode.label)}" x="${chipLeft + 6}" y="${-ICON_SIZE / 2}" width="${ICON_SIZE}" height="${ICON_SIZE}" preserveAspectRatio="xMidYMid meet" />
        <text x="${chipLeft + 32}" text-anchor="start" dominant-baseline="central">${effectNode.label}</text>
        <title>${effect.name} — ${PATH_LABELS[effectNode.path]}</title>
    </g>`;
}

function insertionMarkup(insertion) {
    const glyphSize = activeVariant === "A" ? 20 : activeVariant === "B" ? 22 : 24;
    const glyphHalf = glyphSize / 2;
    const plusHalf = activeVariant === "A" ? 5 : activeVariant === "B" ? 5.5 : 6;
    if (insertion.mode === "summary") {
        return `<g class="insertion-node insertion-node-summary" data-summary-insertion-path="${insertion.path}" data-summary-focus-path="${insertion.summaryFocusPath}" data-owner-path="${insertion.path}" transform="translate(${insertion.x} ${insertion.y})" aria-hidden="true">
            <rect class="insertion-glyph" x="${-glyphHalf}" y="${-glyphHalf}" width="${glyphSize}" height="${glyphSize}" />
            <path d="M-3 0H3M0-3V3" />
        </g>`;
    }
    const hitInset = insertion.bounds.width > MIN_TOUCH_TARGET ? 2 : 0;
    const hitLeft = insertion.bounds.left + hitInset - insertion.x;
    const hitWidth = Math.max(MIN_TOUCH_TARGET, insertion.bounds.width - hitInset * 2);
    const active = state.pickerPath === insertion.path;
    return `<g class="insertion-node${active ? " is-active" : ""}" data-insertion-path="${insertion.path}" data-owner-path="${insertion.path}" data-anchor-x="${insertion.x}" data-anchor-y="${insertion.y}" transform="translate(${insertion.x} ${insertion.y})" role="button" tabindex="0" aria-label="Add effect to ${PATH_LABELS[insertion.path]}">
        <rect class="insertion-hit" x="${hitLeft}" y="${-ROW_HEIGHT / 2}" width="${hitWidth}" height="${ROW_HEIGHT}" rx="3" />
        <rect class="insertion-glyph" x="${-glyphHalf}" y="${-glyphHalf}" width="${glyphSize}" height="${glyphSize}" />
        <path d="M${-plusHalf} 0H${plusHalf}M0 ${-plusHalf}V${plusHalf}" />
    </g>`;
}

function graphMarkup(layout) {
    return `<section class="map-stage" aria-label="Readable nested FX graph">
        <div class="graph-scroll" data-root-graph-scroll data-scroll-owner="root">
            <svg class="graph-svg" viewBox="0 0 ${VIEW_WIDTH} ${layout.height}" data-graph-height="${layout.height}" data-expanded-outer="${state.expandedOuter}" data-expanded-nested="${state.expandedNested}" data-folded-lanes="${layout.foldedLanes.join(" ")}" role="img" aria-label="Connected frequency split containing a parallel split, followed by another parallel split">
                <g class="branch-lane-layer">${layout.branchLanes.map(branchLaneMarkup).join("")}</g>
                <g class="route-layer">${layout.routes.map(routeMarkup).join("")}</g>
                <g class="junction-layer">${layout.junctions.map(junctionMarkup).join("")}</g>
                <g class="branch-label-layer">${layout.badges.map(badgeMarkup).join("")}</g>
                <g class="effect-layer">${layout.effects.map(effectMarkup).join("")}</g>
                <g class="insertion-layer">${layout.insertions.map(insertionMarkup).join("")}</g>
            </svg>
        </div>
        <div class="scroll-cue scroll-cue-top" aria-hidden="true"><span>⌃</span></div>
        <div class="scroll-cue scroll-cue-bottom" aria-hidden="true"><span>⌄</span></div>
    </section>`;
}

function variantSwitcherMarkup() {
    return `<nav class="variant-switcher" aria-label="Graph visual variants">
        ${Object.entries(VARIANTS).map(([id, variant]) => `<a href="?variant=${id}" data-variant-link="${id}"${id === activeVariant ? ' aria-current="page"' : ""} aria-label="${variant.name}">${variant.label}</a>`).join("")}
    </nav>`;
}

function editorPanel(layout) {
    const effect = EFFECTS[state.selectedEffect] ?? EFFECTS["OTT 1"];
    const owner = layout.effectOwners.get(state.selectedEffect) ?? state.selectedOwner;
    const labels = ["MIX", "SHAPE", "TIME", "TONE"];
    return `<section class="effect-panel" style="--effect-accent:${effect.accent}" aria-label="Selected effect controls">
        <header class="rack-toolbar">
            <span class="rack-mark">FX GRAPH</span>
            <span class="rack-status">${PATH_LABELS[owner]}</span>
        </header>
        <div class="effect-heading">
            <img class="effect-heading-icon" src="${effectIconHref(state.selectedEffect)}" alt="" />
            <div class="effect-heading-copy"><span>${PATH_LABELS[owner]}</span><h1>${state.selectedEffect}</h1><p>${effect.name}</p></div>
            <button type="button" class="power" aria-label="Effect power"><i></i></button>
        </div>
        <div class="effect-display" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="parameter-grid">
            ${labels.map((label, index) => `<div class="parameter"><div class="knob" style="--turn:${[68, 42, 57, 76][index]}%"><i></i></div><span>${label}</span><strong>${effect.values[index]}</strong></div>`).join("")}
        </div>
        <footer class="effect-footer"><button type="button">PRESET</button><button type="button">MOD</button><button type="button">•••</button></footer>
        ${pickerMarkup()}
    </section>`;
}

function pickerMarkup() {
    if (!state.pickerPath) { return ""; }
    const choices = ["delay", "chorus", "filter", "drive", "reverb", "crusher"];
    return `<div class="effect-picker" role="dialog" aria-label="Add effect to ${PATH_LABELS[state.pickerPath]}">
        <header><div><span>ADD TO</span><strong>${PATH_LABELS[state.pickerPath]}</strong></div><button type="button" data-action="close-picker" aria-label="Close picker">×</button></header>
        <div class="effect-picker-grid">
            ${choices.map((templateName) => {
                const template = EFFECT_TEMPLATES[templateName];
                return `<button type="button" data-picker-effect="${templateName}" style="--choice-accent:${template.accent}"><img src="${ICON_URLS[template.icon]}" alt="" /><span>${template.name}</span></button>`;
            }).join("")}
        </div>
    </div>`;
}

function setupGraphScroller() {
    const scroller = app.querySelector("[data-root-graph-scroll]");
    if (!scroller) { return; }
    scroller.scrollTop = state.graphScrollTop;
    const updateCues = () => {
        const canScroll = scroller.scrollHeight > scroller.clientHeight + 2;
        const atTop = scroller.scrollTop <= 2;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        scroller.classList.toggle("has-overflow", canScroll);
        scroller.classList.toggle("is-at-top", !canScroll || atTop);
        scroller.classList.toggle("is-at-bottom", !canScroll || atBottom);
        state.graphScrollTop = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", updateCues, { passive: true });
    updateCues();

    if (state.scrollToEffect) {
        const label = state.scrollToEffect;
        state.scrollToEffect = null;
        requestAnimationFrame(() => {
            app.querySelector(`[data-effect="${CSS.escape(label)}"]`)?.scrollIntoView({ block: "nearest" });
            updateCues();
        });
    }
}

function render() {
    currentLayout = buildGraphLayout();
    app.innerHTML = `<div class="prototype-shell" data-visual-variant="${activeVariant}">${graphMarkup(currentLayout)}${editorPanel(currentLayout)}${variantSwitcherMarkup()}</div>`;
    setupGraphScroller();
}

function applyExpansionForPath(path) {
    if (path === "freq/lo") { state.expandedOuter = "lo"; return; }
    if (path === "freq/hi") { state.expandedOuter = "hi"; return; }
    if (path === "freq/mid") {
        state.expandedOuter = "mid";
        return;
    }
    if (path.startsWith("freq/mid/nested/")) {
        state.expandedOuter = "mid";
        state.expandedNested = path.endsWith("/b") ? "b" : "a";
    }
}

function selectEffect(label, owner) {
    state.selectedEffect = label;
    state.selectedOwner = owner;
    state.pickerPath = null;
    applyExpansionForPath(owner);
    render();
}

function firstEffectInSequence(path) {
    return SEQUENCES.get(path)?.find((node) => node.type === "effect")?.label ?? null;
}

function focusPath(path) {
    applyExpansionForPath(path);
    const firstEffect = firstEffectInSequence(path);
    if (firstEffect) {
        state.selectedEffect = firstEffect;
        state.selectedOwner = path;
    }
    state.pickerPath = null;
    render();
}

function addEffect(templateName, path) {
    const template = EFFECT_TEMPLATES[templateName];
    const nodes = SEQUENCES.get(path);
    if (!template || !nodes) { return; }
    const nextInstance = (instanceCounts[template.code] ?? 0) + 1;
    const label = `${template.code} ${nextInstance}`;
    nodes.push(registerEffect(label, templateName));
    state.selectedEffect = label;
    state.selectedOwner = path;
    state.pickerPath = null;
    state.scrollToEffect = label;
    applyExpansionForPath(path);
    render();
}

function activate(node) {
    if (node.matches("[data-effect]")) {
        selectEffect(node.dataset.effect, node.dataset.ownerPath);
        return;
    }
    if (node.matches("[data-focus-path]")) {
        focusPath(node.dataset.focusPath);
        return;
    }
    if (node.matches("[data-insertion-path]")) {
        state.pickerPath = node.dataset.insertionPath;
        render();
    }
}

app.addEventListener("click", (event) => {
    const close = event.target.closest('[data-action="close-picker"]');
    if (close) {
        state.pickerPath = null;
        render();
        return;
    }

    const pickerChoice = event.target.closest("[data-picker-effect]");
    if (pickerChoice) {
        addEffect(pickerChoice.dataset.pickerEffect, state.pickerPath);
        return;
    }

    const interactive = event.target.closest("[data-effect], [data-focus-path], [data-insertion-path]");
    if (interactive) { activate(interactive); }
});

app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    const interactive = event.target.closest("[data-effect], [data-focus-path], [data-insertion-path]");
    if (!interactive) { return; }
    event.preventDefault();
    activate(interactive);
});

window.__FX_GRAPH_PROTOTYPE__ = {
    getState: () => ({ ...state, activeVariant }),
    getLayout: () => currentLayout ? {
        height: currentLayout.height,
        foldedLanes: [...currentLayout.foldedLanes],
        branchLanes: currentLayout.branchLanes.map((lane) => ({ ...lane, bounds: { ...lane.bounds } })),
        badges: currentLayout.badges.map((badge) => ({ ...badge, bounds: { ...badge.bounds } })),
        routes: currentLayout.routes.map((route) => ({ ...route })),
        effects: currentLayout.effects.map((effect) => ({ ...effect, bounds: { ...effect.bounds } })),
        insertions: currentLayout.insertions.map((insertion) => ({ ...insertion, bounds: { ...insertion.bounds } })),
    } : null,
    selectEffect,
    focusPath,
    addEffect,
};

render();
