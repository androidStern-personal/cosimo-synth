import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bridgeLogPath = "/tmp/choc-host-keyboard-bridge.log";
const shouldRunNativeProbe = process.env.COSIMO_RUN_NATIVE_KEYBOARD_PROBE === "1";
const isMacOS = process.platform === "darwin";

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function run(command, args, {
    cwd = repoRoot,
    timeout = 600_000,
} = {}) {
    return execFileAsync(command, args, {
        cwd,
        timeout,
        maxBuffer: 20 * 1024 * 1024,
    });
}

async function readTrimmed(command, args, options) {
    const { stdout } = await run(command, args, options);
    return stdout.trim();
}

async function buildKeyboardProbeApp(devServerOrigin) {
    if (process.env.COSIMO_NATIVE_KEYBOARD_PROBE_APP) {
        return process.env.COSIMO_NATIVE_KEYBOARD_PROBE_APP;
    }

    const probeBuildDir = path.join(repoRoot, "build", "desktop_native_keyboard_probe");
    const appPath = path.join(
        probeBuildDir,
        "CosimoDesktopNative_artefacts",
        "Release",
        "Standalone",
        "CosimoDesktopNative.app",
    );
    const cmajorSourcePath = await readTrimmed("python3", ["scripts/ensure_cmajor_runtime.py", "--path"]);
    const jucePath = process.env.JUCE_PATH ?? path.join(
        process.env.HOME ?? "",
        "Library",
        "Caches",
        "cosimo-synth-dev",
        "JUCE",
    );

    await run("cmake", [
        "-S", path.join(repoRoot, "tools", "desktop_native"),
        "-B", probeBuildDir,
        "-DCMAKE_BUILD_TYPE=Release",
        "-DCMAKE_CXX_FLAGS=-DCHOC_HOST_KEYBOARD_BRIDGE_DEBUG_LOG=1",
        `-DCOSIMO_PATCH_PATH=${path.join(repoRoot, "WavetableSynth.cmajorpatch")}`,
        "-DCOSIMO_DESKTOP_UI_SOURCE_MODE=dev-server",
        `-DCOSIMO_DESKTOP_DEV_SERVER_ORIGIN=${devServerOrigin.replace(/\/$/, "")}`,
        `-DCMAJOR_SOURCE_PATH=${cmajorSourcePath}`,
        `-DJUCE_PATH=${jucePath}`,
    ]);
    await run("cmake", [
        "--build", probeBuildDir,
        "--config", "Release",
        "--target", "CosimoDesktopNative_Standalone",
        "-j", "8",
    ]);

    const cmajorVersionOutput = await readTrimmed("cmaj", ["version"]);
    const cmajorVersion = cmajorVersionOutput
        .split(/\r?\n/)
        .map((line) => line.match(/Cmajor Version:\s+(\S+)/)?.[1])
        .find(Boolean);

    if (!cmajorVersion) {
        throw new Error(`Could not read Cmajor version from:\n${cmajorVersionOutput}`);
    }

    const cacheRoot = process.env.COSIMO_DEV_CACHE ?? path.join(
        process.env.HOME ?? "",
        "Library",
        "Caches",
        "cosimo-synth-dev",
    );
    const runtimeDylib = path.join(cacheRoot, `libCmajPerformer-${cmajorVersion}.dylib`);
    const resourcesDir = path.join(appPath, "Contents", "Resources");
    await fs.mkdir(resourcesDir, { recursive: true });
    await fs.copyFile(runtimeDylib, path.join(resourcesDir, "libCmajPerformer.dylib"));

    return appPath;
}

async function killCosimoDesktopNativeProcesses() {
    try {
        const { stdout } = await execFileAsync("pgrep", ["-f", "CosimoDesktopNative.app/Contents/MacOS/CosimoDesktopNative"]);
        const pids = stdout
            .split(/\s+/)
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid);

        await Promise.all(pids.map(async (pid) => {
            try {
                process.kill(pid, "SIGTERM");
            } catch {
                // The process may have already exited.
            }
        }));

        await delay(1_000);
    } catch {
        // No existing standalone process is fine.
    }
}

async function waitForProbeLog(pattern, description) {
    let lastLog = "";

    for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
            lastLog = await fs.readFile(bridgeLogPath, "utf8");
        } catch {
            lastLog = "";
        }

        if (pattern.test(lastLog)) {
            return lastLog;
        }

        await delay(100);
    }

    throw new Error(`Timed out waiting for ${description}. Last log:\n${lastLog}`);
}

async function placeProbeWindow() {
    await run("osascript", ["-e", `
tell application "System Events"
  tell process "CosimoDesktopNative"
    set frontmost to true
    repeat 50 times
      if exists window 1 then exit repeat
      delay 0.1
    end repeat
    set position of window 1 to {0, 0}
    set size of window 1 to {824, 768}
  end tell
end tell
`], { timeout: 20_000 });
}

async function clearBridgeLog() {
    await fs.writeFile(bridgeLogPath, "");
}

async function runCliclick(commands) {
    await run("/opt/homebrew/bin/cliclick", commands, { timeout: 20_000 });
}

async function exerciseControlThenPressA(commands) {
    await placeProbeWindow();
    await clearBridgeLog();
    await runCliclick([...commands, "w:100", "t:a"]);
    await delay(250);
    return fs.readFile(bridgeLogPath, "utf8");
}

function assertKeyAWasCapturedButNotForwarded(log, controlName) {
    assert.match(
        log,
        /buffer-capture source=keyDown .*charsIgnoringModifiers=a/,
        `${controlName}: native WKWebView did not log a KeyA keyDown after the drag.`,
    );
    assert.doesNotMatch(
        log,
        /forward-request result=forwarded .*eventType=keydown key=a code=KeyA reason=ableton-musical-typing-key/,
        `${controlName}: KeyA reached native and JS, but Cosimo did not claim it; the CHOC bridge forwarded it as host musical typing.\n${log}`,
    );
    assert.match(
        log,
        /forward-request result=relayed .*eventType=keydown key=a code=KeyA reason=ableton-musical-typing-key/,
        `${controlName}: CHOC did not relay the standalone musical typing key into Cosimo.\n${log}`,
    );
    assert.match(
        log,
        /forward-request result=relayed .*eventType=keyup key=a code=KeyA reason=matching-forwarded-keyup/,
        `${controlName}: CHOC relayed KeyA down but not the matching key-up, which can leave a stuck standalone preview note.\n${log}`,
    );
}

test("native standalone keeps musical typing after pointer-drag controls", {
    skip: !shouldRunNativeProbe
        ? "Set COSIMO_RUN_NATIVE_KEYBOARD_PROBE=1 to run the macOS standalone keyboard probe."
        : !isMacOS
            ? "The native standalone keyboard probe only runs on macOS."
            : false,
    timeout: 900_000,
}, async (t) => {
    assert.equal(await fileExists("/opt/homebrew/bin/cliclick"), true, "cliclick is required for the native keyboard probe.");

    const server = await startDesktopHarnessServer();
    let appPath = "";

    try {
        appPath = await buildKeyboardProbeApp(server.baseUrl);
        await killCosimoDesktopNativeProcesses();
        await fs.rm(bridgeLogPath, { force: true });
        await run("open", ["-n", appPath], { timeout: 20_000 });
        await waitForProbeLog(/js-installed href=choc:\/\/choc\.choc\//, "the CHOC keyboard bridge to install");
        await waitForProbeLog(/cosimo-keyboard-router-ready:standalone-preview/, "the Cosimo standalone keyboard router to mount");

        const cases = [
            {
                name: "filter response handle",
                commands: ["dd:565,155", "dm:610,130", "du:610,130"],
            },
            {
                name: "wavetable stage vertical drag",
                commands: ["dd:155,145", "dm:155,95", "du:155,95"],
            },
            {
                name: "chorus mix slider drag",
                commands: ["dd:437,356", "dm:437,400", "du:437,400"],
            },
            {
                name: "MSEG morph slider drag",
                commands: ["dd:68,662", "dm:160,662", "du:160,662"],
            },
        ];

        for (const probeCase of cases) {
            await t.test(probeCase.name, async () => {
                const log = await exerciseControlThenPressA(probeCase.commands);
                assertKeyAWasCapturedButNotForwarded(log, probeCase.name);
            });
        }
    } finally {
        await killCosimoDesktopNativeProcesses();
        await server.stop();
    }
});
