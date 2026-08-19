import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { usePatchConnection } from "../shared/cmajor-react";
import {
    createEditorCurvePlotRect,
    normalizedCurvePointToPlotPoint,
    plotPointToNormalizedCurvePoint,
} from "../shared/editor-curve-geometry";
import { usePatchParameterBinding, type PatchControlBinding } from "../shared/patch-controls";
import {
    RACK_EFFECT_DESCRIPTORS,
    formatRackParameterEditingValue,
    formatRackParameterValue,
    getRackEffectDescriptor,
    getRackParameterDescriptor,
    parseRackParameterEditingValue,
    type RackEffectDescriptor,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import {
    RACK_STATE_KEY,
    commitRackState,
    createDefaultRackState,
    deserializeRackState,
    serializeRackState,
    type RackState,
} from "../shared/rack-state";
import {
    MODULATION_SOURCE_OPTIONS,
    composeModulationAmount,
    formatModulationAmountEditingValue,
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
    isVoiceModulationSource,
    parseModulationAmountEditingValue,
    type GeneratedModulationRouteInput,
    type ModulationRoute,
    type ModulationRouteUpdate,
    type ModulationTargetKind,
    type RackModulationTargetKind,
} from "../shared/modulation";
import {
    modSourceDragHasActivated,
    resolveModSourceTouchPoint,
    type ModSourceDragPoint as ClientPoint,
    type ModSourceDragViewport as ClientViewport,
} from "../shared/mod-source-touch-geometry";
import {
    buildRailSilhouettePath,
    normalizeRailTop,
    parseStoredRailDock,
    projectRailDrawerPlacement,
    projectRailTop,
    railVerticalBounds,
    serializeRailDock,
    settleRailEdge,
    snapRailTop,
    type RailDock,
    type RailDrawerMetrics,
    type RailDrawerPlacement,
    type RailEdge,
    type RailVerticalBounds,
} from "../shared/mod-rail-perimeter";
import { presentRouteWithCanonicalAmount, useModulationRouteAmountBinding } from "../shared/modulation-route-amount";
import { parseModulationTargetKind } from "../shared/modulation-targets";
import {
    RACK_MODULATION_SOURCE_PAGES,
    findRackModulationSource,
    type RackModulationSource,
} from "../shared/rack-modulation-sources";
import {
    getModulationRouteCreation,
    projectRackRoutePresentation,
    type RackRouteCreation,
    type RackRouteSource,
} from "../shared/rack-route-presentation";
import type { EffectModuleId } from "../shared/target-descriptor";
import { FilterResponseGraph, VOICE_MODE_OPTIONS } from "../shared/synth-components";
import { PrecisionNumberField } from "./desktop-precision-number-field";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import {
    GLIDE_TIME_MAX_SECONDS,
    GLIDE_TIME_MIN_SECONDS,
    GLIDE_TIME_STEP_SECONDS,
    type SynthPatchViewModel,
} from "../shared/synth-hooks";
import { useSliderDrag, type SliderDragPointer } from "../shared/use-slider-drag";
import {
    RackParameterKnob,
    type RackParameterHud,
} from "./rack-parameter-knob";

type EffectsRackWorkspaceProps = {
    routes: ModulationRoute[];
    observedFilterSpectrum: SynthPatchViewModel["observedFilterSpectrum"];
    observedDistortionHistory: SynthPatchViewModel["observedDistortionHistory"];
    observedDistortionScope: SynthPatchViewModel["observedDistortionScope"];
    onAddRouteWithOverrides: (overrides: GeneratedModulationRouteInput) => boolean;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onBackToVoice: () => void;
    onOpenModSource?: (source: SelectedSource) => void;
    onGlobalModRailStateChange?: (state: GlobalModRailState) => void;
    onSelectedEffectChange?: (effectId: EffectModuleId) => void;
    mobileGlobalModRail?: boolean;
    mobileModRailPortalTarget?: HTMLElement | null;
    globalModSourceActivity?: number | null;
    modRailAudition?: ModRailAuditionBindings;
    modRailVoiceSettings?: ModRailVoiceSettings;
    /**
     * T06: dwell navigation during a source drag for surfaces the rack does
     * not own (workspace tabs, oscillator tabs). Rack rows resolve locally.
     */
    onDragDwellNavigate?: (dwellKey: string) => void;
    className?: string;
};

/**
 * The rail's audition wiring (T10B): the Note key's press lifecycle, the
 * Auto-preview mode, and the on-screen keyboard toggle. Required whenever the
 * mobile rail renders — a compact surface without them is a wiring defect.
 */
export type ModRailAuditionBindings = {
    readonly onNoteKeyDown: () => void;
    readonly onNoteKeyUp: () => void;
    readonly autoPreviewEnabled: boolean;
    readonly onToggleAutoPreview: () => void;
    readonly keyboardVisible: boolean;
    readonly onToggleKeyboard: () => void;
};

/**
 * T05: Play Mode/Glide live in the rail drawer's voice-settings popover (the
 * keyboard menu button was rejected; this placement is provisional).
 */
export type ModRailVoiceSettings = {
    readonly playMode: PatchControlBinding<number>;
    readonly glideTime: PatchControlBinding<number>;
};

type SelectedSource = Pick<RackModulationSource, "sourceKind" | "sourceSlot">;

export type GlobalModRailState = {
    readonly expanded: boolean;
    readonly selectedSource: SelectedSource;
};

type SourceDragPresentation = {
    readonly source: SelectedSource;
    readonly clientX: number;
    readonly clientY: number;
    readonly targetCaptured: boolean;
};

type ReorderGesture = {
    readonly pointerId: number;
    readonly effectId: EffectModuleId;
    readonly originalOrder: ReadonlyArray<EffectModuleId>;
    readonly captureElement: HTMLDivElement;
};

const EFFECT_ACCENTS: Readonly<Record<EffectModuleId, string>> = {
    filter: "#c6db3f",
    drive: "#ff6a27",
    ott: "#f2ca00",
    chorus: "#38d9d5",
    flanger: "#e94f43",
    phaser: "#df74cf",
    delay: "#55d9ff",
    reverb: "#e1b456",
};

const MOD_SOURCE_TOUCH_PREVIEW_RADIUS_PX = 23;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function readClientViewport(referenceElement: Element): ClientViewport {
    const ownerWindow = referenceElement.ownerDocument.defaultView;
    const visualViewport = ownerWindow?.visualViewport;
    const left = visualViewport?.offsetLeft ?? 0;
    const top = visualViewport?.offsetTop ?? 0;
    const width = visualViewport?.width ?? ownerWindow?.innerWidth ?? referenceElement.ownerDocument.documentElement.clientWidth;
    const height = visualViewport?.height ?? ownerWindow?.innerHeight ?? referenceElement.ownerDocument.documentElement.clientHeight;

    return {
        left: left + MOD_SOURCE_TOUCH_PREVIEW_RADIUS_PX,
        right: left + width - MOD_SOURCE_TOUCH_PREVIEW_RADIUS_PX,
        top: top + MOD_SOURCE_TOUCH_PREVIEW_RADIUS_PX,
        bottom: top + height - MOD_SOURCE_TOUCH_PREVIEW_RADIUS_PX,
        width,
    };
}

function resolveModSourceDragPoint(
    referenceElement: Element,
    pointerType: string,
    start: ClientPoint,
    previousPointer: ClientPoint,
    previousPreview: ClientPoint,
    pointer: ClientPoint,
): ClientPoint {
    return resolveModSourceTouchPoint({
        pointerType,
        start,
        previousPointer,
        previousPreview,
        pointer,
        viewport: readClientViewport(referenceElement),
    });
}

function hasReleasedMouseButton(event: ReactPointerEvent<HTMLElement>) {
    return event.pointerType === "mouse" && event.buttons === 0;
}

function elementAtPointInRenderRoot(referenceElement: Element, clientX: number, clientY: number) {
    const renderRoot = referenceElement.getRootNode();
    if (renderRoot instanceof Document || renderRoot instanceof ShadowRoot) {
        return renderRoot.elementFromPoint(clientX, clientY);
    }
    return null;
}

type ModulationDropTarget = {
    readonly element: HTMLElement;
    readonly targetKind: ModulationTargetKind;
    /** Extra destinations a compound drop surface pairs with one drop. */
    readonly companionKinds: ReadonlyArray<ModulationTargetKind>;
};

type ClientRect = {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
};

type ModulationDropCandidate = ModulationDropTarget & {
    readonly rect: ClientRect;
};

const MODULATION_TARGET_MIN_CAPTURE_PX = 44;
const MODULATION_TARGET_CAPTURE_HYSTERESIS_PX = 12;

function parseCompanionKinds(element: HTMLElement): ReadonlyArray<ModulationTargetKind> {
    const raw = element.dataset.modulationTargetCompanions;
    if (!raw) {
        return [];
    }
    return raw.split(/\s+/).filter(Boolean).map((candidate) => {
        const kind = parseModulationTargetKind(candidate);
        if (kind === null) {
            throw new Error(`Unknown companion modulation target "${candidate}"`);
        }
        return kind;
    });
}

function modulationTargetAtPoint(
    referenceElement: Element,
    clientX: number,
    clientY: number,
): ModulationDropTarget | null {
    const element = elementAtPointInRenderRoot(referenceElement, clientX, clientY)
        ?.closest<HTMLElement>("[data-modulation-target-kind]") ?? null;
    const targetKind = parseModulationTargetKind(element?.dataset.modulationTargetKind);
    return element === null || targetKind === null
        ? null
        : { element, targetKind, companionKinds: parseCompanionKinds(element) };
}

function modulationTargetFromElement(element: HTMLElement | null): ModulationDropTarget | null {
    const targetKind = parseModulationTargetKind(element?.dataset.modulationTargetKind);
    return element === null || targetKind === null
        ? null
        : { element, targetKind, companionKinds: parseCompanionKinds(element) };
}

function modulationDropCandidateFromTarget(target: ModulationDropTarget): ModulationDropCandidate | null {
    const bounds = target.element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || target.element.getClientRects().length === 0) {
        return null;
    }

    const horizontalInset = Math.max(0, (MODULATION_TARGET_MIN_CAPTURE_PX - bounds.width) / 2);
    const verticalInset = Math.max(0, (MODULATION_TARGET_MIN_CAPTURE_PX - bounds.height) / 2);
    return {
        ...target,
        rect: {
            left: bounds.left - horizontalInset,
            right: bounds.right + horizontalInset,
            top: bounds.top - verticalInset,
            bottom: bounds.bottom + verticalInset,
        },
    };
}

function modulationDropCandidates(referenceElement: Element): ModulationDropCandidate[] {
    const renderRoot = referenceElement.getRootNode();
    if (!(renderRoot instanceof Document || renderRoot instanceof ShadowRoot)) {
        return [];
    }

    return Array.from(renderRoot.querySelectorAll<HTMLElement>("[data-modulation-target-kind]")).flatMap((element) => {
        const target = modulationTargetFromElement(element);
        const candidate = target ? modulationDropCandidateFromTarget(target) : null;
        return candidate ? [candidate] : [];
    });
}

function pointIsInsideClientRect(point: ClientPoint, rect: ClientRect, inset = 0) {
    return point.x >= rect.left - inset
        && point.x <= rect.right + inset
        && point.y >= rect.top - inset
        && point.y <= rect.bottom + inset;
}

function clientRectCenter(rect: ClientRect): ClientPoint {
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2,
    };
}

function segmentClientRectEntry(
    start: ClientPoint,
    end: ClientPoint,
    rect: ClientRect,
): number | null {
    const delta = { x: end.x - start.x, y: end.y - start.y };
    let entry = 0;
    let exit = 1;

    for (const [origin, movement, minimum, maximum] of [
        [start.x, delta.x, rect.left, rect.right],
        [start.y, delta.y, rect.top, rect.bottom],
    ] as const) {
        if (movement === 0) {
            if (origin < minimum || origin > maximum) {
                return null;
            }
            continue;
        }

        const first = (minimum - origin) / movement;
        const second = (maximum - origin) / movement;
        entry = Math.max(entry, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (entry > exit) {
            return null;
        }
    }

    return entry >= 0 && entry <= 1 ? entry : null;
}

function resolveModulationTargetForDrag(
    referenceElement: Element,
    point: ClientPoint,
    previousPoint: ClientPoint,
    previousTarget: HTMLElement | null,
): ModulationDropCandidate | null {
    const exactTarget = modulationTargetAtPoint(referenceElement, point.x, point.y);
    if (exactTarget) {
        const candidate = modulationDropCandidateFromTarget(exactTarget);
        if (candidate) {
            return candidate;
        }
    }

    if (previousTarget) {
        const previous = modulationTargetFromElement(previousTarget);
        const retained = previous ? modulationDropCandidateFromTarget(previous) : null;
        if (retained && pointIsInsideClientRect(point, retained.rect, MODULATION_TARGET_CAPTURE_HYSTERESIS_PX)) {
            return retained;
        }
    }

    const candidates = modulationDropCandidates(referenceElement);
    const nearPoint = candidates
        .filter(({ rect }) => pointIsInsideClientRect(point, rect))
        .sort((left, right) => {
            const leftCenter = clientRectCenter(left.rect);
            const rightCenter = clientRectCenter(right.rect);
            return Math.hypot(point.x - leftCenter.x, point.y - leftCenter.y)
                - Math.hypot(point.x - rightCenter.x, point.y - rightCenter.y);
        })[0];
    if (nearPoint) {
        return nearPoint;
    }

    return candidates
        .flatMap((candidate) => {
            const entry = segmentClientRectEntry(previousPoint, point, candidate.rect);
            return entry === null ? [] : [{ candidate, entry }];
        })
        .sort((left, right) => right.entry - left.entry)[0]?.candidate ?? null;
}

function readRackStateFromFullStoredState(fullState: Record<string, unknown>) {
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};
    return Object.hasOwn(values, RACK_STATE_KEY) ? values[RACK_STATE_KEY] : fullState[RACK_STATE_KEY];
}

function useRackState() {
    const patchConnection = usePatchConnection();
    const [rackState, setRackState] = useState<RackState>(createDefaultRackState);
    const rackStateRef = useRef(rackState);

    const acceptRackState = useCallback((nextState: RackState) => {
        rackStateRef.current = nextState;
        setRackState(nextState);
    }, []);

    // rack.v1 is the editor's desired and persisted authority. effectiveRackState is
    // diagnostic readback without a correlated intent id, so an older DSP event must
    // never replace the base of a newer user edit.
    useEffect(() => {
        const storedStateListener = (message: unknown) => {
            if (typeof message !== "object" || message === null || Array.isArray(message)) {
                return;
            }

            if (Reflect.get(message, "key") === RACK_STATE_KEY) {
                acceptRackState(deserializeRackState(Reflect.get(message, "value")));
            }
        };

        patchConnection.addStoredStateValueListener?.(storedStateListener);
        patchConnection.requestFullStoredState?.((fullState) => {
            acceptRackState(deserializeRackState(readRackStateFromFullStoredState(fullState)));
        });

        return () => {
            patchConnection.removeStoredStateValueListener?.(storedStateListener);
        };
    }, [acceptRackState, patchConnection]);

    const commit = useCallback((nextState: RackState) => {
        acceptRackState(nextState);
        commitRackState(patchConnection, nextState);
        patchConnection.sendStoredStateValue?.(RACK_STATE_KEY, serializeRackState(nextState));
    }, [acceptRackState, patchConnection]);

    return { rackState, rackStateRef, commit };
}

function useRackParameterBinding(descriptor: RackParameterDescriptor, active = true) {
    const coerce = useCallback((rawValue: unknown) => {
        const numericValue = Number(rawValue);
        const fallback = Number.isFinite(numericValue) ? numericValue : descriptor.initial;
        return clamp(fallback, descriptor.min, descriptor.max);
    }, [descriptor.initial, descriptor.max, descriptor.min]);

    return usePatchParameterBinding<number>({
        endpointID: descriptor.endpointID,
        initialValue: descriptor.initial,
        coerce,
        active,
    });
}

function normalizedRackParameterValue(descriptor: RackParameterDescriptor, value: number) {
    if (descriptor.scale === "log") {
        return Math.log(clamp(value, descriptor.min, descriptor.max) / descriptor.min)
            / Math.log(descriptor.max / descriptor.min);
    }

    return (clamp(value, descriptor.min, descriptor.max) - descriptor.min)
        / (descriptor.max - descriptor.min);
}

function rackParameterValueFromNormalized(descriptor: RackParameterDescriptor, normalizedValue: number) {
    const normalized = clamp(normalizedValue, 0, 1);
    return descriptor.scale === "log"
        ? descriptor.min * (descriptor.max / descriptor.min) ** normalized
        : descriptor.min + (descriptor.max - descriptor.min) * normalized;
}

function normalizedRackParameterKeyboardStep(descriptor: RackParameterDescriptor) {
    return Math.max(0.01, descriptor.step / (descriptor.max - descriptor.min));
}

function formatRackQuickParameterValue(descriptor: RackParameterDescriptor, value: number) {
    if (descriptor.choices !== undefined) {
        return formatRackParameterValue(descriptor, value);
    }
    if (descriptor.unit === "dB") {
        return `${Math.round(value)}dB`;
    }
    if (descriptor.unit === "Hz") {
        return value >= 1_000 ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k` : `${Math.round(value)}Hz`;
    }
    if (descriptor.unit === "ms") {
        return `${Math.round(value)}ms`;
    }
    return formatRackParameterValue(descriptor, value);
}

function moveEffect(
    order: ReadonlyArray<EffectModuleId>,
    effectId: EffectModuleId,
    overEffectId: EffectModuleId,
) {
    const sourceIndex = order.indexOf(effectId);
    const targetIndex = order.indexOf(overEffectId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return order;
    }

    const nextOrder = [...order];
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, effectId);
    return nextOrder;
}

function sameOrder(left: ReadonlyArray<EffectModuleId>, right: ReadonlyArray<EffectModuleId>) {
    return left.length === right.length && left.every((effectId, index) => effectId === right[index]);
}

function PowerGlyph() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8v8.1M7.2 5.6a8 8 0 1 0 9.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
        </svg>
    );
}

function GripDots() {
    return (
        <span className="rack-grip-dots" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
    );
}

function RackQuickSurface({
    descriptor,
    selected,
    onSelect,
    onRecentParameter,
}: {
    descriptor: RackParameterDescriptor;
    selected: boolean;
    onSelect: () => void;
    onRecentParameter: (endpointID: string) => void;
}) {
    const binding = useRackParameterBinding(descriptor);
    const surfaceRef = useRef<HTMLButtonElement | null>(null);
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
    } = useSliderDrag();
    const normalized = normalizedRackParameterValue(descriptor, binding.value);
    const adjustFromNormalized = useCallback((nextNormalized: number) => {
        binding.setValue(rackParameterValueFromNormalized(descriptor, nextNormalized));
    }, [binding, descriptor]);
    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }

        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const normalizedStep = descriptor.choices
            ? 1 / Math.max(1, descriptor.choices.length - 1)
            : Math.max(0.01, descriptor.step / (descriptor.max - descriptor.min));
        binding.commitValue(rackParameterValueFromNormalized(
            descriptor,
            clamp(normalized + direction * normalizedStep, 0, 1),
        ));
        onRecentParameter(descriptor.endpointID);
        onSelect();
    }, [binding, descriptor, normalized, onRecentParameter, onSelect]);

    return (
        <button
            ref={surfaceRef}
            type="button"
            role="slider"
            data-role={`rack-quick-${descriptor.effectId}`}
            data-rack-quick-endpoint={descriptor.endpointID}
            aria-label={`${getRackEffectDescriptor(descriptor.effectId).label} ${descriptor.label}`}
            aria-valuemin={descriptor.min}
            aria-valuemax={descriptor.max}
            aria-valuenow={binding.value}
            aria-valuetext={formatRackQuickParameterValue(descriptor, binding.value)}
            className="rack-quick-surface"
            style={{ "--rack-progress": normalized } as CSSProperties}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
                onSelect();
                onRecentParameter(descriptor.endpointID);
                handlePointerDown(
                    event,
                    surfaceRef.current,
                    binding,
                    normalized,
                    descriptor.min,
                    descriptor.max,
                    "horizontal-relative",
                    adjustFromNormalized,
                );
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={() => handleLostPointerCapture()}
        >
            <span className="rack-wordmark-line" aria-hidden="true">
                <span className="rack-wordmark">{getRackEffectDescriptor(descriptor.effectId).label}</span>
            </span>
            <span className="rack-quick-line">
                <span>{descriptor.shortLabel}</span>
                <strong>{formatRackQuickParameterValue(descriptor, binding.value)}</strong>
            </span>
            {selected ? <span className="sr-only">Selected effect</span> : null}
        </button>
    );
}

function RackUnit({
    effectId,
    position,
    enabled,
    selected,
    reordering,
    quickEndpointID,
    onSelect,
    onToggle,
    onRecentParameter,
    onReorderPointerDown,
    onKeyboardMove,
}: {
    effectId: EffectModuleId;
    position: number;
    enabled: boolean;
    selected: boolean;
    reordering: boolean;
    quickEndpointID: string;
    onSelect: () => void;
    onToggle: () => void;
    onRecentParameter: (endpointID: string) => void;
    onReorderPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    onKeyboardMove: (offset: -1 | 1) => void;
}) {
    const effect = getRackEffectDescriptor(effectId);
    const quickDescriptor = effect.parameters.find((parameter) => parameter.endpointID === quickEndpointID)
        ?? effect.parameters.find((parameter) => parameter.endpointID === effect.initialQuickEndpointID)
        ?? effect.parameters[0];

    return (
        <div
            data-role={`rack-module-${effectId}`}
            data-rack-effect-id={effectId}
            data-rack-position={position}
            data-effect-id={effectId}
            data-enabled={enabled ? "true" : "false"}
            data-drag-dwell={`rack-effect:${effectId}`}
            className={`rack-unit${selected ? " is-selected" : ""}${enabled ? "" : " is-disabled"}${reordering ? " is-reordering" : ""}`}
        >
            <button
                type="button"
                data-role={`rack-reorder-handle-${effectId}`}
                aria-label={`Reorder ${effect.label}`}
                className="rack-grip"
                onPointerDown={onReorderPointerDown}
                onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                        event.preventDefault();
                        onKeyboardMove(-1);
                    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                        event.preventDefault();
                        onKeyboardMove(1);
                    }
                }}
            >
                <GripDots />
            </button>
            <RackQuickSurface
                descriptor={quickDescriptor}
                selected={selected}
                onSelect={onSelect}
                onRecentParameter={onRecentParameter}
            />
            <button
                type="button"
                data-role={`rack-enabled-${effectId}`}
                aria-label={`${enabled ? "Bypass" : "Enable"} ${effect.label}`}
                aria-pressed={enabled}
                className="rack-power"
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                <PowerGlyph />
            </button>
        </div>
    );
}

function isRouteForTarget(route: ModulationRoute, endpointID: string) {
    return route.targetKind === `rack.${endpointID}`;
}

function routePairKey(source: RackRouteSource, targetKind: ModulationTargetKind) {
    return `${source.sourceKind}:${source.sourceSlot}:${targetKind}`;
}

const RACK_CONTROL_ROLE_ALIASES: Readonly<Record<string, string>> = {
    distortionMode: "distortion-mode-option-1",
    distortionDriveDb: "distortion-drive-field",
    distortionKnee: "distortion-knee-field",
    distortionWet: "distortion-mix-field",
    distortionWetLPHz: "distortion-wet-lp-field",
    chorusMotionMode: "chorus-motion-mode-control",
    chorusBloomMode: "chorus-bloom-mode-control",
    chorusMix: "chorus-mix-control",
    chorusTone: "chorus-tone-control",
    chorusFeedback: "chorus-feedback-control",
    chorusRingAmount: "chorus-ring-amount-control",
    chorusRingOffsetMode: "chorus-ring-offset-mode-control",
    chorusRingFineSemitones: "chorus-ring-fine-control",
};

const RACK_TRACK_ROLE_ALIASES: Readonly<Record<string, string>> = {
    chorusMix: "chorus-mix-track",
};

const RACK_HANDLE_ROLE_ALIASES: Readonly<Record<string, string>> = {
    distortionDriveDb: "distortion-drive-handle",
    distortionKnee: "distortion-knee-handle",
    distortionWet: "distortion-mix-handle",
};

function RackParameterControl({
    descriptor,
    routes,
    selected,
    activeSource,
    sourceIsSelected,
    effectEnabled,
    targetEffective,
    pending,
    dragSourceAccent,
    hovered,
    onSelect,
    onRecentParameter,
    onHudChange,
    onRequestContextMenu,
}: {
    descriptor: RackParameterDescriptor;
    routes: ReadonlyArray<ModulationRoute>;
    selected: boolean;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    effectEnabled: boolean;
    targetEffective: boolean;
    pending: boolean;
    dragSourceAccent: string | null;
    hovered: boolean;
    onSelect: () => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const binding = useRackParameterBinding(descriptor);
    const isTarget = descriptor.modulationTargetIndex !== null;
    const presentation = projectRackRoutePresentation({
        routes,
        armedSource: sourceIsSelected ? activeSource : null,
        targetKind: isTarget ? `rack.${descriptor.endpointID}` as RackModulationTargetKind : null,
        effectEnabled,
        targetEffective,
        pending,
    });
    const amountBinding = useModulationRouteAmountBinding(presentation.currentRoute);
    const presentedRoute = presentRouteWithCanonicalAmount(presentation.currentRoute, amountBinding);
    const rootStyle = {
        "--drag-source-color": dragSourceAccent ?? "transparent",
    } as CSSProperties;
    const controlDataRole = RACK_CONTROL_ROLE_ALIASES[descriptor.endpointID]
        ?? `rack-parameter-${descriptor.endpointID}`;

    const selectParameter = useCallback(() => {
        onRecentParameter(descriptor.endpointID);
        if (isTarget) {
            onSelect();
        }
    }, [descriptor.endpointID, isTarget, onRecentParameter, onSelect]);

    if (descriptor.choices !== undefined) {
        const choiceIndex = Math.max(0, descriptor.choices.findIndex(
            (choice) => choice.value === Math.round(binding.value),
        ));
        const selectedChoice = descriptor.choices[choiceIndex] ?? descriptor.choices[0];

        return (
            <button
                type="button"
                data-role={controlDataRole}
                aria-label={`${descriptor.label}: ${selectedChoice?.label ?? ""}`}
                className="rack-choice-control"
                onClick={() => {
                    const nextChoice = descriptor.choices?.[(choiceIndex + 1) % descriptor.choices.length];
                    if (nextChoice) {
                        binding.commitValue(nextChoice.value);
                        selectParameter();
                    }
                }}
            >
                <span>{descriptor.endpointID === "chorusRingOffsetMode" ? descriptor.shortLabel : descriptor.label}</span>
                <strong>{selectedChoice?.label}</strong>
            </button>
        );
    }

    return (
        <div
            data-role={`rack-parameter-surface-${descriptor.endpointID}`}
            data-rack-mod-target={isTarget ? descriptor.endpointID : undefined}
            data-modulation-target-kind={isTarget ? `rack.${descriptor.endpointID}` : undefined}
            data-creation-state={presentation.creation}
            data-effectiveness={presentation.effectiveness}
            className={`rack-editor-control${selected ? " is-selected-target" : ""}${hovered ? " is-mod-hover" : ""}${presentation.effectiveness === "active" ? "" : " is-suspended"}`}
            style={rootStyle}
        >
            {presentation.badge !== "hidden" ? (
                <span
                    className={`rack-route-count-badge is-${presentation.badge}`}
                    data-role={`rack-route-count-${descriptor.endpointID}`}
                    aria-label={`${presentation.targetRouteCount} modulation ${presentation.targetRouteCount === 1 ? "route" : "routes"} target ${descriptor.label}`}
                >
                    {presentation.targetRouteCount}
                </span>
            ) : null}
            {presentation.effectiveness === "target-suspended" ? (
                <span className="rack-target-suspended-label">MODE</span>
            ) : null}
            <RackParameterKnob
                descriptor={descriptor}
                binding={binding}
                route={presentedRoute}
                sourceIsSelected={sourceIsSelected}
                sourceAccent={activeSource.accent}
                effectiveness={presentation.effectiveness}
                dataRole={controlDataRole}
                trackDataRole={RACK_TRACK_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-track-${descriptor.endpointID}`}
                handleDataRole={RACK_HANDLE_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-handle-${descriptor.endpointID}`}
                onSelect={selectParameter}
                ownerAccent={EFFECT_ACCENTS[descriptor.effectId]}
                onModulationAmountChange={amountBinding.setValue}
                onRequestContextMenu={(clientX, clientY) => onRequestContextMenu(
                    descriptor.endpointID,
                    clientX,
                    clientY,
                )}
            />
        </div>
    );
}

function FilterRackVisual({
    spectrum,
    onRecentParameter,
}: {
    spectrum: SynthPatchViewModel["observedFilterSpectrum"];
    onRecentParameter: (endpointID: string) => void;
}) {
    const effect = getRackEffectDescriptor("filter");
    const modeDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterMode")!;
    const cutoffDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterCutoff")!;
    const resonanceDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterResonance")!;
    const mode = useRackParameterBinding(modeDescriptor);
    const cutoff = useRackParameterBinding(cutoffDescriptor);
    const resonance = useRackParameterBinding(resonanceDescriptor);

    return (
        <FilterResponseGraph
            baseMode={mode.value}
            baseCutoffHz={cutoff.value}
            baseQ={resonance.value}
            liveMode={mode.value}
            liveCutoffHz={cutoff.value}
            liveQ={resonance.value}
            liveHasActive={false}
            spectrumFrame={spectrum}
            onGestureStart={() => {
                cutoff.beginGesture();
                resonance.beginGesture();
                onRecentParameter(cutoff.endpointID);
            }}
            onGestureEnd={() => {
                cutoff.endGesture();
                resonance.endGesture();
            }}
            onCutoffSet={(value) => cutoff.setValue(value)}
            onQSet={(value) => resonance.setValue(value)}
            className="h-full w-full"
        />
    );
}

function DistortionRackVisual({
    history,
    scope,
}: {
    history: SynthPatchViewModel["observedDistortionHistory"];
    scope: SynthPatchViewModel["observedDistortionScope"];
}) {
    const kneeDescriptor = getRackEffectDescriptor("drive").parameters.find(
        (parameter) => parameter.endpointID === "distortionKnee",
    )!;
    const knee = useRackParameterBinding(kneeDescriptor);

    return (
        <DistortionVisualizer
            compact
            knee={knee.value}
            transferFrame={scope}
            historyFrame={history}
            className="h-full w-full"
        />
    );
}

const GENERIC_RACK_XY_PLOT = createEditorCurvePlotRect(100, 100, {
    horizontalPaddingPx: 0,
    topPaddingPx: 0,
    bottomPaddingPx: 0,
});

function GenericRackXYVisual({
    descriptor,
    onRecentParameter,
}: {
    descriptor: RackEffectDescriptor;
    onRecentParameter: (endpointID: string) => void;
}) {
    const xDescriptor = descriptor.parameters.find(
        (parameter) => parameter.endpointID === descriptor.xEndpointID,
    );
    const yDescriptor = descriptor.parameters.find(
        (parameter) => parameter.endpointID === descriptor.yEndpointID,
    );

    if (xDescriptor === undefined || yDescriptor === undefined) {
        throw new Error(`The ${descriptor.id} X/Y visual is missing a parameter descriptor.`);
    }

    const xBinding = useRackParameterBinding(xDescriptor);
    const yBinding = useRackParameterBinding(yDescriptor);
    const surfaceRef = useRef<HTMLButtonElement | null>(null);
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
    } = useSliderDrag();
    const normalizedX = normalizedRackParameterValue(xDescriptor, xBinding.value);
    const normalizedY = normalizedRackParameterValue(yDescriptor, yBinding.value);
    const marker = normalizedCurvePointToPlotPoint(
        { x: normalizedX, y: normalizedY },
        GENERIC_RACK_XY_PLOT,
    );
    const gestureBinding = useMemo<PatchControlBinding<number>>(() => ({
        ...xBinding,
        beginGesture: () => {
            xBinding.beginGesture();
            yBinding.beginGesture();
        },
        endGesture: () => {
            xBinding.endGesture();
            yBinding.endGesture();
        },
    }), [xBinding, yBinding.beginGesture, yBinding.endGesture]);
    const setValuesFromPointer = useCallback((
        _normalizedValue: number,
        pointer: SliderDragPointer,
    ) => {
        const surface = surfaceRef.current;
        if (surface === null) {
            return;
        }

        const bounds = surface.getBoundingClientRect();
        const plot = createEditorCurvePlotRect(bounds.width, bounds.height, {
            horizontalPaddingPx: 0,
            topPaddingPx: 0,
            bottomPaddingPx: 0,
        });
        const nextPoint = plotPointToNormalizedCurvePoint({
            x: pointer.x - bounds.left,
            y: pointer.y - bounds.top,
        }, plot);
        xBinding.setValue(rackParameterValueFromNormalized(xDescriptor, nextPoint.x));
        yBinding.setValue(rackParameterValueFromNormalized(yDescriptor, nextPoint.y));
    }, [xBinding.setValue, xDescriptor, yBinding.setValue, yDescriptor]);
    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
        const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
        if (!horizontal && !vertical) {
            return;
        }

        event.preventDefault();
        const axisDescriptor = horizontal ? xDescriptor : yDescriptor;
        const axisBinding = horizontal ? xBinding : yBinding;
        const currentNormalized = horizontal ? normalizedX : normalizedY;
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
        axisBinding.commitValue(rackParameterValueFromNormalized(
            axisDescriptor,
            clamp(
                currentNormalized + direction * normalizedRackParameterKeyboardStep(axisDescriptor),
                0,
                1,
            ),
        ));
        onRecentParameter(axisDescriptor.endpointID);
    }, [normalizedX, normalizedY, onRecentParameter, xBinding, xDescriptor, yBinding, yDescriptor]);

    return (
        <button
            ref={surfaceRef}
            type="button"
            data-role="rack-xy-visual"
            data-effect-id={descriptor.id}
            data-x-endpoint-id={xDescriptor.endpointID}
            data-y-endpoint-id={yDescriptor.endpointID}
            data-x-normalized={normalizedX.toFixed(6)}
            data-y-normalized={normalizedY.toFixed(6)}
            className="rack-xy-visual"
            aria-label={`${descriptor.label} X/Y control: ${xDescriptor.label} and ${yDescriptor.label}`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown ArrowUp"
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) {
                    return;
                }
                onRecentParameter(xDescriptor.endpointID);
                handlePointerDown(
                    event,
                    surfaceRef.current,
                    gestureBinding,
                    normalizedX,
                    xDescriptor.min,
                    xDescriptor.max,
                    "horizontal",
                    setValuesFromPointer,
                );
                setValuesFromPointer(normalizedX, { x: event.clientX, y: event.clientY });
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={() => handleLostPointerCapture()}
        >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path className="rack-visual-grid" d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" />
                <path className="rack-xy-guide" d={`M ${marker.x} 0 V 100 M 0 ${marker.y} H 100`} />
            </svg>
            <span
                className="rack-xy-marker"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                aria-hidden="true"
            />
            <span className="rack-xy-axis-label is-x" aria-hidden="true">X · {xDescriptor.shortLabel}</span>
            <span className="rack-xy-axis-label is-y" aria-hidden="true">Y · {yDescriptor.shortLabel}</span>
        </button>
    );
}

function RackEditorReadout({ descriptor }: { descriptor: RackParameterDescriptor }) {
    const binding = useRackParameterBinding(descriptor);

    return (
        <span className="rack-editor-visual-readout">
            <span>{descriptor.shortLabel}</span>
            <strong>{formatRackParameterValue(descriptor, binding.value)}</strong>
        </span>
    );
}

function RackEditorVisual({
    effectId,
    observedFilterSpectrum,
    observedDistortionHistory,
    observedDistortionScope,
    onRecentParameter,
}: {
    effectId: EffectModuleId;
    observedFilterSpectrum: SynthPatchViewModel["observedFilterSpectrum"];
    observedDistortionHistory: SynthPatchViewModel["observedDistortionHistory"];
    observedDistortionScope: SynthPatchViewModel["observedDistortionScope"];
    onRecentParameter: (endpointID: string) => void;
}) {
    if (effectId === "filter") {
        return <FilterRackVisual spectrum={observedFilterSpectrum} onRecentParameter={onRecentParameter} />;
    }

    if (effectId === "drive") {
        return <DistortionRackVisual history={observedDistortionHistory} scope={observedDistortionScope} />;
    }

    return (
        <GenericRackXYVisual
            descriptor={getRackEffectDescriptor(effectId)}
            onRecentParameter={onRecentParameter}
        />
    );
}

function ParameterList({
    effectId,
    routes,
    selectedTargetEndpointID,
    hoverTargetEndpointID,
    activeSource,
    sourceIsSelected,
    effectEnabled,
    pendingRouteKey,
    dragSourceAccent,
    onSelectTarget,
    onRecentParameter,
    onHudChange,
    onRequestContextMenu,
}: {
    effectId: EffectModuleId;
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    effectEnabled: boolean;
    pendingRouteKey: string | null;
    dragSourceAccent: string | null;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const descriptor = getRackEffectDescriptor(effectId);

    if (effectId === "phaser" || effectId === "delay") {
        return (
            <SyncParameterList
                effectId={effectId}
                routes={routes}
                selectedTargetEndpointID={selectedTargetEndpointID}
                hoverTargetEndpointID={hoverTargetEndpointID}
                activeSource={activeSource}
                sourceIsSelected={sourceIsSelected}
                effectEnabled={effectEnabled}
                pendingRouteKey={pendingRouteKey}
                dragSourceAccent={dragSourceAccent}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
                onHudChange={onHudChange}
                onRequestContextMenu={onRequestContextMenu}
            />
        );
    }

    if (effectId === "filter") {
        return (
            <FilterParameterList
                routes={routes}
                selectedTargetEndpointID={selectedTargetEndpointID}
                hoverTargetEndpointID={hoverTargetEndpointID}
                activeSource={activeSource}
                sourceIsSelected={sourceIsSelected}
                effectEnabled={effectEnabled}
                pendingRouteKey={pendingRouteKey}
                dragSourceAccent={dragSourceAccent}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
                onHudChange={onHudChange}
                onRequestContextMenu={onRequestContextMenu}
            />
        );
    }

    return (
        <>
            {descriptor.parameters.map((parameter) => (
                <RackParameterControl
                    key={parameter.endpointID}
                    descriptor={parameter}
                    routes={routes}
                    selected={selectedTargetEndpointID === parameter.endpointID}
                    activeSource={activeSource}
                    sourceIsSelected={sourceIsSelected}
                    effectEnabled={effectEnabled}
                    targetEffective
                    pending={pendingRouteKey === `${activeSource.sourceKind}:${activeSource.sourceSlot}:rack.${parameter.endpointID}`}
                    dragSourceAccent={dragSourceAccent}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onHudChange={onHudChange}
                    onRequestContextMenu={onRequestContextMenu}
                />
            ))}
        </>
    );
}

function FilterParameterList({
    routes,
    selectedTargetEndpointID,
    hoverTargetEndpointID,
    activeSource,
    sourceIsSelected,
    effectEnabled,
    pendingRouteKey,
    dragSourceAccent,
    onSelectTarget,
    onRecentParameter,
    onHudChange,
    onRequestContextMenu,
}: Omit<Parameters<typeof ParameterList>[0], "effectId">) {
    const descriptor = getRackEffectDescriptor("filter");
    const modeDescriptor = descriptor.parameters.find((parameter) => parameter.endpointID === "globalFilterMode")!;
    const modeBinding = useRackParameterBinding(modeDescriptor);
    const filterIsAudible = modeBinding.value >= 0.5;

    return (
        <>
            {descriptor.parameters.map((parameter) => (
                <RackParameterControl
                    key={parameter.endpointID}
                    descriptor={parameter}
                    routes={routes}
                    selected={selectedTargetEndpointID === parameter.endpointID}
                    activeSource={activeSource}
                    sourceIsSelected={sourceIsSelected}
                    effectEnabled={effectEnabled}
                    targetEffective={parameter.modulationTargetIndex === null || filterIsAudible}
                    pending={pendingRouteKey === `${activeSource.sourceKind}:${activeSource.sourceSlot}:rack.${parameter.endpointID}`}
                    dragSourceAccent={dragSourceAccent}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onHudChange={onHudChange}
                    onRequestContextMenu={onRequestContextMenu}
                />
            ))}
        </>
    );
}

function SyncParameterList({
    effectId,
    routes,
    selectedTargetEndpointID,
    hoverTargetEndpointID,
    activeSource,
    sourceIsSelected,
    effectEnabled,
    pendingRouteKey,
    dragSourceAccent,
    onSelectTarget,
    onRecentParameter,
    onHudChange,
    onRequestContextMenu,
}: {
    effectId: "phaser" | "delay";
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    effectEnabled: boolean;
    pendingRouteKey: string | null;
    dragSourceAccent: string | null;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const descriptor = getRackEffectDescriptor(effectId);
    const modeEndpointID = effectId === "phaser" ? "phaserRateMode" : "delayTimeMode";
    const freeEndpointID = effectId === "phaser" ? "phaserRate" : "delayTime";
    const divisionEndpointID = effectId === "phaser" ? "phaserRateDivision" : "delayDivision";
    const modeDescriptor = descriptor.parameters.find((parameter) => parameter.endpointID === modeEndpointID)!;
    const modeBinding = useRackParameterBinding(modeDescriptor);
    const syncMode = modeBinding.value >= 0.5;
    const visibleParameters = descriptor.parameters.filter((parameter) => {
        if (parameter.endpointID === freeEndpointID) {
            return !syncMode
                || selectedTargetEndpointID === freeEndpointID
                || routes.some((route) => isRouteForTarget(route, freeEndpointID));
        }
        if (parameter.endpointID === divisionEndpointID) {
            return syncMode;
        }
        return true;
    });

    return (
        <>
            {visibleParameters.map((parameter) => (
                <RackParameterControl
                    key={parameter.endpointID}
                    descriptor={parameter}
                    routes={routes}
                    selected={selectedTargetEndpointID === parameter.endpointID}
                    activeSource={activeSource}
                    sourceIsSelected={sourceIsSelected}
                    effectEnabled={effectEnabled}
                    targetEffective={parameter.endpointID !== freeEndpointID || !syncMode}
                    pending={pendingRouteKey === `${activeSource.sourceKind}:${activeSource.sourceSlot}:rack.${parameter.endpointID}`}
                    dragSourceAccent={dragSourceAccent}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onHudChange={onHudChange}
                    onRequestContextMenu={onRequestContextMenu}
                />
            ))}
        </>
    );
}

function ModSourceArt({ source }: { source: RackModulationSource }) {
    return (
        <span
            className="rack-mod-art"
            style={{ "--glyph-url": `url("${source.identityIconUrl}")` } as CSSProperties}
            aria-hidden="true"
        >
            <span data-role="rack-mod-glyph" className="rack-mod-glyph" />
            <span className="rack-mod-number">{source.sourceSlot}</span>
        </span>
    );
}

type ModSourceDragCallbacks = {
    readonly onHoverTarget: (source: SelectedSource, targetKind: ModulationTargetKind | null) => void;
    readonly onDragSourceChange: (source: SelectedSource | null) => void;
    readonly onSourceDragChange?: (drag: SourceDragPresentation | null) => void;
    readonly onSourceDrop: (
        source: SelectedSource,
        targetKind: ModulationTargetKind,
        companionKinds?: ReadonlyArray<ModulationTargetKind>,
    ) => void;
    readonly onTap: (source: SelectedSource, wasActiveSelection: boolean) => void;
    /**
     * T06: fired when the drag preview dwells on a `[data-drag-dwell]`
     * navigation surface. The drag stays alive; the consumer navigates.
     */
    readonly onDwellNavigate?: (dwellKey: string) => void;
};

/** Deliberate hover before a dwell navigation fires; transit stays inert. */
const MOD_SOURCE_DWELL_NAVIGATE_MS = 550;

function useModSourceDrag(callbacks: ModSourceDragCallbacks) {
    const handlersRef = useRef(callbacks);
    handlersRef.current = callbacks;
    const autoScrollRef = useRef<{
        clientY: number;
        frame: number | null;
        referenceElement: HTMLElement | null;
    }>({ clientY: 0, frame: null, referenceElement: null });
    const dragRef = useRef<{
        pointerId: number;
        pointerType: string;
        source: SelectedSource;
        moved: boolean;
        startX: number;
        startY: number;
        wasActiveSelection: boolean;
        captureElement: HTMLButtonElement;
        hoveredTarget: HTMLElement | null;
        lastPointerPoint: ClientPoint;
        lastDragPoint: ClientPoint;
        dwell: { key: string; timer: number } | null;
    } | null>(null);

    const clearDwellTracker = useCallback(() => {
        const drag = dragRef.current;
        if (drag?.dwell) {
            window.clearTimeout(drag.dwell.timer);
            drag.dwell = null;
        }
    }, []);

    const updateDwellTracker = useCallback((referenceElement: Element, dragPoint: ClientPoint) => {
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        const dwellKey = elementAtPointInRenderRoot(referenceElement, dragPoint.x, dragPoint.y)
            ?.closest<HTMLElement>("[data-drag-dwell]")
            ?.dataset.dragDwell ?? null;
        if ((drag.dwell?.key ?? null) === dwellKey) {
            return;
        }
        clearDwellTracker();
        if (dwellKey === null) {
            return;
        }
        const timer = window.setTimeout(() => {
            const activeDrag = dragRef.current;
            if (activeDrag?.dwell?.key !== dwellKey) {
                return;
            }
            handlersRef.current.onDwellNavigate?.(dwellKey);
        }, MOD_SOURCE_DWELL_NAVIGATE_MS);
        drag.dwell = { key: dwellKey, timer };
    }, [clearDwellTracker]);

    const updateHoveredTarget = useCallback((nextTarget: HTMLElement | null, source: SelectedSource) => {
        const drag = dragRef.current;
        if (!drag || drag.hoveredTarget === nextTarget) {
            return;
        }
        drag.hoveredTarget?.classList.remove("is-mod-hover");
        drag.hoveredTarget?.style.removeProperty("--drag-source-color");
        drag.hoveredTarget = nextTarget;
        if (nextTarget) {
            nextTarget.style.setProperty(
                "--drag-source-color",
                findRackModulationSource(source.sourceKind, source.sourceSlot).accent,
            );
            nextTarget.classList.add("is-mod-hover");
            if (drag.pointerType === "touch") {
                triggerLightHaptic();
            }
        }
    }, []);

    const stopSourceAutoScroll = useCallback(() => {
        if (autoScrollRef.current.frame !== null) {
            cancelAnimationFrame(autoScrollRef.current.frame);
        }
        autoScrollRef.current = { clientY: 0, frame: null, referenceElement: null };
    }, []);

    const runSourceAutoScroll = useCallback(() => {
        const state = autoScrollRef.current;
        const referenceElement = state.referenceElement;
        if (!referenceElement || dragRef.current === null) {
            stopSourceAutoScroll();
            return;
        }

        const renderRoot = referenceElement.getRootNode();
        const activePanel = (renderRoot instanceof Document || renderRoot instanceof ShadowRoot)
            ? renderRoot.querySelector<HTMLElement>('[data-role^="mobile-workspace-panel-"]:not([hidden])')
            : null;
        if (activePanel) {
            const bounds = activePanel.getBoundingClientRect();
            const edgeZone = Math.min(52, bounds.height * 0.18);
            const distanceFromTop = state.clientY - bounds.top;
            const distanceFromBottom = bounds.bottom - state.clientY;
            const topStrength = distanceFromTop < edgeZone
                ? clamp((edgeZone - Math.max(0, distanceFromTop)) / edgeZone, 0, 1)
                : 0;
            const bottomStrength = distanceFromBottom < edgeZone
                ? clamp((edgeZone - Math.max(0, distanceFromBottom)) / edgeZone, 0, 1)
                : 0;
            const delta = (bottomStrength - topStrength) * 7;
            if (Math.abs(delta) > 0.2) {
                activePanel.scrollTop += delta;
            }
        }

        autoScrollRef.current.frame = requestAnimationFrame(runSourceAutoScroll);
    }, [stopSourceAutoScroll]);

    const updateSourceAutoScroll = useCallback((referenceElement: HTMLElement, clientY: number) => {
        autoScrollRef.current.clientY = clientY;
        autoScrollRef.current.referenceElement = referenceElement;
        if (autoScrollRef.current.frame === null) {
            autoScrollRef.current.frame = requestAnimationFrame(runSourceAutoScroll);
        }
    }, [runSourceAutoScroll]);

    const finishSourceGesture = useCallback((
        pointerId: number,
        clientX: number,
        clientY: number,
        cancelled: boolean,
    ) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== pointerId) {
            return;
        }

        const pointerPoint = { x: clientX, y: clientY };
        const pointerStayedAtLastPoint = Math.hypot(
            pointerPoint.x - drag.lastPointerPoint.x,
            pointerPoint.y - drag.lastPointerPoint.y,
        ) <= 1;
        const dragPoint = pointerStayedAtLastPoint
            ? drag.lastDragPoint
            : resolveModSourceDragPoint(
                drag.captureElement,
                drag.pointerType,
                { x: drag.startX, y: drag.startY },
                drag.lastPointerPoint,
                drag.lastDragPoint,
                pointerPoint,
            );
        const target = cancelled
            ? null
            : pointerStayedAtLastPoint
                ? modulationTargetFromElement(drag.hoveredTarget)
                : resolveModulationTargetForDrag(
                    drag.captureElement,
                    dragPoint,
                    drag.lastDragPoint,
                    drag.hoveredTarget,
                );
        updateHoveredTarget(null, drag.source);
        clearDwellTracker();
        dragRef.current = null;
        handlersRef.current.onHoverTarget(drag.source, null);
        handlersRef.current.onDragSourceChange(null);
        handlersRef.current.onSourceDragChange?.(null);
        stopSourceAutoScroll();

        try {
            if (drag.captureElement.hasPointerCapture(pointerId)) {
                drag.captureElement.releasePointerCapture(pointerId);
            }
        } catch {
            // Pointer capture may already have been released by the browser.
        }

        if (cancelled) {
            return;
        }
        if (target) {
            handlersRef.current.onSourceDrop(drag.source, target.targetKind, target.companionKinds);
            return;
        }
        if (!drag.moved) {
            handlersRef.current.onTap(drag.source, drag.wasActiveSelection);
        }
    }, [clearDwellTracker, stopSourceAutoScroll, updateHoveredTarget]);

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, false);
        };
        const handlePointerCancel = (event: PointerEvent) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
        };
        const cancelActiveGesture = () => {
            const drag = dragRef.current;
            if (drag) {
                finishSourceGesture(drag.pointerId, drag.startX, drag.startY, true);
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelActiveGesture();
            }
        };

        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", cancelActiveGesture);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", cancelActiveGesture);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActiveGesture();
            stopSourceAutoScroll();
        };
    }, [finishSourceGesture, stopSourceAutoScroll]);

    return useCallback((source: SelectedSource, wasActiveSelection: boolean) => ({
        onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (event.pointerType === "mouse" && event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            handlersRef.current.onDragSourceChange(source);
            dragRef.current = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                source,
                moved: false,
                startX: event.clientX,
                startY: event.clientY,
                wasActiveSelection,
                captureElement: event.currentTarget,
                hoveredTarget: null,
                lastPointerPoint: { x: event.clientX, y: event.clientY },
                lastDragPoint: { x: event.clientX, y: event.clientY },
                dwell: null,
            };
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Window-level termination still owns unsupported or synthetic pointers.
            }
        },
        onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (hasReleasedMouseButton(event)) {
                finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
                return;
            }
            drag.moved ||= modSourceDragHasActivated(
                { x: drag.startX, y: drag.startY },
                { x: event.clientX, y: event.clientY },
            );
            if (drag.moved) {
                const dragPoint = resolveModSourceDragPoint(
                    event.currentTarget,
                    drag.pointerType,
                    { x: drag.startX, y: drag.startY },
                    drag.lastPointerPoint,
                    drag.lastDragPoint,
                    { x: event.clientX, y: event.clientY },
                );
                const target = resolveModulationTargetForDrag(
                    event.currentTarget,
                    dragPoint,
                    drag.lastDragPoint,
                    drag.hoveredTarget,
                );
                drag.lastPointerPoint = { x: event.clientX, y: event.clientY };
                drag.lastDragPoint = dragPoint;
                handlersRef.current.onSourceDragChange?.({
                    source: drag.source,
                    clientX: dragPoint.x,
                    clientY: dragPoint.y,
                    targetCaptured: target !== null,
                });
                updateSourceAutoScroll(event.currentTarget, dragPoint.y);
                updateHoveredTarget(target?.element ?? null, drag.source);
                updateDwellTracker(event.currentTarget, dragPoint);
                handlersRef.current.onHoverTarget(drag.source, target?.targetKind ?? null);
                return;
            }
            const target = modulationTargetAtPoint(event.currentTarget, event.clientX, event.clientY);
            updateHoveredTarget(target?.element ?? null, drag.source);
            handlersRef.current.onHoverTarget(drag.source, target?.targetKind ?? null);
        },
        onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, false);
        },
        onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
        },
        onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
        },
    }), [finishSourceGesture, updateDwellTracker, updateHoveredTarget, updateSourceAutoScroll]);
}

function ModSourceCarousel({
    pageIndex,
    selectedSource,
    sourceIsArmed,
    orientation = "horizontal",
    onPageChange,
    onDragSourceChange,
    onSourceSelect,
    onSourceDrop,
    onOpenSelectedSource,
    onHoverTarget,
    onSourceDragChange,
    onDwellNavigate,
}: {
    pageIndex: number;
    selectedSource: SelectedSource;
    sourceIsArmed: boolean;
    orientation?: "horizontal" | "vertical";
    onPageChange: (pageIndex: number) => void;
    onDragSourceChange: (source: SelectedSource | null) => void;
    onSourceSelect: (source: SelectedSource) => void;
    onSourceDrop: (
        source: SelectedSource,
        targetKind: ModulationTargetKind,
        companionKinds?: ReadonlyArray<ModulationTargetKind>,
    ) => void;
    onOpenSelectedSource: (source: SelectedSource) => void;
    onHoverTarget: (source: SelectedSource, targetKind: ModulationTargetKind | null) => void;
    onSourceDragChange?: (drag: SourceDragPresentation | null) => void;
    onDwellNavigate?: (dwellKey: string) => void;
}) {
    const armedSourceLabel = sourceIsArmed
        ? findRackModulationSource(selectedSource.sourceKind, selectedSource.sourceSlot).label
        : null;
    const sourceHandlers = useModSourceDrag({
        onHoverTarget,
        onDragSourceChange,
        onSourceDrop,
        onSourceDragChange,
        onDwellNavigate,
        onTap: (source, wasActiveSelection) => {
            if (wasActiveSelection) {
                onOpenSelectedSource(source);
            } else {
                onSourceSelect(source);
            }
        },
    });
    const vertical = orientation === "vertical";

    return (
        <div className={`rack-mod-dock${vertical ? " is-vertical" : ""}`} role="group" aria-label="Rack modulation sources">
            <header className="rack-mod-header">
                <strong>MOD BAR{armedSourceLabel === null ? "" : ` · ${armedSourceLabel}`}</strong>
                <span>GROUP {pageIndex + 1} / {RACK_MODULATION_SOURCE_PAGES.length}</span>
            </header>
            <div className="rack-mod-row">
                <button
                    type="button"
                    className="rack-mod-paddle"
                    aria-label="Previous modulation-source group"
                    onClick={() => onPageChange((pageIndex + RACK_MODULATION_SOURCE_PAGES.length - 1) % RACK_MODULATION_SOURCE_PAGES.length)}
                >
                    <span
                        className="rack-mod-chevron"
                        data-direction={vertical ? "up" : "left"}
                        aria-hidden="true"
                    />
                </button>
                <div className="rack-mod-viewport">
                    <div
                        className="rack-mod-track"
                        data-role="rack-mod-source-track"
                        style={{
                            transform: vertical
                                ? `translateY(-${pageIndex * 100}%)`
                                : `translateX(-${pageIndex * 100}%)`,
                            transitionDuration: "280ms",
                        }}
                    >
                        {RACK_MODULATION_SOURCE_PAGES.map((page, candidatePageIndex) => (
                            <div className="rack-mod-page" key={candidatePageIndex} aria-hidden={candidatePageIndex !== pageIndex}>
                                {page.map((source) => {
                                    const isSelected = sourceIsArmed
                                        && source.sourceKind === selectedSource.sourceKind
                                        && source.sourceSlot === selectedSource.sourceSlot;
                                    return (
                                        <button
                                            key={`${source.sourceKind}-${source.sourceSlot}`}
                                            type="button"
                                            data-role={`rack-mod-source-${source.sourceKind}-${source.sourceSlot}`}
                                            aria-label={source.label}
                                            aria-pressed={isSelected}
                                            className={`rack-mod-source${isSelected ? " is-selected" : ""}`}
                                            style={{ "--source-color": source.accent } as CSSProperties}
                                            tabIndex={candidatePageIndex === pageIndex ? 0 : -1}
                                            {...sourceHandlers(source, isSelected && sourceIsArmed)}
                                        >
                                            <ModSourceArt source={source} />
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    className="rack-mod-paddle"
                    aria-label="Next modulation-source group"
                    onClick={() => onPageChange((pageIndex + 1) % RACK_MODULATION_SOURCE_PAGES.length)}
                >
                    <span
                        className="rack-mod-chevron"
                        data-direction={vertical ? "down" : "right"}
                        aria-hidden="true"
                    />
                </button>
            </div>
        </div>
    );
}

type HudRect = {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
};

type HudPlacementSide = "above" | "below" | "start" | "end";

const HUD_VIEWPORT_MARGIN_PX = 4;
const HUD_ANCHOR_GAP_PX = 14;
const HUD_FINGER_CLEARANCE_PX = 48;

function inflateHudRect(rect: HudRect, amount: number): HudRect {
    return {
        left: rect.left - amount,
        top: rect.top - amount,
        right: rect.right + amount,
        bottom: rect.bottom + amount,
    };
}

function hudRectsIntersect(a: HudRect, b: HudRect) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function boundingHudRect(element: Element | null): HudRect | null {
    if (!element) {
        return null;
    }
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
        return null;
    }
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
}

export function RackParameterHudOverlay({ hud }: { hud: RackParameterHud }) {
    const elementRef = useRef<HTMLDivElement | null>(null);
    const stickyRef = useRef<{ gestureKey: string; side: HudPlacementSide | "dock" } | null>(null);
    const [offset, setOffset] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        const element = elementRef.current;
        const host = element?.parentElement;
        if (!element || !host) {
            return;
        }

        const hudWidth = element.offsetWidth;
        const hudHeight = element.offsetHeight;
        const hostBounds = host.getBoundingClientRect();
        const viewport: HudRect = {
            left: HUD_VIEWPORT_MARGIN_PX,
            top: HUD_VIEWPORT_MARGIN_PX,
            right: window.innerWidth - HUD_VIEWPORT_MARGIN_PX,
            bottom: window.innerHeight - HUD_VIEWPORT_MARGIN_PX,
        };
        const exclusions: HudRect[] = [
            inflateHudRect(hud.anchor, 6),
            {
                left: hud.pointer.x - HUD_FINGER_CLEARANCE_PX,
                top: hud.pointer.y - HUD_FINGER_CLEARANCE_PX,
                right: hud.pointer.x + HUD_FINGER_CLEARANCE_PX,
                bottom: hud.pointer.y + HUD_FINGER_CLEARANCE_PX,
            },
        ];
        const railBounds = boundingHudRect(document.querySelector('[data-role="mobile-global-mod-rail"]'));
        if (railBounds) {
            exclusions.push(inflateHudRect(railBounds, 4));
        }
        const keyboardBounds = boundingHudRect(document.querySelector('[data-role="sticky-keyboard"]'));
        if (keyboardBounds) {
            exclusions.push(keyboardBounds);
        }

        const anchorCenterX = (hud.anchor.left + hud.anchor.right) / 2;
        const anchorCenterY = (hud.anchor.top + hud.anchor.bottom) / 2;
        const clampLeft = (left: number) => Math.min(Math.max(left, viewport.left), viewport.right - hudWidth);
        const clampTop = (top: number) => Math.min(Math.max(top, viewport.top), viewport.bottom - hudHeight);
        const placementRect = (side: HudPlacementSide): HudRect => {
            const left = side === "start"
                ? hud.anchor.left - HUD_ANCHOR_GAP_PX - hudWidth
                : side === "end"
                    ? hud.anchor.right + HUD_ANCHOR_GAP_PX
                    : clampLeft(anchorCenterX - (hudWidth / 2));
            const top = side === "above"
                ? hud.anchor.top - HUD_ANCHOR_GAP_PX - hudHeight
                : side === "below"
                    ? hud.anchor.bottom + HUD_ANCHOR_GAP_PX
                    : clampTop(anchorCenterY - (hudHeight / 2));
            return { left, top, right: left + hudWidth, bottom: top + hudHeight };
        };
        const rectIsClear = (rect: HudRect) => (
            rect.left >= viewport.left
            && rect.top >= viewport.top
            && rect.right <= viewport.right
            && rect.bottom <= viewport.bottom
            && exclusions.every((exclusion) => !hudRectsIntersect(rect, exclusion))
        );
        const dockRect = (): HudRect | null => {
            const dockTop = Math.max(viewport.top, hostBounds.top + 6);
            const dockLefts = [
                clampLeft(((hostBounds.left + hostBounds.right) / 2) - (hudWidth / 2)),
                ...(railBounds ? [clampLeft(railBounds.left - HUD_ANCHOR_GAP_PX - hudWidth)] : []),
                clampLeft(hostBounds.left + 6),
            ];
            for (const left of dockLefts) {
                const rect = { left, top: dockTop, right: left + hudWidth, bottom: dockTop + hudHeight };
                if (rectIsClear(rect)) {
                    return rect;
                }
            }
            return null;
        };

        const sideOrder: HudPlacementSide[] = hud.mode === "modulation"
            ? ["above", "below", "start", "end"]
            : ["start", "end", "above", "below"];
        const gestureKey = `${hud.endpointID}:${hud.mode}`;
        const sticky = stickyRef.current;
        let chosenSide: HudPlacementSide | "dock" = "dock";
        let chosenRect: HudRect | null = null;

        if (sticky?.gestureKey === gestureKey) {
            const stickyRect = sticky.side === "dock" ? dockRect() : placementRect(sticky.side);
            if (stickyRect && (sticky.side === "dock" || rectIsClear(stickyRect))) {
                chosenSide = sticky.side;
                chosenRect = stickyRect;
            }
        }
        if (!chosenRect) {
            for (const side of sideOrder) {
                const rect = placementRect(side);
                if (rectIsClear(rect)) {
                    chosenSide = side;
                    chosenRect = rect;
                    break;
                }
            }
        }
        chosenRect ??= dockRect();
        if (!chosenRect) {
            const left = clampLeft(hostBounds.left + 6);
            const top = Math.max(viewport.top, hostBounds.top + 6);
            chosenRect = { left, top, right: left + hudWidth, bottom: top + hudHeight };
        }

        stickyRef.current = { gestureKey, side: chosenSide };
        setOffset({
            left: chosenRect.left - hostBounds.left,
            top: chosenRect.top - hostBounds.top,
        });
    }, [hud]);

    return (
        <div
            ref={elementRef}
            data-role="rack-parameter-hud"
            data-mode={hud.mode}
            className="rack-parameter-hud"
            aria-live="polite"
            style={offset ? { left: offset.left, top: offset.top } : { visibility: "hidden" }}
        >
            <span>{hud.label}</span>
            <strong>{hud.value}</strong>
        </div>
    );
}

const MOBILE_MOD_RAIL_POSITION_KEY = "cosimo.mobile-global-mod-rail.position.v1";
const MOBILE_MOD_RAIL_DRAG_THRESHOLD_PX = 7;
const MOBILE_MOD_RAIL_SNAP_DISTANCE_PX = 28;
const MOBILE_MOD_RAIL_DRAWER_FALLBACK_HEIGHT_PX = 234;
const MOBILE_MOD_RAIL_VELOCITY_WINDOW_MS = 100;
const MOBILE_MOD_RAIL_MIN_RELEASE_VELOCITY_PX_PER_MS = 0.08;
const MOBILE_MOD_RAIL_MAX_RELEASE_VELOCITY_PX_PER_MS = 1.35;
const MOBILE_MOD_RAIL_STOP_VELOCITY_PX_PER_MS = 0.02;
// UIScrollView.DecelerationRate.fast is 0.99. Treating that value as a
// millisecond decay gives this short rail speed-sensitive travel without the
// long coast that feels right for a full scroll view.
const MOBILE_MOD_RAIL_DECELERATION_RATE_PER_MS = 0.99;
const MOBILE_MOD_RAIL_WIDTH_PX = 40;
const MOBILE_MOD_RAIL_SHOULDER_PX = 12;
const MOBILE_MOD_RAIL_CORNER_PX = 12;
const MOBILE_MOD_RAIL_TAB_CONTENT_HEIGHT_PX = 128;
const MOBILE_MOD_RAIL_SETTLE_X_MS = 220;
const MOBILE_MOD_RAIL_DEFAULT_DOCK: RailDock = { edge: "right", normalizedY: 0.42 };

type RailMotionSample = {
    readonly clientY: number;
    readonly timeStamp: number;
};

function appendRailMotionSample(samples: RailMotionSample[], clientY: number, timeStamp: number) {
    const previousTimeStamp = samples.at(-1)?.timeStamp ?? timeStamp;
    const nextTimeStamp = Number.isFinite(timeStamp)
        ? Math.max(previousTimeStamp, timeStamp)
        : previousTimeStamp;
    samples.push({ clientY, timeStamp: nextTimeStamp });

    const cutoff = nextTimeStamp - MOBILE_MOD_RAIL_VELOCITY_WINDOW_MS;
    // Retain one sample immediately before the window so a slow, continuous
    // release still has a useful velocity baseline.
    while (samples.length > 2) {
        const nextOldest = samples[1];
        if (!nextOldest || nextOldest.timeStamp >= cutoff) {
            break;
        }
        samples.shift();
    }
}

function railReleaseVelocity(samples: readonly RailMotionSample[], releaseTimeStamp: number) {
    const last = samples.at(-1);
    if (!last) {
        return 0;
    }

    const releaseTime = Number.isFinite(releaseTimeStamp)
        ? Math.max(last.timeStamp, releaseTimeStamp)
        : last.timeStamp;
    const cutoff = releaseTime - MOBILE_MOD_RAIL_VELOCITY_WINDOW_MS;
    let first = samples[0] ?? last;
    for (const sample of samples) {
        if (sample.timeStamp > cutoff) {
            break;
        }
        first = sample;
    }

    const elapsed = releaseTime - first.timeStamp;
    if (elapsed <= 0) {
        return 0;
    }
    return (last.clientY - first.clientY) / elapsed;
}

function prefersReducedRailMotion() {
    return typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function triggerLightHaptic() {
    try {
        (globalThis as { cmaj_triggerHaptic?: (style?: string) => unknown })
            .cmaj_triggerHaptic?.("light");
    } catch {
        // Haptics are progressive enhancement; interaction cannot depend on them.
    }
}

function MobileGlobalModRail({
    selectedSource,
    routeCount,
    sourceActivity,
    sourceDrag,
    accent,
    collapseSignal,
    autoPreviewEnabled,
    keyboardVisible,
    onStateChange,
    onDragSourceChange,
    onSourceDrop,
    onHoverTarget,
    onSourceDragChange,
    onNoteKeyDown,
    onNoteKeyUp,
    onToggleAutoPreview,
    onToggleKeyboard,
    voiceSettings,
    onDwellNavigate,
    children,
}: {
    selectedSource: RackModulationSource;
    routeCount: number;
    sourceActivity: number | null;
    sourceDrag: SourceDragPresentation | null;
    accent: string;
    collapseSignal: number;
    autoPreviewEnabled: boolean;
    keyboardVisible: boolean;
    onStateChange?: (state: GlobalModRailState) => void;
    onDragSourceChange: (source: SelectedSource | null) => void;
    onSourceDrop: (
        source: SelectedSource,
        targetKind: ModulationTargetKind,
        companionKinds?: ReadonlyArray<ModulationTargetKind>,
    ) => void;
    onHoverTarget: (source: SelectedSource, targetKind: ModulationTargetKind | null) => void;
    onSourceDragChange: (drag: SourceDragPresentation | null) => void;
    onNoteKeyDown: () => void;
    onNoteKeyUp: () => void;
    onToggleAutoPreview: () => void;
    onToggleKeyboard: () => void;
    voiceSettings: ModRailVoiceSettings;
    onDwellNavigate: (dwellKey: string) => void;
    children: React.ReactNode;
}) {
    const layerRef = useRef<HTMLDivElement | null>(null);
    const railRef = useRef<HTMLElement | null>(null);
    const tabRef = useRef<HTMLDivElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const positionRef = useRef(0);
    const normalizedPositionRef = useRef<number | null>(null);
    const boundsRef = useRef<RailVerticalBounds>({ min: 12, max: 12 });
    const layerWidthRef = useRef(0);
    const edgeRef = useRef<RailEdge>(MOBILE_MOD_RAIL_DEFAULT_DOCK.edge);
    const dockInitializedRef = useRef(false);
    const dragXRef = useRef(0);
    const settleXTimeoutRef = useRef<number | null>(null);
    const noteKeyPointerRef = useRef<number | null>(null);
    const drawerMetricsRef = useRef<RailDrawerMetrics>({
        safeTop: 12,
        safeBottom: 12,
        collapsedHeight: MOBILE_MOD_RAIL_TAB_CONTENT_HEIGHT_PX + (2 * MOBILE_MOD_RAIL_SHOULDER_PX),
        desiredHeight: MOBILE_MOD_RAIL_DRAWER_FALLBACK_HEIGHT_PX,
    });
    const decelerationFrameRef = useRef<number | null>(null);
    const gestureRef = useRef<{
        pointerId: number;
        startClientX: number;
        startClientY: number;
        lastClientX: number;
        startNormalizedY: number;
        startTop: number;
        startEdge: RailEdge;
        moved: boolean;
        interruptedDeceleration: boolean;
        motionSamples: RailMotionSample[];
        captureElement: HTMLButtonElement;
    } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [top, setTop] = useState(12);
    const [edge, setEdge] = useState<RailEdge>(MOBILE_MOD_RAIL_DEFAULT_DOCK.edge);
    const [dragX, setDragX] = useState(0);
    const [settlingX, setSettlingX] = useState(false);
    const [decelerating, setDecelerating] = useState(false);
    const [noteHeld, setNoteHeld] = useState(false);
    const [drawerPlacement, setDrawerPlacement] = useState<RailDrawerPlacement>({
        direction: "down",
        extent: MOBILE_MOD_RAIL_DRAWER_FALLBACK_HEIGHT_PX,
    });
    const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
    const voicePopoverRef = useRef<HTMLDivElement | null>(null);
    const voiceToggleRef = useRef<HTMLButtonElement | null>(null);
    const silhouetteGradientId = `mobile-mod-rail-fill-${useId().replaceAll(":", "")}`;
    const mappingActive = sourceDrag !== null;
    const selectedSourceHandlers = useModSourceDrag({
        onHoverTarget,
        onDragSourceChange,
        onSourceDrop,
        onSourceDragChange,
        onDwellNavigate,
        onTap: () => setExpanded((current) => !current),
    });

    const applyDragX = useCallback((nextDragX: number) => {
        dragXRef.current = nextDragX;
        setDragX(nextDragX);
    }, []);

    const updateDrawerPlacement = useCallback((nextTop: number) => {
        setDrawerPlacement(projectRailDrawerPlacement(nextTop, drawerMetricsRef.current));
    }, []);

    // The voice-settings popover belongs to the open drawer; whatever hides
    // the drawer (collapse, mapping drag) takes the popover with it.
    useEffect(() => {
        if (!expanded || mappingActive) {
            setVoiceSettingsOpen(false);
        }
    }, [expanded, mappingActive]);

    useEffect(() => {
        if (!voiceSettingsOpen) {
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (voicePopoverRef.current?.contains(target) || voiceToggleRef.current?.contains(target)) {
                return;
            }
            setVoiceSettingsOpen(false);
        };
        window.addEventListener("pointerdown", handlePointerDown, true);
        return () => window.removeEventListener("pointerdown", handlePointerDown, true);
    }, [voiceSettingsOpen]);

    const measureAndClamp = useCallback(() => {
        const layer = layerRef.current;
        const rail = railRef.current;
        if (!layer || !rail || gestureRef.current !== null || decelerationFrameRef.current !== null) {
            return;
        }

        const layerBounds = layer.getBoundingClientRect();
        const layerStyle = getComputedStyle(layer);
        layerWidthRef.current = layerBounds.width;
        const surface = layer.closest(".cosimo-surface");
        const keyboard = surface?.querySelector<HTMLElement>('[data-role="sticky-keyboard"]');
        const workspaceTabs = surface?.querySelector<HTMLElement>('[data-role="mobile-workspace-tabs"]');
        const presetBar = surface?.querySelector<HTMLElement>('[data-role="synth-preset-bar-host"]');
        const measuredKeyboardBounds = keyboard?.getBoundingClientRect();
        // A hidden keyboard (display: none) measures 0x0 at the origin and must
        // not collapse the rail's travel band.
        const keyboardBounds = measuredKeyboardBounds && measuredKeyboardBounds.height > 0
            ? measuredKeyboardBounds
            : undefined;
        // The tab row's top edge is the rail's lowest usable boundary
        // (ADR-026): with the keyboard hidden, the tabs dock at the bottom and
        // become the binding constraint.
        const measuredTabsBounds = workspaceTabs?.getBoundingClientRect();
        const tabsBounds = measuredTabsBounds && measuredTabsBounds.height > 0
            ? measuredTabsBounds
            : undefined;
        const presetBarBounds = presetBar?.getBoundingClientRect();
        const safeTopInset = 8 + (Number.parseFloat(layerStyle.paddingTop) || 0);
        const safeTop = presetBarBounds
            ? Math.max(safeTopInset, presetBarBounds.bottom - layerBounds.top + 8)
            : safeTopInset;
        const safeBottom = 8 + (Number.parseFloat(layerStyle.paddingBottom) || 0);
        const chromeTop = Math.min(
            keyboardBounds ? keyboardBounds.top : Number.POSITIVE_INFINITY,
            tabsBounds ? tabsBounds.top : Number.POSITIVE_INFINITY,
        );
        const availableBottom = Number.isFinite(chromeTop)
            ? Math.min(layerBounds.height, chromeTop - layerBounds.top)
            : layerBounds.height;
        const railStyle = getComputedStyle(rail);
        const shoulderHeight = Number.parseFloat(railStyle.getPropertyValue("--rail-shoulder"))
            || MOBILE_MOD_RAIL_SHOULDER_PX;
        const tabHeight = tabRef.current?.getBoundingClientRect().height
            || MOBILE_MOD_RAIL_TAB_CONTENT_HEIGHT_PX;
        const railHeight = tabHeight + (2 * shoulderHeight);
        const nextBounds = railVerticalBounds(
            { height: availableBottom, insetTop: safeTop, insetBottom: safeBottom },
            railHeight,
        );
        boundsRef.current = nextBounds;
        const drawerHeight = drawerRef.current?.scrollHeight || MOBILE_MOD_RAIL_DRAWER_FALLBACK_HEIGHT_PX;
        drawerMetricsRef.current = {
            safeTop,
            safeBottom: availableBottom - safeBottom,
            collapsedHeight: railHeight,
            desiredHeight: drawerHeight,
        };

        if (!dockInitializedRef.current) {
            dockInitializedRef.current = true;
            let storedDock: RailDock | null = null;
            try {
                storedDock = parseStoredRailDock(localStorage.getItem(MOBILE_MOD_RAIL_POSITION_KEY));
            } catch {
                storedDock = null;
            }
            const dock = storedDock ?? MOBILE_MOD_RAIL_DEFAULT_DOCK;
            edgeRef.current = dock.edge;
            setEdge(dock.edge);
            normalizedPositionRef.current = dock.normalizedY;
        }
        normalizedPositionRef.current ??= MOBILE_MOD_RAIL_DEFAULT_DOCK.normalizedY;
        const nextTop = projectRailTop(normalizedPositionRef.current, nextBounds);
        positionRef.current = nextTop;
        setTop(nextTop);
        updateDrawerPlacement(nextTop);
    }, [updateDrawerPlacement]);

    useLayoutEffect(() => {
        measureAndClamp();
        const layer = layerRef.current;
        const surface = layer?.closest(".cosimo-surface");
        const keyboard = surface?.querySelector<HTMLElement>('[data-role="sticky-keyboard"]');
        const workspaceTabs = surface?.querySelector<HTMLElement>('[data-role="mobile-workspace-tabs"]');
        const presetBar = surface?.querySelector<HTMLElement>('[data-role="synth-preset-bar-host"]');
        const observer = typeof ResizeObserver === "function"
            ? new ResizeObserver(measureAndClamp)
            : null;
        if (layer) {
            observer?.observe(layer);
        }
        if (tabRef.current) {
            observer?.observe(tabRef.current);
        }
        if (drawerRef.current) {
            observer?.observe(drawerRef.current);
        }
        if (keyboard) {
            observer?.observe(keyboard);
        }
        if (workspaceTabs) {
            observer?.observe(workspaceTabs);
        }
        if (presetBar) {
            observer?.observe(presetBar);
        }
        window.addEventListener("resize", measureAndClamp);
        window.visualViewport?.addEventListener("resize", measureAndClamp);
        window.visualViewport?.addEventListener("scroll", measureAndClamp);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", measureAndClamp);
            window.visualViewport?.removeEventListener("resize", measureAndClamp);
            window.visualViewport?.removeEventListener("scroll", measureAndClamp);
        };
    }, [measureAndClamp]);

    useEffect(() => {
        onStateChange?.({
            expanded,
            selectedSource: {
                sourceKind: selectedSource.sourceKind,
                sourceSlot: selectedSource.sourceSlot,
            },
        });
    }, [expanded, onStateChange, selectedSource.sourceKind, selectedSource.sourceSlot]);

    useEffect(() => {
        // A source deep-link navigates into that source's full editor; collapse
        // the drawer so it cannot cover the destination's Back bar.
        if (collapseSignal > 0) {
            setExpanded(false);
        }
    }, [collapseSignal]);

    useEffect(() => {
        const surface = layerRef.current?.closest(".cosimo-surface");
        const previousSourceColor = surface instanceof HTMLElement
            ? surface.style.getPropertyValue("--active-source-color")
            : "";
        surface?.classList.toggle("is-mod-source-mapping", mappingActive);
        if (surface instanceof HTMLElement && mappingActive) {
            surface.style.setProperty("--active-source-color", selectedSource.accent);
        }
        return () => {
            surface?.classList.remove("is-mod-source-mapping");
            if (surface instanceof HTMLElement) {
                if (previousSourceColor) {
                    surface.style.setProperty("--active-source-color", previousSourceColor);
                } else {
                    surface.style.removeProperty("--active-source-color");
                }
            }
        };
    }, [mappingActive, selectedSource.accent]);

    const persistRailDock = useCallback((nextTop: number) => {
        const normalizedY = normalizeRailTop(nextTop, boundsRef.current);
        normalizedPositionRef.current = normalizedY;
        try {
            localStorage.setItem(
                MOBILE_MOD_RAIL_POSITION_KEY,
                serializeRailDock({ edge: edgeRef.current, normalizedY }),
            );
        } catch {
            // A private browsing storage failure must not break rail movement.
        }
    }, []);

    const settleRailPosition = useCallback((unsettledTop: number) => {
        const bounds = boundsRef.current;
        const clampedTop = clamp(unsettledTop, bounds.min, bounds.max);
        const { top: settledTop } = snapRailTop(clampedTop, bounds, MOBILE_MOD_RAIL_SNAP_DISTANCE_PX);
        if (settledTop !== clampedTop) {
            triggerLightHaptic();
        }
        positionRef.current = settledTop;
        setTop(settledTop);
        updateDrawerPlacement(settledTop);
        persistRailDock(settledTop);
    }, [persistRailDock, updateDrawerPlacement]);

    const stopRailDeceleration = useCallback(() => {
        const frameID = decelerationFrameRef.current;
        if (frameID === null) {
            return false;
        }
        cancelAnimationFrame(frameID);
        decelerationFrameRef.current = null;
        setDecelerating(false);
        return true;
    }, []);

    const startRailDeceleration = useCallback((rawReleaseVelocity: number) => {
        const releaseVelocity = clamp(
            rawReleaseVelocity,
            -MOBILE_MOD_RAIL_MAX_RELEASE_VELOCITY_PX_PER_MS,
            MOBILE_MOD_RAIL_MAX_RELEASE_VELOCITY_PX_PER_MS,
        );
        if (Math.abs(releaseVelocity) < MOBILE_MOD_RAIL_MIN_RELEASE_VELOCITY_PX_PER_MS) {
            return false;
        }

        let velocity = releaseVelocity;
        let previousTimeStamp = performance.now();
        const decayLog = -Math.log(MOBILE_MOD_RAIL_DECELERATION_RATE_PER_MS);
        setDecelerating(true);

        const step = (timeStamp: number) => {
            decelerationFrameRef.current = null;
            // Use the full frame gap. Exponential integration is stable for a
            // long interval and must catch up after main-thread jank instead of
            // stretching a short coast into slow motion.
            const elapsed = Math.max(0, timeStamp - previousTimeStamp);
            previousTimeStamp = timeStamp;
            const attenuation = MOBILE_MOD_RAIL_DECELERATION_RATE_PER_MS ** elapsed;
            const nextVelocity = velocity * attenuation;
            const displacement = decayLog > 0 ? (velocity - nextVelocity) / decayLog : 0;
            const bounds = boundsRef.current;
            const projectedTop = positionRef.current + displacement;
            const nextTop = clamp(projectedTop, bounds.min, bounds.max);
            const reachedBound = nextTop !== projectedTop;

            positionRef.current = nextTop;
            normalizedPositionRef.current = normalizeRailTop(nextTop, bounds);
            setTop(nextTop);
            updateDrawerPlacement(nextTop);

            if (reachedBound || Math.abs(nextVelocity) <= MOBILE_MOD_RAIL_STOP_VELOCITY_PX_PER_MS) {
                setDecelerating(false);
                settleRailPosition(nextTop);
                return;
            }

            velocity = nextVelocity;
            decelerationFrameRef.current = requestAnimationFrame(step);
        };

        decelerationFrameRef.current = requestAnimationFrame(step);
        return true;
    }, [settleRailPosition, updateDrawerPlacement]);

    const settleDragXHome = useCallback(() => {
        // Paint the compensated offset first, then glide the bar flush against
        // its edge (FLIP): the double frame guarantees the pre-transition
        // position reaches the compositor before the transition arms.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setSettlingX(true);
                applyDragX(0);
                if (settleXTimeoutRef.current !== null) {
                    window.clearTimeout(settleXTimeoutRef.current);
                }
                settleXTimeoutRef.current = window.setTimeout(() => {
                    settleXTimeoutRef.current = null;
                    setSettlingX(false);
                }, MOBILE_MOD_RAIL_SETTLE_X_MS);
            });
        });
    }, [applyDragX]);

    const finishRailGesture = useCallback((
        pointerId: number,
        cancelled: boolean,
        releaseTimeStamp = performance.now(),
    ) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== pointerId) {
            return;
        }
        gestureRef.current = null;
        try {
            if (gesture.captureElement.hasPointerCapture(pointerId)) {
                gesture.captureElement.releasePointerCapture(pointerId);
            }
        } catch {
            // Window listeners remain authoritative after platform capture loss.
        }

        if (cancelled) {
            stopRailDeceleration();
            normalizedPositionRef.current = gesture.startNormalizedY;
            positionRef.current = gesture.startTop;
            setTop(gesture.startTop);
            updateDrawerPlacement(gesture.startTop);
            edgeRef.current = gesture.startEdge;
            setEdge(gesture.startEdge);
            setSettlingX(false);
            applyDragX(0);
            return;
        }
        if (!gesture.moved) {
            if (!gesture.interruptedDeceleration) {
                setExpanded((current) => !current);
            }
            return;
        }

        // Horizontal settle: the nearest screen edge wins and the bar glides
        // flush against it from wherever the finger left it.
        const layerWidth = layerWidthRef.current;
        const currentEdge = edgeRef.current;
        const nextEdge = settleRailEdge(gesture.lastClientX, layerWidth, currentEdge);
        if (nextEdge !== currentEdge) {
            const edgeSpan = Math.max(0, layerWidth - MOBILE_MOD_RAIL_WIDTH_PX);
            edgeRef.current = nextEdge;
            setEdge(nextEdge);
            applyDragX(nextEdge === "left"
                ? dragXRef.current + edgeSpan
                : dragXRef.current - edgeSpan);
        }
        settleDragXHome();

        const releaseVelocity = railReleaseVelocity(gesture.motionSamples, releaseTimeStamp);
        if (
            prefersReducedRailMotion()
            || !startRailDeceleration(releaseVelocity)
        ) {
            settleRailPosition(positionRef.current);
        }
    }, [applyDragX, settleDragXHome, settleRailPosition, startRailDeceleration, stopRailDeceleration, updateDrawerPlacement]);

    const releaseNoteKey = useCallback((pointerId: number) => {
        if (noteKeyPointerRef.current !== pointerId) {
            return;
        }
        noteKeyPointerRef.current = null;
        setNoteHeld(false);
        onNoteKeyUp();
    }, [onNoteKeyUp]);

    const abortNoteKey = useCallback(() => {
        if (noteKeyPointerRef.current === null) {
            return;
        }
        noteKeyPointerRef.current = null;
        setNoteHeld(false);
        onNoteKeyUp();
    }, [onNoteKeyUp]);

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => {
            finishRailGesture(event.pointerId, false, event.timeStamp);
            releaseNoteKey(event.pointerId);
        };
        const handlePointerCancel = (event: PointerEvent) => {
            finishRailGesture(event.pointerId, true, event.timeStamp);
            releaseNoteKey(event.pointerId);
        };
        const cancelActiveInteraction = () => {
            const gesture = gestureRef.current;
            if (gesture) {
                finishRailGesture(gesture.pointerId, true);
            }
            if (stopRailDeceleration()) {
                settleRailPosition(positionRef.current);
            }
            abortNoteKey();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelActiveInteraction();
            }
        };
        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", cancelActiveInteraction);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", cancelActiveInteraction);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActiveInteraction();
            if (settleXTimeoutRef.current !== null) {
                window.clearTimeout(settleXTimeoutRef.current);
                settleXTimeoutRef.current = null;
            }
        };
    }, [abortNoteKey, finishRailGesture, releaseNoteKey, settleRailPosition, stopRailDeceleration]);

    const clampedActivity = sourceActivity === null ? null : clamp(sourceActivity, 0, 1);
    const drawerOpen = expanded && !mappingActive;
    const activePlayMode = VOICE_MODE_OPTIONS.find(
        (option) => option.value === voiceSettings.playMode.value,
    );
    if (!activePlayMode) {
        throw new Error(`Unknown play mode value: ${voiceSettings.playMode.value}`);
    }
    // Glide only applies while notes steal a voice (Mono/Legato); Poly greys it.
    const glideDisabled = voiceSettings.playMode.value === VOICE_MODE_OPTIONS[0].value;
    const silhouetteHeight = MOBILE_MOD_RAIL_TAB_CONTENT_HEIGHT_PX
        + (2 * MOBILE_MOD_RAIL_SHOULDER_PX)
        + (drawerOpen ? drawerPlacement.extent : 0);
    const silhouettePath = buildRailSilhouettePath({
        width: MOBILE_MOD_RAIL_WIDTH_PX,
        shoulder: MOBILE_MOD_RAIL_SHOULDER_PX,
        corner: MOBILE_MOD_RAIL_CORNER_PX,
        height: silhouetteHeight,
    }, edge);
    const upwardDrawerOffset = drawerOpen && drawerPlacement.direction === "up" ? -drawerPlacement.extent : 0;
    let disclosureDirection = drawerPlacement.direction;
    if (expanded) {
        disclosureDirection = drawerPlacement.direction === "up" ? "down" : "up";
    }

    return (
        <div ref={layerRef} data-role="mobile-global-mod-rail-layer" className="mobile-global-mod-rail-layer">
            <aside
                ref={railRef}
                data-role="mobile-global-mod-rail"
                data-expanded={expanded}
                data-edge={edge}
                data-drawer-direction={drawerPlacement.direction}
                data-mapping-active={mappingActive}
                data-decelerating={decelerating}
                data-settling-x={settlingX}
                className="mobile-global-mod-rail"
                style={{
                    top,
                    transform: `translate(${dragX}px, ${upwardDrawerOffset}px)`,
                    "--source-color": selectedSource.accent,
                    "--editor-accent": accent,
                    "--rail-drawer-size": `${drawerPlacement.extent}px`,
                } as CSSProperties}
                aria-label="Global modulation bar"
            >
                <div
                    data-role="mobile-global-mod-rail-glass"
                    className="mobile-global-mod-rail-glass"
                    style={{ clipPath: `path("${silhouettePath}")` }}
                    aria-hidden="true"
                />
                <svg
                    data-role="mobile-global-mod-rail-silhouette"
                    className="mobile-global-mod-rail-silhouette"
                    viewBox={`0 0 ${MOBILE_MOD_RAIL_WIDTH_PX} ${silhouetteHeight}`}
                    preserveAspectRatio="none"
                    focusable="false"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={silhouetteGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop className="mobile-global-mod-rail-silhouette-top" offset="0" />
                            <stop className="mobile-global-mod-rail-silhouette-mid" offset="0.12" />
                            <stop className="mobile-global-mod-rail-silhouette-bottom" offset="1" />
                        </linearGradient>
                    </defs>
                    <path
                        d={silhouettePath}
                        fill={`url(#${silhouetteGradientId})`}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
                <div data-role="mobile-global-mod-rail-body" className="mobile-global-mod-rail-body">
                    <div
                        ref={tabRef}
                        data-role="mobile-global-mod-rail-tab"
                        className="mobile-global-mod-rail-tab"
                    >
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-grip"
                            className="mobile-global-mod-rail-grip"
                            aria-label={expanded ? "Collapse global modulation bar" : "Expand global modulation bar"}
                            aria-expanded={expanded}
                            onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") {
                                    return;
                                }
                                event.preventDefault();
                                setExpanded((current) => !current);
                            }}
                            onPointerDown={(event) => {
                                if (event.pointerType === "mouse" && event.button !== 0) {
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                const interruptedDeceleration = stopRailDeceleration();
                                if (interruptedDeceleration) {
                                    // Like touching a coasting scroll view, a new touch stops
                                    // it exactly where it is before beginning the next gesture.
                                    persistRailDock(positionRef.current);
                                }
                                const motionSamples: RailMotionSample[] = [];
                                appendRailMotionSample(motionSamples, event.clientY, event.timeStamp);
                                gestureRef.current = {
                                    pointerId: event.pointerId,
                                    startClientX: event.clientX,
                                    startClientY: event.clientY,
                                    lastClientX: event.clientX,
                                    startNormalizedY: normalizedPositionRef.current
                                        ?? MOBILE_MOD_RAIL_DEFAULT_DOCK.normalizedY,
                                    startTop: positionRef.current,
                                    startEdge: edgeRef.current,
                                    moved: false,
                                    interruptedDeceleration,
                                    motionSamples,
                                    captureElement: event.currentTarget,
                                };
                                setSettlingX(false);
                                if (settleXTimeoutRef.current !== null) {
                                    window.clearTimeout(settleXTimeoutRef.current);
                                    settleXTimeoutRef.current = null;
                                }
                                try {
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                } catch {
                                    // Window-level termination still owns unsupported pointers.
                                }
                            }}
                            onPointerMove={(event) => {
                                const gesture = gestureRef.current;
                                if (!gesture || gesture.pointerId !== event.pointerId) {
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                appendRailMotionSample(
                                    gesture.motionSamples,
                                    event.clientY,
                                    event.timeStamp,
                                );
                                gesture.lastClientX = event.clientX;
                                const deltaY = event.clientY - gesture.startClientY;
                                const deltaX = event.clientX - gesture.startClientX;
                                gesture.moved ||= Math.abs(deltaY) > MOBILE_MOD_RAIL_DRAG_THRESHOLD_PX
                                    || Math.abs(deltaX) > MOBILE_MOD_RAIL_DRAG_THRESHOLD_PX;
                                if (!gesture.moved) {
                                    return;
                                }
                                const bounds = boundsRef.current;
                                const nextTop = clamp(gesture.startTop + deltaY, bounds.min, bounds.max);
                                positionRef.current = nextTop;
                                normalizedPositionRef.current = normalizeRailTop(nextTop, bounds);
                                setTop(nextTop);
                                updateDrawerPlacement(nextTop);
                                // The bar follows the finger horizontally inside the layer;
                                // release settles it against the nearest edge.
                                const edgeSpan = Math.max(0, layerWidthRef.current - MOBILE_MOD_RAIL_WIDTH_PX);
                                const dragRange: readonly [number, number] = gesture.startEdge === "right"
                                    ? [-edgeSpan, 0]
                                    : [0, edgeSpan];
                                applyDragX(clamp(deltaX, dragRange[0], dragRange[1]));
                            }}
                            onPointerUp={(event) => finishRailGesture(event.pointerId, false, event.timeStamp)}
                            onPointerCancel={(event) => finishRailGesture(event.pointerId, true, event.timeStamp)}
                            onLostPointerCapture={(event) => finishRailGesture(event.pointerId, true, event.timeStamp)}
                        >
                            <span className="mobile-global-mod-rail-handle" aria-hidden="true">
                                <span /><span /><span /><span /><span /><span />
                            </span>
                            <span
                                className="rack-mod-chevron mobile-global-mod-rail-chevron"
                                data-direction={disclosureDirection}
                                aria-hidden="true"
                            />
                        </button>
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-selected"
                            className="mobile-global-mod-rail-module mobile-global-mod-rail-selected"
                            aria-label={`${selectedSource.label} selected`}
                            {...selectedSourceHandlers(selectedSource, false)}
                        >
                            <ModSourceArt source={selectedSource} />
                            {clampedActivity !== null ? (
                                <span
                                    className="mobile-global-mod-rail-activity"
                                    aria-label={`${selectedSource.label} activity`}
                                    style={{ "--source-activity": clampedActivity } as CSSProperties}
                                ><span /></span>
                            ) : null}
                        </button>
                        <span
                            data-role="mobile-global-mod-rail-route-count"
                            className="mobile-global-mod-rail-route-count"
                            aria-label={`${routeCount} modulation routes`}
                        >{routeCount}</span>
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-note"
                            className="mobile-global-mod-rail-module mobile-global-mod-rail-note"
                            data-note-held={noteHeld}
                            aria-label="Play note"
                            onPointerDown={(event) => {
                                if (event.pointerType === "mouse" && event.button !== 0) {
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                try {
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                } catch {
                                    // Window-level termination still owns unsupported pointers.
                                }
                                noteKeyPointerRef.current = event.pointerId;
                                setNoteHeld(true);
                                onNoteKeyDown();
                            }}
                            onPointerUp={(event) => releaseNoteKey(event.pointerId)}
                            onPointerCancel={(event) => releaseNoteKey(event.pointerId)}
                            onLostPointerCapture={(event) => releaseNoteKey(event.pointerId)}
                            onKeyDown={(event) => {
                                if ((event.key !== "Enter" && event.key !== " ") || event.repeat) {
                                    return;
                                }
                                event.preventDefault();
                                noteKeyPointerRef.current = -1;
                                setNoteHeld(true);
                                onNoteKeyDown();
                            }}
                            onKeyUp={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") {
                                    return;
                                }
                                event.preventDefault();
                                releaseNoteKey(-1);
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="9" cy="17" r="2.8" fill="currentColor" />
                                <path d="M11.8 17V5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                <path d="M11.8 5.5c3 1 4.6 2.6 4.9 5.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                            </svg>
                            {autoPreviewEnabled ? (
                                <span
                                    data-role="mobile-global-mod-rail-note-dot"
                                    className="mobile-global-mod-rail-note-dot"
                                    aria-hidden="true"
                                />
                            ) : null}
                        </button>
                    </div>
                    <div
                        ref={drawerRef}
                        data-role="mobile-global-mod-rail-drawer"
                        className="mobile-global-mod-rail-drawer"
                        aria-hidden={!expanded || mappingActive}
                        inert={!expanded || mappingActive}
                    >
                        {children}
                        <div className="mobile-global-mod-rail-toggles" role="group" aria-label="Audition controls">
                            <button
                                type="button"
                                data-role="mobile-global-mod-rail-keyboard-toggle"
                                className="mobile-global-mod-rail-toggle"
                                aria-pressed={keyboardVisible}
                                aria-label="Toggle on-screen keyboard"
                                onClick={onToggleKeyboard}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="3" y="8" width="18" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                                    <path d="M9 8v6M15 8v6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                data-role="mobile-global-mod-rail-auto-toggle"
                                className="mobile-global-mod-rail-toggle is-auto"
                                aria-pressed={autoPreviewEnabled}
                                aria-label="Toggle auto-preview"
                                onClick={onToggleAutoPreview}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                    <path d="M19.5 3.5v3.4h-3.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <button
                                ref={voiceToggleRef}
                                type="button"
                                data-role="mobile-global-mod-rail-voice-toggle"
                                className="mobile-global-mod-rail-toggle is-voice"
                                aria-pressed={voiceSettingsOpen}
                                aria-haspopup="dialog"
                                aria-label={`Voice settings (${activePlayMode.label})`}
                                onClick={() => setVoiceSettingsOpen((current) => !current)}
                            >
                                {activePlayMode.label}
                            </button>
                        </div>
                    </div>
                </div>
                {voiceSettingsOpen ? (
                    <div
                        ref={voicePopoverRef}
                        data-role="mobile-global-mod-rail-voice-popover"
                        className="mobile-global-mod-rail-voice-popover"
                        role="dialog"
                        aria-label="Voice settings"
                    >
                        <div className="mobile-global-mod-rail-voice-modes" role="radiogroup" aria-label="Play mode">
                            {VOICE_MODE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={option.value === voiceSettings.playMode.value}
                                    className="mobile-global-mod-rail-voice-mode"
                                    onClick={() => voiceSettings.playMode.commitValue(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div
                            className="mobile-global-mod-rail-voice-glide"
                            data-disabled={glideDisabled}
                            inert={glideDisabled}
                        >
                            <PrecisionNumberField
                                ariaLabel="Glide time"
                                binding={voiceSettings.glideTime}
                                min={GLIDE_TIME_MIN_SECONDS}
                                max={GLIDE_TIME_MAX_SECONDS}
                                step={GLIDE_TIME_STEP_SECONDS}
                                formatDisplay={(value) => `${value.toFixed(3)} s`}
                                leadingLabel="Glide"
                                variant="inlineDark"
                                dataRole="mobile-global-mod-rail-glide-field"
                                width={64}
                                height={22}
                            />
                        </div>
                    </div>
                ) : null}
            </aside>
            {sourceDrag ? (
                <div
                    data-role="mobile-global-mod-source-ghost"
                    data-target-captured={sourceDrag.targetCaptured}
                    className="mobile-global-mod-source-ghost"
                    style={{
                        left: sourceDrag.clientX,
                        top: sourceDrag.clientY,
                        "--source-color": findRackModulationSource(
                            sourceDrag.source.sourceKind,
                            sourceDrag.source.sourceSlot,
                        ).accent,
                    } as CSSProperties}
                    aria-hidden="true"
                >
                    <ModSourceArt
                        source={findRackModulationSource(
                            sourceDrag.source.sourceKind,
                            sourceDrag.source.sourceSlot,
                        )}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ModulationAmountControl({
    source,
    target,
    route,
    onHudChange,
}: {
    source: RackModulationSource;
    target: RackParameterDescriptor;
    route: ModulationRoute;
    onHudChange: (hud: RackParameterHud | null) => void;
}) {
    const sliderRef = useRef<HTMLButtonElement | null>(null);
    const hudPointerRef = useRef<SliderDragPointer | null>(null);
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
    } = useSliderDrag();
    const targetKind = `rack.${target.endpointID}` as RackModulationTargetKind;
    const amountBinding = useModulationRouteAmountBinding(route);
    const presentedAmount = amountBinding.value;
    const polarity = route.polarity;
    const sliderPosition = getModulationAmountSliderPosition(targetKind, presentedAmount);
    const showModulationHud = useCallback((nextAmount: number, pointer?: SliderDragPointer) => {
        const slider = sliderRef.current;
        if (!slider) {
            return;
        }
        const bounds = slider.getBoundingClientRect();
        const hudPointer = pointer ?? hudPointerRef.current ?? {
            x: (bounds.left + bounds.right) / 2,
            y: (bounds.top + bounds.bottom) / 2,
        };
        hudPointerRef.current = hudPointer;
        onHudChange({
            endpointID: target.endpointID,
            label: `MOD · ${target.label}`,
            value: formatModulationAmountReadout(targetKind, nextAmount, polarity),
            mode: "modulation",
            anchor: {
                left: bounds.left,
                top: bounds.top,
                right: bounds.right,
                bottom: bounds.bottom,
            },
            pointer: hudPointer,
        });
    }, [onHudChange, polarity, target.endpointID, target.label, targetKind]);
    const binding = useMemo<PatchControlBinding<number>>(() => ({
        endpointID: "rackModulationAmount",
        value: sliderPosition,
        setValue: () => undefined,
        commitValue: () => undefined,
        beginGesture: () => showModulationHud(presentedAmount),
        endGesture: () => {
            hudPointerRef.current = null;
            onHudChange(null);
        },
    }), [onHudChange, presentedAmount, showModulationHud, sliderPosition]);
    const handleNormalizedChange = useCallback((normalized: number, pointer?: SliderDragPointer) => {
        const nextAmount = composeModulationAmount(targetKind, normalized);
        if (Math.abs(nextAmount - presentedAmount) <= 1e-9) {
            showModulationHud(nextAmount, pointer);
            return;
        }
        amountBinding.setValue(nextAmount);
        showModulationHud(nextAmount, pointer);
    }, [amountBinding, presentedAmount, showModulationHud, targetKind]);
    const fillStart = Math.min(0.5, sliderPosition);
    const fillWidth = Math.abs(sliderPosition - 0.5);

    return (
        <section className="rack-mod-amount" aria-label="Selected modulation mapping amount">
            <div className="rack-mod-amount-label">
                <span><strong>AMOUNT</strong>{source.label} → {getRackEffectDescriptor(target.effectId).label} {target.shortLabel}</span>
                <output>{formatModulationAmountReadout(targetKind, presentedAmount, polarity)}</output>
            </div>
            <button
                ref={sliderRef}
                type="button"
                role="slider"
                data-role="rack-modulation-amount"
                aria-label="Modulation mapping amount"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={Math.round((sliderPosition - 0.5) * 200)}
                aria-valuetext={formatModulationAmountReadout(targetKind, presentedAmount, polarity)}
                className="rack-mod-amount-slider"
                onPointerDown={(event) => {
                    hudPointerRef.current = { x: event.clientX, y: event.clientY };
                    handlePointerDown(
                        event,
                        sliderRef.current,
                        binding,
                        sliderPosition,
                        0,
                        1,
                        "horizontal",
                        handleNormalizedChange,
                    );
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={() => handleLostPointerCapture()}
                onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                        return;
                    }
                    event.preventDefault();
                    handleNormalizedChange(clamp(
                        sliderPosition + (event.key === "ArrowRight" ? 0.01 : -0.01),
                        0,
                        1,
                    ));
                }}
                onKeyUp={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        onHudChange(null);
                    }
                }}
                onBlur={() => onHudChange(null)}
            >
                <span className="rack-mod-amount-track" aria-hidden="true">
                    <span className="rack-mod-amount-zero" />
                    <span className="rack-mod-amount-fill" style={{ left: `${fillStart * 100}%`, width: `${fillWidth * 100}%` }} />
                    <span className="rack-mod-amount-thumb" style={{ left: `${sliderPosition * 100}%` }} />
                </span>
            </button>
        </section>
    );
}

function UnmappedModulationPair({
    source,
    target,
    onCreate,
}: {
    source: RackModulationSource;
    target: RackParameterDescriptor;
    onCreate: () => void;
}) {
    return (
        <section
            className="rack-mod-amount rack-mod-unmapped"
            aria-label="Selected modulation source and target are not mapped"
            data-role="rack-unmapped-pair"
        >
            <span className="rack-mod-unmapped-pair">
                {source.label} → {getRackEffectDescriptor(target.effectId).label} {target.label}
            </span>
            <button
                type="button"
                data-role="rack-create-mapping"
                className="rack-create-mapping"
                onClick={onCreate}
            >
                CREATE MAPPING +
            </button>
        </section>
    );
}

type RackParameterMenuState = {
    readonly endpointID: string;
    readonly clientX: number;
    readonly clientY: number;
};

const RACK_PARAMETER_MENU_ITEMS = [
    { action: "edit-values", label: "Edit values…" },
    { action: "reset-base", label: "Reset base to default" },
    { action: "toggle-route", label: "Bypass route" },
    { action: "polarity", label: "Polarity: Unipolar" },
    { action: "reducer", label: "Voice reducer: Maximum" },
    { action: "remove-route", label: "Remove selected-source route" },
    { action: "remove-all-target-routes", label: "Remove all routes to target…" },
] as const;

type RackParameterMenuAction = typeof RACK_PARAMETER_MENU_ITEMS[number]["action"];

function routeSourceLabel(route: Pick<ModulationRoute, "sourceKind" | "sourceSlot">) {
    return MODULATION_SOURCE_OPTIONS.find((source) => (
        source.sourceKind === route.sourceKind && source.sourceSlot === route.sourceSlot
    ))?.label ?? "Selected source";
}

function RackParameterContextMenu({
    state,
    route,
    targetRouteCount,
    onClose,
    onSelectAction,
}: {
    state: RackParameterMenuState;
    route: ModulationRoute | null;
    targetRouteCount: number;
    onClose: () => void;
    onSelectAction: (action: RackParameterMenuAction) => void;
}) {
    const style = {
        "--rack-menu-x": `${state.clientX}px`,
        "--rack-menu-y": `${state.clientY}px`,
    } as CSSProperties;

    return (
        <div
            className="rack-parameter-menu-layer"
            data-role="rack-parameter-menu-layer"
            onPointerDown={onClose}
        >
            <div
                role="menu"
                aria-label="Rack parameter actions"
                data-role="rack-parameter-menu"
                data-endpoint-id={state.endpointID}
                className="rack-parameter-menu"
                style={style}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {RACK_PARAMETER_MENU_ITEMS
                    .filter((item) => {
                        if (item.action === "remove-all-target-routes") {
                            return targetRouteCount > 0;
                        }
                        if (item.action === "reducer") {
                            return route !== null && isVoiceModulationSource(route.sourceKind);
                        }
                        if (["toggle-route", "polarity", "remove-route"].includes(item.action)) {
                            return route !== null;
                        }
                        return true;
                    })
                    .map((item) => {
                        const label = item.action === "toggle-route"
                            ? (route?.enabled === false ? "Enable route" : "Bypass route")
                            : item.action === "polarity"
                                ? `Polarity: ${route?.polarity === "bipolar" ? "Bipolar" : "Unipolar"}`
                                : item.action === "reducer"
                                    ? `Voice reducer: ${route?.reducer === "mean" ? "Mean" : "Maximum"}`
                                    : item.action === "remove-route" && route !== null
                                        ? `Remove ${routeSourceLabel(route)} route`
                                    : item.label;
                        const needsRoute = ["toggle-route", "polarity", "reducer", "remove-route"].includes(item.action);
                        return (
                    <button
                        key={item.action}
                        type="button"
                        role="menuitem"
                        data-role="rack-parameter-menu-item"
                        data-action={item.action}
                        disabled={needsRoute && route === null}
                        onClick={() => onSelectAction(item.action)}
                    >
                        {label}
                    </button>
                        );
                    })}
            </div>
        </div>
    );
}

function rackParameterEditingUnit(descriptor: RackParameterDescriptor) {
    if (descriptor.unit === "" && descriptor.max - descriptor.min <= 2) {
        return "%";
    }
    return descriptor.unit === "deg" ? "°" : descriptor.unit;
}

function rackModulationEditingUnit(descriptor: RackParameterDescriptor) {
    if (descriptor.scale === "log") {
        return "oct";
    }
    return rackParameterEditingUnit(descriptor);
}

function RackParameterValueSheet({
    descriptor,
    binding,
    route,
    source,
    onApply,
    onClose,
}: {
    descriptor: RackParameterDescriptor;
    binding: PatchControlBinding<number>;
    route: ModulationRoute | null;
    source: RackModulationSource | null;
    onApply: (baseValue: number, modulationAmount: number | null) => void;
    onClose: () => void;
}) {
    const targetKind = `rack.${descriptor.endpointID}` as RackModulationTargetKind;
    const [baseDraft, setBaseDraft] = useState(() => formatRackParameterEditingValue(descriptor, binding.value));
    const [amountDraft, setAmountDraft] = useState(() => (
        route ? formatModulationAmountEditingValue(targetKind, route.amount) : ""
    ));
    const [error, setError] = useState("");

    const apply = useCallback(() => {
        const baseValue = parseRackParameterEditingValue(descriptor, baseDraft);
        const modulationAmount = route === null
            ? null
            : parseModulationAmountEditingValue(targetKind, amountDraft);
        if (baseValue === null || (route !== null && modulationAmount === null)) {
            setError("Enter valid values in the shown units.");
            return;
        }
        onApply(baseValue, modulationAmount);
    }, [amountDraft, baseDraft, descriptor, onApply, route, targetKind]);

    return (
        <div className="rack-value-sheet-layer" onPointerDown={onClose}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={`Edit ${descriptor.label} values`}
                data-role="rack-parameter-value-sheet"
                className="rack-value-sheet"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <header>
                    <span>EXACT VALUE</span>
                    <strong>{getRackEffectDescriptor(descriptor.effectId).label} · {descriptor.label}</strong>
                </header>
                <label>
                    <span>Base</span>
                    <span className="rack-value-sheet-input">
                        <input
                            data-role="rack-base-value-input"
                            inputMode="decimal"
                            value={baseDraft}
                            onChange={(event) => setBaseDraft(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") apply();
                                if (event.key === "Escape") onClose();
                            }}
                            autoFocus
                        />
                        <em>{rackParameterEditingUnit(descriptor)}</em>
                    </span>
                </label>
                <label>
                    <span>{source === null ? "No armed source" : `${source.label} amount`}</span>
                    <span className="rack-value-sheet-input">
                        <input
                            data-role="rack-modulation-value-input"
                            inputMode="decimal"
                            value={amountDraft}
                            disabled={route === null}
                            onChange={(event) => setAmountDraft(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") apply();
                                if (event.key === "Escape") onClose();
                            }}
                        />
                        <em>{rackModulationEditingUnit(descriptor)}</em>
                    </span>
                </label>
                {route === null ? <p data-role="rack-value-sheet-no-route">{source === null ? "Arm a source to edit its route." : "No selected source route."}</p> : null}
                {error ? <p className="rack-value-sheet-error" role="alert">{error}</p> : null}
                <footer>
                    <button type="button" data-role="rack-value-sheet-default" onClick={() => {
                        setBaseDraft(formatRackParameterEditingValue(descriptor, descriptor.initial));
                        setError("");
                    }}>Default</button>
                    <span />
                    <button type="button" data-role="rack-value-sheet-cancel" onClick={onClose}>Cancel</button>
                    <button type="button" data-role="rack-value-sheet-apply" onClick={apply}>Apply</button>
                </footer>
            </section>
        </div>
    );
}

function RemoveRackTargetRoutesConfirmation({
    descriptor,
    routeCount,
    onCancel,
    onConfirm,
}: {
    descriptor: RackParameterDescriptor;
    routeCount: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="rack-value-sheet-layer" onPointerDown={onCancel}>
            <section
                role="alertdialog"
                aria-modal="true"
                aria-label="Remove all modulation routes to parameter"
                data-role="rack-remove-target-routes-confirmation"
                className="rack-remove-routes-confirmation"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <span>REMOVE ROUTES</span>
                <strong>Remove all {routeCount} {routeCount === 1 ? "route" : "routes"} to {descriptor.label}?</strong>
                <p>Other parameters and the base value will not change.</p>
                <footer>
                    <button type="button" onClick={onCancel}>Cancel</button>
                    <button type="button" data-role="rack-remove-target-routes-confirm" onClick={onConfirm}>Remove</button>
                </footer>
            </section>
        </div>
    );
}

export function EffectsRackWorkspace({
    routes,
    observedFilterSpectrum,
    observedDistortionHistory,
    observedDistortionScope,
    onAddRouteWithOverrides,
    onRemoveRoute,
    onRouteChange,
    onBackToVoice,
    onOpenModSource,
    onGlobalModRailStateChange,
    onSelectedEffectChange,
    mobileGlobalModRail = false,
    mobileModRailPortalTarget = null,
    globalModSourceActivity = null,
    modRailAudition,
    modRailVoiceSettings,
    onDragDwellNavigate,
    className,
}: EffectsRackWorkspaceProps) {
    if (mobileGlobalModRail && !modRailAudition) {
        throw new Error("The mobile Mod rail requires modRailAudition bindings.");
    }
    if (mobileGlobalModRail && !modRailVoiceSettings) {
        throw new Error("The mobile Mod rail requires modRailVoiceSettings bindings.");
    }
    const { rackState, rackStateRef, commit } = useRackState();
    const [selectedEffectId, setSelectedEffectId] = useState<EffectModuleId>("drive");
    const [quickEndpointByEffect, setQuickEndpointByEffect] = useState<Readonly<Record<EffectModuleId, string>>>(() => (
        Object.fromEntries(RACK_EFFECT_DESCRIPTORS.map((effect) => [effect.id, effect.initialQuickEndpointID])) as Record<EffectModuleId, string>
    ));
    const [previewOrder, setPreviewOrder] = useState<ReadonlyArray<EffectModuleId>>(rackState.order);
    const previewOrderRef = useRef<ReadonlyArray<EffectModuleId>>(rackState.order);
    const rackListRef = useRef<HTMLDivElement | null>(null);
    const reorderRef = useRef<ReorderGesture | null>(null);
    const [reorderingEffectId, setReorderingEffectId] = useState<EffectModuleId | null>(null);
    const [selectedSource, setSelectedSource] = useState<SelectedSource>({ sourceKind: "mseg", sourceSlot: 1 });
    const [sourcePageIndex, setSourcePageIndex] = useState(0);
    const [sourceIsArmed, setSourceIsArmed] = useState(false);
    const [dragSource, setDragSource] = useState<SelectedSource | null>(null);
    const [selectedTargetEndpointID, setSelectedTargetEndpointID] = useState("distortionDriveDb");
    const [hoverTargetEndpointID, setHoverTargetEndpointID] = useState<string | null>(null);
    const [routeStatus, setRouteStatus] = useState("");
    const [sourceDrag, setSourceDrag] = useState<SourceDragPresentation | null>(null);
    const [parameterHud, setParameterHud] = useState<RackParameterHud | null>(null);
    const [railCollapseSignal, setRailCollapseSignal] = useState(0);
    const [parameterMenu, setParameterMenu] = useState<RackParameterMenuState | null>(null);
    const [parameterValueSheetEndpointID, setParameterValueSheetEndpointID] = useState<string | null>(null);
    const [removeTargetRoutesEndpointID, setRemoveTargetRoutesEndpointID] = useState<string | null>(null);
    const pendingRouteRef = useRef<{ key: string } | null>(null);
    const [pendingRouteKey, setPendingRouteKey] = useState<string | null>(null);

    useEffect(() => {
        if (parameterMenu === null) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setParameterMenu(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [parameterMenu]);

    useEffect(() => {
        if (reorderRef.current !== null) {
            return;
        }
        previewOrderRef.current = rackState.order;
        setPreviewOrder(rackState.order);
    }, [rackState.order]);

    const selectedEffect = getRackEffectDescriptor(selectedEffectId);
    const selectedTargetCandidate = getRackParameterDescriptor(selectedTargetEndpointID);
    const selectedTarget = selectedTargetCandidate !== null
        && selectedTargetCandidate.modulationTargetIndex !== null
        ? selectedTargetCandidate
        : selectedEffect.parameters.find((parameter) => parameter.modulationTargetIndex !== null)
            ?? selectedEffect.parameters[0];
    const activeSource = findRackModulationSource(selectedSource.sourceKind, selectedSource.sourceSlot);
    const dragSourceDescriptor = dragSource === null
        ? null
        : findRackModulationSource(dragSource.sourceKind, dragSource.sourceSlot);
    const selectedTargetKind = `rack.${selectedTarget.endpointID}` as RackModulationTargetKind;
    const selectedRouteIndex = routes.findIndex((route) => (
        route.sourceKind === selectedSource.sourceKind
        && route.sourceSlot === selectedSource.sourceSlot
        && route.targetKind === selectedTargetKind
    ));
    const selectedRoute = sourceIsArmed && selectedRouteIndex >= 0 ? routes[selectedRouteIndex] : null;
    const selectedPairKey = `${selectedSource.sourceKind}:${selectedSource.sourceSlot}:${selectedTargetKind}`;
    const parameterOverlayEndpointID = parameterValueSheetEndpointID
        ?? parameterMenu?.endpointID
        ?? removeTargetRoutesEndpointID;
    const parameterOverlayDescriptor = parameterOverlayEndpointID === undefined
        || parameterOverlayEndpointID === null
        ? selectedTarget
        : getRackParameterDescriptor(parameterOverlayEndpointID)
            ?? selectedTarget;
    const parameterOverlayBinding = useRackParameterBinding(
        parameterOverlayDescriptor,
        parameterOverlayEndpointID !== undefined && parameterOverlayEndpointID !== null,
    );
    const parameterOverlayTargetKind = `rack.${parameterOverlayDescriptor.endpointID}` as RackModulationTargetKind;
    const parameterOverlayRouteIndex = sourceIsArmed ? routes.findIndex((route) => (
        route.sourceKind === selectedSource.sourceKind
        && route.sourceSlot === selectedSource.sourceSlot
        && route.targetKind === parameterOverlayTargetKind
    )) : -1;
    const parameterOverlayRoute = parameterOverlayRouteIndex >= 0
        ? routes[parameterOverlayRouteIndex] ?? null
        : null;
    const parameterOverlayAmountBinding = useModulationRouteAmountBinding(parameterOverlayRoute);
    const parameterOverlayPresentedRoute = parameterOverlayRoute === null || parameterOverlayAmountBinding.value === null
        ? parameterOverlayRoute
        : { ...parameterOverlayRoute, amount: parameterOverlayAmountBinding.value };
    const parameterOverlayTargetRouteIndices = routes.flatMap((route, routeIndex) => (
        route.targetKind === parameterOverlayTargetKind ? [routeIndex] : []
    ));

    useEffect(() => {
        const pending = pendingRouteRef.current;
        if (!pending || pending.key !== selectedPairKey || selectedRouteIndex < 0) {
            return;
        }
        pendingRouteRef.current = null;
        setPendingRouteKey(null);
        setRouteStatus("");
    }, [selectedPairKey, selectedRouteIndex]);

    useEffect(() => {
        if (pendingRouteKey === null) {
            return;
        }
        const routeExists = routes.some((route) => routePairKey(route, route.targetKind) === pendingRouteKey);
        if (routeExists) {
            pendingRouteRef.current = null;
            setPendingRouteKey(null);
            setRouteStatus("");
            return;
        }
        const timeout = window.setTimeout(() => {
            if (pendingRouteRef.current?.key === pendingRouteKey) {
                pendingRouteRef.current = null;
            }
            setPendingRouteKey((current) => current === pendingRouteKey ? null : current);
            setRouteStatus((current) => current === "CREATING MAPPING…" ? "MAPPING NOT CREATED" : current);
        }, 750);
        return () => window.clearTimeout(timeout);
    }, [pendingRouteKey, routes]);

    const commitOrder = useCallback((order: ReadonlyArray<EffectModuleId>) => {
        commit({ ...rackStateRef.current, order: [...order] });
    }, [commit, rackStateRef]);

    const finishReorder = useCallback((pointerId: number, shouldCommit: boolean) => {
        const gesture = reorderRef.current;
        if (!gesture || gesture.pointerId !== pointerId) {
            return;
        }

        reorderRef.current = null;
        setReorderingEffectId(null);
        try {
            if (gesture.captureElement.hasPointerCapture(pointerId)) {
                gesture.captureElement.releasePointerCapture(pointerId);
            }
        } catch {
            // Capture may already be gone after a platform cancellation.
        }

        if (shouldCommit && !sameOrder(gesture.originalOrder, previewOrderRef.current)) {
            commitOrder(previewOrderRef.current);
        } else {
            const currentOrder = rackStateRef.current.order;
            previewOrderRef.current = currentOrder;
            setPreviewOrder(currentOrder);
        }
    }, [commitOrder, rackStateRef]);

    const updateReorderPreview = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const gesture = reorderRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (hasReleasedMouseButton(event)) {
            finishReorder(event.pointerId, false);
            return;
        }

        const renderRoot = event.currentTarget.getRootNode();
        if (!(renderRoot instanceof Document) && !(renderRoot instanceof ShadowRoot)) {
            return;
        }

        const rackUnits = Array.from(
            renderRoot.querySelectorAll<HTMLElement>("[data-rack-effect-id]"),
        );
        const containingUnit = rackUnits.find((unit) => {
            const rect = unit.getBoundingClientRect();
            return event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        const nearestUnit = containingUnit ?? rackUnits.reduce<HTMLElement | null>(
            (nearest, unit) => {
                if (!nearest) {
                    return unit;
                }
                const unitRect = unit.getBoundingClientRect();
                const nearestRect = nearest.getBoundingClientRect();
                const unitDistance = Math.abs(event.clientY - (unitRect.top + unitRect.height / 2));
                const nearestDistance = Math.abs(
                    event.clientY - (nearestRect.top + nearestRect.height / 2),
                );
                return unitDistance < nearestDistance ? unit : nearest;
            },
            null,
        );
        const candidateEffectId = (containingUnit ?? nearestUnit)?.dataset.rackEffectId;
        const overEffectId = previewOrderRef.current.find((effectId) => effectId === candidateEffectId);
        if (!overEffectId) {
            return;
        }

        const nextOrder = moveEffect(previewOrderRef.current, gesture.effectId, overEffectId);
        if (nextOrder !== previewOrderRef.current) {
            previewOrderRef.current = nextOrder;
            setPreviewOrder(nextOrder);
        }
    }, [finishReorder]);

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishReorder(event.pointerId, true);
        const handlePointerCancel = (event: PointerEvent) => finishReorder(event.pointerId, false);
        const cancelActiveReorder = () => {
            const gesture = reorderRef.current;
            if (gesture) {
                finishReorder(gesture.pointerId, false);
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelActiveReorder();
            }
        };

        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", cancelActiveReorder);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", cancelActiveReorder);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActiveReorder();
        };
    }, [finishReorder]);

    const getPairCreation = useCallback((
        source: SelectedSource,
        requestedTargetKind: string,
    ): RackRouteCreation => {
        const targetKind = parseModulationTargetKind(requestedTargetKind);
        return getModulationRouteCreation({
            routes,
            source,
            targetKind,
            pending: targetKind !== null
                && pendingRouteRef.current?.key === routePairKey(source, targetKind),
        });
    }, [routes]);

    const createRoute = useCallback((
        source: SelectedSource,
        targetKind: ModulationTargetKind,
    ) => {
        const creation = getPairCreation(source, targetKind);
        if (creation === "existing") {
            setRouteStatus("");
            return true;
        }
        if (creation !== "creatable") {
            return false;
        }

        const created = onAddRouteWithOverrides({
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind,
            amount: 0,
            polarity: "unipolar",
            reducer: "max",
            enabled: true,
        });
        if (!created) {
            setRouteStatus("MAPPING NOT CREATED");
            return false;
        }

        const key = routePairKey(source, targetKind);
        pendingRouteRef.current = { key };
        setPendingRouteKey(key);
        setRouteStatus("CREATING MAPPING…");
        return true;
    }, [getPairCreation, onAddRouteWithOverrides]);

    const selectEffect = useCallback((effectId: EffectModuleId) => {
        setSelectedEffectId(effectId);
        onSelectedEffectChange?.(effectId);
        const effect = getRackEffectDescriptor(effectId);
        const preferredEndpointID = quickEndpointByEffect[effectId];
        const preferred = effect.parameters.find((parameter) => (
            parameter.endpointID === preferredEndpointID && parameter.modulationTargetIndex !== null
        ));
        const target = preferred ?? effect.parameters.find((parameter) => parameter.modulationTargetIndex !== null);
        if (target) {
            setSelectedTargetEndpointID(target.endpointID);
        }
    }, [onSelectedEffectChange, quickEndpointByEffect]);

    const selectTarget = useCallback((endpointID: string) => {
        const parameter = getRackParameterDescriptor(endpointID);
        if (!parameter || parameter.modulationTargetIndex === null) {
            return;
        }
        setSelectedTargetEndpointID(endpointID);
        setSelectedEffectId(parameter.effectId);
        onSelectedEffectChange?.(parameter.effectId);
        setRouteStatus("");
    }, [onSelectedEffectChange]);

    // T06: a source drag dwelling on a navigation surface switches views
    // while the drag stays alive under its original owner.
    const handleDwellNavigate = useCallback((dwellKey: string) => {
        if (dwellKey.startsWith("rack-effect:")) {
            const effectId = dwellKey.slice("rack-effect:".length) as EffectModuleId;
            // Unknown ids are authoring bugs; the descriptor lookup throws.
            getRackEffectDescriptor(effectId);
            selectEffect(effectId);
            return;
        }
        onDragDwellNavigate?.(dwellKey);
    }, [onDragDwellNavigate, selectEffect]);

    const selectSource = useCallback((source: SelectedSource) => {
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        setRouteStatus("");
    }, []);

    const dropSource = useCallback((
        source: SelectedSource,
        targetKind: ModulationTargetKind,
        companionKinds: ReadonlyArray<ModulationTargetKind> = [],
    ) => {
        const rackEndpointID = targetKind.startsWith("rack.") ? targetKind.slice("rack.".length) : null;
        const targetParameter = rackEndpointID === null ? null : getRackParameterDescriptor(rackEndpointID);
        const creation = getPairCreation(source, targetKind);
        if (creation !== "existing" && creation !== "creatable") {
            return;
        }
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        if (targetParameter && targetParameter.modulationTargetIndex !== null) {
            setSelectedTargetEndpointID(targetParameter.endpointID);
            setSelectedEffectId(targetParameter.effectId);
            onSelectedEffectChange?.(targetParameter.effectId);
        }
        if (creation === "creatable") {
            createRoute(source, targetKind);
        }
        // A compound drop surface (the filter graph) declares companion
        // destinations; one explicit drop creates every missing pairing.
        for (const companionKind of companionKinds) {
            if (getPairCreation(source, companionKind) === "creatable") {
                onAddRouteWithOverrides({
                    sourceKind: source.sourceKind,
                    sourceSlot: source.sourceSlot,
                    targetKind: companionKind,
                });
            }
        }
    }, [createRoute, getPairCreation, onAddRouteWithOverrides, onSelectedEffectChange]);

    const changeSourcePage = useCallback((nextPageIndex: number) => {
        const normalizedPageIndex = ((nextPageIndex % RACK_MODULATION_SOURCE_PAGES.length)
            + RACK_MODULATION_SOURCE_PAGES.length) % RACK_MODULATION_SOURCE_PAGES.length;
        setSourcePageIndex(normalizedPageIndex);
        setRouteStatus("");
    }, []);

    const setRecentParameter = useCallback((effectId: EffectModuleId, endpointID: string) => {
        setQuickEndpointByEffect((current) => ({ ...current, [effectId]: endpointID }));
    }, []);

    const handleParameterMenuAction = useCallback((action: RackParameterMenuAction) => {
        if (action === "edit-values") {
            setParameterValueSheetEndpointID(parameterOverlayDescriptor.endpointID);
        } else if (action === "reset-base") {
            parameterOverlayBinding.commitValue(parameterOverlayDescriptor.initial);
        } else if (action === "remove-all-target-routes") {
            setRemoveTargetRoutesEndpointID(parameterOverlayDescriptor.endpointID);
        } else if (parameterOverlayRouteIndex >= 0 && parameterOverlayRoute !== null) {
            if (action === "toggle-route") {
                onRouteChange(parameterOverlayRouteIndex, { enabled: !parameterOverlayRoute.enabled });
            } else if (action === "polarity") {
                onRouteChange(parameterOverlayRouteIndex, {
                    polarity: parameterOverlayRoute.polarity === "unipolar" ? "bipolar" : "unipolar",
                });
            } else if (action === "reducer" && isVoiceModulationSource(parameterOverlayRoute.sourceKind)) {
                onRouteChange(parameterOverlayRouteIndex, {
                    reducer: parameterOverlayRoute.reducer === "max" ? "mean" : "max",
                });
            } else if (action === "remove-route") {
                onRemoveRoute(parameterOverlayRouteIndex);
            }
        }
        setParameterMenu(null);
    }, [
        onRouteChange,
        onRemoveRoute,
        parameterOverlayBinding,
        parameterOverlayDescriptor.endpointID,
        parameterOverlayDescriptor.initial,
        parameterOverlayRoute,
        parameterOverlayRouteIndex,
    ]);

    const hoverSourceTarget = useCallback((source: SelectedSource, targetKind: ModulationTargetKind | null) => {
        if (targetKind === null || !targetKind.startsWith("rack.")) {
            setHoverTargetEndpointID(null);
            return;
        }
        const endpointID = targetKind.slice("rack.".length);
        const creation = getPairCreation(source, targetKind);
        setHoverTargetEndpointID(
            creation === "existing" || creation === "creatable" ? endpointID : null,
        );
    }, [getPairCreation]);

    const modulationSourceControls = (
        <ModSourceCarousel
            pageIndex={sourcePageIndex}
            selectedSource={selectedSource}
            sourceIsArmed={sourceIsArmed}
            orientation={mobileGlobalModRail ? "vertical" : "horizontal"}
            onPageChange={changeSourcePage}
            onDragSourceChange={setDragSource}
            onSourceSelect={selectSource}
            onSourceDrop={dropSource}
            onOpenSelectedSource={(source) => {
                setRailCollapseSignal((current) => current + 1);
                onOpenModSource?.(source);
            }}
            onHoverTarget={hoverSourceTarget}
            onSourceDragChange={setSourceDrag}
            onDwellNavigate={handleDwellNavigate}
        />
    );

    const modulationRouteControls = (
        <>
            {selectedRoute ? (
                <ModulationAmountControl
                    source={activeSource}
                    target={selectedTarget}
                    route={selectedRoute}
                    onHudChange={setParameterHud}
                />
            ) : sourceIsArmed ? (
                <UnmappedModulationPair
                    source={activeSource}
                    target={selectedTarget}
                    onCreate={() => createRoute(
                        selectedSource,
                        `rack.${selectedTarget.endpointID}` as RackModulationTargetKind,
                    )}
                />
            ) : null}
            <output className="rack-route-status" aria-live="polite">
                {routeStatus || (hoverTargetEndpointID ? `Route to ${hoverTargetEndpointID}` : "")}
            </output>
        </>
    );

    const modulationControls = (
        <>
            {modulationSourceControls}
            {modulationRouteControls}
        </>
    );

    return (
        <section
            data-role="effects-rack-card"
            data-layout-card="mobile-effects-workspace"
            className={`effects-rack-workspace ${className ?? ""}`}
        >
            {parameterHud ? <RackParameterHudOverlay hud={parameterHud} /> : null}
            {parameterMenu ? (
                <RackParameterContextMenu
                    state={parameterMenu}
                    route={parameterOverlayRoute}
                    targetRouteCount={parameterOverlayTargetRouteIndices.length}
                    onClose={() => setParameterMenu(null)}
                    onSelectAction={handleParameterMenuAction}
                />
            ) : null}
            {parameterValueSheetEndpointID ? (
                <RackParameterValueSheet
                    key={`${parameterValueSheetEndpointID}:${selectedSource.sourceKind}:${selectedSource.sourceSlot}`}
                    descriptor={parameterOverlayDescriptor}
                    binding={parameterOverlayBinding}
                    route={parameterOverlayPresentedRoute}
                    source={sourceIsArmed ? activeSource : null}
                    onApply={(baseValue, modulationAmount) => {
                        parameterOverlayBinding.commitValue(baseValue);
                        if (modulationAmount !== null) {
                            parameterOverlayAmountBinding.setValue(modulationAmount);
                        }
                        setParameterValueSheetEndpointID(null);
                    }}
                    onClose={() => setParameterValueSheetEndpointID(null)}
                />
            ) : null}
            {removeTargetRoutesEndpointID ? (
                <RemoveRackTargetRoutesConfirmation
                    descriptor={parameterOverlayDescriptor}
                    routeCount={parameterOverlayTargetRouteIndices.length}
                    onCancel={() => setRemoveTargetRoutesEndpointID(null)}
                    onConfirm={() => {
                        [...parameterOverlayTargetRouteIndices]
                            .sort((left, right) => right - left)
                            .forEach(onRemoveRoute);
                        setRemoveTargetRoutesEndpointID(null);
                    }}
                />
            ) : null}
            <nav className="rack-effects-nav" aria-label="Effects workspace navigation">
                <button
                    type="button"
                    aria-label="Back to synth controls"
                    className="rack-nav-back"
                    onClick={onBackToVoice}
                >
                    <span aria-hidden="true">‹</span> VOICE
                </button>
                <strong>FX RACK</strong>
                <span>8 FX</span>
            </nav>

            <div className="rack-effects-grid">
                <div className="rack-stack" aria-label="Ordered effects rack">
                    <div
                        ref={rackListRef}
                        className="rack-list"
                        data-role="rack-module-list"
                        onPointerMove={updateReorderPreview}
                        onPointerUp={(event) => finishReorder(event.pointerId, true)}
                        onPointerCancel={(event) => finishReorder(event.pointerId, false)}
                        onLostPointerCapture={(event) => {
                            const gesture = reorderRef.current;
                            if (gesture?.captureElement === event.currentTarget) {
                                finishReorder(gesture.pointerId, false);
                            }
                        }}
                    >
                        {previewOrder.map((effectId, position) => (
                            <RackUnit
                                key={effectId}
                                effectId={effectId}
                                position={position}
                                enabled={rackState.enabled[effectId]}
                                selected={selectedEffectId === effectId}
                                reordering={reorderingEffectId === effectId}
                                quickEndpointID={quickEndpointByEffect[effectId]}
                                onSelect={() => selectEffect(effectId)}
                                onToggle={() => commit({
                                    ...rackState,
                                    enabled: { ...rackState.enabled, [effectId]: !rackState.enabled[effectId] },
                                })}
                                onRecentParameter={(endpointID) => {
                                    setRecentParameter(effectId, endpointID);
                                    selectTarget(endpointID);
                                }}
                                onReorderPointerDown={(event) => {
                                    if (event.pointerType === "mouse" && event.button !== 0) {
                                        return;
                                    }
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const captureElement = rackListRef.current;
                                    if (!captureElement) {
                                        return;
                                    }
                                    try {
                                        captureElement.setPointerCapture(event.pointerId);
                                    } catch {
                                        // The list and window handlers remain authoritative when
                                        // capture is unavailable or the platform has already lost it.
                                    }
                                    reorderRef.current = {
                                        pointerId: event.pointerId,
                                        effectId,
                                        originalOrder: [...previewOrderRef.current],
                                        captureElement,
                                    };
                                    setReorderingEffectId(effectId);
                                }}
                                onKeyboardMove={(offset) => {
                                    const targetPosition = clamp(position + offset, 0, previewOrder.length - 1);
                                    if (targetPosition === position) {
                                        return;
                                    }
                                    const nextOrder = moveEffect(previewOrder, effectId, previewOrder[targetPosition]!);
                                    previewOrderRef.current = nextOrder;
                                    setPreviewOrder(nextOrder);
                                    commitOrder(nextOrder);
                                }}
                            />
                        ))}
                    </div>
                </div>

                <section
                    data-role={`rack-editor-${selectedEffectId}`}
                    data-selected-effect={selectedEffectId}
                    data-effect-enabled={rackState.enabled[selectedEffectId] ? "true" : "false"}
                    className="rack-effect-editor"
                    style={{ "--editor-accent": EFFECT_ACCENTS[selectedEffectId] } as CSSProperties}
                    aria-label="Selected effect editor"
                >
                    <header className="rack-editor-header">
                        <span>{rackState.enabled[selectedEffectId] ? "SELECTED FX" : "FX BYPASSED"}</span>
                        <strong className="rack-editor-name">{selectedEffect.label}</strong>
                        <p>{selectedEffect.summary}</p>
                    </header>
                    <div className="rack-editor-visual">
                        <RackEditorVisual
                            effectId={selectedEffectId}
                            observedFilterSpectrum={observedFilterSpectrum}
                            observedDistortionHistory={observedDistortionHistory}
                            observedDistortionScope={observedDistortionScope}
                            onRecentParameter={(endpointID) => setRecentParameter(selectedEffectId, endpointID)}
                        />
                        <RackEditorReadout descriptor={selectedTarget} />
                    </div>
                    <div className="rack-editor-controls">
                        <ParameterList
                            effectId={selectedEffectId}
                            routes={routes}
                            selectedTargetEndpointID={selectedTarget.endpointID}
                            hoverTargetEndpointID={hoverTargetEndpointID}
                            activeSource={activeSource}
                            sourceIsSelected={sourceIsArmed}
                            effectEnabled={rackState.enabled[selectedEffectId]}
                            pendingRouteKey={pendingRouteKey}
                            dragSourceAccent={dragSourceDescriptor?.accent ?? null}
                            onSelectTarget={selectTarget}
                            onRecentParameter={(endpointID) => setRecentParameter(selectedEffectId, endpointID)}
                            onHudChange={setParameterHud}
                            onRequestContextMenu={(endpointID, clientX, clientY) => {
                                selectTarget(endpointID);
                                setParameterMenu({ endpointID, clientX, clientY });
                            }}
                        />
                    </div>
                    <div className="rack-editor-modulation">
                        {mobileGlobalModRail ? modulationRouteControls : modulationControls}
                    </div>
                </section>
            </div>
            {mobileGlobalModRail && mobileModRailPortalTarget && modRailAudition && modRailVoiceSettings ? createPortal(
                <MobileGlobalModRail
                    selectedSource={activeSource}
                    routeCount={routes.length}
                    sourceActivity={globalModSourceActivity}
                    sourceDrag={sourceDrag}
                    accent={EFFECT_ACCENTS[selectedEffectId]}
                    collapseSignal={railCollapseSignal}
                    autoPreviewEnabled={modRailAudition.autoPreviewEnabled}
                    keyboardVisible={modRailAudition.keyboardVisible}
                    onStateChange={onGlobalModRailStateChange}
                    onDragSourceChange={setDragSource}
                    onSourceDrop={dropSource}
                    onHoverTarget={hoverSourceTarget}
                    onSourceDragChange={setSourceDrag}
                    onNoteKeyDown={modRailAudition.onNoteKeyDown}
                    onNoteKeyUp={modRailAudition.onNoteKeyUp}
                    onToggleAutoPreview={modRailAudition.onToggleAutoPreview}
                    onToggleKeyboard={modRailAudition.onToggleKeyboard}
                    voiceSettings={modRailVoiceSettings}
                    onDwellNavigate={handleDwellNavigate}
                >
                    {modulationSourceControls}
                </MobileGlobalModRail>,
                mobileModRailPortalTarget,
            ) : null}
        </section>
    );
}
