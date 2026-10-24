import { usePluginState, type PluginStateControl } from "../../../kit/index";
import definition from "../state";

type SoundKey = "frequency" | "q" | "routing" | "amount" | "sideAmount" | "character" | "intensity" | "shape";
/** The eight sound controls, by their state field names. */
export type SoundControls = { readonly [Key in SoundKey]: PluginStateControl<number> };
/** The eight sound values, by their state field names. */
export type Sound = { readonly [Key in SoundKey]: number };

const valueOf = (control: PluginStateControl<number>) => "value" in control.state ? control.state.value : null;

/** Every sound control, and the sound itself once the plugin has reported all eight values. */
export function useSound(): { readonly controls: SoundControls; readonly sound: Sound | null } {
    const controls: SoundControls = {
        frequency: usePluginState(definition.frequency),
        q: usePluginState(definition.q),
        routing: usePluginState(definition.routing),
        amount: usePluginState(definition.amount),
        sideAmount: usePluginState(definition.sideAmount),
        character: usePluginState(definition.character),
        intensity: usePluginState(definition.intensity),
        shape: usePluginState(definition.shape),
    };
    const frequency = valueOf(controls.frequency), q = valueOf(controls.q), routing = valueOf(controls.routing),
        amount = valueOf(controls.amount), sideAmount = valueOf(controls.sideAmount), character = valueOf(controls.character),
        intensity = valueOf(controls.intensity), shape = valueOf(controls.shape);
    if (frequency === null || q === null || routing === null || amount === null || sideAmount === null
        || character === null || intensity === null || shape === null)
        return { controls, sound: null };
    return { controls, sound: { frequency, q, routing, amount, sideAmount, character, intensity, shape } };
}
