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
    getContract: () => EffectStoredStateContract;
};

const cmajorEndpointIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function normalizeStoredStateContract(entry: StoredStateContractSource): EffectStoredStateContract {
    const rawEntry = "getContract" in entry && typeof entry.getContract === "function"
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

function rightRotate(value: number, bits: number) {
    return (value >>> bits) | (value << (32 - bits));
}

function sha256(message: string): string {
    const bytes = new TextEncoder().encode(message);
    const bitLength = bytes.length * 8;
    const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
    const padded = new Uint8Array(paddedLength);
    const hash = [
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    const constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const words = new Uint32Array(64);

    padded.set(bytes);
    padded[bytes.length] = 0x80;

    for (let index = 0; index < 8; index += 1) {
        padded[padded.length - 1 - index] = (bitLength / (2 ** (8 * index))) & 0xff;
    }

    for (let offset = 0; offset < padded.length; offset += 64) {
        for (let index = 0; index < 16; index += 1) {
            const byteIndex = offset + (index * 4);
            words[index] = (
                (padded[byteIndex] << 24)
                | (padded[byteIndex + 1] << 16)
                | (padded[byteIndex + 2] << 8)
                | padded[byteIndex + 3]
            ) >>> 0;
        }

        for (let index = 16; index < 64; index += 1) {
            const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
            const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
            words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
        }

        let [a, b, c, d, e, f, g, h] = hash;

        for (let index = 0; index < 64; index += 1) {
            const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ ((~e) & g);
            const temp1 = (h + s1 + ch + constants[index] + words[index]) >>> 0;
            const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (s0 + maj) >>> 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        hash[0] = (hash[0] + a) >>> 0;
        hash[1] = (hash[1] + b) >>> 0;
        hash[2] = (hash[2] + c) >>> 0;
        hash[3] = (hash[3] + d) >>> 0;
        hash[4] = (hash[4] + e) >>> 0;
        hash[5] = (hash[5] + f) >>> 0;
        hash[6] = (hash[6] + g) >>> 0;
        hash[7] = (hash[7] + h) >>> 0;
    }

    return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
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
