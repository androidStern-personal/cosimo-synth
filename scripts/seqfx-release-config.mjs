import {
    forbiddenChocWebViewMarkers,
    requiredChocWebViewMarkers,
} from "../kit/scripts/check_choc_markers.mjs";

/**
 * Authoritative release-facing identity and packaging contract for SeqFX.
 *
 * The Cmajor manifest remains the runtime source consumed by Cmajor/JUCE. The
 * release builder refuses to continue when any identity field in that manifest
 * drifts from this contract, so packaging cannot silently invent a second
 * product identity.
 */
export const seqFxReleaseConfig = Object.freeze({
    schemaVersion: 4,
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
        betaVersionApproved: false,
        signingAndNotarizationApproved: false,
        cmajorDistributionRightsApproved: false,
        juceDistributionRightsApproved: false,
    }),
    support: Object.freeze({
        publicContact: null,
    }),
    paths: Object.freeze({
        patchManifest: "fx/seqfx/SeqFx.cmajorpatch",
        thirdPartyNotices: "legal/seqfx/THIRD_PARTY_NOTICES.txt",
        builtVst3: "build/seqfx_juce/_build/plugin/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3",
        nativeBuildCmakeCache: "build/seqfx_juce/_build/CMakeCache.txt",
        installedVst3: "/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3",
        userInstalledVst3: "~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3",
    }),
    nativeDependencies: Object.freeze({
        declarationPath: "kit/cmake/CosimoDependencies.cmake",
        cmajor: Object.freeze({
            cpmName: "cosimo_cmajor",
            sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR",
            repository: "https://github.com/androidStern-personal/cmajor.git",
            revision: "cb616bf1d0931ff92da3826d15a01eadfd8e35b1",
        }),
        choc: Object.freeze({
            repository: "https://github.com/androidStern-personal/choc.git",
            revision: "98b52fb54c3b9fec03c0c13218f6557aef33eabe",
            submodulePath: "include/choc",
        }),
        juce: Object.freeze({
            cpmName: "cosimo_juce",
            sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_juce_SOURCE_DIR",
            repository: "https://github.com/juce-framework/JUCE.git",
            revision: "501c07674e1ad693085a7e7c398f205c2677f5da",
        }),
    }),
    nativeMetadata: Object.freeze({
        bundlePackageType: "BNDL",
        vst3Category: "Fx",
        audioClass: Object.freeze({
            category: "Audio Module Class",
            cid: "ABCDEF019182FAEB436F736943734678",
        }),
        controllerClass: Object.freeze({
            category: "Component Controller Class",
            cid: "ABCDEF011234ABCD436F736943734678",
        }),
    }),
    signing: Object.freeze({
        application: Object.freeze({
            commonName: null,
            sha1Fingerprint: null,
            teamIdentifier: null,
        }),
        installer: Object.freeze({
            commonName: null,
            sha1Fingerprint: null,
            teamIdentifier: null,
        }),
    }),
    webViewMarkers: Object.freeze({
        required: requiredChocWebViewMarkers,
        forbidden: forbiddenChocWebViewMarkers,
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

    if (!config.approvals.betaVersionApproved) {
        decisions.push({
            id: "beta-version-approval",
            decision: `Approve ${config.release.channelVersion} as the first public beta version.`,
        });
    }

    if (!config.approvals.cmajorDistributionRightsApproved) {
        decisions.push({
            id: "cmajor-distribution-rights",
            decision: "Confirm that this exact Cmajor-based binary is covered by an applicable commercial entitlement or an approved GPL-compliant distribution plan.",
        });
    }

    if (!config.approvals.juceDistributionRightsApproved) {
        decisions.push({
            id: "juce-distribution-rights",
            decision: "Confirm that this exact JUCE-based binary is covered by an applicable commercial entitlement or an approved AGPL-compliant distribution plan.",
        });
    }

    if (!config.approvals.signingAndNotarizationApproved) {
        decisions.push({
            id: "signing-notarization-authorization",
            decision: "Explicitly authorize Developer ID signing and submission of this beta candidate to Apple notarization.",
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
