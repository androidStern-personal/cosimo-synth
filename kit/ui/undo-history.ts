/** Immutable, bounded Undo/Redo bookkeeping independent of state, storage and UI. */
export class UndoHistory<Entry> {
    #past: readonly Entry[] = Object.freeze([]);
    #future: readonly Entry[] = Object.freeze([]);
    readonly #limit: number;
    readonly #compare: ((left: Entry, right: Entry) => number) | undefined;

    constructor(options: { readonly limit?: number; readonly compare?: (left: Entry, right: Entry) => number } = {}) {
        const limit = options.limit ?? 100;
        if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("History limit must be a non-negative integer.");
        this.#limit = limit;
        this.#compare = options.compare;
    }

    get undoEntry(): Entry | undefined { return this.#past[this.#past.length - 1]; }
    get redoEntry(): Entry | undefined { return this.#future[this.#future.length - 1]; }

    #next(past: readonly Entry[], future: readonly Entry[]): UndoHistory<Entry> {
        const next = new UndoHistory<Entry>({ limit: this.#limit, compare: this.#compare });
        next.#past = Object.freeze(this.#limit === 0 ? [] : past.slice(-this.#limit));
        next.#future = Object.freeze(this.#limit === 0 ? [] : future.slice(-this.#limit));
        return next;
    }

    /** Recording an accepted change invalidates Redo; optional ordering supports interleaved gestures. */
    record(entry: Entry): UndoHistory<Entry> {
        const past = [...this.#past, entry];
        if (this.#compare) past.sort(this.#compare);
        return this.#next(past, []);
    }

    /** Invalidate Redo at the first accepted edit in an unfinished group. */
    clearRedo(): UndoHistory<Entry> { return this.#future.length ? this.#next(this.#past, []) : this; }
    undo(): UndoHistory<Entry> {
        return this.#past.length === 0 ? this : this.#next(this.#past.slice(0, -1), [...this.#future, ...this.#past.slice(-1)]);
    }
    redo(): UndoHistory<Entry> {
        return this.#future.length === 0 ? this : this.#next([...this.#past, ...this.#future.slice(-1)], this.#future.slice(0, -1));
    }
    clear(): UndoHistory<Entry> { return this.#next([], []); }
}
