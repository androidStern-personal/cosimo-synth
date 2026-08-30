/**
 * Authoritative release-facing identity and packaging contract for SeqFX.
 *
 * The Cmajor manifest remains the runtime source consumed by Cmajor/JUCE. The
 * release builder refuses to continue when any identity field in that manifest
 * drifts from this contract, so packaging cannot silently invent a second
 * product identity.
 */
export const seqFxReleaseConfig = Object.freeze({
    schemaVersion: 1,
    productKey: "seqfx",
    identity: Object.freeze({
        publicName: "Cosimo SeqFX",
        bundleName: "CosimoSeqFX",
        manufacturer: "Cosimo",
        patchId: "dev.cosimo.seqfx",
        pluginCode: "CsFx",
        manufacturerCode: "Cosi",
        pluginVersion: "0.1.0",
        installerIdentifier: "dev.cosimo.seqfx.pkg",
    }),
    release: Object.freeze({
        channelVersion: "0.1.0-beta.1",
        artifactPlatformLabel: "macOS",
        outputDirectory: "release/seqfx/0.1.0-beta.1",
        sourceDateEpochStrategy: "source-commit",
    }),
    scope: Object.freeze({
        operatingSystems: Object.freeze(["macOS"]),
        minimumMacOSVersion: null,
        pluginFormats: Object.freeze(["VST3"]),
        architectures: Object.freeze(["arm64", "x86_64"]),
        distributionGate: "Patreon-hosted download only",
        patreonDeliverySurface: null,
        audioUnitIncluded: false,
        windowsIncluded: false,
        inPluginActivation: false,
    }),
    approvals: Object.freeze({
        publicIdentityApproved: false,
    }),
    support: Object.freeze({
        publicContact: null,
    }),
    paths: Object.freeze({
        patchManifest: "fx/seqfx/SeqFx.cmajorpatch",
        builtVst3: "build/seqfx_juce/_build/plugin/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3",
        installedVst3: "/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3",
        userInstalledVst3: "~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3",
    }),
    webViewMarkers: Object.freeze({
        required: Object.freeze([
            "chocHostKeyboard",
            "__chocHostKeyboardBridgeInstalled",
            "__chocUserFiles",
            "chocUserFiles",
        ]),
        forbidden: Object.freeze([
            "cosimoKeyboard",
            "cosimoKeyboardProbe",
            "cosimo-keyboard-probe-panel",
            "forwarded-buffered-flags-changed",
        ]),
    }),
});

export function seqFxArtifactBaseName(config = seqFxReleaseConfig) {
    return `${config.identity.bundleName}-${config.release.channelVersion}-${config.release.artifactPlatformLabel}`;
}

export function unresolvedSeqFxPublicReleaseDecisions(config = seqFxReleaseConfig) {
    const decisions = [];

    if (!config.approvals.publicIdentityApproved) {
        decisions.push({
            id: "public-identity-approval",
            decision: "Approve the current public name, bundle ID, plugin code, and manufacturer code before the first distributed beta.",
        });
    }

    if (!config.scope.minimumMacOSVersion) {
        decisions.push({
            id: "minimum-macos-version",
            decision: "Choose and verify the minimum supported macOS version.",
        });
    }

    if (!config.support.publicContact) {
        decisions.push({
            id: "support-contact",
            decision: "Choose the public support email or support URL printed in release notes.",
        });
    }

    if (!config.scope.patreonDeliverySurface) {
        decisions.push({
            id: "patreon-delivery-surface",
            decision: "Choose whether the gated download is a members-only post or a Patreon digital product.",
        });
    }

    return decisions;
}
