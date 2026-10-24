/**
 * Demand-driven analyzer activation. Analyzer and read-only visualization
 * endpoints only capture and emit while a surface observes them (the int32
 * *Activity event inputs on graph WavetableSynth). This module owns the UI
 * half of that contract: a per-connection reference count for each endpoint,
 * publishing one activity event on every open/closed transition.
 *
 * The ordinary, latest-frame, and folded endpoint hooks call acquire/release
 * around their listeners, so every observer shares one DSP activity lease and
 * the final observer closing reliably returns the visualization to dormancy.
 */

import type { PatchConnectionLike } from "./cmajor-react";

/** Analyzer event endpoint -> its int32 activity endpoint on the graph. */
export const ANALYZER_ACTIVITY_ENDPOINT_IDS: Readonly<Record<string, string>> = {
    filterSpectrum: "filterSpectrumActivity",
    distortionScope: "distortionScopeActivity",
    distortionHistory: "distortionHistoryActivity",
    voiceEnhancerSpectrum: "voiceEnhancerSpectrumActivity",
};

type AnalyzerCounts = Map<string, number>;

const countsByConnection = new WeakMap<PatchConnectionLike, AnalyzerCounts>();

function publishActivity(
    connection: PatchConnectionLike,
    endpointID: string,
    counts: AnalyzerCounts,
): void {
    connection.sendEventOrValue?.(
        ANALYZER_ACTIVITY_ENDPOINT_IDS[endpointID],
        (counts.get(endpointID) ?? 0) > 0 ? 1 : 0,
    );
}

/**
 * Marks one observer of `endpointID` active on `connection`. Returns a
 * release function, or null when the endpoint is not an analyzer endpoint
 * (the common case; callers need no analyzer awareness).
 */
export function acquireAnalyzerActivity(
    connection: PatchConnectionLike,
    endpointID: string,
): (() => void) | null {
    if (!(endpointID in ANALYZER_ACTIVITY_ENDPOINT_IDS)) {
        return null;
    }

    let counts = countsByConnection.get(connection);
    if (!counts) {
        counts = new Map();
        countsByConnection.set(connection, counts);
    }
    const nextCount = (counts.get(endpointID) ?? 0) + 1;
    counts.set(endpointID, nextCount);
    if (nextCount === 1) {
        publishActivity(connection, endpointID, counts);
    }

    let released = false;
    return () => {
        if (released) {
            return;
        }
        released = true;
        const releasedCount = Math.max(0, (counts.get(endpointID) ?? 0) - 1);
        counts.set(endpointID, releasedCount);
        if (releasedCount === 0) {
            publishActivity(connection, endpointID, counts);
        }
    };
}
