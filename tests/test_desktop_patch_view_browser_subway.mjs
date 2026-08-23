import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultLaneState,
    serializeLaneState,
} from "../patch_gui/lane-state.js";
import {
    clearHarnessDebugLog,
    getHarnessSnapshot,
    openHarnessPage,
    waitForHarnessSnapshot,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

const readStoredLaneDoc = (snapshot) => JSON.parse(String(snapshot.storedState["lane.v1"]));

async function wrapStationInGroup(page, effectId, groupKind) {
    await page.click(`[data-role="rack-station-${effectId}"]`, { button: "right" });
    await page.waitForSelector(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.click(`[data-role="rack-station-wrap-${groupKind}-${effectId}"]`);
    await page.waitForSelector('[data-role="rack-station-menu"]', { state: "detached" });
}

test("wrapping a station in a split builds the tree, the wire, and the map", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);

        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');

        // The document grew the group with the default crossovers.
        const snapshot = await waitForHarnessSnapshot(
            page,
            "split group persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                return JSON.parse(String(rawState)).chain
                    .some((node) => node.kind === "split");
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        const split = storedDoc.chain.find((node) => node.kind === "split");
        assert.equal(split.groupId, "split#1");
        assert.equal(split.enabled, true);
        assert.equal(split.xoverLowHz, 800);
        assert.equal(split.xoverHighHz, 2500);
        assert.deepEqual(split.branches.map((branch) => branch.map((p) => p.deviceId)), [["delay#1"], []]);

        // The wire carried the marker record and the marker-grammar topology.
        const markerRecord = snapshot.sentMessages.find((message) => (
            message.endpointID === "laneSlotParams" && message.value?.slotId === 44
        ));
        assert.equal(markerRecord.value.values[0], 800);
        assert.equal(markerRecord.value.values[1], 2500);
        const topology = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").at(-1);
        assert.equal(topology.value.chainLength, 9);
        assert.equal(topology.value.slotIds.includes(44 | (2 << 8)), true);
        assert.equal(topology.value.slotIds.includes(6 | (1 << 8)), true);

        // The map shows the diamond fork, the crossover readout, the delay
        // in the LO lane, and the empty HI band's ghost stub.
        assert.equal(await page.locator('[data-role="rack-fork-split#1"] .subway-glyph-diamond').count(), 1);
        assert.match(await page.locator('[data-role="rack-fork-readout-split#1"]').innerText(), /800/);
        assert.equal(await page.locator('.subway-group [data-role="rack-module-delay"]').count(), 1);
        assert.equal(await page.locator('[data-lane-path="branch:split#1:1:0"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("the split editor drags the crossover on the acked marker hot path", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');

        await page.click('[data-role="rack-fork-split#1"]');
        const slider = page.locator('[data-role="rack-split-low-split#1"]');
        await slider.waitFor();
        assert.equal(await slider.getAttribute("aria-valuenow"), "800");

        await clearHarnessDebugLog(page);
        await slider.scrollIntoViewIfNeeded();
        const bounds = await slider.boundingBox();
        assert.ok(bounds);
        await page.mouse.move(bounds.x + (bounds.width * 0.9), bounds.y + (bounds.height / 2));
        await page.mouse.down();
        await page.mouse.move(bounds.x + (bounds.width * 0.95), bounds.y + (bounds.height / 2), { steps: 4 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "crossover field edits persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const split = JSON.parse(String(rawState)).chain.find((node) => node.kind === "split");
                return split !== undefined && split.xoverLowHz > 5000;
            },
        );
        const fieldEdits = snapshot.sentMessages.filter((message) => (
            message.endpointID === "laneSlotParamValue" && message.value?.slotId === 44
        ));
        assert.equal(fieldEdits.length > 0, true);
        assert.equal(fieldEdits.every((message) => message.value.paramIndex === 0), true);
        const finalHz = fieldEdits.at(-1).value.value;
        assert.equal(finalHz > 5000, true);
        assert.equal(readStoredLaneDoc(snapshot).chain.find((node) => node.kind === "split").xoverLowHz, finalHz);
        // No topology traffic: a crossover drag is a parameter edit, never a
        // structure transition.
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        assert.match(await page.locator('[data-role="rack-fork-readout-split#1"]').innerText(), /k/);
    } finally {
        await page.close();
    }
});

test("dragging a station into the empty band crosses lanes and commits once", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "delay", "split");
        await page.waitForSelector('[data-role="rack-group-split#1"]');
        await clearHarnessDebugLog(page);

        // The whole map fits one viewport once the card is scrolled to, so
        // both drag endpoints stay on screen for the pointer stream.
        await page.locator('[data-role="effects-rack-card"]').scrollIntoViewIfNeeded();
        const reverbBox = await page.locator('[data-role="rack-station-reverb"]').boundingBox();
        const ghostBox = await page.locator('[data-lane-path="branch:split#1:1:0"]').boundingBox();
        assert.ok(reverbBox && ghostBox);

        await page.mouse.move(reverbBox.x + (reverbBox.width / 2), reverbBox.y + (reverbBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(ghostBox.x + (ghostBox.width / 2), ghostBox.y + (ghostBox.height / 2), { steps: 12 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "cross-lane move commit",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const split = JSON.parse(String(rawState)).chain.find((node) => node.kind === "split");
                return split !== undefined && split.branches[1].length === 1;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        const split = storedDoc.chain.find((node) => node.kind === "split");
        assert.deepEqual(split.branches.map((branch) => branch.map((p) => p.deviceId)),
                         [["delay#1"], ["reverb#1"]]);
        assert.equal(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length,
            1,
        );
        const topology = snapshot.sentMessages.find(({ endpointID }) => endpointID === "laneTopology");
        assert.equal(topology.value.slotIds.includes(7 | (2 << 8)), true);
        assert.equal(await page.locator('.subway-group [data-role="rack-module-reverb"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("group bypass and dissolve ride the fork menu", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await wrapStationInGroup(page, "chorus", "parallel");
        await page.waitForSelector('[data-role="rack-group-parallel#1"]');

        await page.click('[data-role="rack-fork-parallel#1"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-group-menu"]');
        await page.click('[data-role="rack-group-enabled-parallel#1"]');
        await page.waitForSelector('[data-role="rack-group-menu"]', { state: "detached" });
        await page.waitForSelector('[data-role="rack-group-parallel#1"].is-bypassed');
        let snapshot = await waitForHarnessSnapshot(
            page,
            "group bypass persisted",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).chain
                        .find((node) => node.kind === "parallel")?.enabled === false;
            },
        );

        await page.click('[data-role="rack-fork-parallel#1"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-group-menu"]');
        await page.click('[data-role="rack-group-dissolve-parallel#1"]');
        snapshot = await waitForHarnessSnapshot(
            page,
            "group dissolved",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                return rawState !== undefined
                    && JSON.parse(String(rawState)).chain.every((node) => node.kind === "device");
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.chain.length, 8);
        assert.equal(await page.locator('[data-role="rack-group-parallel#1"]').count(), 0);
        assert.equal(await page.locator('[data-role="rack-module-chorus"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("a stored v1 document upgrades in place and persists as lane.v2", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        const v1 = createDefaultLaneState();
        const reversed = {
            ...v1,
            order: [...v1.order].reverse(),
            enabled: { ...v1.enabled, chorus: true },
        };
        await page.evaluate((serialized) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("lane.v1", serialized);
        }, serializeLaneState(reversed));

        // The map renders the upgraded document: reverb leads the line and
        // the chorus station is powered.
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
            && document.querySelector('[data-role="rack-module-chorus"]')?.getAttribute("data-enabled") === "true"
        ));

        // The next persisted write is a lane.v2 document.
        await page.click('[data-role="rack-station-chorus"]', { button: "right" });
        await page.waitForSelector('[data-role="rack-enabled-chorus"]');
        await page.click('[data-role="rack-enabled-chorus"]');
        const snapshot = await waitForHarnessSnapshot(
            page,
            "upgraded doc persisted as v2",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const doc = JSON.parse(String(rawState));
                return doc.version === 2
                    && doc.chain?.find((node) => node.deviceId === "chorus#1")?.enabled === false;
            },
        );
        const storedDoc = readStoredLaneDoc(snapshot);
        assert.equal(storedDoc.format, "cosimo.lane");
        assert.equal(storedDoc.chain[0].deviceId, "reverb#1");
    } finally {
        await page.close();
    }
});
