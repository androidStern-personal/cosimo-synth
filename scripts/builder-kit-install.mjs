// Maintainer-side rendering only. Customers execute the self-contained Bash
// payload; they never need this module, Keychain, or a source checkout.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
export const publicInstallationUrl = "https://pub-2bb7a8a7b9b44ed3b975f3f0a6bcc756.r2.dev/install.sh";

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

async function renderPublicEntry(bootstrap, feedOrigin, publicBootstrapUrl = publicInstallationUrl) {
    const feed = parseOrigin(feedOrigin);
    let url;
    try {
        url = new URL(publicBootstrapUrl);
        const loopback = url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname);
        if (!parseOrigin(publicBootstrapUrl) || url.pathname !== "/install.sh"
            || (publicBootstrapUrl !== publicInstallationUrl && !loopback)) return failure("invalid-public-bootstrap-url");
    } catch { return failure("invalid-public-bootstrap-url"); }
    if (!feed) return failure("invalid-origin");
    let template;
    try { template = await readFile(new URL("./templates/builder-kit-public-install.sh.template", import.meta.url), "utf8"); }
    catch { return failure("public-bootstrap-template-unavailable"); }
    const values = {
        FEED_ORIGIN: quote(feed.value), PROTOCOLS: quote(feed.protocols),
        INSTALLER_ARTIFACT: quote(bootstrap.artifact), INSTALLER_SHA256: quote(bootstrap.sha256),
        DEFAULT_DIRECTORY: `builder-kit-${bootstrap.release.tag.slice(1)}`,
    };
    const script = template.replace(/@@([A-Z0-9_]+)@@/gu, (_, key) => values[key]);
    return { ok: true, value: { script, sha256: createHash("sha256").update(script).digest("hex"), url: url.href } };
}

/** The only secret-bearing outputs are wrapped until written to private delivery files. */
export async function renderInstallation(options) {
    let capability;
    try { capability = ensureRedacted(options.capability); }
    catch { return failure("invalid-capability"); }
    if (!/^[A-Za-z0-9._~-]+$/u.test(reveal(capability))) return failure("invalid-capability");
    if ("projectDir" in options || "installerOrigin" in options) return failure("obsolete-inline-delivery-option");
    const bootstrap = await renderBootstrap(options);
    if (!bootstrap.ok) return bootstrap;
    if (!options.manifest.installation
        || options.manifest.installation.sha256 !== bootstrap.value.sha256 || options.manifest.installation.artifact !== bootstrap.value.artifact)
        return failure("installer-does-not-match-release-manifest");
    const publicEntry = await renderPublicEntry(bootstrap.value, options.feedOrigin, options.publicBootstrapUrl);
    if (!publicEntry.ok) return publicEntry;
    const publicBootstrap = publicEntry.value;
    if ([bootstrap.value.script, publicBootstrap.script, publicBootstrap.url].some(value => value.includes(reveal(capability))))
        return failure("bootstrap-must-not-contain-capability");
    const command = redact(`export BUILDER_KIT_ACCESS=${quote(reveal(capability))}; curl -fsSL ${publicBootstrap.url} | bash`);
    const delivery = redact([
        "Builder Kit installation — macOS 15 or newer, Apple silicon",
        "Apple Command Line Tools must already be installed and their agreements accepted by you.",
        "Node and CMake are downloaded into this project; your shell profiles and system runtimes are unchanged.",
        `The project folder is ~/src/builder-kit-${bootstrap.value.release.tag.slice(1)}.`,
        "", ...juceNoticeLines(), "",
        "If you agree to the notice above, copy the entire line below into Terminal and press Enter.",
        "Running this command after agreeing explicitly acknowledges the JUCE terms; the hosted installer records that acknowledgment. Setup does not grant a JUCE license.",
        "Keep this personalized command private: it contains your access credential.",
        "", reveal(command), "",
        "On success, open the printed project folder in Codex. No plugin is built or installed.",
    ].join("\n"));
    return { ok: true, value: { ...bootstrap.value, publicBootstrap, command, delivery } };
}
