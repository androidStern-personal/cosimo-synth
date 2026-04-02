import type { PatchConnectionLike } from "./cmajor-react";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";

type ParameterListener = (value: unknown) => void;
type EndpointListener = (value: unknown) => void;
type StatusListener = (status: unknown) => void;
type StoredStateListener = (message: unknown) => void;

class MockPianoKeyboard extends HTMLElement {
    naturalWidth = 22;
    accidentalWidth = 13;

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

    attachToPatchConnection() {}

    detachPatchConnection() {}

    refreshHTML() {}

    bindRenderedTouchHandlers() {}

    refreshActiveNoteElements() {}
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

    private parameterValues = new Map<string, unknown>([
        [wavetablePositionEndpointID, 0.28],
        [wavetableSelectEndpointID, 0],
        [playModeEndpointID, 0],
        [glideTimeEndpointID, 0.15],
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
        if (endpointID === runtimeSyncRequestEndpointID) {
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
            return;
        }

        if (endpointID === retryDesiredTableRequestEndpointID) {
            this.runtimeState = {
                ...this.runtimeState,
                hasFailure: false,
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
            this.runtimeState = {
                ...this.runtimeState,
                desiredTableIndex: tableIndex,
                activeTableIndex: tableIndex,
                desiredIntentSerial: this.runtimeState.desiredIntentSerial + 1,
            };
            this.emitEndpoint(runtimeStateEndpointID, this.runtimeState);
        }
    }

    sendParameterGestureStart() {}

    sendParameterGestureEnd() {}

    addEndpointListener(endpointID: string, listener: EndpointListener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID: string, listener: EndpointListener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    private emitEndpoint(endpointID: string, value: unknown) {
        this.endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    sendMIDIInputEvent(endpointID: string, value: number) {
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
}

export async function loadHarnessManifest() {
    const response = await fetch("/WavetableSynth.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load desktop patch manifest: ${response.status}`);
    }

    return response.json();
}
