// Maintainer-side rendering only. Customers execute the self-contained Bash
// payload; they never need this module, Keychain, or a source checkout.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureRedacted, redact, reveal } from "../kit/scripts/redacted.mjs";
import { juceNoticeLines } from "../kit/scripts/toolchain.mjs";

// Verified against the publishers' SHA-256 lists, 2026-09-04. Updating these is
// an explicit installer release decision, not a customer's package-manager step.
export const installationRuntimes = Object.freeze({
    node: Object.freeze({
        directory: "node-v22.23.2-darwin-arm64",
        bin: "bin",
        executable: "node",
        version: "v22.23.2",
        url: "https://nodejs.org/dist/v22.23.2/node-v22.23.2-darwin-arm64.tar.gz",
        sha256: "61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6",
    }),
    cmake: Object.freeze({
        directory: "cmake-4.3.4-macos-universal",
        bin: "CMake.app/Contents/bin",
        executable: "cmake",
        version: "cmake version 4.3.4",
        url: "https://github.com/Kitware/CMake/releases/download/v4.3.4/cmake-4.3.4-macos-universal.tar.gz",
        sha256: "bf6647c78ac295c54dbe0a094d4428f495be93c1f810fd8bde57374e8b548523",
    }),
});

const sha256Pattern = /^[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const safePath = /^[A-Za-z0-9_-][A-Za-z0-9._/-]*$/u;
const failure = (code) => ({ ok: false, error: { code } });
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

function parseOrigin(input) {
    try {
        const url = new URL(input);
        const loopback = url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname);
        if ((!loopback && url.protocol !== "https:") || url.username || url.password || url.search || url.hash
            || !/^\/[A-Za-z0-9._~/-]*$/u.test(url.pathname)) return null;
        return { value: url.href.replace(/\/+$/u, ""), protocols: loopback ? "=http" : "=https" };
    } catch { return null; }
}

function parseRelease(manifest) {
    if (!manifest || manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version)
        || manifest.tag !== `v${manifest.version}` || manifest.kit?.tag !== manifest.tag
        || manifest.kit.repo !== "kit.git" || !commitPattern.test(manifest.kit.commit)
        || !sha256Pattern.test(manifest.tools?.cmaj?.sha256)
        || !sha256Pattern.test(manifest.tools?.cmajPlugin?.sha256)) return null;
    return {
        tag: manifest.tag, commit: manifest.kit.commit,
        cmajSha256: manifest.tools.cmaj.sha256, pluginSha256: manifest.tools.cmajPlugin.sha256,
    };
}

function parseRuntime(runtime) {
    if (!runtime || !["directory", "bin", "executable", "version", "url", "sha256"].every((key) => typeof runtime[key] === "string")
        || !safePath.test(runtime.directory) || runtime.directory.includes("/")
        || !safePath.test(runtime.bin) || runtime.bin.split("/").includes("..")
        || !/^[a-z]+$/u.test(runtime.executable) || !sha256Pattern.test(runtime.sha256)
        || typeof runtime.version !== "string" || !/^[A-Za-z0-9 .-]+$/u.test(runtime.version)) return null;
    try {
        const url = new URL(runtime.url);
        const origin = parseOrigin(url.origin);
        if (!origin || url.username || url.password || url.search || url.hash || /[\r\n"]/u.test(url.href)) return null;
        return { ...runtime, url: url.href, protocols: origin.protocols };
    } catch { return null; }
}

/** Parse the release/delivery boundary and render a credential-free installer. */
export async function renderBootstrap({ manifest, feedOrigin, kitOrigin = feedOrigin, runtimes = installationRuntimes }) {
    const release = parseRelease(manifest);
    const feed = parseOrigin(feedOrigin);
    const kit = parseOrigin(kitOrigin);
    const node = parseRuntime(runtimes?.node);
    const cmake = parseRuntime(runtimes?.cmake);
    if (!release) return failure("invalid-release");
    if (!feed || !kit) return failure("invalid-origin");
    if (!node || !cmake) return failure("invalid-runtime");
    let template;
    try { template = await readFile(new URL("../kit/install/bootstrap.sh.template", import.meta.url), "utf8"); }
    catch { return failure("installer-template-unavailable"); }
    const values = {
        RELEASE_TAG: release.tag, RELEASE_COMMIT: release.commit,
        FEED_ORIGIN: feed.value, KIT_ORIGIN: kit.value,
        GIT_PROTOCOL: kit.protocols.slice(1),
        CMAJ_SHA256: release.cmajSha256, PLUGIN_SHA256: release.pluginSha256,
    };
    for (const [name, runtime] of [["NODE", node], ["CMAKE", cmake]]) {
        for (const [key, value] of Object.entries(runtime)) values[`${name}_${key.toUpperCase()}`] = value;
    }
    const script = template.replace(/@@([A-Z0-9_]+)@@/gu, (_, key) => quote(values[key]));
    const sha256 = createHash("sha256").update(script).digest("hex");
    return { ok: true, value: { script, sha256, artifact: `installers/${sha256}.sh`, release } };
}

// The success trailer is emitted only after curl succeeds, even when curl
// received a complete-looking body before reporting a transport error. The
// receiver buffers the entire transfer and verifies its pinned hash before
// executing any downloaded code. pipefail covers both sides independently.
const receiver = [
    "set -eu",
    'download=$(mktemp -t builder-kit-download)',
    'trap \'rm -f -- "$download" "$download.sh"\' EXIT',
    'cat > "$download"',
    '[ "$(tail -n 1 "$download")" = BUILDER_KIT_TRANSFER_COMPLETE ] || { printf "%s\\n" "Installer download failed; nothing was installed." >&2; exit 1; }',
    'sed \'$d\' "$download" > "$download.sh"',
    'digest=$(shasum -a 256 "$download.sh")',
    '[ "${digest%% *}" = "$1" ] || { printf "%s\\n" "Installer verification failed; nothing was installed." >&2; exit 1; }',
    '/bin/bash "$download.sh" --accept-juce-terms',
].join("; ");

/** The only secret-bearing outputs are wrapped until written to private delivery files. */
export async function renderInstallation(options) {
    let capability;
    try { capability = ensureRedacted(options.capability); }
    catch { return failure("invalid-capability"); }
    if (!/^[A-Za-z0-9._~-]+$/u.test(reveal(capability))) return failure("invalid-capability");
    if (typeof options.projectDir !== "string" || !path.isAbsolute(options.projectDir)
        || path.parse(options.projectDir).root === path.resolve(options.projectDir)
        || /[\r\n\0]/u.test(options.projectDir)) return failure("invalid-project-directory");
    const bootstrap = await renderBootstrap(options);
    if (!bootstrap.ok) return bootstrap;
    if (!options.manifest.installation
        || options.manifest.installation.sha256 !== bootstrap.value.sha256 || options.manifest.installation.artifact !== bootstrap.value.artifact)
        return failure("installer-does-not-match-release-manifest");
    const origin = parseOrigin(options.installerOrigin ?? options.feedOrigin);
    if (!origin) return failure("invalid-installer-origin");
    const { artifact, sha256 } = bootstrap.value;
    const downloader = `set -euo pipefail; (printf 'url = "%s"\\n' ${quote(`${origin.value}/`)}"$BUILDER_KIT_ACCESS"${quote(`/${artifact}`)} | curl --disable --fail --silent --location --proto ${origin.protocols} --proto-redir ${origin.protocols} --config - && printf '%s\\n' BUILDER_KIT_TRANSFER_COMPLETE) | /bin/bash -c ${quote(receiver)} _ ${quote(sha256)}`;
    const command = redact(`export BUILDER_KIT_ACCESS=${quote(reveal(capability))}; mkdir -p -- ${quote(options.projectDir)} && cd -- ${quote(options.projectDir)} && /bin/bash -c ${quote(downloader)}`);
    const delivery = redact([
        "Builder Kit installation — macOS 15 or newer, Apple silicon",
        "Apple Command Line Tools must already be installed and their agreements accepted by you.",
        "Node and CMake are downloaded into this project; your shell profiles and system runtimes are unchanged.",
        "", ...juceNoticeLines(), "",
        "If you agree to the notice above, copy the entire line below into Terminal and press Enter.",
        "The --accept-juce-terms option records your explicit acknowledgment. Setup does not grant a JUCE license.",
        "Keep this personalized command private: it contains your access credential.",
        "", reveal(command), "",
        "On success, open the printed project folder in Codex. No plugin is built or installed.",
    ].join("\n"));
    return { ok: true, value: { ...bootstrap.value, command, delivery } };
}
