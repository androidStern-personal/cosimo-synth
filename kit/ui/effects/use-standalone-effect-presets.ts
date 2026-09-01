import { useEffect, useMemo, useState } from "react";
import { usePatchConnection } from "../cmajor-react";
import {
    StandaloneEffectPresetController,
    type StandaloneEffectPresetControllerOptions,
    type StandaloneEffectPresetFilter,
} from "./standalone-effect-presets";

export type UseStandaloneEffectPresetsOptions = Omit<
    StandaloneEffectPresetControllerOptions,
    "effectID" | "patchConnection"
> & {
    initialFilter?: Partial<StandaloneEffectPresetFilter>;
};

export function useStandaloneEffectPresets(
    effectID: string,
    options: UseStandaloneEffectPresetsOptions = {},
) {
    const patchConnection = usePatchConnection();
    const {
        descriptorRegistry,
        factoryPresets,
        storedStateAdapters,
        presetMigrations,
        createPresetID,
        readClipboardText,
        writeClipboardText,
        initialFilter,
    } = options;
    const controller = useMemo(() => new StandaloneEffectPresetController({
        effectID,
        patchConnection,
        descriptorRegistry,
        factoryPresets,
        storedStateAdapters,
        presetMigrations,
        createPresetID,
        readClipboardText,
        writeClipboardText,
    }), [
        createPresetID,
        descriptorRegistry,
        effectID,
        factoryPresets,
        storedStateAdapters,
        presetMigrations,
        patchConnection,
        readClipboardText,
        writeClipboardText,
    ]);
    const [state, setState] = useState(() => controller.getState());
    const mutations = useMemo(() => controller.getMutations(), [controller]);

    useEffect(() => {
        const unsubscribe = controller.subscribe(setState);
        controller.attach();
        setState(controller.getState());

        return () => {
            unsubscribe();
            controller.detach();
        };
    }, [controller]);

    useEffect(() => {
        if (initialFilter) {
            controller.setFilter(initialFilter);
        }
    }, [controller, initialFilter?.query, initialFilter?.source]);

    return {
        state,
        mutations,
        controller,
    };
}
