import type { PatchConnectionLike } from "./cmajor-react";
import { LANE_SOLO_ENDPOINT_ID } from "./lane-state";
import type { LaneStateV2 } from "./lane-state-v2";
import {
    compileLaneSoloUpload,
    createLaneSoloState,
    reconcileLaneSoloState,
    toggleLaneBranchSolo,
    type LaneSoloState,
} from "./lane-solo-state";

type LaneSoloAuditionStore = {
    state: LaneSoloState;
    laneState: LaneStateV2 | null;
    readonly listeners: Set<() => void>;
};

const stores = new WeakMap<object, LaneSoloAuditionStore>();
const EMPTY_LANE_SOLO_STATE = createLaneSoloState();

function getStore(
    connection: PatchConnectionLike,
    laneState: LaneStateV2,
): LaneSoloAuditionStore {
    const key = connection as unknown as object;
    const existing = stores.get(key);
    if (existing !== undefined) {
        return existing;
    }
    const created: LaneSoloAuditionStore = {
        state: EMPTY_LANE_SOLO_STATE,
        laneState,
        listeners: new Set(),
    };
    stores.set(key, created);
    // A native editor can be destroyed while its processor keeps running.
    // Its replacement owns a new patch-connection object, so synchronize the
    // empty presentation state once before that UI can show every Solo as off.
    connection.sendEventOrValue?.(
        LANE_SOLO_ENDPOINT_ID,
        compileLaneSoloUpload(EMPTY_LANE_SOLO_STATE, laneState),
    );
    return created;
}

function soloStatesEqual(left: LaneSoloState, right: LaneSoloState): boolean {
    const leftEntries = Object.entries(left.selectedBranchByGroup);
    const rightEntries = Object.entries(right.selectedBranchByGroup);
    return leftEntries.length === rightEntries.length
        && leftEntries.every(([groupId, branchIndex]) => (
            right.selectedBranchByGroup[groupId] === branchIndex
        ));
}

function publishState(
    connection: PatchConnectionLike,
    store: LaneSoloAuditionStore,
    state: LaneSoloState,
    laneState: LaneStateV2,
): void {
    store.state = state;
    store.laneState = laneState;
    connection.sendEventOrValue?.(
        LANE_SOLO_ENDPOINT_ID,
        compileLaneSoloUpload(state, laneState),
    );
    for (const listener of [...store.listeners]) {
        listener();
    }
}

/** Read the instance-owned audition overlay without hydrating or persisting it. */
export function readLaneSoloAudition(connection: PatchConnectionLike): LaneSoloState {
    return stores.get(connection as unknown as object)?.state ?? EMPTY_LANE_SOLO_STATE;
}

/** Subscribe a mounted rack surface to transient Solo changes on this patch instance. */
export function subscribeLaneSoloAudition(
    connection: PatchConnectionLike,
    laneState: LaneStateV2,
    listener: () => void,
): () => void {
    const store = getStore(connection, laneState);
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
}

/** Toggle one group-local Solo and send the complete transient runtime overlay. */
export function toggleLaneSoloAudition(
    connection: PatchConnectionLike,
    laneState: LaneStateV2,
    groupId: string,
    branchIndex: number,
): LaneSoloState | null {
    const store = getStore(connection, laneState);
    const nextState = toggleLaneBranchSolo(store.state, laneState, groupId, branchIndex);
    if (nextState === null) {
        return null;
    }
    publishState(connection, store, nextState, laneState);
    return nextState;
}

/** Reconcile Solo after a rack edit, clearing only removed groups or branches. */
export function reconcileLaneSoloAudition(
    connection: PatchConnectionLike,
    previousLaneState: LaneStateV2,
    nextLaneState: LaneStateV2,
): LaneSoloState {
    const store = stores.get(connection as unknown as object);
    if (store === undefined) {
        return EMPTY_LANE_SOLO_STATE;
    }
    store.laneState = nextLaneState;
    const nextSoloState = reconcileLaneSoloState(store.state, previousLaneState, nextLaneState);
    if (!soloStatesEqual(store.state, nextSoloState)) {
        publishState(connection, store, nextSoloState, nextLaneState);
    }
    return store.state;
}

/** Clear every active Solo after Init or a successful preset/sound load. */
export function clearLaneSoloAudition(connection: PatchConnectionLike): boolean {
    const store = stores.get(connection as unknown as object);
    if (store === undefined || store.laneState === null
            || Object.keys(store.state.selectedBranchByGroup).length === 0) {
        return false;
    }
    publishState(connection, store, EMPTY_LANE_SOLO_STATE, store.laneState);
    return true;
}
