import type { LaneChainNodeV2, LaneStateV2 } from "../../shared/lane-state-v2";
import type { ModulationMsegSlot, ModulationRoute } from "../../shared/modulation";
import type { OscillatorID } from "../../shared/modulation-targets";
import type { NavTarget, SpeedrunRecipe, UIOp } from "../recipe";
import type { SpeedrunTimeline, TimedSection } from "../timeline";

export type SpeedrunWorkspace = "voice" | "fx" | "mod";

export type SpeedrunLaneDeviceState = {
    readonly deviceId: string;
    readonly enabled: boolean;
};

export type SpeedrunEnvelopeState = {
    readonly name: string;
    readonly attack: number;
    readonly decay: number;
    readonly sustain: number;
    readonly release: number;
};

export type SpeedrunVisualState = {
    readonly workspace: SpeedrunWorkspace;
    readonly oscillatorId: OscillatorID;
    readonly selectedSourceId: string;
    readonly selectedDeviceId: string | null;
    readonly filterFocused: boolean;
    readonly parameters: Readonly<Record<string, number>>;
    readonly laneParameters: Readonly<Record<string, number>>;
    readonly wavetableNames: Readonly<Record<OscillatorID, string>>;
    readonly wavetableIndices: Readonly<Record<OscillatorID, number>>;
    readonly laneDevices: ReadonlyArray<SpeedrunLaneDeviceState>;
    readonly routeAmounts: Readonly<Record<string, number>>;
    readonly routeTargets: Readonly<Record<string, string>>;
    readonly msegSlots: Readonly<Record<number, ModulationMsegSlot>>;
    readonly msegProgress: Readonly<Record<number, number>>;
    readonly envelopes: Readonly<Record<number, SpeedrunEnvelopeState>>;
    readonly macros: Readonly<Record<number, { readonly name: string; readonly value: number }>>;
    readonly section: TimedSection | null;
    readonly activeOp: { readonly op: UIOp; readonly progress: number } | null;
};

type MutableVisualState = {
    workspace: SpeedrunWorkspace;
    oscillatorId: OscillatorID;
    selectedSourceId: string;
    selectedDeviceId: string | null;
    filterFocused: boolean;
    parameters: Record<string, number>;
    laneParameters: Record<string, number>;
    wavetableNames: Record<OscillatorID, string>;
    wavetableIndices: Record<OscillatorID, number>;
    laneDevices: SpeedrunLaneDeviceState[];
    routeAmounts: Record<string, number>;
    routeTargets: Record<string, string>;
    msegSlots: Record<number, ModulationMsegSlot>;
    msegProgress: Record<number, number>;
    envelopes: Record<number, SpeedrunEnvelopeState>;
    macros: Record<number, { name: string; value: number }>;
};

const DEFAULT_ENVELOPE: SpeedrunEnvelopeState = {
    name: "Envelope",
    attack: 0.01,
    decay: 0.2,
    sustain: 0.8,
    release: 0.4,
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothstep(value: number) {
    const progress = clamp01(value);
    return progress * progress * (3 - (2 * progress));
}

function mix(from: number, to: number, progress: number) {
    return from + ((to - from) * smoothstep(progress));
}

function cloneMsegSlot(slot: ModulationMsegSlot): ModulationMsegSlot {
    return JSON.parse(JSON.stringify(slot)) as ModulationMsegSlot;
}

function collectLaneDevices(nodes: ReadonlyArray<LaneChainNodeV2>, output: SpeedrunLaneDeviceState[]) {
    for (const node of nodes) {
        if (node.kind === "device") {
            output.push({ deviceId: node.deviceId, enabled: node.enabled });
            continue;
        }
        for (const branch of node.branches) {
            for (const placement of branch) {
                output.push({ deviceId: placement.deviceId, enabled: placement.enabled });
            }
        }
    }
}

function installLane(state: MutableVisualState, lane: LaneStateV2) {
    const devices: SpeedrunLaneDeviceState[] = [];
    collectLaneDevices(lane.chain, devices);
    state.laneDevices = devices;
    for (const [deviceId, record] of Object.entries(lane.devices)) {
        for (const [endpointID, value] of Object.entries(record.params)) {
            state.laneParameters[`${deviceId}:${endpointID}`] = value;
        }
    }
    state.selectedDeviceId = devices[0]?.deviceId ?? null;
}

function installModulationBaseline(state: MutableVisualState, op: Extract<UIOp, { kind: "installModulationBaseline" }>) {
    op.modulation.msegSlots.forEach((slot, index) => {
        state.msegSlots[index + 1] = cloneMsegSlot(slot);
        state.msegProgress[index + 1] = 1;
    });
    op.modulation.envelopeSlots.forEach((slot, index) => {
        state.envelopes[index + 1] = { ...DEFAULT_ENVELOPE, name: slot.name };
    });
    op.modulation.macroNames.forEach((name, index) => {
        state.macros[index + 1] = { name, value: 0 };
    });
    for (const route of op.modulation.routes) {
        if (!route.enabled) continue;
        state.routeAmounts[route.id] = route.amount;
        state.routeTargets[route.id] = route.targetKind;
    }
}

function setNavigation(state: MutableVisualState, target: NavTarget) {
    state.workspace = target.tab;
    state.filterFocused = target.tab === "voice" && target.focus === "filter";
    if (target.tab === "voice" && target.oscillatorId !== undefined) {
        state.oscillatorId = target.oscillatorId;
    } else if (target.tab === "fx") {
        state.selectedDeviceId = target.deviceId;
    } else if (target.tab === "mod") {
        state.selectedSourceId = target.sourceId;
    }
}

function updateDeviceEnabled(state: MutableVisualState, deviceId: string, enabled: boolean) {
    const existing = state.laneDevices.findIndex((device) => device.deviceId === deviceId);
    if (existing < 0) {
        state.laneDevices.push({ deviceId, enabled });
        return;
    }
    state.laneDevices[existing] = { deviceId, enabled };
}

function applyRoute(state: MutableVisualState, route: ModulationRoute, progress: number) {
    const amountProgress = clamp01((progress - 0.55) / 0.45);
    state.routeAmounts[route.id] = mix(0, route.amount, amountProgress);
    state.routeTargets[route.id] = route.targetKind;
}

function applyOp(state: MutableVisualState, op: UIOp, progress: number) {
    const eased = smoothstep(progress);
    switch (op.kind) {
        case "installLaneBaseline":
            installLane(state, op.lane);
            return;
        case "installModulationBaseline":
            installModulationBaseline(state, op);
            return;
        case "navigate":
            if (progress >= 0.55) setNavigation(state, op.to);
            return;
        case "setParam":
            state.parameters[op.endpointID] = mix(op.from, op.to, progress);
            return;
        case "selectWavetable":
            if (progress >= 0.58) {
                state.wavetableNames[op.osc] = op.tableName;
                state.wavetableIndices[op.osc] = op.tableIndex;
            }
            return;
        case "toggleEffect":
            if (progress >= 0.62) updateDeviceEnabled(state, op.deviceId, true);
            return;
        case "setLaneParam":
            state.laneParameters[`${op.deviceId}:${op.endpointID}`] = mix(op.from, op.to, progress);
            return;
        case "mapRoute":
            applyRoute(state, op.route, progress);
            return;
        case "configureMseg":
            state.msegSlots[op.slot] = cloneMsegSlot(op.state);
            state.msegProgress[op.slot] = eased;
            state.parameters[`mseg${op.slot}Rate`] = mix(1, op.rate, progress);
            state.parameters[`mseg${op.slot}Morph`] = mix(0, op.morph, progress);
            return;
        case "setEnvelope": {
            const current = state.envelopes[op.slot] ?? DEFAULT_ENVELOPE;
            state.envelopes[op.slot] = {
                name: progress >= 0.45 ? op.name : current.name,
                attack: mix(DEFAULT_ENVELOPE.attack, op.attack, progress),
                decay: mix(DEFAULT_ENVELOPE.decay, op.decay, progress),
                sustain: mix(DEFAULT_ENVELOPE.sustain, op.sustain, progress),
                release: mix(DEFAULT_ENVELOPE.release, op.release, progress),
            };
            return;
        }
        case "setMacro":
            state.macros[op.slot] = {
                name: progress >= 0.45 ? op.name : `Macro ${op.slot}`,
                value: mix(0, op.value, progress),
            };
    }
}

function createInitialState(recipe: SpeedrunRecipe): MutableVisualState {
    const state: MutableVisualState = {
        workspace: "voice",
        oscillatorId: "A",
        selectedSourceId: "mseg-1",
        selectedDeviceId: null,
        filterFocused: false,
        parameters: {},
        laneParameters: {},
        wavetableNames: { A: "INIT", B: "INIT", C: "INIT" },
        wavetableIndices: { A: 0, B: 0, C: 0 },
        laneDevices: [],
        routeAmounts: {},
        routeTargets: {},
        msegSlots: {},
        msegProgress: {},
        envelopes: {},
        macros: {},
    };

    for (const section of recipe.sections) {
        for (const op of section.ops) {
            if (op.kind === "setParam" && state.parameters[op.endpointID] === undefined) {
                state.parameters[op.endpointID] = op.from;
            } else if (op.kind === "setLaneParam") {
                const key = `${op.deviceId}:${op.endpointID}`;
                if (state.laneParameters[key] === undefined) state.laneParameters[key] = op.from;
            }
        }
    }
    for (const op of recipe.prelude) applyOp(state, op, 1);
    return state;
}

function sectionAtFrame(timeline: SpeedrunTimeline, frame: number) {
    return timeline.sections.find((section) => frame >= section.startFrame && frame < section.endFrame)
        ?? timeline.sections.at(-1)
        ?? null;
}

/** Derive every visible value from recipe + integer frame; no wall-clock or retained state participates. */
export function speedrunVisualStateAtFrame(
    recipe: SpeedrunRecipe,
    timeline: SpeedrunTimeline,
    requestedFrame: number,
): SpeedrunVisualState {
    const frame = Math.min(
        Math.max(0, Math.floor(requestedFrame)),
        Math.max(0, timeline.durationInFrames - 1),
    );
    const state = createInitialState(recipe);
    let activeOp: SpeedrunVisualState["activeOp"] = null;
    let activeOpStartFrame = -1;

    for (const timedSection of timeline.sections) {
        if (frame < timedSection.startFrame) break;
        for (const span of timedSection.opSpans) {
            if (frame < span.startFrame) continue;
            const duration = Math.max(1, span.endFrame - span.startFrame);
            const progress = frame >= span.endFrame ? 1 : clamp01((frame - span.startFrame) / duration);
            applyOp(state, span.op, progress);
            if (frame >= span.startFrame && frame < span.endFrame && span.startFrame >= activeOpStartFrame) {
                activeOp = { op: span.op, progress };
                activeOpStartFrame = span.startFrame;
            }
        }
    }

    return { ...state, section: sectionAtFrame(timeline, frame), activeOp };
}
