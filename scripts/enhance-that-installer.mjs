import path from "node:path";

function shellLiteral(value) {
    if (typeof value !== "string" || /[\0\r\n]/u.test(value))
        throw new Error("Installer values must be single-line strings.");
    return `'${value.replaceAll("'", "'\\''")}'`;
}

/** The fixtures substitute only scan roots; production always uses local account homes. */
export function renderEnhanceThatPreinstall({ teamIdentifier = null, includeAU = false } = {}, {
    systemRoot = "/Library/Audio/Plug-Ins/VST3",
    componentRoot = path.join(path.dirname(systemRoot), "Components"),
    homeDirectories = null,
} = {}) {
    for (const value of [systemRoot, ...(includeAU ? [componentRoot] : []), ...(homeDirectories ?? [])]) {
        if (!path.isAbsolute(value) || /[\0\r\n]/u.test(value))
            throw new Error("Installer scan roots must be absolute single-line paths.");
    }
    if (teamIdentifier !== null && !/^[A-Z0-9]{10}$/u.test(teamIdentifier))
        throw new Error("Installer team identifier must contain ten uppercase letters/digits.");

    const requirement = teamIdentifier === null ? null
        : `anchor apple generic and identifier "dev.cosimo.enhancer-lite" and certificate leaf[subject.OU] = "${teamIdentifier}"`;
    const homeScan = homeDirectories === null ? `
homes=$(/usr/bin/dscl . -list /Users NFSHomeDirectory) || fail "Could not enumerate local account homes."
[ -n "$homes" ] || fail "Local account home enumeration returned no results."
printf '%s\\n' "$homes" | while IFS= read -r account_record; do
    account_home=$(printf '%s\\n' "$account_record" | /usr/bin/sed -E 's/^[^[:space:]]+[[:space:]]+//')
    case "$account_home" in /*) ;; *) fail "Could not resolve a local account home." ;; esac
    inspect_home "$account_home"
done
` : homeDirectories.map(home => `inspect_home ${shellLiteral(home)}`).join("\n");

    return `#!/bin/sh
set -eu
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
umask 077
fail() { printf 'Enhance That: %s\\n' "$1" >&2; exit 1; }
occupied() { [ -e "$1" ] || [ -L "$1" ]; }
legacy() {
    if occupied "$1"; then
        fail "An existing plugin must be retained outside plugin scan folders before installation: $1. Nothing was removed."
    fi
}
inspect_home() {
    legacy "$1/Library/Audio/Plug-Ins/VST3/CosimoEnhancerLite.vst3"
    legacy "$1/Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3"
    ${includeAU ? `legacy "$1/Library/Audio/Plug-Ins/Components/CosimoEnhancerLite.component"
    legacy "$1/Library/Audio/Plug-Ins/Components/EnhanceThat.component"` : ""}
}
if [ "$#" -ge 3 ] && [ "$3" != / ]; then fail "This installer supports the current startup volume only."; fi
${homeScan}
for phase in inspect preserve; do
for format in ${includeAU ? "vst3 component" : "vst3"}; do
if [ "$format" = vst3 ]; then system_root=${shellLiteral(systemRoot)}; else system_root=${shellLiteral(componentRoot)}; fi
ancestor="$system_root"
while [ "$ancestor" != / ]; do
    [ ! -L "$ancestor" ] || fail "A system plugin scan path is a symbolic link: $ancestor"
    ancestor=$(/usr/bin/dirname "$ancestor")
done
legacy "$system_root/CosimoEnhancerLite.$format"
installed="$system_root/EnhanceThat.$format"
if occupied "$installed"; then
    [ -d "$installed" ] && [ ! -L "$installed" ] || fail "The existing system destination is not a regular plugin bundle: $installed"
    ${requirement === null ? 'fail "An unsigned validation installer cannot replace an existing system plugin."' : `requirement=${shellLiteral(requirement)}
    /usr/bin/codesign --verify --deep --strict -R="$requirement" "$installed" || fail "The existing system plugin does not match the release signing identity: $installed"
    if [ "$format" = vst3 ]; then
    processor_cid=$(/usr/bin/plutil -extract Classes.0.CID raw -o - "$installed/Contents/Resources/moduleinfo.json") || fail "Cannot read the existing plugin's sealed VST3 identity metadata."
    [ "$processor_cid" = ABCDEF019182FAEB436F73694373454C ] || fail "The existing system plugin's sealed processor identity differs from Enhance That."
    else
    component_count=$(/usr/bin/plutil -extract AudioComponents raw -o - "$installed/Contents/Info.plist") || fail "Cannot read the existing AU component list."
    [ "$component_count" = 1 ] || fail "The existing system AU must contain exactly one component."
    component_type=$(/usr/bin/plutil -extract AudioComponents.0.type raw -o - "$installed/Contents/Info.plist") || fail "Cannot read the existing AU type."
    component_subtype=$(/usr/bin/plutil -extract AudioComponents.0.subtype raw -o - "$installed/Contents/Info.plist") || fail "Cannot read the existing AU subtype."
    component_manufacturer=$(/usr/bin/plutil -extract AudioComponents.0.manufacturer raw -o - "$installed/Contents/Info.plist") || fail "Cannot read the existing AU manufacturer."
    [ "$component_type" = aufx ] && [ "$component_subtype" = CsEL ] && [ "$component_manufacturer" = Cosi ] || fail "The existing system AU identity differs from Enhance That."
    fi
    if [ "$phase" = preserve ]; then
    recovery=$(/usr/bin/mktemp -d "$system_root/../.EnhanceThat.$format.previous.XXXXXX") || fail "Could not create an exclusive recovery directory."
    trap 'printf "Enhance That recovery directory retained: %s\\n" "$recovery" >&2' EXIT
    /usr/bin/ditto --norsrc --noextattr --noqtn "$installed" "$recovery/previous.bundle" || fail "Could not preserve the previous system plugin."
    /usr/bin/codesign --verify --deep --strict -R="$requirement" "$recovery/previous.bundle" || fail "The retained previous plugin failed signature verification."
    /usr/bin/diff -qr "$installed" "$recovery/previous.bundle" || fail "The existing plugin changed while its recovery copy was being captured."
    printf '%s\\n' 'Previous EnhanceThat system plugin. Retained before the package payload was installed.' 'To recover: quit the host; retain any failed replacement outside all scan folders; copy previous.bundle back to the original destination below.' "$installed" > "$recovery/RECOVERY.txt"
    printf 'Enhance That recovery directory retained: %s\\n' "$recovery" >&2
    trap - EXIT
    fi`}
fi
done
done
exit 0
`;
}
