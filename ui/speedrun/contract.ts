import { sha256 } from "../../kit/ui/sha256";

/** One public synth parameter as a speedrun recipe sees it. */
export type SpeedrunContractParameter = {
    endpointID: string;
    type: "number" | "integer" | "boolean";
    min?: number;
    max?: number;
    step?: number;
    defaultValue: number | boolean;
    discrete?: boolean;
    text?: string;
};

/** A saved document the synth must restore for a recipe to replay. */
export type SpeedrunContractDocument = {
    key: string;
    schemaVersion: number;
    required: true;
};

/**
 * The synth surface a recipe was written against. Every recipe stores the hash,
 * so a recipe made for a different set of parameters or documents is refused.
 */
export type SpeedrunContract = {
    effectID: string;
    parameters: SpeedrunContractParameter[];
    storedState: SpeedrunContractDocument[];
    hash: string;
};

const cmajorEndpointIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function contractParameter(parameter: unknown): SpeedrunContractParameter {
    if (!isRecord(parameter)) throw new Error("Each contract parameter must be an object.");
    const endpointID = parameter.endpointID;
    if (typeof endpointID !== "string" || !cmajorEndpointIdentifierPattern.test(endpointID)) {
        throw new Error(`"${String(endpointID)}" is not a Cmajor parameter endpoint ID.`);
    }
    const annotation = isRecord(parameter.annotation) ? parameter.annotation : parameter;
    const initValue = annotation.init ?? parameter.defaultValue;
    const discrete = annotation.discrete === true || parameter.discrete === true;
    const type = parameter.type === "boolean" || annotation.boolean === true || typeof initValue === "boolean"
        ? "boolean"
        : parameter.type === "integer" || discrete ? "integer" : "number";
    const contract: SpeedrunContractParameter = {
        endpointID,
        type,
        defaultValue: type === "boolean" ? Boolean(initValue) : finiteNumber(initValue) ?? 0,
    };
    const min = finiteNumber(annotation.min ?? parameter.min);
    const max = finiteNumber(annotation.max ?? parameter.max);
    const step = finiteNumber(annotation.step ?? parameter.step);
    const text = annotation.text ?? parameter.text;
    if (min !== undefined) contract.min = min;
    if (max !== undefined) contract.max = max;
    if (step !== undefined) contract.step = step;
    if (discrete) contract.discrete = true;
    if (typeof text === "string") contract.text = text;
    return contract;
}

function contractDocument(entry: { readonly key: string; readonly schemaVersion: number }): SpeedrunContractDocument {
    if (entry.key.trim().length === 0) throw new Error("A contract document key must not be empty.");
    if (!Number.isInteger(entry.schemaVersion) || entry.schemaVersion < 1) {
        throw new Error(`The contract document "${entry.key}" needs a positive whole schema version.`);
    }
    return { key: entry.key, schemaVersion: entry.schemaVersion, required: true };
}

function assertUnique(keys: readonly string[], label: string) {
    const seen = new Set<string>();
    for (const key of keys) {
        if (seen.has(key)) throw new Error(`The contract lists the ${label} "${key}" twice.`);
        seen.add(key);
    }
}

function canonicalValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (isRecord(value)) {
        return Object.fromEntries(Object.keys(value)
            .sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => [key, canonicalValue(value[key])]));
    }
    return value;
}

/** Build the contract from the synth's public parameter endpoints and its saved documents. */
export function buildSpeedrunContract({
    effectID,
    parameters,
    storedState = [],
}: {
    effectID: string;
    parameters: readonly unknown[];
    storedState?: ReadonlyArray<{ readonly key: string; readonly schemaVersion: number }>;
}): SpeedrunContract {
    if (effectID.trim().length === 0) throw new Error("A speedrun contract needs an effect ID.");
    const contract = {
        effectID: effectID.trim(),
        parameters: parameters.map(contractParameter).sort((left, right) => left.endpointID.localeCompare(right.endpointID)),
        storedState: storedState.map(contractDocument).sort((left, right) => left.key.localeCompare(right.key)),
    };
    assertUnique(contract.parameters.map((parameter) => parameter.endpointID), "parameter");
    assertUnique(contract.storedState.map((entry) => entry.key), "document");
    return { ...contract, hash: `sha256:${sha256(JSON.stringify(canonicalValue(contract)))}` };
}
