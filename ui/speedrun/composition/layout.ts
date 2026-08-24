import type { NavTarget, SurfaceRef, UIOp } from "../recipe";

export const SPEEDRUN_PHONE_WIDTH = 393 as const;
export const SPEEDRUN_PHONE_HEIGHT = 852 as const;

export type SpeedrunPoint = {
    readonly x: number;
    readonly y: number;
};

const VOICE_CELL_POINTS: Readonly<Record<string, SpeedrunPoint>> = {
    WavetablePosition: { x: 84, y: 315 },
    WarpMode: { x: 265, y: 315 },
    WarpAmount: { x: 171, y: 315 },
    VolumeDb: { x: 310, y: 315 },
    Pan: { x: 350, y: 315 },
};

const RACK_PARAMETER_ORDER = [
    "Time", "Mix", "Feedback", "Filter", "Size", "Decay", "Damping", "Drive", "Amount", "Rate",
];

function hash(value: string) {
    let result = 0;
    for (let index = 0; index < value.length; index += 1) {
        result = ((result * 31) + value.charCodeAt(index)) >>> 0;
    }
    return result;
}

function endpointSuffix(surface: string) {
    const voice = surface.match(/^mobile-voice-cell-[ABC]-(.+)$/);
    if (voice) return voice[1];
    const rack = surface.match(/^rack-parameter-surface-.+?-([A-Za-z0-9]+)$/);
    if (rack) return rack[1];
    return surface;
}

function rackParameterPoint(endpointID: string): SpeedrunPoint {
    const short = RACK_PARAMETER_ORDER.findIndex((name) => endpointID.toLowerCase().includes(name.toLowerCase()));
    const index = short >= 0 ? short : hash(endpointID) % 6;
    return {
        x: 72 + ((index % 3) * 112),
        y: 420 + (Math.floor(index / 3) * 126),
    };
}

export function surfacePoint(surface: SurfaceRef): SpeedrunPoint {
    if (surface === "filter-graph-drop-surface") return { x: 188, y: 490 };
    if (surface === "voice-filter-filterCutoff") return { x: 92, y: 548 };
    if (surface === "voice-setup-ampRelease") return { x: 330, y: 616 };
    const suffix = endpointSuffix(surface);
    if (surface.startsWith("mobile-voice-cell-")) {
        return VOICE_CELL_POINTS[suffix] ?? { x: 196, y: 315 };
    }
    if (surface.startsWith("rack-parameter-surface-")) return rackParameterPoint(suffix);
    return { x: 196, y: 430 };
}

export function workspaceTabPoint(tab: "voice" | "fx" | "mod"): SpeedrunPoint {
    return { x: tab === "voice" ? 66 : tab === "fx" ? 196 : 327, y: 714 };
}

export function navigationPoint(target: NavTarget): SpeedrunPoint {
    if (target.tab === "mod") return workspaceTabPoint("mod");
    if (target.tab === "fx") return workspaceTabPoint("fx");
    return workspaceTabPoint("voice");
}

export function sourceRailPoint(op: Extract<UIOp, { kind: "mapRoute" }>): SpeedrunPoint {
    const slot = Math.max(1, Number(op.route.sourceSlot) || 1);
    const kindOffset = op.route.sourceKind === "env" ? 1 : op.route.sourceKind === "macro" ? 2 : 0;
    return { x: 373, y: 238 + (((slot - 1 + kindOffset) % 4) * 54) };
}

export function pointAlongQuadratic(
    start: SpeedrunPoint,
    control: SpeedrunPoint,
    end: SpeedrunPoint,
    progress: number,
): SpeedrunPoint {
    const inverse = 1 - progress;
    return {
        x: (inverse * inverse * start.x) + (2 * inverse * progress * control.x) + (progress * progress * end.x),
        y: (inverse * inverse * start.y) + (2 * inverse * progress * control.y) + (progress * progress * end.y),
    };
}
