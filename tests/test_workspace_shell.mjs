import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadShell() {
    return await loadUIModule(repoRoot, "ui/shared/workspace-shell.ts");
}

test("a fresh shell starts at Home: Voice main screen with no return paths", async () => {
    const { createHomeShellState, universalBackTarget } = await loadShell();
    const state = createHomeShellState();

    assert.equal(state.activeTab, "voice");
    assert.deepEqual(state.details, { voice: null, fx: null, mod: null });
    assert.equal(universalBackTarget(state), null);
});

test("switching tabs preserves each workspace's detail exactly where it was left", async () => {
    const { createHomeShellState, activateTab, enterDetail } = await loadShell();

    let state = activateTab(createHomeShellState(), "fx");
    state = enterDetail(state, "fx", "delay");
    state = activateTab(state, "voice");
    assert.equal(state.activeTab, "voice");
    assert.deepEqual(state.details.fx, { detail: "delay", returnTo: "fx" });

    state = activateTab(state, "fx");
    assert.equal(state.activeTab, "fx");
    assert.deepEqual(state.details.fx, { detail: "delay", returnTo: "fx" }, "returning restores the detail page");
});

test("tapping the active tab inside a detail returns that workspace to its main screen", async () => {
    const { createHomeShellState, activateTab, enterDetail, tapActiveTab } = await loadShell();

    let state = enterDetail(activateTab(createHomeShellState(), "mod"), "mod", "mseg-1");
    const result = tapActiveTab(state);
    state = result.state;

    assert.equal(result.effect, "returned-to-main");
    assert.equal(state.details.mod, null, "the reset clears the detail and its return path");
});

test("tapping the active tab on its main screen requests scroll-to-top", async () => {
    const { createHomeShellState, tapActiveTab } = await loadShell();

    const result = tapActiveTab(createHomeShellState());
    assert.equal(result.effect, "scroll-to-top");
    assert.deepEqual(result.state, createHomeShellState());
});

test("a deep link opens the destination with a Back path to the originating tab", async () => {
    const { createHomeShellState, openDeepLink, universalBackTarget } = await loadShell();

    const state = openDeepLink(createHomeShellState(), {
        tab: "mod",
        detail: "mseg-2",
        from: "fx",
    });

    assert.equal(state.activeTab, "mod");
    assert.deepEqual(state.details.mod, { detail: "mseg-2", returnTo: "fx" });
    assert.equal(universalBackTarget(state), "fx");
});

test("temporarily visiting another tab does not erase a return path", async () => {
    const { createHomeShellState, openDeepLink, activateTab, universalBackTarget } = await loadShell();

    let state = openDeepLink(createHomeShellState(), { tab: "mod", detail: "mseg-2", from: "fx" });
    state = activateTab(state, "voice");
    assert.equal(universalBackTarget(state), null, "Back reflects the ACTIVE workspace only");

    state = activateTab(state, "mod");
    assert.deepEqual(state.details.mod, { detail: "mseg-2", returnTo: "fx" });
    assert.equal(universalBackTarget(state), "fx", "the preserved path reappears with its tab");
});

test("universal Back follows the stored path and ends it", async () => {
    const { createHomeShellState, openDeepLink, universalBack } = await loadShell();

    let state = openDeepLink(createHomeShellState(), { tab: "mod", detail: "mseg-2", from: "fx" });
    state = universalBack(state);

    assert.equal(state.activeTab, "fx");
    assert.equal(state.details.mod, null);
});

test("universal Back with no return path changes nothing", async () => {
    const { createHomeShellState, universalBack } = await loadShell();

    const home = createHomeShellState();
    assert.deepEqual(universalBack(home), home);
});

test("shell state round-trips through serialization and rejects garbage", async () => {
    const {
        createHomeShellState,
        openDeepLink,
        serializeShellState,
        parseStoredShellState,
    } = await loadShell();

    const state = openDeepLink(createHomeShellState(), { tab: "fx", detail: "reverb", from: "voice" });
    assert.deepEqual(parseStoredShellState(serializeShellState(state)), state);

    assert.equal(parseStoredShellState(null), null);
    assert.equal(parseStoredShellState("not json"), null);
    assert.equal(parseStoredShellState(JSON.stringify({ activeTab: "sidebar" })), null);
    assert.equal(
        parseStoredShellState(JSON.stringify({
            version: 1,
            activeTab: "fx",
            details: { voice: null, fx: { detail: "reverb", returnTo: "lava" }, mod: null },
        })),
        null,
        "an invalid returnTo invalidates the whole stored state rather than guessing",
    );
});
