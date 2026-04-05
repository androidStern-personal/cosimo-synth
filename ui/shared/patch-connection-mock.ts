import type { PatchConnectionLike } from "./cmajor-react";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const warpModeEndpointID = "warpMode";
const warpAmountEndpointID = "warpAmount";
const warpMsegDepthEndpointID = "warpMsegDepth";
const filterModeEndpointID = "filterMode";
const filterCutoffEndpointID = "filterCutoff";
const filterQEndpointID = "filterQ";
const filterMsegDepthEndpointID = "filterMsegDepth";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const effectiveWarpStateEndpointID = "effectiveWarpState";
const effectiveFilterStateEndpointID = "effectiveFilterState";
const filterSpectrumEndpointID = "filterSpectrum";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";

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
        const shortMIDICode = midiStatus | (noteNumber << 8) | (velocity << 16);

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
                    endpointID: warpMsegDepthEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Warp MSEG Depth",
                        min: -1,
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
                    endpointID: filterMsegDepthEndpointID,
                    purpose: "parameter",
                    annotation: {
                        name: "Filter MSEG Depth",
                        min: -6,
                        max: 6,
                        init: 0,
                    },
                },
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

    private parameterValues = new Map<string, unknown>([
        [wavetablePositionEndpointID, 0.28],
        [wavetableSelectEndpointID, 0],
        [playModeEndpointID, 0],
        [glideTimeEndpointID, 0.15],
        [warpModeEndpointID, 0],
        [warpAmountEndpointID, 0],
        [warpMsegDepthEndpointID, 0],
        [filterModeEndpointID, 0],
        [filterCutoffEndpointID, 1000],
        [filterQEndpointID, 0.707107],
        [filterMsegDepthEndpointID, 0],
    ]);
    private parameterListeners = new Map<string, Set<ParameterListener>>();
    private endpointListeners = new Map<string, Set<EndpointListener>>();
    private statusListeners = new Set<StatusListener>();
    private storedStateListeners = new Set<StoredStateListener>();
    private storedState = new Map<string, unknown>();
    private runtimeState = createDefaultRuntimeState();
    private status: unknown;

    constructor(manifest: unknown) {
        this.manifest = manifest;
        this.status = buildHarnessStatus(manifest);
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

        if (endpointID === runtimeSyncRequestEndpointID) {
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
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
        const snapshot = Object.fromEntries(this.storedState.entries());
        queueMicrotask(() => callback(snapshot));
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
        return {
            parameterValues: Object.fromEntries(this.parameterValues.entries()),
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
        };
    }

    recordKeyboardAttach(endpointID: string) {
        this.keyboardAttachCalls.push({ endpointID });
    }

    recordKeyboardDetach() {
        this.keyboardDetachCount += 1;
    }

    setRuntimeState(nextState: Partial<ReturnType<typeof createDefaultRuntimeState>>) {
        this.runtimeState = {
            ...this.runtimeState,
            ...nextState,
        };
        this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
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
