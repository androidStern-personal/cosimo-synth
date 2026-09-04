import { isPlainObject } from "./effect-utils";
import { sha256 } from "../sha256";

export type EffectParameterValue = number | boolean;

export type EffectParameterContract = {
    endpointID: string;
    type: "number" | "integer" | "boolean";
    min?: number;
    max?: number;
    step?: number;
    defaultValue: EffectParameterValue;
    discrete?: boolean;
    text?: string;
};

export type EffectStoredStateContract = {
    key: string;
    schemaVersion: number;
    required: true;
};

export type EffectPluginStateContract = {
    effectID: string;
    parameters: EffectParameterContract[];
    storedState: EffectStoredStateContract[];
    hash: string;
};

export type StoredStateContractSource = EffectStoredStateContract | {
    key: string;
    schemaVersion: number;
    required?: true;
} | {
    getContract: () => EffectStoredStateContract;
};

const cmajorEndpointIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function finiteNumber(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
}

function normalizeEndpointID(endpointID: unknown): string {
    if (typeof endpointID !== "string" || !cmajorEndpointIdentifierPattern.test(endpointID)) {
        throw new Error(`Invalid Cmajor parameter endpoint ID "${String(endpointID)}".`);
    }

    return endpointID;
}

function normalizeParameterContract(parameter: unknown): EffectParameterContract {
    if (!isPlainObject(parameter)) {
        throw new Error("Parameter contract must be an object.");
    }

    const endpointID = normalizeEndpointID(parameter.endpointID);
    const annotation = isPlainObject(parameter.annotation) ? parameter.annotation : parameter;
    const booleanAnnotation = annotation.boolean === true;
    const initValue = annotation.init ?? parameter.defaultValue;
    const discrete = annotation.discrete === true || parameter.discrete === true;
    const type = parameter.type === "boolean" || booleanAnnotation || typeof initValue === "boolean"
        ? "boolean"
        : parameter.type === "integer" || discrete
            ? "integer"
            : "number";
    const defaultValue = type === "boolean"
        ? Boolean(initValue)
        : finiteNumber(initValue) ?? 0;
    const contract: EffectParameterContract = {
        endpointID,
        type,
        defaultValue,
    };
    const min = finiteNumber(annotation.min ?? parameter.min);
    const max = finiteNumber(annotation.max ?? parameter.max);
    const step = finiteNumber(annotation.step ?? parameter.step);
    const text = annotation.text ?? parameter.text;

    if (min !== undefined) {
        contract.min = min;
    }

    if (max !== undefined) {
        contract.max = max;
    }

    if (step !== undefined) {
        contract.step = step;
    }

    if (discrete) {
        contract.discrete = true;
    }

    if (typeof text === "string") {
        contract.text = text;
    }

    return contract;
}

function hasStoredStateContractGetter(
    entry: StoredStateContractSource,
): entry is { getContract: () => EffectStoredStateContract } {
    return typeof (entry as { getContract?: unknown }).getContract === "function";
}

function normalizeStoredStateContract(entry: StoredStateContractSource): EffectStoredStateContract {
    const rawEntry = hasStoredStateContractGetter(entry)
        ? entry.getContract()
        : entry;

    if (!isPlainObject(rawEntry)) {
        throw new Error("Stored-state contract must be an object.");
    }

    if (typeof rawEntry.key !== "string" || rawEntry.key.trim().length === 0) {
        throw new Error("Stored-state contract key must be a non-empty string.");
    }

    if (!Number.isInteger(rawEntry.schemaVersion) || rawEntry.schemaVersion < 1) {
        throw new Error(`Stored-state contract "${rawEntry.key}" schemaVersion must be a positive integer.`);
    }

    return {
        key: rawEntry.key,
        schemaVersion: rawEntry.schemaVersion,
        required: true,
    };
}

function assertUnique<T>(
    values: T[],
    keyFor: (value: T) => string,
    label: string,
) {
    const seen = new Set<string>();

    for (const value of values) {
        const key = keyFor(value);

        if (seen.has(key)) {
            throw new Error(`Duplicate ${label} "${key}".`);
        }

        seen.add(key);
    }
}

function canonicalValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalValue);
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .filter((key) => value[key] !== undefined)
                .map((key) => [key, canonicalValue(value[key])]),
        );
    }

    return value;
}

export function canonicalJSONStringify(value: unknown): string {
    return JSON.stringify(canonicalValue(value));
}

function contractHashPayload(contract: Omit<EffectPluginStateContract, "hash">) {
    return {
        effectID: contract.effectID,
        parameters: contract.parameters,
        storedState: contract.storedState,
    };
}

export function buildCanonicalPluginStateContract({
    effectID,
    parameters,
    storedState = [],
}: {
    effectID: string;
    parameters: unknown[];
    storedState?: StoredStateContractSource[];
}): EffectPluginStateContract {
    if (typeof effectID !== "string" || effectID.trim().length === 0) {
        throw new Error("Plugin state contract effectID must be a non-empty string.");
    }

    const normalizedParameters = parameters
        .map(normalizeParameterContract)
        .sort((left, right) => left.endpointID.localeCompare(right.endpointID));
    const normalizedStoredState = storedState
        .map(normalizeStoredStateContract)
        .sort((left, right) => left.key.localeCompare(right.key));
    const baseContract = {
        effectID: effectID.trim(),
        parameters: normalizedParameters,
        storedState: normalizedStoredState,
    };

    assertUnique(normalizedParameters, (param) => param.endpointID, "parameter endpointID");
    assertUnique(normalizedStoredState, (entry) => entry.key, "stored-state key");

    return {
        ...baseContract,
        hash: `sha256:${sha256(canonicalJSONStringify(contractHashPayload(baseContract)))}`,
    };
}

export function buildPluginStateContract({
    effectID,
    status,
    storedState = [],
}: {
    effectID: string;
    status: unknown;
    storedState?: StoredStateContractSource[];
}): EffectPluginStateContract {
    if (!isPlainObject(status) || !isPlainObject(status.details) || !Array.isArray(status.details.inputs)) {
        throw new Error("Cmajor status details.inputs must be an array.");
    }

    const parameters = status.details.inputs.filter((endpoint) => (
        isPlainObject(endpoint)
        && endpoint.purpose === "parameter"
        && !(isPlainObject(endpoint.annotation) && endpoint.annotation.hidden === true)
    ));

    return buildCanonicalPluginStateContract({
        effectID,
        parameters,
        storedState,
    });
}

export function clonePluginStateContract(contract: EffectPluginStateContract): EffectPluginStateContract {
    return {
        effectID: contract.effectID,
        parameters: contract.parameters.map((parameter) => ({ ...parameter })),
        storedState: contract.storedState.map((entry) => ({ ...entry })),
        hash: contract.hash,
    };
}
