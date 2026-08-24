/**
 * Review-grade live render: drives the live-review harness in headless
 * Chromium, captures real compositor output via CDP screencast, and
 * assembles a watchable mp4 of the stage. This is the agent/CI watching
 * loop — shipping renders come from the in-app Region Capture recorder.
 *
 * Usage:
 *   node tests/tools/render_live_review.mjs [--start=SECONDS] [--end=SECONDS]
 *       [--out=build/live-review/review.mp4]
 * Prerequisites: npm run ui:video-bounce:build && npm run speedrun:live:harness:build
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { startLiveReviewServer } from "../helpers/live_review_server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = Object.fromEntries(process.argv.slice(2)
    .filter((argument) => argument.startsWith("--"))
    .map((argument) => {
        const [key, value] = argument.slice(2).split("=");
        return [key, value ?? "true"];
    }));
const startAtSeconds = args.start !== undefined ? Number(args.start) : undefined;
const endAtSeconds = args.end !== undefined ? Number(args.end) : undefined;
const outPath = path.resolve(repoRoot, args.out ?? "build/live-review/review.mp4");

const server = await startLiveReviewServer();
const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 640, height: 1120 }, deviceScaleFactor: 1 });
const failures = [];
page.on("pageerror", (error) => failures.push(`pageerror: ${error.stack ?? error.message}`));
page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
});
await page.goto(`${server.baseUrl}live-test/live-review-harness.html`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__COSIMO_LIVE_REVIEW__?.start === "function", null, { timeout: 60_000 });

const frameDir = path.join(path.dirname(outPath), "frames");
await fs.rm(frameDir, { recursive: true, force: true });
await fs.mkdir(frameDir, { recursive: true });

const client = await page.context().newCDPSession(page);
const frames = [];
client.on("Page.screencastFrame", (event) => {
    frames.push({ data: event.data, timestamp: event.metadata.timestamp ?? null });
    client.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
});
await client.send("Page.startScreencast", { format: "jpeg", quality: 82, everyNthFrame: 1 });

// The promise from start() is settled from inside the (eventually detached)
// performance iframe; polling a window field avoids awaiting across realms.
await page.evaluate((options) => {
    window.__COSIMO_LIVE_REVIEW_RESULT__ = undefined;
    void window.__COSIMO_LIVE_REVIEW__.start(options)
        .then((value) => { window.__COSIMO_LIVE_REVIEW_RESULT__ = value; })
        .catch((error) => { window.__COSIMO_LIVE_REVIEW_RESULT__ = { error: String(error?.stack ?? error) }; });
}, { startAtSeconds, endAtSeconds });
const stageBox = await page.waitForFunction(() => {
    const stage = document.querySelector('[data-role="live-stage"]');
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return rect.width > 0 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
}, null, { timeout: 60_000 }).then((handle) => handle.jsonValue());

let result = null;
while (result === null) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    result = await page.evaluate(() => window.__COSIMO_LIVE_REVIEW_RESULT__ ?? null);
}
await client.send("Page.stopScreencast").catch(() => {});
await new Promise((resolve) => setTimeout(resolve, 300));

if (frames.length < 2) {
    console.error(JSON.stringify({ error: "screencast produced too few frames", frames: frames.length, failures }));
    await browser.close();
    await server.stop();
    process.exit(1);
}

let listText = "";
for (let index = 0; index < frames.length; index += 1) {
    const name = `frame-${String(index).padStart(5, "0")}.jpg`;
    await fs.writeFile(path.join(frameDir, name), Buffer.from(frames[index].data, "base64"));
    const timestamp = frames[index].timestamp;
    const next = frames[index + 1]?.timestamp;
    const duration = timestamp !== null && next !== null && next !== undefined
        ? Math.max(0.01, next - timestamp)
        : 1 / 30;
    listText += `file '${name}'\nduration ${duration.toFixed(4)}\n`;
}
listText += `file 'frame-${String(frames.length - 1).padStart(5, "0")}.jpg'\n`;
await fs.writeFile(path.join(frameDir, "list.txt"), listText);

const crop = {
    x: Math.max(0, Math.round(stageBox.left / 2) * 2),
    y: Math.max(0, Math.round(stageBox.top / 2) * 2),
    width: Math.floor(stageBox.width / 2) * 2,
    height: Math.floor(stageBox.height / 2) * 2,
};
const ffmpeg = spawnSync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
    "-vf", `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=30`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    outPath,
], { cwd: frameDir, encoding: "utf8" });
if (ffmpeg.status !== 0) {
    console.error(ffmpeg.stderr.slice(-2000));
    process.exit(1);
}

const reportPath = outPath.replace(/\.mp4$/u, ".report.json");
await fs.writeFile(reportPath, `${JSON.stringify({ result, failures, screencastFrames: frames.length }, null, 2)}\n`);
console.log(JSON.stringify({
    out: outPath,
    report: reportPath,
    screencastFrames: frames.length,
    stageBox,
    missedOps: result?.report?.missedOps ?? null,
    stateOnlyOps: result?.report?.stateOnlyOps ?? null,
    skippedFrames: result?.report?.skippedFrames ?? null,
    failures,
}, null, 2));

await browser.close();
await server.stop();
