#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { buildPlugin, effectPlugins, effectPluginTargetNames, repoRoot } from "../fx/build-effect.mjs";

const REVIEW_ORIGIN = "http://plugin-visual-review.local";
const REVIEW_SIZES = Object.freeze([
    { name: "wide", width: 1440, height: 800 },
    { name: "medium", width: 1060, height: 820 },
    { name: "narrow", width: 420, height: 640 },
]);

function supportedTargetNames() {
    return Object.entries(effectPlugins)
        .filter(([, plugin]) => typeof plugin.visualReviewAdapter === "string")
        .map(([pluginName]) => pluginName);
}

function usage() {
    return [
        "Usage: npm run fx:visual-review -- <plugin> [output-directory]",
        `Registered plugins: ${effectPluginTargetNames().join(", ")}`,
        `Supported visual-review targets: ${supportedTargetNames().join(", ")}`,
    ].join("\n");
}

function parseArguments(arguments_) {
    if (arguments_.length < 1 || arguments_.length > 2)
        throw new Error(usage());

    const [pluginName, outputArgument] = arguments_;
    const plugin = effectPlugins[pluginName];
    if (!plugin)
        throw new Error(`Unknown plugin target "${pluginName}".\n${usage()}`);
    if (typeof plugin.visualReviewAdapter !== "string") {
        throw new Error(
            `Plugin target "${pluginName}" has no representative browser-review adapter.\n${usage()}`,
        );
    }

    return {
        outputDirectory: outputArgument
            ? path.resolve(outputArgument)
            : path.join(repoRoot, "build", "plugin_visual_review", pluginName),
        plugin,
        pluginName,
    };
}

function contentType(filePath) {
    switch (path.extname(filePath)) {
        case ".css": return "text/css; charset=utf-8";
        case ".html": return "text/html; charset=utf-8";
        case ".js":
        case ".mjs": return "text/javascript; charset=utf-8";
        case ".json":
        case ".map":
        case ".cmajorpatch": return "application/json; charset=utf-8";
        case ".png": return "image/png";
        case ".svg": return "image/svg+xml";
        default: return "application/octet-stream";
    }
}

function pathWithin(root, candidate) {
    const relativePath = path.relative(root, candidate);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function installRuntimeRoutes(page, runtimeRoot) {
    await page.route(`${REVIEW_ORIGIN}/**`, async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        if (requestPath === "/") {
            await route.fulfill({
                body: [
                    "<!doctype html><html><head><style>",
                    "html,body,main{width:100%;height:100%;margin:0;overflow:hidden}",
                    "</style></head><body><main data-role=\"visual-review-host\"></main></body></html>",
                ].join(""),
                contentType: "text/html; charset=utf-8",
            });
            return;
        }

        const relativePath = decodeURIComponent(requestPath.replace(/^\/runtime\//, ""));
        const filePath = path.resolve(runtimeRoot, relativePath);
        if (!requestPath.startsWith("/runtime/") || !pathWithin(runtimeRoot, filePath)) {
            await route.fulfill({ status: 404, body: "Not found" });
            return;
        }

        try {
            await route.fulfill({ body: await readFile(filePath), contentType: contentType(filePath) });
        } catch {
            await route.fulfill({ status: 404, body: "Not found" });
        }
    });
}

async function loadAdapter(plugin) {
    const adapterPath = path.resolve(repoRoot, plugin.visualReviewAdapter);
    if (!pathWithin(repoRoot, adapterPath))
        throw new Error(`Visual-review adapter escapes the repository: ${plugin.visualReviewAdapter}`);

    const module = await import(pathToFileURL(adapterPath));
    const adapter = module.default;
    for (const method of ["installConnection", "prepare", "prepareViewport", "assertRepresentative"]) {
        if (typeof adapter?.[method] !== "function")
            throw new Error(`${plugin.visualReviewAdapter} must export adapter.${method}().`);
    }
    return adapter;
}

async function mountProductionView(page, manifest, adapter) {
    await adapter.installConnection(page, manifest);
    await page.evaluate(async () => {
        const connection = window.__PLUGIN_VISUAL_REVIEW_CONNECTION__;
        if (!connection)
            throw new Error("Browser-review adapter did not install a patch connection.");

        const module = await import("/runtime/view/index.js");
        const createPatchView = module.default ?? module.createPatchView;
        if (typeof createPatchView !== "function")
            throw new Error("Packaged view/index.js did not export a patch view factory.");

        const view = await createPatchView(connection);
        if (!(view instanceof HTMLElement))
            throw new Error("Packaged patch view factory did not return an HTMLElement.");

        view.style.display = "block";
        view.style.width = "100%";
        view.style.height = "100%";
        document.querySelector('[data-role="visual-review-host"]').appendChild(view);
        window.__PLUGIN_VISUAL_REVIEW_VIEW__ = view;
    });

    await page.waitForFunction(() => {
        const view = window.__PLUGIN_VISUAL_REVIEW_VIEW__;
        const root = view?.shadowRoot ?? view;
        return Boolean(view?.isConnected && root?.childElementCount > 0);
    });
    const loadFailure = await page.evaluate(() => {
        const view = window.__PLUGIN_VISUAL_REVIEW_VIEW__;
        const root = view?.shadowRoot ?? view;
        const error = view?.matches?.('[data-role="effect-load-error"]')
            ? view
            : root?.querySelector?.('[data-role="effect-load-error"]');
        return error?.textContent?.trim() ?? "";
    });
    if (loadFailure)
        throw new Error(loadFailure);

    await adapter.prepare(page);
}

async function capturePluginReview(pluginName, plugin, outputDirectory) {
    const adapter = await loadAdapter(plugin);
    await buildPlugin(pluginName);

    const runtimeRoot = path.join(repoRoot, plugin.runtimeOut);
    const manifest = JSON.parse(await readFile(
        path.join(runtimeRoot, path.basename(plugin.patch)),
        "utf8",
    ));
    const outputPaths = REVIEW_SIZES.map(({ name }) => path.join(outputDirectory, `${name}.png`));
    await mkdir(outputDirectory, { recursive: true });

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const pageErrors = [];
        const requestFailures = [];
        const page = await browser.newPage({
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            viewport: { width: REVIEW_SIZES[0].width, height: REVIEW_SIZES[0].height },
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("response", (response) => {
            if (response.status() >= 400)
                requestFailures.push(`${response.status()} ${response.url()}`);
        });

        await installRuntimeRoutes(page, runtimeRoot);
        await page.goto(REVIEW_ORIGIN, { waitUntil: "load" });
        await mountProductionView(page, manifest, adapter);

        for (const [index, size] of REVIEW_SIZES.entries()) {
            await page.setViewportSize({ width: size.width, height: size.height });
            await adapter.prepareViewport(page, size);
            await page.evaluate(async () => {
                await document.fonts.ready;
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            await adapter.assertRepresentative(page, size);
            await page.screenshot({ animations: "disabled", path: outputPaths[index], type: "png" });
        }

        if (pageErrors.length > 0)
            throw new Error(`Browser view error: ${pageErrors.join("; ")}`);
        if (requestFailures.length > 0)
            throw new Error(`Browser resource failure: ${requestFailures.join("; ")}`);
    } finally {
        await browser?.close();
    }

    return outputPaths;
}

async function main() {
    try {
        const { outputDirectory, plugin, pluginName } = parseArguments(process.argv.slice(2));
        const outputPaths = await capturePluginReview(pluginName, plugin, outputDirectory);
        for (const outputPath of outputPaths)
            console.log(outputPath);
    } catch (error) {
        console.error(`Plugin visual review failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}

await main();
