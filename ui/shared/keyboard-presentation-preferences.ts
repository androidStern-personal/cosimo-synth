/**
 * Application-level on-screen keyboard geometry preferences (T79).
 *
 * These values are UI presentation only. They deliberately live outside the
 * patch, preset, host, Init, URL-sharing, automation, and modulation models.
 */

/** A responsive default or one explicit MIDI-note span selected by the user. */
export type KeyboardVisibleNoteCountPreference = number | "responsive";

/** Durable presentation geometry for the on-screen keyboard. */
export type KeyboardPresentationPreferences = {
    readonly visibleNoteCount: KeyboardVisibleNoteCountPreference;
    readonly heightScale: number;
};

/** Narrowest supported span: one octave, including accidentals. */
export const KEYBOARD_VISIBLE_NOTE_COUNT_MIN = 12;

/** Widest supported span; the 320x568 composed proof fits all 30 notes even
    with 11px/13px horizontal safe-area insets and no document overflow. */
export const KEYBOARD_VISIBLE_NOTE_COUNT_MAX = 30;

/** Current height is the floor, preserving the paddles' 36x40px hit boxes. */
export const KEYBOARD_HEIGHT_SCALE_MIN = 1;

/** The 1.4x ceiling keeps positive, non-overlapping workspace in composed
    1120x680 plugin and 1440x900 desktop proofs. */
export const KEYBOARD_HEIGHT_SCALE_MAX = 1.4;

/** Existing compact-shell note span retained by the responsive default. */
export const KEYBOARD_COMPACT_DEFAULT_VISIBLE_NOTE_COUNT = 18;

/** Existing plugin/desktop note span retained by the responsive default. */
export const KEYBOARD_WIDE_DEFAULT_VISIBLE_NOTE_COUNT = 25;

/** Current compact/wide geometry remains the default until explicitly changed. */
export const KEYBOARD_PRESENTATION_DEFAULTS: KeyboardPresentationPreferences = {
    visibleNoteCount: "responsive",
    heightScale: 1,
};

/** Versioned application-preference key, separate from every sound codec. */
export const KEYBOARD_PRESENTATION_STORAGE_KEY = "cosimo.keyboard.presentation.preferences.v1";

type KeyboardPresentationPreferencePatch = {
    readonly visibleNoteCount?: KeyboardVisibleNoteCountPreference;
    readonly heightScale?: number;
};

type Listener = () => void;

function clampFixedVisibleNoteCount(value: number): number {
    return Math.min(
        KEYBOARD_VISIBLE_NOTE_COUNT_MAX,
        Math.max(KEYBOARD_VISIBLE_NOTE_COUNT_MIN, Math.round(value)),
    );
}

function clampVisibleNoteCount(value: unknown): KeyboardVisibleNoteCountPreference {
    if (value === "responsive") {
        return value;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return KEYBOARD_PRESENTATION_DEFAULTS.visibleNoteCount;
    }
    return clampFixedVisibleNoteCount(value);
}

function clampHeightScale(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return KEYBOARD_PRESENTATION_DEFAULTS.heightScale;
    }
    return Math.min(
        KEYBOARD_HEIGHT_SCALE_MAX,
        Math.max(KEYBOARD_HEIGHT_SCALE_MIN, value),
    );
}

/** Serialize one complete keyboard-preference record for application storage. */
export function serializeKeyboardPresentationPreferences(
    preferences: KeyboardPresentationPreferences,
): string {
    return JSON.stringify({
        version: 1,
        visibleNoteCount: clampVisibleNoteCount(preferences.visibleNoteCount),
        heightScale: clampHeightScale(preferences.heightScale),
    });
}

/**
 * Parse stored keyboard presentation state. Malformed fields fall back
 * independently, while malformed records are rejected as a whole.
 */
export function parseStoredKeyboardPresentationPreferences(
    raw: string | null,
): KeyboardPresentationPreferences | null {
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
    // each persisted field remains unknown until its owning parser refines it.
    const candidate = parsed as Readonly<Record<string, unknown>>;
    return {
        visibleNoteCount: candidate.visibleNoteCount === undefined
            ? KEYBOARD_PRESENTATION_DEFAULTS.visibleNoteCount
            : clampVisibleNoteCount(candidate.visibleNoteCount),
        heightScale: candidate.heightScale === undefined
            ? KEYBOARD_PRESENTATION_DEFAULTS.heightScale
            : clampHeightScale(candidate.heightScale),
    };
}

/** Resolve the live note span while preserving each layout's current default. */
export function resolveKeyboardVisibleNoteCount(
    preferences: KeyboardPresentationPreferences,
    responsiveDefault: number,
): number {
    const selected = preferences.visibleNoteCount === "responsive"
        ? responsiveDefault
        : preferences.visibleNoteCount;
    return clampFixedVisibleNoteCount(selected);
}

function readInitialState(): KeyboardPresentationPreferences {
    if (typeof localStorage === "undefined") {
        return KEYBOARD_PRESENTATION_DEFAULTS;
    }

    try {
        return parseStoredKeyboardPresentationPreferences(
            localStorage.getItem(KEYBOARD_PRESENTATION_STORAGE_KEY),
        ) ?? KEYBOARD_PRESENTATION_DEFAULTS;
    } catch {
        return KEYBOARD_PRESENTATION_DEFAULTS;
    }
}

const listeners = new Set<Listener>();
let state = readInitialState();

function persist(): void {
    try {
        localStorage.setItem(
            KEYBOARD_PRESENTATION_STORAGE_KEY,
            serializeKeyboardPresentationPreferences(state),
        );
    } catch {
        // Storage is best effort; the live preference remains authoritative.
    }
}

/** Read the current on-screen keyboard presentation preference snapshot. */
export function getKeyboardPresentationPreferences(): KeyboardPresentationPreferences {
    return state;
}

/** Subscribe to live on-screen keyboard presentation preference changes. */
export function subscribeKeyboardPresentationPreferences(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Apply, bound, persist, and publish one keyboard presentation patch. */
export function updateKeyboardPresentationPreferences(
    patch: KeyboardPresentationPreferencePatch,
): void {
    state = {
        visibleNoteCount: patch.visibleNoteCount === undefined
            ? state.visibleNoteCount
            : clampVisibleNoteCount(patch.visibleNoteCount),
        heightScale: patch.heightScale === undefined
            ? state.heightScale
            : clampHeightScale(patch.heightScale),
    };
    persist();
    for (const listener of listeners) {
        listener();
    }
}

/** Restore responsive note span and the current keyboard height. */
export function resetKeyboardPresentationPreferences(): void {
    updateKeyboardPresentationPreferences(KEYBOARD_PRESENTATION_DEFAULTS);
}
