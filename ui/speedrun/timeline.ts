import type { SpeedrunRecipe, SpeedrunSection, UIOp } from "./recipe";

export const SPEEDRUN_FPS = 30 as const;
export const SPEEDRUN_SAMPLE_RATE = 48_000 as const;
export const SPEEDRUN_SAMPLES_PER_FRAME = 1_600 as const;
export const SPEEDRUN_MAX_DURATION_IN_FRAMES = 2_700 as const;

export type SpeedrunPacing = {
    readonly leadIn: number;
    readonly captionStagger: number;
    readonly navigate: number;
    readonly setParam: number;
    readonly selectWavetable: number;
    readonly toggleEffect: number;
    readonly mapRoute: number;
    readonly configureMseg: number;
    readonly setSource: number;
    readonly rapid: number;
    readonly tail: number;
    readonly sectionMinimum: number;
};

export type SpeedrunTimelineConfig = {
    readonly maxDurationInFrames?: number;
    readonly pacing?: Partial<SpeedrunPacing>;
};

export type TimedOp = {
    readonly op: UIOp;
    readonly startFrame: number;
    readonly endFrame: number;
};

export type TimedSection = {
    readonly section: SpeedrunSection;
    readonly startFrame: number;
    readonly endFrame: number;
    readonly startSample: number;
    readonly endSample: number;
    readonly captionEvents: ReadonlyArray<{ readonly line: number; readonly atFrame: number }>;
    readonly opSpans: ReadonlyArray<TimedOp>;
    readonly checkpointIndex: number;
};

export type SpeedrunTimeline = {
    readonly fps: typeof SPEEDRUN_FPS;
    readonly sampleRate: typeof SPEEDRUN_SAMPLE_RATE;
    readonly samplesPerFrame: typeof SPEEDRUN_SAMPLES_PER_FRAME;
    readonly durationInFrames: number;
    readonly compressionLevel: 0 | 1 | 2 | 3;
    readonly sections: ReadonlyArray<TimedSection>;
};

/**
 * Perception-scale pacing (30 fps frames). Each value is the smallest span in
 * which a viewer can actually see the action happen: approach, motion, and a
 * beat to register the result. Duration is an OUTPUT of the recipe under this
 * table — the video is as long as the build needs. There is deliberately no
 * "compression ladder" shrinking these below perception; an explicit caller
 * ceiling is honored only by uniform time-scaling as a last-resort backstop.
 */
const DEFAULT_PACING: SpeedrunPacing = {
    leadIn: 24,
    captionStagger: 12,
    navigate: 30,
    setParam: 42,
    selectWavetable: 54,
    toggleEffect: 24,
    mapRoute: 66,
    configureMseg: 72,
    setSource: 48,
    rapid: 12,
    tail: 24,
    sectionMinimum: 105,
};

function integer(value: number, minimum = 0): number {
    return Math.max(minimum, Math.round(value));
}

function normalizedPacing(config: SpeedrunTimelineConfig): SpeedrunPacing {
    const overrides = config.pacing ?? {};
    return Object.fromEntries(Object.entries(DEFAULT_PACING).map(([key, value]) => [
        key,
        integer(overrides[key as keyof SpeedrunPacing] ?? value, 1),
    ])) as SpeedrunPacing;
}

function opDuration(op: UIOp, pacing: SpeedrunPacing): number {
    switch (op.kind) {
        case "installLaneBaseline":
        case "installModulationBaseline":
            return 0;
        case "navigate": return pacing.navigate;
        case "setParam":
        case "setLaneParam": return op.weight === "rapid" ? pacing.rapid : pacing.setParam;
        case "selectWavetable": return pacing.selectWavetable;
        case "toggleEffect": return pacing.toggleEffect;
        case "mapRoute": return pacing.mapRoute;
        case "configureMseg": return pacing.configureMseg;
        case "setEnvelope":
        case "setMacro": return pacing.setSource;
    }
}

function buildTimeline(
    recipe: SpeedrunRecipe,
    pacing: SpeedrunPacing,
    compressionLevel: 0 | 1 | 2 | 3,
): SpeedrunTimeline {
    let cursor = 0;
    let heardOscillator = false;
    const sections = recipe.sections.map((section, sectionIndex): TimedSection => {
        const startFrame = cursor;
        const captionEvents = section.captions.map((_, line) => ({
            line,
            atFrame: startFrame + pacing.leadIn + line * pacing.captionStagger,
        }));
        let opCursor = startFrame;
        const opSpans = section.ops.map((op, opIndex): TimedOp => {
            const captionLine = section.opCaptionLines[opIndex];
            const captionStart = captionLine === null
                ? startFrame
                : startFrame + pacing.leadIn + captionLine * pacing.captionStagger;
            const opStart = Math.max(opCursor, captionStart);
            const duration = opDuration(op, pacing);
            const opEnd = opStart + duration;
            opCursor = opEnd;
            return { op, startFrame: opStart, endFrame: opEnd };
        });
        const latestOpEnd = opSpans.reduce((latest, span) => Math.max(latest, span.endFrame), startFrame);
        const latestCaption = captionEvents.at(-1)?.atFrame ?? startFrame;
        const endFrame = Math.max(
            startFrame + pacing.sectionMinimum,
            latestOpEnd + pacing.tail,
            latestCaption + pacing.tail,
        );
        cursor = endFrame;
        if (section.kind === "oscillator") heardOscillator = true;
        const checkpointIndex = heardOscillator ? sectionIndex : -1;
        return {
            section,
            startFrame,
            endFrame,
            startSample: startFrame * SPEEDRUN_SAMPLES_PER_FRAME,
            endSample: endFrame * SPEEDRUN_SAMPLES_PER_FRAME,
            captionEvents,
            opSpans,
            checkpointIndex,
        };
    });
    return {
        fps: SPEEDRUN_FPS,
        sampleRate: SPEEDRUN_SAMPLE_RATE,
        samplesPerFrame: SPEEDRUN_SAMPLES_PER_FRAME,
        durationInFrames: cursor,
        compressionLevel,
        sections,
    };
}

function scaleTimelineToCeiling(timeline: SpeedrunTimeline, maximum: number): SpeedrunTimeline {
    if (timeline.durationInFrames <= maximum || timeline.durationInFrames === 0) return timeline;
    const scale = maximum / timeline.durationInFrames;
    const frame = (value: number) => Math.min(maximum, Math.max(0, Math.round(value * scale)));
    const sections = timeline.sections.map((timed, index): TimedSection => {
        const startFrame = frame(timed.startFrame);
        const isLast = index === timeline.sections.length - 1;
        const endFrame = isLast
            ? maximum
            : Math.min(maximum, Math.max(startFrame + 1, frame(timed.endFrame)));
        return {
            ...timed,
            startFrame,
            endFrame,
            startSample: startFrame * SPEEDRUN_SAMPLES_PER_FRAME,
            endSample: endFrame * SPEEDRUN_SAMPLES_PER_FRAME,
            captionEvents: timed.captionEvents.map((event) => ({ ...event, atFrame: frame(event.atFrame) })),
            opSpans: timed.opSpans.map((span) => {
                const opStart = frame(span.startFrame);
                return {
                    ...span,
                    startFrame: opStart,
                    endFrame: Math.min(maximum, Math.max(opStart + 1, frame(span.endFrame))),
                };
            }),
        };
    });
    return { ...timeline, durationInFrames: maximum, compressionLevel: 3, sections };
}

/** Assemble the one integer-frame authority used by audio and video. */
export function assembleTimeline(
    recipe: SpeedrunRecipe,
    config: SpeedrunTimelineConfig = {},
): SpeedrunTimeline {
    const base = normalizedPacing(config);
    const maximum = integer(config.maxDurationInFrames ?? SPEEDRUN_MAX_DURATION_IN_FRAMES, 1);
    const natural = buildTimeline(recipe, base, 0);
    if (natural.durationInFrames <= maximum) return natural;
    return scaleTimelineToCeiling(natural, maximum);
}

