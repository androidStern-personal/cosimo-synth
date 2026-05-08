import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import editorTokensCssText from "../../ui/shared/editor-tokens.css?inline";
import editorCurveSurfaceCssText from "../../ui/shared/editor-curve-surface.css?inline";
import filterRangeEditorCssText from "../../ui/shared/filter-range-editor.css?inline";
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
    FilterRangeEditor,
    type FilterRangeEndpoints,
    type FilterRangeMode,
    type FilterRangePolarity,
    type FilterRangeValue,
    cutoffRangeOctaves,
    cutoffsFromBaseModulationOctaves,
    cutoffsFromCenterRangeOctaves,
    geometricCenterCutoffHz,
    modulationOctavesFromCutoffRange,
} from "../../ui/shared/filter-range-editor";
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
import { useStandaloneEffectPresets } from "../../ui/shared/effects/use-standalone-effect-presets";
import {
    buildCanonicalPluginStateContract,
    buildPluginStateContract,
} from "../../ui/shared/effects/effect-state-contract";
import {
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    type EffectPresetMigration,
    type EffectPresetV2,
    type EffectStoredStateAdapter,
} from "../../ui/shared/effects/effect-preset-v2";
import type {
    EffectPreset,
    EffectPresetDescriptorRegistry,
    EffectPresetValue,
} from "../../ui/shared/effects/effect-preset-schema";

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

function installFilterRangeEditorTestStyles() {
    installInlineTestStyle("filter-range-editor-token-styles", editorTokensCssText);
    installInlineTestStyle("filter-range-editor-curve-styles", editorCurveSurfaceCssText);
    installInlineTestStyle("filter-range-editor-component-styles", filterRangeEditorCssText);

    if (document.getElementById("filter-range-editor-test-styles")) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = "filter-range-editor-test-styles";
    styleElement.textContent = `
        .filter-range-editor-test {
            width: 640px;
            height: 320px;
        }
        .filter-range-editor-test .filter-range-editor__viewport,
        .filter-range-editor-test .filter-range-editor__surface {
            display: block;
            width: 100%;
            height: 100%;
            touch-action: none;
        }
        .filter-range-editor-test .filter-range-editor__range-hit-target,
        .filter-range-editor-test .filter-range-editor__value-hit-target {
            fill: transparent;
        }
    `;
    document.head.appendChild(styleElement);
}

function installInlineTestStyle(id: string, cssText: string) {
    if (document.getElementById(id)) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = id;
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);
}

function cloneValue<TValue>(value: TValue): TValue {
    if (value === null || value === undefined) {
        return value;
    }

    return JSON.parse(JSON.stringify(value)) as TValue;
}

function createStandalonePresetDescriptorRegistry(): EffectPresetDescriptorRegistry {
    return {
        ott: {
            effectID: "ott",
            label: "OTT",
            params: {
                ottMix: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottAmount: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottTimePercent: { type: "number", min: 10, max: 1000, defaultValue: 100, clamp: true },
                ottBandDrive: { type: "number", min: 0, max: 100, defaultValue: 0 },
                ottEnvelopeMatch: { type: "number", min: 0, max: 100, defaultValue: 0 },
                envelopeBoostClampDb: { type: "number", min: 0, max: 24, defaultValue: 6 },
            },
        },
    };
}

function createStandaloneFactoryPresets(): Record<string, EffectPreset[]> {
    return {
        ott: [{
            kind: "cosimo.effectPreset",
            version: 1,
            effectID: "ott",
            presetID: "ott.default-smash",
            label: "Default Smash",
            values: {
                ottMix: 100,
                ottAmount: 100,
                ottTimePercent: 100,
                ottBandDrive: 0,
                ottEnvelopeMatch: 0,
                envelopeBoostClampDb: 6,
            },
        }, {
            kind: "cosimo.effectPreset",
            version: 1,
            effectID: "ott",
            presetID: "ott.envelope-tamed",
            label: "Envelope Tamed",
            values: {
                ottMix: 86,
                ottAmount: 92,
                ottTimePercent: 100,
                ottBandDrive: 12,
                ottEnvelopeMatch: 38,
                envelopeBoostClampDb: 6,
            },
        }],
    };
}

class StandalonePresetHookPatchConnection implements PatchConnectionLike {
    storedState: Record<string, unknown> = {};
    parameterValues: Record<string, EffectPresetValue> = {
        ottMix: 11,
        ottAmount: 22,
        ottTimePercent: 100,
        ottBandDrive: 0,
        ottEnvelopeMatch: 0,
        envelopeBoostClampDb: 6,
    };
    events: Array<{ endpointID: string; value: unknown }> = [];
    storedWrites: Array<{ key: string; value: unknown }> = [];
    requestedParameters: string[] = [];
    private storedStateListeners = new Set<(message: unknown) => void>();
    private parameterListeners = new Map<string, Set<(value: unknown) => void>>();
    private statusListeners = new Set<(status: unknown) => void>();

    addStatusListener(listener: (status: unknown) => void) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener: (status: unknown) => void) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        const status = {
            details: {
                inputs: [
                    { endpointID: "hostSlot0Guard", purpose: "parameter", annotation: { hidden: true, init: 0, min: 0, max: 1 } },
                    { endpointID: "ottMix", purpose: "parameter", annotation: { init: 100, min: 0, max: 100 } },
                    { endpointID: "ottAmount", purpose: "parameter", annotation: { init: 100, min: 0, max: 100 } },
                    { endpointID: "ottTimePercent", purpose: "parameter", annotation: { init: 100, min: 10, max: 1000 } },
                    { endpointID: "ottBandDrive", purpose: "parameter", annotation: { init: 0, min: 0, max: 100 } },
                    { endpointID: "ottEnvelopeMatch", purpose: "parameter", annotation: { init: 0, min: 0, max: 100 } },
                    { endpointID: "envelopeBoostClampDb", purpose: "parameter", annotation: { init: 6, min: 0, max: 24 } },
                ],
            },
        };

        for (const listener of this.statusListeners) {
            listener(status);
        }
    }

    addStoredStateValueListener(listener: (message: unknown) => void) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener: (message: unknown) => void) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
        callback({ ...this.storedState });
    }

    sendStoredStateValue(key: string, value: unknown) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });

        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    addParameterListener(endpointID: string, listener: (value: unknown) => void) {
        if (!this.parameterListeners.has(endpointID)) {
            this.parameterListeners.set(endpointID, new Set());
        }

        this.parameterListeners.get(endpointID)?.add(listener);
    }

    removeParameterListener(endpointID: string, listener: (value: unknown) => void) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID: string) {
        this.requestedParameters.push(endpointID);

        if (Object.prototype.hasOwnProperty.call(this.parameterValues, endpointID)) {
            this.emitParameterValue(endpointID, this.parameterValues[endpointID]);
        }
    }

    sendEventOrValue(endpointID: string, value: unknown) {
        this.events.push({ endpointID, value });
        this.emitParameterValue(endpointID, value as EffectPresetValue);
    }

    emitParameterValue(endpointID: string, value: EffectPresetValue) {
        this.parameterValues[endpointID] = value;

        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    getListenerCounts() {
        return {
            storedState: this.storedStateListeners.size,
            parameters: Object.fromEntries(Array.from(this.parameterListeners.entries()).map(([endpointID, listeners]) => [
                endpointID,
                listeners.size,
            ])),
        };
    }
}

const statefulHookStatus = {
    details: {
        inputs: [
            { endpointID: "amount", purpose: "parameter", annotation: { init: 0.5, min: 0, max: 1 } },
        ],
    },
};

class StatefulPresetHookPatchConnection implements PatchConnectionLike {
    storedState: Record<string, unknown> = {};
    parameterValues: Record<string, EffectPresetValue> = {
        amount: 0.25,
    };
    events: Array<{ endpointID: string; value: unknown }> = [];
    storedWrites: Array<{ key: string; value: unknown }> = [];
    requestedParameters: string[] = [];
    private storedStateListeners = new Set<(message: unknown) => void>();
    private parameterListeners = new Map<string, Set<(value: unknown) => void>>();
    private statusListeners = new Set<(status: unknown) => void>();

    addStatusListener(listener: (status: unknown) => void) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener: (status: unknown) => void) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        for (const listener of this.statusListeners) {
            listener(statefulHookStatus);
        }
    }

    addStoredStateValueListener(listener: (message: unknown) => void) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener: (message: unknown) => void) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
        callback({ ...this.storedState });
    }

    sendStoredStateValue(key: string, value: unknown) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });

        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    addParameterListener(endpointID: string, listener: (value: unknown) => void) {
        if (!this.parameterListeners.has(endpointID)) {
            this.parameterListeners.set(endpointID, new Set());
        }

        this.parameterListeners.get(endpointID)?.add(listener);
    }

    removeParameterListener(endpointID: string, listener: (value: unknown) => void) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID: string) {
        this.requestedParameters.push(endpointID);

        if (Object.prototype.hasOwnProperty.call(this.parameterValues, endpointID)) {
            this.emitParameterValue(endpointID, this.parameterValues[endpointID]);
        }
    }

    sendEventOrValue(endpointID: string, value: unknown) {
        this.events.push({ endpointID, value });
        this.emitParameterValue(endpointID, value as EffectPresetValue);
    }

    emitParameterValue(endpointID: string, value: EffectPresetValue) {
        this.parameterValues[endpointID] = value;

        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
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
        shapeA: createDefaultMsegShape("Test MSEG A"),
        shapeB: createDefaultMsegShape("Test MSEG B"),
        morph: 0,
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
        "modulation.v2": serializeModulationState(bootModulationState),
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
    const keyboardRootNoteBounds = {
        min: 12,
        max: 72,
    };
    let currentRootNote = 36;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [rootNote, setRootNote] = useState(36);
            currentRootNote = rootNote;
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
                onKeyboardOctaveDown: () => {
                    if (currentRootNote <= keyboardRootNoteBounds.min) {
                        return false;
                    }

                    setRootNote((previousRootNote) => Math.max(previousRootNote - 12, keyboardRootNoteBounds.min));
                    return true;
                },
                onKeyboardOctaveUp: () => {
                    if (currentRootNote >= keyboardRootNoteBounds.max) {
                        return false;
                    }

                    setRootNote((previousRootNote) => Math.min(previousRootNote + 12, keyboardRootNoteBounds.max));
                    return true;
                },
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
                rootNote: currentRootNote,
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
                    onTablePrewarm={() => {}}
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

export async function installSharedFilterRangeEditorHarness(target: HTMLElement) {
    installFilterRangeEditorTestStyles();

    const state = {
        value: {
            mode: "lowpass" as FilterRangeMode,
            cutoffHz: geometricCenterCutoffHz(200, 3200),
            q: 4,
        },
        range: {
            startCutoffHz: 200,
            endCutoffHz: 3200,
        },
        valueLog: [] as FilterRangeValue[],
        rangeLog: [] as FilterRangeEndpoints[],
        editLog: [] as string[],
        rangePolarity: "bipolar" as FilterRangePolarity,
        previewActive: true,
    };
    let setHarnessRangePolarity: ((nextPolarity: FilterRangePolarity) => void) | null = null;
    let setHarnessPreviewActive: ((nextPreviewActive: boolean) => void) | null = null;
    let setHarnessValue: ((nextValue: Partial<FilterRangeValue>) => void) | null = null;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const [value, setValue] = useState<FilterRangeValue>(state.value);
            const [range, setRange] = useState<FilterRangeEndpoints>(state.range);
            const [rangePolarity, setRangePolarity] = useState<FilterRangePolarity>(state.rangePolarity);
            const [previewActive, setPreviewActive] = useState(state.previewActive);
            const preview = useMemo(() => ({
                active: previewActive,
                mode: value.mode,
                cutoffHz: range.endCutoffHz,
                q: value.q,
                label: "range end",
            }), [previewActive, range.endCutoffHz, value.mode, value.q]);

            useEffect(() => {
                state.value = cloneValue(value);
                state.range = cloneValue(range);
                state.rangePolarity = rangePolarity;
                state.previewActive = previewActive;
            }, [previewActive, range, rangePolarity, value]);

            useEffect(() => {
                setHarnessRangePolarity = (nextPolarity) => {
                    setRangePolarity(nextPolarity);
                    setRange(nextPolarity === "unipolar"
                        ? cutoffsFromBaseModulationOctaves({
                            baseCutoffHz: value.cutoffHz,
                            amountOctaves: 2,
                            polarity: "unipolar",
                        })
                        : cutoffsFromCenterRangeOctaves({
                            centerCutoffHz: value.cutoffHz,
                            rangeOctaves: 4,
                            direction: 1,
                        }));
                };
                setHarnessPreviewActive = setPreviewActive;
                setHarnessValue = (nextValue) => {
                    setValue((currentValue) => ({
                        ...currentValue,
                        ...nextValue,
                    }));
                };

                return () => {
                    setHarnessRangePolarity = null;
                    setHarnessPreviewActive = null;
                    setHarnessValue = null;
                };
            }, [value.cutoffHz]);

            const updateValue = (nextValue: FilterRangeValue) => {
                const modulationAmount = modulationOctavesFromCutoffRange({
                    baseCutoffHz: value.cutoffHz,
                    range,
                    polarity: rangePolarity,
                });
                const nextRange = rangePolarity === "unipolar"
                    ? cutoffsFromBaseModulationOctaves({
                        baseCutoffHz: nextValue.cutoffHz,
                        amountOctaves: modulationAmount,
                        polarity: "unipolar",
                    })
                    : cutoffsFromCenterRangeOctaves({
                        centerCutoffHz: nextValue.cutoffHz,
                        rangeOctaves: cutoffRangeOctaves(range.startCutoffHz, range.endCutoffHz),
                        direction: range.endCutoffHz >= range.startCutoffHz ? 1 : -1,
                    });
                state.valueLog.push(cloneValue(nextValue));
                setValue(nextValue);
                setRange(nextRange);
            };

            const updateRange = (nextRange: FilterRangeEndpoints) => {
                state.rangeLog.push(cloneValue(nextRange));
                setRange(nextRange);
            };

            return (
                <FilterRangeEditor
                    className="filter-range-editor-test"
                    value={value}
                    range={range}
                    rangePolarity={rangePolarity}
                    preview={preview}
                    showHandleChips
                    showModeControls
                    showReadout
                    onValueChange={updateValue}
                    onRangeChange={updateRange}
                    onEditStart={(targetName) => state.editLog.push(`start:${targetName}`)}
                    onEditEnd={(targetName) => state.editLog.push(`end:${targetName}`)}
                />
            );
        }

        root.render(<Harness />);
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        getSnapshot() {
            const axes = Array.from(target.querySelectorAll('[data-role="filter-range-editor-axis"]'));
            const xAxis = axes.find((axis) => axis.getAttribute("y1") === axis.getAttribute("y2"));
            const yAxis = axes.find((axis) => axis.getAttribute("x1") === axis.getAttribute("x2"));
            const surface = target.querySelector('[data-role="filter-range-editor-surface"]');
            const valueHandle = target.querySelector('[data-role="filter-range-value-handle"]');
            const valueHitTarget = target.querySelector('[data-role="filter-range-value-hit-target"]');
            const rangeBand = target.querySelector('[data-role="filter-range-band"]');
            const rangeStartHandle = target.querySelector('[data-role="filter-range-start-handle"]');
            const rangeEndHandle = target.querySelector('[data-role="filter-range-end-handle"]');
            const rangeEndHitTarget = target.querySelector('[data-role="filter-range-end-hit-target"]');
            const previewHandle = target.querySelector('[data-role="filter-range-preview-handle"]');
            const modeCycleButton = target.querySelector('[data-role="filter-range-mode-cycle-button"]');

            const readCircle = (element: Element | null) => {
                if (!element) {
                    return null;
                }

                return {
                    x: Number(element.getAttribute("cx") ?? 0),
                    y: Number(element.getAttribute("cy") ?? 0),
                };
            };
            const readElementCenterXInSurface = (element: Element | null) => {
                if (!(surface instanceof SVGSVGElement) || !element) {
                    return null;
                }

                const surfaceBounds = surface.getBoundingClientRect();
                const elementBounds = element.getBoundingClientRect();
                const viewBox = surface.viewBox.baseVal;
                const scaleX = viewBox.width / Math.max(1, surfaceBounds.width);

                return ((elementBounds.left + (elementBounds.width / 2)) - surfaceBounds.left) * scaleX;
            };

            return {
                value: cloneValue(state.value),
                range: cloneValue(state.range),
                rangePolarity: state.rangePolarity,
                previewActive: state.previewActive,
                valueLog: cloneValue(state.valueLog),
                rangeLog: cloneValue(state.rangeLog),
                editLog: cloneValue(state.editLog),
                surfaceTouchAction: surface instanceof SVGSVGElement
                    ? getComputedStyle(surface).touchAction
                    : null,
                valueHitTargetTabIndex: valueHitTarget?.getAttribute("tabindex") ?? null,
                rangeEndHitTargetTabIndex: rangeEndHitTarget?.getAttribute("tabindex") ?? null,
                plot: {
                    left: Number(yAxis?.getAttribute("x1") ?? 0),
                    right: Number(xAxis?.getAttribute("x2") ?? 0),
                    top: Number(yAxis?.getAttribute("y1") ?? 0),
                    bottom: Number(xAxis?.getAttribute("y1") ?? 0),
                },
                valueHandle: readCircle(valueHandle),
                rangeStartHandle: readCircle(rangeStartHandle),
                rangeEndHandle: readCircle(rangeEndHandle),
                previewHandle: readCircle(previewHandle),
                rangeStartHitTargetCount: target.querySelectorAll('[data-role="filter-range-start-hit-target"]').length,
                rangeBand: rangeBand ? {
                    x: Number(rangeBand.getAttribute("x") ?? 0),
                    width: Number(rangeBand.getAttribute("width") ?? 0),
                } : null,
                modeCycleButton: modeCycleButton ? {
                    ariaLabel: modeCycleButton.getAttribute("aria-label") ?? "",
                    modeLabel: modeCycleButton.getAttribute("data-mode-label") ?? "",
                    title: modeCycleButton.getAttribute("title") ?? "",
                } : null,
                readoutCenter: target.querySelector('[data-role="filter-range-readout-center"]')?.textContent ?? "",
                readoutRange: target.querySelector('[data-role="filter-range-readout-range"]')?.textContent ?? "",
                readoutWidth: target.querySelector('[data-role="filter-range-readout-width"]')?.textContent ?? "",
                readoutQ: target.querySelector('[data-role="filter-range-readout-q"]')?.textContent ?? "",
                chipCount: target.querySelectorAll(
                    '[data-role="filter-range-chip-center"], [data-role="filter-range-chip-start"], [data-role="filter-range-chip-end"], [data-role="filter-range-chip-span"]',
                ).length,
                chipCenterCutoff: target.querySelector('[data-role="filter-range-chip-center-cutoff"]')?.textContent ?? "",
                chipCenterQ: target.querySelector('[data-role="filter-range-chip-center-q"]')?.textContent ?? "",
                chipStart: target.querySelector('[data-role="filter-range-chip-start"]')?.textContent ?? "",
                chipEnd: target.querySelector('[data-role="filter-range-chip-end"]')?.textContent ?? "",
                chipSpanDirection: target.querySelector('[data-role="filter-range-chip-span-direction"]')?.textContent ?? "",
                chipSpanOctaves: target.querySelector('[data-role="filter-range-chip-span-octaves"]')?.textContent ?? "",
                chipSpanDirectionValue: target.querySelector('[data-role="filter-range-chip-span"]')?.getAttribute("data-direction") ?? "",
                chipCenterX: readElementCenterXInSurface(target.querySelector('[data-role="filter-range-chip-center"]')),
                chipSpanX: readElementCenterXInSurface(target.querySelector('[data-role="filter-range-chip-span"]')),
                valuePath: target.querySelector('[data-role="filter-range-value-response"]')?.getAttribute("d") ?? "",
                previewPath: target.querySelector('[data-role="filter-range-preview-response"]')?.getAttribute("d") ?? "",
            };
        },
        setRangePolarity(nextPolarity: FilterRangePolarity) {
            setHarnessRangePolarity?.(nextPolarity);
        },
        setPreviewActive(nextPreviewActive: boolean) {
            setHarnessPreviewActive?.(nextPreviewActive);
        },
        setValue(nextValue: Partial<FilterRangeValue>) {
            setHarnessValue?.(nextValue);
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installStandaloneEffectPresetHookHarness(target: HTMLElement) {
    const patchConnection = new StandalonePresetHookPatchConnection();
    const descriptorRegistry = createStandalonePresetDescriptorRegistry();
    const factoryPresets = createStandaloneFactoryPresets();
    let latestSnapshot: Record<string, unknown> | null = null;
    let latestMutations: ReturnType<typeof useStandaloneEffectPresets>["mutations"] | null = null;
    let firstMutations: ReturnType<typeof useStandaloneEffectPresets>["mutations"] | null = null;
    let mutationsStable = true;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const { state, mutations } = useStandaloneEffectPresets("ott", {
                descriptorRegistry,
                factoryPresets,
                initialFilter: { query: "env" },
            });

            if (!firstMutations) {
                firstMutations = mutations;
            } else if (firstMutations !== mutations) {
                mutationsStable = false;
            }

            latestMutations = mutations;

            useEffect(() => {
                latestSnapshot = {
                    ready: state.ready,
                    filter: state.filter,
                    visibleLabels: state.visiblePresets.map((preset) => preset.label),
                    presetKeys: state.presets.map((preset) => preset.presetKey),
                    activePreset: state.activePreset,
                    currentValues: state.currentValues,
                    missingCurrentValueEndpointIDs: state.missingCurrentValueEndpointIDs,
                    mutationKeys: Object.keys(mutations).sort(),
                    mutationsStable,
                };
            });

            return null;
        }

        root.render(
            <PatchConnectionProvider patchConnection={patchConnection}>
                <Harness />
            </PatchConnectionProvider>,
        );
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async applyEnvelopeTamed() {
            if (!latestMutations) {
                throw new Error("Standalone preset mutations are not available.");
            }

            const result = latestMutations.applyPreset("factory:ott.envelope-tamed");
            await waitForMicrotask();
            return result;
        },
        getSnapshot() {
            return {
                latest: cloneValue(latestSnapshot),
                events: cloneValue(patchConnection.events),
                storedWrites: cloneValue(patchConnection.storedWrites),
                requestedParameters: cloneValue(patchConnection.requestedParameters),
                listenerCounts: patchConnection.getListenerCounts(),
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}

export async function installStandaloneEffectPresetHookOptionsHarness(target: HTMLElement) {
    const effectID = "hook-stateful";
    const patchConnection = new StatefulPresetHookPatchConnection();
    const adapterApplies: unknown[] = [];
    const storedStateAdapters: Array<EffectStoredStateAdapter<{ pattern: string }>> = [{
        key: "hook.matrix.v1",
        schemaVersion: 1,
        getContract() {
            return {
                key: "hook.matrix.v1",
                schemaVersion: 1,
                required: true,
            };
        },
        capture() {
            return { pattern: "captured" };
        },
        normalizeForPreset(value) {
            if (!value || typeof value !== "object" || Array.isArray(value) || (value as { pattern?: unknown }).pattern !== "ok") {
                throw new Error("hook matrix state must contain pattern ok.");
            }

            return { pattern: "ok" };
        },
        serializeForPreset(value) {
            return { pattern: value.pattern };
        },
        apply(value) {
            adapterApplies.push({ pattern: value.pattern });
        },
    }];
    const oldContract = buildCanonicalPluginStateContract({
        effectID,
        parameters: [{
            endpointID: "mix",
            type: "number",
            min: 0,
            max: 1,
            defaultValue: 0.5,
        }],
    });
    const currentContract = buildPluginStateContract({
        effectID,
        status: statefulHookStatus,
        storedState: storedStateAdapters,
    });
    const factoryPreset: EffectPresetV2 = {
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID,
        presetID: "hook.old-mix",
        label: "Old Mix",
        contract: oldContract,
        parameters: {
            mix: 0.75,
        },
        storedState: {},
    };
    const factoryPresets = {
        [effectID]: [factoryPreset],
    };
    let migrationCallCount = 0;
    const presetMigrations: EffectPresetMigration[] = [{
        effectID,
        fromHash: oldContract.hash,
        toHash: currentContract.hash,
        migrate(preset) {
            migrationCallCount += 1;

            return {
                ...preset,
                contract: currentContract,
                parameters: {
                    amount: preset.parameters.mix,
                },
                storedState: {
                    "hook.matrix.v1": { pattern: "ok" },
                },
            };
        },
    }];
    let latestSnapshot: Record<string, unknown> | null = null;
    let latestMutations: ReturnType<typeof useStandaloneEffectPresets>["mutations"] | null = null;

    const mounted = mountHarness(target, (root) => {
        function Harness() {
            const { state, mutations } = useStandaloneEffectPresets(effectID, {
                factoryPresets,
                storedStateAdapters,
                presetMigrations,
            });

            latestMutations = mutations;

            useEffect(() => {
                latestSnapshot = {
                    ready: state.ready,
                    lastError: state.lastError,
                    currentContractHash: state.currentContract?.hash ?? null,
                    currentContractStoredStateKeys: state.currentContract?.storedState.map((entry) => entry.key) ?? [],
                    presets: state.presets.map((preset) => ({
                        presetKey: preset.presetKey,
                        canApply: preset.canApply,
                        parameters: preset.preset.parameters,
                        storedState: preset.preset.storedState,
                        contractHash: preset.preset.contract.hash,
                    })),
                };
            });

            return null;
        }

        root.render(
            <PatchConnectionProvider patchConnection={patchConnection}>
                <Harness />
            </PatchConnectionProvider>,
        );
    });

    window.__COSIMO_DESKTOP_MODULE_HARNESS__ = {
        async applyMigratedFactory() {
            if (!latestMutations) {
                throw new Error("Standalone preset mutations are not available.");
            }

            const result = latestMutations.applyPreset("factory:hook.old-mix");
            await waitForMicrotask();
            return result;
        },
        getSnapshot() {
            return {
                latest: cloneValue(latestSnapshot),
                events: cloneValue(patchConnection.events),
                storedWrites: cloneValue(patchConnection.storedWrites),
                requestedParameters: cloneValue(patchConnection.requestedParameters),
                adapterApplies: cloneValue(adapterApplies),
                migrationCallCount,
            };
        },
        async unmount() {
            mounted.unmount();
            await waitForMicrotask();
        },
    };

    await waitForMicrotask();
}
