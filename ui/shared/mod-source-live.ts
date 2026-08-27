/**
 * Live modulation-source telemetry for the traveling mod-fill lights.
 *
 * The engine's `effectiveModSourceState` monitor reports the clamped [0,1]
 * output of every per-voice modulation source (MSEG 1-3, Env 1-3, velocity,
 * pressure, slide, Amp Envelope) on the newest monitored voice at ~60Hz;
 * macro sources are
 * plain host parameters mirrored here from `macro1..4`. One driver per patch
 * connection subscribes ONCE, smooths the values, and moves every registered
 * light from a single rAF loop with direct attribute/style writes — hosts
 * re-render nothing per frame. Hosts own the projection from a source value
 * to a normalized band position, because the Voice rail law (linear additive,
 * `mobile-voice-rail-projection.ts`) and the rack knob law (log scale +
 * octave application, `rack-route-presentation.ts`) differ.
 */

import { useCallback, useEffect, useRef } from "react";

import { useOptionalPatchConnection, type PatchConnectionLike } from "./cmajor-react";
import { knobArcPoint } from "./parameter-knob-artwork";
import type { ModulationSourceKind } from "./modulation-targets";
import {
    hasUiMediaClock,
    uiMediaCancelAnimationFrame,
    uiMediaRequestAnimationFrame,
} from "./ui-media-clock";

export const EFFECTIVE_MOD_SOURCE_STATE_ENDPOINT_ID = "effectiveModSourceState";

/** Runtime order of the engine's per-voice sources (modulation-targets.ts). */
export const VOICE_MOD_SOURCE_VALUE_COUNT = 10;
const MACRO_SOURCE_COUNT = 4;

/** Smoothing time constant: how quickly a light chases a new source value. */
const LIGHT_SMOOTHING_TAU_MS = 45;
/** Below this delta a smoothed value snaps and stops animating. */
const SETTLE_EPSILON = 0.0005;
const FALLBACK_FRAME_MS = 33;

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

export type EffectiveModSourceState = {
    voiceGeneration: number;
    hasActive: boolean;
    values: ReadonlyArray<number>;
};

function coerceValues(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length < VOICE_MOD_SOURCE_VALUE_COUNT) {
        return null;
    }
    const values: number[] = [];
    for (let index = 0; index < VOICE_MOD_SOURCE_VALUE_COUNT; index += 1) {
        values.push(clamp01(Number(value[index]) || 0));
    }
    return values;
}

export function normalizeEffectiveModSourceStateMessage(
    message: unknown,
): EffectiveModSourceState | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const values = coerceValues((payload as { values?: unknown }).values);
    if (!values) {
        return null;
    }
    const rawGeneration = Number((payload as { voiceGeneration?: unknown }).voiceGeneration);
    return {
        voiceGeneration: Number.isFinite(rawGeneration)
            ? Math.max(0, Math.trunc(rawGeneration))
            : 0,
        hasActive: Boolean((payload as { hasActive?: unknown }).hasActive),
        values,
    };
}

/** Accept a message only when it is well formed and not from an older voice. */
export function selectObservedEffectiveModSourceState(
    currentState: EffectiveModSourceState | null | undefined,
    message: unknown,
): EffectiveModSourceState | null {
    const nextState = normalizeEffectiveModSourceStateMessage(message);
    if (!nextState) {
        return currentState ?? null;
    }
    if (currentState && nextState.voiceGeneration < currentState.voiceGeneration) {
        return currentState;
    }
    return nextState;
}

export type ModSourceIdentity = {
    readonly sourceKind: ModulationSourceKind;
    readonly sourceSlot: number | null;
};

/**
 * The engine's runtime index for a per-voice source, or null for macros
 * (mirrored from parameters, not the voice monitor) and malformed slots.
 */
export function voiceModSourceValueIndex(source: ModSourceIdentity): number | null {
    const slot = source.sourceSlot;
    switch (source.sourceKind) {
        case "mseg":
            return slot !== null && slot >= 1 && slot <= 3 ? slot - 1 : null;
        case "env":
            if (slot !== null && slot >= 1 && slot <= 3) return 2 + slot;
            return slot === 4 ? 9 : null;
        case "velocity":
            return 6;
        case "pressure":
            return 7;
        case "slide":
            return 8;
        case "macro":
            return null;
    }
}

export type ModSourceLightPlacement =
    /** SVG circle riding the knob's modulation arc at the given radius. */
    | { readonly kind: "knob-arc"; readonly radius: number }
    /** Absolutely positioned element sliding along a horizontal rail. */
    | { readonly kind: "rail" };

export type ModSourceLightSpec = {
    /** The armed route's source; null renders the light inert. */
    readonly source: ModSourceIdentity | null;
    /** Host-owned projection: clamped [0,1] source value → normalized [0,1] position. */
    readonly project: (sourceValue01: number) => number;
    readonly placement: ModSourceLightPlacement;
};

type LightEntry = {
    element: Element;
    spec: ModSourceLightSpec;
    lastLive: boolean | null;
    lastPositionText: string | null;
};

export type ModSourceLiveDriverHooks = {
    requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
};

function defaultRequestFrame(callback: (timestamp: number) => void): number {
    // The media-clock facade routes to an installed capture clock, or native
    // rAF otherwise; environments without rAF keep the timer fallback.
    if (hasUiMediaClock() || typeof globalThis.requestAnimationFrame === "function") {
        return uiMediaRequestAnimationFrame(callback);
    }
    return Number(setTimeout(() => callback(Date.now()), FALLBACK_FRAME_MS));
}

function defaultCancelFrame(handle: number): void {
    if (hasUiMediaClock() || typeof globalThis.cancelAnimationFrame === "function") {
        uiMediaCancelAnimationFrame(handle);
        return;
    }
    clearTimeout(handle);
}

/**
 * One per patch connection. Registered lights are driven imperatively; the
 * loop runs only while a voice is sounding, a value is still settling, or a
 * host poked a projection change, and stops itself otherwise.
 */
export class ModSourceLiveDriver {
    private readonly connection: PatchConnectionLike;
    private readonly requestFrame: (callback: (timestamp: number) => void) => number;
    private readonly cancelFrame: (handle: number) => void;

    private readonly entries = new Set<LightEntry>();
    private observed: EffectiveModSourceState | null = null;
    private readonly voiceTargets = new Float32Array(VOICE_MOD_SOURCE_VALUE_COUNT);
    private readonly voiceDisplays = new Float32Array(VOICE_MOD_SOURCE_VALUE_COUNT);
    private readonly macroTargets = new Float32Array(MACRO_SOURCE_COUNT);
    private readonly macroDisplays = new Float32Array(MACRO_SOURCE_COUNT);
    private hasActiveVoice = false;
    private applyPending = false;
    private frameHandle: number | null = null;
    private lastFrameTimestamp: number | null = null;
    private attached = false;

    private readonly endpointListener = (message: unknown) => {
        const next = selectObservedEffectiveModSourceState(this.observed, message);
        if (next === this.observed || next === null) {
            return;
        }
        this.observed = next;
        this.hasActiveVoice = next.hasActive;
        for (let index = 0; index < VOICE_MOD_SOURCE_VALUE_COUNT; index += 1) {
            this.voiceTargets[index] = next.values[index];
        }
        this.ensureLoop();
    };

    private readonly macroListeners: Array<(value: unknown) => void> = [];

    constructor(connection: PatchConnectionLike, hooks: ModSourceLiveDriverHooks = {}) {
        this.connection = connection;
        this.requestFrame = hooks.requestAnimationFrame ?? defaultRequestFrame;
        this.cancelFrame = hooks.cancelAnimationFrame ?? defaultCancelFrame;
    }

    attach(): void {
        if (this.attached) {
            return;
        }
        this.attached = true;
        this.connection.addEndpointListener?.(
            EFFECTIVE_MOD_SOURCE_STATE_ENDPOINT_ID,
            this.endpointListener,
        );
        for (let macroIndex = 0; macroIndex < MACRO_SOURCE_COUNT; macroIndex += 1) {
            const listener = (value: unknown) => {
                this.macroTargets[macroIndex] = clamp01(Number(value) || 0);
                this.ensureLoop();
            };
            this.macroListeners.push(listener);
            const endpointID = `macro${macroIndex + 1}`;
            this.connection.addParameterListener?.(endpointID, listener);
            this.connection.requestParameterValue?.(endpointID);
        }
    }

    detach(): void {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        this.connection.removeEndpointListener?.(
            EFFECTIVE_MOD_SOURCE_STATE_ENDPOINT_ID,
            this.endpointListener,
        );
        this.macroListeners.forEach((listener, macroIndex) => {
            this.connection.removeParameterListener?.(`macro${macroIndex + 1}`, listener);
        });
        this.macroListeners.length = 0;
        this.stopLoop();
        this.entries.clear();
    }

    register(element: Element, spec: ModSourceLightSpec): () => void {
        const entry: LightEntry = { element, spec, lastLive: null, lastPositionText: null };
        this.entries.add(entry);
        this.applyPending = true;
        this.ensureLoop();
        return () => {
            this.entries.delete(entry);
            if (this.entries.size === 0) {
                this.stopLoop();
            }
        };
    }

    /** A host changed a registered spec (new route amount, base, source). */
    updateSpec(element: Element, spec: ModSourceLightSpec): void {
        for (const entry of this.entries) {
            if (entry.element === element) {
                entry.spec = spec;
            }
        }
        this.poke();
    }

    /** Request one apply pass (used after projection inputs change). */
    poke(): void {
        this.applyPending = true;
        this.ensureLoop();
    }

    /** Test hook: the latest observed monitor state. */
    getObservedState(): EffectiveModSourceState | null {
        return this.observed;
    }

    private ensureLoop(): void {
        if (this.frameHandle !== null || this.entries.size === 0) {
            return;
        }
        this.lastFrameTimestamp = null;
        this.frameHandle = this.requestFrame(this.runFrame);
    }

    private stopLoop(): void {
        if (this.frameHandle !== null) {
            this.cancelFrame(this.frameHandle);
            this.frameHandle = null;
        }
        this.lastFrameTimestamp = null;
    }

    private readonly runFrame = (timestamp: number) => {
        this.frameHandle = null;
        const elapsedMs = this.lastFrameTimestamp === null
            ? FALLBACK_FRAME_MS
            : Math.max(1, timestamp - this.lastFrameTimestamp);
        this.lastFrameTimestamp = timestamp;

        const alpha = 1 - Math.exp(-elapsedMs / LIGHT_SMOOTHING_TAU_MS);
        let settling = false;
        settling = this.advanceValues(this.voiceDisplays, this.voiceTargets, alpha) || settling;
        settling = this.advanceValues(this.macroDisplays, this.macroTargets, alpha) || settling;

        for (const entry of this.entries) {
            this.applyEntry(entry);
        }
        this.applyPending = false;

        // A sounding voice keeps streaming fresh targets, so keep the loop
        // alive for it; otherwise run only until every value settles.
        if (this.hasActiveVoice || settling || this.applyPending) {
            this.frameHandle = this.requestFrame(this.runFrame);
        }
    };

    private advanceValues(displays: Float32Array, targets: Float32Array, alpha: number): boolean {
        let settling = false;
        for (let index = 0; index < displays.length; index += 1) {
            const delta = targets[index] - displays[index];
            if (Math.abs(delta) <= SETTLE_EPSILON) {
                displays[index] = targets[index];
            } else {
                displays[index] += delta * alpha;
                settling = true;
            }
        }
        return settling;
    }

    private resolveDisplayValue(source: ModSourceIdentity): { value: number; live: boolean } | null {
        if (source.sourceKind === "macro") {
            const slot = source.sourceSlot;
            if (slot === null || slot < 1 || slot > MACRO_SOURCE_COUNT) {
                return null;
            }
            // Macros are global: their light is meaningful with no voice sounding.
            return { value: this.macroDisplays[slot - 1], live: true };
        }
        const index = voiceModSourceValueIndex(source);
        if (index === null) {
            return null;
        }
        return { value: this.voiceDisplays[index], live: this.hasActiveVoice };
    }

    private applyEntry(entry: LightEntry): void {
        const source = entry.spec.source;
        const resolved = source === null ? null : this.resolveDisplayValue(source);
        const live = resolved !== null && resolved.live;
        if (entry.lastLive !== live) {
            entry.lastLive = live;
            entry.element.setAttribute("data-mod-live", live ? "1" : "0");
            (entry.element as HTMLElement | SVGCircleElement).style.opacity = live ? "1" : "0";
        }
        if (resolved === null) {
            return;
        }
        const normalized = clamp01(entry.spec.project(clamp01(resolved.value)));
        if (entry.spec.placement.kind === "knob-arc") {
            const point = knobArcPoint(normalized, entry.spec.placement.radius);
            const positionText = `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
            if (entry.lastPositionText !== positionText) {
                entry.lastPositionText = positionText;
                entry.element.setAttribute("cx", point.x.toFixed(2));
                entry.element.setAttribute("cy", point.y.toFixed(2));
            }
            return;
        }
        const positionText = `${(normalized * 100).toFixed(2)}%`;
        if (entry.lastPositionText !== positionText) {
            entry.lastPositionText = positionText;
            (entry.element as HTMLElement).style.left = positionText;
        }
    }
}

type SharedDriverEntry = {
    driver: ModSourceLiveDriver;
    refCount: number;
};

const sharedDrivers = new WeakMap<PatchConnectionLike, SharedDriverEntry>();

export function acquireModSourceLiveDriver(connection: PatchConnectionLike): ModSourceLiveDriver {
    // Frame scheduling goes through the default hooks, which consult the
    // ui-media-clock facade per call — a capture clock installed in this realm
    // takes effect without any per-caller plumbing.
    let entry = sharedDrivers.get(connection);
    if (!entry) {
        entry = { driver: new ModSourceLiveDriver(connection), refCount: 0 };
        sharedDrivers.set(connection, entry);
    }
    entry.refCount += 1;
    if (entry.refCount === 1) {
        entry.driver.attach();
    }
    return entry.driver;
}

export function releaseModSourceLiveDriver(connection: PatchConnectionLike): void {
    const entry = sharedDrivers.get(connection);
    if (!entry) {
        return;
    }
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
        entry.driver.detach();
        sharedDrivers.delete(connection);
    }
}

/**
 * Attach a traveling light element. Returns a stable ref callback; the spec
 * may change every render without re-registering. Renders inert (and cheap)
 * when no PatchConnectionProvider is present, e.g. in bare component tests.
 */
export function useModSourceLight(spec: ModSourceLightSpec): (element: Element | null) => void {
    const connection = useOptionalPatchConnection();
    const specRef = useRef(spec);
    specRef.current = spec;
    const attachmentRef = useRef<{
        element: Element;
        driver: ModSourceLiveDriver;
        connection: PatchConnectionLike;
        unregister: () => void;
    } | null>(null);
    const connectionRef = useRef(connection);
    connectionRef.current = connection;

    const attach = useCallback((element: Element | null) => {
        const current = attachmentRef.current;
        if (current !== null && current.element !== element) {
            current.unregister();
            releaseModSourceLiveDriver(current.connection);
            attachmentRef.current = null;
        }
        const nextConnection = connectionRef.current;
        if (element === null || nextConnection === null || attachmentRef.current !== null) {
            return;
        }
        const driver = acquireModSourceLiveDriver(nextConnection);
        attachmentRef.current = {
            element,
            driver,
            connection: nextConnection,
            unregister: driver.register(element, specRef.current),
        };
    }, []);

    useEffect(() => {
        const current = attachmentRef.current;
        if (current !== null) {
            current.driver.updateSpec(current.element, spec);
        }
    }, [spec]);

    useEffect(() => () => {
        const current = attachmentRef.current;
        if (current !== null) {
            current.unregister();
            releaseModSourceLiveDriver(current.connection);
            attachmentRef.current = null;
        }
    }, []);

    return attach;
}
