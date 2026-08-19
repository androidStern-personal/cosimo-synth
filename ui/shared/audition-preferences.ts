/**
 * The durable Auto-preview preference (T12): a global setting shared across
 * synth sessions, deliberately outside preset/patch state. Stored alongside
 * the Mod rail's dock in localStorage; these helpers own only the codec so the
 * storage call sites stay one line each.
 */

export const AUTO_PREVIEW_ENABLED_STORAGE_KEY = "cosimo.auto-preview.enabled.v1";

export function serializeAutoPreviewEnabled(enabled: boolean): string {
    return JSON.stringify({ version: 1, enabled });
}

/** Stored state is external input: anything unreadable yields null (default off). */
export function parseStoredAutoPreviewEnabled(raw: string | null): boolean | null {
    if (raw === null) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (typeof parsed !== "object" || parsed === null) {
        return null;
    }

    const enabled = (parsed as { enabled?: unknown }).enabled;
    return typeof enabled === "boolean" ? enabled : null;
}
