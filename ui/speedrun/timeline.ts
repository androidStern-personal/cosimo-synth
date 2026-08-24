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

const DEFAULT_PACING: SpeedrunPacing = {
    leadIn: 10,
    captionStagger: 4,
    navigate: 10,
    setParam: 13,
    selectWavetable: 18,
    toggleEffect: 9,
    mapRoute: 25,
    configureMseg: 26,
    setSource: 12,
    rapid: 5,
    tail: 12,
    sectionMinimum: 48,
};

const FLOOR_PACING: SpeedrunPacing = {
    leadIn: 8,
    captionStagger: 3,
    navigate: 6,
    setParam: 8,
    selectWavetable: 11,
    toggleEffect: 6,
    mapRoute: 16,
    configureMseg: 17,
    setSource: 8,
    rapid: 5,
    tail: 8,
    sectionMinimum: 40,
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

function mixPacing(base: SpeedrunPacing, floor: SpeedrunPacing, factor: number): SpeedrunPacing {
    return Object.fromEntries(Object.entries(base).map(([key, value]) => {
        const floorValue = floor[key as keyof SpeedrunPacing];
        return [key, integer(floorValue + (value - floorValue) * factor, 1)];
    })) as SpeedrunPacing;
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
    overlapRapid: boolean,
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
            const rapid = (op.kind === "setParam" || op.kind === "setLaneParam") && op.weight === "rapid";
            opCursor = overlapRapid && rapid ? opStart + Math.min(2, duration) : opEnd;
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

function fitLevelOne(
    recipe: SpeedrunRecipe,
    base: SpeedrunPacing,
    maximum: number,
): SpeedrunTimeline | null {
    const fastest = buildTimeline(recipe, mixPacing(base, FLOOR_PACING, 0), 1, false);
    if (fastest.durationInFrames > maximum) return null;
    let low = 0;
    let high = 1;
    let best = fastest;
    for (let iteration = 0; iteration < 18; iteration += 1) {
        const factor = (low + high) / 2;
        const candidate = buildTimeline(recipe, mixPacing(base, FLOOR_PACING, factor), 1, false);
        if (candidate.durationInFrames <= maximum) {
            best = candidate;
            low = factor;
        } else {
            high = factor;
        }
    }
    return best;
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
    const uncompressed = buildTimeline(recipe, base, 0, false);
    if (uncompressed.durationInFrames <= maximum) return uncompressed;

    const levelOne = fitLevelOne(recipe, base, maximum);
    if (levelOne !== null) return levelOne;

    const levelTwoPacing: SpeedrunPacing = {
        ...FLOOR_PACING,
        leadIn: 6,
        captionStagger: 2,
        rapid: 4,
        tail: 6,
        sectionMinimum: 32,
    };
    const levelTwo = buildTimeline(recipe, levelTwoPacing, 2, true);
    if (levelTwo.durationInFrames <= maximum) return levelTwo;

    const levelThree = buildTimeline(recipe, {
        ...levelTwoPacing,
        navigate: 4,
        setParam: 5,
        selectWavetable: 7,
        toggleEffect: 4,
        mapRoute: 10,
        configureMseg: 10,
        setSource: 6,
        rapid: 3,
        tail: 4,
        sectionMinimum: 24,
    }, 3, true);
    return scaleTimelineToCeiling(levelThree, maximum);
}

