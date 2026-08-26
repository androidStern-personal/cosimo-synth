import type { PatchConnectionLike } from "./cmajor-react";
import {
    EFFECT_ID_TO_LANE_TYPE,
    LANE_STATE_KEY,
    deserializeLaneState,
    serializeLaneState,
} from "./lane-state";
import { getLaneSlotId, getLaneSlotParamIndex } from "./lane-slot-params";
import { getRackParameterDescriptor } from "./rack-parameter-descriptors";
import { createModulationArticulationWorkerService } from "../worker/modulation-articulation-worker-service";
import { allTargetDescriptors } from "./target-descriptor";
import {
    OSCILLATOR_BINDING_CONTRACTS,
    type OscillatorControlID,
} from "./oscillator-binding";
import {
    GLOBAL_TUNE_ENDPOINT_ID,
    GLOBAL_TUNE_INITIAL_SEMITONES,
    GLOBAL_TUNE_MAX_SEMITONES,
    GLOBAL_TUNE_MIN_SEMITONES,
} from "./global-tune";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "oscAWavetablePosition";
const wavetableSelectEndpointID = "oscAWavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const panEndpointID = "oscAPan";
const warpModeEndpointID = "oscAWarpMode";
const warpAmountEndpointID = "oscAWarpAmount";
const filterModeEndpointID = "filterMode";
const filterCutoffEndpointID = "filterCutoff";
const filterQEndpointID = "filterQ";
const filterMixEndpointID = "filterMix";
const unisonVoicesEndpointID = "oscAUnisonVoices";
const unisonDetuneEndpointID = "oscAUnisonDetune";
const unisonBlendEndpointID = "oscAUnisonBlend";
const unisonWidthEndpointID = "oscAUnisonWidth";
const unisonPhaseEndpointID = "oscAPhase";
const unisonRandomEndpointID = "oscAPhaseRandom";
const unisonPhaseModeEndpointID = "oscARetrigger";
const unisonDetuneModeEndpointID = "oscAUnisonDetuneMode";
const unisonStackModeEndpointID = "oscAUnisonStackMode";
const unisonWavetablePositionSpreadEndpointID = "oscAUnisonPositionSpread";
const unisonWarpSpreadEndpointID = "oscAUnisonWarpSpread";
const mseg1MorphEndpointID = "mseg1Morph";
const mseg2MorphEndpointID = "mseg2Morph";
const mseg3MorphEndpointID = "mseg3Morph";
const hiddenSynthPresetGuardEndpointID = "hiddenSynthPresetGuard";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeInstallAckEndpointID = "runtimeInstallAck";
const runtimeStateEndpointID = "runtimeState";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const effectiveWarpStateEndpointID = "effectiveWarpState";
const effectiveUnisonStateEndpointID = "effectiveUnisonState";
const effectiveFilterStateEndpointID = "effectiveFilterState";
const effectiveMsegStateEndpointID = "effectiveMsegState";
const effectiveModSourceStateEndpointID = "effectiveModSourceState";
const filterSpectrumEndpointID = "filterSpectrum";
const distortionHistoryEndpointID = "distortionHistory";
const distortionScopeEndpointID = "distortionScope";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const wavetablePrewarmRequestEndpointID = "wavetablePrewarmRequest";
const wavetablePrewarmNotificationEndpointID = "wavetablePrewarmNotification";
const HARNESS_WAVETABLE_ACTIVATION_DELAY_MS = 700;

type OscillatorParameterAnnotation = {
    readonly name: string;
    readonly min: number;
    readonly max: number;
    readonly init: number;
    readonly discrete?: boolean;
    readonly step?: number;
    readonly unit?: string;
};

const oscillatorParameterAnnotations: Record<OscillatorControlID, OscillatorParameterAnnotation> = {
    wavetableSelect: { name: "Wavetable Select", min: 0, max: 237, init: 0, discrete: true, step: 1 },
    framePosition: { name: "Wavetable Position", min: 0, max: 1, init: 0 },
    pan: { name: "Pan", min: -1, max: 1, init: 0 },
    octave: { name: "Octave", min: -4, max: 4, init: 0, discrete: true, step: 1 },
    semitone: { name: "Semitone", min: -12, max: 12, init: 0, discrete: true, step: 1 },
    fineCents: { name: "Fine Cents", min: -100, max: 100, init: 0, unit: "cents" },
    phase: { name: "Phase", min: 0, max: 1, init: 0 },
    phaseRandom: { name: "Phase Random", min: 0, max: 1, init: 0 },
    retrigger: { name: "Retrigger", min: 0, max: 1, init: 1, discrete: true, step: 1 },
    volumeDb: { name: "Volume", min: -48, max: 6, init: -9.542425, unit: "dB" },
    mute: { name: "Mute", min: 0, max: 1, init: 0, discrete: true, step: 1 },
    solo: { name: "Solo", min: 0, max: 1, init: 0, discrete: true, step: 1 },
    warpMode: { name: "Warp Mode", min: 0, max: 4, init: 0, discrete: true, step: 1 },
    warpAmount: { name: "Warp Amount", min: 0, max: 1, init: 0 },
    unisonVoices: { name: "Unison", min: 1, max: 8, init: 1, discrete: true, step: 1 },
    unisonDetune: { name: "Unison Detune", min: 0, max: 1, init: 0.1 },
    unisonBlend: { name: "Unison Blend", min: 0, max: 1, init: 0.75 },
    unisonWidth: { name: "Unison Width", min: 0, max: 1, init: 1 },
    unisonDetuneMode: { name: "Unison Detune Mode", min: 0, max: 4, init: 0, discrete: true, step: 1 },
    unisonStackMode: { name: "Unison Stack", min: 0, max: 4, init: 0, discrete: true, step: 1 },
    unisonWavetablePositionSpread: { name: "Unison WT Pos", min: 0, max: 1, init: 0 },
    unisonWarpSpread: { name: "Unison Warp", min: 0, max: 1, init: 0 },
};

const manuallyDeclaredOscillatorEndpoints = new Set([
    wavetablePositionEndpointID,
    wavetableSelectEndpointID,
    panEndpointID,
    warpModeEndpointID,
    warpAmountEndpointID,
    unisonVoicesEndpointID,
    unisonDetuneEndpointID,
    unisonBlendEndpointID,
    unisonWidthEndpointID,
    unisonPhaseEndpointID,
    unisonRandomEndpointID,
    unisonPhaseModeEndpointID,
    unisonDetuneModeEndpointID,
    unisonStackModeEndpointID,
    unisonWavetablePositionSpreadEndpointID,
    unisonWarpSpreadEndpointID,
]);

function buildAdditionalOscillatorStatusInputs() {
    return OSCILLATOR_BINDING_CONTRACTS.flatMap((contract) => contract.controls.flatMap((control) => {
        if (manuallyDeclaredOscillatorEndpoints.has(control.endpointID)) return [];
        const annotation = oscillatorParameterAnnotations[control.controlID];
        return [{
            endpointID: control.endpointID,
            purpose: "parameter",
            annotation: {
                ...annotation,
                name: `Oscillator ${contract.id} ${annotation.name}`,
            },
        }];
    }));
}

function buildModulationGeneratorStatusInputs() {
    return allTargetDescriptors().flatMap((descriptor) => {
        if (descriptor.binding._tag !== "endpoint"
            || (!descriptor.moduleId.startsWith("mseg") && !descriptor.moduleId.startsWith("env"))
            || [mseg1MorphEndpointID, mseg2MorphEndpointID, mseg3MorphEndpointID]
                .includes(descriptor.binding.endpointId)) {
            return [];
        }
        const range = descriptor.format.kind === "time"
            ? { min: descriptor.format.minSeconds, max: descriptor.format.maxSeconds }
            : { min: 0, max: 1 };
        return [{
            endpointID: descriptor.binding.endpointId,
            purpose: "parameter",
            annotation: {
                name: descriptor.label,
                ...range,
                init: descriptor.binding.toEngine(descriptor.initialValue),
            },
        }];
    });
}

type ParameterListener = (value: unknown) => void;
type EndpointListener = (value: unknown) => void;
type StatusListener = (status: unknown) => void;
type StoredStateListener = (message: unknown) => void;

function createKeyboardDebugState() {
    return {
        attachCalls: [] as Array<{ endpointID: string }>,
        detachCount: 0,
        handledKeys: [] as Array<{ key: string; isDown: boolean }>,
        allNotesOffCount: 0,
        refreshHTMLCount: 0,
        refreshActiveNoteElementsCount: 0,
    };
}

const qwertyNoteOffsets = new Map([
    ["a", 0],
    ["w", 1],
    ["s", 2],
    ["e", 3],
    ["d", 4],
    ["f", 5],
    ["t", 6],
    ["g", 7],
    ["y", 8],
    ["h", 9],
    ["u", 10],
    ["j", 11],
    ["k", 12],
    ["o", 13],
    ["l", 14],
    ["p", 15],
    [";", 16],
    ["'", 17],
]);

class MockPianoKeyboard extends HTMLElement {
    notes: unknown[] = [];
    naturalWidth = 22;
    accidentalWidth = 13;
    private attachedPatchConnection: PatchConnectionLike | null = null;
    private attachedEndpointID: string | null = null;
    debug = createKeyboardDebugState();

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }

                .note-holder {
                    width: 100%;
                    height: 100%;
                    border-radius: 18px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background:
                        repeating-linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.96) 0,
                            rgba(255, 255, 255, 0.96) 24px,
                            rgba(245, 216, 166, 0.94) 24px,
                            rgba(245, 216, 166, 0.94) 26px
                        );
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
                }
            </style>
            <div class="note-holder" tabindex="0" title="Desktop harness keyboard"></div>
        `;
    }

    handleExternalMIDI() {}

    handleKey(event: KeyboardEvent, isDown: boolean) {
        this.debug.handledKeys.push({
            key: event.key,
            isDown,
        });

        if (!this.attachedPatchConnection || !this.attachedEndpointID) {
            return;
        }

        const noteOffset = qwertyNoteOffsets.get(event.key.toLowerCase());

        if (noteOffset === undefined) {
            return;
        }

        const midiStatus = isDown ? 0x90 : 0x80;
        const rootNote = Math.max(0, Math.round(Number(this.getAttribute("root-note")) || 0));
        const noteNumber = rootNote + noteOffset;
        const velocity = isDown ? 100 : 0;
        const shortMIDICode = (midiStatus << 16) | (noteNumber << 8) | velocity;

        this.attachedPatchConnection.sendMIDIInputEvent?.(this.attachedEndpointID, shortMIDICode);
    }

    allNotesOff() {
        this.debug.allNotesOffCount += 1;
    }

    attachToPatchConnection(_patchConnection: PatchConnectionLike, endpointID: string) {
        this.attachedPatchConnection = _patchConnection;
        this.attachedEndpointID = endpointID;
        this.debug.attachCalls.push({ endpointID });
        (_patchConnection as { recordKeyboardAttach?: (endpointID: string) => void }).recordKeyboardAttach?.(endpointID);
    }

    detachPatchConnection() {
        const patchConnection = this.attachedPatchConnection;
        this.attachedPatchConnection = null;
        this.attachedEndpointID = null;
        this.debug.detachCount += 1;
        (patchConnection as { recordKeyboardDetach?: () => void })?.recordKeyboardDetach?.();
    }

    refreshHTML() {
        this.debug.refreshHTMLCount += 1;
    }

    bindRenderedTouchHandlers() {}

    refreshActiveNoteElements() {
        this.debug.refreshActiveNoteElementsCount += 1;
    }

    resetDebug() {
        this.debug = createKeyboardDebugState();
    }
}

function createDefaultRuntimeState() {
    return {
        dspSessionId: 1,
        oscillatorIndex: 0,
        desiredTableIndex: 0,
        desiredIntentSerial: 1,
        serviceState: 0,
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
}

function createInitialParameterValues(): Map<string, unknown> {
    const values = new Map<string, unknown>([
        [wavetablePositionEndpointID, 0.28],
        [wavetableSelectEndpointID, 0],
        [playModeEndpointID, 0],
        [glideTimeEndpointID, 0.15],
        [panEndpointID, 0],
        [warpModeEndpointID, 0],
        [warpAmountEndpointID, 0],
        [filterModeEndpointID, 0],
        [filterCutoffEndpointID, 1000],
        [filterQEndpointID, 0.707107],
        [filterMixEndpointID, 1],
        [unisonVoicesEndpointID, 1],
        [unisonDetuneEndpointID, 0.1],
        [unisonBlendEndpointID, 0.75],
        [unisonWidthEndpointID, 1],
        [unisonPhaseEndpointID, 0],
        [unisonRandomEndpointID, 0],
        [unisonPhaseModeEndpointID, 0],
        [unisonDetuneModeEndpointID, 0],
        [unisonStackModeEndpointID, 0],
        [unisonWavetablePositionSpreadEndpointID, 0],
        [unisonWarpSpreadEndpointID, 0],
        [mseg1MorphEndpointID, 0],
        [mseg2MorphEndpointID, 0],
        [mseg3MorphEndpointID, 0],
        [hiddenSynthPresetGuardEndpointID, 0.42],
    ]);

    // The mock models Cmajor's parameter state. Keep every product-bound
    // endpoint at the same engine-unit initial value as the binding catalog.
    for (const descriptor of allTargetDescriptors()) {
        // Lane parameters have no host endpoints since the parameter cut.
        if (descriptor.binding._tag === "endpoint"
                && getRackParameterDescriptor(descriptor.binding.endpointId) === null) {
            values.set(
                descriptor.binding.endpointId,
                descriptor.binding.toEngine(descriptor.initialValue),
            );
        }
    }

    for (const contract of OSCILLATOR_BINDING_CONTRACTS) {
        for (const control of contract.controls) {
            if (!values.has(control.endpointID)) {
                values.set(control.endpointID, oscillatorParameterAnnotations[control.controlID].init);
            }
        }
    }
    return values;
}

function buildHarnessStatus(manifest: unknown) {
    return {
        manifest,
        details: {
            inputs: [
                {
                    endpointID: midiInputEndpointID,
                    purpose: "event",
                },
                {
                    endpointID: wavetablePositionEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Wavetable Position",
                        min: 0,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: wavetableSelectEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Wavetable Select",
                        min: 0,
                        max: 255,
                        init: 0,
                    },
                },
                {
                    endpointID: playModeEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Voice Mode",
                        min: 0,
                        max: 2,
                        init: 0,
                    },
                },
                {
                    endpointID: glideTimeEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Glide Time",
                        min: 0,
                        max: 2,
                        init: 0,
                    },
                },
                {
                    endpointID: GLOBAL_TUNE_ENDPOINT_ID,
                    purpose: "parameter",
                    annotation: {
                        name: "Global Tune",
                        min: GLOBAL_TUNE_MIN_SEMITONES,
                        max: GLOBAL_TUNE_MAX_SEMITONES,
                        init: GLOBAL_TUNE_INITIAL_SEMITONES,
                        unit: "st",
                    },
                },
                {
                    endpointID: panEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Pan",
                        min: -1,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: warpModeEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Warp Mode",
                        min: 0,
                        max: 4,
                        init: 0,
                    },
                },
                {
                    endpointID: warpAmountEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Warp Amount",
                        min: 0,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: filterModeEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Filter Mode",
                        min: 0,
                        max: 5,
                        init: 0,
                    },
                },
                {
                    endpointID: filterCutoffEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Filter Cutoff",
                        min: 20,
                        max: 20000,
                        init: 1000,
                    },
                },
                {
                    endpointID: filterQEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Filter Q",
                        min: 0.1,
                        max: 20,
                        init: 0.707107,
                    },
                },
                {
                    endpointID: filterMixEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Filter Mix",
                        min: 0,
                        max: 1,
                        init: 1,
                    },
                },
                {
                    endpointID: unisonVoicesEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison", min: 1, max: 8, init: 1 },
                },
                {
                    endpointID: unisonDetuneEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Detune", min: 0, max: 1, init: 0.1 },
                },
                {
                    endpointID: unisonBlendEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Blend", min: 0, max: 1, init: 0.75 },
                },
                {
                    endpointID: unisonWidthEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Width", min: 0, max: 1, init: 1 },
                },
                {
                    endpointID: unisonPhaseEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Phase", min: 0, max: 1, init: 0 },
                },
                {
                    endpointID: unisonRandomEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Random", min: 0, max: 1, init: 0 },
                },
                {
                    endpointID: unisonPhaseModeEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Phase Mode", min: 0, max: 1, init: 0 },
                },
                {
                    endpointID: unisonDetuneModeEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Detune Mode", min: 0, max: 4, init: 0 },
                },
                {
                    endpointID: unisonStackModeEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Stack", min: 0, max: 4, init: 0 },
                },
                {
                    endpointID: unisonWavetablePositionSpreadEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison WT Pos", min: 0, max: 1, init: 0 },
                },
                {
                    endpointID: unisonWarpSpreadEndpointID,
                    purpose: "parameter",
                    annotation: { name: "Unison Warp", min: 0, max: 1, init: 0 },
                },
                {
                    endpointID: mseg1MorphEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "MSEG 1 Morph",
                        min: 0,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: mseg2MorphEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "MSEG 2 Morph",
                        min: 0,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: mseg3MorphEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "MSEG 3 Morph",
                        min: 0,
                        max: 1,
                        init: 0,
                    },
                },
                {
                    endpointID: hiddenSynthPresetGuardEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Hidden Synth Preset Guard",
                        hidden: true,
                        min: 0,
                        max: 1,
                        init: 0.42,
                    },
                },
                ...buildModulationGeneratorStatusInputs(),
                ...buildAdditionalOscillatorStatusInputs(),
            ],
        },
    };
}

export class MockPatchConnection implements PatchConnectionLike {
    manifest: unknown;
    utilities = {
        PianoKeyboard: MockPianoKeyboard,
        ParameterControls: {},
    };
    sentMessages: Array<{ endpointID: string; value: unknown }> = [];
    gestureStarts: string[] = [];
    gestureEnds: string[] = [];
    endpointMessages: Array<{ endpointID: string; value: unknown }> = [];
    midiInputEvents: Array<{ endpointID: string; value: number }> = [];
    keyboardAttachCalls: Array<{ endpointID: string }> = [];
    keyboardDetachCount = 0;

    private parameterValues = createInitialParameterValues();
    private parameterListeners = new Map<string, Set<ParameterListener>>();
    private endpointListeners = new Map<string, Set<EndpointListener>>();
    private statusListeners = new Set<StatusListener>();
    private storedStateListeners = new Set<StoredStateListener>();
    // The engine-model overlay for lane field uploads: the DSP's current
    // parameter truth is the last full record or field write per slot/param,
    // which mid-gesture runs AHEAD of the persisted lane.v1 document.
    private laneFieldOverlay = new Map<string, number>();
    private storedState = new Map<string, unknown>();
    private runtimeState = createDefaultRuntimeState();
    private wavetableActivationTimerID: number | null = null;
    private acceptedModulationSerial = 0;
    private acceptedArticulationSerial = 0;
    private status: unknown;
    private readonly modulationArticulationWorkerService;

    constructor(manifest: unknown) {
        this.manifest = manifest;
        this.status = buildHarnessStatus(manifest);
        this.modulationArticulationWorkerService = createModulationArticulationWorkerService(this);
        this.modulationArticulationWorkerService.start();
        queueMicrotask(() => this.emitEndpoint(runtimeStateEndpointID, this.runtimeState));
    }

    protected cancelScheduledWavetableActivation() {
        if (this.wavetableActivationTimerID === null) {
            return;
        }
        window.clearTimeout(this.wavetableActivationTimerID);
        this.wavetableActivationTimerID = null;
    }

    protected scheduleWavetableActivation(tableIndex: number, generation: number) {
        this.cancelScheduledWavetableActivation();
        const intentSerial = this.runtimeState.desiredIntentSerial;
        this.wavetableActivationTimerID = window.setTimeout(() => {
            this.wavetableActivationTimerID = null;
            if (!this.runtimeState.hasLoading
                || this.runtimeState.hasFailure
                || this.runtimeState.desiredIntentSerial !== intentSerial
                || this.runtimeState.loadingTableIndex !== tableIndex
                || this.runtimeState.loadingGeneration !== generation) {
                return;
            }

            this.runtimeState = {
                ...this.runtimeState,
                hasActive: true,
                activeTableIndex: tableIndex,
                activeGeneration: generation,
                hasLoading: false,
                loadingTableIndex: 0,
                loadingGeneration: 0,
            };
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
        }, HARNESS_WAVETABLE_ACTIVATION_DELAY_MS);
    }

    getResourceAddress(path: string) {
        const normalisedPath = path.startsWith("/") ? path : `/${path}`;
        return new URL(normalisedPath, window.location.href).toString();
    }

    addParameterListener(endpointID: string, listener: ParameterListener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID: string, listener: ParameterListener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID: string) {
        queueMicrotask(() => {
            const value = this.parameterValues.get(endpointID) ?? 0;
            this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
        });
    }

    sendEventOrValue(endpointID: string, value: unknown) {
        this.sentMessages.push({ endpointID, value });

        if (endpointID === "laneSlotParamValue" && value && typeof value === "object") {
            const upload = value as { slotId?: unknown; paramIndex?: unknown; value?: unknown };
            this.laneFieldOverlay.set(
                `${Math.trunc(Number(upload.slotId))}:${Math.trunc(Number(upload.paramIndex))}`,
                Number(upload.value),
            );
        }
        if (endpointID === "laneSlotParams" && value && typeof value === "object") {
            const upload = value as { slotId?: unknown; values?: unknown };
            const slotId = Math.trunc(Number(upload.slotId));
            if (Array.isArray(upload.values)) {
                upload.values.forEach((fieldValue, paramIndex) => {
                    this.laneFieldOverlay.set(`${slotId}:${paramIndex}`, Number(fieldValue));
                });
            }
        }

        if (endpointID === runtimeSyncRequestEndpointID) {
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
            queueMicrotask(() => this.emitRuntimeInstallAck(Math.trunc(Number(value) || 0)));
            return;
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
            const payload = value as { dspSessionId?: unknown; deliverySerial?: unknown };
            const dspSessionId = Math.trunc(Number(payload.dspSessionId) || 0);
            const deliverySerial = Math.trunc(Number(payload.deliverySerial) || 0);
            if (dspSessionId === this.runtimeState.dspSessionId && deliverySerial !== 0) {
                if (deliverySerial === this.acceptedModulationSerial + 1) {
                    this.acceptedModulationSerial = deliverySerial;
                } else if (deliverySerial === this.acceptedArticulationSerial - 1) {
                    this.acceptedArticulationSerial = deliverySerial;
                }
                queueMicrotask(() => this.emitRuntimeInstallAck(0));
                return;
            }
        }

        if (endpointID === runtimeInstallAckEndpointID) {
            return;
        }

        if (endpointID === retryDesiredTableRequestEndpointID) {
            const retryGeneration = Math.max(
                this.runtimeState.activeGeneration,
                this.runtimeState.loadingGeneration,
                this.runtimeState.failedGeneration,
                0,
            ) + 1;
            this.runtimeState = {
                ...this.runtimeState,
                hasFailure: false,
                hasLoading: true,
                loadingTableIndex: this.runtimeState.desiredTableIndex,
                loadingGeneration: retryGeneration,
            };
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
            this.scheduleWavetableActivation(this.runtimeState.desiredTableIndex, retryGeneration);
            return;
        }

        if (endpointID === wavetablePrewarmRequestEndpointID) {
            this.emitEndpoint(wavetablePrewarmNotificationEndpointID, Math.max(0, Math.trunc(Number(value) || 0)));
            return;
        }

        this.parameterValues.set(endpointID, value);
        this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

        if (endpointID === wavetablePositionEndpointID) {
            this.emitEndpoint(effectiveWavetablePositionEndpointID, {
                voiceGeneration: 1,
                position: value,
            });
        }

        if (endpointID === wavetableSelectEndpointID) {
            const tableIndex = Math.max(0, Math.trunc(Number(value) || 0));
            const isAlreadyActive = this.runtimeState.hasActive && this.runtimeState.activeTableIndex === tableIndex;
            const nextGeneration = Math.max(
                this.runtimeState.activeGeneration,
                this.runtimeState.loadingGeneration,
                this.runtimeState.failedGeneration,
                0,
            ) + 1;
            this.runtimeState = {
                ...this.runtimeState,
                desiredTableIndex: tableIndex,
                desiredIntentSerial: this.runtimeState.desiredIntentSerial + 1,
                hasLoading: !isAlreadyActive,
                loadingTableIndex: tableIndex,
                loadingGeneration: isAlreadyActive ? 0 : nextGeneration,
                hasFailure: false,
                failedTableIndex: 0,
                failedGeneration: 0,
                failureScope: 0,
                failurePhase: 0,
                failureReasonCode: 0,
            };
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
            if (isAlreadyActive) {
                this.cancelScheduledWavetableActivation();
            } else {
                this.scheduleWavetableActivation(tableIndex, nextGeneration);
            }
        }
    }

    sendParameterGestureStart(endpointID: string) {
        this.gestureStarts.push(endpointID);
    }

    sendParameterGestureEnd(endpointID: string) {
        this.gestureEnds.push(endpointID);
    }

    addEndpointListener(endpointID: string, listener: EndpointListener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID: string, listener: EndpointListener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    private emitEndpoint(endpointID: string, value: unknown) {
        this.endpointMessages.push({ endpointID, value });
        this.endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    private emitRuntimeInstallAck(syncSerial: number) {
        this.emitEndpoint(runtimeInstallAckEndpointID, {
            dspSessionId: this.runtimeState.dspSessionId,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: this.acceptedArticulationSerial,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial,
        });
    }

    sendMIDIInputEvent(endpointID: string, value: number) {
        this.midiInputEvents.push({ endpointID, value });
        this.emitEndpoint(endpointID, { message: value });
    }

    addStatusListener(listener: StatusListener) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener: StatusListener) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        queueMicrotask(() => {
            this.statusListeners.forEach((listener) => listener(this.status));
        });
    }

    addStoredStateValueListener(listener: StoredStateListener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener: StoredStateListener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
        queueMicrotask(() => callback(Object.fromEntries(this.storedState.entries())));
    }

    requestStoredStateValue(key: string) {
        queueMicrotask(() => {
            const message = {
                key,
                value: this.storedState.get(key),
            };
            this.storedStateListeners.forEach((listener) => listener(message));
        });
    }

    sendStoredStateValue(key: string, value: unknown) {
        this.storedState.set(key, value);
        const message = { key, value };
        this.storedStateListeners.forEach((listener) => listener(message));
    }

    clearDebugLog() {
        this.sentMessages = [];
        this.gestureStarts = [];
        this.gestureEnds = [];
        this.endpointMessages = [];
        this.midiInputEvents = [];
    }

    getDebugSnapshot() {
        const laneDocument = deserializeLaneState(this.storedState.get(LANE_STATE_KEY));
        const laneParams: Record<string, number> = {};
        for (const [effectId, deviceParams] of Object.entries(laneDocument.params)) {
            const deviceType = EFFECT_ID_TO_LANE_TYPE[effectId as keyof typeof EFFECT_ID_TO_LANE_TYPE];
            for (const [endpointID, documentValue] of Object.entries(deviceParams)) {
                const overlayKey = `${getLaneSlotId(deviceType, 0)}:${getLaneSlotParamIndex(deviceType, endpointID)}`;
                laneParams[endpointID] = this.laneFieldOverlay.get(overlayKey) ?? documentValue;
            }
        }
        return {
            parameterValues: Object.fromEntries(this.parameterValues.entries()),
            laneParams,
            runtimeState: { ...this.runtimeState },
            storedState: Object.fromEntries(this.storedState.entries()),
            sentMessages: this.sentMessages.map((message) => ({
                endpointID: message.endpointID,
                value: message.value,
            })),
            gestureStarts: [...this.gestureStarts],
            gestureEnds: [...this.gestureEnds],
            endpointMessages: this.endpointMessages.map((message) => ({
                endpointID: message.endpointID,
                value: message.value,
            })),
            midiInputEvents: this.midiInputEvents.map((message) => ({
                endpointID: message.endpointID,
                value: message.value,
            })),
            keyboardAttachCalls: this.keyboardAttachCalls.map(({ endpointID }) => ({ endpointID })),
            keyboardDetachCount: this.keyboardDetachCount,
            parameterListenerCounts: Object.fromEntries(Array.from(this.parameterListeners.entries()).map(([
                endpointID,
                listeners,
            ]) => [endpointID, listeners.size])),
            endpointListenerCounts: Object.fromEntries(Array.from(this.endpointListeners.entries()).map(([
                endpointID,
                listeners,
            ]) => [endpointID, listeners.size])),
        };
    }

    recordKeyboardAttach(endpointID: string) {
        this.keyboardAttachCalls.push({ endpointID });
    }

    recordKeyboardDetach() {
        this.keyboardDetachCount += 1;
    }

    setRuntimeState(nextState: Partial<ReturnType<typeof createDefaultRuntimeState>>) {
        this.cancelScheduledWavetableActivation();
        const previousDspSessionId = this.runtimeState.dspSessionId;
        this.runtimeState = {
            ...this.runtimeState,
            ...nextState,
        };
        if (this.runtimeState.dspSessionId !== previousDspSessionId) {
            this.acceptedModulationSerial = 0;
            this.acceptedArticulationSerial = 0;
        }
        this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
    }

    /**
     * Seed one lane parameter the way the product changes it durably: through
     * the lane.v1 document. Since the parameter cut, effect parameters have
     * no host endpoints, so tests simulating external edits write the
     * document and let the stored-state listener fan out.
     */
    setLaneParamValue(endpointID: string, value: number) {
        const descriptor = getRackParameterDescriptor(endpointID);
        if (descriptor === null) {
            throw new Error(`Not a lane parameter endpoint: ${endpointID}`);
        }
        const current = deserializeLaneState(this.storedState.get(LANE_STATE_KEY));
        const next = {
            ...current,
            params: {
                ...current.params,
                [descriptor.effectId]: {
                    ...current.params[descriptor.effectId],
                    [endpointID]: value,
                },
            },
        };
        const deviceType = EFFECT_ID_TO_LANE_TYPE[descriptor.effectId];
        this.laneFieldOverlay.delete(
            `${getLaneSlotId(deviceType, 0)}:${getLaneSlotParamIndex(deviceType, endpointID)}`,
        );
        this.setStoredStateValue(LANE_STATE_KEY, serializeLaneState(next));
    }

    setParameterValue(endpointID: string, value: unknown, emitEndpoint = false) {
        this.parameterValues.set(endpointID, value);
        this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

        if (emitEndpoint) {
            this.emitEndpoint(endpointID, value);
        }
    }

    emitEffectiveWavetablePosition(position: number, voiceGeneration = 1) {
        this.emitEndpoint(effectiveWavetablePositionEndpointID, {
            voiceGeneration,
            position,
        });
    }

    emitEffectiveFilterState(
        {
            voiceGeneration = 1,
            hasActive = true,
            mode = 1,
            cutoffHz = 1000,
            q = 0.707107,
        }: {
            voiceGeneration?: number;
            hasActive?: boolean;
            mode?: number;
            cutoffHz?: number;
            q?: number;
        } = {},
    ) {
        this.emitEndpoint(effectiveFilterStateEndpointID, {
            voiceGeneration,
            hasActive: hasActive ? 1 : 0,
            mode,
            cutoffHz,
            q,
        });
    }

    emitEffectiveMsegState(
        {
            voiceGeneration = 1,
            hasActive = true,
            positions = [0, 0, 0],
        }: {
            voiceGeneration?: number;
            hasActive?: boolean;
            positions?: number[];
        } = {},
    ) {
        this.emitEndpoint(effectiveMsegStateEndpointID, {
            voiceGeneration,
            hasActive: hasActive ? 1 : 0,
            positions,
        });
    }

    emitEffectiveModSourceState(
        {
            voiceGeneration = 1,
            hasActive = true,
            values = [0, 0, 0, 0, 0, 0, 0, 0, 0],
        }: {
            voiceGeneration?: number;
            hasActive?: boolean;
            values?: number[];
        } = {},
    ) {
        this.emitEndpoint(effectiveModSourceStateEndpointID, {
            voiceGeneration,
            hasActive: hasActive ? 1 : 0,
            values,
        });
    }

    emitFilterSpectrum(
        {
            sampleRateHz = 44_100,
            magnitudes = [],
        }: {
            sampleRateHz?: number;
            magnitudes?: number[];
        } = {},
    ) {
        this.emitEndpoint(filterSpectrumEndpointID, {
            sampleRateHz,
            magnitudes,
        });
    }

    emitDistortionScope(
        {
            sampleRateHz = 44_100,
            dominantChannel = 0,
            inputPeak = 0,
            outputPeak = 0,
            removedPeak = 0,
            inputSamples = [],
            outputSamples = [],
        }: {
            sampleRateHz?: number;
            dominantChannel?: number;
            inputPeak?: number;
            outputPeak?: number;
            removedPeak?: number;
            inputSamples?: number[];
            outputSamples?: number[];
        } = {},
    ) {
        this.emitEndpoint(distortionScopeEndpointID, {
            sampleRateHz,
            dominantChannel,
            inputPeak,
            outputPeak,
            removedPeak,
            inputSamples,
            outputSamples,
        });
    }

    emitDistortionHistory(
        {
            sampleRateHz = 44_100,
            horizonMs = 2_000,
            binDurationMs = 12.5,
            binCount = 160,
            validBinCount = 160,
            inputMins = [],
            inputMaxs = [],
            outputMins = [],
            outputMaxs = [],
        }: {
            sampleRateHz?: number;
            horizonMs?: number;
            binDurationMs?: number;
            binCount?: number;
            validBinCount?: number;
            inputMins?: number[];
            inputMaxs?: number[];
            outputMins?: number[];
            outputMaxs?: number[];
        } = {},
    ) {
        this.emitEndpoint(distortionHistoryEndpointID, {
            sampleRateHz,
            horizonMs,
            binDurationMs,
            binCount,
            validBinCount,
            inputMins,
            inputMaxs,
            outputMins,
            outputMaxs,
        });
    }

    emitEffectiveWarpState(
        {
            voiceGeneration = 1,
            hasActive = true,
            mode = 1,
            amount = 0.5,
        }: {
            voiceGeneration?: number;
            hasActive?: boolean;
            mode?: number;
            amount?: number;
        } = {},
    ) {
        this.emitEndpoint(effectiveWarpStateEndpointID, {
            voiceGeneration,
            hasActive: hasActive ? 1 : 0,
            mode,
            amount,
        });
    }

    emitEffectiveUnisonState(
        {
            voiceGeneration = 1,
            hasActive = true,
            voices = 4,
            detune = 0.35,
            blend = 0.75,
            width = 1,
            detuneMode = 0,
            stackMode = 0,
            wavetablePositionSpread = 0,
            warpSpread = 0,
        }: {
            voiceGeneration?: number;
            hasActive?: boolean;
            voices?: number;
            detune?: number;
            blend?: number;
            width?: number;
            detuneMode?: number;
            stackMode?: number;
            wavetablePositionSpread?: number;
            warpSpread?: number;
        } = {},
    ) {
        this.emitEndpoint(effectiveUnisonStateEndpointID, {
            voiceGeneration,
            hasActive: hasActive ? 1 : 0,
            voices,
            detune,
            blend,
            width,
            detuneMode,
            stackMode,
            wavetablePositionSpread,
            warpSpread,
        });
    }

    setStoredStateValue(key: string, value: unknown) {
        this.storedState.set(key, value);
        const message = { key, value };
        this.storedStateListeners.forEach((listener) => listener(message));
    }
}

export async function loadHarnessManifest() {
    const response = await fetch("/WavetableSynth.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load desktop patch manifest: ${response.status}`);
    }

    return response.json();
}
