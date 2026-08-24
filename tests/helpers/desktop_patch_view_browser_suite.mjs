import { after, before } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
} from "../../patch_gui/articulations.js";
import {
    ARTICULATIONS_V4_STATE_KEY,
    parseArticulationsV4,
} from "../../patch_gui/articulation-image.js";
import { deserializeMsegShape, renderMsegShape } from "../../patch_gui/mseg.js";
import {
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    deserializeModulationState,
    normalizeModulationState,
} from "../../patch_gui/modulation.js";
import {
    getModulationArticulationCellIndex,
    getModulationRuntimeCell,
} from "../../patch_gui/modulation-runtime-program.js";
import {
    EFFECT_ID_TO_LANE_TYPE,
    RACK_EFFECT_ORDER,
    createDefaultLaneState,
} from "../../patch_gui/lane-state.js";
import {
    serializeLaneStateV2,
    upgradeLaneStateV1,
} from "../../patch_gui/lane-state-v2.js";
import {
    getLaneSlotId,
    getLaneSlotParamIndex,
} from "../../patch_gui/lane-slot-params.js";
import { getRackParameterDescriptor } from "../../patch_gui/rack-parameter-descriptors.js";
import {
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
} from "./desktop_harness_browser.mjs";

let server;

let builtBundleServer;

let browser;

export const TEST_SAMPLES_PER_FRAME = 2048;

export const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;

export const EFFECT_PRESETS_V2_STATE_KEY = "effects.presets.v2";

export const SYNTH_PRESET_EFFECT_ID = "cosimo-synth";

export const ARTICULATION_STATE_KEY = ARTICULATIONS_V4_STATE_KEY;

export const RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY = ["synth", "preset" + "Baseline" + "Snapshot", "v1"].join(".");

export function expectedMsegPreviewProgressClipWidth(previewState, progress) {
    const plotWidth = Math.max(1, previewState.width - (MSEG_PREVIEW_HORIZONTAL_PADDING_PX * 2));
    return plotWidth * progress;
}

export function buildShortMidi(status, noteNumber, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

export function readStoredModulationState(snapshot) {
    const rawState = snapshot.storedState[MODULATION_STATE_KEY];
    return rawState === undefined
        ? createDefaultModulationState()
        : deserializeModulationState(rawState);
}

export function readStoredArticulationEditorState(snapshot) {
    const rawState = snapshot.storedState[ARTICULATION_STATE_KEY];
    if (rawState === undefined) {
        return normalizeArticulationEditorState(undefined);
    }
    const acceptedRouteIds = new Set(readStoredModulationState(snapshot).routes.flatMap((route) => (
        getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    )));
    const parsed = parseArticulationsV4(JSON.parse(String(rawState)), acceptedRouteIds);
    assert.equal(parsed._tag, "ok", parsed._tag === "err" ? parsed.error.message : undefined);
    const state = parsed.value;
    return normalizeArticulationEditorState({
        selectedSlotId: state.selectedSlotId,
        activeTriggerMode: state.activeTriggerMode,
        slots: state.slots.map((slot) => ({
            id: slot.id,
            runtimeSlot: slot.runtimeSlot,
            name: slot.name,
            snapshot: normalizeArticulationSnapshot({
                parameters: {
                    wavetablePosition: slot.overrides["oscA.framePosition"],
                    pan: slot.overrides["oscA.pan"],
                    warpMode: slot.overrides["oscA.warpMode"],
                    warpAmount: slot.overrides["oscA.warpAmount"],
                    filterMode: slot.overrides.filterMode,
                    filterCutoff: slot.overrides.filterCutoffHz,
                    filterQ: slot.overrides.filterQ,
                    unisonVoices: slot.overrides["oscA.unisonVoices"],
                    unisonDetune: slot.overrides["oscA.unisonDetune"],
                    unisonBlend: slot.overrides["oscA.unisonBlend"],
                    unisonWidth: slot.overrides["oscA.unisonWidth"],
                    unisonPhase: slot.overrides["oscA.phase"],
                    unisonRandom: slot.overrides["oscA.phaseRandom"],
                    unisonPhaseMode: slot.overrides["oscA.retrigger"],
                    unisonDetuneMode: slot.overrides["oscA.unisonDetuneMode"],
                    unisonStackMode: slot.overrides["oscA.unisonStackMode"],
                    unisonWavetablePositionSpread: slot.overrides["oscA.unisonWavetablePositionSpread"],
                    unisonWarpSpread: slot.overrides["oscA.unisonWarpSpread"],
                    msegMorphs: [
                        slot.overrides.msegMorph1,
                        slot.overrides.msegMorph2,
                        slot.overrides.msegMorph3,
                    ],
                },
                envelopes: [1, 2, 3].map((envelopeNumber) => ({
                    attackSeconds: slot.overrides[`env${envelopeNumber}.attackSeconds`],
                    decaySeconds: slot.overrides[`env${envelopeNumber}.decaySeconds`],
                    sustain: slot.overrides[`env${envelopeNumber}.sustain`],
                    releaseSeconds: slot.overrides[`env${envelopeNumber}.releaseSeconds`],
                })),
                modRouteAmounts: Object.entries(slot.routeAmounts).map(([routeId, amount]) => ({ routeId, amount })),
            }),
        })),
        chainAssignments: state.slots.map((slot) => ({
            id: `chain-${slot.id}`,
            articulationId: slot.id,
            ...slot.chainRange,
        })),
        keyAssignments: state.slots.map((slot) => ({ articulationId: slot.id, note: slot.key })),
        velocityAssignments: state.slots.map((slot) => ({
            id: `velocity-${slot.id}`,
            articulationId: slot.id,
            ...slot.velRange,
        })),
    });
}

export function editorBankToStoredArticulations(bankValue) {
    const bank = normalizeArticulationEditorState(bankValue);
    return {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: bank.selectedSlotId,
        activeTriggerMode: bank.activeTriggerMode,
        slots: bank.slots.map((slot) => {
            const parameters = slot.snapshot.parameters;
            const envelopes = slot.snapshot.envelopes;
            const envelope1 = envelopes[0];
            const envelope2 = envelopes[1];
            const envelope3 = envelopes[2];
            const key = bank.keyAssignments.find((assignment) => assignment.articulationId === slot.id)?.note
                ?? slot.runtimeSlot;
            const velRange = bank.velocityAssignments.find((assignment) => assignment.articulationId === slot.id)
                ?? { min: 0, max: 127 };
            const chainRange = bank.chainAssignments.find((assignment) => assignment.articulationId === slot.id)
                ?? { min: 0, max: 127 };
            return {
                id: slot.id,
                runtimeSlot: slot.runtimeSlot,
                name: slot.name,
                color: "#d2a128",
                key,
                velRange: { min: velRange.min, max: velRange.max },
                chainRange: { min: chainRange.min, max: chainRange.max },
                overrides: {
                    "oscA.framePosition": parameters.wavetablePosition,
                    "oscA.pan": parameters.pan,
                    "oscA.warpMode": parameters.warpMode,
                    "oscA.warpAmount": parameters.warpAmount,
                    filterMode: parameters.filterMode,
                    filterCutoffHz: parameters.filterCutoff,
                    filterQ: parameters.filterQ,
                    "oscA.unisonVoices": parameters.unisonVoices,
                    "oscA.unisonDetune": parameters.unisonDetune,
                    "oscA.unisonBlend": parameters.unisonBlend,
                    "oscA.unisonWidth": parameters.unisonWidth,
                    "oscA.phase": parameters.unisonPhase,
                    "oscA.phaseRandom": parameters.unisonRandom,
                    "oscA.retrigger": parameters.unisonPhaseMode,
                    "oscA.unisonDetuneMode": parameters.unisonDetuneMode,
                    "oscA.unisonStackMode": parameters.unisonStackMode,
                    "oscA.unisonWavetablePositionSpread": parameters.unisonWavetablePositionSpread,
                    "oscA.unisonWarpSpread": parameters.unisonWarpSpread,
                    msegMorph1: parameters.msegMorphs[0],
                    msegMorph2: parameters.msegMorphs[1],
                    msegMorph3: parameters.msegMorphs[2],
                    "env1.attackSeconds": envelope1.attackSeconds,
                    "env1.decaySeconds": envelope1.decaySeconds,
                    "env1.sustain": envelope1.sustain,
                    "env1.releaseSeconds": envelope1.releaseSeconds,
                    "env2.attackSeconds": envelope2.attackSeconds,
                    "env2.decaySeconds": envelope2.decaySeconds,
                    "env2.sustain": envelope2.sustain,
                    "env2.releaseSeconds": envelope2.releaseSeconds,
                    "env3.attackSeconds": envelope3.attackSeconds,
                    "env3.decaySeconds": envelope3.decaySeconds,
                    "env3.sustain": envelope3.sustain,
                    "env3.releaseSeconds": envelope3.releaseSeconds,
                },
                routeAmounts: Object.fromEntries(
                    slot.snapshot.modRouteAmounts.map(({ routeId, amount }) => [routeId, amount]),
                ),
            };
        }),
    };
}

export function readEffectPresetState(snapshot) {
    return JSON.parse(String(snapshot.storedState[EFFECT_PRESETS_V2_STATE_KEY]));
}

export function containsRetiredSynthPresetBaselineKey(snapshot) {
    return Object.prototype.hasOwnProperty.call(snapshot.storedState, RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY);
}

export function readStoredMsegShape(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].shapeA;
}

export function readStoredMsegPlayback(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].playback;
}

export function readStoredRouteAmount(snapshot, sourceSlot, targetKind) {
    const route = readStoredModulationState(snapshot).routes.find((candidate) => (
        candidate.enabled !== false
        && candidate.sourceKind === "mseg"
        && candidate.sourceSlot === sourceSlot
        && candidate.targetKind === targetKind
    ));

    return Number(route?.amount ?? 0);
}

export function routeSummary(route) {
    return {
        enabled: route.enabled,
        sourceKind: route.sourceKind,
        sourceSlot: route.sourceSlot,
        polarity: route.polarity,
        targetKind: route.targetKind,
        amount: route.amount,
    };
}

export function routeSummaries(routes) {
    return routes.map((route) => routeSummary(route));
}

export async function ensureFirstModulationRoute(page) {
    if (readStoredModulationState(await getHarnessSnapshot(page)).routes.length === 0) {
        await page.getByRole("button", { name: "Add route" }).click();
    }
    return waitForHarnessSnapshot(
        page,
        "first modulation route",
        (snapshot) => readStoredModulationState(snapshot).routes.length > 0,
    );
}

export const RUNTIME_PATH_FIELDS = {
    voice: {
        count: "voiceRouteCount",
        cells: "voiceRouteCells",
        sources: "voiceRouteSources",
        targets: "voiceRouteTargets",
        polarities: "voiceRoutePolarities",
    },
    macroVoice: {
        count: "macroVoiceRouteCount",
        cells: "macroVoiceRouteCells",
        sources: "macroVoiceRouteSources",
        targets: "macroVoiceRouteTargets",
        polarities: "macroVoiceRoutePolarities",
    },
    voiceRack: {
        count: "voiceRackRouteCount",
        cells: "voiceRackRouteCells",
        sources: "voiceRackRouteSources",
        targets: "voiceRackRouteTargets",
        polarities: "voiceRackRoutePolarities",
    },
    macroRack: {
        count: "macroRackRouteCount",
        cells: "macroRackRouteCells",
        sources: "macroRackRouteSources",
        targets: "macroRackRouteTargets",
        polarities: "macroRackRoutePolarities",
    },
};

export const RUNTIME_PATH_KINDS = {
    voice: 1,
    macroVoice: 2,
    voiceRack: 3,
    macroRack: 4,
};

export function latestRuntimeProgram(snapshot) {
    return [...snapshot.sentMessages]
        .reverse()
        .find(({ endpointID }) => endpointID === "modulationProgram")
        ?.value ?? null;
}

export function readRuntimeProgramRoute(snapshot, route) {
    const program = latestRuntimeProgram(snapshot);
    const cell = getModulationRuntimeCell(route);
    const fields = RUNTIME_PATH_FIELDS[cell.path];
    const count = Number(program?.[fields.count] ?? 0);
    const activeIndex = (program?.[fields.cells] ?? []).slice(0, count).indexOf(cell.cellIndex);

    if (activeIndex < 0) {
        return null;
    }

    return {
        path: cell.path,
        cellIndex: cell.cellIndex,
        sourceIndex: program[fields.sources][activeIndex],
        targetIndex: program[fields.targets][activeIndex],
        polarityKind: program[fields.polarities][activeIndex],
    };
}

export function hasRuntimeAmount(snapshot, route, expectedAmount, tolerance = 1e-9) {
    const cell = getModulationRuntimeCell(route);
    return snapshot.sentMessages.some(({ endpointID, value }) => (
        endpointID === "modulationAmount"
        && Number(value?.pathKind) === RUNTIME_PATH_KINDS[cell.path]
        && Number(value?.cellIndex) === cell.cellIndex
        && Math.abs(Number(value?.amount) - expectedAmount) <= tolerance
    ));
}

export function compactRuntimeMessages(messages) {
    return messages
        .filter(({ endpointID }) => endpointID === "modulationProgram" || endpointID === "modulationAmount")
        .slice(-12)
        .map(({ endpointID, value }) => endpointID === "modulationProgram"
            ? {
                endpointID,
                counts: {
                    voice: value?.voiceRouteCount,
                    macroVoice: value?.macroVoiceRouteCount,
                    voiceRack: value?.voiceRackRouteCount,
                    macroRack: value?.macroRackRouteCount,
                },
                activeCells: {
                    voice: value?.voiceRouteCells?.slice(0, Number(value?.voiceRouteCount ?? 0)),
                    macroVoice: value?.macroVoiceRouteCells?.slice(0, Number(value?.macroVoiceRouteCount ?? 0)),
                    voiceRack: value?.voiceRackRouteCells?.slice(0, Number(value?.voiceRackRouteCount ?? 0)),
                    macroRack: value?.macroRackRouteCells?.slice(0, Number(value?.macroRackRouteCount ?? 0)),
                },
            }
            : { endpointID, value });
}

export function buildDistortionScopeFixture({ amplitude = 1.62, sampleCount = 256 } = {}) {
    const inputSamples = [];
    const outputSamples = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const phase = (index / Math.max(1, sampleCount - 1)) * Math.PI * 6;
        const envelope = 0.82 + (0.18 * Math.cos((index / Math.max(1, sampleCount - 1)) * Math.PI * 2));
        const input = amplitude * envelope * Math.sin(phase);
        const output = input / Math.pow(1 + Math.pow(Math.abs(input), 8), 1 / 8);

        inputSamples.push(input);
        outputSamples.push(output);
    }

    const inputPeak = Math.max(...inputSamples.map((sample) => Math.abs(sample)));
    const outputPeak = Math.max(...outputSamples.map((sample) => Math.abs(sample)));
    const removedPeak = Math.max(...inputSamples.map((sample, index) => (
        Math.abs(sample - outputSamples[index])
    )));

    return {
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak,
        outputPeak,
        removedPeak,
        inputSamples,
        outputSamples,
    };
}

export function buildDistortionHistoryFixture({ amplitude = 1.7, binCount = 160 } = {}) {
    const inputMins = [];
    const inputMaxs = [];
    const outputMins = [];
    const outputMaxs = [];

    for (let index = 0; index < binCount; index += 1) {
        const normalized = index / Math.max(1, binCount - 1);
        const motion = 0.2 + (0.8 * Math.abs(Math.sin(normalized * Math.PI * 5.2)));
        const inputPeak = amplitude * motion;
        const outputPeak = inputPeak / Math.pow(1 + Math.pow(inputPeak, 8), 1 / 8);

        inputMins.push(-inputPeak);
        inputMaxs.push(inputPeak);
        outputMins.push(-outputPeak);
        outputMaxs.push(outputPeak);
    }

    return {
        sampleRateHz: 44_100,
        horizonMs: 2_000,
        binDurationMs: 12.5,
        binCount,
        validBinCount: binCount,
        inputMins,
        inputMaxs,
        outputMins,
        outputMaxs,
    };
}

export async function dispatchInputValueChange(locator, nextValue) {
    await locator.evaluate((element, value) => {
        if (!(element instanceof HTMLInputElement)) {
            throw new Error("Expected an HTMLInputElement.");
        }

        const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

        if (!setNativeValue) {
            throw new Error("Expected HTMLInputElement.prototype.value setter.");
        }

        setNativeValue.call(element, String(value));
        element.dispatchEvent(new Event("input", { bubbles: true }));
    }, String(nextValue));
}

export async function selectRackEffect(page, effectId) {
    await page.click(`[data-role="rack-station-${effectId}"]`);
    await page.waitForSelector(`[data-role="rack-editor-${effectId}"]`);
}

/**
 * Toggle one effect's enable through its station's long-press menu — the
 * subway map's home for bypass (the old per-row power button is gone).
 * Opens via contextmenu, which shares the long-press code path.
 */
export async function toggleRackEffectEnabled(page, effectId) {
    await page.click(`[data-role="rack-station-${effectId}"]`, { button: "right" });
    await page.waitForSelector(`[data-role="rack-station-menu"][data-effect-id="${effectId}"]`);
    await page.click(`[data-role="rack-enabled-${effectId}"]`);
    await page.waitForSelector('[data-role="rack-station-menu"]', { state: "detached" });
}

export async function expandGlobalModRail(page) {
    const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
    await grip.waitFor();
    if (await grip.getAttribute("aria-expanded") !== "true") {
        await grip.click({ position: { x: 28, y: 12 } });
    }
    await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
    await page.waitForTimeout(220);
}

export async function collapseGlobalModRail(page) {
    const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
    await grip.waitFor();
    if (await grip.getAttribute("aria-expanded") === "true") {
        await grip.click({ position: { x: 28, y: 12 } });
    }
    await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="false"]').waitFor();
    await page.waitForTimeout(240);
}

export function touchPointForModSourcePreviewTarget(start, target, viewportWidth, viewportHeight = 852) {
    const delta = { x: target.x - start.x, y: target.y - start.y };
    const distance = Math.hypot(delta.x, delta.y);
    assert.equal(distance > 7, true, "A preview-led test drag must cross the activation distance.");
    const direction = { x: delta.x / distance, y: delta.y / distance };
    const previewBounds = { left: 23, right: viewportWidth - 23, top: 23, bottom: viewportHeight - 23 };
    const edgeDistances = [];
    if (direction.x > 0) edgeDistances.push((previewBounds.right - start.x) / direction.x);
    if (direction.x < 0) edgeDistances.push((previewBounds.left - start.x) / direction.x);
    if (direction.y > 0) edgeDistances.push((previewBounds.bottom - start.y) / direction.y);
    if (direction.y < 0) edgeDistances.push((previewBounds.top - start.y) / direction.y);
    const viewportTravel = Math.min(...edgeDistances.filter((candidate) => candidate >= 0));
    assert.equal(distance <= viewportTravel + 0.5, true, "The target center must be inside the preview-safe viewport.");
    const maximumGain = Math.min(Math.max(viewportWidth / 168, 2.1), 2.5);
    const previewTravelForFingerTravel = (fingerTravel) => {
        const rampProgress = Math.min(Math.max((fingerTravel - 7) / 64, 0), 1);
        const gainProgress = rampProgress * rampProgress * (3 - (2 * rampProgress));
        return fingerTravel * (1 + ((maximumGain - 1) * gainProgress));
    };
    let lower = 0;
    let upper = viewportTravel;
    for (let iteration = 0; iteration < 32; iteration += 1) {
        const middle = (lower + upper) / 2;
        if (previewTravelForFingerTravel(middle) < distance) {
            lower = middle;
        } else {
            upper = middle;
        }
    }
    const fingerTravel = (lower + upper) / 2;
    return {
        x: start.x + (direction.x * fingerTravel),
        y: start.y + (direction.y * fingerTravel),
    };
}

export async function editRackParameterValue(page, controlRole, editingValue) {
    await page.locator(`[data-role="${controlRole}"]`).click({ button: "right" });
    await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
    const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
    await sheet.locator('[data-role="rack-base-value-input"]').fill(String(editingValue));
    await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
    await sheet.waitFor({ state: "detached" });
}

export async function dispatchRackKnobPointerEvents(locator, events) {
    await locator.evaluate((element, pointerEvents) => {
        const art = element.querySelector(".rack-knob-art");
        if (!(element instanceof HTMLButtonElement) || !(art instanceof SVGElement)) {
            throw new Error("Expected a rack knob button and its SVG art.");
        }
        const bounds = art.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        for (const pointerEvent of pointerEvents) {
            // The shared parameter-gesture contract listens on window; the
            // bubbling element dispatch reaches it.
            element.dispatchEvent(new PointerEvent(pointerEvent.type, {
                bubbles: true,
                pointerId: pointerEvent.pointerId,
                pointerType: "mouse",
                button: 0,
                buttons: pointerEvent.buttons,
                clientX: centerX + (pointerEvent.deltaX ?? 0),
                clientY: centerY + (pointerEvent.deltaY ?? 0),
            }));
        }
    }, events);
}

export async function clickFilterGraphAt(page, normalizedX, normalizedY) {
    const graph = page.locator('[data-role="filter-response-graph"]');
    await graph.scrollIntoViewIfNeeded();
    const box = await graph.boundingBox();

    if (!box) {
        throw new Error("Expected filter response graph bounding box.");
    }

    const targetX = box.x + (box.width * normalizedX);
    const targetY = box.y + (box.height * normalizedY);

    await page.mouse.click(targetX, targetY);
}

export async function dragFilterHandleBy(page, deltaX, deltaY) {
    const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();

    if (!box) {
        throw new Error("Expected filter response handle bounding box.");
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

export async function dragEnvelopeHandleBy(page, dataRole, deltaX, deltaY) {
    const handle = page.locator(`[data-role="${dataRole}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();

    if (!box) {
        throw new Error(`Expected envelope handle bounding box for ${dataRole}.`);
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

export async function dragLocatorBy(page, locator, deltaX, deltaY) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();

    if (!box) {
        throw new Error("Expected locator bounding box.");
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

export async function choosePrototypeSelectOption(page, buttonLabel, optionLabel) {
    await page.getByRole("button", { name: buttonLabel }).click();
    await page.getByRole("button", { name: `${buttonLabel} ${optionLabel}` }).click();
}

export async function waitForHarnessSnapshot(page, description, predicate, {
    attempts = 80,
    delayMs = 50,
} = {}) {
    let lastSnapshot = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastSnapshot = await getHarnessSnapshot(page);
        if (predicate(lastSnapshot)) {
            return lastSnapshot;
        }
        await page.waitForTimeout(delayMs);
    }

    const modulationState = lastSnapshot ? readStoredModulationState(lastSnapshot) : null;
    throw new Error(`Timed out waiting for ${description}. Last snapshot: ${JSON.stringify({
        routes: modulationState ? routeSummaries(modulationState.routes) : null,
        articulations: lastSnapshot ? readStoredArticulationEditorState(lastSnapshot) : null,
        sentMessages: compactRuntimeMessages(lastSnapshot?.sentMessages ?? []),
        runtimeAcks: (lastSnapshot?.endpointMessages ?? [])
            .filter(({ endpointID }) => endpointID === "runtimeInstallAck")
            .slice(-8),
        diagnostics: page.__cosimoDiagnostics ?? [],
    })}`);
}

export async function waitForPageValue(page, description, readValue, predicate, {
    attempts = 80,
    delayMs = 50,
} = {}) {
    let lastValue = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastValue = await page.evaluate(readValue);
        if (predicate(lastValue)) {
            return lastValue;
        }
        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}`);
}

export async function waitForReactFrames(page, frameCount = 2) {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
}

export async function readVisibleHarnessParameterEndpointIDs(page) {
    return page.evaluate(() => {
        const inputs = window.__COSIMO_DESKTOP_HARNESS__?.patchConnection?.status?.details?.inputs;

        if (!Array.isArray(inputs)) {
            throw new Error("Harness status inputs are unavailable.");
        }

        return inputs
            .filter((input) => input
                && typeof input === "object"
                && input.purpose === "parameter"
                && !(input.annotation && typeof input.annotation === "object" && input.annotation.hidden === true))
            .map((input) => input.endpointID)
            .sort((left, right) => String(left).localeCompare(String(right)));
    });
}

export async function clickPresetBarAction(page, action) {
    await page.waitForFunction((nextAction) => {
        const button = document
            .querySelector("cosimo-preset-bar")
            ?.shadowRoot
            ?.querySelector(`[data-action="${nextAction}"]`);
        return button instanceof HTMLButtonElement && !button.disabled;
    }, action);

    await page.evaluate((nextAction) => {
        const button = document
            .querySelector("cosimo-preset-bar")
            ?.shadowRoot
            ?.querySelector(`[data-action="${nextAction}"]`);

        if (!(button instanceof HTMLButtonElement)) {
            throw new Error(`Missing preset bar action ${nextAction}.`);
        }

        button.click();
    }, action);
}

export async function saveSynthPresetAs(page, label) {
    await clickPresetBarAction(page, "save-as");
    await page.waitForFunction(() => {
        const overlay = document
            .querySelector("cosimo-preset-bar")
            ?.shadowRoot
            ?.querySelector('[data-el="dialog-overlay"]');
        return overlay instanceof HTMLElement && overlay.classList.contains("open");
    });

    await page.evaluate((nextLabel) => {
        const shadowRoot = document.querySelector("cosimo-preset-bar")?.shadowRoot;
        const input = shadowRoot?.querySelector('[data-el="dialog-input"]');
        const confirm = shadowRoot?.querySelector('[data-action="dialog-confirm"]');

        if (!(input instanceof HTMLInputElement) || !(confirm instanceof HTMLButtonElement)) {
            throw new Error("Preset save dialog controls are missing.");
        }

        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

        if (!valueSetter) {
            throw new Error("Expected HTMLInputElement.prototype.value setter.");
        }

        valueSetter.call(input, nextLabel);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        confirm.click();
    }, label);
}

export async function waitForPresetBarDirtyState(page, dirty) {
    await page.waitForFunction((expectedDirty) => {
        const shadowRoot = document.querySelector("cosimo-preset-bar")?.shadowRoot;
        const dirtyDot = shadowRoot?.querySelector('[data-el="dirty-dot"]');
        const revertButton = shadowRoot?.querySelector('[data-action="revert"]');
        return dirtyDot instanceof HTMLElement
            && revertButton instanceof HTMLButtonElement
            && dirtyDot.classList.contains("visible") === expectedDirty
            && revertButton.disabled !== expectedDirty;
    }, dirty);
}

export async function dragArticulationCardToLane(page, articulationId, lane, targetPosition, {
    afterDragOver = null,
} = {}) {
    const card = page.locator(`[data-role="articulation-card"][data-articulation-id="${articulationId}"]`);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer });
    await lane.dispatchEvent("dragover", { dataTransfer, clientX: targetPosition.x, clientY: targetPosition.y });
    if (typeof afterDragOver === "function") {
        await afterDragOver();
    }
    await lane.dispatchEvent("drop", { dataTransfer, clientX: targetPosition.x, clientY: targetPosition.y });
    await dataTransfer.dispose();
}

export async function previewArticulationCardDragOver(page, articulationId, lane, targetPosition) {
    const card = page.locator(`[data-role="articulation-card"][data-articulation-id="${articulationId}"]`);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer });
    await lane.dispatchEvent("dragover", {
        dataTransfer,
        clientX: targetPosition.x,
        clientY: targetPosition.y,
    });
    const previewOperation = await page.locator('[data-role="articulation-placement-preview"]').getAttribute("data-operation");
    await dataTransfer.dispose();

    return previewOperation;
}

export async function readDesktopRangeSegments(page) {
    return page.locator('[data-role="articulation-range-segment"]').evaluateAll((segments) => (
        segments.map((segment) => ({
            articulationId: segment.getAttribute("data-articulation-id"),
            min: Number(segment.getAttribute("data-range-min")),
            max: Number(segment.getAttribute("data-range-max")),
            isPreview: segment.getAttribute("data-preview") === "true",
            isPreviewAffected: segment.getAttribute("data-preview-affected") === "true",
            text: segment.innerText.replace(/\s+/g, " ").trim(),
        }))
    ));
}

export async function readDesktopRangeViewport(page) {
    const lane = page.locator('[data-role="articulation-range-lane"]').first();
    return lane.evaluate((element) => ({
        index: Number(element.getAttribute("data-viewport-index")),
        min: Number(element.getAttribute("data-viewport-min")),
        max: Number(element.getAttribute("data-viewport-max")),
        heldValue: element.getAttribute("data-held-value"),
    }));
}

/** The pre-T7 resident-eight document, serialized as stored lane.v2. */
export function legacyEightLaneDocJson() {
    return serializeLaneStateV2(upgradeLaneStateV1(createDefaultLaneState()));
}

export async function openHarnessPage({
    beforeGoto = null,
    laneDoc = "legacy",
} = {}) {
    const page = await browser.newPage({
        // The segmented-panel slide honors prefers-reduced-motion; tests run
        // reduced by default so panel switches are instant and never overlay
        // a transition ghost. The one transition-proof test opts back out via
        // page.emulateMedia({ reducedMotion: "no-preference" }).
        reducedMotion: "reduce",
    });
    const diagnostics = [];
    page.__cosimoDiagnostics = diagnostics;
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
    });

    // The fresh default became the STARTER TRIO (T7), while these suites were
    // written against the resident eight: the harness opens on a seeded
    // legacy stored document by default. Pass laneDoc: "fresh" to exercise
    // the true fresh-instrument default, or a serialized doc to seed it.
    if (laneDoc !== "fresh") {
        const serialized = laneDoc === "legacy" ? legacyEightLaneDocJson() : laneDoc;
        await page.addInitScript((value) => {
            const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
            window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                ...initial,
                storedState: { ...initial.storedState, "lane.v1": value },
            };
        }, serialized);
    }

    if (typeof beforeGoto === "function") {
        await beforeGoto(page);
    }

    await page.goto(server.baseUrl, { waitUntil: "commit" });
    try {
        await waitForHarnessReady(page);
    } catch (cause) {
        const renderedState = await page.evaluate(() => (
            window.__COSIMO_DESKTOP_HARNESS__?.getRenderedState?.() ?? null
        ));
        throw new Error(
            `Desktop harness did not render. State: ${JSON.stringify(renderedState)}. ${diagnostics.join(" | ")}`,
            { cause },
        );
    }
    return page;
}

export async function showVoiceControls(page) {
    await page.getByRole("button", { name: "Voice" }).click();
    await page.locator('[aria-label="Glide"]').waitFor({ state: "visible" });
}

export async function openBuiltDesktopBundlePage({
    beforeGoto = null,
} = {}) {
    const page = await browser.newPage();

    if (typeof beforeGoto === "function") {
        await beforeGoto(page);
    }

    await page.goto(builtBundleServer.baseUrl, { waitUntil: "domcontentloaded" });
    await page.setContent(`
        <!doctype html>
        <html>
            <body style="margin:0;background:#02040b;">
                <div id="mount" style="width:100vw;height:100vh;"></div>
            </body>
        </html>
    `);

    await page.evaluate(async () => {
        class TestPianoKeyboard extends HTMLElement {
            notes = [];
            naturalWidth = 22;
            accidentalWidth = 13;
            debug = {
                attachCalls: [],
                detachCount: 0,
            };

            handleExternalMIDI() {}
            handleKey() {}
            allNotesOff() {}
            attachToPatchConnection(_patchConnection, endpointID) {
                this.debug.attachCalls.push({ endpointID });
            }
            detachPatchConnection() {
                this.debug.detachCount += 1;
            }
            refreshHTML() {}
            bindRenderedTouchHandlers() {}
            refreshActiveNoteElements() {}
        }

        const runtimeState = {
            dspSessionId: 1,
            desiredTableIndex: 0,
            desiredIntentSerial: 1,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        };
        const parameterValues = new Map([
            ["oscAWavetablePosition", 0.28],
            ["oscAWavetableSelect", 0],
            ["playMode", 0],
            ["glideTime", 0.15],
        ]);
        const resourceReads = [];
        const sentMessages = [];
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const addMapListener = (map, key, listener) => {
            const listeners = map.get(key) ?? new Set();
            listeners.add(listener);
            map.set(key, listeners);
        };
        const emitEndpoint = (endpointID, value) => {
            endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
        };

        const patchConnection = {
            utilities: {
                PianoKeyboard: TestPianoKeyboard,
                ParameterControls: {},
            },
            getResourceAddress(path) {
                const normalizedPath = path.startsWith("/") ? path : `/${path}`;
                return new URL(normalizedPath, window.location.href).toString();
            },
            addParameterListener(endpointID, listener) {
                addMapListener(parameterListeners, endpointID, listener);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    const value = parameterValues.get(endpointID) ?? 0;
                    parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
                });
            },
            sendEventOrValue(endpointID, value) {
                sentMessages.push({ endpointID, value });
                parameterValues.set(endpointID, value);
                parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

                if (endpointID === "runtimeSyncRequest") {
                    emitEndpoint("runtimeState", runtimeState);
                }
            },
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            addEndpointListener(endpointID, listener) {
                addMapListener(endpointListeners, endpointID, listener);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            addStatusListener(listener) {
                statusListeners.add(listener);
            },
            removeStatusListener(listener) {
                statusListeners.delete(listener);
            },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    statusListeners.forEach((listener) => listener({ details: { inputs: [] } }));
                });
            },
            addStoredStateValueListener(listener) {
                storedStateListeners.add(listener);
            },
            removeStoredStateValueListener(listener) {
                storedStateListeners.delete(listener);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({}));
            },
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    storedStateListeners.forEach((listener) => listener({ key, value: undefined }));
                });
            },
        };

        const createPatchView = (await import("/patch_gui/desktop/index.js")).default;
        const {
            createStoredStateRuntimeMirror,
        } = await import("/patch_gui/stored-state-runtime-mirror.js");
        const {
            MODULATION_STATE_KEY,
            buildModulationRuntimeEvents,
            deserializeModulationState,
        } = await import("/patch_gui/modulation.js");
        const modulationRuntimeMirror = createStoredStateRuntimeMirror(patchConnection, {
            stateKey: MODULATION_STATE_KEY,
            runtimeEndpointDependencies: [{
                endpointID: "runtimeState",
                required: true,
                mapValue: (value) => Number(value?.dspSessionId) || 0,
            }],
            applyDefaultRuntimeStateWhenMissing: true,
            deserializeStoredState: deserializeModulationState,
            buildRuntimeEvents: ({ state }) => buildModulationRuntimeEvents(state),
        });
        modulationRuntimeMirror.start();
        const patchView = await createPatchView(patchConnection);
        const mountPoint = document.getElementById("mount");

        if (!mountPoint) {
            throw new Error("Built desktop bundle mount point is missing.");
        }

        window.__COSIMO_BUILT_DESKTOP_DEBUG__ = {
            getSnapshot() {
                return {
                    sentMessages: sentMessages.map(({ endpointID, value }) => ({ endpointID, value })),
                    keyboardDebug: document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                        ?.querySelector(".keyboard")?.debug ?? null,
                };
            },
        };

        mountPoint.replaceChildren(patchView);
    });

    return page;
}

export async function openDesktopEntryPageWithInjectedResourceClient() {
    const page = await browser.newPage();

    await page.goto(server.baseUrl, { waitUntil: "domcontentloaded" });
    await page.setContent(`
        <!doctype html>
        <html>
            <body style="margin:0;background:#02040b;">
                <div id="mount" style="width:100vw;height:100vh;"></div>
            </body>
        </html>
    `);

    await page.evaluate(async (samplesPerFrame) => {
        class TestPianoKeyboard extends HTMLElement {
            handleExternalMIDI() {}
            handleKey() {}
            allNotesOff() {}
            attachToPatchConnection() {}
            detachPatchConnection() {}
            refreshHTML() {}
            bindRenderedTouchHandlers() {}
            refreshActiveNoteElements() {}
        }

        const resourceSamples = new Float32Array(samplesPerFrame);
        for (let index = 0; index < resourceSamples.length; index += 1) {
            resourceSamples[index] = Math.sin((index / resourceSamples.length) * Math.PI * 2);
        }

        const parameterValues = new Map([
            ["oscAWavetablePosition", 0.28],
            ["oscAWavetableSelect", 0],
            ["playMode", 0],
            ["glideTime", 0.15],
        ]);
        const resourceReads = [];
        const sentMessages = [];
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const addMapListener = (map, key, listener) => {
            const listeners = map.get(key) ?? new Set();
            listeners.add(listener);
            map.set(key, listeners);
        };
        const emitEndpoint = (endpointID, value) => {
            endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
        };
        const runtimeState = {
            desiredTableIndex: 0,
            desiredIntentSerial: 1,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        };

        const patchConnection = {
            utilities: {
                PianoKeyboard: TestPianoKeyboard,
                ParameterControls: {},
            },
            getResourceAddress() {
                throw new Error("patchConnection resource access should not be used when an explicit resourceClient is injected");
            },
            addParameterListener(endpointID, listener) {
                addMapListener(parameterListeners, endpointID, listener);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    const value = parameterValues.get(endpointID) ?? 0;
                    parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
                });
            },
            sendEventOrValue(endpointID, value) {
                sentMessages.push({ endpointID, value });
                parameterValues.set(endpointID, value);
                parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

                if (endpointID === "runtimeSyncRequest") {
                    emitEndpoint("runtimeState", runtimeState);
                }
            },
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            addEndpointListener(endpointID, listener) {
                addMapListener(endpointListeners, endpointID, listener);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            addStatusListener(listener) {
                statusListeners.add(listener);
            },
            removeStatusListener(listener) {
                statusListeners.delete(listener);
            },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    statusListeners.forEach((listener) => listener({ details: { inputs: [] } }));
                });
            },
            addStoredStateValueListener(listener) {
                storedStateListeners.add(listener);
            },
            removeStoredStateValueListener(listener) {
                storedStateListeners.delete(listener);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({}));
            },
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    storedStateListeners.forEach((listener) => listener({ key, value: undefined }));
                });
            },
        };

        const resourceClient = {
            async readText(path) {
                resourceReads.push({ method: "readText", path });
                return JSON.stringify(await this.readJSON(path));
            },
            async readJSON(path) {
                resourceReads.push({ method: "readJSON", path });
                if (path !== "assets/factory-bank-catalog.json") {
                    throw new Error(`Unexpected JSON resource path: ${path}`);
                }

                return {
                    tables: [{
                        tableId: "explicit-client-table",
                        name: "Explicit Client Table",
                        frameCount: 1,
                        sourceWav: "assets/factory_sources/explicit-client.wav",
                    }],
                };
            },
            async readBytes(path) {
                resourceReads.push({ method: "readBytes", path });
                if (path !== "assets/factory-bank-catalog.json") {
                    throw new Error(`Unexpected byte resource path: ${path}`);
                }

                return new TextEncoder().encode(JSON.stringify(await this.readJSON(path)));
            },
            async readAudio(path) {
                resourceReads.push({ method: "readAudio", path });
                if (path !== "assets/factory_sources/explicit-client.wav") {
                    throw new Error(`Unexpected audio resource path: ${path}`);
                }

                return {
                    sampleRate: 44100,
                    samples: resourceSamples,
                };
            },
            getURL() {
                return null;
            },
        };

        const { createDesktopPatchView } = await import("/ui/desktop/patch-view-entry.tsx");
        const mountPoint = document.getElementById("mount");

        if (!mountPoint) {
            throw new Error("Explicit resource-client mount point is missing.");
        }

        window.__COSIMO_EXPLICIT_RESOURCE_CLIENT_DEBUG__ = {
            getSnapshot() {
                return {
                    resourceReads: resourceReads.slice(),
                    sentMessages: sentMessages.map(({ endpointID, value }) => ({ endpointID, value })),
                };
            },
        };

        mountPoint.replaceChildren(createDesktopPatchView(patchConnection, { resourceClient }));
    }, TEST_SAMPLES_PER_FRAME);

    return page;
}

before(async () => {
    server = await startDesktopHarnessServer();
    builtBundleServer = await startStaticRepoServer();
    browser = await chromium.launch({
        headless: true,
    });
});

after(async () => {
    await browser?.close();
    await builtBundleServer?.stop();
    await server?.stop();
});

export function assertLatestMsegBufferMatchesStoredShape(snapshot) {
    const storedShape = readStoredMsegShape(snapshot);
    const expectedBuffer = Array.from(renderMsegShape(storedShape));
    const lastBufferMessage = [...snapshot.sentMessages]
        .reverse()
        .find(({ endpointID, value }) => (
            endpointID === "modulationMsegBuffer"
            && Number(value?.slot) === 1
            && Number(value?.shapeIndex ?? 0) === 0
        ));

    assert.ok(lastBufferMessage, "Expected a modulationMsegBuffer upload for slot 1.");
    assert.deepEqual({
        slot: lastBufferMessage.value.slot,
        shapeIndex: lastBufferMessage.value.shapeIndex,
        buffer: lastBufferMessage.value.buffer,
    }, {
        slot: 1,
        shapeIndex: 0,
        buffer: expectedBuffer,
    });
    assert.equal(lastBufferMessage.value.dspSessionId, snapshot.runtimeState.dspSessionId);
    assert.equal(Number.isSafeInteger(lastBufferMessage.value.deliverySerial), true);
    assert.equal(lastBufferMessage.value.deliverySerial > 0, true);
}

export async function beginRackReorderWithoutPointerCapture(page, {
    pointerId,
    targetEffectID = null,
}) {
    await page.evaluate(({ pointerId: browserPointerId, targetEffectID: browserTargetEffectID }) => {
        const list = document.querySelector('[data-role="rack-module-list"]');
        const station = document.querySelector('[data-role="rack-station-reverb"]');
        const target = browserTargetEffectID === null
            ? null
            : document.querySelector(`[data-role="rack-module-${browserTargetEffectID}"]`);
        if (!(list instanceof HTMLElement) || !(station instanceof HTMLElement)) {
            throw new Error("Expected rack reorder elements.");
        }
        if (browserTargetEffectID !== null && !(target instanceof HTMLElement)) {
            throw new Error(`Expected ${browserTargetEffectID} rack target.`);
        }

        Object.defineProperty(list, "setPointerCapture", {
            configurable: true,
            value() {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            },
        });
        // The station arms the reorder once a move crosses the lift
        // threshold; a second move on the list drives the preview.
        const stationBounds = station.getBoundingClientRect();
        const stationCenterX = stationBounds.left + (stationBounds.width / 2);
        const stationCenterY = stationBounds.top + (stationBounds.height / 2);
        station.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: browserPointerId,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: stationCenterX,
            clientY: stationCenterY,
        }));
        station.dispatchEvent(new PointerEvent("pointermove", {
            bubbles: true,
            pointerId: browserPointerId,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: stationCenterX,
            clientY: stationCenterY + 12,
        }));
        if (target instanceof HTMLElement) {
            const targetBounds = target.getBoundingClientRect();
            list.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                pointerId: browserPointerId,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                clientX: targetBounds.left + (targetBounds.width / 2),
                clientY: targetBounds.top + (targetBounds.height / 2),
            }));
        }
    }, { pointerId, targetEffectID });
}

export async function endRackReorderWithoutPointerCapture(page, pointerId) {
    await page.evaluate((browserPointerId) => {
        const list = document.querySelector('[data-role="rack-module-list"]');
        if (!(list instanceof HTMLElement)) {
            throw new Error("Expected rack module list.");
        }
        list.dispatchEvent(new PointerEvent("pointerup", {
            bubbles: true,
            pointerId: browserPointerId,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
        }));
    }, pointerId);
}

export function rectsIntersect(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

export function rectContains(outer, inner, tolerance = 0.5) {
    return inner.left >= outer.left - tolerance
        && inner.right <= outer.right + tolerance
        && inner.top >= outer.top - tolerance
        && inner.bottom <= outer.bottom + tolerance;
}

export async function readGlobalModRailGeometry(page) {
    return await page.evaluate(() => {
        const rectOf = (element) => {
            if (!element) {
                return null;
            }
            const bounds = element.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
        };
        const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
        if (!(rail instanceof HTMLElement)) {
            return null;
        }
        const body = rail.querySelector('[data-role="mobile-global-mod-rail-body"]');
        return {
            rail: rectOf(rail),
            body: rectOf(body),
            tab: rectOf(rail.querySelector('[data-role="mobile-global-mod-rail-tab"]')),
            art: rectOf(rail.querySelector('[data-role="mobile-global-mod-rail-selected"] .rack-mod-art')),
            routeCount: rectOf(rail.querySelector('[data-role="mobile-global-mod-rail-route-count"]')),
            chevron: rectOf(rail.querySelector(".mobile-global-mod-rail-chevron")),
            drawer: rectOf(rail.querySelector('[data-role="mobile-global-mod-rail-drawer"]')),
            track: rectOf(rail.querySelector('[data-role="rack-mod-source-track"]')),
            amount: rectOf(rail.querySelector(".rack-mod-amount")),
            keyboard: rectOf(document.querySelector('[data-role="sticky-keyboard"]')),
            transitionProperty: getComputedStyle(rail).transitionProperty,
            viewportWidth: window.innerWidth,
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
    });
}

export {
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
    ARTICULATIONS_V4_STATE_KEY,
    parseArticulationsV4,
    deserializeMsegShape,
    renderMsegShape,
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    deserializeModulationState,
    normalizeModulationState,
    getModulationArticulationCellIndex,
    getModulationRuntimeCell,
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
};

/**
 * The wire location of one effect parameter since the B3 parameter cut:
 * knob edits ride laneSlotParamValue {slotId, paramIndex, ...} instead of a
 * per-parameter host endpoint.
 */
export function laneParamWireLocation(endpointID, ordinal = 0) {
    const descriptor = getRackParameterDescriptor(endpointID);
    if (descriptor === null) {
        throw new Error(`Not a lane parameter endpoint: ${endpointID}`);
    }
    const deviceType = EFFECT_ID_TO_LANE_TYPE[descriptor.effectId];
    return {
        slotId: getLaneSlotId(deviceType, ordinal),
        paramIndex: getLaneSlotParamIndex(deviceType, endpointID),
    };
}

/** Predicate for one sent lane field upload, optionally matching its value. */
export function isLaneParamSend(message, endpointID, expectedValue, tolerance = 1e-6, ordinal = 0) {
    if (message.endpointID !== "laneSlotParamValue") {
        return false;
    }
    const location = laneParamWireLocation(endpointID, ordinal);
    if (Number(message.value?.slotId) !== location.slotId
            || Number(message.value?.paramIndex) !== location.paramIndex) {
        return false;
    }
    return expectedValue === undefined
        || Math.abs(Number(message.value?.value) - expectedValue) <= tolerance;
}

void RACK_EFFECT_ORDER;
