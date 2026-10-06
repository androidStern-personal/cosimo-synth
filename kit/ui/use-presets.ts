import { useState } from "react";
import { soundFieldKeys, type PluginStateFields, type PluginStateJson, type PluginStateStored, type PluginStateValueResult } from "./plugin-state-definition";
import { usePluginState, usePluginStateSnapshot } from "./plugin-state-react";
import { useOptionalPatchConnection } from "./cmajor-react";
import { pluginManifestId } from "./plugin-state-user-files";
import {
    editOutcome, factoryValues, parsePresetFile, presetFileText, sameSoundValue, soundChanges,
    type Preset, type PresetActionResult, type PresetLibraryField, type SoundValues,
} from "./presets";

/** A fresh id that no factory preset or earlier user preset shares. */
function newPresetId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return `user-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

const failed = (message: string): PresetActionResult => ({ kind: "failed", message });

/** Availability shared by the preset and snapshot hooks. */
export type SoundLibraryStatus = "loading" | "ready" | "unavailable";

/** The rendered sound: accepted values, and the same values in saved form. */
export type CurrentSound =
    | { readonly status: "loading" | "unavailable" }
    | { readonly status: "ready"; readonly values: Readonly<Record<string, unknown>>; readonly saved: SoundValues };

// Accepted values are immutable, so each value object is encoded once per field, however
// often the preset and snapshot bars render. Large documents would otherwise be re-encoded
// on every render of every bar.
const savedForms = new WeakMap<PluginStateStored<unknown>, WeakMap<object, PluginStateJson>>();
function savedForm(field: PluginStateStored<unknown>, value: unknown): PluginStateJson {
    if (typeof value !== "object" || value === null) return field.codec.encode(value);
    let forField = savedForms.get(field);
    if (!forField) savedForms.set(field, forField = new WeakMap());
    let saved = forField.get(value);
    if (saved === undefined) forField.set(value, saved = field.codec.encode(value));
    return saved;
}

/** Read every sound field from the rendered state. */
export function useCurrentSound(definition: PluginStateFields): CurrentSound {
    const snapshot = usePluginStateSnapshot();
    if (!snapshot) return { status: "loading" };
    const values: Record<string, unknown> = {}, saved: Record<string, PluginStateJson> = {};
    for (const key of soundFieldKeys(definition)) {
        const field = definition[key], current = snapshot.fields[key];
        if (!field || !current || current.readiness.kind === "pending") return { status: "loading" };
        if (current.readiness.kind === "failed" || !("value" in current)) return { status: "unavailable" };
        values[key] = current.value;
        saved[key] = field.kind === "parameter" ? Number(current.value) : savedForm(field, current.value);
    }
    return { status: "ready", values, saved: Object.freeze(saved) };
}

/** Remember the last action's failure for display; a later success clears it. */
export function useActionError() {
    const [error, setError] = useState<string | null>(null);
    const settle = (result: PresetActionResult) => { setError(result.kind === "failed" ? result.message : null); return result; };
    return { error, settle };
}

export interface PresetSummary {
    readonly id: string;
    readonly name: string;
}

/** The preset lists, state and actions that `PresetBar` is built on, for a custom preset interface to use as well. */
export interface Presets {
    readonly status: SoundLibraryStatus;
    /** The last action's failure, or a reason the presets are unavailable. */
    readonly error: string | null;
    readonly factory: readonly PresetSummary[];
    readonly user: readonly PresetSummary[];
    /** The project's preset, which may since have been deleted from the user library. */
    readonly active: PresetSummary | null;
    /** True when the current sound differs from the active preset. */
    readonly dirty: boolean;
    /** Load a preset's sound as one Undo entry. */
    recall(id: string): Promise<PresetActionResult>;
    /** Save the current sound as a new user preset and make it active. */
    save(name: string): Promise<PresetActionResult>;
    /** Overwrite the active user preset with the current sound. */
    update(): Promise<PresetActionResult>;
    rename(id: string, name: string): Promise<PresetActionResult>;
    remove(id: string): Promise<PresetActionResult>;
    duplicate(id: string): Promise<PresetActionResult>;
    /** Return to the active preset's sound as one Undo entry. */
    revert(): Promise<PresetActionResult>;
    /** A preset file for one preset, or for the current sound when `id` is omitted. */
    exportJson(id?: string): { readonly kind: "done"; readonly text: string } | { readonly kind: "failed"; readonly message: string };
    /** Add a preset file to the user library without loading it. */
    importJson(text: string): Promise<PresetActionResult>;
    /**
     * Load a preset file's sound as one Undo entry. Afterwards no preset is active, because the
     * loaded sound is not in the library.
     */
    loadJson(text: string): Promise<PresetActionResult>;
}

function isPresetLibraryField(field: unknown): field is PresetLibraryField {
    return typeof field === "object" && field !== null && Reflect.get(field, "kind") === "stored" && Array.isArray(Reflect.get(field, "factory"));
}

const presetName = (name: string): PluginStateValueResult<string> => {
    const trimmed = name.trim();
    return trimmed.length === 0 ? { kind: "error", message: "Enter a preset name." }
        : trimmed.length > 80 ? { kind: "error", message: "Use a preset name of 80 characters or fewer." } : { kind: "ok", value: trimmed };
};

/** Presets for a definition that spreads `presets()`. */
export function usePresets(definition: PluginStateFields): Presets {
    const libraryField = definition.presetLibrary, activeField = definition.activePreset;
    if (!isPresetLibraryField(libraryField) || activeField?.kind !== "stored")
        throw new Error("usePresets needs presets in the plugin state. Spread presets({ factory }) into definePluginState.");
    const editor = usePluginState(definition);
    const libraryControl = usePluginState(libraryField);
    // SAFETY: activePreset is the field presets() declares with this value type.
    const activeControl = usePluginState(activeField as PluginStateStored<Preset | null>);
    const sound = useCurrentSound(definition);
    const plugin = pluginManifestId(useOptionalPatchConnection()?.manifest);
    const { error, settle } = useActionError();

    const factory = libraryField.factory.map(preset => ({ id: preset.id, name: preset.name, values: factoryValues(definition, preset) }));
    const library = "value" in libraryControl.state ? libraryControl.state.value : null;
    const active = "value" in activeControl.state ? activeControl.state.value : null;
    const userPresets = library?.presets ?? [];
    const controlsReady = library !== null && "value" in activeControl.state;
    const status: SoundLibraryStatus = sound.status === "ready" && controlsReady ? "ready"
        : sound.status === "unavailable" || libraryControl.state.status === "invalid" || libraryControl.state.status === "unavailable"
            || activeControl.state.status === "invalid" || activeControl.state.status === "unavailable" ? "unavailable" : "loading";
    const unavailableReason = status === "unavailable" ? libraryControl.error?.message ?? activeControl.error?.message ?? "Presets are unavailable." : null;
    const find = (id: string) => factory.find(preset => preset.id === id) ?? userPresets.find(preset => preset.id === id);
    const current = sound.status === "ready" ? sound : null;
    const dirty = active !== null && current !== null && Object.entries(active.values).some(([key, value]) => {
        const field = definition[key];
        return field !== undefined && Object.hasOwn(current.values, key) && !sameSoundValue(field, value, current.values[key]);
    });

    const writeLibrary = (presetsList: readonly Preset[], nextActive: Preset | null) =>
        editor.edit({ presetLibrary: { version: 1, presets: presetsList }, activePreset: nextActive }, { history: false }).then(editOutcome);
    /** Replace the sound and the active preset together, as one Undo entry. */
    const load = (values: SoundValues, nextActive: Preset | null) =>
        editor.edit({ ...soundChanges(definition, values), activePreset: nextActive }, { recall: true }).then(editOutcome);
    const userPreset = (id: string) => userPresets.find(preset => preset.id === id);
    const act = async (action: (saved: SoundValues) => PresetActionResult | Promise<PresetActionResult>) => {
        if (status !== "ready" || !current) return settle(failed(unavailableReason ?? "The plugin is still loading. Try again in a moment."));
        return settle(await action(current.saved));
    };
    const readPresetFile = (text: string) => plugin ? parsePresetFile(text, plugin, definition)
        : { kind: "error" as const, message: "This view has no plugin manifest ID, so it cannot read preset files." };
    const exportJson = (id?: string): ReturnType<Presets["exportJson"]> => {
        if (!plugin) return { kind: "failed", message: "This view has no plugin manifest ID, so it cannot write preset files." };
        if (!current) return { kind: "failed", message: "The plugin is still loading. Try again in a moment." };
        const preset = id === undefined ? { name: active?.name ?? "Current sound", values: current.saved } : find(id);
        return preset ? { kind: "done", text: presetFileText(plugin, preset) } : { kind: "failed", message: "That preset no longer exists." };
    };

    return {
        status, error: error ?? unavailableReason,
        factory: factory.map(({ id, name }) => ({ id, name })),
        user: userPresets.map(({ id, name }) => ({ id, name })),
        active: active && { id: active.id, name: active.name },
        dirty,
        recall: id => act(() => {
            const preset = find(id);
            return preset ? load(preset.values, preset) : failed("That preset no longer exists.");
        }),
        save: name => act(saved => {
            const checked = presetName(name);
            if (checked.kind === "error") return failed(checked.message);
            const preset = { id: newPresetId(), name: checked.value, values: saved };
            return writeLibrary([...userPresets, preset], preset);
        }),
        update: () => act(saved => {
            const existing = active && userPreset(active.id);
            if (!existing) return failed(active ? "Factory presets cannot be changed. Use Save as new." : "Choose one of your presets to save over, or use Save as new.");
            const preset = { ...existing, values: saved };
            return writeLibrary(userPresets.map(candidate => candidate.id === preset.id ? preset : candidate), preset);
        }),
        rename: (id, name) => act(() => {
            const checked = presetName(name);
            if (checked.kind === "error") return failed(checked.message);
            if (!userPreset(id)) return failed("Only your own presets can be renamed. Duplicate a factory preset first.");
            return writeLibrary(userPresets.map(existing => existing.id === id ? { ...existing, name: checked.value } : existing),
                active?.id === id ? { ...active, name: checked.value } : active);
        }),
        remove: id => act(() => {
            if (!userPreset(id)) return failed("Only your own presets can be deleted.");
            return writeLibrary(userPresets.filter(existing => existing.id !== id), active?.id === id ? null : active);
        }),
        duplicate: id => act(() => {
            const preset = find(id);
            if (!preset) return failed("That preset no longer exists.");
            return writeLibrary([...userPresets, { id: newPresetId(), name: `${preset.name} copy`, values: preset.values }], active);
        }),
        revert: () => act(() => active ? load(active.values, active) : failed("No preset is active, so there is nothing to revert to.")),
        exportJson,
        importJson: text => act(() => {
            const file = readPresetFile(text);
            return file.kind === "error" ? failed(file.message) : writeLibrary([...userPresets, { id: newPresetId(), ...file.value }], active);
        }),
        loadJson: text => act(() => {
            const file = readPresetFile(text);
            return file.kind === "error" ? failed(file.message) : load(file.value.values, null);
        }),
    };
}
