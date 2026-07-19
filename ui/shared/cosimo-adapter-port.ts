/**
 * The Cosimo adapter port: the application-owned seam between the mobile
 * product shell and any backing instrument (docs/COSIMO_IOS_MERGE_ROADMAP.md
 * § API contracts).
 *
 * Two adapters implement it — the in-memory mock (the named test fixture) and
 * the engine bridge over PatchConnectionLike — and they expose the identical
 * surface at every commit (hard-cut policy: no per-adapter capabilities).
 * A shared behavioral contract suite runs against both; the bridge must pass
 * it unchanged. Reads are useSyncExternalStore-compatible; commands mutate
 * the authoritative model synchronously — persistence and engine upload are
 * adapter business, invisible here.
 *
 * Unknown-id inputs to commands are DEFECTS (the UI only passes ids read from
 * the snapshot), not expected failures; commands with genuine failure policy
 * return Result values.
 */

import { type ArticulationRange } from "./articulation-image";
import {
    type ArticulationId,
    type MappingId,
    type NormalizedValue,
    type SourceId,
    type TargetId,
} from "./cosimo-ids";
import { type ModulationEnvelope, type ModulationMsegSlot, MODULATION_MAX_ROUTES } from "./modulation";
import { type MsegPlayback, type MsegShape } from "./mseg";
import { type Result } from "./result";
import { type EffectModuleId } from "./target-descriptor";

/** Lifecycle of the adapter's backing engine. The mock is always ready. */
export type ConnectionState =
    | { readonly _tag: "ready" }
    | { readonly _tag: "connecting" }
    | { readonly _tag: "detached"; readonly reason: string };

/** Which layer a value edit writes (never inferred from audition — locked 2026-07-16). */
export type EditLayer =
    | { readonly _tag: "patchBase" }
    | { readonly _tag: "articulationOverride"; readonly articulationId: ArticulationId };

/** Polarity of a mapping's source transform (engine semantics, 2026-07-16). */
export type MappingPolarity = "Unipolar" | "Bipolar";

/** Voice-source→global-target reducer (ledger §9: exactly these two). */
export type MappingReducer = "Max" | "Mean";

/** The kinds of modulation sources the rail can hold. */
export type SourceType = "macro" | "envelope" | "mseg" | "fixed";

/** Articulation trigger dispatch mode. */
export type ArticulationTriggerMode = "chain" | "key" | "vel";

/** One source→target route. `amount` is in the target's ModAmountSpec units. */
export type ModulationMapping = {
    readonly id: MappingId;
    readonly targetId: TargetId;
    readonly sourceId: SourceId;
    readonly amount: number;
    readonly polarity: MappingPolarity;
    readonly reducer: MappingReducer;
    readonly enabled: boolean;
};

/** Per-type source state, in REAL units (no illustrative 0-100 bags). */
export type SourceState =
    | { readonly _tag: "macro"; readonly value: NormalizedValue; readonly name: string }
    | { readonly _tag: "envelope"; readonly envelope: ModulationEnvelope }
    | { readonly _tag: "mseg"; readonly slot: ModulationMsegSlot }
    | { readonly _tag: "fixed" };

/** One rail source. Fixed sources have slot null and immutable identity. */
export type ModulationSource = {
    readonly id: SourceId;
    readonly type: SourceType;
    readonly slot: number | null;
    readonly label: string;
    readonly state: SourceState;
};

/** One articulation as the UI addresses it (storage form is ADR-014 v3). */
export type ArticulationView = {
    readonly id: ArticulationId;
    readonly label: string;
    readonly color: string;
    readonly icon: string;
    /** Engine selector (v3 runtimeSlot) — stable for the slot's lifetime. */
    readonly selector: number;
    readonly key: number;
    readonly velRange: ArticulationRange;
    readonly chainRange: ArticulationRange;
};

/** Tempo-sync compound setting for a compound-flagged target. */
export type CompoundSetting = {
    readonly mode: "Free" | "Sync";
    readonly division: string;
};

/** The transportable audition state. */
export type AuditionState = {
    readonly articulation: ArticulationId | "Default";
    readonly note: string;
    readonly repeat: boolean;
    readonly latch: boolean;
    readonly triggerActive: boolean;
    /** The parameter whose motion Capture would commit, when one exists. */
    readonly captureCandidate: { readonly targetId: TargetId; readonly sourceId: SourceId | null } | null;
    readonly status: string;
};

/** The complete instrument snapshot. Immutable; reference-stable between changes. */
export type PatchSnapshot = {
    readonly connection: ConnectionState;
    readonly patch: {
        readonly parameterValues: Readonly<Record<TargetId, NormalizedValue>>;
        readonly mappings: ReadonlyArray<ModulationMapping>;
        readonly sources: ReadonlyArray<ModulationSource>;
        readonly effectOrder: ReadonlyArray<EffectModuleId>;
        readonly effectEnabled: Readonly<Record<EffectModuleId, boolean>>;
        readonly compoundSettings: Readonly<Record<TargetId, CompoundSetting>>;
        readonly articulations: ReadonlyArray<ArticulationView>;
        readonly articulationTriggerMode: ArticulationTriggerMode;
        readonly articulationOverrides: Readonly<Record<ArticulationId, Readonly<Record<TargetId, NormalizedValue>>>>;
        readonly articulationMappingAmounts: Readonly<Record<ArticulationId, Readonly<Record<MappingId, number>>>>;
    };
    readonly audition: AuditionState;
};

/** The engine's per-patch route capacity (compile-time constant, kept at 12). */
export const ROUTE_BUDGET = MODULATION_MAX_ROUTES;

/** Adding a mapping would exceed the engine's fixed route capacity. */
export class RouteBudgetExceeded extends Error {
    readonly _tag = "RouteBudgetExceeded" as const;

    constructor(readonly budget: number) {
        super(`Route budget of ${budget} is full`);
    }
}

/** The source is already mapped to that target (one mapping per pair). */
export class MappingAlreadyExists extends Error {
    readonly _tag = "MappingAlreadyExists" as const;

    constructor(readonly mappingId: MappingId) {
        super(`Mapping ${mappingId} already exists`);
    }
}

/** Every slot for the requested source type is occupied. */
export class SourceSlotsExhausted extends Error {
    readonly _tag = "SourceSlotsExhausted" as const;

    constructor(readonly sourceType: SourceType, readonly limit: number) {
        super(`All ${limit} ${sourceType} slots are in use`);
    }
}

/** All 128 articulation selectors are occupied. */
export class ArticulationSlotsExhausted extends Error {
    readonly _tag = "ArticulationSlotsExhausted" as const;

    constructor(readonly limit: number) {
        super(`All ${limit} articulation slots are in use`);
    }
}

/** Keyswitch walk outcome: where the key landed and what it touched. */
export type KeyWalkOutcome = {
    readonly key: number;
    readonly touching: boolean;
    readonly neighborId: ArticulationId | null;
};

/** Range-bound clamp outcome: where the bound landed and what it touched. */
export type RangeClampOutcome = {
    readonly value: number;
    readonly touching: boolean;
    readonly neighborId: ArticulationId | null;
};

/** Snapshot of one articulation's layer for transactional restore (worn ✕). */
export type ArticulationLayerBackup = {
    readonly overrides: Readonly<Record<TargetId, NormalizedValue>>;
    readonly mappingAmounts: Readonly<Record<MappingId, number>>;
};

/** MSEG slot index (three slots). */
export type MsegSlotIndex = 0 | 1 | 2;

/**
 * The full command surface. Synchronous; each call is one user-meaningful
 * mutation of the instrument.
 */
export type CosimoCommands = {
    // ── Parameters ────────────────────────────────────────────────────────
    setParameter(input: { targetId: TargetId; value: NormalizedValue; layer: EditLayer }): void;

    // ── Mappings ──────────────────────────────────────────────────────────
    addMapping(input: {
        targetId: TargetId;
        sourceId: SourceId;
        amount?: number;
        polarity?: MappingPolarity;
        reducer?: MappingReducer;
    }): Result<MappingId, RouteBudgetExceeded | MappingAlreadyExists>;
    removeMapping(mappingId: MappingId): void;
    setMappingAmount(mappingId: MappingId, amount: number, layer: EditLayer): void;
    setMappingEnabled(mappingId: MappingId, enabled: boolean): void;
    setMappingPolarity(mappingId: MappingId, polarity: MappingPolarity): void;
    setMappingReducer(mappingId: MappingId, reducer: MappingReducer): void;

    // ── Sources ───────────────────────────────────────────────────────────
    createSource(type: Exclude<SourceType, "fixed">): Result<SourceId, SourceSlotsExhausted>;
    deleteSource(sourceId: SourceId): void;
    undoDeleteSource(): void;
    setMacroValue(sourceId: SourceId, value: NormalizedValue): void;
    renameMacro(sourceId: SourceId, name: string): void;
    setEnvelope(sourceId: SourceId, envelope: ModulationEnvelope): void;

    // ── MSEG (backs MsegEditorControllerLike) ─────────────────────────────
    setMsegShape(input: { sourceId: SourceId; shapeIndex: 0 | 1; shape: MsegShape }): void;
    setMsegMorph(input: { sourceId: SourceId; morph: NormalizedValue; layer: EditLayer }): void;
    setMsegPlayback(input: { sourceId: SourceId; playback: MsegPlayback }): void;

    // ── Articulations (stored sparse per ADR-014) ─────────────────────────
    addArticulation(): Result<ArticulationId, ArticulationSlotsExhausted>;
    duplicateArticulation(articulationId: ArticulationId): Result<ArticulationId, ArticulationSlotsExhausted>;
    deleteArticulation(articulationId: ArticulationId): void;
    setArticulationKey(articulationId: ArticulationId, wantKey: number): KeyWalkOutcome;
    setArticulationRange(
        articulationId: ArticulationId,
        mode: Exclude<ArticulationTriggerMode, "key">,
        bound: "min" | "max",
        value: number,
    ): RangeClampOutcome;
    setArticulationTriggerMode(mode: ArticulationTriggerMode): void;
    clearArticulationOverride(targetId: TargetId, articulationId: ArticulationId): void;
    clearArticulationBaseOverride(targetId: TargetId, articulationId: ArticulationId): void;
    clearArticulationMappingAmount(mappingId: MappingId, articulationId: ArticulationId): void;
    restoreArticulationLayer(articulationId: ArticulationId, backup: ArticulationLayerBackup): void;

    // ── Effects rack ──────────────────────────────────────────────────────
    setEffectEnabled(effectId: EffectModuleId, enabled: boolean): void;
    reorderEffect(effectId: EffectModuleId, overEffectId: EffectModuleId): void;
    restoreEffectOrder(effectOrder: ReadonlyArray<EffectModuleId>): void;
    setCompoundSetting(targetId: TargetId, patch: { mode?: "Free" | "Sync"; division?: string }): void;

    // ── Audition & capture ────────────────────────────────────────────────
    setAuditionArticulation(articulationId: ArticulationId | "Default"): void;
    setAuditionNote(note: string): void;
    setRepeatEnabled(enabled: boolean): void;
    setLatchEnabled(enabled: boolean): void;
    beginTrigger(): void;
    endTrigger(): void;
    cancelTrigger(): void;
    /** Commit the retrospective capture; null when no candidate exists (normal). */
    captureMotion(): SourceId | null;

    // ── Session ───────────────────────────────────────────────────────────
    reset(): void;
};

/** The port: reads via external-store contract, writes via commands. */
export type CosimoAdapterPort = {
    /** Current snapshot — the same reference until a command changes state. */
    getSnapshot(): PatchSnapshot;
    /** Subscribe to snapshot changes; returns the unsubscribe function. */
    subscribe(onChange: () => void): () => void;
    readonly commands: CosimoCommands;
};
