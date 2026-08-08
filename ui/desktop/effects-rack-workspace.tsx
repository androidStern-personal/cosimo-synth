import {
    useCallback,
    useEffect,
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
    EFFECTIVE_RACK_STATE_ENDPOINT_ID,
    RACK_STATE_KEY,
    commitRackState,
    createDefaultRackState,
    deserializeRackState,
    parseEffectiveRackState,
    serializeRackState,
    type RackState,
} from "../shared/rack-state";
import {
    MODULATION_MAX_ROUTES,
    composeModulationAmount,
    formatModulationAmountEditingValue,
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
    isVoiceModulationSource,
    parseModulationAmountEditingValue,
    type ModulationRoute,
    type ModulationRouteUpdate,
    type RackModulationTargetKind,
} from "../shared/modulation";
import {
    RACK_MODULATION_SOURCE_PAGES,
    findRackModulationSource,
    type RackModulationSource,
} from "../shared/rack-modulation-sources";
import type { EffectModuleId } from "../shared/target-descriptor";
import { FilterResponseGraph } from "../shared/synth-components";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import type { SynthPatchViewModel } from "../shared/synth-hooks";
import { useSliderDrag } from "../shared/use-slider-drag";
import {
    RackParameterKnob,
    type RackParameterHud,
} from "./rack-parameter-knob";

type EffectsRackWorkspaceProps = {
    routes: ModulationRoute[];
    observedFilterSpectrum: SynthPatchViewModel["observedFilterSpectrum"];
    observedDistortionHistory: SynthPatchViewModel["observedDistortionHistory"];
    observedDistortionScope: SynthPatchViewModel["observedDistortionScope"];
    onAddRouteWithOverrides: (overrides: Partial<ModulationRoute>) => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onBackToVoice: () => void;
    onOpenModSource?: (source: SelectedSource) => void;
    onGlobalModRailStateChange?: (state: GlobalModRailState) => void;
    onSelectedEffectChange?: (effectId: EffectModuleId) => void;
    mobileGlobalModRail?: boolean;
    mobileModRailPortalTarget?: HTMLElement | null;
    globalModSourceActivity?: number | null;
    className?: string;
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

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
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

function rackModulationTargetAtPoint(referenceElement: Element, clientX: number, clientY: number) {
    return elementAtPointInRenderRoot(referenceElement, clientX, clientY)
        ?.closest<HTMLElement>("[data-rack-mod-target]") ?? null;
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

    useEffect(() => {
        const storedStateListener = (message: unknown) => {
            if (typeof message !== "object" || message === null || Array.isArray(message)) {
                return;
            }

            if (Reflect.get(message, "key") === RACK_STATE_KEY) {
                setRackState(deserializeRackState(Reflect.get(message, "value")));
            }
        };
        const effectiveStateListener = (message: unknown) => {
            const effectiveState = parseEffectiveRackState(message);
            if (effectiveState === null) {
                return;
            }

            setRackState({
                format: "cosimo.rack",
                version: 1,
                order: effectiveState.order,
                enabled: effectiveState.enabled,
            });
        };

        patchConnection.addStoredStateValueListener?.(storedStateListener);
        patchConnection.addEndpointListener?.(EFFECTIVE_RACK_STATE_ENDPOINT_ID, effectiveStateListener);
        patchConnection.requestFullStoredState?.((fullState) => {
            setRackState(deserializeRackState(readRackStateFromFullStoredState(fullState)));
        });

        return () => {
            patchConnection.removeStoredStateValueListener?.(storedStateListener);
            patchConnection.removeEndpointListener?.(EFFECTIVE_RACK_STATE_ENDPOINT_ID, effectiveStateListener);
        };
    }, [patchConnection]);

    const commit = useCallback((nextState: RackState) => {
        setRackState(nextState);
        commitRackState(patchConnection, nextState);
        patchConnection.sendStoredStateValue?.(RACK_STATE_KEY, serializeRackState(nextState));
    }, [patchConnection]);

    return { rackState, commit };
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
    hovered,
    onSelect,
    onRecentParameter,
    onHudChange,
    onModulationAmountChange,
    onRequestContextMenu,
}: {
    descriptor: RackParameterDescriptor;
    routes: ReadonlyArray<ModulationRoute>;
    selected: boolean;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    hovered: boolean;
    onSelect: () => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onModulationAmountChange: (endpointID: string, amount: number) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const binding = useRackParameterBinding(descriptor);
    const isTarget = descriptor.modulationTargetIndex !== null;
    const hasRoute = isTarget && routes.some((route) => isRouteForTarget(route, descriptor.endpointID));
    const selectedRoute = sourceIsSelected ? routes.find((route) => (
        route.sourceKind === activeSource.sourceKind
        && route.sourceSlot === activeSource.sourceSlot
        && isRouteForTarget(route, descriptor.endpointID)
    )) ?? null : null;
    const rootStyle = { "--active-source-color": activeSource.accent } as CSSProperties;
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
            className={`rack-editor-control${hasRoute ? " has-route" : ""}${selected ? " is-selected-target" : ""}${hovered ? " is-mod-hover" : ""}`}
            style={rootStyle}
        >
            <RackParameterKnob
                descriptor={descriptor}
                binding={binding}
                route={selectedRoute}
                sourceIsSelected={sourceIsSelected}
                sourceAccent={activeSource.accent}
                dataRole={controlDataRole}
                trackDataRole={RACK_TRACK_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-track-${descriptor.endpointID}`}
                handleDataRole={RACK_HANDLE_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-handle-${descriptor.endpointID}`}
                onSelect={selectParameter}
                onHudChange={onHudChange}
                onModulationAmountChange={(amount) => onModulationAmountChange(descriptor.endpointID, amount)}
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

const EFFECT_CURVE_PATHS: Readonly<Record<Exclude<EffectModuleId, "filter" | "drive">, string>> = {
    ott: "M 0 82 C 18 78 24 48 44 48 S 68 21 100 18",
    chorus: "M 0 58 C 12 24 24 88 38 50 S 64 22 78 55 S 92 79 100 42",
    flanger: "M 0 72 C 18 72 17 28 34 28 S 50 72 67 72 S 82 28 100 28",
    phaser: "M 0 57 C 10 13 20 91 31 48 S 49 14 59 55 S 78 89 88 46 S 96 25 100 38",
    delay: "M 0 28 L 22 28 L 22 47 L 48 47 L 48 64 L 73 64 L 73 78 L 100 78",
    reverb: "M 0 88 C 7 21 18 68 30 39 S 48 61 58 35 S 76 51 84 28 S 95 34 100 21",
};

function GenericRackVisual({ descriptor }: { descriptor: RackEffectDescriptor }) {
    const quickDescriptor = descriptor.parameters.find(
        (parameter) => parameter.endpointID === descriptor.initialQuickEndpointID,
    ) ?? descriptor.parameters[0];
    const binding = useRackParameterBinding(quickDescriptor);
    const normalized = normalizedRackParameterValue(quickDescriptor, binding.value);
    const path = EFFECT_CURVE_PATHS[descriptor.id as Exclude<EffectModuleId, "filter" | "drive">];

    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="rack-visual-grid" d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" />
            <path
                className="rack-visual-curve"
                d={path}
                style={{ opacity: 0.54 + normalized * 0.46, strokeWidth: 2.2 + normalized * 1.4 }}
            />
        </svg>
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

    return <GenericRackVisual descriptor={getRackEffectDescriptor(effectId)} />;
}

function ParameterList({
    effectId,
    routes,
    selectedTargetEndpointID,
    hoverTargetEndpointID,
    activeSource,
    sourceIsSelected,
    onSelectTarget,
    onRecentParameter,
    onHudChange,
    onModulationAmountChange,
    onRequestContextMenu,
}: {
    effectId: EffectModuleId;
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onModulationAmountChange: (endpointID: string, amount: number) => void;
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
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
                onHudChange={onHudChange}
                onModulationAmountChange={onModulationAmountChange}
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
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onHudChange={onHudChange}
                    onModulationAmountChange={onModulationAmountChange}
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
    onSelectTarget,
    onRecentParameter,
    onHudChange,
    onModulationAmountChange,
    onRequestContextMenu,
}: {
    effectId: "phaser" | "delay";
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
    onHudChange: (hud: RackParameterHud | null) => void;
    onModulationAmountChange: (endpointID: string, amount: number) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const descriptor = getRackEffectDescriptor(effectId);
    const modeEndpointID = effectId === "phaser" ? "phaserRateMode" : "delayTimeMode";
    const freeEndpointID = effectId === "phaser" ? "phaserRate" : "delayTime";
    const divisionEndpointID = effectId === "phaser" ? "phaserRateDivision" : "delayDivision";
    const modeDescriptor = descriptor.parameters.find((parameter) => parameter.endpointID === modeEndpointID)!;
    const modeBinding = useRackParameterBinding(modeDescriptor);
    const visibleParameters = descriptor.parameters.filter((parameter) => {
        if (parameter.endpointID === freeEndpointID) {
            return modeBinding.value < 0.5;
        }
        if (parameter.endpointID === divisionEndpointID) {
            return modeBinding.value >= 0.5;
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
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onHudChange={onHudChange}
                    onModulationAmountChange={onModulationAmountChange}
                    onRequestContextMenu={onRequestContextMenu}
                />
            ))}
        </>
    );
}

function ModSourceCarousel({
    pageIndex,
    selectedSource,
    sourceIsArmed,
    onPageChange,
    onSourcePreview,
    onSourceSelect,
    onSourceDrop,
    onOpenSelectedSource,
    onHoverTarget,
    onSourceDragChange,
}: {
    pageIndex: number;
    selectedSource: SelectedSource;
    sourceIsArmed: boolean;
    onPageChange: (pageIndex: number) => void;
    onSourcePreview: (source: SelectedSource) => void;
    onSourceSelect: (source: SelectedSource) => void;
    onSourceDrop: (source: SelectedSource, targetEndpointID: string) => void;
    onOpenSelectedSource: (source: SelectedSource) => void;
    onHoverTarget: (endpointID: string | null) => void;
    onSourceDragChange?: (drag: SourceDragPresentation | null) => void;
}) {
    const handlersRef = useRef({
        onHoverTarget,
        onOpenSelectedSource,
        onSourceDrop,
        onSourceSelect,
        onSourceDragChange,
    });
    handlersRef.current = {
        onHoverTarget,
        onOpenSelectedSource,
        onSourceDrop,
        onSourceSelect,
        onSourceDragChange,
    };
    const autoScrollRef = useRef<{
        clientY: number;
        frame: number | null;
        referenceElement: HTMLElement | null;
    }>({ clientY: 0, frame: null, referenceElement: null });
    const dragRef = useRef<{
        pointerId: number;
        source: SelectedSource;
        moved: boolean;
        startX: number;
        startY: number;
        wasActiveSelection: boolean;
        captureElement: HTMLButtonElement;
    } | null>(null);

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

        const targetElement = cancelled
            ? null
            : rackModulationTargetAtPoint(drag.captureElement, clientX, clientY);
        const targetEndpointID = targetElement?.dataset.rackModTarget;
        dragRef.current = null;
        handlersRef.current.onHoverTarget(null);
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

        if (targetEndpointID) {
            handlersRef.current.onSourceDrop(drag.source, targetEndpointID);
        } else if (!drag.moved) {
            if (drag.wasActiveSelection) {
                handlersRef.current.onOpenSelectedSource(drag.source);
            } else {
                handlersRef.current.onSourceSelect(drag.source);
            }
        }
    }, [stopSourceAutoScroll]);

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

    return (
        <div className="rack-mod-dock" role="group" aria-label="Rack modulation sources">
            <header className="rack-mod-header">
                <strong>MOD BAR</strong>
                <span>GROUP {pageIndex + 1} / {RACK_MODULATION_SOURCE_PAGES.length}</span>
            </header>
            <div className="rack-mod-row">
                <button
                    type="button"
                    className="rack-mod-paddle"
                    aria-label="Previous modulation-source group"
                    onClick={() => onPageChange((pageIndex + RACK_MODULATION_SOURCE_PAGES.length - 1) % RACK_MODULATION_SOURCE_PAGES.length)}
                >‹</button>
                <div className="rack-mod-viewport">
                    <div
                        className="rack-mod-track"
                        data-role="rack-mod-source-track"
                        style={{ transform: `translateX(-${pageIndex * 100}%)`, transitionDuration: "280ms" }}
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
                                            onPointerDown={(event) => {
                                                if (event.pointerType === "mouse" && event.button !== 0) {
                                                    return;
                                                }
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onSourcePreview(source);
                                                dragRef.current = {
                                                    pointerId: event.pointerId,
                                                    source,
                                                    moved: false,
                                                    startX: event.clientX,
                                                    startY: event.clientY,
                                                    wasActiveSelection: isSelected && sourceIsArmed,
                                                    captureElement: event.currentTarget,
                                                };
                                                try {
                                                    event.currentTarget.setPointerCapture(event.pointerId);
                                                } catch {
                                                    // Window-level termination still owns unsupported or synthetic pointers.
                                                }
                                            }}
                                            onPointerMove={(event) => {
                                                const drag = dragRef.current;
                                                if (!drag || drag.pointerId !== event.pointerId) {
                                                    return;
                                                }
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (hasReleasedMouseButton(event)) {
                                                    finishSourceGesture(
                                                        event.pointerId,
                                                        event.clientX,
                                                        event.clientY,
                                                        true,
                                                    );
                                                    return;
                                                }
                                                drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7;
                                                if (drag.moved) {
                                                    handlersRef.current.onSourceDragChange?.({
                                                        source: drag.source,
                                                        clientX: event.clientX,
                                                        clientY: event.clientY,
                                                    });
                                                    updateSourceAutoScroll(event.currentTarget, event.clientY);
                                                }
                                                const target = rackModulationTargetAtPoint(
                                                    event.currentTarget,
                                                    event.clientX,
                                                    event.clientY,
                                                );
                                                onHoverTarget(target?.dataset.rackModTarget ?? null);
                                            }}
                                            onPointerUp={(event) => finishSourceGesture(
                                                event.pointerId,
                                                event.clientX,
                                                event.clientY,
                                                false,
                                            )}
                                            onPointerCancel={(event) => finishSourceGesture(
                                                event.pointerId,
                                                event.clientX,
                                                event.clientY,
                                                true,
                                            )}
                                            onLostPointerCapture={(event) => {
                                                finishSourceGesture(
                                                    event.pointerId,
                                                    event.clientX,
                                                    event.clientY,
                                                    true,
                                                );
                                            }}
                                        >
                                            <span className="rack-mod-art" aria-hidden="true">
                                                <img
                                                    className="rack-mod-icon"
                                                    src={source.iconUrl}
                                                    alt=""
                                                    draggable={false}
                                                />
                                                <span className="rack-mod-number">{source.sourceSlot}</span>
                                            </span>
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
                >›</button>
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

function RackParameterHudOverlay({ hud }: { hud: RackParameterHud }) {
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

type RailVerticalBounds = {
    readonly min: number;
    readonly max: number;
};

function readStoredRailPosition() {
    try {
        const stored = localStorage.getItem(MOBILE_MOD_RAIL_POSITION_KEY);
        if (stored === null) {
            return 0.42;
        }
        const parsed = JSON.parse(stored) as unknown;
        const candidate = typeof parsed === "number"
            ? parsed
            : Number((parsed as { normalizedY?: unknown } | null)?.normalizedY);
        return Number.isFinite(candidate) ? clamp(candidate, 0, 1) : 0.42;
    } catch {
        return 0.42;
    }
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
    onStateChange,
    children,
}: {
    selectedSource: RackModulationSource;
    routeCount: number;
    sourceActivity: number | null;
    sourceDrag: SourceDragPresentation | null;
    accent: string;
    collapseSignal: number;
    onStateChange?: (state: GlobalModRailState) => void;
    children: React.ReactNode;
}) {
    const layerRef = useRef<HTMLDivElement | null>(null);
    const railRef = useRef<HTMLElement | null>(null);
    const positionRef = useRef(0);
    const normalizedPositionRef = useRef<number | null>(null);
    const boundsRef = useRef<RailVerticalBounds>({ min: 12, max: 12 });
    const gestureRef = useRef<{
        pointerId: number;
        startClientY: number;
        startNormalizedY: number;
        startTop: number;
        moved: boolean;
        captureElement: HTMLButtonElement;
    } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [top, setTop] = useState(12);
    const mappingActive = sourceDrag !== null;

    const measureAndClamp = useCallback(() => {
        const layer = layerRef.current;
        const rail = railRef.current;
        if (!layer || !rail || gestureRef.current !== null) {
            return;
        }

        const layerBounds = layer.getBoundingClientRect();
        const layerStyle = getComputedStyle(layer);
        const keyboard = layer.closest(".cosimo-surface")
            ?.querySelector<HTMLElement>('[data-role="sticky-keyboard"]');
        const keyboardBounds = keyboard?.getBoundingClientRect();
        const safeTop = 8 + (Number.parseFloat(layerStyle.paddingTop) || 0);
        const safeBottom = 8 + (Number.parseFloat(layerStyle.paddingBottom) || 0);
        const availableBottom = keyboardBounds
            ? Math.min(layerBounds.height, keyboardBounds.top - layerBounds.top)
            : layerBounds.height;
        const railHeight = rail.getBoundingClientRect().height || 168;
        const nextBounds = {
            min: safeTop,
            max: Math.max(safeTop, availableBottom - railHeight - safeBottom),
        };
        boundsRef.current = nextBounds;

        normalizedPositionRef.current ??= readStoredRailPosition();
        const nextTop = nextBounds.min
            + ((nextBounds.max - nextBounds.min) * normalizedPositionRef.current);
        positionRef.current = nextTop;
        setTop(nextTop);
    }, []);

    useLayoutEffect(() => {
        measureAndClamp();
        const layer = layerRef.current;
        const keyboard = layer?.closest(".cosimo-surface")
            ?.querySelector<HTMLElement>('[data-role="sticky-keyboard"]');
        const observer = typeof ResizeObserver === "function"
            ? new ResizeObserver(measureAndClamp)
            : null;
        if (layer) {
            observer?.observe(layer);
        }
        if (railRef.current) {
            observer?.observe(railRef.current);
        }
        if (keyboard) {
            observer?.observe(keyboard);
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
        // A source deep-link navigates into that source's full editor; the
        // widened tab would otherwise sit over the destination's Back bar.
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

    const finishRailGesture = useCallback((pointerId: number, cancelled: boolean) => {
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
            normalizedPositionRef.current = gesture.startNormalizedY;
            positionRef.current = gesture.startTop;
            setTop(gesture.startTop);
            return;
        }
        if (!gesture.moved) {
            setExpanded((current) => !current);
            return;
        }

        const bounds = boundsRef.current;
        const middle = bounds.min + ((bounds.max - bounds.min) / 2);
        const anchors = [bounds.min, middle, bounds.max];
        const nearest = anchors.reduce((candidate, anchor) => (
            Math.abs(anchor - positionRef.current) < Math.abs(candidate - positionRef.current)
                ? anchor
                : candidate
        ), anchors[0] ?? bounds.min);
        const settledTop = Math.abs(nearest - positionRef.current) <= MOBILE_MOD_RAIL_SNAP_DISTANCE_PX
            ? nearest
            : clamp(positionRef.current, bounds.min, bounds.max);
        if (settledTop !== positionRef.current) {
            triggerLightHaptic();
        }
        positionRef.current = settledTop;
        setTop(settledTop);
        const span = bounds.max - bounds.min;
        const normalizedY = span > 0 ? (settledTop - bounds.min) / span : 0;
        normalizedPositionRef.current = normalizedY;
        try {
            localStorage.setItem(MOBILE_MOD_RAIL_POSITION_KEY, JSON.stringify({ normalizedY }));
        } catch {
            // A private browsing storage failure must not break rail movement.
        }
    }, []);

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishRailGesture(event.pointerId, false);
        const handlePointerCancel = (event: PointerEvent) => finishRailGesture(event.pointerId, true);
        const cancelActiveGesture = () => {
            const gesture = gestureRef.current;
            if (gesture) {
                finishRailGesture(gesture.pointerId, true);
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
        };
    }, [finishRailGesture]);

    const clampedActivity = sourceActivity === null ? null : clamp(sourceActivity, 0, 1);

    return (
        <div ref={layerRef} data-role="mobile-global-mod-rail-layer" className="mobile-global-mod-rail-layer">
            <aside
                ref={railRef}
                data-role="mobile-global-mod-rail"
                data-expanded={expanded}
                data-mapping-active={mappingActive}
                className="mobile-global-mod-rail"
                style={{
                    top,
                    "--source-color": selectedSource.accent,
                    "--editor-accent": accent,
                } as CSSProperties}
                aria-label="Global modulation bar"
            >
                <span
                    data-role="mobile-global-mod-rail-shoulder"
                    className="mobile-global-mod-rail-shoulder is-top"
                    aria-hidden="true"
                />
                <span
                    data-role="mobile-global-mod-rail-shoulder"
                    className="mobile-global-mod-rail-shoulder is-bottom"
                    aria-hidden="true"
                />
                <div data-role="mobile-global-mod-rail-body" className="mobile-global-mod-rail-body">
                    <div
                        data-role="mobile-global-mod-rail-drawer"
                        className="mobile-global-mod-rail-drawer"
                        aria-hidden={!expanded || mappingActive}
                        inert={!expanded || mappingActive}
                    >
                        {children}
                    </div>
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
                            gestureRef.current = {
                                pointerId: event.pointerId,
                                startClientY: event.clientY,
                                startNormalizedY: normalizedPositionRef.current ?? readStoredRailPosition(),
                                startTop: positionRef.current,
                                moved: false,
                                captureElement: event.currentTarget,
                            };
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
                            const deltaY = event.clientY - gesture.startClientY;
                            gesture.moved ||= Math.abs(deltaY) > MOBILE_MOD_RAIL_DRAG_THRESHOLD_PX;
                            if (!gesture.moved) {
                                return;
                            }
                            const bounds = boundsRef.current;
                            const nextTop = clamp(gesture.startTop + deltaY, bounds.min, bounds.max);
                            positionRef.current = nextTop;
                            const span = bounds.max - bounds.min;
                            normalizedPositionRef.current = span > 0
                                ? (nextTop - bounds.min) / span
                                : 0;
                            setTop(nextTop);
                        }}
                        onPointerUp={(event) => finishRailGesture(event.pointerId, false)}
                        onPointerCancel={(event) => finishRailGesture(event.pointerId, true)}
                        onLostPointerCapture={(event) => finishRailGesture(event.pointerId, true)}
                    >
                        <span className="mobile-global-mod-rail-handle" aria-hidden="true" />
                        <span
                            data-role="mobile-global-mod-rail-selected"
                            className="mobile-global-mod-rail-selected"
                            aria-label={`${selectedSource.label} selected`}
                        >
                            <span className="rack-mod-art" aria-hidden="true">
                                <img className="rack-mod-icon" src={selectedSource.iconUrl} alt="" draggable={false} />
                                <span className="rack-mod-number">{selectedSource.sourceSlot}</span>
                            </span>
                        </span>
                        {clampedActivity !== null ? (
                            <span
                                className="mobile-global-mod-rail-activity"
                                aria-label={`${selectedSource.label} activity`}
                                style={{ "--source-activity": clampedActivity } as CSSProperties}
                            ><span /></span>
                        ) : null}
                        <span
                            data-role="mobile-global-mod-rail-route-count"
                            className="mobile-global-mod-rail-route-count"
                            aria-label={`${routeCount} modulation routes`}
                        >{routeCount}</span>
                        <span className="mobile-global-mod-rail-chevron" aria-hidden="true">{expanded ? "›" : "‹"}</span>
                    </button>
                </div>
            </aside>
            {sourceDrag ? (
                <div
                    data-role="mobile-global-mod-source-ghost"
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
                    <img
                        src={findRackModulationSource(
                            sourceDrag.source.sourceKind,
                            sourceDrag.source.sourceSlot,
                        ).iconUrl}
                        alt=""
                        draggable={false}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ModulationAmountControl({
    source,
    target,
    amount,
    onChange,
}: {
    source: RackModulationSource;
    target: RackParameterDescriptor;
    amount: number;
    onChange: (amount: number) => void;
}) {
    const sliderRef = useRef<HTMLButtonElement | null>(null);
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
    } = useSliderDrag();
    const targetKind = `rack.${target.endpointID}` as RackModulationTargetKind;
    const sliderPosition = getModulationAmountSliderPosition(targetKind, amount);
    const binding = useMemo<PatchControlBinding<number>>(() => ({
        endpointID: "rackModulationAmount",
        value: sliderPosition,
        setValue: () => undefined,
        commitValue: () => undefined,
        beginGesture: () => undefined,
        endGesture: () => undefined,
    }), [sliderPosition]);
    const handleNormalizedChange = useCallback((normalized: number) => {
        onChange(composeModulationAmount(targetKind, normalized));
    }, [onChange, targetKind]);
    const fillStart = Math.min(0.5, sliderPosition);
    const fillWidth = Math.abs(sliderPosition - 0.5);

    return (
        <section className="rack-mod-amount" aria-label="Selected modulation mapping amount">
            <div className="rack-mod-amount-label">
                <span><strong>AMOUNT</strong>{source.label} → {getRackEffectDescriptor(target.effectId).label} {target.shortLabel}</span>
                <output>{formatModulationAmountReadout(targetKind, amount)}</output>
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
                aria-valuetext={formatModulationAmountReadout(targetKind, amount)}
                className="rack-mod-amount-slider"
                onPointerDown={(event) => handlePointerDown(
                    event,
                    sliderRef.current,
                    binding,
                    sliderPosition,
                    0,
                    1,
                    "horizontal",
                    handleNormalizedChange,
                )}
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
    routeLimitReached,
    onCreate,
}: {
    source: RackModulationSource;
    target: RackParameterDescriptor;
    routeLimitReached: boolean;
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
                disabled={routeLimitReached}
                onClick={onCreate}
            >
                {routeLimitReached ? `ROUTE LIMIT REACHED · ${MODULATION_MAX_ROUTES}/${MODULATION_MAX_ROUTES}` : "CREATE MAPPING +"}
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
    { action: "remove-route", label: "Remove this route" },
    { action: "remove-all-target-routes", label: "Remove all routes to target…" },
] as const;

type RackParameterMenuAction = typeof RACK_PARAMETER_MENU_ITEMS[number]["action"];

function RackParameterContextMenu({
    state,
    route,
    onClose,
    onSelectAction,
}: {
    state: RackParameterMenuState;
    route: ModulationRoute | null;
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
                    .filter((item) => item.action !== "reducer"
                        || (route !== null && isVoiceModulationSource(route.sourceKind)))
                    .map((item) => {
                        const label = item.action === "toggle-route"
                            ? (route?.enabled === false ? "Enable route" : "Bypass route")
                            : item.action === "polarity"
                                ? `Polarity: ${route?.polarity === "bipolar" ? "Bipolar" : "Unipolar"}`
                                : item.action === "reducer"
                                    ? `Voice reducer: ${route?.reducer === "mean" ? "Mean" : "Maximum"}`
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
    source: RackModulationSource;
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
                    <span>{source.label} amount</span>
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
                {route === null ? <p data-role="rack-value-sheet-no-route">No selected source route.</p> : null}
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
    className,
}: EffectsRackWorkspaceProps) {
    const { rackState, commit } = useRackState();
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
    const parameterOverlayRouteIndex = routes.findIndex((route) => (
        route.sourceKind === selectedSource.sourceKind
        && route.sourceSlot === selectedSource.sourceSlot
        && route.targetKind === parameterOverlayTargetKind
    ));
    const parameterOverlayRoute = parameterOverlayRouteIndex >= 0
        ? routes[parameterOverlayRouteIndex] ?? null
        : null;
    const parameterOverlayTargetRouteIndices = routes.flatMap((route, routeIndex) => (
        route.targetKind === parameterOverlayTargetKind ? [routeIndex] : []
    ));

    useEffect(() => {
        const pending = pendingRouteRef.current;
        if (!pending || pending.key !== selectedPairKey || selectedRouteIndex < 0) {
            return;
        }
        pendingRouteRef.current = null;
        setRouteStatus("");
    }, [selectedPairKey, selectedRouteIndex]);

    const commitOrder = useCallback((order: ReadonlyArray<EffectModuleId>) => {
        commit({ ...rackState, order: [...order] });
    }, [commit, rackState]);

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
        } else if (!shouldCommit) {
            previewOrderRef.current = gesture.originalOrder;
            setPreviewOrder(gesture.originalOrder);
        }
    }, [commitOrder]);

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

    const createRoute = useCallback((
        source: SelectedSource,
        targetEndpointID: string,
    ) => {
        const targetKind = `rack.${targetEndpointID}` as RackModulationTargetKind;
        const existingIndex = routes.findIndex((route) => (
            route.sourceKind === source.sourceKind
            && route.sourceSlot === source.sourceSlot
            && route.targetKind === targetKind
        ));

        if (existingIndex >= 0) {
            setRouteStatus("");
            return existingIndex;
        }

        const key = `${source.sourceKind}:${source.sourceSlot}:${targetKind}`;
        if (pendingRouteRef.current?.key === key) {
            return -1;
        }

        if (routes.length >= MODULATION_MAX_ROUTES) {
            setRouteStatus(`ROUTE LIMIT REACHED · ${MODULATION_MAX_ROUTES}/${MODULATION_MAX_ROUTES}`);
            return -1;
        }

        pendingRouteRef.current = { key };
        onAddRouteWithOverrides({
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind,
            amount: 0,
            polarity: "unipolar",
            reducer: "max",
            enabled: true,
        });
        setRouteStatus("CREATING MAPPING…");
        return -1;
    }, [onAddRouteWithOverrides, routes]);

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

    const selectSource = useCallback((source: SelectedSource) => {
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        setRouteStatus("");
    }, []);

    const dropSource = useCallback((source: SelectedSource, targetEndpointID: string) => {
        const targetParameter = getRackParameterDescriptor(targetEndpointID);
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        if (targetParameter && targetParameter.modulationTargetIndex !== null) {
            setSelectedTargetEndpointID(targetEndpointID);
            setSelectedEffectId(targetParameter.effectId);
            onSelectedEffectChange?.(targetParameter.effectId);
        }
        createRoute(source, targetEndpointID);
    }, [createRoute, onSelectedEffectChange]);

    const changeSourcePage = useCallback((nextPageIndex: number) => {
        const normalizedPageIndex = ((nextPageIndex % RACK_MODULATION_SOURCE_PAGES.length)
            + RACK_MODULATION_SOURCE_PAGES.length) % RACK_MODULATION_SOURCE_PAGES.length;
        setSourcePageIndex(normalizedPageIndex);
        setSelectedSource((source) => ({ ...source, sourceSlot: (normalizedPageIndex + 1) as 1 | 2 | 3 }));
        setRouteStatus("");
    }, []);

    const changeModulationAmount = useCallback((nextAmount: number) => {
        if (selectedRouteIndex < 0 || selectedRoute === null) {
            setRouteStatus("NOT MAPPED · CREATE MAPPING +");
            return;
        }
        onRouteChange(selectedRouteIndex, { amount: nextAmount });
    }, [onRouteChange, selectedRoute, selectedRouteIndex]);

    const changeParameterModulationAmount = useCallback((endpointID: string, nextAmount: number) => {
        const targetKind = `rack.${endpointID}` as RackModulationTargetKind;
        const routeIndex = routes.findIndex((route) => (
            route.sourceKind === selectedSource.sourceKind
            && route.sourceSlot === selectedSource.sourceSlot
            && route.targetKind === targetKind
        ));

        setSelectedTargetEndpointID(endpointID);
        if (routeIndex >= 0) {
            onRouteChange(routeIndex, { amount: nextAmount });
            return;
        }
        setRouteStatus("NOT MAPPED · CREATE MAPPING +");
    }, [onRouteChange, routes, selectedSource]);

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

    const modulationControls = (
        <>
            <ModSourceCarousel
                pageIndex={sourcePageIndex}
                selectedSource={selectedSource}
                sourceIsArmed={sourceIsArmed}
                onPageChange={changeSourcePage}
                onSourcePreview={(source) => {
                    setSelectedSource(source);
                    setSourcePageIndex(source.sourceSlot - 1);
                }}
                onSourceSelect={selectSource}
                onSourceDrop={dropSource}
                onOpenSelectedSource={(source) => {
                    setRailCollapseSignal((current) => current + 1);
                    onOpenModSource?.(source);
                }}
                onHoverTarget={setHoverTargetEndpointID}
                onSourceDragChange={setSourceDrag}
            />
            {selectedRoute ? (
                <ModulationAmountControl
                    source={activeSource}
                    target={selectedTarget}
                    amount={selectedRoute.amount}
                    onChange={changeModulationAmount}
                />
            ) : sourceIsArmed ? (
                <UnmappedModulationPair
                    source={activeSource}
                    target={selectedTarget}
                    routeLimitReached={routes.length >= MODULATION_MAX_ROUTES}
                    onCreate={() => createRoute(selectedSource, selectedTarget.endpointID)}
                />
            ) : null}
            <output className="rack-route-status" aria-live="polite">
                {routeStatus || (hoverTargetEndpointID ? `Route to ${hoverTargetEndpointID}` : "")}
            </output>
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
                    onClose={() => setParameterMenu(null)}
                    onSelectAction={handleParameterMenuAction}
                />
            ) : null}
            {parameterValueSheetEndpointID ? (
                <RackParameterValueSheet
                    key={`${parameterValueSheetEndpointID}:${selectedSource.sourceKind}:${selectedSource.sourceSlot}`}
                    descriptor={parameterOverlayDescriptor}
                    binding={parameterOverlayBinding}
                    route={parameterOverlayRoute}
                    source={activeSource}
                    onApply={(baseValue, modulationAmount) => {
                        parameterOverlayBinding.commitValue(baseValue);
                        if (parameterOverlayRouteIndex >= 0 && modulationAmount !== null) {
                            onRouteChange(parameterOverlayRouteIndex, {
                                amount: modulationAmount,
                            });
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
                    className="rack-effect-editor"
                    style={{ "--editor-accent": EFFECT_ACCENTS[selectedEffectId] } as CSSProperties}
                    aria-label="Selected effect editor"
                >
                    <header className="rack-editor-header">
                        <span>SELECTED FX</span>
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
                            onSelectTarget={selectTarget}
                            onRecentParameter={(endpointID) => setRecentParameter(selectedEffectId, endpointID)}
                            onHudChange={setParameterHud}
                            onModulationAmountChange={changeParameterModulationAmount}
                            onRequestContextMenu={(endpointID, clientX, clientY) => {
                                selectTarget(endpointID);
                                setParameterMenu({ endpointID, clientX, clientY });
                            }}
                        />
                    </div>
                    <div className="rack-editor-modulation">
                        {mobileGlobalModRail ? null : modulationControls}
                    </div>
                </section>
            </div>
            {mobileGlobalModRail && mobileModRailPortalTarget ? createPortal(
                <MobileGlobalModRail
                    selectedSource={activeSource}
                    routeCount={routes.length}
                    sourceActivity={globalModSourceActivity}
                    sourceDrag={sourceDrag}
                    accent={EFFECT_ACCENTS[selectedEffectId]}
                    collapseSignal={railCollapseSignal}
                    onStateChange={onGlobalModRailStateChange}
                >
                    {modulationControls}
                </MobileGlobalModRail>,
                mobileModRailPortalTarget,
            ) : null}
        </section>
    );
}
