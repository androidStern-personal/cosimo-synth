import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import {
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
} from "../patch_gui/articulations.js";
import {
    ARTICULATIONS_V4_STATE_KEY,
    parseArticulationsV4,
} from "../patch_gui/articulation-image.js";
import { deserializeMsegShape, renderMsegShape } from "../patch_gui/mseg.js";
import {
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    deserializeModulationState,
    normalizeModulationState,
} from "../patch_gui/modulation.js";
import {
    getModulationArticulationCellIndex,
    getModulationRuntimeCell,
} from "../patch_gui/modulation-runtime-program.js";

import {
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
} from "./helpers/desktop_harness_browser.mjs";

let server;
let builtBundleServer;
let browser;
const TEST_SAMPLES_PER_FRAME = 2048;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
const EFFECT_PRESETS_V2_STATE_KEY = "effects.presets.v2";
const SYNTH_PRESET_EFFECT_ID = "cosimo-synth";
const ARTICULATION_STATE_KEY = ARTICULATIONS_V4_STATE_KEY;
const RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY = ["synth", "preset" + "Baseline" + "Snapshot", "v1"].join(".");

function expectedMsegPreviewProgressClipWidth(previewState, progress) {
    const plotWidth = Math.max(1, previewState.width - (MSEG_PREVIEW_HORIZONTAL_PADDING_PX * 2));
    return plotWidth * progress;
}

function buildShortMidi(status, noteNumber, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

function readStoredModulationState(snapshot) {
    const rawState = snapshot.storedState[MODULATION_STATE_KEY];
    return rawState === undefined
        ? createDefaultModulationState()
        : deserializeModulationState(rawState);
}

function readStoredArticulationEditorState(snapshot) {
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

function editorBankToStoredArticulations(bankValue) {
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

function readEffectPresetState(snapshot) {
    return JSON.parse(String(snapshot.storedState[EFFECT_PRESETS_V2_STATE_KEY]));
}

function containsRetiredSynthPresetBaselineKey(snapshot) {
    return Object.prototype.hasOwnProperty.call(snapshot.storedState, RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY);
}

function readStoredMsegShape(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].shapeA;
}

function readStoredMsegPlayback(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].playback;
}

function readStoredRouteAmount(snapshot, sourceSlot, targetKind) {
    const route = readStoredModulationState(snapshot).routes.find((candidate) => (
        candidate.enabled !== false
        && candidate.sourceKind === "mseg"
        && candidate.sourceSlot === sourceSlot
        && candidate.targetKind === targetKind
    ));

    return Number(route?.amount ?? 0);
}

function routeSummary(route) {
    return {
        enabled: route.enabled,
        sourceKind: route.sourceKind,
        sourceSlot: route.sourceSlot,
        polarity: route.polarity,
        targetKind: route.targetKind,
        amount: route.amount,
    };
}

function routeSummaries(routes) {
    return routes.map((route) => routeSummary(route));
}

async function ensureFirstModulationRoute(page) {
    if (readStoredModulationState(await getHarnessSnapshot(page)).routes.length === 0) {
        await page.getByRole("button", { name: "Add route" }).click();
    }
    return waitForHarnessSnapshot(
        page,
        "first modulation route",
        (snapshot) => readStoredModulationState(snapshot).routes.length > 0,
    );
}

const RUNTIME_PATH_FIELDS = {
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

const RUNTIME_PATH_KINDS = {
    voice: 1,
    macroVoice: 2,
    voiceRack: 3,
    macroRack: 4,
};

function latestRuntimeProgram(snapshot) {
    return [...snapshot.sentMessages]
        .reverse()
        .find(({ endpointID }) => endpointID === "modulationProgram")
        ?.value ?? null;
}

function readRuntimeProgramRoute(snapshot, route) {
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

function hasRuntimeAmount(snapshot, route, expectedAmount, tolerance = 1e-9) {
    const cell = getModulationRuntimeCell(route);
    return snapshot.sentMessages.some(({ endpointID, value }) => (
        endpointID === "modulationAmount"
        && Number(value?.pathKind) === RUNTIME_PATH_KINDS[cell.path]
        && Number(value?.cellIndex) === cell.cellIndex
        && Math.abs(Number(value?.amount) - expectedAmount) <= tolerance
    ));
}

function compactRuntimeMessages(messages) {
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

function buildDistortionScopeFixture({ amplitude = 1.62, sampleCount = 256 } = {}) {
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

function buildDistortionHistoryFixture({ amplitude = 1.7, binCount = 160 } = {}) {
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

async function dispatchInputValueChange(locator, nextValue) {
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

async function selectRackEffect(page, effectId) {
    await page.click(`[data-role="rack-quick-${effectId}"]`);
    await page.waitForSelector(`[data-role="rack-editor-${effectId}"]`);
}

async function expandGlobalModRail(page) {
    const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
    await grip.waitFor();
    if (await grip.getAttribute("aria-expanded") !== "true") {
        await grip.click({ position: { x: 28, y: 12 } });
    }
    await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
    await page.waitForTimeout(220);
}

async function collapseGlobalModRail(page) {
    const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
    await grip.waitFor();
    if (await grip.getAttribute("aria-expanded") === "true") {
        await grip.click({ position: { x: 28, y: 12 } });
    }
    await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="false"]').waitFor();
    await page.waitForTimeout(240);
}

function touchPointForModSourcePreviewTarget(start, target, viewportWidth, viewportHeight = 852) {
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

async function editRackParameterValue(page, controlRole, editingValue) {
    await page.locator(`[data-role="${controlRole}"]`).click({ button: "right" });
    await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
    const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
    await sheet.locator('[data-role="rack-base-value-input"]').fill(String(editingValue));
    await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
    await sheet.waitFor({ state: "detached" });
}

async function dispatchRackKnobPointerEvents(locator, events) {
    await locator.evaluate((element, pointerEvents) => {
        const art = element.querySelector(".rack-knob-art");
        if (!(element instanceof HTMLButtonElement) || !(art instanceof SVGElement)) {
            throw new Error("Expected a rack knob button and its SVG art.");
        }
        const bounds = art.getBoundingClientRect();
        const clientX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        for (const pointerEvent of pointerEvents) {
            element.dispatchEvent(new PointerEvent(pointerEvent.type, {
                bubbles: true,
                pointerId: pointerEvent.pointerId,
                pointerType: "mouse",
                button: 0,
                buttons: pointerEvent.buttons,
                clientX,
                clientY: centerY + pointerEvent.deltaY,
            }));
        }
    }, events);
}

async function clickFilterGraphAt(page, normalizedX, normalizedY) {
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

async function dragFilterHandleBy(page, deltaX, deltaY) {
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

async function dragEnvelopeHandleBy(page, dataRole, deltaX, deltaY) {
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

async function dragLocatorBy(page, locator, deltaX, deltaY) {
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

async function choosePrototypeSelectOption(page, buttonLabel, optionLabel) {
    await page.getByRole("button", { name: buttonLabel }).click();
    await page.getByRole("button", { name: `${buttonLabel} ${optionLabel}` }).click();
}

async function waitForHarnessSnapshot(page, description, predicate, {
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

async function waitForPageValue(page, description, readValue, predicate, {
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

async function waitForReactFrames(page, frameCount = 2) {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
}

async function readVisibleHarnessParameterEndpointIDs(page) {
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

async function clickPresetBarAction(page, action) {
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

async function saveSynthPresetAs(page, label) {
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

async function waitForPresetBarDirtyState(page, dirty) {
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

async function dragArticulationCardToLane(page, articulationId, lane, targetPosition, {
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

async function previewArticulationCardDragOver(page, articulationId, lane, targetPosition) {
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

async function readDesktopRangeSegments(page) {
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

async function readDesktopRangeViewport(page) {
    const lane = page.locator('[data-role="articulation-range-lane"]').first();
    return lane.evaluate((element) => ({
        index: Number(element.getAttribute("data-viewport-index")),
        min: Number(element.getAttribute("data-viewport-min")),
        max: Number(element.getAttribute("data-viewport-max")),
        heldValue: element.getAttribute("data-held-value"),
    }));
}

async function openHarnessPage({
    beforeGoto = null,
} = {}) {
    const page = await browser.newPage();
    const diagnostics = [];
    page.__cosimoDiagnostics = diagnostics;
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
    });

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

async function showVoiceControls(page) {
    await page.getByRole("button", { name: "Voice" }).click();
    await page.locator('[aria-label="Glide"]').waitFor({ state: "visible" });
}

async function openBuiltDesktopBundlePage() {
    const page = await browser.newPage();

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

async function openDesktopEntryPageWithInjectedResourceClient() {
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

function assertLatestMsegBufferMatchesStoredShape(snapshot) {
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

test("desktop harness renders the real React patch view and requests runtime sync on boot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.title(), "Cosimo Desktop UI Harness");
        assert.equal(await page.locator("cosimo-desktop-react-view").count(), 1);
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        await page.waitForSelector("text=Ready");

        const snapshot = await getHarnessSnapshot(page);
        const runtimeSyncMessages = snapshot.sentMessages.filter(
            ({ endpointID }) => endpointID === "runtimeSyncRequest",
        );

        assert.equal(
            runtimeSyncMessages.some(({ value }) => value === 1),
            true,
            "The UI must request its initial runtime presentation state.",
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"), true);
    } finally {
        await page.close();
    }
});

test("desktop Vite harness installs React Grab and registers the official MCP plugin in dev mode", async () => {
    const page = await openHarnessPage();

    try {
        const reactGrabState = await page.evaluate(() => {
            const api = window.__REACT_GRAB__;

            if (!api || typeof api !== "object") {
                return null;
            }

            return {
                hasRegisterPlugin: typeof api.registerPlugin === "function",
                hasGetPlugins: typeof api.getPlugins === "function",
                plugins: typeof api.getPlugins === "function" ? api.getPlugins() : null,
            };
        });

        assert.equal(reactGrabState?.hasRegisterPlugin, true);
        assert.equal(reactGrabState?.hasGetPlugins, true);
        assert.equal(Array.isArray(reactGrabState?.plugins), true);
        assert.equal(reactGrabState.plugins.includes("mcp"), true);
    } finally {
        await page.close();
    }
});

test("built desktop bundle renders the stage without duplicating worker-owned runtime installation", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");
        await page.waitForSelector("text=Ready");
        assert.equal(
            await page.evaluate(() => Boolean(document.querySelector("cosimo-desktop-react-view")?.shadowRoot)),
            true,
        );
        assert.equal(
            await page.evaluate(() => "__REACT_GRAB__" in window),
            false,
        );
        assert.equal(await page.locator('[data-role="curve-lab-toggle"]').count(), 0);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("#mount > pre").count(), 0);

        const builtBundleSnapshot = await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot());
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"),
            false,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
        );
        assert.deepEqual(builtBundleSnapshot.keyboardDebug?.attachCalls ?? [], [{ endpointID: "midiIn" }]);
    } finally {
        await page.close();
    }
});

test("built desktop bundle renders visible distortion dual-ring knobs inside the shadow DOM", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");
        await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const selectDrive = host?.shadowRoot?.querySelector('[data-role="rack-quick-drive"]');

            if (!(selectDrive instanceof HTMLButtonElement)) {
                throw new Error("Expected the Distortion rack selector in the built bundle.");
            }

            selectDrive.click();
        });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot?.querySelector('[data-role="rack-editor-drive"]')
            instanceof HTMLElement
        ));

        const knobState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot;

            if (!root) {
                return null;
            }

            return [
                ["distortion-drive-field", "distortion-drive-handle"],
                ["distortion-knee-field", "distortion-knee-handle"],
                ["distortion-mix-field", "distortion-mix-handle"],
            ].map(([controlRole, handleRole]) => {
                const control = root.querySelector(`[data-role="${controlRole}"]`);
                const art = control?.querySelector(".rack-knob-art");
                const handle = control?.querySelector(`[data-role="${handleRole}"]`);
                const defaultMarker = control?.querySelector(".rack-knob-default-marker");

                if (!(control instanceof HTMLButtonElement)
                    || !(art instanceof SVGSVGElement)
                    || !(handle instanceof SVGCircleElement)
                    || !(defaultMarker instanceof SVGCircleElement)) {
                    return { controlRole, exists: false };
                }

                const artRect = art.getBoundingClientRect();
                const handleStyle = getComputedStyle(handle);

                return {
                    controlRole,
                    exists: true,
                    artWidth: artRect.width,
                    artHeight: artRect.height,
                    defaultMarkerFill: getComputedStyle(defaultMarker).fill,
                    handleFill: handleStyle.fill,
                    handleStroke: handleStyle.stroke,
                    opacity: handleStyle.opacity,
                    visibility: handleStyle.visibility,
                };
            });
        });

        assert.notEqual(knobState, null);

        for (const knob of knobState) {
            assert.equal(knob.exists, true, `${knob.controlRole} should render a complete dual-ring knob`);
            assert.equal(knob.artWidth >= 40, true, `${knob.controlRole} should have visible knob art: ${JSON.stringify(knob)}`);
            assert.equal(knob.artHeight >= 40, true, `${knob.controlRole} should have visible knob art: ${JSON.stringify(knob)}`);
            assert.notEqual(knob.handleFill, "none", `${knob.controlRole} should render a live value indicator`);
            assert.notEqual(knob.handleStroke, "none", `${knob.controlRole} should render a live indicator edge`);
            assert.notEqual(knob.defaultMarkerFill, "none", `${knob.controlRole} should render its fixed default marker`);
            assert.equal(knob.opacity, "1", `${knob.controlRole} should not be transparent`);
            assert.equal(knob.visibility, "visible", `${knob.controlRole} should not be hidden`);
        }
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab retunes the real filter resonance drag curve", async () => {
    const page = await openHarnessPage();

    try {
        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        assert.equal(await curveLabToggle.count(), 1);

        const popupPromise = page.waitForEvent("popup");
        await curveLabToggle.click();
        const curveLabPage = await popupPromise;
        await curveLabPage.waitForLoadState("domcontentloaded");
        await curveLabPage.waitForSelector('[data-role="curve-lab-panel"]');

        const linearFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-linear"]');
        await linearFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "linear"
        ));

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        let snapshot = await waitForHarnessSnapshot(
            page,
            "linear filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.3,
        );
        const linearDraggedQ = Number(snapshot.parameterValues.filterQ);

        const balancedPowerFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-balanced-power"]');
        await balancedPowerFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "balanced-power"
        ));

        const powerCoefficient = curveLabPage.locator('[data-role="curve-lab-coefficient-power"]');
        await dispatchInputValueChange(powerCoefficient, 3.8);
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "balanced-power"
                && Math.abs(Number(curve?.coefficients?.power) - 3.8) <= 0.001;
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        snapshot = await waitForHarnessSnapshot(
            page,
            "balanced power filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.12,
        );
        const curvedDraggedQ = Number(snapshot.parameterValues.filterQ);

        assert.ok(
            curvedDraggedQ < linearDraggedQ,
            `Expected the balanced power curve to move resonance less near the floor. Linear=${linearDraggedQ}, curved=${curvedDraggedQ}`,
        );

        const popupClose = new Promise((resolve) => curveLabPage.once("close", resolve));
        await curveLabPage.getByRole("button", { name: "Close", exact: true }).click();
        await popupClose;
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });
    } finally {
        await page.close();
    }
});

test("desktop filter resonance drag defaults to the locked sigmoid curve", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });

        const renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab uses the native desktop bridge when it is available", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(() => {
                window.__COSIMO_NATIVE_CURVE_LAB_TEST__ = {
                    openCalls: 0,
                    closeCalls: 0,
                    stateJSON: "",
                };

                window.cosimo_desktop_curve_lab_openWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls += 1;
                };

                window.cosimo_desktop_curve_lab_closeWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.closeCalls += 1;
                };

                window.cosimo_desktop_curve_lab_getState = async () => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON;

                window.cosimo_desktop_curve_lab_setState = async (nextState) => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = String(nextState);
                };
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            typeof window.__COSIMO_NATIVE_CURVE_LAB_TEST__?.stateJSON === "string"
            && window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON.length > 0
        ));

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = false;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForTimeout(50);
        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);

        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        await curveLabToggle.click();
        assert.equal(await page.evaluate(() => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls), 1);

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = true;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 9.2) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.31) <= 0.001;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 9.2) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop patch view scrolls vertically when the window is shorter than the full layout", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 1280, height: 720 });
        },
    });

    try {
        await page.waitForSelector("text=Filter");
        const initialMetrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            return {
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
                scrollTop: scrollRegion.scrollTop,
            };
        });

        assert.ok(
            initialMetrics.scrollHeight > initialMetrics.clientHeight,
            `Expected the desktop patch view to overflow vertically. Got ${JSON.stringify(initialMetrics)}`,
        );

        const scrolledMetrics = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            scrollRegion.scrollTop = scrollRegion.scrollHeight;
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));

            return {
                scrollTop: scrollRegion.scrollTop,
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
            };
        });

        assert.ok(
            scrolledMetrics.scrollTop > 0,
            `Expected the desktop patch view to accept vertical scrolling. Got ${JSON.stringify(scrolledMetrics)}`,
        );
    } finally {
        await page.close();
    }
});

test("desktop voice visuals stack full-width above the compact panel grid", async () => {
    const viewportCases = [
        { label: "narrow desktop", width: 775, height: 700 },
        { label: "standalone desktop", width: 976, height: 768 },
    ];

    for (const viewportCase of viewportCases) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
            },
        });

        try {
            await page.waitForSelector("text=Ready");
            await selectRackEffect(page, "drive");

            const metrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot ?? document;
            const rectOf = (selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing element: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    x: rect.x,
                    y: rect.y,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    padding: style.padding,
                };
            };

            const gridCardSelectors = [
                '[data-role="wavetable-card"]',
                '[data-role="filter-card"]',
                '[data-role="mseg-card"]',
                '[data-role="mod-matrix-card"]',
            ];
            const cards = gridCardSelectors.map((selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing grid card: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    role: element.getAttribute("data-role") ?? selector,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    hasSharedShell: element.getAttribute("data-layout-card") === "desktop-grid-card",
                };
            });

            return {
                cards,
                wavetable: rectOf(".cosimo-stage"),
                wavetableCanvas: rectOf(".cosimo-stage canvas"),
                wavetableTopControls: rectOf('[data-role="wavetable-stage-top-controls"]'),
                wavetableBottomControls: rectOf('[data-role="wavetable-stage-bottom-controls"]'),
                wavetableSelectChip: rectOf('[data-role="wavetable-select-chip"]'),
                wavetableFrameChip: rectOf('[data-role="wavetable-frame-chip"]'),
                warpControlCluster: rectOf('[data-role="warp-control-cluster"]'),
                warpModeControl: rectOf('[data-role="warp-mode-control"]'),
                wavetablePanField: rectOf('[data-role="wavetable-pan-field"]'),
                filterModeChip: rectOf('[data-role="filter-mode-chip"]'),
                filterAnalyzerChip: rectOf('[data-role="filter-analyzer-chip"]'),
                filterCutoffField: rectOf('[data-role="filter-cutoff-field"]'),
                filterResonanceField: rectOf('[data-role="filter-resonance-field"]'),
                distortionModeButton: rectOf('[data-role="distortion-mode-option-1"]'),
                filter: rectOf('[data-role="filter-card"]'),
                filterGraph: rectOf('[data-role="filter-response-graph"]'),
            };
            });

            assert.equal(metrics.cards.length, 4, `Expected the four compact desktop panels to be measured by name at ${viewportCase.label}.`);
            assert.deepEqual(
                metrics.cards.map((card) => card.hasSharedShell),
                Array.from({ length: metrics.cards.length }, () => true),
                `Expected the six main desktop panels to opt into the shared grid-card shell at ${viewportCase.label}.`,
            );
            assert.deepEqual(
                metrics.cards.map((card) => card.borderRadius),
                Array.from({ length: metrics.cards.length }, () => "14px"),
                `desktop grid panels should share the same compact shell radius instead of per-panel hero shells at ${viewportCase.label}`,
            );

            assert.equal(
                Math.abs(metrics.filter.width - metrics.wavetable.width) <= 1,
                true,
                `Expected the filter to match the full-width wavetable shell at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                Math.abs(metrics.filter.x - metrics.wavetable.x) <= 1,
                true,
                `Expected the filter to align beneath the wavetable at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                metrics.filter.y >= metrics.wavetable.bottom + 12,
                true,
                `Expected the filter to occupy its own row beneath the wavetable at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                metrics.wavetable.height >= 230,
                true,
                `Expected enough wavetable height to keep the graphic visible at ${viewportCase.label}: ${JSON.stringify(metrics.wavetable)}`,
            );

            const compactGridCards = metrics.cards.slice(2);
            const compactReferenceCard = compactGridCards[0];

            assert.equal(
                metrics.wavetable.width >= compactReferenceCard.width * 1.9,
                true,
                `Expected voice visualizations to span both compact-card columns at ${viewportCase.label}: ${JSON.stringify({ wavetable: metrics.wavetable, compactReferenceCard })}`,
            );

            for (const card of compactGridCards) {
                assert.equal(
                    Math.abs(card.width - compactReferenceCard.width) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} width to match the compact grid at ${viewportCase.label}: ${JSON.stringify({ card, compactReferenceCard })}`,
                );
                assert.equal(
                    Math.abs(card.height - compactReferenceCard.height) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} height to match the compact grid at ${viewportCase.label}: ${JSON.stringify({ card, compactReferenceCard })}`,
                );
            }

            assert.equal(
                metrics.wavetableTopControls.height <= 36,
                true,
                `Wavetable top controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableTopControls)}`,
            );
            assert.equal(
                metrics.wavetableBottomControls.height <= 34,
                true,
                `Wavetable bottom controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableBottomControls)}`,
            );
            for (const compactControl of [
                metrics.wavetableSelectChip,
                metrics.wavetableFrameChip,
                metrics.warpModeControl,
                metrics.filterModeChip,
                metrics.filterAnalyzerChip,
            ]) {
                assert.equal(
                    compactControl.height <= metrics.distortionModeButton.height + 6,
                    true,
                    `Expected top-row chip/control height to stay close to the compact distortion mode button at ${viewportCase.label}: ${JSON.stringify({ compactControl, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            for (const compactField of [
                metrics.wavetablePanField,
                metrics.filterCutoffField,
                metrics.filterResonanceField,
            ]) {
                assert.equal(
                    compactField.height <= metrics.distortionModeButton.height + 8,
                    true,
                    `Expected top-row number fields to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ compactField, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            assert.equal(
                metrics.warpControlCluster.height <= metrics.distortionModeButton.height + 8,
                true,
                `Expected the warp cluster to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ warpControlCluster: metrics.warpControlCluster, distortionModeButton: metrics.distortionModeButton })}`,
            );
            assert.equal(metrics.wavetableCanvas.width / metrics.wavetable.width >= 0.98, true);
            assert.equal(metrics.wavetableCanvas.height / metrics.wavetable.height >= 0.98, true);
            assert.equal(metrics.filterGraph.width / metrics.filter.width >= 0.94, true);
            assert.equal(metrics.filterGraph.height / metrics.filter.height >= 0.9, true);
        } finally {
            await page.close();
        }
    }
});

test("desktop custom-element wrapper honors an explicitly injected resource client", async () => {
    const page = await openDesktopEntryPageWithInjectedResourceClient();

    try {
        await page.waitForSelector("text=Ready");
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("text=Explicit Client Table").count() > 0, true);

        const snapshot = await page.evaluate(() => window.__COSIMO_EXPLICIT_RESOURCE_CLIENT_DEBUG__.getSnapshot());
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readJSON" && path === "assets/factory-bank-catalog.json"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readAudio" && path === "assets/factory_sources/explicit-client.wav"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.every(({ method, path }) =>
                (method === "readJSON" && path === "assets/factory-bank-catalog.json") ||
                (method === "readAudio" && path === "assets/factory_sources/explicit-client.wav")),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
    } finally {
        await page.close();
    }
});

test("desktop page only shows Retry Load for failures on the current desired wavetable", async () => {
    const page = await openHarnessPage();

    try {
        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 4,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        assert.equal(await page.getByRole("button", { name: "Retry Load" }).count(), 0);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces catalog load failures instead of going blank", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory-bank-catalog.json", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "catalog failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not load the factory bank.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces frame load failures instead of blanking the stage", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory_sources/**", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "frame failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not render the current wavetable.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("wavetable picker prewarms the current and adjacent tables without selecting a new table", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        await clearHarnessDebugLog(page);
        await page.locator('label:has(select[aria-label="Select wavetable"])').hover();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest").length >= 2;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest"),
            [
                { endpointID: "wavetablePrewarmRequest", value: 0 },
                { endpointID: "wavetablePrewarmRequest", value: 1 },
            ],
        );
        assert.deepEqual(
            snapshot.endpointMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmNotification"),
            [
                { endpointID: "wavetablePrewarmNotification", value: 0 },
                { endpointID: "wavetablePrewarmNotification", value: 1 },
            ],
        );
        assert.equal(Number(snapshot.parameterValues.oscAWavetableSelect), 0);
        assert.deepEqual(snapshot.gestureStarts.filter((value) => value === "oscAWavetableSelect"), []);
    } finally {
        await page.close();
    }
});

test("selected oscillator table and pan controls write only that oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await clearHarnessDebugLog(page);

        await page.locator('select[aria-label="Select wavetable"]').selectOption("1");
        const panInput = page.locator('input[aria-label="Pan"]');
        await panInput.press("Enter");
        await panInput.fill("25");
        await panInput.press("Enter");

        await page.waitForFunction(() => {
            const messages = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().sentMessages;
            return messages.some(({ endpointID, value }) => (
                endpointID === "oscBWavetableSelect" && Number(value) === 1
            )) && messages.some(({ endpointID, value }) => (
                endpointID === "oscBPan" && Math.abs(Number(value) - 0.25) < 0.0001
            ));
        });

        const selectedWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            endpointID === "oscBWavetableSelect" || endpointID === "oscBPan"
        ));
        assert.deepEqual(selectedWrites, [
            { endpointID: "oscBWavetableSelect", value: 1 },
            { endpointID: "oscBPan", value: 0.25 },
        ]);
        assert.equal((await getHarnessSnapshot(page)).sentMessages.some(({ endpointID }) => (
            endpointID === "wavetableSelect"
            || endpointID === "pan"
            || endpointID === "oscAWavetableSelect"
            || endpointID === "oscAPan"
            || endpointID === "oscCWavetableSelect"
            || endpointID === "oscCPan"
        )), false);
    } finally {
        await page.close();
    }
});

test("selected oscillator tuning level mute and solo controls write only that oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await clearHarnessDebugLog(page);

        for (const [label, keys] of [
            ["Oscillator octave", ["ArrowUp"]],
            ["Oscillator semitone", ["ArrowDown", "ArrowDown", "ArrowDown"]],
            ["Oscillator fine tune", ["ArrowUp"]],
            ["Oscillator level", ["End"]],
        ]) {
            const knob = page.getByRole("slider", { name: label });
            for (const key of keys) {
                await knob.press(key);
            }
        }
        await page.getByRole("button", { name: "Mute selected oscillator" }).click();
        await page.getByRole("button", { name: "Solo selected oscillator" }).click();

        await page.waitForFunction(() => {
            const values = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues;
            return Number(values.oscBOctave) === 1
                && Number(values.oscBSemitone) === -3
                && Math.abs(Number(values.oscBFineCents) - 0.1) < 0.0001
                && Number(values.oscBVolumeDb) === 6
                && Number(values.oscBMute) === 1
                && Number(values.oscBSolo) === 1;
        });

        const oscillatorWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            /^osc[ABC](Octave|Semitone|FineCents|VolumeDb|Mute|Solo)$/.test(endpointID)
        ));
        assert.deepEqual(oscillatorWrites, [
            { endpointID: "oscBOctave", value: 1 },
            { endpointID: "oscBSemitone", value: -1 },
            { endpointID: "oscBSemitone", value: -2 },
            { endpointID: "oscBSemitone", value: -3 },
            { endpointID: "oscBFineCents", value: 0.1 },
            { endpointID: "oscBVolumeDb", value: 6 },
            { endpointID: "oscBMute", value: 1 },
            { endpointID: "oscBSolo", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("mobile oscillator readout cells own touch and detent discrete values with haptics", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__oscillatorHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__oscillatorHaptics.push(style);
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    const dragCellByTouch = async (locator, deltaX) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        const start = {
            x: box.x + (box.width / 2),
            y: box.y + (box.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((deltaX * step) / 4),
                    y: start.y,
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );

        assert.equal(
            await page.locator('[data-role="mobile-voice-cell-volumeDb"]').getAttribute("data-modulation-target-kind"),
            "oscB.ampGainDb",
        );

        await page.locator('[data-role="mobile-voice-page-next"]').click();
        await page.waitForSelector('[data-role="mobile-voice-page"][data-page-name="Tune"]');

        // One MOD destination, one presenting cell: Semi alone carries the
        // pitch drop target; Oct and Fine are base-only readouts.
        const targetsByRole = new Map([
            ["mobile-voice-cell-octave", null],
            ["mobile-voice-cell-semitone", "oscB.pitchSemitones"],
            ["mobile-voice-cell-fineCents", null],
        ]);
        for (const [role, targetKind] of targetsByRole) {
            const cell = page.locator(`[data-role="${role}"]`);
            assert.equal(await cell.getAttribute("role"), "slider");
            assert.equal(await cell.evaluate((element) => getComputedStyle(element).touchAction), "none");
            assert.equal(await cell.getAttribute("data-modulation-target-kind"), targetKind);
        }

        const voicePanel = page.locator('[data-role="mobile-workspace-panel-voice"]');
        const octaveCell = page.locator('[data-role="mobile-voice-cell-octave"]');
        await octaveCell.scrollIntoViewIfNeeded();
        await clearHarnessDebugLog(page);
        const scrollBefore = await voicePanel.evaluate((element) => element.scrollTop);
        await dragCellByTouch(octaveCell, 120);

        const detentedSnapshot = await waitForHarnessSnapshot(
            page,
            "touch-detented oscillator octave",
            (snapshot) => Number(snapshot.parameterValues.oscBOctave) >= 1,
        );
        const octaveValue = Number(detentedSnapshot.parameterValues.oscBOctave);
        assert.equal(Number.isInteger(octaveValue), true);
        assert.equal(octaveValue >= 1 && octaveValue <= 4, true);
        assert.equal(await voicePanel.evaluate((element) => element.scrollTop), scrollBefore);
        const detentHaptics = await page.evaluate(() => window.__oscillatorHaptics);
        assert.equal(detentHaptics.length >= 1, true);
        assert.equal(detentHaptics.every((style) => style === "light"), true);

        const fineCell = page.locator('[data-role="mobile-voice-cell-fineCents"]');
        const hapticCountBeforeContinuousDrag = detentHaptics.length;
        await dragCellByTouch(fineCell, 17);
        const continuousSnapshot = await waitForHarnessSnapshot(
            page,
            "continuous oscillator fine tune",
            (snapshot) => Number(snapshot.parameterValues.oscBFineCents) > 1,
        );
        assert.equal(Number(continuousSnapshot.parameterValues.oscBFineCents) > 1, true);
        assert.equal(
            (await page.evaluate(() => window.__oscillatorHaptics)).length,
            hapticCountBeforeContinuousDrag,
        );
        assert.equal(await voicePanel.evaluate((element) => element.scrollTop), scrollBefore);

        const siblingWrites = continuousSnapshot.sentMessages.filter(({ endpointID }) => (
            /^osc[AC](Octave|Semitone|FineCents|VolumeDb)$/.test(endpointID)
        ));
        assert.deepEqual(siblingWrites, []);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("articulation capture and recall edit only the selected oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        await waitForHarnessSnapshot(
            page,
            "baseline B articulation",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 1,
        );

        for (const [label, keys] of [
            ["Oscillator octave", ["ArrowUp"]],
            ["Oscillator semitone", ["ArrowDown", "ArrowDown", "ArrowDown"]],
            ["Oscillator fine tune", ["ArrowUp"]],
            ["Oscillator level", ["End"]],
        ]) {
            const knob = page.getByRole("slider", { name: label });
            for (const key of keys) {
                await knob.press(key);
            }
        }
        await page.getByRole("button", { name: "Mute selected oscillator" }).click();
        await page.getByRole("button", { name: "Solo selected oscillator" }).click();
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();

        const captured = await waitForHarnessSnapshot(
            page,
            "B articulation overrides",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 2,
        );
        const storedBank = JSON.parse(String(captured.storedState[ARTICULATION_STATE_KEY]));
        const overrides = storedBank.slots[1].overrides;
        assert.deepEqual({
            octave: overrides["oscB.octave"],
            semitone: overrides["oscB.semitone"],
            fineCents: overrides["oscB.fineCents"],
            volumeDb: overrides["oscB.volumeDb"],
            mute: overrides["oscB.mute"],
            solo: overrides["oscB.solo"],
        }, {
            octave: 1,
            semitone: -3,
            fineCents: 0.1,
            volumeDb: 6,
            mute: 1,
            solo: 1,
        });
        assert.equal(Object.keys(overrides).some((key) => key.startsWith("oscA.")), false);
        assert.equal(Object.keys(overrides).some((key) => key.startsWith("oscC.")), false);

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="articulation-card"]').first().click();
        await page.locator('[data-role="articulation-card"]').nth(1).click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscBVolumeDb" && Number(value) === 6
            ))
        ));
        const oscillatorWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            /^osc[ABC]/.test(endpointID)
        ));
        assert.equal(oscillatorWrites.length > 0, true);
        assert.equal(oscillatorWrites.every(({ endpointID }) => endpointID.startsWith("oscB")), true);
    } finally {
        await page.close();
    }
});

test("global modulation-source drag maps the selected oscillator level control", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );
        await expandGlobalModRail(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="mobile-voice-cell-volumeDb"]');
        await target.scrollIntoViewIfNeeded();
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);

        const start = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        const settledTargetBox = await target.boundingBox();
        assert.ok(settledTargetBox);
        const settledEnd = touchPointForModSourcePreviewTarget(start, {
            x: settledTargetBox.x + (settledTargetBox.width / 2),
            y: settledTargetBox.y + (settledTargetBox.height / 2),
        }, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...settledEnd, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "oscB.ampGainDb");
        const dragDiagnostic = await page.evaluate(() => {
            const targetElement = document.querySelector('[data-role="mobile-voice-cell-volumeDb"]');
            const ghost = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
            const readRect = (element) => {
                const bounds = element?.getBoundingClientRect();
                return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
            };
            return {
                target: readRect(targetElement),
                ghost: readRect(ghost),
                hovered: Array.from(document.querySelectorAll(".is-mod-hover")).map((element) => ({
                    role: element.getAttribute("data-role"),
                    targetKind: element.getAttribute("data-modulation-target-kind"),
                    rect: readRect(element),
                })),
            };
        });
        assert.equal(
            (await target.getAttribute("class")).includes("is-mod-hover"),
            true,
            `Expected oscillator level hover. ${JSON.stringify(dragDiagnostic)}`,
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const snapshot = await waitForHarnessSnapshot(
            page,
            "selected oscillator modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "oscB.ampGainDb"
            )),
        );
        const routes = readStoredModulationState(snapshot).routes;
        assert.equal(routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "oscB.ampGainDb"
        )), true);
    } finally {
        await page.close();
    }
});

test("first mobile Mod Bar drop appears in the matrix after restoring routes", async () => {
    const restoredState = normalizeModulationState({
        routes: [{
            id: "mod-route-auto-1",
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 0.25,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 695 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: restoredState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "restored modulation route before first drop",
            (snapshot) => readStoredModulationState(snapshot).routes.length === 1,
        );
        await page.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        await page.waitForFunction(() => {
            const matrix = document.querySelector('[data-role="mobile-mod-matrix"]');
            const count = matrix?.querySelector('[data-role="mobile-mod-route-count"]')?.textContent?.trim();
            const rows = Array.from(matrix?.querySelectorAll('[data-role="mobile-mod-route-row"]') ?? []);
            return count === "1 mappings" && rows.some((row) => row.textContent?.includes("ENV 3"));
        });
        await page.locator('[data-role="mobile-workspace-toggle-voice"]').click();
        const railGrip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
        await railGrip.waitFor();
        if (await railGrip.getAttribute("aria-expanded") !== "true") {
            await railGrip.click({ position: { x: 28, y: 12 } });
        }
        await page.waitForFunction(() => {
            const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const drawer = rail?.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
            if (!(drawer instanceof HTMLElement) || rail?.getAttribute("data-expanded") !== "true") {
                return false;
            }
            const style = getComputedStyle(drawer);
            return drawer.getAttribute("aria-hidden") === "false"
                && !drawer.inert
                && style.opacity === "1"
                && style.visibility === "visible"
                && drawer.getAnimations().every((animation) => animation.playState === "finished");
        });

        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const target = page.locator('[data-role="mobile-voice-chip-semitone"]');
        await target.scrollIntoViewIfNeeded();
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393, 695);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        let thumb = start;
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            thumb = {
                x: start.x + ((end.x - start.x) * progress),
                y: start.y + ((end.y - start.y) * progress),
            };
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...thumb, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        // The amplified preview can land a few pixels off a compact corner
        // chip, and Chromium's touch resampler predicts one extra step past
        // a fast final move. Approach the chip closed-loop with small spaced
        // steps and verify capture before releasing, like a real thumb.
        const previewGain = Math.min(Math.max(393 / 168, 2.1), 2.5);
        let chipCaptured = false;
        for (let iteration = 0; iteration < 12 && !chipCaptured; iteration += 1) {
            const approach = await page.evaluate(() => {
                const ghost = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
                const bounds = ghost?.getBoundingClientRect();
                return {
                    ghost: bounds ? { x: bounds.x + (bounds.width / 2), y: bounds.y + (bounds.height / 2) } : null,
                    hovered: document.querySelector(".is-mod-hover")?.getAttribute("data-role") ?? null,
                };
            });
            assert.ok(approach.ghost, "The source drag must keep its preview ghost alive.");
            const error = {
                x: targetCenter.x - approach.ghost.x,
                y: targetCenter.y - approach.ghost.y,
            };
            if (Math.hypot(error.x, error.y) <= 3 && approach.hovered === "mobile-voice-chip-semitone") {
                chipCaptured = true;
                break;
            }
            const stepScale = Math.min(
                1,
                8 / Math.max(1, Math.hypot(error.x / previewGain, error.y / previewGain)),
            );
            thumb = {
                x: thumb.x + ((error.x / previewGain) * stepScale),
                y: thumb.y + ((error.y / previewGain) * stepScale),
            };
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...thumb, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(30);
        }
        assert.equal(chipCaptured, true, "The preview must settle captured on the Semitone chip.");
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "oscA.pitchSemitones");
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "first dropped oscillator modulation route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "oscA.pitchSemitones"
            )),
        );
        await page.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        await page.waitForFunction(() => {
            const matrix = document.querySelector('[data-role="mobile-mod-matrix"]');
            const count = matrix?.querySelector('[data-role="mobile-mod-route-count"]')?.textContent?.trim();
            const rows = Array.from(matrix?.querySelectorAll('[data-role="mobile-mod-route-row"]') ?? []);
            return count === "2 mappings" && rows.some((row) => row.textContent?.includes("MSEG 1"));
        });
        assert.equal(readStoredModulationState(await getHarnessSnapshot(page)).routes.length, 2);
    } finally {
        await cdp.detach().catch(() => {});
        await page.close();
    }
});

test("MSEG morph is a real modulation drop target", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="mseg-morph-slider"]').first();
        await target.scrollIntoViewIfNeeded();
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "mseg1Morph");

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
        const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "MSEG morph modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "mseg1Morph"
            )),
        );
        assert.equal(readStoredModulationState(snapshot).routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "mseg1Morph"
        )), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("every continuous MSEG and envelope control exposes its exact modulation target", async () => {
    const page = await openHarnessPage();

    try {
        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await page.getByRole("button", { name: `Select MSEG ${slotIndex + 1}` }).click();
            assert.equal(
                await page.locator('[role="slider"][aria-label="MSEG morph"]:visible').getAttribute("data-modulation-target-kind"),
                `mseg${slotIndex + 1}Morph`,
            );
            assert.equal(
                await page.locator('input[aria-label="MSEG rate"]:visible').getAttribute("data-modulation-target-kind"),
                `mseg${slotIndex + 1}Rate`,
            );
        }

        const envelopeFields = [
            ["Envelope attack value", "Attack"],
            ["Envelope decay value", "Decay"],
            ["Envelope sustain value", "Sustain"],
            ["Envelope release value", "Release"],
        ];
        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await page.getByRole("button", { name: `Select envelope ${slotIndex + 1}` }).click();
            for (const [ariaLabel, suffix] of envelopeFields) {
                assert.equal(
                    await page.locator(`input[aria-label="${ariaLabel}"]:visible`).getAttribute("data-modulation-target-kind"),
                    `env${slotIndex + 1}${suffix}`,
                );
            }
        }
    } finally {
        await page.close();
    }
});

test("envelope decay accepts a real touch modulation drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        await page.locator('[data-role="mobile-mod-source-type"]').selectOption("envelope");
        await page.locator('[data-role="mobile-mod-source-number"]').selectOption("2");
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('input[aria-label="Envelope decay value"]:visible');
        await target.scrollIntoViewIfNeeded();
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "env2Decay");

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
        const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "envelope decay modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "env2Decay"
            )),
        );
        assert.equal(readStoredModulationState(snapshot).routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "env2Decay"
        )), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("voice controls expose the selected oscillator and shared filter modulation targets", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const targetKindFor = (role) => page.locator(`[data-role="${role}"]`).evaluate((element) => (
        element.closest("[data-modulation-target-kind]")?.getAttribute("data-modulation-target-kind") ?? null
    ));
    const showPage = async (pageName) => {
        for (let step = 0; step < 5; step += 1) {
            const current = await page.locator('[data-role="mobile-voice-page"]').getAttribute("data-page-name");
            if (current === pageName) {
                return;
            }
            await page.locator('[data-role="mobile-voice-page-next"]').click();
        }
        throw new Error(`Could not reach toolbar page ${pageName}`);
    };

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );

        assert.equal(await targetKindFor("mobile-voice-graph"), "oscB.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-chip-semitone"), "oscB.pitchSemitones");
        assert.equal(await targetKindFor("mobile-voice-cell-framePosition"), "oscB.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-cell-warpAmount"), "oscB.warpAmount");
        assert.equal(await targetKindFor("mobile-voice-cell-volumeDb"), "oscB.ampGainDb");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonDetune"), "oscB.unisonDetune");

        await showPage("Tune");
        assert.equal(await targetKindFor("mobile-voice-cell-pan"), "oscB.pan");

        await showPage("Unison");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonBlend"), "oscB.unisonBlend");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWidth"), "oscB.unisonWidth");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWavetablePositionSpread"), "oscB.unisonWavetablePositionSpread");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWarpSpread"), "oscB.unisonWarpSpread");

        assert.equal(await targetKindFor("filter-cutoff-field"), "filterCutoffOctaves");
        assert.equal(await targetKindFor("filter-resonance-field"), "filterQ");

        await page.locator('[data-role="mobile-voice-tab-c"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="C"]',
        );
        assert.equal(await targetKindFor("mobile-voice-graph"), "oscC.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-cell-volumeDb"), "oscC.ampGainDb");
        assert.equal(await targetKindFor("mobile-voice-chip-semitone"), "oscC.pitchSemitones");
    } finally {
        await page.close();
    }
});

test("wavetable selection commits the desired table and retry uses the runtime retry event", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await clearHarnessDebugLog(page);
        await page.click('select[aria-label="Select wavetable"]');
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Select wavetable"]', "1");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 1 &&
                snapshot.runtimeState.desiredTableIndex === 1 &&
                snapshot.runtimeState.activeTableIndex === 0 &&
                snapshot.runtimeState.hasLoading === true &&
                snapshot.runtimeState.loadingTableIndex === 1;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetableSelect"), true);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetableSelect"), true);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.runtimeState.activeTableIndex, 0);
        assert.equal(snapshot.runtimeState.desiredTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWavetableSelect" && Number(value) === 1),
            true,
        );
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 2,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        await page.waitForSelector('button:has-text("Retry Load")');
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "retryDesiredTableRequest")
                && snapshot.runtimeState.hasLoading === true
                && snapshot.runtimeState.loadingTableIndex === 1
                && snapshot.runtimeState.hasFailure === false;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForSelector('button:has-text("Retry Load")', { state: "detached" });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "retryDesiredTableRequest"),
            [{ endpointID: "retryDesiredTableRequest", value: 0 }],
        );
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasFailure, false);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);
    } finally {
        await page.close();
    }
});

test("runtime loading state keeps the audible table visible while naming the desired table as pending", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 3,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 9,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 10,
            hasFailure: false,
        });

        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForFunction((expectedTableName) => {
            return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().stageLabel === expectedTableName;
        }, audibleTableName);
    } finally {
        await page.close();
    }
});

test("mobile wavetable selection names the pending table and the harness activates it", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const select = page.locator('select[aria-label="Select wavetable"]');
        const desiredOption = select.locator("option").nth(1);
        await desiredOption.waitFor({ state: "attached" });
        const desiredTableName = (await desiredOption.textContent())?.trim();
        assert.ok(desiredTableName);

        await select.selectOption("1");
        await page.waitForFunction((expected) => (
            document.querySelector('[data-role="mobile-voice-table-name"]')?.textContent?.trim()
                === `Loading ${expected}…`
        ), desiredTableName, { timeout: 3_000 });
        assert.equal(
            await page.locator('header:has-text("Cosimo Synth")').count(),
            0,
            "Compact mode must not rely on the desktop status header.",
        );

        await page.waitForFunction(() => {
            const { runtimeState } = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return runtimeState.activeTableIndex === 1 && runtimeState.hasLoading === false;
        });
        await page.waitForFunction((expected) => (
            document.querySelector('[data-role="mobile-voice-table-name"]')?.textContent?.trim() === expected
        ), desiredTableName);
        assert.equal(await select.inputValue(), "1");
    } finally {
        await page.close();
    }
});

test("stage drag preserves the gesture contract and ignores tiny drags", async () => {
    const page = await openHarnessPage();

    try {
        const stage = page.locator(".cosimo-stage");
        const box = await stage.boundingBox();
        assert.ok(box);

        const startX = box.x + (box.width * 0.5);
        const startY = box.y + (box.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 1);
        await page.mouse.up();

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 48, { steps: 6 });
        await page.mouse.up();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition");
        });

        snapshot = await getHarnessSnapshot(page);
        const positionMessages = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetablePosition");

        assert.equal(snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(positionMessages.length > 0, true);

        const lastPosition = Number(positionMessages.at(-1)?.value);
        const expectedPosition = Math.min(1, Math.max(0, 0.28 + (48 / box.height)));
        assert.ok(Math.abs(lastPosition - expectedPosition) <= 0.03);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 0,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 11,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 11,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });
        await page.waitForSelector('button:has-text("Retry Load")');
        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await showVoiceControls(page);
        await page.click('[aria-label="Glide"]');
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);
    } finally {
        await page.close();
    }
});

test("wavetable select claims left and right arrows on the real desktop page", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });
        await page.locator('select[aria-label="Select wavetable"]').evaluate((element) => {
            element.addEventListener("keydown", (event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                }
            }, true);
        });

        await clearHarnessDebugLog(page);
        await page.focus('select[aria-label="Select wavetable"]');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetableSelect"),
            [{ endpointID: "oscAWavetableSelect", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetableSelect"),
            [{ endpointID: "oscAWavetableSelect", value: 0 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("keyboard routing lets focused controls claim arrows and still routes note keys to the keyboard", async () => {
    const page = await openHarnessPage();

    try {
        const initialKeyboardDebug = await getKeyboardDebug(page);
        assert.ok(initialKeyboardDebug);
        assert.deepEqual(initialKeyboardDebug.attachCalls, [{ endpointID: "midiIn" }]);
        await showVoiceControls(page);

        await clearHarnessDebugLog(page);
        await page.focus('button:has-text("Poly")');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.151) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.151 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.15) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.15 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.locator('[aria-label="Glide"]').blur();
        await page.keyboard.down("a");
        await page.keyboard.up("a");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        keyboardDebug = await getKeyboardDebug(page);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("glide widget commits direct edits and blocks note routing while text entry is active", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const glideInput = page.locator('[aria-label="Glide"]');
        await glideInput.waitFor();

        await clearHarnessDebugLog(page);
        await glideInput.focus();
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });

        await clearHarnessDebugLog(page);
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await dispatchInputValueChange(glideInput, 0.5);
        await glideInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.5) <= 1e-9;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.5 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("voice mode buttons commit the exact discrete playMode values", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        await clearHarnessDebugLog(page);

        await page.click('button:has-text("Mono")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.equal(await page.locator('button:has-text("Mono")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Legato")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 2 }],
        );
        assert.equal(await page.locator('button:has-text("Legato")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Poly")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 0 }],
        );
        assert.equal(await page.locator('button:has-text("Poly")').getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("unison controls commit parameters and redraw the voice distribution", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        await page.locator('[data-role="unison-control-surface"]').waitFor();
        assert.equal(await page.locator('[data-role="unison-visualization"] circle').count(), 1);

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="unison-voices-up"]').click();
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAUnisonVoices) === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAUnisonVoices"),
            [{ endpointID: "oscAUnisonVoices", value: 2 }],
        );

        await clearHarnessDebugLog(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await detuneInput.fill("25");
        await detuneInput.press("Enter");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });

        await page.locator('[data-role="unison-detune-mode-control"]').click();
        await page.locator('[data-role="unison-stack-mode-control"]').click();
        await page.locator('[data-role="unison-phase-mode-control"]').click();
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAUnisonDetuneMode) === 1
                && Number(snapshot.parameterValues.oscAUnisonStackMode) === 1
                && Number(snapshot.parameterValues.oscARetrigger) === 1;
        });

        snapshot = await getHarnessSnapshot(page);
        const unisonEndpointIDs = new Set([
            "oscAUnisonDetune",
            "oscAUnisonDetuneMode",
            "oscAUnisonStackMode",
            "oscARetrigger",
        ]);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => unisonEndpointIDs.has(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [
                { endpointID: "oscAUnisonDetune", value: 0.5 },
                { endpointID: "oscAUnisonDetuneMode", value: 1 },
                { endpointID: "oscAUnisonStackMode", value: 1 },
                { endpointID: "oscARetrigger", value: 1 },
            ],
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEffectiveUnisonState({
                voices: 5,
                detune: 0.4,
                blend: 0.75,
                width: 1,
                detuneMode: 1,
                stackMode: 2,
                wavetablePositionSpread: 0.5,
                warpSpread: 0.25,
            });
        });
        await page.waitForFunction(() => document.querySelectorAll('[data-role="unison-visualization"] circle').length === 5);
    } finally {
        await page.close();
    }
});

test("precision value entry commits the newest text when Enter follows in the same event turn", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await clearHarnessDebugLog(page);
        await detuneInput.evaluate((element) => {
            if (!(element instanceof HTMLInputElement)) {
                throw new Error("Expected the unison detune input.");
            }
            const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (!setNativeValue) {
                throw new Error("Expected the native input value setter.");
            }
            setNativeValue.call(element, "25");
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });
    } finally {
        await page.close();
    }
});

test("precision value entry keeps the focused draft when a host echo arrives", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await detuneInput.fill("25");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAUnisonDetune", 0.8, true);
        });
        await page.waitForTimeout(50);

        assert.equal(await detuneInput.inputValue(), "25");
        await clearHarnessDebugLog(page);
        await detuneInput.press("Enter");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });
    } finally {
        await page.close();
    }
});

test("desktop unison drag presents within 50 ms while committing the matching runtime value", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 720 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="keyboard-control-mode-voice"]').click();
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.waitFor({ state: "visible" });
        const bounds = await detuneInput.boundingBox();
        assert.ok(bounds);
        await page.evaluate(() => {
            window.__COSIMO_UNISON_LATENCY__ = { armed: null, results: [] };
            const patchConnection = window.__COSIMO_DESKTOP_HARNESS__.patchConnection;
            const sendEventOrValue = patchConnection.sendEventOrValue.bind(patchConnection);
            patchConnection.sendEventOrValue = (endpointID, value) => {
                const state = window.__COSIMO_UNISON_LATENCY__;
                if (endpointID === "oscAUnisonDetune" && state?.armed?.handlerStartedAt) {
                    state.armed.runtimeSentAt ??= performance.now();
                }
                return sendEventOrValue(endpointID, value);
            };
            const targetInput = document.querySelector('[data-role="unison-detune-control"] input');
            const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
            if (!(targetInput instanceof HTMLInputElement) || !nativeValue?.get || !nativeValue.set) {
                throw new Error("Expected an instrumentable unison detune input.");
            }
            Object.defineProperty(targetInput, "value", {
                configurable: true,
                get() {
                    return nativeValue.get.call(this);
                },
                set(nextValue) {
                    nativeValue.set.call(this, nextValue);
                    const state = window.__COSIMO_UNISON_LATENCY__;
                    const armed = state?.armed;
                    if (!armed?.handlerStartedAt || armed.presented || String(nextValue) === armed.initialValue) {
                        return;
                    }
                    armed.presented = true;
                    state.results.push({
                        nativeQueueMs: armed.nativeQueueMs,
                        handlerToCommitMs: performance.now() - armed.handlerStartedAt,
                        handlerToRuntimeMs: armed.runtimeSentAt - armed.handlerStartedAt,
                        totalMs: armed.nativeQueueMs + performance.now() - armed.handlerStartedAt,
                        initialValue: armed.initialValue,
                        presentedValue: String(nextValue),
                    });
                },
            });
            document.addEventListener("pointermove", (event) => {
                const state = window.__COSIMO_UNISON_LATENCY__;
                const input = event.composedPath().find((candidate) => (
                    candidate instanceof HTMLInputElement
                    && candidate.closest('[data-role="unison-detune-control"]')
                ));
                if (!state?.armed || state.armed.handled || !(input instanceof HTMLInputElement)) {
                    return;
                }

                state.armed.handled = true;
                const armed = state.armed;
                const handlerStartedAt = performance.now();
                armed.handlerStartedAt = handlerStartedAt;
                armed.nativeQueueMs = handlerStartedAt - event.timeStamp;
            }, { capture: true, passive: true });
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
        await detuneInput.evaluate((input) => {
            window.__COSIMO_UNISON_LATENCY__.armed = {
                initialValue: input.value,
                handled: false,
            };
        });

        const startX = bounds.x + (bounds.width / 2);
        const endX = startX + Math.min(24, bounds.width * 0.25);
        const y = bounds.y + (bounds.height / 2);
        await detuneInput.dispatchEvent("pointerdown", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: startX,
            clientY: y,
        });
        await detuneInput.dispatchEvent("pointermove", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: endX,
            clientY: y,
        });
        await detuneInput.dispatchEvent("pointerup", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
            clientX: endX,
            clientY: y,
        });
        await page.waitForFunction(() => window.__COSIMO_UNISON_LATENCY__?.results?.length === 1, null, { timeout: 10_000 });

        const result = await page.evaluate(() => window.__COSIMO_UNISON_LATENCY__.results[0]);
        const snapshot = await getHarnessSnapshot(page);
        const sentUnisonMessages = snapshot.sentMessages.filter(
            ({ endpointID }) => endpointID === "oscAUnisonDetune",
        );
        assert.notEqual(result.presentedValue, result.initialValue);
        assert.ok(sentUnisonMessages.length > 0, "The presented drag must also reach the runtime boundary.");
        assert.equal(
            Number(snapshot.parameterValues.oscAUnisonDetune),
            Number(sentUnisonMessages.at(-1).value),
            "The runtime value must match the last value sent by the drag.",
        );
        assert.ok(
            result.nativeQueueMs + result.handlerToRuntimeMs < 50,
            `Expected unison runtime send <50ms, got ${JSON.stringify(result)}`,
        );
        assert.ok(result.totalMs < 50, `Expected unison value presentation <50ms, got ${JSON.stringify(result)}`);
        await page.waitForTimeout(100);
        assert.equal(
            await detuneInput.inputValue(),
            result.presentedValue,
            "The optimistic value must not snap back while the deferred runtime echo settles.",
        );
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAUnisonDetune", 0.8, true);
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="unison-detune-control"] input')?.value === "40 ct"
        ));
        assert.equal(await detuneInput.inputValue(), "40 ct", "An authoritative host echo must replace the drag value.");
    } finally {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
        await cdp.detach().catch(() => {});
        await page.close();
    }
});

test("precision fields end their host gesture when mouse movement reports no pressed button", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        const box = await detuneInput.boundingBox();
        assert.ok(box);
        const startX = box.x + (box.width / 2);
        const startY = box.y + (box.height / 2);
        await clearHarnessDebugLog(page);
        await detuneInput.evaluate((element, point) => {
            if (!(element instanceof HTMLInputElement)) {
                throw new Error("Expected the unison detune input.");
            }
            element.setPointerCapture = () => undefined;
            element.hasPointerCapture = () => false;
            element.releasePointerCapture = () => undefined;
            element.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 47,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                clientX: point.startX,
                clientY: point.startY,
            }));
            element.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                pointerId: 47,
                pointerType: "mouse",
                button: 0,
                buttons: 0,
                clientX: point.startX + 20,
                clientY: point.startY,
            }));
        }, {
            startX,
            startY,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["oscAUnisonDetune"]);
        assert.deepEqual(snapshot.gestureEnds, ["oscAUnisonDetune"]);
    } finally {
        await page.close();
    }
});

test("precision fields keep tracking touch when pointer capture is unavailable", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        const box = await detuneInput.boundingBox();
        assert.ok(box);
        await detuneInput.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointerId = 48;
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        const moved = { x: start.x + 40, y: start.y };
        await detuneInput.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free precision touch move",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAUnisonDetune"),
        );
        assert.deepEqual(snapshot.gestureStarts, ["oscAUnisonDetune"]);
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free precision touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("oscAUnisonDetune"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["oscAUnisonDetune"]);
    } finally {
        await page.close();
    }
});

test("warp controls commit mode and amount, and the matrix can route MSEG 1 into warp amount", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        assert.equal(await page.locator('select[aria-label="Warp mode"]').count(), 0);
        assert.equal(await page.getByText("Phase Warp", { exact: true }).count(), 0);

        await clearHarnessDebugLog(page);
        const warpModeChip = page.locator('button[aria-label^="Cycle warp mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.oscAWarpMode));

        for (let guard = 0; guard < 8 && currentMode !== 3; guard += 1) {
            await warpModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "warp mode cycling to asym",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.oscAWarpMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 3);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWarpMode" && Number(value) === 3),
            true,
        );

        await clearHarnessDebugLog(page);
        await warpModeChip.click();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWarpMode) === 4;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWarpMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const warpAmountInput = page.locator('input[aria-label="Warp amount"]');
        await warpAmountInput.dblclick();
        await warpAmountInput.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
        await warpAmountInput.type("0.720");
        await warpAmountInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAWarpAmount) - 0.72) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWarpAmount"),
            [{ endpointID: "oscAWarpAmount", value: 0.72 }],
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        await waitForHarnessSnapshot(
            page,
            "Route 1 target selection",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.targetKind === "oscA.warpAmount",
        );
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await waitForHarnessSnapshot(
            page,
            "Route 1 bipolar selection",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.polarity === "bipolar",
        );
        const routeAmount = page.locator('[aria-label="Route 1 amount"]');
        await routeAmount.focus();
        await routeAmount.press("Home");

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 targeting warp amount",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && route?.polarity === "bipolar"
                    && Number(route.amount) === -1;
            },
        );

        const finalRoute = readStoredModulationState(snapshot).routes[0];
        assert.deepEqual(routeSummary(finalRoute), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.warpAmount",
            amount: finalRoute.amount,
        });
        assert.deepEqual(readRuntimeProgramRoute(snapshot, finalRoute), {
            path: "voice",
            cellIndex: 1,
            sourceIndex: 0,
            targetIndex: 1,
            polarityKind: 1,
        });
        assert.equal(hasRuntimeAmount(snapshot, finalRoute, finalRoute.amount), true);
        const amountReadout = page.locator('[data-role="route-row-1"] >> text=/±100%/');
        await amountReadout.waitFor({ state: "visible" });
        assert.equal((await amountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("articulation recall applies sparse v4 overrides without replacing routing", async () => {
    const page = await openHarnessPage();
    const routeId = "oscA.warpAmount::mseg-1";

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        await page.evaluate(({ fallbackModulationState, nextRouteId }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAWavetablePosition", 0.12);
            harness.setParameterValue("oscAPan", 0.41);
            harness.setParameterValue("oscAWarpMode", 4);
            harness.setParameterValue("oscAWarpAmount", 0.08);
            harness.setParameterValue("filterCutoff", 8200);

            const rawModulationState = harness.getSnapshot().storedState["modulation.v6"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : fallbackModulationState;
            modulationState.routes = [{
                id: nextRouteId,
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "oscA.warpAmount",
                amount: 0.03,
                reducer: "max",
            }];
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
        }, {
            fallbackModulationState: createDefaultModulationState(),
            nextRouteId: routeId,
        });
        await waitForHarnessSnapshot(
            page,
            "canonical modulation route before articulation recall",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId,
        );

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: null,
            activeTriggerMode: "chain",
            slots: [{
                id: "articulation-0",
                runtimeSlot: 0,
                name: "Bow Forte",
                color: "#d2a128",
                key: 0,
                velRange: { min: 1, max: 1 },
                chainRange: { min: 0, max: 0 },
                overrides: {
                    "oscA.framePosition": 0.66,
                    "oscA.pan": -0.18,
                    "oscA.warpMode": 3,
                    "oscA.warpAmount": 0.61,
                    filterCutoffHz: 2475,
                },
                routeAmounts: { [routeId]: 0.42 },
            }],
        };
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').waitFor();

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "sparse articulation recall",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                const storedBank = readStoredArticulationEditorState(nextSnapshot);
                return storedBank.selectedSlotId === "articulation-0"
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAWavetablePosition) - 0.66) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAPan) - -0.18) <= 1e-9
                    && Number(nextSnapshot.parameterValues.oscAWarpMode) === 3
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAWarpAmount) - 0.61) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 2475) <= 1e-9
                    && route?.id === routeId
                    && route?.sourceKind === "mseg"
                    && route?.sourceSlot === 1
                    && route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route?.amount) - 0.42) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.warpAmount",
            amount: 0.42,
        });
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => ["oscAWavetablePosition", "oscAPan", "oscAWarpMode", "oscAWarpAmount", "filterCutoff"].includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [
                { endpointID: "oscAWavetablePosition", value: 0.66 },
                { endpointID: "oscAPan", value: -0.18 },
                { endpointID: "oscAWarpMode", value: 3 },
                { endpointID: "oscAWarpAmount", value: 0.61 },
                { endpointID: "filterCutoff", value: 2475 },
            ],
        );
    } finally {
        await page.close();
    }
});

test("desktop articulation hydration and live writes reject the same duplicate and retired documents whole", async () => {
    const validState = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "bow",
        activeTriggerMode: "chain",
        slots: [{
            id: "bow",
            runtimeSlot: 0,
            name: "Bow",
            color: "test-bow",
            key: 0,
            velRange: { min: 1, max: 1 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: {},
        }],
    };
    const duplicateState = {
        ...validState,
        slots: [validState.slots[0], { ...validState.slots[0], name: "Duplicate Bow" }],
    };
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, {
                stateKey: ARTICULATION_STATE_KEY,
                state: duplicateState,
            });
        },
    });

    try {
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 0);

        await page.evaluate(({ stateKey, state }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(state));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            state: validState,
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').waitFor();

        await page.evaluate(({ stateKey, state }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(state));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            state: duplicateState,
        });
        await waitForReactFrames(page);
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 1);
        assert.equal(
            await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').count(),
            1,
        );

        await page.evaluate((stateKey) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify({
                format: "cosimo.articulations",
                version: 2,
                selectedSlotId: null,
                activeTriggerMode: "chain",
                slots: [],
                chainAssignments: [],
                keyAssignments: [],
                velocityAssignments: [],
            }));
        }, ARTICULATION_STATE_KEY);
        await waitForReactFrames(page);
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("articulation range lane zooms by thirds and marks held Key Vel and Chain values", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        let viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                    pressed: dot.getAttribute("aria-pressed"),
                }))
            )),
            [
                { index: "0", held: "false", pressed: "true" },
                { index: "1", held: "false", pressed: "false" },
                { index: "2", held: "false", pressed: "false" },
            ],
        );

        await page.getByRole("tab", { name: "Key" }).click();
        await page.keyboard.down("a");
        await page.locator('[data-role="articulation-held-value"][data-held-value="36"]').waitFor();
        viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "36" });

        await page.getByRole("tab", { name: "Vel" }).click();
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                }))
            )),
            [
                { index: "0", held: "false" },
                { index: "1", held: "false" },
                { index: "2", held: "true" },
            ],
            "velocity 100 should mark the upper third while the lower velocity third is visible",
        );
        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        await page.locator('[data-role="articulation-held-value"][data-held-value="100"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 86, max: 127, heldValue: "100" });

        await page.getByRole("tab", { name: "Chain" }).click();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("voiceArticulationStart", {
                hasArticulation: 1,
                selectorA: 24,
            }, true);
        });
        await page.locator('[data-role="articulation-held-value"][data-held-value="24"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 0, min: 0, max: 42, heldValue: "24" });

        await page.keyboard.up("a");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-range-lane"]')?.getAttribute("data-held-value") === ""
        ));
    } finally {
        await page.keyboard.up("a").catch(() => {});
        await page.close();
    }
});

test("articulation editor resizes moves and gives every captured slot mandatory v4 selectors", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                {
                    id: "bow", runtimeSlot: 0, name: "Bow", color: "test-bow", key: 0,
                    velRange: { min: 1, max: 1 }, chainRange: { min: 0, max: 126 },
                    overrides: {}, routeAmounts: {},
                },
                {
                    id: "pluck", runtimeSlot: 1, name: "Pluck", color: "test-pluck", key: 1,
                    velRange: { min: 2, max: 2 }, chainRange: { min: 127, max: 127 },
                    overrides: {}, routeAmounts: {},
                },
            ],
        };

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        await page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]').click();
        assert.equal(
            await page.locator('[data-role="articulation-lane-assign-mode"], [data-role="articulation-lane-insert-mode"]').count(),
            0,
            "range placement must be inferred from hover/drop position, not an Assign/Insert mode toggle",
        );

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);

        await page.evaluate(({ stateKey }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const currentBank = JSON.parse(harness.getSnapshot().storedState[stateKey]);
            harness.setStoredStateValue(stateKey, JSON.stringify({
                ...currentBank,
                slots: currentBank.slots.map((slot) => ({
                    ...slot,
                    chainRange: slot.id === "bow" ? { min: 0, max: 20 } : { min: 21, max: 21 },
                })),
            }));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
        });
        let snapshot = await waitForHarnessSnapshot(
            page,
            "seeded narrow segment for resize and move",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => assignment.id === "chain-pluck" && assignment.min === 21 && assignment.max === 21);
            },
        );

        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);
        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.9, laneBox.y + laneBox.height * 0.5, { steps: 8 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range edge resize",
            (nextSnapshot) => {
                const pluck = readStoredArticulationEditorState(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return pluck?.min === 21 && Number(pluck?.max) > 21;
            },
        );
        const resizedPluck = readStoredArticulationEditorState(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.equal(resizedPluck.min, 21);
        assert.equal(resizedPluck.max, 38);

        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        const segmentBox = await pluckSegment.boundingBox();
        assert.notEqual(segmentBox, null);
        await page.mouse.move(segmentBox.x + segmentBox.width * 0.5, segmentBox.y + segmentBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.95, laneBox.y + laneBox.height * 0.5, { steps: 10 });
        assert.deepEqual(
            await readDesktopRangeSegments(page),
            [
                {
                    articulationId: "bow",
                    min: 0,
                    max: 20,
                    isPreview: false,
                    isPreviewAffected: false,
                    text: "Bow 0-20",
                },
                {
                    articulationId: "pluck",
                    min: 31,
                    max: 42,
                    isPreview: true,
                    isPreviewAffected: false,
                    text: "Pluck 31-42",
                },
            ],
            "range body drag must render its moved range before pointer up",
        );
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            "31-48",
        );
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range body move",
            (nextSnapshot) => {
                const pluck = readStoredArticulationEditorState(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return Number(pluck?.min) > 21 && Number(pluck?.max) > Number(pluck?.min);
            },
        );
        const movedPluck = readStoredArticulationEditorState(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.deepEqual(movedPluck, { id: "chain-pluck", articulationId: "pluck", min: 31, max: 48 });

        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "expanded capture uses the first free mandatory selectors",
            (nextSnapshot) => {
                const nextBank = readStoredArticulationEditorState(nextSnapshot);
                return nextBank.slots.length === 3
                    && nextBank.selectedSlotId === "articulation-2"
                    && nextBank.chainAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.min === 21
                        && assignment.max === 21
                    ))
                    && nextBank.keyAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.note === 2
                    ))
                    && nextBank.velocityAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.min === 3
                        && assignment.max === 3
                    ));
            },
        );
        assert.equal(readStoredArticulationEditorState(snapshot).slots.length, 3);
    } finally {
        await page.close();
    }
});

test("real articulation card drag previews and commits a mapped v4 range move", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                {
                    id: "bow", runtimeSlot: 0, name: "Bow", color: "test-bow", key: 0,
                    velRange: { min: 1, max: 1 }, chainRange: { min: 0, max: 20 },
                    overrides: {}, routeAmounts: {},
                },
                {
                    id: "pluck", runtimeSlot: 1, name: "Pluck", color: "test-pluck", key: 1,
                    velRange: { min: 2, max: 2 }, chainRange: { min: 21, max: 30 },
                    overrides: {}, routeAmounts: {},
                },
            ],
        };

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for real browser drag",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const card = page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]');
        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const targetPosition = {
            x: laneBox.width * 0.79,
            y: laneBox.height * 0.5,
        };
        const expectedDropPosition = Math.round(lowerViewport.min + (0.79 * (lowerViewport.max - lowerViewport.min)));
        const expectedMovedMin = expectedDropPosition - 5;
        const expectedMovedMax = expectedMovedMin + 9;
        const targetClientPosition = {
            x: laneBox.x + targetPosition.x,
            y: laneBox.y + targetPosition.y,
        };

        assert.equal(
            await previewArticulationCardDragOver(page, "pluck", lane, targetClientPosition),
            "move",
        );
        assert.deepEqual(await readDesktopRangeSegments(page), [
            {
                articulationId: "bow",
                min: 0,
                max: 20,
                isPreview: false,
                isPreviewAffected: false,
                text: "Bow 0-20",
            },
            {
                articulationId: "pluck",
                min: expectedMovedMin,
                max: expectedMovedMax,
                isPreview: true,
                isPreviewAffected: false,
                text: `Pluck ${expectedMovedMin}-${expectedMovedMax}`,
            },
        ]);
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            `${expectedMovedMin}-${expectedMovedMax}`,
            "the live move preview must expose the exact target range",
        );

        await card.dragTo(lane, {
            sourcePosition: { x: 20, y: 20 },
            targetPosition,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "real browser drag moves the mapped v4 range",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === expectedMovedMin
                    && assignment.max === expectedMovedMax
                ));
            },
        );

        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: expectedMovedMin, max: expectedMovedMax },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation range clicks select only and dragging an already mapped card moves its range", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
                { id: "air", runtimeSlot: 2, name: "Air" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
                { id: "chain-pluck", articulationId: "pluck", min: 64, max: 79 },
                { id: "chain-air", articulationId: "air", min: 96, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for desktop click behavior",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 3,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        await page.mouse.click(laneBox.x + laneBox.width * 0.38, laneBox.y + laneBox.height * 0.5);
        await waitForReactFrames(page);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);

        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 85, max: 127, heldValue: "" });

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "desktop range click selects the segment articulation",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "air",
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click({ button: "right" });
        const rangeMenu = page.locator('[data-role="articulation-range-menu"]');
        await rangeMenu.waitFor();
        assert.deepEqual(
            await rangeMenu.locator('[data-role="articulation-range-menu-item"]').evaluateAll((items) => (
                items.map((item) => item.getAttribute("data-action"))
            )),
            ["replace", "insert-after", "duplicate-after", "delete"],
            "right-click must open the range context menu with editing actions",
        );
        await waitForReactFrames(page);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);
        await page.keyboard.press("Escape");
        await rangeMenu.waitFor({ state: "detached" });

        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="1"]').click();
        const highViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(highViewport, { index: 1, min: 43, max: 84, heldValue: "" });
        const expectedMovedPosition = Math.round(highViewport.min + (0.2 * (highViewport.max - highViewport.min)));
        assert.equal(expectedMovedPosition, 51);
        const movedPluckMin = 43;
        const movedPluckMax = 58;
        await dragArticulationCardToLane(page, "pluck", lane, {
            x: laneBox.x + (laneBox.width * 0.2),
            y: laneBox.y + (laneBox.height * 0.5),
        }, {
            afterDragOver: async () => {
                const preview = page.locator('[data-role="articulation-placement-preview"]');
                await preview.waitFor();
                assert.equal(await preview.getAttribute("data-operation"), "move");
                assert.deepEqual(
                    await readDesktopRangeSegments(page),
                    [
                        {
                            articulationId: "pluck",
                            min: movedPluckMin,
                            max: movedPluckMax,
                            isPreview: true,
                            isPreviewAffected: false,
                            text: `Pluck ${movedPluckMin}-${movedPluckMax}`,
                        },
                    ],
                    "dragging an already-mapped card must preview one moved range, not merged instances",
                );
                assert.equal(
                    await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
                    `${movedPluckMin}-${movedPluckMax}`,
                );
            },
        });

        snapshot = await waitForHarnessSnapshot(
            page,
            "dragging a mapped card moves its only range instead of duplicating it",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.filter((assignment) => assignment.articulationId === "pluck").length === 1
                    && assignments.some((assignment) => (
                        assignment.articulationId === "pluck"
                        && assignment.min === movedPluckMin
                        && assignment.max === movedPluckMax
                    ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
            { id: "chain-pluck", articulationId: "pluck", min: movedPluckMin, max: movedPluckMax },
            { id: "chain-air", articulationId: "air", min: 96, max: 127 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize shrinks the range in the drag direction", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for resize",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);

        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.75, laneBox.y + laneBox.height * 0.5, { steps: 8 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "32-42"],
            "shared-boundary drag right must preview shrinking the right range start while leaving the left range alone",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "right range shrinks from the start during shared-boundary drag right",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 32
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 32, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize works on the first cold drag without pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for cold first drag",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const bowBox = await bowSegment.boundingBox();
        assert.notEqual(bowBox, null);
        await bowSegment.evaluate((element) => {
            [element, ...element.querySelectorAll("*")].forEach((candidate) => {
                candidate.setPointerCapture = () => {
                    throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
                };
            });
        });

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - viewport.min) / (viewport.max - viewport.min))
        );
        const y = bowBox.y + bowBox.height * 0.5;

        await page.mouse.move(bowBox.x + bowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(23), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "23-42"],
            "the first drag from a cold shared edge must preview shrinking the range in the drag direction",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "reset adjacent ranges for cold first drag left",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );

        const resetBowBox = await bowSegment.boundingBox();
        assert.notEqual(resetBowBox, null);
        await page.mouse.move(resetBowBox.x + resetBowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(19), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-19", "21-42"],
            "the first cold drag left from a shared edge must shrink the left range and leave the right range in place",
        );

        await page.mouse.up();

        const dragLeftSnapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag left shrinks the left range end and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(dragLeftSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation one-slot ranges keep labels and avoid adjacent resize-handle stealing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded one-slot adjacent range",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 21),
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        await pluckSegment.waitFor();
        assert.equal(await pluckSegment.getAttribute("data-tier"), "tiny");
        assert.equal(
            await pluckSegment.locator('[data-role="articulation-range-name"]').textContent(),
            "PS",
            "a one-slot range should still display the articulation identity instead of going blank",
        );

        const pluckHandleWidths = await pluckSegment
            .locator('[data-role^="articulation-range-resize"]')
            .evaluateAll((handles) => handles.map((handle) => handle.getBoundingClientRect().width));
        assert.deepEqual(
            pluckHandleWidths.map((width) => Math.round(width)),
            [4, 4],
            "resize hit targets should not consume the readable area of a one-slot range",
        );

        const bowBox = await bowSegment.boundingBox();
        const pluckBox = await pluckSegment.boundingBox();
        assert.notEqual(bowBox, null);
        assert.notEqual(pluckBox, null);

        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));

        await page.mouse.move(pluckBox.x + 1, pluckBox.y + pluckBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "false"
        ));

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - lowerViewport.min) / (lowerViewport.max - lowerViewport.min))
        );

        const bowMaxHandle = bowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const bowMaxHandleBox = await bowMaxHandle.boundingBox();
        assert.notEqual(bowMaxHandleBox, null);
        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));
        await page.mouse.move(
            bowMaxHandleBox.x + bowMaxHandleBox.width * 0.5,
            bowMaxHandleBox.y + bowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(19), pluckBox.y + pluckBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag left shrinks the left range and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 21
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
        ]);

        await page.evaluate(({ stateKey, nextState }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextState));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextState: editorBankToStoredArticulations(normalizeArticulationEditorState({
                selectedSlotId: "bow",
                activeTriggerMode: "chain",
                slots: [
                    { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                    { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
                ],
                chainAssignments: [
                    { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                    { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
                ],
            })),
        });
        await waitForHarnessSnapshot(
            page,
            "reset shared boundary with a wider right range",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 42),
        );

        const refreshedBowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const refreshedBowBox = await refreshedBowSegment.boundingBox();
        assert.notEqual(refreshedBowBox, null);
        const refreshedBowMaxHandle = refreshedBowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const refreshedBowMaxHandleBox = await refreshedBowMaxHandle.boundingBox();
        assert.notEqual(refreshedBowMaxHandleBox, null);
        await page.mouse.move(refreshedBowBox.x + refreshedBowBox.width * 0.5, refreshedBowBox.y + refreshedBowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
        ));
        await page.mouse.move(
            refreshedBowMaxHandleBox.x + refreshedBowMaxHandleBox.width * 0.5,
            refreshedBowMaxHandleBox.y + refreshedBowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(23), refreshedBowBox.y + refreshedBowBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const dragRightSnapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(dragRightSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("contextual toolbar only exposes articulation draft actions", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });

        await page.evaluate(({ articulationStateKey, nextBank }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        await waitForHarnessSnapshot(
            page,
            "seeded articulation",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "bow",
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAPan", 0.25);
        });

        const toolbar = page.locator('[data-role="contextual-floating-toolbar"]');
        await toolbar.waitFor();
        assert.match(await toolbar.getAttribute("aria-label"), /Edited Bow/i);
        assert.doesNotMatch(
            await toolbar.textContent(),
            /save preset|save only|undo save|update and save|update \+ save/i,
            "the floating toolbar must not expose preset-save language",
        );
        const toolbarBox = await toolbar.boundingBox();
        assert.ok(toolbarBox && toolbarBox.height <= 44, "the floating toolbar must stay one row tall");
        const toolbarButtonRoles = await toolbar.locator("button").evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("data-role")).sort()
        ));
        assert.deepEqual(toolbarButtonRoles, [
            "contextual-revert-articulation",
            "contextual-save-new-articulation",
            "contextual-toolbar-dismiss",
            "contextual-update-articulation",
        ]);

        await page.locator('[data-role="contextual-update-articulation"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "updated articulation without synth-local preset baseline",
            (nextSnapshot) => {
                const storedBank = readStoredArticulationEditorState(nextSnapshot);
                return storedBank.slots[0].snapshot.parameters.pan === 0.25
                    && !containsRetiredSynthPresetBaselineKey(nextSnapshot);
            },
        );
        const storedBank = readStoredArticulationEditorState(snapshot);
        assert.equal(storedBank.slots[0].snapshot.parameters.pan, 0.25);
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
        await page.waitForFunction(() => !document.querySelector('[data-role="contextual-floating-toolbar"]'));
    } finally {
        await page.close();
    }
});

test("synth preset bar saves current synth state through shared effect presets", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        const seededBank = normalizeArticulationEditorState({
            selectedSlotId: "bright-bow",
            activeTriggerMode: "velocity",
            slots: [
                { id: "bright-bow", runtimeSlot: 0, name: "Bright Bow" },
            ],
            velocityAssignments: [
                { id: "vel-bright", articulationId: "bright-bow", min: 12, max: 34 },
            ],
        });
        const seededModulationState = normalizeModulationState(await page.evaluate(({
            articulationStateKey,
            defaultModulationState,
            nextBank,
        }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));

            const rawModulationState = harness.getSnapshot().storedState["modulation.v6"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : defaultModulationState;

            modulationState.msegSlots = Array.isArray(modulationState.msegSlots)
                ? modulationState.msegSlots
                : [];
            modulationState.envelopeSlots = Array.isArray(modulationState.envelopeSlots)
                ? modulationState.envelopeSlots
                : [];
            modulationState.msegSlots[0] = {
                ...(modulationState.msegSlots[0] ?? {}),
            };
            modulationState.envelopeSlots[1] = {
                ...(modulationState.envelopeSlots[1] ?? {}),
                name: "Sweep Env",
            };
            modulationState.routes = [{
                id: "preset-route-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "oscA.warpAmount",
                amount: 0.37,
                reducer: "max",
            }];
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
            harness.setParameterValue("mseg1Morph", 0.71);
            harness.setParameterValue("env2Attack", 0.21);
            harness.setParameterValue("env2Decay", 0.32);
            harness.setParameterValue("env2Sustain", 0.43);
            harness.setParameterValue("env2Release", 0.54);
            return modulationState;
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            defaultModulationState: createDefaultModulationState(),
            nextBank: editorBankToStoredArticulations(seededBank),
        }));

        await waitForHarnessSnapshot(
            page,
            "seeded non-default stored state before synth preset save",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "bright-bow"
                && Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.71) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.env2Attack) - 0.21) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.env2Release) - 0.54) <= 1e-9,
        );

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.25);
            harness.setParameterValue("filterCutoff", 2475);
            harness.setParameterValue("mseg1Morph", 0.33);
        });

        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Bright Test Synth");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared synth preset saved",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState[EFFECT_PRESETS_V2_STATE_KEY];
                if (!rawState || containsRetiredSynthPresetBaselineKey(nextSnapshot)) {
                    return false;
                }

                const state = JSON.parse(String(rawState));
                return Array.isArray(state.userPresets?.[SYNTH_PRESET_EFFECT_ID])
                    && state.userPresets[SYNTH_PRESET_EFFECT_ID].some((preset) => preset.label === "Bright Test Synth");
            },
        );

        const presetState = readEffectPresetState(snapshot);
        const savedPreset = presetState.userPresets[SYNTH_PRESET_EFFECT_ID].find((preset) => (
            preset.label === "Bright Test Synth"
        ));

        assert.ok(savedPreset, "shared preset state must contain the saved synth preset");
        assert.equal(savedPreset.kind, "cosimo.effectPreset");
        assert.equal(savedPreset.version, 2);
        assert.equal(savedPreset.effectID, SYNTH_PRESET_EFFECT_ID);
        const visibleEndpointIDs = await readVisibleHarnessParameterEndpointIDs(page);
        const savedParameterIDs = Object.keys(savedPreset.parameters).sort((left, right) => left.localeCompare(right));
        assert.deepEqual(
            savedParameterIDs,
            visibleEndpointIDs,
            "saved synth presets must capture the complete visible Cmajor parameter contract",
        );
        for (const endpointID of visibleEndpointIDs) {
            assert.equal(
                savedPreset.parameters[endpointID],
                snapshot.parameterValues[endpointID],
                `saved parameter ${endpointID} must match the live value`,
            );
        }
        assert.equal(snapshot.parameterValues.hiddenSynthPresetGuard, 0.42);
        assert.equal("hiddenSynthPresetGuard" in savedPreset.parameters, false);
        assert.equal("midiIn" in savedPreset.parameters, false);
        assert.equal("runtimeState" in savedPreset.parameters, false);
        assert.equal("effectiveWarpState" in savedPreset.parameters, false);
        assert.equal(
            Object.keys(savedPreset.parameters).some((endpointID) => endpointID.startsWith("effective")),
            false,
            "saved synth presets must only contain real parameters, not runtime display endpoints",
        );
        assert.deepEqual(
            Object.keys(savedPreset.storedState).sort((left, right) => left.localeCompare(right)),
            [ARTICULATION_STATE_KEY, "modulation.v6"],
            "saved synth presets must capture only the required stored-state adapters",
        );
        assert.deepEqual(
            savedPreset.storedState[ARTICULATION_STATE_KEY],
            editorBankToStoredArticulations(seededBank),
            "saved synth presets must include the actual non-default articulation bank",
        );
        const savedModulationState = deserializeModulationState(savedPreset.storedState["modulation.v6"]);
        assert.equal(savedPreset.parameters.mseg1Morph, 0.33);
        assert.equal(savedPreset.parameters.env2Attack, 0.21);
        assert.equal(savedPreset.parameters.env2Decay, 0.32);
        assert.equal(savedPreset.parameters.env2Sustain, 0.43);
        assert.equal(savedPreset.parameters.env2Release, 0.54);
        assert.equal("morph" in savedModulationState.msegSlots[0], false);
        assert.deepEqual(savedModulationState.envelopeSlots[1], { name: "Sweep Env" });
        assert.equal("attackSeconds" in savedModulationState.envelopeSlots[1], false);
        assert.deepEqual(
            routeSummary(savedModulationState.routes[0]),
            routeSummary(seededModulationState.routes[0]),
            "saved synth presets must include the actual non-default modulation state",
        );
        assert.deepEqual(presetState.activePresetByEffect[SYNTH_PRESET_EFFECT_ID], {
            presetID: savedPreset.presetID,
            label: "Bright Test Synth",
            dirty: false,
        });
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
    } finally {
        await page.close();
    }
});

test("synth preset bar marks edits dirty and reverts without synth-local baseline state", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.12);
            harness.setParameterValue("oscAWavetableSelect", 3);
            harness.setParameterValue("oscBPan", -0.34);
            harness.setParameterValue("oscBWavetableSelect", 7);
            harness.setParameterValue("oscCPan", 0.56);
            harness.setParameterValue("oscCWavetableSelect", 11);
            harness.setParameterValue("filterCutoff", 2475);
            harness.setParameterValue("mseg1Morph", 0.33);
        });

        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Revert Test Synth");
        await waitForPresetBarDirtyState(page, false);

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.77);
            harness.setParameterValue("oscAWavetableSelect", 13);
            harness.setParameterValue("oscBPan", 0.78);
            harness.setParameterValue("oscBWavetableSelect", 17);
            harness.setParameterValue("oscCPan", -0.79);
            harness.setParameterValue("oscCWavetableSelect", 19);
            harness.setParameterValue("filterCutoff", 8200);
        });

        await waitForPresetBarDirtyState(page, true);
        await clickPresetBarAction(page, "revert");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared synth preset reverted",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.oscAPan) - 0.12) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscAWavetableSelect) === 3
                && Math.abs(Number(nextSnapshot.parameterValues.oscBPan) + 0.34) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscBWavetableSelect) === 7
                && Math.abs(Number(nextSnapshot.parameterValues.oscCPan) - 0.56) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscCWavetableSelect) === 11
                && Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 2475) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.33) <= 1e-9
                && !containsRetiredSynthPresetBaselineKey(nextSnapshot)
                && readEffectPresetState(nextSnapshot).activePresetByEffect[SYNTH_PRESET_EFFECT_ID]?.dirty === false,
        );

        assert.equal(Number(snapshot.parameterValues.oscAPan), 0.12);
        assert.equal(Number(snapshot.parameterValues.oscAWavetableSelect), 3);
        assert.equal(Number(snapshot.parameterValues.oscBPan), -0.34);
        assert.equal(Number(snapshot.parameterValues.oscBWavetableSelect), 7);
        assert.equal(Number(snapshot.parameterValues.oscCPan), 0.56);
        assert.equal(Number(snapshot.parameterValues.oscCWavetableSelect), 11);
        assert.equal(Number(snapshot.parameterValues.filterCutoff), 2475);
        assert.equal(Number(snapshot.parameterValues.mseg1Morph), 0.33);
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
    } finally {
        await page.close();
    }
});

test("synth presets restore mapping dependencies before strict articulation route amounts", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        const routeId = "preset-dependent-route";
        const seededBank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "mapped-bow",
            activeTriggerMode: "chain",
            slots: [{
                id: "mapped-bow",
                runtimeSlot: 0,
                name: "Mapped Bow",
                color: "test-mapped-bow",
                key: 0,
                velRange: { min: 1, max: 1 },
                chainRange: { min: 0, max: 0 },
                overrides: {},
                routeAmounts: { [routeId]: 0.63 },
            }],
        };

        await page.evaluate(({ defaultModulationState, nextRouteId }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify({
                ...defaultModulationState,
                routes: [{
                    id: nextRouteId,
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "bipolar",
                    targetKind: "oscA.warpAmount",
                    amount: 0.37,
                    reducer: "max",
                }],
            }));
        }, {
            defaultModulationState: createDefaultModulationState(),
            nextRouteId: routeId,
        });

        await waitForHarnessSnapshot(
            page,
            "accepted prerequisite mapping",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && Number(latestRuntimeProgram(snapshot)?.voiceRouteCount) === 1,
        );
        await page.evaluate(({ articulationStateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            nextBank: seededBank,
        });

        await waitForHarnessSnapshot(
            page,
            "seeded dependent mapping and articulation",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && readStoredArticulationEditorState(snapshot).slots[0]?.snapshot.modRouteAmounts[0]?.routeId === routeId,
        );
        await page.locator('[data-role="articulation-card"][data-articulation-id="mapped-bow"]').waitFor();
        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Mapped Articulation Test");
        await waitForPresetBarDirtyState(page, false);

        await page.evaluate(({ articulationStateKey, emptyArticulations }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(emptyArticulations));
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            harness.setStoredStateValue("modulation.v6", JSON.stringify({ ...modulationState, routes: [] }));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            emptyArticulations: {
                format: "cosimo.articulations",
                version: 4,
                selectedSlotId: null,
                activeTriggerMode: "chain",
                slots: [],
            },
        });

        await waitForPresetBarDirtyState(page, true);
        await clickPresetBarAction(page, "revert");

        const restored = await waitForHarnessSnapshot(
            page,
            "restored dependent mapping and articulation",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && readStoredArticulationEditorState(snapshot).slots[0]?.snapshot.modRouteAmounts[0]?.routeId === routeId,
        );
        assert.equal(readStoredArticulationEditorState(restored).slots[0].snapshot.modRouteAmounts[0].amount, 0.63);
        await waitForPresetBarDirtyState(page, false);
    } finally {
        await page.close();
    }
});

test("collapsed articulation cards scroll without clipping the voice tab or row controls", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 760, height: 720 });
        },
    });

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "slot-0",
            activeTriggerMode: "chain",
            slots: Array.from({ length: 16 }, (_, index) => ({
                id: `slot-${index}`,
                runtimeSlot: index,
                name: `Articulation ${index}`,
            })),
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="slot-15"]').waitFor();

        const layout = await page.evaluate(() => {
            const row = document.querySelector('[data-role="keyboard-control-row"]');
            const surface = document.querySelector('[data-role="articulation-control-surface"]');
            const carousel = document.querySelector('[data-role="articulation-card-carousel"]');
            const voiceTab = document.querySelector('[data-role="keyboard-control-mode-voice"]');

            if (!row || !surface || !carousel || !voiceTab) {
                throw new Error("Articulation control layout is missing.");
            }

            const rowBox = row.getBoundingClientRect();
            const surfaceBox = surface.getBoundingClientRect();
            const voiceBox = voiceTab.getBoundingClientRect();

            return {
                rowWidth: rowBox.width,
                surfaceRight: surfaceBox.right,
                rowRight: rowBox.right,
                voiceRight: voiceBox.right,
                carouselClientWidth: carousel.clientWidth,
                carouselScrollWidth: carousel.scrollWidth,
            };
        });

        assert.ok(layout.voiceRight <= layout.rowRight + 0.5, "the Voice tab must stay inside the controls row");
        assert.ok(layout.surfaceRight <= layout.rowRight + 0.5, "the articulation row must not expand beyond its parent");
        assert.ok(
            layout.carouselScrollWidth > layout.carouselClientWidth,
            "extra articulation cards should scroll inside the carousel instead of widening the row",
        );
    } finally {
        await page.close();
    }
});

test("compact desktop articulation row click replaces an occupied v4 range", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 390, height: 760 });
        },
    });

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                {
                    id: "bow", runtimeSlot: 0, name: "Bow", color: "test-bow", key: 0,
                    velRange: { min: 1, max: 1 }, chainRange: { min: 0, max: 126 },
                    overrides: {}, routeAmounts: {},
                },
                {
                    id: "pluck", runtimeSlot: 1, name: "Pluck", color: "test-pluck", key: 1,
                    velRange: { min: 2, max: 2 }, chainRange: { min: 127, max: 127 },
                    overrides: {}, routeAmounts: {},
                },
            ],
        };

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for compact row replacement",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        await page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]').click();
        await page.locator('[data-role="articulation-range-segment-row"]').first().click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "compact occupied row click replaces the whole range",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.length === 2
                    && assignments[0].articulationId === "bow"
                    && assignments[0].min === 127
                    && assignments[0].max === 127
                    && assignments[1].articulationId === "pluck"
                    && assignments[1].min === 0
                    && assignments[1].max === 126;
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 127, max: 127 },
            { id: "chain-pluck", articulationId: "pluck", min: 0, max: 126 },
        ]);
    } finally {
        await page.close();
    }
});

test("articulation card audition is press-hold and follows the most recently played note", async () => {
    const page = await openHarnessPage();

    async function pressAuditionAndExpect(note) {
        await clearHarnessDebugLog(page);

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        const box = await playButton.boundingBox();
        assert.notEqual(box, null);

        const clickPromise = playButton.click({ delay: 200 });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
        ]);

        await clickPromise;
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, note) },
        ]);
    }

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').waitFor();

        await clearHarnessDebugLog(page);
        await page.keyboard.down("g");
        await page.keyboard.up("g");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 43, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 43) },
        ]);

        await pressAuditionAndExpect(43);
        await pressAuditionAndExpect(43);

        await clearHarnessDebugLog(page);
        await page.keyboard.down("k");
        await page.keyboard.up("k");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
        ]);

        await pressAuditionAndExpect(48);
    } finally {
        await page.close();
    }
});

test("articulation card audition survives a platform pointer-capture rejection", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });
        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        await playButton.waitFor();
        await playButton.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        await playButton.dispatchEvent("pointerdown", {
            pointerId: 79,
            pointerType: "touch",
            button: 0,
            buttons: 1,
        });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);
        await playButton.dispatchEvent("pointerup", {
            pointerId: 79,
            pointerType: "touch",
            button: 0,
            buttons: 0,
        });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);

        assert.deepEqual((await getHarnessSnapshot(page)).midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60) },
        ]);
    } finally {
        await page.close();
    }
});

test("articulation card audition releases its note when the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });
        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        await playButton.waitFor();
        await playButton.scrollIntoViewIfNeeded();
        const box = await playButton.boundingBox();
        assert.ok(box, "Expected the articulation audition button to be visible.");
        await clearHarnessDebugLog(page);
        await page.mouse.move(box.x + (box.width * 0.5), box.y + (box.height * 0.5));
        await page.mouse.down();
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(100);

        assert.deepEqual((await getHarnessSnapshot(page)).midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60) },
        ]);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("opening the synth GUI does not recall or overwrite a stored selected articulation", async () => {
    const parameterEndpoints = [
        "oscAWavetablePosition",
        "playMode",
        "glideTime",
        "oscAPan",
        "oscAWarpMode",
        "oscAWarpAmount",
        "filterMode",
        "filterCutoff",
        "filterQ",
        "mseg1Morph",
        "distortionMode",
        "distortionWet",
        "chorusMix",
    ];
    const liveParameters = {
        wavetablePosition: 0.11,
        playMode: 2,
        glideTime: 0.04,
        pan: -0.31,
        warpMode: 1,
        warpAmount: 0.18,
        filterMode: 4,
        filterCutoff: 8765,
        filterQ: 7.25,
        mseg1Morph: 0.22,
        distortionMode: 1,
        distortionWet: 0.37,
        chorusMix: 0.48,
    };
    const storedBank = normalizeArticulationEditorState({
        selectedSlotId: "articulation-0",
        slots: [{
            id: "articulation-0",
            runtimeSlot: 0,
            name: "Art 1",
            snapshot: {
                parameters: {
                    wavetablePosition: 0.88,
                    playMode: 1,
                    glideTime: 0.33,
                    pan: 0.42,
                    warpMode: 3,
                    warpAmount: 0.77,
                    filterMode: 2,
                    filterCutoff: 2345,
                    filterQ: 2.5,
                    msegMorphs: [0.91, 0, 0],
                    distortionMode: 0,
                    distortionWet: 0.12,
                    chorusMix: 0.16,
                },
            },
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(({ stateKey, bank, parameters }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    parameterValues: parameters,
                    storedState: {
                        [stateKey]: JSON.stringify(bank),
                    },
                };
            }, {
                stateKey: ARTICULATION_STATE_KEY,
                bank: editorBankToStoredArticulations(storedBank),
                parameters: liveParameters,
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-card"][data-runtime-slot="0"]') instanceof HTMLElement
        ));
        await waitForReactFrames(page, 4);

        const snapshot = await getHarnessSnapshot(page);
        for (const [endpointID, expectedValue] of Object.entries(liveParameters)) {
            assert.equal(
                Number(snapshot.parameterValues[endpointID]),
                expectedValue,
                `${endpointID} should keep the host/current value when the GUI opens`,
            );
        }

        const hydratedBank = readStoredArticulationEditorState(snapshot);
        assert.equal(hydratedBank.selectedSlotId, "articulation-0");
        assert.equal(hydratedBank.slots[0].snapshot.parameters.wavetablePosition, 0.88);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.warpAmount, 0.77);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.filterCutoff, 2345);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.msegMorphs[0], 0.91);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => parameterEndpoints.includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [],
        );
    } finally {
        await page.close();
    }
});

test("Add route appends unique inert mappings and scrolls the new row into view", async () => {
    const page = await openHarnessPage();

    try {
        await page.setViewportSize({ width: 1280, height: 600 });
        const initialRoutes = readStoredModulationState(await getHarnessSnapshot(page)).routes;

        for (let routeIndex = initialRoutes.length; routeIndex < 8; routeIndex += 1) {
            await page.getByRole("button", { name: "Add route" }).click();
            await page.waitForFunction((expectedRouteIndex) => (
                document.querySelector(`[data-role="route-row-${expectedRouteIndex}"]`) instanceof HTMLElement
            ), routeIndex + 1);
        }

        await page.waitForFunction(() => {
            const routeRow = document.querySelector('[data-role="route-row-8"]');

            if (!(routeRow instanceof HTMLElement)) {
                return false;
            }

            const rect = routeRow.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            routeSummaries(readStoredModulationState(snapshot).routes),
            [
                ...routeSummaries(initialRoutes),
                ...[
                    "oscA.wavetablePosition",
                    "oscA.warpAmount",
                    "oscA.pitchSemitones",
                    "oscA.ampGainDb",
                    "oscA.pan",
                    "oscA.unisonDetune",
                    "oscA.unisonBlend",
                    "oscA.unisonWidth",
                ]
                    .slice(0, 8 - initialRoutes.length)
                    .map((targetKind) => ({
                        enabled: true,
                        sourceKind: "mseg",
                        sourceSlot: 1,
                        polarity: "unipolar",
                        targetKind,
                        amount: 0,
                    })),
            ],
        );
        const finalProgram = latestRuntimeProgram(snapshot);
        assert.equal(finalProgram?.voiceRouteCount, 8);
        assert.deepEqual(finalProgram?.voiceRouteCells.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
    } finally {
        await page.close();
    }
});

test("mod matrix keeps the list shell when empty and restores the seeded route when re-adding", async () => {
    const page = await openHarnessPage();

    try {
        const initialRouteCount = readStoredModulationState(await getHarnessSnapshot(page)).routes.length;

        for (let remainingRouteCount = initialRouteCount; remainingRouteCount > 0; remainingRouteCount -= 1) {
            await page.getByRole("button", { name: "Remove route 1" }).click();
            await waitForHarnessSnapshot(
                page,
                `route removal leaves ${remainingRouteCount - 1} rows`,
                (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === remainingRouteCount - 1,
            );
        }

        let snapshot = await waitForHarnessSnapshot(
            page,
            "route list empty after removing the seeded row",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === 0,
        );

        assert.equal(await page.getByRole("button", { name: "Add route" }).count(), 1);
        assert.equal(await page.locator('[data-role^="route-row-"]').count(), 0);
        assert.equal(await page.getByText(/add a modulation slot/i).count(), 0);
        assert.deepEqual(readStoredModulationState(snapshot).routes, []);

        await page.getByRole("button", { name: "Add route" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "seeded route returns after add",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route !== undefined
                    && route.enabled === true
                    && route.sourceKind === "mseg"
                    && route.sourceSlot === 1
                    && route.polarity === "unipolar"
                    && route.targetKind === "oscA.wavetablePosition"
                    && Math.abs(Number(route.amount)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0,
        });
    } finally {
        await page.close();
    }
});

test("mod matrix source and target selects keep enough width for their menu content and bypass uses the flattened source model", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await page.getByRole("button", { name: "Route 1 source" }).click();

        let sourceSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 source"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 source "]'));
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
                optionFontFamilies: optionButtons.map((button) => getComputedStyle(button).fontFamily),
            };
        });

        assert.ok(sourceSizing.triggerWidth >= sourceSizing.widestOptionWidth);
        assert.equal(sourceSizing.optionFontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        await page.getByRole("button", { name: "Route 1 source ENV 3" }).click();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "flattened source selection updates to ENV 3",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.sourceKind === "env" && route?.sourceSlot === 3;
            },
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 target" }).click();

        const targetSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 target"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 target "]'));
            const menu = optionButtons[0]?.parentElement;
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                menuWidth: menu instanceof HTMLElement ? menu.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
            };
        });

        assert.ok(targetSizing.triggerWidth <= 180);
        assert.ok(targetSizing.menuWidth >= targetSizing.widestOptionWidth);
        assert.ok(await page.locator('[aria-label="Route 1 amount"]:visible').boundingBox());
        await page.getByRole("button", { name: "Route 1 target A TUNE" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "target selection updates to pitch",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.targetKind === "oscA.pitchSemitones",
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 bypass" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "route bypass disables the first route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.enabled === false,
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: false,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 0,
        });
        assert.equal(readRuntimeProgramRoute(snapshot, readStoredModulationState(snapshot).routes[0]), null);
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob double-click entry uses the displayed units", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");

        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        await amountKnob.dblclick();

        const amountInput = page.locator('input[aria-label="Route 1 amount value"]:visible');
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("12");
        await amountInput.blur();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "typed route amount commit in displayed percent units",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route.amount) - 0.12) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.warpAmount",
            amount: 0.12,
        });
        const warpAmountReadout = page.locator('[data-role="route-row-1"] >> text=/\\+?12%/');
        await warpAmountReadout.waitFor({ state: "visible" });
        assert.equal((await warpAmountReadout.count()) >= 1, true);
        assert.equal(
            hasRuntimeAmount(snapshot, readStoredModulationState(snapshot).routes[0], 0.12),
            true,
        );

        await choosePrototypeSelectOption(page, "Route 1 target", "A PAN");
        await amountKnob.dblclick();
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("-40");
        await amountInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed signed pan amount commit",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.pan"
                    && Math.abs(Number(route.amount) - (-0.4)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.pan",
            amount: -0.4,
        });
        const panAmountReadout = page.locator('[data-role="route-row-1"] >> text=/40% L/');
        await panAmountReadout.waitFor({ state: "visible" });
        assert.equal((await panAmountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("mod matrix amount entry preserves the focused draft across a host echo", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        await page.locator('[aria-label="Route 1 amount"]:visible').dblclick();

        const amountInput = page.locator('input[aria-label="Route 1 amount value"]:visible');
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("12");
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            modulationState.routes[0].amount = 0.77;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
        });
        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            return Math.abs(Number(modulationState.routes[0]?.amount) - 0.77) <= 1e-9;
        });

        assert.equal(await amountInput.inputValue(), "12");
        await amountInput.press("Enter");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "focused route amount draft committed after host echo",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route.amount) - 0.12) <= 1e-9;
            },
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 0.12);
        assert.equal(await amountInput.count(), 0, "Enter must close the exact-value editor instead of reopening it through the slider.");
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob tracks a Safari-style touch drag", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        const bounds = await amountKnob.boundingBox();
        assert.ok(bounds);
        await clearHarnessDebugLog(page);

        const pointer = {
            pointerId: 93,
            pointerType: "touch",
            button: 0,
            clientX: bounds.x + (bounds.width / 2),
        };
        await amountKnob.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientY: bounds.y + (bounds.height / 2),
        });
        await amountKnob.dispatchEvent("pointermove", {
            ...pointer,
            buttons: 0,
            clientY: bounds.y + bounds.height + 24,
        });
        await amountKnob.dispatchEvent("pointerup", {
            ...pointer,
            buttons: 0,
            clientY: bounds.y + bounds.height + 24,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "touch-adjusted modulation amount",
            (nextSnapshot) => Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) < 0.95,
        );
        const route = readStoredModulationState(snapshot).routes[0];
        assert.equal(hasRuntimeAmount(snapshot, route, route.amount), true);
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob supports standard slider keyboard controls", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        await amountKnob.focus();
        await amountKnob.press("Home");

        let snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard minimum",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - (-1)) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, -1);

        await amountKnob.press("End");
        snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard maximum",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - 1) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 1);

        await amountKnob.press("ArrowDown");
        snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard decrement",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - 0.999) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 0.999);
    } finally {
        await page.close();
    }
});

test("mod matrix amount rendering stays current across idle flushes and structural edits", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        const polarityToggle = page.locator('[aria-label="Route 1 polarity"]:visible');
        await amountKnob.focus();

        await amountKnob.press("Home");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), -1);
        await amountKnob.press("End");
        await page.waitForTimeout(60);
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 1);

        await amountKnob.press("ArrowDown");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.999);
        await page.waitForTimeout(70);
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.999);

        await amountKnob.press("ArrowDown");
        await polarityToggle.click();
        await page.waitForTimeout(70);

        const snapshot = await getHarnessSnapshot(page);
        const route = readStoredModulationState(snapshot).routes[0];
        assert.equal(route.polarity, "bipolar");
        assert.equal(route.amount, 0.998);
        assert.equal(await polarityToggle.getAttribute("aria-pressed"), "true");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.998);
    } finally {
        await page.close();
    }
});

test("desktop envelope editor drags handles and commits compact rail values for the selected slot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.locator('input[aria-label="Pan"]').count(), 1);
        assert.equal(await page.locator('[data-role="wavetable-pan-field"]').count(), 1);
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        assert.equal(
            await page.locator('input[aria-label="Envelope decay value"]').evaluate((element) => getComputedStyle(element).textAlign),
            "left",
        );

        const initialParameters = (await getHarnessSnapshot(page)).parameterValues;

        await dragEnvelopeHandleBy(page, "adsr-attack-handle-hit-target", 110, 0);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "envelope attack drag updates slot 2",
            (nextSnapshot) => {
                return Number(nextSnapshot.parameterValues.env2Attack) > 0.08
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Attack) - 0.01) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Attack"
                        && Number(value) > 0.08
                    ));
            },
        );

        assert.equal(Number(snapshot.parameterValues.env2Attack) > 0.08, true);
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Attack) - 0.01) <= 1e-9, true);

        const parametersAfterAttack = snapshot.parameterValues;

        await dragEnvelopeHandleBy(page, "adsr-decay-sustain-handle-hit-target", 160, 70);

        snapshot = await waitForHarnessSnapshot(
            page,
            "decay-sustain handle drag updates decay horizontally and sustain vertically for slot 2",
            (nextSnapshot) => {
                return Math.abs(Number(nextSnapshot.parameterValues.env2Decay) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02
                    && Math.abs(Number(nextSnapshot.parameterValues.env2Sustain) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Decay) - 0.25) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Sustain) - 0.5) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Decay"
                        && Math.abs(Number(value) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02
                    ))
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Sustain"
                        && Math.abs(Number(value) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05
                    ));
            },
        );

        assert.equal(
            Math.abs(Number(snapshot.parameterValues.env2Decay) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02,
            true,
        );
        assert.equal(
            Math.abs(Number(snapshot.parameterValues.env2Sustain) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05,
            true,
        );
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Decay) - 0.25) <= 1e-9, true);
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Sustain) - 0.5) <= 1e-9, true);

        const releaseInput = page.locator('input[aria-label="Envelope release value"]');
        await releaseInput.fill("800 ms");
        await releaseInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "compact release field commits milliseconds for slot 2",
            (nextSnapshot) => {
                return Math.abs(Number(nextSnapshot.parameterValues.env2Release) - 0.8) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Release"
                        && Math.abs(Number(value) - 0.8) <= 1e-9
                    ));
            },
        );

        assert.equal(Math.abs(Number(snapshot.parameterValues.env2Release) - 0.8) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("desktop envelope exact entry preserves the focused draft across a host echo", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        const attackInput = page.locator('input[aria-label="Envelope attack value"]');
        await attackInput.fill("250 ms");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("env2Attack", 0.9);
        });
        await page.waitForFunction(() => {
            return Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.env2Attack) - 0.9) <= 1e-9;
        });

        assert.equal(await attackInput.inputValue(), "250 ms");
        await attackInput.press("Enter");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "focused envelope draft committed after host echo",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.env2Attack) - 0.25) <= 1e-9,
        );
        assert.equal(snapshot.parameterValues.env2Attack, 0.25);
    } finally {
        await page.close();
    }
});

test("desktop envelope handle stops editing after the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        const handle = page.locator('[data-role="adsr-attack-handle-hit-target"]');
        await handle.scrollIntoViewIfNeeded();
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox, "Expected the ADSR attack handle to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(handleBox.x + (handleBox.width * 0.5), handleBox.y + (handleBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.move(handleBox.x + handleBox.width + 120, handleBox.y + (handleBox.height * 0.5));
        await page.mouse.up();
        await page.waitForTimeout(100);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "env2Attack"),
            false,
        );
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("desktop wavetable stage follows live effective warp state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.stageDebug && typeof rendered.stageDebug.warpMode === "number";
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAWarpMode", 1);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAWarpAmount", 0.18);
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 4,
                amount: 0.82,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 4
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.82) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveWarpState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 3,
                amount: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                amount: 0.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("filter controls commit mode, cutoff, and Q, and the matrix can route MSEG 1 into filter cutoff", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        const filterModeChip = page.locator('button[aria-label^="Cycle filter mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode));

        for (let guard = 0; guard < 8 && currentMode !== 4; guard += 1) {
            await filterModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "filter mode cycling",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 4);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffField = page.locator('[data-role="filter-cutoff-field"]');
        await dragLocatorBy(page, filterCutoffField, 18, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffInput = page.locator('input[aria-label="Filter cutoff"]');
        await filterCutoffInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter cutoff"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterCutoffInput, 1210);
        await filterCutoffInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter cutoff commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 1210) <= 1
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceField = page.locator('[data-role="filter-resonance-field"]');
        await dragLocatorBy(page, filterResonanceField, 10, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterQ) > 0.8;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.8),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceInput = page.locator('input[aria-label="Filter resonance"]');
        await filterResonanceInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter resonance"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterResonanceInput, 7.5);
        await filterResonanceInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter resonance commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterQ) - 7.5) <= 0.01
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01),
            true,
        );

        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "CUTOFF");
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await dragLocatorBy(page, page.locator('[aria-label="Route 1 amount"]'), 0, 20);

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 modulating filter cutoff",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "filterCutoffOctaves"
                    && route?.polarity === "bipolar"
                    && Math.abs(Number(route.amount) - (-1.0)) <= 0.08;
            },
        );

        const finalRoute = readStoredModulationState(snapshot).routes[0];
        assert.deepEqual(routeSummary(finalRoute), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "filterCutoffOctaves",
            amount: finalRoute.amount,
        });
        assert.deepEqual(readRuntimeProgramRoute(snapshot, finalRoute), {
            path: "voice",
            cellIndex: 30,
            sourceIndex: 0,
            targetIndex: 30,
            polarityKind: 1,
        });
        assert.equal(hasRuntimeAmount(snapshot, finalRoute, finalRoute.amount, 0.001), true);
        const cutoffAmountReadout = page.locator('[data-role="route-row-1"] >> text=/±1\\.00 oct/');
        await cutoffAmountReadout.waitFor({ state: "visible" });
        assert.equal((await cutoffAmountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("desktop filter graph follows live effective filter state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        const filterCard = page.locator('[data-role="filter-card"]');
        const filterGraph = page.locator('[data-role="filter-response-graph"]');
        const filterHandle = page.locator('[data-role="filter-response-handle-hit-target"]');
        const filterCardBox = await filterCard.boundingBox();
        const filterGraphBox = await filterGraph.boundingBox();
        const filterHandleBox = await filterHandle.boundingBox();

        assert.ok(filterCardBox, "Expected filter card bounding box.");
        assert.ok(filterGraphBox, "Expected filter graph bounding box.");
        assert.ok(filterHandleBox, "Expected filter response handle bounding box.");
        assert.ok((filterGraphBox.width / filterCardBox.width) >= 0.9);
        assert.ok((filterGraphBox.height / filterCardBox.height) >= 0.9);
        assert.equal(await filterCard.getByText("Analyzer View", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Live Response", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Filter", { exact: true }).count(), 0);

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.base && rendered.filterGraphState.live;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);

        await clearHarnessDebugLog(page);
        await clickFilterGraphAt(page, 0.06, 0.08);
        await page.waitForTimeout(100);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff" || endpointID === "filterQ"),
            false,
        );

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 96, -54);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000
                && Number(snapshot.parameterValues.filterQ) > 0.707107;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.707107),
            true,
        );

        await dragFilterHandleBy(page, 0, 420);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05);

        await dragFilterHandleBy(page, 0, -1200);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 3,
                cutoffHz: 2800,
                q: 5.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === true
                && Number(rendered.filterGraphState?.live?.mode) === 3
                && Math.abs(Number(rendered.filterGraphState?.live?.cutoffHz) - 2800) <= 1;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveFilterState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 1,
                cutoffHz: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                cutoffHz: 1000,
                q: 0.707107,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);
    } finally {
        await page.close();
    }
});

test("desktop filter graph closes both host gestures when the window blurs mid-drag", async () => {
    const page = await openHarnessPage();

    try {
        const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
        await handle.scrollIntoViewIfNeeded();
        const bounds = await handle.boundingBox();
        assert.ok(bounds);
        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        await clearHarnessDebugLog(page);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 24, startY - 18, { steps: 4 });
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.gestureStarts.includes("filterCutoff")
                && snapshot.gestureStarts.includes("filterQ");
        });

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(20);
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureEnds, ["filterCutoff", "filterQ"]);
        await page.mouse.up();
    } finally {
        await page.close();
    }
});

test("desktop filter graph keeps tracking touch when pointer capture is unavailable", async () => {
    const page = await openHarnessPage();

    try {
        const graph = page.locator('[data-role="filter-response-graph"]');
        const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
        const bounds = await handle.boundingBox();
        assert.ok(bounds);
        await graph.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointerId = 96;
        const start = {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2),
        };
        const moved = { x: start.x + 80, y: start.y - 40 };
        await handle.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free filter graph touch move",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("filterCutoff")
                && nextSnapshot.gestureStarts.includes("filterQ")
                && nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff"),
        );
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free filter graph touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("filterCutoff")
                && nextSnapshot.gestureEnds.includes("filterQ"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["filterCutoff", "filterQ"]);
    } finally {
        await page.close();
    }
});

test("desktop filter graph cycles graph, bars, and round-bars analyzers while keeping live spectrum updates sane", async () => {
    const page = await openHarnessPage();

    try {
        const analyzerModeChip = page.locator('button[aria-label^="Cycle analyzer view"]').first();

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.spectrum;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.hasSpectrum, false);

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 2 ? 0.03 : index === 3 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.hasSpectrum === true
                && Array.isArray(spectrum?.bandMagnitudesDb)
                && spectrum.bandMagnitudesDb.length > 0;
        });

        renderedState = await getHarnessRenderedState(page);
        const lowHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.equal(lowHeavySpectrum.hasSpectrum, true);
        assert.equal(lowHeavySpectrum.renderMode, "graph");
        assert.equal(lowHeavySpectrum.sourceBinCount, 64);
        assert.equal(lowHeavySpectrum.bandCount, 120);
        assert.ok(lowHeavySpectrum.graphPointCount > lowHeavySpectrum.bandCount);
        assert.equal(lowHeavySpectrum.bandMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.smoothedMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.peakMagnitudesDb.length, 120);
        assert.deepEqual(lowHeavySpectrum.renderGeometry, {
            kind: "graph",
            pointCount: lowHeavySpectrum.graphPointCount,
            peakPointCount: lowHeavySpectrum.graphPointCount,
        });
        assert.deepEqual(
            lowHeavySpectrum.frequencyTicks.map(({ label }) => label),
            ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k"],
        );
        assert.deepEqual(
            lowHeavySpectrum.dbTicks.map(({ label }) => label),
            ["-18", "-36", "-54", "-72", "-90"],
        );
        assert.ok(Math.max(...lowHeavySpectrum.bandMagnitudesDb) > Math.min(...lowHeavySpectrum.bandMagnitudesDb));
        const previousBandMagnitudesDb = [...lowHeavySpectrum.bandMagnitudesDb];
        const previousSmoothedMagnitudesDb = [...lowHeavySpectrum.smoothedMagnitudesDb];

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("filterSpectrum", {
                sampleRateHz: "broken",
                magnitudes: [1, 2, 3, 4, 5, 6, 7, 8],
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.deepEqual(renderedState.filterGraphState.spectrum, lowHeavySpectrum);

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: false,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "round-bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === true;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "round-bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: true,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "graph" && spectrum?.renderGeometry?.kind === "graph";
        });

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.03 : index === 58 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, previousBandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const highHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.notDeepEqual(highHeavySpectrum.bandMagnitudesDb, previousBandMagnitudesDb);
        assert.notDeepEqual(highHeavySpectrum.smoothedMagnitudesDb, previousSmoothedMagnitudesDb);
        assert.equal(highHeavySpectrum.renderMode, "graph");
        assert.equal(highHeavySpectrum.renderGeometry.kind, "graph");

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.009 : index === 58 ? 0.006 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, highHeavySpectrum.bandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const decayingSpectrum = renderedState.filterGraphState.spectrum;
        const peakBandIndex = highHeavySpectrum.peakBandIndex;
        assert.ok(decayingSpectrum.smoothedMagnitudesDb[peakBandIndex] > decayingSpectrum.bandMagnitudesDb[peakBandIndex]);
        assert.ok(decayingSpectrum.peakMagnitudesDb[peakBandIndex] >= decayingSpectrum.smoothedMagnitudesDb[peakBandIndex]);
    } finally {
        await page.close();
    }
});

test("keyboard octave controls update the mounted keyboard root note and note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await page.click('button[aria-label="Shift keyboard up one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "48");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
            ],
        );

        await page.click('button[aria-label="Shift keyboard down one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("z and x shift the mounted keyboard octave without forwarding those keys to note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("z");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "24");

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 24, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 24) },
            ],
        );

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("x");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("keyboard octave buttons disable at the configured minimum and maximum root notes", async () => {
    const page = await openHarnessPage();

    try {
        const upButton = page.locator('button[aria-label="Shift keyboard up one octave"]');
        const downButton = page.locator('button[aria-label="Shift keyboard down one octave"]');

        for (const expectedRootNote of ["48", "60", "72"]) {
            await upButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await upButton.isDisabled(), true);
        assert.equal(await downButton.isDisabled(), false);

        for (const expectedRootNote of ["60", "48", "36", "24", "12"]) {
            await downButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await downButton.isDisabled(), true);
        assert.equal(await upButton.isDisabled(), false);
    } finally {
        await page.close();
    }
});

test("MSEG editor wiring can open, add a point, move it, and close with Escape", async () => {
    const page = await openHarnessPage();

    try {
        await page.click('button[aria-label="Open MSEG editor"]');
        await page.waitForSelector('[data-role="mseg-editor-dialog"]');

        const presetBarHost = page.locator('[data-role="synth-preset-bar-host"]');
        assert.equal(
            await presetBarHost.evaluate((element) => getComputedStyle(element).display),
            "none",
            "The preset bar must not cover the full-screen MSEG editor.",
        );

        const surface = page.locator('svg[data-role="mseg-editor-surface"]');
        const box = await surface.boundingBox();
        assert.ok(box);

        const addPointX = box.x + (box.width * 0.5);
        const addPointY = box.y + (box.height * 0.25);

        await clearHarnessDebugLog(page);
        await page.mouse.click(addPointX, addPointY);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "added MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 3,
        );
        let points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        const addedPoint = { ...points[1] };
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        const addedPointCircle = surface.locator("circle").nth(1);
        const addedPointBox = await addedPointCircle.boundingBox();
        assert.ok(addedPointBox);
        const addedPointCenterX = addedPointBox.x + (addedPointBox.width * 0.5);
        const addedPointCenterY = addedPointBox.y + (addedPointBox.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(addedPointCenterX, addedPointCenterY);
        await page.mouse.down();
        await page.mouse.move(addedPointCenterX + 40, addedPointCenterY - 48, { steps: 6 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "moved MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points[1]?.x > 0.5,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        assert.equal(points[0].x, 0);
        assert.equal(points[0].y, 0);
        assert.equal(points[2].x, 1);
        assert.equal(points[2].y, 1);
        assert.equal(points[0].x < points[1].x && points[1].x < points[2].x, true);
        assert.equal(points[1].x > addedPoint.x, true);
        assert.equal(points[1].y > addedPoint.y, true);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(1).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "deleted MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 2,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(0).click();
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        }));
        snapshot = await getHarnessSnapshot(page);
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );

        await page.keyboard.press("Escape");
        await page.waitForSelector('[data-role="mseg-editor-dialog"]', { state: "detached" });
        assert.notEqual(
            await presetBarHost.evaluate((element) => getComputedStyle(element).display),
            "none",
            "The preset bar must return after the MSEG editor closes.",
        );
    } finally {
        await page.close();
    }
});

test("mobile MSEG editor is a contained synth surface with a dominant graph and recovery controls", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');

        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        await dialog.waitFor();
        assert.equal(await dialog.getAttribute("role"), "dialog");
        assert.equal(await dialog.getAttribute("aria-modal"), "true");
        assert.equal(await dialog.getAttribute("aria-label"), "MSEG 1 editor");
        assert.equal(await dialog.locator('text="Modulation Shape Editor"').count(), 0);
        assert.equal(await dialog.locator('text=/Drag a point to move/i').count(), 0);

        const layout = await dialog.evaluate((element) => {
            const graph = element.querySelector('[data-role="mseg-editor-graph"]');
            const footer = element.querySelector('[data-role="mseg-editor-controls"]');
            const bounds = element.getBoundingClientRect();
            if (!(graph instanceof HTMLElement) || !(footer instanceof HTMLElement)) {
                return null;
            }
            const graphBounds = graph.getBoundingClientRect();
            const footerBounds = footer.getBoundingClientRect();
            return {
                bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height },
                graphHeight: graphBounds.height,
                footerHeight: footerBounds.height,
                documentScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                activeRole: document.activeElement?.getAttribute("data-role") ?? "",
            };
        });
        assert.ok(layout);
        assert.equal(layout.bounds.left >= 0 && layout.bounds.right <= 393, true);
        assert.equal(layout.bounds.top >= 0 && layout.bounds.bottom <= 852, true);
        assert.equal(layout.documentScrollWidth <= 393 && layout.bodyScrollWidth <= 393, true);
        assert.equal(layout.graphHeight > layout.footerHeight * 1.5, true);
        assert.equal(layout.graphHeight >= layout.bounds.height * 0.48, true);
        assert.equal(layout.activeRole, "mseg-editor-done");

        for (const role of ["mseg-editor-done", "mseg-shape-a", "mseg-shape-b", "mseg-editor-undo", "mseg-loop-toggle"]) {
            const target = dialog.locator(`[data-role="${role}"]`);
            const box = await target.boundingBox();
            assert.ok(box, `${role} should be visible`);
            assert.equal(box.width >= 44 && box.height >= 44, true, `${role} must be touchable`);
        }
        assert.equal(await dialog.locator('[data-role="mseg-editor-undo"]').isDisabled(), true);
        assert.equal(await dialog.locator('[data-role="mseg-rate-readout"]').count(), 1);

        const surface = dialog.locator('svg[data-role="mseg-editor-surface"]');
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);
        await page.mouse.click(surfaceBox.x + surfaceBox.width * 0.5, surfaceBox.y + surfaceBox.height * 0.25);
        await waitForHarnessSnapshot(
            page,
            "mobile MSEG point",
            (snapshot) => readStoredMsegShape(snapshot).points.length === 3,
        );
        assert.equal(await dialog.locator('[data-role="mseg-editor-undo"]').isEnabled(), true);
        assert.match(await dialog.locator('[data-role="mseg-coordinate-hud"]').innerText(), /T\s+\d+\.\d{3}\s+·\s+V\s+[+-]?\d+\.\d{3}/);

        await dialog.locator('[data-role="mseg-editor-undo"]').click();
        await waitForHarnessSnapshot(
            page,
            "undone mobile MSEG point",
            (snapshot) => readStoredMsegShape(snapshot).points.length === 2,
        );
    } finally {
        await page.close();
    }
});

test("MSEG preview progress fill follows the selected DSP slot and clears when the monitor goes inactive", async () => {
    const page = await openHarnessPage();

    try {
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 7,
                hasActive: 1,
                positions: [0.2, 0.58, 0.86],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip);
        });

        let renderedState = await getHarnessRenderedState(page);
        let previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.2)) <= 1.5,
            true,
        );

        await page.click('button[aria-label="Select MSEG 2"]');
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip)
                && preview.progressClip.width > 100;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.58)) <= 1.5,
            true,
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 8,
                hasActive: 0,
                positions: [1, 1, 1],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview) && !preview.progressClip;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.equal(previewState.playhead, null);
        assert.equal(previewState.progressClip, null);
    } finally {
        await page.close();
    }
});

test("main MSEG morph control updates morph without taking keyboard focus and previews the effective curve while dragged", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");

        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync before morph drag",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1),
        );
        await clearHarnessDebugLog(page);
        await page.mouse.move(sliderBox.x + 2, sliderBox.y + (sliderBox.height * 0.5));
        await page.mouse.down();
        await page.mouse.move(sliderBox.x + (sliderBox.width * 0.72), sliderBox.y + (sliderBox.height * 0.5), { steps: 6 });

        await page.waitForFunction(() => Boolean(window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.effectiveCurvePath));
        let renderedState = await getHarnessRenderedState(page);
        assert.match(renderedState.msegPreviewState?.effectiveCurvePath ?? "", /^M /);
        assert.match(renderedState.msegPreviewState?.shapeACurvePath ?? "", /^M /);
        assert.match(renderedState.msegPreviewState?.shapeBCurvePath ?? "", /^M /);
        assert.notEqual(
            renderedState.msegPreviewState?.effectiveCurvePath,
            renderedState.msegPreviewState?.shapeACurvePath,
            "The preview's primary curve should be the morphed A/B result, not always shape A.",
        );

        const focusedElement = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const activeElement = viewRoot?.activeElement;

            return {
                tagName: activeElement?.tagName?.toLowerCase() ?? null,
                dataRole: activeElement?.getAttribute("data-role") ?? null,
                ariaLabel: activeElement?.getAttribute("aria-label") ?? null,
            };
        });
        assert.notEqual(focusedElement.dataRole, "mseg-morph-slider");
        assert.notEqual(focusedElement.tagName, "input");

        await page.keyboard.press("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });
        const morphMidiSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            morphMidiSnapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );

        await page.mouse.up();
        await page.waitForFunction(() => Boolean(window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.effectiveCurvePath));

        const snapshot = await waitForHarnessSnapshot(
            page,
            "main MSEG morph changed",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["modulation.v6"];
                const modulationState = typeof rawState === "string" ? JSON.parse(rawState) : null;
                return Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.72) <= 0.04
                    && (modulationState === null || !("morph" in (modulationState.msegSlots?.[0] ?? {})));
            },
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Morph"),
            true,
            "the morph drag must reach the real parameter endpoint",
        );
        const rawModulationState = snapshot.storedState["modulation.v6"];
        if (typeof rawModulationState === "string") {
            assert.equal("morph" in JSON.parse(rawModulationState).msegSlots[0], false);
        }
    } finally {
        await page.close();
    }
});

test("main MSEG morph control closes its host gesture when the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(sliderBox.x + 2, sliderBox.y + (sliderBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.filter((value) => value === "mseg1Morph").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "mseg1Morph").length, 1);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("main MSEG morph touch drag survives unavailable pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");
        await morphSlider.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);

        const pointerId = 94;
        const clientY = sliderBox.y + (sliderBox.height * 0.5);
        await morphSlider.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: sliderBox.x + 2,
            clientY,
        });
        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId,
            clientX: sliderBox.x + (sliderBox.width * 0.75),
            clientY,
        });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free MSEG morph touch move",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.mseg1Morph) > 0.7,
        );
        assert.deepEqual(snapshot.gestureStarts, ["mseg1Morph"]);

        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId,
            clientX: sliderBox.x + (sliderBox.width * 0.75),
            clientY,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free MSEG morph touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("mseg1Morph"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["mseg1Morph"]);
    } finally {
        await page.close();
    }
});

test("MSEG rate drag stops changing values after the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        const rateInput = page.locator('input[aria-label="MSEG rate"]').first();
        await rateInput.scrollIntoViewIfNeeded();
        const inputBox = await rateInput.boundingBox();
        assert.ok(inputBox, "Expected the MSEG rate input to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(inputBox.x + (inputBox.width * 0.5), inputBox.y + (inputBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.move(inputBox.x + inputBox.width + 120, inputBox.y + (inputBox.height * 0.5));
        await page.mouse.up();
        await page.waitForTimeout(100);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Rate"),
            false,
        );
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("MSEG rate touch drag survives unavailable pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        const rateInput = page.locator('input[aria-label="MSEG rate"]').first();
        await rateInput.scrollIntoViewIfNeeded();
        const inputBox = await rateInput.boundingBox();
        assert.ok(inputBox, "Expected the MSEG rate input to be visible.");
        await rateInput.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointer = {
            pointerId: 83,
            pointerType: "touch",
            button: 0,
            clientY: inputBox.y + (inputBox.height * 0.5),
        };
        await rateInput.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientX: inputBox.x + (inputBox.width * 0.5),
        });
        await page.evaluate(({ clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                cancelable: true,
                pointerId: 83,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
            }));
            window.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                pointerId: 83,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
            }));
        }, {
            clientX: inputBox.x + (inputBox.width * 0.5) + 20,
            clientY: inputBox.y + (inputBox.height * 0.5),
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "touch-adjusted MSEG rate without pointer capture",
            (nextSnapshot) => {
                return Number(nextSnapshot.parameterValues.mseg1Rate) > 1.2
                    && nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Rate");
            },
        );
        assert.equal(Number(snapshot.parameterValues.mseg1Rate) > 1.2, true);
    } finally {
        await page.close();
    }
});

test("MSEG overview rate updates its host parameter while loop policy updates modulation.v6", { timeout: 60_000 }, async () => {
    const isolatedServer = await startDesktopHarnessServer();
    const isolatedBrowser = await chromium.launch({ headless: true });
    const page = await isolatedBrowser.newPage();

    try {
        await page.goto(isolatedServer.baseUrl, { waitUntil: "load" });
        await waitForHarnessReady(page);
        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegPlayback" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
        );

        const depthInputCount = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            return viewRoot?.querySelectorAll('input[aria-label="MSEG depth"]').length ?? 0;
        });
        assert.equal(depthInputCount, 0);

        await clearHarnessDebugLog(page);
        const rateAfterChange = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const rateInput = viewRoot?.querySelector('input[aria-label="MSEG rate"]');

            if (!(rateInput instanceof HTMLInputElement)) {
                throw new Error("MSEG rate input is missing.");
            }

            rateInput.value = "0.500";
            rateInput.dispatchEvent(new Event("input", { bubbles: true }));
            rateInput.dispatchEvent(new Event("change", { bubbles: true }));

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
                if (Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 0.5) <= 1e-9) {
                    return Number(snapshot.parameterValues.mseg1Rate);
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.mseg1Rate);
        });
        assert.equal(rateAfterChange, 0.5);
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.mseg1Rate), 0.5);
        assert.equal("rate" in readStoredMsegPlayback(snapshot), false);

        await clearHarnessDebugLog(page);
        const playbackAfterLoopToggle = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const loopButton = Array.from(viewRoot?.querySelectorAll("button") ?? []).find((button) =>
                button.textContent?.trim() === "Looping"
            );

            if (!(loopButton instanceof HTMLButtonElement)) {
                throw new Error("MSEG loop button is missing.");
            }

            loopButton.click();

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
                const rawState = snapshot.storedState["modulation.v6"];
                if (typeof rawState !== "string") {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    continue;
                }

                const modulationState = JSON.parse(rawState);
                const playback = modulationState.msegSlots?.[0]?.playback;
                if (playback?.loop === null) {
                    return playback;
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return JSON.parse(String(snapshot.storedState["modulation.v6"])).msegSlots?.[0]?.playback;
        });
        assert.equal(playbackAfterLoopToggle.loop, null);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredMsegPlayback(snapshot).loop, null);
        assert.ok((await page.getByRole("button", { name: "One Shot" }).count()) >= 1);
    } finally {
        await page.close();
        await isolatedBrowser.close();
        await isolatedServer.stop();
    }
});

test("desktop custom-element wrapper detaches the keyboard when the host element is removed", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardAttachCalls?.length === 1;
        });

        await page.evaluate(() => {
            document.querySelector("cosimo-desktop-react-view")?.remove();
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardDetachCount === 1;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.keyboardAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.keyboardDetachCount, 1);
    } finally {
        await page.close();
    }
});

test("desktop distortion controls send exact parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        await page.waitForSelector('[data-role="rack-editor-drive"]');
        await clearHarnessDebugLog(page);

        await page.click('[data-role="distortion-mode-option-1"]');
        await editRackParameterValue(page, "distortion-drive-field", "18.5");
        await editRackParameterValue(page, "distortion-mix-field", "64");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "distortion parameter updates",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionMode"
                && Number(value) === 1
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionDriveDb"
                && Math.abs(Number(value) - 18.5) <= 1e-6
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionWet"
                && Math.abs(Number(value) - 0.64) <= 1e-6
            )),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionMode"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionDriveDb"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionWet"), true);
    } finally {
        await page.close();
    }
});

test("desktop effects rack renders the complete ordered eight-module surface", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');

        const layout = await page.evaluate(() => {
            const rack = document.querySelector('[data-role="effects-rack-card"]');
            const modules = Array.from(document.querySelectorAll("[data-rack-position]"));

            if (!(rack instanceof HTMLElement)) {
                return null;
            }

            const rackRect = rack.getBoundingClientRect();

            return {
                moduleCount: modules.length,
                effectIds: modules.map((module) => module.getAttribute("data-role")?.replace("rack-module-", "")),
                positions: modules.map((module) => Number(module.getAttribute("data-rack-position"))),
                rackWidth: rackRect.width,
                rackHeight: rackRect.height,
            };
        });

        assert.ok(layout, "Expected effects rack to render.");
        assert.equal(layout.moduleCount, 8);
        assert.deepEqual(layout.effectIds, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
        assert.deepEqual(layout.positions, [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.ok(layout.rackWidth > 0 && layout.rackHeight > 0);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb, 5);
        await page.locator('[data-role="distortion-drive-field"]').click({ button: "right" });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterListenerCounts.distortionDriveDb === 6
        ));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterListenerCounts.distortionDriveDb === 5
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb, 5);
    } finally {
        await page.close();
    }
});

test("mobile workspace keeps Voice FX and Mod visible while exactly one accordion section is expanded", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        const accordion = page.locator('[data-role="mobile-workspace-accordion"]');
        assert.equal(await accordion.count(), 1);

        const sectionButtons = accordion.locator('[data-role^="mobile-workspace-toggle-"]');
        assert.deepEqual(await sectionButtons.allTextContents(), ["Voice", "FX", "Mod"]);
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-expanded"))
        )), ["true", "false", "false"]);
        assert.equal(await accordion.locator('[data-role="mobile-workspace-panel-voice"]').count(), 1);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return counts.filterSpectrum === 1
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0
                && counts.effectiveMsegState === 1;
        });

        await accordion.locator('[data-role="mobile-workspace-toggle-fx"]').click();
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-expanded"))
        )), ["false", "true", "false"]);
        assert.equal(await accordion.locator('[data-role="mobile-workspace-panel-fx"] [data-role="effects-rack-card"]').count(), 1);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && counts.distortionHistory === 1
                && counts.distortionScope === 1
                && counts.effectiveMsegState === 1;
        });

        await page.locator('[data-role="rack-quick-filter"]').click();
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return counts.filterSpectrum === 1
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0;
        });
        await page.locator('[data-role="rack-quick-chorus"]').click();
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0;
        });

        await accordion.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-expanded"))
        )), ["false", "false", "true"]);
        assert.equal(await accordion.locator('[data-role="mobile-workspace-panel-mod"] [data-role="mobile-mod-matrix"]').count(), 1);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0
                && counts.effectiveMsegState === 1;
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 12,
                hasActive: 1,
                positions: [0.72, 0.4, 0.2],
            });
        });
        await page.waitForFunction(() => Boolean(
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.progressClip,
        ));
        await accordion.locator('[data-role="mobile-workspace-toggle-voice"]').click();
        await accordion.locator('[data-role="mobile-workspace-toggle-mod"]').click();
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        const renderedState = await getHarnessRenderedState(page);
        assert.ok(
            renderedState.msegPreviewState?.progressClip,
            "The globally visible MSEG activity monitor must survive accordion navigation.",
        );
    } finally {
        await page.close();
    }
});

test("mobile Voice stacks the full-width focused oscillator editor and filter row above a short unlabeled keyboard", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.waitForSelector('[data-role="mobile-workspace-panel-voice"]');
        const renderedState = await getHarnessRenderedState(page);
        const layout = await page.evaluate(() => {
            const wavetable = document.querySelector('[data-role="mobile-voice-editor"]');
            const filter = document.querySelector('[data-role="filter-card"]');
            const keyboard = document.querySelector('[data-role="sticky-keyboard"] > section');
            const railLabel = document.querySelector('[data-role="sticky-keyboard"] .synth-control-rail > span');
            const railReadout = document.querySelector('[data-role="sticky-keyboard"] .synth-control-rail > div');

            if (!(wavetable instanceof HTMLElement)
                || !(filter instanceof HTMLElement)
                || !(keyboard instanceof HTMLElement)
                || !(railLabel instanceof HTMLElement)
                || !(railReadout instanceof HTMLElement)) {
                return null;
            }

            const wavetableRect = wavetable.getBoundingClientRect();
            const filterRect = filter.getBoundingClientRect();
            const keyboardRect = keyboard.getBoundingClientRect();

            return {
                stackedRows: filterRect.top >= wavetableRect.bottom + 8,
                alignedLeft: Math.abs(wavetableRect.left - filterRect.left) <= 1,
                wavetableWidth: wavetableRect.width,
                filterWidth: filterRect.width,
                keyboardHeight: keyboardRect.height,
                railLabelDisplay: getComputedStyle(railLabel).display,
                railReadoutDisplay: getComputedStyle(railReadout).display,
            };
        });

        assert.equal(renderedState.keyboardNoteCount, "18");
        assert.ok(layout);
        assert.equal(layout.stackedRows, true);
        assert.equal(layout.alignedLeft, true);
        assert.equal(Math.abs(layout.wavetableWidth - layout.filterWidth) <= 1, true);
        assert.equal(layout.wavetableWidth > 280 && layout.filterWidth > 280, true);
        assert.equal(layout.keyboardHeight <= 84, true);
        assert.equal(layout.railLabelDisplay, "none");
        assert.equal(layout.railReadoutDisplay, "none");
    } finally {
        await page.close();
    }
});

test("a second tap on the selected rack source deep-links Mod and Back restores the exact FX context", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.click();
        await source.click();

        assert.equal(
            await page.locator('[data-role="mobile-workspace-toggle-mod"]').getAttribute("aria-expanded"),
            "true",
        );
        const editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "mseg");
        assert.equal(await editor.getAttribute("data-source-slot"), "1");
        assert.match(
            (await page.locator('[data-role="mobile-mod-filter-token"]').innerText()).trim(),
            /MSEG 1\s*×/,
        );
        assert.equal(
            await page.locator('[data-role="mobile-mod-route-row"]').evaluateAll((rows) => (
                rows.every((row) => /MSEG 1/.test(row.textContent ?? ""))
            )),
            true,
        );

        await page.click('[data-role="mobile-workspace-back"]');
        assert.equal(
            await page.locator('[data-role="mobile-workspace-toggle-fx"]').getAttribute("aria-expanded"),
            "true",
        );
        assert.equal(await source.getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator('[data-role="rack-editor-drive"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("rack deep links open the exact Envelope and Macro editor slots without introducing LFOs", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);

        const envelope = page.locator('[data-role="rack-mod-source-env-1"]');
        await envelope.click();
        await envelope.click();
        let editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "env");
        assert.equal(await editor.getAttribute("data-source-slot"), "1");

        await page.click('[data-role="mobile-workspace-back"]');
        await expandGlobalModRail(page);
        await page.click('[aria-label="Next modulation-source group"]');
        await page.waitForTimeout(300);
        const macro = page.locator('[data-role="rack-mod-source-macro-2"]');
        await macro.click();
        await macro.click();

        editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "macro");
        assert.equal(await editor.getAttribute("data-source-slot"), "2");
        assert.equal(await page.locator('[data-role="macro-source-value-2"]').count(), 1);
        assert.equal(/\blfo\b/i.test(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText()), false);
    } finally {
        await page.close();
    }
});

test("rack continuous parameters use the approved stippled dual-ring knobs instead of native ranges", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("role"), "slider");
        assert.equal(await knob.locator(".rack-knob-base-track").count(), 1);
        assert.equal(await knob.locator(".rack-knob-base-fill").count(), 1);
        assert.equal(await knob.locator(".rack-knob-mod-track").count(), 1);
        assert.equal(await knob.locator(".rack-knob-mod-fill").count(), 1);
        assert.equal(
            await page.locator('[data-role="rack-editor-reverb"] input[type="range"]').count(),
            0,
        );
    } finally {
        await page.close();
    }
});

test("rack knobs retain a fixed default marker while the live base indicator moves", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const readPositions = () => knob.evaluate((element) => {
            const defaultMarker = element.querySelector(".rack-knob-default-marker");
            const liveHandle = element.querySelector(".rack-knob-handle");
            if (!(defaultMarker instanceof SVGCircleElement) || !(liveHandle instanceof SVGCircleElement)) {
                return null;
            }
            return {
                default: [defaultMarker.getAttribute("cx"), defaultMarker.getAttribute("cy")],
                live: [liveHandle.getAttribute("cx"), liveHandle.getAttribute("cy")],
            };
        });
        const before = await readPositions();
        assert.ok(before);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.82, true);
        });
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-reverbSize"]')?.value === "0.82");
        const after = await readPositions();
        assert.ok(after);
        assert.deepEqual(after.default, before.default);
        assert.notDeepEqual(after.live, before.live);
    } finally {
        await page.close();
    }
});

test("rack knob base drags capture the pointer, show a stable HUD, and detach cleanly on release", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const centerX = box.x + (box.width / 2);
        const centerY = box.y + (box.height / 2);

        await page.mouse.move(centerX - 8, centerY);
        await page.mouse.move(centerX + 8, centerY, { steps: 5 });
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, []);

        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        assert.equal(await page.locator('[data-role="rack-parameter-hud"]').count(), 0);
        await page.mouse.move(centerX, centerY - 10, { steps: 3 });
        await page.waitForSelector('[data-role="rack-parameter-hud"]');
        assert.match(await page.locator('[data-role="rack-parameter-hud"]').innerText(), /BASE.*Size/i);
        assert.match(
            await page.locator('[data-role="rack-parameter-hud"]').evaluate((element) => getComputedStyle(element).fontFamily),
            /system-ui/,
        );
        const hudLayout = await page.locator('[data-role="rack-parameter-hud"]').evaluate((element) => {
            const hud = element.getBoundingClientRect();
            const knob = document.querySelector('[data-role="rack-parameter-reverbSize"]')?.getBoundingClientRect();
            const style = getComputedStyle(element);
            return knob ? {
                pointerEvents: style.pointerEvents,
                intersectsKnob: !(hud.right <= knob.left || hud.left >= knob.right || hud.bottom <= knob.top || hud.top >= knob.bottom),
                onScreen: hud.left >= 0 && hud.top >= 0 && hud.right <= window.innerWidth && hud.bottom <= window.innerHeight,
            } : null;
        });
        assert.ok(hudLayout);
        assert.equal(hudLayout.pointerEvents, "none");
        assert.equal(hudLayout.intersectsKnob, false, "The gesture HUD must not cover the active knob.");
        assert.equal(hudLayout.onScreen, true, "The gesture HUD must remain fully on screen.");

        await page.mouse.move(centerX, centerY - 34, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-hud"]') === null);

        snapshot = await waitForHarnessSnapshot(
            page,
            "rack knob pointer gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);

        const valueAfterRelease = Number(snapshot.parameterValues.reverbSize);
        await clearHarnessDebugLog(page);
        await page.mouse.move(centerX, centerY + 20, { steps: 6 });
        await page.mouse.move(centerX, centerY - 20, { steps: 6 });
        await page.waitForTimeout(60);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.reverbSize), valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages, []);
    } finally {
        await page.close();
    }
});

test("rack knob touch drag survives unavailable pointer capture outside the knob", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const artBox = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(artBox);
        await knob.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        const pointerId = 97;
        const start = {
            x: artBox.x + (artBox.width / 2),
            y: artBox.y + (artBox.height / 2),
        };
        const moved = { x: start.x, y: start.y - 40 };
        await knob.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack knob touch move",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack knob touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
        assert.equal(await page.locator('[data-role="rack-parameter-hud"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("rack knob outer-ring drags edit only the selected source-target modulation route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "initial zero-depth reverb route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "mapped");
        assert.equal(await knob.locator(".rack-knob-route-presence").count(), 1);
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const outerX = box.x + (box.width * 0.75);
        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(outerX, centerY);
        await page.mouse.down();
        await page.mouse.move(outerX + 38, centerY, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        const hud = page.locator('[data-role="rack-parameter-hud"]');
        assert.equal(await hud.getAttribute("data-mode"), "modulation");
        assert.match(await hud.innerText(), /MOD.*Size/i);
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "outer-ring route amount",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
                && route.amount > 0.01
            )),
        );
        const route = readStoredModulationState(snapshot).routes.find((candidate) => (
            candidate.sourceKind === "mseg"
            && candidate.sourceSlot === 1
            && candidate.targetKind === "rack.reverbSize"
        ));
        assert.ok(route);
        assert.equal(Number(snapshot.parameterValues.reverbSize), 0.5);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"] .rack-knob-mod-fill')
                ?.getAttribute("d") !== ""
        ));
        assert.notEqual(await knob.locator(".rack-knob-mod-fill").getAttribute("d"), "");
    } finally {
        await page.close();
    }
});

test("rack parameter frames stay neutral while badges and armed rings tell route ownership", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: 0.35, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await collapseGlobalModRail(page);

        const mixSurface = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const driveSurface = page.locator('[data-role="rack-parameter-surface-distortionDriveDb"]');
        const mixKnob = mixSurface.locator('[data-role="distortion-mix-field"]');
        const visual = await mixSurface.evaluate((element) => {
            const knob = element.querySelector('.rack-parameter-knob');
            const outerTrack = element.querySelector('.rack-knob-mod-track');
            const innerFill = element.querySelector('.rack-knob-base-fill');
            if (!(knob instanceof HTMLElement) || !(outerTrack instanceof SVGElement) || !(innerFill instanceof SVGElement)) {
                return null;
            }
            const surfaceStyle = getComputedStyle(element);
            return {
                className: element.className,
                borderColor: surfaceStyle.borderColor,
                boxShadow: surfaceStyle.boxShadow,
                routeState: knob.dataset.routeState,
                trackStroke: getComputedStyle(outerTrack).stroke,
                innerFill: getComputedStyle(innerFill).fill,
            };
        });
        assert.ok(visual);
        assert.equal(visual.className.includes("has-route"), false);
        assert.equal(visual.className.includes("is-selected-target"), false);
        assert.equal(visual.routeState, "unmapped");
        assert.equal(visual.borderColor, "rgba(255, 255, 255, 0.08)");
        assert.equal(/184, 226, 54/.test(`${visual.borderColor} ${visual.boxShadow}`), false);
        assert.equal(visual.trackStroke, "rgba(210, 220, 222, 0.42)");
        assert.equal(visual.innerFill, "rgb(213, 220, 222)");
        assert.equal(await mixKnob.getAttribute("aria-label"), "Mix");
        const badge = mixSurface.locator('[data-role="rack-route-count-distortionWet"]');
        assert.equal((await badge.textContent()).trim(), "1");
        assert.match(await badge.getAttribute("aria-label"), /1 modulation route target Mix/);
        assert.equal((await badge.getAttribute("class")).includes("is-solid"), true);
        assert.equal((await driveSurface.getAttribute("class")).includes("is-selected-target"), true);
        assert.equal(
            await driveSurface.evaluate((element) => getComputedStyle(element).borderColor),
            "rgba(223, 230, 232, 0.78)",
        );
    } finally {
        await page.close();
    }
});

test("switching armed sources swaps only selected-route outer geometry and preserves exact target count", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: 0.2, reducer: "max" },
                { id: "env-mix", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: -0.55, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("distortionWet", 0.6, true);
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        const mix = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const readRing = () => mix.evaluate((element) => {
            const knob = element.querySelector('.rack-parameter-knob');
            const fill = element.querySelector('.rack-knob-mod-fill');
            return knob instanceof HTMLElement && fill instanceof SVGPathElement
                ? { color: knob.style.getPropertyValue("--rack-knob-mod-accent"), path: fill.getAttribute("d") }
                : null;
        });

        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const msegRing = await readRing();
        await page.click('[data-role="rack-mod-source-env-1"]');
        const envRing = await readRing();
        assert.ok(msegRing && envRing);
        assert.equal(msegRing.color, "#cc59d2");
        assert.equal(envRing.color, "#b8e236");
        assert.notEqual(msegRing.path, envRing.path);
        assert.equal((await mix.locator('[data-role="rack-route-count-distortionWet"]').textContent()).trim(), "2");
        assert.equal((await mix.getAttribute("class")).includes("is-selected-target"), false);
    } finally {
        await page.close();
    }
});

test("an unmapped rack knob shows a neutral outer track and horizontal drag cannot create a route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        let knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "no-source");
        assert.equal(await knob.locator(".rack-knob-mod-track.is-hidden").count(), 1);

        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "unmapped");
        assert.equal(await knob.locator(".rack-knob-mod-track.is-unmapped").count(), 1);
        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await clearHarnessDebugLog(page);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 42, start.y, { steps: 8 });
        assert.match(await page.locator('[data-role="rack-parameter-hud"]').innerText(), /NOT MAPPED.*CREATE MAPPING/i);
        await page.mouse.up();

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
            false,
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"), false);
    } finally {
        await page.close();
    }
});

test("editing a bypassed rack route preserves bypass and renders the outer ring as bypassed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(page, "route before bypass-preserving edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize")
        ));
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]').click();
        await waitForHarnessSnapshot(page, "bypassed route before amount edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "rack.reverbSize")?.enabled === false
        ));
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        assert.equal(await knob.locator(".rack-knob-route-presence.is-bypassed").count(), 1);

        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        const liveBypassedStyle = await knob.locator('.rack-knob-mod-fill').evaluate((element) => {
            const style = getComputedStyle(element);
            return { opacity: style.opacity, dash: style.strokeDasharray, filter: style.filter };
        });
        assert.equal(liveBypassedStyle.opacity, "0.28");
        assert.notEqual(liveBypassedStyle.dash, "none");
        assert.equal(liveBypassedStyle.filter, "none");
        await page.mouse.up();
        const snapshot = await waitForHarnessSnapshot(page, "bypassed route amount edit", (nextSnapshot) => {
            const route = readStoredModulationState(nextSnapshot).routes.find((candidate) => candidate.targetKind === "rack.reverbSize");
            return route !== undefined && route.amount > 0.01;
        });
        assert.equal(
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "rack.reverbSize")?.enabled,
            false,
        );
    } finally {
        await page.close();
    }
});

test("a stationary touch hold on a rack knob opens its routing menu with one haptic bump", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 375, height: 667 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before rack parameter hold",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const box = await knob.boundingBox();
        assert.ok(box);
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await knob.dispatchEvent("pointerdown", {
            pointerId: 41,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: point.x,
            clientY: point.y,
        });
        await page.waitForTimeout(560);

        const menu = page.locator('[data-role="rack-parameter-menu"]');
        await menu.waitFor();
        assert.deepEqual(
            await menu.locator('[data-role="rack-parameter-menu-item"]').evaluateAll((items) => (
                items.map((item) => item.getAttribute("data-action"))
            )),
            [
                "edit-values",
                "reset-base",
                "toggle-route",
                "polarity",
                "reducer",
                "remove-route",
                "remove-all-target-routes",
            ],
        );
        assert.deepEqual(await page.evaluate(() => window.__rackHaptics), ["light"]);

        await knob.dispatchEvent("pointerup", {
            pointerId: 41,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: point.x,
            clientY: point.y,
        });
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
        assert.deepEqual(snapshot.sentMessages, []);
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
    } finally {
        await page.close();
    }
});

test("moving a rack knob touch cancels the hold menu and completes one captured value gesture", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 375, height: 667 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await knob.dispatchEvent("pointerdown", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await knob.dispatchEvent("pointermove", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y - 28,
        });
        await page.waitForTimeout(560);
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
        assert.deepEqual(await page.evaluate(() => window.__rackHaptics), []);
        await knob.dispatchEvent("pointerup", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x,
            clientY: start.y - 28,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "completed touch knob gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
    } finally {
        await page.close();
    }
});

test("rack parameter reset restores the base default without deleting modulation routes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before base reset",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.84, true);
        });
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="rack-parameter-reverbSize"]').click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack base default reset",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.5) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
            true,
        );
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("rack parameter menu edits the active route enablement polarity and voice reducer", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before context edits",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const routeForSize = (snapshot) => readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "rack.reverbSize"
        ));

        await knob.click({ button: "right" });
        let action = page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]');
        assert.equal((await action.textContent()).trim(), "Bypass route");
        await action.click();
        await waitForHarnessSnapshot(page, "bypassed rack route", (snapshot) => routeForSize(snapshot)?.enabled === false);

        await knob.click({ button: "right" });
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]');
        assert.equal((await action.textContent()).trim(), "Enable route");
        await action.click();
        await waitForHarnessSnapshot(page, "enabled rack route", (snapshot) => routeForSize(snapshot)?.enabled === true);

        await knob.click({ button: "right" });
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="polarity"]');
        assert.equal((await action.textContent()).trim(), "Polarity: Unipolar");
        await action.click();
        await waitForHarnessSnapshot(page, "bipolar rack route", (snapshot) => routeForSize(snapshot)?.polarity === "bipolar");

        await knob.click({ button: "right" });
        assert.equal(
            (await page.locator('[data-role="rack-parameter-menu-item"][data-action="polarity"]').textContent()).trim(),
            "Polarity: Bipolar",
        );
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="reducer"]');
        assert.equal((await action.textContent()).trim(), "Voice reducer: Maximum");
        await action.click();
        await waitForHarnessSnapshot(page, "mean rack route reducer", (snapshot) => routeForSize(snapshot)?.reducer === "mean");

        await knob.click({ button: "right" });
        assert.equal(
            (await page.locator('[data-role="rack-parameter-menu-item"][data-action="reducer"]').textContent()).trim(),
            "Voice reducer: Mean",
        );
    } finally {
        await page.close();
    }
});

test("rack exact-value sheet applies real-unit base and selected-route amounts", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before exact rack edit",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        await sheet.waitFor();
        const sheetVisual = await sheet.evaluate((element) => ({
            backgroundImage: getComputedStyle(element).backgroundImage,
            fontFamilies: Array.from(element.querySelectorAll("button, em, input, label, p, span, strong"))
                .map((child) => getComputedStyle(child).fontFamily),
        }));
        assert.equal(sheetVisual.backgroundImage, "none");
        assert.equal(sheetVisual.fontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        const baseInput = sheet.locator('[data-role="rack-base-value-input"]');
        const amountInput = sheet.locator('[data-role="rack-modulation-value-input"]');
        assert.equal(await baseInput.inputValue(), "50");
        assert.equal(await amountInput.inputValue(), "0");

        await amountInput.fill("35");
        await sheet.locator('[data-role="rack-value-sheet-default"]').click();
        assert.equal(await baseInput.inputValue(), "50");
        assert.equal(await amountInput.inputValue(), "35");
        await baseInput.fill("72");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "exact rack values applied",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes.find((candidate) => (
                    candidate.sourceKind === "mseg"
                    && candidate.sourceSlot === 1
                    && candidate.targetKind === "rack.reverbSize"
                ));
                return Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.72) < 0.0001
                    && route !== undefined
                    && Math.abs(route.amount - 0.35) < 0.0001;
            },
        );
        assert.equal(Math.abs(Number(snapshot.parameterValues.reverbSize) - 0.72) < 0.0001, true);
        assert.equal(await sheet.count(), 0);
    } finally {
        await page.close();
    }
});

test("rack exact-value editing never creates an unrequested modulation route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();

        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        const amountInput = sheet.locator('[data-role="rack-modulation-value-input"]');
        assert.equal(await amountInput.isDisabled(), true);
        assert.equal((await sheet.locator('[data-role="rack-value-sheet-no-route"]').textContent()).trim(), "Arm a source to edit its route.");
        await sheet.locator('[data-role="rack-base-value-input"]').fill("64");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "base-only exact rack edit",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.64) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize"),
            false,
        );
    } finally {
        await page.close();
    }
});

test("rack parameter menu hides route removal when the target has no routes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await page.locator('[data-role="rack-parameter-reverbSize"]').click({ button: "right" });

        const menu = page.locator('[data-role="rack-parameter-menu"]');
        assert.doesNotMatch(await menu.innerText(), /Remove this route/i);
        assert.equal(await menu.locator('[data-action="remove-route"]').count(), 0);
        assert.equal(await menu.locator('[data-action="remove-all-target-routes"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("rack parameter menus never edit a hidden default-source route while no source is armed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "hidden-mseg-route", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.45, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "no-source");
        await knob.click({ button: "right" });
        for (const action of ["toggle-route", "polarity", "remove-route"]) {
            assert.equal(
                await page.locator(`[data-role="rack-parameter-menu-item"][data-action="${action}"]`).count(),
                0,
                action,
            );
        }
        assert.equal(
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-all-target-routes"]').count(),
            1,
        );
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        assert.match(await sheet.innerText(), /No armed source.*Arm a source to edit its route/is);
        assert.equal(await sheet.locator('[data-role="rack-modulation-value-input"]').isDisabled(), true);
        assert.equal(
            readStoredModulationState(await getHarnessSnapshot(page)).routes.find((route) => route.id === "hidden-mseg-route")?.amount,
            0.45,
        );
    } finally {
        await page.close();
    }
});

test("rack parameter route removal targets one source or confirms removal of every target route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await page.click('[data-role="rack-mod-source-env-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "two source routes before removal",
            (snapshot) => readStoredModulationState(snapshot).routes.filter(
                (route) => route.targetKind === "rack.reverbSize",
            ).length === 2,
        );
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');

        await knob.click({ button: "right" });
        const menuTypography = await page.locator('[data-role="rack-parameter-menu-item"]').first().evaluate((item) => {
            const style = getComputedStyle(item);
            return {
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                letterSpacing: style.letterSpacing,
            };
        });
        assert.match(menuTypography.fontFamily, /system-ui/);
        assert.doesNotMatch(menuTypography.fontFamily, /Departure Mono/);
        assert.equal(menuTypography.fontSize, "13px");
        assert.equal(menuTypography.letterSpacing, "normal");
        const removeSelectedRoute = page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-route"]');
        assert.equal((await removeSelectedRoute.textContent()).trim(), "Remove ENV 1 route");
        await removeSelectedRoute.click();
        let snapshot = await waitForHarnessSnapshot(
            page,
            "single selected rack route removed",
            (nextSnapshot) => {
                const routes = readStoredModulationState(nextSnapshot).routes;
                return !routes.some((route) => route.sourceKind === "env" && route.targetKind === "rack.reverbSize")
                    && routes.some((route) => route.sourceKind === "mseg" && route.targetKind === "rack.reverbSize");
            },
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.filter((route) => route.targetKind === "rack.reverbSize").length,
            1,
        );

        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        await knob.click({ button: "right" });
        const removeAllRoutes = page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-all-target-routes"]');
        const removeAllBounds = await removeAllRoutes.boundingBox();
        assert.ok(removeAllBounds && removeAllBounds.y >= 0 && removeAllBounds.y + removeAllBounds.height <= 667);
        await removeAllRoutes.click();
        const confirmation = page.locator('[data-role="rack-remove-target-routes-confirmation"]');
        await confirmation.waitFor();
        assert.match(await confirmation.textContent(), /remove all 1 route/i);
        const confirmationVisual = await confirmation.evaluate((element) => ({
            backgroundImage: getComputedStyle(element).backgroundImage,
            fontFamilies: Array.from(element.querySelectorAll("button, p, span, strong"))
                .map((child) => getComputedStyle(child).fontFamily),
        }));
        assert.equal(confirmationVisual.backgroundImage, "none");
        assert.equal(confirmationVisual.fontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize"),
            true,
        );
        await confirmation.locator('[data-role="rack-remove-target-routes-confirm"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "all rack target routes removed",
            (nextSnapshot) => !readStoredModulationState(nextSnapshot).routes.some(
                (route) => route.targetKind === "rack.reverbSize",
            ),
        );
        assert.equal(await confirmation.count(), 0);
    } finally {
        await page.close();
    }
});

test("short-phone rack knobs form a touchable three-column matrix", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        const controls = page.locator('[data-role="rack-editor-reverb"] .rack-editor-control');
        assert.equal(await controls.count(), 4);
        const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        }));
        assert.equal(Math.abs(boxes[0].y - boxes[1].y) < 1, true);
        assert.equal(Math.abs(boxes[1].y - boxes[2].y) < 1, true);
        assert.equal(boxes[3].y > boxes[0].y + 40, true);
        assert.equal(boxes.every((box) => box.width >= 52 && box.height >= 68), true);
    } finally {
        await page.close();
    }
});

test("mobile Mod joins one compact source selector to its editor without the legacy chip grid", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        const editor = page.locator('.mobile-mod-source-editor');
        const frame = editor.locator('[data-role="mobile-mod-integrated-editor"]');
        const selector = frame.locator('[data-role="mobile-mod-source-selector"]');
        const typeSelect = selector.locator('[data-role="mobile-mod-source-type"]');
        const numberSelect = selector.locator('[data-role="mobile-mod-source-number"]');

        await selector.waitFor();
        assert.equal(await typeSelect.inputValue(), "mseg");
        assert.equal(await numberSelect.inputValue(), "1");
        assert.deepEqual(await typeSelect.locator("option").allTextContents(), ["MSEG", "ENV", "MACRO"]);
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3"]);
        assert.equal(await editor.locator('[data-role="mobile-mod-source-family"]').count(), 0);
        assert.equal(await editor.locator('[data-role="mod-fixed-sources"]').count(), 0);
        assert.equal(/\blfo\b/i.test(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText()), false);
    } finally {
        await page.close();
    }
});

test("mobile Mod selector drives the attached editor and stays contained at iPhone width", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.click();
        await source.click();

        const editor = page.locator('.mobile-mod-source-editor');
        const frame = editor.locator('[data-role="mobile-mod-integrated-editor"]');
        const selector = frame.locator('[data-role="mobile-mod-source-selector"]');
        const typeSelect = selector.locator('[data-role="mobile-mod-source-type"]');
        const numberSelect = selector.locator('[data-role="mobile-mod-source-number"]');
        const editorState = editor.locator('[data-role="mod-source-editor"]');

        await selector.waitFor();
        for (const width of [393, 320]) {
            await page.setViewportSize({ width, height: 852 });
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const layout = await frame.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const dock = element.querySelector('[data-role="mobile-mod-source-selector"]');
                const body = element.querySelector('[data-role="mobile-mod-editor-body"]');
                const controls = element.querySelector('[data-role="mobile-mod-active-controls"]');
                const typeControl = element.querySelector('[data-role="mobile-mod-source-type"]')?.parentElement;
                const numberControl = element.querySelector('[data-role="mobile-mod-source-number"]')?.parentElement;

                if (!dock || !body || !controls || !typeControl || !numberControl) {
                    throw new Error("Expected the integrated mobile Mod editor structure.");
                }

                const dockBounds = dock.getBoundingClientRect();
                const bodyBounds = body.getBoundingClientRect();
                const controlsBounds = controls.getBoundingClientRect();
                const readControl = (control) => {
                    const controlBounds = control.getBoundingClientRect();
                    const style = getComputedStyle(control);
                    return {
                        width: controlBounds.width,
                        height: controlBounds.height,
                        borderWidth: style.borderTopWidth,
                        borderRadius: parseFloat(style.borderTopLeftRadius),
                        backgroundColor: style.backgroundColor,
                    };
                };

                return {
                    clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    dockRightAligned: Math.abs(dockBounds.right - bounds.right) <= 1,
                    dockLoopsAboveFrame: dockBounds.top < bounds.top && dockBounds.bottom >= bounds.top,
                    bodyPrecedesControls: bodyBounds.bottom <= controlsBounds.top + 1,
                    typeControl: readControl(typeControl),
                    numberControl: readControl(numberControl),
                };
            });
            assert.equal(layout.scrollWidth <= layout.clientWidth + 1, true, `Source editor overflows at ${width}px.`);
            assert.equal(layout.documentScrollWidth <= width, true, `Document overflows at ${width}px.`);
            assert.equal(layout.dockRightAligned, true);
            assert.equal(layout.dockLoopsAboveFrame, true);
            assert.equal(layout.bodyPrecedesControls, true);
            assert.equal(layout.typeControl.borderWidth, "0px");
            assert.equal(layout.numberControl.borderWidth, "0px");
            assert.equal(layout.typeControl.borderRadius >= 6 && layout.numberControl.borderRadius >= 6, true);
            assert.notEqual(layout.typeControl.backgroundColor, "rgba(0, 0, 0, 0)");
            assert.notEqual(layout.numberControl.backgroundColor, "rgba(0, 0, 0, 0)");
            assert.equal(layout.typeControl.height >= 24 && layout.typeControl.width <= 72, true);
            assert.equal(layout.numberControl.height >= 24 && layout.numberControl.width <= 40, true);

            const back = page.locator('[data-role="mobile-workspace-back"]');
            const backBounds = await back.boundingBox();
            assert.ok(backBounds);
            assert.equal(backBounds.width >= 120 && backBounds.height >= 44, true);
            assert.equal(backBounds.x >= 0 && backBounds.x + backBounds.width <= width, true);
        }

        await typeSelect.selectOption("envelope");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "env"
        ));
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3"]);
        const envelopeSurface = frame.locator('[data-role="adsr-editor-surface"]');
        assert.equal(await envelopeSurface.count(), 1);
        assert.equal(await envelopeSurface.getAttribute("preserveAspectRatio"), "none");
        assert.deepEqual(
            await frame.locator('[data-role="mobile-mod-active-controls"] label > span').allTextContents(),
            ["Attack", "Decay", "Sustain", "Release"],
        );
        assert.equal(await frame.getByLabel("Envelope sustain value").inputValue(), "50%");
        await numberSelect.selectOption("3");
        assert.equal(await editorState.getAttribute("data-source-slot"), "3");

        await typeSelect.selectOption("macro");
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3", "4"]);
        assert.equal(/\bmacro 1\b/i.test(await frame.innerText()), false, "The selector must be the only source title.");

        await typeSelect.selectOption("mseg");
        await numberSelect.selectOption("2");
        assert.equal(await editorState.getAttribute("data-source-kind"), "mseg");
        assert.equal(await editorState.getAttribute("data-source-slot"), "2");
        assert.equal(await frame.getByRole("button", { name: "Open MSEG editor" }).count(), 1);
    } finally {
        await page.close();
    }
});

test("mobile Mod uses a complete one-dimensional route list with detail, filters, and hierarchical creation", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.clear();
            });
        },
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mobile-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "bipolar", targetKind: "rack.flangerDepth", amount: -0.39, reducer: "max" },
                { id: "mobile-route-2", enabled: true, sourceKind: "macro", sourceSlot: 1, polarity: "unipolar", targetKind: "oscA.wavetablePosition", amount: 0.2, reducer: "max" },
                { id: "mobile-route-3", enabled: false, sourceKind: "env", sourceSlot: 2, polarity: "unipolar", targetKind: "filterCutoffOctaves", amount: 1.5, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes?.length === 3;
        });
        await page.click('[data-role="mobile-workspace-toggle-mod"]');

        const matrix = page.locator('[data-role="mobile-mod-matrix"]');
        await matrix.waitFor();
        assert.equal(await page.locator('[data-role="desktop-mod-matrix"]').count(), 0);
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), "3 mappings");
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 3);

        const geometry = await matrix.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            rows: Array.from(element.querySelectorAll('[data-role="mobile-mod-route-row"]')).map((row) => {
                const bounds = row.getBoundingClientRect();
                return { left: bounds.left, right: bounds.right, height: bounds.height };
            }),
        }));
        assert.equal(geometry.scrollWidth <= geometry.clientWidth + 1, true);
        assert.equal(geometry.documentScrollWidth <= 393, true);
        assert.equal(geometry.rows.every((row) => row.left >= 0 && row.right <= 393 && row.height >= 56), true);
        const msegRouteRow = matrix.locator('[data-role="mobile-mod-route-row"]', { hasText: "MSEG 1" });
        assert.match(await msegRouteRow.innerText(), /MSEG 1.*Flanger.*Depth.*-39%/s);

        await matrix.locator('[data-role="mobile-mod-route-open-0"]').click();
        const detail = matrix.locator('[data-role="mobile-mod-route-detail"]');
        await detail.waitFor();
        for (const role of ["mobile-mod-detail-back", "mobile-mod-polarity", "mobile-mod-bypass", "mobile-mod-delete"]) {
            const bounds = await detail.locator(`[data-role="${role}"]`).boundingBox();
            assert.ok(bounds);
            assert.equal(bounds.width >= 44 && bounds.height >= 44, true, `${role} must be touchable`);
        }
        assert.equal(await detail.locator('[data-role="mobile-mod-reducer"]').count(), 1);
        assert.equal(await detail.locator('[data-role="mobile-mod-amount-slider"]').count(), 1);
        assert.equal(await detail.locator('[data-role="mobile-mod-amount-input"]').count(), 1);
        await detail.locator('[data-role="mobile-mod-amount-input"]').fill("-25");
        await detail.locator('[data-role="mobile-mod-amount-input"]').press("Enter");
        await waitForHarnessSnapshot(
            page,
            "mobile exact route amount",
            (snapshot) => Math.abs(readStoredModulationState(snapshot).routes[0]?.amount - (-0.25)) < 0.0001,
        );
        await detail.locator('[data-role="mobile-mod-detail-back"]').click();

        await matrix.locator('[data-role="mobile-mod-filter"]').click();
        const filters = matrix.locator('[data-role="mobile-mod-filter-sheet"]');
        await filters.locator('[data-role="mobile-mod-filter-source-mseg-1"]').click();
        await filters.locator('[data-role="mobile-mod-filter-done"]').click();
        assert.equal(await matrix.locator('[data-role="mobile-mod-filter-token"]').count(), 1);
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 1);
        await matrix.locator('[data-role="mobile-mod-filter-token-remove"]').click();
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 3);

        await matrix.locator('[data-role="mobile-mod-add"]').click();
        await matrix.locator('[data-role="mobile-mod-create-source-macro-2"]').click();
        await matrix.locator('[data-role="mobile-mod-create-category-fx"]').click();
        await matrix.locator('[data-role="mobile-mod-create-effect-reverb"]').click();
        await matrix.locator('[data-role="mobile-mod-create-target-rack-reverbSize"]').click();
        await waitForHarnessSnapshot(
            page,
            "hierarchically-created mobile route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.match(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), /4 mappings/i);
    } finally {
        await page.close();
    }
});

test("mobile Mod creates, reloads, edits, and deletes more than 100 mappings without a public route ceiling", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const targets = [
            "oscA.wavetablePosition",
            "oscA.warpAmount",
            "filterCutoffOctaves",
            "filterQ",
            "oscA.pitchSemitones",
            "oscA.ampGainDb",
            "oscA.pan",
            "oscA.unisonDetune",
            "oscA.unisonBlend",
            "oscA.unisonWidth",
            "oscA.unisonWavetablePositionSpread",
            "oscA.unisonWarpSpread",
        ];
        const sources = [
            ["mseg", 1], ["mseg", 2], ["mseg", 3],
            ["env", 1], ["env", 2], ["env", 3],
            ["velocity", null], ["pressure", null], ["slide", null],
        ];
        const routes = [];
        for (const [sourceKind, sourceSlot] of sources) {
            for (const targetKind of targets) {
                routes.push({
                    id: `large-${sourceKind}-${sourceSlot ?? "fixed"}-${targetKind}`,
                    enabled: true,
                    sourceKind,
                    sourceSlot,
                    polarity: "unipolar",
                    targetKind,
                    amount: 0,
                    reducer: "max",
                });
            }
        }
        const seededState = normalizeModulationState({ routes: routes.slice(0, 101) });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        const matrix = page.locator('[data-role="mobile-mod-matrix"]');
        await matrix.waitFor();
        assert.equal(await matrix.locator('[data-role="mobile-mod-add"]').isDisabled(), false);
        assert.match(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), /101 mappings/i);

        await clearHarnessDebugLog(page);
        await matrix.locator('[data-role="mobile-mod-add"]').click();
        await matrix.locator('[data-role="mobile-mod-create-source-slide"]').click();
        await matrix.locator('[data-role="mobile-mod-create-category-voice"]').click();
        await matrix.locator('[data-role="mobile-mod-create-target-oscA-ampGainDb"]').click();
        let snapshot = await waitForHarnessSnapshot(page, "102nd explicit mobile mapping", (nextSnapshot) => (
            readStoredModulationState(nextSnapshot).routes.length === 102
        ));
        const after = readStoredModulationState(snapshot).routes;
        assert.equal(after.length, 102);
        assert.equal(new Set(after.map((route) => `${route.sourceKind}:${route.sourceSlot}->${route.targetKind}`)).size, 102);
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationProgram" && Number(value?.voiceRouteCount) === 102
        )), true);

        const createdRoute = after[101];
        assert.ok(createdRoute);
        await page.addInitScript((persistedState) => {
            window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                storedState: { "modulation.v6": JSON.stringify(persistedState) },
            };
        }, readStoredModulationState(snapshot));
        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        await page.locator('[data-role="mobile-mod-matrix"]').waitFor();
        await page.waitForFunction((routeId) => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            if (rawState === undefined) return false;
            const state = JSON.parse(String(rawState));
            return state.routes?.length === 102 && state.routes.some((route) => route.id === routeId);
        }, createdRoute.id);
        assert.match(await page.locator('[data-role="mobile-mod-route-count"]').innerText(), /102 mappings/i);

        await page.locator('[data-role="mobile-mod-route-open-101"]').click();
        await clearHarnessDebugLog(page);
        const amountInput = page.locator('[data-role="mobile-mod-amount-input"]');
        await amountInput.fill("-12");
        await amountInput.blur();
        snapshot = await waitForHarnessSnapshot(page, "editing the restored 102nd mapping", (nextSnapshot) => (
            Math.abs(Number(readStoredModulationState(nextSnapshot).routes[101]?.amount) - (-12)) <= 1e-9
        ));
        assert.equal(hasRuntimeAmount(snapshot, readStoredModulationState(snapshot).routes[101], -12), true);

        await page.locator('[data-role="mobile-mod-delete"]').click();
        snapshot = await waitForHarnessSnapshot(page, "deleting the restored 102nd mapping", (nextSnapshot) => {
            const nextRoutes = readStoredModulationState(nextSnapshot).routes;
            return nextRoutes.length === 101 && !nextRoutes.some((route) => route.id === createdRoute.id);
        });
        assert.equal(latestRuntimeProgram(snapshot)?.voiceRouteCount, 101);
    } finally {
        await page.close();
    }
});

test("phone touch drags are captured by rack grips and modulation chips without scrolling the interface", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });
    const cdp = await page.context().newCDPSession(page);
    const touchDrag = async (from, to) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: from.x, y: from.y, radiusX: 6, radiusY: 6, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: from.x + ((to.x - from.x) * progress),
                    y: from.y + ((to.y - from.y) * progress),
                    radiusX: 6,
                    radiusY: 6,
                    force: 1,
                }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await clearHarnessDebugLog(page);
        const initialScroll = await page.evaluate(() => ({
            windowY: window.scrollY,
            documentY: document.documentElement.scrollTop,
        }));

        const gripBox = await page.locator('[data-role="rack-reorder-handle-reverb"]').boundingBox();
        const filterBox = await page.locator('[data-role="rack-module-filter"]').boundingBox();
        assert.ok(gripBox && filterBox);
        await touchDrag(
            { x: gripBox.x + gripBox.width / 2, y: gripBox.y + gripBox.height / 2 },
            { x: filterBox.x + filterBox.width / 2, y: filterBox.y + filterBox.height / 2 },
        );
        let snapshot = await waitForHarnessSnapshot(
            page,
            "touch rack reorder",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder").length, 1);

        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        const sourceBox = await page.locator('[data-role="rack-mod-source-env-1"]').boundingBox();
        const targetBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(sourceBox && targetBox);
        await touchDrag(
            { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 },
            touchPointForModSourcePreviewTarget(
                { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 },
                { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 },
                375,
                667,
            ),
        );
        snapshot = await waitForHarnessSnapshot(
            page,
            "touch rack modulation drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.deepEqual(await page.evaluate(() => ({
            windowY: window.scrollY,
            documentY: document.documentElement.scrollTop,
        })), initialScroll);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

async function beginRackReorderWithoutPointerCapture(page, {
    pointerId,
    targetEffectID = null,
}) {
    await page.evaluate(({ pointerId: browserPointerId, targetEffectID: browserTargetEffectID }) => {
        const list = document.querySelector('[data-role="rack-module-list"]');
        const handle = document.querySelector('[data-role="rack-reorder-handle-reverb"]');
        const target = browserTargetEffectID === null
            ? null
            : document.querySelector(`[data-role="rack-module-${browserTargetEffectID}"]`);
        if (!(list instanceof HTMLElement) || !(handle instanceof HTMLElement)) {
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
        const handleBounds = handle.getBoundingClientRect();
        handle.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: browserPointerId,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: handleBounds.left + (handleBounds.width / 2),
            clientY: handleBounds.top + (handleBounds.height / 2),
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

async function endRackReorderWithoutPointerCapture(page, pointerId) {
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

test("rack reorder survives a platform pointer-capture rejection", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="rack-module-list"]');
        await clearHarnessDebugLog(page);

        await beginRackReorderWithoutPointerCapture(page, { pointerId: 92, targetEffectID: "filter" });
        await endRackReorderWithoutPointerCapture(page, 92);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "pointer-capture fallback rack reorder",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder").length, 1);
    } finally {
        await page.close();
    }
});

test("rack reorder keeps the latest desired enable state across an older effective readback", async () => {
    const page = await openHarnessPage();

    try {
        await page.click('[data-role="rack-enabled-chorus"]');
        await page.waitForFunction(() => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["rack.v1"];
            return rawState !== undefined && JSON.parse(String(rawState)).enabled.chorus === true;
        });
        await clearHarnessDebugLog(page);

        await beginRackReorderWithoutPointerCapture(page, { pointerId: 93, targetEffectID: "filter" });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
        ), null, { timeout: 1_000 });
        await page.evaluate(() => {
            const identityOrderCode = [0, 1, 2, 3, 4, 5, 6, 7].reduce(
                (code, moduleId, position) => code | (moduleId << (position * 3)),
                0,
            );
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveRackState", {
                committedStructureGeneration: 0,
                committedOrderCode: identityOrderCode,
                committedEnableMask: 0,
                rejectedOrderCount: 0,
                rejectedEnableCount: 0,
            });
        });
        await endRackReorderWithoutPointerCapture(page, 93);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack reorder after stale effective readback",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["rack.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const state = JSON.parse(String(rawState));
                return state.order[0] === "reverb";
            },
        );
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.equal(storedRack.enabled.chorus, true);
        const lastEnable = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackEnable").at(-1);
        assert.equal(Number(lastEnable?.value?.enabledFlags?.[3]), 1);
    } finally {
        await page.close();
    }
});

test("rack no-op release adopts authoritative stored order received during the gesture", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        await beginRackReorderWithoutPointerCapture(page, { pointerId: 94 });
        await page.waitForSelector(".rack-unit.is-reordering");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("rack.v1", JSON.stringify({
                format: "cosimo.rack",
                version: 1,
                order: ["reverb", "filter", "drive", "ott", "chorus", "flanger", "phaser", "delay"],
                enabled: {
                    filter: false,
                    drive: false,
                    ott: false,
                    chorus: true,
                    flanger: false,
                    phaser: false,
                    delay: false,
                    reverb: false,
                },
            }));
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-chorus"]')?.getAttribute("data-enabled") === "true"
            && document.querySelector(".rack-unit.is-reordering") !== null
        ));
        assert.equal(
            await page.locator('[data-role="rack-module-list"] > :first-child').getAttribute("data-role"),
            "rack-module-filter",
            "authoritative order must not replace the preview while the gesture is active",
        );
        await endRackReorderWithoutPointerCapture(page, 94);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
        ), null, { timeout: 1_000 });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "rackOrder"), false);
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.equal(storedRack.order[0], "reverb");
        assert.equal(storedRack.enabled.chorus, true);
    } finally {
        await page.close();
    }
});

test("mobile workspace keeps the synth preset bar visible and contained at 320px", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 667 }),
    });

    try {
        const host = page.locator('[data-role="synth-preset-bar-host"]');
        await host.waitFor();
        const layout = await host.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const accordion = document.querySelector('[data-role="mobile-workspace-accordion"]');
            const presetBar = element.querySelector("cosimo-preset-bar")?.shadowRoot?.querySelector(".preset-bar");
            const presetName = element.querySelector("cosimo-preset-bar")?.shadowRoot?.querySelector('[data-el="preset-name"]');
            return {
                display: getComputedStyle(element).display,
                left: bounds.left,
                right: bounds.right,
                height: bounds.height,
                accordionTop: accordion instanceof HTMLElement ? accordion.getBoundingClientRect().top : null,
                presetBarHeight: presetBar instanceof HTMLElement ? presetBar.getBoundingClientRect().height : null,
                presetName: presetName?.textContent?.trim() ?? null,
            };
        });

        assert.notEqual(layout.display, "none");
        assert.equal(layout.left >= 0 && layout.right <= 320, true);
        assert.equal(layout.height, 40);
        assert.equal(layout.presetBarHeight, 38);
        assert.equal(layout.accordionTop >= layout.height, true);
        assert.equal(layout.presetName, "No Preset");
    } finally {
        await page.close();
    }
});

test("mobile FX subpage keeps all eight approved rack rows visible and confines modulation controls to the editor", async () => {
    for (const width of [320, 375, 390, 430]) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize({ width, height: 667 }),
        });

        try {
            await page.click('[data-role="mobile-workspace-toggle-fx"]');
            await page.waitForSelector('[data-role="mobile-effects-region"] [data-role="effects-rack-card"]');

            const layout = await page.evaluate(() => {
                const rectOf = (element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                };
                const units = Array.from(document.querySelectorAll("[data-rack-position]"));
                const list = document.querySelector(".rack-list");
                const editor = document.querySelector(".rack-effect-editor");
                const amount = document.querySelector(".rack-mod-amount, [data-role=\"rack-unmapped-pair\"]");
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                const wordmarks = Array.from(document.querySelectorAll(".rack-wordmark"));
                const powers = Array.from(document.querySelectorAll(".rack-power"));
                const quickLines = Array.from(document.querySelectorAll(".rack-quick-line"));
                const rawRanges = Array.from(document.querySelectorAll(
                    '[data-role="effects-rack-card"] input[type="range"]',
                ));

                if (!(list instanceof HTMLElement)
                    || !(editor instanceof HTMLElement)
                    || !(keyboard instanceof HTMLElement)) {
                    return null;
                }

                return {
                    viewportWidth: window.innerWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    units: units.map(rectOf),
                    list: rectOf(list),
                    editor: rectOf(editor),
                    amount: amount instanceof HTMLElement ? rectOf(amount) : null,
                    keyboard: rectOf(keyboard),
                    wordmarks: wordmarks.map((wordmark, index) => ({
                        ...rectOf(wordmark),
                        row: rectOf(units[index]),
                    })),
                    powers: powers.map(rectOf),
                    quickLinesAreSingleRow: quickLines.every((line) => {
                        const children = Array.from(line.children).map(rectOf);
                        return getComputedStyle(line).display === "flex"
                            && children.length === 2
                            && Math.abs(children[0].top - children[1].top) <= 1
                            && Math.abs(children[0].bottom - children[1].bottom) <= 1
                            && Array.from(line.children).every((child) => getComputedStyle(child).whiteSpace === "nowrap");
                    }),
                    rawRangesAreVisuallyHidden: rawRanges.every((range) => {
                        const style = getComputedStyle(range);
                        return style.position === "absolute"
                            && (style.clip !== "auto" || style.clipPath !== "none")
                            && Number.parseFloat(style.width) <= 1
                            && Number.parseFloat(style.height) <= 1;
                    }),
                };
            });

            assert.ok(layout, `Expected compact rack layout at ${width}px.`);
            assert.equal(layout.units.length, 8, `Expected eight rack rows at ${width}px.`);
            assert.equal(layout.documentScrollWidth <= layout.viewportWidth, true, `Horizontal overflow at ${width}px.`);
            assert.equal(
                layout.units.every((unit) => Math.abs(unit.height - 48) <= 0.5),
                true,
                `Rack rows are not 48px at ${width}px: ${JSON.stringify(layout.units)}`,
            );
            assert.equal(layout.units[7].bottom <= layout.keyboard.top + 0.5, true, `Last rack row clips keyboard at ${width}px.`);
            assert.equal(layout.units[7].bottom <= 667, true, `All rack rows must remain in the viewport at ${width}px.`);
            if (layout.amount) {
                assert.equal(layout.amount.left >= layout.editor.left - 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.right <= layout.editor.right + 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.left >= layout.list.right - 0.5, true, `Amount control steals rack width at ${width}px.`);
            }
            assert.equal(layout.list.bottom >= layout.units[7].bottom - 0.5, true);
            assert.equal(
                layout.wordmarks.every(({ left, top, row }) => left >= row.left && top >= row.top && top - row.top <= 9),
                true,
                `Rack names are not upper-left aligned at ${width}px.`
            );
            assert.equal(
                layout.powers.every(({ width: powerWidth, height: powerHeight }) => powerWidth >= 44 && powerHeight >= 44),
                true,
                `Power targets are not touchable at ${width}px.`
            );
            assert.equal(layout.quickLinesAreSingleRow, true, `Quick values wrapped at ${width}px.`);
            assert.equal(layout.rawRangesAreVisuallyHidden, true, `Native rack ranges leaked visually at ${width}px.`);
        } finally {
            await page.close();
        }
    }
});

test("mobile Mod Bar is a curved global edge rail that survives accordion navigation", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        await rail.waitFor();
        await page.waitForTimeout(240);

        const initial = await rail.evaluate((element) => {
            const layer = element.closest('[data-role="mobile-global-mod-rail-layer"]');
            const body = element.querySelector('[data-role="mobile-global-mod-rail-body"]');
            const silhouette = element.querySelector('[data-role="mobile-global-mod-rail-silhouette"]');
            const selected = element.querySelector('[data-role="mobile-global-mod-rail-selected"]');
            const routeCount = element.querySelector('[data-role="mobile-global-mod-rail-route-count"]');
            const drawer = element.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
            const bodyStyle = body instanceof HTMLElement ? getComputedStyle(body) : null;
            return {
                expanded: element.getAttribute("data-expanded"),
                layerPointerEvents: layer instanceof HTMLElement ? getComputedStyle(layer).pointerEvents : null,
                railPointerEvents: getComputedStyle(element).pointerEvents,
                gripTouchAction: getComputedStyle(element.querySelector('[data-role="mobile-global-mod-rail-grip"]')).touchAction,
                silhouettePathCount: silhouette?.querySelectorAll("path").length ?? 0,
                fragmentShoulderCount: element.querySelectorAll('[data-role="mobile-global-mod-rail-shoulder"]').length,
                bodyLeftRadius: bodyStyle
                    ? Math.min(Number.parseFloat(bodyStyle.borderTopLeftRadius), Number.parseFloat(bodyStyle.borderBottomLeftRadius))
                    : null,
                bodyRightRadius: bodyStyle
                    ? Math.max(Number.parseFloat(bodyStyle.borderTopRightRadius), Number.parseFloat(bodyStyle.borderBottomRightRadius))
                    : null,
                railFlushRight: Math.abs(element.getBoundingClientRect().right - window.innerWidth) <= 0.5,
                selectedLabel: selected?.getAttribute("aria-label") ?? null,
                routeCount: routeCount?.textContent?.trim() ?? null,
                insideFxPanel: element.closest('[data-role="mobile-workspace-panel-fx"]') !== null,
                parentRole: layer?.getAttribute("data-role") ?? null,
                drawerHidden: drawer?.getAttribute("aria-hidden") ?? null,
                drawerInert: drawer instanceof HTMLElement ? drawer.inert : null,
            };
        });

        assert.equal(await page.locator('[data-role="mobile-workspace-toggle-voice"]').getAttribute("aria-expanded"), "true");
        assert.deepEqual(initial, {
            expanded: "false",
            layerPointerEvents: "none",
            railPointerEvents: "auto",
            gripTouchAction: "none",
            silhouettePathCount: 1,
            fragmentShoulderCount: 0,
            bodyLeftRadius: initial.bodyLeftRadius,
            bodyRightRadius: 0,
            railFlushRight: true,
            selectedLabel: "MSEG 1 selected",
            routeCount: initial.routeCount,
            insideFxPanel: false,
            parentRole: "mobile-global-mod-rail-layer",
            drawerHidden: "true",
            drawerInert: true,
        });
        assert.equal(
            typeof initial.bodyLeftRadius === "number" && initial.bodyLeftRadius >= 12,
            true,
            "The tab face must keep smoothly rounded left corners joining the curved shoulders.",
        );
        assert.match(initial.routeCount, /^\d+$/);
        assert.equal(await page.locator('.rack-editor-modulation [data-role="rack-mod-source-track"]').count(), 0);
        assert.equal(await grip.getAttribute("aria-expanded"), "false");
        await grip.press("Enter");
        assert.equal(await grip.getAttribute("aria-expanded"), "true");
        await grip.press("Space");
        assert.equal(await grip.getAttribute("aria-expanded"), "false");

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 11,
                hasActive: 1,
                positions: [0.35, 0.62, 0.88],
            });
        });
        const collapsedActivity = page.locator(".mobile-global-mod-rail-activity");
        await collapsedActivity.waitFor();
        assert.equal(await collapsedActivity.getAttribute("aria-label"), "MSEG 1 activity");
        assert.equal(
            await collapsedActivity.evaluate((element) => element.style.getPropertyValue("--source-activity")),
            "0.35",
        );

        await expandGlobalModRail(page);
        assert.equal(await page.locator('[data-role="rack-mod-source-track"]').isVisible(), true);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "false");

        const beforeNavigation = await rail.boundingBox();
        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        const afterNavigation = await rail.boundingBox();
        assert.ok(beforeNavigation && afterNavigation);
        assert.equal(await rail.isVisible(), true);
        assert.equal(Math.abs(beforeNavigation.x - afterNavigation.x) <= 1, true);
        assert.equal(await grip.getAttribute("aria-expanded"), "true");

        await collapseGlobalModRail(page);
        const beforeResizeNormalized = await rail.evaluate((element) => {
            const layer = element.closest('[data-role="mobile-global-mod-rail-layer"]');
            const keyboard = element.closest(".cosimo-surface")?.querySelector('[data-role="sticky-keyboard"]');
            const presetBar = element.closest(".cosimo-surface")?.querySelector('[data-role="synth-preset-bar-host"]');
            if (!(layer instanceof HTMLElement) || !(keyboard instanceof HTMLElement) || !(presetBar instanceof HTMLElement)) {
                return null;
            }
            const railBounds = element.getBoundingClientRect();
            const layerBounds = layer.getBoundingClientRect();
            const keyboardBounds = keyboard.getBoundingClientRect();
            const min = Math.max(8, presetBar.getBoundingClientRect().bottom - layerBounds.top + 8);
            const max = Math.max(min, keyboardBounds.top - layerBounds.top - railBounds.height - 8);
            return (railBounds.top - layerBounds.top - min) / Math.max(1, max - min);
        });
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(240);
        const safeLayout = await page.evaluate(() => {
            const railElement = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const layer = railElement?.closest('[data-role="mobile-global-mod-rail-layer"]');
            const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
            const presetBar = document.querySelector('[data-role="synth-preset-bar-host"]');
            if (
                !(railElement instanceof HTMLElement)
                || !(layer instanceof HTMLElement)
                || !(keyboard instanceof HTMLElement)
                || !(presetBar instanceof HTMLElement)
            ) {
                return null;
            }
            const railBounds = railElement.getBoundingClientRect();
            const layerBounds = layer.getBoundingClientRect();
            const keyboardBounds = keyboard.getBoundingClientRect();
            const min = Math.max(8, presetBar.getBoundingClientRect().bottom - layerBounds.top + 8);
            const max = Math.max(min, keyboardBounds.top - layerBounds.top - railBounds.height - 8);
            return {
                railTop: railBounds.top,
                railBottom: railBounds.bottom,
                keyboardTop: keyboardBounds.top,
                minimumTop: layerBounds.top + min,
                normalized: (railBounds.top - layerBounds.top - min) / Math.max(1, max - min),
            };
        });
        assert.ok(safeLayout);
        assert.notEqual(beforeResizeNormalized, null);
        assert.equal(safeLayout.railTop >= safeLayout.minimumTop - 0.5, true);
        assert.equal(safeLayout.railBottom <= safeLayout.keyboardTop - 8, true);
        assert.equal(
            Math.abs(safeLayout.normalized - beforeResizeNormalized) <= 0.04,
            true,
            "Viewport changes must preserve the rail's normalized vertical position.",
        );
    } finally {
        await page.close();
    }
});

test("global Mod Bar grip movement and source mapping have disjoint touch ownership", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await clearHarnessDebugLog(page);

        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const initialRouteCount = Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText());
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");
        const initialRailBox = await rail.boundingBox();
        const handleBox = await handle.boundingBox();
        assert.ok(initialRailBox && handleBox);
        const gripStart = {
            x: handleBox.x + (handleBox.width / 2),
            y: handleBox.y + (handleBox.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...gripStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: gripStart.x, y: gripStart.y - 72, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
        ));
        await page.waitForTimeout(220);

        const movedRailBox = await rail.boundingBox();
        assert.ok(movedRailBox);
        assert.equal(Math.abs(movedRailBox.y - initialRailBox.y) >= 24, true, "Grip drag did not reposition the rail.");
        assert.equal(await grip.getAttribute("aria-expanded"), "true", "Moving the grip must not toggle expansion.");
        assert.equal(await page.evaluate(() => localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") !== null), true);
        assert.equal((await getHarnessSnapshot(page)).sentMessages.length, 0, "Moving the rail must not create a route.");

        const railTopBeforeSourceDrag = (await rail.boundingBox())?.y;
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox && railTopBeforeSourceDrag !== undefined);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await rail.getAttribute("data-mapping-active"), "true");
        assert.equal(
            await rail.evaluate((element) => getComputedStyle(element).pointerEvents),
            "none",
            "The rail must become hit-transparent while a source is mapping onto controls beneath it.",
        );
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 1);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "true");
        await page.waitForTimeout(180);
        const retreatedRailBox = await rail.boundingBox();
        const activeGhostBox = await page.locator('[data-role="mobile-global-mod-source-ghost"]').boundingBox();
        assert.ok(retreatedRailBox && activeGhostBox);
        assert.equal(
            retreatedRailBox.x >= 393,
            true,
            `The Mod Bar must retreat fully beyond the right edge during source mapping. ${JSON.stringify(retreatedRailBox)}`,
        );
        assert.equal(
            activeGhostBox.x < 393 && activeGhostBox.x + activeGhostBox.width > 0,
            true,
            "The dragged source preview must remain visible while the Mod Bar retreats.",
        );

        const targetFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{
                x: targetFinger.x,
                y: targetFinger.y,
                radiusX: 5,
                radiusY: 5,
                force: 1,
            }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "global source rail drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.ok(snapshot);
        assert.equal(await rail.getAttribute("data-mapping-active"), "false");
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 0);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "false");
        await page.waitForTimeout(320);
        const restoredRailBox = await rail.boundingBox();
        assert.ok(restoredRailBox);
        assert.equal(Math.abs(restoredRailBox.y - railTopBeforeSourceDrag) <= 1, true, "Source drag moved the rail.");
        assert.equal(Math.abs(restoredRailBox.x + restoredRailBox.width - 393) <= 1, true, "The Mod Bar did not return to the right edge after the drop.");
        assert.equal(
            Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText()),
            initialRouteCount + 1,
        );

        await collapseGlobalModRail(page);
        const collapsedRailTop = (await rail.boundingBox())?.y;
        const collapsedSource = page.locator('[data-role="mobile-global-mod-rail-selected"]');
        const collapsedSourceBox = await collapsedSource.boundingBox();
        const secondTarget = page.locator('[data-role="rack-parameter-surface-reverbMix"]');
        const secondTargetBox = await secondTarget.boundingBox();
        assert.ok(collapsedRailTop !== undefined && collapsedSourceBox && secondTargetBox);
        const collapsedSourceStart = {
            x: collapsedSourceBox.x + (collapsedSourceBox.width / 2),
            y: collapsedSourceBox.y + (collapsedSourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...collapsedSourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: collapsedSourceStart.x - 18, y: collapsedSourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await rail.getAttribute("data-expanded"), "false", "Dragging the collapsed armed source must not expand the drawer.");
        assert.equal(await rail.getAttribute("data-mapping-active"), "true", "The collapsed armed source must begin route mapping.");
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 1);
        await page.waitForTimeout(180);
        assert.equal(
            ((await rail.boundingBox())?.x ?? 0) >= 393,
            true,
            "The collapsed Mod Bar must also retreat beyond the right edge during mapping.",
        );
        const secondTargetFinger = touchPointForModSourcePreviewTarget(
            collapsedSourceStart,
            { x: secondTargetBox.x + (secondTargetBox.width / 2), y: secondTargetBox.y + (secondTargetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{
                x: secondTargetFinger.x,
                y: secondTargetFinger.y,
                radiusX: 5,
                radiusY: 5,
                force: 1,
            }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "collapsed armed source drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbMix"
            )),
        );
        assert.equal(await rail.getAttribute("data-expanded"), "false");
        assert.equal(await rail.getAttribute("data-mapping-active"), "false");
        await page.waitForTimeout(180);
        const restoredCollapsedRailBox = await rail.boundingBox();
        assert.ok(restoredCollapsedRailBox);
        assert.equal(Math.abs(restoredCollapsedRailBox.y - collapsedRailTop) <= 1, true, "Dragging the collapsed source moved the bar.");
        assert.equal(Math.abs(restoredCollapsedRailBox.x + restoredCollapsedRailBox.width - 393) <= 1, true, "The collapsed Mod Bar did not return after the drop.");
        assert.equal(
            Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText()),
            initialRouteCount + 2,
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("the Mod rail docks to either screen edge and remembers its dock across launches", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        assert.equal(await rail.getAttribute("data-edge"), "right");

        const handle = rail.locator(".mobile-global-mod-rail-handle");
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox);
        const start = {
            x: handleBox.x + (handleBox.width / 2),
            y: handleBox.y + (handleBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        // Two intermediate points keep the drag classified before crossing the
        // midline, then release deep inside the left half.
        for (const x of [start.x - 80, start.x - 200, 60]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: start.y + 12, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="mobile-global-mod-rail"]');
            return element?.getAttribute("data-settling-x") === "false"
                && element.getAttribute("data-decelerating") === "false";
        });
        await page.waitForTimeout(300);

        assert.equal(await rail.getAttribute("data-edge"), "left");
        const dockedBox = await rail.boundingBox();
        assert.ok(dockedBox);
        assert.equal(Math.abs(dockedBox.x) <= 1, true, "The rail must settle flush against the left screen edge.");
        assert.equal(
            (await rail.locator('[data-role="mobile-global-mod-rail-silhouette"] path').getAttribute("d"))?.startsWith("M 0 0"),
            true,
            "The silhouette's shoulders must attach to the left screen edge after a left dock.",
        );

        const storedDock = await page.evaluate(() => (
            JSON.parse(localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") ?? "null")
        ));
        assert.equal(storedDock?.version, 2);
        assert.equal(storedDock?.edge, "left");
        assert.equal(storedDock.normalizedY >= 0 && storedDock.normalizedY <= 1, true);

        // The drawer still opens toward the screen from the left dock.
        await expandGlobalModRail(page);
        const drawerBox = await page.locator('[data-role="mobile-global-mod-rail-drawer"]').boundingBox();
        assert.ok(drawerBox);
        assert.equal(drawerBox.x >= -1 && drawerBox.x + drawerBox.width <= 200, true);
    } finally {
        await page.close();
    }

    const restoredPage = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript((value) => {
                localStorage.setItem("cosimo.mobile-global-mod-rail.position.v1", value);
            }, JSON.stringify({ version: 2, edge: "left", normalizedY: 0.8 }));
        },
    });
    try {
        const rail = restoredPage.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await restoredPage.waitForTimeout(240);
        assert.equal(await rail.getAttribute("data-edge"), "left");
        const box = await rail.boundingBox();
        assert.ok(box);
        assert.equal(Math.abs(box.x) <= 1, true, "A stored left dock must restore flush left.");
        assert.equal(box.y > 426, true, "A stored normalizedY of 0.8 must restore in the lower travel band.");
    } finally {
        await restoredPage.close();
    }

    const legacyPage = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mobile-global-mod-rail.position.v1", "0.42");
            });
        },
    });
    try {
        const rail = legacyPage.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await legacyPage.waitForTimeout(240);
        assert.equal(
            await rail.getAttribute("data-edge"),
            "right",
            "A legacy stored position predates edge docking and must restore on the right edge.",
        );
    } finally {
        await legacyPage.close();
    }
});

test("the Note key plays the remembered pitch, follows intentional notes, and never sticks", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const noteKey = rail.locator('[data-role="mobile-global-mod-rail-note"]');
        await noteKey.waitFor();
        await page.waitForTimeout(240);
        await clearHarnessDebugLog(page);

        // Before any intentional note the Note key plays middle C.
        const noteBox = await noteKey.boundingBox();
        assert.ok(noteBox);
        const noteCenter = { x: noteBox.x + (noteBox.width / 2), y: noteBox.y + (noteBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...noteCenter, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));
        assert.equal(await noteKey.getAttribute("data-note-held"), "true");

        // A vertical move while holding the key must neither move the rail nor
        // release the note: the key owns its pointer.
        const railTopWhileHeld = (await rail.boundingBox())?.y;
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: noteCenter.x, y: noteCenter.y + 48, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForTimeout(120);
        assert.equal((await rail.boundingBox())?.y, railTopWhileHeld, "Holding the Note key must not drag the rail.");
        assert.equal(await noteKey.getAttribute("data-note-held"), "true");

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60, 0) },
        ]);
        assert.equal(await noteKey.getAttribute("data-note-held"), "false");

        // An intentional note played on the on-screen keyboard becomes the
        // Note key's pitch (the element reports its own presses as
        // note-down/note-up, which host playback never dispatches).
        await page.evaluate(() => {
            const keyboard = document.querySelector('[data-role="sticky-keyboard"] .keyboard');
            keyboard.dispatchEvent(new CustomEvent("note-down", { detail: { note: 52 } }));
            keyboard.dispatchEvent(new CustomEvent("note-up", { detail: { note: 52 } }));
        });
        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...noteCenter, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));

        // Suspension while held must end the note exactly once.
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length >= 2
        ));
        await page.waitForTimeout(160);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 52, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 52, 0) },
        ]);
        assert.equal(await noteKey.getAttribute("data-note-held"), "false");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
        await page.close();
    }
});

test("the expanded drawer's Keyboard and Auto-preview toggles govern the keyboard and the Note-key dot", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        const autoToggle = rail.locator('[data-role="mobile-global-mod-rail-auto-toggle"]');
        const keyboardToggle = rail.locator('[data-role="mobile-global-mod-rail-keyboard-toggle"]');
        const noteDot = rail.locator('[data-role="mobile-global-mod-rail-note-dot"]');

        assert.equal(await autoToggle.getAttribute("aria-pressed"), "false");
        assert.equal(await noteDot.count(), 0);
        await autoToggle.click();
        assert.equal(await autoToggle.getAttribute("aria-pressed"), "true");
        assert.equal(await noteDot.count(), 1, "Active Auto-preview must light the Note key's status dot.");
        assert.deepEqual(
            await page.evaluate(() => JSON.parse(localStorage.getItem("cosimo.auto-preview.enabled.v1") ?? "null")),
            { version: 1, enabled: true },
        );

        const keyboard = page.locator('[data-role="sticky-keyboard"]');
        assert.equal(await keyboard.isVisible(), true);
        const beforeDebug = await getKeyboardDebug(page);
        await keyboardToggle.click();
        assert.equal(await keyboardToggle.getAttribute("aria-pressed"), "false");
        assert.equal(await keyboard.isVisible(), false, "The Keyboard toggle must hide the bottom keyboard.");
        const afterDebug = await getKeyboardDebug(page);
        assert.equal(
            Number(afterDebug?.allNotesOffCount ?? 0) >= Number(beforeDebug?.allNotesOffCount ?? 0) + 1,
            true,
            "Hiding the keyboard must release its held notes.",
        );
        await page.waitForTimeout(260);
        const railBoxWithoutKeyboard = await rail.boundingBox();
        assert.ok(railBoxWithoutKeyboard);
        assert.equal(
            railBoxWithoutKeyboard.y + railBoxWithoutKeyboard.height <= 852,
            true,
            "The rail must stay inside the viewport when the keyboard is hidden.",
        );

        await keyboardToggle.click();
        assert.equal(await keyboard.isVisible(), true);
        assert.equal(await keyboardToggle.getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("the Note key triggers audible output from every mobile editor state", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    const pressNoteKey = async (stateLabel) => {
        await clearHarnessDebugLog(page);
        const noteKey = page.locator('[data-role="mobile-global-mod-rail-note"]');
        const noteBox = await noteKey.boundingBox();
        assert.ok(noteBox, `${stateLabel}: the Note key must be present.`);
        const center = { x: noteBox.x + (noteBox.width / 2), y: noteBox.y + (noteBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...center, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ), undefined, { timeout: 4000 }).catch(() => {
            throw new Error(`${stateLabel}: pressing the Note key produced no note-on.`);
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60, 0) },
        ], `${stateLabel}: the Note key must play and release exactly the remembered pitch.`);
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);

        await pressNoteKey("Voice accordion");

        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await pressNoteKey("FX effect editor");

        // Create one route so the Mod views have a route to detail.
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const routeFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: routeFinger.x, y: routeFinger.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "note key path route creation",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env" && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);

        await page.click('[data-role="mobile-workspace-toggle-mod"]');
        await pressNoteKey("Mod overview");

        const routeRow = page.locator('[data-role="mobile-mod-route-row"]').first();
        await routeRow.waitFor();
        await routeRow.click();
        await pressNoteKey("Route detail");

        // Deep-link into the selected source's full editor from the drawer: the
        // first tap arms the source if it is not armed; the tap on an armed
        // source opens its editor.
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        if (!(await page.locator(".mobile-mod-return-bar").isVisible())) {
            await page.click('[data-role="rack-mod-source-mseg-1"]');
        }
        await page.locator(".mobile-mod-return-bar").waitFor();
        await pressNoteKey("Source editor");
    } finally {
        await page.close();
    }
});

test("Auto-preview retriggers on real parameter drags, stays silent when off, and cannot stick", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    const dragKnobVertically = async () => {
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);
        const start = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [12, 26, 40]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - step, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(40);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");

        // Off by default: a real value drag produces no audition notes.
        await clearHarnessDebugLog(page);
        await dragKnobVertically();
        await page.waitForTimeout(700);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [], "Auto-preview off must stay silent for value edits.");
        assert.notEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "reverbSize").length,
            0,
            "The drag itself must have edited the parameter.",
        );

        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-global-mod-rail-auto-toggle"]').click();
        await collapseGlobalModRail(page);

        // On: the same drag strikes the remembered pitch and settles with no
        // note left hanging.
        await clearHarnessDebugLog(page);
        await dragKnobVertically();
        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns >= 1 && noteOns === noteOffs;
        }, undefined, { timeout: 4000 });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.midiInputEvents.every(({ value }) => ((value >>> 8) & 0x7f) === 60),
            true,
            "With nothing held, Auto-preview must strike the remembered pitch (middle C).",
        );

        // Toggling off mid-hold can never leave a note sounding.
        await clearHarnessDebugLog(page);
        const surfaceBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(surfaceBox);
        const holdStart = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...holdStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: holdStart.x, y: holdStart.y - 30, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.some(({ value }) => (value >>> 16) === 0x90)
        ));
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns === noteOffs;
        }, undefined, { timeout: 2000 });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
        await page.close();
    }
});

test("Auto-preview with a routed looping MSEG still strikes, settles balanced, and never sticks", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");

        // Route the default-armed MSEG 1 (rate 1s, full-shape loop) onto a
        // rack parameter so the loop-sync path becomes eligible.
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const routeFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: routeFinger.x, y: routeFinger.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "mseg loop-sync route creation",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg" && route.targetKind === "rack.reverbSize"
            )),
        );

        await page.locator('[data-role="mobile-global-mod-rail-auto-toggle"]').click();
        await collapseGlobalModRail(page);

        // Drag the knob: strikes may defer to the loop grid (unit-pinned math)
        // but must still arrive, stay on the remembered pitch, and settle with
        // every note-on matched by a note-off.
        await clearHarnessDebugLog(page);
        const surfaceBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(surfaceBox);
        const dragStart = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...dragStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [14, 30, 46]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: dragStart.x, y: dragStart.y - step, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(50);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns >= 1 && noteOns === noteOffs;
        }, undefined, { timeout: 5000 });
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.midiInputEvents.every(({ value }) => ((value >>> 8) & 0x7f) === 60),
            true,
            "Loop-synced strikes must stay on the remembered pitch.",
        );
    } finally {
        await page.close();
    }
});

test("touch source mapping keeps its free preview while a sticky target claims the drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__modSourceCaptureHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__modSourceCaptureHaptics.push(style);
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);

        const sourceCenter = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const sourceToTarget = {
            x: targetCenter.x - sourceCenter.x,
            y: targetCenter.y - sourceCenter.y,
        };
        const sourceToTargetDistance = Math.hypot(sourceToTarget.x, sourceToTarget.y);
        assert.equal(sourceToTargetDistance > 128, true);
        const finger = touchPointForModSourcePreviewTarget(sourceCenter, targetCenter, 393);
        const thumbTravel = Math.hypot(finger.x - sourceCenter.x, finger.y - sourceCenter.y);
        assert.equal(
            thumbTravel <= sourceToTargetDistance * 0.55,
            true,
            `The preview should cross the surface with substantially less thumb travel. ${JSON.stringify({ thumbTravel, sourceToTargetDistance })}`,
        );

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceCenter, radiusX: 8, radiusY: 8, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...finger, radiusX: 8, radiusY: 8, force: 1 }],
        });

        const ghost = page.locator('[data-role="mobile-global-mod-source-ghost"]');
        await ghost.waitFor({ state: "visible" });
        assert.equal(
            Math.hypot(finger.x - targetCenter.x, finger.y - targetCenter.y) >= 60,
            true,
        );
        assert.equal((await target.getAttribute("class"))?.includes("is-mod-hover"), true);
        assert.equal(await ghost.getAttribute("data-target-captured"), "true");
        assert.deepEqual(await page.evaluate(() => window.__modSourceCaptureHaptics), ["light"]);

        const retainedPreviewPoint = targetCenter.x <= 393 / 2
            ? { x: targetBox.x + targetBox.width + 2, y: targetCenter.y }
            : { x: targetBox.x - 2, y: targetCenter.y };
        const retainedFinger = touchPointForModSourcePreviewTarget(sourceCenter, retainedPreviewPoint, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...retainedFinger, radiusX: 8, radiusY: 8, force: 1 }],
        });
        await page.waitForFunction(({ x, y }) => {
            const preview = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
            if (!(preview instanceof HTMLElement)) {
                return false;
            }
            return Math.hypot(Number.parseFloat(preview.style.left) - x, Number.parseFloat(preview.style.top) - y) <= 2;
        }, retainedPreviewPoint);

        const ghostBox = await ghost.boundingBox();
        assert.ok(ghostBox);
        const ghostCenter = {
            x: ghostBox.x + (ghostBox.width / 2),
            y: ghostBox.y + (ghostBox.height / 2),
        };
        assert.equal(
            Math.hypot(ghostCenter.x - retainedPreviewPoint.x, ghostCenter.y - retainedPreviewPoint.y) <= 2,
            true,
            `Target capture must not magnetize the preview. ${JSON.stringify({ ghostCenter, retainedPreviewPoint, targetCenter })}`,
        );
        assert.equal((await target.getAttribute("class"))?.includes("is-mod-hover"), true);
        assert.equal(await ghost.getAttribute("data-target-captured"), "true");
        assert.deepEqual(await page.evaluate(() => window.__modSourceCaptureHaptics), ["light"]);
        assert.equal(
            ghostBox.width >= 40,
            true,
            `Target capture must not resize the preview, got ${ghostBox.width}px.`,
        );

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "finger-clearing source drop",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => undefined);
        await cdp.detach();
        await page.close();
    }
});

function rectsIntersect(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function rectContains(outer, inner, tolerance = 0.5) {
    return inner.left >= outer.left - tolerance
        && inner.right <= outer.right + tolerance
        && inner.top >= outer.top - tolerance
        && inner.bottom <= outer.bottom + tolerance;
}

async function readGlobalModRailGeometry(page) {
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

test("the global modulation rail owns one continuous SVG silhouette", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.25 }),
                );
            });
        },
    });

    const readSilhouette = async () => await page.locator('[data-role="mobile-global-mod-rail"]').evaluate((rail) => {
        const silhouette = rail.querySelector('[data-role="mobile-global-mod-rail-silhouette"]');
        const paths = silhouette ? Array.from(silhouette.querySelectorAll("path")) : [];
        const path = paths[0] ?? null;
        const grip = rail.querySelector('[data-role="mobile-global-mod-rail-grip"]');
        const body = rail.querySelector('[data-role="mobile-global-mod-rail-body"]');
        const railBounds = rail.getBoundingClientRect();
        const silhouetteBounds = silhouette?.getBoundingClientRect() ?? null;
        const pathStyle = path ? getComputedStyle(path) : null;
        return {
            pathCount: paths.length,
            pathData: path?.getAttribute("d") ?? "",
            pathFill: pathStyle?.fill ?? null,
            pathStroke: pathStyle?.stroke ?? null,
            pathStrokeWidth: pathStyle?.strokeWidth ?? null,
            fragmentShoulderCount: rail.querySelectorAll('[data-role="mobile-global-mod-rail-shoulder"]').length,
            gripBackground: grip ? getComputedStyle(grip).backgroundColor : null,
            bodyBoxShadow: body ? getComputedStyle(body).boxShadow : null,
            railBounds: {
                left: railBounds.left,
                top: railBounds.top,
                width: railBounds.width,
                height: railBounds.height,
            },
            silhouetteBounds: silhouetteBounds ? {
                left: silhouetteBounds.left,
                top: silhouetteBounds.top,
                width: silhouetteBounds.width,
                height: silhouetteBounds.height,
            } : null,
        };
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readSilhouette();
        assert.equal(collapsed.pathCount, 1, "One SVG path must own the complete tab outline.");
        assert.match(collapsed.pathData, /Z\s*$/i, "The silhouette must be one closed contour.");
        assert.notEqual(collapsed.pathFill, "none", "The silhouette path must own the tab fill.");
        assert.notEqual(collapsed.pathStroke, "none", "The silhouette path must own the complete outline.");
        assert.equal(collapsed.pathStrokeWidth, "1px");
        assert.equal(collapsed.fragmentShoulderCount, 0, "Separate shoulder fragments must not paint the outline.");
        assert.equal(collapsed.gripBackground, "rgba(0, 0, 0, 0)", "The grip must not cover the silhouette stroke.");
        assert.equal(collapsed.bodyBoxShadow, "none", "The body must not draw a competing outline.");
        assert.deepEqual(collapsed.silhouetteBounds, collapsed.railBounds, "The single silhouette must cover the full rail bounds.");

        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readSilhouette();
        assert.equal(expanded.pathCount, 1, "Expansion must retain one outline path.");
        assert.match(expanded.pathData, /Z\s*$/i);
        assert.notEqual(expanded.pathData, collapsed.pathData, "The contour must extend with the drawer.");
        assert.deepEqual(expanded.silhouetteBounds, expanded.railBounds, "The expanded contour must cover the full rail bounds.");
    } finally {
        await page.close();
    }
});

test("the global modulation rail keeps a fixed tab and opens its source drawer toward available space", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.25 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readGlobalModRailGeometry(page);
        assert.ok(collapsed?.rail && collapsed.body && collapsed.tab && collapsed.art && collapsed.routeCount, "The rail must render its fixed tab, source art, and route count.");
        assert.equal(
            Math.abs(collapsed.rail.right - collapsed.viewportWidth) <= 0.5,
            true,
            "The collapsed tab must attach flush to the right screen edge.",
        );
        for (const [label, part] of Object.entries({ art: collapsed.art, routeCount: collapsed.routeCount, chevron: collapsed.chevron })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(collapsed.rail, part),
                true,
                `Collapsed ${label} must fit inside the tab: ${JSON.stringify(part)} vs ${JSON.stringify(collapsed.rail)}`,
            );
            assert.equal(
                rectContains(collapsed.body, part),
                true,
                `Collapsed ${label} must sit on the filled tab body: ${JSON.stringify(part)} vs ${JSON.stringify(collapsed.body)}`,
            );
        }
        const collapsedArtCenter = {
            x: (collapsed.art.left + collapsed.art.right) / 2,
            y: (collapsed.art.top + collapsed.art.bottom) / 2,
        };
        const collapsedBadgeCenter = {
            x: (collapsed.routeCount.left + collapsed.routeCount.right) / 2,
            y: (collapsed.routeCount.top + collapsed.routeCount.bottom) / 2,
        };
        assert.equal(
            Math.abs(collapsedArtCenter.x - ((collapsed.tab.left + collapsed.tab.right) / 2)) <= 0.5,
            true,
            "The collapsed source must be centered horizontally in the fixed tab.",
        );
        assert.equal(rectsIntersect(collapsed.art, collapsed.routeCount), true, "The route count must overlay the active source like a notification badge.");
        assert.equal(collapsedBadgeCenter.x > collapsedArtCenter.x, true, "The route count must sit on the source's upper-right corner.");
        assert.equal(collapsedBadgeCenter.y < collapsedArtCenter.y, true, "The route count must sit on the source's upper-right corner.");

        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readGlobalModRailGeometry(page);
        assert.ok(expanded?.rail && expanded.tab && expanded.drawer && expanded.track, "The expanded rail must render its fixed tab and source drawer.");
        assert.equal(
            Math.abs(expanded.rail.right - expanded.viewportWidth) <= 0.5,
            true,
            "The expanded tab must stay flush to the right screen edge.",
        );
        for (const key of ["left", "right", "top", "width", "height"]) {
            assert.equal(
                Math.abs(expanded.tab[key] - collapsed.tab[key]) <= 1.5,
                true,
                `Expansion changed the persistent tab's ${key}: ${collapsed.tab[key]} -> ${expanded.tab[key]}.`,
            );
        }
        assert.equal(
            Math.abs(expanded.rail.width - collapsed.rail.width) <= 1,
            true,
            `Expansion must not widen sideways (collapsed ${collapsed.rail.width}px, expanded ${expanded.rail.width}px).`,
        );
        assert.equal(Math.abs(expanded.rail.top - collapsed.rail.top) <= 1.5, true, "Expansion must not move the tab's top edge.");
        assert.equal(
            expanded.rail.height >= collapsed.rail.height + 120,
            true,
            "The source drawer must extend the rail downward.",
        );
        assert.equal(
            expanded.drawer.top >= expanded.tab.bottom - 1,
            true,
            `The source drawer must begin beneath the tab: ${JSON.stringify(expanded.drawer)} vs ${JSON.stringify(expanded.tab)}.`,
        );
        for (const [label, part] of Object.entries({ drawer: expanded.drawer, track: expanded.track })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(expanded.rail, part),
                true,
                `Expanded ${label} must live inside the tab surface, not a detached popup: ${JSON.stringify(part)} vs ${JSON.stringify(expanded.rail)}`,
            );
        }
        if (expanded.keyboard) {
            assert.equal(
                expanded.rail.bottom <= expanded.keyboard.top + 0.5,
                true,
                "The expanded tab must stay clear of the sticky keyboard.",
            );
        }
        assert.equal(expanded.documentFits, true, "The expanded tab must not create horizontal page overflow.");

        await page.locator('[data-role="mobile-global-mod-rail-grip"]').click({ position: { x: 28, y: 12 } });
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="false"]').waitFor();
        await page.waitForTimeout(260);
        const collapsedAgain = await readGlobalModRailGeometry(page);
        assert.ok(collapsedAgain?.rail);
        assert.equal(
            Math.abs(collapsedAgain.rail.height - collapsed.rail.height) <= 1,
            true,
            "Collapsing must remove only the downward drawer.",
        );

        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const narrow = await readGlobalModRailGeometry(page);
        assert.ok(narrow?.rail && narrow.tab && narrow.drawer && narrow.track, "The expanded rail must survive a 320px viewport.");
        assert.equal(Math.abs(narrow.rail.right - narrow.viewportWidth) <= 0.5, true, "The tab must stay flush at 320px.");
        assert.equal(Math.abs(narrow.rail.width - narrow.tab.width) <= 1, true, "The drawer must retain the tab's narrow width at 320px.");
        for (const [label, part] of Object.entries({ drawer: narrow.drawer, track: narrow.track })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(narrow.rail, part),
                true,
                `Expanded ${label} must stay inside the tab at 320px: ${JSON.stringify(part)} vs ${JSON.stringify(narrow.rail)}`,
            );
        }
        assert.equal(narrow.documentFits, true, "The expanded tab must not overflow a 320px viewport.");

    } finally {
        await page.close();
    }
});

test("a bottom-positioned global modulation rail opens its drawer upward", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 1 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readGlobalModRailGeometry(page);
        assert.ok(collapsed?.rail && collapsed.tab);
        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readGlobalModRailGeometry(page);
        assert.ok(expanded?.rail && expanded.tab && expanded.drawer && expanded.track);
        for (const key of ["left", "right", "top", "width", "height"]) {
            assert.equal(
                Math.abs(expanded.tab[key] - collapsed.tab[key]) <= 1.5,
                true,
                `Upward expansion changed the persistent tab's ${key}: ${collapsed.tab[key]} -> ${expanded.tab[key]}.`,
            );
        }
        assert.equal(
            expanded.drawer.bottom <= expanded.tab.top + 1,
            true,
            `A bottom-positioned rail must open upward: ${JSON.stringify(expanded.drawer)} vs ${JSON.stringify(expanded.tab)}.`,
        );
        assert.equal(rectContains(expanded.rail, expanded.drawer), true, "The upward drawer must remain inside the continuous rail surface.");
        assert.equal(expanded.documentFits, true, "Upward expansion must not create page overflow.");
    } finally {
        await page.close();
    }
});

test("the parameter gesture HUD avoids the active control, the global rail, the keyboard, and the finger", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0 }),
                );
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const createMapping = page.locator('[data-role="rack-create-mapping"]');
        if (await createMapping.count() > 0) {
            await createMapping.click();
        }
        await page.locator('[data-role="rack-modulation-amount"]').waitFor();

        const readHudCollisions = async (knobRole, finger) => {
            const layout = await page.evaluate(({ role }) => {
                const rectOf = (element) => {
                    if (!element) {
                        return null;
                    }
                    const bounds = element.getBoundingClientRect();
                    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
                };
                const hud = document.querySelector('[data-role="rack-parameter-hud"]');
                return {
                    hud: rectOf(hud),
                    hudPosition: hud ? getComputedStyle(hud).position : null,
                    hudPointerEvents: hud ? getComputedStyle(hud).pointerEvents : null,
                    knob: rectOf(document.querySelector(`[data-role="${role}"]`)),
                    rail: rectOf(document.querySelector('[data-role="mobile-global-mod-rail"]')),
                    drawer: rectOf(document.querySelector('[data-role="mobile-global-mod-rail-drawer"]')),
                    amount: rectOf(document.querySelector('[data-role="rack-modulation-amount"]')),
                    keyboard: rectOf(document.querySelector('[data-role="sticky-keyboard"]')),
                    viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
                };
            }, { role: knobRole });
            assert.ok(layout.hud && layout.knob && layout.rail && layout.keyboard, "Expected the HUD and its exclusion surfaces.");
            assert.equal(layout.hudPointerEvents, "none", "The HUD must remain pointer-events none.");
            assert.equal(rectsIntersect(layout.hud, layout.knob), false, `HUD covers the active control ${knobRole}.`);
            assert.equal(rectsIntersect(layout.hud, layout.rail), false, "HUD covers the global modulation rail.");
            if (layout.drawer) {
                assert.equal(rectsIntersect(layout.hud, layout.drawer), false, "HUD covers the rail drawer.");
            }
            if (layout.amount) {
                assert.equal(rectsIntersect(layout.hud, layout.amount), false, "HUD covers the modulation amount slider.");
            }
            assert.equal(rectsIntersect(layout.hud, layout.keyboard), false, "HUD covers the sticky keyboard.");
            assert.equal(
                rectsIntersect(layout.hud, {
                    left: finger.x - 40,
                    right: finger.x + 40,
                    top: finger.y - 40,
                    bottom: finger.y + 40,
                }),
                false,
                "HUD sits inside the active finger zone.",
            );
            assert.equal(rectContains(layout.viewport, layout.hud, 0), true, "HUD must remain fully on screen.");
            return layout.hud;
        };

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const artBox = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(artBox);
        const start = { x: artBox.x + (artBox.width / 2), y: artBox.y + (artBox.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 42, start.y, { steps: 8 });
        await page.locator('[data-role="rack-parameter-hud"]').waitFor();
        const firstPlacement = await readHudCollisions("rack-parameter-reverbSize", { x: start.x + 42, y: start.y });
        await page.mouse.move(start.x + 58, start.y, { steps: 4 });
        const secondPlacement = await readHudCollisions("rack-parameter-reverbSize", { x: start.x + 58, y: start.y });
        assert.equal(
            Math.abs(firstPlacement.left - secondPlacement.left) <= 1.5 && Math.abs(firstPlacement.top - secondPlacement.top) <= 1.5,
            true,
            "The HUD must keep one stable placement during an uninterrupted gesture.",
        );
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-hud"]') === null);

        const lastKnob = page.locator(".rack-editor-controls .rack-parameter-knob").last();
        await lastKnob.scrollIntoViewIfNeeded();
        const lastKnobRole = await lastKnob.getAttribute("data-role");
        const lastArtBox = await lastKnob.locator(".rack-knob-art").boundingBox();
        assert.ok(lastKnobRole && lastArtBox);
        const lastStart = { x: lastArtBox.x + (lastArtBox.width / 2), y: lastArtBox.y + (lastArtBox.height / 2) };
        await page.mouse.move(lastStart.x, lastStart.y);
        await page.mouse.down();
        await page.mouse.move(lastStart.x, lastStart.y - 24, { steps: 6 });
        await page.locator('[data-role="rack-parameter-hud"]').waitFor();
        await readHudCollisions(lastKnobRole, { x: lastStart.x, y: lastStart.y - 24 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-hud"]') === null);
    } finally {
        await page.close();
    }
});

test("rail grip drags own the touch without page scroll, persist across reload, and cancel cleanly", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");
        await rail.waitFor();

        const readScrollState = () => page.evaluate(() => ({
            documentTop: document.documentElement.scrollTop,
            panels: Array.from(document.querySelectorAll(".mobile-workspace-panel")).map((panel) => panel.scrollTop),
        }));

        const before = await rail.boundingBox();
        const scrollBefore = await readScrollState();
        const handleBox = await handle.boundingBox();
        assert.ok(before && handleBox);
        const gripStart = { x: handleBox.x + (handleBox.width / 2), y: handleBox.y + (handleBox.height / 2) };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...gripStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: gripStart.x, y: gripStart.y + (step * 15), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        const scrollDuring = await readScrollState();
        assert.deepEqual(scrollDuring, scrollBefore, "A grip drag must not scroll the page or any panel.");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
        ));
        await page.waitForTimeout(220);

        const moved = await rail.boundingBox();
        assert.ok(moved);
        assert.equal(moved.y - before.y >= 24, true, "The grip drag must reposition the rail.");
        assert.deepEqual(await readScrollState(), scrollBefore);
        assert.equal(await page.evaluate(() => localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") !== null), true);

        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await rail.waitFor();
        await page.waitForTimeout(120);
        const restored = await rail.boundingBox();
        assert.ok(restored);
        assert.equal(
            Math.abs(restored.y - moved.y) <= 2,
            true,
            `Reload must restore the persisted rail position (was ${moved.y}, restored ${restored.y}).`,
        );

        const topBeforeCancel = (await rail.boundingBox())?.y;
        const cancelHandleBox = await handle.boundingBox();
        assert.ok(topBeforeCancel !== undefined && cancelHandleBox);
        const cancelStart = {
            x: cancelHandleBox.x + (cancelHandleBox.width / 2),
            y: cancelHandleBox.y + (cancelHandleBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...cancelStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: cancelStart.x, y: cancelStart.y + 40, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await page.waitForTimeout(240);
        assert.equal(
            Math.abs(((await rail.boundingBox())?.y ?? 0) - topBeforeCancel) <= 1,
            true,
            "A cancelled grip drag must restore the rail position.",
        );

        await grip.click({ position: { x: 28, y: 26 } });
        assert.equal(await grip.getAttribute("aria-expanded"), "true", "The grip must still toggle after cancelled gestures.");
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("rail flick keeps moving after touch release and faster releases travel farther", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.5 }),
                );
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");

        const resetRailToMiddle = async () => {
            await page.evaluate(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.5 }),
                );
            });
            await page.reload({ waitUntil: "commit" });
            await waitForHarnessReady(page);
            await rail.waitFor();
            await page.waitForTimeout(140);
        };

        const releaseFlickUp = async (stepDelayMs, releasePauseMs) => {
            const handleBox = await handle.boundingBox();
            assert.ok(handleBox);
            const start = {
                x: handleBox.x + (handleBox.width / 2),
                y: handleBox.y + (handleBox.height / 2),
            };

            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
            });
            for (let step = 1; step <= 4; step += 1) {
                await page.waitForTimeout(stepDelayMs);
                await cdp.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [{
                        x: start.x,
                        y: start.y - (step * 6),
                        radiusX: 5,
                        radiusY: 5,
                        force: 1,
                    }],
                });
            }
            await page.waitForTimeout(releasePauseMs);

            const held = await rail.boundingBox();
            assert.ok(held);
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            return held;
        };

        const measureFlickUp = async (stepDelayMs, releasePauseMs) => {
            const held = await releaseFlickUp(stepDelayMs, releasePauseMs);
            await page.waitForTimeout(80);
            const shortlyAfterRelease = await rail.boundingBox();
            assert.ok(shortlyAfterRelease);
            await page.waitForFunction(() => (
                document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
            ));
            await page.waitForTimeout(220);
            const settled = await rail.boundingBox();
            assert.ok(settled);

            return {
                first80Ms: held.y - shortlyAfterRelease.y,
                totalMomentum: held.y - settled.y,
            };
        };

        await rail.waitFor();
        await page.waitForTimeout(140);
        const fast = await measureFlickUp(8, 16);

        await resetRailToMiddle();
        const slow = await measureFlickUp(70, 120);

        assert.equal(
            fast.first80Ms >= 8,
            true,
            `A quick upward flick must keep traveling after release: ${JSON.stringify({ fast, slow })}`,
        );
        assert.equal(
            fast.totalMomentum >= slow.totalMomentum + 24,
            true,
            `Release speed must increase momentum travel: ${JSON.stringify({ fast, slow })}`,
        );

        await resetRailToMiddle();
        await page.evaluate(() => {
            const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (callback) => nativeRequestAnimationFrame((timeStamp) => {
                callback(timeStamp + 500);
            });
        });
        await releaseFlickUp(8, 16);
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        assert.equal(
            await rail.getAttribute("data-decelerating"),
            "false",
            "A delayed animation frame must consume elapsed coast time instead of resuming in slow motion.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("rack mod bar vertically pages one colored MSEG Envelope and Macro identity per source", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await expandGlobalModRail(page);
        await page.waitForSelector('[data-role="rack-mod-source-track"]');

        const initial = await page.evaluate(() => {
            const rack = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const track = document.querySelector('[data-role="rack-mod-source-track"]');
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            if (!(rack instanceof HTMLElement) || !(track instanceof HTMLElement) || !(activePage instanceof HTMLElement)) {
                return null;
            }
            return {
                labels: Array.from(activePage.querySelectorAll("button")).map((button) => button.getAttribute("aria-label")),
                sourceRoles: Array.from(rack.querySelectorAll('button[data-role^="rack-mod-source-"]'))
                    .map((element) => element.getAttribute("data-role")),
                rackText: rack.textContent ?? "",
                transitionDuration: getComputedStyle(track).transitionDuration,
            };
        });

        assert.ok(initial);
        assert.deepEqual(initial.labels, ["MSEG 1", "Envelope 1", "Macro 1"]);
        assert.equal(initial.sourceRoles.length, 9);
        assert.equal(initial.sourceRoles.some((role) => /lfo/i.test(String(role))), false);
        assert.equal(/\blfo\b/i.test(initial.rackText), false);
        assert.equal(initial.transitionDuration, "0.28s");

        const visualContract = await page.evaluate(() => {
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            const sources = Array.from(activePage?.querySelectorAll(".rack-mod-source") ?? []);
            const previous = document.querySelector('[aria-label="Previous modulation-source group"]');
            if (!(activePage instanceof HTMLElement)
                || sources.length !== 3
                || !(previous instanceof HTMLButtonElement)) {
                return null;
            }
            return {
                sources: sources.map((source) => {
                    const button = source;
                    const art = source.querySelector(".rack-mod-art");
                    const glyph = source.querySelector('[data-role="rack-mod-glyph"]');
                    const number = source.querySelector(".rack-mod-number");
                    if (!(button instanceof HTMLButtonElement)
                        || !(art instanceof HTMLElement)
                        || !(glyph instanceof HTMLElement)
                        || !(number instanceof HTMLElement)) {
                        return null;
                    }
                    const buttonStyle = getComputedStyle(button);
                    const artStyle = getComputedStyle(art);
                    const glyphStyle = getComputedStyle(glyph);
                    const bounds = button.getBoundingClientRect();
                    return {
                        label: button.getAttribute("aria-label"),
                        buttonWidth: bounds.width,
                        buttonHeight: bounds.height,
                        centerX: bounds.left + (bounds.width / 2),
                        top: bounds.top,
                        bottom: bounds.bottom,
                        artWidth: art.getBoundingClientRect().width,
                        artHeight: art.getBoundingClientRect().height,
                        background: buttonStyle.backgroundColor,
                        boxShadow: buttonStyle.boxShadow,
                        overflow: buttonStyle.overflow,
                        accent: buttonStyle.getPropertyValue("--source-color").trim(),
                        visualCount: art.querySelectorAll('img, [data-role="rack-mod-glyph"]').length,
                        glyphColor: glyphStyle.backgroundColor,
                        glyphMask: glyphStyle.maskImage || glyphStyle.webkitMaskImage,
                        number: number.textContent?.trim(),
                        artFilter: artStyle.filter,
                    };
                }),
                drawer: (() => {
                    const drawer = document.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
                    if (!(drawer instanceof HTMLElement)) {
                        return null;
                    }
                    const bounds = drawer.getBoundingClientRect();
                    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
                })(),
                previous: (() => {
                    const bounds = previous.getBoundingClientRect();
                    return { width: bounds.width, height: bounds.height };
                })(),
                next: (() => {
                    const next = document.querySelector('[aria-label="Next modulation-source group"]');
                    if (!(next instanceof HTMLButtonElement)) {
                        return null;
                    }
                    const bounds = next.getBoundingClientRect();
                    return { width: bounds.width, height: bounds.height };
                })(),
            };
        });

        assert.ok(visualContract);
        assert.equal(visualContract.sources.every(Boolean), true);
        assert.deepEqual(visualContract.sources.map((source) => source.number), ["1", "1", "1"]);
        assert.deepEqual(visualContract.sources.map((source) => source.accent), ["#cc59d2", "#b8e236", "#ff6428"]);
        // The B2 module skeleton (T10B): a full-width 40px hit area around a
        // 28px source module, on the rail's 10px rhythm.
        assert.equal(visualContract.sources.every((source) => source.buttonWidth === 40 && source.buttonHeight === 28), true);
        assert.equal(visualContract.sources.every((source) => source.artWidth === 28 && source.artHeight === 28), true);
        assert.equal(visualContract.sources.every((source) => source.background === "rgba(0, 0, 0, 0)"), true);
        assert.equal(visualContract.sources.every((source) => source.boxShadow === "none"), true);
        assert.equal(visualContract.sources.every((source) => source.overflow === "visible"), true);
        assert.equal(visualContract.sources.every((source) => source.visualCount === 1), true, "Each source must render exactly one identity icon.");
        assert.deepEqual(visualContract.sources.map((source) => source.glyphColor), ["rgb(204, 89, 210)", "rgb(184, 226, 54)", "rgb(255, 100, 40)"]);
        assert.equal(visualContract.sources.every((source) => source.glyphMask !== "none"), true);
        assert.equal(
            Math.max(...visualContract.sources.map((source) => source.centerX))
                - Math.min(...visualContract.sources.map((source) => source.centerX)) <= 1,
            true,
            "The active source page must be one vertical column.",
        );
        assert.ok(visualContract.drawer);
        assert.equal(
            visualContract.sources.every((source) => (
                Math.abs(source.centerX - ((visualContract.drawer.left + visualContract.drawer.right) / 2)) <= 0.5
            )),
            true,
            "Every source must be centered horizontally in the drawer.",
        );
        assert.equal(
            visualContract.sources.every((source, index, sources) => index === 0 || source.top >= sources[index - 1].bottom - 1),
            true,
            "The three source controls must stack downward without overlap.",
        );
        assert.equal(
            visualContract.sources.slice(1).every((source, index) => (
                Math.abs(source.top - visualContract.sources[index].bottom - 10) <= 0.5
            )),
            true,
            "Source rows must sit on the rail's single 10px rhythm.",
        );
        assert.deepEqual(visualContract.previous, { width: 40, height: 20 });
        assert.deepEqual(visualContract.next, { width: 40, height: 20 });

        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const selectedVisual = await page.locator('[data-role="rack-mod-source-mseg-1"]').evaluate((button) => {
            const art = button.querySelector(".rack-mod-art");
            const viewport = button.closest(".rack-mod-viewport");
            const underline = getComputedStyle(button, "::after");
            const viewportStyle = viewport instanceof HTMLElement ? getComputedStyle(viewport) : null;
            return {
                buttonFilter: getComputedStyle(button).filter,
                buttonShadow: getComputedStyle(button).boxShadow,
                artFilter: art instanceof HTMLElement ? getComputedStyle(art).filter : "",
                artTransform: art instanceof HTMLElement ? getComputedStyle(art).transform : "",
                artBackground: art instanceof HTMLElement ? getComputedStyle(art).backgroundColor : "",
                underlineDisplay: underline.display,
                viewportOverflow: viewportStyle?.overflow ?? "",
                viewportClipMargin: viewportStyle?.overflowClipMargin ?? "",
            };
        });
        // B2 selection: the module itself tints — no glow, no scale, no
        // underline. The tinted container is the entire selected treatment.
        assert.equal(selectedVisual.buttonFilter, "none");
        assert.equal(selectedVisual.buttonShadow, "none");
        assert.equal(selectedVisual.artFilter, "none");
        assert.equal(selectedVisual.artTransform, "none");
        assert.notEqual(selectedVisual.artBackground, "rgba(0, 0, 0, 0)");
        assert.equal(selectedVisual.underlineDisplay, "none");
        assert.equal(selectedVisual.viewportOverflow, "clip");
        // B2 modules carry no glow: the viewport clips hard so the next page
        // cannot peek through the 10px rhythm gap.
        assert.equal(Number.parseFloat(selectedVisual.viewportClipMargin), 0);

        const animation = await page.evaluate(async () => {
            const track = document.querySelector('[data-role="rack-mod-source-track"]');
            const viewport = document.querySelector(".rack-mod-viewport");
            const next = document.querySelector('[aria-label="Next modulation-source group"]');
            if (!(track instanceof HTMLElement) || !(viewport instanceof HTMLElement) || !(next instanceof HTMLButtonElement)) {
                return null;
            }
            const startTop = track.getBoundingClientRect().top;
            const travel = viewport.getBoundingClientRect().height;
            next.click();
            await new Promise((resolve) => window.setTimeout(resolve, 80));
            const duringTop = track.getBoundingClientRect().top;
            await new Promise((resolve) => window.setTimeout(resolve, 260));
            const endTop = track.getBoundingClientRect().top;
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            const selected = activePage?.querySelector('[aria-pressed="true"]');
            const header = document.querySelector('.rack-mod-header strong');
            return {
                startTop,
                duringTop,
                endTop,
                travel,
                labels: Array.from(activePage?.querySelectorAll("button") ?? [])
                    .map((button) => button.getAttribute("aria-label")),
                selectedLabel: selected?.getAttribute("aria-label") ?? null,
                armedLabel: header?.textContent ?? "",
            };
        });

        assert.ok(animation);
        assert.equal(animation.duringTop < animation.startTop - 1, true, "The vertical source page did not begin moving.");
        assert.equal(
            animation.duringTop > animation.startTop - animation.travel + 1,
            true,
            "The vertical source page switched instantly instead of animating.",
        );
        assert.equal(
            Math.abs((animation.startTop - animation.endTop) - animation.travel) <= 2,
            true,
            `The vertical source track did not finish one page away: ${JSON.stringify(animation)}`,
        );
        assert.deepEqual(animation.labels, ["MSEG 2", "Envelope 2", "Macro 2"]);
        assert.equal(animation.selectedLabel, null);
        assert.match(animation.armedLabel, /MSEG 1/);
    } finally {
        await page.close();
    }
});

test("rack mod bar keeps source and target selection unassigned until explicit route creation", async () => {
    const sourceFirstPage = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await sourceFirstPage.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(sourceFirstPage);
        await clearHarnessDebugLog(sourceFirstPage);
        await sourceFirstPage.click('[data-role="rack-mod-source-mseg-1"]');

        let snapshot = await getHarnessSnapshot(sourceFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionDriveDb"
            )),
            false,
            "Selecting a source must not imply a modulation route.",
        );
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 0);
        const createMapping = sourceFirstPage.locator('[data-role="rack-create-mapping"]');
        assert.match(await createMapping.innerText(), /create mapping \+/i);
        assert.match(
            await sourceFirstPage.locator('[data-role="rack-unmapped-pair"]').innerText(),
            /MSEG 1.*Distortion.*Drive/i,
        );
        await createMapping.click();

        snapshot = await waitForHarnessSnapshot(
            sourceFirstPage,
            "explicit source-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionDriveDb"
            )),
        );
        const sourceFirstRoute = readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "rack.distortionDriveDb"
        ));
        assert.ok(sourceFirstRoute);

        const amount = sourceFirstPage.locator('[data-role="rack-modulation-amount"]');
        const amountBox = await amount.boundingBox();
        assert.ok(amountBox, "Expected the rack amount control.");
        await sourceFirstPage.mouse.move(amountBox.x + (amountBox.width * 0.5), amountBox.y + (amountBox.height * 0.5));
        await sourceFirstPage.mouse.down();
        await sourceFirstPage.mouse.move(amountBox.x + (amountBox.width * 0.82), amountBox.y + (amountBox.height * 0.5), { steps: 8 });
        const amountHud = sourceFirstPage.locator('[data-role="rack-parameter-hud"]');
        await amountHud.waitFor();
        assert.equal(await amountHud.getAttribute("data-mode"), "modulation");
        assert.match(await amountHud.innerText(), /MOD.*Drive.*dB/is);
        const liveAmountHudLayout = await sourceFirstPage.evaluate(() => {
            const rectOf = (element) => {
                const bounds = element.getBoundingClientRect();
                return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
            };
            return {
                hud: rectOf(document.querySelector('[data-role="rack-parameter-hud"]')),
                amount: rectOf(document.querySelector('[data-role="rack-modulation-amount"]')),
            };
        });
        assert.equal(rectsIntersect(liveAmountHudLayout.hud, liveAmountHudLayout.amount), false);
        await sourceFirstPage.mouse.up();
        await amountHud.waitFor({ state: "detached" });

        snapshot = await waitForHarnessSnapshot(
            sourceFirstPage,
            "rack route amount update",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionDriveDb"
                && route.amount > 1
            )),
        );
        const modulationMessages = snapshot.sentMessages.filter(({ endpointID }) => (
            endpointID === "modulationProgram" || endpointID === "modulationAmount"
        ));
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => {
            if (endpointID !== "modulationProgram") return false;
            const count = Number(value?.voiceRackRouteCount) || 0;
            const routeIndex = value?.voiceRackRouteCells?.slice(0, count).indexOf(3) ?? -1;
            return routeIndex >= 0 && Number(value?.voiceRackRouteReducers?.[routeIndex]) === 1;
        }), true, `Voice-source rack route did not compile with Max reduction: ${JSON.stringify(modulationMessages)}`);
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationAmount"
            && Number(value?.pathKind) === 3
            && Number(value?.cellIndex) === 3
            && Number(value?.amount) > 1
        )), true, `Voice-source rack amount edit did not use the small update path: ${JSON.stringify(modulationMessages)}`);
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').getAttribute("aria-valuemin"), "-100");
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').getAttribute("aria-valuemax"), "100");
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 1);
    } finally {
        await sourceFirstPage.close();
    }

    const targetFirstPage = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await targetFirstPage.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(targetFirstPage, "reverb");
        await expandGlobalModRail(targetFirstPage);
        await targetFirstPage.click('[aria-label="Next modulation-source group"]');
        await targetFirstPage.waitForTimeout(300);
        await waitForHarnessSnapshot(
            targetFirstPage,
            "target-first runtime boot program",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
        );
        await clearHarnessDebugLog(targetFirstPage);
        await targetFirstPage.click('[data-role="rack-mod-source-macro-2"]');

        let snapshot = await getHarnessSnapshot(targetFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
            )),
            false,
            "Target-first selection must remain context-only.",
        );
        await targetFirstPage.click('[data-role="rack-create-mapping"]');

        snapshot = await waitForHarnessSnapshot(
            targetFirstPage,
            "explicit target-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
            "A zero-depth rack mapping must remain outside the active runtime prefix.",
        );

        const targetAmount = targetFirstPage.locator('[data-role="rack-modulation-amount"]');
        const targetAmountBox = await targetAmount.boundingBox();
        assert.ok(targetAmountBox, "Expected the target-first rack amount control.");
        await targetFirstPage.mouse.move(
            targetAmountBox.x + (targetAmountBox.width * 0.5),
            targetAmountBox.y + (targetAmountBox.height * 0.5),
        );
        await targetFirstPage.mouse.down();
        await targetFirstPage.mouse.move(
            targetAmountBox.x + (targetAmountBox.width * 0.82),
            targetAmountBox.y + (targetAmountBox.height * 0.5),
            { steps: 8 },
        );
        await targetFirstPage.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            targetFirstPage,
            "active target-first rack route",
            (nextSnapshot) => (
                readStoredModulationState(nextSnapshot).routes.some((route) => (
                    route.sourceKind === "macro"
                    && route.sourceSlot === 2
                    && route.targetKind === "rack.reverbSize"
                    && route.amount > 0
                ))
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "modulationProgram"
                    && Number(value?.macroRackRouteCount) >= 1
                    && value?.macroRackRouteSources?.slice(0, value.macroRackRouteCount).includes(1)
                    && value?.macroRackRouteTargets?.slice(0, value.macroRackRouteCount).includes(32)
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "modulationProgram"
                && Number(value?.macroRackRouteCount) >= 1
                && value?.macroRackRouteSources?.slice(0, value.macroRackRouteCount).includes(1)
                && value?.macroRackRouteTargets?.slice(0, value.macroRackRouteCount).includes(32)
            )),
            true,
            "Global Macro route must compile into the reducer-free macro-to-rack path.",
        );
    } finally {
        await targetFirstPage.close();
    }
});

test("mobile rack modulation amount presents the canonical bridge value while the full document is deferred", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });
    const readAmountPresentation = async () => page.locator('[data-role="rack-modulation-amount"]').evaluate((slider) => {
        const thumb = slider.querySelector(".rack-mod-amount-thumb");
        const output = slider.closest(".rack-mod-amount")?.querySelector("output");
        return {
            ariaValueText: slider.getAttribute("aria-valuetext"),
            output: output?.textContent ?? null,
            thumbLeft: thumb instanceof HTMLElement ? thumb.style.left : null,
        };
    });

    try {
        const seededState = normalizeModulationState({
            routes: [{
                id: "mobile-rack-amount-route",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "rack.distortionDriveDb",
                amount: 0,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded mobile rack modulation amount route",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === "mobile-rack-amount-route",
        );
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');

        const amount = page.locator('[data-role="rack-modulation-amount"]');
        await amount.waitFor();
        const bounds = await amount.boundingBox();
        assert.ok(bounds);
        const initial = await readAmountPresentation();

        await page.clock.install();
        await page.clock.pauseAt(Date.now() + 1_000);
        await clearHarnessDebugLog(page);
        const y = bounds.y + (bounds.height / 2);
        await page.mouse.move(bounds.x + (bounds.width * 0.5), y);
        await page.mouse.down();
        await page.mouse.move(bounds.x + (bounds.width * 0.8), y);
        await page.clock.runFor(20);
        const duringDrag = await readAmountPresentation();
        await page.mouse.up();
        await page.clock.runFor(20);
        const beforeParentEcho = await readAmountPresentation();
        await page.clock.runFor(30);
        const afterParentEcho = await readAmountPresentation();

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                (endpointID === "modulationAmount" && Number(value?.amount) > 0)
                || (endpointID === "modulationProgram" && Number(value?.voiceRackRouteCount) > 0)
            )),
            true,
            "The drag must reach the runtime boundary immediately.",
        );
        assert.notEqual(duringDrag.thumbLeft, initial.thumbLeft, "The amount thumb stayed at the stale parent value.");
        assert.notEqual(duringDrag.output, initial.output, "The amount readout stayed at the stale parent value.");
        assert.equal(duringDrag.output, duringDrag.ariaValueText);
        assert.deepEqual(beforeParentEcho, duringDrag, "The amount presentation diverged from the canonical route value.");
        assert.deepEqual(afterParentEcho, duringDrag, "The deferred full-document projection changed the route value.");
    } finally {
        await page.close();
    }
});

test("rack modulation-source gesture cancels on window blur instead of creating a route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.scrollIntoViewIfNeeded();
        const sourceBounds = await source.boundingBox();
        assert.ok(sourceBounds);
        const beforeRoutes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        await clearHarnessDebugLog(page);

        await page.mouse.move(
            sourceBounds.x + (sourceBounds.width / 2),
            sourceBounds.y + (sourceBounds.height / 2),
        );
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.up();
        await page.waitForTimeout(80);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredModulationState(snapshot).routes.length, beforeRoutes.length);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
            "A blurred source gesture must not create a modulation route on the later pointer release.",
        );
    } finally {
        await page.close();
    }
});

test("source preview and valid hover stay transient while the armed ring and focus indicator persist", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "armed-mseg-size", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.4, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const knob = surface.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.focus();
        const env = page.locator('[data-role="rack-mod-source-env-1"]');
        const envBox = await env.boundingBox();
        const targetBox = await surface.boundingBox();
        assert.ok(envBox && targetBox);
        await page.mouse.move(envBox.x + envBox.width / 2, envBox.y + envBox.height / 2);
        await page.mouse.down();
        assert.equal(await knob.evaluate((element) => element.style.getPropertyValue("--rack-knob-mod-accent")), "#cc59d2");
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });

        const live = await surface.evaluate((element) => {
            const style = getComputedStyle(element);
            const knobElement = element.querySelector('.rack-parameter-knob');
            return {
                isHover: element.classList.contains("is-mod-hover"),
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                dragAccent: style.getPropertyValue("--drag-source-color").trim(),
                outline: style.outline,
                outlineOffset: style.outlineOffset,
                ringAccent: knobElement instanceof HTMLElement
                    ? knobElement.style.getPropertyValue("--rack-knob-mod-accent")
                    : "",
            };
        });
        assert.equal(live.isHover, true);
        assert.equal(live.borderColor, "rgba(223, 230, 232, 0.78)");
        assert.notEqual(live.boxShadow, "none");
        assert.equal(live.dragAccent, "#b8e236");
        assert.match(live.outline, /rgb\(245, 255, 255\)/);
        assert.equal(live.outlineOffset, "2px");
        assert.equal(live.ringAccent, "#cc59d2");

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.up();
        await page.waitForTimeout(60);
        assert.equal((await surface.getAttribute("class")).includes("is-mod-hover"), false);
        assert.equal(await knob.evaluate((element) => element.style.getPropertyValue("--rack-knob-mod-accent")), "#cc59d2");
        const routes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routes.some((route) => route.sourceKind === "env" && route.targetKind === "rack.reverbSize"), false);
    } finally {
        await page.close();
    }
});

test("a real source drop creates a mapping after 100 existing mappings", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const routes = MODULATION_SOURCE_OPTIONS.flatMap((source) => (
            MODULATION_TARGET_OPTIONS.map((target) => ({ source, target }))
        )).filter(({ source, target }) => !(
            source.sourceKind === "env"
            && source.sourceSlot === 1
            && target.value === "rack.reverbSize"
        )).slice(0, 100).map(({ source, target }, routeIndex) => ({
            id: `large-set-drop-${routeIndex}`,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: "unipolar",
            targetKind: target.value,
            amount: routeIndex / 200,
            reducer: "max",
        }));
        const seededState = normalizeModulationState({
            routes,
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "large mapping set seeded before real drop",
            (snapshot) => readStoredModulationState(snapshot).routes.length === 100,
        );
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await page.mouse.up();
        const after = await waitForHarnessSnapshot(
            page,
            "source drop creates mapping 101",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.equal(readStoredModulationState(after).routes.length, 101);
        const knob = target.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "mapped");
        assert.equal(await knob.locator('.rack-knob-route-presence').count(), 1);
        assert.doesNotMatch(await page.locator('.rack-route-status').innerText(), /ROUTE LIMIT/);
    } finally {
        await page.close();
    }
});

test("effect bypass and mode suspension preserve route geometry without claiming audible activity", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "env-reverb", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.4, reducer: "max" },
                { id: "env-filter", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.globalFilterResonance", amount: 2, reducer: "max" },
                { id: "env-phaser", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.phaserRate", amount: 1.2, reducer: "max" },
                { id: "env-delay", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.delayTime", amount: 1, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("globalFilterMode", 0, true);
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "reverb");
        await page.click('[data-role="rack-enabled-reverb"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await collapseGlobalModRail(page);
        const reverbKnob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const reverbBadge = page.locator('[data-role="rack-route-count-reverbSize"]');
        const activeGeometry = await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d");
        assert.notEqual(activeGeometry, "");
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        const routesBeforeBypass = routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes);

        await page.click('[data-role="rack-enabled-reverb"]');
        assert.match(await page.locator('[data-role="rack-editor-reverb"] .rack-editor-header').innerText(), /FX BYPASSED/);
        assert.equal(await reverbKnob.getAttribute("data-route-state"), "mapped");
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "effect-bypassed");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        assert.equal(
            await reverbKnob.locator('.rack-knob-mod-fill').evaluate((element) => getComputedStyle(element).filter),
            "none",
        );
        assert.deepEqual(routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes), routesBeforeBypass);
        await page.click('[data-role="rack-enabled-reverb"]');
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "active");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);

        await page.click('[data-role="rack-enabled-reverb"]');
        const reverbArtBox = await reverbKnob.locator('.rack-knob-art').boundingBox();
        assert.ok(reverbArtBox);
        await page.mouse.move(reverbArtBox.x + reverbArtBox.width / 2, reverbArtBox.y + reverbArtBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(reverbArtBox.x + reverbArtBox.width / 2 + 30, reverbArtBox.y + reverbArtBox.height / 2, { steps: 6 });
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "effect-bypassed");
        await page.mouse.up();
        const afterBypassedEdit = await waitForHarnessSnapshot(
            page,
            "effect-bypassed route amount edit",
            (snapshot) => readStoredModulationState(snapshot).routes.find((route) => route.id === "env-reverb")?.amount > 0.4,
        );
        assert.equal(await page.locator('[data-role="rack-editor-reverb"]').getAttribute("data-effect-enabled"), "false");
        assert.equal(readStoredModulationState(afterBypassedEdit).routes.find((route) => route.id === "env-reverb")?.enabled, true);

        await selectRackEffect(page, "filter");
        await page.click('[data-role="rack-enabled-filter"]');
        const filterMode = page.locator('[data-role="rack-parameter-globalFilterMode"]');
        const resonance = page.locator('[data-role="rack-parameter-globalFilterResonance"]');
        assert.equal(await filterMode.getAttribute("data-rack-mod-target"), null);
        assert.equal(await filterMode.locator('.rack-route-count-badge').count(), 0);
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "target-suspended");
        assert.equal(await page.locator('[data-role="rack-parameter-surface-globalFilterResonance"] .rack-target-suspended-label').count(), 1);
        await filterMode.click();
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "active");

        await selectRackEffect(page, "phaser");
        await page.click('[data-role="rack-enabled-phaser"]');
        const phaserMode = page.locator('[data-role="rack-parameter-phaserRateMode"]');
        await phaserMode.click();
        const phaserRate = page.locator('[data-role="rack-parameter-phaserRate"]');
        assert.equal(await phaserRate.count(), 1, "Configured Free rate must stay discoverable in Sync mode.");
        assert.equal(await phaserRate.getAttribute("data-route-effectiveness"), "target-suspended");

        await selectRackEffect(page, "delay");
        await page.click('[data-role="rack-enabled-delay"]');
        await page.locator('[data-role="rack-parameter-delayTimeMode"]').click();
        const delayTime = page.locator('[data-role="rack-parameter-delayTime"]');
        assert.equal(await delayTime.count(), 1, "Configured Free time must stay discoverable in Sync mode.");
        assert.equal(await delayTime.getAttribute("data-route-effectiveness"), "target-suspended");
    } finally {
        await page.close();
    }
});

test("rack Filter defaults to Lowpass while its effect remains bypassed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        await selectRackEffect(page, "filter");

        const snapshot = await getHarnessSnapshot(page);
        const mode = page.locator('[data-role="rack-parameter-globalFilterMode"]');
        assert.equal(Number(snapshot.parameterValues.globalFilterMode), 1);
        assert.match(await mode.innerText(), /Lowpass/i);
        assert.match(await page.locator('[data-role="rack-editor-filter"] .rack-editor-header').innerText(), /FX BYPASSED/);
        assert.equal(await page.locator('[data-role="rack-editor-filter"]').getAttribute("data-effect-enabled"), "false");
    } finally {
        await page.close();
    }
});

test("a two-digit exact route badge stays contained at 320px without changing the slider name", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 852 }),
    });

    try {
        const sources = [
            ["mseg", 1], ["mseg", 2], ["mseg", 3],
            ["env", 1], ["env", 2], ["env", 3],
            ["macro", 1], ["macro", 2], ["macro", 3], ["macro", 4],
            ["velocity", null], ["pressure", null],
        ];
        const seededState = normalizeModulationState({
            routes: sources.map(([sourceKind, sourceSlot], routeIndex) => ({
                id: `badge-${routeIndex}`,
                enabled: true,
                sourceKind,
                sourceSlot,
                polarity: "unipolar",
                targetKind: "rack.distortionWet",
                amount: routeIndex / 100,
                reducer: "max",
            })),
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        const surface = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const badge = surface.locator('[data-role="rack-route-count-distortionWet"]');
        const geometry = await surface.evaluate((element) => {
            const badgeElement = element.querySelector('.rack-route-count-badge');
            if (!(badgeElement instanceof HTMLElement)) return null;
            const surfaceBounds = element.getBoundingClientRect();
            const badgeBounds = badgeElement.getBoundingClientRect();
            return {
                surfaceLeft: surfaceBounds.left,
                surfaceRight: surfaceBounds.right,
                badgeLeft: badgeBounds.left,
                badgeRight: badgeBounds.right,
                badgeWidth: badgeBounds.width,
            };
        });
        assert.ok(geometry);
        assert.equal((await badge.textContent()).trim(), "12");
        assert.equal(geometry.badgeLeft >= geometry.surfaceLeft && geometry.badgeRight <= geometry.surfaceRight, true);
        assert.equal(geometry.badgeWidth >= 15, true);
        assert.equal(await surface.locator('[data-role="distortion-mix-field"]').getAttribute("aria-label"), "Mix");
        assert.match(await badge.getAttribute("aria-label"), /12 modulation routes target Mix/);
    } finally {
        await page.close();
    }
});

test("rack quick controls never reorder or stick after release and reorder is grip-only", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        const quickBox = await quick.boundingBox();
        assert.ok(quickBox);

        await page.mouse.move(quickBox.x + (quickBox.width * 0.2), quickBox.y + (quickBox.height * 0.72));
        await page.mouse.move(quickBox.x + (quickBox.width * 0.8), quickBox.y + (quickBox.height * 0.72), { steps: 8 });
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, [], "Hovering a quick control must be inert.");
        assert.deepEqual(snapshot.gestureStarts, []);

        await page.mouse.down();
        await page.mouse.move(quickBox.x + (quickBox.width * 0.55), quickBox.y + (quickBox.height * 0.72), { steps: 6 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "quick-control parameter gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "reverbSize"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "rackOrder"), false);

        const valueAfterRelease = Number(snapshot.parameterValues.reverbSize);
        await clearHarnessDebugLog(page);
        await page.mouse.move(quickBox.x + 2, quickBox.y + (quickBox.height * 0.72), { steps: 10 });
        await page.mouse.move(quickBox.x + quickBox.width - 2, quickBox.y + (quickBox.height * 0.72), { steps: 10 });
        await page.waitForTimeout(80);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.reverbSize), valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages, [], "Released quick control remained attached to the pointer.");
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);

        assert.equal(await page.locator('[data-rack-position][draggable="true"]').count(), 0);
        assert.equal(await page.locator('[data-role^="rack-reorder-handle-"]').count(), 8);
    } finally {
        await page.close();
    }
});

test("rack quick controls keep tracking Safari touch moves that report zero buttons", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.3, true);
        });
        await clearHarnessDebugLog(page);

        const bounds = await quick.boundingBox();
        assert.ok(bounds);
        const start = {
            x: bounds.x + (bounds.width * 0.35),
            y: bounds.y + (bounds.height * 0.5),
        };
        const moved = {
            x: start.x + (bounds.width * 0.3),
            y: start.y,
        };

        await quick.dispatchEvent("pointerdown", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await quick.dispatchEvent("pointermove", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: moved.x,
            clientY: moved.y,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, [], "A live Safari touch move must not end the gesture.");
        assert.ok(Number(snapshot.parameterValues.reverbSize) > 0.3);

        await quick.dispatchEvent("pointerup", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: moved.x,
            clientY: moved.y,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "Safari quick-control touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
    } finally {
        await page.close();
    }
});

test("rack quick controls keep tracking touch outside the card when pointer capture is unavailable", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-toggle-fx"]');
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.3, true);
        });
        await clearHarnessDebugLog(page);

        const bounds = await quick.boundingBox();
        assert.ok(bounds);
        await quick.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        const pointer = {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
        };
        const startX = bounds.x + (bounds.width * 0.35);
        const clientY = bounds.y + (bounds.height * 0.5);
        await quick.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientX: startX,
            clientY,
        });
        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId: pointer.pointerId,
            clientX: startX + (bounds.width * 0.3),
            clientY,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.ok(Number(snapshot.parameterValues.reverbSize) > 0.3);

        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId: pointer.pointerId,
            clientX: startX + (bounds.width * 0.3),
            clientY,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack quick-control release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
    } finally {
        await page.close();
    }
});

test("every rack editor binds live controls and one drop commits one complete DSP order", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        const editorControlByEffect = {
            filter: "rack-parameter-globalFilterCutoff",
            drive: "distortion-drive-field",
            ott: "rack-parameter-ottAmount",
            chorus: "chorus-mix-control",
            flanger: "rack-parameter-flangerRate",
            phaser: "rack-parameter-phaserRateMode",
            delay: "rack-parameter-delayTimeMode",
            reverb: "rack-parameter-reverbSize",
        };

        for (const [effectId, controlRole] of Object.entries(editorControlByEffect)) {
            await selectRackEffect(page, effectId);
            await page.waitForSelector(
                `[data-role="rack-editor-${effectId}"] [data-role="${controlRole}"]`,
            );
        }

        await clearHarnessDebugLog(page);
        for (const effectId of Object.keys(editorControlByEffect)) {
            await page.click(`[data-role="rack-enabled-${effectId}"]`);
        }

        let snapshot = await waitForHarnessSnapshot(
            page,
            "all rack enable commits",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackEnable"
                && Array.isArray(value?.enabledFlags)
                && value.enabledFlags.every((flag) => Number(flag) === 1)
            )),
        );
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.deepEqual(storedRack.order, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
        assert.equal(Object.values(storedRack.enabled).every(Boolean), true);

        await clearHarnessDebugLog(page);
        const reorderHandle = page.locator('[data-role="rack-reorder-handle-reverb"]');
        const reorderTarget = page.locator('[data-role="rack-module-filter"]');
        await reorderHandle.scrollIntoViewIfNeeded();
        const handleBox = await reorderHandle.boundingBox();
        const targetBox = await reorderTarget.boundingBox();
        assert.ok(handleBox && targetBox, "Rack pointer-reorder endpoints are missing");
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "one rack reorder commit",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        const orderMessages = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder");
        assert.equal(orderMessages.length, 1, "drag previews must not write DSP structure");
        assert.deepEqual(orderMessages[0].value.moduleIds, [7, 0, 1, 2, 3, 4, 5, 6]);
    } finally {
        await page.close();
    }
});

test("Phaser and Delay keep the selected Free control visibly ineffective when Sync is active", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        for (const effect of [
            { id: "phaser", mode: "phaserRateMode", free: "phaserRate", sync: "phaserRateDivision" },
            { id: "delay", mode: "delayTimeMode", free: "delayTime", sync: "delayDivision" },
        ]) {
            await selectRackEffect(page, effect.id);
            const editor = page.locator(`[data-role="rack-editor-${effect.id}"]`);
            assert.equal(await editor.locator(`[data-role="rack-parameter-${effect.free}"]`).count(), 1);
            assert.equal(await editor.locator(`[data-role="rack-parameter-${effect.sync}"]`).count(), 0);

            await page.evaluate(({ endpointID }) => {
                window.__COSIMO_DESKTOP_HARNESS__.setParameterValue(endpointID, 1, true);
            }, { endpointID: effect.mode });
            await page.waitForFunction(({ effectId, freeEndpointID, syncEndpointID }) => {
                const editorElement = document.querySelector(`[data-role="rack-editor-${effectId}"]`);
                return editorElement?.querySelector(`[data-role="rack-parameter-${freeEndpointID}"]`) !== null
                    && editorElement?.querySelector(`[data-role="rack-parameter-${syncEndpointID}"]`) !== null;
            }, {
                effectId: effect.id,
                freeEndpointID: effect.free,
                syncEndpointID: effect.sync,
            });
            assert.equal(
                ["target-suspended", "effect-bypassed"].includes(
                    await editor.locator(`[data-role="rack-parameter-${effect.free}"]`).getAttribute("data-route-effectiveness"),
                ),
                true,
            );
        }
    } finally {
        await page.close();
    }
});

test("desktop chorus mode buttons do not visually collide in the selected rack editor", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 1, true);
        });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim() === "MotionClassic"
            && document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim() === "BloomLarge"
            && document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim() === "PitchLow 5th"
        ));

        const layout = await page.evaluate(() => {
            const roles = [
                "chorus-motion-mode-control",
                "chorus-bloom-mode-control",
                "chorus-ring-offset-mode-control",
            ];
            const buttons = roles.map((role) => document.querySelector(`[data-role="${role}"]`));

            if (!buttons.every((button) => button instanceof HTMLElement)) {
                return null;
            }

            const rects = buttons.map((button) => {
                const rect = button.getBoundingClientRect();
                const style = window.getComputedStyle(button);
                return {
                    role: button.getAttribute("data-role"),
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    scrollWidth: button.scrollWidth,
                    clientWidth: button.clientWidth,
                    overflowX: style.overflowX,
                    text: button.textContent?.trim(),
                };
            });

            return {
                rects,
                noBoxOverlap: rects.every((rect, index) => rects.every((otherRect, otherIndex) => (
                    index === otherIndex
                    || rect.right <= otherRect.left
                    || otherRect.right <= rect.left
                    || rect.bottom <= otherRect.top
                    || otherRect.bottom <= rect.top
                ))),
                clipsInternalOverflow: rects.every((rect) => rect.overflowX === "hidden"),
                contentFits: rects.every((rect) => rect.scrollWidth <= rect.clientWidth + 1),
            };
        });

        assert.ok(layout, "Expected chorus mode buttons to render.");
        assert.equal(layout.noBoxOverlap, true, `Mode button boxes overlap: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.clipsInternalOverflow, true, `Mode button labels can paint outside their boxes: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.contentFits, true, `Longest chorus mode labels do not fit their buttons: ${JSON.stringify(layout.rects)}`);
    } finally {
        await page.close();
    }
});

test("desktop chorus controls send exact parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        await page.click('[data-role="rack-enabled-chorus"]');
        await editRackParameterValue(page, "chorus-mix-control", "66");
        await page.click('[data-role="chorus-motion-mode-control"]');
        await page.click('[data-role="chorus-bloom-mode-control"]');
        await page.click('[data-role="chorus-ring-offset-mode-control"]');
        await editRackParameterValue(page, "chorus-tone-control", "80");
        await editRackParameterValue(page, "chorus-feedback-control", "70");
        await editRackParameterValue(page, "chorus-ring-amount-control", "50");
        await editRackParameterValue(page, "chorus-ring-fine-control", "-0.75");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus parameter updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "rackEnable"
                    && Array.isArray(value?.enabledFlags)
                    && Number(value.enabledFlags[3]) === 1
                ))
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMix" && Math.abs(Number(value) - 0.66) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMotionMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusBloomMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingOffsetMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusTone" && Math.abs(Number(value) - 0.8) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusFeedback" && Math.abs(Number(value) - 0.7) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingAmount" && Math.abs(Number(value) - 0.5) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingFineSemitones" && Math.abs(Number(value) + 0.75) <= 1e-6)
            ),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "chorusMix"), true);
    } finally {
        await page.close();
    }
});

test("desktop chorus controls render host values before edits", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.375, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 3, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 4, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusTone", 0.825, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusFeedback", 0.615, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingAmount", 0.285, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingFineSemitones", 1.25, true);
        });

        await page.waitForFunction(() => {
            const readInputValue = (role) => document.querySelector(`[data-role="${role}"]`)?.value ?? "";
            const readText = (role) => document.querySelector(`[data-role="${role}"]`)?.textContent ?? "";

            return readInputValue("chorus-mix-control") === "0.375"
                && readInputValue("chorus-tone-control") === "0.825"
                && readInputValue("chorus-feedback-control") === "0.615"
                && readInputValue("chorus-ring-amount-control") === "0.285"
                && readInputValue("chorus-ring-fine-control") === "1.25"
                && readText("chorus-motion-mode-control").includes("Fast")
                && readText("chorus-bloom-mode-control").includes("Lg+Sh")
                && readText("chorus-ring-offset-mode-control").includes("+Oct");
        });

        const rendered = await page.evaluate(() => ({
            mix: document.querySelector('[data-role="chorus-mix-control"]')?.value,
            tone: document.querySelector('[data-role="chorus-tone-control"]')?.value,
            feedback: document.querySelector('[data-role="chorus-feedback-control"]')?.value,
            ring: document.querySelector('[data-role="chorus-ring-amount-control"]')?.value,
            ringFine: document.querySelector('[data-role="chorus-ring-fine-control"]')?.value,
            motionText: document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim(),
            bloomText: document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim(),
            ringOffsetText: document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim(),
        }));

        assert.deepEqual(rendered, {
            mix: "0.375",
            tone: "0.825",
            feedback: "0.615",
            ring: "0.285",
            ringFine: "1.25",
            motionText: "MotionFast",
            bloomText: "BloomLg+Sh",
            ringOffsetText: "Pitch+Oct",
        });
    } finally {
        await page.close();
    }
});

test("desktop chorus knob closes host gesture on pointer cancellation", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 7, buttons: 1, deltaY: 0 },
            { type: "pointermove", pointerId: 7, buttons: 1, deltaY: -12 },
            { type: "pointercancel", pointerId: 7, buttons: 0, deltaY: -12 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cancelled gesture",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus knob closes host gesture when pointer capture is lost", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 8, buttons: 1, deltaY: 0 },
            { type: "pointermove", pointerId: 8, buttons: 1, deltaY: -12 },
            { type: "lostpointercapture", pointerId: 8, buttons: 0, deltaY: -12 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus lost pointer capture cleanup",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus knob closes host gesture when pointer movement reports no pressed buttons", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 9, buttons: 1, deltaY: 0 },
            { type: "pointermove", pointerId: 9, buttons: 1, deltaY: -12 },
            { type: "pointermove", pointerId: 9, buttons: 0, deltaY: -12 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus zero-button pointer cleanup",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus knob ignores mouse movement after a completed drag release", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-control"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.2, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="chorus-mix-control"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();

        if (!box) {
            throw new Error("Expected chorus mix control bounding box.");
        }

        const centerX = box.x + (box.width * 0.5);
        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX, centerY - 26, { steps: 8 });
        await page.mouse.up();

        const valueAfterRelease = await knob.getAttribute("value");
        await clearHarnessDebugLog(page);

        await page.mouse.move(centerX, centerY + 20, { steps: 10 });
        await page.mouse.move(centerX, centerY - 20, { steps: 10 });
        await page.waitForTimeout(100);

        const valueAfterHover = await knob.getAttribute("value");
        const snapshot = await getHarnessSnapshot(page);

        assert.equal(valueAfterHover, valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMix"), []);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
    } finally {
        await page.close();
    }
});

test("desktop chorus cycle buttons wrap through all modes", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-motion-mode-control"]');
        }

        for (let i = 0; i < 6; i += 1) {
            await page.click('[data-role="chorus-bloom-mode-control"]');
        }

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-ring-offset-mode-control"]');
        }

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cycle button updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMotionMode").length >= 5
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusBloomMode").length >= 6
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusRingOffsetMode").length >= 5
            ),
        );

        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusMotionMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusBloomMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 4, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusRingOffsetMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
        );
    } finally {
        await page.close();
    }
});

test("desktop distortion wet low-pass knob renders the full 20 Hz floor", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        await page.waitForSelector('[data-role="rack-editor-drive"]');

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("distortionWetLPHz", 20, true);
        });

        const knobState = await waitForPageValue(
            page,
            "desktop distortion wet low-pass knob state",
            () => {
                const knob = document.querySelector('[data-role="distortion-wet-lp-field"]');

                if (!(knob instanceof HTMLButtonElement)) {
                    return null;
                }

                return {
                    min: knob.getAttribute("aria-valuemin"),
                    max: knob.getAttribute("aria-valuemax"),
                    value: knob.value,
                };
            },
            (nextState) => Boolean(
                nextState
                && nextState.min === "20"
                && nextState.max === "20000"
                && Math.abs(Number(nextState.value) - 20) <= 0.001
            ),
        );

        assert.equal(knobState.min, "20");
        assert.equal(knobState.max, "20000");
        assert.equal(Math.abs(Number(knobState.value) - 20) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop distortion graph renders occupancy bands on the fixed transfer scale", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        const scopeFixture = buildDistortionScopeFixture();
        const historyFixture = buildDistortionHistoryFixture();

        await page.evaluate(({ nextScopeFixture, nextHistoryFixture }) => {
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionScope(nextScopeFixture);
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionHistory(nextHistoryFixture);
        }, {
            nextScopeFixture: scopeFixture,
            nextHistoryFixture: historyFixture,
        });

        const renderedState = await waitForPageValue(
            page,
            "desktop distortion graph state",
            () => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().distortionGraphState,
            (graphState) => Boolean(
                graphState
                && graphState.transfer?.occupancySegmentCount > 0
                && graphState.history?.validBinCount > 0
            ),
        );
        const overlayState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;

            return {
                occupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-occupancy"]').length ?? 0,
                clippedOccupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-occupancy"]').length ?? 0,
                historyOutputColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-output-column"]').length ?? 0,
                historyRemovedColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-removed-column"]').length ?? 0,
                legacyTraceCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-trace"]').length ?? 0,
                legacyClippedPointCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-point"]').length ?? 0,
            };
        });

        assert.equal(renderedState.displayRange, 2);
        assert.equal(renderedState.inputPeak > renderedState.outputPeak, true);
        assert.equal(renderedState.removedPeak > 0.1, true);
        assert.equal(renderedState.clippedSampleCount > 0, true);
        assert.equal(renderedState.transfer.occupancySegmentCount > 0, true);
        assert.equal(renderedState.transfer.clippedOccupancySegmentCount > 0, true);
        assert.equal(renderedState.history.binCount, historyFixture.binCount);
        assert.equal(renderedState.history.validBinCount, historyFixture.validBinCount);
        assert.equal(renderedState.history.clippedBinCount > 0, true);
        assert.equal(renderedState.history.removedPeak > 0.1, true);
        assert.equal(overlayState.occupancyCount > 0, true);
        assert.equal(overlayState.clippedOccupancyCount > 0, true);
        assert.equal(overlayState.historyOutputColumnCount, historyFixture.binCount);
        assert.equal(overlayState.historyRemovedColumnCount > 0, true);
        assert.equal(overlayState.legacyTraceCount, 0);
        assert.equal(overlayState.legacyClippedPointCount, 0);
    } finally {
        await page.close();
    }
});

test("mobile voice tabs mute on active tap and per-tab solo badges write exact endpoints", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.waitForSelector('[data-role="mobile-voice-editor"][data-selected-oscillator-id="A"]');
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector('[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]');
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscBMute"),
            false,
            "Selecting an inactive tab must not toggle Mute.",
        );

        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "active-tab mute toggle",
            (candidate) => Number(candidate.parameterValues.oscBMute) === 1,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-editor"]').getAttribute("data-selected-oscillator-id"),
            "B",
            "Muting must not change the selection.",
        );
        assert.equal(
            (await page.locator('[data-role="mobile-voice-tab-b"]').getAttribute("class")).includes("is-muted"),
            true,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-toolbar"]').isVisible(),
            true,
            "A muted oscillator remains editable.",
        );

        await page.locator('[data-role="mobile-voice-solo-c"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "per-tab solo toggle",
            (candidate) => Number(candidate.parameterValues.oscCSolo) === 1,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-editor"]').getAttribute("data-selected-oscillator-id"),
            "B",
            "Soloing another oscillator must not select it.",
        );
        const strayWrites = snapshot.sentMessages.filter(({ endpointID }) => (
            /^osc[ABC](Octave|Semitone|FineCents|VolumeDb|WavetablePosition|WarpAmount)$/.test(endpointID)
        ));
        assert.deepEqual(strayWrites, [], "Tab actions write only Mute/Solo endpoints.");
    } finally {
        await page.close();
    }
});

test("mobile voice graph drag steers warp and index one axis at a time with a transient readout", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const graph = page.locator('[data-role="mobile-voice-graph"]');
        await graph.waitFor({ state: "visible" });
        const box = await graph.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width * 0.5), y: box.y + (box.height * 0.62) };

        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x + (step * 12), y: start.y, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }

        await waitForHarnessSnapshot(
            page,
            "graph horizontal segment edits warp",
            (candidate) => candidate.sentMessages.some(({ endpointID }) => endpointID === "oscAWarpAmount"),
        );
        const readoutClass = await page
            .locator('[data-role="mobile-voice-graph-readout"]')
            .getAttribute("class");
        assert.equal(readoutClass.includes("is-hidden"), false, "The top-left overlay becomes the live readout.");
        const idleClass = await page
            .locator('[data-role="mobile-voice-wavetable-idle"]')
            .getAttribute("class");
        assert.equal(idleClass.includes("is-hidden"), true);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
            false,
            "A horizontal-dominant segment must not edit Index.",
        );

        // Deliberate turn: pause past the direction window, then move up.
        await page.waitForTimeout(60);
        const turnX = start.x + 48;
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: turnX, y: start.y - (step * 14), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await waitForHarnessSnapshot(
            page,
            "graph vertical segment edits index after the in-gesture switch",
            (candidate) => candidate.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
        );

        const warpWritesBeforeEnd = (await getHarnessSnapshot(page)).sentMessages
            .filter(({ endpointID }) => endpointID === "oscAWarpAmount").length;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-wavetable-idle"]')?.getAttribute("class")?.includes("is-hidden") === false
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWarpAmount").length,
            warpWritesBeforeEnd,
            "After the switch, vertical movement edits only Index.",
        );
        assert.equal(
            snapshot.gestureStarts.filter((value) => value === "oscAWarpAmount").length,
            snapshot.gestureEnds.filter((value) => value === "oscAWarpAmount").length,
            "Every warp host gesture closes exactly once.",
        );
        assert.equal(
            snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length,
            snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length,
            "Every index host gesture closes exactly once.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice vertical readout drag edits only the selected existing route amount under a fixed HUD", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-voice-idx",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0.2,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded voice route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        const cell = page.locator('[data-role="mobile-voice-cell-framePosition"]');
        await cell.waitFor({ state: "visible" });
        const box = await cell.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 12), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }

        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.classList.contains("is-visible") === true
        ));
        assert.equal(await hud.getAttribute("data-hud-axis"), "modulation");
        const hudBox = await hud.boundingBox();
        assert.ok(hudBox);
        const hudCenterX = hudBox.x + (hudBox.width / 2);
        assert.ok(Math.abs(hudCenterX - (393 / 2)) <= 2, "The HUD pins to the top center.");
        assert.ok(hudBox.y <= 40, "The HUD sits inside the top safe area, not near the finger.");

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: start.x, y: start.y - 80, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const hudBoxDuring = await hud.boundingBox();
        assert.ok(hudBoxDuring);
        assert.ok(Math.abs(hudBoxDuring.x - hudBox.x) <= 1 && Math.abs(hudBoxDuring.y - hudBox.y) <= 1,
            "The HUD never repositions during the drag.");

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "vertical drag advanced the selected route amount",
            (candidate) => {
                const routes = readStoredModulationState(candidate).routes;
                return routes.length === 1 && Number(routes[0].amount) > 0.25;
            },
        );
        const routes = readStoredModulationState(snapshot).routes;
        assert.equal(routes.length, 1, "A vertical drag never creates or removes a route.");
        assert.equal(routes[0].targetKind, "oscA.wavetablePosition");
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
            false,
            "A vertical drag must not edit the base value.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice editor stays edge-to-edge without horizontal overflow from 320 to 430", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
    });

    try {
        for (const width of [320, 375, 390, 430]) {
            await page.setViewportSize({ width, height: 760 });
            await page.waitForSelector('[data-role="mobile-voice-editor"]');
            const overflow = await page.evaluate(() => {
                const scroller = document.scrollingElement;
                return {
                    pageOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
                    editorWidth: document.querySelector('[data-role="mobile-voice-editor"]')?.getBoundingClientRect().width ?? 0,
                };
            });
            assert.equal(overflow.pageOverflow <= 0, true, `No horizontal page scroll at ${width}px.`);
            assert.ok(overflow.editorWidth > 0);
        }
    } finally {
        await page.close();
    }
});

test("mobile voice surface scrolls normally outside owned surfaces and never from an owned drag", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    const swipeUp = async (x, y) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: y - (step * 20), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const panelScrollTop = () => page.evaluate(() => (
        document.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop ?? -1
    ));
    const resetPanel = async () => {
        await page.waitForTimeout(650);
        await page.evaluate(() => {
            const panel = document.querySelector('[data-role="mobile-workspace-panel-voice"]');
            if (panel) panel.scrollTop = 0;
        });
    };

    try {
        await page.waitForSelector('[data-role="mobile-voice-editor"]');
        const overflow = await page.evaluate(() => {
            const panel = document.querySelector('[data-role="mobile-workspace-panel-voice"]');
            return panel ? panel.scrollHeight - panel.clientHeight : 0;
        });
        assert.ok(overflow > 40, "The Voice panel must have scrollable content below the editor.");

        const tabs = await page.locator('[data-role="mobile-voice-tabs"]').boundingBox();
        assert.ok(tabs);
        await swipeUp(tabs.x + (tabs.width * 0.5), tabs.y + (tabs.height * 0.5));
        await page.waitForFunction(() => (
            (document.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop ?? 0) > 20
        ), null, { timeout: 3_000 });

        await resetPanel();
        const cell = await page.locator('[data-role="mobile-voice-cell-framePosition"]').boundingBox();
        assert.ok(cell);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: cell.x + (cell.width / 2), y: cell.y + (cell.height / 2), radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: cell.x + (cell.width / 2),
                    y: cell.y + (cell.height / 2) - (step * 20),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
            assert.equal(await panelScrollTop(), 0, "An owned readout drag must never become page scroll.");
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(650);
        assert.equal(await panelScrollTop(), 0, "No deferred scroll may follow an owned drag.");
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice level modulation reaches the +6 dB rail from any base value", async () => {
    // Live repro: with the amp amount range copied from the parameter range
    // (-48..+6), an upward MOD drag could never lift the high limit past
    // base + 6 dB. The amount is an additive dB offset spanning +/-54.
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-amp-reach",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.ampGainDb",
            amount: 0,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded amp route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        const cell = page.locator('[data-role="mobile-voice-cell-volumeDb"]');
        await cell.waitFor({ state: "visible" });
        const box = await cell.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 30), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ));
        const highText = await page.locator('[data-role="mobile-voice-hud-high"]').textContent();
        assert.match(
            (highText ?? "").trim(),
            /^\+?6(\.0)?\s?dB$/,
            `a large upward amount must pin the high limit to the +6 dB parameter rail, got "${highText}"`,
        );
        const sourceText = await page.locator(".mobile-voice-hud-source").textContent();
        assert.ok(
            (sourceText ?? "").includes("dB") && !(sourceText ?? "").includes("%"),
            `amp amounts read in dB, never as a percentage, got "${sourceText}"`,
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "amp amount escaped the old +6 offset cap",
            (candidate) => Number(readStoredModulationState(candidate).routes[0]?.amount ?? 0) > 6,
        );
        const amount = Number(readStoredModulationState(snapshot).routes[0].amount);
        assert.ok(amount > 6 && amount <= 54, `stored offset must exceed +6 dB within +/-54, got ${amount}`);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice pitch modulation is presented by the Semi cell alone and Oct/Fine stay base-only", async () => {
    // Live repro: mapping MSEG 1 -> semitones lit Oct, Semi, AND Fine on the
    // Tune page. The engine has one pitch destination; Semi alone presents it.
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-pitch-single",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 3,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded pitch route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="mobile-voice-page-next"]').click();
        await page.waitForSelector('[data-role="mobile-voice-page"][data-page-name="Tune"]');

        const railState = (controlID) => page
            .locator(`[data-role="mobile-voice-cell-${controlID}"] .mobile-voice-rail`)
            .getAttribute("data-rail-state");
        assert.equal(await railState("semitone"), "mapped", "Semi presents the pitch route");
        assert.equal(await railState("octave"), "not-modulatable", "Oct never presents pitch modulation");
        assert.equal(await railState("fineCents"), "not-modulatable", "Fine never presents pitch modulation");

        const targetKindOf = (controlID) => page
            .locator(`[data-role="mobile-voice-cell-${controlID}"]`)
            .getAttribute("data-modulation-target-kind");
        assert.equal(await targetKindOf("semitone"), "oscA.pitchSemitones");
        assert.equal(await targetKindOf("octave"), null, "Oct is not a pitch drop target");
        assert.equal(await targetKindOf("fineCents"), null, "Fine is not a pitch drop target");

        await page.locator('[data-role="mobile-voice-chip-route-dot-semitone"]').waitFor({ state: "visible" });

        const octBox = await page.locator('[data-role="mobile-voice-cell-octave"]').boundingBox();
        assert.ok(octBox);
        const start = { x: octBox.x + (octBox.width / 2), y: octBox.y + (octBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 14), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.classList.contains("is-visible") === true
        ));
        assert.equal(
            await page.locator('[data-role="mobile-voice-hud"]').getAttribute("data-hud-axis"),
            "base",
            "a vertical drag on Oct stays in the base presentation",
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(150);

        const routes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routes.length, 1);
        assert.equal(Number(routes[0].amount), 3, "an Oct drag never edits the pitch route amount");
    } finally {
        await cdp.detach();
        await page.close();
    }
});
