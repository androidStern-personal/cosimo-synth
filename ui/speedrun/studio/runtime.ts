import { buildCanonicalPluginStateContract } from "../../shared/effects/effect-state-contract";
import { ARTICULATIONS_V4_STATE_KEY } from "../../shared/articulation-image";
import { LANE_STATE_KEY } from "../../shared/lane-state";
import { MODULATION_STATE_KEY } from "../../shared/modulation";
import { SYNTH_PRESET_EFFECT_ID } from "../../shared/effects/synth-preset-identity";
import { getFactoryBankCatalogValue } from "../../shared/wavetable-bank";
import type { WavetableCatalog } from "../recipe";
import type { ParameterEndpointMetadata, PatchIntakeOptions } from "../patch-io";
import { SpeedrunStudioError, studioError } from "./errors";

type OfflineSynthClass = {
    readonly prototype: {
        getInputEndpoints(): ParameterEndpointMetadata[];
    };
};

export type SpeedrunStudioRuntime = {
    readonly intakeOptions: PatchIntakeOptions;
    readonly catalog: WavetableCatalog;
    readonly webRootURL: URL;
    readonly engineModuleURL: URL;
    readonly workerURL: URL;
};

export function resolveSpeedrunWebRootURL(baseURI = document.baseURI) {
    const page = new URL(baseURI);
    const normalizedPath = page.pathname.replace(/index\.html$/u, "");
    return normalizedPath.endsWith("/speedrun/")
        ? new URL("../", page)
        : new URL("./", page);
}

async function loadSynthClass(engineModuleURL: URL): Promise<OfflineSynthClass> {
    try {
        const module = await import(/* @vite-ignore */ engineModuleURL.href) as {
            readonly default?: unknown;
            readonly WavetableSynth?: unknown;
        };
        const Synth = module.default ?? module.WavetableSynth;
        if (typeof Synth !== "function") {
            throw new Error("The offline synth module does not export its performer class.");
        }
        return Synth as unknown as OfflineSynthClass;
    } catch (error) {
        throw studioError("contract", "EngineModuleUnavailable", error, "The offline synth contract could not be loaded.");
    }
}

async function loadCatalog(webRootURL: URL): Promise<WavetableCatalog> {
    try {
        const response = await fetch(new URL("assets/factory-bank-catalog.json", webRootURL));
        if (!response.ok) throw new Error(`Factory catalog request failed with HTTP ${response.status}.`);
        const catalogValue: unknown = await response.json();
        const catalog = getFactoryBankCatalogValue(catalogValue);
        if (catalog.tables.length === 0) {
            throw new Error("The factory wavetable catalog is empty.");
        }
        return catalog;
    } catch (error) {
        throw studioError("contract", "FactoryCatalogUnavailable", error, "The factory wavetable catalog could not be loaded.");
    }
}

/** Resolve the generated performer and derive the live contract instead of pinning a stale endpoint list. */
export async function loadSpeedrunStudioRuntime(): Promise<SpeedrunStudioRuntime> {
    const webRootURL = resolveSpeedrunWebRootURL();
    const engineModuleURL = new URL("cmaj_Cosimo_Synth.offline.js", webRootURL);
    const [Synth, catalog] = await Promise.all([
        loadSynthClass(engineModuleURL),
        loadCatalog(webRootURL),
    ]);
    const inputEndpoints = Synth.prototype.getInputEndpoints();
    const visibleParameters = inputEndpoints.filter((endpoint) => {
        const annotation = typeof endpoint.annotation === "object" && endpoint.annotation !== null
            ? endpoint.annotation as { readonly hidden?: unknown }
            : null;
        return endpoint.purpose === "parameter" && annotation?.hidden !== true;
    });
    const currentContract = buildCanonicalPluginStateContract({
        effectID: SYNTH_PRESET_EFFECT_ID,
        parameters: visibleParameters,
        storedState: [
            { key: MODULATION_STATE_KEY, schemaVersion: 6, required: true },
            { key: ARTICULATIONS_V4_STATE_KEY, schemaVersion: 4, required: true },
            { key: "bounce.v1", schemaVersion: 1, required: true },
        ],
    });
    if (currentContract.parameters.length === 0) {
        throw new SpeedrunStudioError("contract", "EmptyContract", "The generated synth exposed no public parameters.");
    }
    return {
        intakeOptions: { currentContract, inputEndpoints },
        catalog,
        webRootURL,
        engineModuleURL,
        workerURL: new URL("patch_gui/speedrun-checkpoint-worker.js", webRootURL),
    };
}
