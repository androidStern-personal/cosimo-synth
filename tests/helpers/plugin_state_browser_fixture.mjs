import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { build as bundle } from "esbuild";
import { buildPluginStateFixture } from "./build_plugin_state_fixture.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const fixture = path.join(root, "tests/browser/fixtures/plugin_state_system");

/** Actual generated worker, React view, native storage and DSP checks shared by scenarios. */
export async function startPluginStateBrowserFixture(build) {
    const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
    let browser, page, server;
    const errors = [];

    async function close() {
        const cleanup = [];
        try { await page?.evaluate(() => window.fixture?.dispose()); } catch (error) { cleanup.push(error); }
        try { await browser?.close(); } catch (error) { cleanup.push(error); }
        if (server) await new Promise(resolve => server.close(resolve));
        if (cleanup.length) throw new AggregateError(cleanup, "Production browser fixture cleanup failed");
    }

    async function expectValues(gain, points) {
        await page.waitForFunction(({ gain, points }) => {
            const snapshot = window.fixture.agent.getSnapshot();
            if (snapshot.kind !== "ready") return false;
            const fields = snapshot.state.fields;
            return fields.gain.value === gain && JSON.stringify(fields.curve.value.points) === JSON.stringify(points)
                && fields.curve.application?.kind === "sent" && fields.curve.application?.proof === "native-publication-processed";
        }, { gain, points }, { timeout: 5_000 });
        await page.waitForFunction(({ gain, points }) => {
            const shadow = document.querySelector("#mount").firstElementChild?.shadowRoot;
            const gainText = shadow?.querySelector('[data-testid="gain"]')?.textContent;
            const curveText = shadow?.querySelector('[data-testid="curve"]')?.textContent;
            return gainText && curveText && JSON.parse(gainText).value === gain
                && JSON.stringify(JSON.parse(curveText).value) === JSON.stringify({ points })
                && !JSON.parse(gainText).pending && !JSON.parse(curveText).pending;
        }, { gain, points }, { timeout: 5_000 });
        assert.equal(JSON.parse(await page.getByTestId("gain").textContent()).value, gain);
        assert.deepEqual(JSON.parse(await page.getByTestId("curve").textContent()).value, { points });
        const native = await page.evaluate(() => new Promise(resolve => window.fixture.connection.requestFullStoredState(resolve)));
        assert.equal(native.parameters.find(parameter => parameter.name === "gain").value, gain);
        assert.deepEqual(native.values.curve, { points });
        const output = await page.evaluate(() => window.fixture.readOutput());
        const expected = gain * 1.1 + points.reduce((sum, value) => sum + value, 0);
        assert.ok(Math.abs(output.min - expected) < 0.001 && Math.abs(output.max - expected) < 0.001, JSON.stringify({ output, expected }));
        assert.deepEqual(await page.evaluate(() => window.fixture.defects), []);
        assert.deepEqual(errors, []);
    }

    try {
        assert.ok(source, "Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the isolated Cmajor fork");
        const manifestPath = await buildPluginStateFixture(build);
        const runtime = path.dirname(manifestPath);
        const staging = path.resolve(runtime, "../../..");
        const viewSource = path.join(staging, "fx/state_lab/browser-view.tsx");
        await fs.copyFile(path.join(fixture, "view.tsx"), viewSource);
        await bundle({ entryPoints: [viewSource], outfile: path.join(build, "view.js"), bundle: true, format: "esm",
            platform: "browser", jsx: "automatic", target: "es2022", logLevel: "silent" });
        const generated = path.join(build, "generated.js");
        const codegen = spawnSync(path.join(root, "build/browser_plugin_state_generator/cosimo_cmajor_external_codegen"), [
            manifestPath, generated, "PluginStateSystem", "--target", "javascript", "--max-frames-per-block", "128",
        ], { encoding: "utf8", timeout: 60_000 });
        if (codegen.error) throw codegen.error;
        assert.equal(codegen.status, 0, codegen.stderr);
        await fs.appendFile(generated, "\nexport default PluginStateSystem;\n");
        server = createServer(async (request, response) => {
            try {
                const pathname = new URL(request.url, "http://127.0.0.1").pathname;
                assert.ok(!pathname.includes(".."));
                const target = pathname === "/" ? path.join(fixture, "index.html")
                    : pathname === "/manifest.json" ? manifestPath
                    : ["/view.js", "/generated.js"].includes(pathname) ? path.join(build, pathname.slice(1))
                    : pathname.startsWith("/runtime/") ? path.join(runtime, pathname.slice(9))
                    : pathname.startsWith("/cmaj_api/") ? path.join(source, "javascript/cmaj_api", pathname.slice(10)) : undefined;
                assert.ok(target);
                response.writeHead(200, { "content-type": target.endsWith(".html") ? "text/html" : "text/javascript" });
                response.end(await fs.readFile(target));
            } catch { response.writeHead(404).end(); }
        });
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
        page = await browser.newPage();
        page.on("pageerror", error => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.click("#start");
        await page.waitForFunction(() => window.fixture || window.fixtureError, null, { timeout: 10_000 });
        assert.equal(await page.evaluate(() => window.fixtureError), null);
        return { page, expectValues, close };
    } catch (error) {
        try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], "Browser fixture startup and cleanup failed"); }
        throw error;
    }
}
