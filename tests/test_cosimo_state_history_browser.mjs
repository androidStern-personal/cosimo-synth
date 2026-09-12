import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { bundleBrowserModuleSource } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "build/web");

test("actual Cosimo GUI and audio restore parameter, wavetable, rack, articulation, matrix and curve history", { timeout: 120000 }, async () => {
    const driver = await bundleBrowserModuleSource(path.join(root, "tests/helpers/cosimo-history-client.ts"));
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            const file = path.resolve(web, `.${pathname === "/" ? "/index.html" : pathname}`);
            assert.ok(file.startsWith(`${web}/`));
            let body = pathname === "/history-client.js" ? driver : await readFile(file);
            // Observe the real host's connection; no production command is substituted.
            if (pathname === "/cosimo-web-host.js") body = body.toString().replace(
                "state.connection = connection;", "state.connection = connection; globalThis.proofConnection = connection;");
            response.writeHead(200, {
                "Content-Type": ({ ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json" })[path.extname(file)] ?? "application/octet-stream",
                "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp",
            });
            response.end(body);
        } catch (error) { response.writeHead(404); response.end(String(error)); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [], checkpoints = [];
    let phase = "startup";
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") { errors.push(message.text()); console.error(`${phase}: ${message.text()}`); } });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/synth.html?test=1`);
        await page.waitForFunction(() => window.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready");
        await page.locator("#cosimo-start-overlay").click();
        await page.evaluate(async () => {
            const { connect } = await import("/history-client.js");
            window.historyClient = connect(window.proofConnection);
            window.dspTables = [null, null, null];
            window.proofConnection.addEndpointListener("runtimeState", value => { window.dspTables[value.oscillatorIndex] = value; });
            window.proofConnection.sendEventOrValue("runtimeSyncRequest", 20000000);
            const context = window.proofConnection.audioNode.context;
            const url = URL.createObjectURL(new Blob([`registerProcessor("history-audio", class extends AudioWorkletProcessor {
                constructor() { super(); this.remaining=0; this.port.onmessage=()=>{this.remaining=8192;this.count=0;this.left=0;this.right=0;this.bad=0;}; }
                process(inputs) { if(this.remaining>0) for(let i=0;i<(inputs[0]?.[0]?.length??0)&&this.remaining>0;i++) {
                    const l=inputs[0][0][i],r=inputs[0][1]?.[i]??l;this.left+=l*l;this.right+=r*r;
                    if(!Number.isFinite(l)||!Number.isFinite(r))this.bad++;this.count++;this.remaining--;
                    if(this.remaining===0)this.port.postMessage({left:Math.sqrt(this.left/this.count),right:Math.sqrt(this.right/this.count),bad:this.bad,samples:this.count});
                } return true; }
            });`], { type: "text/javascript" }));
            await context.audioWorklet.addModule(url); URL.revokeObjectURL(url);
            window.audioCapture = new AudioWorkletNode(context, "history-audio", { numberOfInputs: 1, numberOfOutputs: 0 });
            window.proofConnection.audioNode.connect(window.audioCapture);
        });
        await page.waitForFunction(() => window.dspTables.every(table => table?.hasActive));
        await page.waitForFunction(() => window.historyClient.getSnapshot().state?.fields.oscAWavetableSelect?.readiness.kind === "ready");
        // This is the actual compiled parameter list, not a separately maintained fixture.
        const coverage = await page.evaluate(async () => {
            const { getInputEndpoints } = await import("/cmaj_Cosimo_Synth.js");
            const fields = window.historyClient.getSnapshot().state.fields;
            return getInputEndpoints().filter(endpoint => endpoint.purpose === "parameter" && !endpoint.annotation?.hidden)
                .filter(endpoint => !fields[endpoint.endpointID]).map(endpoint => endpoint.endpointID);
        });
        assert.deepEqual(coverage, [], "every audible host parameter belongs to the same owner");
        await page.waitForFunction(() => window.historyClient.getSnapshot().state.fields["modulation.v6"].application?.kind === "sent");
        const state = () => page.evaluate(() => window.historyClient.getSnapshot().state);
        // Drive actual product controls before the lower-level public-client sequence.
        const cutoffControl = page.getByLabel("Filter cutoff", { exact: true });
        const tableControl = page.getByLabel("Select wavetable", { exact: true });
        const originalCutoffText = await cutoffControl.inputValue();
        const originalTableText = await tableControl.inputValue();
        const originalCutoff = (await state()).fields.filterCutoff.value;
        await cutoffControl.dblclick(); // The precision readout enters text editing explicitly.
        await cutoffControl.fill("2200"); await cutoffControl.press("Enter");
        await tableControl.selectOption("3");
        const voiceSettings = page.getByRole("button", { name: "Voice settings (Poly)", exact: true });
        await voiceSettings.click();
        const guiUndo = page.getByRole("button", { name: "Undo Voice edit", exact: true });
        const guiRedo = page.getByRole("button", { name: "Redo Voice edit", exact: true });
        const guiCheckpoint = async (cutoff, table, cutoffText) => {
            phase = `GUI cutoff ${cutoff}, table ${table}`;
            await page.waitForFunction(({ cutoff, table }) => {
                const fields = window.historyClient.getSnapshot().state.fields;
                return fields.filterCutoff.value === cutoff && fields.oscAWavetableSelect.value === table
                    && window.dspTables[0]?.activeTableIndex === table;
            }, { cutoff, table });
            assert.equal(await cutoffControl.inputValue(), cutoffText);
            assert.equal(await tableControl.inputValue(), String(table));
        };
        await guiCheckpoint(2200, 3, "2.20 kHz");
        await guiUndo.click(); await guiCheckpoint(2200, Number(originalTableText), "2.20 kHz");
        await guiUndo.click(); await guiCheckpoint(originalCutoff, Number(originalTableText), originalCutoffText);
        assert.equal(await guiUndo.isEnabled(), false, "two DOM user edits create exactly two shared history entries");
        await guiRedo.click(); await guiCheckpoint(2200, Number(originalTableText), "2.20 kHz");
        await guiRedo.click(); await guiCheckpoint(2200, 3, "2.20 kHz");
        assert.equal(await guiRedo.isEnabled(), false);
        await guiUndo.click(); await guiCheckpoint(2200, Number(originalTableText), "2.20 kHz");
        await guiUndo.click(); await guiCheckpoint(originalCutoff, Number(originalTableText), originalCutoffText);
        await voiceSettings.click();
        const initial = await state();
        const dispatch = async command => {
            const result = await page.evaluate(command => window.historyClient.dispatch(command), command);
            assert.equal(result.kind, "accepted", JSON.stringify({ command, result }));
        };
        const checkpoint = async (label, expectedTable, expectedGain, expectedBank, silent = false) => {
            phase = label;
            await page.waitForFunction(table => window.dspTables[0]?.hasActive && window.dspTables[0].activeTableIndex === table, expectedTable);
            await page.waitForFunction(() => window.historyClient.getSnapshot().state.fields["modulation.v6"].application?.kind === "sent");
            const accepted = await state();
            assert.equal(accepted.fields.oscAVolumeDb.value, expectedGain, label);
            assert.equal(accepted.fields.oscAWavetableSelect.value, expectedTable, label);
            assert.deepEqual(accepted.fields["modulation.v6"].value, expectedBank, label);
            await page.evaluate(async () => {
                window.__COSIMO_WEB_POC__.noteOff(60);
                await new Promise(resolve => setTimeout(resolve, 350)); // Actual default amp release.
                window.__COSIMO_WEB_POC__.noteOn(60);
                await new Promise(resolve => setTimeout(resolve, 100)); // Clear the amp attack before measuring.
            });
            const actual = await page.evaluate(async () => {
                const audio = await new Promise(resolve => {
                    window.audioCapture.port.onmessage = event => resolve(event.data);
                    window.audioCapture.port.postMessage("capture");
                });
                return { table: window.dspTables[0], ack: window.__COSIMO_WEB_POC__.runtimeInstallAckForTest(), audio };
            });
            assert.equal(actual.audio.bad, 0, label);
            assert.equal(actual.audio.samples, 8192, label);
            if (silent) assert.equal(actual.audio.left + actual.audio.right, 0, `${label}: enabled silent trim reaches the audio output`);
            else assert.ok(actual.audio.left + actual.audio.right > 0, label);
            if (expectedBank === curved) assert.ok(actual.audio.left > actual.audio.right * 1.2,
                `${label}: the installed constant curve must actually pan the rendered sound left`);
            if (expectedBank === bank && !silent) assert.ok(Math.abs(actual.audio.left / actual.audio.right - 1) < 0.02,
                `${label}: removing modulation restores centered audio, not just the displayed matrix`);
            checkpoints.push({ label, ...actual });
        };
        const gain = initial.fields.oscAVolumeDb.value;
        const table = initial.fields.oscAWavetableSelect.value;
        const bank = initial.fields["modulation.v6"].value;
        const routed = structuredClone(bank);
        routed.routes.push({ id: "history-proof-pan", sourceKind: "mseg", sourceSlot: 1,
            targetKind: "oscA.pan", enabled: true, polarity: "bipolar", amount: 0.8, reducer: "max" });
        const curved = structuredClone(routed);
        curved.msegSlots[0].shapeA.points = [{ x: 0, y: 0.2, curvePower: 0 }, { x: 1, y: 0.2, curvePower: 0 }];
        await checkpoint("baseline", table, gain, bank);
        const baselineAudio = checkpoints[checkpoints.length - 1].audio.left;
        await dispatch({ kind: "edit", key: "laneDistortion1OutputTrimDb", value: -100 });
        await page.waitForFunction(() => window.historyClient.getSnapshot().state.fields["lane.v1"].application?.kind === "sent");
        await checkpoint("bypassed rack silent trim", table, gain, bank);
        assert.ok(Math.abs(checkpoints[checkpoints.length - 1].audio.left / baselineAudio - 1) < 0.12,
            "a bypassed device cannot silence the lane through its resident trim");
        const rack = structuredClone(initial.fields["lane.v1"].value);
        rack.chain[0].enabled = true;
        rack.devices["distortion#1"].params.distortionDriveDb = 36;
        rack.devices["distortion#1"].params.distortionWet = 1;
        await dispatch({ kind: "edit", key: "lane.v1", value: rack });
        await page.waitForFunction(() => window.historyClient.getSnapshot().state.fields["lane.v1"].application?.kind === "sent");
        await checkpoint("rack enabled", table, gain, bank, true);
        await dispatch({ kind: "undo" });
        await page.waitForFunction(() => window.historyClient.getSnapshot().state.fields["lane.v1"].application?.kind === "sent");
        await checkpoint("undo rack", table, gain, bank);
        assert.ok(Math.abs(checkpoints[checkpoints.length - 1].audio.left / baselineAudio - 1) < 0.12,
            "rack Undo restores bypassed audio");
        await dispatch({ kind: "undo" });
        assert.equal((await state()).fields.laneDistortion1OutputTrimDb.value, initial.fields.laneDistortion1OutputTrimDb.value);
        await dispatch({ kind: "edit", key: "articulations.v4", value: {
            format: "cosimo.articulations", version: 4, selectedSlotId: "browser-history-art", activeTriggerMode: "vel",
            slots: [{ id: "browser-history-art", runtimeSlot: 7, name: "Browser history", color: "red", key: 24,
                velRange: { min: 100, max: 100 }, chainRange: { min: 0, max: 0 },
                overrides: { "oscA.volumeDb": -24 }, routeAmounts: {} }],
        } });
        await checkpoint("velocity articulation", table, gain, bank);
        assert.ok(checkpoints[checkpoints.length - 1].audio.left < baselineAudio * 0.15,
            "the browser host selects the installed articulation on the actual velocity-100 note");
        await dispatch({ kind: "undo" });
        await checkpoint("undo articulation", table, gain, bank);
        assert.ok(Math.abs(checkpoints[checkpoints.length - 1].audio.left / baselineAudio - 1) < 0.12,
            "articulation Undo removes the actual note override");
        assert.equal((await state()).history.canUndo, false);
        await dispatch({ kind: "edit", key: "oscAVolumeDb", value: -12 });
        await checkpoint("gain", table, -12, bank);
        await dispatch({ kind: "edit", key: "oscAWavetableSelect", value: 3 });
        await checkpoint("table", 3, -12, bank);
        await dispatch({ kind: "edit", key: "modulation.v6", value: routed });
        await checkpoint("matrix", 3, -12, routed);
        await dispatch({ kind: "edit", key: "modulation.v6", value: curved });
        await checkpoint("curve", 3, -12, curved);
        for (const [label, tableIndex, gainValue, mod] of [
            ["undo curve", 3, -12, routed], ["undo matrix", 3, -12, bank],
            ["undo table", table, -12, bank], ["undo gain", table, gain, bank],
        ]) { await dispatch({ kind: "undo" }); await checkpoint(label, tableIndex, gainValue, mod); }
        assert.equal((await state()).history.canUndo, false, "one history entry per user operation; worker updates add none");
        // Close both editors, then recreate the real compiled GUI on the same audio instance.
        await page.evaluate(async () => {
            window.historyClient.stop();
            document.getElementById("cosimo-view").replaceChildren();
            const { createPatchViewHolder } = await import("/cmaj_api/cmaj-patch-view.js");
            const view = await createPatchViewHolder(window.proofConnection);
            if (!view) throw new Error("The production GUI could not reopen");
            document.getElementById("cosimo-view").replaceChildren(view);
            const { connect } = await import("/history-client.js");
            window.historyClient = connect(window.proofConnection);
        });
        await page.waitForFunction(() => window.historyClient.getSnapshot().state?.history.canRedo === true);
        await voiceSettings.click();
        assert.equal(await guiRedo.isEnabled(), true, "the reopened production GUI sees the surviving history");
        assert.equal(await guiUndo.isEnabled(), false);
        await voiceSettings.click();
        for (const [label, tableIndex, gainValue, mod] of [
            ["redo gain", table, -12, bank], ["redo table", 3, -12, bank],
            ["redo matrix", 3, -12, routed], ["redo curve", 3, -12, curved],
        ]) { await dispatch({ kind: "redo" }); await checkpoint(label, tableIndex, gainValue, mod); }
        assert.equal((await state()).history.canRedo, false);
        const baseline = checkpoints.find(point => point.label === "baseline").audio.left;
        for (const label of ["gain", "redo gain"]) {
            const measured = checkpoints.find(point => point.label === label).audio.left;
            const expected = baseline * Math.pow(10, (-12 - gain) / 20);
            assert.ok(Math.abs(measured / expected - 1) < 0.12, `${label}: DSP gain must follow the restored dB value`);
        }
        const restored = checkpoints.find(point => point.label === "undo gain").audio.left;
        assert.ok(Math.abs(restored / baseline - 1) < 0.12, "Undo gain restores the actual audio level");
        // Undo a selection while its asynchronous source load is still queued.
        await dispatch({ kind: "edit", key: "oscAWavetableSelect", value: 4 });
        await dispatch({ kind: "undo" });
        await checkpoint("superseded table load", 3, -12, curved);
        assert.deepEqual(errors, []);
        await mkdir(path.join(root, "build/cosimo-state-history-proof"), { recursive: true });
        await writeFile(path.join(root, "build/cosimo-state-history-proof/browser.json"), JSON.stringify({ browser: browser.version(), checkpoints }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({ errors, checkpoints, state: await page.evaluate(() => ({
            client: window.historyClient?.getSnapshot().kind,
            modulation: window.historyClient?.getSnapshot().state?.fields["modulation.v6"],
            ack: window.__COSIMO_WEB_POC__?.runtimeInstallAckForTest(),
        })).catch(() => null) }));
        throw error;
    } finally {
        await page.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
    }
});
