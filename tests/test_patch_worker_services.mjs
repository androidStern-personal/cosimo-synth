import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const { startPatchWorkerServices } = await loadUIModule(
    path.resolve(import.meta.dirname, ".."),
    "ui/shared/patch-worker-services.ts",
);

const connection = {};
const service = (calls, name, { failStart = null, failStop = null } = {}) => () => ({
    start() {
        calls.push(`start-${name}`);
        if (failStart) throw failStart;
    },
    async stop() {
        calls.push(`stop-${name}`);
        if (failStop) throw failStop;
    },
});

test("patch worker services start in order, receive the connection, and stop in reverse order", async () => {
    const calls = [];
    const received = [];
    const services = await startPatchWorkerServices(connection, [
        (given) => { received.push(given); return service(calls, "a")(); },
        service(calls, "b"),
    ]);
    assert.deepEqual(calls, ["start-a", "start-b"]);
    assert.equal(received[0], connection);

    await services.stop();
    assert.deepEqual(calls, ["start-a", "start-b", "stop-b", "stop-a"]);
});

test("a service that fails to start stops every service already created, then reports the failure", async () => {
    const calls = [];
    await assert.rejects(startPatchWorkerServices(connection, [
        service(calls, "a"),
        service(calls, "b", { failStart: new Error("b failed to start") }),
        service(calls, "c"),
    ]), /b failed to start/);
    assert.deepEqual(calls, ["start-a", "start-b", "stop-b", "stop-a"]);
});

test("a failed start whose cleanup also fails reports both", async () => {
    const startFailure = new Error("b failed to start");
    const stopFailure = new Error("a failed to stop");
    await assert.rejects(startPatchWorkerServices(connection, [
        service([], "a", { failStop: stopFailure }),
        service([], "b", { failStart: startFailure }),
    ]), (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [startFailure, stopFailure]);
        return true;
    });
});

test("stopping releases every service even when several fail to stop, and only once", async () => {
    const calls = [];
    const firstFailure = new Error("b failed to stop");
    const secondFailure = new Error("a failed to stop");
    const services = await startPatchWorkerServices(connection, [
        service(calls, "a", { failStop: secondFailure }),
        service(calls, "b", { failStop: firstFailure }),
        service(calls, "c"),
    ]);
    await assert.rejects(services.stop(), (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [firstFailure, secondFailure]);
        return true;
    });
    await services.stop();
    assert.deepEqual(calls, ["start-a", "start-b", "start-c", "stop-c", "stop-b", "stop-a"]);
});
