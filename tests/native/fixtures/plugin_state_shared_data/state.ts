// PLUGIN CODE. This declaration is imported by the generated framework worker
// and by the GUI. Importing it does not create a worker or allocate DSP memory.
import { definePluginState, parameter, preparedState, sharedData, type PluginStateCodec } from "../../kit/index";
import { createDefaultMsegShape, normalizeMsegShape, renderMsegShape, type MsegShape } from "../../ui/shared/mseg";

const codec: PluginStateCodec<MsegShape> = {
    parse(value) {
        if (!value || typeof value !== "object" || !("points" in value) || !Array.isArray(value.points)
            || value.points.length < 2 || value.points.length > 256
            || !value.points.every(p => p && typeof p.x === "number" && Number.isFinite(p.x)
                && typeof p.y === "number" && Number.isFinite(p.y) && typeof p.curvePower === "number" && Number.isFinite(p.curvePower)))
            return { kind: "error", message: "An MSEG needs finite editable points." };
        const shape = normalizeMsegShape(value);
        for (const point of shape.points) Object.freeze(point);
        Object.freeze(shape.points);
        return { kind: "ok", value: Object.freeze(shape) };
    },
    encode: value => ({ ...value, points: value.points.map(point => ({ ...point })) }),
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
};

export default definePluginState({
    gain: parameter("gain"),
    shape: preparedState({
        schema: codec,
        initial: createDefaultMsegShape(),
        prepare: renderMsegShape, // Existing Cosimo renderer; real padded 2,051-sample curve.
        engine: sharedData({ input: 0 }),
    }),
});
