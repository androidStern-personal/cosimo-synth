/**
 * Owns browser audio interruption state without reconnecting the audio graph.
 *
 * The module exists only after audio has started, so `active` is its initial
 * state. Browser-specific events are deliberately collapsed to `leave`,
 * `returnToPage`, and `retryFromGesture` at this interface.
 */
export function createBrowserAudioLifecycle({
    context,
    canRecover,
    onLeave,
    onRecovered = () => {},
}) {
    let phase = "active";
    let revision = 0;
    let attemptCount = 0;
    let lastFailure = null;
    let lastReason = "started";

    const describeFailure = (error) => (
        error instanceof Error ? error.name : String(error)
    );

    const finishFailure = (recoveryRevision, error) => {
        if (phase !== "recovering" || revision !== recoveryRevision) return;
        phase = "blocked";
        lastFailure = describeFailure(error);
    };

    const recover = (reason) => {
        if (!canRecover()) {
            return false;
        }

        const recoveryRevision = ++revision;
        phase = "recovering";
        attemptCount += 1;
        lastFailure = null;
        lastReason = reason;

        let suspendPromise;
        let resumePromise;
        try {
            // Both calls are issued in the same event turn. This preserves a
            // trusted gesture for resume while still creating WebKit's required
            // stop/start edge when the public state incorrectly says running.
            suspendPromise = context.suspend();
            resumePromise = context.resume();
        } catch (error) {
            finishFailure(recoveryRevision, error);
            return true;
        }

        void Promise.all([suspendPromise, resumePromise]).then(() => {
            if (phase === "recovering" && revision === recoveryRevision) {
                phase = "active";
                onRecovered(reason);
            }
        }, (error) => finishFailure(recoveryRevision, error));
        return true;
    };

    const leave = (reason) => {
        if (phase === "away") {
            // Input may have been acquired while recovery was ineligible.
            // Re-run the idempotent panic without creating another transition.
            onLeave(reason);
            return false;
        }

        revision += 1;
        phase = "away";
        lastFailure = null;
        lastReason = reason;
        onLeave(reason);
        return true;
    };

    return {
        getSnapshot: () => ({
            attemptCount,
            lastFailure,
            lastReason,
            phase,
            revision,
        }),
        leave,
        retryFromGesture: (reason) => (
            phase === "active" ? false : recover(reason)
        ),
        returnToPage: (reason) => (
            phase === "away" ? recover(reason) : false
        ),
    };
}
