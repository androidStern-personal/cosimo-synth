import { definePluginState, eventValue, parameter, storedValue, type PluginStateCodec } from "../../kit/index";

type Curve = { readonly points: readonly number[] };

const curveCodec: PluginStateCodec<Curve> = {
    parse(input) {
        if (input === null || typeof input !== "object" || !("points" in input)
            || !Array.isArray(input.points) || input.points.length < 2
            || !input.points.every(point => typeof point === "number" && Number.isFinite(point))) {
            return { kind: "error", message: "A curve needs at least two finite points." };
        }
        return { kind: "ok", value: Object.freeze({ points: Object.freeze([...input.points]) }) };
    },
    encode: curve => ({ points: [...curve.points] }),
    equals: (left, right) => left.points.length === right.points.length
        && left.points.every((point, index) => point === right.points[index]),
};

// This supported public import is intentional: a deep import would miss
// accidental browser dependencies in the actual generated QuickJS bundle.
export default definePluginState({
    gain: parameter("gain"),
    curve: storedValue({
        initial: { points: [0, 1] },
        codec: curveCodec,
        engine: eventValue<Curve>("curveValue", (curve, context) =>
            curve.points.reduce((sum, point) => sum + point, 0) + context.parameters.gain * 0.1,
        { dependencies: ["gain"] }),
    }),
});
