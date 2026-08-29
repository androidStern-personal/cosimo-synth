import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium, webkit } from "playwright";

import { adaptCosimoAudioWorkletModuleLoading } from "../web/audio-worklet-instrumentation.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserName = process.env.COSIMO_WEB_RENDERER_BROWSER ?? "chromium";

let server;
let browser;
let root;
let baseUrl;

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
    }
}

function contentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
    return "application/octet-stream";
}

before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-renderer-worklet-"));
    const generatedClass = path.join(root, "generated-class.js");
    run("node", [
        path.join(repoRoot, "scripts/generate_cmajor_javascript_with_renderer.mjs"),
        path.join(repoRoot, "tests/native/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"),
        generatedClass,
        "ThreeOscillatorExternalSmoke",
    ]);

    const classSource = await fs.readFile(generatedClass, "utf8");
    await fs.writeFile(path.join(root, "patch.js"), `
import * as helpers from "./cmaj_api/cmaj-audio-worklet-helper.js";
${classSource}
export async function createConnection(audioContext) {
    const connection = new helpers.AudioWorkletPatchConnection({
        CmajorVersion: 1,
        ID: "dev.cosimo.renderer-worklet-test",
        name: "Renderer Worklet Test",
    });
    await connection.initialise({
        CmajorClass: ThreeOscillatorExternalSmoke,
        audioContext,
        workletName: "cosimo-renderer-worklet-test",
        hostDescription: "Cosimo renderer test",
    });
    return connection;
}
`);
    stageCmajorWebRuntime(repoRoot, {
        buildDirectory: path.join(root, "cmajor-runtime-build"),
        outputDirectory: path.join(root, "cmaj_api"),
    });
    const helperPath = path.join(root, "cmaj_api/cmaj-audio-worklet-helper.js");
    await fs.writeFile(
        helperPath,
        adaptCosimoAudioWorkletModuleLoading(await fs.readFile(helperPath, "utf8")),
    );
    await fs.writeFile(path.join(root, "index.html"), `<!doctype html>
<button id="start">Start</button>
<script type="module">
import { createConnection } from "./patch.js";
window.cosimoRendererResult = null;
document.querySelector("#start").addEventListener("click", async () => {
  try {
    const context = new AudioContext({ sampleRate: 48000 });
    const connection = await createConnection(context);
    const capture = context.createScriptProcessor(256, 2, 2);
    let sumSquares = 0;
    let sampleCount = 0;
    capture.onaudioprocess = (event) => {
      for (let channel = 0; channel < 2; channel += 1) {
        const samples = event.inputBuffer.getChannelData(channel);
        for (const sample of samples) {
          sumSquares += sample * sample;
          sampleCount += 1;
        }
      }
      if (sampleCount >= 4096) {
        window.cosimoRendererResult = { rms: Math.sqrt(sumSquares / sampleCount) };
        capture.disconnect();
        connection.audioNode.disconnect();
      }
    };
    connection.audioNode.connect(capture);
    capture.connect(context.destination);
    await context.resume();
  } catch (error) {
    window.cosimoRendererResult = {
      error: String(error),
      errorName: String(error?.name ?? ""),
      errorMessage: String(error?.message ?? ""),
      errorStack: String(error?.stack ?? ""),
    };
  }
});
</script>`);

    server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
            const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
            const filePath = path.resolve(root, relative);
            if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("invalid path");
            response.writeHead(200, { "content-type": contentType(filePath) });
            response.end(await fs.readFile(filePath));
        } catch {
            response.writeHead(404).end();
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    browser = browserName === "webkit"
        ? await webkit.launch({ headless: true })
        : await chromium.launch({
            headless: true,
            args: ["--autoplay-policy=no-user-gesture-required"],
        });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
});

test("canonical renderer produces B-only audio in the real AudioWorklet", { timeout: 120_000 }, async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl);
    await page.click("#start");
    await page.waitForFunction(() => window.cosimoRendererResult !== null, null, { timeout: 90_000 });
    const result = await page.evaluate(() => window.cosimoRendererResult);
    assert.ok(!result.error, JSON.stringify(result));
    assert.ok(result.rms > 1e-4, `B-only AudioWorklet output was silent: ${result.rms}`);
    await page.close();
});
