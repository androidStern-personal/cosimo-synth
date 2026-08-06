import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

import { usePatchConnection } from "../shared/cmajor-react";
import { usePatchParameterBinding, type PatchControlBinding } from "../shared/patch-controls";
import {
    RACK_EFFECT_DESCRIPTORS,
    formatRackParameterValue,
    getRackEffectDescriptor,
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
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
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
import { FilterResponseGraph, VerticalSlider } from "../shared/synth-components";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import type { SynthPatchViewModel } from "../shared/synth-hooks";
import { useSliderDrag } from "../shared/use-slider-drag";

type EffectsRackWorkspaceProps = {
    routes: ModulationRoute[];
    observedFilterSpectrum: SynthPatchViewModel["observedFilterSpectrum"];
    observedDistortionHistory: SynthPatchViewModel["observedDistortionHistory"];
    observedDistortionScope: SynthPatchViewModel["observedDistortionScope"];
    onAddRouteWithOverrides: (overrides: Partial<ModulationRoute>) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onBackToVoice: () => void;
    className?: string;
};

type SelectedSource = Pick<RackModulationSource, "sourceKind" | "sourceSlot">;

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

function useRackParameterBinding(descriptor: RackParameterDescriptor) {
    const coerce = useCallback((rawValue: unknown) => {
        const numericValue = Number(rawValue);
        const fallback = Number.isFinite(numericValue) ? numericValue : descriptor.initial;
        return clamp(fallback, descriptor.min, descriptor.max);
    }, [descriptor.initial, descriptor.max, descriptor.min]);

    return usePatchParameterBinding<number>({
        endpointID: descriptor.endpointID,
        initialValue: descriptor.initial,
        coerce,
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
    activeSourceAccent,
    hovered,
    onSelect,
    onRecentParameter,
}: {
    descriptor: RackParameterDescriptor;
    routes: ReadonlyArray<ModulationRoute>;
    selected: boolean;
    activeSourceAccent: string;
    hovered: boolean;
    onSelect: () => void;
    onRecentParameter: (endpointID: string) => void;
}) {
    const binding = useRackParameterBinding(descriptor);
    const isTarget = descriptor.modulationTargetIndex !== null;
    const hasRoute = isTarget && routes.some((route) => isRouteForTarget(route, descriptor.endpointID));
    const rootStyle = { "--active-source-color": activeSourceAccent } as CSSProperties;
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
            onPointerDownCapture={selectParameter}
        >
            <VerticalSlider
                label={descriptor.shortLabel}
                binding={binding}
                min={descriptor.min}
                max={descriptor.max}
                bipolar={descriptor.min < 0 && descriptor.max > 0}
                fillClassName="rack-control-fill"
                handleClassName="rack-control-handle"
                fillDataRole={`rack-parameter-fill-${descriptor.endpointID}`}
                handleDataRole={RACK_HANDLE_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-handle-${descriptor.endpointID}`}
                inputDataRole={controlDataRole}
                trackDataRole={RACK_TRACK_ROLE_ALIASES[descriptor.endpointID] ?? `rack-parameter-track-${descriptor.endpointID}`}
                formatValue={(value) => formatRackParameterValue(descriptor, value)}
                normalizedFromValue={(value) => normalizedRackParameterValue(descriptor, value)}
                valueFromNormalized={(normalized) => rackParameterValueFromNormalized(descriptor, normalized)}
                className="h-full w-full"
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
    activeSourceAccent,
    onSelectTarget,
    onRecentParameter,
}: {
    effectId: EffectModuleId;
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSourceAccent: string;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
}) {
    const descriptor = getRackEffectDescriptor(effectId);

    if (effectId === "phaser" || effectId === "delay") {
        return (
            <SyncParameterList
                effectId={effectId}
                routes={routes}
                selectedTargetEndpointID={selectedTargetEndpointID}
                hoverTargetEndpointID={hoverTargetEndpointID}
                activeSourceAccent={activeSourceAccent}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
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
                    activeSourceAccent={activeSourceAccent}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
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
    activeSourceAccent,
    onSelectTarget,
    onRecentParameter,
}: {
    effectId: "phaser" | "delay";
    routes: ReadonlyArray<ModulationRoute>;
    selectedTargetEndpointID: string;
    hoverTargetEndpointID: string | null;
    activeSourceAccent: string;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
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
                    activeSourceAccent={activeSourceAccent}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                />
            ))}
        </>
    );
}

function ModSourceCarousel({
    pageIndex,
    selectedSource,
    onPageChange,
    onSourcePreview,
    onSourceActivate,
    onHoverTarget,
}: {
    pageIndex: number;
    selectedSource: SelectedSource;
    onPageChange: (pageIndex: number) => void;
    onSourcePreview: (source: SelectedSource) => void;
    onSourceActivate: (source: SelectedSource, targetEndpointID?: string) => void;
    onHoverTarget: (endpointID: string | null) => void;
}) {
    const dragRef = useRef<{
        pointerId: number;
        source: SelectedSource;
        moved: boolean;
        startX: number;
        startY: number;
    } | null>(null);

    const finishSourceGesture = useCallback((event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        const targetElement = rackModulationTargetAtPoint(event.currentTarget, event.clientX, event.clientY);
        const targetEndpointID = targetElement?.dataset.rackModTarget;
        dragRef.current = null;
        onHoverTarget(null);

        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Pointer capture may already have been released by the browser.
        }

        if (cancelled) {
            return;
        }

        if (targetEndpointID) {
            onSourceActivate(drag.source, targetEndpointID);
        } else if (!drag.moved) {
            onSourceActivate(drag.source);
        }
    }, [onHoverTarget, onSourceActivate]);

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
                                    const isSelected = source.sourceKind === selectedSource.sourceKind
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
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragRef.current = {
                                                    pointerId: event.pointerId,
                                                    source,
                                                    moved: false,
                                                    startX: event.clientX,
                                                    startY: event.clientY,
                                                };
                                            }}
                                            onPointerMove={(event) => {
                                                const drag = dragRef.current;
                                                if (!drag || drag.pointerId !== event.pointerId) {
                                                    return;
                                                }
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (hasReleasedMouseButton(event)) {
                                                    finishSourceGesture(event, true);
                                                    return;
                                                }
                                                drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
                                                const target = rackModulationTargetAtPoint(
                                                    event.currentTarget,
                                                    event.clientX,
                                                    event.clientY,
                                                );
                                                onHoverTarget(target?.dataset.rackModTarget ?? null);
                                            }}
                                            onPointerUp={(event) => finishSourceGesture(event, false)}
                                            onPointerCancel={(event) => finishSourceGesture(event, true)}
                                            onLostPointerCapture={(event) => {
                                                if (dragRef.current?.pointerId === event.pointerId) {
                                                    dragRef.current = null;
                                                    onHoverTarget(null);
                                                }
                                            }}
                                        >
                                            <img src={source.iconUrl} alt="" draggable={false} />
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

export function EffectsRackWorkspace({
    routes,
    observedFilterSpectrum,
    observedDistortionHistory,
    observedDistortionScope,
    onAddRouteWithOverrides,
    onRouteChange,
    onBackToVoice,
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
    const [draftAmount, setDraftAmount] = useState<number | null>(null);
    const pendingRouteRef = useRef<{ key: string; amount: number } | null>(null);

    useEffect(() => {
        previewOrderRef.current = rackState.order;
        setPreviewOrder(rackState.order);
    }, [rackState.order]);

    const selectedEffect = getRackEffectDescriptor(selectedEffectId);
    const selectedTarget = RACK_EFFECT_DESCRIPTORS
        .flatMap((effect) => effect.parameters)
        .find((parameter) => parameter.endpointID === selectedTargetEndpointID
            && parameter.modulationTargetIndex !== null)
        ?? selectedEffect.parameters.find((parameter) => parameter.modulationTargetIndex !== null)
        ?? selectedEffect.parameters[0];
    const activeSource = findRackModulationSource(selectedSource.sourceKind, selectedSource.sourceSlot);
    const selectedTargetKind = `rack.${selectedTarget.endpointID}` as RackModulationTargetKind;
    const selectedRouteIndex = routes.findIndex((route) => (
        route.sourceKind === selectedSource.sourceKind
        && route.sourceSlot === selectedSource.sourceSlot
        && route.targetKind === selectedTargetKind
    ));
    const selectedRoute = selectedRouteIndex >= 0 ? routes[selectedRouteIndex] : null;
    const selectedPairKey = `${selectedSource.sourceKind}:${selectedSource.sourceSlot}:${selectedTargetKind}`;

    useEffect(() => {
        const pending = pendingRouteRef.current;
        if (!pending || pending.key !== selectedPairKey || selectedRouteIndex < 0) {
            return;
        }

        const route = routes[selectedRouteIndex];
        if (route && Math.abs(route.amount - pending.amount) > 1e-9) {
            onRouteChange(selectedRouteIndex, { amount: pending.amount, enabled: true });
        }
        pendingRouteRef.current = null;
    }, [onRouteChange, routes, selectedPairKey, selectedRouteIndex]);

    useEffect(() => {
        if (draftAmount !== null && selectedRoute && Math.abs(selectedRoute.amount - draftAmount) <= 1e-9) {
            setDraftAmount(null);
        }
    }, [draftAmount, selectedRoute]);

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

    const ensureRoute = useCallback((
        source: SelectedSource,
        targetEndpointID: string,
        initialAmount = 0,
    ) => {
        const targetKind = `rack.${targetEndpointID}` as RackModulationTargetKind;
        const existingIndex = routes.findIndex((route) => (
            route.sourceKind === source.sourceKind
            && route.sourceSlot === source.sourceSlot
            && route.targetKind === targetKind
        ));

        if (existingIndex >= 0) {
            if (!routes[existingIndex]?.enabled) {
                onRouteChange(existingIndex, { enabled: true });
            }
            setRouteStatus("");
            return existingIndex;
        }

        const key = `${source.sourceKind}:${source.sourceSlot}:${targetKind}`;
        if (pendingRouteRef.current?.key === key) {
            pendingRouteRef.current.amount = initialAmount;
            return -1;
        }

        if (routes.length >= MODULATION_MAX_ROUTES) {
            setRouteStatus(`Route limit reached (${MODULATION_MAX_ROUTES})`);
            return -1;
        }

        pendingRouteRef.current = { key, amount: initialAmount };
        onAddRouteWithOverrides({
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind,
            amount: initialAmount,
            polarity: "unipolar",
            reducer: "max",
            enabled: true,
        });
        setRouteStatus("");
        return -1;
    }, [onAddRouteWithOverrides, onRouteChange, routes]);

    const selectEffect = useCallback((effectId: EffectModuleId) => {
        setSelectedEffectId(effectId);
        const effect = getRackEffectDescriptor(effectId);
        const preferredEndpointID = quickEndpointByEffect[effectId];
        const preferred = effect.parameters.find((parameter) => (
            parameter.endpointID === preferredEndpointID && parameter.modulationTargetIndex !== null
        ));
        const target = preferred ?? effect.parameters.find((parameter) => parameter.modulationTargetIndex !== null);
        if (target) {
            setSelectedTargetEndpointID(target.endpointID);
            setDraftAmount(null);
            if (sourceIsArmed) {
                ensureRoute(selectedSource, target.endpointID);
            }
        }
    }, [ensureRoute, quickEndpointByEffect, selectedSource, sourceIsArmed]);

    const selectTarget = useCallback((endpointID: string) => {
        const parameter = RACK_EFFECT_DESCRIPTORS.flatMap((effect) => effect.parameters)
            .find((candidate) => candidate.endpointID === endpointID);
        if (!parameter || parameter.modulationTargetIndex === null) {
            return;
        }
        setSelectedTargetEndpointID(endpointID);
        setSelectedEffectId(parameter.effectId);
        setDraftAmount(null);
        if (sourceIsArmed) {
            ensureRoute(selectedSource, endpointID);
        }
    }, [ensureRoute, selectedSource, sourceIsArmed]);

    const activateSource = useCallback((source: SelectedSource, targetEndpointID = selectedTarget.endpointID) => {
        const targetParameter = RACK_EFFECT_DESCRIPTORS.flatMap((effect) => effect.parameters)
            .find((parameter) => parameter.endpointID === targetEndpointID);
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        if (targetParameter && targetParameter.modulationTargetIndex !== null) {
            setSelectedTargetEndpointID(targetEndpointID);
            setSelectedEffectId(targetParameter.effectId);
        }
        setDraftAmount(null);
        ensureRoute(source, targetEndpointID);
    }, [ensureRoute, selectedTarget.endpointID]);

    const changeSourcePage = useCallback((nextPageIndex: number) => {
        const normalizedPageIndex = ((nextPageIndex % RACK_MODULATION_SOURCE_PAGES.length)
            + RACK_MODULATION_SOURCE_PAGES.length) % RACK_MODULATION_SOURCE_PAGES.length;
        setSourcePageIndex(normalizedPageIndex);
        setSelectedSource((source) => ({ ...source, sourceSlot: (normalizedPageIndex + 1) as 1 | 2 | 3 }));
        setDraftAmount(null);
    }, []);

    const changeModulationAmount = useCallback((nextAmount: number) => {
        setSourceIsArmed(true);
        setDraftAmount(nextAmount);
        if (selectedRouteIndex >= 0) {
            onRouteChange(selectedRouteIndex, { amount: nextAmount, enabled: true });
            return;
        }
        ensureRoute(selectedSource, selectedTarget.endpointID, nextAmount);
    }, [ensureRoute, onRouteChange, selectedRouteIndex, selectedSource, selectedTarget.endpointID]);

    const setRecentParameter = useCallback((effectId: EffectModuleId, endpointID: string) => {
        setQuickEndpointByEffect((current) => ({ ...current, [effectId]: endpointID }));
    }, []);

    const displayAmount = draftAmount ?? selectedRoute?.amount ?? 0;

    return (
        <section
            data-role="effects-rack-card"
            data-layout-card="mobile-effects-workspace"
            className={`effects-rack-workspace ${className ?? ""}`}
        >
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
                                    captureElement.setPointerCapture(event.pointerId);
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
                            activeSourceAccent={activeSource.accent}
                            onSelectTarget={selectTarget}
                            onRecentParameter={(endpointID) => setRecentParameter(selectedEffectId, endpointID)}
                        />
                    </div>
                    <div className="rack-editor-modulation">
                        <ModSourceCarousel
                            pageIndex={sourcePageIndex}
                            selectedSource={selectedSource}
                            onPageChange={changeSourcePage}
                            onSourcePreview={(source) => {
                                setSelectedSource(source);
                                setSourcePageIndex(source.sourceSlot - 1);
                                setDraftAmount(null);
                            }}
                            onSourceActivate={activateSource}
                            onHoverTarget={setHoverTargetEndpointID}
                        />
                        <ModulationAmountControl
                            source={activeSource}
                            target={selectedTarget}
                            amount={displayAmount}
                            onChange={changeModulationAmount}
                        />
                        <output className="rack-route-status" aria-live="polite">
                            {routeStatus || (hoverTargetEndpointID ? `Route to ${hoverTargetEndpointID}` : "")}
                        </output>
                    </div>
                </section>
            </div>
        </section>
    );
}
