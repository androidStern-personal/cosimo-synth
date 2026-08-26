import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
    createDefaultLaneState,
    serializeLaneState,
} from "../patch_gui/lane-state.js";
import { normalizeModulationState } from "../patch_gui/modulation.js";
import {
    clearHarnessDebugLog,
    editRackParameterValue,
    expandGlobalModRail,
    getHarnessSnapshot,
    laneParamWireLocation,
    openHarnessPage,
    readStoredModulationState,
    readRuntimeProgramRoute,
    selectRackEffect,
    waitForHarnessSnapshot,
} from "./helpers/desktop_patch_view_browser_suite.mjs";
import { decodePng, pngPixelAt, rgbDistance } from "./helpers/png_pixels.mjs";

const readStoredLaneDoc = (snapshot) => JSON.parse(String(snapshot.storedState["lane.v1"]));
const evidenceDirectory = path.resolve(import.meta.dirname, "..", "build", "fx-graph-foundation");

function emptyLaneDocJson() {
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        devices: {},
        chain: [],
    });
}

function populatedThreeBandLaneDocJson() {
    const params = createDefaultLaneState().params;
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        devices: {
            "distortion#1": { params: { ...params.drive } },
            "chorus#1": { params: { ...params.chorus } },
            "ott#1": { params: { ...params.ott } },
            "flanger#1": { params: { ...params.flanger } },
            "phaser#1": { params: { ...params.phaser } },
            "delay#1": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
        },
        chain: [{
            kind: "split",
            groupId: "split#1",
            enabled: true,
            xoverLowHz: 320,
            xoverHighHz: 3200,
            branches: [
                [
                    { kind: "device", deviceId: "distortion#1", enabled: true },
                    { kind: "device", deviceId: "chorus#1", enabled: true },
                ],
                [
                    { kind: "device", deviceId: "ott#1", enabled: true },
                    { kind: "device", deviceId: "flanger#1", enabled: true },
                    { kind: "device", deviceId: "phaser#1", enabled: true },
                ],
                [
                    { kind: "device", deviceId: "delay#1", enabled: true },
                    { kind: "device", deviceId: "reverb#1", enabled: true },
                ],
            ],
        }],
    });
}

function populatedFourWayParallelLaneDocJson() {
    const params = createDefaultLaneState().params;
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        devices: {
            "distortion#1": { params: { ...params.drive } },
            "chorus#1": { params: { ...params.chorus } },
            "ott#1": { params: { ...params.ott } },
            "flanger#1": { params: { ...params.flanger } },
            "phaser#1": { params: { ...params.phaser } },
            "delay#1": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
        },
        chain: [{
            kind: "parallel",
            groupId: "parallel#1",
            enabled: true,
            branches: [
                [
                    { kind: "device", deviceId: "distortion#1", enabled: true },
                    { kind: "device", deviceId: "chorus#1", enabled: true },
                ],
                [{ kind: "device", deviceId: "ott#1", enabled: true }],
                [
                    { kind: "device", deviceId: "flanger#1", enabled: true },
                    { kind: "device", deviceId: "phaser#1", enabled: true },
                    { kind: "device", deviceId: "delay#1", enabled: true },
                ],
                [{ kind: "device", deviceId: "reverb#1", enabled: true }],
            ],
        }],
    });
}

function maximumSerialLaneDocJson() {
    const params = createDefaultLaneState().params;
    const devices = {};
    const chain = [];
    const types = [
        { deviceType: "distortion", params: params.drive, count: 1 },
        { deviceType: "delay", params: params.delay, count: 5 },
        { deviceType: "reverb", params: params.reverb, count: 5 },
        { deviceType: "chorus", params: params.chorus, count: 5 },
    ];
    for (const type of types) {
        for (let instance = 1; instance <= type.count; instance += 1) {
            const deviceId = `${type.deviceType}#${instance}`;
            devices[deviceId] = { params: { ...type.params } };
            chain.push({ kind: "device", deviceId, enabled: true });
        }
    }
    return JSON.stringify({ format: "cosimo.lane", version: 2, devices, chain });
}

function branchTailLaneDocJson(groupKind) {
    const params = createDefaultLaneState().params;
    const group = groupKind === "parallel"
        ? {
            kind: "parallel",
            groupId: "parallel#1",
            enabled: true,
            branches: [
                [
                    { kind: "device", deviceId: "distortion#1", enabled: true },
                    { kind: "device", deviceId: "chorus#1", enabled: true },
                ],
                [],
            ],
        }
        : {
            kind: "split",
            groupId: "split#1",
            enabled: true,
            xoverLowHz: 320,
            xoverHighHz: 3200,
            branches: [
                [{ kind: "device", deviceId: "ott#1", enabled: true }],
                [],
                [
                    { kind: "device", deviceId: "delay#1", enabled: true },
                    { kind: "device", deviceId: "reverb#1", enabled: true },
                ],
            ],
        };
    const devices = groupKind === "parallel"
        ? {
            "distortion#1": { params: { ...params.drive } },
            "chorus#1": { params: { ...params.chorus } },
            "phaser#1": { params: { ...params.phaser } },
        }
        : {
            "ott#1": { params: { ...params.ott } },
            "delay#1": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
            "phaser#1": { params: { ...params.phaser } },
        };
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        devices,
        chain: [
            group,
            { kind: "device", deviceId: "phaser#1", enabled: true },
        ],
    });
}

function insertExpectedPlacement(document, path, deviceId) {
    const placement = { kind: "device", deviceId, enabled: true };
    if (path.kind === "trunk") {
        document.chain.splice(path.index, 0, placement);
        return;
    }
    const group = document.chain.find((node) => node.groupId === path.groupId);
    assert.ok(group, `Expected group ${path.groupId}`);
    group.branches[path.branchIndex].splice(path.index, 0, placement);
}

function populatedConnectorLaneDocJson(groupKind, branchCount) {
    const params = createDefaultLaneState().params;
    const fixtures = [
        { deviceId: "distortion#1", params: params.drive },
        { deviceId: "ott#1", params: params.ott },
        { deviceId: "chorus#1", params: params.chorus },
        { deviceId: "delay#1", params: params.delay },
    ].slice(0, branchCount);
    const group = {
        kind: groupKind,
        groupId: `${groupKind}#1`,
        enabled: true,
        ...(groupKind === "split" ? { xoverLowHz: 320, xoverHighHz: 3200 } : {}),
        branches: fixtures.map(({ deviceId }) => ([{
            kind: "device",
            deviceId,
            enabled: true,
        }])),
    };
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        devices: Object.fromEntries(fixtures.map((fixture) => ([
            fixture.deviceId,
            { params: { ...fixture.params } },
        ]))),
        chain: [group],
    });
}

function pointDistance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y);
}

function minimumExpectedStrokeDistance(png, cssSize, point, expectedRgb, radius = 3) {
    const scaleX = png.width / cssSize.width;
    const scaleY = png.height / cssSize.height;
    const centerX = point.x * scaleX;
    const centerY = point.y * scaleY;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            minimum = Math.min(
                minimum,
                rgbDistance(pngPixelAt(png, centerX + offsetX, centerY + offsetY), expectedRgb),
            );
        }
    }
    return minimum;
}

async function readRenderedConnector(page, role) {
    const connector = page.locator(`[data-role="${role}"]`);
    const geometry = await connector.evaluate((svg) => {
        const root = svg.parentElement;
        if (!(svg instanceof SVGSVGElement) || !(root instanceof HTMLElement)) {
            return null;
        }
        const rootRect = root.getBoundingClientRect();
        const group = root.closest(".subway-group");
        const laneRows = group === null ? [] : Array.from(group.querySelectorAll(".subway-lane-row"));
        const laneRow = root.classList.contains("subway-fork") ? laneRows[0] : laneRows.at(-1);
        const laneCenters = laneRow instanceof HTMLElement
            ? Array.from(laneRow.children, (cell) => {
                const rect = cell.getBoundingClientRect();
                return rect.left + (rect.width / 2) - rootRect.left;
            })
            : [];
        const colorCanvas = document.createElement("canvas");
        colorCanvas.width = 1;
        colorCanvas.height = 1;
        const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
        if (colorContext === null) {
            return null;
        }
        const resolveRgb = (value) => {
            colorContext.clearRect(0, 0, 1, 1);
            colorContext.fillStyle = value;
            colorContext.fillRect(0, 0, 1, 1);
            return Array.from(colorContext.getImageData(0, 0, 1, 1).data.slice(0, 3));
        };
        const pointOnPath = (path, fraction) => {
            const sourcePoint = path.getPointAtLength(path.getTotalLength() * fraction);
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = sourcePoint.x;
            svgPoint.y = sourcePoint.y;
            const matrix = path.getScreenCTM();
            if (matrix === null) {
                return null;
            }
            const screenPoint = svgPoint.matrixTransform(matrix);
            return { x: screenPoint.x - rootRect.left, y: screenPoint.y - rootRect.top };
        };
        const fork = root.classList.contains("subway-fork");
        const paths = Array.from(svg.querySelectorAll("path"), (path) => {
            const segment = path.getAttribute("data-connector-segment") ?? "";
            const fractions = segment === "trunk"
                ? (fork ? [0.1, 0.25, 0.4] : [0.72, 0.84, 0.96])
                // Branch badges deliberately sit on the latter half of the
                // fork curves. Sample the visibly emerging curve here; exact
                // endpoint-to-rail ownership is asserted separately below.
                : (fork ? [0.14, 0.34, 0.54] : [0.04, 0.16, 0.3]);
            return {
                segment,
                laneIndex: Number(path.getAttribute("data-lane-index")),
                expectedRgb: resolveRgb(getComputedStyle(path).stroke),
                start: pointOnPath(path, 0),
                end: pointOnPath(path, 1),
                samples: fractions.map((fraction) => pointOnPath(path, fraction)),
            };
        });
        return {
            size: { width: rootRect.width, height: rootRect.height },
            laneCenters,
            paths,
        };
    });
    assert.ok(geometry, `${role}: rendered connector geometry`);
    const png = decodePng(await connector.locator("xpath=..").screenshot({ animations: "disabled" }));
    return { geometry, png };
}

function rectanglesIntersect(left, right) {
    return left.left < right.right
        && left.right > right.left
        && left.top < right.bottom
        && left.bottom > right.top;
}

async function wrapStationInGroup(page, effectId, groupKind) {
    await page.click(`[data-role="rack-station-${effectId}"]`, { button: "right" });
    await page.waitForSelector(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.click(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.waitForSelector('[data-role="rack-station-menu"]', { state: "detached" });
}

test("mobile Variant C focuses one readable branch without coupling focus to selection", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedThreeBandLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const group = page.locator('[data-role="rack-group-split#1"]');
        await group.waitFor();
        const naturalHeight = await group.evaluate((element) => element.getBoundingClientRect().height);

        assert.equal(await group.getAttribute("data-focused-branch-index"), "0");
        assert.equal(
            await page.locator('[data-device-id="distortion#1"] .subway-station-detail:visible').count(),
            1,
        );
        assert.equal(
            await page.locator('[data-device-id="delay#1"] .subway-station-compact:visible').count(),
            1,
        );

        await page.click('[data-device-id="delay#1"] [data-role="rack-station-delay"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-group-split#1"]')
                ?.getAttribute("data-focused-branch-index") === "2"
        ));
        const anatomy = await page.locator(
            '[data-device-id="delay#1"] .subway-station-detail:visible',
        ).evaluate((chip) => {
            const chipRect = chip.getBoundingClientRect();
            const well = chip.querySelector(".subway-station-icon-well");
            const icon = chip.querySelector(".subway-station-icon");
            const label = chip.querySelector(".subway-station-label");
            if (!(well instanceof HTMLElement)
                    || !(icon instanceof HTMLElement)
                    || !(label instanceof HTMLElement)) {
                return null;
            }
            const wellRect = well.getBoundingClientRect();
            const iconRect = icon.getBoundingClientRect();
            const iconStyle = getComputedStyle(icon);
            return {
                chip: { width: chipRect.width, height: chipRect.height },
                well: { width: wellRect.width, height: wellRect.height },
                icon: {
                    width: iconRect.width,
                    height: iconRect.height,
                    maskImage: iconStyle.maskImage || iconStyle.webkitMaskImage,
                    backgroundColor: iconStyle.backgroundColor,
                },
                fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
            };
        });
        assert.deepEqual(anatomy?.chip, { width: 76, height: 32 });
        assert.deepEqual(anatomy?.well, { width: 24, height: 26 });
        assert.deepEqual(anatomy?.icon.width, 20);
        assert.deepEqual(anatomy?.icon.height, 20);
        assert.notEqual(anatomy?.icon.maskImage, "none");
        assert.notEqual(anatomy?.icon.backgroundColor, "rgba(0, 0, 0, 0)");
        assert.equal((anatomy?.fontSize ?? 0) >= 13, true);

        // Branch focus is navigation context, not effect selection.
        await page.click('[data-role="rack-branch-focus-split#1-1"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-group-split#1"]')
                ?.getAttribute("data-focused-branch-index") === "1"
        ));
        assert.equal(
            await page.locator('[data-role="rack-editor-delay"][data-device-id="delay#1"]').count(),
            1,
        );
        assert.equal(
            await group.evaluate((element) => element.getBoundingClientRect().height),
            naturalHeight,
        );

        // The readout is a first-class route to the existing utility editor.
        await page.click('[data-role="rack-fork-readout-split#1"]');
        assert.equal(await page.locator('[data-role="rack-group-editor-split#1"]').count(), 1);
        assert.equal(await page.locator('[data-role="rack-split-low-split#1"]').count(), 1);
        assert.equal(await page.locator('[data-role="rack-split-high-split#1"]').count(), 1);
        await page.click('[data-role="rack-group-power"]');
        await page.waitForSelector('[data-role="rack-group-split#1"].is-bypassed');
        assert.equal(
            await group.getAttribute("data-focused-branch-index"),
            "1",
            "an unrelated rack mutation must not snap focus back to the selected device",
        );
    } finally {
        await page.close();
    }
});

test("a four-way mobile Parallel folds context lanes without shrinking or overlapping targets", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedFourWayParallelLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const group = page.locator('[data-role="rack-group-parallel#1"]');
        await group.waitFor();
        assert.equal(await group.getAttribute("data-focused-branch-index"), "0");

        const presentation = await group.evaluate((element) => {
            const isVisible = (node) => {
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden"
                    && rect.width > 0 && rect.height > 0;
            };
            const rectOf = (node) => {
                const rect = node.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            };
            return {
                detailDeviceIds: Array.from(
                    element.querySelectorAll(".subway-station-detail"),
                ).filter(isVisible).map((node) => node.closest("[data-device-id]")?.getAttribute("data-device-id")),
                summaryDeviceIds: Array.from(
                    element.querySelectorAll(".subway-station-summary"),
                ).filter(isVisible).map((node) => node.closest("[data-device-id]")?.getAttribute("data-device-id")),
                visibleTailPaths: Array.from(
                    element.querySelectorAll('[data-role="rack-ghost-add"]'),
                ).filter(isVisible).map((node) => node.getAttribute("data-lane-path")),
                badgeRects: Array.from(
                    element.querySelectorAll(".subway-fork-lane"),
                    rectOf,
                ),
            };
        });
        assert.deepEqual(presentation.detailDeviceIds, ["distortion#1", "chorus#1"]);
        assert.deepEqual(
            presentation.summaryDeviceIds.toSorted(),
            ["ott#1", "flanger#1", "phaser#1", "delay#1", "reverb#1"].toSorted(),
        );
        assert.deepEqual(presentation.visibleTailPaths, ["branch:parallel#1:0:2"]);
        assert.equal(
            presentation.badgeRects.every((rect) => (
                rect.right - rect.left >= 43.5 && rect.bottom - rect.top >= 43.5
            )),
            true,
        );
        for (let index = 1; index < presentation.badgeRects.length; index += 1) {
            assert.equal(
                rectanglesIntersect(presentation.badgeRects[index - 1], presentation.badgeRects[index]),
                false,
            );
        }

        await page.click('[data-role="rack-branch-focus-parallel#1-2"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-group-parallel#1"]')
                ?.getAttribute("data-focused-branch-index") === "2"
        ));
        assert.equal(
            await page.locator('[data-device-id="delay#1"] .subway-station-detail:visible').count(),
            1,
        );
        assert.equal(
            await page.locator('[data-device-id="distortion#1"] .subway-station-summary:visible').count(),
            1,
        );
        assert.equal(
            await page.locator('[data-role="rack-ghost-add"][data-lane-path="branch:parallel#1:2:3"]:visible').count(),
            1,
        );
        assert.equal(
            await page.locator('[data-role="rack-editor-drive"][data-device-id="distortion#1"]').count(),
            1,
        );

        await fs.mkdir(evidenceDirectory, { recursive: true });
        await page.locator('[data-role="effects-rack-card"]').screenshot({
            path: path.join(evidenceDirectory, "variant-c-parallel-4-phone-focus-c.png"),
            animations: "disabled",
        });

        // At plugin width there is enough allocation for every fixed-anatomy
        // chip, so the focus model becomes additive rather than destructive.
        await page.setViewportSize({ width: 640, height: 700 });
        await page.waitForFunction(() => {
            const details = Array.from(document.querySelectorAll(
                '[data-role="rack-group-parallel#1"] .subway-station-detail',
            ));
            return details.length === 7 && details.every((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
        });
        const widePresentation = await group.evaluate((element) => {
            const isVisible = (node) => {
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden"
                    && rect.width > 0 && rect.height > 0;
            };
            const chips = Array.from(element.querySelectorAll(".subway-station-detail"))
                .filter(isVisible)
                .map((node) => {
                    const rect = node.getBoundingClientRect();
                    return {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                });
            return {
                chips,
                summaryCount: Array.from(element.querySelectorAll(".subway-station-summary"))
                    .filter(isVisible).length,
                tailCount: Array.from(element.querySelectorAll('[data-role="rack-ghost-add"]'))
                    .filter(isVisible).length,
            };
        });
        assert.equal(widePresentation.chips.length, 7);
        assert.equal(widePresentation.summaryCount, 0);
        assert.equal(widePresentation.tailCount, 4);
        assert.equal(
            widePresentation.chips.every((chip) => chip.width === 76 && chip.height === 32),
            true,
        );
        for (let leftIndex = 0; leftIndex < widePresentation.chips.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < widePresentation.chips.length; rightIndex += 1) {
                assert.equal(
                    rectanglesIntersect(
                        widePresentation.chips[leftIndex],
                        widePresentation.chips[rightIndex],
                    ),
                    false,
                );
            }
        }
        await page.locator('[data-role="effects-rack-card"]').screenshot({
            path: path.join(evidenceDirectory, "variant-c-parallel-4-plugin.png"),
            animations: "disabled",
        });
    } finally {
        await page.close();
    }
});

test("a reorder dwell opens a folded branch before the exact drop commits", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedFourWayParallelLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.waitForSelector('[data-role="rack-group-parallel#1"]');
        await clearHarnessDebugLog(page);

        const stationBox = await page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        ).boundingBox();
        const branchBadgeBox = await page.locator(
            '[data-role="rack-branch-focus-parallel#1-2"]',
        ).boundingBox();
        assert.ok(stationBox && branchBadgeBox);

        await page.mouse.move(
            stationBox.x + (stationBox.width / 2),
            stationBox.y + (stationBox.height / 2),
        );
        await page.mouse.down();
        await page.mouse.move(
            branchBadgeBox.x + (branchBadgeBox.width / 2),
            branchBadgeBox.y + (branchBadgeBox.height / 2),
        );
        // The threshold-crossing move transfers pointer capture from the chip
        // to the list. One subsequent physical move begins the badge dwell.
        await page.mouse.move(
            branchBadgeBox.x + (branchBadgeBox.width / 2) + 1,
            branchBadgeBox.y + (branchBadgeBox.height / 2),
        );
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-group-parallel#1"]')
                ?.getAttribute("data-focused-branch-index") === "2"
        ));

        const targetBox = await page.locator(
            '[data-role="rack-ghost-add"][data-lane-path="branch:parallel#1:2:3"]:visible',
        ).boundingBox();
        assert.ok(targetBox);
        await page.mouse.move(
            targetBox.x + (targetBox.width / 2),
            targetBox.y + (targetBox.height / 2),
        );
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "folded-branch dwell drop",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const parallel = JSON.parse(String(rawState)).chain
                    .find((node) => node.kind === "parallel");
                return parallel?.branches[2]?.at(-1)?.deviceId === "distortion#1";
            },
        );
        const parallel = readStoredLaneDoc(snapshot).chain
            .find((node) => node.kind === "parallel");
        assert.deepEqual(
            parallel.branches.map((branch) => branch.map((placement) => placement.deviceId)),
            [
                ["chorus#1"],
                ["ott#1"],
                ["flanger#1", "phaser#1", "delay#1", "distortion#1"],
                ["reverb#1"],
            ],
        );
        assert.equal(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
    } finally {
        await page.close();
    }
});

test("a maximum natural-height graph uses one root scroller with truthful cues and selection reveal", async () => {
    const page = await openHarnessPage({
        laneDoc: maximumSerialLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.classList.contains("has-overflow")
        ));
        const initial = await graph.evaluate((element) => ({
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollTop: element.scrollTop,
            classes: element.className,
        }));
        assert.equal(initial.scrollHeight > initial.clientHeight, true);
        assert.equal(initial.scrollTop, 0);
        assert.match(initial.classes, /is-at-top/);
        assert.doesNotMatch(initial.classes, /is-at-bottom/);
        assert.equal(await page.locator('.subway-scroll-cue-top.is-visible').count(), 0);
        assert.equal(await page.locator('.subway-scroll-cue-bottom.is-visible').count(), 1);

        // Programmatic selection does not get the browser's implicit click
        // scrolling; the rack itself must reveal the newly selected station.
        await page.evaluate(() => {
            const station = document.querySelector('[data-device-id="chorus#5"] [data-role="rack-station-chorus"]');
            if (station instanceof HTMLButtonElement) {
                station.click();
            }
        });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement && element.scrollTop > 0;
        });
        const revealed = await graph.evaluate((element) => {
            const selected = element.querySelector('[data-device-id="chorus#5"]');
            const listRect = element.getBoundingClientRect();
            const selectedRect = selected?.getBoundingClientRect();
            return {
                scrollTop: element.scrollTop,
                selectedIsVisible: selectedRect !== undefined
                    && selectedRect.top >= listRect.top
                    && selectedRect.bottom <= listRect.bottom,
            };
        });
        assert.equal(revealed.scrollTop > 0, true);
        assert.equal(revealed.selectedIsVisible, true);
        assert.equal(await page.locator('.subway-scroll-cue-top.is-visible').count(), 1);
        // The selected effect still has its insertion tail below it, so the
        // lower cue remains truthful until the user reaches the real end.
        assert.equal(await page.locator('.subway-scroll-cue-bottom.is-visible').count(), 1);
        assert.equal(
            await page.locator('[data-role="rack-editor-chorus"][data-device-id="chorus#5"]').count(),
            1,
        );
        await fs.mkdir(evidenceDirectory, { recursive: true });
        await page.locator('[data-role="effects-rack-card"]').screenshot({
            path: path.join(evidenceDirectory, "variant-c-natural-height-phone.png"),
            animations: "disabled",
        });

        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.classList.contains("is-at-bottom")
        ));
        assert.equal(await page.locator('.subway-scroll-cue-top.is-visible').count(), 1);
        assert.equal(await page.locator('.subway-scroll-cue-bottom.is-visible').count(), 0);
    } finally {
        await page.close();
    }
});

test("empty and short racks extend the final trunk to the graph viewport bottom", async () => {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const cases = [
        { name: "empty", laneDoc: emptyLaneDocJson() },
        { name: "short", laneDoc: "fresh" },
    ];

    for (const fixture of cases) {
        const page = await openHarnessPage({
            laneDoc: fixture.laneDoc,
            beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
        });
        try {
            await page.click('[data-role="mobile-workspace-tab-fx"]');
            const graph = page.locator('[data-role="rack-module-list"]');
            await graph.waitFor();
            const layout = await graph.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const trunkAnchors = Array.from(element.querySelectorAll(
                    '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
                ));
                const lastAnchorRow = trunkAnchors.at(-1)?.closest(".subway-ghost-row");
                const lastAnchorBounds = lastAnchorRow?.getBoundingClientRect();
                return {
                    width: bounds.width,
                    height: bounds.height,
                    unfilledHeight: lastAnchorBounds === undefined
                        ? bounds.height
                        : bounds.bottom - lastAnchorBounds.bottom,
                };
            });
            assert.equal(
                layout.unfilledHeight > 40,
                true,
                `${fixture.name}: fixture must leave a meaningful short-rack tail`,
            );
            const png = decodePng(await graph.screenshot({ animations: "disabled" }));
            const bottomTrunkDistance = minimumExpectedStrokeDistance(
                png,
                { width: layout.width, height: layout.height },
                { x: layout.width / 2, y: layout.height - 10 },
                [230, 225, 214],
            );
            assert.equal(
                bottomTrunkDistance <= 90,
                true,
                `${fixture.name}: final trunk must reach the graph bottom; RGB distance ${bottomTrunkDistance}`,
            );
            if (fixture.name === "short") {
                await page.screenshot({
                    path: path.join(evidenceDirectory, "variant-c-short-tail-phone.png"),
                    animations: "disabled",
                });
            }
        } finally {
            await page.close();
        }
    }
});

test("a modulation-source drag edge-scrolls the graph and still drops after leaving the edge", async () => {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const page = await openHarnessPage({
        laneDoc: maximumSerialLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.classList.contains("has-overflow")
        ));
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const sourceBox = await source.boundingBox();
        const graphBox = await graph.boundingBox();
        assert.ok(sourceBox && graphBox);
        await page.mouse.move(
            sourceBox.x + (sourceBox.width / 2),
            sourceBox.y + (sourceBox.height / 2),
        );
        await page.mouse.down();
        await page.mouse.move(graphBox.x + (graphBox.width / 2), graphBox.y + (graphBox.height / 2), {
            steps: 5,
        });
        await page.locator('[data-role="mobile-global-mod-source-ghost"]').waitFor();

        const bottomEdge = {
            x: graphBox.x + (graphBox.width / 2),
            y: graphBox.y + graphBox.height - 8,
        };
        await page.mouse.move(bottomEdge.x, bottomEdge.y, { steps: 4 });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement && element.scrollTop >= 48;
        }, undefined, { timeout: 2_500 });
        const afterBottomEdge = await graph.evaluate((element) => element.scrollTop);
        assert.equal(
            await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(),
            1,
            "edge scrolling must preserve the active source drag",
        );
        assert.equal(
            await page.evaluate(({ x, y }) => (
                document.elementFromPoint(x, y)?.closest("[data-device-id], [data-role='rack-ghost-add']") !== null
            ), bottomEdge),
            true,
            "a rack target under the edge pointer must not prevent navigation scrolling",
        );
        await page.screenshot({
            path: path.join(evidenceDirectory, "variant-c-mod-drag-edge-scroll-phone.png"),
            animations: "disabled",
        });

        const topEdge = {
            x: graphBox.x + (graphBox.width / 2),
            y: graphBox.y + 8,
        };
        await page.mouse.move(topEdge.x, topEdge.y, { steps: 4 });
        await page.waitForFunction((previousScrollTop) => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement && element.scrollTop <= previousScrollTop - 24;
        }, afterBottomEdge, { timeout: 2_500 });

        const hoverPoint = await graph.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const x = bounds.left + (bounds.width / 2);
            const y = bounds.top + (bounds.height / 2);
            const station = document.elementFromPoint(x, y)?.closest("[data-device-id]");
            return station instanceof HTMLElement
                ? { x, y, effectId: station.dataset.effectId ?? null }
                : null;
        });
        assert.ok(hoverPoint?.effectId);
        await page.mouse.move(hoverPoint.x, hoverPoint.y, { steps: 3 });
        await page.waitForFunction((effectId) => (
            document.querySelector(`.subway-station-row.is-selected[data-effect-id="${CSS.escape(effectId)}"], .subway-station-cell.is-selected[data-effect-id="${CSS.escape(effectId)}"]`) !== null
        ), hoverPoint.effectId, { timeout: 2_500 });

        const target = page.locator(
            '[data-role="effects-rack-card"] [data-drag-creation="creatable"]:visible',
        ).first();
        await target.waitFor();
        const targetKind = await target.getAttribute("data-modulation-target-kind");
        const targetBox = await target.boundingBox();
        assert.ok(targetKind && targetBox);
        await page.mouse.move(
            targetBox.x + (targetBox.width / 2),
            targetBox.y + (targetBox.height / 2),
            { steps: 5 },
        );
        await page.mouse.up();
        await waitForHarnessSnapshot(
            page,
            "edge-scrolled source drag creates the final hovered mapping",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === targetKind
            )),
        );
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("a populated three-band split stays inside the graph without intersecting effect pills", async () => {
    const laneDoc = populatedThreeBandLaneDocJson();
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const surfaces = [
        { name: "phone", width: 320, height: 700 },
        { name: "plugin", width: 640, height: 700 },
        { name: "desktop", width: 1024, height: 768 },
    ];

    for (const surface of surfaces) {
        const page = await openHarnessPage({
            laneDoc,
            beforeGoto: (nextPage) => nextPage.setViewportSize({
                width: surface.width,
                height: surface.height,
            }),
        });

        try {
            if (surface.width < 640) {
                await page.click('[data-role="mobile-workspace-tab-fx"]');
            }
            await page.waitForSelector('[data-role="rack-group-split#1"]');
            const geometry = await page.locator('[data-role="rack-group-split#1"]').evaluate((group) => {
                const list = group.closest('[data-role="rack-module-list"]');
                if (!(list instanceof HTMLElement)) {
                    return null;
                }
                const bounds = list.getBoundingClientRect();
                const parts = Array.from(group.querySelectorAll([
                    ".subway-glyph-diamond",
                    ".subway-fork-lane",
                    ".subway-fork-readout",
                    ".subway-station-pill",
                    ".subway-ghost-pill",
                    ".subway-merge-dot",
                ].join(","))).filter((element) => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== "none" && style.visibility !== "hidden"
                        && rect.width > 0 && rect.height > 0;
                }).map((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        className: element.className,
                        text: element.textContent?.trim() ?? "",
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                    };
                });
                const pills = parts.filter((part) => part.className === "subway-station-pill");
                return {
                    bounds: {
                        left: bounds.left,
                        right: bounds.right,
                        top: bounds.top,
                        bottom: bounds.bottom,
                    },
                    parts,
                    pills,
                    labels: Array.from(group.querySelectorAll(".subway-fork-lane"), (label) => (
                        label.textContent?.trim() ?? ""
                    )),
                    documentScrollWidth: document.documentElement.scrollWidth,
                };
            });
            assert.ok(geometry, `${surface.name}: split geometry must render`);
            assert.deepEqual(geometry.labels, ["LO", "MID", "HI"]);
            assert.equal(
                geometry.documentScrollWidth <= surface.width,
                true,
                `${surface.name}: the graph must not widen the document`,
            );
            for (const part of geometry.parts) {
                assert.equal(
                    part.left >= geometry.bounds.left - 0.5
                        && part.right <= geometry.bounds.right + 0.5
                        && part.top >= geometry.bounds.top - 0.5
                        && part.bottom <= geometry.bounds.bottom + 0.5,
                    true,
                    `${surface.name}: ${part.className} ${part.text} must stay inside the graph: `
                        + `${JSON.stringify(part)} vs ${JSON.stringify(geometry.bounds)}`,
                );
            }
            for (let leftIndex = 0; leftIndex < geometry.pills.length; leftIndex += 1) {
                for (let rightIndex = leftIndex + 1; rightIndex < geometry.pills.length; rightIndex += 1) {
                    assert.equal(
                        rectanglesIntersect(geometry.pills[leftIndex], geometry.pills[rightIndex]),
                        false,
                        `${surface.name}: effect pills ${geometry.pills[leftIndex].text} and `
                            + `${geometry.pills[rightIndex].text} must not overlap`,
                    );
                }
            }
            await page.locator('[data-role="effects-rack-card"]').screenshot({
                path: path.join(evidenceDirectory, `frequency-split-${surface.name}-${surface.width}px.png`),
                animations: "disabled",
            });
        } finally {
            await page.close();
        }
    }
});

test("parallel and split paths expose one exact add anchor at every empty or populated tail", async () => {
    const cases = [
        {
            groupKind: "parallel",
            paths: [
                "branch:parallel#1:0:2",
                "branch:parallel#1:1:0",
                "trunk:2",
            ],
        },
        {
            groupKind: "split",
            paths: [
                "branch:split#1:0:1",
                "branch:split#1:1:0",
                "branch:split#1:2:2",
                "trunk:2",
            ],
        },
    ];

    for (const fixture of cases) {
        const page = await openHarnessPage({ laneDoc: branchTailLaneDocJson(fixture.groupKind) });
        try {
            await page.waitForSelector(`[data-role="rack-group-${fixture.groupKind}#1"]`);
            for (const path of fixture.paths) {
                const anchor = page.locator(
                    `[data-role="rack-ghost-add"][data-insertion-anchor="path-tail"][data-lane-path="${path}"]`,
                );
                assert.equal(await anchor.count(), 1, `${fixture.groupKind}: one add anchor at ${path}`);
            }
            assert.equal(
                await page.locator('[data-role="rack-ghost-add"][data-insertion-anchor="path-tail"]').count(),
                fixture.paths.length,
            );
            for (const connector of ["fork", "merge"]) {
                const connectorRole = `[data-role="rack-${connector}-connections-${fixture.groupKind}#1"]`;
                const paths = page.locator(`${connectorRole} [data-connector-segment="branch"]`);
                const dashedPaths = page.locator(`${connectorRole} [data-connector-segment="branch"].is-dashed`);
                assert.equal(await paths.count(), fixture.groupKind === "split" ? 3 : 2);
                assert.equal(await dashedPaths.count(), 1);
                assert.equal(
                    await page.locator(
                        `[data-role="rack-${connector}-connections-${fixture.groupKind}#1"] `
                            + '[data-connector-segment="branch"][data-lane-index="1"].is-dashed',
                    ).count(),
                    1,
                    `${fixture.groupKind}: the empty branch remains dashed through its ${connector}`,
                );
            }
        } finally {
            await page.close();
        }
    }
});

test("every pictured path-tail add anchor inserts at that exact path and preserves every other path", async () => {
    const cases = [
        {
            groupKind: "parallel",
            path: { kind: "branch", groupId: "parallel#1", branchIndex: 0, index: 2 },
        },
        {
            groupKind: "parallel",
            path: { kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0 },
        },
        {
            groupKind: "parallel",
            path: { kind: "trunk", index: 2 },
        },
        {
            groupKind: "split",
            path: { kind: "branch", groupId: "split#1", branchIndex: 0, index: 1 },
        },
        {
            groupKind: "split",
            path: { kind: "branch", groupId: "split#1", branchIndex: 1, index: 0 },
        },
        {
            groupKind: "split",
            path: { kind: "branch", groupId: "split#1", branchIndex: 2, index: 2 },
        },
        {
            groupKind: "split",
            path: { kind: "trunk", index: 2 },
        },
    ];

    for (const fixture of cases) {
        const laneDoc = branchTailLaneDocJson(fixture.groupKind);
        const encodedPath = fixture.path.kind === "trunk"
            ? `trunk:${fixture.path.index}`
            : `branch:${fixture.path.groupId}:${fixture.path.branchIndex}:${fixture.path.index}`;
        const page = await openHarnessPage({ laneDoc });
        try {
            await clearHarnessDebugLog(page);
            await page.click(`[data-role="rack-ghost-add"][data-lane-path="${encodedPath}"]`);
            await page.waitForSelector('[data-role="rack-add-sheet"]');
            await page.click('[data-role="rack-add-flanger"]');
            const snapshot = await waitForHarnessSnapshot(
                page,
                `flanger added at ${encodedPath}`,
                (nextSnapshot) => {
                    const rawState = nextSnapshot.storedState["lane.v1"];
                    return rawState !== undefined
                        && JSON.parse(String(rawState)).devices?.["flanger#1"] !== undefined;
                },
            );
            const storedDoc = readStoredLaneDoc(snapshot);
            const expected = JSON.parse(laneDoc);
            insertExpectedPlacement(expected, fixture.path, "flanger#1");
            assert.deepEqual(storedDoc.chain, expected.chain, encodedPath);
            for (const [deviceId, record] of Object.entries(expected.devices)) {
                assert.deepEqual(storedDoc.devices[deviceId], record, `${encodedPath}: preserved ${deviceId}`);
            }
            assert.deepEqual(
                Object.keys(storedDoc.devices).sort(),
                [...Object.keys(expected.devices), "flanger#1"].sort(),
            );
        } finally {
            await page.close();
        }
    }
});

test("rendered pixels connect every supported split and merge at narrow and wide widths", async () => {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const groups = [
        { groupKind: "parallel", branchCount: 2 },
        { groupKind: "parallel", branchCount: 3 },
        { groupKind: "parallel", branchCount: 4 },
        { groupKind: "split", branchCount: 2 },
        { groupKind: "split", branchCount: 3 },
    ];
    const surfaces = [
        { name: "narrow", width: 320, height: 700 },
        { name: "wide", width: 1024, height: 768 },
    ];

    for (const group of groups) {
        for (const surface of surfaces) {
            const laneDoc = populatedConnectorLaneDocJson(group.groupKind, group.branchCount);
            const page = await openHarnessPage({
                laneDoc,
                beforeGoto: (nextPage) => nextPage.setViewportSize({
                    width: surface.width,
                    height: surface.height,
                }),
            });
            const label = `${surface.name} ${group.groupKind}-${group.branchCount}`;
            try {
                if (surface.width < 640) {
                    await page.click('[data-role="mobile-workspace-tab-fx"]');
                }
                const groupId = `${group.groupKind}#1`;
                await page.waitForSelector(`[data-role="rack-group-${groupId}"]`);
                const groupLayout = await page.locator(`[data-role="rack-group-${groupId}"]`).evaluate((element) => {
                    const graph = element.closest('[data-role="rack-module-list"]');
                    if (!(graph instanceof HTMLElement)) {
                        return null;
                    }
                    const graphRect = graph.getBoundingClientRect();
                    return {
                        graph: {
                            left: graphRect.left,
                            right: graphRect.right,
                            top: graphRect.top,
                            bottom: graphRect.bottom,
                        },
                        pills: Array.from(element.querySelectorAll(".subway-station-pill")).filter((pill) => {
                            const style = getComputedStyle(pill);
                            const rect = pill.getBoundingClientRect();
                            return style.display !== "none" && style.visibility !== "hidden"
                                && rect.width > 0 && rect.height > 0;
                        }).map((pill) => {
                            const rect = pill.getBoundingClientRect();
                            return {
                                text: pill.textContent?.trim() ?? "",
                                left: rect.left,
                                right: rect.right,
                                top: rect.top,
                                bottom: rect.bottom,
                            };
                        }),
                    };
                });
                assert.ok(groupLayout, `${label}: group layout`);
                for (const pill of groupLayout.pills) {
                    assert.equal(
                        pill.left >= groupLayout.graph.left - 0.5
                            && pill.right <= groupLayout.graph.right + 0.5
                            && pill.top >= groupLayout.graph.top - 0.5
                            && pill.bottom <= groupLayout.graph.bottom + 0.5,
                        true,
                        `${label}: ${pill.text} stays inside the graph: `
                            + `${JSON.stringify(pill)} vs ${JSON.stringify(groupLayout.graph)}`,
                    );
                }
                for (let leftIndex = 0; leftIndex < groupLayout.pills.length; leftIndex += 1) {
                    for (let rightIndex = leftIndex + 1; rightIndex < groupLayout.pills.length; rightIndex += 1) {
                        assert.equal(
                            rectanglesIntersect(groupLayout.pills[leftIndex], groupLayout.pills[rightIndex]),
                            false,
                            `${label}: ${groupLayout.pills[leftIndex].text} and `
                                + `${groupLayout.pills[rightIndex].text} must not overlap`,
                        );
                    }
                }
                const fork = await readRenderedConnector(page, `rack-fork-connections-${groupId}`);
                const merge = await readRenderedConnector(page, `rack-merge-connections-${groupId}`);

                for (const [connectorKind, proof] of [["fork", fork], ["merge", merge]]) {
                    const trunk = proof.geometry.paths.find((path) => path.segment === "trunk");
                    const branches = proof.geometry.paths.filter((path) => path.segment === "branch");
                    assert.ok(trunk?.start && trunk.end, `${label} ${connectorKind}: trunk geometry`);
                    assert.equal(branches.length, group.branchCount, `${label} ${connectorKind}: branch count`);
                    assert.equal(proof.geometry.laneCenters.length, group.branchCount);

                    for (const branch of branches) {
                        assert.ok(branch.start && branch.end, `${label} ${connectorKind}: lane ${branch.laneIndex}`);
                        const laneCenter = proof.geometry.laneCenters[branch.laneIndex];
                        assert.equal(Number.isFinite(laneCenter), true);
                        if (connectorKind === "fork") {
                            assert.equal(
                                pointDistance(trunk.end, branch.start) <= 0.25,
                                true,
                                `${label}: every branch leaves the fork's one junction`,
                            );
                            assert.equal(Math.abs(branch.end.x - laneCenter) <= 0.5, true, `${label}: fork rail x`);
                            assert.equal(
                                Math.abs(branch.end.y - proof.geometry.size.height) <= 0.5,
                                true,
                                `${label}: fork reaches the body rail`,
                            );
                        } else {
                            assert.equal(
                                pointDistance(branch.end, trunk.start) <= 0.25,
                                true,
                                `${label}: every branch reaches the merge's one junction`,
                            );
                            assert.equal(Math.abs(branch.start.x - laneCenter) <= 0.5, true, `${label}: merge rail x`);
                            assert.equal(Math.abs(branch.start.y) <= 0.5, true, `${label}: merge starts on body rail`);
                        }
                    }

                    for (const path of proof.geometry.paths) {
                        for (const sample of path.samples) {
                            assert.ok(sample, `${label} ${connectorKind}: sample geometry`);
                            const distance = minimumExpectedStrokeDistance(
                                proof.png,
                                proof.geometry.size,
                                sample,
                                path.expectedRgb,
                            );
                            assert.equal(
                                distance < 260,
                                true,
                                `${label} ${connectorKind} ${path.segment} lane ${path.laneIndex} `
                                    + `must paint through its curve (RGB distance ${distance})`,
                            );
                        }
                    }
                }
                if ((group.groupKind === "parallel" && group.branchCount === 4 && surface.name === "narrow")
                        || (group.groupKind === "split" && group.branchCount === 3 && surface.name === "wide")) {
                    await page.locator('[data-role="effects-rack-card"]').screenshot({
                        path: path.join(
                            evidenceDirectory,
                            `connected-${group.groupKind}-${group.branchCount}-${surface.name}.png`,
                        ),
                        animations: "disabled",
                    });
                }
            } finally {
                await page.close();
            }
        }
    }
});

test("wrapping a station in a split builds the tree, the wire, and the map", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);

        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');

        // The document grew the group with the default crossovers.
        const snapshot = await waitForHarnessSnapshot(
            page,
            "split group persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                return JSON.parse(String(rawState)).chain
                    .some((node) => node.kind === "split");
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        const split = storedDoc.chain.find((node) => node.kind === "split");
        assert.equal(split.groupId, "split#1");
        assert.equal(split.enabled, true);
        assert.equal(split.xoverLowHz, 800);
        assert.equal(split.xoverHighHz, 2500);
        assert.deepEqual(split.branches.map((branch) => branch.map((p) => p.deviceId)), [["delay#1"], []]);

        // The wire carried the marker record and the marker-grammar topology.
        const markerRecord = snapshot.sentMessages.find((message) => (
            message.endpointID === "laneSlotParams" && message.value?.slotId === 44
        ));
        assert.equal(markerRecord.value.values[0], 800);
        assert.equal(markerRecord.value.values[1], 2500);
        const topology = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").at(-1);
        assert.equal(topology.value.chainLength, 9);
        assert.equal(topology.value.slotIds.includes(44 | (2 << 8)), true);
        assert.equal(topology.value.slotIds.includes(6 | (1 << 8)), true);

        // The map shows the diamond fork, the crossover readout, the delay
        // in the LO lane, and the empty HI band's ghost stub.
        assert.equal(await page.locator('[data-role="rack-fork-split#1"] .subway-glyph-diamond').count(), 1);
        assert.match(await page.locator('[data-role="rack-fork-readout-split#1"]').innerText(), /800/);
        assert.equal(await page.locator('.subway-group [data-role="rack-module-delay"]').count(), 1);
        assert.equal(await page.locator('[data-lane-path="branch:split#1:1:0"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("the split editor drags the crossover on the acked marker hot path", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');

        await page.click('[data-role="rack-fork-split#1"]');
        const slider = page.locator('[data-role="rack-split-low-split#1"]');
        await slider.waitFor();
        assert.equal(await slider.getAttribute("aria-valuenow"), "800");

        await clearHarnessDebugLog(page);
        await slider.scrollIntoViewIfNeeded();
        const bounds = await slider.boundingBox();
        assert.ok(bounds);
        await page.mouse.move(bounds.x + (bounds.width * 0.9), bounds.y + (bounds.height / 2));
        await page.mouse.down();
        await page.mouse.move(bounds.x + (bounds.width * 0.95), bounds.y + (bounds.height / 2), { steps: 4 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "crossover field edits persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const split = JSON.parse(String(rawState)).chain.find((node) => node.kind === "split");
                return split !== undefined && split.xoverLowHz > 5000;
            },
        );
        const fieldEdits = snapshot.sentMessages.filter((message) => (
            message.endpointID === "laneSlotParamValue" && message.value?.slotId === 44
        ));
        assert.equal(fieldEdits.length > 0, true);
        assert.equal(fieldEdits.every((message) => message.value.paramIndex === 0), true);
        const finalHz = fieldEdits.at(-1).value.value;
        assert.equal(finalHz > 5000, true);
        assert.equal(readStoredLaneDoc(snapshot).chain.find((node) => node.kind === "split").xoverLowHz, finalHz);
        // No topology traffic: a crossover drag is a parameter edit, never a
        // structure transition.
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        assert.match(await page.locator('[data-role="rack-fork-readout-split#1"]').innerText(), /k/);
    } finally {
        await page.close();
    }
});

test("dragging a station into the empty band crosses lanes and commits once", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');
        await clearHarnessDebugLog(page);

        // Natural-height rows may overflow the one root scroller. Reveal the
        // drag source inside that scroller; the adjacent split target remains
        // visible, so this still exercises one uninterrupted pointer stream.
        await page.locator('[data-role="effects-rack-card"]').scrollIntoViewIfNeeded();
        await page.locator('[data-role="rack-station-reverb"]').scrollIntoViewIfNeeded();
        const reverbBox = await page.locator('[data-role="rack-station-reverb"]').boundingBox();
        const ghostBox = await page.locator('[data-lane-path="branch:split#1:1:0"]').boundingBox();
        assert.ok(reverbBox && ghostBox);

        await page.mouse.move(reverbBox.x + (reverbBox.width / 2), reverbBox.y + (reverbBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(ghostBox.x + (ghostBox.width / 2), ghostBox.y + (ghostBox.height / 2), { steps: 12 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "cross-lane move commit",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const split = JSON.parse(String(rawState)).chain.find((node) => node.kind === "split");
                return split !== undefined && split.branches[1].length === 1;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        const split = storedDoc.chain.find((node) => node.kind === "split");
        assert.deepEqual(split.branches.map((branch) => branch.map((p) => p.deviceId)),
                         [["delay#1"], ["reverb#1"]]);
        assert.equal(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
        const topology = snapshot.sentMessages.find(({ endpointID }) => endpointID === "laneTopology");
        assert.equal(topology.value.slotIds.includes(7 | (2 << 8)), true);
        assert.equal(await page.locator('.subway-group [data-role="rack-module-reverb"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("group bypass and dissolve ride the fork menu", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "chorus", "parallel");
        await page.waitForSelector('[data-role="rack-group-parallel#1"]');

        await page.click('[data-role="rack-fork-parallel#1"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-group-menu"]');
        await page.click('[data-role="rack-group-enabled-parallel#1"]');
        await page.waitForSelector('[data-role="rack-group-menu"]', { state: "detached" });
        await page.waitForSelector('[data-role="rack-group-parallel#1"].is-bypassed');
        let snapshot = await waitForHarnessSnapshot(
            page,
            "group bypass persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).chain
                        .find((node) => node.kind === "parallel")?.enabled === false;
            },
        );

        await page.click('[data-role="rack-fork-parallel#1"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-group-menu"]');
        await page.click('[data-role="rack-group-dissolve-parallel#1"]');
        snapshot = await waitForHarnessSnapshot(
            page,
            "group dissolved",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).chain.every((node) => node.kind === "device");
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.chain.length, 8);
        assert.equal(await page.locator('[data-role="rack-group-parallel#1"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-module-chorus"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("a stored v1 document upgrades in place and persists as lane.v2", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        const v1 = createDefaultLaneState();
        const reversed = {
            ...v1,
            order: [...v1.order].reverse(),
            enabled: { ...v1.enabled, chorus: true },
        };
        await page.evaluate((serialized) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("lane.v1", serialized);
        }, serializeLaneState(reversed));

        // The map renders the upgraded document: reverb leads the line and
        // the chorus station is powered.
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
            && document.querySelector('[data-role="rack-module-chorus"]')?.getAttribute("data-enabled") === "true"
        ));

        // The next persisted write is a lane.v2 document.
        await page.click('[data-role="rack-station-chorus"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-enabled-chorus"]');
        await page.click('[data-role="rack-enabled-chorus"]');
        const snapshot = await waitForHarnessSnapshot(
            page,
            "upgraded doc persisted as v2",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const doc = JSON.parse(String(rawState));
                return doc.version === 2
                    && doc.chain?.find((node) => node.deviceId === "chorus#1")?.enabled === false;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.format, "cosimo.lane");
        assert.equal(storedDoc.chain[0].deviceId, "reverb#1");
    } finally {
        await page.close();
    }
});

test("a fresh instrument opens on the starter trio", async () => {
    // T7: no stored document at all — the true out-of-box state. The lane
    // is the compact starter (drive → delay → reverb, all bypassed) with
    // the trunk's add ghost inviting the rest of the pool.
    const page = await openHarnessPage({ laneDoc: "fresh" });

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await page.waitForSelector('[data-role="rack-ghost-add"][data-lane-path="trunk:3"]');
        const stations = await page.locator('[data-role="rack-module-list"] .subway-station-row').evaluateAll(
            (elements) => elements.map((element) => ({
                deviceId: element.getAttribute("data-device-id"),
                enabled: element.getAttribute("data-enabled"),
            })),
        );
        assert.deepEqual(stations, [
            { deviceId: "distortion#1", enabled: "false" },
            { deviceId: "delay#1", enabled: "false" },
            { deviceId: "reverb#1", enabled: "false" },
        ]);
        assert.equal(
            await page.locator('[data-role="rack-editor-drive"][data-device-id="distortion#1"]').count(),
            1,
        );

        // The first edit persists a trio-shaped lane.v2 document.
        await page.click('[data-role="rack-station-drive"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-enabled-drive"]');
        await page.click('[data-role="rack-enabled-drive"]');
        const snapshot = await waitForHarnessSnapshot(
            page,
            "fresh trio persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const doc = JSON.parse(String(rawState));
                return doc.version === 2
                    && doc.chain?.find((node) => node.deviceId === "distortion#1")?.enabled === true;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.deepEqual(storedDoc.chain.map((node) => node.deviceId),
                         ["distortion#1", "delay#1", "reverb#1"]);
        assert.deepEqual(Object.keys(storedDoc.devices).sort(),
                         ["delay#1", "distortion#1", "reverb#1"]);
    } finally {
        await page.close();
    }
});

/** Tap the trunk's trailing ghost and pick a type; resolves on the commit. */
async function addTrunkDevice(page, effectId, trunkIndex, expectedDeviceId) {
    // Stations carry trunk paths too — the role pins the ghost itself.
    await page.click(`[data-role="rack-ghost-add"][data-lane-path="trunk:${trunkIndex}"]`);
    await page.waitForSelector('[data-role="rack-add-sheet"]');
    await page.click(`[data-role="rack-add-${effectId}"]`);
    await page.waitForSelector('[data-role="rack-add-sheet"]', { state: "detached" });
    return waitForHarnessSnapshot(
        page,
        `${expectedDeviceId} added`,
        (snapshot) => {
            const rawState = snapshot.storedState["lane.v1"];
            return rawState !== undefined
                && JSON.parse(String(rawState)).devices?.[expectedDeviceId] !== undefined;
        },
    );
}

test("every mix-bearing effect creates and resets at a visible and DSP-delivered 50%", async () => {
    const page = await openHarnessPage({ laneDoc: "fresh" });
    const mixCases = [
        { effectId: "drive", deviceId: "distortion#1", endpointID: "distortionWet", expected: 0.5 },
        { effectId: "ott", deviceId: "ott#1", endpointID: "ottMix", expected: 50 },
        { effectId: "chorus", deviceId: "chorus#1", endpointID: "chorusMix", expected: 0.5 },
        { effectId: "flanger", deviceId: "flanger#1", endpointID: "flangerMix", expected: 0.5 },
        { effectId: "phaser", deviceId: "phaser#1", endpointID: "phaserMix", expected: 0.5 },
        { effectId: "delay", deviceId: "delay#1", endpointID: "delayMix", expected: 0.5 },
        { effectId: "reverb", deviceId: "reverb#1", endpointID: "reverbMix", expected: 0.5 },
    ];

    try {
        await page.waitForSelector('[data-role="rack-ghost-add"][data-lane-path="trunk:3"]');
        await addTrunkDevice(page, "ott", 3, "ott#1");
        await addTrunkDevice(page, "chorus", 4, "chorus#1");
        await addTrunkDevice(page, "flanger", 5, "flanger#1");
        await addTrunkDevice(page, "phaser", 6, "phaser#1");

        for (const testCase of mixCases) {
            await selectRackEffect(page, testCase.effectId);
            const control = page.locator(
                `[data-role="rack-parameter-surface-${testCase.endpointID}"] button[aria-valuenow]`,
            );
            await control.waitFor();
            assert.equal(Number(await control.getAttribute("aria-valuenow")), testCase.expected);
            assert.equal((await control.locator(".rack-knob-readout").textContent()).trim(), "50%");

            await control.click({ button: "right" });
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
            const valueSheet = page.locator('[data-role="rack-parameter-value-sheet"]');
            await valueSheet.locator('[data-role="rack-base-value-input"]').fill("0");
            await valueSheet.locator('[data-role="rack-value-sheet-apply"]').click();
            await valueSheet.waitFor({ state: "detached" });
            await waitForHarnessSnapshot(
                page,
                `${testCase.endpointID} moved away from its default`,
                (snapshot) => JSON.parse(String(snapshot.storedState["lane.v1"]))
                    .devices[testCase.deviceId].params[testCase.endpointID] === 0,
            );
            await clearHarnessDebugLog(page);

            await control.click({ button: "right" });
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').click();
            const resetSnapshot = await waitForHarnessSnapshot(
                page,
                `${testCase.endpointID} reset to 50%`,
                (snapshot) => JSON.parse(String(snapshot.storedState["lane.v1"]))
                    .devices[testCase.deviceId].params[testCase.endpointID] === testCase.expected,
            );
            const wire = laneParamWireLocation(testCase.endpointID);
            assert.equal(resetSnapshot.sentMessages.some((message) => (
                message.endpointID === "laneSlotParamValue"
                && message.value?.slotId === wire.slotId
                && message.value?.paramIndex === wire.paramIndex
                && message.value?.value === testCase.expected
            )), true, `${testCase.endpointID} reset must reach the DSP field wire`);
            assert.equal(Number(await control.getAttribute("aria-valuenow")), testCase.expected);
            assert.equal((await control.locator(".rack-knob-readout").textContent()).trim(), "50%");
        }
    } finally {
        await page.close();
    }
});

test("the trunk ghost's type picker adds a second delay and the editor speaks it", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);

        const snapshot = await addTrunkDevice(page, "delay", 8, "delay#2");
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.chain.at(-1).deviceId, "delay#2");
        assert.equal(storedDoc.chain.at(-1).enabled, true);
        const baselineFilterHz = storedDoc.devices["delay#1"].params.delayFilter;

        // The wire grew: the topology's last slot is the delay pool's second
        // unit on the trunk (tag 0), preceded by its parameter record.
        const topology = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").at(-1);
        assert.equal(topology.value.chainLength, 9);
        assert.equal(topology.value.slotIds[8], laneParamWireLocation("delayFilter", 1).slotId);

        // Both delay stations are on the map, distinguished by instance.
        assert.equal(await page.locator('[data-role="rack-module-delay"]').count(), 2);
        assert.equal(await page.locator('[data-device-id="delay#2"][data-role="rack-module-delay"]').count(), 1);

        // The add selected the new instance: the editor names it and edits IT.
        await page.waitForSelector('[data-role="rack-editor-delay"][data-device-id="delay#2"]');
        assert.match(await page.locator(".rack-editor-name").innerText(), /2/);
        await clearHarnessDebugLog(page);
        await editRackParameterValue(page, "rack-parameter-delayFilter", "5000");

        const edited = await waitForHarnessSnapshot(
            page,
            "delay#2 filter persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).devices["delay#2"].params.delayFilter === 5000;
            },
        );
        const location = laneParamWireLocation("delayFilter", 1);
        const fieldEdit = edited.sentMessages.find((message) => (
            message.endpointID === "laneSlotParamValue"
            && message.value?.slotId === location.slotId
            && message.value?.paramIndex === location.paramIndex
        ));
        assert.equal(fieldEdit.value.value, 5000);
        // The first instance's own document value never moved.
        assert.equal(readStoredLaneDoc(edited).devices["delay#1"].params.delayFilter, baselineFilterHz);
    } finally {
        await page.close();
    }
});

test("creating a mapping with the second instance selected targets that instance", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await addTrunkDevice(page, "delay", 8, "delay#2");
        await page.waitForSelector('[data-role="rack-editor-delay"][data-device-id="delay#2"]');

        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');

        const snapshot = await waitForHarnessSnapshot(
            page,
            "per-instance route stored",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.delay#2.delayTime"
            )),
        );
        assert.equal(
            readStoredModulationState(snapshot).routes
                .some((candidate) => candidate.targetKind === "lane.delay#2.delayTime"),
            true,
        );

        // A NONZERO per-instance route executes: static resolution gives it a
        // real runtime cell with no per-document assignment step. (Zero-depth
        // routes deliberately park outside the active program.)
        const seededRoute = {
            id: "mseg-delay2", enabled: true, sourceKind: "mseg", sourceSlot: 1,
            polarity: "unipolar", targetKind: "lane.delay#2.delayTime", amount: 0.35, reducer: "max",
        };
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, normalizeModulationState({ routes: [seededRoute] }));
        await waitForHarnessSnapshot(
            page,
            "per-instance route in the runtime program",
            (nextSnapshot) => readRuntimeProgramRoute(nextSnapshot, seededRoute) !== null,
        );
    } finally {
        await page.close();
    }
});

test("remove rides the station menu, heals the selection, and capacity disables the picker", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await addTrunkDevice(page, "delay", 8, "delay#2");
        await page.waitForSelector('[data-role="rack-editor-delay"][data-device-id="delay#2"]');

        await page.click('[data-device-id="delay#2"] [data-role="rack-station-delay"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-station-menu"][data-device-id="delay#2"]');
        await page.click('[data-role="rack-station-remove-delay"]');
        const snapshot = await waitForHarnessSnapshot(
            page,
            "delay#2 removed",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).devices["delay#2"] === undefined;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.chain.length, 8);
        assert.equal(storedDoc.chain.some((node) => node.deviceId === "delay#2"), false);
        assert.equal(await page.locator('[data-device-id="delay#2"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-module-delay"]').count(), 1);

        // The selection healed onto the head of the line, never a stale id.
        const editor = page.locator(".rack-effect-editor[data-device-id]");
        await editor.waitFor();
        assert.equal(await editor.getAttribute("data-device-id"), storedDoc.chain[0].deviceId);

        // A full delay pool disables just that type in the picker. The v2
        // schema is strict — every device carries its complete param record.
        const v1Params = createDefaultLaneState().params;
        await page.evaluate((serialized) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("lane.v1", serialized);
        }, JSON.stringify({
            format: "cosimo.lane",
            version: 2,
            devices: Object.fromEntries(
                [1, 2, 3, 4, 5].map((n) => [`delay#${n}`, { params: { ...v1Params.delay } }])
                    .concat([["reverb#1", { params: { ...v1Params.reverb } }]]),
            ),
            chain: [1, 2, 3, 4, 5].map((n) => ({ kind: "device", deviceId: `delay#${n}`, enabled: true }))
                .concat([{ kind: "device", deviceId: "reverb#1", enabled: true }]),
        }));
        await page.waitForSelector('[data-role="rack-ghost-add"][data-lane-path="trunk:6"]');
        await page.click('[data-role="rack-ghost-add"][data-lane-path="trunk:6"]');
        await page.waitForSelector('[data-role="rack-add-sheet"]');
        assert.equal(await page.locator('[data-role="rack-add-delay"]').isDisabled(), true);
        assert.equal(await page.locator('[data-role="rack-add-reverb"]').isDisabled(), false);
    } finally {
        await page.close();
    }
});
