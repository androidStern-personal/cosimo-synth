import type { PatchConnectionLike } from "./cmajor-react";
import type { EffectModuleId } from "./target-descriptor";

/** Canonical stored-state key for the first production effects rack schema. */
export const RACK_STATE_KEY = "rack.v1";
/** DSP endpoint receiving the complete lane structure: chain + enable mask. */
export const LANE_TOPOLOGY_ENDPOINT_ID = "laneTopology";
/** DSP endpoint reporting the committed structure after its transition. */
export const EFFECTIVE_RACK_STATE_ENDPOINT_ID = "effectiveRackState";

/** Wire capacity of one lane chain (engine maxLaneChainLength). */
export const LANE_MAX_CHAIN_LENGTH = 16;

/** Stable rack identity order and wire-id vocabulary. */
export const RACK_EFFECT_ORDER: ReadonlyArray<EffectModuleId> = Object.freeze([
    "filter",
    "drive",
    "ott",
    "chorus",
    "flanger",
    "phaser",
    "delay",
    "reverb",
]);

/** One canonical rack document. Parameter values remain Cmajor parameters. */
export type RackState = {
    readonly format: "cosimo.rack";
    readonly version: 1;
    readonly order: ReadonlyArray<EffectModuleId>;
    readonly enabled: Readonly<Record<EffectModuleId, boolean>>;
};

/** A parsed committed rack-state readback from the DSP. */
export type EffectiveRackState = {
    readonly generation: number;
    readonly order: ReadonlyArray<EffectModuleId>;
    readonly enabled: Readonly<Record<EffectModuleId, boolean>>;
    readonly rejectedUploadCount: number;
    readonly paramsAcknowledgedSerial: number;
};

/** A boundary parse outcome for stored rack state. */
export type RackStateParseOutcome =
    | { readonly _tag: "ok"; readonly value: RackState }
    | { readonly _tag: "err"; readonly message: string };

const EFFECT_ID_TO_WIRE_ID: Readonly<Record<EffectModuleId, number>> = Object.freeze({
    filter: 0,
    drive: 1,
    ott: 2,
    chorus: 3,
    flanger: 4,
    phaser: 5,
    delay: 6,
    reverb: 7,
});

const WIRE_ID_TO_EFFECT_ID = new Map<number, EffectModuleId>(
    RACK_EFFECT_ORDER.map((effectId) => [EFFECT_ID_TO_WIRE_ID[effectId], effectId]),
);

function defaultEnabled(): Record<EffectModuleId, boolean> {
    return {
        filter: false,
        drive: false,
        ott: false,
        chorus: false,
        flanger: false,
        phaser: false,
        delay: false,
        reverb: false,
    };
}

/** Create the rack state matching the deployed pre-rack sound. */
export function createDefaultRackState(): RackState {
    return {
        format: "cosimo.rack",
        version: 1,
        order: [...RACK_EFFECT_ORDER],
        enabled: defaultEnabled(),
    };
}

function parseJsonDocument(input: unknown): RackStateParseOutcome | { readonly _tag: "json"; readonly value: unknown } {
    if (typeof input !== "string") {
        return { _tag: "json", value: input };
    }

    if (input.trim().length === 0) {
        return { _tag: "err", message: `${RACK_STATE_KEY} must not be empty` };
    }

    try {
        const value: unknown = JSON.parse(input);
        return { _tag: "json", value };
    } catch (cause: unknown) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        return { _tag: "err", message: `${RACK_STATE_KEY} is not valid JSON: ${detail}` };
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEffectId(input: unknown): EffectModuleId | null {
    if (typeof input !== "string") {
        return null;
    }

    return RACK_EFFECT_ORDER.find((candidate) => candidate === input) ?? null;
}

/** Parse unknown persisted data into the complete clean rack schema. */
export function parseRackState(input: unknown): RackStateParseOutcome {
    const document = parseJsonDocument(input);
    if (document._tag === "err") {
        return document;
    }
    if (!isRecord(document.value)) {
        return { _tag: "err", message: `${RACK_STATE_KEY} must be an object` };
    }

    const allowedKeys = new Set(["format", "version", "order", "enabled"]);
    for (const key of Reflect.ownKeys(document.value)) {
        if (typeof key !== "string" || !allowedKeys.has(key)) {
            return { _tag: "err", message: `${RACK_STATE_KEY} has unexpected field ${String(key)}` };
        }
    }
    if (document.value.format !== "cosimo.rack" || document.value.version !== 1) {
        return { _tag: "err", message: `${RACK_STATE_KEY} must be cosimo.rack version 1` };
    }
    if (!Array.isArray(document.value.order) || document.value.order.length !== RACK_EFFECT_ORDER.length) {
        return { _tag: "err", message: `${RACK_STATE_KEY}.order must contain every effect once` };
    }

    const order: EffectModuleId[] = [];
    const seen = new Set<EffectModuleId>();
    for (const rawEffectId of document.value.order) {
        const effectId = parseEffectId(rawEffectId);
        if (effectId === null || seen.has(effectId)) {
            return { _tag: "err", message: `${RACK_STATE_KEY}.order is not a complete permutation` };
        }
        seen.add(effectId);
        order.push(effectId);
    }

    if (!isRecord(document.value.enabled)) {
        return { _tag: "err", message: `${RACK_STATE_KEY}.enabled must be an object` };
    }
    if (Reflect.ownKeys(document.value.enabled).length !== RACK_EFFECT_ORDER.length) {
        return { _tag: "err", message: `${RACK_STATE_KEY}.enabled must contain every effect once` };
    }

    const enabled = defaultEnabled();
    for (const effectId of RACK_EFFECT_ORDER) {
        const rawEnabled = document.value.enabled[effectId];
        if (typeof rawEnabled !== "boolean") {
            return { _tag: "err", message: `${RACK_STATE_KEY}.enabled.${effectId} must be boolean` };
        }
        enabled[effectId] = rawEnabled;
    }

    return {
        _tag: "ok",
        value: { format: "cosimo.rack", version: 1, order, enabled },
    };
}

/** Deserialize persisted state, using the clean default for missing/corrupt local data. */
export function deserializeRackState(input: unknown): RackState {
    if (input === undefined) {
        return createDefaultRackState();
    }
    const parsed = parseRackState(input);
    return parsed._tag === "ok" ? parsed.value : createDefaultRackState();
}

/** Serialize only canonical rack structure; no parameter values or legacy gates. */
export function serializeRackState(state: RackState): string {
    return JSON.stringify({
        format: "cosimo.rack",
        version: 1,
        order: state.order,
        enabled: state.enabled,
    });
}

/**
 * Build the single structure event consumed by the rack DSP: rack.v1's
 * complete permutation becomes an 8-position lane chain of the ordinal-0
 * devices, and the per-module enabled flags become per-POSITION mask bits
 * (bit N = the device standing at position N is live).
 */
export function buildRackRuntimeEvents(state: RackState): ReadonlyArray<{ readonly endpointID: string; readonly value: unknown }> {
    const slotIds = new Array<number>(LANE_MAX_CHAIN_LENGTH).fill(0);
    let enabledMask = 0;
    state.order.forEach((effectId, position) => {
        slotIds[position] = EFFECT_ID_TO_WIRE_ID[effectId];
        if (state.enabled[effectId]) {
            enabledMask |= 1 << position;
        }
    });
    return [
        {
            endpointID: LANE_TOPOLOGY_ENDPOINT_ID,
            value: { chainLength: state.order.length, slotIds, enabledMask },
        },
    ];
}

/** Send a complete rack structure as one logical commit before the next audio frame. */
export function commitRackState(connection: PatchConnectionLike, state: RackState): void {
    for (const event of buildRackRuntimeEvents(state)) {
        connection.sendEventOrValue?.(event.endpointID, event.value);
    }
}

function decodeOrder(code: number): ReadonlyArray<EffectModuleId> | null {
    const order: EffectModuleId[] = [];
    const seen = new Set<EffectModuleId>();
    for (let position = 0; position < RACK_EFFECT_ORDER.length; position += 1) {
        const wireId = (code >>> (position * 3)) & 0b111;
        const effectId = WIRE_ID_TO_EFFECT_ID.get(wireId);
        if (effectId === undefined || seen.has(effectId)) {
            return null;
        }
        seen.add(effectId);
        order.push(effectId);
    }
    return order;
}

/**
 * Parse DSP effective-state readback into stable effect identities.
 *
 * Null when the committed chain is not a rack.v1 structure: before the
 * adapter's first commit the engine runs the default EMPTY chain (the
 * deployed pre-rack sound), which rack.v1 cannot represent.
 */
export function parseEffectiveRackState(input: unknown): EffectiveRackState | null {
    if (!isRecord(input)) {
        return null;
    }
    const chainLength = Number(input.laneCommittedChainLength);
    const chainCode = Number(input.laneCommittedChainCode);
    const positionMask = Number(input.laneCommittedPositionMask);
    const generation = Number(input.laneCommittedGeneration);
    const rejectedUploadCount = Number(input.laneRejectedUploadCount);
    const paramsAcknowledgedSerial = Number(input.laneParamsAcknowledgedSerial);
    if (![chainLength, chainCode, positionMask, generation, rejectedUploadCount, paramsAcknowledgedSerial]
            .every(Number.isFinite)) {
        return null;
    }
    if (Math.trunc(chainLength) !== RACK_EFFECT_ORDER.length) {
        return null;
    }
    const order = decodeOrder(Math.trunc(chainCode));
    if (order === null) {
        return null;
    }
    const enabled = defaultEnabled();
    order.forEach((effectId, position) => {
        enabled[effectId] = ((Math.trunc(positionMask) >>> position) & 1) === 1;
    });
    return {
        generation: Math.trunc(generation),
        order,
        enabled,
        rejectedUploadCount: Math.trunc(rejectedUploadCount),
        paramsAcknowledgedSerial: Math.trunc(paramsAcknowledgedSerial),
    };
}
