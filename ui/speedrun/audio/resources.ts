import { OSCILLATOR_IDS } from "../../shared/modulation-targets";
import {
    createPatchConnectionResourceClient,
    type ResourceClient,
    type ResourceAudioData,
} from "../../../kit/ui/resource-client";
import {
    loadFactoryBankCatalog,
    type FactoryBankCatalog,
} from "../../shared/wavetable-bank";
import type { CumulativePatchState } from "../partial-states";

const CATALOG_PATH = "assets/factory-bank-catalog.json";

export type SpeedrunWavetableResourceBundle = {
    readonly catalog: FactoryBankCatalog;
    readonly audioByPath: Readonly<Record<string, ResourceAudioData>>;
};

function selectedTableIndices(states: ReadonlyArray<CumulativePatchState>) {
    return new Set(states.flatMap((state) => OSCILLATOR_IDS.map((oscillator) => (
        Math.round(Number(state.parameters[`osc${oscillator}WavetableSelect`]) || 0)
    ))));
}

/** Fetch and decode each selected source once before virtual-time install begins. */
export async function prefetchSpeedrunWavetableResources(
    states: ReadonlyArray<CumulativePatchState>,
    resourceBaseURL: string | URL,
): Promise<SpeedrunWavetableResourceBundle> {
    const resources = createPatchConnectionResourceClient({}, { patchRoot: new URL("./", resourceBaseURL) });
    const catalog = await loadFactoryBankCatalog(resources, { catalogPath: CATALOG_PATH });
    const sourcePaths = [...selectedTableIndices(states)].map((tableIndex) => {
        const table = catalog.tables[tableIndex];
        if (!table) throw new Error(`Speedrun wavetable ${tableIndex} is outside the factory catalog.`);
        return table.sourceWav;
    });
    const audioByPath = Object.fromEntries(await Promise.all(
        [...new Set(sourcePaths)].map(async (sourcePath) => [sourcePath, await resources.readAudio(sourcePath)] as const),
    ));
    return { catalog, audioByPath };
}

export function createSpeedrunResourceClient(
    bundle: SpeedrunWavetableResourceBundle,
): ResourceClient {
    return {
        async readText(path: string) {
            if (path !== CATALOG_PATH) throw new Error(`Speedrun resource bundle has no text ${path}.`);
            return JSON.stringify(bundle.catalog);
        },
        async readJSON<T>(path: string) {
            if (path !== CATALOG_PATH) throw new Error(`Speedrun resource bundle has no JSON ${path}.`);
            return bundle.catalog as T;
        },
        async readBytes(path: string) {
            throw new Error(`Speedrun resource bundle does not expose undecoded bytes for ${path}.`);
        },
        async readAudio(path: string) {
            const audio = bundle.audioByPath[path];
            if (!audio) throw new Error(`Speedrun resource bundle has no audio ${path}.`);
            return audio;
        },
        getURL() {
            return null;
        },
    };
}
