/**
 * The user-edit bus (T12): the single stream of direct user parameter edits.
 *
 * Exactly two seams publish here — usePatchParameter's write path (all scalar
 * engine parameters) and the modulation runtime bridge (route amounts and MSEG
 * shapes). Preset loads, DAW/host restore, engine echo, and undo enter the app
 * around both seams by construction, so anything on this bus is a direct user
 * edit — with one exception, articulation snapshot application, which writes
 * through scalar bindings and must wrap itself in a programmatic-writes block.
 */

export type UserParameterEdit = {
    readonly endpointID: string;
    /** Whether the canonical value actually changed (post-coercion). */
    readonly changed: boolean;
};

type UserEditListener = {
    readonly onParameterEdit?: (edit: UserParameterEdit) => void;
    readonly onGestureStart?: () => void;
    readonly onGestureEnd?: () => void;
};

const listeners = new Set<UserEditListener>();
let programmaticWriteDepth = 0;

export function subscribeToUserEdits(listener: UserEditListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function reportUserParameterEdit(edit: UserParameterEdit): void {
    if (programmaticWriteDepth > 0) {
        return;
    }
    for (const listener of listeners) {
        listener.onParameterEdit?.(edit);
    }
}

export function reportUserGestureStart(): void {
    if (programmaticWriteDepth > 0) {
        return;
    }
    for (const listener of listeners) {
        listener.onGestureStart?.();
    }
}

export function reportUserGestureEnd(): void {
    if (programmaticWriteDepth > 0) {
        return;
    }
    for (const listener of listeners) {
        listener.onGestureEnd?.();
    }
}

/**
 * Suppress bus traffic for a synchronous programmatic write batch (e.g.
 * applying an articulation snapshot through scalar bindings). Nesting is
 * supported; the batch must be synchronous.
 */
export function runProgrammaticWrites<T>(write: () => T): T {
    programmaticWriteDepth += 1;
    try {
        return write();
    } finally {
        programmaticWriteDepth -= 1;
    }
}
