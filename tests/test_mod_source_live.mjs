import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const liveModulePromise = loadUIModule(repoRoot, "ui/shared/mod-source-live.ts");
const railModulePromise = loadUIModule(repoRoot, "ui/shared/mobile-voice-rail-projection.ts");
const rackModulePromise = loadUIModule(repoRoot, "ui/shared/rack-route-presentation.ts");

/* ---------------------- monitor message handling ---------------------- */

test("normalizeEffectiveModSourceStateMessage unwraps, clamps, and rejects malformed payloads", async () => {
    const { normalizeEffectiveModSourceStateMessage } = await liveModulePromise;

    const wrapped = normalizeEffectiveModSourceStateMessage({
        event: {
            voiceGeneration: 7,
            hasActive: 1,
            values: [0.25, -0.5, 1.5, 0, 0.5, 1, 0.1, 0.2, 0.3],
        },
    });
    assert.deepEqual(wrapped, {
        voiceGeneration: 7,
        hasActive: true,
        values: [0.25, 0, 1, 0, 0.5, 1, 0.1, 0.2, 0.3],
    });

    assert.equal(normalizeEffectiveModSourceStateMessage(null), null);
    assert.equal(normalizeEffectiveModSourceStateMessage({ values: [0, 1] }), null,
        "a short values array is malformed, never padded");
    assert.equal(
        normalizeEffectiveModSourceStateMessage({
            voiceGeneration: "nope",
            hasActive: 0,
            values: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        }).voiceGeneration,
        0,
    );
});

test("selectObservedEffectiveModSourceState rejects stale voice generations", async () => {
    const { selectObservedEffectiveModSourceState } = await liveModulePromise;

    const first = selectObservedEffectiveModSourceState(null, {
        voiceGeneration: 5,
        hasActive: 1,
        values: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(first.voiceGeneration, 5);

    const stale = selectObservedEffectiveModSourceState(first, {
        voiceGeneration: 3,
        hasActive: 1,
        values: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(stale, first, "an older generation keeps the newer state");

    const advanced = selectObservedEffectiveModSourceState(first, {
        voiceGeneration: 6,
        hasActive: 0,
        values: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(advanced.voiceGeneration, 6);
    assert.equal(advanced.hasActive, false);

    assert.equal(
        selectObservedEffectiveModSourceState(first, { garbage: true }),
        first,
        "a malformed message keeps the current state",
    );
});

test("voiceModSourceValueIndex mirrors the engine's runtime source order", async () => {
    const { voiceModSourceValueIndex } = await liveModulePromise;

    assert.equal(voiceModSourceValueIndex({ sourceKind: "mseg", sourceSlot: 1 }), 0);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "mseg", sourceSlot: 3 }), 2);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "env", sourceSlot: 1 }), 3);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "env", sourceSlot: 3 }), 5);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "velocity", sourceSlot: null }), 6);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "pressure", sourceSlot: null }), 7);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "slide", sourceSlot: null }), 8);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "macro", sourceSlot: 1 }), null,
        "macros are mirrored from parameters, not the voice monitor");
    assert.equal(voiceModSourceValueIndex({ sourceKind: "mseg", sourceSlot: 4 }), null);
    assert.equal(voiceModSourceValueIndex({ sourceKind: "env", sourceSlot: null }), null);
});

/* -------------------------- projection laws --------------------------- */

test("routeLiveOffset applies the engine polarity law", async () => {
    const { routeLiveOffset } = await railModulePromise;

    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "unipolar" }, 0), 0);
    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "unipolar" }, 1), 0.5);
    assert.equal(routeLiveOffset({ amount: -0.5, polarity: "unipolar" }, 1), -0.5);
    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "bipolar" }, 0), -0.5,
        "a bipolar source at rest sits at full negative, matching the DSP");
    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "bipolar" }, 0.5), 0);
    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "bipolar" }, 1), 0.5);
    assert.equal(routeLiveOffset({ amount: 0.5, polarity: "unipolar" }, 2), 0.5,
        "source values clamp to [0,1] before the multiply");
});

test("projectRailLiveNormalized stays inside the projected band", async () => {
    const {
        projectRailLiveNormalized,
        projectMobileVoiceRailBand,
    } = await railModulePromise;

    const domain = { min: 0, max: 100 };
    const route = { amount: 40, polarity: "unipolar" };
    const band = projectMobileVoiceRailBand(domain, 30, route);
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
        const n = projectRailLiveNormalized(band.baseNormalized, route, s, domain.max - domain.min);
        assert.ok(n >= band.lowNormalized - 1e-9 && n <= band.highNormalized + 1e-9,
            `light at s=${s} must ride the band`);
    }
    assert.equal(
        projectRailLiveNormalized(band.baseNormalized, route, 0, domain.max - domain.min),
        band.baseNormalized,
        "a unipolar source at rest sits on the base tick",
    );
    assert.equal(
        projectRailLiveNormalized(band.baseNormalized, route, 1, domain.max - domain.min),
        band.highNormalized,
    );

    const clipped = projectRailLiveNormalized(0.9, { amount: 50, polarity: "unipolar" }, 1, 100);
    assert.equal(clipped, 1, "the light pins at the rail edge when the value clips");

    assert.throws(() => projectRailLiveNormalized(0.5, route, 0.5, 0));
});

test("projectRackRouteLiveNormalized matches the rack travel projection at the extremes", async () => {
    const { projectRackRouteLiveNormalized, projectRackRouteTravel } = await rackModulePromise;

    const linearDescriptor = { min: 0, max: 1, scale: "linear", modulationApplication: "offset" };
    const route = { amount: 0.4, polarity: "bipolar" };
    const travel = projectRackRouteTravel(linearDescriptor, 0.5, route);
    assert.ok(Math.abs(
        projectRackRouteLiveNormalized(linearDescriptor, 0.5, route, 0) - travel.normalized[0],
    ) < 1e-9);
    assert.ok(Math.abs(
        projectRackRouteLiveNormalized(linearDescriptor, 0.5, route, 1) - travel.normalized[1],
    ) < 1e-9);
    assert.ok(Math.abs(
        projectRackRouteLiveNormalized(linearDescriptor, 0.5, route, 0.5) - 0.5,
    ) < 1e-9, "a bipolar source at center leaves the base value untouched");

    const octaveDescriptor = { min: 20, max: 20000, scale: "log", modulationApplication: "octaves" };
    const octaveRoute = { amount: 2, polarity: "unipolar" };
    const octaveTravel = projectRackRouteTravel(octaveDescriptor, 200, octaveRoute);
    assert.ok(Math.abs(
        projectRackRouteLiveNormalized(octaveDescriptor, 200, octaveRoute, 1) - octaveTravel.normalized[1],
    ) < 1e-9, "octave application must match the fill projection");
    assert.ok(Math.abs(
        projectRackRouteLiveNormalized(octaveDescriptor, 200, octaveRoute, 0) - octaveTravel.normalized[0],
    ) < 1e-9);
});

/* ------------------------------ driver -------------------------------- */

function createConnectionStub() {
    const endpointListeners = new Map();
    const parameterListeners = new Map();
    return {
        addEndpointListener(endpointID, listener) {
            const listeners = endpointListeners.get(endpointID) ?? [];
            listeners.push(listener);
            endpointListeners.set(endpointID, listeners);
        },
        removeEndpointListener(endpointID, listener) {
            const listeners = endpointListeners.get(endpointID) ?? [];
            endpointListeners.set(endpointID, listeners.filter((entry) => entry !== listener));
        },
        addParameterListener(endpointID, listener) {
            const listeners = parameterListeners.get(endpointID) ?? [];
            listeners.push(listener);
            parameterListeners.set(endpointID, listeners);
        },
        removeParameterListener(endpointID, listener) {
            const listeners = parameterListeners.get(endpointID) ?? [];
            parameterListeners.set(endpointID, listeners.filter((entry) => entry !== listener));
        },
        requestParameterValue() {},
        emitEndpoint(endpointID, value) {
            (endpointListeners.get(endpointID) ?? []).forEach((listener) => listener(value));
        },
        emitParameter(endpointID, value) {
            (parameterListeners.get(endpointID) ?? []).forEach((listener) => listener(value));
        },
        listenerCount(endpointID) {
            return (endpointListeners.get(endpointID) ?? []).length;
        },
    };
}

function createFakeFrameScheduler() {
    let nextHandle = 1;
    const pending = new Map();
    let timestamp = 0;
    return {
        hooks: {
            requestAnimationFrame(callback) {
                const handle = nextHandle;
                nextHandle += 1;
                pending.set(handle, callback);
                return handle;
            },
            cancelAnimationFrame(handle) {
                pending.delete(handle);
            },
        },
        step(elapsedMs = 16) {
            timestamp += elapsedMs;
            const callbacks = [...pending.values()];
            pending.clear();
            callbacks.forEach((callback) => callback(timestamp));
        },
        pendingCount() {
            return pending.size;
        },
    };
}

function createElementStub() {
    return {
        attributes: new Map(),
        style: {},
        setAttribute(name, value) {
            this.attributes.set(name, value);
        },
    };
}

test("driver moves a rail light from monitor events without React involvement", async () => {
    const { ModSourceLiveDriver } = await liveModulePromise;
    const connection = createConnectionStub();
    const frames = createFakeFrameScheduler();
    const driver = new ModSourceLiveDriver(connection, frames.hooks);
    driver.attach();
    assert.equal(connection.listenerCount("effectiveModSourceState"), 1);

    const element = createElementStub();
    const unregister = driver.register(element, {
        source: { sourceKind: "mseg", sourceSlot: 1 },
        project: (s) => s,
        placement: { kind: "rail" },
    });

    connection.emitEndpoint("effectiveModSourceState", {
        voiceGeneration: 1,
        hasActive: 1,
        values: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    for (let frame = 0; frame < 60 && frames.pendingCount() > 0; frame += 1) {
        frames.step();
    }
    assert.equal(element.attributes.get("data-mod-live"), "1");
    const left = Number.parseFloat(element.style.left);
    assert.ok(left > 95, `light must chase the source value (left=${element.style.left})`);

    // Voice goes silent: the light fades and the loop stops itself.
    connection.emitEndpoint("effectiveModSourceState", {
        voiceGeneration: 1,
        hasActive: 0,
        values: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    for (let frame = 0; frame < 120 && frames.pendingCount() > 0; frame += 1) {
        frames.step();
    }
    assert.equal(element.attributes.get("data-mod-live"), "0");
    assert.equal(frames.pendingCount(), 0, "the loop must stop once everything settles");

    unregister();
    driver.detach();
    assert.equal(connection.listenerCount("effectiveModSourceState"), 0);
});

test("driver drives macro lights from parameter values with no voice sounding", async () => {
    const { ModSourceLiveDriver } = await liveModulePromise;
    const connection = createConnectionStub();
    const frames = createFakeFrameScheduler();
    const driver = new ModSourceLiveDriver(connection, frames.hooks);
    driver.attach();

    const element = createElementStub();
    driver.register(element, {
        source: { sourceKind: "macro", sourceSlot: 2 },
        project: (s) => s,
        placement: { kind: "rail" },
    });

    connection.emitParameter("macro2", 0.75);
    for (let frame = 0; frame < 120 && frames.pendingCount() > 0; frame += 1) {
        frames.step();
    }
    assert.equal(element.attributes.get("data-mod-live"), "1",
        "macros are global, so their light shows without an active voice");
    assert.ok(Math.abs(Number.parseFloat(element.style.left) - 75) < 1,
        `macro light must sit at the macro value (left=${element.style.left})`);
    assert.equal(frames.pendingCount(), 0);
    driver.detach();
});

test("driver places knob-arc lights on the artwork sweep", async () => {
    const { ModSourceLiveDriver } = await liveModulePromise;
    const connection = createConnectionStub();
    const frames = createFakeFrameScheduler();
    const driver = new ModSourceLiveDriver(connection, frames.hooks);
    driver.attach();

    const element = createElementStub();
    driver.register(element, {
        source: { sourceKind: "env", sourceSlot: 1 },
        project: (s) => s,
        placement: { kind: "knob-arc", radius: 42 },
    });

    connection.emitEndpoint("effectiveModSourceState", {
        voiceGeneration: 1,
        hasActive: 1,
        values: [0, 0, 0, 0.5, 0, 0, 0, 0, 0],
    });
    for (let frame = 0; frame < 60 && frames.pendingCount() > 0; frame += 1) {
        frames.step();
    }
    // Normalized 0.5 on the 270° sweep from 225° is 90°: straight up from
    // center (50, 50) at radius 42 → (50, 8).
    assert.ok(Math.abs(Number.parseFloat(element.attributes.get("cx")) - 50) < 0.5,
        `cx=${element.attributes.get("cx")}`);
    assert.ok(Math.abs(Number.parseFloat(element.attributes.get("cy")) - 8) < 0.5,
        `cy=${element.attributes.get("cy")}`);
    driver.detach();
});
