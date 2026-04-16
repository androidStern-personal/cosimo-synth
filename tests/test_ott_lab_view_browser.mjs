import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { chromium } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const SNAPSHOT_STORAGE_KEY = "cosimo.ottLab.snapshotSlots.v2";
const SNAPSHOT_EXPORT_KIND = "cosimo.effectSnapshot";

let server;
let browser;

const OTT_ENDPOINTS = [
    {
        endpointID: "ottMix",
        purpose: "parameter",
        annotation: { name: "Mix", group: "Global", min: 0, max: 100, init: 100 },
    },
    {
        endpointID: "ottAmount",
        purpose: "parameter",
        annotation: { name: "Amount", group: "Global", min: 0, max: 100, init: 100 },
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
        endpointID: "ottEnvelopeMatch",
        purpose: "parameter",
        annotation: { name: "Envelope Match", group: "Envelope", min: 0, max: 100, init: 0 },
    },
    {
        endpointID: "envelopeBoostClampDb",
        purpose: "parameter",
        annotation: { name: "Env Boost Clamp", group: "Envelope", min: 0, max: 24, init: 6 },
    },
    {
        endpointID: "hostSlot0Guard",
        purpose: "parameter",
        annotation: { name: "Host Guard", hidden: true, min: 0, max: 1, init: 0 },
    },
];

const INITIAL_VALUES = {
    ottMix: 87,
    ottAmount: 91,
    ottTimePercent: 120,
    ottBandDrive: 22,
    ottEnvelopeMatch: 33,
    envelopeBoostClampDb: 7,
    hostSlot0Guard: 1,
};

const INITIAL_SNAPSHOT_PARAMETERS = {
    envelopeBoostClampDb: 7,
    ottAmount: 91,
    ottBandDrive: 22,
    ottEnvelopeMatch: 33,
    ottMix: 87,
    ottTimePercent: 120,
};

const { buildPluginStateContract } = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
const OTT_CONTRACT = buildPluginStateContract({
    effectID: "ott",
    status: { details: { inputs: OTT_ENDPOINTS } },
});

function createSnapshotExport(parameters = {}, overrides = {}) {
    return JSON.stringify({
        kind: SNAPSHOT_EXPORT_KIND,
        version: 2,
        effectID: "ott",
        slotID: "A",
        label: "",
        contract: OTT_CONTRACT,
        parameters: {
            ...INITIAL_SNAPSHOT_PARAMETERS,
            ...parameters,
        },
        storedState: {},
        ...overrides,
    });
}

async function openOttLabPage({ clipboardText = "", initialSnapshotStore = null } = {}) {
    const page = await browser.newPage();

    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    await page.evaluate(({ endpoints, initialValues, initialClipboardText, initialSnapshotStoreText, storageKey }) => {
        window.localStorage.clear();
        if (initialSnapshotStoreText !== null)
            window.localStorage.setItem(storageKey, initialSnapshotStoreText);

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
            sendEventOrValue(endpointID, value) {
                sentMessages.push({ endpointID, value });
                emitParameterValue(endpointID, value);
            },
            manifest: {
                view: {
                    devModule: "/fx/ott_lab/view/source.js",
                },
            },
        };

        window.__OTT_LAB_VIEW_HARNESS__ = {
            async mount() {
                const createPatchView = (await import("/build/fx/ott_lab_runtime/view/index.js")).default;
                const mountPoint = document.getElementById("mount");

                if (!(mountPoint instanceof HTMLElement))
                    throw new Error("Module test mount point is missing.");

                const view = await createPatchView(patchConnection);
                window.setTimeout(() => {
                    mountPoint.replaceChildren(view);
                }, 0);
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
        initialSnapshotStoreText: initialSnapshotStore,
        storageKey: SNAPSHOT_STORAGE_KEY,
    });
    await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.mount());
    await page.waitForSelector("cosimo-ott-lab-view");
    await page.waitForFunction(() => {
        const snapshot = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.();
        return snapshot?.listenerCounts?.ottMix >= 1
            && snapshot?.listenerCounts?.envelopeBoostClampDb >= 1;
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
            composed: true,
        }));
    }, { nextSlotID: slotID, nextKey: key });
}

async function copySnapshotEvent(page, slotID) {
    return await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, nextSlotID) => {
        const input = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(input instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        const clipboard = new DataTransfer();
        const copyEvent = new ClipboardEvent("copy", { clipboardData: clipboard, bubbles: true, composed: true });
        input.dispatchEvent(copyEvent);
        return clipboard.getData("text/plain");
    }, slotID);
}

async function pasteSnapshotEvent(page, slotID, snapshotText) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, { nextSlotID, nextSnapshotText }) => {
        const button = shadowRoot.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`);

        if (!(button instanceof HTMLInputElement))
            throw new Error(`Missing snapshot slot ${nextSlotID}.`);

        const clipboard = new DataTransfer();
        clipboard.setData("text/plain", nextSnapshotText);
        const pasteEvent = new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, composed: true });
        button.dispatchEvent(pasteEvent);
    }, { nextSlotID: slotID, nextSnapshotText: snapshotText });
}

async function setSnapshotLabel(page, label) {
    await page.locator("cosimo-ott-lab-view").evaluate(({ shadowRoot }, nextLabel) => {
        const input = shadowRoot.querySelector("[data-snapshot-label-input]");

        if (!(input instanceof HTMLInputElement))
            throw new Error("Missing snapshot label input.");

        input.value = nextLabel;
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
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
        assert.deepEqual(snapshot.labelInput, {
            value: "",
            disabled: true,
        });
    } finally {
        await page.close();
    }
});

test("OTT lab reports malformed stored v2 snapshots instead of silently ignoring them", async () => {
    const page = await openOttLabPage({
        initialSnapshotStore: JSON.stringify({
            schema: 2,
            patchID: "dev.cosimo.ott-lab",
            slots: {
                A: {
                    kind: "cosimo.legacySnapshot",
                    version: 2,
                },
            },
        }),
    });

    try {
        const snapshot = await waitForHarnessMessage(page, "Stored snapshots were ignored");

        assert.match(snapshot.message, /Stored snapshot A is not valid cosimo\.effectSnapshot version 2/i);
        assert.equal(snapshot.toastVisible, true);
        assert.deepEqual(snapshot.sentMessages, []);
        assert.deepEqual(snapshot.slotStates.map((slot) => slot.value), ["A", "B", "C", "D", "E", "F", "G"]);
    } finally {
        await page.close();
    }
});

test("OTT lab active snapshot captures and updates every visible parameter", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        let snapshot = await getHarnessSnapshot(page);

        assert.equal(snapshot.store.schema, 2);
        assert.equal(snapshot.store.slots.A.kind, SNAPSHOT_EXPORT_KIND);
        assert.deepEqual(snapshot.store.slots.A.parameters, INITIAL_SNAPSHOT_PARAMETERS);
        assert.equal("hostSlot0Guard" in snapshot.store.slots.A.parameters, false);

        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 64);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("envelopeBoostClampDb", 11);
        });
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.A.parameters, {
            ...INITIAL_SNAPSHOT_PARAMETERS,
            envelopeBoostClampDb: 11,
            ottMix: 64,
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
    } finally {
        await page.close();
    }
});

test("OTT lab recalls a filled slot by applying the full v2 snapshot parameter set", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await clickSnapshotSlot(page, "B");
        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 12);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottAmount", 13);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottTimePercent", 900);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottBandDrive", 3);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottEnvelopeMatch", 4);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("envelopeBoostClampDb", 5);
        });
        await clickSnapshotSlot(page, "A");
        const snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.sentMessages.slice(-6), Object.entries(INITIAL_SNAPSHOT_PARAMETERS).map(([endpointID, value]) => ({
            endpointID,
            value,
        })));
        assert.equal(snapshot.activeElementSlot, "A");
    } finally {
        await page.close();
    }
});

test("OTT lab copies and pastes v2 snapshot JSON through focused-slot clipboard events", async () => {
    const page = await openOttLabPage();

    try {
        await clickSnapshotSlot(page, "A");
        await setSnapshotLabel(page, "verse crush");
        const copiedText = await copySnapshotEvent(page, "A");
        let snapshot = await getHarnessSnapshot(page);
        const copiedSnapshot = JSON.parse(copiedText);

        assert.equal(copiedSnapshot.kind, SNAPSHOT_EXPORT_KIND);
        assert.equal(copiedSnapshot.version, 2);
        assert.equal(copiedSnapshot.effectID, "ott");
        assert.equal(copiedSnapshot.slotID, "A");
        assert.equal(copiedSnapshot.label, "verse crush");
        assert.deepEqual(copiedSnapshot.parameters, INITIAL_SNAPSHOT_PARAMETERS);
        assert.match(snapshot.message, /Copied A/);
        assert.equal(snapshot.toastVisible, true);

        await page.evaluate(() => {
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottMix", 5);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottAmount", 6);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottTimePercent", 1000);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottBandDrive", 0);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("ottEnvelopeMatch", 1);
            window.__OTT_LAB_VIEW_HARNESS__.setParameterValue("envelopeBoostClampDb", 2);
        });
        await clickSnapshotSlot(page, "B");
        await pasteSnapshotEvent(page, "B", copiedText);
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.B.parameters, copiedSnapshot.parameters);
        assert.equal(snapshot.store.slots.B.label, "verse crush");
        assert.equal(snapshot.labelInput.value, "verse crush");
        assert.deepEqual(snapshot.sentMessages.slice(-6), Object.entries(INITIAL_SNAPSHOT_PARAMETERS).map(([endpointID, value]) => ({
            endpointID,
            value,
        })));
        assert.match(snapshot.message, /Pasted into B/);
        assert.equal(snapshot.toastVisible, true);
        assert.equal(snapshot.activeElementSlot, "B");
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut rejects incompatible snapshot JSON without changing sound or the target slot", async () => {
    const page = await openOttLabPage({
        clipboardText: createSnapshotExport({ obsoleteControl: 0.5 }),
    });

    try {
        await clickSnapshotSlot(page, "D");
        const before = await getHarnessSnapshot(page);

        await pressSnapshotShortcut(page, "D", "v");
        const after = await waitForHarnessMessage(page, "Unknown parameter");

        assert.deepEqual(after.store.slots.D.parameters, before.store.slots.D.parameters);
        assert.deepEqual(after.sentMessages, []);
        assert.match(after.message, /obsoleteControl/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste events can paste JSON directly into the focused slot", async () => {
    const page = await openOttLabPage();
    const pastedParameters = {
        envelopeBoostClampDb: 9,
        ottAmount: 45,
        ottBandDrive: 11,
        ottEnvelopeMatch: 12,
        ottMix: 44,
        ottTimePercent: 80,
    };

    try {
        await clickSnapshotSlot(page, "F");
        await pasteSnapshotEvent(page, "F", createSnapshotExport(pastedParameters, { label: "manual paste tone" }));
        const snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.F.parameters, pastedParameters);
        assert.equal(snapshot.store.slots.F.label, "manual paste tone");
        assert.equal(snapshot.labelInput.value, "manual paste tone");
        assert.deepEqual(snapshot.sentMessages.slice(-6), Object.entries(pastedParameters).map(([endpointID, value]) => ({
            endpointID,
            value,
        })));
        assert.match(snapshot.message, /Pasted into F/);
    } finally {
        await page.close();
    }
});

test("OTT lab paste shortcut opens a manual paste box when clipboard reads are unavailable", async () => {
    const page = await openOttLabPage();
    const pastedParameters = {
        envelopeBoostClampDb: 9,
        ottAmount: 45,
        ottBandDrive: 11,
        ottEnvelopeMatch: 12,
        ottMix: 44,
        ottTimePercent: 80,
    };

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
        }, createSnapshotExport(pastedParameters, { label: "manual fallback tone" }));
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.store.slots.E.parameters, pastedParameters);
        assert.equal(snapshot.store.slots.E.label, "manual fallback tone");
        assert.equal(snapshot.labelInput.value, "manual fallback tone");
        assert.deepEqual(snapshot.sentMessages.slice(-6), Object.entries(pastedParameters).map(([endpointID, value]) => ({
            endpointID,
            value,
        })));
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

        assert.ok(initialCounts.ottMix >= 1, "ottMix should have at least one listener");
        assert.ok(initialCounts.envelopeBoostClampDb >= 1, "envelopeBoostClampDb should have at least one listener");

        await page.evaluate(() => window.__OTT_LAB_VIEW_HARNESS__.emitStatus());
        await page.waitForFunction((expected) => {
            const counts = window.__OTT_LAB_VIEW_HARNESS__?.getSnapshot?.().listenerCounts;
            return Object.entries(expected).every(([endpointID, count]) => counts?.[endpointID] === count);
        }, initialCounts);
        snapshot = await getHarnessSnapshot(page);

        assert.deepEqual(snapshot.listenerCounts, initialCounts);
    } finally {
        await page.close();
    }
});
