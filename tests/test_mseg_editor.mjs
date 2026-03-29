import test from "node:test";
import assert from "node:assert/strict";

import {
    MSEG_PADDED_SAMPLES,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    renderMsegShape,
    serializeMsegShape,
} from "../patch_gui/mseg.mjs";
import {
    MSEG_BUFFER_ENDPOINT_ID,
    MSEG_DEPTH_ENDPOINT_ID,
    MSEG_DEPTH_STATE_KEY,
    MSEG_PLAYBACK_ENDPOINT_ID,
    MSEG_PLAYBACK_STATE_KEY,
    MSEG_SHAPE_STATE_KEY,
    MsegController,
} from "../patch_gui/mseg-controller.mjs";

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.events = [];
        this.storedWrites = [];
        this.requestedKeys = [];
        this.storedStateListeners = new Set();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    requestStoredStateValue(key) {
        this.requestedKeys.push(key);
        for (const listener of this.storedStateListeners) {
            listener({ key, value: this.storedState[key] });
        }
    }

    sendStoredStateValue(key, value) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }
}

function lastEvent(connection, endpointID) {
    const filtered = connection.events.filter((entry) => entry.endpointID === endpointID);
    return filtered[filtered.length - 1];
}

function endpointEvents(connection, endpointID) {
    return connection.events.filter((entry) => entry.endpointID === endpointID);
}

test("boot_without_saved_mseg_state_uses_default_shape_playback_and_depth", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();

    const { shape, playback, depth } = controller.getState();
    assert.deepEqual(shape, createDefaultMsegShape());
    assert.deepEqual(playback, {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: { kind: "seconds", seconds: 1.0 },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    });
    assert.equal(depth, 1.0);
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).value,
        {
            seconds: 1.0,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: true,
            loopStart: 0.0,
            loopEnd: 1.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
});

test("boot_with_saved_mseg_state_restores_shape_playback_and_depth", () => {
    const patchConnection = new FakePatchConnection({
        [MSEG_SHAPE_STATE_KEY]: JSON.stringify({
            ...createDefaultMsegShape(),
            points: [
                { x: 0.0, y: 0.25, curvePower: 0.0 },
                { x: 0.5, y: 0.75, curvePower: 1.0 },
                { x: 1.0, y: 0.5, curvePower: 0.0 },
            ],
        }),
        [MSEG_PLAYBACK_STATE_KEY]: JSON.stringify({
            ...createDefaultMsegPlayback(),
            rate: { kind: "seconds", seconds: 0.75 },
        }),
        [MSEG_DEPTH_STATE_KEY]: 0.6,
    });
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();

    const state = controller.getState();
    assert.equal(state.shape.points.length, 3);
    assert.equal(state.playback.rate.seconds, 0.75);
    assert.equal(state.depth, 0.6);
});

test("boot_restoration_uploads_one_rendered_buffer_for_mseg1", () => {
    const storedShape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.1, curvePower: 0.0 },
            { x: 0.4, y: 0.8, curvePower: -1.0 },
            { x: 1.0, y: 0.3, curvePower: 0.0 },
        ],
    };
    const patchConnection = new FakePatchConnection({
        [MSEG_SHAPE_STATE_KEY]: JSON.stringify(storedShape),
    });
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();

    const uploads = endpointEvents(patchConnection, MSEG_BUFFER_ENDPOINT_ID);
    assert.equal(uploads.length, 1);
    assert.equal(Array.isArray(uploads[0].value), true);
    assert.equal(uploads[0].value.length, MSEG_PADDED_SAMPLES);
    assert.deepEqual(uploads[0].value, Array.from(renderMsegShape(storedShape)));
});

test("add_point_updates_stored_shape_and_reuploads_buffer", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    controller.addPoint(0.25, 0.75);

    assert.equal(controller.getState().shape.points.length, 3);
    assert.equal(patchConnection.storedWrites[0].key, MSEG_SHAPE_STATE_KEY);
    assert.equal(
        patchConnection.storedWrites[0].value,
        serializeMsegShape(controller.getState().shape)
    );
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_BUFFER_ENDPOINT_ID).value,
        Array.from(renderMsegShape(controller.getState().shape))
    );
});

test("drag_point_clamps_to_valid_domain_and_reuploads_buffer", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    controller.addPoint(0.4, 0.4);
    patchConnection.events = [];

    controller.movePoint(1, -1.0, 5.0);

    const moved = controller.getState().shape.points[1];
    assert.equal(moved.x, 0.0);
    assert.equal(moved.y, 1.0);
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_BUFFER_ENDPOINT_ID).value,
        Array.from(renderMsegShape(controller.getState().shape))
    );
});

test("delete_non_endpoint_point_updates_shape_and_reuploads_buffer", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    controller.addPoint(0.25, 0.2);
    controller.addPoint(0.75, 0.8);
    patchConnection.events = [];

    controller.deletePoint(1);

    assert.equal(controller.getState().shape.points.length, 3);
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_BUFFER_ENDPOINT_ID).value,
        Array.from(renderMsegShape(controller.getState().shape))
    );
});

test("delete_endpoint_is_rejected", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    controller.deletePoint(0);

    assert.equal(controller.getState().shape.points.length, 2);
    assert.equal(endpointEvents(patchConnection, MSEG_BUFFER_ENDPOINT_ID).length, 0);
    assert.equal(patchConnection.storedWrites.length, 0);
});

test("depth_change_updates_route_depth_without_rerendering_shape", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];

    controller.setDepth(0.5);

    assert.equal(controller.getState().depth, 0.5);
    assert.equal(patchConnection.events.filter((entry) => entry.endpointID === MSEG_BUFFER_ENDPOINT_ID).length, 0);
    assert.equal(lastEvent(patchConnection, MSEG_DEPTH_ENDPOINT_ID).value, 0.5);
});

test("playback_rate_change_updates_transport_without_rerendering_shape", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];

    controller.setPlayback({
        ...createDefaultMsegPlayback(),
        rate: { kind: "seconds", seconds: 0.2 },
        loop: { startX: 0.0, endX: 1.0 },
    });

    assert.deepEqual(controller.getState().playback, {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: { kind: "seconds", seconds: 0.2 },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    });
    assert.equal(
        patchConnection.events.filter((entry) => entry.endpointID === MSEG_BUFFER_ENDPOINT_ID).length,
        0
    );
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).value,
        {
            seconds: 0.2,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: true,
            loopStart: 0.0,
            loopEnd: 1.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
});

test("playback_change_updates_stored_playback_and_uploads_without_rerendering_shape", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    controller.setPlayback({
        ...createDefaultMsegPlayback(),
        rate: { kind: "seconds", seconds: 0.25 },
        loop: null,
    });

    assert.deepEqual(controller.getState().playback, {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: { kind: "seconds", seconds: 0.25 },
        loop: null,
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    });
    assert.equal(
        patchConnection.events.filter((entry) => entry.endpointID === MSEG_BUFFER_ENDPOINT_ID).length,
        0
    );
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).value,
        {
            seconds: 0.25,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: false,
            loopStart: 0.0,
            loopEnd: 0.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
    assert.equal(patchConnection.storedWrites.length, 1);
    assert.equal(patchConnection.storedWrites[0].key, MSEG_PLAYBACK_STATE_KEY);
    assert.deepEqual(
        JSON.parse(patchConnection.storedWrites[0].value),
        {
            format: "cosimo.mseg.playback",
            version: 1,
            rate: { kind: "seconds", seconds: 0.25 },
            loop: null,
            noteOffPolicy: "finish_loop",
            legatoRestarts: false,
            holdFinalValue: true,
        }
    );
});

test("every_uploaded_mseg_buffer_has_exact_expected_length", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    controller.addPoint(0.2, 0.3);
    controller.movePoint(1, 0.4, 0.9);
    controller.deletePoint(1);

    patchConnection.events
        .filter((entry) => entry.endpointID === MSEG_BUFFER_ENDPOINT_ID)
        .forEach((entry) => {
            assert.equal(entry.value.length, MSEG_PADDED_SAMPLES);
        });
});

test("playback_upload_uses_the_flat_cmajor_struct_shape", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    patchConnection.events = [];

    controller.setPlayback({
        ...createDefaultMsegPlayback(),
        rate: { kind: "seconds", seconds: 0.375 },
        loop: { startX: 0.0, endX: 1.0 },
    });

    assert.deepEqual(
        lastEvent(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).value,
        {
            seconds: 0.375,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: true,
            loopStart: 0.0,
            loopEnd: 1.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
});

test("fallback_boot_waits_for_all_requested_keys_before_uploading", () => {
    const storedShape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.2, curvePower: 0.0 },
            { x: 0.6, y: 0.7, curvePower: 0.5 },
            { x: 1.0, y: 0.4, curvePower: 0.0 },
        ],
    };
    const storedPlayback = {
        ...createDefaultMsegPlayback(),
        rate: { kind: "seconds", seconds: 0.33 },
    };
    const patchConnection = new FakePatchConnection({
        [MSEG_SHAPE_STATE_KEY]: JSON.stringify(storedShape),
        [MSEG_PLAYBACK_STATE_KEY]: JSON.stringify(storedPlayback),
        [MSEG_DEPTH_STATE_KEY]: 0.25,
    });
    patchConnection.requestFullStoredState = undefined;

    const controller = new MsegController(patchConnection);
    controller.attach();
    controller.requestBootState();

    assert.deepEqual(patchConnection.requestedKeys, [
        MSEG_SHAPE_STATE_KEY,
        MSEG_PLAYBACK_STATE_KEY,
        MSEG_DEPTH_STATE_KEY,
    ]);
    assert.equal(endpointEvents(patchConnection, MSEG_BUFFER_ENDPOINT_ID).length, 1);
    assert.equal(endpointEvents(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).length, 1);
    assert.equal(endpointEvents(patchConnection, MSEG_DEPTH_ENDPOINT_ID).length, 1);
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_BUFFER_ENDPOINT_ID).value,
        Array.from(renderMsegShape(storedShape))
    );
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_PLAYBACK_ENDPOINT_ID).value,
        {
            seconds: 0.33,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: true,
            loopStart: 0.0,
            loopEnd: 1.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
    assert.equal(lastEvent(patchConnection, MSEG_DEPTH_ENDPOINT_ID).value, 0.25);
});

test("malformed_saved_state_falls_back_to_defaults", () => {
    const patchConnection = new FakePatchConnection({
        [MSEG_SHAPE_STATE_KEY]: "{not json",
        [MSEG_PLAYBACK_STATE_KEY]: "{also broken",
        [MSEG_DEPTH_STATE_KEY]: "not-a-number",
    });
    patchConnection.requestFullStoredState = undefined;

    const controller = new MsegController(patchConnection);
    controller.attach();
    controller.requestBootState();

    assert.deepEqual(controller.getState().shape, createDefaultMsegShape());
    assert.deepEqual(controller.getState().playback, createDefaultMsegPlayback());
    assert.equal(controller.getState().depth, 1.0);
    assert.deepEqual(
        lastEvent(patchConnection, MSEG_BUFFER_ENDPOINT_ID).value,
        Array.from(renderMsegShape(createDefaultMsegShape()))
    );
});

test("editor_never_serializes_points_out_of_order", () => {
    const patchConnection = new FakePatchConnection();
    const controller = new MsegController(patchConnection);

    controller.attach();
    controller.requestBootState();
    controller.addPoint(0.75, 0.4);
    controller.addPoint(0.25, 0.7);
    controller.movePoint(1, 0.9, 0.8);

    const serialized = JSON.parse(patchConnection.storedState[MSEG_SHAPE_STATE_KEY]);
    for (let index = 1; index < serialized.points.length; index += 1) {
        assert.equal(serialized.points[index].x >= serialized.points[index - 1].x, true);
    }
});
