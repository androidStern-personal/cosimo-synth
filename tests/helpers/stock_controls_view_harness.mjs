// Browser harness for the lab views built with ui/shared/stock-controls-view.tsx.
//
// The page gets a patch connection whose parameter values and stored state go
// through the kit's browser state owner, a host status listing the patch's
// parameters as Cmajor reports them, and a stand-in for Cmajor's stock
// ParameterControls that talks to its connection the same way the real
// controls do: listen and request on connect, gesture start, values, gesture end.

import { readFile } from "node:fs/promises";

/** The parameter inputs a Cmajor host reports for a .cmajor main processor, with their annotations. */
export async function hostStatusInputs(dspPath) {
    const source = await readFile(dspPath, "utf8");
    // An annotation may name a namespace constant, such as init: ottlab::defaultLowMidHz.
    const constants = new Map([...source.matchAll(/\blet (\w+) = (-?[\d.]+)f?;/g)].map(([, name, value]) => [name, Number(value)]));
    return [...source.matchAll(/^\s*input value (bool|float32) (\w+)\s*\[\[([^\]]*)\]\]/gm)].map(([, type, endpointID, text]) => {
        const annotation = {};
        for (const [, key, raw] of text.matchAll(/(\w+)\s*:\s*("[^"]*"|[^,]+)/g)) {
            const value = raw.trim();
            if (value.startsWith("\"")) annotation[key] = value.slice(1, -1);
            else if (value === "true" || value === "false") annotation[key] = value === "true";
            else if (/^-?[\d.]+f?$/.test(value)) annotation[key] = Number(value.replace(/f$/, ""));
            else if (constants.has(value.replace(/^\w+::/, ""))) annotation[key] = constants.get(value.replace(/^\w+::/, ""));
        }
        if (type === "bool") annotation.boolean = true;
        return { endpointID, purpose: "parameter", annotation };
    });
}

/**
 * Open a lab view module in a new page. `values` overrides the host's initial
 * parameter values, which otherwise start at each input's init annotation.
 * `errors` collects uncaught page errors.
 */
export async function openStockControlsView(browser, server, { modulePath, manifest, statusInputs, values = {} }) {
    const page = await browser.newPage({ viewport: { width: 980, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error));
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html?width=940&height=860&padding=0", server.baseUrl).toString());
    await page.evaluate(async ({ modulePath, manifest, statusInputs, values }) => {
        const parameterValues = new Map(statusInputs.map(input => [input.endpointID,
            values[input.endpointID] ?? Number(input.annotation.init ?? 0)]));
        const parameterListeners = new Map();
        const statusListeners = new Set();
        const storedState = new Map();
        const hostMessages = [];
        let stateHost;
        let publishingParameter = false;

        const emit = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            if (!publishingParameter) stateHost?.observe(endpointID, Number(value));
            for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
        };

        class StockControl extends HTMLElement {
            constructor(connection, endpointInfo) {
                super();
                this.connection = connection;
                this.endpointID = endpointInfo.endpointID;
                this.className = "labelled-control";
                this.dataset.endpoint = endpointInfo.endpointID;
                this.textContent = endpointInfo.annotation?.name ?? endpointInfo.endpointID;
                this.listener = value => { this.dataset.value = String(value); };
            }
            connectedCallback() {
                this.connection.addParameterListener(this.endpointID, this.listener);
                this.connection.requestParameterValue(this.endpointID);
            }
            disconnectedCallback() { this.connection.removeParameterListener(this.endpointID, this.listener); }
            drag(...steps) {
                this.connection.sendParameterGestureStart(this.endpointID);
                for (const value of steps) this.connection.sendEventOrValue(this.endpointID, value);
                this.connection.sendParameterGestureEnd(this.endpointID);
            }
        }
        customElements.define("stub-stock-control", StockControl);

        const patchConnection = {
            manifest,
            utilities: {
                ParameterControls: {
                    getAllCSS: () => ".labelled-control { display: inline-block; width: 6rem; }",
                    createLabelledControl: (connection, endpointInfo) => new StockControl(connection, endpointInfo),
                },
            },
            addParameterListener(endpointID, listener) {
                const listeners = parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                parameterListeners.set(endpointID, listeners);
            },
            removeParameterListener(endpointID, listener) { parameterListeners.get(endpointID)?.delete(listener); },
            requestParameterValue(endpointID) { queueMicrotask(() => emit(endpointID, parameterValues.get(endpointID))); },
            sendEventOrValue(endpointID, value) {
                hostMessages.push({ type: "value", endpointID, value });
                emit(endpointID, value);
            },
            sendParameterGestureStart(endpointID) { hostMessages.push({ type: "begin", endpointID }); },
            sendParameterGestureEnd(endpointID) { hostMessages.push({ type: "end", endpointID }); },
            addStatusListener(listener) { statusListeners.add(listener); },
            removeStatusListener(listener) { statusListeners.delete(listener); },
            requestStatusUpdate() {
                queueMicrotask(() => { for (const listener of statusListeners) listener({ details: { inputs: statusInputs } }); });
            },
        };

        const { createBrowserPreviewState } = await import("/kit/ui/preview/state.ts");
        stateHost = createBrowserPreviewState({
            snapshot: () => ({ values: Object.fromEntries(storedState), parameters: statusInputs.map(input => ({
                endpoint: input.endpointID, value: Number(parameterValues.get(input.endpointID)),
                min: input.annotation.min ?? 0, max: input.annotation.max ?? 1, step: input.annotation.step ?? 0,
                defaultValue: Number(input.annotation.init ?? 0),
            })) }),
            parameter(endpoint, value) {
                publishingParameter = true;
                try { patchConnection.sendEventOrValue(endpoint, value); }
                finally { publishingParameter = false; }
            },
            stored(key, value) { storedState.set(key, value); },
            gesture(endpoint, kind) {
                if (kind === "gesture-start") patchConnection.sendParameterGestureStart(endpoint);
                else patchConnection.sendParameterGestureEnd(endpoint);
            },
        });
        Object.assign(patchConnection, stateHost.host);
        const module = await import(modulePath);
        const mount = document.querySelector("#mount");
        mount.replaceChildren(module.default(patchConnection));
        window.__LAB__ = {
            hostMessages,
            /** Host automation or another editor moving a parameter. */
            automate: emit,
            hostValue: endpointID => parameterValues.get(endpointID),
            listenerCount: endpointID => parameterListeners.get(endpointID)?.size ?? 0,
            control: endpointID => document.querySelector("#mount > *").shadowRoot
                .querySelector(`stub-stock-control[data-endpoint="${endpointID}"]`),
            close: () => mount.replaceChildren(),
            reopen: () => mount.replaceChildren(module.default(patchConnection)),
        };
    }, { modulePath, manifest, statusInputs, values });
    return { page, errors };
}

/** Wait until a control shows a value, then return it as a number. */
export async function displayedValue(page, endpointID, expected) {
    await page.waitForFunction(({ endpointID, expected }) => {
        const shown = window.__LAB__.control(endpointID)?.dataset.value;
        return shown !== undefined && (expected === undefined || Number(shown) === expected);
    }, { endpointID, expected }, { timeout: 5000 });
    return page.evaluate(endpointID => Number(window.__LAB__.control(endpointID).dataset.value), endpointID);
}

/** Drag one control through the given values as one gesture. */
export async function drag(page, endpointID, ...steps) {
    await page.evaluate(({ endpointID, steps }) => window.__LAB__.control(endpointID).drag(...steps), { endpointID, steps });
}
