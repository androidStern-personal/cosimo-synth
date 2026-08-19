/**
 * The persistent Voice/FX/Mod workspace shell's navigation model (ADR-026,
 * T03B) — pure state, no React.
 *
 * Each workspace keeps its own detail page and Back origin; switching tabs
 * never destroys either. Tapping the active tab returns a detailed workspace
 * to its main screen (ending its return path) or, already on main, requests a
 * scroll to top. A deep link opens the exact destination with a Back path to
 * the originating tab; universal Back follows the ACTIVE workspace's stored
 * path and ends it. Navigation state is plugin-instance presentation state —
 * serialized here, stored by the shell owner, never in presets or DAW sound
 * state.
 */

export type WorkspaceTabId = "voice" | "fx" | "mod";

export const WORKSPACE_TAB_IDS: ReadonlyArray<WorkspaceTabId> = ["voice", "fx", "mod"];

/** Session-scoped presentation-state key (a fresh process starts at Home). */
export const WORKSPACE_SHELL_STORAGE_KEY = "cosimo.workspace-shell.v1";

export type WorkspaceDetailState = {
    /** Workspace-specific destination (opaque to the shell). */
    readonly detail: string;
    /** The tab universal Back returns to when this detail is active. */
    readonly returnTo: WorkspaceTabId;
};

export type WorkspaceShellState = {
    readonly activeTab: WorkspaceTabId;
    readonly details: Readonly<Record<WorkspaceTabId, WorkspaceDetailState | null>>;
};

export type ActiveTabTapResult = {
    readonly state: WorkspaceShellState;
    readonly effect: "returned-to-main" | "scroll-to-top";
};

const SHELL_STATE_VERSION = 1;

function isWorkspaceTabId(value: unknown): value is WorkspaceTabId {
    return value === "voice" || value === "fx" || value === "mod";
}

/** Home is the main Voice screen (new plugin instances and fresh launches). */
export function createHomeShellState(): WorkspaceShellState {
    return {
        activeTab: "voice",
        details: { voice: null, fx: null, mod: null },
    };
}

export function activateTab(state: WorkspaceShellState, tab: WorkspaceTabId): WorkspaceShellState {
    if (tab === state.activeTab) {
        return state;
    }
    return { ...state, activeTab: tab };
}

/** Enter a detail page within a workspace; Back returns to that same tab. */
export function enterDetail(
    state: WorkspaceShellState,
    tab: WorkspaceTabId,
    detail: string,
): WorkspaceShellState {
    return {
        activeTab: tab,
        details: { ...state.details, [tab]: { detail, returnTo: tab } },
    };
}

export function openDeepLink(
    state: WorkspaceShellState,
    link: { readonly tab: WorkspaceTabId; readonly detail: string; readonly from: WorkspaceTabId },
): WorkspaceShellState {
    return {
        activeTab: link.tab,
        details: { ...state.details, [link.tab]: { detail: link.detail, returnTo: link.from } },
    };
}

export function tapActiveTab(state: WorkspaceShellState): ActiveTabTapResult {
    const activeDetail = state.details[state.activeTab];
    if (activeDetail !== null) {
        return {
            state: {
                ...state,
                details: { ...state.details, [state.activeTab]: null },
            },
            effect: "returned-to-main",
        };
    }
    return { state, effect: "scroll-to-top" };
}

/** The tab universal Back would go to, or null when the active workspace has no path. */
export function universalBackTarget(state: WorkspaceShellState): WorkspaceTabId | null {
    return state.details[state.activeTab]?.returnTo ?? null;
}

export function universalBack(state: WorkspaceShellState): WorkspaceShellState {
    const activeDetail = state.details[state.activeTab];
    if (activeDetail === null) {
        return state;
    }
    return {
        activeTab: activeDetail.returnTo,
        details: { ...state.details, [state.activeTab]: null },
    };
}

export function serializeShellState(state: WorkspaceShellState): string {
    return JSON.stringify({ version: SHELL_STATE_VERSION, ...state });
}

function parseDetailState(value: unknown): WorkspaceDetailState | null | undefined {
    if (value === null) {
        return null;
    }
    if (typeof value !== "object") {
        return undefined;
    }
    const candidate = value as { detail?: unknown; returnTo?: unknown };
    if (typeof candidate.detail !== "string" || !isWorkspaceTabId(candidate.returnTo)) {
        return undefined;
    }
    return { detail: candidate.detail, returnTo: candidate.returnTo };
}

/** Stored state is external input: anything unreadable yields null (start at Home). */
export function parseStoredShellState(raw: string | null): WorkspaceShellState | null {
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
    const candidate = parsed as { version?: unknown; activeTab?: unknown; details?: unknown };
    if (candidate.version !== SHELL_STATE_VERSION || !isWorkspaceTabId(candidate.activeTab)) {
        return null;
    }
    if (typeof candidate.details !== "object" || candidate.details === null) {
        return null;
    }

    const details: Partial<Record<WorkspaceTabId, WorkspaceDetailState | null>> = {};
    for (const tab of WORKSPACE_TAB_IDS) {
        const detail = parseDetailState((candidate.details as Record<string, unknown>)[tab]);
        if (detail === undefined) {
            return null;
        }
        details[tab] = detail;
    }

    return {
        activeTab: candidate.activeTab,
        details: details as Record<WorkspaceTabId, WorkspaceDetailState | null>,
    };
}
