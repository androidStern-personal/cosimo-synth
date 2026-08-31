import type { PatchConnectionLike } from "./cmajor-react";
import type { LaneDeviceInstance, LaneDeviceType } from "./lane-modulation-targets";
import {
    LEGACY_LANE_DEVICE_PARAM_ENDPOINTS,
    PRE_CHORUS_LEGACY_CLAMP_ENDPOINTS,
    LANE_SLOT_ORDINAL_COUNT,
    LANE_SLOT_PARAM_COUNT,
    buildLaneSlotParamValues,
    getLaneSlotId,
    laneDeviceParamEndpoints,
    materializeLaneDeviceParams,
} from "./lane-slot-params";
import { getRackEffectDescriptor } from "./rack-parameter-descriptors";
import {
    EFFECT_ID_TO_LANE_TYPE,
    LANE_TYPE_TO_EFFECT_ID,
    LANE_BRANCH_TAG_BITS,
    LANE_BRANCH_TAG_SHIFT,
    LANE_CHAIN_SLOT_COUNT,
    LANE_MAX_BANDS_PER_SPLIT,
    LANE_MAX_BRANCHES_PER_GROUP,
    LANE_MAX_CHAIN_LENGTH,
    LANE_PARALLEL_SLOT_BASE,
    LANE_PARALLEL_UNIT_COUNT,
    LANE_OUTPUT_CONTROL_ENDPOINT_ID,
    LANE_SLOT_PARAMS_ENDPOINT_ID,
    LANE_SPLIT_PARAM_XOVER_HIGH_HZ,
    LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_ENABLED,
    LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_OFFSET_SEMITONES,
    LANE_SPLIT_PARAM_XOVER_LOW_HZ,
    LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_ENABLED,
    LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_OFFSET_SEMITONES,
    LANE_SPLIT_SLOT_BASE,
    LANE_SPLIT_UNIT_COUNT,
    LANE_TOPOLOGY_ENDPOINT_ID,
    RACK_EFFECT_ORDER,
    createDefaultLaneState,
    decodeLaneBranchTag,
    decodeLaneSlotId,
    encodeLaneSlotWithBranchTag,
    isLaneGroupMarkerSlot,
    isLaneSplitMarkerSlot,
    parseLaneState,
    type LaneState,
} from "./lane-state";
import { getLaneKeyTrackEndpoints } from "./key-track";
import {
    EFFECT_OUTPUT_TRIM_MAX_DB,
    EFFECT_OUTPUT_TRIM_SILENCE_DB,
    effectOutputTrimHostEndpointID,
    effectOutputTrimLaneEndpointID,
    parseEffectOutputTrimHostEndpointID,
} from "./effect-output-trim";

/**
 * lane.v2 — the device-instance + topology-tree document (M3).
 *
 * v1 pins one device of each type in a serial permutation; v2 is the general
 * form the subway map renders and the marker-grammar wire carries: an
 * INSTANCE TABLE (up to the pool's five instances per type) and a CHAIN TREE
 * whose nodes are device placements or groups. A group's branches hold
 * device placements only — exactly as expressive as the wire grammar, which
 * cannot represent nesting (a marker inside a group closes it).
 *
 * Identity is structural, not positional:
 *  - `delay#2` is the instance id everywhere (documents, modulation targets,
 *    pickers), and instance #n statically holds slot ordinal n-1 — slot
 *    assignment is the identity map, so a route can never silently retarget.
 *  - `parallel#n` / `split#n` name marker UNITS the same way (unit n-1), so
 *    a group keeps its engine slot — and a split keeps its filter state —
 *    across chain reorders.
 *
 * The document stores what the wire validates: crossovers live in the
 * engine's 40..18000 clamp range, fan-outs in 2..4 (parallel) / 2..3
 * (split), and the flattened chain — placements plus one marker per group —
 * fits one topology upload. Parsing validates and never coerces (C11);
 * deserializing falls back to the clean default, upgrading v1 documents in
 * place so existing patches load unchanged.
 */

export const LANE_SPLIT_XOVER_MIN_HZ = 40;
export const LANE_SPLIT_XOVER_MAX_HZ = 18000;

/** Device types in stable identity order (the RACK_EFFECT_ORDER mirror). */
export const LANE_DEVICE_TYPE_ORDER: ReadonlyArray<LaneDeviceType> =
    RACK_EFFECT_ORDER.map((effectId) => EFFECT_ID_TO_LANE_TYPE[effectId]);

export type LaneDeviceRecordV2 = {
    readonly params: Readonly<Record<string, number>>;
};

export type LaneDevicePlacementV2 = {
    readonly kind: "device";
    readonly deviceId: string;
    readonly enabled: boolean;
};

export type LaneParallelGroupV2 = {
    readonly kind: "parallel";
    readonly groupId: string;
    readonly enabled: boolean;
    readonly branches: ReadonlyArray<ReadonlyArray<LaneDevicePlacementV2>>;
};

export type LaneSplitGroupV2 = {
    readonly kind: "split";
    readonly groupId: string;
    readonly enabled: boolean;
    readonly xoverLowHz: number;
    readonly xoverHighHz: number;
    readonly xoverLowKeyTrackEnabled: boolean;
    readonly xoverLowKeyTrackOffsetSemitones: number;
    readonly xoverHighKeyTrackEnabled: boolean;
    readonly xoverHighKeyTrackOffsetSemitones: number;
    readonly branches: ReadonlyArray<ReadonlyArray<LaneDevicePlacementV2>>;
};

export type LaneGroupV2 = LaneParallelGroupV2 | LaneSplitGroupV2;
export type LaneChainNodeV2 = LaneDevicePlacementV2 | LaneGroupV2;

/** Controls around the complete editable lane. Bypass never overwrites Mix. */
export type LaneOutputState = {
    readonly mix: number;
    readonly bypassed: boolean;
};

export type LaneStateV2 = {
    readonly format: "cosimo.lane";
    readonly version: 2;
    readonly output: LaneOutputState;
    readonly devices: Readonly<Record<string, LaneDeviceRecordV2>>;
    readonly chain: ReadonlyArray<LaneChainNodeV2>;
};

export type LaneStateV2ParseOutcome =
    | { readonly _tag: "ok"; readonly value: LaneStateV2 }
    | { readonly _tag: "err"; readonly message: string };

export type ParsedLaneInstanceId = {
    readonly deviceType: LaneDeviceType;
    readonly instanceNumber: number;
};

const LANE_INSTANCE_ID_PATTERN = /^([a-zA-Z]+)#([1-9][0-9]*)$/;
const LANE_GROUP_ID_PATTERN = /^(parallel|split)#([1-9][0-9]*)$/;

/** Parse a `delay#2`-style instance id within the pool's ordinal range. */
export function parseLaneInstanceId(value: unknown): ParsedLaneInstanceId | null {
    if (typeof value !== "string") {
        return null;
    }
    const match = LANE_INSTANCE_ID_PATTERN.exec(value);
    if (match === null) {
        return null;
    }
    const deviceType = LANE_DEVICE_TYPE_ORDER.find((candidate) => candidate === match[1]);
    if (deviceType === undefined) {
        return null;
    }
    const instanceNumber = Number(match[2]);
    if (instanceNumber > LANE_SLOT_ORDINAL_COUNT) {
        return null;
    }
    return { deviceType, instanceNumber };
}

type ParsedLaneGroupId = {
    readonly groupKind: "parallel" | "split";
    readonly unitNumber: number;
};

function parseLaneGroupId(value: unknown): ParsedLaneGroupId | null {
    if (typeof value !== "string") {
        return null;
    }
    const match = LANE_GROUP_ID_PATTERN.exec(value);
    if (match === null) {
        return null;
    }
    const groupKind = match[1] as "parallel" | "split";
    const unitNumber = Number(match[2]);
    const unitCount = groupKind === "parallel" ? LANE_PARALLEL_UNIT_COUNT : LANE_SPLIT_UNIT_COUNT;
    if (unitNumber > unitCount) {
        return null;
    }
    return { groupKind, unitNumber };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
    const own = Reflect.ownKeys(value);
    return own.length === keys.length
        && own.every((key) => typeof key === "string" && keys.includes(key));
}

function err(message: string): LaneStateV2ParseOutcome {
    return { _tag: "err", message: `lane.v2 ${message}` };
}

function parseDeviceRecord(deviceId: string, input: unknown):
    { record: LaneDeviceRecordV2 } | { failure: LaneStateV2ParseOutcome } {
    const parsedId = parseLaneInstanceId(deviceId);
    if (parsedId === null) {
        return { failure: err(`device id ${deviceId} is not a pool instance`) };
    }
    if (!isRecord(input) || !hasExactKeys(input, ["params"]) || !isRecord(input.params)) {
        return { failure: err(`device ${deviceId} must be { params }`) };
    }
    const endpoints = laneDeviceParamEndpoints(parsedId.deviceType);
    const effectId = LANE_TYPE_TO_EFFECT_ID.get(parsedId.deviceType);
    if (effectId === undefined) {
        return { failure: err(`device ${deviceId} has no effect descriptor`) };
    }
    const presentationEndpoints = getRackEffectDescriptor(effectId).parameters
        .map((descriptor) => descriptor.endpointID);
    const inputParams = input.params as Record<string, unknown>;
    const inputKeys = Object.keys(inputParams);
    const hasShape = (expected: ReadonlyArray<string>) => inputKeys.length === expected.length
        && inputKeys.every((key) => expected.includes(key));
    const trimEndpointID = effectOutputTrimLaneEndpointID(parsedId.deviceType);
    const currentLegacyEndpoints = [
        ...LEGACY_LANE_DEVICE_PARAM_ENDPOINTS[parsedId.deviceType],
        trimEndpointID,
    ];
    const currentPreClampChorusEndpoints = [
        ...PRE_CHORUS_LEGACY_CLAMP_ENDPOINTS,
        trimEndpointID,
    ];
    // T78 deliberately introduces no old-preset compatibility path. Both
    // full and previously supported supplemental shapes must already carry
    // Output Trim; pre-Output-Trim records receive no hidden 0 dB migration.
    const hasCurrentShape = inputKeys.includes(trimEndpointID)
        && (hasShape(endpoints)
            || hasShape(presentationEndpoints)
            || hasShape(currentLegacyEndpoints)
            || (parsedId.deviceType === "chorus" && hasShape(currentPreClampChorusEndpoints)));
    if (!hasCurrentShape) {
        return { failure: err(`device ${deviceId} must carry every parameter once`) };
    }
    for (const endpointID of inputKeys) {
        const value = inputParams[endpointID];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return { failure: err(`device ${deviceId}.${endpointID} must be a finite number`) };
        }
    }
    return { record: { params: materializeLaneDeviceParams(parsedId.deviceType, inputParams) } };
}

function parsePlacement(input: unknown, deviceIds: ReadonlySet<string>):
    { placement: LaneDevicePlacementV2 } | { failure: LaneStateV2ParseOutcome } {
    if (!isRecord(input) || input.kind !== "device") {
        return { failure: err("branches may hold device placements only") };
    }
    if (!hasExactKeys(input, ["kind", "deviceId", "enabled"])) {
        return { failure: err("a device placement is { kind, deviceId, enabled }") };
    }
    if (typeof input.deviceId !== "string" || !deviceIds.has(input.deviceId)) {
        return { failure: err(`placement references unknown device ${String(input.deviceId)}`) };
    }
    if (typeof input.enabled !== "boolean") {
        return { failure: err(`placement of ${input.deviceId} needs a boolean enable`) };
    }
    return { placement: { kind: "device", deviceId: input.deviceId, enabled: input.enabled } };
}

function isValidCrossoverHz(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value)
        && value >= LANE_SPLIT_XOVER_MIN_HZ && value <= LANE_SPLIT_XOVER_MAX_HZ;
}

function createDefaultLaneOutputState(): LaneOutputState {
    return { mix: 1, bypassed: false };
}

function parseLaneOutputState(input: unknown): LaneOutputState | null {
    if (!isRecord(input) || !hasExactKeys(input, ["mix", "bypassed"])) {
        return null;
    }
    if (typeof input.mix !== "number" || !Number.isFinite(input.mix)
            || input.mix < 0 || input.mix > 1 || typeof input.bypassed !== "boolean") {
        return null;
    }
    return { mix: input.mix, bypassed: input.bypassed };
}

/** Parse unknown persisted data into the complete current lane.v2 schema. */
export function parseLaneStateV2(input: unknown): LaneStateV2ParseOutcome {
    let document: unknown = input;
    if (typeof input === "string") {
        try {
            document = JSON.parse(input);
        } catch (cause: unknown) {
            const detail = cause instanceof Error ? cause.message : String(cause);
            return err(`is not valid JSON: ${detail}`);
        }
    }
    if (!isRecord(document)
            || !hasExactKeys(document, ["format", "version", "output", "devices", "chain"])) {
        return err("must be { format, version, output, devices, chain }");
    }
    if (document.format !== "cosimo.lane" || document.version !== 2) {
        return err("must be cosimo.lane version 2");
    }
    if (!isRecord(document.devices)) {
        return err("devices must be an object");
    }
    if (!Array.isArray(document.chain)) {
        return err("chain must be an array");
    }
    const output = parseLaneOutputState(document.output);
    if (output === null) {
        return err("output must be { mix: 0..1, bypassed: boolean }");
    }

    const devices: Record<string, LaneDeviceRecordV2> = {};
    for (const deviceId of Reflect.ownKeys(document.devices)) {
        if (typeof deviceId !== "string") {
            return err("device ids must be strings");
        }
        const parsed = parseDeviceRecord(deviceId, document.devices[deviceId]);
        if ("failure" in parsed) {
            return parsed.failure;
        }
        devices[deviceId] = parsed.record;
    }

    const deviceIds = new Set(Object.keys(devices));
    const placementCounts = new Map<string, number>();
    const seenGroupIds = new Set<string>();
    const chain: LaneChainNodeV2[] = [];
    let wireEntryCount = 0;

    const takePlacement = (input2: unknown):
        { placement: LaneDevicePlacementV2 } | { failure: LaneStateV2ParseOutcome } => {
        const parsed = parsePlacement(input2, deviceIds);
        if ("placement" in parsed) {
            placementCounts.set(parsed.placement.deviceId,
                                (placementCounts.get(parsed.placement.deviceId) ?? 0) + 1);
            wireEntryCount += 1;
        }
        return parsed;
    };

    for (const rawNode of document.chain) {
        if (!isRecord(rawNode)) {
            return err("chain nodes must be objects");
        }
        if (rawNode.kind === "device") {
            const parsed = takePlacement(rawNode);
            if ("failure" in parsed) {
                return parsed.failure;
            }
            chain.push(parsed.placement);
            continue;
        }
        if (rawNode.kind !== "parallel" && rawNode.kind !== "split") {
            return err(`unknown chain node kind ${String(rawNode.kind)}`);
        }

        const isSplit = rawNode.kind === "split";
        const legacySplitKeys = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"];
        const currentSplitKeys = [
            "kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz",
            "xoverLowKeyTrackEnabled", "xoverLowKeyTrackOffsetSemitones",
            "xoverHighKeyTrackEnabled", "xoverHighKeyTrackOffsetSemitones", "branches",
        ];
        const expectedKeys = isSplit ? currentSplitKeys : ["kind", "groupId", "enabled", "branches"];
        const isLegacySplit = isSplit && hasExactKeys(rawNode, legacySplitKeys);
        if (!hasExactKeys(rawNode, expectedKeys) && !isLegacySplit) {
            return err(`a ${rawNode.kind} group is { ${expectedKeys.join(", ")} }`);
        }
        const groupId = parseLaneGroupId(rawNode.groupId);
        if (groupId === null || groupId.groupKind !== rawNode.kind) {
            return err(`group id ${String(rawNode.groupId)} does not name a ${rawNode.kind} unit`);
        }
        if (seenGroupIds.has(String(rawNode.groupId))) {
            return err(`group ${String(rawNode.groupId)} is used twice`);
        }
        seenGroupIds.add(String(rawNode.groupId));
        if (typeof rawNode.enabled !== "boolean") {
            return err(`group ${String(rawNode.groupId)} needs a boolean enable`);
        }
        const maxBranches = isSplit ? LANE_MAX_BANDS_PER_SPLIT : LANE_MAX_BRANCHES_PER_GROUP;
        if (!Array.isArray(rawNode.branches)
                || rawNode.branches.length < 2 || rawNode.branches.length > maxBranches) {
            return err(`group ${String(rawNode.groupId)} needs 2..${maxBranches} branches`);
        }
        if (isSplit && (!isValidCrossoverHz(rawNode.xoverLowHz) || !isValidCrossoverHz(rawNode.xoverHighHz))) {
            return err(`group ${String(rawNode.groupId)} crossovers must sit in `
                + `${LANE_SPLIT_XOVER_MIN_HZ}..${LANE_SPLIT_XOVER_MAX_HZ} Hz`);
        }
        if (isSplit && !isLegacySplit && (
            typeof rawNode.xoverLowKeyTrackEnabled !== "boolean"
            || typeof rawNode.xoverHighKeyTrackEnabled !== "boolean"
            || typeof rawNode.xoverLowKeyTrackOffsetSemitones !== "number"
            || !Number.isFinite(rawNode.xoverLowKeyTrackOffsetSemitones)
            || typeof rawNode.xoverHighKeyTrackOffsetSemitones !== "number"
            || !Number.isFinite(rawNode.xoverHighKeyTrackOffsetSemitones)
        )) {
            return err(`group ${String(rawNode.groupId)} Key Track state must be finite`);
        }

        wireEntryCount += 1;
        const branches: LaneDevicePlacementV2[][] = [];
        for (const rawBranch of rawNode.branches) {
            if (!Array.isArray(rawBranch)) {
                return err(`group ${String(rawNode.groupId)} branches must be arrays`);
            }
            const branch: LaneDevicePlacementV2[] = [];
            for (const rawPlacement of rawBranch) {
                const parsed = takePlacement(rawPlacement);
                if ("failure" in parsed) {
                    return parsed.failure;
                }
                branch.push(parsed.placement);
            }
            branches.push(branch);
        }

        chain.push(isSplit
            ? {
                kind: "split",
                groupId: String(rawNode.groupId),
                enabled: rawNode.enabled,
                xoverLowHz: rawNode.xoverLowHz as number,
                xoverHighHz: rawNode.xoverHighHz as number,
                xoverLowKeyTrackEnabled: isLegacySplit ? false : rawNode.xoverLowKeyTrackEnabled as boolean,
                xoverLowKeyTrackOffsetSemitones: isLegacySplit ? 0 : rawNode.xoverLowKeyTrackOffsetSemitones as number,
                xoverHighKeyTrackEnabled: isLegacySplit ? false : rawNode.xoverHighKeyTrackEnabled as boolean,
                xoverHighKeyTrackOffsetSemitones: isLegacySplit ? 0 : rawNode.xoverHighKeyTrackOffsetSemitones as number,
                branches,
            }
            : {
                kind: "parallel",
                groupId: String(rawNode.groupId),
                enabled: rawNode.enabled,
                branches,
            });
    }

    // Placement is existence: the table and the tree are one bijection.
    // (Placements naming ids outside the table were rejected as they parsed.)
    for (const deviceId of deviceIds) {
        if ((placementCounts.get(deviceId) ?? 0) !== 1) {
            return err(`device ${deviceId} must be placed exactly once`);
        }
    }
    if (wireEntryCount > LANE_MAX_CHAIN_LENGTH) {
        return err(`flattens to ${wireEntryCount} wire entries; the topology upload holds ${LANE_MAX_CHAIN_LENGTH}`);
    }

    return { _tag: "ok", value: { format: "cosimo.lane", version: 2, output, devices, chain } };
}

/** Upgrade a parsed v1 document: eight instance-#1 devices, serial chain.
    Params serialize in WIRE order so upgrade -> serialize -> parse ->
    serialize is byte-stable (the echo-dedupe paths depend on it). */
export function upgradeLaneStateV1(state: LaneState): LaneStateV2 {
    const devices: Record<string, LaneDeviceRecordV2> = {};
    for (const effectId of RACK_EFFECT_ORDER) {
        const deviceType = EFFECT_ID_TO_LANE_TYPE[effectId];
        devices[`${deviceType}#1`] = {
            params: materializeLaneDeviceParams(deviceType, state.params[effectId]),
        };
    }
    return {
        format: "cosimo.lane",
        version: 2,
        output: createDefaultLaneOutputState(),
        devices,
        chain: state.order.map((effectId) => ({
            kind: "device",
            deviceId: `${EFFECT_ID_TO_LANE_TYPE[effectId]}#1`,
            enabled: state.enabled[effectId],
        })),
    };
}

const STARTER_DEVICE_IDS = ["distortion#1", "delay#1", "reverb#1"] as const;

/**
 * The fresh-instrument STARTER (M4): a compact bypassed line — drive →
 * delay → reverb — so the out-of-box sound stays the deployed dry voice
 * while the map opens with a short line and add-ghosts instead of eight
 * resident pills. Sliced from the v1 upgrade so params keep their wire
 * order (the serialize∘parse byte-stability rule) and their v1 default
 * values. Stored v1 documents still upgrade to all eight, untouched.
 */
export function createDefaultLaneStateV2(): LaneStateV2 {
    const legacy = upgradeLaneStateV1(createDefaultLaneState());
    const devices: Record<string, LaneDeviceRecordV2> = {};
    for (const deviceId of STARTER_DEVICE_IDS) {
        const record = legacy.devices[deviceId];
        if (record === undefined) {
            throw new Error(`The v1 default is missing starter device ${deviceId}`);
        }
        devices[deviceId] = record;
    }
    return {
        format: "cosimo.lane",
        version: 2,
        output: createDefaultLaneOutputState(),
        devices,
        chain: legacy.chain.filter((node) => (
            node.kind === "device" && (STARTER_DEVICE_IDS as ReadonlyArray<string>).includes(node.deviceId)
        )),
    };
}

/**
 * STRICT two-format parse: v2 verbatim, v1 upgraded in place, an error for
 * anything else (the v2 diagnosis leads — documents are v2 going forward).
 * The strict consumers (the bridge adapter, init presets) use this where
 * they used the v1 strict parse; the store uses the defaulting deserializer.
 */
export function parseLaneStateV2Compat(input: unknown): LaneStateV2ParseOutcome {
    const v2 = parseLaneStateV2(input);
    if (v2._tag === "ok") {
        return v2;
    }
    const v1 = parseLaneState(input);
    if (v1._tag === "ok") {
        return { _tag: "ok", value: upgradeLaneStateV1(v1.value) };
    }
    return v2;
}

/**
 * Deserialize persisted state: v2 verbatim, v1 upgraded in place, the clean
 * default for anything missing or corrupt.
 */
export function deserializeLaneStateV2(input: unknown): LaneStateV2 {
    if (input === undefined) {
        return createDefaultLaneStateV2();
    }
    const v2 = parseLaneStateV2(input);
    if (v2._tag === "ok") {
        return v2.value;
    }
    const v1 = parseLaneState(input);
    if (v1._tag === "ok") {
        return upgradeLaneStateV1(v1.value);
    }
    return createDefaultLaneStateV2();
}

/** Serialize the complete canonical lane.v2 document. */
export function serializeLaneStateV2(state: LaneStateV2): string {
    return JSON.stringify({
        format: "cosimo.lane",
        version: 2,
        output: state.output,
        devices: state.devices,
        chain: state.chain,
    });
}

/**
 * The patch's live devices in STABLE IDENTITY ORDER (type order, then
 * instance number) — the order the dynamic target domain lists devices in,
 * which deliberately never follows the chain: reordering the chain must not
 * reshuffle pickers.
 */
export function listLaneDeviceInstancesV2(state: LaneStateV2): ReadonlyArray<LaneDeviceInstance> {
    return Object.keys(state.devices)
        .map((instanceId) => {
            const parsed = parseLaneInstanceId(instanceId);
            if (parsed === null) {
                throw new Error(`Invalid lane instance id in state: ${instanceId}`);
            }
            return { instanceId, parsed };
        })
        .sort((a, b) =>
            (LANE_DEVICE_TYPE_ORDER.indexOf(a.parsed.deviceType)
                - LANE_DEVICE_TYPE_ORDER.indexOf(b.parsed.deviceType))
            || (a.parsed.instanceNumber - b.parsed.instanceNumber))
        .map(({ instanceId, parsed }) => ({ instanceId, deviceType: parsed.deviceType }));
}

function deviceSlotId(deviceId: string): number {
    const parsed = parseLaneInstanceId(deviceId);
    if (parsed === null) {
        throw new Error(`Invalid lane instance id in state: ${deviceId}`);
    }
    return getLaneSlotId(parsed.deviceType, parsed.instanceNumber - 1);
}

function groupMarkerSlotId(group: LaneGroupV2): number {
    const parsed = parseLaneGroupId(group.groupId);
    if (parsed === null) {
        throw new Error(`Invalid lane group id in state: ${group.groupId}`);
    }
    const base = parsed.groupKind === "parallel" ? LANE_PARALLEL_SLOT_BASE : LANE_SPLIT_SLOT_BASE;
    return base + (parsed.unitNumber - 1);
}

/** The engine slot a split group's crossover record addresses, or null for
    anything that is not a split group id. */
export function laneSplitMarkerSlotId(groupId: string): number | null {
    const parsed = parseLaneGroupId(groupId);
    return parsed === null || parsed.groupKind !== "split"
        ? null
        : LANE_SPLIT_SLOT_BASE + (parsed.unitNumber - 1);
}

export type CompiledLaneTopologyUpload = {
    readonly chainLength: number;
    readonly slotIds: ReadonlyArray<number>;
    readonly enabledMask: number;
};

/**
 * Flatten the tree to the marker-grammar wire: a group emits its marker
 * (tag = branch/band count, enable bit = group bypass), then each branch's
 * placements under tags 1..N — empty branches emit nothing, which the
 * engine reads as a representable skip.
 */
export function compileLaneTopologyUpload(state: LaneStateV2): CompiledLaneTopologyUpload {
    const slotIds = new Array<number>(LANE_MAX_CHAIN_LENGTH).fill(0);
    let enabledMask = 0;
    let position = 0;

    const emit = (slotId: number, branchTag: number, enabled: boolean): void => {
        slotIds[position] = encodeLaneSlotWithBranchTag(slotId, branchTag);
        if (enabled) {
            enabledMask |= 1 << position;
        }
        position += 1;
    };

    for (const node of state.chain) {
        if (node.kind === "device") {
            emit(deviceSlotId(node.deviceId), 0, node.enabled);
            continue;
        }
        emit(groupMarkerSlotId(node), node.branches.length, node.enabled);
        node.branches.forEach((branch, branchIndex) => {
            for (const placement of branch) {
                emit(deviceSlotId(placement.deviceId), branchIndex + 1, placement.enabled);
            }
        });
    }

    return { chainLength: position, slotIds, enabledMask };
}

/**
 * TS mirror of the engine's topology validation (EffectsRack.cmajor's
 * isValidLaneTopology), so the adapter can fail loudly BEFORE sending a
 * malformed upload the engine would silently count and drop. The compiler's
 * output always passes; drift between the mirrors is pinned by test on both
 * sides of the wire.
 */
export function validateCompiledLaneTopology(upload: CompiledLaneTopologyUpload): boolean {
    if (!Number.isInteger(upload.chainLength)
            || upload.chainLength < 0 || upload.chainLength > LANE_MAX_CHAIN_LENGTH) {
        return false;
    }

    const seen = new Set<number>();
    let openGroupFanout = 0;
    let lastMemberTag = 0;

    for (let positionIndex = 0; positionIndex < upload.chainLength; positionIndex += 1) {
        const encoded = upload.slotIds[positionIndex];
        if (!Number.isInteger(encoded)
                || (encoded >> (LANE_BRANCH_TAG_SHIFT + LANE_BRANCH_TAG_BITS)) !== 0) {
            return false;
        }
        const slotId = decodeLaneSlotId(encoded);
        const tag = decodeLaneBranchTag(encoded);
        if (slotId >= LANE_CHAIN_SLOT_COUNT) {
            return false;
        }
        if (isLaneGroupMarkerSlot(slotId)) {
            const maxFanout = isLaneSplitMarkerSlot(slotId)
                ? LANE_MAX_BANDS_PER_SPLIT
                : LANE_MAX_BRANCHES_PER_GROUP;
            if (tag < 2 || tag > maxFanout) {
                return false;
            }
            openGroupFanout = tag;
            lastMemberTag = 0;
        } else if (tag === 0) {
            openGroupFanout = 0;
            lastMemberTag = 0;
        } else {
            if (openGroupFanout === 0 || tag > openGroupFanout || tag < lastMemberTag) {
                return false;
            }
            lastMemberTag = tag;
        }
        if (seen.has(slotId)) {
            return false;
        }
        seen.add(slotId);
    }

    return Number.isInteger(upload.enabledMask)
        && upload.enabledMask >= 0
        && upload.enabledMask < (1 << upload.chainLength);
}

function buildLaneSplitParamValues(group: LaneSplitGroupV2): number[] {
    const values = new Array<number>(LANE_SLOT_PARAM_COUNT).fill(0);
    values[LANE_SPLIT_PARAM_XOVER_LOW_HZ] = group.xoverLowHz;
    values[LANE_SPLIT_PARAM_XOVER_HIGH_HZ] = group.xoverHighHz;
    values[LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_ENABLED] = group.xoverLowKeyTrackEnabled ? 1 : 0;
    values[LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_OFFSET_SEMITONES] = group.xoverLowKeyTrackOffsetSemitones;
    values[LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_ENABLED] = group.xoverHighKeyTrackEnabled ? 1 : 0;
    values[LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_OFFSET_SEMITONES] = group.xoverHighKeyTrackOffsetSemitones;
    return values;
}

/**
 * The complete runtime replay for one lane.v2 document: whole-lane output,
 * every device instance's record, every split marker's crossover record, then
 * the one topology event. Output lands first so preset restore cannot flash
 * full-wet; parameter records still precede topology so anything entering the
 * committed chain snaps onto its record rather than a zeroed default.
 */
export function buildLaneRuntimeEventsV2(state: LaneStateV2): ReadonlyArray<{ readonly endpointID: string; readonly value: unknown }> {
    const events: Array<{ endpointID: string; value: unknown }> = [{
        endpointID: LANE_OUTPUT_CONTROL_ENDPOINT_ID,
        value: state.output,
    }];
    let deliverySerial = 0;

    for (const device of listLaneDeviceInstancesV2(state)) {
        const parsedId = parseLaneInstanceId(device.instanceId);
        if (parsedId === null) {
            throw new Error(`Invalid lane device identity during replay: ${device.instanceId}`);
        }
        events.push({
            endpointID: effectOutputTrimHostEndpointID(
                parsedId.deviceType,
                parsedId.instanceNumber,
            ),
            value: state.devices[device.instanceId].params[
                effectOutputTrimLaneEndpointID(parsedId.deviceType)
            ],
        });
        deliverySerial += 1;
        events.push({
            endpointID: LANE_SLOT_PARAMS_ENDPOINT_ID,
            value: {
                slotId: deviceSlotId(device.instanceId),
                deliverySerial,
                values: buildLaneSlotParamValues(device.deviceType,
                                                 state.devices[device.instanceId].params),
            },
        });
    }

    for (const node of state.chain) {
        if (node.kind === "split") {
            deliverySerial += 1;
            events.push({
                endpointID: LANE_SLOT_PARAMS_ENDPOINT_ID,
                value: {
                    slotId: groupMarkerSlotId(node),
                    deliverySerial,
                    values: buildLaneSplitParamValues(node),
                },
            });
        }
    }

    events.push({
        endpointID: LANE_TOPOLOGY_ENDPOINT_ID,
        value: compileLaneTopologyUpload(state),
    });

    return events;
}

/** Send a complete lane.v2 document as one logical commit. */
export function commitLaneStateV2(connection: PatchConnectionLike, state: LaneStateV2): void {
    for (const event of buildLaneRuntimeEventsV2(state)) {
        connection.sendEventOrValue?.(event.endpointID, event.value);
    }
}

//==============================================================================
// Tree editing (M4). Every op is pure: it returns a NEW document, the same
// document copy for a no-op, or null when the edit is not representable —
// unknown identity, a full unit pool, a non-empty branch removal, a wire
// overflow. Callers surface null as a refusal; they never coerce.

export const LANE_SPLIT_DEFAULT_XOVER_LOW_HZ = 800;
export const LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ = 2500;

/** A placement's document coordinates: a trunk chain index, or a position
    inside one group's branch. Also the drop-target grammar of the map. */
export type LaneDevicePathV2 =
    | { readonly kind: "trunk"; readonly index: number }
    | {
        readonly kind: "branch";
        readonly groupId: string;
        readonly branchIndex: number;
        readonly index: number;
      };

export function encodeLaneDevicePath(devicePath: LaneDevicePathV2): string {
    return devicePath.kind === "trunk"
        ? `trunk:${devicePath.index}`
        : `branch:${devicePath.groupId}:${devicePath.branchIndex}:${devicePath.index}`;
}

export function parseLaneDevicePath(value: unknown): LaneDevicePathV2 | null {
    if (typeof value !== "string") {
        return null;
    }
    const parts = value.split(":");
    if (parts[0] === "trunk" && parts.length === 2) {
        const index = Number(parts[1]);
        return Number.isInteger(index) && index >= 0 ? { kind: "trunk", index } : null;
    }
    if (parts[0] === "branch" && parts.length === 4) {
        const branchIndex = Number(parts[2]);
        const index = Number(parts[3]);
        if (parseLaneGroupId(parts[1]) === null
                || !Number.isInteger(branchIndex) || branchIndex < 0
                || !Number.isInteger(index) || index < 0) {
            return null;
        }
        return { kind: "branch", groupId: parts[1], branchIndex, index };
    }
    return null;
}

/** Locate a device's placement, or null when it is not in the document. */
export function findLaneDevicePath(state: LaneStateV2, deviceId: string): LaneDevicePathV2 | null {
    for (const [nodeIndex, node] of state.chain.entries()) {
        if (node.kind === "device") {
            if (node.deviceId === deviceId) {
                return { kind: "trunk", index: nodeIndex };
            }
            continue;
        }
        for (const [branchIndex, branch] of node.branches.entries()) {
            const index = branch.findIndex((placement) => placement.deviceId === deviceId);
            if (index >= 0) {
                return { kind: "branch", groupId: node.groupId, branchIndex, index };
            }
        }
    }
    return null;
}

function cloneChain(state: LaneStateV2): LaneChainNodeV2[] {
    return state.chain.map((node) => (
        node.kind === "device"
            ? { ...node }
            : { ...node, branches: node.branches.map((branch) => branch.map((placement) => ({ ...placement }))) }
    ));
}

function withChain(state: LaneStateV2, chain: LaneChainNodeV2[]): LaneStateV2 {
    return { ...state, chain };
}

/**
 * Move one device to a new position: along its own sequence, across
 * branches and bands, or between a branch and the trunk. The target indexes
 * the CURRENT rendered structure (the classic remove-then-insert-at-index
 * splice the v1 reorder used); trunk and in-branch indexes clamp to the
 * sequence end so dropping past the last row appends.
 */
export function moveLaneDevice(
    state: LaneStateV2,
    deviceId: string,
    target: LaneDevicePathV2,
): LaneStateV2 | null {
    const source = findLaneDevicePath(state, deviceId);
    if (source === null) {
        return null;
    }
    if (target.kind === "branch") {
        const group = state.chain.find((node) => node.kind !== "device" && node.groupId === target.groupId);
        if (group === undefined || group.kind === "device" || target.branchIndex >= group.branches.length) {
            return null;
        }
    }

    const chain = cloneChain(state);

    // Lift the placement out.
    let placement: LaneDevicePlacementV2;
    if (source.kind === "trunk") {
        placement = chain[source.index] as LaneDevicePlacementV2;
        chain.splice(source.index, 1);
    } else {
        const group = chain.find((node) => node.kind !== "device" && node.groupId === source.groupId) as LaneGroupV2;
        const branch = group.branches[source.branchIndex] as LaneDevicePlacementV2[];
        placement = branch[source.index];
        branch.splice(source.index, 1);
    }

    // Set it back down.
    if (target.kind === "trunk") {
        chain.splice(Math.min(target.index, chain.length), 0, placement);
    } else {
        const group = chain.find((node) => node.kind !== "device" && node.groupId === target.groupId) as LaneGroupV2;
        const branch = group.branches[target.branchIndex] as LaneDevicePlacementV2[];
        branch.splice(Math.min(target.index, branch.length), 0, placement);
    }

    return withChain(state, chain);
}

export function getLaneDeviceEnabled(state: LaneStateV2, deviceId: string): boolean | null {
    for (const node of state.chain) {
        if (node.kind === "device") {
            if (node.deviceId === deviceId) {
                return node.enabled;
            }
            continue;
        }
        for (const branch of node.branches) {
            const placement = branch.find((candidate) => candidate.deviceId === deviceId);
            if (placement !== undefined) {
                return placement.enabled;
            }
        }
    }
    return null;
}

export function setLaneDeviceEnabled(
    state: LaneStateV2,
    deviceId: string,
    enabled: boolean,
): LaneStateV2 | null {
    if (findLaneDevicePath(state, deviceId) === null) {
        return null;
    }
    return withChain(state, state.chain.map((node): LaneChainNodeV2 => {
        if (node.kind === "device") {
            return node.deviceId === deviceId ? { ...node, enabled } : node;
        }
        return {
            ...node,
            branches: node.branches.map((branch) => branch.map((placement) => (
                placement.deviceId === deviceId ? { ...placement, enabled } : placement
            ))),
        };
    }));
}

export function setLaneGroupEnabled(
    state: LaneStateV2,
    groupId: string,
    enabled: boolean,
): LaneStateV2 | null {
    if (!state.chain.some((node) => node.kind !== "device" && node.groupId === groupId)) {
        return null;
    }
    return withChain(state, state.chain.map((node) => (
        node.kind !== "device" && node.groupId === groupId ? { ...node, enabled } : node
    )) as LaneChainNodeV2[]);
}

export function setLaneDeviceParam(
    state: LaneStateV2,
    deviceId: string,
    endpointID: string,
    value: number,
): LaneStateV2 | null {
    const record = state.devices[deviceId];
    const parsedId = parseLaneInstanceId(deviceId);
    if (record === undefined || parsedId === null
            || !laneDeviceParamEndpoints(parsedId.deviceType).includes(endpointID)
            || !Number.isFinite(value)) {
        return null;
    }
    const params = { ...record.params, [endpointID]: value };
    if (parsedId.deviceType === "delay" && endpointID === "delayTimeMode" && value >= 0.5) {
        params.delayTimeKeyTrackEnabled = 0;
    }
    return {
        ...state,
        devices: {
            ...state.devices,
            [deviceId]: { params },
        },
    };
}

/**
 * Reconcile the lane document's durable Output Trim mirrors from the 40 real
 * host parameters. Host endpoints are runtime/automation authority; the lane
 * records carry the same value through topology, Init, presets, and links.
 */
export function synchronizeLaneOutputTrimsFromHostParameters(
    state: LaneStateV2,
    parameters: Readonly<Record<string, unknown>>,
): LaneStateV2 {
    let nextState = state;

    for (const [endpointID, rawValue] of Object.entries(parameters)) {
        const parsed = parseEffectOutputTrimHostEndpointID(endpointID);
        if (parsed === null || typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
            continue;
        }
        const deviceId = `${parsed.deviceType}#${parsed.instanceNumber}`;
        if (nextState.devices[deviceId] === undefined) {
            continue;
        }
        const value = Math.min(
            EFFECT_OUTPUT_TRIM_MAX_DB,
            Math.max(EFFECT_OUTPUT_TRIM_SILENCE_DB, rawValue),
        );
        if (Object.is(nextState.devices[deviceId]?.params[parsed.laneEndpointID], value)) {
            continue;
        }
        nextState = setLaneDeviceParam(
            nextState,
            deviceId,
            parsed.laneEndpointID,
            value,
        ) ?? nextState;
    }

    return nextState;
}

/** Shared lane transition: enabling centres the offset and leaves the ordinary value untouched. */
export function setLaneKeyTrackEnabled(
    state: LaneStateV2,
    deviceId: string,
    ordinaryEndpointID: string,
    enabled: boolean,
): LaneStateV2 | null {
    const endpoints = getLaneKeyTrackEndpoints(ordinaryEndpointID);
    const record = state.devices[deviceId];
    if (endpoints === null || record === undefined
            || !Object.hasOwn(record.params, ordinaryEndpointID)
            || !Object.hasOwn(record.params, endpoints.enabledEndpointID)
            || !Object.hasOwn(record.params, endpoints.offsetEndpointID)) {
        return null;
    }
    const params: Record<string, number> = {
        ...record.params,
        [endpoints.enabledEndpointID]: enabled ? 1 : 0,
    };
    if (enabled) {
        params[endpoints.offsetEndpointID] = 0;
        if (ordinaryEndpointID === "delayTime") {
            params.delayTimeMode = 0;
        }
    }
    return {
        ...state,
        devices: { ...state.devices, [deviceId]: { params } },
    };
}

/** Store a continuous whole-lane Mix without changing the bypass latch. */
export function setLaneOutputMix(state: LaneStateV2, mix: number): LaneStateV2 | null {
    if (!Number.isFinite(mix) || mix < 0 || mix > 1) {
        return null;
    }
    return { ...state, output: { ...state.output, mix } };
}

/** Toggle the whole lane without changing its stored Mix value. */
export function setLaneOutputBypassed(state: LaneStateV2, bypassed: boolean): LaneStateV2 | null {
    if (typeof bypassed !== "boolean") {
        return null;
    }
    return { ...state, output: { ...state.output, bypassed } };
}

function laneWireEntryCount(state: LaneStateV2): number {
    return Object.keys(state.devices).length
        + state.chain.filter((node) => node.kind !== "device").length;
}

function allocateLaneGroupId(state: LaneStateV2, groupKind: "parallel" | "split"): string | null {
    const unitCount = groupKind === "parallel" ? LANE_PARALLEL_UNIT_COUNT : LANE_SPLIT_UNIT_COUNT;
    const used = new Set(state.chain.flatMap((node) => (
        node.kind === groupKind ? [node.groupId] : []
    )));
    for (let unit = 1; unit <= unitCount; unit += 1) {
        if (!used.has(`${groupKind}#${unit}`)) {
            return `${groupKind}#${unit}`;
        }
    }
    return null;
}

/**
 * Wrap one TRUNK device in a fresh two-branch group, the device in the first
 * branch (the LO band for splits) and the other branch empty. Null when the
 * device sits inside a group already (the wire cannot nest), when the unit
 * pool for the kind is exhausted, or when the extra marker would overflow
 * the topology upload.
 */
export function wrapLaneDeviceInGroup(
    state: LaneStateV2,
    deviceId: string,
    groupKind: "parallel" | "split",
): LaneStateV2 | null {
    const source = findLaneDevicePath(state, deviceId);
    if (source === null || source.kind !== "trunk") {
        return null;
    }
    const groupId = allocateLaneGroupId(state, groupKind);
    if (groupId === null || laneWireEntryCount(state) + 1 > LANE_MAX_CHAIN_LENGTH) {
        return null;
    }

    const chain = cloneChain(state);
    const placement = chain[source.index] as LaneDevicePlacementV2;
    const group: LaneGroupV2 = groupKind === "split"
        ? {
            kind: "split",
            groupId,
            enabled: true,
            xoverLowHz: LANE_SPLIT_DEFAULT_XOVER_LOW_HZ,
            xoverHighHz: LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
            xoverLowKeyTrackEnabled: false,
            xoverLowKeyTrackOffsetSemitones: 0,
            xoverHighKeyTrackEnabled: false,
            xoverHighKeyTrackOffsetSemitones: 0,
            branches: [[placement], []],
          }
        : { kind: "parallel", groupId, enabled: true, branches: [[placement], []] };
    chain.splice(source.index, 1, group);
    return withChain(state, chain);
}

/** Splice a group's members serially back into the trunk at its position. */
export function dissolveLaneGroup(state: LaneStateV2, groupId: string): LaneStateV2 | null {
    const nodeIndex = state.chain.findIndex((node) => node.kind !== "device" && node.groupId === groupId);
    if (nodeIndex < 0) {
        return null;
    }
    const chain = cloneChain(state);
    const group = chain[nodeIndex] as LaneGroupV2;
    chain.splice(nodeIndex, 1, ...group.branches.flat());
    return withChain(state, chain);
}

export function setLaneSplitCrossoverHz(
    state: LaneStateV2,
    groupId: string,
    which: "low" | "high",
    hz: number,
): LaneStateV2 | null {
    if (!Number.isFinite(hz) || hz < LANE_SPLIT_XOVER_MIN_HZ || hz > LANE_SPLIT_XOVER_MAX_HZ) {
        return null;
    }
    const group = state.chain.find((node) => node.kind === "split" && node.groupId === groupId);
    if (group === undefined) {
        return null;
    }
    return withChain(state, state.chain.map((node) => (
        node.kind === "split" && node.groupId === groupId
            ? { ...node, [which === "low" ? "xoverLowHz" : "xoverHighHz"]: hz }
            : node
    )) as LaneChainNodeV2[]);
}

/** Split crossover equivalent of the shared device transition. */
export function setLaneSplitKeyTrackEnabled(
    state: LaneStateV2,
    groupId: string,
    which: "low" | "high",
    enabled: boolean,
): LaneStateV2 | null {
    const group = state.chain.find((node) => node.kind === "split" && node.groupId === groupId);
    if (group === undefined) {
        return null;
    }
    const enabledKey = which === "low"
        ? "xoverLowKeyTrackEnabled"
        : "xoverHighKeyTrackEnabled";
    const offsetKey = which === "low"
        ? "xoverLowKeyTrackOffsetSemitones"
        : "xoverHighKeyTrackOffsetSemitones";
    return withChain(state, state.chain.map((node) => (
        node.kind === "split" && node.groupId === groupId
            ? {
                ...node,
                [enabledKey]: enabled,
                ...(enabled ? { [offsetKey]: 0 } : {}),
            }
            : node
    )) as LaneChainNodeV2[]);
}

export function setLaneSplitKeyTrackOffset(
    state: LaneStateV2,
    groupId: string,
    which: "low" | "high",
    offsetSemitones: number,
): LaneStateV2 | null {
    if (!Number.isFinite(offsetSemitones)) {
        return null;
    }
    const group = state.chain.find((node) => node.kind === "split" && node.groupId === groupId);
    if (group === undefined) {
        return null;
    }
    const offsetKey = which === "low"
        ? "xoverLowKeyTrackOffsetSemitones"
        : "xoverHighKeyTrackOffsetSemitones";
    return withChain(state, state.chain.map((node) => (
        node.kind === "split" && node.groupId === groupId
            ? { ...node, [offsetKey]: Math.min(48, Math.max(-48, offsetSemitones)) }
            : node
    )) as LaneChainNodeV2[]);
}

/**
 * Grow or shrink a group's fan-out. Growth appends empty parallel branches;
 * a split growing 2 -> 3 inserts an EMPTY middle band, so the LO and HI
 * device sets stay put and the new band arrives silent. Shrinking removes
 * only EMPTY branches (the last parallel branch, the middle band) — devices
 * are never relocated implicitly; drag them out first.
 */
export function setLaneGroupBranchCount(
    state: LaneStateV2,
    groupId: string,
    branchCount: number,
): LaneStateV2 | null {
    const node = state.chain.find((candidate) => candidate.kind !== "device" && candidate.groupId === groupId);
    if (node === undefined || node.kind === "device") {
        return null;
    }
    const maxBranches = node.kind === "parallel" ? LANE_MAX_BRANCHES_PER_GROUP : LANE_MAX_BANDS_PER_SPLIT;
    if (!Number.isInteger(branchCount) || branchCount < 2 || branchCount > maxBranches) {
        return null;
    }

    const branches = node.branches.map((branch) => [...branch]);
    if (node.kind === "split") {
        if (branchCount === 3 && branches.length === 2) {
            branches.splice(1, 0, []);
        } else if (branchCount === 2 && branches.length === 3) {
            if (branches[1].length !== 0) {
                return null;
            }
            branches.splice(1, 1);
        }
    } else {
        while (branches.length < branchCount) {
            branches.push([]);
        }
        while (branches.length > branchCount) {
            if (branches[branches.length - 1].length !== 0) {
                return null;
            }
            branches.pop();
        }
    }

    return withChain(state, state.chain.map((candidate) => (
        candidate.kind !== "device" && candidate.groupId === groupId
            ? { ...candidate, branches }
            : candidate
    )) as LaneChainNodeV2[]);
}

/** One device type's default parameter record, descriptor initials in WIRE
    order (serialize stability rides on the order — see upgradeLaneStateV1). */
export function laneDefaultParamsForType(deviceType: LaneDeviceType): Record<string, number> {
    const effectId = LANE_TYPE_TO_EFFECT_ID.get(deviceType);
    if (effectId === undefined) {
        throw new Error(`Unknown lane device type: ${deviceType}`);
    }
    const descriptors = getRackEffectDescriptor(effectId).parameters;
    return Object.fromEntries(laneDeviceParamEndpoints(deviceType).map((endpointID) => [
        endpointID,
        descriptors.find((descriptor) => descriptor.endpointID === endpointID)?.initial ?? 0,
    ]));
}

function allocateLaneInstanceId(state: LaneStateV2, deviceType: LaneDeviceType): string | null {
    for (let instanceNumber = 1; instanceNumber <= LANE_SLOT_ORDINAL_COUNT; instanceNumber += 1) {
        const candidate = `${deviceType}#${instanceNumber}`;
        if (state.devices[candidate] === undefined) {
            return candidate;
        }
    }
    return null;
}

/**
 * Create a device of one type at a path — the ghost stubs' add affordance.
 * The smallest free instance number is allocated (the pool holds five per
 * type), the record starts on the type's descriptor defaults, and the
 * placement arrives ENABLED — adding a device is an audible act. Null when
 * the type's pool or the topology upload is full, or the path is invalid.
 */
export function addLaneDevice(
    state: LaneStateV2,
    deviceType: LaneDeviceType,
    target: LaneDevicePathV2,
): LaneStateV2 | null {
    const deviceId = allocateLaneInstanceId(state, deviceType);
    if (deviceId === null || laneWireEntryCount(state) + 1 > LANE_MAX_CHAIN_LENGTH) {
        return null;
    }
    if (target.kind === "branch") {
        const group = state.chain.find((node) => node.kind !== "device" && node.groupId === target.groupId);
        if (group === undefined || group.kind === "device" || target.branchIndex >= group.branches.length) {
            return null;
        }
    }

    const withDevice: LaneStateV2 = {
        ...state,
        devices: {
            ...state.devices,
            [deviceId]: { params: laneDefaultParamsForType(deviceType) },
        },
    };
    const placement: LaneDevicePlacementV2 = { kind: "device", deviceId, enabled: true };
    const chain = cloneChain(withDevice);
    if (target.kind === "trunk") {
        chain.splice(Math.min(target.index, chain.length), 0, placement);
    } else {
        const group = chain.find((node) => node.kind !== "device" && node.groupId === target.groupId) as LaneGroupV2;
        const branch = group.branches[target.branchIndex] as LaneDevicePlacementV2[];
        branch.splice(Math.min(target.index, branch.length), 0, placement);
    }
    return withChain(withDevice, chain);
}

/** Delete a device: the placement leaves the tree and the record leaves the
    table (placement is existence). Routes that target the instance stay
    stored and modulate an idle slot nothing reads. */
export function removeLaneDevice(state: LaneStateV2, deviceId: string): LaneStateV2 | null {
    const source = findLaneDevicePath(state, deviceId);
    if (source === null) {
        return null;
    }
    const chain = cloneChain(state);
    if (source.kind === "trunk") {
        chain.splice(source.index, 1);
    } else {
        const group = chain.find((node) => node.kind !== "device" && node.groupId === source.groupId) as LaneGroupV2;
        (group.branches[source.branchIndex] as LaneDevicePlacementV2[]).splice(source.index, 1);
    }
    const devices = { ...state.devices };
    delete devices[deviceId];
    return { ...state, devices, chain };
}

/** Replace one placed device at its exact path. The old device record leaves
    before the replacement is allocated, so choosing the same type resets it
    to normal defaults instead of retaining hidden parameter state. */
export function replaceLaneDevice(
    state: LaneStateV2,
    deviceId: string,
    replacementType: LaneDeviceType,
): LaneStateV2 | null {
    const source = findLaneDevicePath(state, deviceId);
    if (source === null) {
        return null;
    }
    const withoutDevice = removeLaneDevice(state, deviceId);
    if (withoutDevice === null) {
        return null;
    }
    return addLaneDevice(withoutDevice, replacementType, source);
}

/** Device ids in DISPATCH order — the flattened chain walk host surfaces
    (the seqfx bridge's ordered effect list) present. */
export function listLaneChainDeviceIds(state: LaneStateV2): ReadonlyArray<string> {
    return state.chain.flatMap((node) => (
        node.kind === "device"
            ? [node.deviceId]
            : node.branches.flatMap((branch) => branch.map((placement) => placement.deviceId))
    ));
}
