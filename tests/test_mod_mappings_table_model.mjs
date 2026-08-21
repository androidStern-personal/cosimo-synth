import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModel() {
    return await loadUIModule(repoRoot, "ui/shared/mod-mappings-table-model.ts");
}

function row(overrides = {}) {
    return {
        id: "route-1",
        routeIndex: 0,
        sourceKind: "mseg",
        sourceSlot: 1,
        sourceLabel: "MSEG 1",
        sourceValue: "mseg-1",
        targetKind: "oscA.wavetablePosition",
        targetCategoryLabel: "Voice",
        targetParameterLabel: "Position",
        searchText: "mseg 1 voice position",
        baseNormalized: 0.5,
        amountNormalized: 0.25,
        polarity: "unipolar",
        enabled: true,
        ...overrides,
    };
}

function route(overrides = {}) {
    return {
        id: "route-1",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.wavetablePosition",
        amount: 0,
        reducer: "max",
        ...overrides,
    };
}

const mseg1 = {
    value: "mseg-1",
    label: "MSEG 1",
    sourceKind: "mseg",
    sourceSlot: 1,
};

const env1 = {
    value: "env-1",
    label: "ENV 1",
    sourceKind: "env",
    sourceSlot: 1,
};

test("default view prefs reveal every mapping and pin Source ascending", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();

    assert.deepEqual(defaults, {
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
    });

    const result = applyViewPrefs([
        row({ id: "mseg-beta", routeIndex: 0, targetParameterLabel: "Beta" }),
        row({
            id: "env-alpha",
            routeIndex: 1,
            sourceKind: "env",
            sourceLabel: "ENV 1",
            sourceValue: "env-1",
            targetParameterLabel: "Alpha",
        }),
        row({ id: "mseg-alpha", routeIndex: 2, targetParameterLabel: "Alpha" }),
    ], defaults);

    assert.deepEqual(result.rows.map(({ id }) => id), ["env-alpha", "mseg-alpha", "mseg-beta"]);
    assert.equal(result.matchedCount, 3);
    assert.equal(result.totalCount, 3);
    assert.deepEqual(result.activeCriteria, []);
});

test("sort reducer toggles a repeated column, starts a new column ascending, and Clear All is exactly default", async () => {
    const { createDefaultViewPrefs, viewPrefsReducer } = await loadModel();
    const defaults = createDefaultViewPrefs();

    const sourceDescending = viewPrefsReducer(defaults, { kind: "setSort", column: "source" });
    assert.deepEqual(sourceDescending.sort, { column: "source", direction: "desc" });

    const amountAscending = viewPrefsReducer(sourceDescending, { kind: "setSort", column: "amount" });
    assert.deepEqual(amountAscending.sort, { column: "amount", direction: "asc" });

    const dirty = viewPrefsReducer(
        viewPrefsReducer(amountAscending, { kind: "setSearch", search: "cut" }),
        { kind: "setStateFilter", state: "bypassed" },
    );
    const cleared = viewPrefsReducer(dirty, { kind: "clearAll" });
    assert.deepEqual(cleared, createDefaultViewPrefs());
    assert.notStrictEqual(cleared, dirty);
});

test("filter reducer supports whole-filter set/clear actions and the UI's source/target toggles", async () => {
    const { createDefaultViewPrefs, viewPrefsReducer } = await loadModel();
    let prefs = createDefaultViewPrefs();

    prefs = viewPrefsReducer(prefs, { kind: "setSourceFilter", sources: ["mseg-1", "env-1"] });
    prefs = viewPrefsReducer(prefs, { kind: "toggleSourceFilter", sourceValue: "mseg-1" });
    assert.deepEqual(prefs.filters.sources, ["env-1"]);
    prefs = viewPrefsReducer(prefs, { kind: "clearSourceFilter" });
    assert.deepEqual(prefs.filters.sources, []);

    prefs = viewPrefsReducer(prefs, { kind: "setTargetFilter", targets: ["Voice", "FX"] });
    prefs = viewPrefsReducer(prefs, { kind: "toggleTargetFilter", target: "Voice" });
    assert.deepEqual(prefs.filters.targets, ["FX"]);
    prefs = viewPrefsReducer(prefs, { kind: "clearTargetFilter" });
    assert.deepEqual(prefs.filters.targets, []);

    prefs = viewPrefsReducer(prefs, { kind: "setDirectionFilter", direction: "bipolar" });
    prefs = viewPrefsReducer(prefs, { kind: "clearDirectionFilter" });
    assert.equal(prefs.filters.direction, "all");

    prefs = viewPrefsReducer(prefs, { kind: "setStateFilter", state: "active" });
    prefs = viewPrefsReducer(prefs, { kind: "clearStateFilter" });
    assert.equal(prefs.filters.state, "all");

    prefs = viewPrefsReducer(prefs, { kind: "setBaseRangeFilter", range: { min: 0.2, max: 0.8 } });
    prefs = viewPrefsReducer(prefs, { kind: "clearBaseRangeFilter" });
    assert.equal(prefs.filters.baseRange, null);

    prefs = viewPrefsReducer(prefs, { kind: "setAmountRangeFilter", range: { min: -0.5, max: 0.5 } });
    prefs = viewPrefsReducer(prefs, { kind: "clearAmountRangeFilter" });
    assert.equal(prefs.filters.amountRange, null);
});

test("source and target sorts keep their opposite text column ascending as the fallback", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const rows = [
        row({ id: "mseg-zeta", routeIndex: 0, targetParameterLabel: "Zeta" }),
        row({ id: "mseg-alpha", routeIndex: 1, targetParameterLabel: "Alpha" }),
        row({
            id: "env-zeta",
            routeIndex: 2,
            sourceKind: "env",
            sourceLabel: "ENV 1",
            sourceValue: "env-1",
            targetParameterLabel: "Zeta",
        }),
    ];
    const defaults = createDefaultViewPrefs();

    const sourceDescending = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "source", direction: "desc" },
    });
    assert.deepEqual(sourceDescending.rows.map(({ id }) => id), ["mseg-alpha", "mseg-zeta", "env-zeta"]);

    const targetDescending = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "target", direction: "desc" },
    });
    assert.deepEqual(targetDescending.rows.map(({ id }) => id), ["env-zeta", "mseg-zeta", "mseg-alpha"]);
});

test("numeric sorts always fall back to Source then Target ascending", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "mseg-beta", routeIndex: 0, amountNormalized: 0.2, targetParameterLabel: "Beta" }),
        row({ id: "mseg-alpha", routeIndex: 1, amountNormalized: 0.2, targetParameterLabel: "Alpha" }),
        row({
            id: "env-beta",
            routeIndex: 2,
            amountNormalized: 0.2,
            sourceKind: "env",
            sourceLabel: "ENV 1",
            sourceValue: "env-1",
            targetParameterLabel: "Beta",
        }),
        row({ id: "highest", routeIndex: 3, amountNormalized: 0.8, targetParameterLabel: "Omega" }),
    ];

    const ascending = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "amount", direction: "asc" },
    });
    assert.deepEqual(ascending.rows.map(({ id }) => id), ["env-beta", "mseg-alpha", "mseg-beta", "highest"]);

    const descending = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "amount", direction: "desc" },
    });
    assert.deepEqual(descending.rows.map(({ id }) => id), ["highest", "env-beta", "mseg-alpha", "mseg-beta"]);
});

test("the final route-index and id tie-break makes every sort a deterministic total order", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const equalA = row({ id: "route-a", routeIndex: 4, amountNormalized: 0.5 });
    const equalB = row({ id: "route-b", routeIndex: 4, amountNormalized: 0.5 });
    const earlier = row({ id: "route-z", routeIndex: 2, amountNormalized: 0.5 });
    const prefs = { ...defaults, sort: { column: "amount", direction: "asc" } };

    const first = applyViewPrefs([equalB, earlier, equalA], prefs).rows.map(({ id }) => id);
    const second = applyViewPrefs([equalA, equalB, earlier], prefs).rows.map(({ id }) => id);
    assert.deepEqual(first, ["route-z", "route-a", "route-b"]);
    assert.deepEqual(second, first);
});

test("Direction and State are sortable data columns with stable text fallbacks", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "bipolar", routeIndex: 0, polarity: "bipolar", sourceLabel: "MSEG 2", sourceValue: "mseg-2" }),
        row({ id: "bypassed", routeIndex: 1, enabled: false, sourceLabel: "MSEG 3", sourceValue: "mseg-3" }),
        row({ id: "active", routeIndex: 2, sourceLabel: "ENV 1", sourceValue: "env-1", sourceKind: "env" }),
    ];

    const byDirection = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "direction", direction: "asc" },
    });
    assert.deepEqual(byDirection.rows.map(({ id }) => id), ["active", "bypassed", "bipolar"]);

    const byState = applyViewPrefs(rows, {
        ...defaults,
        sort: { column: "state", direction: "asc" },
    });
    assert.deepEqual(byState.rows.map(({ id }) => id), ["active", "bipolar", "bypassed"]);
});

test("search requires every whitespace-separated term and matches case-insensitive substrings", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "cutoff", searchText: "mseg 1 global filter cutoff" }),
        row({ id: "voice", searchText: "mseg 1 voice position" }),
        row({ id: "macro-cutoff", searchText: "macro 1 global filter cutoff" }),
    ];
    const result = applyViewPrefs(rows, { ...defaults, search: "  MSEG   cut  " });

    assert.deepEqual(result.rows.map(({ id }) => id), ["cutoff"]);
    assert.equal(result.matchedCount, 1);
    assert.equal(result.totalCount, 3);
});

test("source selections are OR within their column", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "mseg" }),
        row({ id: "env", sourceKind: "env", sourceLabel: "ENV 1", sourceValue: "env-1" }),
        row({ id: "macro", sourceKind: "macro", sourceLabel: "MACRO 1", sourceValue: "macro-1" }),
    ];
    const prefs = {
        ...defaults,
        filters: { ...defaults.filters, sources: ["mseg-1", "env-1"] },
    };

    assert.deepEqual(applyViewPrefs(rows, prefs).rows.map(({ id }) => id), ["env", "mseg"]);
});

test("filters across different columns are AND, never OR", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "source-only", sourceValue: "mseg-1", targetCategoryLabel: "Voice" }),
        row({
            id: "target-only",
            sourceKind: "env",
            sourceLabel: "ENV 1",
            sourceValue: "env-1",
            targetCategoryLabel: "Global Filter",
        }),
    ];
    const prefs = {
        ...defaults,
        filters: {
            ...defaults.filters,
            sources: ["mseg-1"],
            targets: ["Global Filter"],
        },
    };

    const result = applyViewPrefs(rows, prefs);
    assert.deepEqual(result.rows, []);
    assert.equal(result.matchedCount, 0);
    assert.equal(result.totalCount, 2);
});

test("an active Base range excludes unbacked rows instead of treating null as zero", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "lower-edge", baseNormalized: 0.25 }),
        row({ id: "upper-edge", baseNormalized: 0.75 }),
        row({ id: "outside", baseNormalized: 0.9 }),
        row({ id: "unbacked", baseNormalized: null }),
    ];
    const prefs = {
        ...defaults,
        filters: { ...defaults.filters, baseRange: { min: 0, max: 0.75 } },
    };

    assert.deepEqual(applyViewPrefs(rows, prefs).rows.map(({ id }) => id), ["lower-edge", "upper-edge"]);
});

test("Amount range comparisons use normalized values and include both endpoints", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const rows = [
        row({ id: "negative-edge", amountNormalized: -0.5 }),
        row({ id: "positive-edge", amountNormalized: 0.5 }),
        row({ id: "outside", amountNormalized: 0.5001 }),
    ];
    const prefs = {
        ...defaults,
        filters: { ...defaults.filters, amountRange: { min: -0.5, max: 0.5 } },
    };

    assert.deepEqual(applyViewPrefs(rows, prefs).rows.map(({ id }) => id), ["negative-edge", "positive-edge"]);
});

test("active criteria use spec-plain labels and carry one removable clear action each", async () => {
    const { applyViewPrefs, createDefaultViewPrefs } = await loadModel();
    const defaults = createDefaultViewPrefs();
    const prefs = {
        ...defaults,
        search: "cut",
        filters: {
            ...defaults.filters,
            sources: ["mseg-1"],
            targets: ["Global Filter"],
            baseRange: { min: 0.25, max: 1 },
        },
    };
    const result = applyViewPrefs([
        row({
            targetCategoryLabel: "Global Filter",
            targetParameterLabel: "Cutoff",
            searchText: "mseg 1 global filter cutoff",
        }),
    ], prefs);

    assert.deepEqual(result.activeCriteria.map(({ label }) => label), [
        "Search: \"cut\"",
        "Source: MSEG 1",
        "Target: Global Filter",
        "Base ≥ 25%",
    ]);
    assert.deepEqual(result.activeCriteria.map(({ clearAction }) => clearAction), [
        { kind: "setSearch", search: "" },
        { kind: "toggleSourceFilter", sourceValue: "mseg-1" },
        { kind: "toggleTargetFilter", target: "Global Filter" },
        { kind: "clearBaseRangeFilter" },
    ]);
    assert.equal(new Set(result.activeCriteria.map(({ key }) => key)).size, 4);
});

test("gesture freeze keeps a newly sorted active row at its previous index with its new data", async () => {
    const { freezeDisplayRows } = await loadModel();
    const previousActive = row({ id: "active", routeIndex: 0, amountNormalized: 0.1 });
    const nextActive = row({ id: "active", routeIndex: 0, amountNormalized: 0.9 });
    const other = row({ id: "other", routeIndex: 1, amountNormalized: 0.4 });

    const frozen = freezeDisplayRows([previousActive, other], [other, nextActive], "active");
    assert.deepEqual(frozen.map(({ id }) => id), ["active", "other"]);
    assert.strictEqual(frozen[0], nextActive);
    assert.equal(frozen[0].amountNormalized, 0.9);
});

test("gesture freeze keeps an active row's membership and index when an edit makes it fail the filter", async () => {
    const { freezeDisplayRows } = await loadModel();
    const before = row({ id: "before", routeIndex: 0 });
    const active = row({ id: "active", routeIndex: 1, amountNormalized: 0.2 });
    const after = row({ id: "after", routeIndex: 2 });

    const frozen = freezeDisplayRows([before, active, after], [before, after], "active");
    assert.deepEqual(frozen.map(({ id }) => id), ["before", "active", "after"]);
});

test("gesture freeze falls back to the next rows unchanged when the previous list lacked the active row", async () => {
    const { freezeDisplayRows } = await loadModel();
    const previous = [row({ id: "before" })];
    const next = [row({ id: "new-active", routeIndex: 1 }), row({ id: "before" })];

    assert.strictEqual(freezeDisplayRows(previous, next, "new-active"), next);
    assert.strictEqual(freezeDisplayRows(previous, next, null), next);
});

test("draft creation distinguishes incomplete, duplicate, and creatable source-target pairs", async () => {
    const { draftCreation } = await loadModel();
    const routes = [route()];

    assert.equal(draftCreation({ routes, sourceOption: null, targetKind: null }), "incomplete");
    assert.equal(
        draftCreation({ routes, sourceOption: mseg1, targetKind: "oscA.wavetablePosition" }),
        "duplicate",
    );
    assert.equal(
        draftCreation({ routes, sourceOption: mseg1, targetKind: "oscA.warpAmount" }),
        "creatable",
    );
});

test("duplicate target listing is source-specific, unique, and preserves route order", async () => {
    const { listDuplicateTargetKinds } = await loadModel();
    const routes = [
        route({ id: "a", targetKind: "oscA.warpAmount" }),
        route({ id: "b", targetKind: "oscA.wavetablePosition" }),
        route({ id: "invalid-repeat", targetKind: "oscA.warpAmount" }),
        route({ id: "other-source", sourceKind: "env", targetKind: "filterQ" }),
    ];

    assert.deepEqual(listDuplicateTargetKinds(routes, mseg1), [
        "oscA.warpAmount",
        "oscA.wavetablePosition",
    ]);
    assert.deepEqual(listDuplicateTargetKinds(routes, env1), ["filterQ"]);
    assert.deepEqual(listDuplicateTargetKinds(routes, null), []);
});

test("row helpers expose the compact direction glyph and plain state label verbatim", async () => {
    const { directionGlyph, stateLabel } = await loadModel();

    assert.equal(directionGlyph("unipolar"), "+");
    assert.equal(directionGlyph("bipolar"), "±");
    assert.equal(stateLabel(true), "Active");
    assert.equal(stateLabel(false), "Bypassed");
});
