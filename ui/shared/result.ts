/**
 * Minimal Result type for expected failures as values.
 *
 * Known failure modes appear in return types as tagged error values; `throw`
 * is reserved for defects (violated invariants, impossible branches). See
 * docs/COSIMO_IOS_MERGE_ROADMAP.md § API contracts.
 */

/** A success or a typed expected failure. */
export type Result<T, E extends Error> =
    | { readonly _tag: "ok"; readonly value: T }
    | { readonly _tag: "err"; readonly error: E };

/**
 * Wrap a success value.
 *
 * @param value - The success value.
 * @returns An ok result carrying the value.
 */
export function ok<T>(value: T): { readonly _tag: "ok"; readonly value: T } {
    return { _tag: "ok", value };
}

/**
 * Wrap an expected failure.
 *
 * @param error - The tagged error value.
 * @returns An err result carrying the error.
 */
export function err<E extends Error>(error: E): { readonly _tag: "err"; readonly error: E } {
    return { _tag: "err", error };
}

/**
 * Narrow a result to its success arm.
 *
 * @param result - The result to inspect.
 * @returns True when the result is ok.
 */
export function isOk<T, E extends Error>(result: Result<T, E>): result is { readonly _tag: "ok"; readonly value: T } {
    return result._tag === "ok";
}

/**
 * Narrow a result to its failure arm.
 *
 * @param result - The result to inspect.
 * @returns True when the result is an error.
 */
export function isErr<T, E extends Error>(result: Result<T, E>): result is { readonly _tag: "err"; readonly error: E } {
    return result._tag === "err";
}

/**
 * Unwrap a result that the caller has proven must be ok; a failure is a defect.
 *
 * @param result - The result to unwrap.
 * @returns The success value.
 * @throws The carried error when the result is err — only for invariant violations.
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
    if (result._tag === "err") {
        throw result.error;
    }

    return result.value;
}

/**
 * Map the success value of a result.
 *
 * @template T - The original success type.
 * @template U - The mapped success type.
 * @template E - The error type.
 * @param result - The result to map.
 * @param fn - The function applied to the success value.
 * @returns A result with the mapped success value, or the original error.
 */
export function map<T, U, E extends Error>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result._tag === "ok" ? ok(fn(result.value)) : result;
}

/**
 * Exhaustiveness guard: unreachable union branches are defects.
 *
 * @param unexpectedCase - The value TypeScript believes cannot exist.
 * @throws Always — reaching this at runtime is a defect.
 */
export function casesHandled(unexpectedCase: never): never {
    throw new Error(`Unhandled case: ${JSON.stringify(unexpectedCase)}`);
}

/**
 * Assert an invariant the type system cannot express.
 *
 * @param message - What was violated.
 * @throws Always — reaching this at runtime is a defect.
 */
export function shouldNeverHappen(message?: string): never {
    throw new Error(message ?? "Invariant violated");
}

/**
 * Placeholder for a path that is intentionally not implemented yet.
 *
 * @param message - What remains to be implemented.
 * @throws Always — calling an unimplemented path is a defect.
 */
export function notYetImplemented(message?: string): never {
    throw new Error(message ?? "Not yet implemented");
}
