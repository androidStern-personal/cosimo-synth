import type { PluginStateDelivery, PluginStateDeliveryOutcome } from "../../kit/index";
import { buildLaneRuntimeEventsV2, type LaneStateV2 } from "../shared/lane-state-v2";
import { LANE_OUTPUT_CONTROL_ENDPOINT_ID, LANE_SLOT_PARAMS_ENDPOINT_ID, LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, LANE_TOPOLOGY_ENDPOINT_ID } from "../shared/lane-state";

const endpoints = [LANE_OUTPUT_CONTROL_ENDPOINT_ID, LANE_SLOT_PARAMS_ENDPOINT_ID, LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, LANE_TOPOLOGY_ENDPOINT_ID];
const sent = { kind: "sent", proof: "native-publication-processed" } as const;

type RecordUpload = { slotId: number; deliverySerial: number; values: number[] };
function recordUpload(value: unknown): RecordUpload {
    // SAFETY: only buildLaneRuntimeEventsV2 creates these positional records.
    return value as RecordUpload;
}

/** Accepted rack state owns delivery. Ordinary drags send a single field;
 * dependent changes use one atomic record, and structural edits replay topology.
 * Output Trim host parameters remain the separate automation authority. */
export const synthRackDelivery: PluginStateDelivery<LaneStateV2> = {
    eventEndpoints: endpoints,
    outputEndpoints: ["runtimeState"],
    replacement: "finish",
    create(document) {
        let previous: LaneStateV2 | undefined;
        let desired: LaneStateV2 | undefined;
        let serial = 0;
        let application = 0;
        let session: number | undefined;
        let stopped = false;
        let tail: Promise<unknown> = Promise.resolve();
        const runtimeEvents = (value: LaneStateV2) => buildLaneRuntimeEventsV2(value).filter(event => endpoints.includes(event.endpointID));
        async function publish(value: LaneStateV2, signal: typeof document.signal, force = false): Promise<PluginStateDeliveryOutcome> {
            if (stopped || signal.aborted) return { kind: "cancelled" };
            const next = runtimeEvents(value);
            const before = previous && !force ? runtimeEvents(previous) : [];
            const topology = (events: typeof next) => events.find(event => event.endpointID === LANE_TOPOLOGY_ENDPOINT_ID)?.value;
            const sameTopology = before.length > 0 && JSON.stringify(topology(before)) === JSON.stringify(topology(next));
            const changes: { endpointID: string; value: unknown }[] = [];
            for (const event of next) {
                if (!sameTopology) { changes.push(event); continue; }
                if (event.endpointID === LANE_TOPOLOGY_ENDPOINT_ID) continue;
                if (event.endpointID === LANE_SLOT_PARAMS_ENDPOINT_ID) {
                    const record = recordUpload(event.value);
                    const old = before.find(candidate => candidate.endpointID === event.endpointID && recordUpload(candidate.value).slotId === record.slotId);
                    const oldValues = old ? recordUpload(old.value).values : [];
                    const indexes = record.values.flatMap((number, index) => Object.is(number, oldValues[index]) ? [] : [index]);
                    if (indexes.length === 1) changes.push({ endpointID: LANE_SLOT_PARAM_VALUE_ENDPOINT_ID,
                        value: { slotId: record.slotId, paramIndex: indexes[0], value: record.values[indexes[0]!] } });
                    else if (indexes.length > 1) changes.push(event);
                } else if (JSON.stringify(event.value) !== JSON.stringify(before.find(candidate => candidate.endpointID === event.endpointID)?.value)) changes.push(event);
            }
            previous = undefined;
            for (const event of changes) {
                if (stopped || signal.aborted) return { kind: "cancelled" };
                const value = event.endpointID === LANE_SLOT_PARAMS_ENDPOINT_ID || event.endpointID === LANE_SLOT_PARAM_VALUE_ENDPOINT_ID
                    ? { ...Object(event.value), deliverySerial: ++serial } : event.value;
                const submitted = document.send({ kind: "event", endpoint: event.endpointID, value });
                const outcome = submitted.kind === "submitted" ? await submitted.completion : submitted;
                if (outcome.kind !== "sent") return outcome;
            }
            if (stopped || signal.aborted) return { kind: "cancelled" };
            previous = value;
            return sent;
        }
        function enqueue(value: LaneStateV2, signal: typeof document.signal, force = false) {
            const job = tail.then(() => publish(value, signal, force));
            tail = job.catch(() => {});
            return job;
        }
        const remove = document.listen("runtimeState", value => {
            const next = value !== null && typeof value === "object" ? Reflect.get(value, "dspSessionId") : undefined;
            if (typeof next !== "number" || next === session) return;
            const changed = session !== undefined;
            session = next;
            const refreshingApplication = application;
            if (changed && desired) void enqueue(desired, document.signal, true).then(outcome => {
                if (outcome.kind === "failed" && refreshingApplication === application) document.report(outcome);
            }, document.fail);
        });
        return {
            apply(value, context) { application += 1; desired = value; return enqueue(value, context.signal); },
            stop() { stopped = true; remove(); },
        };
    },
};
