export type SpeedrunStudioStage =
    | "contract"
    | "intake"
    | "analysis"
    | "audio"
    | "video"
    | "verification"
    | "unsupported"
    | "cancelled";

export class SpeedrunStudioError extends Error {
    constructor(
        readonly stage: SpeedrunStudioStage,
        readonly code: string,
        message: string,
        options: { readonly cause?: unknown } = {},
    ) {
        super(message, options);
        this.name = "SpeedrunStudioError";
    }
}

export function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError"
        || error instanceof Error && /abort|cancel/iu.test(`${error.name} ${error.message}`);
}

export function studioError(
    stage: Exclude<SpeedrunStudioStage, "cancelled">,
    code: string,
    error: unknown,
    fallback: string,
) {
    if (error instanceof SpeedrunStudioError) return error;
    if (isAbortError(error)) {
        return new SpeedrunStudioError("cancelled", "Cancelled", "Speedrun rendering was cancelled.", { cause: error });
    }
    return new SpeedrunStudioError(
        stage,
        code,
        error instanceof Error && error.message.trim().length > 0 ? error.message : fallback,
        { cause: error },
    );
}
