import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prototypeRoot = path.join(repoRoot, "ui/desktop/fx-graph-mobile-prototype");
const remotePrototypeUrl = process.env.COSIMO_FX_GRAPH_PROTOTYPE_URL;
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
    return "application/octet-stream";
}

async function startPrototypeServer() {
    const localServer = createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");
            const prefix = "/fx-graph-prototype";
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
    return {
        server: localServer,
        origin: `http://127.0.0.1:${address.port}`,
    };
}

async function selectEffect(page, label) {
    await page.locator(`[data-effect="${label}"]`).first().click();
    await page.locator(`[data-effect="${label}"].is-selected`).waitFor();
}

async function focusState(page) {
    return page.locator(".graph-svg-natural").evaluate((svg) => ({
        outer: svg.dataset.focusOuter,
        nested: svg.dataset.focusNested,
        detail: [...svg.querySelectorAll('[data-representation="detail"]')].map((node) => node.dataset.effect),
        icons: [...svg.querySelectorAll('[data-representation="icon"]')].map((node) => node.dataset.effect),
        widths: Object.fromEntries([...svg.querySelectorAll(".branch-zone")].map((node) => [node.dataset.branch, Number(node.dataset.width)])),
    }));
}

async function focusedHierarchyGeometry(page) {
    return page.locator(".graph-svg-natural").evaluate((svg) => {
        const route = svg.querySelector('[data-route-role="parent-child-continuous"]');
        const split = svg.querySelector('[data-junction="nested-split"]');
        const merge = svg.querySelector('[data-junction="nested-merge"]');
        const parentBadge = svg.querySelector('[data-branch-node="mid-parent"]');
        if (!route || !split || !merge || !parentBadge) { return null; }

        const points = {
            parentBadge: [Number(parentBadge.dataset.anchorX), Number(parentBadge.dataset.anchorY)],
            split: [Number(split.getAttribute("cx")), Number(split.getAttribute("cy"))],
            child: [Number(route.dataset.childX), 450],
            merge: [Number(merge.getAttribute("cx")), Number(merge.getAttribute("cy"))],
        };
        const totalLength = route.getTotalLength();
        const distanceToRoute = ([x, y]) => {
            let minimum = Number.POSITIVE_INFINITY;
            for (let length = 0; length <= totalLength; length += 0.25) {
                const point = route.getPointAtLength(length);
                minimum = Math.min(minimum, Math.hypot(point.x - x, point.y - y));
            }
            return minimum;
        };
        const junctions = svg.querySelector(".junctions");
        const badges = svg.querySelector(".branch-badges");
        return {
            parent: route.dataset.parentBranch,
            child: route.dataset.childBranch,
            start: route.dataset.start.split(",").map(Number),
            end: route.dataset.end.split(",").map(Number),
            distances: Object.fromEntries(Object.entries(points).map(([name, point]) => [name, distanceToRoute(point)])),
            strokeWidth: Number.parseFloat(getComputedStyle(route).strokeWidth),
            junctionsBeforeRoute: Boolean(junctions.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING),
            routeBeforeBadges: Boolean(route.compareDocumentPosition(badges) & Node.DOCUMENT_POSITION_FOLLOWING),
            parentChildAnchor: parentBadge.dataset.childAnchor,
            splitAnchor: points.split.join(","),
        };
    });
}

async function graphGeometry(page) {
    return page.locator(".map-stage-natural").evaluate((stage) => {
        const stageRect = stage.getBoundingClientRect();
        const visualNodes = [...stage.querySelectorAll(".station-detail-frame, .station-icon-frame")].map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                effect: node.closest("[data-effect]")?.dataset.effect,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
            };
        });
        const hitNodes = [...stage.querySelectorAll(".station-detail-hit, .station-icon-hit")].map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                effect: node.closest("[data-effect]")?.dataset.effect,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
            };
        });
        const findOverlaps = (nodes) => {
            const overlaps = [];
            for (let first = 0; first < nodes.length; first += 1) {
                for (let second = first + 1; second < nodes.length; second += 1) {
                    const a = nodes[first];
                    const b = nodes[second];
                    const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                    const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                    if (overlapWidth > 0.5 && overlapHeight > 0.5) {
                        overlaps.push([a.effect, b.effect, overlapWidth, overlapHeight]);
                    }
                }
            }
            return overlaps;
        };

        const routeEndpoints = [...stage.querySelectorAll("path[data-start][data-end]")].map((route) => {
            const start = route.getPointAtLength(0);
            const end = route.getPointAtLength(route.getTotalLength());
            return {
                id: route.dataset.routeId,
                declaredStart: route.dataset.start.split(",").map(Number),
                declaredEnd: route.dataset.end.split(",").map(Number),
                start: [start.x, start.y],
                end: [end.x, end.y],
            };
        });

        const scroller = stage.querySelector("[data-root-graph-scroll]");
        return {
            stage: { left: stageRect.left, right: stageRect.right },
            visualNodes,
            hitNodes,
            overlaps: findOverlaps(visualNodes),
            hitOverlaps: findOverlaps(hitNodes),
            routeEndpoints,
            rootScrollerCount: stage.querySelectorAll('[data-scroll-owner="root"]').length,
            branchScrollerCount: stage.querySelectorAll('[data-scroll-owner="branch"]').length,
            horizontalOverflow: scroller.scrollWidth - scroller.clientWidth,
            verticalOverflow: scroller.scrollHeight - scroller.clientHeight,
            documentOverflowX: document.documentElement.scrollWidth - window.innerWidth,
            documentOverflowY: document.documentElement.scrollHeight - window.innerHeight,
        };
    });
}

function assertConnectedRoutes(routeEndpoints) {
    for (const route of routeEndpoints) {
        assert.ok(Math.abs(route.start[0] - route.declaredStart[0]) < 0.01, `${route.id} start x`);
        assert.ok(Math.abs(route.start[1] - route.declaredStart[1]) < 0.01, `${route.id} start y`);
        assert.ok(Math.abs(route.end[0] - route.declaredEnd[0]) < 0.01, `${route.id} end x`);
        assert.ok(Math.abs(route.end[1] - route.declaredEnd[1]) < 0.01, `${route.id} end y`);
    }

    const byId = Object.fromEntries(routeEndpoints.map((route) => [route.id, route]));
    assert.deepEqual(byId["outer-lo"].declaredStart, byId["outer-mid-in"].declaredStart);
    assert.deepEqual(byId["outer-hi"].declaredStart, byId["outer-mid-in"].declaredStart);
    assert.deepEqual(byId["nested-a"].declaredStart, byId["outer-mid-in"].declaredEnd);
    assert.deepEqual(byId["nested-b"].declaredStart, byId["outer-mid-in"].declaredEnd);
    assert.deepEqual(byId["nested-a"].declaredEnd, byId["outer-mid-out"].declaredStart);
    assert.deepEqual(byId["nested-b"].declaredEnd, byId["outer-mid-out"].declaredStart);
    assert.deepEqual(byId["outer-lo"].declaredEnd, byId["outer-mid-out"].declaredEnd);
    assert.deepEqual(byId["outer-hi"].declaredEnd, byId["outer-mid-out"].declaredEnd);
    assert.deepEqual(byId["later-a"].declaredStart, byId["later-b"].declaredStart);
    assert.deepEqual(byId["later-a"].declaredEnd, byId["later-b"].declaredEnd);
}

before(async () => {
    if (remotePrototypeUrl) {
        origin = remotePrototypeUrl;
    } else {
        ({ server, origin } = await startPrototypeServer());
    }
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    if (server) {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});

test("mobile FX prototype recursively expands the selected path without geometry regressions", async (t) => {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
            browserErrors.push(`${message.type()}: ${message.text()}`);
        }
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const targetUrl = new URL(remotePrototypeUrl ? origin : `${origin}/fx-graph-prototype/`);
    targetUrl.searchParams.set("variant", "D");
    await page.goto(targetUrl.href, { waitUntil: "networkidle" });

    await t.test("ImageGen emblems are loaded with real transparent corners", async () => {
        const iconResults = await page.evaluate(async () => {
            const hrefs = [...new Set([...document.querySelectorAll("image.station-image")].map((node) => node.href.baseVal))];
            return Promise.all(hrefs.map(async (href) => {
                const bitmap = await createImageBitmap(await (await fetch(href)).blob());
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                context.drawImage(bitmap, 0, 0);
                const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
                let hasOpaquePixel = false;
                for (let index = 3; index < pixels.length; index += 4) {
                    if (pixels[index] > 0) { hasOpaquePixel = true; break; }
                }
                return { href, cornerAlpha: pixels[3], hasOpaquePixel };
            }));
        });
        assert.equal(iconResults.length, 14);
        assert.ok(iconResults.every((result) => result.cornerAlpha === 0), JSON.stringify(iconResults));
        assert.ok(iconResults.every((result) => result.hasOpaquePixel), JSON.stringify(iconResults));
    });

    await t.test("selection follows outer and nested focus ownership exactly", async () => {
        const cases = [
            { effect: "DRV 1", outer: "lo", nested: "none", widths: { lo: 70, mid: 50, hi: 24 }, detail: ["DRV 1", "SAT 1"] },
            { effect: "OTT 1", outer: "mid", nested: "a", widths: { lo: 24, mid: 96, hi: 24 }, detail: ["EQ 1", "OTT 1", "CHO 1"] },
            { effect: "PHS 1", outer: "mid", nested: "b", widths: { lo: 24, mid: 96, hi: 24 }, detail: ["EQ 1", "PHS 1", "DLY 1", "DLY 2"] },
            { effect: "CRS 1", outer: "hi", nested: "none", widths: { lo: 24, mid: 50, hi: 70 }, detail: ["CRS 1", "FLT 1"] },
            { effect: "PAN 1", outer: "none", nested: "none", widths: { lo: 34, mid: 76, hi: 34 }, detail: ["REV 1", "DLY 3", "PAN 1", "FLG 1"] },
            { effect: "EQ 2", outer: "none", nested: "none", widths: { lo: 34, mid: 76, hi: 34 }, detail: ["EQ 2"] },
        ];

        const yPositions = await page.locator("[data-effect]").evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => {
            const match = node.getAttribute("transform")?.match(/translate\([^ ]+ ([^)]+)\)/);
            return [node.dataset.effect, match ? Number(match[1]) : null];
        })));

        for (const expected of cases) {
            await selectEffect(page, expected.effect);
            const actual = await focusState(page);
            assert.equal(actual.outer, expected.outer, expected.effect);
            assert.equal(actual.nested, expected.nested, expected.effect);
            assert.deepEqual(actual.widths, expected.widths, expected.effect);
            for (const label of expected.detail) {
                assert.ok(actual.detail.includes(label), `${label} should be detailed after selecting ${expected.effect}`);
            }
            const nextYPositions = await page.locator("[data-effect]").evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => {
                const match = node.getAttribute("transform")?.match(/translate\([^ ]+ ([^)]+)\)/);
                return [node.dataset.effect, match ? Number(match[1]) : null];
            })));
            assert.deepEqual(nextYPositions, yPositions, `vertical pitch changed after selecting ${expected.effect}`);
        }
    });

    await t.test("the selected nested child is one visible path rooted in its MID parent", async () => {
        for (const expected of [
            { effect: "OTT 1", child: "a" },
            { effect: "PHS 1", child: "b" },
        ]) {
            await selectEffect(page, expected.effect);
            const geometry = await focusedHierarchyGeometry(page);
            assert.ok(geometry, `${expected.effect} is missing its continuous parent-child route`);
            assert.equal(geometry.parent, "mid");
            assert.equal(geometry.child, expected.child);
            assert.deepEqual(geometry.start, [72, 112]);
            assert.deepEqual(geometry.end, [72, 770]);
            assert.equal(geometry.parentChildAnchor, geometry.splitAnchor);
            for (const [anchor, distance] of Object.entries(geometry.distances)) {
                assert.ok(distance < 0.5, `${expected.effect} route misses ${anchor} by ${distance}`);
            }
            assert.ok(geometry.strokeWidth >= 3, `${expected.effect} parent-child route is not visibly strong`);
            assert.equal(geometry.junctionsBeforeRoute, true, `${expected.effect} route is hidden behind its child junction`);
            assert.equal(geometry.routeBeforeBadges, true, `${expected.effect} route obscures its parent label`);
        }
    });

    await t.test("representative phone widths have one scroll owner and no chip overlap or horizontal overflow", async () => {
        for (const viewport of viewportCases) {
            await page.setViewportSize(viewport);
            for (const effect of ["DRV 1", "OTT 1", "PHS 1", "CRS 1", "PAN 1"]) {
                await selectEffect(page, effect);
                const geometry = await graphGeometry(page);
                assert.equal(geometry.rootScrollerCount, 1, `${viewport.width}px ${effect}`);
                assert.equal(geometry.branchScrollerCount, 0, `${viewport.width}px ${effect}`);
                assert.ok(geometry.verticalOverflow > 0, `${viewport.width}px graph should naturally scroll`);
                assert.ok(geometry.horizontalOverflow <= 1, `${viewport.width}px graph overflowed horizontally by ${geometry.horizontalOverflow}`);
                assert.ok(geometry.documentOverflowX <= 1, `${viewport.width}px document overflowed horizontally`);
                assert.ok(geometry.documentOverflowY <= 1, `${viewport.width}px document became a second scroll owner`);
                assert.deepEqual(geometry.overlaps, [], `${viewport.width}px ${effect}: ${JSON.stringify(geometry.overlaps)}`);
                assert.deepEqual(geometry.hitOverlaps, [], `${viewport.width}px ${effect} ambiguous hit areas: ${JSON.stringify(geometry.hitOverlaps)}`);
                for (const node of geometry.visualNodes) {
                    assert.ok(node.left >= geometry.stage.left - 1, `${viewport.width}px ${node.effect} escaped left`);
                    assert.ok(node.right <= geometry.stage.right + 1, `${viewport.width}px ${node.effect} escaped right`);
                }
                for (const node of geometry.hitNodes) {
                    assert.ok(node.left >= geometry.stage.left - 1, `${viewport.width}px ${node.effect} hit area escaped left`);
                    assert.ok(node.right <= geometry.stage.right + 1, `${viewport.width}px ${node.effect} hit area escaped right`);
                    assert.ok(node.bottom - node.top >= 43, `${viewport.width}px ${node.effect} hit area is too short`);
                }
                assertConnectedRoutes(geometry.routeEndpoints);
            }
        }
    });

    await t.test("root scroll position survives focus reallocation and later unequal branches remain fully labeled", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        const scroller = page.locator("[data-root-graph-scroll]");
        await scroller.evaluate((node) => {
            node.scrollTop = 650;
            node.dispatchEvent(new Event("scroll"));
        });
        const before = await scroller.evaluate((node) => node.scrollTop);
        await page.locator('[data-effect="FLG 1"]').first().evaluate((node) => {
            node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        await page.locator('[data-effect="FLG 1"].is-selected').waitFor();
        const after = await scroller.evaluate((node) => node.scrollTop);
        assert.ok(Math.abs(after - before) <= 1, `scroll moved from ${before} to ${after}`);
        const state = await focusState(page);
        for (const label of ["REV 1", "DLY 3", "PAN 1", "FLG 1"]) {
            assert.ok(state.detail.includes(label), `${label} should remain labeled in the roomy two-way split`);
        }
    });

    assert.deepEqual(browserErrors, []);
    await page.close();
});
