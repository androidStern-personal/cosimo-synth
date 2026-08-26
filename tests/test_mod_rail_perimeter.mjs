import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadPerimeterModule() {
    return await loadUIModule(repoRoot, "ui/shared/mod-rail-perimeter.ts");
}

test("T42 scales every measured Mod rail geometry value through one 1.10 contract", async () => {
    const {
        MOBILE_MOD_RAIL_BASE_GEOMETRY,
        MOBILE_MOD_RAIL_GEOMETRY,
        MOBILE_MOD_RAIL_SCALE,
    } = await loadPerimeterModule();

    assert.equal(MOBILE_MOD_RAIL_SCALE, 1.1);
    assert.deepEqual(
        Object.keys(MOBILE_MOD_RAIL_GEOMETRY).sort(),
        Object.keys(MOBILE_MOD_RAIL_BASE_GEOMETRY).sort(),
    );
    for (const [name, before] of Object.entries(MOBILE_MOD_RAIL_BASE_GEOMETRY)) {
        const after = MOBILE_MOD_RAIL_GEOMETRY[name];
        assert.ok(
            Math.abs((after / before) - MOBILE_MOD_RAIL_SCALE) <= 1e-12,
            `${name} must scale once: ${before} -> ${after}`,
        );
    }

    const beforeCollapsedHeight = MOBILE_MOD_RAIL_BASE_GEOMETRY.tabContentHeight
        + (2 * MOBILE_MOD_RAIL_BASE_GEOMETRY.shoulder);
    const afterCollapsedHeight = MOBILE_MOD_RAIL_GEOMETRY.tabContentHeight
        + (2 * MOBILE_MOD_RAIL_GEOMETRY.shoulder);
    assert.equal(beforeCollapsedHeight, 152);
    assert.ok(Math.abs(afterCollapsedHeight - 167.2) <= 1e-12);
});

test("vertical bounds clamp to the keep-out insets and never invert", async () => {
    const { railVerticalBounds } = await loadPerimeterModule();

    assert.deepEqual(
        railVerticalBounds({ height: 800, insetTop: 44, insetBottom: 90 }, 150),
        { min: 44, max: 560 },
    );

    // Degenerate viewport: the rail is taller than the available band.
    const degenerate = railVerticalBounds({ height: 200, insetTop: 44, insetBottom: 90 }, 150);
    assert.equal(degenerate.min, 44);
    assert.equal(degenerate.max, 44);
});

test("dock projection and normalization round-trip inside the bounds", async () => {
    const { projectRailTop, normalizeRailTop } = await loadPerimeterModule();
    const bounds = { min: 44, max: 560 };

    assert.equal(projectRailTop(0, bounds), 44);
    assert.equal(projectRailTop(1, bounds), 560);
    assert.equal(projectRailTop(0.5, bounds), 302);

    assert.equal(normalizeRailTop(302, bounds), 0.5);
    assert.equal(normalizeRailTop(-20, bounds), 0);
    assert.equal(normalizeRailTop(900, bounds), 1);

    // Zero-span bounds normalize to 0 instead of dividing by zero.
    assert.equal(normalizeRailTop(44, { min: 44, max: 44 }), 0);
});

test("release settles onto the nearest screen edge and keeps the current edge on the exact midline", async () => {
    const { settleRailEdge } = await loadPerimeterModule();

    assert.equal(settleRailEdge(80, 390, "right"), "left");
    assert.equal(settleRailEdge(310, 390, "left"), "right");
    assert.equal(settleRailEdge(195, 390, "left"), "left");
    assert.equal(settleRailEdge(195, 390, "right"), "right");
});

test("vertical snapping targets the top, middle, and bottom anchors within the snap distance", async () => {
    const { snapRailTop } = await loadPerimeterModule();
    const bounds = { min: 40, max: 540 };

    assert.deepEqual(snapRailTop(50, bounds, 28), { top: 40, snapped: true });
    assert.deepEqual(snapRailTop(300, bounds, 28), { top: 290, snapped: true });
    assert.deepEqual(snapRailTop(530, bounds, 28), { top: 540, snapped: true });
    assert.deepEqual(snapRailTop(160, bounds, 28), { top: 160, snapped: false });

    // Out-of-bounds input clamps before snapping.
    assert.deepEqual(snapRailTop(900, bounds, 28), { top: 540, snapped: true });
});

test("drawer placement opens downward when there is room and upward when below is tight", async () => {
    const { projectRailDrawerPlacement } = await loadPerimeterModule();
    const metrics = { safeTop: 40, safeBottom: 700, collapsedHeight: 150, desiredHeight: 230 };

    assert.deepEqual(
        projectRailDrawerPlacement(60, metrics),
        { direction: "down", extent: 230 },
    );

    // Near the bottom: not enough room below, more room above.
    assert.deepEqual(
        projectRailDrawerPlacement(520, metrics),
        { direction: "up", extent: 230 },
    );

    // Cramped both ways: extent clamps to the larger side.
    const cramped = projectRailDrawerPlacement(200, {
        safeTop: 100, safeBottom: 420, collapsedHeight: 150, desiredHeight: 230,
    });
    assert.equal(cramped.direction, "up");
    assert.equal(cramped.extent, 100);
});

test("T54 projects the visible rail and its drawer into the nearest control-free segment", async () => {
    const { projectRailVisiblePlacement } = await loadPerimeterModule();
    const bounds = { min: 40, max: 510 };
    const metrics = {
        safeTop: 40,
        safeBottom: 660,
        collapsedHeight: 150,
        desiredHeight: 230,
    };
    const keepOuts = [
        { top: 170, bottom: 200 },
        { top: 330, bottom: 360 },
    ];

    const topRequest = projectRailVisiblePlacement(40, bounds, metrics, keepOuts);
    assert.equal(topRequest.top, 360, "No upper segment fits the tab, so top intent projects just below the controls.");
    assert.deepEqual(topRequest.drawer, { direction: "down", extent: 150 });
    assert.equal(topRequest.collisionFree, true);

    const bottomRequest = projectRailVisiblePlacement(510, bounds, metrics, keepOuts);
    assert.equal(bottomRequest.top, 510, "A free requested position must remain unchanged.");
    assert.deepEqual(bottomRequest.drawer, { direction: "up", extent: 150 });

    const merged = projectRailVisiblePlacement(180, bounds, metrics, [
        { top: 170, bottom: 190 },
        { top: 185, bottom: 360 },
    ]);
    assert.equal(merged.top, 360, "Overlapping keep-outs must behave as one obstruction.");

    const impossible = projectRailVisiblePlacement(180, bounds, metrics, [
        { top: 40, bottom: 660 },
    ]);
    assert.equal(impossible.collisionFree, false, "The caller must be able to fall back from optional obstructions.");
});

test("T42 default placement fits the full scaled drawer when possible and clamps cramped phones safely", async () => {
    const {
        MOBILE_MOD_RAIL_GEOMETRY,
        MOBILE_MOD_RAIL_SCALE,
        projectRailDefaultPlacement,
        railVerticalBounds,
    } = await loadPerimeterModule();
    const collapsedHeight = MOBILE_MOD_RAIL_GEOMETRY.tabContentHeight
        + (2 * MOBILE_MOD_RAIL_GEOMETRY.shoulder);
    const measuredFullDrawerHeight = 309 * MOBILE_MOD_RAIL_SCALE;

    const assertInsideBand = (placement, metrics) => {
        const expandedTop = placement.drawer.direction === "up"
            ? placement.top - placement.drawer.extent
            : placement.top;
        const expandedBottom = placement.drawer.direction === "down"
            ? placement.top + metrics.collapsedHeight + placement.drawer.extent
            : placement.top + metrics.collapsedHeight;
        assert.ok(expandedTop >= metrics.safeTop - 1e-9, `${expandedTop} clears ${metrics.safeTop}`);
        assert.ok(expandedBottom <= metrics.safeBottom + 1e-9, `${expandedBottom} clears ${metrics.safeBottom}`);
    };

    // 430x932 composed interface: there is enough room for the complete
    // scaled drawer, so the preferred 42% dock moves only as far as needed.
    const tallBand = { height: 799, insetTop: 49, insetBottom: 8 };
    const tallBounds = railVerticalBounds(tallBand, collapsedHeight);
    const tallMetrics = {
        safeTop: tallBand.insetTop,
        safeBottom: tallBand.height - tallBand.insetBottom,
        collapsedHeight,
        desiredHeight: measuredFullDrawerHeight,
    };
    const tallPreferredTop = tallBounds.min + ((tallBounds.max - tallBounds.min) * 0.42);
    const tall = projectRailDefaultPlacement(0.42, tallBounds, tallMetrics);
    assert.ok(tall.top < tallPreferredTop, "The tall default shifts upward just enough to fit the drawer.");
    assert.ok(Math.abs(tall.drawer.extent - measuredFullDrawerHeight) <= 1e-9);
    assertInsideBand(tall, tallMetrics);

    // 320x568 composed interface: the whole drawer cannot fit, so the bar
    // keeps its preferred dock and exposes the largest safe scrollable extent.
    const narrowBand = { height: 435, insetTop: 49, insetBottom: 8 };
    const narrowBounds = railVerticalBounds(narrowBand, collapsedHeight);
    const narrowMetrics = {
        safeTop: narrowBand.insetTop,
        safeBottom: narrowBand.height - narrowBand.insetBottom,
        collapsedHeight,
        desiredHeight: measuredFullDrawerHeight,
    };
    const narrowPreferredTop = narrowBounds.min + ((narrowBounds.max - narrowBounds.min) * 0.42);
    const narrow = projectRailDefaultPlacement(0.42, narrowBounds, narrowMetrics);
    assert.ok(Math.abs(narrow.top - narrowPreferredTop) <= 1e-9);
    assert.ok(narrow.drawer.extent < measuredFullDrawerHeight);
    assert.ok(narrow.drawer.extent > 0);
    assertInsideBand(narrow, narrowMetrics);
});

test("stored docks round-trip and legacy right-edge values migrate", async () => {
    const { serializeRailDock, parseStoredRailDock } = await loadPerimeterModule();

    const dock = { edge: "left", normalizedY: 0.62 };
    assert.deepEqual(parseStoredRailDock(serializeRailDock(dock)), dock);

    // v1 formats stored only the vertical position on the right edge.
    assert.deepEqual(parseStoredRailDock("0.42"), { edge: "right", normalizedY: 0.42 });
    assert.deepEqual(
        parseStoredRailDock(JSON.stringify({ normalizedY: 0.9 })),
        { edge: "right", normalizedY: 0.9 },
    );

    // Garbage and out-of-domain input yield null (caller applies the default dock).
    assert.equal(parseStoredRailDock(null), null);
    assert.equal(parseStoredRailDock("not json"), null);
    assert.equal(parseStoredRailDock(JSON.stringify({ edge: "up", normalizedY: 0.5 })), null);
    assert.deepEqual(
        parseStoredRailDock(JSON.stringify({ edge: "left", normalizedY: 7 })),
        { edge: "left", normalizedY: 1 },
    );
});

/**
 * Parse an "M/A/H/V/Z" path into absolute on-path points. Every command in the
 * builder's vocabulary ends on an explicit coordinate, so the point sequence
 * plus each arc's radius fully characterizes the outline.
 */
function pathGeometry(pathData) {
    const tokens = pathData.match(/[MAHVZ]|-?\d+(?:\.\d+)?/g) ?? [];
    const points = [];
    const arcRadii = [];
    let x = 0;
    let y = 0;
    for (let index = 0; index < tokens.length;) {
        const command = tokens[index];
        index += 1;
        if (command === "Z") {
            continue;
        }
        if (command === "M") {
            x = Number(tokens[index]);
            y = Number(tokens[index + 1]);
            index += 2;
        } else if (command === "H") {
            x = Number(tokens[index]);
            index += 1;
        } else if (command === "V") {
            y = Number(tokens[index]);
            index += 1;
        } else if (command === "A") {
            arcRadii.push(Number(tokens[index]));
            x = Number(tokens[index + 5]);
            y = Number(tokens[index + 6]);
            index += 7;
        } else {
            throw new Error(`Unexpected path token: ${command}`);
        }
        points.push({ x, y });
    }
    return { points, arcRadii };
}

test("the silhouette spans exactly the screen-edge-to-body extent it is given", async () => {
    const { buildRailSilhouettePath } = await loadPerimeterModule();
    const spec = { width: 40, shoulder: 12, corner: 12, height: 152 };
    const { points, arcRadii } = pathGeometry(buildRailSilhouettePath(spec));

    // Every point stays inside the box; the outline actually reaches all four
    // extents (flush against the screen edge, full height, full width).
    for (const point of points) {
        assert.ok(point.x >= 0 && point.x <= spec.width, `x ${point.x} inside [0, ${spec.width}]`);
        assert.ok(point.y >= 0 && point.y <= spec.height, `y ${point.y} inside [0, ${spec.height}]`);
    }
    assert.ok(points.some((point) => point.x === 0));
    assert.ok(points.some((point) => point.x === spec.width));
    assert.ok(points.some((point) => point.y === 0));
    assert.ok(points.some((point) => point.y === spec.height));

    // The docked edge (x = width) is touched only at the shoulder tips: the
    // body proper must sit clear of the screen edge by the shoulder sweep.
    const edgeTouches = points.filter((point) => point.x === spec.width);
    assert.deepEqual(edgeTouches.map((point) => point.y).sort((a, b) => a - b), [0, spec.height]);

    // Shoulder arcs keep their radius; body corners are symmetric about the
    // vertical midline of the body span.
    assert.deepEqual(arcRadii, [12, 12, 12, 12]);
});

test("the corner radius clamps so a stubby silhouette cannot self-intersect", async () => {
    const { buildRailSilhouettePath } = await loadPerimeterModule();
    const { points } = pathGeometry(
        buildRailSilhouettePath({ width: 40, shoulder: 12, corner: 12, height: 40 }),
    );

    // Body band is y in [12, 28]; with full 12px corners the two corner arcs
    // would overlap (24 > 16). Clamped corners keep every y ordered and inside.
    const ys = points.map((point) => point.y);
    for (let index = 1; index < ys.length; index += 1) {
        assert.ok(ys[index] >= ys[index - 1], `y sequence stays monotonic: ${ys.join(", ")}`);
    }
});

test("the left-edge silhouette mirrors the right-edge geometry point for point", async () => {
    const { buildRailSilhouettePath } = await loadPerimeterModule();
    const spec = { width: 40, shoulder: 12, corner: 12, height: 152 };

    const right = pathGeometry(buildRailSilhouettePath(spec, "right"));
    const left = pathGeometry(buildRailSilhouettePath(spec, "left"));

    assert.equal(left.points.length, right.points.length);
    for (let index = 0; index < right.points.length; index += 1) {
        assert.deepEqual(
            left.points[index],
            { x: spec.width - right.points[index].x, y: right.points[index].y },
            `point ${index} mirrors across the vertical axis`,
        );
    }
    assert.deepEqual(left.arcRadii, right.arcRadii);

    // The default edge stays "right" so existing callers are unchanged.
    assert.equal(buildRailSilhouettePath(spec), buildRailSilhouettePath(spec, "right"));
});
