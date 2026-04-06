import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PatchConnectionProvider, type PatchConnectionLike } from "../../ui/shared/cmajor-react";
import { KeyboardDock, ensureKeyboardElement, type PianoKeyboardElement } from "../../ui/desktop/desktop-keyboard-adapter";
import { NexusNumberField, setNexusNumberConstructorForTests, type NexusNumberWidgetLike } from "../../ui/desktop/desktop-nexus-number-field";
import {
    EditableMsegSurface,
    KeyboardSectionShell,
    MsegPreview,
    MsegOverviewSection,
    VoiceGlideControlSurface,
    VoiceModeToolbar,
    WavetableStageSection,
} from "../../ui/shared/synth-components";
import {
    useFactoryBankCatalog,
    useFactoryTableFrames,
    useMsegEditorInteractions,
    useMsegState,
    useObservedDisplayPosition,
    useStagePositionDrag,
    useSynthKeyboardRouting,
} from "../../ui/shared/synth-hooks";
import {
    addMsegPoint,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    deleteMsegPoint,
    moveMsegPoint,
    pointToMsegEditorCoordinates,
    setMsegSegmentCurvePower,
    type MsegState,
} from "../../ui/shared/mseg";
import {
    createDefaultModulationState,
    serializeModulationState,
} from "../../ui/shared/modulation";

type Deferred<TValue> = {
    promise: Promise<TValue>;
    resolve: (value: TValue) => void;
    reject: (error: unknown) => void;
};

declare global {
    interface Window {
        __COSIMO_DESKTOP_MODULE_HARNESS__?: Record<string, unknown>;
    }
}

function createDeferred<TValue>(): Deferred<TValue> {
    let resolvePromise!: (value: TValue) => void;
    let rejectPromise!: (error: unknown) => void;
    const promise = new Promise<TValue>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    return {
        promise,
        resolve: resolvePromise,
        reject: rejectPromise,
    };
}

function waitForMicrotask() {
    return new Promise<void>((resolve) => {
        queueMicrotask(() => resolve());
    });
}

function readSurfaceBounds(selector: string) {
    const surface = document.querySelector(selector);
    if (!(surface instanceof SVGSVGElement)) {
        throw new Error("MSEG surface is missing.");
    }

    return {
        surface,
        bounds: surface.getBoundingClientRect(),
    };
}

function readCurvePointsFromPath(pathElement: SVGPathElement | null, maxPoints = 48) {
    if (!(pathElement instanceof SVGPathElement)) {
        return [];
    }

    const d = pathElement.getAttribute("d") ?? "";
    const matches = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
    const points: Array<{ x: number; y: number }> = [];

    for (let index = 0; index + 1 < matches.length && points.length < maxPoints; index += 2) {
        points.push({
            x: Number(matches[index]),
            y: Number(matches[index + 1]),
        });
    }

    return points;
}

function cloneValue<TValue>(value: TValue): TValue {
    if (value === null || value === undefined) {
        return value;
    }

    return JSON.parse(JSON.stringify(value)) as TValue;
}

function mountHarness(target: HTMLElement, render: (root: Root) => void) {
    target.replaceChildren();
    const root = createRoot(target);
    render(root);

    return {
        root,
        unmount() {
            root.unmount();
            target.replaceChildren();
        },
    };
}

export async function inspectEnsureKeyboardElement() {
    const definedBefore = window.customElements.get("cosimo-react-desktop-keyboard");
    const defineCalls: string[] = [];
    const originalDefine = window.customElements.define.bind(window.customElements);
    const patchConnection: PatchConnectionLike = {
        utilities: {
            PianoKeyboard: class TestKeyboard extends HTMLElement {},
            ParameterControls: {},
        },
    };

    if (!definedBefore) {
        window.customElements.define = ((name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
            defineCalls.push(name);
            return originalDefine(name, constructor, options);
        }) as typeof window.customElements.define;
    }

    try {
        const firstTagName = ensureKeyboardElement(patchConnection);
        const secondTagName = ensureKeyboardElement(patchConnection);

        return {
            firstTagName,
            secondTagName,
            defineCalls: [...defineCalls],
            isDefined: Boolean(window.customElements.get("cosimo-react-desktop-keyboard")),
        };
    } finally {
        window.customElements.define = originalDefine;
    }
}

export async function installKeyboardDockHarness(target: HTMLElement) {
    const constructedKeyboards: TestKeyboard[] = [];
    const keyboardIdentityMap = new WeakMap<object, number>();
    let nextKeyboardIdentity = 1;

    function readKeyboardIdentity(keyboard: object | null) {
        if (!keyboard) {
            return null;
        }

        const existingIdentity = keyboardIdentityMap.get(keyboard);
        if (existingIdentity) {
            return existingIdentity;
        }

        const nextIdentity = nextKeyboardIdentity;
        nextKeyboardIdentity += 1;
        keyboardIdentityMap.set(keyboard, nextIdentity);
        return nextIdentity;
    }

    class TestKeyboard extends HTMLElement {
        notes: unknown[] = [];
        naturalWidth = 22;
        accidentalWidth = 13;
        debug = {
            attachCalls: [] as Array<{ endpointID: string }>,
            detachCount: 0,
            refreshHTMLCount: 0,
            refreshActiveNoteElementsCount: 0,
        };

        constructor() {
            super();
            constructedKeyboards.push(this);
        }

        handleKey() {}
        allNotesOff() {}

        attachToPatchConnection(_patchConnection: PatchConnectionLike, endpointID: string) {
            this.debug.attachCalls.push({ endpointID });
        }

        detachPatchConnection() {
            this.debug.detachCount += 1;
        }

        refreshHTML() {
            this.debug.refreshHTMLCount += 1;
        }

        refreshActiveNoteElements() {
            this.debug.refreshActiveNoteElementsCount += 1;
        }
    }

    const patchConnection: PatchConnectionLike = {
        utilities: {
            PianoKeyboard: TestKeyboard,
            ParameterControls: {},
        },
    };
    const keyboardRef = { current: null as PianoKeyboardElement | null };
    let setRootNoteState: ((nextValue: number) => void) | null = null;
    let setNoteCountState: ((nextValue: number) => void) | null = null;
    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [rootNote, setRootNote] = useState(36);
            const [noteCount, setNoteCount] = useState(25);
            setRootNoteState = setRootNote;
            setNoteCountState = setNoteCount;

            return (
                <PatchConnectionProvider patchConnection={patchConnection}>
                    <KeyboardDock rootNote={rootNote} noteCount={noteCount} keyboardRef={keyboardRef} />
                </PatchConnectionProvider>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setRootNote(nextValue: number) {
            setRootNoteState?.(nextValue);
            await waitForMicrotask();
        },
        async setNoteCount(nextValue: number) {
            setNoteCountState?.(nextValue);
            await waitForMicrotask();
        },
        async setHostWidth(nextValue: number) {
            target.style.width = `${nextValue}px`;
            await waitForMicrotask();
        },
        getSnapshot() {
            const keyboard = keyboardRef.current as (PianoKeyboardElement & { debug?: Record<string, unknown> }) | null;

            return {
                constructedCount: constructedKeyboards.length,
                lifetimeAttachCalls: cloneValue(constructedKeyboards.flatMap((currentKeyboard) => currentKeyboard.debug.attachCalls)),
                lifetimeDetachCount: constructedKeyboards.reduce((sum, currentKeyboard) => sum + currentKeyboard.debug.detachCount, 0),
                lifetimeRefreshHTMLCount: constructedKeyboards.reduce((sum, currentKeyboard) => sum + currentKeyboard.debug.refreshHTMLCount, 0),
                lifetimeRefreshActiveNoteElementsCount: constructedKeyboards.reduce(
                    (sum, currentKeyboard) => sum + currentKeyboard.debug.refreshActiveNoteElementsCount,
                    0,
                ),
                tagName: keyboard?.tagName?.toLowerCase() ?? null,
                keyboardIdentity: readKeyboardIdentity(keyboard),
                rootNoteAttribute: keyboard?.getAttribute("root-note") ?? null,
                noteCountAttribute: keyboard?.getAttribute("note-count") ?? null,
                naturalWidth: keyboard?.naturalWidth ?? null,
                accidentalWidth: keyboard?.accidentalWidth ?? null,
                debug: cloneValue(keyboard?.debug ?? null),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installNexusNumberFieldHarness(target: HTMLElement) {
    const createdWidgets: FakeNexusNumber[] = [];
    const activationLog: string[] = [];
    const setValueCalls: number[] = [];
    let externalValueSetter: ((nextValue: number) => void) | null = null;

    class FakeNexusNumber implements NexusNumberWidgetLike {
        value: number;
        decimalPlaces = 0;
        colors = {
            fill: "",
            dark: "",
            light: "",
            accent: "",
        };
        element: HTMLInputElement;
        options: {
            size: [number, number];
            value: number;
            min: number;
            max: number;
            step: number;
        };
        changeListeners = new Set<(value?: number) => void>();
        passiveUpdates: number[] = [];
        renderCount = 0;
        destroyCount = 0;

        constructor(host: HTMLDivElement, options: {
            size: [number, number];
            value: number;
            min: number;
            max: number;
            step: number;
        }) {
            this.value = options.value;
            this.options = options;
            this.element = document.createElement("input");
            this.element.type = "text";
            host.replaceChildren(this.element);
            createdWidgets.push(this);
        }

        colorInterface() {}

        on(eventName: string, listener: (value?: number) => void) {
            if (eventName === "change") {
                this.changeListeners.add(listener);
            }
        }

        emitChange(nextValue?: number) {
            this.changeListeners.forEach((listener) => listener(nextValue));
        }

        passiveUpdate(value: number) {
            this.value = value;
            this.passiveUpdates.push(value);
        }

        render() {
            this.renderCount += 1;
        }

        destroy() {
            this.destroyCount += 1;
            this.element.remove();
        }
    }

    setNexusNumberConstructorForTests(FakeNexusNumber as unknown as new (
        host: HTMLDivElement,
        options: {
            size: [number, number];
            value: number;
            min: number;
            max: number;
            step: number;
        },
    ) => NexusNumberWidgetLike);

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [bindingValue, setBindingValue] = useState(0.25);
            externalValueSetter = setBindingValue;
            const binding = useMemo(() => ({
                endpointID: "glideTime",
                value: bindingValue,
                setValue(nextValue: number) {
                    setValueCalls.push(nextValue);
                    setBindingValue(nextValue);
                },
                commitValue() {},
                beginGesture() {},
                endGesture() {},
            }), [bindingValue]);

            return (
                <NexusNumberField
                    label="Glide Time"
                    binding={binding}
                    min={0}
                    max={2}
                    step={0.001}
                    decimalPlaces={3}
                    onActivate={() => activationLog.push("activate")}
                    onBeginTextEntry={() => activationLog.push("begin")}
                    onEndTextEntry={() => activationLog.push("end")}
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setBindingValue(nextValue: number) {
            externalValueSetter?.(nextValue);
            await waitForMicrotask();
        },
        async emitChange(nextValue?: number) {
            createdWidgets.at(-1)?.emitChange(nextValue);
            await waitForMicrotask();
        },
        async mouseDownInput() {
            createdWidgets.at(-1)?.element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            await waitForMicrotask();
        },
        async focusInput() {
            createdWidgets.at(-1)?.element.focus();
            await waitForMicrotask();
        },
        async blurInput() {
            createdWidgets.at(-1)?.element.blur();
            await waitForMicrotask();
        },
        getSnapshot() {
            const currentWidget = createdWidgets.at(-1) ?? null;

            return {
                createdCount: createdWidgets.length,
                destroyCount: createdWidgets.reduce((sum, widget) => sum + widget.destroyCount, 0),
                activationLog: [...activationLog],
                setValueCalls: [...setValueCalls],
                options: currentWidget ? cloneValue(currentWidget.options) : null,
                decimalPlaces: currentWidget?.decimalPlaces ?? null,
                colors: currentWidget ? cloneValue(currentWidget.colors) : null,
                passiveUpdates: currentWidget ? [...currentWidget.passiveUpdates] : [],
                renderCount: currentWidget?.renderCount ?? 0,
                ariaLabel: currentWidget?.element.getAttribute("aria-label") ?? null,
                inputStyles: currentWidget ? {
                    width: currentWidget.element.style.width,
                    height: currentWidget.element.style.height,
                    fontFamily: currentWidget.element.style.fontFamily,
                    borderRadius: currentWidget.element.style.borderRadius,
                } : null,
                hostStyles: currentWidget?.element.parentElement ? {
                    width: currentWidget.element.parentElement.style.width,
                    height: currentWidget.element.parentElement.style.height,
                    cursor: currentWidget.element.parentElement.style.cursor,
                } : null,
                activeElementTagName: document.activeElement?.tagName?.toLowerCase() ?? null,
            };
        },
        async unmount() {
            mounted.unmount();
            setNexusNumberConstructorForTests(null);
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installFactoryBankCatalogHookHarness(target: HTMLElement) {
    const requests: Array<{ clientID: string; path: string }> = [];
    const renderLog: Array<{ catalog: unknown; error: string | null }> = [];
    const pendingRequests: Array<{ clientID: string; deferred: Deferred<unknown> }> = [];
    const patchConnection: PatchConnectionLike = {};
    const resourceClients = {
        alpha: {
            readJSON(path: string) {
                requests.push({ clientID: "alpha", path });
                const deferred = createDeferred<unknown>();
                pendingRequests.push({ clientID: "alpha", deferred });
                return deferred.promise;
            },
            readText() {
                throw new Error("Catalog harness should not use readText.");
            },
            readBytes() {
                throw new Error("Catalog harness should not use readBytes.");
            },
            readAudio() {
                throw new Error("Catalog harness should not use readAudio.");
            },
            getURL() {
                return null;
            },
        },
        beta: {
            readJSON(path: string) {
                requests.push({ clientID: "beta", path });
                const deferred = createDeferred<unknown>();
                pendingRequests.push({ clientID: "beta", deferred });
                return deferred.promise;
            },
            readText() {
                throw new Error("Catalog harness should not use readText.");
            },
            readBytes() {
                throw new Error("Catalog harness should not use readBytes.");
            },
            readAudio() {
                throw new Error("Catalog harness should not use readAudio.");
            },
            getURL() {
                return null;
            },
        },
    };
    let setClientIDState: ((nextValue: "alpha" | "beta") => void) | null = null;
    const mounted = mountHarness(target, (root) => {
        function Reader() {
            const state = useFactoryBankCatalog();

            useEffect(() => {
                renderLog.push({
                    catalog: cloneValue(state.catalog),
                    error: state.error,
                });
            }, [state]);

            return null;
        }

        function Harness() {
            const [clientID, setClientID] = useState<"alpha" | "beta">("alpha");
            setClientIDState = setClientID;

            return (
                <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClients[clientID]}>
                    <Reader />
                </PatchConnectionProvider>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async switchClient(nextValue: "alpha" | "beta") {
            setClientIDState?.(nextValue);
            await waitForMicrotask();
        },
        async resolveNext(clientID: "alpha" | "beta", value: unknown) {
            const nextPendingIndex = pendingRequests.findIndex((pendingRequest) => pendingRequest.clientID === clientID);
            if (nextPendingIndex >= 0) {
                pendingRequests.splice(nextPendingIndex, 1)[0]?.deferred.resolve(value);
                await waitForMicrotask();
            }
        },
        async rejectNext(clientID: "alpha" | "beta", message: string) {
            const nextPendingIndex = pendingRequests.findIndex((pendingRequest) => pendingRequest.clientID === clientID);
            if (nextPendingIndex >= 0) {
                pendingRequests.splice(nextPendingIndex, 1)[0]?.deferred.reject(new Error(message));
                await waitForMicrotask();
            }
        },
        getSnapshot() {
            return {
                requests: cloneValue(requests),
                renderLog: cloneValue(renderLog),
                lastRender: cloneValue(renderLog.at(-1) ?? null),
                pendingClientIDs: pendingRequests.map((pendingRequest) => pendingRequest.clientID),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installFactoryTableFramesHookHarness(target: HTMLElement) {
    const requests: Array<{ kind: "json" | "audio"; path: string }> = [];
    const renderLog: Array<{ frameCount: number | null; firstSample: number | null; error: string | null }> = [];
    const pendingAudioRequests: Array<{ path: string; deferred: Deferred<{ sampleRate: number; samples: Float32Array }> }> = [];
    let setTableIndexState: ((nextValue: number) => void) | null = null;

    const catalog = {
        tables: [
            {
                tableId: "table-a",
                name: "Table A",
                frameCount: 1,
                sourceWav: "assets/factory_sources/table-a.wav",
            },
            {
                tableId: "table-b",
                name: "Table B",
                frameCount: 1,
                sourceWav: "assets/factory_sources/table-b.wav",
            },
        ],
    };
    const patchConnection: PatchConnectionLike = {};
    const resourceClient = {
        async readJSON(path: string) {
            requests.push({ kind: "json", path });
            return catalog;
        },
        readText() {
            throw new Error("Frame harness should not use readText.");
        },
        readBytes() {
            throw new Error("Frame harness should not use readBytes.");
        },
        readAudio(path: string) {
            requests.push({ kind: "audio", path });
            const deferred = createDeferred<{ sampleRate: number; samples: Float32Array }>();
            pendingAudioRequests.push({ path, deferred });
            return deferred.promise;
        },
        getURL() {
            return null;
        },
    };
    const mounted = mountHarness(target, (root) => {
        function Reader({ tableIndex }: { tableIndex: number }) {
            const state = useFactoryTableFrames(tableIndex);

            useEffect(() => {
                renderLog.push({
                    frameCount: state.frames?.length ?? null,
                    firstSample: state.frames?.[0]?.[0] ?? null,
                    error: state.error,
                });
            }, [state]);

            return null;
        }

        function Harness() {
            const [tableIndex, setTableIndex] = useState(0);
            setTableIndexState = setTableIndex;

            return (
                <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
                    <Reader tableIndex={tableIndex} />
                </PatchConnectionProvider>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setTableIndex(nextValue: number) {
            setTableIndexState?.(nextValue);
            await waitForMicrotask();
        },
        async resolveAudio(path: string, firstValue: number) {
            const nextPendingIndex = pendingAudioRequests.findIndex((pendingRequest) => pendingRequest.path === path);
            if (nextPendingIndex >= 0) {
                const samples = new Float32Array(2048);
                samples[0] = firstValue;
                pendingAudioRequests.splice(nextPendingIndex, 1)[0]?.deferred.resolve({
                    sampleRate: 44100,
                    samples,
                });
                await waitForMicrotask();
            }
        },
        async rejectAudio(path: string, message: string) {
            const nextPendingIndex = pendingAudioRequests.findIndex((pendingRequest) => pendingRequest.path === path);
            if (nextPendingIndex >= 0) {
                pendingAudioRequests.splice(nextPendingIndex, 1)[0]?.deferred.reject(new Error(message));
                await waitForMicrotask();
            }
        },
        getSnapshot() {
            return {
                requests: cloneValue(requests),
                renderLog: cloneValue(renderLog),
                lastRender: cloneValue(renderLog.at(-1) ?? null),
                pendingPaths: pendingAudioRequests.map((pendingRequest) => pendingRequest.path),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installObservedDisplayPositionHookHarness(target: HTMLElement) {
    const endpointListeners = new Set<(value: unknown) => void>();
    const renderLog: number[] = [];
    let setParameterPositionState: ((nextValue: number) => void) | null = null;

    const patchConnection: PatchConnectionLike = {
        addEndpointListener(endpointID, listener) {
            if (endpointID === "effectiveWavetablePosition") {
                endpointListeners.add(listener);
            }
        },
        removeEndpointListener(endpointID, listener) {
            if (endpointID === "effectiveWavetablePosition") {
                endpointListeners.delete(listener);
            }
        },
    };
    const mounted = mountHarness(target, (root) => {
        function Reader({ parameterPosition }: { parameterPosition: number }) {
            const position = useObservedDisplayPosition(parameterPosition);

            useEffect(() => {
                renderLog.push(position);
            }, [position]);

            return null;
        }

        function Harness() {
            const [parameterPosition, setParameterPosition] = useState(0.18);
            setParameterPositionState = setParameterPosition;

            return (
                <PatchConnectionProvider patchConnection={patchConnection}>
                    <Reader parameterPosition={parameterPosition} />
                </PatchConnectionProvider>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setParameterPosition(nextValue: number) {
            setParameterPositionState?.(nextValue);
            await waitForMicrotask();
        },
        async emitObservedPosition(message: unknown) {
            endpointListeners.forEach((listener) => listener(message));
            await waitForMicrotask();
        },
        getSnapshot() {
            return {
                renderLog: [...renderLog],
                lastPosition: renderLog.at(-1) ?? null,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installMsegStateHookHarness(target: HTMLElement) {
    const storedStateListeners = new Set<(message: unknown) => void>();
    const sentEvents: Array<{ endpointID: string; value: unknown }> = [];
    const renderLog: Array<MsegState | null> = [];
    let requestFullStoredStateCount = 0;
    let addStoredStateValueListenerCount = 0;
    let removeStoredStateValueListenerCount = 0;

    const bootModulationState = createDefaultModulationState();
    bootModulationState.msegSlots[0] = {
        shape: createDefaultMsegShape("Test MSEG"),
        playback: createDefaultMsegPlayback(),
    };
    bootModulationState.routes = [{
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: 0.42,
    }];
    const bootState = {
        "modulation.v1": serializeModulationState(bootModulationState),
    };
    const patchConnection: PatchConnectionLike = {
        addStoredStateValueListener(listener) {
            addStoredStateValueListenerCount += 1;
            storedStateListeners.add(listener);
        },
        removeStoredStateValueListener(listener) {
            removeStoredStateValueListenerCount += 1;
            storedStateListeners.delete(listener);
        },
        requestFullStoredState(callback) {
            requestFullStoredStateCount += 1;
            queueMicrotask(() => callback(bootState));
        },
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
        sendStoredStateValue() {},
    };
    const mounted = mountHarness(target, (root) => {
        function Reader() {
            const { state } = useMsegState();

            useEffect(() => {
                renderLog.push(cloneValue(state));
            }, [state]);

            return null;
        }

        root.render(
            <PatchConnectionProvider patchConnection={patchConnection}>
                <Reader />
            </PatchConnectionProvider>,
        );
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            return {
                requestFullStoredStateCount,
                addStoredStateValueListenerCount,
                removeStoredStateValueListenerCount,
                storedStateListenerCount: storedStateListeners.size,
                bootState: cloneValue(bootState),
                sentEvents: cloneValue(sentEvents),
                renderLog: cloneValue(renderLog),
                lastRender: cloneValue(renderLog.at(-1) ?? null),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installStagePositionDragHookHarness(target: HTMLElement) {
    const gestureLog: string[] = [];
    const setValues: number[] = [];

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const stageRef = useRef<HTMLDivElement | null>(null);
            const binding = useMemo(() => ({
                endpointID: "wavetablePosition",
                value: 0.4,
                setValue(nextValue: number) {
                    setValues.push(nextValue);
                },
                commitValue() {},
                beginGesture() {
                    gestureLog.push("begin");
                },
                endGesture() {
                    gestureLog.push("end");
                },
            }), []);
            const {
                handleStagePointerDown,
                handleStagePointerMove,
                handleStagePointerUp,
            } = useStagePositionDrag({
                stageRef,
                observedPosition: 0.4,
                binding,
            });

            useEffect(() => {
                if (!stageRef.current) {
                    return;
                }

                stageRef.current.setPointerCapture = (() => {}) as typeof stageRef.current.setPointerCapture;
                stageRef.current.releasePointerCapture = (() => {}) as typeof stageRef.current.releasePointerCapture;
            }, []);

            return (
                <div
                    id="stage"
                    ref={stageRef}
                    style={{ width: "320px", height: "200px", touchAction: "none" }}
                    onPointerDown={handleStagePointerDown}
                    onPointerMove={handleStagePointerMove}
                    onPointerUp={handleStagePointerUp}
                >
                    <button id="stage-button" type="button">Button</button>
                    <select id="stage-select"><option>1</option></select>
                    <input id="stage-input" />
                </div>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async dispatchPointer(selector: string, type: string, init: PointerEventInit) {
            const element = document.querySelector(selector);
            if (!(element instanceof Element)) {
                throw new Error(`Could not find pointer target ${selector}.`);
            }

            element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                ...init,
            }));
            await waitForMicrotask();
        },
        getSnapshot() {
            return {
                gestureLog: [...gestureLog],
                setValues: [...setValues],
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installMsegEditorInteractionsHookHarness(target: HTMLElement) {
    const actionLog: Array<{ type: string; pointIndex?: number; segmentIndex?: number; x?: number; y?: number; curvePower?: number }> = [];
    const hapticLog: string[] = [];
    let setMsegStateState: ((updater: (previousState: MsegState) => MsegState) => void) | null = null;
    let setOrientationState: ((nextValue: "horizontal" | "vertical") => void) | null = null;
    let setCurveEditModeState: ((nextValue: "immediate" | "hold-or-drag") => void) | null = null;
    let setCurveEditHoldDelayMsState: ((nextValue: number) => void) | null = null;
    let currentOrientation: "horizontal" | "vertical" = "horizontal";
    let currentCurveEditMode: "immediate" | "hold-or-drag" = "immediate";
    let currentMsegState: MsegState = {
        shape: addMsegPoint(createDefaultMsegShape("Harness"), 0.5, 0.35),
        playback: createDefaultMsegPlayback(),
        depth: 0.4,
    };

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [msegState, setMsegState] = useState<MsegState>(currentMsegState);
            const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
            const [curveEditMode, setCurveEditMode] = useState<"immediate" | "hold-or-drag">("immediate");
            const [curveEditHoldDelayMs, setCurveEditHoldDelayMs] = useState(350);
            setMsegStateState = (updater) => setMsegState((previousState) => updater(previousState));
            setOrientationState = setOrientation;
            setCurveEditModeState = setCurveEditMode;
            setCurveEditHoldDelayMsState = setCurveEditHoldDelayMs;
            const currentStateRef = useRef(msegState);
            currentStateRef.current = msegState;
            currentMsegState = msegState;
            currentOrientation = orientation;
            currentCurveEditMode = curveEditMode;
            const surfaceRef = useRef<SVGSVGElement | null>(null);
            const controllerRef = useRef({
                addPoint(x: number, y: number) {
                    actionLog.push({ type: "add", x, y });
                    setMsegState((previousState) => ({
                        ...previousState,
                        shape: addMsegPoint(previousState.shape, x, y),
                    }));
                },
                movePoint(pointIndex: number, x: number, y: number) {
                    actionLog.push({ type: "move", pointIndex, x, y });
                    setMsegState((previousState) => ({
                        ...previousState,
                        shape: moveMsegPoint(previousState.shape, pointIndex, x, y),
                    }));
                },
                deletePoint(pointIndex: number) {
                    actionLog.push({ type: "delete", pointIndex });
                    setMsegState((previousState) => ({
                        ...previousState,
                        shape: deleteMsegPoint(previousState.shape, pointIndex),
                    }));
                },
                setSegmentCurvePower(segmentIndex: number, curvePower: number) {
                    actionLog.push({ type: "curve", segmentIndex, curvePower });
                    setMsegState((previousState) => ({
                        ...previousState,
                        shape: setMsegSegmentCurvePower(previousState.shape, segmentIndex, curvePower),
                    }));
                },
                getState() {
                    return currentStateRef.current;
                },
            });
            const {
                isOpen,
                selectedPointIndex,
                hoveredSegmentIndex,
                activeSegmentIndex,
                openEditor,
                closeEditor,
                handlePointerDown,
                handlePointerMove,
                handlePointerLeave,
                handlePointerUp,
            } = useMsegEditorInteractions({
                msegState,
                msegController: controllerRef,
                surfaceRef,
                orientation,
                curveEditActivationMode: curveEditMode,
                curveEditHoldDelayMs,
                onCurveEditHoldActivated: () => {
                    hapticLog.push("light");
                },
            });

            useEffect(() => {
                if (!surfaceRef.current) {
                    return;
                }

                surfaceRef.current.setPointerCapture = (() => {}) as typeof surfaceRef.current.setPointerCapture;
                surfaceRef.current.releasePointerCapture = (() => {}) as typeof surfaceRef.current.releasePointerCapture;
            }, []);

            return (
                <div>
                    <button id="open-editor" type="button" onClick={openEditor}>Open</button>
                    <button id="close-editor" type="button" onClick={closeEditor}>Close</button>
                    <div
                        id="editor-state"
                        data-open={isOpen ? "true" : "false"}
                        data-selected={selectedPointIndex}
                        data-hovered-segment={hoveredSegmentIndex}
                        data-active-segment={activeSegmentIndex}
                    />
                    <EditableMsegSurface
                        surfaceRef={surfaceRef}
                        points={msegState.shape.points}
                        selectedPointIndex={selectedPointIndex}
                        hoveredSegmentIndex={hoveredSegmentIndex}
                        activeSegmentIndex={activeSegmentIndex}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerLeave={handlePointerLeave}
                        onPointerUp={handlePointerUp}
                        className="h-[180px]"
                        dataRole="mseg-surface"
                    />
                    <div id="point-count">{msegState.shape.points.length}</div>
                </div>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async openEditor() {
            (document.getElementById("open-editor") as HTMLButtonElement | null)?.click();
            await waitForMicrotask();
        },
        async dispatchPointer(type: string, init: PointerEventInit) {
            const { surface } = readSurfaceBounds('[data-role="mseg-surface"]');

            surface.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                ...init,
            }));
            await waitForMicrotask();
        },
        async pressEscape() {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            await waitForMicrotask();
        },
        async setShapePoint(pointIndex: number, x: number, y: number) {
            setMsegStateState?.((previousState) => ({
                ...previousState,
                shape: moveMsegPoint(previousState.shape, pointIndex, x, y),
            }));
            await waitForMicrotask();
        },
        async setOrientation(nextValue: "horizontal" | "vertical") {
            setOrientationState?.(nextValue);
            await waitForMicrotask();
        },
        async setCurveEditMode(nextValue: "immediate" | "hold-or-drag") {
            setCurveEditModeState?.(nextValue);
            await waitForMicrotask();
        },
        async setCurveEditHoldDelayMs(nextValue: number) {
            setCurveEditHoldDelayMsState?.(nextValue);
            await waitForMicrotask();
        },
        getPointCoordinates(pointIndex: number) {
            const point = currentMsegState.shape.points[pointIndex];
            const { bounds } = readSurfaceBounds('[data-role="mseg-surface"]');
            const localCoordinates = pointToMsegEditorCoordinates(point, bounds.width, bounds.height, {
                orientation: currentOrientation,
            });

            return {
                x: bounds.left + localCoordinates.x,
                y: bounds.top + localCoordinates.y,
            };
        },
        getNormalizedCoordinates(x: number, y: number) {
            const { bounds } = readSurfaceBounds('[data-role="mseg-surface"]');
            const localCoordinates = pointToMsegEditorCoordinates({ x, y }, bounds.width, bounds.height, {
                orientation: currentOrientation,
            });

            return {
                x: bounds.left + localCoordinates.x,
                y: bounds.top + localCoordinates.y,
            };
        },
        getSnapshot() {
            const editorState = document.getElementById("editor-state");
            const selectedPointIndex = Number(editorState?.getAttribute("data-selected") ?? 0);
            const hoveredSegmentIndex = Number(editorState?.getAttribute("data-hovered-segment") ?? -1);
            const activeSegmentIndex = Number(editorState?.getAttribute("data-active-segment") ?? -1);
            const isOpen = editorState?.getAttribute("data-open") === "true";
            const pointCountText = document.getElementById("point-count")?.textContent ?? "0";
            const highlightedSegment = document.querySelector('[data-role="mseg-highlight-segment"]');
            const pointStates = Array.from(document.querySelectorAll('[data-role="mseg-point"]')).map((element) =>
                element.getAttribute("data-point-state")
            );

            return {
                isOpen,
                selectedPointIndex,
                hoveredSegmentIndex,
                activeSegmentIndex,
                highlightedSegmentIndex: Number(highlightedSegment?.getAttribute("data-segment-index") ?? -1),
                pointStates,
                pointCount: Number(pointCountText) || 0,
                actionLog: cloneValue(actionLog),
                hapticLog: cloneValue(hapticLog),
                points: cloneValue(currentMsegState.shape.points),
                orientation: currentOrientation,
                curveEditMode: currentCurveEditMode,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSynthKeyboardRoutingHookHarness(target: HTMLElement) {
    const stepLog = {
        wavetable: [] as number[],
        playMode: [] as number[],
        msegRate: [] as number[],
        glide: [] as number[],
    };
    const keyboardLog = {
        handledKeys: [] as Array<{ key: string; isDown: boolean }>,
        allNotesOffCount: 0,
    };

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const keyboardRef = useRef({
                handleKey(event: KeyboardEvent, isDown: boolean) {
                    keyboardLog.handledKeys.push({ key: event.key, isDown });
                },
                allNotesOff() {
                    keyboardLog.allNotesOffCount += 1;
                },
            });
            const {
                wavetableFocusBindings,
                playModeFocusBindings,
                msegRateFocusBindings,
                glideFocusTarget,
            } = useSynthKeyboardRouting({
                keyboardRef,
                onStepWavetable: (direction) => stepLog.wavetable.push(direction),
                onStepPlayMode: (direction) => stepLog.playMode.push(direction),
                onStepMsegRate: (direction) => stepLog.msegRate.push(direction),
                onStepGlideTime: (direction) => stepLog.glide.push(direction),
            });

            return (
                <div>
                    <button id="wavetable-target" type="button" {...wavetableFocusBindings}>Wavetable</button>
                    <button id="play-mode-target" type="button" {...playModeFocusBindings}>Play Mode</button>
                    <button id="mseg-rate-target" type="button" {...msegRateFocusBindings}>MSEG Rate</button>
                    <input
                        id="glide-target"
                        onMouseDown={glideFocusTarget.onActivate}
                        onFocus={glideFocusTarget.onBeginTextEntry}
                        onBlur={glideFocusTarget.onEndTextEntry}
                    />
                </div>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async focus(selector: string) {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement)) {
                throw new Error(`Could not find focus target ${selector}.`);
            }

            element.focus();
            await waitForMicrotask();
        },
        async mouseDown(selector: string) {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement)) {
                throw new Error(`Could not find mouse target ${selector}.`);
            }

            element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            await waitForMicrotask();
        },
        async blur(selector: string) {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement)) {
                throw new Error(`Could not find blur target ${selector}.`);
            }

            element.blur();
            await waitForMicrotask();
        },
        async pressKey(key: string, isDown = true) {
            window.dispatchEvent(new KeyboardEvent(isDown ? "keydown" : "keyup", {
                bubbles: true,
                key,
            }));
            await waitForMicrotask();
        },
        getSnapshot() {
            return {
                stepLog: cloneValue(stepLog),
                keyboardLog: cloneValue(keyboardLog),
                activeElementID: (document.activeElement as HTMLElement | null)?.id ?? null,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedWavetableStageHarness(target: HTMLElement) {
    const changeLog: number[] = [];
    let retryCount = 0;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const stageRef = useRef<HTMLDivElement | null>(null);

            return (
                <WavetableStageSection
                    stageRef={stageRef}
                    frames={[Float32Array.from([0, 0.5, -0.5, 0])]}
                    position={0.5}
                    warpMode={1}
                    warpAmount={0.72}
                    tableName="BS2 - Acid"
                    frameCount={128}
                    desiredTableIndex={0}
                    tableOptions={[
                        {
                            tableId: "acid",
                            name: "BS2 - Acid",
                            frameCount: 128,
                            sourceWav: "assets/factory_sources/imported/BS2 - Acid.wav",
                        },
                        {
                            tableId: "saw",
                            name: "Saw Sweep",
                            frameCount: 64,
                            sourceWav: "assets/factory_sources/saw-sweep.wav",
                        },
                    ]}
                    canRetry={true}
                    onTableChange={(nextValue) => {
                        changeLog.push(nextValue);
                    }}
                    onRetry={() => {
                        retryCount += 1;
                    }}
                    tableFocusBindings={{}}
                    onPointerDown={() => {}}
                    onPointerMove={() => {}}
                    onPointerUp={() => {}}
                    className="min-h-[220px]"
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            return {
                changeLog: cloneValue(changeLog),
                retryCount,
                className: document.querySelector(".cosimo-stage")?.className ?? null,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedMsegOverviewHarness(target: HTMLElement) {
    const openLog: string[] = [];
    const depthLog: number[] = [];
    const rateLog: number[] = [];
    const loopLog: boolean[] = [];
    let setMsegStateState: ((nextValue: MsegState | ((previousState: MsegState) => MsegState)) => void) | null = null;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [msegState, setMsegState] = useState<MsegState>({
                shape: createDefaultMsegShape(),
                playback: createDefaultMsegPlayback(),
                depth: 0.25,
            });
            setMsegStateState = setMsegState;

            return (
                <MsegOverviewSection
                    msegState={msegState}
                    onOpenEditor={() => {
                        openLog.push("open");
                    }}
                    onDepthChange={(nextValue) => {
                        depthLog.push(nextValue);
                        setMsegState((previousState) => ({
                            ...previousState,
                            depth: nextValue,
                        }));
                    }}
                    onRateChange={(nextValue) => {
                        rateLog.push(nextValue);
                        setMsegState((previousState) => ({
                            ...previousState,
                            playback: {
                                ...previousState.playback,
                                rate: {
                                    kind: "seconds",
                                    seconds: nextValue,
                                },
                            },
                        }));
                    }}
                    onToggleLoop={() => {
                        setMsegState((previousState) => {
                            const nextLoop = previousState.playback.loop ? null : { startX: 0, endX: 1 };
                            loopLog.push(Boolean(nextLoop));

                            return {
                                ...previousState,
                                playback: {
                                    ...previousState.playback,
                                    loop: nextLoop,
                                },
                            };
                        });
                    }}
                    depthFocusBindings={{}}
                    rateFocusBindings={{}}
                    className="min-h-[220px]"
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            const rateSlider = document.querySelector('input[aria-label="Rate"]') as HTMLInputElement | null;
            const depthSlider = document.querySelector('input[aria-label="Depth"]') as HTMLInputElement | null;
            const loopButton = Array.from(document.querySelectorAll("button")).find((button) =>
                button.textContent === "Looping" || button.textContent === "One Shot"
            );

            return {
                openLog: cloneValue(openLog),
                depthLog: cloneValue(depthLog),
                rateLog: cloneValue(rateLog),
                loopLog: cloneValue(loopLog),
                sliderValues: {
                    depth: depthSlider?.value ?? null,
                    rate: rateSlider?.value ?? null,
                },
                loopLabel: loopButton?.textContent ?? null,
                className: document.querySelector("section")?.className ?? null,
            };
        },
        async setDepth(nextValue: number) {
            setMsegStateState?.((previousState) => ({
                ...previousState,
                depth: nextValue,
            }));
            await waitForMicrotask();
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedEditableMsegSurfaceHarness(target: HTMLElement) {
    const pointerLog: string[] = [];
    const selectedPointIndex = 1;
    const points = [
        { x: 0, y: 0, curvePower: 0 },
        { x: 0.5, y: 1, curvePower: 0 },
        { x: 1, y: 0, curvePower: 0 },
    ];

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const surfaceRef = useRef<SVGSVGElement | null>(null);

            return (
                <EditableMsegSurface
                    surfaceRef={surfaceRef}
                    points={points}
                    selectedPointIndex={selectedPointIndex}
                    onPointerDown={() => pointerLog.push("down")}
                    onPointerMove={() => pointerLog.push("move")}
                    onPointerUp={() => pointerLog.push("up")}
                    className="h-[180px]"
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            const circles = Array.from(document.querySelectorAll("circle"));

            return {
                pointerLog: cloneValue(pointerLog),
                circleCount: circles.length,
                radii: circles.map((circle) => circle.getAttribute("r")),
                surfaceClassName: document.querySelector("svg")?.className.baseVal ?? null,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedMsegOrientationHarness(target: HTMLElement) {
    const points = [
        { x: 0, y: 0, curvePower: 0 },
        { x: 0.18, y: 0.82, curvePower: 0 },
        { x: 0.72, y: 0.35, curvePower: 0 },
        { x: 1, y: 1, curvePower: 0 },
    ];
    let setOrientationState: ((nextValue: "horizontal" | "vertical") => void) | null = null;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
            const surfaceRef = useRef<SVGSVGElement | null>(null);
            setOrientationState = setOrientation;

            return (
                <div className="grid gap-4">
                    <div data-testid="preview" style={{ width: "320px", height: "128px" }}>
                        <MsegPreview
                            points={points}
                            orientation={orientation}
                            className="h-full w-full overflow-hidden rounded-[20px] bg-white/[0.03]"
                        />
                    </div>
                    <EditableMsegSurface
                        surfaceRef={surfaceRef}
                        orientation={orientation}
                        points={points}
                        selectedPointIndex={1}
                        onPointerDown={() => {}}
                        onPointerMove={() => {}}
                        onPointerUp={() => {}}
                        className="h-[180px]"
                        dataRole="shared-mseg-orientation-surface"
                    />
                </div>
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setOrientation(nextValue: "horizontal" | "vertical") {
            setOrientationState?.(nextValue);
            await waitForMicrotask();
        },
        getSnapshot() {
            const previewPath = document.querySelector('[data-testid="preview"] .cosimo-curve-line') as SVGPathElement | null;
            const circles = Array.from(
                document.querySelectorAll('[data-role="shared-mseg-orientation-surface"] circle'),
            );

            return {
                previewCurvePoints: readCurvePointsFromPath(previewPath),
                editorCircleCenters: circles.map((circle) => ({
                    cx: Number(circle.getAttribute("cx")),
                    cy: Number(circle.getAttribute("cy")),
                })),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedVoiceModeToolbarHarness(target: HTMLElement) {
    const changeLog: number[] = [];

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [value, setValue] = useState(0);
            const options = [
                { value: 0, label: "Poly" },
                { value: 1, label: "Mono" },
                { value: 2, label: "Legato" },
                { value: 3, label: "Hold" },
            ];

            return (
                <VoiceModeToolbar
                    value={value}
                    onChange={(nextValue) => {
                        changeLog.push(nextValue);
                        setValue(nextValue);
                    }}
                    focusBindings={{}}
                    options={options}
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            const optionSurface = document.querySelector('button[aria-pressed]')?.parentElement;

            const states = Array.from(document.querySelectorAll("button")).map((button) => ({
                label: button.textContent?.trim() ?? "",
                pressed: button.getAttribute("aria-pressed"),
            }));

            return {
                changeLog: cloneValue(changeLog),
                states,
                optionGridTemplateColumns: optionSurface instanceof HTMLElement
                    ? optionSurface.style.gridTemplateColumns
                    : null,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedVoiceGlideControlSurfaceHarness(target: HTMLElement) {
    const changeLog: number[] = [];

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [value, setValue] = useState(0);

            return (
                <VoiceGlideControlSurface
                    playModeValue={value}
                    onPlayModeChange={(nextValue) => {
                        changeLog.push(nextValue);
                        setValue(nextValue);
                    }}
                    playModeFocusBindings={{}}
                    glideControl={<div data-testid="glide-slot">Glide Adapter Slot</div>}
                    className="grid-cols-1 items-stretch"
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            return {
                changeLog: cloneValue(changeLog),
                glideSlotText: document.querySelector('[data-testid="glide-slot"]')?.textContent ?? null,
                className: document.querySelector('[data-testid="glide-slot"]')?.parentElement?.className ?? null,
                states: Array.from(document.querySelectorAll('button[aria-pressed]')).map((button) => ({
                    label: button.textContent?.trim() ?? "",
                    pressed: button.getAttribute("aria-pressed"),
                })),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installSharedKeyboardSectionShellHarness(target: HTMLElement) {
    const actionLog: string[] = [];
    let setCanShiftDownState: ((nextValue: boolean) => void) | null = null;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [canShiftDown, setCanShiftDown] = useState(false);
            setCanShiftDownState = setCanShiftDown;

            return (
                <KeyboardSectionShell
                    keyboardRootLabel="C2"
                    canOctaveUp={true}
                    canOctaveDown={canShiftDown}
                    onOctaveUp={() => {
                        actionLog.push("up");
                    }}
                    onOctaveDown={() => {
                        actionLog.push("down");
                    }}
                    className="grid-cols-1"
                    railClassName="self-start min-h-0"
                    contentClassName="gap-1"
                    toolbar={<div data-testid="toolbar-slot">Toolbar Slot</div>}
                    keyboard={<div data-testid="keyboard-slot">Keyboard Slot</div>}
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async setCanShiftDown(nextValue: boolean) {
            setCanShiftDownState?.(nextValue);
            await waitForMicrotask();
        },
        getSnapshot() {
            const upButton = document.querySelector('button[aria-label="Shift keyboard up one octave"]');
            const downButton = document.querySelector('button[aria-label="Shift keyboard down one octave"]');

            return {
                actionLog: cloneValue(actionLog),
                keyboardRootLabel: document.querySelector(".font-mono.text-\\[10px\\]")?.textContent?.trim() ?? null,
                toolbarText: document.querySelector('[data-testid="toolbar-slot"]')?.textContent ?? null,
                keyboardText: document.querySelector('[data-testid="keyboard-slot"]')?.textContent ?? null,
                className: document.querySelector("section")?.className ?? null,
                railClassName: document.querySelector("section > div")?.className ?? null,
                contentClassName: document.querySelector("section > div + div")?.className ?? null,
                buttonState: {
                    upDisabled: upButton instanceof HTMLButtonElement ? upButton.disabled : null,
                    downDisabled: downButton instanceof HTMLButtonElement ? downButton.disabled : null,
                },
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}
