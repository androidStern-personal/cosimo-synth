import { preparedState, type PluginStateCodec } from "./plugin-state-definition";
import { sharedData } from "./shared-data-delivery";
import { createDefaultMsegShape, normalizeMsegShape, renderMsegShapeInto, MSEG_PADDED_SAMPLES, type MsegShape } from "./mseg";

/** Parse and freeze one editable curve; reject invalid ordering and malformed sample coordinates. */
export const msegCurveCodec: PluginStateCodec<MsegShape> = {
    parse(value) {
        if (!value || typeof value !== "object" || !("points" in value) || !Array.isArray(value.points)
            || value.points.length < 2 || value.points.length > 256
            || !value.points.every(point => point && typeof point.x === "number" && Number.isFinite(point.x)
                && typeof point.y === "number" && Number.isFinite(point.y)
                && typeof point.curvePower === "number" && Number.isFinite(point.curvePower))) {
            return { kind: "error", message: "An MSEG needs 2–256 finite editable points." };
        }
        try {
            const shape = normalizeMsegShape(value);
            for (const point of shape.points) Object.freeze(point);
            Object.freeze(shape.points);
            return { kind: "ok", value: Object.freeze(shape) };
        } catch (error) {
            return { kind: "error", message: error instanceof Error ? error.message : "Invalid MSEG curve." };
        }
    },
    encode: value => ({ ...value, points: value.points.map(point => ({ ...point })) }),
    equals: (left, right) => JSON.stringify(left) === JSON.stringify(right),
};

/** Declare one curve; the framework owns its input assignment, allocation, publication, and history. */
export function msegState(initial: MsegShape = createDefaultMsegShape()) {
    return preparedState({
        codec: msegCurveCodec,
        initial,
        engine: sharedData({ type: "float32", length: MSEG_PADDED_SAMPLES }),
        prepare: (shape, samples) => renderMsegShapeInto(shape, samples),
    });
}
