import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { parseLaneModulationTargetKind } from "../shared/lane-modulation-targets";

import {
    MODULATION_SOURCE_OPTIONS,
    MODULATION_TARGET_OPTIONS,
    composeModulationAmount,
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
    isRackModulationTarget,
    isVoiceModulationSource,
    type GeneratedModulationRouteInput,
    type ModulationRoute,
    type ModulationRouteUpdate,
    type ModulationSourceKind,
    type ModulationTargetKind,
} from "../shared/modulation";
import {
    useModulationAmountParameterEntrySpec,
    useModulationRouteAmountBinding,
} from "../shared/modulation-route-amount";
import {
    formatParameterEntry,
    parseParameterEntry,
} from "../shared/parameter-value-entry";
import {
    allRackParameterDescriptors,
    getRackEffectDescriptor,
    getRackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import { RACK_MODULATION_SOURCE_PAGES } from "../shared/rack-modulation-sources";
import type { EffectModuleId } from "../shared/target-descriptor";
import { getModulationRouteCreation } from "../shared/rack-route-presentation";

type FocusedModulationSource = {
    sourceKind: Extract<ModulationSourceKind, "mseg" | "env" | "macro">;
    sourceSlot: number;
};

type MobileModMatrixProps = {
    routes: ModulationRoute[];
    focusedSource?: FocusedModulationSource | null;
    /** ADR-025 row 15: the just-confirmed route's row pulses in source color. */
    recentConfirmedRouteId?: string | null;
    onCreateRoute: (route: GeneratedModulationRouteInput) => boolean;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
};

type TargetCategory = "voice" | "global-filter" | "fx";
type RouteStatusFilter = "all" | "active" | "bypassed";
type RouteSort = "source" | "destination";
type MatrixView =
    | { kind: "list" }
    | { kind: "detail"; routeId: string }
    | { kind: "filters" }
    | { kind: "create-source" }
    | { kind: "create-category"; sourceValue: string }
    | { kind: "create-effect"; sourceValue: string }
    | { kind: "create-target"; sourceValue: string; category: TargetCategory; effectId?: EffectModuleId };

const EFFECT_IDS = Array.from(new Set(
    allRackParameterDescriptors().map((parameter) => parameter.effectId),
));

export function sourceOptionForRoute(route: Pick<ModulationRoute, "sourceKind" | "sourceSlot">) {
    return MODULATION_SOURCE_OPTIONS.find((option) => (
        option.sourceKind === route.sourceKind && option.sourceSlot === route.sourceSlot
    )) ?? MODULATION_SOURCE_OPTIONS[0];
}

function sourceValueForFocusedSource(source: FocusedModulationSource | null | undefined) {
    if (!source) {
        return null;
    }
    return MODULATION_SOURCE_OPTIONS.find((option) => (
        option.sourceKind === source.sourceKind && option.sourceSlot === source.sourceSlot
    ))?.value ?? null;
}

export function targetPresentation(targetKind: ModulationTargetKind) {
    if (isRackModulationTarget(targetKind)) {
        const parameter = getRackParameterDescriptor(parseLaneModulationTargetKind(targetKind)?.endpointID ?? "");
        if (parameter) {
            const effect = getRackEffectDescriptor(parameter.effectId);
            return {
                category: parameter.effectId === "filter" ? "Global Filter" : effect.label,
                parameter: parameter.label,
            };
        }
    }

    return {
        category: "Voice",
        parameter: MODULATION_TARGET_OPTIONS.find((option) => option.value === targetKind)?.label ?? targetKind,
    };
}

export function targetCategory(targetKind: ModulationTargetKind): TargetCategory {
    if (!isRackModulationTarget(targetKind)) {
        return "voice";
    }
    return parseLaneModulationTargetKind(targetKind)?.deviceType === "globalFilter" ? "global-filter" : "fx";
}

export function SourceIdentity({
    sourceKind,
    sourceSlot,
}: Pick<ModulationRoute, "sourceKind" | "sourceSlot">) {
    const option = sourceOptionForRoute({ sourceKind, sourceSlot });
    const family = RACK_MODULATION_SOURCE_PAGES[0]?.find((candidate) => candidate.sourceKind === sourceKind);

    if (!family) {
        return (
            <span className="mobile-mod-fixed-source" aria-hidden="true">
                {option.label}
            </span>
        );
    }

    return (
        <span
            className="mobile-mod-source-art"
            style={{ "--source-color": family.accent } as CSSProperties}
            aria-hidden="true"
        >
            <img src={family.iconUrl} alt="" draggable={false} />
            <span>{sourceSlot}</span>
        </span>
    );
}

function ScreenHeader({
    title,
    onBack,
}: {
    title: string;
    onBack: () => void;
}) {
    return (
        <header className="mobile-mod-screen-header">
            <button type="button" className="mobile-mod-back" data-role="mobile-mod-detail-back" onClick={onBack}>
                <span aria-hidden="true">‹</span>
                Back
            </button>
            <h3>{title}</h3>
            <span className="mobile-mod-header-spacer" aria-hidden="true" />
        </header>
    );
}

function RouteAmountEditor({ route }: { route: ModulationRoute }) {
    const amountBinding = useModulationRouteAmountBinding(route);
    const entrySpec = useModulationAmountParameterEntrySpec(route.targetKind);
    const presentedAmount = amountBinding.value;
    const focusedRef = useRef(false);
    const skipCommitOnBlurRef = useRef(false);
    const [draft, setDraft] = useState(() => formatParameterEntry(entrySpec, route.amount).draft);
    const [entryError, setEntryError] = useState<string | null>(null);
    const formattedAmount = formatParameterEntry(entrySpec, presentedAmount);

    const publishAmount = useCallback((nextAmount: number) => {
        if (Math.abs(nextAmount - presentedAmount) <= 1e-9) {
            return;
        }
        amountBinding.setValue(nextAmount);
    }, [amountBinding, presentedAmount]);

    useEffect(() => {
        if (!focusedRef.current) {
            setDraft(formatParameterEntry(entrySpec, presentedAmount).draft);
            setEntryError(null);
        }
    }, [entrySpec, presentedAmount]);

    const commitDraft = () => {
        const result = parseParameterEntry(entrySpec, draft);
        if (result._tag === "rejected") {
            setEntryError(result.message);
            return false;
        }
        if (result.commit._tag !== "value") {
            throw new Error("A modulation amount entry produced a tempo division.");
        }
        setEntryError(null);
        setDraft(result.echo.draft);
        publishAmount(result.commit.value);
        return true;
    };
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (commitDraft()) {
                skipCommitOnBlurRef.current = true;
                event.currentTarget.blur();
            }
        } else if (event.key === "Escape") {
            setDraft(formattedAmount.draft);
            setEntryError(null);
            skipCommitOnBlurRef.current = true;
            event.currentTarget.blur();
        }
    };

    return (
        <section className="mobile-mod-amount-editor" aria-label="Route amount">
            <div className="mobile-mod-field-heading">
                <span>Amount</span>
                <strong>{formatModulationAmountReadout(route.targetKind, presentedAmount, route.polarity)}</strong>
            </div>
            <input
                type="range"
                className="cosimo-range"
                min={0}
                max={1}
                step={0.001}
                value={getModulationAmountSliderPosition(route.targetKind, presentedAmount).toFixed(3)}
                data-role="mobile-mod-amount-slider"
                aria-label="Route amount slider"
                onChange={(event) => publishAmount(composeModulationAmount(route.targetKind, Number(event.currentTarget.value)))}
            />
            <label className="mobile-mod-exact-row">
                <span>Exact</span>
                <input
                    type="text"
                    inputMode="decimal"
                    data-role="mobile-mod-amount-input"
                    aria-label="Exact route amount"
                    value={draft}
                    onChange={(event) => {
                        setDraft(event.currentTarget.value);
                        setEntryError(null);
                    }}
                    onFocus={() => {
                        focusedRef.current = true;
                    }}
                    onBlur={() => {
                        focusedRef.current = false;
                        if (skipCommitOnBlurRef.current) {
                            skipCommitOnBlurRef.current = false;
                        } else {
                            commitDraft();
                        }
                    }}
                    onKeyDown={handleKeyDown}
                />
                <em data-role="parameter-entry-unit">{formattedAmount.unit}</em>
            </label>
            {entryError === null ? null : (
                <span data-role="parameter-entry-error" role="alert">{entryError}</span>
            )}
        </section>
    );
}

export function MobileModMatrix({
    routes,
    focusedSource = null,
    recentConfirmedRouteId = null,
    onCreateRoute,
    onRemoveRoute,
    onRouteChange,
}: MobileModMatrixProps) {
    const [view, setView] = useState<MatrixView>({ kind: "list" });
    const [sourceFilter, setSourceFilter] = useState<string | null>(() => sourceValueForFocusedSource(focusedSource));
    const [targetFilter, setTargetFilter] = useState<TargetCategory | null>(null);
    const [statusFilter, setStatusFilter] = useState<RouteStatusFilter>("all");
    const [sort, setSort] = useState<RouteSort>("source");
    const focusedSourceValue = sourceValueForFocusedSource(focusedSource);

    useEffect(() => {
        if (!focusedSourceValue) {
            return;
        }
        setSourceFilter(focusedSourceValue);
        setView({ kind: "list" });
    }, [focusedSourceValue]);

    const displayedRoutes = useMemo(() => {
        const rows = routes
            .map((route, routeIndex) => ({ route, routeIndex }))
            .filter(({ route }) => {
                if (sourceFilter && sourceOptionForRoute(route).value !== sourceFilter) {
                    return false;
                }
                if (targetFilter && targetCategory(route.targetKind) !== targetFilter) {
                    return false;
                }
                if (statusFilter === "active" && !route.enabled) {
                    return false;
                }
                if (statusFilter === "bypassed" && route.enabled) {
                    return false;
                }
                return true;
            });

        return rows.sort((left, right) => {
            const leftKey = sort === "source"
                ? sourceOptionForRoute(left.route).label
                : `${targetPresentation(left.route.targetKind).category} ${targetPresentation(left.route.targetKind).parameter}`;
            const rightKey = sort === "source"
                ? sourceOptionForRoute(right.route).label
                : `${targetPresentation(right.route.targetKind).category} ${targetPresentation(right.route.targetKind).parameter}`;
            return leftKey.localeCompare(rightKey);
        });
    }, [routes, sort, sourceFilter, statusFilter, targetFilter]);

    const createRoute = (sourceValue: string, targetKind: ModulationTargetKind) => {
        const source = MODULATION_SOURCE_OPTIONS.find((option) => option.value === sourceValue);
        if (!source) {
            setView({ kind: "list" });
            return;
        }
        const creation = getModulationRouteCreation({
            routes,
            source,
            targetKind,
            pending: false,
        });
        const existingRoute = creation === "existing" ? routes.find((route) => (
            route.sourceKind === source.sourceKind
            && route.sourceSlot === source.sourceSlot
            && route.targetKind === targetKind
        )) : undefined;
        if (existingRoute) {
            setView({ kind: "detail", routeId: existingRoute.id });
            return;
        }
        if (creation !== "creatable") {
            setView({ kind: "list" });
            return;
        }
        onCreateRoute({
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind,
            amount: 0,
            enabled: true,
            polarity: "unipolar",
            reducer: "max",
        });
        setView({ kind: "list" });
    };

    const selectedRouteIndex = view.kind === "detail"
        ? routes.findIndex((route) => route.id === view.routeId)
        : -1;
    const selectedRoute = selectedRouteIndex >= 0 ? routes[selectedRouteIndex] : null;

    const renderCreateTargets = (sourceValue: string, category: TargetCategory, effectId?: EffectModuleId) => {
        const targets = MODULATION_TARGET_OPTIONS.filter((option) => {
            if (category === "voice") {
                return !isRackModulationTarget(option.value);
            }
            if (category === "global-filter") {
                return parseLaneModulationTargetKind(option.value)?.deviceType === "globalFilter";
            }
            if (!effectId) {
                return false;
            }
            const parameter = isRackModulationTarget(option.value)
                ? getRackParameterDescriptor(parseLaneModulationTargetKind(option.value)?.endpointID ?? "")
                : null;
            return parameter?.effectId === effectId;
        });

        return (
            <div className="mobile-mod-screen" data-role="mobile-mod-create-target">
                <ScreenHeader
                    title={category === "voice" ? "Voice target" : category === "global-filter" ? "Global Filter" : getRackEffectDescriptor(effectId!).label}
                    onBack={() => setView(category === "fx" ? { kind: "create-effect", sourceValue } : { kind: "create-category", sourceValue })}
                />
                <div className="mobile-mod-option-list">
                    {targets.map((target) => (
                        <button
                            key={target.value}
                            type="button"
                            data-role={`mobile-mod-create-target-${target.value.replace(".", "-")}`}
                            onClick={() => createRoute(sourceValue, target.value)}
                        >
                            <span>{targetPresentation(target.value).parameter}</span>
                            <span aria-hidden="true">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <section className="mobile-mod-matrix" data-role="mobile-mod-matrix" data-section-accent="amber">
            {view.kind === "detail" && selectedRoute ? (
                <div className="mobile-mod-screen" data-role="mobile-mod-route-detail">
                    <ScreenHeader title="Route" onBack={() => setView({ kind: "list" })} />
                    <div className="mobile-mod-detail-pair">
                        <SourceIdentity sourceKind={selectedRoute.sourceKind} sourceSlot={selectedRoute.sourceSlot} />
                        <div>
                            <span>{sourceOptionForRoute(selectedRoute).label}</span>
                            <strong>{targetPresentation(selectedRoute.targetKind).category} · {targetPresentation(selectedRoute.targetKind).parameter}</strong>
                        </div>
                    </div>
                    <RouteAmountEditor route={selectedRoute} />
                    <div className="mobile-mod-detail-actions">
                        <button
                            type="button"
                            data-role="mobile-mod-polarity"
                            aria-pressed={selectedRoute.polarity === "bipolar"}
                            onClick={() => onRouteChange(selectedRouteIndex, {
                                polarity: selectedRoute.polarity === "bipolar" ? "unipolar" : "bipolar",
                            })}
                        >
                            <span>Polarity</span>
                            <strong>{selectedRoute.polarity === "bipolar" ? "± Bipolar" : "+ Unipolar"}</strong>
                        </button>
                        {isRackModulationTarget(selectedRoute.targetKind) && isVoiceModulationSource(selectedRoute.sourceKind) ? (
                            <button
                                type="button"
                                data-role="mobile-mod-reducer"
                                onClick={() => onRouteChange(selectedRouteIndex, {
                                    reducer: selectedRoute.reducer === "max" ? "mean" : "max",
                                })}
                            >
                                <span>Voice reducer</span>
                                <strong>{selectedRoute.reducer === "max" ? "Max" : "Mean"}</strong>
                            </button>
                        ) : null}
                        <button
                            type="button"
                            data-role="mobile-mod-bypass"
                            aria-pressed={!selectedRoute.enabled}
                            onClick={() => onRouteChange(selectedRouteIndex, { enabled: !selectedRoute.enabled })}
                        >
                            <span>Route</span>
                            <strong>{selectedRoute.enabled ? "Active" : "Bypassed"}</strong>
                        </button>
                        <button
                            type="button"
                            data-role="mobile-mod-delete"
                            className="is-destructive"
                            onClick={() => {
                                onRemoveRoute(selectedRouteIndex);
                                setView({ kind: "list" });
                            }}
                        >
                            Delete route
                        </button>
                    </div>
                </div>
            ) : view.kind === "filters" ? (
                <div className="mobile-mod-screen" data-role="mobile-mod-filter-sheet">
                    <ScreenHeader title="Filter routes" onBack={() => setView({ kind: "list" })} />
                    <fieldset className="mobile-mod-filter-group">
                        <legend>Source</legend>
                        <button type="button" aria-pressed={sourceFilter === null} onClick={() => setSourceFilter(null)}>All sources</button>
                        {MODULATION_SOURCE_OPTIONS.map((source) => (
                            <button
                                key={source.value}
                                type="button"
                                data-role={`mobile-mod-filter-source-${source.value}`}
                                aria-pressed={sourceFilter === source.value}
                                onClick={() => setSourceFilter(source.value)}
                            >{source.label}</button>
                        ))}
                    </fieldset>
                    <fieldset className="mobile-mod-filter-group">
                        <legend>Destination</legend>
                        {([null, "voice", "global-filter", "fx"] as const).map((category) => (
                            <button
                                key={category ?? "all"}
                                type="button"
                                aria-pressed={targetFilter === category}
                                onClick={() => setTargetFilter(category)}
                            >{category === null ? "All" : category === "global-filter" ? "Global Filter" : category === "fx" ? "FX" : "Voice"}</button>
                        ))}
                    </fieldset>
                    <fieldset className="mobile-mod-filter-group">
                        <legend>State</legend>
                        {(["all", "active", "bypassed"] as const).map((status) => (
                            <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status}</button>
                        ))}
                    </fieldset>
                    <fieldset className="mobile-mod-filter-group">
                        <legend>Sort</legend>
                        {(["source", "destination"] as const).map((nextSort) => (
                            <button key={nextSort} type="button" aria-pressed={sort === nextSort} onClick={() => setSort(nextSort)}>{nextSort}</button>
                        ))}
                    </fieldset>
                    <button type="button" className="mobile-mod-primary" data-role="mobile-mod-filter-done" onClick={() => setView({ kind: "list" })}>Done</button>
                </div>
            ) : view.kind === "create-source" ? (
                <div className="mobile-mod-screen">
                    <ScreenHeader title="Choose source" onBack={() => setView({ kind: "list" })} />
                    <div className="mobile-mod-option-list">
                        {MODULATION_SOURCE_OPTIONS.map((source) => (
                            <button
                                key={source.value}
                                type="button"
                                data-role={`mobile-mod-create-source-${source.value}`}
                                onClick={() => setView({ kind: "create-category", sourceValue: source.value })}
                            >
                                <SourceIdentity sourceKind={source.sourceKind} sourceSlot={source.sourceSlot} />
                                <span>{source.label}</span>
                                <span aria-hidden="true">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : view.kind === "create-category" ? (
                <div className="mobile-mod-screen">
                    <ScreenHeader title="Choose destination" onBack={() => setView({ kind: "create-source" })} />
                    <div className="mobile-mod-option-list">
                        {(["voice", "global-filter", "fx"] as const).map((category) => (
                            <button
                                key={category}
                                type="button"
                                data-role={`mobile-mod-create-category-${category === "global-filter" ? "global-filter" : category}`}
                                onClick={() => setView(category === "fx"
                                    ? { kind: "create-effect", sourceValue: view.sourceValue }
                                    : { kind: "create-target", sourceValue: view.sourceValue, category })}
                            >
                                <span>{category === "global-filter" ? "Global Filter" : category === "fx" ? "FX" : "Voice"}</span>
                                <span aria-hidden="true">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : view.kind === "create-effect" ? (
                <div className="mobile-mod-screen">
                    <ScreenHeader title="Choose effect" onBack={() => setView({ kind: "create-category", sourceValue: view.sourceValue })} />
                    <div className="mobile-mod-option-list">
                        {EFFECT_IDS.filter((effectId) => effectId !== "filter").map((effectId) => (
                            <button
                                key={effectId}
                                type="button"
                                data-role={`mobile-mod-create-effect-${effectId}`}
                                onClick={() => setView({ kind: "create-target", sourceValue: view.sourceValue, category: "fx", effectId })}
                            >
                                <span>{getRackEffectDescriptor(effectId).label}</span>
                                <span aria-hidden="true">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : view.kind === "create-target" ? (
                renderCreateTargets(view.sourceValue, view.category, view.effectId)
            ) : (
                <div className="mobile-mod-list-screen">
                    <header className="mobile-mod-list-header">
                        <div>
                            <h2>Mappings</h2>
                            <span data-role="mobile-mod-route-count">{routes.length} mappings</span>
                        </div>
                        <button type="button" data-role="mobile-mod-filter" onClick={() => setView({ kind: "filters" })}>Filter</button>
                        <button
                            type="button"
                            data-role="mobile-mod-add"
                            onClick={() => setView({ kind: "create-source" })}
                        >
                            +
                            <span className="sr-only">Add mapping</span>
                        </button>
                    </header>
                    {sourceFilter || targetFilter || statusFilter !== "all" ? (
                        <div className="mobile-mod-filter-tokens">
                            {sourceFilter ? (
                                <span data-role="mobile-mod-filter-token">
                                    {MODULATION_SOURCE_OPTIONS.find((source) => source.value === sourceFilter)?.label}
                                    <button type="button" data-role="mobile-mod-filter-token-remove" aria-label="Remove source filter" onClick={() => setSourceFilter(null)}>×</button>
                                </span>
                            ) : null}
                            {targetFilter ? <span>{targetFilter === "global-filter" ? "Global Filter" : targetFilter === "fx" ? "FX" : "Voice"}<button type="button" aria-label="Remove destination filter" onClick={() => setTargetFilter(null)}>×</button></span> : null}
                            {statusFilter !== "all" ? <span>{statusFilter}<button type="button" aria-label="Remove state filter" onClick={() => setStatusFilter("all")}>×</button></span> : null}
                        </div>
                    ) : null}
                    <div className="mobile-mod-route-list">
                        {displayedRoutes.map(({ route, routeIndex }) => {
                            const source = sourceOptionForRoute(route);
                            const target = targetPresentation(route.targetKind);
                            const rowFamily = RACK_MODULATION_SOURCE_PAGES[0]?.find(
                                (candidate) => candidate.sourceKind === route.sourceKind,
                            );
                            return (
                                <article
                                    key={route.id}
                                    className={`${route.enabled ? "" : "is-bypassed"}${route.id === recentConfirmedRouteId ? " is-just-created" : ""}`}
                                    data-role="mobile-mod-route-row"
                                    style={{ "--route-source-accent": rowFamily?.accent ?? "#8e969b" } as CSSProperties}
                                >
                                    <button
                                        type="button"
                                        className="mobile-mod-route-open"
                                        data-role={`mobile-mod-route-open-${routeIndex}`}
                                        onClick={() => setView({ kind: "detail", routeId: route.id })}
                                    >
                                        <SourceIdentity sourceKind={route.sourceKind} sourceSlot={route.sourceSlot} />
                                        <span className="mobile-mod-route-source">{source.label}</span>
                                        <span className="mobile-mod-route-arrow" aria-hidden="true">→</span>
                                        <span className="mobile-mod-route-target"><strong>{target.category}</strong><span>{target.parameter}</span></span>
                                        <span className="mobile-mod-route-amount">{formatModulationAmountReadout(route.targetKind, route.amount, route.polarity)}</span>
                                        {route.enabled ? null : (
                                            <span className="mobile-mod-route-bypassed-label" data-role="mobile-mod-route-bypassed">BYPASSED</span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="mobile-mod-route-power"
                                        aria-label={`${route.enabled ? "Bypass" : "Enable"} ${source.label} to ${target.parameter}`}
                                        aria-pressed={route.enabled}
                                        onClick={() => onRouteChange(routeIndex, { enabled: !route.enabled })}
                                    >
                                        <span aria-hidden="true">⏻</span>
                                    </button>
                                </article>
                            );
                        })}
                        {displayedRoutes.length === 0 ? <p className="mobile-mod-empty">No mappings match these filters.</p> : null}
                    </div>
                </div>
            )}
        </section>
    );
}
