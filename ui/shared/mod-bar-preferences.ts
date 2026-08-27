/**
 * Application-level Mod bar presentation preferences (T60).
 *
 * These values deliberately live outside patch, preset, articulation, and
 * host state. The store is available in every UI build because floating-edge
 * moves and parked hide/restore remain user preferences even when the
 * developer-only tuning page is absent.
 */

import { MOBILE_MOD_RAIL_SCALE, parseStoredRailDock } from "./mod-rail-perimeter";

/** The three product-approved placements. */
export type ModBarPlacement = "floating-left" | "floating-right" | "parked";

/** Whether a parked row occupies its one fixed row or exposes only restore. */
export type ParkedModBarVisibility = "visible" | "hidden";

/** Durable presentation state for the global Mod bar. */
export type ModBarPreferences = {
    readonly scale: number;
    readonly placement: ModBarPlacement;
    readonly parkedVisibility: ParkedModBarVisibility;
};

/** T42's current coherent enlargement is T60's initial live value. */
export const MOD_BAR_DEFAULT_SCALE = MOBILE_MOD_RAIL_SCALE;

/** Proposed live tuning floor from the settled T60 contract. */
export const MOD_BAR_MIN_SCALE = 0.85;

/** Proposed live tuning ceiling from the settled T60 contract. */
export const MOD_BAR_MAX_SCALE = 1.3;

/** The application preference used when no stored choice exists. */
export const MOD_BAR_PREFERENCE_DEFAULTS: ModBarPreferences = {
    scale: MOD_BAR_DEFAULT_SCALE,
    placement: "floating-right",
    parkedVisibility: "visible",
};

/** Versioned application-preference key, separate from every sound codec. */
export const MOD_BAR_PREFERENCES_STORAGE_KEY = "cosimo.mod-bar.preferences.v1";

/** Legacy floating dock key, read once as a left/right placement fallback. */
export const LEGACY_MOD_RAIL_POSITION_STORAGE_KEY = "cosimo.mobile-global-mod-rail.position.v1";

const PLACEMENTS: ReadonlyArray<ModBarPlacement> = ["floating-left", "floating-right", "parked"];
const PARKED_VISIBILITIES: ReadonlyArray<ParkedModBarVisibility> = ["visible", "hidden"];

type ModBarPreferencePatch = {
    readonly scale?: number;
    readonly placement?: ModBarPlacement;
    readonly parkedVisibility?: ParkedModBarVisibility;
};

type Listener = () => void;

function clampScale(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return MOD_BAR_PREFERENCE_DEFAULTS.scale;
    }
    return Math.min(MOD_BAR_MAX_SCALE, Math.max(MOD_BAR_MIN_SCALE, value));
}

function isPlacement(value: unknown): value is ModBarPlacement {
    return typeof value === "string" && PLACEMENTS.some((placement) => placement === value);
}

function isParkedVisibility(value: unknown): value is ParkedModBarVisibility {
    return typeof value === "string"
        && PARKED_VISIBILITIES.some((visibility) => visibility === value);
}

/** Serialize one complete preference record for application storage. */
export function serializeModBarPreferences(preferences: ModBarPreferences): string {
    return JSON.stringify({
        version: 1,
        scale: clampScale(preferences.scale),
        placement: preferences.placement,
        parkedVisibility: preferences.parkedVisibility,
    });
}

/**
 * Parse stored application state. Unknown or malformed fields fall back
 * independently, so a future field cannot erase a valid placement or scale.
 */
export function parseStoredModBarPreferences(
    raw: string | null,
    defaults: ModBarPreferences = MOD_BAR_PREFERENCE_DEFAULTS,
): ModBarPreferences | null {
    if (raw === null) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return null;
    }

    // SAFETY: the object check above establishes a property-readable record;
    // every value remains unknown until the concrete field parser refines it.
    const candidate = parsed as Readonly<Record<string, unknown>>;
    return {
        scale: candidate.scale === undefined ? defaults.scale : clampScale(candidate.scale),
        placement: isPlacement(candidate.placement) ? candidate.placement : defaults.placement,
        parkedVisibility: isParkedVisibility(candidate.parkedVisibility)
            ? candidate.parkedVisibility
            : defaults.parkedVisibility,
    };
}

function legacyPlacement(rawDock: string | null): ModBarPlacement {
    const dock = parseStoredRailDock(rawDock);
    return dock?.edge === "left" ? "floating-left" : "floating-right";
}

function readInitialState(): ModBarPreferences {
    if (typeof localStorage === "undefined") {
        return MOD_BAR_PREFERENCE_DEFAULTS;
    }

    try {
        const defaults = {
            ...MOD_BAR_PREFERENCE_DEFAULTS,
            placement: legacyPlacement(localStorage.getItem(LEGACY_MOD_RAIL_POSITION_STORAGE_KEY)),
        } satisfies ModBarPreferences;
        return parseStoredModBarPreferences(
            localStorage.getItem(MOD_BAR_PREFERENCES_STORAGE_KEY),
            defaults,
        ) ?? defaults;
    } catch {
        return MOD_BAR_PREFERENCE_DEFAULTS;
    }
}

const listeners = new Set<Listener>();
let state = readInitialState();

function persist(): void {
    try {
        localStorage.setItem(MOD_BAR_PREFERENCES_STORAGE_KEY, serializeModBarPreferences(state));
    } catch {
        // Storage is best effort; the live preference remains authoritative.
    }
}

/** Read the current application preference snapshot. */
export function getModBarPreferences(): ModBarPreferences {
    return state;
}

/** Subscribe to live application-preference changes. */
export function subscribeModBarPreferences(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Apply a named preference patch, clamp it, persist it, and notify the UI. */
export function updateModBarPreferences(patch: ModBarPreferencePatch): void {
    const next = {
        scale: patch.scale ?? state.scale,
        placement: patch.placement ?? state.placement,
        parkedVisibility: patch.parkedVisibility ?? state.parkedVisibility,
    } satisfies ModBarPreferences;
    state = {
        scale: clampScale(next.scale),
        placement: next.placement,
        parkedVisibility: next.parkedVisibility,
    };
    persist();
    for (const listener of listeners) {
        listener();
    }
}

/** Restore the T60 starting point without touching sound state. */
export function resetModBarPreferences(): void {
    updateModBarPreferences(MOD_BAR_PREFERENCE_DEFAULTS);
}
