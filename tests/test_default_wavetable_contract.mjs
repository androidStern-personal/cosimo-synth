import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";


if (typeof globalThis.HTMLElement === "undefined") {
    globalThis.HTMLElement = class HTMLElementStub {
        attachShadow() {
            this.shadowRoot = { innerHTML: "" };
            return this.shadowRoot;
        }
    };
}

const repoRoot = path.resolve(import.meta.dirname, "..");

function readEndpointAnnotation(source, endpointID, annotationName) {
    const declaration = source.match(new RegExp(
        `input value [^\\s]+ ${endpointID} \\[\\[([^\\]]*)\\]\\]`,
    ));
    assert.ok(declaration, `Missing ${endpointID} declaration`);
    const annotation = declaration[1].match(new RegExp(
        `(?:^|,\\s*)${annotationName}:\\s*(-?[0-9]+(?:\\.[0-9]+)?)f?(?:,|$)`,
    ));
    assert.ok(annotation, `Missing ${endpointID} ${annotationName} annotation`);
    return Number(annotation[1]);
}

test("brand-new synth surfaces select the stable Core Shapes factory table for A, B, and C", async () => {
    const [defaults, mockModule, synthSource, sourceCatalogText] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/oscillator-defaults.ts"),
        loadUIModule(repoRoot, "ui/shared/patch-connection-mock.ts"),
        fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "assets/factory-table-catalog.json"), "utf8"),
    ]);
    const sourceCatalog = JSON.parse(sourceCatalogText);

    assert.equal(defaults.OSCILLATOR_DEFAULT_WAVETABLE_ID, "core-shapes");
    assert.equal(defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX, 35);
    assert.equal(defaults.OSCILLATOR_WAVETABLE_MIN_INDEX, 0);
    assert.equal(defaults.OSCILLATOR_WAVETABLE_MAX_INDEX, sourceCatalog.length - 1);
    assert.equal(
        sourceCatalog[defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX]?.tableId,
        defaults.OSCILLATOR_DEFAULT_WAVETABLE_ID,
    );

    for (const oscillatorID of ["A", "B", "C"]) {
        const endpointID = `osc${oscillatorID}WavetableSelect`;
        assert.equal(
            readEndpointAnnotation(synthSource, endpointID, "init"),
            defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
        );
        assert.equal(
            readEndpointAnnotation(synthSource, endpointID, "min"),
            defaults.OSCILLATOR_WAVETABLE_MIN_INDEX,
        );
        assert.equal(
            readEndpointAnnotation(synthSource, endpointID, "max"),
            defaults.OSCILLATOR_WAVETABLE_MAX_INDEX,
        );
    }

    const connection = new mockModule.MockPatchConnection({ name: "Fresh patch", version: 1 });
    const status = await new Promise((resolve) => {
        connection.addStatusListener(resolve);
        connection.requestStatusUpdate();
    });
    const parameterByID = new Map(
        status.details.inputs
            .filter((input) => input.purpose === "parameter")
            .map((input) => [input.endpointID, input]),
    );
    const debug = connection.getDebugSnapshot();

    for (const oscillatorID of ["A", "B", "C"]) {
        const endpointID = `osc${oscillatorID}WavetableSelect`;
        assert.equal(
            parameterByID.get(endpointID)?.annotation.init,
            defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
        );
        assert.equal(
            parameterByID.get(endpointID)?.annotation.max,
            defaults.OSCILLATOR_WAVETABLE_MAX_INDEX,
        );
        assert.equal(
            debug.parameterValues[endpointID],
            defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
        );
    }
    assert.equal(debug.runtimeState.desiredTableIndex, defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX);
    assert.equal(debug.runtimeState.activeTableIndex, defaults.OSCILLATOR_DEFAULT_WAVETABLE_INDEX);
});

test("the curated Sites bank includes Core Shapes without shipping the complete factory library", async () => {
    const [sitesBuildSource, sourceCatalogText] = await Promise.all([
        fs.readFile(path.join(repoRoot, "web/build-sites.mjs"), "utf8"),
        fs.readFile(path.join(repoRoot, "assets/factory-table-catalog.json"), "utf8"),
    ]);
    const sourceCatalog = JSON.parse(sourceCatalogText);

    assert.match(sitesBuildSource, /const sitesDefaultTableName = "Core Shapes";/);
    assert.equal(sourceCatalog[35]?.tableId, "core-shapes");
    assert.ok(sourceCatalog.length > 36, "the curated Sites bank must remain a strict subset");
});
