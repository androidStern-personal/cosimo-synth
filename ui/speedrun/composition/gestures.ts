import { clamp01, smoothstep } from "../easing";
import type { UIOp } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import {
    navigationPoint,
    pointAlongQuadratic,
    sourceRailPoint,
    surfacePoint,
    type SpeedrunPoint,
} from "./layout";

export type GestureScript = {
    readonly op: UIOp;
    readonly progress: number;
    readonly finger: SpeedrunPoint;
    readonly target: SpeedrunPoint;
    readonly ripple: number;
    readonly ghost: SpeedrunPoint | null;
    readonly capture: number;
    readonly direction: "tap" | "horizontal" | "vertical" | "path";
};


function normalizedEndpointValue(endpointID: string, value: number) {
    const lower = endpointID.toLowerCase();
    if (lower.includes("cutoff") || lower.includes("filter")) {
        return clamp01(Math.log(Math.max(20, value) / 20) / Math.log(20_000 / 20));
    }
    if (lower.includes("time") && value > 2) return clamp01(value / 2_000);
    if (lower.includes("release") || lower.includes("attack") || lower.includes("decay")) {
        return clamp01(Math.log1p(Math.max(0, value) * 4) / Math.log(21));
    }
    if (lower.includes("mode")) return clamp01(value / 8);
    if (value > 1) return clamp01(value / 100);
    return clamp01(value);
}

function tapGesture(op: UIOp, progress: number, target: SpeedrunPoint): GestureScript {
    const pulse = 1 - Math.abs((progress * 2) - 1);
    return {
        op,
        progress,
        finger: target,
        target,
        ripple: smoothstep(pulse),
        ghost: null,
        capture: progress >= 0.55 ? 1 - progress : 0,
        direction: "tap",
    };
}

function setParamGesture(
    op: Extract<UIOp, { kind: "setParam" | "setLaneParam" }>,
    progress: number,
): GestureScript {
    const target = surfacePoint(op.surface);
    const from = normalizedEndpointValue(op.endpointID, op.from);
    const to = normalizedEndpointValue(op.endpointID, op.to);
    const rawDistance = (to - from) * 220;
    const distance = Math.abs(rawDistance) < 24 ? Math.sign(rawDistance || 1) * 24 : rawDistance;
    return {
        op,
        progress,
        finger: { x: target.x - (distance * 0.5) + (distance * smoothstep(progress)), y: target.y },
        target,
        ripple: progress < 0.18 ? 1 - (progress / 0.18) : 0,
        ghost: null,
        capture: 0,
        direction: "horizontal",
    };
}

function mapRouteGesture(op: Extract<UIOp, { kind: "mapRoute" }>, progress: number): GestureScript {
    const start = sourceRailPoint(op);
    const target = surfacePoint(op.surface);
    if (progress < 0.22) {
        return { ...tapGesture(op, progress / 0.22, start), ghost: start, direction: "path" };
    }
    if (progress < 0.66) {
        const pathProgress = smoothstep((progress - 0.22) / 0.44);
        const finger = pointAlongQuadratic(
            start,
            { x: Math.max(210, target.x + 72), y: Math.min(start.y, target.y) - 88 },
            target,
            pathProgress,
        );
        return {
            op,
            progress,
            finger,
            target,
            ripple: 0,
            ghost: finger,
            capture: pathProgress > 0.82 ? (pathProgress - 0.82) / 0.18 : 0,
            direction: "path",
        };
    }
    const amountProgress = smoothstep((progress - 0.66) / 0.34);
    const direction = Math.sign(op.route.amount || 1);
    const distance = Math.min(76, Math.max(24, Math.abs(op.route.amount) * 42));
    return {
        op,
        progress,
        finger: { x: target.x, y: target.y - (direction * distance * amountProgress) },
        target,
        ripple: 0,
        ghost: null,
        capture: 1 - (amountProgress * 0.7),
        direction: "vertical",
    };
}

function sourceGesture(op: UIOp, progress: number): GestureScript {
    const target = { x: 196, y: op.kind === "setMacro" ? 432 : 372 };
    const travel = op.kind === "setMacro" ? 84 : 52;
    return {
        op,
        progress,
        finger: { x: target.x - travel / 2 + (travel * smoothstep(progress)), y: target.y },
        target,
        ripple: progress < 0.16 ? 1 - progress / 0.16 : 0,
        ghost: null,
        capture: 0,
        direction: "horizontal",
    };
}

function scriptForOp(op: UIOp, progress: number): GestureScript | null {
    switch (op.kind) {
        case "installLaneBaseline":
        case "installModulationBaseline":
            return null;
        case "navigate":
            return tapGesture(op, progress, navigationPoint(op.to));
        case "setParam":
        case "setLaneParam":
            return setParamGesture(op, progress);
        case "mapRoute":
            return mapRouteGesture(op, progress);
        case "selectWavetable":
            return tapGesture(op, progress, { x: 96, y: 126 });
        case "toggleEffect":
            return tapGesture(op, progress, { x: 354, y: 216 });
        case "configureMseg":
            return sourceGesture(op, progress);
        case "setEnvelope":
        case "setMacro":
            return sourceGesture(op, progress);
    }
}

/** Return the deterministic finger script for the latest in-flight operation. */
export function gestureAtFrame(timeline: SpeedrunTimeline, frame: number): GestureScript | null {
    let active: { op: UIOp; startFrame: number; endFrame: number } | null = null;
    for (const section of timeline.sections) {
        if (frame < section.startFrame) break;
        for (const span of section.opSpans) {
            if (frame < span.startFrame || frame >= span.endFrame) continue;
            if (active === null || span.startFrame >= active.startFrame) active = span;
        }
    }
    if (active === null) return null;
    const progress = clamp01((frame - active.startFrame) / Math.max(1, active.endFrame - active.startFrame));
    return scriptForOp(active.op, progress);
}
