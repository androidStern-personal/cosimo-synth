import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
    createDefaultLaneState,
    serializeLaneState,
} from "../patch_gui/lane-state.js";
import { createDefaultLaneStateV2 } from "../patch_gui/lane-state-v2.js";
import { normalizeModulationState } from "../patch_gui/modulation.js";
import {
    clickPresetBarAction,
    clearHarnessDebugLog,
    createRackMappingByDrop,
    editRackParameterValue,
    expandGlobalModRail,
    getHarnessSnapshot,
    laneParamWireLocation,
    openBuiltDesktopBundlePage,
    openHarnessPage,
    readStoredModulationState,
    readRuntimeProgramRoute,
    selectRackEffect,
    touchPointForModSourcePreviewTarget,
    waitForHarnessSnapshot,
} from "./helpers/desktop_patch_view_browser_suite.mjs";
import { decodePng, pngPixelAt, rgbDistance } from "./helpers/png_pixels.mjs";

const readStoredLaneDoc = (snapshot) => JSON.parse(String(snapshot.storedState["lane.v1"]));
const starterTrioLaneDocJson = () => JSON.stringify(createDefaultLaneStateV2());
const evidenceDirectory = path.resolve(import.meta.dirname, "..", "build", "fx-graph-foundation");
const fxFooterEvidenceDirectory = path.resolve(import.meta.dirname, "..", "build", "t73-fx-footer");

async function assertEditorControlIsVisibleAndOwned(control, label) {
    await control.scrollIntoViewIfNeeded();
    const evidence = await control.evaluate((element) => {
        const editor = element.closest(".subway-group-editor");
        const body = element.closest(".subway-group-editor-body");
        if (!(editor instanceof HTMLElement) || !(body instanceof HTMLElement)) {
            throw new Error("Expected the control inside the visible group editor body.");
        }
        const rect = element.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const visibleRegion = {
            left: Math.max(0, editorRect.left, bodyRect.left),
            right: Math.min(window.innerWidth, editorRect.right, bodyRect.right),
            top: Math.max(0, editorRect.top, bodyRect.top),
            bottom: Math.min(window.innerHeight, editorRect.bottom, bodyRect.bottom),
        };
        const insetX = Math.min(8, rect.width / 4);
        const insetY = Math.min(8, rect.height / 4);
        const points = [
            { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) },
            { x: rect.left + insetX, y: rect.top + (rect.height / 2) },
            { x: rect.right - insetX, y: rect.top + (rect.height / 2) },
            { x: rect.left + (rect.width / 2), y: rect.top + insetY },
            { x: rect.left + (rect.width / 2), y: rect.bottom - insetY },
        ];
        return {
            rect: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            },
            editorRect: {
                left: editorRect.left,
                right: editorRect.right,
                top: editorRect.top,
                bottom: editorRect.bottom,
            },
            bodyScrollable: body.scrollHeight > body.clientHeight,
            visibleRegion,
            hitOwners: points.map(({ x, y }) => {
                const owner = document.elementFromPoint(x, y);
                return {
                    owned: owner !== null && (owner === element || element.contains(owner)),
                    role: owner?.closest("[data-role]")?.getAttribute("data-role") ?? null,
                };
            }),
        };
    });
    const epsilon = 0.5;
    assert.equal(
        evidence.rect.left >= evidence.visibleRegion.left - epsilon
            && evidence.rect.right <= evidence.visibleRegion.right + epsilon
            && evidence.rect.top >= evidence.visibleRegion.top - epsilon
            && evidence.rect.bottom <= evidence.visibleRegion.bottom + epsilon,
        true,
        `${label} must be fully contained by the visible editor body: ${JSON.stringify(evidence)}`,
    );
    assert.equal(
        evidence.hitOwners.every(({ owned }) => owned),
        true,
        `${label} must own its center and inset hit points: ${JSON.stringify(evidence)}`,
    );
    return evidence;
}

async function assertCompactSplitCrossoverIsUsable(page, which, label) {
    const slider = page.locator(`[data-role="rack-split-${which}-split#1"]`);
    const sliderEvidence = await assertEditorControlIsVisibleAndOwned(slider, `${label} slider`);
    assert.equal(
        await page.locator(`[data-role="key-track-frequencySplit-${which}-split#1"]`).count(),
        0,
        `${label} must not retain a visible Key Track button.`,
    );
    await slider.evaluate((element) => element.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 200,
    })));
    assert.equal(
        (await page.locator(
            '[data-role="rack-parameter-menu-item"][data-action="toggle-key-track"]',
        ).innerText()).trim(),
        "Enable Key Track",
    );
    await page.locator('[data-role="rack-parameter-menu-layer"]').click({ position: { x: 1, y: 1 } });
    const sliderPresentation = await slider.evaluate((element) => {
        const readout = element.querySelector(".subway-crossover-readout");
        if (!(readout instanceof HTMLElement)) {
            throw new Error("Expected a crossover readout inside the slider.");
        }
        const rect = element.getBoundingClientRect();
        const readoutRect = readout.getBoundingClientRect();
        const gridTemplateColumns = getComputedStyle(element).gridTemplateColumns;
        return {
            gridTemplateColumns,
            gridTrackWidths: Array.from(gridTemplateColumns.matchAll(/([0-9.]+)px/g), (match) => Number(match[1])),
            readoutRect: {
                left: readoutRect.left,
                right: readoutRect.right,
                top: readoutRect.top,
                bottom: readoutRect.bottom,
                width: readoutRect.width,
                height: readoutRect.height,
            },
            sliderRect: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
            },
        };
    });
    const epsilon = 0.5;
    assert.equal(
        sliderEvidence.rect.width >= 56 && sliderEvidence.rect.height >= 44,
        true,
        `${label} must retain a meaningful drag surface: ${JSON.stringify(sliderEvidence)}`,
    );
    assert.equal(
        sliderPresentation.gridTrackWidths.length > 0
            && sliderPresentation.gridTrackWidths.every((width) => width >= 1),
        true,
        `${label} must not collapse an inner slider grid track: ${JSON.stringify(sliderPresentation)}`,
    );
    assert.equal(
        sliderPresentation.readoutRect.width >= 28
            && sliderPresentation.readoutRect.height >= 10
            && sliderPresentation.readoutRect.left >= sliderPresentation.sliderRect.left - epsilon
            && sliderPresentation.readoutRect.right <= sliderPresentation.sliderRect.right + epsilon
            && sliderPresentation.readoutRect.top >= sliderPresentation.sliderRect.top - epsilon
            && sliderPresentation.readoutRect.bottom <= sliderPresentation.sliderRect.bottom + epsilon,
        true,
        `${label} readout must remain legible inside the slider: ${JSON.stringify(sliderPresentation)}`,
    );
}

function emptyLaneDocJson() {
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {},
        chain: [],
    });
}

function populatedThreeBandLaneDocJson() {
    const params = createDefaultLaneState().params;
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
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

function emptySplitLaneDocJson(branchCount) {
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {},
        chain: [{
            kind: "split",
            groupId: "split#1",
            enabled: true,
            xoverLowHz: 320,
            xoverHighHz: 3200,
            branches: new Array(branchCount).fill(null).map(() => []),
        }],
    });
}

function populatedFourWayParallelLaneDocJson() {
    const params = createDefaultLaneState().params;
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
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
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices,
        chain,
    });
}

function boundaryScrollLaneDocJson() {
    const params = createDefaultLaneState().params;
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {
            "globalFilter#1": { params: { ...params.filter } },
            "distortion#1": { params: { ...params.drive } },
            "ott#1": { params: { ...params.ott } },
            "chorus#1": { params: { ...params.chorus } },
            "flanger#1": { params: { ...params.flanger } },
            "phaser#1": { params: { ...params.phaser } },
            "delay#1": { params: { ...params.delay } },
            "ott#2": { params: { ...params.ott } },
            "chorus#2": { params: { ...params.chorus } },
            "flanger#2": { params: { ...params.flanger } },
            "phaser#2": { params: { ...params.phaser } },
            "delay#2": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
        },
        chain: [
            { kind: "device", deviceId: "globalFilter#1", enabled: true },
            {
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
                    [{ kind: "device", deviceId: "delay#1", enabled: true }],
                ],
            },
            { kind: "device", deviceId: "ott#2", enabled: true },
            { kind: "device", deviceId: "chorus#2", enabled: true },
            { kind: "device", deviceId: "flanger#2", enabled: true },
            { kind: "device", deviceId: "phaser#2", enabled: true },
            { kind: "device", deviceId: "delay#2", enabled: true },
            { kind: "device", deviceId: "reverb#1", enabled: true },
        ],
    });
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
            xoverLowKeyTrackEnabled: false,
            xoverLowKeyTrackOffsetSemitones: 0,
            xoverHighKeyTrackEnabled: false,
            xoverHighKeyTrackOffsetSemitones: 0,
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
            "distortion#1": {
                params: {
                    ...params.drive,
                    distortionWetHPKeyTrackEnabled: 0,
                    distortionWetHPKeyTrackOffsetSemitones: 0,
                    distortionWetLPKeyTrackEnabled: 0,
                    distortionWetLPKeyTrackOffsetSemitones: 0,
                },
            },
            "chorus#1": {
                params: {
                    ...params.chorus,
                    chorusRingOffsetMode: 0,
                    chorusRingFineSemitones: 0,
                    chorusRingKeyTrackEnabled: 0,
                    chorusRingKeyTrackOffsetSemitones: 0,
                    chorusRingLegacyClampEnabled: 0,
                },
            },
            "phaser#1": {
                params: {
                    ...params.phaser,
                    phaserFrequencyKeyTrackEnabled: 0,
                    phaserFrequencyKeyTrackOffsetSemitones: 0,
                },
            },
        }
        : {
            "ott#1": { params: { ...params.ott } },
            "delay#1": {
                params: {
                    ...params.delay,
                    delayTimeKeyTrackEnabled: 0,
                    delayTimeKeyTrackOffsetSemitones: 0,
                    delayFilterKeyTrackEnabled: 0,
                    delayFilterKeyTrackOffsetSemitones: 0,
                },
            },
            "reverb#1": { params: { ...params.reverb } },
            "phaser#1": {
                params: {
                    ...params.phaser,
                    phaserFrequencyKeyTrackEnabled: 0,
                    phaserFrequencyKeyTrackOffsetSemitones: 0,
                },
            },
        };
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
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
        output: { mix: 1, bypassed: false },
        devices: Object.fromEntries(fixtures.map((fixture) => ([
            fixture.deviceId,
            { params: { ...fixture.params } },
        ]))),
        chain: [group],
    });
}

function emptyConnectorLaneDocJson(groupKind, branchCount) {
    const group = {
        kind: groupKind,
        groupId: `${groupKind}#1`,
        enabled: true,
        ...(groupKind === "split" ? { xoverLowHz: 320, xoverHighHz: 3200 } : {}),
        branches: Array.from({ length: branchCount }, () => []),
    };
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {},
        chain: [group],
    });
}

function pointDistance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y);
}

async function centerOf(locator) {
    const box = await locator.boundingBox();
    assert.ok(box);
    return { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
}

async function moveHarnessIntoProductionShadowRoot(page) {
    await page.evaluate(async () => {
        const host = document.querySelector("cosimo-desktop-react-view");
        const mountPoint = host?.firstElementChild;
        if (!(host instanceof HTMLElement) || !(mountPoint instanceof HTMLElement)) {
            throw new Error("Expected the source-composed desktop view mount point.");
        }
        if (host.shadowRoot !== null) {
            throw new Error("Expected the source harness to begin in light DOM.");
        }
        const cssModule = await import("/ui/desktop/styles.css?inline");
        if (typeof cssModule.default !== "string") {
            throw new Error("Expected the production desktop stylesheet text.");
        }
        const shadowRoot = host.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = cssModule.default;
        shadowRoot.replaceChildren(style, mountPoint);
        document.getElementById("cosimo-desktop-react-view-styles")?.remove();
    });
    await page.waitForFunction(() => (
        document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="rack-module-list"]') !== null
    ));
}

async function openAllCaptureRejectedRackPage() {
    return openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 1024, height: 768 });
            await nextPage.addInitScript(() => {
                window.__FX_CAPTURE_REJECTIONS__ = [];
                window.__FX_LAST_POINTER_ID__ = null;
                window.addEventListener("pointerdown", (event) => {
                    window.__FX_LAST_POINTER_ID__ = event.pointerId;
                }, true);
                Element.prototype.setPointerCapture = function rejectPointerCapture() {
                    window.__FX_CAPTURE_REJECTIONS__.push(
                        this.matches?.(".subway-station")
                            ? "station"
                            : this.matches?.('[data-role="rack-module-list"]')
                                ? "list"
                                : "other",
                    );
                    throw new DOMException("Pointer capture is unavailable", "NotSupportedError");
                };
            });
        },
    });
}

async function pointOutsideOf(locator) {
    return locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const candidates = [
            { x: rect.right + 32, y: rect.top + (rect.height / 2) },
            { x: rect.left - 32, y: rect.top + (rect.height / 2) },
            { x: rect.left + (rect.width / 2), y: rect.bottom + 32 },
            { x: rect.left + (rect.width / 2), y: rect.top - 32 },
        ];
        const point = candidates.find(({ x, y }) => (
            x >= 2 && x <= window.innerWidth - 2
                && y >= 2 && y <= window.innerHeight - 2
                && !(x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
        ));
        if (point === undefined) {
            throw new Error("Expected an in-viewport point outside the rack list.");
        }
        return point;
    });
}

async function createTouchDriver(page) {
    const cdp = await page.context().newCDPSession(page);
    const point = ({ x, y }) => ({
        x,
        y,
        id: 31,
        radiusX: 7,
        radiusY: 7,
        force: 1,
    });
    return {
        start: (position) => cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [point(position)],
        }),
        move: (position) => cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [point(position)],
        }),
        end: () => cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        }),
        cancel: () => cdp.send("Input.dispatchTouchEvent", {
            type: "touchCancel",
            touchPoints: [],
        }),
        close: () => cdp.detach(),
    };
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
            const dashed = path.classList.contains("is-dashed");
            const fractions = segment === "trunk"
                ? [0.08, 0.28, 0.5, 0.72, 0.92]
                : dashed
                    // pathLength=100 with 8/6 dashes: these fractions land
                    // inside every visible dash, including both endpoint caps.
                    ? [0.02, 0.16, 0.3, 0.44, 0.58, 0.72, 0.86, 0.99]
                    : [0.12, 0.35, 0.62, 0.88];
            return {
                segment,
                laneIndex: Number(path.getAttribute("data-lane-index")),
                dashed,
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
    return geometry;
}

function maximumPixelDifference(painted, bare, cssSize, point, radius = 3) {
    const scaleX = painted.width / cssSize.width;
    const scaleY = painted.height / cssSize.height;
    const centerX = point.x * scaleX;
    const centerY = point.y * scaleY;
    let maximum = 0;
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const x = centerX + offsetX;
            const y = centerY + offsetY;
            maximum = Math.max(
                maximum,
                rgbDistance(pngPixelAt(painted, x, y), pngPixelAt(bare, x, y)),
            );
        }
    }
    return maximum;
}

function assertPaintedAgainstLocalBackground({ painted, bare, size }, point, label) {
    const contrast = maximumPixelDifference(painted, bare, size, point);
    assert.equal(
        contrast >= 18,
        true,
        `${label}: route must differ from its exact local background (RGB delta ${contrast})`,
    );
}

async function captureIsolatedConnectorLayers(page, role) {
    const connector = page.locator(`[data-role="${role}"]`);
    const root = connector.locator("xpath=..");
    const geometry = await readRenderedConnector(page, role);
    await page.addStyleTag({
        content: [
            ".is-connector-proof-isolated > :not(.subway-connector-svg) { visibility: hidden !important; }",
        ].join("\n"),
    });
    await root.evaluate((element) => element.classList.add("is-connector-proof-isolated"));
    const priorVisibility = await connector.locator("path").evaluateAll((paths) => paths.map((path) => (
        path.style.visibility
    )));
    await connector.locator("path").evaluateAll((paths) => {
        for (const path of paths) {
            path.style.visibility = "hidden";
        }
    });
    const bare = decodePng(await root.screenshot({ animations: "disabled" }));
    const paintedByPath = [];
    for (let pathIndex = 0; pathIndex < geometry.paths.length; pathIndex += 1) {
        const pathLocator = connector.locator("path").nth(pathIndex);
        await pathLocator.evaluate((path) => { path.style.visibility = "visible"; });
        paintedByPath.push(decodePng(await root.screenshot({ animations: "disabled" })));
        await pathLocator.evaluate((path) => { path.style.visibility = "hidden"; });
    }
    await connector.locator("path").evaluateAll((paths, visibility) => {
        paths.forEach((path, index) => { path.style.visibility = visibility[index] ?? ""; });
    }, priorVisibility);
    await root.evaluate((element) => element.classList.remove("is-connector-proof-isolated"));
    return { geometry, bare, paintedByPath };
}

async function captureGroupSeamLayers(page, groupId) {
    const group = page.locator(`[data-role="rack-group-${groupId}"]`);
    await page.addStyleTag({
        content: [
            ".is-route-proof-clean .subway-station,",
            ".is-route-proof-clean .subway-ghost-button,",
            ".is-route-proof-clean .subway-fork-glyph,",
            ".is-route-proof-clean .subway-fork-lanes,",
            ".is-route-proof-clean .subway-fork-readout,",
            ".is-route-proof-clean .subway-merge-dot { visibility: hidden !important; }",
            ".is-route-proof-bare .subway-connector-svg path { visibility: hidden !important; }",
            ".is-route-proof-bare .subway-station-cell::before,",
            ".is-route-proof-bare .subway-line-cell::before,",
            ".is-route-proof-bare .subway-ghost-cell::before { visibility: hidden !important; }",
        ].join("\n"),
    });
    const geometry = await group.evaluate((element) => {
        const groupRect = element.getBoundingClientRect();
        const rows = Array.from(element.querySelectorAll(".subway-lane-row"));
        const firstRow = rows[0];
        const lastRow = rows.at(-1);
        const fork = element.querySelector(".subway-fork-connectors");
        const merge = element.querySelector(".subway-merge-connectors");
        if (!(firstRow instanceof HTMLElement)
                || !(lastRow instanceof HTMLElement)
                || !(fork instanceof SVGSVGElement)
                || !(merge instanceof SVGSVGElement)) {
            return null;
        }
        const firstRect = firstRow.getBoundingClientRect();
        const lastRect = lastRow.getBoundingClientRect();
        const laneX = Array.from(firstRow.children, (cell) => {
            const rect = cell.getBoundingClientRect();
            return rect.left + (rect.width / 2) - groupRect.left;
        });
        const forkBoundaryY = fork.getBoundingClientRect().bottom - groupRect.top;
        const mergeBoundaryY = merge.getBoundingClientRect().top - groupRect.top;
        return {
            size: { width: groupRect.width, height: groupRect.height },
            forkSeams: laneX.map((x) => ({
                svg: { x, y: forkBoundaryY - 2 },
                body: { x, y: firstRect.top - groupRect.top + 2 },
            })),
            mergeSeams: laneX.map((x) => ({
                body: { x, y: lastRect.bottom - groupRect.top - 2 },
                svg: { x, y: mergeBoundaryY + 2 },
            })),
        };
    });
    assert.ok(geometry, `${groupId}: body seam geometry`);
    await group.evaluate((element) => element.classList.add("is-route-proof-clean", "is-route-proof-bare"));
    const bare = decodePng(await group.screenshot({ animations: "disabled" }));
    await group.evaluate((element) => element.classList.remove("is-route-proof-bare"));
    const painted = decodePng(await group.screenshot({ animations: "disabled" }));
    await group.evaluate((element) => element.classList.remove("is-route-proof-clean"));
    return { ...geometry, bare, painted };
}

async function captureDisconnectedConnectorMutation(page, role, pathIndex) {
    const connector = page.locator(`[data-role="${role}"]`);
    const root = connector.locator("xpath=..");
    const paths = connector.locator("path");
    await root.evaluate((element) => element.classList.add("is-connector-proof-isolated"));
    const priorVisibility = await paths.evaluateAll((elements) => elements.map((element) => element.style.visibility));
    await paths.evaluateAll((elements) => {
        for (const element of elements) {
            element.style.visibility = "hidden";
        }
    });
    const target = paths.nth(pathIndex);
    const originalD = await target.getAttribute("d");
    await target.evaluate((path) => {
        path.setAttribute("d", "M 0 0 L 0 1");
        path.style.visibility = "visible";
    });
    const mutated = decodePng(await root.screenshot({ animations: "disabled" }));
    await target.evaluate((path, d) => {
        if (d !== null) {
            path.setAttribute("d", d);
        }
    }, originalD);
    await paths.evaluateAll((elements, visibility) => {
        elements.forEach((element, index) => { element.style.visibility = visibility[index] ?? ""; });
    }, priorVisibility);
    await root.evaluate((element) => element.classList.remove("is-connector-proof-isolated"));
    return mutated;
}

function rectanglesIntersect(left, right) {
    return left.left < right.right
        && left.right > right.left
        && left.top < right.bottom
        && left.bottom > right.top;
}

test("whole-lane Mix and Bypass use the lane document/event path and restore an exact stored Mix", async () => {
    const laneDoc = JSON.parse(populatedThreeBandLaneDocJson());
    laneDoc.output = { mix: 0.37, bypassed: false };
    const page = await openHarnessPage({
        laneDoc: JSON.stringify(laneDoc),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });
        const slider = page.locator('[data-role="rack-lane-mix-slider"]');
        const bypass = page.locator('[data-role="rack-lane-bypass"]');
        await slider.waitFor();
        assert.equal(await slider.inputValue(), "0.37");
        assert.equal(await page.locator('[data-role="rack-lane-mix-value"]').textContent(), "37%");

        await clearHarnessDebugLog(page);
        await slider.fill("0");
        const liveZero = await waitForHarnessSnapshot(
            page,
            "zero Mix live event",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneOutputControl" && value?.mix === 0 && value?.bypassed === false
            )),
        );
        assert.deepEqual(liveZero.sentMessages, [{
            endpointID: "laneOutputControl",
            value: { mix: 0, bypassed: false },
        }]);
        assert.equal(readStoredLaneDoc(liveZero).output.mix, 0.37,
            "the live audible path must not persist mid-gesture");
        assert.deepEqual(liveZero.gestureStarts, []);
        assert.deepEqual(liveZero.gestureEnds, []);

        await slider.press("Tab");
        await waitForHarnessSnapshot(
            page,
            "zero Mix persisted as a continuous value",
            (snapshot) => readStoredLaneDoc(snapshot).output.mix === 0,
        );

        await slider.fill("0.37");
        await slider.press("Tab");
        await waitForHarnessSnapshot(
            page,
            "whole-lane Mix persisted",
            (snapshot) => readStoredLaneDoc(snapshot).output.mix === 0.37,
        );

        await clearHarnessDebugLog(page);
        await bypass.click();
        const bypassed = await waitForHarnessSnapshot(
            page,
            "whole lane bypassed without changing Mix",
            (snapshot) => {
                const output = readStoredLaneDoc(snapshot).output;
                return output.bypassed === true && output.mix === 0.37;
            },
        );
        assert.ok(bypassed.sentMessages.some(({ endpointID, value }) => (
            endpointID === "laneOutputControl" && value?.mix === 0.37 && value?.bypassed === true
        )));
        assert.equal(bypassed.sentMessages.some(({ endpointID }) => endpointID === "laneSlotParamValue"), false);
        assert.deepEqual(bypassed.gestureStarts, []);
        assert.deepEqual(bypassed.gestureEnds, []);
        assert.equal(await slider.isDisabled(), true);
        assert.equal(await slider.inputValue(), "0.37");

        await bypass.click();
        const restored = await waitForHarnessSnapshot(
            page,
            "whole lane restored to its exact Mix",
            (snapshot) => {
                const output = readStoredLaneDoc(snapshot).output;
                return output.bypassed === false && output.mix === 0.37;
            },
        );
        assert.ok(restored.sentMessages.some(({ endpointID, value }) => (
            endpointID === "laneOutputControl" && value?.mix === 0.37 && value?.bypassed === false
        )));
        assert.equal(await slider.isDisabled(), false);
        assert.equal(await slider.inputValue(), "0.37");
    } finally {
        await page.close();
    }
});

test("the editable FX graph ends at its final add above fixed Mix and POLISH", async () => {
    const page = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });

        const geometry = await page.locator(".rack-stack").evaluate((stack) => {
            const graph = stack.querySelector('[data-role="rack-module-list"]');
            const mix = stack.querySelector('[data-role="rack-lane-mix"]');
            const polish = stack.querySelector('[data-role="rack-polish-boundary"]');
            const tail = Array.from(stack.querySelectorAll(
                '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
            )).at(-1);
            const tailRow = tail?.closest(".subway-ghost-row");
            if (!(graph instanceof HTMLElement) || !(mix instanceof HTMLElement)
                    || !(polish instanceof HTMLElement) || !(tail instanceof HTMLButtonElement)
                    || !(tailRow instanceof HTMLElement)) {
                return null;
            }
            const rectOf = (element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            };
            const centerOwner = (element) => {
                const rect = element.getBoundingClientRect();
                const owner = document.elementFromPoint(
                    rect.left + (rect.width / 2),
                    rect.top + (rect.height / 2),
                );
                return owner !== null && (owner === element || element.contains(owner));
            };
            return {
                stack: rectOf(stack),
                graph: rectOf(graph),
                tail: rectOf(tailRow),
                mix: rectOf(mix),
                polish: rectOf(polish),
                graphOwnsMix: graph.contains(mix),
                graphOwnsPolish: graph.contains(polish),
                tailReachable: centerOwner(tail),
                mixReachable: centerOwner(mix),
                polishReachable: centerOwner(polish),
            };
        });

        assert.ok(geometry);
        assert.equal(geometry.graphOwnsMix, false, "Mix must be outside the scrollable graph");
        assert.equal(geometry.graphOwnsPolish, false, "POLISH must be outside the scrollable graph");
        assert.equal(Math.abs(geometry.tail.bottom - geometry.graph.bottom) <= 1, true,
            "the final add row must own the graph's bottom edge");
        assert.equal(Math.abs(geometry.graph.bottom - geometry.mix.top) <= 1, true,
            "the fixed Mix row must begin exactly where the graph ends");
        assert.equal(Math.abs(geometry.mix.bottom - geometry.polish.top) <= 1, true,
            "Mix must sit flush above POLISH");
        assert.equal(Math.abs(geometry.polish.bottom - geometry.stack.bottom) <= 1, true,
            "POLISH must own the stack's bottom edge");
        assert.deepEqual(
            [geometry.tailReachable, geometry.mixReachable, geometry.polishReachable],
            [true, true, true],
            "the final add, Mix, and POLISH must own their center hit points",
        );
    } finally {
        await page.close();
    }
});

test("the fixed FX footer truncates the composed graph without covering its interactions", async () => {
    const cases = [
        { name: "empty-phone", width: 320, height: 568, laneDoc: emptyLaneDocJson() },
        { name: "short-phone", width: 320, height: 568, laneDoc: "fresh" },
        { name: "overflowing-serial-phone", width: 393, height: 852, laneDoc: maximumSerialLaneDocJson() },
        { name: "split-phone", width: 393, height: 852, laneDoc: populatedThreeBandLaneDocJson() },
        { name: "parallel-phone", width: 393, height: 852, laneDoc: populatedFourWayParallelLaneDocJson() },
        { name: "split-plugin", width: 640, height: 700, laneDoc: populatedThreeBandLaneDocJson() },
        { name: "split-desktop", width: 1024, height: 768, laneDoc: populatedThreeBandLaneDocJson() },
    ];
    await fs.mkdir(fxFooterEvidenceDirectory, { recursive: true });

    for (const fixture of cases) {
        const page = await openHarnessPage({
            laneDoc: fixture.laneDoc,
            beforeGoto: (nextPage) => nextPage.setViewportSize({
                width: fixture.width,
                height: fixture.height,
            }),
        });
        try {
            if (fixture.width < 640) {
                await page.click('[data-role="mobile-workspace-tab-fx"]');
            }
            const graph = page.locator('[data-role="rack-module-list"]');
            await graph.waitFor();
            await page.locator('[data-role="rack-lane-bypass"]').scrollIntoViewIfNeeded();
            const topGeometry = await graph.evaluate((element) => {
                const rectOf = (node) => {
                    const rect = node.getBoundingClientRect();
                    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
                };
                const intersects = (left, right) => left.left < right.right && left.right > right.left
                    && left.top < right.bottom && left.bottom > right.top;
                const graphRect = rectOf(element);
                const stack = element.closest(".rack-stack");
                const grid = element.closest(".rack-effects-grid");
                const graphBoundary = element.closest('[data-role="rack-graph-boundary"]');
                const footer = stack?.querySelector('[data-role="rack-fixed-footer"]');
                const bypass = element.querySelector('[data-role="rack-lane-bypass"]');
                const topCue = stack?.querySelector(".subway-scroll-cue-top");
                const bottomCue = stack?.querySelector(".subway-scroll-cue-bottom");
                if (!(stack instanceof HTMLElement) || !(grid instanceof HTMLElement)
                        || !(graphBoundary instanceof HTMLElement) || !(footer instanceof HTMLElement)
                        || !(bypass instanceof HTMLButtonElement) || !(topCue instanceof HTMLElement)
                        || !(bottomCue instanceof HTMLElement)) {
                    return null;
                }
                const bypassRect = rectOf(bypass);
                const bottomCueRect = rectOf(bottomCue);
                const interactive = Array.from(element.querySelectorAll([
                    "button.subway-station",
                    "button.subway-ghost-button",
                    "button.subway-fork-lane",
                    "button.subway-fork-readout",
                ].join(","))).filter((node) => {
                    const rect = node.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0
                        && rect.top >= graphRect.top && rect.bottom <= graphRect.bottom;
                });
                const connectorCovered = Array.from(element.querySelectorAll(".subway-connector-svg path"))
                    .some((path) => {
                        const matrix = path.getScreenCTM();
                        if (matrix === null) return false;
                        const length = path.getTotalLength();
                        return Array.from({ length: 41 }, (_, index) => index / 40).some((fraction) => {
                            const source = path.getPointAtLength(length * fraction);
                            const point = new DOMPoint(source.x, source.y).matrixTransform(matrix);
                            return point.x > bypassRect.left && point.x < bypassRect.right
                                && point.y > bypassRect.top && point.y < bypassRect.bottom;
                        });
                    });
                const bypassCenterHit = document.elementFromPoint(
                    (bypassRect.left + bypassRect.right) / 2,
                    (bypassRect.top + bypassRect.bottom) / 2,
                );
                return {
                    graph: graphRect,
                    graphBoundary: rectOf(graphBoundary),
                    stack: rectOf(stack),
                    grid: rectOf(grid),
                    footer: rectOf(footer),
                    graphOwnsFooter: element.contains(footer),
                    topCueInGraphBoundary: graphBoundary.contains(topCue),
                    bottomCueInGraphBoundary: graphBoundary.contains(bottomCue),
                    bottomCueVisible: bottomCue.classList.contains("is-visible"),
                    bottomCue: bottomCueRect,
                    bypass: bypassRect,
                    bypassCenterReachable: bypass.contains(bypassCenterHit),
                    bypassCenterHit: bypassCenterHit instanceof HTMLElement
                        ? `${bypassCenterHit.tagName.toLowerCase()}.${bypassCenterHit.className}`
                        : String(bypassCenterHit),
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    bypassIntersections: interactive.filter((node) => intersects(bypassRect, rectOf(node))).length,
                    connectorCovered,
                    gridChildCount: grid.children.length,
                    modulationAttributes: bypass.querySelectorAll("[data-modulation-target-kind]").length,
                };
            });
            assert.ok(topGeometry, fixture.name);
            assert.deepEqual(topGeometry.graph, topGeometry.graphBoundary,
                `${fixture.name}: the graph fills only its reserved boundary`);
            assert.equal(topGeometry.graphOwnsFooter, false,
                `${fixture.name}: the fixed footer is not graph content`);
            assert.equal(topGeometry.topCueInGraphBoundary, true,
                `${fixture.name}: the top scroll cue belongs to the graph boundary`);
            assert.equal(topGeometry.bottomCueInGraphBoundary, true,
                `${fixture.name}: the bottom scroll cue belongs to the graph boundary`);
            if (fixture.name === "overflowing-serial-phone") {
                assert.equal(topGeometry.bottomCueVisible, true,
                    `${fixture.name}: the overflow fixture exposes the bottom cue`);
            }
            if (topGeometry.bottomCueVisible) {
                assert.equal(topGeometry.bottomCue.bottom <= topGeometry.footer.top + 1, true,
                    `${fixture.name}: the visible bottom cue stops above the fixed footer`);
            }
            assert.equal(Math.abs(topGeometry.graph.bottom - topGeometry.footer.top) <= 1, true,
                `${fixture.name}: the graph ends flush against the fixed footer`);
            assert.equal(Math.abs(topGeometry.footer.bottom - topGeometry.stack.bottom) <= 1, true,
                `${fixture.name}: the footer consumes the bottom of the stack`);
            assert.equal((topGeometry.stack.bottom - topGeometry.stack.top)
                - (topGeometry.graph.bottom - topGeometry.graph.top) >= 101.5, true,
            `${fixture.name}: Mix and POLISH consume real layout height`);
            assert.equal(Math.abs((topGeometry.grid.bottom - topGeometry.grid.top)
                - (topGeometry.stack.bottom - topGeometry.stack.top)) <= 1, true,
            `${fixture.name}: the outer effects grid keeps its established height`);
            if (fixture.width >= 640) {
                assert.equal(Math.abs((topGeometry.grid.bottom - topGeometry.grid.top) - 476) <= 1, true,
                    `${fixture.name}: desktop/plugin effects grid retains its 476px contract`);
            }
            assert.equal(topGeometry.gridChildCount, 2, `${fixture.name}: the footer does not add an editor column`);
            assert.equal(topGeometry.bypass.right - topGeometry.bypass.left >= 43.5, true,
                `${fixture.name}: Bypass keeps a touch-sized width`);
            assert.equal(topGeometry.bypass.bottom - topGeometry.bypass.top >= 43.5, true,
                `${fixture.name}: Bypass keeps a touch-sized height`);
            assert.equal(
                topGeometry.bypassCenterReachable,
                true,
                `${fixture.name}: bypass hit target reachable; ${JSON.stringify({
                    hit: topGeometry.bypassCenterHit,
                    bypass: topGeometry.bypass,
                    graph: topGeometry.graph,
                    viewport: topGeometry.viewport,
                })}`,
            );
            assert.equal(topGeometry.bypassIntersections, 0, `${fixture.name}: bypass clears graph controls`);
            assert.equal(topGeometry.connectorCovered, false, `${fixture.name}: bypass clears connector paths`);
            assert.equal(topGeometry.modulationAttributes, 0, `${fixture.name}: bypass is not a modulation target`);
            const footerBeforeScroll = topGeometry.footer;

            await graph.evaluate((element) => {
                element.scrollTop = element.scrollHeight;
                element.dispatchEvent(new Event("scroll"));
            });
            await page.locator('[data-role="rack-polish-node"]').scrollIntoViewIfNeeded();
            const bottomGeometry = await page.locator(".rack-stack").evaluate((stack) => {
                const rectOf = (node) => {
                    const rect = node.getBoundingClientRect();
                    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
                };
                const intersects = (left, right) => left.left < right.right && left.right > right.left
                    && left.top < right.bottom && left.bottom > right.top;
                const graph = stack.querySelector('[data-role="rack-module-list"]');
                const footer = stack.querySelector('[data-role="rack-fixed-footer"]');
                const mix = stack.querySelector('[data-role="rack-lane-mix"]');
                const slider = stack.querySelector('[data-role="rack-lane-mix-slider"]');
                const trunkTail = Array.from(stack.querySelectorAll(
                    '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
                )).at(-1);
                const tailRow = trunkTail?.closest(".subway-ghost-row");
                const polish = stack.querySelector('[data-role="rack-polish-boundary"]');
                const polishNode = stack.querySelector('[data-role="rack-polish-node"]');
                if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)
                        || !(mix instanceof HTMLElement) || !(slider instanceof HTMLInputElement)
                        || !(trunkTail instanceof HTMLButtonElement) || !(tailRow instanceof HTMLElement)
                        || !(polish instanceof HTMLElement) || !(polishNode instanceof HTMLButtonElement)) return null;
                const graphRect = rectOf(graph);
                const footerRect = rectOf(footer);
                const mixRect = rectOf(mix);
                const sliderRect = rectOf(slider);
                const tailRect = rectOf(tailRow);
                const polishRect = rectOf(polish);
                const polishNodeRect = rectOf(polishNode);
                const interactive = Array.from(graph.querySelectorAll([
                    "button.subway-station",
                    "button.subway-ghost-button",
                    "button.subway-fork-lane",
                    "button.subway-fork-readout",
                ].join(","))).filter((node) => {
                    const rect = node.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0
                        && rect.top >= graphRect.top && rect.bottom <= graphRect.bottom;
                });
                const ownsCenter = (node) => {
                    const rect = node.getBoundingClientRect();
                    const owner = document.elementFromPoint(
                        rect.left + (rect.width / 2),
                        rect.top + (rect.height / 2),
                    );
                    return owner !== null && (owner === node || node.contains(owner));
                };
                const sliderHit = document.elementFromPoint(
                    sliderRect.left + (sliderRect.right - sliderRect.left) / 2,
                    sliderRect.top + (sliderRect.bottom - sliderRect.top) / 2,
                );
                const sliderHitOwners = [
                    [sliderRect.left + 3, (sliderRect.top + sliderRect.bottom) / 2],
                    [sliderRect.right - 3, (sliderRect.top + sliderRect.bottom) / 2],
                    [(sliderRect.left + sliderRect.right) / 2, sliderRect.top + 3],
                    [(sliderRect.left + sliderRect.right) / 2, sliderRect.bottom - 3],
                ].map(([x, y]) => slider.contains(document.elementFromPoint(x, y)));
                const polishCenterOwner = document.elementFromPoint(
                    (polishNodeRect.left + polishNodeRect.right) / 2,
                    (polishNodeRect.top + polishNodeRect.bottom) / 2,
                );
                return {
                    stack: rectOf(stack),
                    graph: graphRect,
                    mix: mixRect,
                    slider: sliderRect,
                    tail: tailRect,
                    tailButton: rectOf(trunkTail),
                    footer: footerRect,
                    polish: polishRect,
                    polishNode: polishNodeRect,
                    graphOwnsMix: graph.contains(mix),
                    graphOwnsPolish: graph.contains(polish),
                    mixIntersections: interactive.filter((node) => intersects(mixRect, rectOf(node))).length,
                    footerIntersections: interactive.filter((node) => intersects(footerRect, rectOf(node))).length,
                    graphOwnsFooterPoint: graph.contains(document.elementFromPoint(
                        (footerRect.left + footerRect.right) / 2,
                        footerRect.top + 2,
                    )),
                    tailReachable: ownsCenter(trunkTail),
                    sliderReachable: slider.contains(sliderHit),
                    polishReachable: ownsCenter(polishNode),
                    polishCenterOwner: polishCenterOwner instanceof HTMLElement ? {
                        className: polishCenterOwner.className,
                        role: polishCenterOwner.closest("[data-role]")?.getAttribute("data-role") ?? null,
                        tagName: polishCenterOwner.tagName,
                    } : null,
                    viewport: {
                        height: window.innerHeight,
                        scrollHeight: document.documentElement.scrollHeight,
                        scrollY: window.scrollY,
                    },
                    sliderHitOwners,
                    sliderTouchAction: getComputedStyle(slider).touchAction,
                    scrollAtBottom: graph.scrollTop + graph.clientHeight >= graph.scrollHeight - 1,
                    modulationAttributes: mix.querySelectorAll("[data-modulation-target-kind]").length,
                };
            });
            assert.ok(bottomGeometry, fixture.name);
            assert.equal(bottomGeometry.graphOwnsMix, false, `${fixture.name}: Mix is fixed outside the graph`);
            assert.equal(bottomGeometry.graphOwnsPolish, false, `${fixture.name}: POLISH is fixed outside the graph`);
            assert.equal(Math.abs(bottomGeometry.tail.bottom - bottomGeometry.graph.bottom) <= 1, true,
                `${fixture.name}: final trunk add owns the graph's tail edge`);
            assert.equal(Math.abs(bottomGeometry.graph.bottom - bottomGeometry.mix.top) <= 1, true,
                `${fixture.name}: final add is directly before Mix`);
            assert.equal(Math.abs(bottomGeometry.mix.bottom - bottomGeometry.polish.top) <= 1, true,
                `${fixture.name}: Mix is directly before POLISH`);
            assert.equal(Math.abs(bottomGeometry.polish.bottom - bottomGeometry.footer.bottom) <= 1, true,
                `${fixture.name}: POLISH owns the footer's bottom edge`);
            assert.equal(Math.abs(
                (bottomGeometry.footer.top - bottomGeometry.stack.top)
                    - (footerBeforeScroll.top - topGeometry.stack.top),
            ) <= 0.5 && Math.abs(
                (bottomGeometry.footer.bottom - bottomGeometry.stack.bottom)
                    - (footerBeforeScroll.bottom - topGeometry.stack.bottom),
            ) <= 0.5, true,
            `${fixture.name}: scrolling the graph does not move the fixed footer`);
            assert.equal(bottomGeometry.mix.bottom - bottomGeometry.mix.top >= 43.5, true,
                `${fixture.name}: Mix keeps a touch-sized row`);
            assert.equal(bottomGeometry.slider.bottom - bottomGeometry.slider.top >= 43.5, true,
                `${fixture.name}: Mix slider itself keeps a touch-sized hit box`);
            assert.equal(bottomGeometry.tailButton.bottom - bottomGeometry.tailButton.top >= 43.5, true,
                `${fixture.name}: final add keeps a touch-sized hit box`);
            assert.equal(bottomGeometry.polishNode.bottom - bottomGeometry.polishNode.top >= 43.5, true,
                `${fixture.name}: POLISH keeps a touch-sized hit box`);
            assert.equal(bottomGeometry.mixIntersections, 0, `${fixture.name}: Mix clears graph interactions`);
            assert.equal(bottomGeometry.footerIntersections, 0,
                `${fixture.name}: graph interactions stop above the footer`);
            assert.equal(bottomGeometry.graphOwnsFooterPoint, false,
                `${fixture.name}: graph paint and hit ownership stop at the footer boundary`);
            assert.equal(bottomGeometry.tailReachable, true, `${fixture.name}: final add remains reachable`);
            assert.equal(bottomGeometry.sliderReachable, true, `${fixture.name}: Mix slider reachable`);
            assert.equal(bottomGeometry.polishReachable, true,
                `${fixture.name}: POLISH remains reachable; ${JSON.stringify({
                    owner: bottomGeometry.polishCenterOwner,
                    polish: bottomGeometry.polishNode,
                    viewport: bottomGeometry.viewport,
                })}`);
            assert.deepEqual(bottomGeometry.sliderHitOwners, [true, true, true, true],
                `${fixture.name}: Mix slider owns all four hit-box edges`);
            assert.equal(bottomGeometry.sliderTouchAction, "pan-y",
                `${fixture.name}: vertical graph scrolling remains available over Mix`);
            assert.equal(bottomGeometry.scrollAtBottom, true, `${fixture.name}: graph still scrolls to its true bottom`);
            assert.equal(bottomGeometry.modulationAttributes, 0, `${fixture.name}: Mix is not a modulation target`);

            await page.locator(".rack-stack").screenshot({
                path: path.join(fxFooterEvidenceDirectory, `${fixture.name}-bottom.png`),
                animations: "disabled",
            });

            const graphTargets = graph.locator([
                "button.subway-station:visible",
                "button.subway-ghost-button:visible",
                "button.subway-fork-lane:visible",
                "button.subway-fork-readout:visible",
            ].join(","));
            for (let index = 0; index < await graphTargets.count(); index += 1) {
                const target = graphTargets.nth(index);
                await target.scrollIntoViewIfNeeded();
                assert.equal(await target.evaluate((node) => {
                    const rect = node.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                        rect.left + (rect.width / 2),
                        rect.top + (rect.height / 2),
                    );
                    return node.contains(hit);
                }), true, `${fixture.name}: graph target ${index} remains reachable`);
            }
        } finally {
            await page.close();
        }
    }
});

test("POLISH composes four compact modules, independent bypasses, and the T75 expansion handoff", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedThreeBandLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });
        const polish = page.locator('[data-role="rack-polish-node"]');
        await polish.waitFor();
        const structure = await page.locator(".rack-stack").evaluate((stack) => {
            const graph = stack.querySelector('[data-role="rack-module-list"]');
            const footer = stack.querySelector('[data-role="rack-fixed-footer"]');
            const mix = stack.querySelector('[data-role="rack-lane-mix"]');
            const tail = Array.from(stack.querySelectorAll(
                '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
            )).at(-1);
            const tailRow = tail?.closest(".subway-ghost-row");
            const polishBoundary = stack.querySelector('[data-role="rack-polish-boundary"]');
            const fixedNode = stack.querySelector('[data-role="rack-polish-node"]');
            if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)
                    || !(mix instanceof HTMLElement)
                    || !(tail instanceof HTMLButtonElement) || !(tailRow instanceof HTMLElement)
                    || !(polishBoundary instanceof HTMLElement)
                    || !(fixedNode instanceof HTMLButtonElement)) return null;
            const stackRect = stack.getBoundingClientRect();
            const graphRect = graph.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            const mixRect = mix.getBoundingClientRect();
            const tailRect = tailRow.getBoundingClientRect();
            const polishRect = polishBoundary.getBoundingClientRect();
            return {
                fixedLayout: {
                    stackHeight: stackRect.height,
                    graphHeight: graphRect.height,
                    footerHeight: footerRect.height,
                    polishHeight: polishRect.height,
                    graphScrollTop: graph.scrollTop,
                    graphScrollHeight: graph.scrollHeight,
                    graphClientHeight: graph.clientHeight,
                },
                vertical: {
                    tailBottom: tailRect.bottom,
                    graphBottom: graphRect.bottom,
                    mixTop: mixRect.top,
                    mixBottom: mixRect.bottom,
                    polishTop: polishRect.top,
                },
                graphOwnsFixedControls: graph.contains(mix) || graph.contains(fixedNode),
                draggable: fixedNode.getAttribute("draggable"),
                modulationTargets: fixedNode.querySelectorAll("[data-modulation-target-kind]").length,
            };
        });
        assert.ok(structure);
        assert.equal(Math.abs(structure.vertical.tailBottom - structure.vertical.graphBottom) <= 1, true);
        assert.equal(Math.abs(structure.vertical.graphBottom - structure.vertical.mixTop) <= 1, true);
        assert.equal(Math.abs(structure.vertical.mixBottom - structure.vertical.polishTop) <= 1, true);
        assert.equal(structure.graphOwnsFixedControls, false);
        assert.equal(structure.draggable, null);
        assert.equal(structure.modulationTargets, 0);

        await polish.click({ button: "right" });
        assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-group-menu"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-add-sheet"]').count(), 0);

        await polish.click();
        const editor = page.locator('[data-role="rack-editor-polish"]');
        await editor.waitFor();
        assert.equal(await editor.locator('[data-role^="polish-module-"]').count(), 4);
        assert.equal(await editor.locator('[data-role^="polish-control-"]').count(), 4);
        assert.equal(await editor.locator('[data-role^="polish-bypass-"]').count(), 4);
        assert.equal(await editor.locator('[data-modulation-target-kind]').count(), 0);
        assert.equal(await editor.locator('.rack-editor-power').count(), 0);
        const revealPolishModule = async (locator) => {
            await locator.scrollIntoViewIfNeeded();
            await locator.evaluate((element) => {
                const module = element.closest('[data-role^="polish-module-"]');
                const scroller = element.closest(".polish-editor-controls");
                if (!(module instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return;
                const moduleRect = module.getBoundingClientRect();
                const scrollerRect = scroller.getBoundingClientRect();
                scroller.scrollTop += moduleRect.top - scrollerRect.top;
            });
        };
        const clickPolishBypass = async (endpointID) => {
            const bypass = page.locator(`[data-role="polish-bypass-${endpointID}"]`);
            await revealPolishModule(bypass);
            await bypass.click();
        };

        await page.locator('[data-role="polish-knob-polishSafeBassAmount"]').press("End");
        await page.locator('[data-role="polish-knob-polishEnhancerAmount"]').press("End");
        await page.locator('[data-role="polish-knob-polishCompressionClipAmount"]').press("End");
        await page.locator('[data-role="polish-knob-polishOutputTrimDb"]').press("Home");
        const edited = await waitForHarnessSnapshot(
            page,
            "four Polish module controls",
            (snapshot) => snapshot.parameterValues.polishSafeBassAmount === 1
                && snapshot.parameterValues.polishEnhancerAmount === 1
                && snapshot.parameterValues.polishCompressionClipAmount === 1
                && snapshot.parameterValues.polishOutputTrimDb === -24,
        );
        assert.deepEqual(
            Object.fromEntries([
                "polishSafeBassAmount",
                "polishEnhancerAmount",
                "polishCompressionClipAmount",
                "polishOutputTrimDb",
            ].map((endpointID) => [endpointID, edited.parameterValues[endpointID]])),
            {
                polishSafeBassAmount: 1,
                polishEnhancerAmount: 1,
                polishCompressionClipAmount: 1,
                polishOutputTrimDb: -24,
            },
        );

        await clickPolishBypass("polishSafeBassBypass");
        const safeBassBypassed = await waitForHarnessSnapshot(
            page,
            "only Safe Bass bypassed",
            (snapshot) => snapshot.parameterValues.polishSafeBassBypass === 1,
        );
        assert.equal(safeBassBypassed.parameterValues.polishSafeBassAmount, 1);
        assert.equal(safeBassBypassed.parameterValues.polishEnhancerBypass, 0);
        assert.equal(safeBassBypassed.parameterValues.polishCompressionClipBypass, 0);
        assert.equal(safeBassBypassed.parameterValues.polishOutputTrimBypass, 0);

        for (const endpointID of [
            "polishEnhancerBypass",
            "polishCompressionClipBypass",
            "polishOutputTrimBypass",
        ]) {
            await clickPolishBypass(endpointID);
        }
        const allBypassed = await waitForHarnessSnapshot(
            page,
            "every Polish module bypassed independently",
            (snapshot) => [
                "polishSafeBassBypass",
                "polishEnhancerBypass",
                "polishCompressionClipBypass",
                "polishOutputTrimBypass",
            ].every((endpointID) => snapshot.parameterValues[endpointID] === 1),
        );
        assert.equal(allBypassed.parameterValues.polishEnhancerAmount, 1);
        assert.equal(allBypassed.parameterValues.polishCompressionClipAmount, 1);
        assert.equal(allBypassed.parameterValues.polishOutputTrimDb, -24);

        assert.equal(
            allBypassed.sentMessages.some(({ endpointID, value }) => (
                endpointID === "polishAnalyzerEnabledIn" && value === 0
            )),
            true,
            "the production analyzer starts dormant while the full-screen editor is closed",
        );
        const graphScrollTopBeforeExpand = await graph.evaluate((element) => element.scrollTop);
        await clearHarnessDebugLog(page);
        const expand = page.locator('[data-role="polish-expand"]');
        await expand.click();
        const fullScreen = page.locator('[data-role="polish-fullscreen-editor"]');
        await fullScreen.waitFor();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="polish-expand"]')?.getAttribute("aria-expanded") === "true"
        ));
        assert.equal(await editor.getAttribute("data-expanded"), "true");
        assert.deepEqual(
            await fullScreen.locator("[data-polish-stage]").evaluateAll((stages) => (
                stages.map((stage) => stage.getAttribute("data-polish-stage"))
            )),
            ["safe-bass", "enhancer", "compressor", "soft-clipper", "output-trim"],
        );
        assert.equal(await fullScreen.getAttribute("role"), "dialog");
        assert.equal(await fullScreen.getAttribute("aria-modal"), null);
        assert.equal(await fullScreen.locator('[data-role^="polish-fullscreen-control-"]').count(), 4);
        assert.equal(await fullScreen.locator('[data-role^="polish-fullscreen-bypass-"]').count(), 4);
        assert.equal(await fullScreen.locator("input, [data-role*='advanced']").count(), 0);
        assert.match(
            await fullScreen.locator('[data-role="polish-comp-explanation"]').textContent(),
            /compression.+soft clipping/i,
        );
        assert.equal(
            await fullScreen.locator('[data-polish-stage="compressor"]').getAttribute("data-stage-active"),
            "false",
        );
        assert.equal(
            await fullScreen.locator('[data-polish-stage="soft-clipper"]').getAttribute("data-stage-active"),
            "false",
        );

        const analyzerOpen = await waitForHarnessSnapshot(
            page,
            "the real full-screen editor to enable its hidden analyzer",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "polishAnalyzerEnabledIn" && value === 1
            )),
        );
        assert.equal(
            analyzerOpen.sentMessages.some(({ endpointID }) => (
                endpointID.startsWith("polish") && endpointID !== "polishAnalyzerEnabledIn"
            )),
            false,
            "opening the page must not edit any approved sound parameter",
        );

        await page.evaluate(() => {
            const magnitudes = new Array(2_048).fill(0);
            magnitudes[200] = 1;
            window.__COSIMO_DESKTOP_HARNESS__.emitPolishMeter({
                peakDbfs: -1.2,
                loudnessDbfs: -13.4,
                compressorGainReductionDb: -3.6,
            });
            window.__COSIMO_DESKTOP_HARNESS__.emitPolishMeter({
                sampleRateHz: 4_096,
                magnitudes,
            });
        });
        await page.waitForFunction(() => {
            const fullEditor = document.querySelector('[data-role="polish-fullscreen-editor"]');
            return fullEditor?.querySelector('[data-role="enhancer-spectrum-incoming"]') !== null
                && fullEditor?.querySelector('[data-role="polish-compressor-gain-reduction"]')
                    ?.textContent?.includes("3.6 dB");
        });
        assert.match(
            await fullScreen.locator('[data-role="polish-output-meters"]').textContent(),
            /-1\.2 dBFS[\s\S]*-13\.4 dBFS/,
        );

        const fullCompKnob = fullScreen.locator(
            '[data-role="polish-fullscreen-control-polishCompressionClipAmount"]',
        );
        await fullCompKnob.press("Home");
        await waitForHarnessSnapshot(
            page,
            "the full-screen Comp mirror to edit the real T74 binding",
            (snapshot) => snapshot.parameterValues.polishCompressionClipAmount === 0,
        );
        await fullCompKnob.press("End");
        await waitForHarnessSnapshot(
            page,
            "the full-screen Comp mirror to restore the real T74 binding",
            (snapshot) => snapshot.parameterValues.polishCompressionClipAmount === 1,
        );
        const fullCompBypass = fullScreen.locator(
            '[data-role="polish-fullscreen-bypass-polishCompressionClipBypass"]',
        );
        await fullCompBypass.click();
        await waitForHarnessSnapshot(
            page,
            "the full-screen Comp action to enable the real T74 module",
            (snapshot) => snapshot.parameterValues.polishCompressionClipBypass === 0,
        );
        assert.equal(
            await fullScreen.locator('[data-polish-stage="compressor"]').getAttribute("data-stage-active"),
            "true",
        );
        assert.equal(
            await fullScreen.locator('[data-polish-stage="soft-clipper"]').getAttribute("data-stage-active"),
            "true",
        );
        await fullCompBypass.click();
        await waitForHarnessSnapshot(
            page,
            "the full-screen Comp action to restore bypass",
            (snapshot) => snapshot.parameterValues.polishCompressionClipBypass === 1,
        );

        const close = fullScreen.locator('[data-role="polish-fullscreen-close"]');
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        const keyboardBoundary = await fullScreen.evaluate((editor) => {
            const viewRoot = editor.getRootNode();
            let active = viewRoot instanceof ShadowRoot ? viewRoot.activeElement : document.activeElement;
            const focusChain = [];
            while (active instanceof HTMLElement) {
                focusChain.push(
                    active.getAttribute("data-role")
                        ?? active.getAttribute("data-action")
                        ?? active.tagName.toLowerCase(),
                );
                const nested = active.shadowRoot?.activeElement;
                if (!(nested instanceof HTMLElement)) break;
                active = nested;
            }
            return {
                outsideEditor: active instanceof HTMLElement && !editor.contains(active),
                focusChain,
            };
        });
        assert.equal(keyboardBoundary.outsideEditor, true, JSON.stringify(keyboardBoundary));
        assert.equal(
            keyboardBoundary.focusChain.some((entry) => (
                entry === "synth-preset-bar-host"
                    || entry === "cosimo-preset-bar"
                    || entry === "mobile-bottom-dock"
                    || entry === "shell-back"
                    || entry === "toggle-shell-menu"
            )),
            true,
            `Shift+Tab must reach intentional live shell chrome: ${JSON.stringify(keyboardBoundary)}`,
        );

        await close.focus();
        await close.click();
        await fullScreen.waitFor({ state: "detached" });
        const analyzerClosed = await waitForHarnessSnapshot(
            page,
            "the hidden analyzer to stop after close",
            (snapshot) => [...snapshot.sentMessages].reverse().some(({ endpointID, value }) => (
                endpointID === "polishAnalyzerEnabledIn" && value === 0
            )),
        );
        assert.equal(
            [...analyzerClosed.sentMessages].reverse().find(
                ({ endpointID }) => endpointID === "polishAnalyzerEnabledIn",
            )?.value,
            0,
        );
        await page.waitForFunction(() => (
            document.querySelector('[data-role="polish-expand"]')?.getAttribute("aria-expanded") === "false"
        ));
        assert.equal(await editor.getAttribute("data-expanded"), "false");
        assert.equal(await polish.getAttribute("aria-pressed"), "true");
        assert.equal(await expand.evaluate((element) => (
            element.getRootNode() instanceof ShadowRoot
                ? element.getRootNode().activeElement === element
                : document.activeElement === element
        )), true);
        assert.equal(
            await page.locator('[data-role="rack-polish-boundary"]').evaluate(
                (element) => element.getBoundingClientRect().height,
            ),
            structure.fixedLayout.polishHeight,
        );
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        const restoredFixedLayout = await page.locator(".rack-stack").evaluate((stack) => {
            const graph = stack.querySelector('[data-role="rack-module-list"]');
            const footer = stack.querySelector('[data-role="rack-fixed-footer"]');
            const polishBoundary = stack.querySelector('[data-role="rack-polish-boundary"]');
            if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)
                    || !(polishBoundary instanceof HTMLElement)) return null;
            return {
                stackHeight: stack.getBoundingClientRect().height,
                graphHeight: graph.getBoundingClientRect().height,
                footerHeight: footer.getBoundingClientRect().height,
                polishHeight: polishBoundary.getBoundingClientRect().height,
                graphScrollTop: graph.scrollTop,
                graphScrollHeight: graph.scrollHeight,
                graphClientHeight: graph.clientHeight,
            };
        });
        assert.deepEqual(restoredFixedLayout, {
            ...structure.fixedLayout,
            graphScrollTop: graphScrollTopBeforeExpand,
        });

        for (const surface of [
            { name: "phone", width: 393, height: 852 },
            { name: "narrow phone", width: 320, height: 700 },
            { name: "plugin", width: 640, height: 700 },
            { name: "desktop", width: 1_024, height: 768 },
        ]) {
            await page.setViewportSize({ width: surface.width, height: surface.height });
            await page.evaluate(() => new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            }));
            if (await page.locator('[data-role="rack-editor-polish"]').count() === 0) {
                const surfacePolish = page.locator('[data-role="rack-polish-node"]');
                await surfacePolish.scrollIntoViewIfNeeded();
                await surfacePolish.click();
                await page.locator('[data-role="rack-editor-polish"]').waitFor();
            }
            for (const [moduleID, expectedLabel] of [
                ["safe-bass", "SAFE BASS"],
                ["enhance", "ENHANCE"],
                ["comp", "COMP"],
                ["output-trim", "OUTPUT TRIM"],
            ]) {
                const module = page.locator(`[data-role="polish-module-${moduleID}"]`);
                await revealPolishModule(module);
                const presentation = await module.evaluate((element) => {
                    const label = element.querySelector(".polish-module-header > strong");
                    const bypass = element.querySelector('[data-role^="polish-bypass-"]');
                    if (!(label instanceof HTMLElement) || !(bypass instanceof HTMLButtonElement)) return null;
                    const moduleRect = element.getBoundingClientRect();
                    const bypassRect = bypass.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                        bypassRect.left + (bypassRect.width / 2),
                        bypassRect.top + (bypassRect.height / 2),
                    );
                    return {
                        label: label.textContent,
                        labelFits: label.scrollWidth <= label.clientWidth + 1
                            && label.scrollHeight <= label.clientHeight + 1,
                        moduleWidth: moduleRect.width,
                        moduleHeight: moduleRect.height,
                        bypassWidth: bypassRect.width,
                        bypassHeight: bypassRect.height,
                        bypassOwnsCenter: bypass.contains(hit),
                    };
                });
                assert.ok(presentation, `${surface.name} ${moduleID}`);
                assert.equal(presentation.label, expectedLabel, `${surface.name} ${moduleID}`);
                assert.equal(presentation.labelFits, true, `${surface.name} ${moduleID}`);
                assert.equal(presentation.moduleWidth > 0 && presentation.moduleHeight > 0, true);
                assert.equal(presentation.bypassWidth >= 44 && presentation.bypassHeight >= 44, true);
                assert.equal(presentation.bypassOwnsCenter, true, `${surface.name} ${moduleID}`);
            }
        }

        await page.locator('[data-role="rack-lane-bypass"]').click();
        const bypassed = await waitForHarnessSnapshot(
            page,
            "lane bypass remains upstream of Polish",
            (snapshot) => readStoredLaneDoc(snapshot).output.bypassed === true,
        );
        assert.equal(bypassed.parameterValues.polishEnhancerAmount, 1);
        assert.equal(bypassed.parameterValues.polishCompressionClipAmount, 1);
        assert.equal(bypassed.parameterValues.polishOutputTrimDb, -24);
        assert.equal(bypassed.parameterValues.polishSafeBassAmount, 1);
        assert.equal(bypassed.parameterValues.polishSafeBassBypass, 1);
        assert.equal(await page.locator('[data-role="rack-polish-node"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("the built desktop bundle exposes T74 controls and restores the T73 footer after the T75 editor", async () => {
    const page = await openBuiltDesktopBundlePage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await page.locator('[data-role="rack-polish-node"]').click();
        const editor = page.locator('[data-role="rack-editor-polish"]');
        await editor.waitFor();
        assert.equal(await editor.locator('[data-role^="polish-module-"]').count(), 4);
        assert.equal(await editor.locator('[data-role^="polish-control-"]').count(), 4);
        assert.equal(await editor.locator('[data-role^="polish-bypass-"]').count(), 4);

        const footerBefore = await page.locator('[data-role="rack-fixed-footer"]').boundingBox();
        assert.ok(footerBefore);
        const expand = page.locator('[data-role="polish-expand"]');
        await expand.click();
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="polish-expand"]')?.getAttribute("aria-expanded") === "true"
        ));
        assert.equal(await editor.getAttribute("data-expanded"), "true");
        const fullScreen = page.locator('[data-role="polish-fullscreen-editor"]');
        await fullScreen.waitFor();
        assert.equal(await page.locator('[data-role="rack-fixed-footer"]').boundingBox(), null);

        await fullScreen.locator('[data-role="polish-fullscreen-close"]').click();
        await fullScreen.waitFor({ state: "detached" });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="polish-expand"]')?.getAttribute("aria-expanded") === "false"
        ));
        assert.equal(await editor.getAttribute("data-expanded"), "false");

        const footerAfter = await page.locator('[data-role="rack-fixed-footer"]').boundingBox();
        assert.ok(footerAfter);
        assert.equal(
            Math.abs(footerAfter.x - footerBefore.x) <= 0.5
                && Math.abs(footerAfter.y - footerBefore.y) <= 0.5
                && Math.abs(footerAfter.width - footerBefore.width) <= 0.5
                && Math.abs(footerAfter.height - footerBefore.height) <= 0.5,
            true,
        );
    } finally {
        await page.close();
    }
});

async function wrapStationInGroup(page, effectId, groupKind) {
    await page.click(`[data-role="rack-station-${effectId}"]`, { button: "right" });
    await page.waitForSelector(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.click(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.waitForSelector('[data-role="rack-station-menu"]', { state: "detached" });
}

test("mobile three-band split keeps every readable effect label tied to LO MID or HI", async () => {
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
        const labels = await group.evaluate((element) => {
            const expectedBand = ["LO", "MID", "HI"];
            return Array.from(element.querySelectorAll(".subway-station-label")).map((label) => {
                const station = label.closest("[data-device-id]");
                const detail = label.closest(".subway-station-detail");
                const branchIndex = Number(station?.getAttribute("data-branch-index"));
                const labelRect = label.getBoundingClientRect();
                const detailRect = detail?.getBoundingClientRect();
                const style = getComputedStyle(label);
                return {
                    deviceId: station?.getAttribute("data-device-id"),
                    branchIndex,
                    band: expectedBand[branchIndex],
                    tint: station?.getAttribute("data-lane-tint"),
                    text: label.textContent?.trim(),
                    visible: style.display !== "none" && style.visibility !== "hidden"
                        && labelRect.width > 0 && labelRect.height > 0,
                    fontSize: Number.parseFloat(style.fontSize),
                    labelRect: {
                        left: labelRect.left,
                        right: labelRect.right,
                        top: labelRect.top,
                        bottom: labelRect.bottom,
                    },
                    detailRect: detailRect === undefined ? null : {
                        left: detailRect.left,
                        right: detailRect.right,
                        top: detailRect.top,
                        bottom: detailRect.bottom,
                    },
                };
            });
        });
        assert.deepEqual(labels.map(({ deviceId, band, tint, text }) => ({ deviceId, band, tint, text })), [
            { deviceId: "distortion#1", band: "LO", tint: "lo", text: "DRV 1" },
            { deviceId: "ott#1", band: "MID", tint: "mid", text: "OTT 1" },
            { deviceId: "delay#1", band: "HI", tint: "hi", text: "DLY 1" },
            { deviceId: "chorus#1", band: "LO", tint: "lo", text: "CHO 1" },
            { deviceId: "flanger#1", band: "MID", tint: "mid", text: "FLG 1" },
            { deviceId: "reverb#1", band: "HI", tint: "hi", text: "RVB 1" },
            { deviceId: "phaser#1", band: "MID", tint: "mid", text: "PHA 1" },
        ]);
        for (const label of labels) {
            assert.equal(label.visible, true, `${label.deviceId}: readable label is visible`);
            assert.equal(label.fontSize >= 13, true, `${label.deviceId}: readable phone type floor`);
            assert.ok(label.detailRect, `${label.deviceId}: label belongs to a full detail chip`);
            assert.equal(
                label.labelRect.left >= label.detailRect.left
                    && label.labelRect.right <= label.detailRect.right
                    && label.labelRect.top >= label.detailRect.top
                    && label.labelRect.bottom <= label.detailRect.bottom,
                true,
                `${label.deviceId}: text geometry stays inside its own chip`,
            );
        }

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

test("split and Parallel routes preserve owning colors symbols selection and bypass states", async () => {
    const cases = [
        {
            groupKind: "parallel",
            branchCount: 4,
            expectedStrokes: ["rgb(105, 213, 197)", "rgb(105, 213, 197)", "rgb(105, 213, 197)", "rgb(105, 213, 197)"],
            symbolClass: "subway-glyph-dot",
        },
        {
            groupKind: "split",
            branchCount: 3,
            expectedStrokes: ["rgb(127, 208, 161)", "rgb(242, 202, 0)", "rgb(255, 139, 74)"],
            symbolClass: "subway-glyph-diamond",
        },
    ];

    for (const fixture of cases) {
        const page = await openHarnessPage({
            laneDoc: populatedConnectorLaneDocJson(fixture.groupKind, fixture.branchCount),
        });
        try {
            const groupId = `${fixture.groupKind}#1`;
            const group = page.locator(`[data-role="rack-group-${groupId}"]`);
            await group.waitFor();
            const contract = await group.evaluate((element, expectedSymbolClass) => {
                const branches = Array.from(element.querySelectorAll(
                    '.subway-fork-connectors [data-connector-segment="branch"]',
                ));
                const firstBodyRow = element.querySelector(".subway-lane-row");
                const forkSymbol = element.querySelector(`.subway-fork-glyph > .${expectedSymbolClass}`);
                const mergeSymbol = element.querySelector(".subway-merge-dot");
                const symbolPresentation = (symbol) => {
                    if (!(symbol instanceof HTMLElement)) {
                        return null;
                    }
                    const rect = symbol.getBoundingClientRect();
                    const style = getComputedStyle(symbol);
                    return {
                        display: style.display,
                        width: rect.width,
                        height: rect.height,
                        borderColor: style.borderColor,
                        opacity: style.opacity,
                    };
                };
                return {
                    branchStrokes: branches.map((branch) => getComputedStyle(branch).stroke),
                    bodyStrokes: firstBodyRow === null
                        ? []
                        : Array.from(firstBodyRow.children, (cell) => (
                            getComputedStyle(cell, "::before").backgroundColor
                        )),
                    forkSymbol: symbolPresentation(forkSymbol),
                    mergeSymbol: symbolPresentation(mergeSymbol),
                };
            }, fixture.symbolClass);
            assert.deepEqual(contract.branchStrokes, fixture.expectedStrokes);
            assert.deepEqual(contract.bodyStrokes, fixture.expectedStrokes);
            assert.ok(contract.forkSymbol, `${fixture.groupKind}: fork symbol exists`);
            assert.equal(contract.forkSymbol.display === "none", false);
            assert.equal(contract.forkSymbol.width >= 11 && contract.forkSymbol.height >= 11, true);
            assert.equal(contract.forkSymbol.borderColor, "rgb(105, 213, 197)");
            assert.ok(contract.mergeSymbol, `${fixture.groupKind}: merge symbol exists`);
            assert.equal(contract.mergeSymbol.display === "none", false);
            assert.equal(contract.mergeSymbol.width >= 9 && contract.mergeSymbol.height >= 9, true);
            assert.equal(contract.mergeSymbol.borderColor, "rgb(105, 213, 197)");

            await page.click(`[data-role="rack-fork-${groupId}"]`);
            const selectedSymbol = group.locator(`.subway-fork-glyph > .${fixture.symbolClass}`);
            assert.notEqual(await selectedSymbol.evaluate((symbol) => getComputedStyle(symbol).boxShadow), "none");

            await page.click(`[data-role="rack-branch-focus-${groupId}-${fixture.branchCount - 1}"]`);
            const focusedRoute = group.locator(
                `.subway-fork-connectors [data-lane-index="${fixture.branchCount - 1}"].is-focused`,
            );
            assert.equal(await focusedRoute.evaluate((route) => getComputedStyle(route).stroke), fixture.expectedStrokes.at(-1));

            if (fixture.groupKind === "split") {
                await page.click('[data-device-id="chorus#1"] > .subway-station');
                const selectedIdentity = await page.locator(
                    '[data-role="rack-module-chorus"][data-device-id="chorus#1"]',
                ).evaluate((station) => {
                    const well = station.querySelector(".subway-station-icon-well");
                    const icon = station.querySelector(".subway-station-icon-detail");
                    if (!(well instanceof HTMLElement) || !(icon instanceof HTMLElement)) {
                        return null;
                    }
                    return {
                        borderColor: getComputedStyle(well).borderColor,
                        iconColor: getComputedStyle(icon).backgroundColor,
                    };
                });
                assert.deepEqual(selectedIdentity?.borderColor, selectedIdentity?.iconColor);
                await page.click(`[data-role="rack-fork-${groupId}"]`);
            }

            await page.click('[data-role="rack-group-power"]');
            await page.waitForSelector(`[data-role="rack-group-${groupId}"].is-bypassed`);
            const bypass = await group.evaluate((element, expectedSymbolClass) => {
                const route = element.querySelector('.subway-fork-connectors [data-lane-index="0"]');
                const symbol = element.querySelector(`.subway-fork-glyph > .${expectedSymbolClass}`);
                return {
                    routeStroke: route === null ? null : getComputedStyle(route).stroke,
                    routeOpacity: getComputedStyle(element.querySelector(".subway-fork-connectors")).opacity,
                    symbolOpacity: symbol === null ? null : getComputedStyle(symbol).opacity,
                };
            }, fixture.symbolClass);
            assert.equal(bypass.routeStroke, fixture.expectedStrokes[0]);
            assert.equal(Number(bypass.routeOpacity) < 1, true);
            assert.equal(Number(bypass.symbolOpacity) < 1, true);
        } finally {
            await page.close();
        }
    }
});

test("phone rail edges, plugin, and desktop keep every exclusive Solo contained and hit-test owned", async () => {
    const laneDoc = populatedFourWayParallelLaneDocJson();
    const page = await openHarnessPage({
        laneDoc,
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 568 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.click('[data-role="rack-fork-parallel#1"]');
        const soloButtons = page.locator('[data-role^="rack-branch-solo-parallel#1-"]');
        assert.equal(await soloButtons.count(), 4);

        for (let index = 0; index < 4; index += 1) {
            const evidence = await assertEditorControlIsVisibleAndOwned(
                soloButtons.nth(index), `320x568 right-rail Parallel Solo ${index}`,
            );
            assert.equal(evidence.rect.width >= 44, true, `Solo ${index} width`);
            assert.equal(evidence.rect.height >= 44, true, `Solo ${index} height`);
        }

        await soloButtons.nth(1).click();
        assert.equal(await soloButtons.nth(1).getAttribute("aria-pressed"), "true");
        await soloButtons.nth(3).click();
        assert.equal(await soloButtons.nth(1).getAttribute("aria-pressed"), "false");
        assert.equal(await soloButtons.nth(3).getAttribute("aria-pressed"), "true");

        let snapshot = await getHarnessSnapshot(page);
        const soloWrites = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneSolo");
        assert.deepEqual(soloWrites.at(-1)?.value, {
            parallelSoloBranches: [4, 0, 0, 0],
            splitSoloBranches: [0, 0, 0, 0],
        });
        assert.equal(snapshot.storedState["lane.v1"], laneDoc);

        await soloButtons.nth(3).click();
        snapshot = await getHarnessSnapshot(page);
        assert.equal(await soloButtons.nth(3).getAttribute("aria-pressed"), "false");
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneSolo").at(-1)?.value,
            {
                parallelSoloBranches: [0, 0, 0, 0],
                splitSoloBranches: [0, 0, 0, 0],
            },
        );
        assert.equal(snapshot.storedState["lane.v1"], laneDoc);

        for (const surface of [
            { name: "393x852 right-rail phone", width: 393, height: 852, railEdge: "right" },
            { name: "plugin", width: 640, height: 700 },
            { name: "desktop", width: 1024, height: 768 },
        ]) {
            await page.setViewportSize({ width: surface.width, height: surface.height });
            if (surface.railEdge !== undefined) {
                assert.equal(
                    await page.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-edge"),
                    surface.railEdge,
                );
            }
            await page.locator('[data-role="rack-fork-parallel#1"]:visible').click();
            const surfaceSoloButtons = page.locator(
                '[data-role^="rack-branch-solo-parallel#1-"]:visible',
            );
            await surfaceSoloButtons.first().waitFor();
            assert.equal(await surfaceSoloButtons.count(), 4, `${surface.name} Solo count`);
            for (let index = 0; index < 4; index += 1) {
                const evidence = await assertEditorControlIsVisibleAndOwned(
                    surfaceSoloButtons.nth(index), `${surface.name} Parallel Solo ${index}`,
                );
                assert.equal(evidence.rect.width >= 44 && evidence.rect.height >= 44, true);
            }
        }
    } finally {
        await page.close();
    }

    const leftRailPage = await openHarnessPage({
        laneDoc,
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 320, height: 568 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "left", normalizedY: 0.42 }),
                );
            });
        },
    });
    try {
        await leftRailPage.click('[data-role="mobile-workspace-tab-fx"]');
        assert.equal(
            await leftRailPage.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-edge"),
            "left",
        );
        await leftRailPage.click('[data-role="rack-fork-parallel#1"]');
        const soloButtons = leftRailPage.locator('[data-role^="rack-branch-solo-parallel#1-"]');
        assert.equal(await soloButtons.count(), 4);
        for (let index = 0; index < 4; index += 1) {
            const evidence = await assertEditorControlIsVisibleAndOwned(
                soloButtons.nth(index), `320x568 left-rail Parallel Solo ${index}`,
            );
            assert.equal(evidence.rect.width >= 44 && evidence.rect.height >= 44, true);
        }
    } finally {
        await leftRailPage.close();
    }
});

test("Init clears active branch Solo without serializing it", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedFourWayParallelLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.click('[data-role="rack-fork-parallel#1"]');
        await page.click('[data-role="rack-branch-solo-parallel#1-0"]');
        await clickPresetBarAction(page, "init");
        await page.waitForTimeout(100);
        let snapshot = await getHarnessSnapshot(page);
        if (snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneSolo")
            .at(-1)?.value?.parallelSoloBranches?.[0] !== 0) {
            await page.waitForFunction(() => (
                document.querySelector("cosimo-preset-bar")?.shadowRoot
                    ?.querySelector('[data-action="sound-replacement-discard"]') instanceof HTMLButtonElement
            ));
            await page.evaluate(() => {
                const discard = document.querySelector("cosimo-preset-bar")?.shadowRoot
                    ?.querySelector('[data-action="sound-replacement-discard"]');
                if (!(discard instanceof HTMLButtonElement)) {
                    throw new Error("Discard and Init action is missing.");
                }
                discard.click();
            });
        }
        snapshot = await waitForHarnessSnapshot(
            page,
            "Init clears the runtime Solo overlay",
            (candidate) => candidate.sentMessages
                .filter(({ endpointID }) => endpointID === "laneSolo")
                .at(-1)?.value?.parallelSoloBranches?.[0] === 0,
        );
        assert.equal(String(snapshot.storedState["lane.v1"]).toLowerCase().includes("solo"), false);
    } finally {
        await page.close();
    }

});

test("compact Split Solo wrapping keeps crossovers and group actions scroll-reachable", async () => {
    const page = await openHarnessPage({
        laneDoc: emptySplitLaneDocJson(2),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 568 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.click('[data-role="rack-fork-split#1"]');
        let soloButtons = page.locator('[data-role^="rack-branch-solo-split#1-"]');
        assert.equal(await soloButtons.count(), 2);
        assert.deepEqual(
            await soloButtons.evaluateAll((buttons) => (
                buttons.map((button) => button.textContent?.replace("SOLO", "").trim())
            )),
            ["LO", "HI"],
        );
        for (let index = 0; index < 2; index += 1) {
            await assertEditorControlIsVisibleAndOwned(soloButtons.nth(index), `two-band Split Solo ${index}`);
        }
        await assertCompactSplitCrossoverIsUsable(page, "low", "two-band crossover");
        const addBand = page.locator('[data-role="rack-group-add-band"]');
        await assertEditorControlIsVisibleAndOwned(addBand, "Add mid band");
        await addBand.click();

        soloButtons = page.locator('[data-role^="rack-branch-solo-split#1-"]');
        await soloButtons.nth(2).waitFor();
        assert.equal(await soloButtons.count(), 3);
        assert.deepEqual(
            await soloButtons.evaluateAll((buttons) => (
                buttons.map((button) => button.textContent?.replace("SOLO", "").trim())
            )),
            ["LO", "MID", "HI"],
        );
        for (let index = 0; index < 3; index += 1) {
            const evidence = await assertEditorControlIsVisibleAndOwned(
                soloButtons.nth(index), `three-band Split Solo ${index}`,
            );
            assert.equal(evidence.rect.width >= 44 && evidence.rect.height >= 44, true);
        }
        await assertCompactSplitCrossoverIsUsable(page, "low", "three-band Low crossover");
        await assertCompactSplitCrossoverIsUsable(page, "high", "three-band High crossover");
        for (const [selector, label] of [
            ['[data-role="rack-group-remove-band"]', "Remove mid band"],
            ['[data-role="rack-group-dissolve"]', "Dissolve group"],
        ]) {
            const evidence = await assertEditorControlIsVisibleAndOwned(page.locator(selector), label);
            assert.equal(evidence.bodyScrollable, true, `${label} must remain reachable in the scrolling body`);
        }

        await soloButtons.nth(2).click();
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneSolo").at(-1)?.value,
            {
                parallelSoloBranches: [0, 0, 0, 0],
                splitSoloBranches: [3, 0, 0, 0],
            },
        );
    } finally {
        await page.close();
    }

    const widePhonePage = await openHarnessPage({
        laneDoc: emptySplitLaneDocJson(3),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    try {
        await widePhonePage.click('[data-role="mobile-workspace-tab-fx"]');
        assert.equal(
            await widePhonePage.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-edge"),
            "right",
        );
        await widePhonePage.click('[data-role="rack-fork-split#1"]');
        const soloButtons = widePhonePage.locator('[data-role^="rack-branch-solo-split#1-"]');
        assert.equal(await soloButtons.count(), 3);
        for (let index = 0; index < 3; index += 1) {
            const evidence = await assertEditorControlIsVisibleAndOwned(
                soloButtons.nth(index), `393x852 three-band Split Solo ${index}`,
            );
            assert.equal(evidence.rect.width >= 44 && evidence.rect.height >= 44, true);
        }
        for (const [selector, label] of [
            ['[data-role="rack-split-low-split#1"]', "393x852 Low crossover"],
            ['[data-role="rack-split-high-split#1"]', "393x852 High crossover"],
            ['[data-role="rack-group-remove-band"]', "393x852 Remove mid band"],
            ['[data-role="rack-group-dissolve"]', "393x852 Dissolve group"],
        ]) {
            await assertEditorControlIsVisibleAndOwned(widePhonePage.locator(selector), label);
        }
    } finally {
        await widePhonePage.close();
    }
});

test("every visible fork-symbol pixel owns the exact group tap and long-press control", async () => {
    const fixtures = [
        { groupKind: "parallel", branchCount: 4 },
        { groupKind: "split", branchCount: 3 },
    ];

    for (const fixture of fixtures) {
        const page = await openHarnessPage({
            laneDoc: populatedConnectorLaneDocJson(fixture.groupKind, fixture.branchCount),
            beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
        });
        const groupId = `${fixture.groupKind}#1`;
        const groupRole = `rack-group-${groupId}`;
        const forkRole = `rack-fork-${groupId}`;
        try {
            await page.click('[data-role="mobile-workspace-tab-fx"]');
            const group = page.locator(`[data-role="${groupRole}"]`);
            await group.waitFor();

            const symbolPoints = await group.locator(".subway-fork-glyph").evaluate((symbol) => {
                const rect = symbol.getBoundingClientRect();
                return [
                    { name: "top", x: rect.left + (rect.width / 2), y: rect.top + 2 },
                    { name: "center", x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) },
                    { name: "bottom", x: rect.left + (rect.width / 2), y: rect.bottom - 2 },
                ];
            });
            const owners = await page.evaluate((points) => points.map(({ name, x, y }) => ({
                name,
                role: document.elementFromPoint(x, y)?.closest("button")?.getAttribute("data-role") ?? null,
            })), symbolPoints);
            assert.deepEqual(
                owners,
                symbolPoints.map(({ name }) => ({ name, role: forkRole })),
                `${fixture.groupKind}: top, center, and bottom must resolve to one group button`,
            );

            for (const pointName of ["top", "center", "bottom"]) {
                const resetToFirstBranch = async () => {
                    const firstBranchStation = page.locator(
                        '[data-device-id="distortion#1"] > .subway-station',
                    );
                    await firstBranchStation.focus();
                    await page.keyboard.press("Enter");
                    await page.waitForFunction((role) => {
                        const element = document.querySelector(`[data-role="${role}"]`);
                        return element instanceof HTMLElement
                            && !element.classList.contains("is-selected")
                            && element.getAttribute("data-focused-branch-index") === "0";
                    }, groupRole);
                };
                const readPoint = async () => group.locator(".subway-fork-glyph").evaluate((symbol, name) => {
                    const rect = symbol.getBoundingClientRect();
                    const y = name === "top"
                        ? rect.top + 2
                        : name === "bottom"
                            ? rect.bottom - 2
                            : rect.top + (rect.height / 2);
                    return { x: rect.left + (rect.width / 2), y };
                }, pointName);

                await resetToFirstBranch();
                let point = await readPoint();
                await page.mouse.click(point.x, point.y);
                await page.waitForSelector(`[data-role="${groupRole}"].is-selected`);
                assert.equal(await group.getAttribute("data-focused-branch-index"), "0");
                assert.equal(await page.locator(`[data-role="rack-group-editor-${groupId}"]`).count(), 1);

                await resetToFirstBranch();
                point = await readPoint();
                await page.mouse.move(point.x, point.y);
                await page.mouse.down();
                await page.waitForTimeout(625);
                await page.mouse.up();
                await page.waitForSelector('[data-role="rack-group-menu"]');
                assert.equal(await page.locator(`[data-role="rack-group-enabled-${groupId}"]`).count(), 1);
                assert.equal(await group.getAttribute("data-focused-branch-index"), "0");
                await page.keyboard.press("Escape");
                await page.waitForSelector('[data-role="rack-group-menu"]', { state: "detached" });
            }
        } finally {
            await page.close();
        }
    }
});

test("omitted inline lane projection cannot separate CSS rails from SVG endpoints", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedConnectorLaneDocJson("split", 3),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1024, height: 768 }),
    });
    try {
        const group = page.locator('[data-role="rack-group-split#1"]');
        await group.waitFor();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-group-split#1"]')
                ?.getAttribute("data-compact-layout") === "false"
        ));
        const geometry = await group.evaluate((element) => {
            element.style.removeProperty("--subway-lane-gutter");
            element.style.removeProperty("--subway-lane-span");
            const fork = element.querySelector('[data-role="rack-fork-connections-split#1"]');
            const merge = element.querySelector('[data-role="rack-merge-connections-split#1"]');
            const rows = Array.from(element.querySelectorAll(".subway-lane-row"));
            if (!(fork instanceof SVGSVGElement)
                    || !(merge instanceof SVGSVGElement)
                    || rows.length === 0) {
                return null;
            }
            const pathPointX = (svg, path, fraction) => {
                const point = path.getPointAtLength(path.getTotalLength() * fraction);
                const svgPoint = svg.createSVGPoint();
                svgPoint.x = point.x;
                svgPoint.y = point.y;
                const matrix = path.getScreenCTM();
                return matrix === null ? Number.NaN : svgPoint.matrixTransform(matrix).x;
            };
            const centers = (nodes) => Array.from(nodes, (node) => {
                const rect = node.getBoundingClientRect();
                return rect.left + (rect.width / 2);
            });
            return {
                forkEndpoints: Array.from(
                    fork.querySelectorAll('[data-connector-segment="branch"]'),
                    (path) => pathPointX(fork, path, 1),
                ),
                mergeEndpoints: Array.from(
                    merge.querySelectorAll('[data-connector-segment="branch"]'),
                    (path) => pathPointX(merge, path, 0),
                ),
                forkControls: centers(element.querySelectorAll(".subway-fork-lane")),
                firstBodyRails: centers(rows[0].children),
                lastBodyRails: centers(rows.at(-1).children),
                mergeRails: centers(element.querySelectorAll(".subway-merge-lane")),
            };
        });
        assert.ok(geometry);
        for (const [name, rails] of Object.entries({
            forkControls: geometry.forkControls,
            firstBodyRails: geometry.firstBodyRails,
            lastBodyRails: geometry.lastBodyRails,
            mergeRails: geometry.mergeRails,
        })) {
            const endpoints = name === "mergeRails" ? geometry.mergeEndpoints : geometry.forkEndpoints;
            assert.deepEqual(
                endpoints.map((x, index) => Math.abs(x - rails[index]) <= 0.5),
                [true, true, true],
                `${name} must retain the shared full-width projection without inline variables`,
            );
        }
    } finally {
        await page.close();
    }
});

test("every four-way mobile Parallel summary and branch tail is one exact 44px control", async () => {
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
                summariesOwnControls: Array.from(
                    element.querySelectorAll(".subway-station-summary, .subway-ghost-summary"),
                ).filter(isVisible).every((node) => {
                    const control = node.closest("button");
                    return control instanceof HTMLButtonElement && isVisible(control);
                }),
                actionRects: Array.from(element.querySelectorAll([
                    ".subway-station-cell > .subway-station",
                    ".subway-ghost-cell > .subway-ghost-button",
                ].join(","))).filter(isVisible).map(rectOf),
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
        assert.deepEqual(presentation.visibleTailPaths.toSorted(), [
            "branch:parallel#1:0:2",
            "branch:parallel#1:1:1",
            "branch:parallel#1:2:3",
            "branch:parallel#1:3:1",
        ]);
        assert.equal(presentation.summariesOwnControls, true);
        assert.equal(presentation.actionRects.length, 11);
        assert.equal(
            presentation.actionRects.every((rect) => (
                rect.right - rect.left >= 43.5 && rect.bottom - rect.top >= 43.5
            )),
            true,
        );
        for (let leftIndex = 0; leftIndex < presentation.actionRects.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < presentation.actionRects.length; rightIndex += 1) {
                assert.equal(
                    rectanglesIntersect(
                        presentation.actionRects[leftIndex],
                        presentation.actionRects[rightIndex],
                    ),
                    false,
                    `mobile Parallel action controls ${leftIndex} and ${rightIndex} must not steal each other's hit area`,
                );
            }
        }
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

        const effectBranches = [
            ["distortion#1", 0],
            ["chorus#1", 0],
            ["ott#1", 1],
            ["flanger#1", 2],
            ["phaser#1", 2],
            ["delay#1", 2],
            ["reverb#1", 3],
        ];
        for (const [deviceId, branchIndex] of effectBranches) {
            const station = page.locator(`[data-device-id="${deviceId}"] > .subway-station:visible`);
            assert.equal(await station.count(), 1, `${deviceId}: its visible summary is the real station control`);
            await station.click();
            await page.waitForFunction(({ nextDeviceId, nextBranchIndex }) => (
                document.querySelector('[data-role="rack-group-parallel#1"]')
                    ?.getAttribute("data-focused-branch-index") === String(nextBranchIndex)
                && document.querySelector(".rack-effect-editor")
                    ?.getAttribute("data-device-id") === nextDeviceId
            ), { nextDeviceId: deviceId, nextBranchIndex: branchIndex });
        }

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

    const tails = [
        { path: "branch:parallel#1:0:1", branchIndex: 0, insertionIndex: 1 },
        { path: "branch:parallel#1:1:1", branchIndex: 1, insertionIndex: 1 },
        { path: "branch:parallel#1:2:1", branchIndex: 2, insertionIndex: 1 },
        { path: "branch:parallel#1:3:1", branchIndex: 3, insertionIndex: 1 },
    ];
    for (const tail of tails) {
        const tailPage = await openHarnessPage({
            laneDoc: populatedConnectorLaneDocJson("parallel", 4),
            beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
        });
        try {
            await tailPage.click('[data-role="mobile-workspace-tab-fx"]');
            await clearHarnessDebugLog(tailPage);
            const add = tailPage.locator(
                `[data-role="rack-ghost-add"][data-lane-path="${tail.path}"]:visible`,
            );
            assert.equal(await add.count(), 1, `${tail.path}: visible plus is its real button`);
            await add.click();
            await tailPage.waitForSelector('[data-role="rack-add-sheet"]');
            await tailPage.click('[data-role="rack-add-flanger"]');
            const snapshot = await waitForHarnessSnapshot(
                tailPage,
                `flanger inserted through ${tail.path}`,
                (nextSnapshot) => {
                    const rawState = nextSnapshot.storedState["lane.v1"];
                    if (rawState === undefined) {
                        return false;
                    }
                    const parallel = JSON.parse(String(rawState)).chain
                        .find((node) => node.groupId === "parallel#1");
                    return parallel?.branches[tail.branchIndex]?.[tail.insertionIndex]?.deviceId === "flanger#1";
                },
            );
            const parallel = readStoredLaneDoc(snapshot).chain
                .find((node) => node.groupId === "parallel#1");
            assert.equal(
                parallel.branches[tail.branchIndex][tail.insertionIndex].deviceId,
                "flanger#1",
                tail.path,
            );
        } finally {
            await tailPage.close();
        }
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
        await page.waitForTimeout(200);
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

test("empty and short racks end their painted rail at the final add before the fixed footer", async () => {
    await fs.mkdir(fxFooterEvidenceDirectory, { recursive: true });
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
            const stack = page.locator(".rack-stack");
            const layout = await stack.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const graph = element.querySelector('[data-role="rack-module-list"]');
                const footer = element.querySelector('[data-role="rack-fixed-footer"]');
                const mix = element.querySelector('[data-role="rack-lane-mix"]');
                const polish = element.querySelector('[data-role="rack-polish-boundary"]');
                const trunkAnchors = Array.from(element.querySelectorAll(
                    '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
                ));
                const lastAnchorRow = trunkAnchors.at(-1)?.closest(".subway-ghost-row");
                const lastAnchorBounds = lastAnchorRow?.getBoundingClientRect();
                const fillBounds = element.querySelector('[data-role="rack-trunk-tail-fill"]')
                    ?.getBoundingClientRect();
                if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)
                        || !(mix instanceof HTMLElement) || !(polish instanceof HTMLElement)
                        || lastAnchorBounds === undefined || fillBounds === undefined) {
                    return null;
                }
                const graphBounds = graph.getBoundingClientRect();
                const footerBounds = footer.getBoundingClientRect();
                const mixBounds = mix.getBoundingClientRect();
                const polishBounds = polish.getBoundingClientRect();
                return {
                    width: bounds.width,
                    height: bounds.height,
                    graphWidth: graphBounds.width,
                    graphHeight: graphBounds.height,
                    fillHeight: fillBounds.height,
                    fillSampleY: ((fillBounds.top + fillBounds.bottom) / 2) - graphBounds.top,
                    footerSampleY: ((mixBounds.top + mixBounds.bottom) / 2) - bounds.top,
                    graphOwnsFooter: graph.contains(footer),
                    tailMeetsGraphEnd: Math.abs(lastAnchorBounds.bottom - graphBounds.bottom) <= 1,
                    graphMeetsMix: Math.abs(graphBounds.bottom - mixBounds.top) <= 1,
                    mixMeetsPolish: Math.abs(mixBounds.bottom - polishBounds.top) <= 1,
                    footerMeetsStackEnd: Math.abs(footerBounds.bottom - bounds.bottom) <= 1,
                };
            });
            assert.ok(layout);
            assert.equal(
                layout.fillHeight > 40,
                true,
                `${fixture.name}: fixture must leave meaningful flexible route height above the final add`,
            );
            await page.addStyleTag({
                content: [
                    ".is-tail-proof-bare > .subway-trunk-tail-fill::before { visibility: hidden !important; }",
                    ".is-footer-proof-bare > [data-role=\"rack-fixed-footer\"] { visibility: hidden !important; }",
                ].join("\n"),
            });
            const painted = decodePng(await graph.screenshot({ animations: "disabled" }));
            await graph.evaluate((element) => element.classList.add("is-tail-proof-bare"));
            const bare = decodePng(await graph.screenshot({ animations: "disabled" }));
            await graph.evaluate((element) => element.classList.remove("is-tail-proof-bare"));
            assertPaintedAgainstLocalBackground(
                { painted, bare, size: { width: layout.graphWidth, height: layout.graphHeight } },
                { x: layout.graphWidth / 2, y: layout.fillSampleY },
                `${fixture.name}: the final trunk reaches its last add row`,
            );

            const footerPainted = decodePng(await stack.screenshot({ animations: "disabled" }));
            await stack.evaluate((element) => element.classList.add("is-footer-proof-bare"));
            const footerBare = decodePng(await stack.screenshot({ animations: "disabled" }));
            await stack.evaluate((element) => element.classList.remove("is-footer-proof-bare"));
            assertPaintedAgainstLocalBackground(
                { painted: footerPainted, bare: footerBare, size: { width: layout.width, height: layout.height } },
                { x: layout.width / 2, y: layout.footerSampleY },
                `${fixture.name}: the fixed footer paints its own bottom stack`,
            );
            const bareScaleX = footerBare.width / layout.width;
            const bareScaleY = footerBare.height / layout.height;
            const bareFooterCenter = pngPixelAt(
                footerBare,
                (layout.width / 2) * bareScaleX,
                layout.footerSampleY * bareScaleY,
            );
            const bareFooterNeighbors = [-24, 24].map((offsetX) => pngPixelAt(
                footerBare,
                ((layout.width / 2) + offsetX) * bareScaleX,
                layout.footerSampleY * bareScaleY,
            ));
            assert.equal(
                bareFooterNeighbors.every((pixel) => rgbDistance(bareFooterCenter, pixel) < 12),
                true,
                `${fixture.name}: hiding the footer exposes no graph rail beneath it`,
            );
            assert.equal(layout.graphOwnsFooter, false, `${fixture.name}: footer is outside the graph`);
            assert.equal(layout.tailMeetsGraphEnd, true, `${fixture.name}: final add owns the graph bottom`);
            assert.equal(layout.graphMeetsMix, true, `${fixture.name}: final add is flush before Mix`);
            assert.equal(layout.mixMeetsPolish, true, `${fixture.name}: Mix is flush before POLISH`);
            assert.equal(layout.footerMeetsStackEnd, true, `${fixture.name}: POLISH owns the stack bottom`);
            if (fixture.name === "short") {
                await stack.screenshot({
                    path: path.join(fxFooterEvidenceDirectory, "short-tail-fixed-footer-phone.png"),
                    animations: "disabled",
                });
            }
        } finally {
            await page.close();
        }
    }
});

test("the fixed FX footer rejects modulation drops without scrolling or targeting behind it", async () => {
    const page = await openHarnessPage({
        laneDoc: maximumSerialLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await graph.evaluate((element) => {
            element.scrollTop = 80;
            element.dispatchEvent(new Event("scroll"));
        });
        const initialScrollTop = await graph.evaluate((element) => element.scrollTop);
        assert.equal(initialScrollTop > 0, true);

        await expandGlobalModRail(page);
        await clearHarnessDebugLog(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const footerTarget = page.locator('[data-role="rack-polish-node"]');
        const sourceBox = await source.boundingBox();
        const footerTargetBox = await footerTarget.boundingBox();
        assert.ok(sourceBox && footerTargetBox);
        const sourcePoint = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const footerPoint = {
            x: footerTargetBox.x + (footerTargetBox.width / 2),
            y: footerTargetBox.y + (footerTargetBox.height / 2),
        };

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.mouse.move(footerPoint.x, footerPoint.y, { steps: 8 });
        const ghost = page.locator('[data-role="mobile-global-mod-source-ghost"]');
        await ghost.waitFor();
        await page.waitForTimeout(120);
        assert.equal(await ghost.getAttribute("data-target-captured"), "false");
        assert.equal(await page.locator('[data-modulation-target-kind].is-mod-hover').count(), 0);
        assert.equal(await page.evaluate(({ x, y }) => (
            document.elementFromPoint(x, y)?.closest('[data-role="rack-fixed-footer"]') !== null
        ), footerPoint), true);
        assert.equal(await graph.evaluate((element) => element.scrollTop), initialScrollTop,
            "a footer hover must not edge-scroll the graph hidden above it");

        await page.mouse.up();
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredModulationState(snapshot).routes.length, 0,
            "releasing a source over the fixed footer must not create a route");
        assert.equal(await ghost.count(), 0);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("the fixed FX footer rejects reorder drops without moving a graph path behind it", async () => {
    const page = await openHarnessPage({
        laneDoc: starterTrioLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const source = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const footerTarget = page.locator('[data-role="rack-polish-node"]');
        await source.scrollIntoViewIfNeeded();
        const initialSnapshot = await getHarnessSnapshot(page);
        const initialLane = readStoredLaneDoc(initialSnapshot);
        const initialPath = await page.locator('[data-device-id="reverb#1"][data-lane-path]')
            .getAttribute("data-lane-path");
        const sourceBox = await source.boundingBox();
        const footerTargetBox = await footerTarget.boundingBox();
        assert.ok(sourceBox && footerTargetBox && initialPath);
        const sourcePoint = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const footerPoint = {
            x: footerTargetBox.x + (footerTargetBox.width / 2),
            y: footerTargetBox.y + (footerTargetBox.height / 2),
        };
        await clearHarnessDebugLog(page);

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(sourcePoint.x + 12, sourcePoint.y);
        await page.locator('[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]').waitFor();
        await page.mouse.move(footerPoint.x, footerPoint.y, { steps: 8 });
        assert.equal(await page.evaluate(({ x, y }) => (
            document.elementFromPoint(x, y)?.closest('[data-role="rack-fixed-footer"]') !== null
        ), footerPoint), true);
        assert.equal(await page.locator('[data-role="rack-fixed-footer"] [data-lane-path]').count(), 0);
        assert.equal(
            await page.locator('[data-device-id="reverb#1"][data-lane-path]').getAttribute("data-lane-path"),
            initialPath,
            "the footer must not resolve to a reorder path",
        );
        const ghostClearsFooter = await page.locator('[data-role="rack-reorder-ghost"]').evaluateAll((ghosts) => {
            const footer = document.querySelector('[data-role="rack-fixed-footer"]');
            if (!(footer instanceof HTMLElement)) return false;
            const footerRect = footer.getBoundingClientRect();
            return ghosts.every((ghost) => ghost.getBoundingClientRect().bottom <= footerRect.top + 1);
        });
        assert.equal(ghostClearsFooter, true, "reorder graph placeholders must stop above the footer");

        await page.mouse.up();
        await page.locator('[data-role="rack-reorder-lifted-pill"]').waitFor({ state: "detached" });
        const settledSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredLaneDoc(settledSnapshot), initialLane);
        assert.equal(
            settledSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            0,
            "releasing a held station over the footer must not publish a topology change",
        );
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
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

test("an amplified phone touch drag yields boundary edge bands to the first and last effects", async () => {
    const page = await openHarnessPage({
        laneDoc: boundaryScrollLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);
    const touchPoint = (point) => ({ ...point, radiusX: 8, radiusY: 8, force: 1 });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await page.waitForTimeout(100);
        const graphOverflow = await graph.evaluate((element) => ({
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            childCount: element.children.length,
            classes: element.className,
        }));
        assert.equal(
            graphOverflow.scrollHeight > graphOverflow.clientHeight,
            true,
            `boundary fixture must overflow: ${JSON.stringify(graphOverflow)}`,
        );
        await expandGlobalModRail(page);
        await clearHarnessDebugLog(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox);
        const sourceCenter = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const startTouch = () => cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [touchPoint(sourceCenter)],
        });
        const movePreviewTo = async (previewPoint) => {
            const finger = touchPointForModSourcePreviewTarget(sourceCenter, previewPoint, 393, 852);
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [touchPoint(finger)],
            });
        };
        const endTouch = () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const centerOf = (box) => ({ x: box.x + (box.width / 2), y: box.y + (box.height / 2) });
        const dropOnSelectedEditor = async (deviceId) => {
            const target = page.locator(
                `.rack-effect-editor[data-device-id="${deviceId}"] [data-drag-creation="creatable"]:visible`,
            ).first();
            await target.waitFor();
            const targetKind = await target.getAttribute("data-modulation-target-kind");
            const box = await target.boundingBox();
            assert.ok(targetKind && box);
            await movePreviewTo(centerOf(box));
            await endTouch();
            await waitForHarnessSnapshot(
                page,
                `touch drop onto ${deviceId}`,
                (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                    route.sourceKind === "env"
                    && route.sourceSlot === 1
                    && route.targetKind === targetKind
                )),
            );
        };

        // Start from a different selection, then pin the graph at its upper
        // boundary. The first station sits inside the top auto-scroll band;
        // with no upward travel left, that band must yield to dwell + drop.
        await page.evaluate(() => {
            document.querySelector('[data-device-id="reverb#1"] > .subway-station')?.click();
        });
        await page.waitForSelector('[data-role="rack-editor-reverb"][data-device-id="reverb#1"]');
        await graph.evaluate((element) => {
            element.scrollTop = 0;
            element.dispatchEvent(new Event("scroll"));
        });
        const firstBox = await page.locator(
            '[data-device-id="globalFilter#1"] > .subway-station',
        ).boundingBox();
        assert.ok(firstBox);
        await startTouch();
        await movePreviewTo(centerOf(firstBox));
        await page.locator('[data-role="mobile-global-mod-source-ghost"]').waitFor({ state: "visible" });
        await page.waitForSelector(
            '[data-role="rack-editor-filter"][data-device-id="globalFilter#1"]',
            { timeout: 2_500 },
        );
        assert.equal(await graph.evaluate((element) => element.scrollTop), 0);
        await dropOnSelectedEditor("globalFilter#1");

        // At maximum scroll, aim the amplified preview at the lower edge of
        // the last real station. It is still inside the bottom scroll band,
        // but no downward travel remains, so the reverb dwell and drop win.
        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement
                && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        });
        const lastBox = await page.locator(
            '[data-device-id="reverb#1"] > .subway-station',
        ).boundingBox();
        assert.ok(lastBox);
        await startTouch();
        await movePreviewTo({
            x: lastBox.x + (lastBox.width / 2),
            y: lastBox.y + lastBox.height - 2,
        });
        await page.waitForSelector(
            '[data-role="rack-editor-reverb"][data-device-id="reverb#1"]',
            { timeout: 2_500 },
        );
        const bottom = await graph.evaluate((element) => ({
            scrollTop: element.scrollTop,
            maximum: element.scrollHeight - element.clientHeight,
        }));
        assert.equal(Math.abs(bottom.scrollTop - bottom.maximum) <= 1, true);
        await dropOnSelectedEditor("reverb#1");
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => undefined);
        await cdp.detach();
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
            await page.locator(".rack-stack").scrollIntoViewIfNeeded();
            const geometry = await page.locator('[data-role="rack-group-split#1"]').evaluate((group) => {
                const list = group.closest('[data-role="rack-module-list"]');
                const graphBoundary = group.closest('[data-role="rack-graph-boundary"]');
                if (!(list instanceof HTMLElement) || !(graphBoundary instanceof HTMLElement)) {
                    return null;
                }
                const bounds = list.getBoundingClientRect();
                const listStyle = getComputedStyle(list);
                const graphBoundaryStyle = getComputedStyle(graphBoundary);
                const partElements = Array.from(group.querySelectorAll([
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
                });
                const parts = partElements.map((element) => {
                    const rect = element.getBoundingClientRect();
                    const visible = {
                        left: Math.max(rect.left, bounds.left),
                        right: Math.min(rect.right, bounds.right),
                        top: Math.max(rect.top, bounds.top),
                        bottom: Math.min(rect.bottom, bounds.bottom),
                    };
                    return {
                        className: element.className,
                        text: element.textContent?.trim() ?? "",
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        visible,
                        intersectsGraph: visible.left < visible.right && visible.top < visible.bottom,
                    };
                });
                const pills = parts.filter((part) => part.className === "subway-station-pill");
                const outsideGraphHitOwnedBySplit = partElements.some((element) => {
                    const rect = element.getBoundingClientRect();
                    const x = Math.max(bounds.left + 1, Math.min(bounds.right - 1, rect.left + (rect.width / 2)));
                    const y = Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, rect.top + (rect.height / 2)));
                    return [
                        { x, y: bounds.top - 1 },
                        { x, y: bounds.bottom + 1 },
                        { x: bounds.left - 1, y },
                        { x: bounds.right + 1, y },
                    ].some((point) => {
                        const hit = document.elementFromPoint(point.x, point.y);
                        return hit !== null && group.contains(hit);
                    });
                });
                return {
                    bounds: {
                        left: bounds.left,
                        right: bounds.right,
                        top: bounds.top,
                        bottom: bounds.bottom,
                    },
                    parts,
                    pills,
                    graphClipsPaint: listStyle.overflowX === "hidden"
                        && listStyle.overflowY === "auto"
                        && graphBoundaryStyle.overflowX === "hidden"
                        && graphBoundaryStyle.overflowY === "hidden",
                    outsideGraphHitOwnedBySplit,
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
            assert.equal(geometry.graphClipsPaint, true,
                `${surface.name}: split paint must be clipped by the scroll graph and its boundary`);
            const visibleParts = geometry.parts.filter((part) => part.intersectsGraph);
            assert.equal(visibleParts.length > 0, true, `${surface.name}: split parts must paint in the graph`);
            for (const part of visibleParts) {
                assert.equal(
                    part.visible.left >= geometry.bounds.left - 0.5
                        && part.visible.right <= geometry.bounds.right + 0.5
                        && part.visible.top >= geometry.bounds.top - 0.5
                        && part.visible.bottom <= geometry.bounds.bottom + 0.5,
                    true,
                    `${surface.name}: visible ${part.className} ${part.text} paint must stay inside the graph: `
                        + `${JSON.stringify(part)} vs ${JSON.stringify(geometry.bounds)}`,
                );
            }
            assert.equal(geometry.outsideGraphHitOwnedBySplit, false,
                `${surface.name}: clipped split parts must not own hits outside the graph`);
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

            const footerBeforeScroll = await page.locator('[data-role="rack-fixed-footer"]').boundingBox();
            assert.ok(footerBeforeScroll);
            const graph = page.locator('[data-role="rack-module-list"]');
            await graph.evaluate((element) => {
                element.scrollTop = element.scrollHeight;
                element.dispatchEvent(new Event("scroll"));
            });
            await page.waitForFunction(() => {
                const element = document.querySelector('[data-role="rack-module-list"]');
                return element instanceof HTMLElement
                    && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
            });
            const tailGeometry = await page.locator(".rack-stack").evaluate((stack) => {
                const graph = stack.querySelector('[data-role="rack-module-list"]');
                const footer = stack.querySelector('[data-role="rack-fixed-footer"]');
                const mix = stack.querySelector('[data-role="rack-lane-mix"]');
                const polish = stack.querySelector('[data-role="rack-polish-boundary"]');
                const split = stack.querySelector('[data-role="rack-group-split#1"]');
                const finalTrunkAdd = Array.from(stack.querySelectorAll(
                    '[data-role="rack-ghost-add"][data-lane-path^="trunk:"]',
                )).at(-1);
                const branchAdds = split === null ? [] : Array.from(split.querySelectorAll(
                    '[data-role="rack-ghost-add"][data-insertion-anchor="path-tail"]',
                ));
                const targets = [...branchAdds, finalTrunkAdd].filter((target) => target !== undefined);
                if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)
                        || !(mix instanceof HTMLElement) || !(polish instanceof HTMLElement)
                        || targets.some((target) => !(target instanceof HTMLButtonElement))) return null;
                const rectOf = (element) => {
                    const rect = element.getBoundingClientRect();
                    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
                };
                const graphRect = rectOf(graph);
                const footerRect = footer.getBoundingClientRect();
                return {
                    graph: graphRect,
                    mix: rectOf(mix),
                    polish: rectOf(polish),
                    footer: {
                        x: footerRect.x,
                        y: footerRect.y,
                        width: footerRect.width,
                        height: footerRect.height,
                    },
                    scrollAtBottom: graph.scrollTop + graph.clientHeight >= graph.scrollHeight - 1,
                    targets: targets.map((target) => {
                        const rect = target.getBoundingClientRect();
                        const hit = document.elementFromPoint(
                            rect.left + (rect.width / 2),
                            rect.top + (rect.height / 2),
                        );
                        return {
                            path: target.getAttribute("data-lane-path"),
                            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
                            insideGraph: graph.contains(target)
                                && rect.left >= graphRect.left - 0.5
                                && rect.right <= graphRect.right + 0.5
                                && rect.top >= graphRect.top - 0.5
                                && rect.bottom <= graphRect.bottom + 0.5,
                            reachable: hit !== null && target.contains(hit),
                            outsideFooter: !footer.contains(target),
                        };
                    }),
                };
            });
            assert.ok(tailGeometry, `${surface.name}: split tail geometry must render`);
            assert.equal(tailGeometry.scrollAtBottom, true, `${surface.name}: graph must reach its true tail`);
            assert.deepEqual(tailGeometry.targets.map(({ path: lanePath }) => lanePath).sort(), [
                "branch:split#1:0:2",
                "branch:split#1:1:3",
                "branch:split#1:2:2",
                "trunk:1",
            ]);
            assert.equal(tailGeometry.targets.every(({ insideGraph }) => insideGraph), true,
                `${surface.name}: every split and trunk tail add must be inside the scrolled graph`);
            assert.equal(tailGeometry.targets.every(({ reachable }) => reachable), true,
                `${surface.name}: every split and trunk tail add must own its visible center hit: `
                    + JSON.stringify(tailGeometry.targets));
            assert.equal(tailGeometry.targets.every(({ outsideFooter }) => outsideFooter), true,
                `${surface.name}: no split add target may enter the fixed footer`);
            assert.equal(Math.abs(tailGeometry.graph.bottom - tailGeometry.mix.top) <= 1, true,
                `${surface.name}: split add targets end before fixed Mix`);
            assert.equal(Math.abs(tailGeometry.mix.bottom - tailGeometry.polish.top) <= 1, true,
                `${surface.name}: fixed Mix remains immediately before POLISH`);
            assert.equal(Math.abs(tailGeometry.footer.x - footerBeforeScroll.x) <= 0.5
                && Math.abs(tailGeometry.footer.y - footerBeforeScroll.y) <= 0.5
                && Math.abs(tailGeometry.footer.width - footerBeforeScroll.width) <= 0.5
                && Math.abs(tailGeometry.footer.height - footerBeforeScroll.height) <= 0.5, true,
            `${surface.name}: scrolling to the split tail must not move the fixed footer`);
            await page.locator('[data-role="effects-rack-card"]').screenshot({
                path: path.join(evidenceDirectory, `frequency-split-${surface.name}-${surface.width}px.png`),
                animations: "disabled",
            });

            await clearHarnessDebugLog(page);
            await page.click('[data-role="rack-ghost-add"][data-lane-path="branch:split#1:0:2"]');
            await page.waitForSelector('[data-role="rack-add-sheet"]');
            await page.click('[data-role="rack-add-filter"]');
            const snapshot = await waitForHarnessSnapshot(
                page,
                `${surface.name} split-tail filter insertion`,
                (nextSnapshot) => readStoredLaneDoc(nextSnapshot).devices?.["globalFilter#1"] !== undefined,
            );
            const split = readStoredLaneDoc(snapshot).chain.find((node) => node.kind === "split");
            assert.deepEqual(split?.branches[0].map((node) => node.deviceId), [
                "distortion#1",
                "chorus#1",
                "globalFilter#1",
            ]);
            assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length, 1,
                `${surface.name}: the reachable split add executes one topology write`);
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

test("local-background pixels prove every populated and empty route junction and body seam", async () => {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const groups = [
        { groupKind: "parallel", branchCount: 2 },
        { groupKind: "parallel", branchCount: 3 },
        { groupKind: "parallel", branchCount: 4 },
        { groupKind: "split", branchCount: 2 },
        { groupKind: "split", branchCount: 3 },
    ];
    const narrow = { name: "narrow", width: 320, height: 700 };
    const wide = { name: "wide", width: 1024, height: 768 };
    let mutationEvidenceCaptured = false;

    for (const group of groups) {
        const variants = [
            { name: "populated", laneDoc: populatedConnectorLaneDocJson(group.groupKind, group.branchCount), surfaces: [narrow, wide] },
            { name: "empty", laneDoc: emptyConnectorLaneDocJson(group.groupKind, group.branchCount), surfaces: [narrow] },
        ];
        for (const variant of variants) {
            for (const surface of variant.surfaces) {
                const page = await openHarnessPage({
                    laneDoc: variant.laneDoc,
                    beforeGoto: (nextPage) => nextPage.setViewportSize({
                        width: surface.width,
                        height: surface.height,
                    }),
                });
                const label = `${variant.name} ${surface.name} ${group.groupKind}-${group.branchCount}`;
                try {
                    if (surface.width < 640) {
                        await page.click('[data-role="mobile-workspace-tab-fx"]');
                    }
                    await page.addStyleTag({
                        content: ".subway-station-pill { transition: none !important; }",
                    });
                    const groupId = `${group.groupKind}#1`;
                    const groupLocator = page.locator(`[data-role="rack-group-${groupId}"]`);
                    await groupLocator.waitFor();
                    await page.waitForFunction(({ role, compact }) => {
                        const element = document.querySelector(`[data-role="${role}"]`);
                        return Number(element?.getAttribute("data-graph-width")) > 0
                            && element?.getAttribute("data-compact-layout") === compact;
                    }, {
                        role: `rack-group-${groupId}`,
                        compact: surface.name === "narrow" ? "true" : "false",
                    });

                    const groupLayout = await groupLocator.evaluate((element) => {
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
                                const cell = pill.closest(".subway-station-cell");
                                return {
                                    text: pill.textContent?.trim() ?? "",
                                    left: rect.left,
                                    right: rect.right,
                                    top: rect.top,
                                    bottom: rect.bottom,
                                    cellClass: cell?.className ?? "",
                                    chipOffset: getComputedStyle(pill).getPropertyValue("--subway-chip-offset-x"),
                                    transform: getComputedStyle(pill).transform,
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
                            `${label}: ${pill.text} stays inside the graph ${JSON.stringify({ pill, graph: groupLayout.graph })}`,
                        );
                    }
                    for (let leftIndex = 0; leftIndex < groupLayout.pills.length; leftIndex += 1) {
                        for (let rightIndex = leftIndex + 1; rightIndex < groupLayout.pills.length; rightIndex += 1) {
                            assert.equal(
                                rectanglesIntersect(groupLayout.pills[leftIndex], groupLayout.pills[rightIndex]),
                                false,
                                `${label}: ${groupLayout.pills[leftIndex].text} and ${groupLayout.pills[rightIndex].text}`,
                            );
                        }
                    }

                    const connectorProofs = [
                        ["fork", `rack-fork-connections-${groupId}`],
                        ["merge", `rack-merge-connections-${groupId}`],
                    ];
                    for (const [connectorKind, role] of connectorProofs) {
                        const proof = await captureIsolatedConnectorLayers(page, role);
                        const trunk = proof.geometry.paths.find((candidate) => candidate.segment === "trunk");
                        const branches = proof.geometry.paths.filter((candidate) => candidate.segment === "branch");
                        assert.ok(trunk?.start && trunk.end, `${label} ${connectorKind}: trunk geometry`);
                        assert.equal(branches.length, group.branchCount, `${label} ${connectorKind}: branch count`);
                        assert.equal(proof.geometry.laneCenters.length, group.branchCount);
                        assert.deepEqual(
                            branches.map((branch) => branch.dashed),
                            Array(group.branchCount).fill(variant.name === "empty"),
                        );

                        for (const branch of branches) {
                            assert.ok(branch.start && branch.end, `${label} ${connectorKind}: lane ${branch.laneIndex}`);
                            const laneCenter = proof.geometry.laneCenters[branch.laneIndex];
                            if (connectorKind === "fork") {
                                assert.equal(pointDistance(trunk.end, branch.start) <= 0.25, true, `${label}: fork junction`);
                                assert.equal(Math.abs(branch.end.x - laneCenter) <= 0.5, true, `${label}: fork rail x`);
                                assert.equal(Math.abs(branch.end.y - proof.geometry.size.height) <= 0.5, true);
                            } else {
                                assert.equal(pointDistance(branch.end, trunk.start) <= 0.25, true, `${label}: merge junction`);
                                assert.equal(Math.abs(branch.start.x - laneCenter) <= 0.5, true, `${label}: merge rail x`);
                                assert.equal(Math.abs(branch.start.y) <= 0.5, true);
                            }
                        }

                        for (const [pathIndex, renderedPath] of proof.geometry.paths.entries()) {
                            const layer = {
                                painted: proof.paintedByPath[pathIndex],
                                bare: proof.bare,
                                size: proof.geometry.size,
                            };
                            for (const [sampleIndex, sample] of [
                                renderedPath.start,
                                ...renderedPath.samples,
                                renderedPath.end,
                            ].entries()) {
                                assert.ok(sample, `${label} ${connectorKind}: sample geometry`);
                                assertPaintedAgainstLocalBackground(
                                    layer,
                                    sample,
                                    `${label} ${connectorKind} ${renderedPath.segment} lane ${renderedPath.laneIndex} sample ${sampleIndex}`,
                                );
                            }
                        }

                        if (!mutationEvidenceCaptured && connectorKind === "fork") {
                            const branchPathIndex = proof.geometry.paths.findIndex((candidate) => candidate.segment === "branch");
                            const branch = proof.geometry.paths[branchPathIndex];
                            assert.ok(branch?.start && branch.end);
                            assert.throws(
                                () => assertPaintedAgainstLocalBackground({
                                    painted: proof.bare,
                                    bare: proof.bare,
                                    size: proof.geometry.size,
                                }, branch.start, "removed route mutation"),
                                /route must differ/,
                            );
                            const disconnected = await captureDisconnectedConnectorMutation(page, role, branchPathIndex);
                            assert.throws(
                                () => assertPaintedAgainstLocalBackground({
                                    painted: disconnected,
                                    bare: proof.bare,
                                    size: proof.geometry.size,
                                }, branch.end, "disconnected route mutation"),
                                /route must differ/,
                            );
                            mutationEvidenceCaptured = true;
                        }
                    }

                    const seamProof = await captureGroupSeamLayers(page, groupId);
                    for (const [laneIndex, seam] of seamProof.forkSeams.entries()) {
                        assertPaintedAgainstLocalBackground(seamProof, seam.svg, `${label}: fork SVG seam lane ${laneIndex}`);
                        assertPaintedAgainstLocalBackground(seamProof, seam.body, `${label}: fork body seam lane ${laneIndex}`);
                    }
                    for (const [laneIndex, seam] of seamProof.mergeSeams.entries()) {
                        assertPaintedAgainstLocalBackground(seamProof, seam.body, `${label}: merge body seam lane ${laneIndex}`);
                        assertPaintedAgainstLocalBackground(seamProof, seam.svg, `${label}: merge SVG seam lane ${laneIndex}`);
                    }

                    if ((group.groupKind === "parallel" && group.branchCount === 4 && surface.name === "narrow")
                            || (group.groupKind === "split" && group.branchCount === 3 && surface.name === "wide")
                            || (variant.name === "empty" && group.groupKind === "split" && group.branchCount === 3)) {
                        await page.locator('[data-role="effects-rack-card"]').screenshot({
                            path: path.join(
                                evidenceDirectory,
                                `connected-${variant.name}-${group.groupKind}-${group.branchCount}-${surface.name}.png`,
                            ),
                            animations: "disabled",
                        });
                    }
                } finally {
                    await page.close();
                }
            }
        }
    }
    assert.equal(mutationEvidenceCaptured, true);
});

test("a narrow embedded graph in a wide viewport shares one measured lane geometry", async () => {
    const page = await openHarnessPage({
        laneDoc: populatedThreeBandLaneDocJson(),
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1024, height: 768 }),
    });
    try {
        await page.addStyleTag({
            content: ".rack-effects-grid { grid-template-columns: 176px minmax(0, 1fr) !important; }",
        });
        const group = page.locator('[data-role="rack-group-split#1"]');
        await group.waitFor();
        await page.waitForFunction(() => {
            const graph = document.querySelector('[data-role="rack-module-list"]');
            return graph instanceof HTMLElement && graph.getBoundingClientRect().width <= 177;
        });
        const geometry = await group.evaluate((element) => {
            const graph = element.closest('[data-role="rack-module-list"]');
            const fork = element.querySelector('[data-role="rack-fork-connections-split#1"]');
            const firstRow = element.querySelector(".subway-lane-row");
            if (!(graph instanceof HTMLElement)
                    || !(fork instanceof SVGSVGElement)
                    || !(firstRow instanceof HTMLElement)) {
                return null;
            }
            const forkRect = fork.getBoundingClientRect();
            const endpointX = Array.from(fork.querySelectorAll('[data-connector-segment="branch"]'), (path) => {
                const point = path.getPointAtLength(path.getTotalLength());
                const svgPoint = fork.createSVGPoint();
                svgPoint.x = point.x;
                svgPoint.y = point.y;
                const matrix = path.getScreenCTM();
                return matrix === null ? Number.NaN : svgPoint.matrixTransform(matrix).x;
            });
            const railX = Array.from(firstRow.children, (cell) => {
                const rect = cell.getBoundingClientRect();
                return rect.left + (rect.width / 2);
            });
            return {
                viewportWidth: window.innerWidth,
                graphWidth: graph.getBoundingClientRect().width,
                declaredWidth: Number(element.getAttribute("data-graph-width")),
                forkWidth: forkRect.width,
                endpointX,
                railX,
            };
        });
        assert.ok(geometry);
        assert.equal(geometry.viewportWidth, 1024);
        assert.equal(Math.abs(geometry.graphWidth - 176) <= 1, true);
        assert.equal(Math.abs(geometry.declaredWidth - geometry.forkWidth) <= 0.5, true);
        assert.deepEqual(
            geometry.endpointX.map((x, index) => Math.abs(x - geometry.railX[index]) <= 0.5),
            [true, true, true],
        );
    } finally {
        await page.close();
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
        assert.equal(await page.locator('[data-role="rack-group-split#1"] .subway-glyph-diamond').count(), 1);
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
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');
        await page.waitForTimeout(200);
        await clearHarnessDebugLog(page);

        // Natural-height rows may overflow the one root scroller. Reveal the
        // drag source inside that scroller; the adjacent split target remains
        // visible, so this still exercises one uninterrupted pointer stream.
        await page.locator('[data-role="effects-rack-card"]').scrollIntoViewIfNeeded();
        await page.locator('[data-role="rack-station-reverb"]').scrollIntoViewIfNeeded();
        const reverbBox = await page.locator('[data-role="rack-station-reverb"]').boundingBox();
        const ghostBox = await page.locator('[data-lane-path="branch:split#1:1:0"]').boundingBox();
        const sourcePillBox = await page.locator(
            '[data-device-id="reverb#1"] .subway-station-pill',
        ).boundingBox();
        assert.ok(reverbBox && ghostBox);
        assert.ok(sourcePillBox);

        await page.mouse.move(reverbBox.x + (reverbBox.width / 2), reverbBox.y + (reverbBox.height / 2));
        await page.mouse.down();
        await page.waitForTimeout(200);
        await page.mouse.move(ghostBox.x + (ghostBox.width / 2), ghostBox.y + (ghostBox.height / 2), { steps: 12 });

        const lifted = page.locator('[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]');
        const destinationGhost = page.locator(
            '[data-role="rack-reorder-ghost"][data-device-id="reverb#1"] .subway-station-pill',
        );
        await lifted.waitFor();
        await destinationGhost.waitFor();
        const preview = await page.evaluate(({ pointerX, pointerY }) => {
            const liftedElement = document.querySelector(
                '[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]',
            );
            const ghostElement = document.querySelector(
                '[data-role="rack-reorder-ghost"][data-device-id="reverb#1"] .subway-station-pill',
            );
            const station = document.querySelector('[data-device-id="reverb#1"][data-lane-path]');
            const merge = document.querySelector('[data-role="rack-merge-connections-split#1"]')?.parentElement;
            const list = document.querySelector('[data-role="rack-module-list"]');
            if (!(liftedElement instanceof HTMLElement)
                    || !(ghostElement instanceof HTMLElement)
                    || !(station instanceof HTMLElement)
                    || !(merge instanceof HTMLElement)
                    || !(list instanceof HTMLElement)) {
                return null;
            }
            const liftedRect = liftedElement.getBoundingClientRect();
            const ghostRect = ghostElement.getBoundingClientRect();
            return {
                path: station.dataset.lanePath,
                liftedCenter: {
                    x: liftedRect.left + (liftedRect.width / 2),
                    y: liftedRect.top + (liftedRect.height / 2),
                },
                pointer: { x: pointerX, y: pointerY },
                liftedStyleSize: {
                    width: Number.parseFloat(liftedElement.style.width),
                    height: Number.parseFloat(liftedElement.style.height),
                },
                ghostRect: {
                    left: ghostRect.left,
                    top: ghostRect.top,
                    width: ghostRect.width,
                    height: ghostRect.height,
                },
                scrollTop: list.scrollTop,
                mergePathCount: merge.querySelectorAll("path").length,
                mergeAnimationCount: Array.from(merge.querySelectorAll("path"))
                    .flatMap((path) => path.getAnimations())
                    .filter((animation) => (
                        animation.playState === "running" || animation.playState === "pending"
                    )).length,
            };
        }, {
            pointerX: ghostBox.x + (ghostBox.width / 2),
            pointerY: ghostBox.y + (ghostBox.height / 2),
        });
        assert.ok(preview);
        assert.equal(preview.path, "branch:split#1:1:0");
        // The lift keeps the exact pointer-to-pill offset captured at source;
        // it does not falsely recenter when the destination lane is narrower.
        assert.equal(Math.abs(
            (preview.liftedCenter.x - preview.pointer.x)
                - ((sourcePillBox.x + (sourcePillBox.width / 2))
                    - (reverbBox.x + (reverbBox.width / 2))),
        ) < 1, true);
        assert.equal(Math.abs(
            (preview.liftedCenter.y - preview.pointer.y)
                - ((sourcePillBox.y + (sourcePillBox.height / 2))
                    - (reverbBox.y + (reverbBox.height / 2))),
        ) < 1, true);
        assert.deepEqual(preview.liftedStyleSize, {
            width: sourcePillBox.width,
            height: sourcePillBox.height,
        });
        assert.deepEqual({
            width: preview.ghostRect.width,
            height: preview.ghostRect.height,
        }, {
            width: sourcePillBox.width,
            height: sourcePillBox.height,
        });
        assert.equal(preview.mergePathCount > 0, true);
        assert.equal(preview.mergeAnimationCount > 0, true);
        await page.mouse.up();

        const settling = page.locator(
            '[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"].is-settling',
        );
        await settling.waitFor();
        const settleTarget = await settling.evaluate((element) => ({
            left: Number.parseFloat(element.style.left),
            top: Number.parseFloat(element.style.top),
            width: Number.parseFloat(element.style.width),
            height: Number.parseFloat(element.style.height),
            running: element.getAnimations().some((animation) => (
                animation.playState === "running" || animation.playState === "pending"
            )),
        }));
        assert.equal(Math.abs(settleTarget.left - preview.ghostRect.left) < 1, true);
        assert.equal(Math.abs(settleTarget.top - preview.ghostRect.top) < 1, true);
        assert.equal(Math.abs(settleTarget.width - preview.ghostRect.width) < 1, true);
        assert.equal(Math.abs(settleTarget.height - preview.ghostRect.height) < 1, true);
        assert.equal(settleTarget.running, true);
        await settling.waitFor({ state: "detached" });

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
        const settledPillBox = await page.locator(
            '[data-device-id="reverb#1"] .subway-station-pill',
        ).boundingBox();
        assert.ok(settledPillBox);
        assert.equal(Math.abs(settledPillBox.x - preview.ghostRect.left) < 1, true);
        const settledScrollTop = await page.locator('[data-role="rack-module-list"]')
            .evaluate((element) => element.scrollTop);
        assert.equal(Math.abs(
            (settledPillBox.y + settledScrollTop)
                - (preview.ghostRect.top + preview.scrollTop),
        ) < 1, true);
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

test("the source-composed production ShadowRoot owns and styles the lifted real pill", async () => {
    const page = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1024, height: 768 }),
    });

    try {
        await moveHarnessIntoProductionShadowRoot(page);
        const source = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const target = page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        await source.scrollIntoViewIfNeeded();
        const sourcePoint = await centerOf(source);
        const targetPoint = await centerOf(target);

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetPoint.x, targetPoint.y);
        const lifted = page.locator(
            '[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]',
        );
        await lifted.waitFor();
        const beforeMove = await lifted.evaluate((element) => ({
            left: Number.parseFloat(element.style.left),
            top: Number.parseFloat(element.style.top),
        }));
        const followDelta = { x: 12, y: 6 };
        await page.mouse.move(
            targetPoint.x + followDelta.x,
            targetPoint.y + followDelta.y,
        );
        await page.waitForFunction(({ beforeLeft, beforeTop }) => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const element = host?.shadowRoot?.querySelector('[data-role="rack-reorder-lifted-pill"]')
                ?? document.body.querySelector('[data-role="rack-reorder-lifted-pill"]');
            return element instanceof HTMLElement
                && Math.abs(Number.parseFloat(element.style.left) - beforeLeft) > 8
                && Math.abs(Number.parseFloat(element.style.top) - beforeTop) > 3;
        }, { beforeLeft: beforeMove.left, beforeTop: beforeMove.top });

        const evidence = await lifted.evaluate((element) => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const shadowRoot = host?.shadowRoot ?? null;
            const style = getComputedStyle(element);
            const pill = element.querySelector(".subway-station-pill");
            const pillStyle = pill instanceof HTMLElement ? getComputedStyle(pill) : null;
            return {
                rootIsOwningShadow: shadowRoot !== null && element.getRootNode() === shadowRoot,
                documentBodyOwnsLift: document.body.querySelector(
                    '[data-role="rack-reorder-lifted-pill"]',
                ) !== null,
                position: style.position,
                display: style.display,
                zIndex: style.zIndex,
                pointerEvents: style.pointerEvents,
                transform: style.transform,
                pillDisplay: pillStyle?.display ?? "",
                pillFilter: pillStyle?.filter ?? "",
                left: Number.parseFloat(element.style.left),
                top: Number.parseFloat(element.style.top),
            };
        });
        assert.equal(evidence.rootIsOwningShadow, true);
        assert.equal(evidence.documentBodyOwnsLift, false);
        assert.equal(evidence.position, "fixed");
        assert.equal(evidence.display, "grid");
        assert.equal(evidence.zIndex, "100");
        assert.equal(evidence.pointerEvents, "none");
        assert.notEqual(evidence.transform, "none");
        assert.equal(evidence.pillDisplay, "grid");
        assert.notEqual(evidence.pillFilter, "none");
        assert.equal(Math.abs((evidence.left - beforeMove.left) - followDelta.x) < 1, true);
        assert.equal(Math.abs((evidence.top - beforeMove.top) - followDelta.y) < 1, true);
        await page.mouse.up();
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("same-branch reorder commits the exact held preview once", async () => {
    const page = await openHarnessPage({ laneDoc: branchTailLaneDocJson("split") });

    try {
        await page.waitForSelector('[data-role="rack-group-split#1"]');
        const source = page.locator('[data-device-id="reverb#1"] [data-role="rack-station-reverb"]');
        const target = page.locator('[data-device-id="delay#1"] [data-role="rack-station-delay"]');
        await source.scrollIntoViewIfNeeded();
        const sourcePoint = await centerOf(source);
        const targetPoint = await centerOf(target);
        await clearHarnessDebugLog(page);

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(200);
        await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 });
        await page.waitForSelector('[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]');
        assert.equal(
            await page.locator('[data-device-id="reverb#1"][data-lane-path]')
                .getAttribute("data-lane-path"),
            "branch:split#1:2:0",
        );
        await page.mouse.up();

        const committed = await waitForHarnessSnapshot(
            page,
            "same branch preview committed",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                if (rawLane === undefined) {
                    return false;
                }
                const split = JSON.parse(String(rawLane)).chain
                    .find((node) => node.groupId === "split#1");
                return split?.branches[2]?.[0]?.deviceId === "reverb#1"
                    && split.branches[2][1]?.deviceId === "delay#1";
            },
        );
        assert.equal(
            committed.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
    } finally {
        await page.close();
    }
});

test("reorder release composes its move onto concurrent device state", async () => {
    const page = await openHarnessPage({ laneDoc: starterTrioLaneDocJson() });

    try {
        const source = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const target = page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        await source.scrollIntoViewIfNeeded();
        const sourcePoint = await centerOf(source);
        const targetPoint = await centerOf(target);
        await clearHarnessDebugLog(page);

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 6 });
        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]', {
            timeout: 2000,
        });
        await page.waitForSelector('[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]', {
            timeout: 2000,
        });

        await page.evaluate(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const doc = JSON.parse(String(snapshot.storedState["lane.v1"]));
            const visitPlacements = (nodes) => {
                for (const node of nodes) {
                    if (node.kind === "device") {
                        if (node.deviceId === "delay#1") {
                            node.enabled = false;
                        }
                    } else {
                        node.branches.forEach(visitPlacements);
                    }
                }
            };
            visitPlacements(doc.chain);
            doc.devices["delay#1"].params.delayFeedback = 0.71;
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(
                "lane.v1",
                JSON.stringify(doc),
            );
        });
        await page.waitForSelector('[data-device-id="delay#1"][data-enabled="false"]');
        const publicationsBeforeRelease = (await getHarnessSnapshot(page)).sentMessages
            .filter(({ endpointID }) => endpointID === "laneTopology").length;

        await page.mouse.up();
        const committed = await waitForHarnessSnapshot(
            page,
            "reorder composed onto concurrent device state",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                if (rawLane === undefined) {
                    return false;
                }
                const doc = JSON.parse(String(rawLane));
                return doc.chain[0]?.deviceId === "reverb#1"
                    && doc.chain.find((node) => node.deviceId === "delay#1")?.enabled === false
                    && doc.devices["delay#1"]?.params?.delayFeedback === 0.71;
            },
        );
        const stored = readStoredLaneDoc(committed);
        assert.equal(stored.chain[0].deviceId, "reverb#1");
        assert.equal(stored.chain.find((node) => node.deviceId === "delay#1").enabled, false);
        assert.equal(stored.devices["delay#1"].params.delayFeedback, 0.71);
        assert.equal(
            committed.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            publicationsBeforeRelease + 1,
        );
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("a concurrent topology replacement cancels reorder without restoring its stale preview", async () => {
    const page = await openHarnessPage({ laneDoc: starterTrioLaneDocJson() });

    try {
        const source = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const target = page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        await source.scrollIntoViewIfNeeded();
        const sourcePoint = await centerOf(source);
        const targetPoint = await centerOf(target);
        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 6 });
        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]', {
            timeout: 2000,
        });
        await page.waitForSelector('[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]', {
            timeout: 2000,
        });

        const replacement = await page.evaluate(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const doc = JSON.parse(String(snapshot.storedState["lane.v1"]));
            const byDeviceId = Object.fromEntries(doc.chain.map((node) => [node.deviceId, node]));
            doc.chain = [
                byDeviceId["delay#1"],
                byDeviceId["distortion#1"],
                byDeviceId["reverb#1"],
            ];
            const serialized = JSON.stringify(doc);
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("lane.v1", serialized);
            return serialized;
        });

        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"]', {
            state: "detached",
            timeout: 2000,
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-device-id") === "delay#1"
        ));
        await clearHarnessDebugLog(page);
        await page.mouse.up();
        await page.waitForTimeout(80);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(String(snapshot.storedState["lane.v1"]), replacement);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"),
            false,
        );
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("station capture rejection keeps outside movement in the scrolling gesture", async () => {
    const page = await openHarnessPage({
        laneDoc: boundaryScrollLaneDocJson(),
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__FX_CAPTURE_REJECTIONS__ = 0;
                const setPointerCapture = Element.prototype.setPointerCapture;
                Element.prototype.setPointerCapture = function rejectStationCapture(pointerId) {
                    if (this.matches?.(".subway-station")) {
                        window.__FX_CAPTURE_REJECTIONS__ += 1;
                        try {
                            if (this.hasPointerCapture(pointerId)) {
                                this.releasePointerCapture(pointerId);
                            }
                        } catch {
                            // The test seam represents a platform with no capture support.
                        }
                        throw new DOMException("Station pointer capture rejected", "NotSupportedError");
                    }
                    return setPointerCapture.call(this, pointerId);
                };
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await graph.evaluate((element) => { element.scrollTop = 0; });
        const source = await centerOf(page.locator(
            '[data-device-id="globalFilter#1"] [data-role="rack-station-filter"]',
        ));
        await clearHarnessDebugLog(page);

        await page.mouse.move(source.x, source.y);
        await page.mouse.down();
        await page.mouse.move(388, source.y - 44);
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement && element.scrollTop > 20;
        }, undefined, { timeout: 2000 });
        await page.waitForTimeout(600);

        assert.equal(await page.evaluate(() => window.__FX_CAPTURE_REJECTIONS__), 1);
        assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        await page.mouse.up();
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("station capture rejection still lifts and reorders outside the source station", async () => {
    const page = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__FX_REORDER_HAPTICS__ = [];
                window.cmaj_triggerHaptic = (style = "light") => {
                    window.__FX_REORDER_HAPTICS__.push(style);
                };
                const setPointerCapture = Element.prototype.setPointerCapture;
                Element.prototype.setPointerCapture = function rejectStationCapture(pointerId) {
                    if (this.matches?.(".subway-station")) {
                        try {
                            if (this.hasPointerCapture(pointerId)) {
                                this.releasePointerCapture(pointerId);
                            }
                        } catch {
                            // The test seam represents a platform with no capture support.
                        }
                        throw new DOMException("Station pointer capture rejected", "NotSupportedError");
                    }
                    return setPointerCapture.call(this, pointerId);
                };
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const source = await centerOf(page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        ));
        const target = await centerOf(page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        ));
        await clearHarnessDebugLog(page);

        await page.mouse.move(source.x, source.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(target.x, target.y);
        await page.waitForSelector(
            '[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]',
        );
        await page.mouse.up();

        const committed = await waitForHarnessSnapshot(
            page,
            "capture fallback reorder committed",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                return rawLane !== undefined
                    && JSON.parse(String(rawLane)).chain[0]?.deviceId === "reverb#1";
            },
        );
        assert.deepEqual(await page.evaluate(() => window.__FX_REORDER_HAPTICS__), ["light"]);
        assert.equal(
            committed.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("post-lift capture rejection follows outside-list movement and commits the exact preview once", async () => {
    const page = await openAllCaptureRejectedRackPage();

    try {
        const list = page.locator('[data-role="rack-module-list"]');
        const source = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const target = page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        await source.scrollIntoViewIfNeeded();
        const sourcePoint = await centerOf(source);
        const targetPoint = await centerOf(target);
        const outsidePoint = await pointOutsideOf(list);
        await clearHarnessDebugLog(page);

        await page.mouse.move(sourcePoint.x, sourcePoint.y);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetPoint.x, targetPoint.y);
        const lifted = page.locator(
            '[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]',
        );
        await lifted.waitFor();
        await page.mouse.move(targetPoint.x + 1, targetPoint.y);
        await page.waitForSelector(
            '[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]',
        );
        const beforeOutsideMove = await lifted.boundingBox();
        assert.ok(beforeOutsideMove);

        await page.mouse.move(outsidePoint.x, outsidePoint.y);
        await page.waitForFunction(({ beforeLeft, beforeTop }) => {
            const element = document.querySelector('[data-role="rack-reorder-lifted-pill"]');
            if (!(element instanceof HTMLElement)) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.left - beforeLeft) > 8 || Math.abs(rect.top - beforeTop) > 8;
        }, {
            beforeLeft: beforeOutsideMove.x,
            beforeTop: beforeOutsideMove.y,
        }, { timeout: 2000 });
        const outsideEvidence = await page.evaluate(({ x, y }) => {
            const listElement = document.querySelector('[data-role="rack-module-list"]');
            const hit = document.elementFromPoint(x, y);
            return {
                outsideList: listElement instanceof HTMLElement
                    && hit !== null
                    && !listElement.contains(hit),
                rejections: window.__FX_CAPTURE_REJECTIONS__.slice(),
                previewPath: document.querySelector(
                    '[data-device-id="reverb#1"][data-lane-path]',
                )?.getAttribute("data-lane-path") ?? null,
            };
        }, outsidePoint);
        assert.equal(outsideEvidence.outsideList, true);
        assert.deepEqual(outsideEvidence.rejections, ["station", "list"]);
        assert.equal(outsideEvidence.previewPath, "trunk:0");

        await page.mouse.up();
        const committed = await waitForHarnessSnapshot(
            page,
            "all-capture-rejected reorder commit",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                return rawLane !== undefined
                    && JSON.parse(String(rawLane)).chain[0]?.deviceId === "reverb#1";
            },
        );
        assert.equal(
            committed.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("post-lift window fallback cancel, blur, and hidden state never publish", async () => {
    for (const lifecycleLoss of ["pointercancel", "blur", "hidden"]) {
        const page = await openAllCaptureRejectedRackPage();
        try {
            const list = page.locator('[data-role="rack-module-list"]');
            const source = page.locator(
                '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
            );
            const target = page.locator(
                '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
            );
            await source.scrollIntoViewIfNeeded();
            const sourcePoint = await centerOf(source);
            const targetPoint = await centerOf(target);
            const outsidePoint = await pointOutsideOf(list);
            const storedBefore = String((await getHarnessSnapshot(page)).storedState["lane.v1"]);
            await clearHarnessDebugLog(page);

            await page.mouse.move(sourcePoint.x, sourcePoint.y);
            await page.mouse.down();
            await page.waitForTimeout(210);
            await page.mouse.move(targetPoint.x, targetPoint.y);
            await page.waitForSelector(
                '[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]',
            );
            await page.mouse.move(targetPoint.x + 1, targetPoint.y);
            await page.waitForSelector(
                '[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]',
            );
            await page.mouse.move(outsidePoint.x, outsidePoint.y);

            if (lifecycleLoss === "pointercancel") {
                await page.evaluate(() => {
                    window.dispatchEvent(new PointerEvent("pointercancel", {
                        bubbles: true,
                        cancelable: true,
                        pointerId: window.__FX_LAST_POINTER_ID__,
                        pointerType: "mouse",
                        isPrimary: true,
                        button: 0,
                        buttons: 0,
                    }));
                });
            } else if (lifecycleLoss === "blur") {
                await page.evaluate(() => window.dispatchEvent(new Event("blur")));
            } else {
                await page.evaluate(() => {
                    Object.defineProperty(document, "visibilityState", {
                        configurable: true,
                        get: () => "hidden",
                    });
                    document.dispatchEvent(new Event("visibilitychange"));
                    Object.defineProperty(document, "visibilityState", {
                        configurable: true,
                        get: () => "visible",
                    });
                });
            }

            await page.waitForSelector('[data-role="rack-reorder-lifted-pill"]', {
                state: "detached",
            });
            await page.mouse.move(sourcePoint.x, sourcePoint.y);
            await page.mouse.up();
            await page.waitForTimeout(80);

            const snapshot = await getHarnessSnapshot(page);
            assert.equal(
                String(snapshot.storedState["lane.v1"]),
                storedBefore,
                `${lifecycleLoss} must restore the authoritative document`,
            );
            assert.equal(
                snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"),
                false,
                `${lifecycleLoss} must not publish reorder topology`,
            );
            assert.deepEqual(
                await page.evaluate(() => window.__FX_CAPTURE_REJECTIONS__),
                ["station", "list"],
            );
            assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        } finally {
            await page.mouse.up().catch(() => undefined);
            await page.close();
        }
    }
});

test("native station capture loss cancels a hold even when React delegation is blocked", async () => {
    const page = await openHarnessPage({
        laneDoc: starterTrioLaneDocJson(),
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const station = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const source = await centerOf(station);
        const before = await getHarnessSnapshot(page);
        const selectedBefore = await page.locator(
            '.subway-station-row.is-selected, .subway-station-cell.is-selected',
        ).first().getAttribute("data-device-id");
        await station.evaluate((element) => {
            window.__FX_CAPTURE_LOSS_POINTER_ID__ = null;
            window.__FX_CAPTURE_LOSS_BLOCKED__ = 0;
            element.addEventListener("pointerdown", (event) => {
                window.__FX_CAPTURE_LOSS_POINTER_ID__ = event.pointerId;
            }, { once: true });
        });
        await clearHarnessDebugLog(page);

        await page.mouse.move(source.x, source.y);
        await page.mouse.down();
        await page.waitForFunction(() => Number.isInteger(window.__FX_CAPTURE_LOSS_POINTER_ID__));
        await page.mouse.move(source.x + 1, source.y);
        await page.waitForFunction(() => {
            const element = document.querySelector(
                '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
            );
            return element?.hasPointerCapture(window.__FX_CAPTURE_LOSS_POINTER_ID__) === true;
        });
        await station.evaluate((element) => {
            element.addEventListener("lostpointercapture", (event) => {
                window.__FX_CAPTURE_LOSS_BLOCKED__ += 1;
                event.stopPropagation();
            }, { once: true });
            element.releasePointerCapture(window.__FX_CAPTURE_LOSS_POINTER_ID__);
        });
        await page.mouse.move(388, source.y - 44);
        await page.waitForFunction(
            () => window.__FX_CAPTURE_LOSS_BLOCKED__ === 1,
            undefined,
            { timeout: 2000 },
        );
        await page.waitForTimeout(600);
        await page.mouse.up();

        assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        assert.equal(
            await page.locator(
                '.subway-station-row.is-selected, .subway-station-cell.is-selected',
            ).first().getAttribute("data-device-id"),
            selectedBefore,
        );
        const after = await getHarnessSnapshot(page);
        assert.equal(String(after.storedState["lane.v1"]), String(before.storedState["lane.v1"]));
        assert.equal(after.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("blur and hidden visibility cancel pre-lift station holds without a late winner", async () => {
    const page = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__FX_REORDER_HAPTICS__ = [];
                window.cmaj_triggerHaptic = (style = "light") => {
                    window.__FX_REORDER_HAPTICS__.push(style);
                };
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const sourceLocator = page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        );
        const targetLocator = page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        const selectedBefore = await page.locator(
            '.subway-station-row.is-selected, .subway-station-cell.is-selected',
        ).first().getAttribute("data-device-id");
        const storedBefore = String((await getHarnessSnapshot(page)).storedState["lane.v1"]);

        for (const lifecycleLoss of ["blur", "hidden"]) {
            await clearHarnessDebugLog(page);
            const source = await centerOf(sourceLocator);
            const target = await centerOf(targetLocator);
            await page.mouse.move(source.x, source.y);
            await page.mouse.down();
            await page.waitForTimeout(lifecycleLoss === "blur" ? 80 : 230);
            if (lifecycleLoss === "blur") {
                await page.evaluate(() => window.dispatchEvent(new Event("blur")));
            } else {
                await page.evaluate(() => {
                    Object.defineProperty(document, "visibilityState", {
                        configurable: true,
                        get: () => "hidden",
                    });
                    document.dispatchEvent(new Event("visibilitychange"));
                    Object.defineProperty(document, "visibilityState", {
                        configurable: true,
                        get: () => "visible",
                    });
                });
            }
            await page.waitForTimeout(600);
            await page.mouse.move(target.x, target.y);
            await page.mouse.up();

            assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
            assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
            assert.equal(
                await page.locator(
                    '.subway-station-row.is-selected, .subway-station-cell.is-selected',
                ).first().getAttribute("data-device-id"),
                selectedBefore,
            );
            const snapshot = await getHarnessSnapshot(page);
            assert.equal(String(snapshot.storedState["lane.v1"]), storedBefore);
            assert.equal(
                snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"),
                false,
            );
        }
        assert.deepEqual(await page.evaluate(() => window.__FX_REORDER_HAPTICS__), []);
    } finally {
        await page.mouse.up().catch(() => undefined);
        await page.close();
    }
});

test("secondary mouse and pen pointerdowns never enter the station hold state", async () => {
    const page = await openHarnessPage({ laneDoc: "fresh" });

    try {
        const station = page.locator(
            '[data-device-id="delay#1"] [data-role="rack-station-delay"]',
        );
        const point = await centerOf(station);
        for (const input of [
            { pointerId: 81, pointerType: "mouse", isPrimary: true, button: 2 },
            { pointerId: 82, pointerType: "pen", isPrimary: true, button: 2 },
            { pointerId: 83, pointerType: "pen", isPrimary: false, button: 0 },
        ]) {
            await station.dispatchEvent("pointerdown", {
                ...input,
                clientX: point.x,
                clientY: point.y,
                bubbles: true,
            });
        }
        await page.waitForTimeout(600);

        assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("phone station gestures lock scrolling, reorder, and menu as exclusive winners", async () => {
    const installNativeHapticRecorder = (nextPage) => nextPage.addInitScript(() => {
        window.__FX_REORDER_HAPTICS__ = [];
        window.cmaj_triggerHaptic = (style = "light") => {
            window.__FX_REORDER_HAPTICS__.push(style);
        };
    });

    const scrollPage = await openHarnessPage({
        laneDoc: boundaryScrollLaneDocJson(),
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await installNativeHapticRecorder(nextPage);
        },
    });
    let touch = null;
    try {
        await scrollPage.click('[data-role="mobile-workspace-tab-fx"]');
        const graph = scrollPage.locator('[data-role="rack-module-list"]');
        await graph.waitFor();
        await graph.evaluate((element) => { element.scrollTop = 0; });
        await clearHarnessDebugLog(scrollPage);
        const before = await getHarnessSnapshot(scrollPage);
        const selectedBefore = await scrollPage.locator(
            '.subway-station-row.is-selected, .subway-station-cell.is-selected',
        ).first().getAttribute("data-device-id");
        const source = await centerOf(scrollPage.locator(
            '[data-device-id="globalFilter#1"] [data-role="rack-station-filter"]',
        ));
        touch = await createTouchDriver(scrollPage);
        await touch.start(source);
        await touch.move({ x: source.x, y: source.y - 36 });
        await touch.end();
        await scrollPage.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement && element.scrollTop > 20;
        });
        assert.deepEqual(
            await scrollPage.evaluate(() => window.__FX_REORDER_HAPTICS__),
            [],
        );
        assert.equal(await scrollPage.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        assert.equal(await scrollPage.locator('[data-role="rack-station-menu"]').count(), 0);
        let after = await getHarnessSnapshot(scrollPage);
        assert.equal(String(after.storedState["lane.v1"]), String(before.storedState["lane.v1"]));
        assert.equal(after.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        assert.equal(
            await scrollPage.locator(
                '.subway-station-row.is-selected, .subway-station-cell.is-selected',
            ).first().getAttribute("data-device-id"),
            selectedBefore,
        );

        // Movement still owns the gesture at the top boundary even though the
        // graph cannot consume a downward delta there.
        await graph.evaluate((element) => { element.scrollTop = 0; });
        await clearHarnessDebugLog(scrollPage);
        const boundarySource = await centerOf(scrollPage.locator(
            '[data-device-id="globalFilter#1"] [data-role="rack-station-filter"]',
        ));
        await touch.start(boundarySource);
        await touch.move({ x: boundarySource.x, y: boundarySource.y + 34 });
        await touch.end();
        assert.equal(await graph.evaluate((element) => element.scrollTop), 0);
        assert.equal(await scrollPage.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        after = await getHarnessSnapshot(scrollPage);
        assert.equal(after.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);

        // A branch pill obeys the same immediate-scroll winner. Pick a direction
        // with remaining graph range so the ownership is observable.
        const branchStation = scrollPage.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        );
        await branchStation.scrollIntoViewIfNeeded();
        const branchSource = await centerOf(branchStation);
        const branchScroll = await graph.evaluate((element) => ({
            before: element.scrollTop,
            maximum: element.scrollHeight - element.clientHeight,
        }));
        const moveUp = branchScroll.before < branchScroll.maximum - 20;
        await clearHarnessDebugLog(scrollPage);
        await touch.start(branchSource);
        await touch.move({ x: branchSource.x, y: branchSource.y + (moveUp ? -34 : 34) });
        await touch.end();
        await scrollPage.waitForFunction(({ beforeScroll, increasing }) => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement
                && (increasing ? element.scrollTop > beforeScroll : element.scrollTop < beforeScroll);
        }, { beforeScroll: branchScroll.before, increasing: moveUp });
        assert.deepEqual(await scrollPage.evaluate(() => window.__FX_REORDER_HAPTICS__), []);
        assert.equal(await scrollPage.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        assert.equal(
            await scrollPage.locator(
                '.subway-station-row.is-selected, .subway-station-cell.is-selected',
            ).first().getAttribute("data-device-id"),
            selectedBefore,
        );
        after = await getHarnessSnapshot(scrollPage);
        assert.equal(String(after.storedState["lane.v1"]), String(before.storedState["lane.v1"]));
        assert.equal(after.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
    } finally {
        await touch?.close().catch(() => undefined);
        await scrollPage.close();
    }

    const page = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await installNativeHapticRecorder(nextPage);
        },
    });
    touch = null;
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        touch = await createTouchDriver(page);
        const original = await getHarnessSnapshot(page);
        await clearHarnessDebugLog(page);
        await page.evaluate(() => { window.__FX_REORDER_HAPTICS__ = []; });
        let source = await centerOf(page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        ));
        let target = await centerOf(page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        ));

        // Reduced motion keeps the lift/gap/ghost explicit; it removes only
        // travel time. Cancellation then restores the exact source document.
        await touch.start(source);
        await page.waitForTimeout(210);
        await touch.move(target);
        await touch.move({ x: target.x + 1, y: target.y });
        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"][data-device-id="reverb#1"]');
        const reducedPresentation = await page.evaluate(() => {
            const lifted = document.querySelector('[data-role="rack-reorder-lifted-pill"]');
            const ghost = document.querySelector('[data-role="rack-reorder-ghost"] .subway-station-pill');
            const placement = document.querySelector('[data-device-id="reverb#1"][data-lane-path]');
            if (!(lifted instanceof HTMLElement)
                    || !(ghost instanceof HTMLElement)
                    || !(placement instanceof HTMLElement)) {
                return null;
            }
            const liftedRect = lifted.getBoundingClientRect();
            const ghostRect = ghost.getBoundingClientRect();
            return {
                path: placement.dataset.lanePath,
                liftedVisible: liftedRect.width > 0 && liftedRect.height > 0,
                ghostVisible: ghostRect.width > 0
                    && ghostRect.height > 0
                    && Number(getComputedStyle(ghost).opacity) > 0,
            };
        });
        assert.deepEqual(reducedPresentation, {
            path: "trunk:0",
            liftedVisible: true,
            ghostVisible: true,
        });
        assert.deepEqual(await page.evaluate(() => window.__FX_REORDER_HAPTICS__), ["light"]);
        assert.equal(await page.locator('[data-role="rack-station-menu"]').count(), 0);
        await touch.cancel();
        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"]', { state: "detached" });
        const cancelled = await getHarnessSnapshot(page);
        assert.equal(String(cancelled.storedState["lane.v1"]), String(original.storedState["lane.v1"]));
        assert.equal(cancelled.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        assert.equal(
            await page.locator('[data-device-id="reverb#1"][data-lane-path]')
                .getAttribute("data-lane-path"),
            "trunk:2",
        );
        assert.equal(await page.locator(
            '[data-role="rack-editor-drive"][data-device-id="distortion#1"]',
        ).count(), 1);
        assert.equal(await page.locator(
            '[data-role="rack-editor-reverb"][data-device-id="reverb#1"]',
        ).count(), 0);

        // A second full gesture commits exactly the preview and emits one lift
        // haptic—never another one during movement or release.
        await clearHarnessDebugLog(page);
        await page.evaluate(() => { window.__FX_REORDER_HAPTICS__ = []; });
        source = await centerOf(page.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        ));
        target = await centerOf(page.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        ));
        await touch.start(source);
        await page.waitForTimeout(210);
        await touch.move(target);
        await touch.move({ x: target.x + 1, y: target.y });
        await page.waitForSelector('[data-role="rack-reorder-ghost"][data-device-id="reverb#1"]');
        await touch.end();
        const committed = await waitForHarnessSnapshot(
            page,
            "phone reorder commit",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                return rawLane !== undefined
                    && JSON.parse(String(rawLane)).chain[0]?.deviceId === "reverb#1";
            },
        );
        assert.deepEqual(await page.evaluate(() => window.__FX_REORDER_HAPTICS__), ["light"]);
        assert.equal(
            committed.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );

        // The longer stationary hold opens only the menu. It neither selects
        // the station nor emits a lift haptic/topology publication.
        await page.waitForSelector('[data-role="rack-reorder-lifted-pill"]', { state: "detached" });
        await clearHarnessDebugLog(page);
        await page.evaluate(() => { window.__FX_REORDER_HAPTICS__ = []; });
        const menuSource = await centerOf(page.locator(
            '[data-device-id="delay#1"] [data-role="rack-station-delay"]',
        ));
        await touch.start(menuSource);
        await page.waitForTimeout(600);
        await page.waitForSelector('[data-role="rack-station-menu"][data-device-id="delay#1"]');
        assert.deepEqual(await page.evaluate(() => window.__FX_REORDER_HAPTICS__), []);
        assert.equal(await page.locator('[data-role="rack-reorder-lifted-pill"]').count(), 0);
        await touch.end();
        await page.waitForTimeout(40);
        assert.equal(await page.locator('[data-role="rack-editor-drive"][data-device-id="distortion#1"]').count(), 1);
        const menuSnapshot = await getHarnessSnapshot(page);
        assert.equal(menuSnapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
    } finally {
        await touch?.close().catch(() => undefined);
        await page.close();
    }

    const fallbackPage = await openHarnessPage({
        laneDoc: "fresh",
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__FX_REORDER_VIBRATIONS__ = [];
                Object.defineProperty(window, "cmaj_triggerHaptic", {
                    configurable: true,
                    writable: true,
                    value: undefined,
                });
                Object.defineProperty(navigator, "vibrate", {
                    configurable: true,
                    value: (pattern) => {
                        window.__FX_REORDER_VIBRATIONS__.push(pattern);
                        return true;
                    },
                });
            });
        },
    });
    touch = null;
    try {
        await fallbackPage.click('[data-role="mobile-workspace-tab-fx"]');
        touch = await createTouchDriver(fallbackPage);
        const source = await centerOf(fallbackPage.locator(
            '[data-device-id="reverb#1"] [data-role="rack-station-reverb"]',
        ));
        const target = await centerOf(fallbackPage.locator(
            '[data-device-id="distortion#1"] [data-role="rack-station-drive"]',
        ));
        await touch.start(source);
        await fallbackPage.waitForTimeout(210);
        await touch.move(target);
        await touch.move({ x: target.x + 1, y: target.y });
        await fallbackPage.waitForSelector('[data-role="rack-reorder-lifted-pill"]');
        assert.deepEqual(
            await fallbackPage.evaluate(() => window.__FX_REORDER_VIBRATIONS__),
            [8],
        );
        await touch.cancel();
    } finally {
        await touch?.close().catch(() => undefined);
        await fallbackPage.close();
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

test("only the icon of an already selected station toggles bypass", async () => {
    const page = await openHarnessPage({ laneDoc: "fresh" });

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        const driveModule = page.locator('[data-device-id="distortion#1"][data-role="rack-module-drive"]');
        const delayModule = page.locator('[data-device-id="delay#1"][data-role="rack-module-delay"]');
        const driveLabel = driveModule.locator(".subway-station-label");
        const delayLabel = delayModule.locator(".subway-station-label");
        const delayIcon = delayModule.locator('[data-station-icon-target="true"]:visible');

        assert.equal(await driveModule.getAttribute("data-enabled"), "false");
        await driveLabel.click();
        assert.equal(await driveModule.getAttribute("data-enabled"), "false");
        assert.equal(await page.locator('[data-role="rack-editor-drive"][data-device-id="distortion#1"]').count(), 1);
        await driveLabel.click();
        assert.equal(await driveModule.getAttribute("data-enabled"), "false");

        // The first icon tap is still selection/open, never a power command.
        assert.equal(await delayModule.getAttribute("data-enabled"), "false");
        await delayIcon.click();
        await page.waitForSelector('[data-role="rack-editor-delay"][data-device-id="delay#1"]');
        assert.equal(await delayModule.getAttribute("data-enabled"), "false");

        await delayIcon.click();
        const toggled = await waitForHarnessSnapshot(
            page,
            "selected delay icon bypass toggle",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                return rawLane !== undefined
                    && JSON.parse(String(rawLane)).chain
                        .find((node) => node.deviceId === "delay#1")?.enabled === true;
            },
        );
        assert.equal(await delayModule.getAttribute("data-enabled"), "true");
        assert.equal(await page.locator('[data-role="rack-editor-delay"][data-device-id="delay#1"]').count(), 1);
        assert.equal(
            toggled.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );

        await clearHarnessDebugLog(page);
        await delayIcon.click();
        const bypassedAgain = await waitForHarnessSnapshot(
            page,
            "selected delay icon second bypass toggle",
            (snapshot) => {
                const rawLane = snapshot.storedState["lane.v1"];
                return rawLane !== undefined
                    && JSON.parse(String(rawLane)).chain
                        .find((node) => node.deviceId === "delay#1")?.enabled === false;
            },
        );
        assert.equal(await delayModule.getAttribute("data-enabled"), "false");
        assert.equal(
            bypassedAgain.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
        assert.equal(await page.locator(
            '[data-role="rack-editor-delay"][data-device-id="delay#1"]',
        ).count(), 1);

        await clearHarnessDebugLog(page);
        await delayLabel.click();
        const afterLabel = await getHarnessSnapshot(page);
        assert.equal(await delayModule.getAttribute("data-enabled"), "false");
        assert.equal(afterLabel.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        assert.equal(await page.locator('[data-role="rack-editor-delay"][data-device-id="delay#1"]').count(), 1);
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
        await createRackMappingByDrop(page);

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

test("Swap uses the shared picker at the exact trunk, parallel, and split path", async () => {
    const fixtures = [
        {
            name: "trunk",
            laneDoc: "fresh",
            oldEffectId: "delay",
            oldDeviceId: "delay#1",
            oldTargetKind: "lane.delay#1.delayTime",
            replacementEffectId: "chorus",
            replacementDeviceId: "chorus#1",
            atPath: (doc) => doc.chain[1]?.deviceId,
        },
        {
            name: "parallel branch",
            laneDoc: branchTailLaneDocJson("parallel"),
            oldEffectId: "chorus",
            oldDeviceId: "chorus#1",
            oldTargetKind: "lane.chorus#1.chorusMix",
            replacementEffectId: "reverb",
            replacementDeviceId: "reverb#1",
            atPath: (doc) => doc.chain.find((node) => node.groupId === "parallel#1")
                ?.branches[0]?.[1]?.deviceId,
        },
        {
            name: "split band",
            laneDoc: branchTailLaneDocJson("split"),
            oldEffectId: "delay",
            oldDeviceId: "delay#1",
            oldTargetKind: "lane.delay#1.delayTime",
            replacementEffectId: "chorus",
            replacementDeviceId: "chorus#1",
            atPath: (doc) => doc.chain.find((node) => node.groupId === "split#1")
                ?.branches[2]?.[0]?.deviceId,
        },
    ];

    for (const fixture of fixtures) {
        const page = await openHarnessPage({ laneDoc: fixture.laneDoc });
        try {
            await page.waitForSelector('[data-role="effects-rack-card"]');
            const seededRoute = normalizeModulationState({
                routes: [{
                    id: `swap-${fixture.oldEffectId}`,
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "unipolar",
                    targetKind: fixture.oldTargetKind,
                    amount: 0.25,
                    reducer: "max",
                }],
            });
            await page.evaluate((state) => {
                window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(
                    "modulation.v6",
                    JSON.stringify(state),
                );
            }, seededRoute);
            await waitForHarnessSnapshot(
                page,
                `${fixture.name} old route seeded`,
                (snapshot) => readStoredModulationState(snapshot).routes
                    .some((route) => route.targetKind === fixture.oldTargetKind),
            );

            const stationSelector = `[data-device-id="${fixture.oldDeviceId}"] [data-role="rack-station-${fixture.oldEffectId}"]`;
            const openSwapPicker = async () => {
                await page.click(stationSelector, { button: "right" });
                await page.waitForSelector(
                    `[data-role="rack-station-menu"][data-device-id="${fixture.oldDeviceId}"]`,
                );
                await page.click(`[data-role="rack-station-swap-${fixture.oldEffectId}"]`);
                await page.waitForSelector('[data-role="rack-add-sheet"][data-picker-mode="swap"]');
            };

            // Closing the picker is a true cancellation: neither the lane nor
            // its old modulation route publishes a change.
            const beforeCancel = await getHarnessSnapshot(page);
            await clearHarnessDebugLog(page);
            await openSwapPicker();
            await page.keyboard.press("Escape");
            await page.waitForSelector('[data-role="rack-add-sheet"]', { state: "detached" });
            const cancelled = await getHarnessSnapshot(page);
            assert.equal(
                String(cancelled.storedState["lane.v1"]),
                String(beforeCancel.storedState["lane.v1"]),
                `${fixture.name}: cancellation keeps the lane document`,
            );
            assert.equal(
                readStoredModulationState(cancelled).routes.some((route) => (
                    route.targetKind === fixture.oldTargetKind
                )),
                true,
                `${fixture.name}: cancellation keeps the old route`,
            );
            assert.equal(
                cancelled.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"),
                false,
                `${fixture.name}: cancellation publishes no topology`,
            );

            await clearHarnessDebugLog(page);
            await openSwapPicker();
            await page.click(`[data-role="rack-add-${fixture.replacementEffectId}"]`);
            const swapped = await waitForHarnessSnapshot(
                page,
                `${fixture.name} swap committed and cleaned`,
                (snapshot) => {
                    const rawLane = snapshot.storedState["lane.v1"];
                    if (rawLane === undefined) {
                        return false;
                    }
                    const doc = JSON.parse(String(rawLane));
                    return fixture.atPath(doc) === fixture.replacementDeviceId
                        && doc.devices[fixture.oldDeviceId] === undefined
                        && readStoredModulationState(snapshot).routes
                            .every((route) => route.targetKind !== fixture.oldTargetKind);
                },
            );
            const doc = readStoredLaneDoc(swapped);
            assert.equal(fixture.atPath(doc), fixture.replacementDeviceId, fixture.name);
            assert.equal(doc.devices[fixture.oldDeviceId], undefined, fixture.name);
            assert.notEqual(doc.devices[fixture.replacementDeviceId], undefined, fixture.name);
            assert.equal(
                swapped.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
                1,
                `${fixture.name}: replacement publishes one topology`,
            );
            await page.waitForSelector(
                `.rack-effect-editor[data-device-id="${fixture.replacementDeviceId}"]`,
            );
        } finally {
            await page.close();
        }
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
            output: { mix: 1, bypassed: false },
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
