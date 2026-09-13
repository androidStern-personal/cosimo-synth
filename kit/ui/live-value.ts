/** A retained, read-only value from an engine adapter or another store. @template T Snapshot type. */
export type LiveValue<T> = {
    readonly getSnapshot: () => T;
    readonly subscribe: (onChange: () => void) => () => void;
};

/** null hides an indicator. Numbers are canonical units, not dial coordinates. */
export type LiveNumber = number | null | LiveValue<number | null>;

type FrameWork = (timestamp: number) => boolean;
class FrameDriver {
    private readonly work = new Set<FrameWork>();
    private frame: number | null = null;
    constructor(private readonly view: Window) {}
    request(work: FrameWork) {
        this.work.add(work);
        this.schedule();
    }
    remove(work: FrameWork) {
        this.work.delete(work);
        if (!this.work.size && this.frame !== null) {
            this.view.cancelAnimationFrame(this.frame);
            this.frame = null;
        }
    }
    private schedule() {
        if (this.frame !== null || !this.work.size) return;
        this.frame = this.view.requestAnimationFrame(time => {
            this.frame = null;
            for (const work of this.work) if (!work(time)) this.work.delete(work);
            this.schedule();
        });
    }
}

// Realm-scoped scheduling is internal; importing this module starts no work.
const drivers = new WeakMap<Window, FrameDriver>();

/** Internal DOM adapter: subscribe, smooth projected values, and release every owned resource. */
export function animateLiveNumber(view: Window, source: LiveNumber, project: (value: number) => number,
    smoothingMs: number, apply: (position: number | null) => void): () => void {
    let driver = drivers.get(view);
    if (!driver) { driver = new FrameDriver(view); drivers.set(view, driver); }
    const scheduler = driver;
    let target: number | null = null, displayed: number | null = null, previousTime: number | null = null;
    let disposed = false;
    const frame = (time: number) => {
        if (disposed) return false;
        if (target === null) { displayed = null; previousTime = null; apply(null); return false; }
        if (displayed === null || smoothingMs <= 0) displayed = target;
        else {
            const elapsed = previousTime === null ? 1000 / 60 : Math.min(100, time - previousTime);
            displayed += (target - displayed) * (1 - Math.exp(-elapsed / smoothingMs));
        }
        previousTime = time;
        const settling = Math.abs(target - displayed) > 0.00005;
        if (!settling) { displayed = target; previousTime = null; }
        apply(displayed);
        return settling;
    };
    const update = () => {
        if (disposed) return;
        const value = typeof source === "object" && source !== null ? source.getSnapshot() : source;
        const position = value !== null && Number.isFinite(value) ? project(value) : null;
        target = position !== null && Number.isFinite(position) ? position : null;
        // A brief inactive report still breaks continuity if another report arrives this frame.
        if (target === null) displayed = null;
        scheduler.request(frame);
    };
    const unsubscribe = typeof source === "object" && source !== null ? source.subscribe(update) : () => {};
    update();
    return () => { disposed = true; unsubscribe(); scheduler.remove(frame); };
}
