import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    type Ref,
} from "react";
import { parseLaneModulationTargetKind } from "../shared/lane-modulation-targets";
import { createPortal } from "react-dom";

import {
    ParameterHudLayerContext,
    useParameterHudSuppression,
    type ParameterHudVisualization,
} from "../shared/parameter-hud";

import { usePatchConnection } from "../shared/cmajor-react";
import {
    createEditorCurvePlotRect,
    normalizedCurvePointToPlotPoint,
    plotPointToNormalizedCurvePoint,
} from "../shared/editor-curve-geometry";
import { type PatchControlBinding } from "../shared/patch-controls";
import {
    RACK_EFFECT_DESCRIPTORS,
    formatRackParameterValue,
    getRackEffectDescriptor,
    getRackParameterDescriptor,
    rackModulationIdentityEndpointID,
    type RackEffectDescriptor,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import {
    formatParameterEntry,
    parameterEntrySpecForModulationAmount,
    parameterEntrySpecForKeyTrackModulationAmount,
    parameterEntrySpecForKeyTrackOffset,
    parameterEntrySpecForFrequency,
    parameterEntrySpecForRackParameter,
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
    parseParameterEntry,
    type ParameterEntryCommit,
} from "../shared/parameter-value-entry";
import { EFFECT_ID_TO_LANE_TYPE, LANE_MAX_BRANCHES_PER_GROUP, LANE_TYPE_TO_EFFECT_ID } from "../shared/lane-state";
import {
    addLaneDevice,
    dissolveLaneGroup,
    findLaneDevicePath,
    getLaneDeviceEnabled,
    listLaneDeviceInstancesV2,
    moveLaneDevice,
    parseLaneDevicePath,
    serializeLaneStateV2,
    setLaneDeviceEnabled,
    setLaneGroupBranchCount,
    parseLaneInstanceId,
    removeLaneDevice,
    setLaneGroupEnabled,
    LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
    LANE_SPLIT_DEFAULT_XOVER_LOW_HZ,
    wrapLaneDeviceInGroup,
    type LaneDevicePathV2,
    type LaneGroupV2,
    type LaneStateV2,
} from "../shared/lane-state-v2";
import {
    useLaneKeyTrackControlBinding,
    useLaneParameterBinding,
    useLaneSoloAudition,
    useLaneStateDoc,
} from "../shared/lane-param-bindings";
import {
    getKeyTrackDefinition,
    keyTrackRouteAmountFromSemitones,
    keyTrackRouteAmountToSemitones,
    requireKeyTrackRange,
    type KeyTrackParameterFamily,
    type KeyTrackRouteStorage,
} from "../shared/key-track";
import {
    MODULATION_SOURCE_OPTIONS,
    parseAnyModulationTargetKind,
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
    isVoiceModulationSource,
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
    MOBILE_MOD_RAIL_BASE_GEOMETRY,
    normalizeRailTop,
    parseStoredRailDock,
    projectRailDefaultPlacement,
    projectRailDrawerPlacement,
    projectRailTop,
    railVerticalBounds,
    serializeRailDock,
    scaleMobileModRailGeometry,
    settleRailEdge,
    snapRailTop,
    type RailDock,
    type RailDrawerMetrics,
    type RailDrawerPlacement,
    type RailEdge,
    type RailVerticalBounds,
} from "../shared/mod-rail-perimeter";
import {
    MOD_BAR_MAX_SCALE,
    MOD_BAR_MIN_SCALE,
    updateModBarPreferences,
    type ModBarPreferences,
} from "../shared/mod-bar-preferences";
import { presentRouteWithCanonicalAmount, useModulationRouteAmountBinding } from "../shared/modulation-route-amount";
import {
    laneBaseKindForRackEndpoint,
    parseModulationTargetKind,
} from "../shared/modulation-targets";
import {
    ParameterContextMenu,
    ParameterValueSheet,
    RemoveTargetRoutesConfirmation,
    useParameterMenu,
    type ParameterMenuAction,
} from "../shared/parameter-context-menu";
import {
    RACK_MODULATION_SOURCE_PAGES,
    findRackModulationSource,
    rackModulationSourceBadgeLabel,
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
import { BROWSER_AUDIO_LEAVE_EVENT } from "../shared/browser-audio-events";
import { PrecisionNumberField } from "./desktop-precision-number-field";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import {
    GLIDE_TIME_MAX_SECONDS,
    GLIDE_TIME_MIN_SECONDS,
    GLIDE_TIME_STEP_SECONDS,
    type SynthPatchViewModel,
} from "../shared/synth-hooks";
import { useSliderDrag, type SliderDragPointer } from "../shared/use-slider-drag";
import { clearUiTimeout, uiTimeout } from "../shared/ui-timers";
import {
    PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
    PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
    useParameterGesture,
} from "../shared/parameter-gesture";
import {
    BaseParameterKnob,
    RackParameterKnob,
    type ParameterKnobDescriptor,
} from "./rack-parameter-knob";
import { SubwayMapColumn, formatCrossoverHz, type SubwayGroupMenuRequest, type SubwayStationMenuRequest } from "./subway-map-column";
import {
    POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
    POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
} from "../shared/polish";

type EffectsRackWorkspaceProps = {
    routes: ModulationRoute[];
    observedFilterSpectrum: SynthPatchViewModel["observedFilterSpectrum"];
    observedDistortionHistory: SynthPatchViewModel["observedDistortionHistory"];
    observedDistortionScope: SynthPatchViewModel["observedDistortionScope"];
    polishEnhancerAmount: PatchControlBinding<number>;
    polishCompressionClipAmount: PatchControlBinding<number>;
    polishOutputTrimDb: PatchControlBinding<number>;
    onAddRouteWithOverrides: (overrides: GeneratedModulationRouteInput) => boolean;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onBackToVoice: () => void;
    onModSourceTap?: (source: SelectedSource) => void;
    /**
     * Voice/FX use one tap to toggle their quick source sheet. Mod and the
     * horizontal desktop rail retain select-first, open-on-second-tap.
     */
    modSourceTapMode?: "select-then-open" | "toggle-quick-source";
    onGlobalModRailStateChange?: (state: GlobalModRailState) => void;
    /** The source owned only by an active mapping drag. It never changes
        ordinary source selection or tap behavior. */
    onGlobalModSourceDragChange?: (source: GlobalModRailState["selectedSource"] | null) => void;
    /** Ordinary selection is distinct from a mapping drop. */
    onGlobalModSourceSelect?: (source: GlobalModRailState["selectedSource"]) => void;
    /** A valid drop is distinct from an ordinary source tap. */
    onGlobalModSourceDrop?: (source: GlobalModRailState["selectedSource"]) => void;
    /** T14 one-selection: the Mod page's selectors arm the bar through this. */
    selectModSourceSignal?: { source: SelectedSource; serial: number } | null;
    /** ADR-025 row 15: fired once per authoritative route creation. */
    onRouteCreationConfirmed?: (routeId: string) => void;
    onSelectedEffectChange?: (effectId: EffectModuleId) => void;
    mobileGlobalModRail?: boolean;
    mobileModRailPortalTarget?: HTMLElement | null;
    modBarPreferences?: ModBarPreferences;
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
 * Voice settings share one popout whether the Mod bar is floating, parked, or
 * rendered horizontally. The caller supplies the one composed Global Tune
 * control so this module does not duplicate its state or modulation wiring.
 */
export type ModRailVoiceSettings = {
    readonly playMode: PatchControlBinding<number>;
    readonly glideTime: PatchControlBinding<number>;
    readonly globalTuneControl: ReactNode;
};

function ModRailVoiceSettingsPopover({
    settings,
    scale,
    dataRole,
    className,
    popoverRef,
    style,
}: {
    readonly settings: ModRailVoiceSettings;
    readonly scale: number;
    readonly dataRole: string;
    readonly className: string;
    readonly popoverRef: Ref<HTMLDivElement>;
    readonly style?: CSSProperties;
}) {
    const glideDisabled = settings.playMode.value === VOICE_MODE_OPTIONS[0].value;
    const glideEntrySpec = parameterEntrySpecForSeconds({
        minSeconds: GLIDE_TIME_MIN_SECONDS,
        maxSeconds: GLIDE_TIME_MAX_SECONDS,
        stepSeconds: GLIDE_TIME_STEP_SECONDS,
        currentSeconds: settings.glideTime.value,
    });

    return (
        <div
            ref={popoverRef}
            data-role={dataRole}
            className={className}
            role="dialog"
            aria-label="Voice settings"
            style={style}
        >
            <div className="mobile-global-mod-rail-voice-modes" role="radiogroup" aria-label="Play mode">
                {VOICE_MODE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={option.value === settings.playMode.value}
                        className="mobile-global-mod-rail-voice-mode"
                        onClick={() => settings.playMode.commitValue(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className="mobile-global-mod-rail-global-tune">
                {settings.globalTuneControl}
            </div>
            <div
                className="mobile-global-mod-rail-voice-glide"
                data-disabled={glideDisabled}
                inert={glideDisabled}
            >
                <PrecisionNumberField
                    ariaLabel="Glide time"
                    binding={settings.glideTime}
                    entrySpec={glideEntrySpec}
                    suffix={glideEntrySpec.defaultUnit}
                    leadingLabel="Glide"
                    variant="inlineDark"
                    dataRole="mobile-global-mod-rail-glide-field"
                    width={64 * scale}
                    height={22 * scale}
                />
            </div>
        </div>
    );
}

const POLISH_ACCENT = "#f4c86a";

const POLISH_CONTROL_DESCRIPTORS: ReadonlyArray<{
    readonly descriptor: ParameterKnobDescriptor;
    readonly bindingKey: "enhancer" | "compressionClip" | "trim";
    readonly unit: "%" | "dB";
    readonly canonicalPerDisplayedUnit: number;
    readonly digits: number;
}> = [
    {
        descriptor: {
            endpointID: POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
            label: "Enhancer Amount",
            shortLabel: "ENH",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.01,
            scale: "linear",
        },
        bindingKey: "enhancer",
        unit: "%",
        canonicalPerDisplayedUnit: 0.01,
        digits: 0,
    },
    {
        descriptor: {
            endpointID: POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
            label: "Compression / Clip Amount",
            shortLabel: "COMP",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.01,
            scale: "linear",
        },
        bindingKey: "compressionClip",
        unit: "%",
        canonicalPerDisplayedUnit: 0.01,
        digits: 0,
    },
    {
        descriptor: {
            endpointID: POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
            label: "Output Trim",
            shortLabel: "TRIM",
            min: -24,
            max: 12,
            initial: 0,
            step: 0.1,
            scale: "linear",
        },
        bindingKey: "trim",
        unit: "dB",
        canonicalPerDisplayedUnit: 1,
        digits: 1,
    },
];

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
    readonly deviceId: string;
    readonly originalDoc: LaneStateV2;
    readonly captureElement: HTMLDivElement;
};

const REORDER_BRANCH_FOCUS_DWELL_MS = 400;

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

type HitTestRoot = Document | ShadowRoot;

function hitTestRoot(reference: Element | HitTestRoot): HitTestRoot | null {
    const renderRoot = reference instanceof Document || reference instanceof ShadowRoot
        ? reference
        : reference.getRootNode();
    return renderRoot instanceof Document || renderRoot instanceof ShadowRoot
        ? renderRoot
        : null;
}

function elementAtPointInRenderRoot(reference: Element | HitTestRoot, clientX: number, clientY: number) {
    const renderRoot = hitTestRoot(reference);
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
        const kind = parseAnyModulationTargetKind(candidate);
        if (kind === null) {
            throw new Error(`Unknown companion modulation target "${candidate}"`);
        }
        return kind;
    });
}

function modulationTargetAtPoint(
    reference: Element | HitTestRoot,
    clientX: number,
    clientY: number,
): ModulationDropTarget | null {
    const element = elementAtPointInRenderRoot(reference, clientX, clientY)
        ?.closest<HTMLElement>("[data-modulation-target-kind]") ?? null;
    const targetKind = parseAnyModulationTargetKind(element?.dataset.modulationTargetKind);
    return element === null || targetKind === null
        ? null
        : { element, targetKind, companionKinds: parseCompanionKinds(element) };
}

function modulationTargetFromElement(element: HTMLElement | null): ModulationDropTarget | null {
    const targetKind = parseAnyModulationTargetKind(element?.dataset.modulationTargetKind);
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

function modulationDropCandidates(reference: Element | HitTestRoot): ModulationDropCandidate[] {
    const renderRoot = hitTestRoot(reference);
    if (renderRoot === null) {
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
    reference: Element | HitTestRoot,
    point: ClientPoint,
    previousPoint: ClientPoint,
    previousTarget: HTMLElement | null,
): ModulationDropCandidate | null {
    const exactTarget = modulationTargetAtPoint(reference, point.x, point.y);
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

    const candidates = modulationDropCandidates(reference);
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

/**
 * The SELECTED lane device instance. Everything under the editor's provider
 * — knob bindings, target kinds, drop attributes — speaks this instance;
 * outside it (or for descriptors of another type) instance #1 holds, which
 * is the entire pre-instance world.
 */
const SelectedLaneDeviceContext = createContext<string | null>(null);

function laneDeviceIdForDescriptor(
    selectedDeviceId: string | null,
    descriptor: RackParameterDescriptor,
): string {
    const fallback = `${EFFECT_ID_TO_LANE_TYPE[descriptor.effectId]}#1`;
    if (selectedDeviceId === null) {
        return fallback;
    }
    return parseLaneInstanceId(selectedDeviceId)?.deviceType === EFFECT_ID_TO_LANE_TYPE[descriptor.effectId]
        ? selectedDeviceId
        : fallback;
}

function laneKindForDevice(deviceId: string, endpointID: string): RackModulationTargetKind {
    return `lane.${deviceId}.${endpointID}`;
}

function effectIdForLaneDeviceId(deviceId: string): EffectModuleId {
    const deviceType = parseLaneInstanceId(deviceId)?.deviceType;
    const effectId = deviceType === undefined ? undefined : LANE_TYPE_TO_EFFECT_ID.get(deviceType);
    if (effectId === undefined) {
        throw new Error(`Not a lane device instance id: ${deviceId}`);
    }
    return effectId;
}

/** The first device in dispatch order — the selection fallback after a removal. */
function firstLaneDeviceId(state: LaneStateV2): string | null {
    for (const node of state.chain) {
        if (node.kind === "device") {
            return node.deviceId;
        }
        for (const branch of node.branches) {
            const first = branch[0];
            if (first !== undefined) {
                return first.deviceId;
            }
        }
    }
    return null;
}

/** The selected instance's target kind for one of ITS endpoints. */
function useLaneKindResolver(): (descriptor: RackParameterDescriptor) => RackModulationTargetKind {
    const selectedDeviceId = useContext(SelectedLaneDeviceContext);
    return useCallback((descriptor: RackParameterDescriptor) => (
        laneKindForDevice(
            laneDeviceIdForDescriptor(selectedDeviceId, descriptor),
            rackModulationIdentityEndpointID(descriptor),
        )
    ), [selectedDeviceId]);
}

function useRackState() {
    // lane.v1 is the editor's desired and persisted authority. effectiveRackState is
    // diagnostic readback without a correlated intent id, so an older DSP event must
    // never replace the base of a newer user edit. The document itself lives in the
    // connection-scoped lane store, shared with every parameter binding.
    const {
        laneState,
        commit,
        setOutputMix,
        setOutputBypassed,
        setSplitCrossover,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    } = useLaneStateDoc();
    const rackStateRef = useRef(laneState);
    rackStateRef.current = laneState;

    return {
        rackState: laneState,
        rackStateRef,
        commit,
        setOutputMix,
        setOutputBypassed,
        setSplitCrossover,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    };
}

/**
 * The workspace body itself sits ABOVE its own provider, so its overlay
 * bindings pass the selection explicitly through `deviceId`; components
 * under the provider omit it and read the context.
 */
function useRackParameterBinding(
    descriptor: RackParameterDescriptor,
    active = true,
    deviceId: string | null = null,
) {
    void active;
    const contextDeviceId = useContext(SelectedLaneDeviceContext);
    return useLaneParameterBinding(descriptor, laneDeviceIdForDescriptor(deviceId ?? contextDeviceId, descriptor));
}

function useRackKeyTrackBinding(
    descriptor: RackParameterDescriptor,
    deviceId: string | null = null,
) {
    const contextDeviceId = useContext(SelectedLaneDeviceContext);
    return useLaneKeyTrackControlBinding(
        descriptor,
        laneDeviceIdForDescriptor(deviceId ?? contextDeviceId, descriptor),
    );
}

function keyTrackPresentedDescriptor(
    descriptor: RackParameterDescriptor,
    family: KeyTrackParameterFamily,
): RackParameterDescriptor {
    const range = requireKeyTrackRange(family);
    return {
        ...descriptor,
        label: "Key Track Offset",
        shortLabel: "OFFSET",
        min: range.knobMin,
        max: range.knobMax,
        initial: 0,
        step: range.step,
        scale: "linear",
        unit: "st",
        choices: undefined,
        modulationApplication: "linear",
        modulationDragStyle: undefined,
    };
}

function keyTrackRouteStorage(descriptor: RackParameterDescriptor): KeyTrackRouteStorage {
    return descriptor.modulationApplication === "semitones" ? "semitones" : "octaves";
}

function formatKeyTrackOffset(value: number): string {
    return `${Number(value.toFixed(2))} st`;
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

// The station pills carry no power button of their own (the accepted subway
// tradeoff): bypass lives in the station's long-press menu and, for the
// selected device, in the editor header next to the faceplate.
function PowerGlyph() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8v8.1M7.2 5.6a8 8 0 1 0 9.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
        </svg>
    );
}

function isRouteForTarget(route: ModulationRoute, targetKind: ModulationTargetKind) {
    return route.targetKind === targetKind;
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
    confirmed,
    dragSource,
    hovered,
    onSelect,
    onRecentParameter,
    onRequestContextMenu,
    presentHudVisualization,
}: {
    descriptor: RackParameterDescriptor;
    routes: ReadonlyArray<ModulationRoute>;
    selected: boolean;
    activeSource: RackModulationSource;
    sourceIsSelected: boolean;
    effectEnabled: boolean;
    targetEffective: boolean;
    pending: boolean;
    /** ADR-025 row 15: brief authoritative-confirmation flash window. */
    confirmed: boolean;
    dragSource: SelectedSource | null;
    hovered: boolean;
    onSelect: () => void;
    onRecentParameter: (endpointID: string) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
    presentHudVisualization?: (value: number) => ParameterHudVisualization;
}) {
    const keyTrack = useRackKeyTrackBinding(descriptor);
    const definition = getKeyTrackDefinition(`lane.${descriptor.endpointID}`);
    const presentedDescriptor = keyTrack.enabled && definition !== null
        ? keyTrackPresentedDescriptor(descriptor, definition.family)
        : descriptor;
    const binding = keyTrack.binding;
    const resolveLaneKind = useLaneKindResolver();
    const controlTargetKind = resolveLaneKind(descriptor);
    const isTarget = descriptor.modulationTargetIndex !== null;
    const presentation = projectRackRoutePresentation({
        routes,
        armedSource: sourceIsSelected ? activeSource : null,
        targetKind: isTarget ? controlTargetKind : null,
        effectEnabled,
        targetEffective,
        pending,
    });
    const amountBinding = useModulationRouteAmountBinding(presentation.currentRoute);
    const canonicalPresentedRoute = presentRouteWithCanonicalAmount(
        presentation.currentRoute, amountBinding);
    const storage = keyTrackRouteStorage(descriptor);
    const presentedRoute = keyTrack.enabled && canonicalPresentedRoute !== null
        ? {
            ...canonicalPresentedRoute,
            amount: keyTrackRouteAmountToSemitones(canonicalPresentedRoute.amount, storage),
          }
        : canonicalPresentedRoute;
    const dragSourceAccent = dragSource === null
        ? null
        : findRackModulationSource(dragSource.sourceKind, dragSource.sourceSlot).accent;
    // ADR-025 rows 11/16: eligibility during a drag belongs to the DRAGGED
    // source, whether or not it is the armed one.
    const dragCreation = dragSource === null ? null : getModulationRouteCreation({
        routes,
        source: dragSource,
        targetKind: controlTargetKind,
        pending,
    });
    const rootStyle = {
        "--drag-source-color": dragSourceAccent ?? "transparent",
        "--control-source-accent": activeSource.accent,
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
                <span>{descriptor.label}</span>
                <strong>{selectedChoice?.label}</strong>
            </button>
        );
    }

    return (
        <div
            data-role={`rack-parameter-surface-${descriptor.endpointID}`}
            data-rack-mod-target={isTarget ? descriptor.endpointID : undefined}
            data-modulation-target-kind={isTarget ? controlTargetKind : undefined}
            data-creation-state={presentation.creation}
            data-drag-creation={dragCreation ?? undefined}
            data-creation-confirmed={confirmed || undefined}
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
            {confirmed ? (
                <span className="rack-confirm-check" aria-hidden="true">✓</span>
            ) : null}
            <RackParameterKnob
                descriptor={presentedDescriptor}
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
                modulationDragStyle={descriptor.modulationDragStyle}
                modulationTargetKind={controlTargetKind}
                presentHudVisualization={keyTrack.enabled ? undefined : presentHudVisualization}
                modulationAmountBounds={keyTrack.enabled && definition !== null
                    ? (() => {
                        const range = requireKeyTrackRange(definition.family);
                        return { min: range.routeMin, max: range.routeMax };
                    })()
                    : undefined}
                formatValue={keyTrack.enabled ? formatKeyTrackOffset : undefined}
                formatModulationAmount={keyTrack.enabled ? (amount) => formatKeyTrackOffset(amount) : undefined}
                onModulationAmountChange={keyTrack.enabled
                    ? (amount) => amountBinding.setValue(
                        keyTrackRouteAmountFromSemitones(amount, storage))
                    : amountBinding.setValue}
                onRequestContextMenu={(clientX, clientY) => onRequestContextMenu(
                    descriptor.endpointID,
                    clientX,
                    clientY,
                )}
            />
            {keyTrack.eligible ? (
                <button
                    type="button"
                    data-role={`key-track-${descriptor.endpointID}`}
                    aria-pressed={keyTrack.enabled}
                    className="key-track-button rack-key-track-button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => keyTrack.setEnabled(!keyTrack.enabled)}
                >Key Track</button>
            ) : null}
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
    const parameterHudSuppression = useParameterHudSuppression();
    const effect = getRackEffectDescriptor("filter");
    const modeDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterMode")!;
    const cutoffDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterCutoff")!;
    const resonanceDescriptor = effect.parameters.find((parameter) => parameter.endpointID === "globalFilterResonance")!;
    const mode = useRackParameterBinding(modeDescriptor);
    const cutoffKeyTrack = useRackKeyTrackBinding(cutoffDescriptor);
    const cutoff = cutoffKeyTrack.ordinaryBinding;
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
                parameterHudSuppression.suppress();
            }}
            onGestureEnd={() => {
                cutoff.endGesture();
                resonance.endGesture();
                parameterHudSuppression.release();
            }}
            onCutoffSet={(value) => {
                if (!cutoffKeyTrack.enabled) cutoff.setValue(value);
            }}
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
    const effect = getRackEffectDescriptor("drive");
    const driveDescriptor = effect.parameters.find(
        (parameter) => parameter.endpointID === "distortionDriveDb",
    )!;
    const drive = useRackParameterBinding(driveDescriptor);
    const kneeDescriptor = effect.parameters.find(
        (parameter) => parameter.endpointID === "distortionKnee",
    )!;
    const knee = useRackParameterBinding(kneeDescriptor);
    const typeDescriptor = effect.parameters.find(
        (parameter) => parameter.endpointID === "distortionType",
    )!;
    const type = useRackParameterBinding(typeDescriptor);

    return (
        <DistortionVisualizer
            compact
            driveDb={drive.value}
            knee={knee.value}
            type={type.value}
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

    const xKeyTrack = useRackKeyTrackBinding(xDescriptor);
    const xBinding = xKeyTrack.ordinaryBinding;
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
        if (!xKeyTrack.enabled) {
            xBinding.setValue(rackParameterValueFromNormalized(xDescriptor, nextPoint.x));
        }
        yBinding.setValue(rackParameterValueFromNormalized(yDescriptor, nextPoint.y));
    }, [xBinding.setValue, xDescriptor, xKeyTrack.enabled, yBinding.setValue, yDescriptor]);
    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
        const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
        if (!horizontal && !vertical) {
            return;
        }

        event.preventDefault();
        if (horizontal && xKeyTrack.enabled) {
            onRecentParameter(xDescriptor.endpointID);
            return;
        }
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
    }, [normalizedX, normalizedY, onRecentParameter, xBinding, xDescriptor, xKeyTrack.enabled, yBinding, yDescriptor]);

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
    confirmedEndpointID,
    dragSource,
    onSelectTarget,
    onRecentParameter,
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
    confirmedEndpointID: string | null;
    dragSource: SelectedSource | null;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
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
                confirmedEndpointID={confirmedEndpointID}
                dragSource={dragSource}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
                onRequestContextMenu={onRequestContextMenu}
            />
        );
    }

    if (effectId === "drive") {
        return (
            <DistortionParameterList
                routes={routes}
                selectedTargetEndpointID={selectedTargetEndpointID}
                hoverTargetEndpointID={hoverTargetEndpointID}
                activeSource={activeSource}
                sourceIsSelected={sourceIsSelected}
                effectEnabled={effectEnabled}
                pendingRouteKey={pendingRouteKey}
                confirmedEndpointID={confirmedEndpointID}
                dragSource={dragSource}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
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
                confirmedEndpointID={confirmedEndpointID}
                dragSource={dragSource}
                onSelectTarget={onSelectTarget}
                onRecentParameter={onRecentParameter}
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
                    confirmed={confirmedEndpointID === parameter.endpointID}
                    dragSource={dragSource}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onRequestContextMenu={onRequestContextMenu}
                />
            ))}
        </>
    );
}

function DistortionParameterList({
    routes,
    selectedTargetEndpointID,
    hoverTargetEndpointID,
    activeSource,
    sourceIsSelected,
    effectEnabled,
    pendingRouteKey,
    confirmedEndpointID,
    dragSource,
    onSelectTarget,
    onRecentParameter,
    onRequestContextMenu,
}: Omit<Parameters<typeof ParameterList>[0], "effectId">) {
    const descriptor = getRackEffectDescriptor("drive");
    const kneeDescriptor = getRackParameterDescriptor("distortionKnee");
    const typeDescriptor = getRackParameterDescriptor("distortionType");
    if (kneeDescriptor === null || typeDescriptor === null) {
        throw new Error("The Distortion HUD requires Knee and Type parameter descriptors.");
    }
    const kneeBinding = useRackParameterBinding(kneeDescriptor);
    const typeBinding = useRackParameterBinding(typeDescriptor);
    const presentDistortionHudVisualization = useCallback((driveDb: number): ParameterHudVisualization => ({
        kind: "distortion",
        driveDb,
        knee: kneeBinding.value,
        type: typeBinding.value,
    }), [kneeBinding.value, typeBinding.value]);

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
                    confirmed={confirmedEndpointID === parameter.endpointID}
                    dragSource={dragSource}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onRequestContextMenu={onRequestContextMenu}
                    presentHudVisualization={parameter.endpointID === "distortionDriveDb"
                        ? presentDistortionHudVisualization
                        : undefined}
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
    confirmedEndpointID,
    dragSource,
    onSelectTarget,
    onRecentParameter,
    onRequestContextMenu,
}: Omit<Parameters<typeof ParameterList>[0], "effectId">) {
    const descriptor = getRackEffectDescriptor("filter");
    const modeDescriptor = getRackParameterDescriptor("globalFilterMode");
    const resonanceDescriptor = getRackParameterDescriptor("globalFilterResonance");
    if (modeDescriptor === null || resonanceDescriptor === null) {
        throw new Error("The Filter HUD requires Mode and Resonance parameter descriptors.");
    }
    const modeBinding = useRackParameterBinding(modeDescriptor);
    const resonanceBinding = useRackParameterBinding(resonanceDescriptor);
    const filterIsAudible = modeBinding.value >= 0.5;
    const presentFilterHudVisualization = useCallback((cutoffHz: number): ParameterHudVisualization => ({
        kind: "filter",
        mode: modeBinding.value,
        cutoffHz,
        q: resonanceBinding.value,
    }), [modeBinding.value, resonanceBinding.value]);

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
                    confirmed={confirmedEndpointID === parameter.endpointID}
                    dragSource={dragSource}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
                    onRequestContextMenu={onRequestContextMenu}
                    presentHudVisualization={parameter.endpointID === "globalFilterCutoff"
                        ? presentFilterHudVisualization
                        : undefined}
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
    confirmedEndpointID,
    dragSource,
    onSelectTarget,
    onRecentParameter,
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
    confirmedEndpointID: string | null;
    dragSource: SelectedSource | null;
    onSelectTarget: (endpointID: string) => void;
    onRecentParameter: (endpointID: string) => void;
    onRequestContextMenu: (endpointID: string, clientX: number, clientY: number) => void;
}) {
    const descriptor = getRackEffectDescriptor(effectId);
    const resolveLaneKind = useLaneKindResolver();
    const modeEndpointID = effectId === "phaser" ? "phaserRateMode" : "delayTimeMode";
    const freeEndpointID = effectId === "phaser" ? "phaserRate" : "delayTime";
    const divisionEndpointID = effectId === "phaser" ? "phaserRateDivision" : "delayDivision";
    const modeDescriptor = descriptor.parameters.find((parameter) => parameter.endpointID === modeEndpointID)!;
    const freeDescriptor = descriptor.parameters.find((parameter) => parameter.endpointID === freeEndpointID)!;
    const modeBinding = useRackParameterBinding(modeDescriptor);
    const syncMode = modeBinding.value >= 0.5;
    const visibleParameters = descriptor.parameters.filter((parameter) => {
        if (parameter.endpointID === freeEndpointID) {
            return !syncMode
                || selectedTargetEndpointID === freeEndpointID
                || routes.some((route) => isRouteForTarget(route, resolveLaneKind(freeDescriptor)));
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
                    confirmed={confirmedEndpointID === parameter.endpointID}
                    dragSource={dragSource}
                    hovered={hoverTargetEndpointID === parameter.endpointID}
                    onSelect={() => onSelectTarget(parameter.endpointID)}
                    onRecentParameter={onRecentParameter}
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
            <span className="rack-mod-number">{rackModulationSourceBadgeLabel(source)}</span>
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
    /**
     * ADR-025 row 16: pair eligibility for the DRAGGED source. Targets whose
     * pair already exists must never look droppable.
     */
    readonly getPairCreation?: (source: SelectedSource, targetKind: string) => RackRouteCreation;
    /** Fired once per target per drag after a deliberate duplicate hover. */
    readonly onDuplicateHover?: (source: SelectedSource, targetKind: string) => void;
};

type SourcePointerMovement = {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly buttons: number;
    readonly clientX: number;
    readonly clientY: number;
};

/** Deliberate hover before a dwell navigation fires; transit stays inert. */
const MOD_SOURCE_DWELL_NAVIGATE_MS = 550;
/** ADR-025 row 16: a deliberate duplicate hover warns after this dwell. */
const MOD_SOURCE_DUPLICATE_WARN_MS = 500;

function useModSourceDrag(callbacks: ModSourceDragCallbacks) {
    const handlersRef = useRef(callbacks);
    handlersRef.current = callbacks;
    const autoScrollRef = useRef<{
        clientX: number;
        clientY: number;
        frame: number | null;
        renderRoot: HitTestRoot | null;
    }>({ clientX: 0, clientY: 0, frame: null, renderRoot: null });
    const dragRef = useRef<{
        pointerId: number;
        pointerType: string;
        source: SelectedSource;
        moved: boolean;
        startX: number;
        startY: number;
        wasActiveSelection: boolean;
        captureElement: HTMLButtonElement;
        captureLost: boolean;
        renderRoot: HitTestRoot;
        hoveredTarget: HTMLElement | null;
        lastPointerPoint: ClientPoint;
        lastDragPoint: ClientPoint;
        dwell: { key: string; timer: number } | null;
        duplicate: { targetKind: string; timer: number } | null;
        duplicateWarned: Set<string>;
    } | null>(null);

    const clearDwellTracker = useCallback(() => {
        const drag = dragRef.current;
        if (drag?.dwell) {
            clearUiTimeout(drag.dwell.timer);
            drag.dwell = null;
        }
    }, []);

    const updateDwellTracker = useCallback((renderRoot: HitTestRoot, dragPoint: ClientPoint) => {
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        const dwellKey = elementAtPointInRenderRoot(renderRoot, dragPoint.x, dragPoint.y)
            ?.closest<HTMLElement>("[data-drag-dwell]")
            ?.dataset.dragDwell ?? null;
        if ((drag.dwell?.key ?? null) === dwellKey) {
            return;
        }
        clearDwellTracker();
        if (dwellKey === null) {
            return;
        }
        const timer = uiTimeout(() => {
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
        if (drag.duplicate) {
            clearUiTimeout(drag.duplicate.timer);
            drag.duplicate = null;
        }
        if (!nextTarget) {
            return;
        }
        const targetKind = nextTarget.dataset.modulationTargetKind ?? null;
        const creation = targetKind === null
            ? null
            : handlersRef.current.getPairCreation?.(source, targetKind) ?? null;
        if (creation === "existing") {
            // ADR-025 row 16: never droppable; only a deliberate uninterrupted
            // hover warns, exactly once per target per drag.
            if (targetKind !== null && !drag.duplicateWarned.has(targetKind)) {
                const timer = uiTimeout(() => {
                    const activeDrag = dragRef.current;
                    if (activeDrag?.duplicate?.targetKind !== targetKind) {
                        return;
                    }
                    activeDrag.duplicate = null;
                    activeDrag.duplicateWarned.add(targetKind);
                    handlersRef.current.onDuplicateHover?.(source, targetKind);
                }, MOD_SOURCE_DUPLICATE_WARN_MS);
                drag.duplicate = { targetKind, timer };
            }
            return;
        }
        if (creation !== null && creation !== "creatable") {
            return;
        }
        nextTarget.style.setProperty(
            "--drag-source-color",
            findRackModulationSource(source.sourceKind, source.sourceSlot).accent,
        );
        nextTarget.classList.add("is-mod-hover");
        if (drag.pointerType === "touch") {
            triggerLightHaptic();
        }
    }, []);

    const stopSourceAutoScroll = useCallback(() => {
        if (autoScrollRef.current.frame !== null) {
            cancelAnimationFrame(autoScrollRef.current.frame);
        }
        autoScrollRef.current = { clientX: 0, clientY: 0, frame: null, renderRoot: null };
    }, []);

    const sourceAutoScrollDelta = useCallback((surface: HTMLElement, clientY: number) => {
        const bounds = surface.getBoundingClientRect();
        const edgeZone = Math.min(64, bounds.height * 0.18);
        const distanceFromTop = clientY - bounds.top;
        const distanceFromBottom = bounds.bottom - clientY;
        const topStrength = distanceFromTop < edgeZone
            ? clamp((edgeZone - Math.max(0, distanceFromTop)) / edgeZone, 0, 1)
            : 0;
        const bottomStrength = distanceFromBottom < edgeZone
            ? clamp((edgeZone - Math.max(0, distanceFromBottom)) / edgeZone, 0, 1)
            : 0;
        return (bottomStrength - topStrength) * 7;
    }, []);

    const sourceAutoScrollCanMove = useCallback((surface: HTMLElement, delta: number) => {
        if (delta < -0.2) {
            return surface.scrollTop > 0.5;
        }
        if (delta > 0.2) {
            const maximumScrollTop = Math.max(0, surface.scrollHeight - surface.clientHeight);
            return surface.scrollTop < maximumScrollTop - 0.5;
        }
        return false;
    }, []);

    const graphScrollSurfaceAtPoint = useCallback((
        renderRoot: HitTestRoot,
        clientX: number,
        clientY: number,
    ) => {
        const graph = elementAtPointInRenderRoot(renderRoot, clientX, clientY)
            ?.closest<HTMLElement>('[data-role="rack-module-list"]') ?? null;
        return graph !== null && graph.scrollHeight > graph.clientHeight + 1
            ? graph
            : null;
    }, []);

    const runSourceAutoScroll = useCallback(() => {
        const state = autoScrollRef.current;
        const renderRoot = state.renderRoot;
        if (!renderRoot || dragRef.current === null) {
            stopSourceAutoScroll();
            return;
        }

        const graphSurface = graphScrollSurfaceAtPoint(
            renderRoot,
            state.clientX,
            state.clientY,
        );
        const graphDelta = graphSurface === null
            ? 0
            : sourceAutoScrollDelta(graphSurface, state.clientY);
        if (graphSurface !== null && sourceAutoScrollCanMove(graphSurface, graphDelta)) {
            graphSurface.scrollTop += graphDelta;
        } else {
            const activePanel = renderRoot.querySelector<HTMLElement>(
                '[data-role^="mobile-workspace-panel-"]:not([hidden])',
            );
            if (activePanel) {
                const panelDelta = sourceAutoScrollDelta(activePanel, state.clientY);
                if (sourceAutoScrollCanMove(activePanel, panelDelta)) {
                    activePanel.scrollTop += panelDelta;
                }
            }
        }

        autoScrollRef.current.frame = requestAnimationFrame(runSourceAutoScroll);
    }, [graphScrollSurfaceAtPoint, sourceAutoScrollCanMove, sourceAutoScrollDelta, stopSourceAutoScroll]);

    const updateSourceAutoScroll = useCallback((renderRoot: HitTestRoot, dragPoint: ClientPoint) => {
        autoScrollRef.current.clientX = dragPoint.x;
        autoScrollRef.current.clientY = dragPoint.y;
        autoScrollRef.current.renderRoot = renderRoot;
        if (autoScrollRef.current.frame === null) {
            autoScrollRef.current.frame = requestAnimationFrame(runSourceAutoScroll);
        }
        const graphSurface = graphScrollSurfaceAtPoint(renderRoot, dragPoint.x, dragPoint.y);
        if (graphSurface === null) {
            return false;
        }
        return sourceAutoScrollCanMove(
            graphSurface,
            sourceAutoScrollDelta(graphSurface, dragPoint.y),
        );
    }, [graphScrollSurfaceAtPoint, runSourceAutoScroll, sourceAutoScrollCanMove, sourceAutoScrollDelta]);

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
                    drag.renderRoot,
                    dragPoint,
                    drag.lastDragPoint,
                    drag.hoveredTarget,
                );
        updateHoveredTarget(null, drag.source);
        clearDwellTracker();
        if (drag.duplicate) {
            clearUiTimeout(drag.duplicate.timer);
            drag.duplicate = null;
        }
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

    const moveSourceGesture = useCallback((event: SourcePointerMovement) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
            return;
        }
        drag.moved ||= modSourceDragHasActivated(
            { x: drag.startX, y: drag.startY },
            { x: event.clientX, y: event.clientY },
        );
        if (drag.moved) {
            const dragPoint = resolveModSourceDragPoint(
                drag.captureElement,
                drag.pointerType,
                { x: drag.startX, y: drag.startY },
                drag.lastPointerPoint,
                drag.lastDragPoint,
                { x: event.clientX, y: event.clientY },
            );
            const previousDragPoint = drag.lastDragPoint;
            drag.lastPointerPoint = { x: event.clientX, y: event.clientY };
            drag.lastDragPoint = dragPoint;
            const graphEdgeOwnsPreview = updateSourceAutoScroll(drag.renderRoot, dragPoint);
            if (graphEdgeOwnsPreview) {
                updateHoveredTarget(null, drag.source);
                clearDwellTracker();
                handlersRef.current.onSourceDragChange?.({
                    source: drag.source,
                    clientX: dragPoint.x,
                    clientY: dragPoint.y,
                    targetCaptured: false,
                });
                handlersRef.current.onHoverTarget(drag.source, null);
                return;
            }
            const target = resolveModulationTargetForDrag(
                drag.renderRoot,
                dragPoint,
                previousDragPoint,
                drag.hoveredTarget,
            );
            handlersRef.current.onSourceDragChange?.({
                source: drag.source,
                clientX: dragPoint.x,
                clientY: dragPoint.y,
                targetCaptured: target !== null,
            });
            updateHoveredTarget(target?.element ?? null, drag.source);
            updateDwellTracker(drag.renderRoot, dragPoint);
            handlersRef.current.onHoverTarget(drag.source, target?.targetKind ?? null);
            return;
        }
        const target = modulationTargetAtPoint(drag.renderRoot, event.clientX, event.clientY);
        updateHoveredTarget(target?.element ?? null, drag.source);
        handlersRef.current.onHoverTarget(drag.source, target?.targetKind ?? null);
    }, [
        clearDwellTracker,
        finishSourceGesture,
        updateDwellTracker,
        updateHoveredTarget,
        updateSourceAutoScroll,
    ]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }
            if (drag.captureElement.isConnected && !drag.captureLost) {
                return;
            }
            event.preventDefault();
            moveSourceGesture(event);
        };
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

        window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", cancelActiveGesture);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove, true);
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", cancelActiveGesture);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActiveGesture();
            stopSourceAutoScroll();
        };
    }, [finishSourceGesture, moveSourceGesture, stopSourceAutoScroll]);

    return useCallback((source: SelectedSource, wasActiveSelection: boolean) => ({
        onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (event.pointerType === "mouse" && event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const renderRoot = hitTestRoot(event.currentTarget);
            if (renderRoot === null) {
                return;
            }
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
                captureLost: false,
                renderRoot,
                hoveredTarget: null,
                lastPointerPoint: { x: event.clientX, y: event.clientY },
                lastDragPoint: { x: event.clientX, y: event.clientY },
                dwell: null,
                duplicate: null,
                duplicateWarned: new Set(),
            };
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                const drag = dragRef.current;
                if (drag?.pointerId === event.pointerId) {
                    drag.captureLost = true;
                }
            }
        },
        onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            moveSourceGesture(event);
        },
        onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, false);
        },
        onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
            finishSourceGesture(event.pointerId, event.clientX, event.clientY, true);
        },
        onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current;
            if (drag?.pointerId === event.pointerId) {
                drag.captureLost = true;
            }
        },
    }), [finishSourceGesture, moveSourceGesture]);
}

type ModSourceGestureHandlers = ReturnType<typeof useModSourceDrag>;

function ModSourceCarousel({
    pageIndex,
    selectedSource,
    sourceIsArmed,
    orientation = "horizontal",
    headerAccessory = null,
    onPageChange,
    sourceHandlers,
}: {
    pageIndex: number;
    selectedSource: SelectedSource;
    sourceIsArmed: boolean;
    orientation?: "horizontal" | "vertical";
    headerAccessory?: ReactNode;
    onPageChange: (pageIndex: number) => void;
    sourceHandlers: ModSourceGestureHandlers;
}) {
    const armedSourceLabel = sourceIsArmed
        ? findRackModulationSource(selectedSource.sourceKind, selectedSource.sourceSlot).label
        : null;
    const vertical = orientation === "vertical";

    return (
        <div className={`rack-mod-dock${vertical ? " is-vertical" : ""}`} role="group" aria-label="Rack modulation sources">
            <header className="rack-mod-header">
                <strong>MOD BAR{armedSourceLabel === null ? "" : ` · ${armedSourceLabel}`}</strong>
                <span className="rack-mod-header-actions">
                    {headerAccessory}
                    <span>GROUP {pageIndex + 1} / {RACK_MODULATION_SOURCE_PAGES.length}</span>
                </span>
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

const MOBILE_MOD_RAIL_POSITION_KEY = "cosimo.mobile-global-mod-rail.position.v1";
const MOBILE_MOD_RAIL_VELOCITY_WINDOW_MS = 100;
const MOBILE_MOD_RAIL_MIN_RELEASE_VELOCITY_PX_PER_MS = 0.08;
const MOBILE_MOD_RAIL_MAX_RELEASE_VELOCITY_PX_PER_MS = 1.35;
const MOBILE_MOD_RAIL_STOP_VELOCITY_PX_PER_MS = 0.02;
// UIScrollView.DecelerationRate.fast is 0.99. Treating that value as a
// millisecond decay gives this short rail speed-sensitive travel without the
// long coast that feels right for a full scroll view.
const MOBILE_MOD_RAIL_DECELERATION_RATE_PER_MS = 0.99;
const MOBILE_MOD_RAIL_SETTLE_X_MS = 220;
const MOBILE_MOD_RAIL_DEFAULT_DOCK: RailDock = { edge: "right", normalizedY: 0.42 };
// The note keeps its own 44px slot. These page shares preserve the previous
// three-across source/tool target widths in the remaining compact space.
const PARKED_PAGE_SHARE_AT_MIN_SCALE = 0.41625;
const PARKED_PAGE_SHARE_AT_MAX_SCALE = 0.465;

function parkedPageShare(scale: number) {
    const scaleProgress = (clamp(scale, MOD_BAR_MIN_SCALE, MOD_BAR_MAX_SCALE) - MOD_BAR_MIN_SCALE)
        / (MOD_BAR_MAX_SCALE - MOD_BAR_MIN_SCALE);
    return PARKED_PAGE_SHARE_AT_MIN_SCALE
        + (scaleProgress * (PARKED_PAGE_SHARE_AT_MAX_SCALE - PARKED_PAGE_SHARE_AT_MIN_SCALE));
}

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

function triggerWarningHaptic(style: "heavy" | "rigid") {
    const trigger = (globalThis as typeof globalThis & {
        cmaj_triggerHaptic?: (style?: string) => unknown;
    }).cmaj_triggerHaptic;
    trigger?.(style);
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
    preferences,
    sourcePageIndex,
    sourceIsArmed,
    sourceHandlers,
    onStateChange,
    onNoteKeyDown,
    onNoteKeyUp,
    onToggleAutoPreview,
    onToggleKeyboard,
    onSourcePageChange,
    voiceSettings,
    countPulseSerial = 0,
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
    preferences: ModBarPreferences;
    sourcePageIndex: number;
    sourceIsArmed: boolean;
    sourceHandlers: ModSourceGestureHandlers;
    onStateChange?: (state: GlobalModRailState) => void;
    /** ADR-025 row 15: bumps once per confirmed creation to pulse the count. */
    countPulseSerial?: number;
    onNoteKeyDown: () => void;
    onNoteKeyUp: () => void;
    onToggleAutoPreview: () => void;
    onToggleKeyboard: () => void;
    onSourcePageChange: (pageIndex: number) => void;
    voiceSettings: ModRailVoiceSettings;
    children: React.ReactNode;
}) {
    const railGeometry = useMemo(
        () => scaleMobileModRailGeometry(MOBILE_MOD_RAIL_BASE_GEOMETRY, preferences.scale),
        [preferences.scale],
    );
    const floating = preferences.placement !== "parked";
    const preferenceEdge: RailEdge = preferences.placement === "floating-left" ? "left" : "right";
    const layerRef = useRef<HTMLDivElement | null>(null);
    const railRef = useRef<HTMLElement | null>(null);
    const tabRef = useRef<HTMLDivElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const positionRef = useRef(0);
    const normalizedPositionRef = useRef<number | null>(null);
    const boundsRef = useRef<RailVerticalBounds>({
        min: railGeometry.safeGap,
        max: railGeometry.safeGap,
    });
    const layerWidthRef = useRef(0);
    const edgeRef = useRef<RailEdge>(preferenceEdge);
    const dockInitializedRef = useRef(false);
    const dragXRef = useRef(0);
    const settleXTimeoutRef = useRef<number | null>(null);
    const noteKeyPointerRef = useRef<number | null>(null);
    const [countPulsing, setCountPulsing] = useState(false);
    useEffect(() => {
        if (countPulseSerial === 0) {
            return;
        }
        setCountPulsing(true);
        const timeout = uiTimeout(() => setCountPulsing(false), 700);
        return () => clearUiTimeout(timeout);
    }, [countPulseSerial]);
    const drawerMetricsRef = useRef<RailDrawerMetrics>({
        safeTop: railGeometry.safeGap,
        safeBottom: railGeometry.safeGap,
        collapsedHeight: railGeometry.tabContentHeight
            + (2 * railGeometry.shoulder),
        desiredHeight: railGeometry.drawerFallbackHeight,
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
    const [top, setTop] = useState(railGeometry.safeGap);
    const [edge, setEdge] = useState<RailEdge>(preferenceEdge);
    const [dragX, setDragX] = useState(0);
    const [settlingX, setSettlingX] = useState(false);
    const [decelerating, setDecelerating] = useState(false);
    const [noteHeld, setNoteHeld] = useState(false);
    const [drawerPlacement, setDrawerPlacement] = useState<RailDrawerPlacement>({
        direction: "down",
        extent: railGeometry.drawerFallbackHeight,
    });
    const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
    const [parkedPageIndex, setParkedPageIndex] = useState(sourcePageIndex);
    const previousPlacementRef = useRef(preferences.placement);
    const voicePopoverRef = useRef<HTMLDivElement | null>(null);
    const voiceToggleRef = useRef<HTMLButtonElement | null>(null);
    const silhouetteGradientId = `mobile-mod-rail-fill-${useId().replaceAll(":", "")}`;
    const mappingActive = sourceDrag !== null;

    const toggleExpanded = useCallback(() => {
        setExpanded((current) => {
            if (current) {
                // A deliberate grip collapse is an explicit Voice-popout
                // dismissal. Source-driven collapse uses its own path below.
                setVoiceSettingsOpen(false);
            }
            return !current;
        });
    }, []);

    useEffect(() => {
        setParkedPageIndex(selectedSource.sourceSlot - 1);
    }, [selectedSource.sourceSlot]);

    useEffect(() => {
        setParkedPageIndex(sourcePageIndex);
    }, [sourcePageIndex]);

    useEffect(() => {
        if (!floating) {
            return;
        }
        edgeRef.current = preferenceEdge;
        setEdge(preferenceEdge);
    }, [floating, preferenceEdge]);

    const applyDragX = useCallback((nextDragX: number) => {
        dragXRef.current = nextDragX;
        setDragX(nextDragX);
    }, []);

    const updateDrawerPlacement = useCallback((nextTop: number) => {
        setDrawerPlacement(projectRailDrawerPlacement(nextTop, drawerMetricsRef.current));
    }, []);

    useLayoutEffect(() => {
        const surface = layerRef.current?.closest(".cosimo-surface");
        if (!(surface instanceof HTMLElement)) {
            return;
        }
        const previousEdge = surface.dataset.modRailEdge;
        const previousPlacement = surface.dataset.modBarPlacement;
        const previousDockWidth = surface.style.getPropertyValue("--cosimo-rail-dock");
        surface.dataset.modBarPlacement = preferences.placement;
        if (floating) {
            surface.dataset.modRailEdge = edge;
        } else {
            delete surface.dataset.modRailEdge;
        }
        surface.style.setProperty("--cosimo-rail-dock", floating ? `${railGeometry.width}px` : "0px");
        return () => {
            if (previousEdge === undefined) {
                delete surface.dataset.modRailEdge;
            } else {
                surface.dataset.modRailEdge = previousEdge;
            }
            if (previousPlacement === undefined) {
                delete surface.dataset.modBarPlacement;
            } else {
                surface.dataset.modBarPlacement = previousPlacement;
            }
            if (previousDockWidth) {
                surface.style.setProperty("--cosimo-rail-dock", previousDockWidth);
            } else {
                surface.style.removeProperty("--cosimo-rail-dock");
            }
        };
    }, [edge, floating, preferences.placement, railGeometry.width]);

    // Parked tools float independently. Moving an open Voice popover back to
    // a floating edge reopens its drawer so the control and popover survive
    // the placement change together. Source selection, source-driven drawer
    // collapse, and active mapping do not dismiss Voice settings.
    useEffect(() => {
        const previousPlacement = previousPlacementRef.current;
        previousPlacementRef.current = preferences.placement;
        if (floating && !expanded && previousPlacement === "parked" && voiceSettingsOpen) {
            setExpanded(true);
        }
    }, [expanded, floating, preferences.placement, voiceSettingsOpen]);

    useEffect(() => {
        if (!voiceSettingsOpen) {
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            const eventPath = event.composedPath();
            const preservesPresentation = eventPath.some((target) => (
                target instanceof Element
                && target.closest([
                    '[data-role^="rack-mod-source-"]',
                    '[data-role="mobile-global-mod-rail-selected"]',
                    '[data-role="mobile-global-mod-rail-grip"]',
                    '[data-role="perf-tuning-page"]',
                    '[data-role="mobile-global-mod-rail-hide"]',
                    '[data-role="mobile-global-mod-rail-restore"]',
                ].join(",")) !== null
            ));
            if (
                preservesPresentation
                || (voicePopoverRef.current !== null && eventPath.includes(voicePopoverRef.current))
                || (voiceToggleRef.current !== null && eventPath.includes(voiceToggleRef.current))
            ) {
                return;
            }
            setVoiceSettingsOpen(false);
        };
        window.addEventListener("pointerdown", handlePointerDown, true);
        return () => window.removeEventListener("pointerdown", handlePointerDown, true);
    }, [voiceSettingsOpen]);

    const measureAndClamp = useCallback(() => {
        if (!floating) {
            return;
        }
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
        const safeTopInset = railGeometry.safeGap
            + (Number.parseFloat(layerStyle.paddingTop) || 0);
        const safeTop = presetBarBounds
            ? Math.max(
                safeTopInset,
                presetBarBounds.bottom - layerBounds.top + railGeometry.safeGap,
            )
            : safeTopInset;
        const safeBottom = railGeometry.safeGap
            + (Number.parseFloat(layerStyle.paddingBottom) || 0);
        const chromeTop = Math.min(
            keyboardBounds ? keyboardBounds.top : Number.POSITIVE_INFINITY,
            tabsBounds ? tabsBounds.top : Number.POSITIVE_INFINITY,
        );
        const availableBottom = Number.isFinite(chromeTop)
            ? Math.min(layerBounds.height, chromeTop - layerBounds.top)
            : layerBounds.height;
        const railStyle = getComputedStyle(rail);
        const shoulderHeight = Number.parseFloat(railStyle.getPropertyValue("--rail-shoulder"))
            || railGeometry.shoulder;
        const tabHeight = tabRef.current?.getBoundingClientRect().height
            || railGeometry.tabContentHeight;
        const railHeight = tabHeight + (2 * shoulderHeight);
        const nextBounds = railVerticalBounds(
            { height: availableBottom, insetTop: safeTop, insetBottom: safeBottom },
            railHeight,
        );
        boundsRef.current = nextBounds;
        const drawerHeight = drawerRef.current?.scrollHeight
            || railGeometry.drawerFallbackHeight;
        const nextDrawerMetrics = {
            safeTop,
            safeBottom: availableBottom - safeBottom,
            collapsedHeight: railHeight,
            desiredHeight: drawerHeight,
        };
        drawerMetricsRef.current = nextDrawerMetrics;

        if (!dockInitializedRef.current) {
            dockInitializedRef.current = true;
            let storedDock: RailDock | null = null;
            try {
                storedDock = parseStoredRailDock(localStorage.getItem(MOBILE_MOD_RAIL_POSITION_KEY));
            } catch {
                storedDock = null;
            }
            const dock = storedDock ?? MOBILE_MOD_RAIL_DEFAULT_DOCK;
            edgeRef.current = preferenceEdge;
            setEdge(preferenceEdge);
            normalizedPositionRef.current = storedDock
                ? dock.normalizedY
                : projectRailDefaultPlacement(
                    dock.normalizedY,
                    nextBounds,
                    nextDrawerMetrics,
                ).normalizedY;
        }
        normalizedPositionRef.current ??= MOBILE_MOD_RAIL_DEFAULT_DOCK.normalizedY;
        const nextTop = projectRailTop(normalizedPositionRef.current, nextBounds);
        positionRef.current = nextTop;
        setTop(nextTop);
        updateDrawerPlacement(nextTop);
    }, [floating, preferenceEdge, railGeometry, updateDrawerPlacement]);

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
            expanded: floating && expanded,
            selectedSource: {
                sourceKind: selectedSource.sourceKind,
                sourceSlot: selectedSource.sourceSlot,
            },
        });
    }, [expanded, floating, onStateChange, selectedSource.sourceKind, selectedSource.sourceSlot]);

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
        // A data attribute, NOT a class: the surface's className is
        // React-controlled and re-renders (page switches) silently wiped an
        // imperative class mid-drag (T21). React never writes attributes it
        // does not declare, so this one survives any surface re-render.
        if (surface instanceof HTMLElement) {
            if (mappingActive) {
                surface.dataset.modSourceMapping = "true";
            } else {
                delete surface.dataset.modSourceMapping;
            }
        }
        if (surface instanceof HTMLElement && mappingActive) {
            surface.style.setProperty("--active-source-color", selectedSource.accent);
        }
        return () => {
            if (surface instanceof HTMLElement) {
                delete surface.dataset.modSourceMapping;
            }
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
        const { top: settledTop } = snapRailTop(
            clampedTop,
            bounds,
            railGeometry.snapDistance,
        );
        if (settledTop !== clampedTop) {
            triggerLightHaptic();
        }
        positionRef.current = settledTop;
        setTop(settledTop);
        updateDrawerPlacement(settledTop);
        persistRailDock(settledTop);
    }, [persistRailDock, railGeometry.snapDistance, updateDrawerPlacement]);

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
                    clearUiTimeout(settleXTimeoutRef.current);
                }
                settleXTimeoutRef.current = uiTimeout(() => {
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
                toggleExpanded();
            }
            return;
        }

        // Horizontal settle: the nearest screen edge wins and the bar glides
        // flush against it from wherever the finger left it.
        const layerWidth = layerWidthRef.current;
        const currentEdge = edgeRef.current;
        const nextEdge = settleRailEdge(gesture.lastClientX, layerWidth, currentEdge);
        if (nextEdge !== currentEdge) {
            const edgeSpan = Math.max(0, layerWidth - railGeometry.width);
            edgeRef.current = nextEdge;
            setEdge(nextEdge);
            updateModBarPreferences({
                placement: nextEdge === "left" ? "floating-left" : "floating-right",
            });
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
    }, [applyDragX, railGeometry.width, settleDragXHome, settleRailPosition, startRailDeceleration, stopRailDeceleration, toggleExpanded, updateDrawerPlacement]);

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
        window.addEventListener(BROWSER_AUDIO_LEAVE_EVENT, cancelActiveInteraction);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", cancelActiveInteraction);
            window.removeEventListener(BROWSER_AUDIO_LEAVE_EVENT, cancelActiveInteraction);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActiveInteraction();
            if (settleXTimeoutRef.current !== null) {
                clearUiTimeout(settleXTimeoutRef.current);
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
    const silhouetteHeight = railGeometry.tabContentHeight
        + (2 * railGeometry.shoulder)
        + (drawerOpen ? drawerPlacement.extent : 0);
    const silhouettePath = buildRailSilhouettePath({
        width: railGeometry.width,
        shoulder: railGeometry.shoulder,
        corner: railGeometry.corner,
        height: silhouetteHeight,
    }, edge);
    const upwardDrawerOffset = drawerOpen && drawerPlacement.direction === "up" ? -drawerPlacement.extent : 0;
    let disclosureDirection = drawerPlacement.direction;
    if (expanded) {
        disclosureDirection = drawerPlacement.direction === "up" ? "down" : "up";
    }

    // The ghost is positioned in the LAYER's local space, not raw viewport
    // coordinates: on a phone the two coincide, but when the shell is embedded
    // under a transform (the scripted video capture stage) client coordinates
    // must be mapped back through the layer's rect or the ghost lands off the
    // screen it is being dragged over.
    const ghostLayerPoint = (() => {
        if (!sourceDrag) return null;
        const layer = layerRef.current;
        if (!layer) return { left: sourceDrag.clientX, top: sourceDrag.clientY };
        const bounds = layer.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return null;
        return {
            left: (sourceDrag.clientX - bounds.left) * (layer.offsetWidth / bounds.width),
            top: (sourceDrag.clientY - bounds.top) * (layer.offsetHeight / bounds.height),
        };
    })();

    const parkedPageCount = RACK_MODULATION_SOURCE_PAGES.length + 1;
    const parkedToolPageIndex = RACK_MODULATION_SOURCE_PAGES.length;
    const changeParkedPage = (direction: -1 | 1) => {
        const nextPageIndex = (parkedPageIndex + parkedPageCount + direction) % parkedPageCount;
        setParkedPageIndex(nextPageIndex);
        if (nextPageIndex < RACK_MODULATION_SOURCE_PAGES.length) {
            onSourcePageChange(nextPageIndex);
        }
    };
    const parkedSources = parkedPageIndex < RACK_MODULATION_SOURCE_PAGES.length
        ? RACK_MODULATION_SOURCE_PAGES[parkedPageIndex] ?? []
        : [];
    const parkedPageWidthShare = parkedPageShare(preferences.scale);

    const noteButton = (
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
    );

    const auditionToolButtons = (
        <>
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
        </>
    );

    const voicePopover = voiceSettingsOpen ? (
        <ModRailVoiceSettingsPopover
            settings={voiceSettings}
            scale={preferences.scale}
            dataRole="mobile-global-mod-rail-voice-popover"
            className="mobile-global-mod-rail-voice-popover"
            popoverRef={voicePopoverRef}
        />
    ) : null;

    if (!floating) {
        const parkedHidden = preferences.parkedVisibility === "hidden";
        return (
            <div
                ref={layerRef}
                data-role="mobile-global-mod-rail-layer"
                data-placement="parked"
                data-parked-visibility={preferences.parkedVisibility}
                className="mobile-global-mod-rail-layer"
                style={{
                    "--rail-scale": preferences.scale,
                    "--rail-outline": `${railGeometry.outline}px`,
                } as CSSProperties}
            >
                <aside
                    ref={railRef}
                    data-role="mobile-global-mod-rail"
                    data-placement="parked"
                    data-expanded="false"
                    data-page-index={parkedPageIndex}
                    data-page-kind={parkedPageIndex === parkedToolPageIndex ? "tools" : "sources"}
                    data-mapping-active={mappingActive}
                    aria-hidden={parkedHidden}
                    inert={parkedHidden}
                    className="mobile-global-mod-rail is-parked"
                    style={{
                        "--source-color": selectedSource.accent,
                        "--editor-accent": accent,
                        "--rail-scale": preferences.scale,
                        "--rail-outline": `${railGeometry.outline}px`,
                        "--parked-page-share": `${parkedPageWidthShare * 100}%`,
                    } as CSSProperties}
                    aria-label="Global modulation bar"
                >
                    <div
                        ref={tabRef}
                        data-role="mobile-global-mod-rail-tab"
                        className="mobile-global-mod-rail-parked-row"
                    >
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-selected"
                            className="mobile-global-mod-rail-module mobile-global-mod-rail-selected"
                            aria-label={`${selectedSource.label} selected`}
                            {...sourceHandlers(selectedSource, true)}
                        >
                            <ModSourceArt source={selectedSource} />
                            {clampedActivity !== null ? (
                                <span
                                    className="mobile-global-mod-rail-activity"
                                    aria-label={`${selectedSource.label} activity`}
                                    style={{ "--source-activity": clampedActivity } as CSSProperties}
                                ><span /></span>
                            ) : null}
                            <span
                                data-role="mobile-global-mod-rail-route-count"
                                data-count-pulsing={countPulsing || undefined}
                                className="mobile-global-mod-rail-route-count"
                                aria-label={`${routeCount} modulation routes`}
                            >{routeCount}</span>
                        </button>
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-parked-previous"
                            className="mobile-global-mod-rail-parked-paddle"
                            aria-label="Previous Mod bar group"
                            onClick={() => changeParkedPage(-1)}
                        >
                            <span className="rack-mod-chevron" data-direction="left" aria-hidden="true" />
                        </button>
                        <div
                            data-role="mobile-global-mod-rail-parked-page"
                            className="mobile-global-mod-rail-parked-page"
                            aria-label={parkedPageIndex === parkedToolPageIndex
                                ? "Mod bar tools"
                                : `Modulation source group ${parkedPageIndex + 1}`}
                        >
                            {parkedPageIndex === parkedToolPageIndex ? (
                                <div className="mobile-global-mod-rail-parked-tools" role="group" aria-label="Audition controls">
                                    {auditionToolButtons}
                                </div>
                            ) : (
                                <div className="mobile-global-mod-rail-parked-sources" role="group" aria-label="Rack modulation sources">
                                    {parkedSources.map((source) => {
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
                                                {...sourceHandlers(source, isSelected)}
                                            >
                                                <ModSourceArt source={source} />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {noteButton}
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-parked-next"
                            className="mobile-global-mod-rail-parked-paddle"
                            aria-label="Next Mod bar group"
                            onClick={() => changeParkedPage(1)}
                        >
                            <span className="rack-mod-chevron" data-direction="right" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            data-role="mobile-global-mod-rail-hide"
                            className="mobile-global-mod-rail-parked-hide"
                            aria-label="Hide parked Mod bar"
                            onClick={() => updateModBarPreferences({ parkedVisibility: "hidden" })}
                        >
                            <span className="rack-mod-chevron" data-direction="down" aria-hidden="true" />
                        </button>
                    </div>
                    {voicePopover}
                </aside>
                {parkedHidden ? (
                    <button
                        type="button"
                        data-role="mobile-global-mod-rail-restore"
                        className="mobile-global-mod-rail-restore"
                        aria-label="Restore parked Mod bar"
                        onClick={() => updateModBarPreferences({ parkedVisibility: "visible" })}
                    >
                        <span className="rack-mod-chevron" data-direction="up" aria-hidden="true" />
                    </button>
                ) : null}
                {sourceDrag && ghostLayerPoint ? (
                    <div
                        data-role="mobile-global-mod-source-ghost"
                        data-target-captured={sourceDrag.targetCaptured}
                        className="mobile-global-mod-source-ghost"
                        style={{
                            left: ghostLayerPoint.left,
                            top: ghostLayerPoint.top,
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

    return (
        <div
            ref={layerRef}
            data-role="mobile-global-mod-rail-layer"
            className="mobile-global-mod-rail-layer"
            style={{ "--rail-scale": preferences.scale } as CSSProperties}
        >
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
                    "--rail-scale": preferences.scale,
                    "--rail-outline": `${railGeometry.outline}px`,
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
                    viewBox={`0 0 ${railGeometry.width} ${silhouetteHeight}`}
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
                                toggleExpanded();
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
                                    clearUiTimeout(settleXTimeoutRef.current);
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
                                gesture.moved ||= Math.abs(deltaY) > railGeometry.dragThreshold
                                    || Math.abs(deltaX) > railGeometry.dragThreshold;
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
                                const edgeSpan = Math.max(
                                    0,
                                    layerWidthRef.current - railGeometry.width,
                                );
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
                            {...sourceHandlers(selectedSource, true)}
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
                            data-count-pulsing={countPulsing || undefined}
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
                {voicePopover}
            </aside>
            {sourceDrag && ghostLayerPoint ? (
                <div
                    data-role="mobile-global-mod-source-ghost"
                    data-target-captured={sourceDrag.targetCaptured}
                    className="mobile-global-mod-source-ghost"
                    style={{
                        left: ghostLayerPoint.left,
                        top: ghostLayerPoint.top,
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

type RackParameterMenuState = {
    readonly endpointID: string;
    readonly clientX: number;
    readonly clientY: number;
};

const SPLIT_XOVER_MIN_HZ = 40;
const SPLIT_XOVER_MAX_HZ = 18000;
const SPLIT_XOVER_LOG_SPAN = Math.log(SPLIT_XOVER_MAX_HZ / SPLIT_XOVER_MIN_HZ);
const SPLIT_XOVER_ENTRY_SPEC = parameterEntrySpecForFrequency({
    minHz: SPLIT_XOVER_MIN_HZ,
    maxHz: SPLIT_XOVER_MAX_HZ,
    stepHz: 0,
    allowLogPercent: false,
});
const SPLIT_KEY_TRACK_DEFINITION = getKeyTrackDefinition("lane.frequencySplitLowHz");
if (SPLIT_KEY_TRACK_DEFINITION === null) {
    throw new Error("Frequency Split is missing its Key Track definition.");
}
const SPLIT_KEY_TRACK_RANGE = requireKeyTrackRange(SPLIT_KEY_TRACK_DEFINITION.family);
const SPLIT_KEY_TRACK_OFFSET_ENTRY_SPEC = parameterEntrySpecForKeyTrackOffset(
    SPLIT_KEY_TRACK_DEFINITION.family);
const SPLIT_KEY_TRACK_ROUTE_ENTRY_SPEC = parameterEntrySpecForKeyTrackModulationAmount(
    SPLIT_KEY_TRACK_DEFINITION.family, "octaves");

function crossoverToNormalized(hz: number) {
    return clamp(Math.log(hz / SPLIT_XOVER_MIN_HZ) / SPLIT_XOVER_LOG_SPAN, 0, 1);
}

function normalizedToCrossover(normalized: number) {
    return SPLIT_XOVER_MIN_HZ * Math.exp(clamp(normalized, 0, 1) * SPLIT_XOVER_LOG_SPAN);
}

/**
 * One crossover fader: a log-scaled horizontal drag on the acked marker
 * hot path (live field uploads while dragging, one document persist on
 * release — the same discipline as every device knob).
 */
function CrossoverSlider({
    groupId,
    which,
    label,
    hz,
    keyTrackEnabled,
    keyTrackOffsetSemitones,
    routes,
    activeSource,
    sourceIsArmed,
    onHzDrag,
    onKeyTrackOffsetDrag,
    onKeyTrackToggle,
    onGestureEnd,
}: {
    groupId: string;
    which: "low" | "high";
    label: string;
    hz: number;
    keyTrackEnabled: boolean;
    keyTrackOffsetSemitones: number;
    routes: ReadonlyArray<ModulationRoute>;
    activeSource: RackModulationSource;
    sourceIsArmed: boolean;
    onHzDrag: (which: "low" | "high", hz: number) => void;
    onKeyTrackOffsetDrag: (which: "low" | "high", offsetSemitones: number) => void;
    onKeyTrackToggle: (which: "low" | "high", enabled: boolean) => void;
    onGestureEnd: () => void;
}) {
    const surfaceRef = useRef<HTMLButtonElement | null>(null);
    const ordinaryDragPointerRef = useRef<number | null>(null);
    const gestureController = useParameterGesture();
    const openParameterMenu = useParameterMenu();
    const unitNumber = Number(groupId.slice(groupId.indexOf("#") + 1));
    const targetKind = `lane.frequencySplit#${unitNumber}.${which === "low" ? "xoverLowHz" : "xoverHighHz"}` as ModulationTargetKind;
    const route = sourceIsArmed ? routes.find((candidate) => (
        candidate.targetKind === targetKind
        && candidate.sourceKind === activeSource.sourceKind
        && candidate.sourceSlot === activeSource.sourceSlot
    )) ?? null : null;
    const amountBinding = useModulationRouteAmountBinding(route);
    const canonicalAmount = amountBinding.value ?? route?.amount ?? 0;
    const displayedAmount = keyTrackEnabled
        ? keyTrackRouteAmountToSemitones(canonicalAmount, "octaves")
        : canonicalAmount;
    const displayedValue = keyTrackEnabled ? keyTrackOffsetSemitones : hz;
    const baseNormalized = keyTrackEnabled
        ? (displayedValue - SPLIT_KEY_TRACK_RANGE.knobMin)
            / (SPLIT_KEY_TRACK_RANGE.knobMax - SPLIT_KEY_TRACK_RANGE.knobMin)
        : crossoverToNormalized(hz);
    const amountMin = keyTrackEnabled ? SPLIT_KEY_TRACK_RANGE.routeMin : -4;
    const amountMax = keyTrackEnabled ? SPLIT_KEY_TRACK_RANGE.routeMax : 4;
    const amountNormalized = (displayedAmount - amountMin) / (amountMax - amountMin);
    const targetRouteCount = routes.filter((candidate) => candidate.targetKind === targetKind).length;
    const hasEnabledTargetRoute = routes.some((candidate) => (
        candidate.targetKind === targetKind && candidate.enabled));

    const applyOrdinaryClientX = useCallback((clientX: number) => {
        const surface = surfaceRef.current;
        if (surface === null) {
            return;
        }
        const bounds = surface.getBoundingClientRect();
        const normalized = (clientX - bounds.left) / Math.max(1, bounds.width);
        onHzDrag(which, Math.round(normalizedToCrossover(normalized)));
    }, [onHzDrag, which]);

    const commitBase = useCallback((value: number) => {
        if (keyTrackEnabled) {
            onKeyTrackOffsetDrag(which, value);
        } else {
            onHzDrag(which, value);
        }
        onGestureEnd();
    }, [keyTrackEnabled, onGestureEnd, onHzDrag, onKeyTrackOffsetDrag, which]);

    const openExactMenu = useCallback((clientX: number, clientY: number) => {
        openParameterMenu?.({
            controlKey: `frequencySplit#${unitNumber}.${which}`,
            label: keyTrackEnabled ? "Key Track Offset" : label,
            targetKind,
            baseSpec: keyTrackEnabled ? SPLIT_KEY_TRACK_OFFSET_ENTRY_SPEC : SPLIT_XOVER_ENTRY_SPEC,
            amountSpec: keyTrackEnabled ? SPLIT_KEY_TRACK_ROUTE_ENTRY_SPEC : undefined,
            baseFieldLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
            routeDestinationLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
            baseValue: displayedValue,
            defaultValue: keyTrackEnabled
                ? 0
                : which === "low" ? LANE_SPLIT_DEFAULT_XOVER_LOW_HZ : LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
            commitBase,
            clientX,
            clientY,
        });
    }, [commitBase, displayedValue, keyTrackEnabled, label, openParameterMenu, targetKind, unitNumber, which]);

    return (
        <div
            className="subway-crossover-control"
            data-modulation-target-kind={targetKind}
        >
            {targetRouteCount > 0 ? (
                <span className={`rack-route-count-badge ${hasEnabledTargetRoute ? "is-solid" : "is-hollow"}`}>
                    {targetRouteCount}
                </span>
            ) : null}
            <button
                ref={surfaceRef}
                type="button"
                role="slider"
                data-role={`rack-split-${which}-${groupId}`}
                aria-label={keyTrackEnabled ? "Key Track Offset" : label}
                aria-valuemin={keyTrackEnabled ? SPLIT_KEY_TRACK_RANGE.knobMin : SPLIT_XOVER_MIN_HZ}
                aria-valuemax={keyTrackEnabled ? SPLIT_KEY_TRACK_RANGE.knobMax : SPLIT_XOVER_MAX_HZ}
                aria-valuenow={displayedValue}
                aria-valuetext={keyTrackEnabled
                    ? `${Number(displayedValue.toFixed(2))} st`
                    : `${formatCrossoverHz(hz)} Hz`}
                className="subway-crossover-slider"
                style={{ "--crossover-progress": baseNormalized } as CSSProperties}
                onPointerDown={(event) => {
                    if (event.pointerType === "mouse" && event.button !== 0) return;
                    if (!keyTrackEnabled) {
                        try {
                            event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                            // Window-level release still ends the ordinary drag.
                        }
                        ordinaryDragPointerRef.current = event.pointerId;
                        applyOrdinaryClientX(event.clientX);
                        return;
                    }
                    gestureController.startGesture(event, {
                        horizontal: {
                            startNormalized: baseNormalized,
                            pixelsPerFullSpan: PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
                            write: (normalized) => {
                                if (keyTrackEnabled) {
                                    onKeyTrackOffsetDrag(which,
                                        SPLIT_KEY_TRACK_RANGE.knobMin
                                        + normalized * (SPLIT_KEY_TRACK_RANGE.knobMax
                                            - SPLIT_KEY_TRACK_RANGE.knobMin));
                                } else {
                                    onHzDrag(which, Math.round(normalizedToCrossover(normalized)));
                                }
                            },
                        },
                        vertical: {
                            startNormalized: amountNormalized,
                            pixelsPerFullSpan: PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
                            write: route === null ? null : (normalized) => {
                                const amount = amountMin + normalized * (amountMax - amountMin);
                                amountBinding.setValue(keyTrackEnabled
                                    ? keyTrackRouteAmountFromSemitones(amount, "octaves")
                                    : amount);
                            },
                        },
                        onFinish: () => onGestureEnd(),
                        onLongPress: openParameterMenu === null ? undefined : openExactMenu,
                    });
                }}
                onPointerMove={(event) => {
                    if (ordinaryDragPointerRef.current === event.pointerId) {
                        applyOrdinaryClientX(event.clientX);
                    }
                }}
                onPointerUp={(event) => {
                    if (ordinaryDragPointerRef.current === event.pointerId) {
                        ordinaryDragPointerRef.current = null;
                        onGestureEnd();
                    }
                }}
                onPointerCancel={(event) => {
                    if (ordinaryDragPointerRef.current === event.pointerId) {
                        ordinaryDragPointerRef.current = null;
                        onGestureEnd();
                    }
                }}
                onContextMenu={(event) => {
                    if (openParameterMenu === null) return;
                    event.preventDefault();
                    openExactMenu(event.clientX, event.clientY);
                }}
                onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowRight" ? 1 : -1;
                    if (keyTrackEnabled) {
                        onKeyTrackOffsetDrag(which, clamp(
                            keyTrackOffsetSemitones + direction * 0.1,
                            SPLIT_KEY_TRACK_RANGE.knobMin,
                            SPLIT_KEY_TRACK_RANGE.knobMax));
                    } else {
                        onHzDrag(which, Math.round(clamp(
                            hz * Math.pow(2, direction / 12),
                            SPLIT_XOVER_MIN_HZ,
                            SPLIT_XOVER_MAX_HZ)));
                    }
                    onGestureEnd();
                }}
            >
                <span className="subway-crossover-label">{keyTrackEnabled ? "KEY TRACK OFFSET" : label}</span>
                <strong className="subway-crossover-readout">{keyTrackEnabled
                    ? `${Number(displayedValue.toFixed(2))} st`
                    : `${formatCrossoverHz(hz)} Hz`}</strong>
                {route !== null ? (
                    <small>{keyTrackEnabled
                        ? `${Number(displayedAmount.toFixed(2))} st`
                        : formatModulationAmountReadout(targetKind, canonicalAmount, route.polarity)}</small>
                ) : null}
            </button>
            <button
                type="button"
                data-role={`key-track-frequencySplit-${which}-${groupId}`}
                aria-pressed={keyTrackEnabled}
                className="key-track-button split-key-track-button"
                onClick={() => onKeyTrackToggle(which, !keyTrackEnabled)}
            >Key Track</button>
        </div>
    );
}

/** The right-pane editor for a selected GROUP: crossovers for splits,
    fan-out and bypass for both kinds, dissolve to leave. */
function GroupEditorPane({
    group,
    soloedBranchIndex,
    onToggleSolo,
    onToggleEnabled,
    onSetBranchCount,
    onDissolve,
    onCrossoverDrag,
    onCrossoverKeyTrackOffsetDrag,
    onCrossoverKeyTrackToggle,
    onCrossoverGestureEnd,
    routes,
    activeSource,
    sourceIsArmed,
}: {
    group: LaneGroupV2;
    soloedBranchIndex: number | null;
    onToggleSolo: (branchIndex: number) => void;
    onToggleEnabled: () => void;
    onSetBranchCount: (branchCount: number) => void;
    onDissolve: () => void;
    onCrossoverDrag: (which: "low" | "high", hz: number) => void;
    onCrossoverKeyTrackOffsetDrag: (which: "low" | "high", offsetSemitones: number) => void;
    onCrossoverKeyTrackToggle: (which: "low" | "high", enabled: boolean) => void;
    onCrossoverGestureEnd: () => void;
    routes: ReadonlyArray<ModulationRoute>;
    activeSource: RackModulationSource;
    sourceIsArmed: boolean;
}) {
    const isSplit = group.kind === "split";
    const unitNumber = group.groupId.slice(group.groupId.indexOf("#") + 1);
    const branchLabels = isSplit
        ? (group.branches.length === 3 ? ["LO", "MID", "HI"] : ["LO", "HI"])
        : group.branches.map((_, branchIndex) => String.fromCharCode("A".charCodeAt(0) + branchIndex));

    return (
        <section
            data-role={`rack-group-editor-${group.groupId}`}
            data-effect-enabled={group.enabled ? "true" : "false"}
            className="rack-effect-editor subway-group-editor"
            style={{ "--editor-accent": "#69d5c5" } as CSSProperties}
            aria-label="Selected group editor"
        >
            <header className="rack-editor-header">
                <div className="rack-editor-heading">
                    <span>{group.enabled ? "SELECTED GROUP" : "GROUP BYPASSED"}</span>
                    <strong className="rack-editor-name">
                        {isSplit ? "FREQ SPLIT" : "PARALLEL"} {unitNumber}
                    </strong>
                    <p>
                        {isSplit
                            ? "Linkwitz-Riley bands — drag the crossovers."
                            : "Every branch reads the fork; the merge sums them."}
                    </p>
                </div>
                <button
                    type="button"
                    data-role="rack-group-power"
                    aria-label={`${group.enabled ? "Bypass" : "Enable"} group`}
                    aria-pressed={group.enabled}
                    className="rack-power rack-editor-power"
                    onClick={onToggleEnabled}
                >
                    <PowerGlyph />
                </button>
            </header>
            <div className="subway-group-editor-body">
                <div
                    className="subway-group-solo-controls"
                    style={{ "--subway-solo-count": group.branches.length } as CSSProperties}
                    role="group"
                    aria-label={`${isSplit ? "Frequency split band" : "Parallel branch"} Solo controls`}
                >
                    {branchLabels.map((label, branchIndex) => (
                        <button
                            type="button"
                            key={label}
                            data-role={`rack-branch-solo-${group.groupId}-${branchIndex}`}
                            data-branch-index={branchIndex}
                            aria-label={`Solo ${isSplit ? `${label} band` : `branch ${label}`}`}
                            aria-pressed={soloedBranchIndex === branchIndex}
                            className="subway-group-solo"
                            onClick={() => onToggleSolo(branchIndex)}
                        >
                            <span>{label}</span>
                            <strong>SOLO</strong>
                        </button>
                    ))}
                </div>
                {isSplit ? (
                    <div className="subway-crossover-stack">
                        <CrossoverSlider
                            groupId={group.groupId}
                            which="low"
                            label={group.branches.length === 3 ? "LOW CROSSOVER" : "CROSSOVER"}
                            hz={group.xoverLowHz}
                            keyTrackEnabled={group.xoverLowKeyTrackEnabled}
                            keyTrackOffsetSemitones={group.xoverLowKeyTrackOffsetSemitones}
                            routes={routes}
                            activeSource={activeSource}
                            sourceIsArmed={sourceIsArmed}
                            onHzDrag={onCrossoverDrag}
                            onKeyTrackOffsetDrag={onCrossoverKeyTrackOffsetDrag}
                            onKeyTrackToggle={onCrossoverKeyTrackToggle}
                            onGestureEnd={onCrossoverGestureEnd}
                        />
                        {group.branches.length === 3 ? (
                            <CrossoverSlider
                                groupId={group.groupId}
                                which="high"
                                label="HIGH CROSSOVER"
                                hz={group.xoverHighHz}
                                keyTrackEnabled={group.xoverHighKeyTrackEnabled}
                                keyTrackOffsetSemitones={group.xoverHighKeyTrackOffsetSemitones}
                                routes={routes}
                                activeSource={activeSource}
                                sourceIsArmed={sourceIsArmed}
                                onHzDrag={onCrossoverDrag}
                                onKeyTrackOffsetDrag={onCrossoverKeyTrackOffsetDrag}
                                onKeyTrackToggle={onCrossoverKeyTrackToggle}
                                onGestureEnd={onCrossoverGestureEnd}
                            />
                        ) : null}
                    </div>
                ) : null}
                <div className="subway-group-editor-actions">
                    {isSplit ? (
                        <button
                            type="button"
                            data-role={group.branches.length === 2 ? "rack-group-add-band" : "rack-group-remove-band"}
                            onClick={() => onSetBranchCount(group.branches.length === 2 ? 3 : 2)}
                        >
                            {group.branches.length === 2 ? "Add mid band" : "Remove mid band"}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                data-role="rack-group-add-branch"
                                disabled={group.branches.length >= LANE_MAX_BRANCHES_PER_GROUP}
                                onClick={() => onSetBranchCount(group.branches.length + 1)}
                            >
                                Add branch
                            </button>
                            <button
                                type="button"
                                data-role="rack-group-remove-branch"
                                disabled={group.branches.length <= 2}
                                onClick={() => onSetBranchCount(group.branches.length - 1)}
                            >
                                Remove branch
                            </button>
                        </>
                    )}
                    <button type="button" data-role="rack-group-dissolve" onClick={onDissolve}>
                        Dissolve group
                    </button>
                </div>
            </div>
        </section>
    );
}

function PolishEditor({
    enhancerAmount,
    compressionClipAmount,
    outputTrimDb,
}: {
    readonly enhancerAmount: PatchControlBinding<number>;
    readonly compressionClipAmount: PatchControlBinding<number>;
    readonly outputTrimDb: PatchControlBinding<number>;
}) {
    const bindings = {
        enhancer: enhancerAmount,
        compressionClip: compressionClipAmount,
        trim: outputTrimDb,
    } as const;

    return (
        <section
            data-role="rack-editor-polish"
            className="rack-effect-editor polish-editor"
            style={{ "--editor-accent": POLISH_ACCENT } as CSSProperties}
            aria-label="Polish editor"
        >
            <header className="rack-editor-header polish-editor-header">
                <div className="rack-editor-heading">
                    <span>FIXED OUTPUT SECTION</span>
                    <strong className="rack-editor-name">POLISH</strong>
                    <p>Safe Bass → Enhancer → Compression / Clip → Trim</p>
                </div>
            </header>
            <div className="rack-editor-visual polish-editor-flow" aria-hidden="true">
                <span>SAFE BASS</span>
                <i />
                <span>ENHANCER</span>
                <i />
                <span>COMP / CLIP</span>
                <i />
                <span>TRIM</span>
            </div>
            <div className="rack-editor-controls polish-editor-controls">
                {POLISH_CONTROL_DESCRIPTORS.map((control) => {
                    const binding = bindings[control.bindingKey];
                    return (
                        <div
                            key={control.descriptor.endpointID}
                            className="rack-editor-control polish-editor-control"
                            data-role={`polish-control-${control.descriptor.endpointID}`}
                        >
                            <BaseParameterKnob
                                descriptor={control.descriptor}
                                binding={binding}
                                ownerAccent={POLISH_ACCENT}
                                dataRole={`polish-knob-${control.descriptor.endpointID}`}
                                trackDataRole={`polish-knob-track-${control.descriptor.endpointID}`}
                                handleDataRole={`polish-knob-handle-${control.descriptor.endpointID}`}
                                detentStep={null}
                                entrySpec={parameterEntrySpecForScalar({
                                    min: control.descriptor.min,
                                    max: control.descriptor.max,
                                    step: control.descriptor.step,
                                    unit: control.unit,
                                    canonicalPerDisplayedUnit: control.canonicalPerDisplayedUnit,
                                    digits: control.digits,
                                })}
                                formatValue={(value) => control.bindingKey === "trim"
                                    ? `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`
                                    : `${Math.round(value * 100)}%`}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export function EffectsRackWorkspace({
    routes,
    observedFilterSpectrum,
    observedDistortionHistory,
    observedDistortionScope,
    polishEnhancerAmount,
    polishCompressionClipAmount,
    polishOutputTrimDb,
    onAddRouteWithOverrides,
    onRemoveRoute,
    onRouteChange,
    onBackToVoice,
    onModSourceTap,
    modSourceTapMode = "select-then-open",
    onGlobalModRailStateChange,
    onGlobalModSourceDragChange,
    onGlobalModSourceSelect,
    onGlobalModSourceDrop,
    selectModSourceSignal = null,
    onRouteCreationConfirmed,
    onSelectedEffectChange,
    mobileGlobalModRail = false,
    mobileModRailPortalTarget = null,
    modBarPreferences,
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
    if (mobileGlobalModRail && !modBarPreferences) {
        throw new Error("The mobile Mod rail requires application preferences.");
    }
    const {
        rackState,
        rackStateRef,
        commit,
        setOutputMix,
        setOutputBypassed,
        setSplitCrossover,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    } = useRackState();
    const { soloState, toggleSolo } = useLaneSoloAudition(rackState);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [polishSelected, setPolishSelected] = useState(false);
    const [groupMenu, setGroupMenu] = useState<SubwayGroupMenuRequest | null>(null);
    // Selection is a DEVICE INSTANCE (T6): the effect id derives from it.
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("distortion#1");
    const selectedEffectId = effectIdForLaneDeviceId(selectedDeviceId);
    const [quickEndpointByEffect, setQuickEndpointByEffect] = useState<Readonly<Record<EffectModuleId, string>>>(() => (
        Object.fromEntries(RACK_EFFECT_DESCRIPTORS.map((effect) => [effect.id, effect.initialQuickEndpointID])) as Record<EffectModuleId, string>
    ));
    const [previewDoc, setPreviewDoc] = useState<LaneStateV2>(rackState);
    const previewDocRef = useRef<LaneStateV2>(rackState);
    const rackListRef = useRef<HTMLDivElement | null>(null);
    const [rackGraphWidth, setRackGraphWidth] = useState(0);
    const [rackScrollPresentation, setRackScrollPresentation] = useState({
        overflow: false,
        atTop: true,
        atBottom: true,
    });
    const updateRackScrollPresentation = useCallback(() => {
        const list = rackListRef.current;
        if (list === null) {
            return;
        }
        const measuredGraphWidth = list.clientWidth;
        setRackGraphWidth((current) => (
            current === measuredGraphWidth ? current : measuredGraphWidth
        ));
        const overflow = list.scrollHeight > list.clientHeight + 2;
        const atTop = !overflow || list.scrollTop <= 2;
        const atBottom = !overflow
            || list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
        setRackScrollPresentation((current) => (
            current.overflow === overflow
                && current.atTop === atTop
                && current.atBottom === atBottom
                ? current
                : { overflow, atTop, atBottom }
        ));
    }, []);
    const reorderRef = useRef<ReorderGesture | null>(null);
    const reorderBranchDwellRef = useRef<{ key: string; timer: number } | null>(null);
    const [reorderingDeviceId, setReorderingDeviceId] = useState<string | null>(null);
    const [focusedBranchIndices, setFocusedBranchIndices] = useState<Readonly<Record<string, number>>>({});
    const focusRackBranch = useCallback((groupId: string, branchIndex: number) => {
        setFocusedBranchIndices((current) => (
            current[groupId] === branchIndex
                ? current
                : { ...current, [groupId]: branchIndex }
        ));
    }, []);
    useEffect(() => {
        // The non-nested lane.v2 model owns groups directly in the chain.
        // Reconcile presentation state after dissolve, preset restore, or a
        // legal branch-count reduction so a later reused id cannot inherit a
        // focus that belonged to a different topology.
        const branchCountByGroup = new Map(
            rackState.chain.flatMap((node) => (
                node.kind === "device" ? [] : [[node.groupId, node.branches.length] as const]
            )),
        );
        setFocusedBranchIndices((current) => {
            let changed = false;
            const reconciled: Record<string, number> = {};
            for (const [groupId, branchIndex] of Object.entries(current)) {
                const branchCount = branchCountByGroup.get(groupId);
                if (branchCount === undefined) {
                    changed = true;
                    continue;
                }
                const nextBranchIndex = Math.min(Math.max(branchIndex, 0), branchCount - 1);
                reconciled[groupId] = nextBranchIndex;
                changed ||= nextBranchIndex !== branchIndex;
            }
            return changed ? reconciled : current;
        });
    }, [rackState.chain]);
    const clearReorderBranchDwell = useCallback(() => {
        const dwell = reorderBranchDwellRef.current;
        if (dwell !== null) {
            clearUiTimeout(dwell.timer);
            reorderBranchDwellRef.current = null;
        }
    }, []);
    const updateReorderBranchDwell = useCallback((
        referenceElement: Element,
        clientX: number,
        clientY: number,
    ): boolean => {
        const badge = elementAtPointInRenderRoot(referenceElement, clientX, clientY)
            ?.closest<HTMLElement>("[data-focus-group-id][data-focus-branch-index]") ?? null;
        const groupId = badge?.dataset.focusGroupId;
        const branchIndex = Number(badge?.dataset.focusBranchIndex);
        if (badge === null || groupId === undefined || !Number.isInteger(branchIndex)) {
            clearReorderBranchDwell();
            return false;
        }

        const dwellKey = `${groupId}:${branchIndex}`;
        if ((focusedBranchIndices[groupId] ?? 0) === branchIndex
                || reorderBranchDwellRef.current?.key === dwellKey) {
            return true;
        }
        clearReorderBranchDwell();
        const timer = uiTimeout(() => {
            if (reorderRef.current === null || reorderBranchDwellRef.current?.key !== dwellKey) {
                return;
            }
            reorderBranchDwellRef.current = null;
            focusRackBranch(groupId, branchIndex);
        }, REORDER_BRANCH_FOCUS_DWELL_MS);
        reorderBranchDwellRef.current = { key: dwellKey, timer };
        return true;
    }, [clearReorderBranchDwell, focusRackBranch, focusedBranchIndices]);
    const [selectedSource, setSelectedSource] = useState<SelectedSource>({ sourceKind: "mseg", sourceSlot: 1 });
    const [sourceIsArmed, setSourceIsArmed] = useState(false);
    // T14 one-selection: the Mod page's selectors arm the bar. This state is
    // the real selection owner; onGlobalModRailStateChange re-reports it.
    useEffect(() => {
        if (selectModSourceSignal !== null) {
            setSelectedSource(selectModSourceSignal.source);
            setSourceIsArmed(true);
        }
    }, [selectModSourceSignal]);
    const [sourcePageIndex, setSourcePageIndex] = useState(0);
    const [dragSource, setDragSource] = useState<SelectedSource | null>(null);
    const [selectedTargetEndpointID, setSelectedTargetEndpointID] = useState("distortionDriveDb");
    const [hoverTargetEndpointID, setHoverTargetEndpointID] = useState<string | null>(null);
    const [routeStatus, setRouteStatus] = useState("");
    const feedbackToastLayer = useContext(ParameterHudLayerContext);
    const [desktopVoiceSettingsOpen, setDesktopVoiceSettingsOpen] = useState(false);
    const [desktopVoicePopoverPosition, setDesktopVoicePopoverPosition] = useState({ left: 8, top: 8 });
    const desktopVoiceToggleRef = useRef<HTMLButtonElement | null>(null);
    const desktopVoicePopoverRef = useRef<HTMLDivElement | null>(null);
    const positionDesktopVoicePopover = useCallback(() => {
        const layer = feedbackToastLayer;
        const toggle = desktopVoiceToggleRef.current;
        if (layer === null || toggle === null) {
            return;
        }
        const layerBounds = layer.getBoundingClientRect();
        const toggleBounds = toggle.getBoundingClientRect();
        const popoverWidth = desktopVoicePopoverRef.current?.offsetWidth ?? 220;
        const popoverHeight = desktopVoicePopoverRef.current?.offsetHeight ?? 180;
        const gap = 6;
        const maxLeft = Math.max(8, layerBounds.width - popoverWidth - 8);
        const left = clamp(toggleBounds.right - layerBounds.left - popoverWidth, 8, maxLeft);
        const preferredAbove = toggleBounds.top - layerBounds.top - popoverHeight - gap;
        const preferredBelow = toggleBounds.bottom - layerBounds.top + gap;
        const maxTop = Math.max(8, layerBounds.height - popoverHeight - 8);
        const top = clamp(preferredAbove >= 8 ? preferredAbove : preferredBelow, 8, maxTop);
        setDesktopVoicePopoverPosition((current) => (
            Math.abs(current.left - left) <= 0.5 && Math.abs(current.top - top) <= 0.5
                ? current
                : { left, top }
        ));
    }, [feedbackToastLayer]);
    useLayoutEffect(() => {
        if (!desktopVoiceSettingsOpen) {
            return;
        }
        positionDesktopVoicePopover();
        const observer = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(positionDesktopVoicePopover);
        if (desktopVoiceToggleRef.current !== null) {
            observer?.observe(desktopVoiceToggleRef.current);
        }
        if (desktopVoicePopoverRef.current !== null) {
            observer?.observe(desktopVoicePopoverRef.current);
        }
        window.addEventListener("resize", positionDesktopVoicePopover);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", positionDesktopVoicePopover);
        };
    }, [desktopVoiceSettingsOpen, positionDesktopVoicePopover]);
    useEffect(() => {
        if (!desktopVoiceSettingsOpen) {
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            const eventPath = event.composedPath();
            const sourceInteraction = eventPath.some((target) => (
                target instanceof Element
                && target.closest('[data-role^="rack-mod-source-"]') !== null
            ));
            if (
                sourceInteraction
                || (desktopVoicePopoverRef.current !== null && eventPath.includes(desktopVoicePopoverRef.current))
                || (desktopVoiceToggleRef.current !== null && eventPath.includes(desktopVoiceToggleRef.current))
            ) {
                return;
            }
            setDesktopVoiceSettingsOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDesktopVoiceSettingsOpen(false);
            }
        };
        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [desktopVoiceSettingsOpen]);
    // ADR-025: duplicate and failure reports are top-of-screen toasts, never
    // silent inline text. One at a time; the newest replaces the current.
    const [feedbackToast, setFeedbackToast] = useState<{ id: number; text: string } | null>(null);
    const feedbackToastSerialRef = useRef(0);
    const showFeedbackToast = useCallback((toastText: string) => {
        feedbackToastSerialRef.current += 1;
        setFeedbackToast({ id: feedbackToastSerialRef.current, text: toastText });
    }, []);
    useEffect(() => {
        if (feedbackToast === null) {
            return;
        }
        const timeout = uiTimeout(() => {
            setFeedbackToast((current) => (current?.id === feedbackToast.id ? null : current));
        }, 2000);
        return () => clearUiTimeout(timeout);
    }, [feedbackToast]);
    const handleDuplicateHover = useCallback(() => {
        showFeedbackToast("DUPLICATE");
        triggerWarningHaptic("heavy");
    }, [showFeedbackToast]);
    // ADR-025 row 15: the brief confirmed-creation window driving the target
    // flash, rising checkmark, and rail/matrix pulses.
    const [confirmedRoute, setConfirmedRoute] = useState<{
        endpointID: string | null;
        routeId: string;
        serial: number;
    } | null>(null);
    const confirmedRouteSerialRef = useRef(0);
    useEffect(() => {
        if (confirmedRoute === null) {
            return;
        }
        const timeout = uiTimeout(() => {
            setConfirmedRoute((current) => (current?.serial === confirmedRoute.serial ? null : current));
        }, 900);
        return () => clearUiTimeout(timeout);
    }, [confirmedRoute]);
    const [sourceDrag, setSourceDrag] = useState<SourceDragPresentation | null>(null);
    const handleSourceDragChange = useCallback((nextDrag: SourceDragPresentation | null) => {
        setSourceDrag(nextDrag);
        onGlobalModSourceDragChange?.(nextDrag?.source ?? null);
    }, [onGlobalModSourceDragChange]);
    const [railCollapseSignal, setRailCollapseSignal] = useState(0);
    const [parameterMenu, setParameterMenu] = useState<RackParameterMenuState | null>(null);
    const [stationMenu, setStationMenu] = useState<SubwayStationMenuRequest | null>(null);
    const [addSheet, setAddSheet] = useState<{
        path: LaneDevicePathV2;
        clientX: number;
        clientY: number;
    } | null>(null);
    const [parameterValueSheetEndpointID, setParameterValueSheetEndpointID] = useState<string | null>(null);
    const [removeTargetRoutesEndpointID, setRemoveTargetRoutesEndpointID] = useState<string | null>(null);
    const pendingRouteRef = useRef<{ key: string } | null>(null);
    const [pendingRouteKey, setPendingRouteKey] = useState<string | null>(null);

    useEffect(() => {
        if (parameterMenu === null && stationMenu === null && groupMenu === null && addSheet === null) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setParameterMenu(null);
                setStationMenu(null);
                setGroupMenu(null);
                setAddSheet(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [parameterMenu, stationMenu, groupMenu, addSheet]);

    useEffect(() => {
        if (reorderRef.current !== null) {
            return;
        }
        previewDocRef.current = rackState;
        setPreviewDoc(rackState);
    }, [rackState]);

    // A document swap (preset restore, storage hydrate) can strand the
    // selection on a device that no longer exists; heal it to the first
    // placed device. Only a truly empty document keeps the stale id — the
    // editor pane shows its empty placeholder for that.
    useEffect(() => {
        if (rackState.devices[selectedDeviceId] !== undefined) {
            return;
        }
        const fallback = firstLaneDeviceId(rackState);
        if (fallback !== null) {
            setSelectedDeviceId(fallback);
            onSelectedEffectChange?.(effectIdForLaneDeviceId(fallback));
        }
    }, [onSelectedEffectChange, rackState, selectedDeviceId]);

    // Selection and branch focus are separate presentation state. A newly
    // selected device reveals its owner, while a later badge tap may inspect
    // a sibling without stealing the effect editor selection.
    const selectedDevicePath = findLaneDevicePath(rackState, selectedDeviceId);
    const selectedBranchGroupId = selectedDevicePath?.kind === "branch"
        ? selectedDevicePath.groupId
        : null;
    const selectedBranchIndex = selectedDevicePath?.kind === "branch"
        ? selectedDevicePath.branchIndex
        : null;
    useEffect(() => {
        if (selectedBranchGroupId !== null && selectedBranchIndex !== null) {
            focusRackBranch(selectedBranchGroupId, selectedBranchIndex);
        }
    }, [
        focusRackBranch,
        selectedBranchGroupId,
        selectedBranchIndex,
        selectedDeviceId,
    ]);

    const selectedEffect = getRackEffectDescriptor(selectedEffectId);
    const selectedDeviceExists = rackState.devices[selectedDeviceId] !== undefined;
    const selectedInstanceNumber = parseLaneInstanceId(selectedDeviceId)?.instanceNumber ?? 1;
    const selectedEffectEnabled = getLaneDeviceEnabled(rackState, selectedDeviceId) ?? false;
    // The map draws the PREVIEW structure, but enables stay LIVE: an
    // authoritative enable arriving mid-drag paints immediately, exactly as
    // it did when order and enables were separate documents.
    const mapDoc = useMemo(() => {
        if (previewDoc === rackState) {
            return rackState;
        }
        let doc = previewDoc;
        for (const deviceId of Object.keys(previewDoc.devices)) {
            const liveEnabled = getLaneDeviceEnabled(rackState, deviceId);
            if (liveEnabled !== null && liveEnabled !== getLaneDeviceEnabled(previewDoc, deviceId)) {
                doc = setLaneDeviceEnabled(doc, deviceId, liveEnabled) ?? doc;
            }
        }
        return doc;
    }, [previewDoc, rackState]);

    useLayoutEffect(() => {
        const list = rackListRef.current;
        if (list === null) {
            return;
        }
        const animationFrame = window.requestAnimationFrame(updateRackScrollPresentation);
        const resizeObserver = new ResizeObserver(updateRackScrollPresentation);
        resizeObserver.observe(list);
        for (const child of list.children) {
            resizeObserver.observe(child);
        }
        window.addEventListener("resize", updateRackScrollPresentation);
        return () => {
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateRackScrollPresentation);
        };
    }, [mapDoc, updateRackScrollPresentation]);

    useLayoutEffect(() => {
        const list = rackListRef.current;
        if (list === null) {
            return;
        }
        const animationFrame = window.requestAnimationFrame(() => {
            const selected = list.querySelector<HTMLElement>(
                `[data-device-id="${CSS.escape(selectedDeviceId)}"]`,
            );
            if (selected === null) {
                return;
            }
            const listRect = list.getBoundingClientRect();
            const selectedRect = selected.getBoundingClientRect();
            if (selectedRect.top < listRect.top) {
                list.scrollTop -= listRect.top - selectedRect.top;
            } else if (selectedRect.bottom > listRect.bottom) {
                list.scrollTop += selectedRect.bottom - listRect.bottom;
            }
            updateRackScrollPresentation();
        });
        return () => window.cancelAnimationFrame(animationFrame);
    }, [mapDoc, selectedDeviceId, updateRackScrollPresentation]);
    const selectedGroup = selectedGroupId === null
        ? null
        : rackState.chain.find((node) => node.kind !== "device" && node.groupId === selectedGroupId) ?? null;
    const groupMenuNode = groupMenu === null
        ? null
        : rackState.chain.find((node) => node.kind !== "device" && node.groupId === groupMenu.groupId) ?? null;
    const stationMenuEffectId = stationMenu === null ? null : effectIdForLaneDeviceId(stationMenu.deviceId);
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
    const kindForDescriptor = useCallback((descriptor: RackParameterDescriptor) => (
        laneKindForDevice(
            laneDeviceIdForDescriptor(selectedDeviceId, descriptor),
            rackModulationIdentityEndpointID(descriptor),
        )
    ), [selectedDeviceId]);
    const selectedTargetKind = kindForDescriptor(selectedTarget);
    const selectedRouteIndex = routes.findIndex((route) => (
        route.sourceKind === selectedSource.sourceKind
        && route.sourceSlot === selectedSource.sourceSlot
        && route.targetKind === selectedTargetKind
    ));
    const selectedPairKey = `${selectedSource.sourceKind}:${selectedSource.sourceSlot}:${selectedTargetKind}`;
    const parameterOverlayEndpointID = parameterValueSheetEndpointID
        ?? parameterMenu?.endpointID
        ?? removeTargetRoutesEndpointID;
    const parameterOverlayDescriptor = parameterOverlayEndpointID === undefined
        || parameterOverlayEndpointID === null
        ? selectedTarget
        : getRackParameterDescriptor(parameterOverlayEndpointID)
            ?? selectedTarget;
    const parameterOverlayKeyTrack = useRackKeyTrackBinding(
        parameterOverlayDescriptor,
        selectedDeviceId,
    );
    const parameterOverlayBinding = parameterOverlayKeyTrack.binding;
    const parameterOverlayKeyTrackDefinition = getKeyTrackDefinition(
        `lane.${parameterOverlayDescriptor.endpointID}`);
    const parameterOverlaySyncModeEndpointID = parameterOverlayDescriptor.endpointID === "delayTime"
        ? "delayTimeMode"
        : parameterOverlayDescriptor.endpointID === "phaserRate"
            ? "phaserRateMode"
            : null;
    const parameterOverlaySyncDivisionEndpointID = parameterOverlayDescriptor.endpointID === "delayTime"
        ? "delayDivision"
        : parameterOverlayDescriptor.endpointID === "phaserRate"
            ? "phaserRateDivision"
            : null;
    const parameterOverlaySyncModeDescriptor = parameterOverlaySyncModeEndpointID === null
        ? parameterOverlayDescriptor
        : getRackParameterDescriptor(parameterOverlaySyncModeEndpointID) ?? parameterOverlayDescriptor;
    const parameterOverlaySyncDivisionDescriptor = parameterOverlaySyncDivisionEndpointID === null
        ? parameterOverlayDescriptor
        : getRackParameterDescriptor(parameterOverlaySyncDivisionEndpointID) ?? parameterOverlayDescriptor;
    const parameterOverlaySyncModeBinding = useRackParameterBinding(
        parameterOverlaySyncModeDescriptor,
        parameterValueSheetEndpointID !== null && parameterOverlaySyncModeEndpointID !== null,
        selectedDeviceId,
    );
    const parameterOverlaySyncDivisionBinding = useRackParameterBinding(
        parameterOverlaySyncDivisionDescriptor,
        parameterValueSheetEndpointID !== null && parameterOverlaySyncDivisionEndpointID !== null,
        selectedDeviceId,
    );
    const parameterOverlayTargetKind = kindForDescriptor(parameterOverlayDescriptor);
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
        const confirmed = routes.find((route) => routePairKey(route, route.targetKind) === pendingRouteKey);
        if (confirmed !== undefined) {
            pendingRouteRef.current = null;
            setPendingRouteKey(null);
            setRouteStatus("");
            // Authoritative confirmation only (ADR-025): the route exists in
            // the canonical document, so flash, tick, and pulse now.
            confirmedRouteSerialRef.current += 1;
            setConfirmedRoute({
                endpointID: parseLaneModulationTargetKind(confirmed.targetKind)?.endpointID
                    ? parseLaneModulationTargetKind(confirmed.targetKind)?.endpointID ?? null
                    : null,
                routeId: confirmed.id,
                serial: confirmedRouteSerialRef.current,
            });
            triggerLightHaptic();
            onRouteCreationConfirmed?.(confirmed.id);
            return;
        }
        const timeout = uiTimeout(() => {
            if (pendingRouteRef.current?.key === pendingRouteKey) {
                pendingRouteRef.current = null;
            }
            setPendingRouteKey((current) => current === pendingRouteKey ? null : current);
            setRouteStatus((current) => current === "CREATING MAPPING…" ? "MAPPING NOT CREATED" : current);
            showFeedbackToast("MAPPING NOT CREATED");
            triggerWarningHaptic("rigid");
        }, 750);
        return () => clearUiTimeout(timeout);
    }, [pendingRouteKey, routes]);

    const toggleDeviceEnabled = useCallback((deviceId: string) => {
        const current = rackStateRef.current;
        const next = setLaneDeviceEnabled(
            current, deviceId, !(getLaneDeviceEnabled(current, deviceId) ?? false));
        if (next !== null) {
            commit(next);
        }
    }, [commit, rackStateRef]);

    // A station drag that crosses the lift threshold hands the pointer to the
    // list-level reorder machinery — the same physics the grip handle drove.
    const armStationReorder = useCallback((deviceId: string, event: ReactPointerEvent<HTMLElement>) => {
        const captureElement = rackListRef.current;
        if (!captureElement || reorderRef.current !== null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
            captureElement.setPointerCapture(event.pointerId);
        } catch {
            // The list and window handlers remain authoritative when capture
            // is unavailable or the platform has already lost it.
        }
        reorderRef.current = {
            pointerId: event.pointerId,
            deviceId,
            originalDoc: previewDocRef.current,
            captureElement,
        };
        setReorderingDeviceId(deviceId);
    }, []);

    const moveDeviceByOffset = useCallback((deviceId: string, offset: -1 | 1) => {
        const doc = rackStateRef.current;
        const path = findLaneDevicePath(doc, deviceId);
        if (path === null) {
            return;
        }
        const next = moveLaneDevice(doc, deviceId, {
            ...path,
            index: Math.max(0, path.index + offset),
        });
        if (next !== null && serializeLaneStateV2(next) !== serializeLaneStateV2(doc)) {
            previewDocRef.current = next;
            setPreviewDoc(next);
            commit(next);
        }
    }, [commit, rackStateRef]);

    const finishReorder = useCallback((pointerId: number, shouldCommit: boolean) => {
        const gesture = reorderRef.current;
        if (!gesture || gesture.pointerId !== pointerId) {
            return;
        }

        reorderRef.current = null;
        clearReorderBranchDwell();
        setReorderingDeviceId(null);
        try {
            if (gesture.captureElement.hasPointerCapture(pointerId)) {
                gesture.captureElement.releasePointerCapture(pointerId);
            }
        } catch {
            // Capture may already be gone after a platform cancellation.
        }

        if (shouldCommit
                && serializeLaneStateV2(gesture.originalDoc) !== serializeLaneStateV2(previewDocRef.current)) {
            commit(previewDocRef.current);
        } else {
            const currentDoc = rackStateRef.current;
            previewDocRef.current = currentDoc;
            setPreviewDoc(currentDoc);
        }
    }, [clearReorderBranchDwell, commit, rackStateRef]);

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

        // A folded four-lane branch deliberately has no direct body target.
        // Deliberately dwelling its full-size badge opens that branch without
        // moving the device to a nearby visible rail while the badge is held.
        if (updateReorderBranchDwell(event.currentTarget, event.clientX, event.clientY)) {
            return;
        }

        // Pick the drop target in BOTH axes: lanes sit side by side, so a
        // Y-only walk lands in the wrong band. A containing rect wins over
        // distance, the SMALLEST containing rect wins over an enclosing row
        // (the ghost cell inside a lane beats the full-width trunk row), and
        // with no containment the nearest center takes it.
        const rackUnits = Array.from(
            renderRoot.querySelectorAll<HTMLElement>("[data-lane-path]"),
        );
        let targetUnit: HTMLElement | null = null;
        let targetScore = Number.POSITIVE_INFINITY;
        for (const unit of rackUnits) {
            const stationControl = unit.querySelector<HTMLElement>(":scope > .subway-station");
            const ownerWindow = unit.ownerDocument.defaultView;
            if (stationControl !== null
                    && ownerWindow?.getComputedStyle(stationControl).display === "none") {
                continue;
            }
            const rect = unit.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }
            const contains = event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom;
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const score = contains
                ? rect.width * rect.height
                : 1e12 + ((event.clientX - centerX) ** 2) + ((event.clientY - centerY) ** 2);
            if (score < targetScore) {
                targetUnit = unit;
                targetScore = score;
            }
        }
        const targetPath = parseLaneDevicePath(targetUnit?.dataset.lanePath);
        if (targetPath === null) {
            return;
        }

        const nextDoc = moveLaneDevice(previewDocRef.current, gesture.deviceId, targetPath);
        if (nextDoc !== null
                && serializeLaneStateV2(nextDoc) !== serializeLaneStateV2(previewDocRef.current)) {
            previewDocRef.current = nextDoc;
            setPreviewDoc(nextDoc);
        }
    }, [finishReorder, updateReorderBranchDwell]);

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
        const targetKind = parseAnyModulationTargetKind(requestedTargetKind);
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
            showFeedbackToast("MAPPING NOT CREATED");
            triggerWarningHaptic("rigid");
            return false;
        }

        const key = routePairKey(source, targetKind);
        pendingRouteRef.current = { key };
        setPendingRouteKey(key);
        setRouteStatus("CREATING MAPPING…");
        return true;
    }, [getPairCreation, onAddRouteWithOverrides]);

    const selectDevice = useCallback((deviceId: string) => {
        const effectId = effectIdForLaneDeviceId(deviceId);
        setPolishSelected(false);
        setSelectedGroupId(null);
        setSelectedDeviceId(deviceId);
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

    // Effect-typed entry points (dwell navigation, parameter taps) resolve to
    // the selection itself when the type already matches, else the document's
    // lowest-numbered instance of the type, else the pool's #1.
    const deviceIdForEffectSelection = useCallback((effectId: EffectModuleId): string => {
        const deviceType = EFFECT_ID_TO_LANE_TYPE[effectId];
        if (parseLaneInstanceId(selectedDeviceId)?.deviceType === deviceType) {
            return selectedDeviceId;
        }
        const placed = listLaneDeviceInstancesV2(rackStateRef.current)
            .find((instance) => instance.deviceType === deviceType);
        return placed?.instanceId ?? `${deviceType}#1`;
    }, [rackStateRef, selectedDeviceId]);

    const selectEffect = useCallback((effectId: EffectModuleId) => {
        selectDevice(deviceIdForEffectSelection(effectId));
    }, [deviceIdForEffectSelection, selectDevice]);

    const selectTarget = useCallback((endpointID: string) => {
        const parameter = getRackParameterDescriptor(endpointID);
        if (!parameter || parameter.modulationTargetIndex === null) {
            return;
        }
        setSelectedTargetEndpointID(endpointID);
        setSelectedDeviceId(deviceIdForEffectSelection(parameter.effectId));
        onSelectedEffectChange?.(parameter.effectId);
        setRouteStatus("");
    }, [deviceIdForEffectSelection, onSelectedEffectChange]);

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
        onGlobalModSourceSelect?.(source);
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        setRouteStatus("");
    }, [onGlobalModSourceSelect]);

    const dropSource = useCallback((
        source: SelectedSource,
        targetKind: ModulationTargetKind,
        companionKinds: ReadonlyArray<ModulationTargetKind> = [],
    ) => {
        const parsedTarget = parseLaneModulationTargetKind(targetKind);
        const targetParameter = parsedTarget === null ? null : getRackParameterDescriptor(parsedTarget.endpointID);
        const creation = getPairCreation(source, targetKind);
        if (creation !== "existing" && creation !== "creatable") {
            return;
        }
        // ADR-025 row 16: releasing on an already-mapped pair changes nothing.
        // A compound surface stays droppable only while a companion is missing.
        const anyCreatable = creation === "creatable"
            || companionKinds.some((companionKind) => getPairCreation(source, companionKind) === "creatable");
        if (!anyCreatable) {
            return;
        }
        onGlobalModSourceDrop?.(source);
        setSelectedSource(source);
        setSourcePageIndex(source.sourceSlot - 1);
        setSourceIsArmed(true);
        if (targetParameter && targetParameter.modulationTargetIndex !== null) {
            setSelectedTargetEndpointID(targetParameter.endpointID);
            // The dropped kind names its instance — selection follows it.
            setSelectedDeviceId(parsedTarget?.instanceId ?? deviceIdForEffectSelection(targetParameter.effectId));
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
    }, [
        createRoute,
        deviceIdForEffectSelection,
        getPairCreation,
        onAddRouteWithOverrides,
        onGlobalModSourceDrop,
        onSelectedEffectChange,
    ]);

    const changeSourcePage = useCallback((nextPageIndex: number) => {
        const normalizedPageIndex = ((nextPageIndex % RACK_MODULATION_SOURCE_PAGES.length)
            + RACK_MODULATION_SOURCE_PAGES.length) % RACK_MODULATION_SOURCE_PAGES.length;
        setSourcePageIndex(normalizedPageIndex);
        setRouteStatus("");
    }, []);

    const setRecentParameter = useCallback((effectId: EffectModuleId, endpointID: string) => {
        setQuickEndpointByEffect((current) => ({ ...current, [effectId]: endpointID }));
    }, []);

    const handleParameterMenuAction = useCallback((action: ParameterMenuAction) => {
        if (action === "edit-values") {
            setParameterValueSheetEndpointID(parameterOverlayDescriptor.endpointID);
        } else if (action === "reset-base") {
            parameterOverlayBinding.commitValue(parameterOverlayKeyTrack.enabled
                ? 0
                : parameterOverlayDescriptor.initial);
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
        parameterOverlayKeyTrack.enabled,
        parameterOverlayDescriptor.endpointID,
        parameterOverlayDescriptor.initial,
        parameterOverlayRoute,
        parameterOverlayRouteIndex,
    ]);

    const hoverSourceTarget = useCallback((source: SelectedSource, targetKind: ModulationTargetKind | null) => {
        const parsedHoverTarget = targetKind === null ? null : parseLaneModulationTargetKind(targetKind);
        if (targetKind === null || parsedHoverTarget === null) {
            setHoverTargetEndpointID(null);
            return;
        }
        const endpointID = parsedHoverTarget.endpointID;
        const creation = getPairCreation(source, targetKind);
        setHoverTargetEndpointID(creation === "creatable" ? endpointID : null);
    }, [getPairCreation]);

    const openSelectedSource = useCallback((source: SelectedSource) => {
        setRailCollapseSignal((current) => current + 1);
        onModSourceTap?.(source);
    }, [onModSourceTap]);
    // The workspace, not either replaceable rail presentation, owns the
    // mapping lifecycle so a live placement change cannot unmount the drag.
    const sourceHandlers = useModSourceDrag({
        onHoverTarget: hoverSourceTarget,
        onDragSourceChange: setDragSource,
        onSourceDrop: dropSource,
        onSourceDragChange: handleSourceDragChange,
        onDwellNavigate: handleDwellNavigate,
        getPairCreation,
        onDuplicateHover: handleDuplicateHover,
        onTap: (source, wasActiveSelection) => {
            if (modSourceTapMode === "toggle-quick-source") {
                // T43: an inactive source changes selection and sheet ownership
                // atomically. The active source only toggles its existing editor.
                if (!wasActiveSelection) {
                    selectSource(source);
                }
                openSelectedSource(source);
                return;
            }
            if (wasActiveSelection) {
                openSelectedSource(source);
            } else {
                selectSource(source);
            }
        },
    });

    const desktopActivePlayMode = modRailVoiceSettings === undefined
        ? null
        : VOICE_MODE_OPTIONS.find((option) => option.value === modRailVoiceSettings.playMode.value);
    if (modRailVoiceSettings !== undefined && desktopActivePlayMode === undefined) {
        throw new Error(`Unknown play mode value: ${modRailVoiceSettings.playMode.value}`);
    }
    const desktopVoiceSettingsToggle = !mobileGlobalModRail
        && modRailVoiceSettings !== undefined
        && desktopActivePlayMode !== null
        && desktopActivePlayMode !== undefined ? (
            <button
                ref={desktopVoiceToggleRef}
                type="button"
                data-role="desktop-global-mod-rail-voice-toggle"
                className="rack-mod-voice-toggle"
                aria-pressed={desktopVoiceSettingsOpen}
                aria-haspopup="dialog"
                aria-label={`Voice settings (${desktopActivePlayMode.label})`}
                onClick={() => {
                    if (!desktopVoiceSettingsOpen) {
                        positionDesktopVoicePopover();
                    }
                    setDesktopVoiceSettingsOpen((current) => !current);
                }}
            >
                {desktopActivePlayMode.label}
            </button>
        ) : null;

    const modulationSourceControls = (
        <ModSourceCarousel
            pageIndex={sourcePageIndex}
            selectedSource={selectedSource}
            sourceIsArmed={sourceIsArmed}
            orientation={mobileGlobalModRail ? "vertical" : "horizontal"}
            headerAccessory={desktopVoiceSettingsToggle}
            onPageChange={changeSourcePage}
            sourceHandlers={sourceHandlers}
        />
    );

    const modulationRouteControls = (
        <>
            {/* T09: a selected mapped pair shows NO separate amount control —
                the target knob, its ring, and the shared HUD own that job. */}
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
        // Every parameter surface below (knobs, visuals, sheets, mod rows —
        // portals included) resolves lane bindings against the selection.
        <SelectedLaneDeviceContext.Provider value={selectedDeviceId}>
        <section
            data-role="effects-rack-card"
            data-layout-card="mobile-effects-workspace"
            className={`effects-rack-workspace ${className ?? ""}`}
        >
            {feedbackToast !== null && feedbackToastLayer !== null ? createPortal(
                <output
                    key={feedbackToast.id}
                    data-role="synth-feedback-toast"
                    className="synth-feedback-toast"
                    aria-live="assertive"
                >
                    {feedbackToast.text}
                </output>,
                feedbackToastLayer,
            ) : null}
            {!mobileGlobalModRail
                    && desktopVoiceSettingsOpen
                    && modRailVoiceSettings !== undefined
                    && feedbackToastLayer !== null ? createPortal(
                <ModRailVoiceSettingsPopover
                    settings={modRailVoiceSettings}
                    scale={1}
                    dataRole="desktop-global-mod-rail-voice-popover"
                    className="desktop-global-mod-rail-voice-popover"
                    popoverRef={desktopVoicePopoverRef}
                    style={desktopVoicePopoverPosition}
                />,
                feedbackToastLayer,
            ) : null}
            {parameterMenu ? (
                <ParameterContextMenu
                    position={parameterMenu}
                    controlId={parameterMenu.endpointID}
                    route={parameterOverlayRoute}
                    targetRouteCount={parameterOverlayTargetRouteIndices.length}
                    onClose={() => setParameterMenu(null)}
                    onSelectAction={handleParameterMenuAction}
                />
            ) : null}
            {stationMenu !== null && stationMenuEffectId !== null ? (
                // The station's long-press menu: everything the old row
                // offered, none of the bulk. Actions speak the station's own
                // device instance; the data-role contract stays effect-typed.
                <div
                    className="rack-parameter-menu-layer"
                    data-role="rack-station-menu-layer"
                    onPointerDown={() => setStationMenu(null)}
                >
                    <div
                        role="menu"
                        aria-label={`${getRackEffectDescriptor(stationMenuEffectId).label} station actions`}
                        data-role="rack-station-menu"
                        data-effect-id={stationMenuEffectId}
                        data-device-id={stationMenu.deviceId}
                        className="rack-parameter-menu"
                        style={{
                            "--rack-menu-x": `${stationMenu.clientX}px`,
                            "--rack-menu-y": `${stationMenu.clientY}px`,
                        } as CSSProperties}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-enabled-${stationMenuEffectId}`}
                            aria-pressed={getLaneDeviceEnabled(rackState, stationMenu.deviceId) ?? false}
                            onClick={() => {
                                toggleDeviceEnabled(stationMenu.deviceId);
                                setStationMenu(null);
                            }}
                        >
                            {(getLaneDeviceEnabled(rackState, stationMenu.deviceId) ?? false) ? "Bypass" : "Enable"}
                        </button>
                        {findLaneDevicePath(rackState, stationMenu.deviceId)?.kind === "trunk" ? (
                            <>
                                <button
                                    type="button"
                                    role="menuitem"
                                    data-role={`rack-station-wrap-parallel-${stationMenuEffectId}`}
                                    onClick={() => {
                                        const next = wrapLaneDeviceInGroup(
                                            rackStateRef.current, stationMenu.deviceId, "parallel");
                                        if (next === null) {
                                            showFeedbackToast("NO ROOM TO GROUP");
                                        } else {
                                            commit(next);
                                        }
                                        setStationMenu(null);
                                    }}
                                >
                                    Make parallel
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    data-role={`rack-station-wrap-split-${stationMenuEffectId}`}
                                    onClick={() => {
                                        const next = wrapLaneDeviceInGroup(
                                            rackStateRef.current, stationMenu.deviceId, "split");
                                        if (next === null) {
                                            showFeedbackToast("NO ROOM TO GROUP");
                                        } else {
                                            commit(next);
                                        }
                                        setStationMenu(null);
                                    }}
                                >
                                    Make frequency split
                                </button>
                            </>
                        ) : null}
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-station-exact-${stationMenuEffectId}`}
                            onClick={() => {
                                const effect = getRackEffectDescriptor(stationMenuEffectId);
                                const quickEndpointID = quickEndpointByEffect[stationMenuEffectId]
                                    ?? effect.initialQuickEndpointID;
                                selectDevice(stationMenu.deviceId);
                                setParameterValueSheetEndpointID(quickEndpointID);
                                setStationMenu(null);
                            }}
                        >
                            Exact value
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-station-remove-${stationMenuEffectId}`}
                            onClick={() => {
                                const next = removeLaneDevice(rackStateRef.current, stationMenu.deviceId);
                                if (next !== null) {
                                    commit(next);
                                    if (selectedDeviceId === stationMenu.deviceId) {
                                        const fallback = firstLaneDeviceId(next);
                                        if (fallback !== null) {
                                            selectDevice(fallback);
                                        }
                                    }
                                }
                                setStationMenu(null);
                            }}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : null}
            {groupMenu && groupMenuNode !== null && groupMenuNode.kind !== "device" ? (
                <div
                    className="rack-parameter-menu-layer"
                    data-role="rack-group-menu-layer"
                    onPointerDown={() => setGroupMenu(null)}
                >
                    <div
                        role="menu"
                        aria-label={`${groupMenuNode.kind === "split" ? "Frequency split" : "Parallel"} group actions`}
                        data-role="rack-group-menu"
                        data-group-id={groupMenu.groupId}
                        className="rack-parameter-menu"
                        style={{
                            "--rack-menu-x": `${groupMenu.clientX}px`,
                            "--rack-menu-y": `${groupMenu.clientY}px`,
                        } as CSSProperties}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-group-enabled-${groupMenu.groupId}`}
                            aria-pressed={groupMenuNode.enabled}
                            onClick={() => {
                                const next = setLaneGroupEnabled(
                                    rackStateRef.current, groupMenu.groupId, !groupMenuNode.enabled);
                                if (next !== null) {
                                    commit(next);
                                }
                                setGroupMenu(null);
                            }}
                        >
                            {groupMenuNode.enabled ? "Bypass group" : "Enable group"}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-group-menu-resize-${groupMenu.groupId}`}
                            onClick={() => {
                                const growing = groupMenuNode.kind === "split"
                                    ? groupMenuNode.branches.length === 2
                                    : groupMenuNode.branches.length < LANE_MAX_BRANCHES_PER_GROUP;
                                const nextCount = groupMenuNode.branches.length + (growing ? 1 : -1);
                                const next = setLaneGroupBranchCount(
                                    rackStateRef.current, groupMenu.groupId, nextCount);
                                if (next === null) {
                                    showFeedbackToast("EMPTY THE LANE FIRST");
                                } else {
                                    commit(next);
                                }
                                setGroupMenu(null);
                            }}
                        >
                            {groupMenuNode.kind === "split"
                                ? (groupMenuNode.branches.length === 2 ? "Add mid band" : "Remove mid band")
                                : (groupMenuNode.branches.length < LANE_MAX_BRANCHES_PER_GROUP
                                    ? "Add branch" : "Remove branch")}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            data-role={`rack-group-dissolve-${groupMenu.groupId}`}
                            onClick={() => {
                                const next = dissolveLaneGroup(rackStateRef.current, groupMenu.groupId);
                                if (next !== null) {
                                    commit(next);
                                    setSelectedGroupId((current) => (
                                        current === groupMenu.groupId ? null : current
                                    ));
                                }
                                setGroupMenu(null);
                            }}
                        >
                            Dissolve group
                        </button>
                    </div>
                </div>
            ) : null}
            {addSheet !== null ? (
                // The ghost's type picker: all eight devices, with the ones
                // the document cannot take (pool or wire capacity) disabled.
                <div
                    className="rack-parameter-menu-layer"
                    data-role="rack-add-sheet-layer"
                    onPointerDown={() => setAddSheet(null)}
                >
                    <div
                        role="menu"
                        aria-label="Add a device"
                        data-role="rack-add-sheet"
                        className="rack-parameter-menu"
                        style={{
                            "--rack-menu-x": `${addSheet.clientX}px`,
                            "--rack-menu-y": `${addSheet.clientY}px`,
                        } as CSSProperties}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {RACK_EFFECT_DESCRIPTORS.map((effect) => {
                            const deviceType = EFFECT_ID_TO_LANE_TYPE[effect.id];
                            const creatable = addLaneDevice(rackState, deviceType, addSheet.path) !== null;
                            return (
                                <button
                                    key={effect.id}
                                    type="button"
                                    role="menuitem"
                                    data-role={`rack-add-${effect.id}`}
                                    disabled={!creatable}
                                    onClick={() => {
                                        const current = rackStateRef.current;
                                        const next = addLaneDevice(current, deviceType, addSheet.path);
                                        if (next !== null) {
                                            const newDeviceId = Object.keys(next.devices)
                                                .find((deviceId) => current.devices[deviceId] === undefined);
                                            commit(next);
                                            if (newDeviceId !== undefined) {
                                                selectDevice(newDeviceId);
                                            }
                                        }
                                        setAddSheet(null);
                                    }}
                                >
                                    {effect.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
            {parameterValueSheetEndpointID ? (
                <ParameterValueSheet
                    key={`${parameterValueSheetEndpointID}:${selectedSource.sourceKind}:${selectedSource.sourceSlot}`}
                    heading={`${getRackEffectDescriptor(parameterOverlayDescriptor.effectId).label} · ${parameterOverlayKeyTrack.enabled ? "Key Track Offset" : parameterOverlayDescriptor.label}`}
                    label={parameterOverlayKeyTrack.enabled ? "Key Track Offset" : parameterOverlayDescriptor.label}
                    baseFieldLabel={parameterOverlayKeyTrack.enabled ? "Key Track Offset" : undefined}
                    routeFieldLabel={parameterOverlayKeyTrack.enabled && sourceIsArmed
                        ? `${activeSource.label} -> Key Track Offset`
                        : undefined}
                    base={{
                        spec: parameterOverlayKeyTrack.enabled && parameterOverlayKeyTrackDefinition !== null
                            ? parameterEntrySpecForKeyTrackOffset(parameterOverlayKeyTrackDefinition.family)
                            : parameterEntrySpecForRackParameter(parameterOverlayDescriptor, parameterOverlayBinding.value),
                        value: parameterOverlayBinding.value,
                        defaultValue: parameterOverlayKeyTrack.enabled ? 0 : parameterOverlayDescriptor.initial,
                    }}
                    amountSpec={(() => {
                        const targetKind = parseAnyModulationTargetKind(kindForDescriptor(parameterOverlayDescriptor));
                        return targetKind === null
                            ? null
                            : parameterOverlayKeyTrack.enabled && parameterOverlayKeyTrackDefinition !== null
                                ? parameterEntrySpecForKeyTrackModulationAmount(
                                    parameterOverlayKeyTrackDefinition.family,
                                    keyTrackRouteStorage(parameterOverlayDescriptor),
                                )
                                : parameterEntrySpecForModulationAmount(targetKind, parameterOverlayBinding.value);
                    })()}
                    route={parameterOverlayPresentedRoute}
                    sourceLabel={sourceIsArmed ? activeSource.label : null}
                    onApply={(baseCommit, modulationAmount) => {
                        if (baseCommit === null) {
                            throw new Error("A rack parameter value sheet requires a base commit.");
                        }
                        if (baseCommit._tag === "tempoDivision") {
                            // Publish the division before exposing Sync so the newly visible row
                            // never flashes the previous division.
                            parameterOverlaySyncDivisionBinding.commitValue(baseCommit.divisionValue);
                            parameterOverlaySyncModeBinding.commitValue(1);
                        } else {
                            parameterOverlayBinding.commitValue(baseCommit.value);
                            if (baseCommit.mode === "free") {
                                parameterOverlaySyncModeBinding.commitValue(0);
                            }
                        }
                        if (modulationAmount !== null) {
                            parameterOverlayAmountBinding.setValue(modulationAmount);
                        }
                        setParameterValueSheetEndpointID(null);
                    }}
                    onClose={() => setParameterValueSheetEndpointID(null)}
                />
            ) : null}
            {removeTargetRoutesEndpointID ? (
                <RemoveTargetRoutesConfirmation
                    targetLabel={parameterOverlayDescriptor.label}
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
                        className={`rack-list subway-map${rackScrollPresentation.overflow ? " has-overflow" : ""}${rackScrollPresentation.atTop ? " is-at-top" : ""}${rackScrollPresentation.atBottom ? " is-at-bottom" : ""}`}
                        data-role="rack-module-list"
                        onScroll={updateRackScrollPresentation}
                        onPointerMove={updateReorderPreview}
                        onPointerUp={(event) => finishReorder(event.pointerId, true)}
                        onPointerCancel={(event) => finishReorder(event.pointerId, false)}
                        onLostPointerCapture={(event) => {
                            // The station's capture handoff at the lift
                            // threshold BUBBLES through here; only the list
                            // losing its own capture cancels the gesture.
                            if (event.target !== event.currentTarget) {
                                return;
                            }
                            const gesture = reorderRef.current;
                            if (gesture?.captureElement === event.currentTarget) {
                                finishReorder(gesture.pointerId, false);
                            }
                        }}
                    >
                        <SubwayMapColumn
                            laneState={mapDoc}
                            graphWidth={rackGraphWidth}
                            selectedDeviceId={selectedDeviceId}
                            selectedGroupId={selectedGroupId}
                            reorderingDeviceId={reorderingDeviceId}
                            focusedBranchIndices={focusedBranchIndices}
                            accents={EFFECT_ACCENTS}
                            onSelect={selectDevice}
                            onSelectGroup={(groupId) => {
                                setPolishSelected(false);
                                setSelectedGroupId(groupId);
                            }}
                            onFocusBranch={focusRackBranch}
                            onOpenStationMenu={setStationMenu}
                            onOpenGroupMenu={setGroupMenu}
                            onArmReorder={armStationReorder}
                            onKeyboardMove={moveDeviceByOffset}
                            tailPrefix={(
                                <label className="rack-lane-mix" data-role="rack-lane-mix">
                                    <span className="rack-lane-mix-label">MIX</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={rackState.output.mix}
                                        disabled={rackState.output.bypassed}
                                        data-role="rack-lane-mix-slider"
                                        aria-label="Effects Lane Mix"
                                        onChange={(event) => setOutputMix(Number(event.currentTarget.value))}
                                        onPointerUp={persist}
                                        onPointerCancel={persist}
                                        onKeyUp={persist}
                                        onBlur={persist}
                                    />
                                    <output
                                        className="rack-lane-mix-value"
                                        data-role="rack-lane-mix-value"
                                    >
                                        {Math.round(rackState.output.mix * 100)}%
                                    </output>
                                </label>
                            )}
                            onRequestAdd={(path, clientX, clientY) => setAddSheet({ path, clientX, clientY })}
                        />
                        <button
                            type="button"
                            className={`rack-lane-bypass${rackState.output.bypassed ? " is-bypassed" : ""}`}
                            data-role="rack-lane-bypass"
                            aria-label="Bypass Effects Lane"
                            aria-pressed={rackState.output.bypassed}
                            onClick={() => {
                                setOutputBypassed(!rackState.output.bypassed);
                                persist();
                            }}
                        >
                            <span className="rack-lane-bypass-label">BYPASS</span>
                            <span className="rack-lane-bypass-label-compact" aria-hidden="true">BYP</span>
                        </button>
                        <div className="rack-polish-boundary" data-role="rack-polish-boundary">
                            <button
                                type="button"
                                className={`rack-polish-node${polishSelected ? " is-selected" : ""}`}
                                data-role="rack-polish-node"
                                aria-label="Open fixed Polish output section"
                                aria-pressed={polishSelected}
                                onClick={() => {
                                    setSelectedGroupId(null);
                                    setPolishSelected(true);
                                }}
                            >
                                <span className="rack-polish-node-light" aria-hidden="true" />
                                <strong>POLISH</strong>
                                <small>FIXED</small>
                            </button>
                        </div>
                    </div>
                    <span
                        className={`subway-scroll-cue subway-scroll-cue-top${rackScrollPresentation.overflow && !rackScrollPresentation.atTop ? " is-visible" : ""}`}
                        aria-hidden="true"
                    >⌃</span>
                    <span
                        className={`subway-scroll-cue subway-scroll-cue-bottom${rackScrollPresentation.overflow && !rackScrollPresentation.atBottom ? " is-visible" : ""}`}
                        aria-hidden="true"
                    >⌄</span>
                </div>

                {polishSelected ? (
                    <PolishEditor
                        enhancerAmount={polishEnhancerAmount}
                        compressionClipAmount={polishCompressionClipAmount}
                        outputTrimDb={polishOutputTrimDb}
                    />
                ) : selectedGroup !== null && selectedGroup.kind !== "device" ? (
                    <GroupEditorPane
                        group={selectedGroup}
                        soloedBranchIndex={soloState.selectedBranchByGroup[selectedGroup.groupId] ?? null}
                        onToggleSolo={(branchIndex) => {
                            toggleSolo(selectedGroup.groupId, branchIndex);
                        }}
                        onToggleEnabled={() => {
                            const next = setLaneGroupEnabled(
                                rackStateRef.current, selectedGroup.groupId, !selectedGroup.enabled);
                            if (next !== null) {
                                commit(next);
                            }
                        }}
                        onSetBranchCount={(count) => {
                            const next = setLaneGroupBranchCount(
                                rackStateRef.current, selectedGroup.groupId, count);
                            if (next === null) {
                                showFeedbackToast("EMPTY THE LANE FIRST");
                            } else {
                                commit(next);
                            }
                        }}
                        onDissolve={() => {
                            const next = dissolveLaneGroup(rackStateRef.current, selectedGroup.groupId);
                            if (next !== null) {
                                commit(next);
                                setSelectedGroupId(null);
                            }
                        }}
                        onCrossoverDrag={(which, hz) => setSplitCrossover(selectedGroup.groupId, which, hz)}
                        onCrossoverKeyTrackOffsetDrag={(which, offsetSemitones) => (
                            setSplitKeyTrackOffset(selectedGroup.groupId, which, offsetSemitones)
                        )}
                        onCrossoverKeyTrackToggle={(which, enabled) => (
                            setSplitKeyTrackEnabled(selectedGroup.groupId, which, enabled)
                        )}
                        onCrossoverGestureEnd={persist}
                        routes={routes}
                        activeSource={activeSource}
                        sourceIsArmed={sourceIsArmed}
                    />
                ) : !selectedDeviceExists ? (
                <section
                    data-role="rack-editor-empty"
                    className="rack-effect-editor is-empty"
                    aria-label="Selected effect editor"
                >
                    <p className="rack-editor-empty-note">
                        The line is empty. Tap a + stub on the map to add a device.
                    </p>
                </section>
                ) : (
                <section
                    data-role={`rack-editor-${selectedEffectId}`}
                    data-selected-effect={selectedEffectId}
                    data-device-id={selectedDeviceId}
                    data-effect-enabled={selectedEffectEnabled ? "true" : "false"}
                    className="rack-effect-editor"
                    style={{ "--editor-accent": EFFECT_ACCENTS[selectedEffectId] } as CSSProperties}
                    aria-label="Selected effect editor"
                >
                    <header className="rack-editor-header rack-effect-header" data-effect-id={selectedEffectId}>
                        {/* The faceplate art lives here now — the header is
                            the one place with room for it at station scale. */}
                        <div className="rack-editor-heading">
                            <strong className="rack-editor-name">
                                {selectedInstanceNumber > 1
                                    ? `${selectedEffect.label} ${selectedInstanceNumber}`
                                    : selectedEffect.label}
                            </strong>
                        </div>
                        <button
                            type="button"
                            data-role="rack-editor-power"
                            aria-label={`${selectedEffectEnabled ? "Bypass" : "Enable"} ${selectedEffect.label}`}
                            aria-pressed={selectedEffectEnabled}
                            className="rack-power rack-editor-power"
                            onClick={() => toggleDeviceEnabled(selectedDeviceId)}
                        >
                            <PowerGlyph />
                        </button>
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
                            effectEnabled={selectedEffectEnabled}
                            pendingRouteKey={pendingRouteKey}
                            confirmedEndpointID={confirmedRoute?.endpointID ?? null}
                            dragSource={dragSource}
                            onSelectTarget={selectTarget}
                            onRecentParameter={(endpointID) => setRecentParameter(selectedEffectId, endpointID)}
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
                )}
            </div>
            {mobileGlobalModRail && mobileModRailPortalTarget && modRailAudition && modRailVoiceSettings && modBarPreferences ? createPortal(
                <MobileGlobalModRail
                    selectedSource={activeSource}
                    routeCount={routes.length}
                    sourceActivity={globalModSourceActivity}
                    sourceDrag={sourceDrag}
                    accent={EFFECT_ACCENTS[selectedEffectId]}
                    collapseSignal={railCollapseSignal}
                    autoPreviewEnabled={modRailAudition.autoPreviewEnabled}
                    keyboardVisible={modRailAudition.keyboardVisible}
                    preferences={modBarPreferences}
                    sourcePageIndex={sourcePageIndex}
                    sourceIsArmed={sourceIsArmed}
                    sourceHandlers={sourceHandlers}
                    onStateChange={onGlobalModRailStateChange}
                    countPulseSerial={confirmedRoute?.serial ?? 0}
                    onNoteKeyDown={modRailAudition.onNoteKeyDown}
                    onNoteKeyUp={modRailAudition.onNoteKeyUp}
                    onToggleAutoPreview={modRailAudition.onToggleAutoPreview}
                    onToggleKeyboard={modRailAudition.onToggleKeyboard}
                    onSourcePageChange={changeSourcePage}
                    voiceSettings={modRailVoiceSettings}
                >
                    {modulationSourceControls}
                </MobileGlobalModRail>,
                mobileModRailPortalTarget,
            ) : null}
        </section>
        </SelectedLaneDeviceContext.Provider>
    );
}
