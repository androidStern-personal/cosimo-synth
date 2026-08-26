import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prototypeRoot = path.join(repoRoot, "ui/desktop/fx-graph-mobile-prototype");
const uiAssetsRoot = path.join(repoRoot, "ui/assets");
const remotePrototypeUrl = process.env.COSIMO_FX_GRAPH_PROTOTYPE_URL;
const screenshotDir = process.env.COSIMO_FX_GRAPH_SCREENSHOT_DIR;
const viewportCases = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
];

let browser;
let server;
let origin;

function contentType(filePath) {
    if (filePath.endsWith(".html")) { return "text/html; charset=utf-8"; }
    if (filePath.endsWith(".js")) { return "text/javascript; charset=utf-8"; }
    if (filePath.endsWith(".css")) { return "text/css; charset=utf-8"; }
    if (filePath.endsWith(".png")) { return "image/png"; }
    if (filePath.endsWith(".woff2")) { return "font/woff2"; }
    return "application/octet-stream";
}

async function startPrototypeServer() {
    const localServer = createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");
            const prefix = "/fx-graph-prototype";
            if (url.pathname.startsWith("/assets/")) {
                const relativeAssetPath = url.pathname.slice("/assets/".length);
                const absoluteAssetPath = path.resolve(uiAssetsRoot, relativeAssetPath);
                if (absoluteAssetPath !== uiAssetsRoot && !absoluteAssetPath.startsWith(`${uiAssetsRoot}${path.sep}`)) {
                    response.writeHead(403).end("Forbidden");
                    return;
                }
                const assetStat = await stat(absoluteAssetPath);
                if (!assetStat.isFile()) {
                    response.writeHead(404).end("Not found");
                    return;
                }
                response.writeHead(200, { "Content-Type": contentType(absoluteAssetPath) });
                response.end(await readFile(absoluteAssetPath));
                return;
            }
            if (!url.pathname.startsWith(prefix)) {
                response.writeHead(404).end("Not found");
                return;
            }

            const relativePath = url.pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
            const absolutePath = path.resolve(prototypeRoot, relativePath);
            if (absolutePath !== prototypeRoot && !absolutePath.startsWith(`${prototypeRoot}${path.sep}`)) {
                response.writeHead(403).end("Forbidden");
                return;
            }

            const fileStat = await stat(absolutePath);
            if (!fileStat.isFile()) {
                response.writeHead(404).end("Not found");
                return;
            }

            response.writeHead(200, { "Content-Type": contentType(absolutePath) });
            response.end(await readFile(absolutePath));
        } catch {
            response.writeHead(404).end("Not found");
        }
    });

    await new Promise((resolve) => localServer.listen(0, "127.0.0.1", resolve));
    const address = localServer.address();
    assert.ok(address && typeof address === "object");
    return { server: localServer, origin: `http://127.0.0.1:${address.port}` };
}

function targetUrl(variant = "A") {
    const url = new URL(remotePrototypeUrl ? origin : `${origin}/fx-graph-prototype/`);
    url.searchParams.set("variant", variant);
    return url.href;
}

async function selectEffect(page, label) {
    const target = page.locator(`[data-effect="${label}"]`);
    if (await target.count() === 0) {
        const summary = page.locator(`[data-summary-effect="${label}"]`);
        assert.equal(await summary.count(), 1, `${label} is neither interactive nor summarized`);
        const focusPath = await summary.getAttribute("data-summary-focus-path");
        assert.ok(focusPath, `${label} summary has no parent focus path`);
        await page.locator(`.branch-label[data-focus-path="${focusPath}"]`).click();
    }
    await page.locator(`[data-effect="${label}"]`).click();
    await page.locator(`[data-effect="${label}"].is-selected`).waitFor();
}

async function graphState(page) {
    return page.locator(".graph-svg").evaluate((svg) => ({
        selected: svg.querySelector(".effect-node.is-selected")?.dataset.effect,
        outer: svg.dataset.expandedOuter,
        nested: svg.dataset.expandedNested,
        height: Number(svg.dataset.graphHeight),
        routeIds: [...svg.querySelectorAll("[data-route-id]")].map((route) => route.dataset.routeId),
        visibleRoutes: [...svg.querySelectorAll("[data-route-id]")].filter((route) => {
            const style = getComputedStyle(route);
            return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
        }).map((route) => route.dataset.routeId),
        detail: [...svg.querySelectorAll('[data-representation="detail"]')].map((node) => node.dataset.effect),
        icons: [...svg.querySelectorAll('[data-representation="icon"]')].map((node) => node.dataset.effect),
        yPositions: Object.fromEntries([...svg.querySelectorAll("[data-effect], [data-summary-effect]")].map((node) => {
            const match = node.getAttribute("transform")?.match(/translate\([^ ]+ ([^)]+)\)/);
            return [node.dataset.effect ?? node.dataset.summaryEffect, match ? Number(match[1]) : null];
        })),
    }));
}

async function geometry(page) {
    return page.locator(".map-stage").evaluate((stage) => {
        const stageRect = stage.getBoundingClientRect();
        const rectangles = (selector) => [...stage.querySelectorAll(selector)].map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                effect: node.closest("[data-effect]")?.dataset.effect,
                owner: node.closest("[data-owner-path]")?.dataset.ownerPath,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        });
        const overlaps = (nodes) => {
            const result = [];
            for (let first = 0; first < nodes.length; first += 1) {
                for (let second = first + 1; second < nodes.length; second += 1) {
                    const a = nodes[first];
                    const b = nodes[second];
                    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                    if (width > 0.25 && height > 0.25) {
                        result.push([a.effect, b.effect, width, height]);
                    }
                }
            }
            return result;
        };

        const hits = rectangles(".effect-hit");
        const insertionHits = rectangles(".insertion-hit");
        const branchTargets = rectangles(".branch-lane .branch-lane-hit");
        const compactIcons = rectangles(".effect-icon-compact");
        const detailLabels = rectangles(".effect-node-detail text");
        const visuals = rectangles(".effect-chip, .effect-icon-compact, .effect-icon-summary");
        const routeEndpoints = [...stage.querySelectorAll("[data-route-id]")].map((route) => {
            const start = route.getPointAtLength(0);
            const end = route.getPointAtLength(route.getTotalLength());
            return {
                id: route.dataset.routeId,
                owner: route.dataset.ownerPath,
                declaredStart: [Number(route.dataset.startX), Number(route.dataset.startY)],
                declaredEnd: [Number(route.dataset.endX), Number(route.dataset.endY)],
                start: [start.x, start.y],
                end: [end.x, end.y],
            };
        });
        const junctions = [...stage.querySelectorAll("[data-junction-id]")].map((node) => ({
            id: node.dataset.junctionId,
            point: [Number(node.dataset.junctionX), Number(node.dataset.junctionY)],
        }));
        const scroller = stage.querySelector("[data-root-graph-scroll]");

        return {
            stage: { left: stageRect.left, right: stageRect.right, width: stageRect.width },
            hits,
            insertionHits,
            branchTargets,
            compactIcons,
            detailLabels,
            visuals,
            hitOverlaps: overlaps(hits),
            visualOverlaps: overlaps(visuals),
            routeEndpoints,
            junctions,
            rootScrollerCount: stage.querySelectorAll('[data-scroll-owner="root"]').length,
            branchScrollerCount: stage.querySelectorAll('[data-scroll-owner="branch"]').length,
            horizontalOverflow: scroller.scrollWidth - scroller.clientWidth,
            verticalOverflow: scroller.scrollHeight - scroller.clientHeight,
            documentOverflowX: document.documentElement.scrollWidth - window.innerWidth,
            documentOverflowY: document.documentElement.scrollHeight - window.innerHeight,
            focusZoneCount: stage.querySelectorAll(".branch-zone,.nested-zone").length,
        };
    });
}

function pointKey(point) {
    return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function assertConnectedTopology(result) {
    const points = [];
    for (const route of result.routeEndpoints) {
        assert.ok(Math.abs(route.start[0] - route.declaredStart[0]) < 0.01, `${route.id} start x`);
        assert.ok(Math.abs(route.start[1] - route.declaredStart[1]) < 0.01, `${route.id} start y`);
        assert.ok(Math.abs(route.end[0] - route.declaredEnd[0]) < 0.01, `${route.id} end x`);
        assert.ok(Math.abs(route.end[1] - route.declaredEnd[1]) < 0.01, `${route.id} end y`);
        points.push({ kind: "route", id: route.id, point: route.declaredStart });
        points.push({ kind: "route", id: route.id, point: route.declaredEnd });
    }
    for (const junction of result.junctions) {
        points.push({ kind: "junction", id: junction.id, point: junction.point });
    }

    const groups = new Map();
    for (const point of points) {
        const key = pointKey(point.point);
        groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    const routeYs = result.routeEndpoints.flatMap((route) => [route.declaredStart[1], route.declaredEnd[1]]);
    const minimumY = Math.min(...routeYs);
    const maximumY = Math.max(...routeYs);
    const disconnected = [...groups.entries()].filter(([key, items]) => {
        const y = Number(key.split(",")[1]);
        return items.length < 2 && y !== minimumY && y !== maximumY;
    });
    assert.deepEqual(disconnected, [], JSON.stringify(disconnected));

    const expectedConnections = {
        "frequency-split": 4,
        "nested-split": 3,
        "nested-merge": 3,
        "frequency-merge": 4,
        "later-split": 3,
        "later-merge": 3,
    };
    for (const junction of result.junctions) {
        const connectionCount = groups.get(pointKey(junction.point)).filter((point) => point.kind === "route").length;
        assert.equal(connectionCount, expectedConnections[junction.id], junction.id);
    }
}

before(async () => {
    if (remotePrototypeUrl) {
        origin = remotePrototypeUrl;
    } else {
        ({ server, origin } = await startPrototypeServer());
    }
    if (screenshotDir) { await mkdir(screenshotDir, { recursive: true }); }
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    if (server) {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});

test("readable mobile FX graph keeps topology, ownership, and phone-sized targets stable", async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const browserErrors = [];
    page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
            browserErrors.push(`${message.type()}: ${message.text()}`);
        }
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    await page.goto(targetUrl(), { waitUntil: "networkidle" });

    await t.test("ImageGen v2 icons are colorful, transparent, and readable when collapsed", async () => {
        const iconResults = await page.evaluate(async () => {
            const effectIconNames = [
                "chorus", "cmp", "crusher", "delay", "drive", "eq", "filter",
                "flanger", "limiter", "ott", "pan", "phaser", "reverb", "saturator",
            ];
            const hrefs = effectIconNames.map((name) => new URL(`./assets/effect-icons/${name}-v2.png`, location.href).href);
            return Promise.all(hrefs.map(async (href) => {
                const bitmap = await createImageBitmap(await (await fetch(href)).blob());
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                context.drawImage(bitmap, 0, 0);
                const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
                let opaquePixels = 0;
                let colorfulPixels = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                    const alpha = pixels[index + 3];
                    if (alpha < 32) { continue; }
                    opaquePixels += 1;
                    const spread = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
                    if (spread > 24) { colorfulPixels += 1; }
                }
                return { href, cornerAlpha: pixels[3], opaquePixels, colorfulPixels };
            }));
        });
        assert.equal(iconResults.length, 14);
        assert.ok(iconResults.every((result) => result.href.endsWith("-v2.png")), JSON.stringify(iconResults));
        assert.ok(iconResults.every((result) => result.cornerAlpha === 0), JSON.stringify(iconResults));
        assert.ok(iconResults.every((result) => result.opaquePixels > 0 && result.colorfulPixels > 0), JSON.stringify(iconResults));
        const compactSizes = await page.locator('[data-representation="icon"]').evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.visualSize)));
        assert.ok(compactSizes.length > 0);
        assert.ok(compactSizes.every((size) => size >= 28), compactSizes.join(","));
    });

    await t.test("tap selection expands the exact owning branch and EQ preserves its child focus", async () => {
        const initial = await graphState(page);
        assert.equal(initial.height, 936);
        assert.equal(initial.routeIds.length, 25);

        await selectEffect(page, "DLY 1");
        const delay = await graphState(page);
        assert.deepEqual({ selected: delay.selected, outer: delay.outer, nested: delay.nested }, { selected: "DLY 1", outer: "mid", nested: "b" });
        assert.ok(delay.detail.includes("DLY 1"));
        assert.ok(delay.icons.includes("OTT 1"));
        assert.deepEqual(delay.routeIds, initial.routeIds);
        assert.deepEqual(delay.visibleRoutes, delay.routeIds);

        await selectEffect(page, "EQ 1");
        const eq = await graphState(page);
        assert.deepEqual({ selected: eq.selected, outer: eq.outer, nested: eq.nested }, { selected: "EQ 1", outer: "mid", nested: "b" });
        assert.ok(eq.detail.includes("DLY 1"), "EQ must preserve the last detailed child branch");
        assert.deepEqual(eq.routeIds, initial.routeIds);
        assert.deepEqual(eq.visibleRoutes, eq.routeIds);

        const cases = [
            { label: "OTT 1", outer: "mid", nested: "a", detailed: ["EQ 1", "OTT 1", "CHO 1"] },
            { label: "DRV 1", outer: "lo", nested: "a", detailed: ["DRV 1", "SAT 1"] },
            { label: "CRS 1", outer: "hi", nested: "a", detailed: ["CRS 1", "FLT 1"] },
            { label: "PHS 1", outer: "mid", nested: "b", detailed: ["EQ 1", "PHS 1", "DLY 1", "DLY 2"] },
        ];
        for (const expected of cases) {
            await selectEffect(page, expected.label);
            const actual = await graphState(page);
            assert.equal(actual.outer, expected.outer, expected.label);
            assert.equal(actual.nested, expected.nested, expected.label);
            for (const label of expected.detailed) {
                assert.ok(actual.detail.includes(label), `${label} after ${expected.label}`);
            }
            assert.deepEqual(actual.yPositions, initial.yPositions, `${expected.label} changed vertical pitch`);
            assert.deepEqual(actual.routeIds, initial.routeIds, `${expected.label} changed topology`);
            assert.deepEqual(actual.visibleRoutes, actual.routeIds, `${expected.label} hid a route`);
        }
    });

    await t.test("every point in every effect hit region belongs to that exact effect", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await selectEffect(page, "EQ 1");
        const labels = await page.locator("[data-effect]").evaluateAll((nodes) => nodes.map((node) => node.dataset.effect));
        const hitAudit = [];
        for (const label of labels) {
            const effectNode = page.locator(`[data-effect="${label}"]`);
            await effectNode.scrollIntoViewIfNeeded();
            hitAudit.push(...await effectNode.evaluate((node) => {
                const failures = [];
                const rect = node.querySelector(".effect-hit").getBoundingClientRect();
                for (const fraction of [0.08, 0.5, 0.92]) {
                    const x = rect.left + rect.width * fraction;
                    const y = rect.top + rect.height / 2;
                    const target = document.elementFromPoint(x, y)?.closest("[data-effect]");
                    if (target?.dataset.effect !== node.dataset.effect || target?.dataset.ownerPath !== node.dataset.ownerPath) {
                        failures.push({ expected: node.dataset.effect, actual: target?.dataset.effect ?? null, fraction });
                    }
                }
                return failures;
            }));
        }
        assert.deepEqual(hitAudit, []);
        const result = await geometry(page);
        assert.deepEqual(result.hitOverlaps, []);
    });

    await t.test("representative phone widths preserve readable labels and 44px direct-manipulation targets", async () => {
        for (const viewport of viewportCases) {
            await page.setViewportSize(viewport);
            for (const effect of ["DRV 1", "OTT 1", "DLY 1", "CRS 1"]) {
                await selectEffect(page, effect);
                const result = await geometry(page);
                assert.equal(result.rootScrollerCount, 1, `${viewport.width}px ${effect}`);
                assert.equal(result.branchScrollerCount, 0, `${viewport.width}px ${effect}`);
                assert.equal(result.focusZoneCount, 0, `${viewport.width}px ${effect}`);
                assert.ok(result.stage.width <= 184.5, `${viewport.width}px graph stopped being a narrow side panel`);
                assert.ok(result.horizontalOverflow <= 1, `${viewport.width}px graph overflow ${result.horizontalOverflow}`);
                assert.ok(result.documentOverflowX <= 1, `${viewport.width}px document x overflow`);
                assert.ok(result.documentOverflowY <= 1, `${viewport.width}px second vertical scroller`);
                assert.deepEqual(result.hitOverlaps, [], `${viewport.width}px ${effect} hit overlap`);
                assert.deepEqual(result.visualOverlaps, [], `${viewport.width}px ${effect} visual overlap`);
                for (const node of [...result.hits, ...result.visuals]) {
                    assert.ok(node.left >= result.stage.left - 1, `${viewport.width}px ${node.effect} escaped left`);
                    assert.ok(node.right <= result.stage.right + 1, `${viewport.width}px ${node.effect} escaped right`);
                }
                for (const hit of [...result.hits, ...result.insertionHits]) {
                    assert.ok(hit.width >= 43.5, `${viewport.width}px ${hit.owner} target is too narrow at ${hit.width}`);
                    assert.ok(hit.height >= 43.5, `${viewport.width}px ${hit.owner} target is too short at ${hit.height}`);
                }
                for (const target of result.branchTargets) {
                    assert.ok(target.width >= 43.5, `${viewport.width}px ${target.owner} branch lane is too narrow at ${target.width}`);
                }
                for (const icon of result.compactIcons) {
                    assert.ok(icon.width >= 27.5, `${viewport.width}px ${icon.effect} icon is too small at ${icon.width}`);
                }
                for (const label of result.detailLabels) {
                    assert.ok(label.height >= 12.5, `${viewport.width}px ${label.effect} label is too small at ${label.height}`);
                }
                assertConnectedTopology(result);
            }
            if (screenshotDir) {
                await selectEffect(page, "OTT 1");
                await page.screenshot({ path: path.join(screenshotDir, `fx-graph-A-${viewport.width}x${viewport.height}.png`) });
            }
        }
    });

    await t.test("each branch owns a tail insertion and the picker inserts into that exact sequence", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload({ waitUntil: "networkidle" });
        // MID is focused, so its nested split is open and LO/HI are folded to
        // overview rails. A folded rail is context: it hands its taps, including
        // its tail insertion, to its badge. Focusing the rail brings both back.
        const expectedPaths = [
            "freq/mid/nested/a",
            "freq/mid/nested/b",
            "freq/mid",
            "parallel/a",
            "parallel/b",
            "root",
        ];
        const paths = await page.locator("[data-insertion-path]").evaluateAll((nodes) => nodes.map((node) => node.dataset.insertionPath));
        assert.deepEqual(paths, expectedPaths);
        assert.deepEqual(
            await page.locator("[data-summary-insertion-path]").evaluateAll((nodes) => nodes.map((node) => node.dataset.summaryInsertionPath)),
            ["freq/lo", "freq/hi"],
        );
        assert.deepEqual(
            await page.locator("[data-summary-insertion-path]").evaluateAll((nodes) => nodes.map((node) => node.dataset.summaryFocusPath)),
            ["freq/lo", "freq/hi"],
        );

        await page.locator('.branch-label[data-focus-path="freq/lo"]').click();
        await page.locator('[data-insertion-path="freq/lo"]').waitFor();
        assert.equal(await page.locator('[data-summary-insertion-path="freq/lo"]').count(), 0);
        await page.locator('.branch-label[data-focus-path="freq/mid"]').click();
        await page.locator('[data-summary-insertion-path="freq/lo"]').waitFor();

        const before = await graphState(page);
        const aCountBefore = await page.locator('[data-owner-path="freq/mid/nested/a"][data-effect]').count();
        await page.locator('[data-insertion-path="freq/mid/nested/b"]').click();
        await page.getByRole("dialog", { name: "Add effect to MID / B" }).waitFor();
        await page.locator('[data-picker-effect="delay"]').click();
        await page.locator('[data-effect="DLY 4"][data-owner-path="freq/mid/nested/b"]').waitFor();
        const after = await graphState(page);
        assert.equal(after.selected, "DLY 4");
        assert.equal(after.outer, "mid");
        assert.equal(after.nested, "b");
        assert.equal(after.height, before.height + 48);
        assert.equal(await page.locator('[data-owner-path="freq/mid/nested/a"][data-effect]').count(), aCountBefore);
        assert.equal(await page.locator('[data-owner-path="freq/mid/nested/b"][data-effect]').count(), 4);
        assert.deepEqual(after.routeIds, before.routeIds);

        await page.locator('[data-insertion-path="root"]').click();
        await page.getByRole("dialog", { name: "Add effect to TRUNK" }).waitFor();
        await page.locator('[data-picker-effect="filter"]').click();
        await page.locator('[data-effect="FLT 2"][data-owner-path="root"]').waitFor();
        const rootAfter = await graphState(page);
        assert.equal(rootAfter.height, after.height + 48);
        assert.equal(rootAfter.selected, "FLT 2");
    });

    await t.test("overflow belongs only to the root graph and scroll position survives branch focus", async () => {
        await page.setViewportSize({ width: 320, height: 568 });
        const scroller = page.locator("[data-root-graph-scroll]");
        const overflow = await scroller.evaluate((node) => node.scrollHeight - node.clientHeight);
        assert.ok(overflow > 0, `expected root overflow after stress insertion, got ${overflow}`);
        await scroller.evaluate((node) => {
            node.scrollTop = Math.min(40, node.scrollHeight - node.clientHeight);
            node.dispatchEvent(new Event("scroll"));
        });
        const before = await scroller.evaluate((node) => node.scrollTop);
        await page.locator('[data-effect="DLY 1"]').evaluate((node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        await page.locator('[data-effect="DLY 1"].is-selected').waitFor();
        const after = await scroller.evaluate((node) => node.scrollTop);
        assert.ok(Math.abs(after - before) <= 1, `scroll moved from ${before} to ${after}`);
        const result = await geometry(page);
        assert.equal(result.rootScrollerCount, 1);
        assert.equal(result.branchScrollerCount, 0);
    });

    assert.deepEqual(browserErrors, []);
    await page.close();
});

// Chip anatomy measured relative to the chip box, so it is invariant to where
// in the column the chip sits. The rejected repair passed a "has an icon" check
// while quietly shrinking the 24px well to 20px, the 20px icon to 16px, and the
// label spacing to zero. Every one of those numbers is pinned here.
async function chipAnatomy(page, label) {
    return page.locator(`[data-effect="${label}"]`).evaluate((node) => {
        const round = (value) => Math.round(value * 100) / 100;
        const chip = node.querySelector(".effect-chip").getBoundingClientRect();
        const icon = node.querySelector(".effect-icon-detail")?.getBoundingClientRect();
        const well = node.querySelector(".effect-icon-well-detail")?.getBoundingClientRect();
        const text = node.querySelector("text");
        const labelBox = text?.getBoundingClientRect();
        return {
            layout: node.dataset.labelLayout,
            text: text?.textContent,
            chipWidth: round(chip.width),
            chipHeight: round(chip.height),
            iconWidth: round(icon?.width ?? 0),
            iconHeight: round(icon?.height ?? 0),
            wellWidth: round(well?.width ?? 0),
            wellHeight: round(well?.height ?? 0),
            wellInset: round((well?.left ?? 0) - chip.left),
            iconInset: round((icon?.left ?? 0) - chip.left),
            labelInset: round((labelBox?.left ?? 0) - chip.left),
            fontSize: text ? Number.parseFloat(getComputedStyle(text).fontSize) : 0,
            iconInsideChip: Boolean(icon && icon.left >= chip.left - 0.01 && icon.right <= chip.right + 0.01),
            wellInsideChip: Boolean(well && well.left >= chip.left - 0.01 && well.right <= chip.right + 0.01),
            labelInsideChip: Boolean(labelBox && labelBox.left >= chip.left - 0.01 && labelBox.right <= chip.right + 0.01),
        };
    });
}

test("variant C gives every selected nested child the complete standard chip", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(targetUrl("C"), { waitUntil: "networkidle" });

    // The trunk chip is the accepted C reference anatomy. Nothing nested may
    // deviate from it by so much as a pixel.
    await selectEffect(page, "CMP 1");
    const reference = await chipAnatomy(page, "CMP 1");
    assert.equal(reference.layout, "icon-and-text");
    assert.equal(reference.chipWidth, 76);
    assert.equal(reference.chipHeight, 32);
    assert.equal(reference.wellWidth, 24);
    assert.equal(reference.wellHeight, 26);
    assert.equal(reference.iconWidth, 20);
    assert.equal(reference.iconHeight, 20);
    assert.equal(reference.wellInset, 3);
    assert.equal(reference.iconInset, 6);
    assert.equal(reference.fontSize, 13);

    const nestedCases = [
        { focus: "OTT 1", owner: "freq/mid/nested/a", chips: ["OTT 1", "CHO 1"] },
        { focus: "DLY 1", owner: "freq/mid/nested/b", chips: ["PHS 1", "DLY 1", "DLY 2"] },
    ];
    for (const nested of nestedCases) {
        await selectEffect(page, nested.focus);

        const detailed = await page.locator(`[data-owner-path="${nested.owner}"][data-representation="detail"]`)
            .evaluateAll((nodes) => nodes.map((node) => node.dataset.effect));
        assert.deepEqual(detailed, nested.chips, `${nested.owner} did not detail its whole sequence`);

        for (const label of nested.chips) {
            const chip = await chipAnatomy(page, label);
            assert.deepEqual(chip, { ...reference, text: label }, `${label} chip drifted from the trunk chip`);
            assert.equal(chip.iconInsideChip, true, `${label} icon escaped its chip`);
            assert.equal(chip.wellInsideChip, true, `${label} well escaped its chip`);
            assert.equal(chip.labelInsideChip, true, `${label} label escaped its chip`);
        }
    }

    await page.close();
});

test("variant C folds the outer siblings so four logical lanes still fit 176px", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(targetUrl("C"), { waitUntil: "networkidle" });

    for (const focus of ["OTT 1", "DLY 1", "EQ 1"]) {
        await selectEffect(page, focus);
        const folded = await page.locator(".graph-svg").evaluate((svg) => svg.dataset.foldedLanes);
        assert.equal(folded, "freq/lo freq/hi", `${focus} did not fold the outer siblings`);

        // A folded rail is context only: no effect of it claims a tap, and no
        // lane rect of it claims one either.
        const railClaims = await page.locator('[data-owner-path="freq/lo"], [data-owner-path="freq/hi"]')
            .evaluateAll((nodes) => nodes
                .filter((node) => node.matches("[data-effect], [data-insertion-path], .branch-lane"))
                .map((node) => node.dataset.effect ?? node.dataset.insertionPath ?? node.dataset.branchLane));
        assert.deepEqual(railClaims, [], `${focus} left a sub-44px target on a folded rail`);

        // Their badges keep a full handle instead, and it actually refocuses.
        const handles = await page.locator(".branch-label[data-focus-path] .branch-label-hit").evaluateAll((nodes) => nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                path: node.closest("[data-focus-path]").dataset.focusPath,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        }));
        for (const handle of handles) {
            assert.ok(handle.width >= 43.5, `${focus} ${handle.path} handle is ${handle.width}px wide`);
            assert.ok(handle.height >= 43.5, `${focus} ${handle.path} handle is ${handle.height}px tall`);
        }
        for (let first = 0; first < handles.length; first += 1) {
            for (let second = first + 1; second < handles.length; second += 1) {
                const a = handles[first];
                const b = handles[second];
                const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                assert.ok(overlapX <= 0.25 || overlapY <= 0.25, `${focus} handles ${a.path} and ${b.path} overlap`);
            }
        }
    }

    for (const path of ["freq/lo", "freq/hi"]) {
        await page.locator(`.branch-label[data-focus-path="${path}"]`).click();
        await page.locator(`[data-branch-lane="${path}"]`).waitFor();
        assert.equal(await page.locator(".graph-svg").evaluate((svg) => svg.dataset.foldedLanes), "");
        assert.equal(await page.locator(".graph-svg").evaluate((svg) => svg.dataset.expandedOuter), path.endsWith("lo") ? "lo" : "hi");
    }

    await page.close();
});

test("variant C keeps ownership, routing, and height stable across every focus state", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(targetUrl("C"), { waitUntil: "networkidle" });
    const baseline = await graphState(page);

    for (const viewport of viewportCases) {
        await page.setViewportSize(viewport);
        for (const focus of ["EQ 1", "OTT 1", "DLY 1", "DRV 1", "CRS 1"]) {
            await selectEffect(page, focus);
            const where = `${viewport.width}px ${focus}`;

            const state = await graphState(page);
            assert.equal(state.height, baseline.height, `${where} moved the graph height`);
            assert.deepEqual(state.yPositions, baseline.yPositions, `${where} moved the vertical pitch`);
            assert.deepEqual(state.routeIds, baseline.routeIds, `${where} changed the routing topology`);
            assert.deepEqual(state.visibleRoutes, state.routeIds, `${where} hid a route`);

            const result = await geometry(page);
            assertConnectedTopology(result);
            assert.deepEqual(result.hitOverlaps, [], `${where} hit overlap`);
            assert.deepEqual(result.visualOverlaps, [], `${where} visual overlap`);
            assert.ok(result.horizontalOverflow <= 1, `${where} horizontal overflow ${result.horizontalOverflow}`);
            assert.ok(result.documentOverflowX <= 1, `${where} document overflow`);
            assert.ok(result.stage.width <= 184.5, `${where} graph stopped being a narrow side panel`);
            for (const node of [...result.hits, ...result.visuals]) {
                assert.ok(node.left >= result.stage.left - 1, `${where} ${node.effect} escaped left`);
                assert.ok(node.right <= result.stage.right + 1, `${where} ${node.effect} escaped right`);
            }
            for (const hit of [...result.hits, ...result.insertionHits]) {
                assert.ok(hit.width >= 43.5, `${where} ${hit.owner} target is ${hit.width}px wide`);
                assert.ok(hit.height >= 43.5, `${where} ${hit.owner} target is ${hit.height}px tall`);
            }
            for (const target of result.branchTargets) {
                assert.ok(target.width >= 43.5, `${where} ${target.owner} lane is ${target.width}px wide`);
            }

            // Exact ownership: every sampled point of every on-screen hit
            // resolves to the effect that drew it, in the branch that owns it.
            // Rows scrolled out of the viewport are unprobeable, so the focused
            // effect is scrolled in first and the probed set is asserted to
            // cover the whole four-lane region.
            await page.locator(`[data-effect="${focus}"]`).scrollIntoViewIfNeeded();
            const ownership = await page.locator(".map-stage").evaluate((stage) => {
                const stageRect = stage.getBoundingClientRect();
                const failures = [];
                const probed = [];
                for (const node of stage.querySelectorAll("[data-effect]")) {
                    const rect = node.querySelector(".effect-hit").getBoundingClientRect();
                    if (rect.top < stageRect.top || rect.bottom > stageRect.bottom) { continue; }
                    probed.push(node.dataset.effect);
                    for (const fraction of [0.02, 0.25, 0.5, 0.75, 0.98]) {
                        // Clamp a hair inside the column. The last pixel of the
                        // grid column hit-tests as the adjacent effect panel,
                        // which is a shell boundary artifact, not graph ownership.
                        const x = Math.min(Math.max(rect.left + rect.width * fraction, stageRect.left + 1.5), stageRect.right - 1.5);
                        const point = document.elementFromPoint(x, rect.top + rect.height / 2);
                        const owner = point?.closest("[data-effect]");
                        if (owner?.dataset.effect !== node.dataset.effect || owner?.dataset.ownerPath !== node.dataset.ownerPath) {
                            failures.push({ expected: node.dataset.effect, actual: owner?.dataset.effect ?? null, fraction });
                        }
                    }
                }
                return { failures, probed };
            });
            assert.deepEqual(ownership.failures, [], `${where} wrong-neighbour taps`);
            assert.ok(ownership.probed.includes(focus), `${where} never probed the focused effect`);
        }
    }

    await page.close();
});

test("all three visual systems preserve the accepted mobile graph contract", async () => {
    const expectedRouteStyles = {
        A: { lineCap: "butt", lineJoin: "round" },
        B: { lineCap: "butt", lineJoin: "miter" },
        C: { lineCap: "butt", lineJoin: "round" },
    };

    for (const variant of Object.keys(expectedRouteStyles)) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.goto(targetUrl(variant), { waitUntil: "networkidle" });

        for (const viewport of viewportCases) {
            await page.setViewportSize(viewport);
            const result = await geometry(page);
            const visual = await page.locator(".graph-svg").evaluate((svg) => {
                const isVisible = (node) => {
                    const style = getComputedStyle(node);
                    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
                };
                const routeStyle = getComputedStyle(svg.querySelector(".route"));
                const switcherRects = [...document.querySelectorAll("[data-variant-link]")].map((node) => {
                    const rect = node.getBoundingClientRect();
                    return { width: rect.width, height: rect.height };
                });
                const wells = [...svg.querySelectorAll(".effect-icon-well")];
                return {
                    activeVariant: document.documentElement.dataset.fxGraphVariant,
                    switcherRects,
                    junctionSymbolsVisible: [...svg.querySelectorAll(".junction-symbol")].filter(isVisible).length,
                    circleCount: svg.querySelectorAll("circle").length,
                    effectIconCount: svg.querySelectorAll(".effect-icon").length,
                    iconWellCount: wells.length,
                    transparentWellCount: wells.filter((well) => {
                        const style = getComputedStyle(well);
                        return style.fill === "none" || style.fill === "rgba(0, 0, 0, 0)" || style.fill === "transparent";
                    }).length,
                    routeStyle: {
                        lineCap: routeStyle.strokeLinecap,
                        lineJoin: routeStyle.strokeLinejoin,
                    },
                    minimumLabelFontSize: Math.min(...[...svg.querySelectorAll(".effect-node-detail text")].map((node) => Number.parseFloat(getComputedStyle(node).fontSize))),
                };
            });

            assert.equal(visual.activeVariant, variant, `${variant} at ${viewport.width}px`);
            assert.equal(visual.switcherRects.length, 3, variant);
            assert.ok(visual.switcherRects.every((rect) => rect.width >= 43.5 && rect.height >= 43.5), `${variant} variant controls`);
            assert.equal(visual.junctionSymbolsVisible, 0, `${variant} decorative junction marks`);
            assert.equal(visual.circleCount, 0, `${variant} graph circles`);
            assert.equal(visual.iconWellCount, visual.effectIconCount, `${variant} icon without a well`);
            assert.equal(visual.transparentWellCount, 0, `${variant} transparent icon well`);
            assert.deepEqual(visual.routeStyle, expectedRouteStyles[variant], `${variant} routing treatment`);
            assert.ok(visual.minimumLabelFontSize >= 13, `${variant} label font ${visual.minimumLabelFontSize}px`);
            assert.ok(result.horizontalOverflow <= 1, `${variant} ${viewport.width}px graph overflow ${result.horizontalOverflow}`);
            assert.ok(result.documentOverflowX <= 1, `${variant} ${viewport.width}px document overflow`);
            assert.deepEqual(result.hitOverlaps, [], `${variant} ${viewport.width}px hit overlap`);
            assert.deepEqual(result.visualOverlaps, [], `${variant} ${viewport.width}px visual overlap`);
            assertConnectedTopology(result);

            if (screenshotDir) {
                await page.screenshot({ path: path.join(screenshotDir, `fx-graph-${variant}-${viewport.width}x${viewport.height}.png`) });
            }
        }

        await page.close();
    }
});
