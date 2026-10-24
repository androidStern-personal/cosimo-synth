import type { EngineCancellation } from "./plugin-state-engine";

/** One idempotent cleanup owner. Child scopes end without closing their parents. */
export function createStateLifetime(...parents: readonly EngineCancellation[]) {
    let aborted = false;
    const listeners = new Set<() => void>();
    const detach = new Set<() => void>();
    const signal: EngineCancellation = {
        get aborted() { return aborted; },
        onAbort(listener) {
            if (aborted) listener(); else listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
    function cancel() {
        if (aborted) return;
        aborted = true;
        for (const remove of detach) remove();
        detach.clear();
        const pending = [...listeners];
        listeners.clear();
        for (const listener of pending) listener();
    }
    for (const parent of parents) {
        const remove = parent.onAbort(cancel);
        if (aborted) remove(); else detach.add(remove);
    }
    return { signal, cancel };
}
