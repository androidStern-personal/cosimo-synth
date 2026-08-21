import type {
    ModulationPolarity,
    ModulationRoute,
    ModulationSourceOption,
} from "./modulation";
import type {
    ModulationSourceKind,
    ModulationTargetKind,
} from "./modulation-targets";
import { getModulationRouteCreation } from "./rack-route-presentation";

/** One normalized inclusive range used by a numeric table filter. */
export type MappingsNormalizedRange = {
    min: number;
    max: number;
};

/** One sortable logical column in the mappings table. */
export type MappingsSortColumn = "source" | "target" | "base" | "amount" | "direction" | "state";

/** Direction applied only to the selected primary sort column. */
export type MappingsSortDirection = "asc" | "desc";

/** Persisted-per-instance view choices for the mappings list machine. */
export type MappingsViewPrefs = {
    search: string;
    sort: {
        column: MappingsSortColumn;
        direction: MappingsSortDirection;
    };
    filters: {
        sources: string[];
        targets: string[];
        direction: "all" | ModulationPolarity;
        state: "all" | "active" | "bypassed";
        baseRange: MappingsNormalizedRange | null;
        amountRange: MappingsNormalizedRange | null;
    };
};

/** Spec vocabulary alias for the mappings view-preference state. */
export type ViewPrefs = MappingsViewPrefs;

/** Every supported transition of the mappings view-preference reducer. */
export type ViewPrefsAction =
    | { kind: "setSearch"; search: string }
    | { kind: "setSort"; column: MappingsSortColumn }
    | { kind: "clearAll" }
    | { kind: "setSourceFilter"; sources: ReadonlyArray<string> }
    | { kind: "toggleSourceFilter"; sourceValue: string }
    | { kind: "clearSourceFilter" }
    | { kind: "setTargetFilter"; targets: ReadonlyArray<string> }
    | { kind: "toggleTargetFilter"; target: string }
    | { kind: "clearTargetFilter" }
    | { kind: "setDirectionFilter"; direction: MappingsViewPrefs["filters"]["direction"] }
    | { kind: "clearDirectionFilter" }
    | { kind: "setStateFilter"; state: MappingsViewPrefs["filters"]["state"] }
    | { kind: "clearStateFilter" }
    | { kind: "setBaseRangeFilter"; range: MappingsNormalizedRange | null }
    | { kind: "clearBaseRangeFilter" }
    | { kind: "setAmountRangeFilter"; range: MappingsNormalizedRange | null }
    | { kind: "clearAmountRangeFilter" };

/** Spec vocabulary alias for a view-preference reducer action. */
export type Action = ViewPrefsAction;

/** Pure row data projected by the binding layer for the mappings list machine. */
export type MappingsRowInput = {
    id: string;
    routeIndex: number;
    sourceKind: ModulationSourceKind;
    sourceSlot: number | null;
    sourceLabel: string;
    sourceValue: string;
    targetKind: ModulationTargetKind;
    targetCategoryLabel: string;
    targetParameterLabel: string;
    searchText: string;
    baseNormalized: number | null;
    amountNormalized: number;
    polarity: ModulationPolarity;
    enabled: boolean;
};

/** Optional plain-data labels retained even when no current row uses a selected source. */
export type ApplyViewPrefsOptions = {
    sourceLabels?: Readonly<Record<string, string>>;
};

/** One removable search or filter criterion rendered by the toolbar. */
export type MappingsActiveCriterion = {
    key: string;
    label: string;
    clearAction: ViewPrefsAction;
};

/** Result of filtering and deterministically sorting all projected mapping rows. */
export type AppliedMappingsView = {
    rows: MappingsRowInput[];
    matchedCount: number;
    totalCount: number;
    activeCriteria: MappingsActiveCriterion[];
};

/** State of an inline Add Mapping draft before the binding layer commits it. */
export type DraftCreationState = "incomplete" | "duplicate" | "creatable";

/** Create a fresh all-visible Source-then-Target ascending view preference. */
export function createDefaultViewPrefs(): MappingsViewPrefs {
    return {
        search: "",
        sort: { column: "source", direction: "asc" },
        filters: {
            sources: [],
            targets: [],
            direction: "all",
            state: "all",
            baseRange: null,
            amountRange: null,
        },
    };
}

function toggleValue(values: ReadonlyArray<string>, value: string): string[] {
    return values.includes(value)
        ? values.filter((candidate) => candidate !== value)
        : [...values, value];
}

/** Apply one immutable transition to mappings view preferences. */
export function viewPrefsReducer(state: MappingsViewPrefs, action: ViewPrefsAction): MappingsViewPrefs {
    switch (action.kind) {
        case "setSearch":
            return { ...state, search: action.search };
        case "setSort":
            return {
                ...state,
                sort: state.sort.column === action.column
                    ? {
                        column: action.column,
                        direction: state.sort.direction === "asc" ? "desc" : "asc",
                    }
                    : { column: action.column, direction: "asc" },
            };
        case "clearAll":
            return createDefaultViewPrefs();
        case "setSourceFilter":
            return {
                ...state,
                filters: { ...state.filters, sources: [...action.sources] },
            };
        case "toggleSourceFilter":
            return {
                ...state,
                filters: {
                    ...state.filters,
                    sources: toggleValue(state.filters.sources, action.sourceValue),
                },
            };
        case "clearSourceFilter":
            return { ...state, filters: { ...state.filters, sources: [] } };
        case "setTargetFilter":
            return {
                ...state,
                filters: { ...state.filters, targets: [...action.targets] },
            };
        case "toggleTargetFilter":
            return {
                ...state,
                filters: {
                    ...state.filters,
                    targets: toggleValue(state.filters.targets, action.target),
                },
            };
        case "clearTargetFilter":
            return { ...state, filters: { ...state.filters, targets: [] } };
        case "setDirectionFilter":
            return { ...state, filters: { ...state.filters, direction: action.direction } };
        case "clearDirectionFilter":
            return { ...state, filters: { ...state.filters, direction: "all" } };
        case "setStateFilter":
            return { ...state, filters: { ...state.filters, state: action.state } };
        case "clearStateFilter":
            return { ...state, filters: { ...state.filters, state: "all" } };
        case "setBaseRangeFilter":
            return { ...state, filters: { ...state.filters, baseRange: action.range } };
        case "clearBaseRangeFilter":
            return { ...state, filters: { ...state.filters, baseRange: null } };
        case "setAmountRangeFilter":
            return { ...state, filters: { ...state.filters, amountRange: action.range } };
        case "clearAmountRangeFilter":
            return { ...state, filters: { ...state.filters, amountRange: null } };
    }
}

function compareText(left: string, right: string): number {
    const normalizedLeft = left.toLowerCase();
    const normalizedRight = right.toLowerCase();
    if (normalizedLeft < normalizedRight) return -1;
    if (normalizedLeft > normalizedRight) return 1;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function compareSource(left: MappingsRowInput, right: MappingsRowInput): number {
    return compareText(left.sourceLabel, right.sourceLabel)
        || compareText(left.sourceValue, right.sourceValue);
}

function compareTarget(left: MappingsRowInput, right: MappingsRowInput): number {
    return compareText(left.targetCategoryLabel, right.targetCategoryLabel)
        || compareText(left.targetParameterLabel, right.targetParameterLabel)
        || compareText(left.targetKind, right.targetKind);
}

function compareNullableNumber(left: number | null, right: number | null): number {
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return left - right;
}

function compareFinalIdentity(left: MappingsRowInput, right: MappingsRowInput): number {
    return left.routeIndex - right.routeIndex || compareText(left.id, right.id);
}

function sortRows(rows: ReadonlyArray<MappingsRowInput>, prefs: MappingsViewPrefs): MappingsRowInput[] {
    const primaryDirection = prefs.sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
        let primary = 0;
        let fallback = 0;
        switch (prefs.sort.column) {
            case "source":
                primary = compareSource(left, right);
                fallback = compareTarget(left, right);
                break;
            case "target":
                primary = compareTarget(left, right);
                fallback = compareSource(left, right);
                break;
            case "base":
                primary = compareNullableNumber(left.baseNormalized, right.baseNormalized);
                fallback = compareSource(left, right) || compareTarget(left, right);
                break;
            case "amount":
                primary = left.amountNormalized - right.amountNormalized;
                fallback = compareSource(left, right) || compareTarget(left, right);
                break;
            case "direction":
                primary = Number(left.polarity === "bipolar") - Number(right.polarity === "bipolar");
                fallback = compareSource(left, right) || compareTarget(left, right);
                break;
            case "state":
                primary = Number(!left.enabled) - Number(!right.enabled);
                fallback = compareSource(left, right) || compareTarget(left, right);
                break;
        }
        return primary * primaryDirection || fallback || compareFinalIdentity(left, right);
    });
}

function inRange(value: number, range: MappingsNormalizedRange): boolean {
    return value >= range.min && value <= range.max;
}

function rowMatchesView(
    row: MappingsRowInput,
    prefs: MappingsViewPrefs,
    searchTerms: ReadonlyArray<string>,
): boolean {
    const haystack = row.searchText.toLowerCase();
    if (!searchTerms.every((term) => haystack.includes(term))) return false;

    const sourceMatches = prefs.filters.sources.length === 0
        || prefs.filters.sources.includes(row.sourceValue);
    const targetMatches = prefs.filters.targets.length === 0
        || prefs.filters.targets.includes(row.targetCategoryLabel);
    if (!sourceMatches || !targetMatches) return false;

    if (prefs.filters.direction !== "all" && row.polarity !== prefs.filters.direction) return false;
    if (prefs.filters.state === "active" && !row.enabled) return false;
    if (prefs.filters.state === "bypassed" && row.enabled) return false;

    if (prefs.filters.baseRange !== null) {
        if (row.baseNormalized === null || !inRange(row.baseNormalized, prefs.filters.baseRange)) return false;
    }
    if (prefs.filters.amountRange !== null && !inRange(row.amountNormalized, prefs.filters.amountRange)) {
        return false;
    }
    return true;
}

function formatPercentage(normalized: number): string {
    const percentage = Math.round(normalized * 10_000) / 100;
    return `${percentage}%`;
}

function formatRangeCriterion(
    label: string,
    range: MappingsNormalizedRange,
    domainMin: number,
    domainMax: number,
): string {
    if (range.max >= domainMax && range.min > domainMin) {
        return `${label} ≥ ${formatPercentage(range.min)}`;
    }
    if (range.min <= domainMin && range.max < domainMax) {
        return `${label} ≤ ${formatPercentage(range.max)}`;
    }
    return `${label}: ${formatPercentage(range.min)}–${formatPercentage(range.max)}`;
}

function sourceFilterLabel(
    sourceValue: string,
    rows: ReadonlyArray<MappingsRowInput>,
    options: ApplyViewPrefsOptions,
): string {
    return options.sourceLabels?.[sourceValue]
        ?? rows.find((row) => row.sourceValue === sourceValue)?.sourceLabel
        ?? sourceValue;
}

function activeCriteria(
    rows: ReadonlyArray<MappingsRowInput>,
    prefs: MappingsViewPrefs,
    options: ApplyViewPrefsOptions,
): MappingsActiveCriterion[] {
    const criteria: MappingsActiveCriterion[] = [];
    const search = prefs.search.trim();
    if (search !== "") {
        criteria.push({
            key: "search",
            label: `Search: \"${search}\"`,
            clearAction: { kind: "setSearch", search: "" },
        });
    }
    for (const sourceValue of prefs.filters.sources) {
        criteria.push({
            key: `source:${sourceValue}`,
            label: `Source: ${sourceFilterLabel(sourceValue, rows, options)}`,
            clearAction: { kind: "toggleSourceFilter", sourceValue },
        });
    }
    for (const target of prefs.filters.targets) {
        criteria.push({
            key: `target:${target}`,
            label: `Target: ${target}`,
            clearAction: { kind: "toggleTargetFilter", target },
        });
    }
    if (prefs.filters.direction !== "all") {
        criteria.push({
            key: "direction",
            label: `Direction: ${directionGlyph(prefs.filters.direction)}`,
            clearAction: { kind: "clearDirectionFilter" },
        });
    }
    if (prefs.filters.state !== "all") {
        criteria.push({
            key: "state",
            label: `State: ${prefs.filters.state === "active" ? "Active" : "Bypassed"}`,
            clearAction: { kind: "clearStateFilter" },
        });
    }
    if (prefs.filters.baseRange !== null) {
        criteria.push({
            key: "base-range",
            label: formatRangeCriterion("Base", prefs.filters.baseRange, 0, 1),
            clearAction: { kind: "clearBaseRangeFilter" },
        });
    }
    if (prefs.filters.amountRange !== null) {
        criteria.push({
            key: "amount-range",
            label: formatRangeCriterion("Amount", prefs.filters.amountRange, -1, 1),
            clearAction: { kind: "clearAmountRangeFilter" },
        });
    }
    return criteria;
}

/** Filter, count, describe, and deterministically sort projected mapping rows. */
export function applyViewPrefs(
    rows: ReadonlyArray<MappingsRowInput>,
    prefs: MappingsViewPrefs,
    options: ApplyViewPrefsOptions = {},
): AppliedMappingsView {
    const search = prefs.search.trim().toLowerCase();
    const searchTerms = search === "" ? [] : search.split(/\s+/u);
    const matchedRows = rows.filter((row) => rowMatchesView(row, prefs, searchTerms));
    return {
        rows: sortRows(matchedRows, prefs),
        matchedCount: matchedRows.length,
        totalCount: rows.length,
        activeCriteria: activeCriteria(rows, prefs, options),
    };
}

/**
 * Hold an actively edited row at its prior displayed index while adopting its
 * next snapshot whenever filtering still supplies one.
 */
export function freezeDisplayRows(
    previousDisplayedRows: ReadonlyArray<MappingsRowInput>,
    nextDisplayedRows: ReadonlyArray<MappingsRowInput>,
    activeRowId: string | null,
): ReadonlyArray<MappingsRowInput> {
    if (activeRowId === null) return nextDisplayedRows;
    const previousIndex = previousDisplayedRows.findIndex((row) => row.id === activeRowId);
    if (previousIndex < 0) return nextDisplayedRows;

    const previousActiveRow = previousDisplayedRows[previousIndex];
    if (previousActiveRow === undefined) return nextDisplayedRows;
    const nextActiveRow = nextDisplayedRows.find((row) => row.id === activeRowId) ?? previousActiveRow;
    const otherRows = nextDisplayedRows.filter((row) => row.id !== activeRowId);
    const insertionIndex = Math.min(previousIndex, otherRows.length);
    return [
        ...otherRows.slice(0, insertionIndex),
        nextActiveRow,
        ...otherRows.slice(insertionIndex),
    ];
}

/** Classify an inline Add Mapping draft without mutating route state. */
export function draftCreation(input: {
    routes: ReadonlyArray<ModulationRoute>;
    sourceOption: ModulationSourceOption | null;
    targetKind: ModulationTargetKind | null;
}): DraftCreationState {
    const creation = getModulationRouteCreation({
        routes: input.routes,
        source: input.sourceOption,
        targetKind: input.targetKind,
        pending: false,
    });
    if (creation === "existing") return "duplicate";
    if (creation === "creatable") return "creatable";
    return "incomplete";
}

/** List the unique target kinds already occupied by one draft source. */
export function listDuplicateTargetKinds(
    routes: ReadonlyArray<ModulationRoute>,
    sourceOption: ModulationSourceOption | null,
): ModulationTargetKind[] {
    if (sourceOption === null) return [];
    const targets = new Set<ModulationTargetKind>();
    for (const route of routes) {
        if (
            route.sourceKind === sourceOption.sourceKind
            && route.sourceSlot === sourceOption.sourceSlot
        ) {
            targets.add(route.targetKind);
        }
    }
    return [...targets];
}

/** Render one mapping polarity using the compact table glyph. */
export function directionGlyph(polarity: ModulationPolarity): "+" | "±" {
    return polarity === "unipolar" ? "+" : "±";
}

/** Render one route-enabled flag using the plain table state label. */
export function stateLabel(enabled: boolean): "Active" | "Bypassed" {
    return enabled ? "Active" : "Bypassed";
}
