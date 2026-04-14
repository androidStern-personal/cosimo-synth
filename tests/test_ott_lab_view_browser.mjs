import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";

const SNAPSHOT_STORAGE_KEY = "cosimo.ottLab.snapshotSlots.v1";
const SNAPSHOT_EXPORT_KIND = "cosimo.ottLab.snapshot";
const SNAPSHOT_PATCH_ID = "dev.cosimo.ott-lab";

let server;
let browser;

const OTT_ENDPOINTS = [
    {
        endpointID: "ottMix",
        purpose: "parameter",
        annotation: { name: "Mix", group: "Global", min: 0, max: 100, init: 100 },
    },
    {
        endpointID: "ottTimePercent",
        purpose: "parameter",
        annotation: { name: "Time", group: "Detector", min: 10, max: 1000, init: 100 },
    },
    {
        endpointID: "ottBandDrive",
        purpose: "parameter",
        annotation: { name: "Band Drive", group: "Saturation", min: 0, max: 100, init: 0 },
    },
    {
        endpointID: "hostSlot0Guard",
        purpose: "parameter",
        annotation: { name: "Host Guard", hidden: true, min: 0, max: 1, init: 0 },
    },
];

const INITIAL_VALUES = {
    ottMix: 87,
    ottTimePercent: 120,
    ottBandDrive: 22,
    hostSlot0Guard: 1,
};

function createSnapshotExport(values, overrides = {}) {
    return JSON.stringify({
        kind: SNAPSHOT_EXPORT_KIND,
        schema: 1,
        patchID: SNAPSHOT_PATCH_ID,
        slot: "A",
        label: "",
        values,
        ...overrides,
    });
}

async function openOttLabPage({ clipboardText = "" } = {}) {
    const page = await browser.newPage();

    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    await page.evaluate(({ endpoints, initialValues, initialClipboardText, storageKey }) => {
        window.localStorage.clear();
        window.__OTT_TEST_CLIPBOARD__ = { text: initialClipboardText };
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                async writeText(text) {
                    window.__OTT_TEST_CLIPBOARD__.text = text;
                },
                async readText() {
                    return window.__OTT_TEST_CLIPBOARD__.text;
                },
            },
        });

        const sentMessages = [];
        const parameterValues = new Map(Object.entries(initialValues));
        const parameterListeners = new Map();
        const statusListeners = new Set();

        const addParameterListener = (endpointID, listener) => {
            const listeners = parameterListeners.get(endpointID) ?? new Set();
            listeners.add(listener);
            parameterListeners.set(endpointID, listeners);
        };
        const emitParameterValue = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
        };
        const emitStatus = () => {
            const status = { details: { inputs: endpoints.map((endpoint) => structuredClone(endpoint)) } };
            statusListeners.forEach((listener) => listener(status));
        };

        const patchConnection = {
            utilities: {
                ParameterControls: {
                    getAllCSS() {
                        return "";
                    },
                    createLabelledControl(_patchConnection, endpointInfo) {
                        const wrapper = document.createElement("div");
                        const child = document.createElement("button");
                        wrapper.className = "labelled-control";
                        wrapper.dataset.endpointId = endpointInfo.endpointID;
                        child.textContent = endpointInfo.annotation?.name ?? endpointInfo.endpointID;
                        wrapper.childControl = child;
                        wrapper.appendChild(child);
                        return wrapper;
                    },
                },
            },
            addStatusListener(listener) {
                statusListeners.add(listener);
            },
            removeStatusListener(listener) {
                statusListeners.delete(listener);
            },
            requestStatusUpdate() {
                queueMicrotask(emitStatus);
            },
            addParameterListener(endpointID, listener) {
                addParameterListener(endpointID, listener);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    const value = parameterValues.get(endpointID) ?? 0;
                    parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
                });
            },
            sendEventOrValue(endpointID, value, rampFrames) {
                sentMessages.push({ endpointID, value, rampFrames });
                emitParameterValue(endpointID, value);
            },
        };

        window.__OTT_LAB_VIEW_HARNESS__ = {
            async mount() {
                const createPatchView = (await import("/fx/ott_lab/view/bundle.js")).default;
                const mountPoint = document.getElementById("mount");

                if (!(mountPoint instanceof HTMLElement))
                    throw new Error("Module test mount point is missing.");

                mountPoint.replaceChildren(await createPatchView(patchConnection));
            },
            emitStatus,
            setParameterValue: emitParameterValue,
            setClipboardText(text) {
                window.__OTT_TEST_CLIPBOARD__.text = text;
            },
            removeClipboardRead() {
                Object.defineProperty(navigator, "clipboard", {
                    configurable: true,
                    value: {
                        async writeText(text) {
                            window.__OTT_TEST_CLIPBOARD__.text = text;
                        },
                    },
                });
            },
            makeClipboardWriteRejectAndInstallExecCommandFallback() {
                Object.defineProperty(navigator, "clipboard", {
                    configurable: true,
                    value: {
                        async writeText() {
                            throw new Error("simulated clipboard write rejection");
                        },
                        async readText() {
                            return window.__OTT_TEST_CLIPBOARD__.text;
                        },
                    },
                });
                document.execCommand = (command) => {
                    if (command !== "copy")
                        return false;

                    const textarea = document.querySelector("textarea[readonly]");

                    if (!(textarea instanceof HTMLTextAreaElement))
                        return false;

                    window.__OTT_TEST_CLIPBOARD__.text = textarea.value;
                    return true;
                };
            },
            getSnapshot() {
                const rawStore = window.localStorage.getItem(storageKey);
                const view = document.querySelector("cosimo-ott-lab-view");
                const root = view?.shadowRoot;

                return {
                    activeElementSlot: root?.activeElement?.dataset?.slot ?? null,
                    sentMessages: sentMessages.map((message) => ({ ...message })),
                    store: rawStore ? JSON.parse(rawStore) : null,
                    clipboardText: window.__OTT_TEST_CLIPBOARD__.text,
                    message: root?.querySelector("[data-snapshot-message]")?.textContent ?? "",
                    toastVisible: root?.querySelector("[data-snapshot-message]")?.dataset?.visible === "true",
                    labelInput: {
                        value: root?.querySelector("[data-snapshot-label-input]")?.value ?? null,
                        disabled: root?.querySelector("[data-snapshot-label-input]")?.disabled ?? null,
                    },
                    listenerCounts: Object.fromEntries(
                        Array.from(parameterListeners.entries()).map(([endpointID, listeners]) => [endpointID, listeners.size]),
                    ),
                    slotStates: Array.from(root?.querySelectorAll(".snapshot-slot") ?? []).map((slot) => ({
                        slot: slot.dataset.slot,
                        className: slot.className,
                        value: slot.value,
                    })),
                    pasteBoxOpen: Boolean(root?.querySelector("[data-snapshot-paste-text]")),
                };
            },
        };
    }, {
        endpoints: OTT_ENDPOINTS,
        initialValues: INITIAL_VALUES,
        initialClipboardText: clipboardText,
        storageKey: SNAPSHOT_STORAGE_KEY,
    });
    await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.mount());
    await page.waitForSelector("cosimo-ott-lab-view");
    await page.waitForFunction(() => {
        const snapshot = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.();
        return snapshot?.listenerCounts?.ottMix >= 1;
    });

    return page;
}

async function clickSnapshotSlot(page, slotID) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, nextSlotID) => {
        const button = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(button instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        button.click();
    }, slotID);
}

async function pressSnapshotShortcut(page, slotID, key) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, { nextSlotID, nextKey }) => {
        const button = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(button instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        button.focus();
        button.dispatchEvent(new KeyboardEvent("keydown", {
            key: nextKey,
            metaKey: true,
            bubbles: true,
            cancelable: true,
        }));
    }, { nextSlotID: slotID, nextKey: key });
}

async function copySnapshotEvent(page, slotID) {
    return page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, nextSlotID) => {
        const input = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(input instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        const data = new DataTransfer();
        const copyEvent = new ClipboardEvent("copy", {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
        });
        input.focus();
        input.dispatchEvent(copyEvent);
        return data.getData("text/plain");
    }, slotID);
}

async function pasteSnapshotEvent(page, slotID, snapshotText) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, { nextSlotID, nextSnapshotText }) => {
        const button = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(button instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        button.focus();
        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer(),
        });
        pasteEvent.clipboardData.setData("text/plain", nextSnapshotText);
        button.dispatchEvent(pasteEvent);
    }, { nextSlotID: slotID, nextSnapshotText: snapshotText });
}

async function setSnapshotLabel(page, label) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, nextLabel) => {
        const input = shadowRoot.querySelector("[data-snapshot-label-input]");

        if (!(input instanceof HTMLInputElement))
            throw new Error("Missing snapshot label input.");

        input.value = nextLabel;
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }, label);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.getSnapshot());
}

async function waitForHarnessMessage(page, messageFragment) {
    await page.waitForFunction((nextMessageFragment) => {
        const snapshot = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.();
        return typeof snapshot?.message === "string" && snapshot.message.includes(nextMessageFragment);
    }, messageFragment);

    return getHarnessSnapshot(page);
}

before(async () => {
    server = await startStaticRepoServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("OTT lab snapshot slots are compact single-input tabs", async () => {
    const page = await openOttLabPage();

    try {
        const snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.slotStates.map((slot) => slot.slot), ["A", "B", "C", "D", "E", "F", "G"]);
        assert.deepEqual(snapshot.slotStates.map((slot) => slot.value), ["A", "B", "C", "D", "E", "F", "G"]);
        assert.deepEqual(await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }) => ({
            actionButtonCount: shadowRoot.querySelectorAll("[data-snapshot-action]").length,
            slotInputCount: shadowRoot.querySelectorAll("input.snapshot-slot").length,
            labelInputCount: shadowRoot.querySelectorAll("[data-snapshot-label-input]").length,
        })), {
            actionButtonCount: 0,
            slotInputCount: 7,
            labelInputCount: 1,
        });
        assert.deepEqual(snapshot.labelInput, {
            value: "",
            disabled: true,
        });
    } finally {
        await page.close();
    }
});

test("OTT lab snapshot slot inputs stay labelled after accidental typing", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }) => {
            const input = shadowRoot.querySelector('.snapshot-slot[data-slot="A"]');

            if (!(input instanceof HTMLInputElement))
                throw new Error("Missing snapshot slot A.");

            input.value = "x";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const snapshot = await getHarnessSnapshot(page);

        assert.equal(snapshot.slotStates.find((slot) => slot.slot === "A")?.value, "A");
    } finally {
        await page.close();
    }
});

test("OTT lab active snapshot updates automatically when parameter values change", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        let snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.A.values, {
            ottMix: 87,
            ottTimePercent: 120,
            ottBandDrive: 22,
        });
        assert.equal(snapshot.store.slots.A.label, "");
        assert.equal("hostSlot0Guard" in snapshot.store.slots.A.values, false);

        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 64);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottTimePercent", 250);
        });
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.A.values, {
            ottMix: 64,
            ottTimePercent: 250,
            ottBandDrive: 22,
        });
        assert.equal(snapshot.activeElementSlot, "A");
    } finally {
        await page.close();
    }
});

test("OTT lab snapshot label input follows and edits the active slot", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await setSnapshotLabel(page, "bright smash");
        let snapshot = await getHarnessSnapshot(page);

        assert.equal(snapshot.store.slots.A.label, "bright smash");
        assert.deepEqual(snapshot.labelInput, {
            value: "bright smash",
            disabled: false,
        });

        await clickSnapshotSlot(page, "B");
        await setSnapshotLabel(page, "dark pump");
        snapshot = await getHarnessSnapshot(page);

        assert.equal(snapshot.store.slots.A.label, "bright smash");
        assert.equal(snapshot.store.slots.B.label, "dark pump");
        assert.deepEqual(snapshot.labelInput, {
            value: "dark pump",
            disabled: false,
        });

        await clickSnapshotSlot(page, "A");
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.labelInput, {
            value: "bright smash",
            disabled: false,
        });
    } finally {
        await page.close();
    }
});

test("OTT lab recalls a filled slot and then edits only the newly active slot", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await clickSnapshotSlot(page, "B");
        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 12);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottTimePercent", 900);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottBandDrive", 3);
        });

        let snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.A.values, {
            ottMix: 87,
            ottTimePercent: 120,
            ottBandDrive: 22,
        });
        assert.deepEqual(snapshot.store.slots.B.values, {
            ottMix: 12,
            ottTimePercent: 900,
            ottBandDrive: 3,
        });

        await clickSnapshotSlot(page, "A");
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.sentMessages.slice(-3), [
            { endpointID: "ottMix", value: 87, rampFrames: 0 },
            { endpointID: "ottTimePercent", value: 120, rampFrames: 0 },
            { endpointID: "ottBandDrive", value: 22, rampFrames: 0 },
        ]);
        assert.equal(snapshot.activeElementSlot, "A");
    } finally {
        await page.close();
    }
});

test("OTT lab copies and pastes through native focused-slot clipboard events", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await setSnapshotLabel(page, "verse crush");
        const copiedText = await copySnapshotEvent(page, "A");
        let snapshot = await getHarnessSnapshot(page);
        const copiedSnapshot = JSON.parse(copiedText);

        assert.equal(copiedSnapshot.kind, SNAPSHOT_EXPORT_KIND);
        assert.equal(copiedSnapshot.schema, 1);
        assert.equal(copiedSnapshot.patchID, SNAPSHOT_PATCH_ID);
        assert.equal(copiedSnapshot.slot, "A");
        assert.equal(copiedSnapshot.label, "verse crush");
        assert.deepEqual(copiedSnapshot.values, {
            ottMix: 87,
            ottTimePercent: 120,
            ottBandDrive: 22,
        });
        assert.match(snapshot.message, /Copied A/);
        assert.equal(snapshot.toastVisible, true);

        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 5);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottTimePercent", 1000);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottBandDrive", 0);
        });
        await clickSnapshotSlot(page, "B");
        await pasteSnapshotEvent(page, "B", copiedText);
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.B.values, copiedSnapshot.values);
        assert.equal(snapshot.store.slots.B.label, "verse crush");
        assert.equal(snapshot.labelInput.value, "verse crush");
        assert.deepEqual(snapshot.sentMessages.slice(-3), [
            { endpointID: "ottMix", value: 87, rampFrames: 0 },
            { endpointID: "ottTimePercent", value: 120, rampFrames: 0 },
            { endpointID: "ottBandDrive", value: 22, rampFrames: 0 },
        ]);
        assert.match(snapshot.message, /Pasted into B/);
        assert.equal(snapshot.toastVisible, true);
        assert.equal(snapshot.activeElementSlot, "B");
    } finally {
        await page.close();
    }
});

test("OTT lab keyboard fallback copies the focused slot when no native copy event arrives", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await pressSnapshotShortcut(page, "A", "c");
        await page.waitForFunction(() => {
            const snapshot = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.();
            return snapshot?.clipboardText?.includes("cosimo.ottLab.snapshot");
        });
        const snapshot = await getHarnessSnapshot(page);
        const copiedSnapshot = JSON.parse(snapshot.clipboardText);

        assert.equal(copiedSnapshot.kind, SNAPSHOT_EXPORT_KIND);
        assert.equal(copiedSnapshot.patchID, SNAPSHOT_PATCH_ID);
        assert.equal(copiedSnapshot.label, "");
        assert.deepEqual(copiedSnapshot.values, {
            ottMix: 87,
            ottTimePercent: 120,
            ottBandDrive: 22,
        });
        assert.match(snapshot.message, /Copied A/);
    } finally {
        await page.close();
    }
});

test("OTT lab copy shortcut falls back to textarea copy when clipboard writes are rejected", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.makeClipboardWriteRejectAndInstallExecCommandFallback());
        await pressSnapshotShortcut(page, "A", "c");
        await page.waitForFunction(() => {
            const snapshot = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.();
            return snapshot?.clipboardText?.includes("cosimo.ottLab.snapshot");
        });
        const snapshot = await getHarnessSnapshot(page);
        const copiedSnapshot = JSON.parse(snapshot.clipboardText);

        assert.equal(copiedSnapshot.kind, SNAPSHOT_EXPORT_KIND);
        assert.equal(copiedSnapshot.patchID, SNAPSHOT_PATCH_ID);
        assert.equal(copiedSnapshot.label, "");
        assert.deepEqual(copiedSnapshot.values, {
            ottMix: 87,
            ottTimePercent: 120,
            ottBandDrive: 22,
        });
        assert.match(snapshot.message, /Copied A/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut rejects wrong-patch JSON without changing sound or the target slot", async () => {
    const page = await openOttLabPage({
        clipboardText: createSnapshotExport({ ottMix: 33 }, { patchID: "dev.cosimo.other-effect" }),
    });

    try {
        await clickSnapshotSlot(page, "C");
        const before = await getHarnessSnapshot(page);

        await pressSnapshotShortcut(page, "C", "v");
        const after = await waitForHarnessMessage(page, "patchID must be dev.cosimo.ott-lab");

        assert.deepEqual(after.store.slots.C.values, before.store.slots.C.values);
        assert.deepEqual(after.sentMessages, []);
        assert.match(after.message, /patchID must be dev\.cosimo\.ott-lab/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut rejects out-of-range values without partially applying them", async () => {
    const page = await openOttLabPage({
        clipboardText: createSnapshotExport({ ottMix: 101, ottTimePercent: 120, ottBandDrive: 22 }),
    });

    try {
        await clickSnapshotSlot(page, "D");
        const before = await getHarnessSnapshot(page);

        await pressSnapshotShortcut(page, "D", "v");
        const after = await waitForHarnessMessage(page, "value 101 is above maximum 100");

        assert.deepEqual(after.store.slots.D.values, before.store.slots.D.values);
        assert.deepEqual(after.sentMessages, []);
        assert.match(after.message, /ottMix: value 101 is above maximum 100/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut rejects unknown parameter IDs without partially applying them", async () => {
    const page = await openOttLabPage({
        clipboardText: createSnapshotExport({ ottMix: 72, obsoleteControl: 0.5 }),
    });

    try {
        await clickSnapshotSlot(page, "D");
        const before = await getHarnessSnapshot(page);

        await pressSnapshotShortcut(page, "D", "v");
        const after = await waitForHarnessMessage(page, "Unknown parameter: obsoleteControl");

        assert.deepEqual(after.store.slots.D.values, before.store.slots.D.values);
        assert.deepEqual(after.sentMessages, []);
        assert.match(after.message, /Unknown parameter: obsoleteControl/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut rejects non-string labels without partially applying values", async () => {
    const page = await openOttLabPage({
        clipboardText: createSnapshotExport(
            { ottMix: 72, ottTimePercent: 120, ottBandDrive: 22 },
            { label: { name: "not valid" } },
        ),
    });

    try {
        await clickSnapshotSlot(page, "D");
        const before = await getHarnessSnapshot(page);

        await pressSnapshotShortcut(page, "D", "v");
        const after = await waitForHarnessMessage(page, "Snapshot label must be a string");

        assert.deepEqual(after.store.slots.D.values, before.store.slots.D.values);
        assert.equal(after.store.slots.D.label, before.store.slots.D.label);
        assert.deepEqual(after.sentMessages, []);
    } finally {
        await page.close();
    }
});

test("OTT lab paste events can paste JSON directly into the focused slot", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "F");
        await pasteSnapshotEvent(page, "F", createSnapshotExport(
            { ottMix: 44, ottTimePercent: 80, ottBandDrive: 11 },
            { label: "manual paste tone" },
        ));
        const snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.F.values, {
            ottMix: 44,
            ottTimePercent: 80,
            ottBandDrive: 11,
        });
        assert.equal(snapshot.store.slots.F.label, "manual paste tone");
        assert.equal(snapshot.labelInput.value, "manual paste tone");
        assert.deepEqual(snapshot.sentMessages.slice(-3), [
            { endpointID: "ottMix", value: 44, rampFrames: 0 },
            { endpointID: "ottTimePercent", value: 80, rampFrames: 0 },
            { endpointID: "ottBandDrive", value: 11, rampFrames: 0 },
        ]);
        assert.match(snapshot.message, /Pasted into F/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut opens a manual paste box when clipboard reads are unavailable", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "E");
        await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.removeClipboardRead());
        await pressSnapshotShortcut(page, "E", "v");
        await page.waitForFunction(() => window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.().pasteBoxOpen === true);
        let snapshot = await getHarnessSnapshot(page);

        assert.equal(snapshot.pasteBoxOpen, true);
        assert.match(snapshot.message, /Clipboard read was blocked/);

        await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, snapshotText) => {
            const textarea = shadowRoot.querySelector("[data-snapshot-paste-text]");
            const form = shadowRoot.querySelector("[data-snapshot-paste-form]");

            if (!(textarea instanceof HTMLTextAreaElement) || !(form instanceof HTMLFormElement))
                throw new Error("Manual paste form did not open.");

            textarea.value = snapshotText;
            form.requestSubmit();
        }, createSnapshotExport(
            { ottMix: 44, ottTimePercent: 80, ottBandDrive: 11 },
            { label: "manual fallback tone" },
        ));
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.E.values, {
            ottMix: 44,
            ottTimePercent: 80,
            ottBandDrive: 11,
        });
        assert.equal(snapshot.store.slots.E.label, "manual fallback tone");
        assert.equal(snapshot.labelInput.value, "manual fallback tone");
        assert.deepEqual(snapshot.sentMessages.slice(-3), [
            { endpointID: "ottMix", value: 44, rampFrames: 0 },
            { endpointID: "ottTimePercent", value: 80, rampFrames: 0 },
            { endpointID: "ottBandDrive", value: 11, rampFrames: 0 },
        ]);
        assert.match(snapshot.message, /Pasted into E/);
    } finally {
        await page.close();
    }
});

test("OTT lab keeps stable parameter listener counts after status rerenders", async () => {
    const page = await openOttLabPage();

    try {
        let snapshot = await getHarnessSnapshot(page);
        const initialCounts = snapshot.listenerCounts;

        // Snapshot system registers one listener per visible parameter endpoint.
        // Preset controller may add its own stable listeners.
        // The key invariant: counts must not grow after a re-render.
        assert.ok(initialCounts.ottMix >= 1, "ottMix should have at least one listener");
        assert.ok(initialCounts.ottTimePercent >= 1, "ottTimePercent should have at least one listener");
        assert.ok(initialCounts.ottBandDrive >= 1, "ottBandDrive should have at least one listener");

        await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.emitStatus());
        await page.waitForFunction((expected) => {
            const counts = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.().listenerCounts;
            return counts?.ottMix === expected.ottMix
                && counts?.ottTimePercent === expected.ottTimePercent
                && counts?.ottBandDrive === expected.ottBandDrive;
        }, initialCounts);
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.listenerCounts, initialCounts);
    } finally {
        await page.close();
    }
});
