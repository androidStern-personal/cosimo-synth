import type {
    BounceBankStoreEntry,
    BounceBankStoreUsage,
} from "./browser-bank-store.mjs";

/** Minimum persistence seam needed by conservative bank retirement. */
export type BounceBankRetirementStore = {
    list(): Promise<ReadonlyArray<BounceBankStoreEntry>>;
    delete(digest: string): Promise<boolean>;
    usage(): Promise<BounceBankStoreUsage>;
};

/** Complete set of known bank roots and reasons a scan was incomplete. */
export type BounceBankRetentionRoots = {
    readonly complete: boolean;
    readonly digests: ReadonlyArray<string>;
    readonly incompleteReasons: ReadonlyArray<string>;
};

/** Observable result of a conservative retirement attempt. */
export type BounceBankRetirementResult = {
    readonly completed: boolean;
    readonly reason: string | null;
    readonly retainedDigests: ReadonlyArray<string>;
    readonly deletedDigests: ReadonlyArray<string>;
    readonly before: BounceBankStoreUsage | null;
    readonly after: BounceBankStoreUsage | null;
};

/** Web Lock name serializing browser bank garbage collection. */
export const BOUNCE_BANK_GC_LOCK_NAME: "cosimo-bounce-bank-gc-v1";

/** Compute all bank digests rooted by the live patch and in-flight state saves. */
export function collectBounceBankRetentionRoots(options: {
    readonly livePatchDocument: unknown;
    readonly inFlightPatchDocuments?: ReadonlyArray<unknown>;
}): BounceBankRetentionRoots;

/** Delete only proven-unreachable banks from an overwritten DSP slot. */
export function retireSupersededBounceBanks(options: {
    readonly store: BounceBankRetirementStore;
    readonly candidateDigests?: ReadonlyArray<string>;
    readonly dspOverwrittenDigests?: ReadonlyArray<string>;
    readonly lockManager?: LockManager;
    readonly livePatchDocument: unknown;
    readonly inFlightPatchDocuments?: ReadonlyArray<unknown>;
}): Promise<BounceBankRetirementResult>;
