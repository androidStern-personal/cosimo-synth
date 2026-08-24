/**
 * DEPRECATED (capture media-time controller): superseded by the live-performance render path in
 * ui/speedrun/live/ (see VIDEO_BOUNCE_LIVE_RENDER_PLAN.md). Kept only as the
 * VITE_COSIMO_VIDEO_BOUNCE_SCRIPTED=1 escape hatch until the live render is
 * accepted; scheduled for deletion with its suites afterwards.
 */
import {
    installUiMediaClock,
    type UiMediaClock,
} from "../../shared/ui-media-clock";
import {
    installUiTimeoutDriver,
    type UiTimeoutDriver,
} from "../../shared/ui-timers";

type ScheduledTimeout = {
    readonly handle: number;
    readonly dueAtMilliseconds: number;
    readonly callback: () => void;
};

/**
 * Media-time authority for product-only timer and smoother seams in the
 * scripted iframe. It deliberately does not touch window timers or rAF.
 */
export class ScriptedCaptureTimeController implements UiTimeoutDriver, UiMediaClock {
    private readonly timeouts = new Map<number, ScheduledTimeout>();
    private readonly animationFrames = new Map<number, (timestamp: number) => void>();
    private mediaTimeMilliseconds = 0;
    private nextTimeoutHandle = -1;
    // Negative like driven timeout handles, so a native rAF handle canceled
    // while this clock is installed can never collide with a driven one.
    private nextAnimationFrameHandle = -1;

    now(): number {
        return this.mediaTimeMilliseconds;
    }

    setMediaTime(frame: number, fps: number): void {
        this.mediaTimeMilliseconds = (Math.max(0, frame) * 1_000) / fps;
    }

    setTimeout(callback: () => void, delayMilliseconds: number): number {
        const handle = this.nextTimeoutHandle;
        this.nextTimeoutHandle -= 1;
        this.timeouts.set(handle, {
            handle,
            dueAtMilliseconds: this.mediaTimeMilliseconds
                + Math.max(0, Number.isFinite(delayMilliseconds) ? delayMilliseconds : 0),
            callback,
        });
        return handle;
    }

    clearTimeout(handle: number): boolean {
        if (handle >= 0) return false;
        this.timeouts.delete(handle);
        return true;
    }

    requestAnimationFrame(callback: (timestamp: number) => void): number {
        const handle = this.nextAnimationFrameHandle;
        this.nextAnimationFrameHandle -= 1;
        this.animationFrames.set(handle, callback);
        return handle;
    }

    cancelAnimationFrame(handle: number): boolean {
        if (handle >= 0) return false;
        this.animationFrames.delete(handle);
        return true;
    }

    flushDueTimeouts(): void {
        let callbacksRun = 0;
        while (true) {
            const due = [...this.timeouts.values()]
                .filter(({ dueAtMilliseconds }) => dueAtMilliseconds <= this.mediaTimeMilliseconds)
                .sort((left, right) => (
                    left.dueAtMilliseconds - right.dueAtMilliseconds
                    || right.handle - left.handle
                ))[0];
            if (!due) return;
            this.timeouts.delete(due.handle);
            due.callback();
            callbacksRun += 1;
            if (callbacksRun > 10_000) {
                throw new Error("Scripted UI timeout flush exceeded 10,000 callbacks at one frame.");
            }
        }
    }

    flushAnimationFrames(): void {
        // Handles count downward, so scheduling order is descending numeric.
        const callbacks = [...this.animationFrames.entries()]
            .sort(([left], [right]) => right - left);
        this.animationFrames.clear();
        for (const [, callback] of callbacks) callback(this.mediaTimeMilliseconds);
    }

    install(): () => void {
        const restoreTimeouts = installUiTimeoutDriver(this);
        const restoreMediaClock = installUiMediaClock(this);
        const previous = activeCaptureTimeController;
        activeCaptureTimeController = this;
        let restored = false;
        return () => {
            if (restored) return;
            restored = true;
            if (activeCaptureTimeController === this) {
                activeCaptureTimeController = previous;
            }
            restoreMediaClock();
            restoreTimeouts();
        };
    }
}

let activeCaptureTimeController: ScriptedCaptureTimeController | null = null;

export function requireScriptedCaptureTimeController(): ScriptedCaptureTimeController {
    if (activeCaptureTimeController === null) {
        throw new Error("The scripted capture media-time controller is not installed.");
    }
    return activeCaptureTimeController;
}
