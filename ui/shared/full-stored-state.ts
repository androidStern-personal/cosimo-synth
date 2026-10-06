/**
 * The saved values in Cmajor's reply to a full stored-state request,
 * `{ parameters, values }`. A reply in any other shape has none.
 */
export function fullStoredStateValues(fullState: unknown): Readonly<Record<string, unknown>> {
    if (typeof fullState !== "object" || fullState === null) return {};
    const values: unknown = Reflect.get(fullState, "values");
    // SAFETY: a non-null, non-array object is read only by string key here.
    return typeof values === "object" && values !== null && !Array.isArray(values) ? values as Record<string, unknown> : {};
}
