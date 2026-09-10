import path from "node:path";

const pluginId = "dev.cosimo.enhancer-lite";
const literal = value => `'${value.replaceAll("'", "'\\''")}'`;

function roots({ includeAU = false } = {}, {
    systemRoot = "/Library/Audio/Plug-Ins/VST3",
    componentRoot = path.join(path.dirname(systemRoot), "Components"),
    homeDirectories = null,
} = {}) {
    for (const value of [systemRoot, componentRoot, ...(homeDirectories ?? [])]) {
        if (!path.isAbsolute(value) || path.normalize(value) !== value || value === "/" || /[\0\r\n]/u.test(value))
            throw new Error("Installer roots must be normalized absolute single-line directory paths.");
    }
    return { systemRoot, componentRoot, homeDirectories, includeAU };
}

const shell = `#!/bin/sh
set -eu
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
if [ "$#" -ge 3 ] && [ "$3" != / ]; then exit 1; fi
regular_path() {
    ancestor="$1"
    while [ "$ancestor" != / ]; do
        [ ! -L "$ancestor" ] || return 1
        ancestor=$(/usr/bin/dirname "$ancestor")
    done
}
`;

/** Native Installer owns replacement of the system bundles; no existing-copy policy. */
export function renderEnhanceThatPreinstall(options = {}, fixtures = {}) {
    const r = roots(options, fixtures);
    return shell + [r.systemRoot, ...(r.includeAU ? [r.componentRoot] : [])]
        .map(root => `regular_path ${literal(root)} || exit 1`).join("\n") + "\nexit 0\n";
}

/** Remove matching older scan duplicates only AFTER the new system payload is installed. */
export function renderEnhanceThatPostinstall(options = {}, fixtures = {}) {
    const r = roots(options, fixtures);
    const homes = r.homeDirectories === null ? `
/usr/bin/dscl . -list /Users NFSHomeDirectory | while IFS= read -r record; do
    home_dir=$(printf '%s\\n' "$record" | /usr/bin/sed -E 's/^[^[:space:]]+[[:space:]]+//')
    case "$home_dir" in /*) clean_home "$home_dir" ;; esac
done` : r.homeDirectories.map(home => `clean_home ${literal(home)}`).join("\n");
    return shell + `
remove_duplicate() {
    bundle="$1"
    [ -d "$bundle" ] || return 0
    regular_path "$bundle" || return 0
    [ ! -L "$bundle/Contents" ] && [ ! -L "$bundle/Contents/Info.plist" ] || return 0
    bundle_id=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$bundle/Contents/Info.plist" 2>/dev/null) || return 0
    [ "$bundle_id" = ${literal(pluginId)} ] || return 0
    /bin/rm -rf -- "$bundle"
}
clean_home() {
    remove_duplicate "$1/Library/Audio/Plug-Ins/$scan/EnhanceThat.$format"
    remove_duplicate "$1/Library/Audio/Plug-Ins/$scan/CosimoEnhancerLite.$format"
}
for format in ${r.includeAU ? "vst3 component" : "vst3"}; do
    if [ "$format" = vst3 ]; then
        scan=VST3; system_root=${literal(r.systemRoot)}
    else
        scan=Components; system_root=${literal(r.componentRoot)}
    fi
    regular_path "$system_root/EnhanceThat.$format" || exit 1
    installed_id=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$system_root/EnhanceThat.$format/Contents/Info.plist")
    [ "$installed_id" = ${literal(pluginId)} ] || exit 1
    remove_duplicate "$system_root/CosimoEnhancerLite.$format"
    ${homes}
done
exit 0
`;
}

export function renderEnhanceThatReadme({ releaseVersion, payloadBundles }) {
    return `Enhance That ${releaseVersion}

Apple silicon Mac · macOS 15 or later

1. Quit your DAW.
2. Open the installer package and follow the installation steps.
3. Open your DAW and rescan plugins if needed, then load Enhance That.

Installed plugins:
${payloadBundles.map(bundle => `/${bundle.relativePath}`).join("\n")}

To uninstall, quit your DAW and remove the plugin bundles listed above.
`;
}
