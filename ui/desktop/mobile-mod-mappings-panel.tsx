/**
 * T14 MAPPINGS panel + T15 row editing: the polished responsive mappings
 * table. One logical data model (Source, Target, Base, Mod Amount,
 * Direction, State, Actions); a compact disciplined toolbar (count, find,
 * Filter, Sort, Add Mapping); removable criteria chips with Clear All; an
 * inline draft row for creation; and every row is the editing surface —
 * its rail IS the shared readout cell (rolling-axis base/amount gesture,
 * fixed HUD, long-press ADR-017 menu pinned to this exact route), with
 * power and trash directly on the row.
 *
 * The list behavior (search/filter/sort/freeze) lives in the pure model
 * (ui/shared/mod-mappings-table-model); this file is presentation and
 * bindings only. View preferences persist per plugin instance
 * (sessionStorage — the shell's workspace-state scope), never in presets.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";

import {
    applyViewPrefs,
    createDefaultViewPrefs,
    directionGlyph,
    draftCreation,
    freezeDisplayRows,
    listDuplicateTargetKinds,
    viewPrefsReducer,
    type MappingsRowInput,
    type MappingsViewPrefs,
    type ViewPrefsAction,
} from "../shared/mod-mappings-table-model";
import {
    MODULATION_SOURCE_OPTIONS,
    composeModulationAmount,
    formatModulationAmountReadout,
    getModulationAmountBounds,
    getModulationAmountSliderPosition,
    type GeneratedModulationRouteInput,
    type ModulationRoute,
    type ModulationRouteUpdate,
} from "../shared/modulation";
import {
    isOscillatorModulationTargetKind,
    type ModulationTargetKind,
} from "../shared/modulation-targets";
import { parseLaneModulationTargetKind } from "../shared/lane-modulation-targets";
import {
    keyTrackModulationTargetBasePresentation,
    resolveModulationTargetBase,
} from "../shared/modulation-target-base";
import { findRackModulationSource } from "../shared/rack-modulation-sources";
import {
    useLaneKeyTrackControlBinding,
    useLaneOrHostParameterBinding,
    usePatchModulationTargetOptions,
} from "../shared/lane-param-bindings";
import { formatParameterEntry } from "../shared/parameter-value-entry";
import { useParameterGesture } from "../shared/parameter-gesture";
import { useReadoutCells, type ReadoutCellSpec } from "../shared/parameter-readout-strip";
import {
    useLongPressParameterMenu,
    useParameterMenu,
    type ParameterMenuRequestContext,
} from "../shared/parameter-context-menu";
import { hexToRgbTriplet } from "../shared/parameter-hud";
import { useModulationRouteAmountBinding } from "../shared/modulation-route-amount";
import { useSliderDrag } from "../shared/use-slider-drag";
import { usePatchParameterBinding, type PatchControlBinding } from "../shared/patch-controls";
import { getRackParameterDescriptor } from "../shared/rack-parameter-descriptors";
import { sourceOptionForRoute, targetPresentation, SourceIdentity } from "./mobile-mod-matrix";

export const MOD_MAPPINGS_VIEW_STORAGE_KEY = "cosimo.mod-mappings-view.v1";

const FALLBACK_MAPPING_LANE_DESCRIPTOR = getRackParameterDescriptor("delayMix");
if (FALLBACK_MAPPING_LANE_DESCRIPTOR === null) {
    throw new Error("The mappings table is missing its fallback lane descriptor.");
}

function loadStoredViewPrefs(): MappingsViewPrefs {
    const raw = sessionStorage.getItem(MOD_MAPPINGS_VIEW_STORAGE_KEY);
    if (raw === null) {
        return createDefaultViewPrefs();
    }
    try {
        const parsed = JSON.parse(raw) as MappingsViewPrefs;
        // Tolerant restore: any structural surprise falls back to default.
        return typeof parsed === "object" && parsed !== null && typeof parsed.search === "string"
            ? { ...createDefaultViewPrefs(), ...parsed }
            : createDefaultViewPrefs();
    } catch {
        return createDefaultViewPrefs();
    }
}

/* ------------------------------------------------------------------ */
/* One row = one editing surface                                        */
/* ------------------------------------------------------------------ */

function MappingAmountOnlyControl({
    route,
    routeIndex,
    sourceLabel,
    sourceAccent,
    targetLabel,
    onGestureActive,
}: {
    route: ModulationRoute;
    routeIndex: number;
    sourceLabel: string;
    sourceAccent: string;
    targetLabel: string;
    onGestureActive: (routeId: string, active: boolean) => void;
}) {
    const amountBinding = useModulationRouteAmountBinding(route);
    const amountBounds = useMemo(() => getModulationAmountBounds(route.targetKind), [route.targetKind]);
    const amountSliderPosition = getModulationAmountSliderPosition(route.targetKind, amountBinding.value);
    const zeroSliderPosition = getModulationAmountSliderPosition(route.targetKind, 0);
    const [dragging, setDragging] = useState(false);
    const sliderDrag = useSliderDrag();
    const sliderBinding = useMemo<PatchControlBinding<number>>(() => ({
        endpointID: `modulation-route:${route.id}`,
        value: amountBinding.value,
        isReady: true,
        setValue: (nextValue) => { amountBinding.setValue(nextValue); },
        commitValue: (nextValue) => { amountBinding.setValue(nextValue); },
        beginGesture: () => {
            setDragging(true);
            onGestureActive(route.id, true);
        },
        endGesture: () => {
            setDragging(false);
            onGestureActive(route.id, false);
        },
    }), [amountBinding, onGestureActive, route.id]);
    const menuRequestContext = useCallback((): ParameterMenuRequestContext => ({
        controlKey: `mapping-${route.id}`,
        label: targetLabel,
        targetKind: route.targetKind,
        baseSpec: null,
        baseValue: null,
        defaultValue: null,
        commitBase: null,
        routeIndex,
    }), [route.id, route.targetKind, routeIndex, targetLabel]);
    const menuHandlers = useLongPressParameterMenu(menuRequestContext);

    return (
        <div
            className="mod-mappings-row-amount-only"
            data-role="mod-mappings-amount-only"
            data-dragging={dragging ? "modulation" : undefined}
            role="slider"
            tabIndex={0}
            aria-label={`${sourceLabel} to ${targetLabel} amount`}
            aria-orientation="vertical"
            aria-valuemin={amountBounds.min}
            aria-valuemax={amountBounds.max}
            aria-valuenow={amountBinding.value}
            aria-valuetext={formatModulationAmountReadout(route.targetKind, amountBinding.value, route.polarity)}
            style={{
                "--route-source-accent": sourceAccent,
                "--mobile-voice-source-accent": sourceAccent,
            } as CSSProperties}
            onPointerDown={(event) => {
                menuHandlers.onPointerDown?.(event);
                sliderDrag.handlePointerDown(
                    event,
                    event.currentTarget,
                    sliderBinding,
                    amountSliderPosition,
                    0,
                    1,
                    "vertical",
                    (normalized) => {
                        amountBinding.setValue(composeModulationAmount(route.targetKind, normalized));
                    },
                );
            }}
            onPointerMove={(event) => {
                menuHandlers.onPointerMove?.(event);
                sliderDrag.handlePointerMove(event);
            }}
            onPointerUp={(event) => {
                menuHandlers.onPointerUp?.();
                sliderDrag.handlePointerUp(event);
            }}
            onPointerCancel={(event) => {
                menuHandlers.onPointerCancel?.();
                sliderDrag.handlePointerCancel(event);
            }}
            onLostPointerCapture={(event) => {
                menuHandlers.onLostPointerCapture?.();
                sliderDrag.handleLostPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
                let nextAmount: number | null = null;
                if (event.key === "Home") nextAmount = amountBounds.min;
                if (event.key === "End") nextAmount = amountBounds.max;
                if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                    nextAmount = Math.min(
                        amountBounds.max,
                        amountBinding.value + (amountBounds.step * (event.shiftKey ? 10 : 1)),
                    );
                }
                if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
                    nextAmount = Math.max(
                        amountBounds.min,
                        amountBinding.value - (amountBounds.step * (event.shiftKey ? 10 : 1)),
                    );
                }
                if (nextAmount !== null) {
                    event.preventDefault();
                    amountBinding.setValue(nextAmount);
                }
            }}
        >
            <span className="mod-led-flag" data-role="mod-mappings-amount-flag">
                {formatModulationAmountReadout(route.targetKind, amountBinding.value, route.polarity)}
            </span>
            <span
                className="mod-led-rail"
                data-rail-state={route.enabled
                    ? Math.abs(amountBinding.value) <= 1e-9 ? "mapped-zero" : "mapped"
                    : "bypassed"}
                aria-hidden="true"
            >
                <span className="mod-led-track" />
                <span
                    className="mod-led-fill"
                    style={{
                        left: `${(Math.min(amountSliderPosition, zeroSliderPosition) * 100).toFixed(2)}%`,
                        width: `${(Math.abs(amountSliderPosition - zeroSliderPosition) * 100).toFixed(2)}%`,
                    }}
                />
                <span
                    className="mod-led-tick"
                    style={{ left: `calc(${(zeroSliderPosition * 100).toFixed(2)}% - 1px)` }}
                />
            </span>
        </div>
    );
}

function MappingRow({
    route,
    routeIndex,
    isJustCreated,
    hudContainer,
    resolveScrollLockTargets,
    onRequestHaptic,
    onRouteChange,
    onRemoveRoute,
    onGestureActive,
    onBaseSample,
    oscillatorTargetsInactive,
    resolveTargetBase,
}: {
    route: ModulationRoute;
    routeIndex: number;
    isJustCreated: boolean;
    hudContainer: Element | null;
    resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    onRequestHaptic?: () => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onRemoveRoute: (routeIndex: number) => void;
    onGestureActive: (routeId: string, active: boolean) => void;
    onBaseSample: (routeId: string, normalized: number | null) => void;
    oscillatorTargetsInactive: boolean;
    resolveTargetBase: typeof resolveModulationTargetBase;
}) {
    const source = sourceOptionForRoute(route);
    const sourceIdentity = route.sourceSlot === null
        ? { shortLabel: source.label, accent: "#8e969b" }
        : (() => {
            const rack = findRackModulationSource(
                route.sourceKind as Parameters<typeof findRackModulationSource>[0],
                route.sourceSlot,
            );
            return { shortLabel: rack.shortLabel, accent: rack.accent };
        })();
    const target = targetPresentation(route.targetKind);
    const isBounceInert = oscillatorTargetsInactive
        && isOscillatorModulationTargetKind(route.targetKind);
    const base = useMemo(
        () => resolveTargetBase(route.targetKind),
        [resolveTargetBase, route.targetKind],
    );

    const baseBinding = useLaneOrHostParameterBinding({
        endpointID: base?.endpointID ?? `__unbacked_${route.targetKind}`,
        initialValue: base?.initialValue ?? 0,
        coerce: (rawValue) => Number(rawValue) || 0,
        active: base !== null,
        deviceId: parseLaneModulationTargetKind(route.targetKind)?.instanceId,
    });
    const parsedLaneTarget = parseLaneModulationTargetKind(route.targetKind);
    const laneKeyTrackBinding = useLaneKeyTrackControlBinding(
        base?.keyTrack?.binding.kind === "lane"
            ? base.keyTrack.binding.descriptor
            : FALLBACK_MAPPING_LANE_DESCRIPTOR,
        parsedLaneTarget?.instanceId,
    );
    const hostKeyTrackEnabled = usePatchParameterBinding<number>({
        endpointID: base?.keyTrack?.binding.kind === "host"
            ? base.keyTrack.binding.enabledEndpointID
            : "filterCutoffKeyTrackEnabled",
        initialValue: 0,
        coerce: (rawValue) => Number(rawValue) || 0,
        active: base?.keyTrack?.binding.kind === "host",
    });
    const hostKeyTrackOffset = usePatchParameterBinding<number>({
        endpointID: base?.keyTrack?.binding.kind === "host"
            ? base.keyTrack.binding.offsetEndpointID
            : "filterCutoffKeyTrackOffsetSemitones",
        initialValue: 0,
        coerce: (rawValue) => Number(rawValue) || 0,
        active: base?.keyTrack?.binding.kind === "host",
    });
    const keyTrackEnabled = base?.keyTrack?.binding.kind === "lane"
        ? laneKeyTrackBinding.enabled
        : base?.keyTrack?.binding.kind === "host"
            ? hostKeyTrackEnabled.value >= 0.5
            : false;
    const presentedTargetLabel = keyTrackEnabled ? "Key Track Offset" : target.parameter;
    const keyTrackPresentation = useMemo(() => (
        base?.keyTrack === null || base?.keyTrack === undefined
            ? null
            : keyTrackModulationTargetBasePresentation(base.keyTrack)
    ), [base?.keyTrack]);
    const presentedBaseBinding = keyTrackEnabled
        ? base?.keyTrack?.binding.kind === "lane"
            ? laneKeyTrackBinding.binding
            : hostKeyTrackOffset
        : baseBinding;
    const entrySpec = keyTrackEnabled && keyTrackPresentation !== null
        ? keyTrackPresentation.entrySpec
        : base?.entrySpec;
    const railProjection = keyTrackEnabled && keyTrackPresentation !== null
        ? keyTrackPresentation.railProjection
        : base?.railProjection;

    const gestureController = useParameterGesture();
    const openParameterMenu = useParameterMenu();

    const menuRequestContext = useCallback((): ParameterMenuRequestContext => {
        if (base === null || entrySpec === undefined) {
            throw new Error(`Mapping ${route.id} has no base control menu.`);
        }
        return {
            controlKey: `mapping-${route.id}`,
            label: keyTrackEnabled
                ? `${target.category} · Key Track Offset`
                : `${target.category} · ${target.parameter}`,
            targetKind: route.targetKind,
            baseSpec: entrySpec,
            amountSpec: keyTrackEnabled ? keyTrackPresentation?.amountSpec : undefined,
            baseFieldLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
            routeDestinationLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
            baseValue: presentedBaseBinding.value,
            defaultValue: keyTrackEnabled ? 0 : base.initialValue,
            commitBase: presentedBaseBinding.commitValue,
            routeIndex,
        };
    }, [
        base,
        entrySpec,
        keyTrackEnabled,
        keyTrackPresentation?.amountSpec,
        presentedBaseBinding.commitValue,
        presentedBaseBinding.value,
        route.id,
        route.targetKind,
        routeIndex,
        target.category,
        target.parameter,
    ]);

    const rowBindings = useMemo(
        () => ({ [route.id]: presentedBaseBinding }),
        [presentedBaseBinding, route.id],
    );

    const cellSpec = useMemo<ReadonlyArray<ReadoutCellSpec>>(() => (base === null ? [] : [{
        id: route.id,
        kind: "readout",
        shortLabel: presentedTargetLabel,
        fullLabel: `${target.category} ${presentedTargetLabel}`,
        display: {
            min: entrySpec!.min,
            max: entrySpec!.max,
            step: entrySpec!.step,
        },
        formatValue: (value: number) => formatParameterEntry(entrySpec!, value).display,
        targetKind: route.targetKind,
        normalizeValue: railProjection!.normalizeValue,
        denormalizeValue: railProjection!.denormalizeValue,
        projectBand: railProjection!.projectBand,
        amountDragStyle: keyTrackEnabled ? "amount-span" : base.amountDragStyle,
        modulationAmountBounds: keyTrackEnabled
            ? keyTrackPresentation?.canonicalAmountBounds
            : undefined,
        formatRouteAmount: keyTrackEnabled && keyTrackPresentation !== null
            ? (candidate) => formatParameterEntry(
                keyTrackPresentation.amountSpec,
                candidate.amount,
            ).display
            : undefined,
    }]), [
        base,
        entrySpec,
        keyTrackEnabled,
        keyTrackPresentation,
        railProjection,
        route.id,
        route.targetKind,
        target.category,
        target.parameter,
        presentedTargetLabel,
    ]);

    const cellApi = useReadoutCells({
        cells: cellSpec,
        bindings: rowBindings,
        routes: useMemo(() => [route], [route]),
        armedSource: useMemo(() => ({
            sourceKind: route.sourceKind,
            sourceSlot: route.sourceSlot,
            shortLabel: sourceIdentity.shortLabel,
            accent: sourceIdentity.accent,
        }), [route.sourceKind, route.sourceSlot, sourceIdentity.accent, sourceIdentity.shortLabel]),
        hudContainer,
        gestureController,
        ownerAccent: sourceIdentity.accent,
        ownerAccentRgb: hexToRgbTriplet(sourceIdentity.accent),
        resolveScrollLockTargets,
        onRequestHaptic,
        onRequestParameterMenu: base === null || openParameterMenu === null
            ? undefined
            : (_cellId, clientX, clientY) => {
                openParameterMenu({ ...menuRequestContext(), clientX, clientY });
            },
    });

    // Report gesture-active up for the freeze contract.
    const dragging = cellApi.draggingCell !== null;
    useEffect(() => {
        onGestureActive(route.id, dragging);
    }, [dragging, onGestureActive, route.id]);

    // Report the normalized base for unit-safe sorting/filtering.
    const normalizedBase = base === null
        ? null
        : (presentedBaseBinding.value - entrySpec!.min)
            / Math.max(1e-9, entrySpec!.max - entrySpec!.min);
    useEffect(() => {
        onBaseSample(route.id, normalizedBase);
    }, [normalizedBase, onBaseSample, route.id]);

    return (
        <article
            className={`mod-mappings-row${route.enabled ? "" : " is-bypassed"}${isJustCreated ? " is-just-created" : ""}${isBounceInert ? " opacity-35 grayscale" : ""}`}
            data-role="mod-mappings-row"
            data-route-id={route.id}
            data-bounce-inert={isBounceInert ? "true" : undefined}
            aria-disabled={isBounceInert}
            inert={isBounceInert}
        >
            <div className="mod-mappings-row-identity">
                <SourceIdentity sourceKind={route.sourceKind} sourceSlot={route.sourceSlot} />
                <div className="mod-mappings-row-labels">
                    <span className="mod-mappings-row-source">{source.label}</span>
                    <span className="mod-mappings-row-target">
                        <strong>{target.category}</strong> {presentedTargetLabel}
                    </span>
                </div>
            </div>
            <div
                className="mod-mappings-row-rail"
                data-role={`mod-mappings-rail-${routeIndex}`}
            >
                {base === null ? (
                    <MappingAmountOnlyControl
                        route={route}
                        routeIndex={routeIndex}
                        sourceLabel={source.label}
                        sourceAccent={sourceIdentity.accent}
                        targetLabel={`${target.category} · ${target.parameter}`}
                        onGestureActive={onGestureActive}
                    />
                ) : (
                    <MappingLedCell
                        cell={cellSpec[0]}
                        api={cellApi}
                        baseValue={presentedBaseBinding.value}
                        rolePrefix={`mod-mapping-${routeIndex}`}
                    />
                )}
            </div>
            <button
                type="button"
                className="mod-mappings-row-polarity"
                aria-label={`Polarity ${route.polarity === "bipolar" ? "bipolar" : "unipolar"}: tap to flip`}
                data-role={`mod-mappings-polarity-${routeIndex}`}
                onClick={() => onRouteChange(routeIndex, {
                    polarity: route.polarity === "bipolar" ? "unipolar" : "bipolar",
                })}
            >
                {directionGlyph(route.polarity)}
            </button>
            <button
                type="button"
                className="mod-mappings-row-power"
                aria-label={`${route.enabled ? "Bypass" : "Enable"} ${source.label} to ${presentedTargetLabel}`}
                aria-pressed={route.enabled}
                data-role={`mod-mappings-power-${routeIndex}`}
                onClick={() => onRouteChange(routeIndex, { enabled: !route.enabled })}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <circle cx="7" cy="7.6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="7" y1="1" x2="7" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
            <button
                type="button"
                className="mod-mappings-row-delete"
                aria-label={`Delete ${source.label} to ${presentedTargetLabel}`}
                data-role={`mod-mappings-delete-${routeIndex}`}
                onClick={() => onRemoveRoute(routeIndex)}
            >
                🗑
            </button>
        </article>
    );
}

/* ------------------------------------------------------------------ */
/* LED readout                                                          */
/* ------------------------------------------------------------------ */

/**
 * T15 mapping readout: the identity column already names the mapping, so
 * this cell spends its height on the amount itself — a segmented meter lit
 * from the base tick, the canonical amount readout riding the lit end, and
 * the base value in a small corner. No duplicated label. Same brain as
 * every readout cell: identical gesture, keyboard, HUD, and menu wiring.
 */
function MappingLedCell({ cell, api, baseValue, rolePrefix }: {
    cell: ReadoutCellSpec;
    api: ReturnType<typeof useReadoutCells>;
    baseValue: number;
    rolePrefix: string;
}) {
    const display = cell.display;
    const presentation = api.presentCell(cell.id);
    const value = Math.min(display.max, Math.max(display.min, baseValue));
    const dragging = api.draggingCell !== null && api.draggingCell.cellId === cell.id
        ? api.draggingCell.mode
        : undefined;
    const route = presentation.route;
    const band = presentation.band;
    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label={cell.fullLabel}
            aria-valuemin={display.min}
            aria-valuemax={display.max}
            aria-valuenow={value}
            aria-valuetext={cell.formatValue(value)}
            data-role={`${rolePrefix}-cell-${cell.id}`}
            data-modulation-target-kind={cell.targetKind ?? undefined}
            data-dragging={dragging}
            className="mobile-voice-cell is-readout is-mapping-led"
            style={{ "--mobile-voice-source-accent": api.sourceAccent } as CSSProperties}
            onPointerDown={(event) => api.cellPointerDown(event, cell.id)}
            onKeyDown={(event) => api.handleReadoutKeyDown(event, cell.id)}
        >
            <span className="mod-led-base-val" data-role="mod-mappings-base-val">
                {cell.formatValue(value)}
            </span>
            {route !== null ? (
                <span className="mod-led-flag" data-role="mod-mappings-amount-flag">
                    {cell.formatRouteAmount?.(route)
                        ?? formatModulationAmountReadout(route.targetKind, route.amount, route.polarity)}
                </span>
            ) : null}
            <span className="mod-led-rail" data-rail-state={presentation.railState} aria-hidden="true">
                <span className="mod-led-track" />
                {band !== null ? (
                    <span
                        className="mod-led-fill"
                        style={{
                            left: `${(band.lowNormalized * 100).toFixed(2)}%`,
                            width: `${((band.highNormalized - band.lowNormalized) * 100).toFixed(2)}%`,
                        }}
                    />
                ) : null}
                {band !== null && (band.clippedLow || band.clippedHigh) ? (
                    <span className="mod-led-clip" style={band.clippedHigh ? { right: 0 } : { left: 0 }} />
                ) : null}
                <span
                    className="mod-led-tick"
                    style={{ left: `calc(${(presentation.baseNormalized * 100).toFixed(2)}% - 1px)` }}
                />
            </span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */

export function MobileModMappingsPanel({
    routes,
    recentConfirmedRouteId,
    hudContainer,
    resolveScrollLockTargets,
    onRequestHaptic,
    onCreateRoute,
    onRemoveRoute,
    onRouteChange,
    oscillatorTargetsInactive = false,
    resolveTargetBase = resolveModulationTargetBase,
}: {
    routes: ReadonlyArray<ModulationRoute>;
    recentConfirmedRouteId: string | null;
    hudContainer: Element | null;
    resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    onRequestHaptic?: () => void;
    onCreateRoute: (route: GeneratedModulationRouteInput) => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    oscillatorTargetsInactive?: boolean;
    /** Base-contract authority for the rendered host. The product uses the
        shared resolver; isolated renderers can explicitly supply a narrower
        contract without changing the production target catalog. */
    resolveTargetBase?: typeof resolveModulationTargetBase;
}) {
    const targetOptions = usePatchModulationTargetOptions({
        includeOscillatorTargets: !oscillatorTargetsInactive,
    });
    const [prefs, setPrefs] = useState<MappingsViewPrefs>(loadStoredViewPrefs);
    const dispatch = useCallback((action: ViewPrefsAction) => {
        setPrefs((current: MappingsViewPrefs) => viewPrefsReducer(current, action));
    }, []);
    useEffect(() => {
        sessionStorage.setItem(MOD_MAPPINGS_VIEW_STORAGE_KEY, JSON.stringify(prefs));
    }, [prefs]);

    const [toolMenu, setToolMenu] = useState<"filter" | "sort" | null>(null);
    const [draftOpen, setDraftOpen] = useState(false);
    const [draftSourceValue, setDraftSourceValue] = useState<string | null>(null);
    const [draftTargetKind, setDraftTargetKind] = useState<ModulationTargetKind | null>(null);
    const [activeGestureRouteId, setActiveGestureRouteId] = useState<string | null>(null);
    const baseSamplesRef = useRef(new Map<string, number | null>());
    const [baseSampleSerial, setBaseSampleSerial] = useState(0);

    const handleBaseSample = useCallback((routeId: string, normalized: number | null) => {
        const previous = baseSamplesRef.current.get(routeId);
        if (previous !== normalized) {
            baseSamplesRef.current.set(routeId, normalized);
            setBaseSampleSerial((serial) => serial + 1);
        }
    }, []);

    const handleGestureActive = useCallback((routeId: string, active: boolean) => {
        setActiveGestureRouteId((current: string | null) => {
            if (active) {
                return routeId;
            }
            return current === routeId ? null : current;
        });
    }, []);

    const rowInputs = useMemo<ReadonlyArray<MappingsRowInput>>(() => {
        void baseSampleSerial;
        return routes.map((route, routeIndex) => {
            const source = sourceOptionForRoute(route);
            const target = targetPresentation(route.targetKind);
            return {
                id: route.id,
                routeIndex,
                sourceKind: route.sourceKind,
                sourceSlot: route.sourceSlot,
                sourceLabel: source.label,
                sourceValue: source.value,
                targetKind: route.targetKind,
                targetCategoryLabel: target.category,
                targetParameterLabel: target.parameter,
                searchText: `${source.label} ${target.category} ${target.parameter}`.toLowerCase(),
                baseNormalized: baseSamplesRef.current.get(route.id) ?? null,
                amountNormalized: route.amount,
                polarity: route.polarity,
                enabled: route.enabled,
            };
        });
    }, [baseSampleSerial, routes]);

    const applied = useMemo(() => applyViewPrefs(rowInputs, prefs), [prefs, rowInputs]);
    const previousDisplayedRef = useRef<ReadonlyArray<MappingsRowInput>>(applied.rows);
    const displayedRows = useMemo(() => {
        const frozen = freezeDisplayRows(previousDisplayedRef.current, applied.rows, activeGestureRouteId);
        return frozen;
    }, [activeGestureRouteId, applied.rows]);
    useEffect(() => {
        if (activeGestureRouteId === null) {
            previousDisplayedRef.current = applied.rows;
        }
    }, [activeGestureRouteId, applied.rows]);

    const routeByRowId = useMemo(() => new Map(routes.map((route, index) => [route.id, { route, index }])), [routes]);

    const draftState = draftCreation({
        routes,
        sourceOption: draftSourceValue === null
            ? null
            : MODULATION_SOURCE_OPTIONS.find((option) => option.value === draftSourceValue) ?? null,
        targetKind: draftTargetKind,
    });
    const duplicateTargets = useMemo(() => (
        draftSourceValue === null
            ? new Set<string>()
            : new Set(listDuplicateTargetKinds(
                routes,
                MODULATION_SOURCE_OPTIONS.find((option) => option.value === draftSourceValue) ?? null,
            ))
    ), [draftSourceValue, routes]);

    const commitDraft = useCallback(() => {
        const source = MODULATION_SOURCE_OPTIONS.find((option) => option.value === draftSourceValue);
        if (draftState !== "creatable" || source === undefined || draftTargetKind === null) {
            throw new Error("Create must only be reachable for a creatable draft.");
        }
        onCreateRoute({
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind: draftTargetKind,
        });
        setDraftOpen(false);
        setDraftSourceValue(null);
        setDraftTargetKind(null);
    }, [draftSourceValue, draftState, draftTargetKind, onCreateRoute]);

    return (
        <section className="mod-mappings-panel" data-role="mod-mappings-panel">
            <div className="mod-mappings-toolbar" data-role="mod-mappings-toolbar">
                <span className="mod-mappings-count" data-role="mod-mappings-count">
                    {applied.matchedCount === applied.totalCount
                        ? `${applied.totalCount}`
                        : `${applied.matchedCount} of ${applied.totalCount}`}
                </span>
                <input
                    type="text"
                    className="mod-mappings-search"
                    placeholder="Find"
                    aria-label="Find mappings"
                    data-role="mod-mappings-search"
                    value={prefs.search}
                    onChange={(event) => dispatch({ kind: "setSearch", search: event.currentTarget.value })}
                />
                {prefs.search !== "" ? (
                    <button
                        type="button"
                        aria-label="Clear search"
                        data-role="mod-mappings-search-clear"
                        className="mod-mappings-search-clear"
                        onClick={() => dispatch({ kind: "setSearch", search: "" })}
                    >
                        ×
                    </button>
                ) : null}
                <button
                    type="button"
                    data-role="mod-mappings-filter-button"
                    aria-expanded={toolMenu === "filter"}
                    className="mod-mappings-tool"
                    onClick={() => setToolMenu((current: "filter" | "sort" | null) => (current === "filter" ? null : "filter"))}
                >
                    Filter
                </button>
                <button
                    type="button"
                    data-role="mod-mappings-sort-button"
                    aria-expanded={toolMenu === "sort"}
                    className="mod-mappings-tool"
                    onClick={() => setToolMenu((current: "filter" | "sort" | null) => (current === "sort" ? null : "sort"))}
                >
                    Sort
                </button>
                <button
                    type="button"
                    data-role="mod-mappings-add"
                    className="mod-mappings-add"
                    onClick={() => setDraftOpen((current: boolean) => !current)}
                >
                    + Add
                </button>
            </div>

            {toolMenu === "filter" ? (
                <div className="mod-mappings-toolsheet" data-role="mod-mappings-filter-sheet">
                    <div className="mod-mappings-toolsheet-group">
                        <span>Source</span>
                        <div className="mod-mappings-choice-row">
                            {MODULATION_SOURCE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={prefs.filters.sources.includes(option.value)}
                                    data-role={`mod-mappings-filter-source-${option.value}`}
                                    onClick={() => dispatch({ kind: "toggleSourceFilter", sourceValue: option.value })}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mod-mappings-toolsheet-group">
                        <span>Destination</span>
                        <div className="mod-mappings-choice-row">
                            {["Voice", "Global Filter", "FX"].map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    aria-pressed={prefs.filters.targets.includes(category)}
                                    data-role={`mod-mappings-filter-target-${category.toLowerCase().replace(" ", "-")}`}
                                    onClick={() => dispatch({ kind: "toggleTargetFilter", target: category })}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mod-mappings-toolsheet-group">
                        <span>Direction</span>
                        <div className="mod-mappings-choice-row">
                            {(["all", "unipolar", "bipolar"] as const).map((direction) => (
                                <button
                                    key={direction}
                                    type="button"
                                    aria-pressed={prefs.filters.direction === direction}
                                    data-role={`mod-mappings-filter-direction-${direction}`}
                                    onClick={() => dispatch({ kind: "setDirectionFilter", direction })}
                                >
                                    {direction === "all" ? "All" : directionGlyph(direction)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mod-mappings-toolsheet-group">
                        <span>State</span>
                        <div className="mod-mappings-choice-row">
                            {(["all", "active", "bypassed"] as const).map((state) => (
                                <button
                                    key={state}
                                    type="button"
                                    aria-pressed={prefs.filters.state === state}
                                    data-role={`mod-mappings-filter-state-${state}`}
                                    onClick={() => dispatch({ kind: "setStateFilter", state })}
                                >
                                    {state === "all" ? "All" : state === "active" ? "Active" : "Bypassed"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {toolMenu === "sort" ? (
                <div className="mod-mappings-toolsheet" data-role="mod-mappings-sort-sheet">
                    <div className="mod-mappings-choice-row">
                        {([
                            ["source", "Source"],
                            ["target", "Target"],
                            ["base", "Base"],
                            ["amount", "Mod Amount"],
                            ["direction", "Direction"],
                            ["state", "State"],
                        ] as const).map(([column, label]) => (
                            <button
                                key={column}
                                type="button"
                                aria-pressed={prefs.sort.column === column}
                                data-role={`mod-mappings-sort-${column}`}
                                onClick={() => dispatch({ kind: "setSort", column })}
                            >
                                {label}
                                {prefs.sort.column === column ? (prefs.sort.direction === "asc" ? " ↑" : " ↓") : ""}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {applied.activeCriteria.length > 0 ? (
                <div className="mod-mappings-criteria" data-role="mod-mappings-criteria">
                    {applied.activeCriteria.map((criterion: { key: string; label: string; clearAction: ViewPrefsAction }) => (
                        <button
                            key={criterion.key}
                            type="button"
                            data-role="mod-mappings-criterion"
                            onClick={() => dispatch(criterion.clearAction)}
                        >
                            {criterion.label} ×
                        </button>
                    ))}
                    <button
                        type="button"
                        data-role="mod-mappings-clear-all"
                        className="mod-mappings-clear-all"
                        onClick={() => dispatch({ kind: "clearAll" })}
                    >
                        Clear All
                    </button>
                </div>
            ) : null}

            {draftOpen ? (
                <div className="mod-mappings-draft" data-role="mod-mappings-draft">
                    <select
                        aria-label="Draft mapping source"
                        data-role="mod-mappings-draft-source"
                        value={draftSourceValue ?? ""}
                        onChange={(event) => setDraftSourceValue(event.currentTarget.value || null)}
                    >
                        <option value="">Source…</option>
                        {MODULATION_SOURCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Draft mapping target"
                        data-role="mod-mappings-draft-target"
                        value={draftTargetKind ?? ""}
                        onChange={(event) => setDraftTargetKind((event.currentTarget.value || null) as ModulationTargetKind | null)}
                    >
                        <option value="">Target…</option>
                        {targetOptions.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                disabled={duplicateTargets.has(option.value)}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        data-role="mod-mappings-draft-create"
                        disabled={draftState !== "creatable"}
                        onClick={commitDraft}
                    >
                        Create
                    </button>
                    <button
                        type="button"
                        data-role="mod-mappings-draft-cancel"
                        onClick={() => {
                            setDraftOpen(false);
                            setDraftSourceValue(null);
                            setDraftTargetKind(null);
                        }}
                    >
                        Cancel
                    </button>
                    {draftState === "duplicate" ? (
                        <span role="alert" data-role="mod-mappings-draft-duplicate">Already mapped</span>
                    ) : null}
                </div>
            ) : null}

            <div className="mod-mappings-list" data-role="mod-mappings-list">
                {displayedRows.map((row: MappingsRowInput) => {
                    const live = routeByRowId.get(row.id);
                    if (live === undefined) {
                        return null;
                    }
                    return (
                        <MappingRow
                            key={row.id}
                            route={live.route}
                            routeIndex={live.index}
                            isJustCreated={row.id === recentConfirmedRouteId}
                            hudContainer={hudContainer}
                            resolveScrollLockTargets={resolveScrollLockTargets}
                            onRequestHaptic={onRequestHaptic}
                            onRouteChange={onRouteChange}
                            onRemoveRoute={onRemoveRoute}
                            onGestureActive={handleGestureActive}
                            onBaseSample={handleBaseSample}
                            oscillatorTargetsInactive={oscillatorTargetsInactive}
                            resolveTargetBase={resolveTargetBase}
                        />
                    );
                })}
                {applied.matchedCount === 0 ? (
                    <p className="mod-mappings-empty" data-role="mod-mappings-empty">
                        {applied.totalCount === 0
                            ? "No mappings yet. Add one, or drag a source onto a control."
                            : "No mappings match these criteria."}
                        {applied.totalCount > 0 ? (
                            <button
                                type="button"
                                data-role="mod-mappings-empty-clear"
                                onClick={() => dispatch({ kind: "clearAll" })}
                            >
                                Clear All
                            </button>
                        ) : null}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
