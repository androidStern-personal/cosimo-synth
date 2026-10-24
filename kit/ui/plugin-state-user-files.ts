import { sha256 } from "./sha256";
import type { PluginStateFields } from "./plugin-state-definition";
import type { createPluginStateClient } from "./plugin-state-client";

type Client = ReturnType<typeof createPluginStateClient<PluginStateFields>>;

/** The per-user file store the Cmajor WebView provides as `window.chocUserFiles`. */
interface UserFiles {
    list(scope: string): Promise<string[]>;
    read(scope: string, fileName: string): Promise<string>;
    write(scope: string, fileName: string, contents: string): Promise<unknown>;
}

function installedUserFiles(): UserFiles | null {
    const candidate: unknown = Reflect.get(globalThis, "chocUserFiles");
    if (typeof candidate !== "object" || candidate === null) return null;
    const { list, read, write } = candidate as Record<string, unknown>;
    return typeof list === "function" && typeof read === "function" && typeof write === "function"
        ? candidate as UserFiles : null;
}

/** The plugin's permanent identity from its Cmajor manifest, or null when the view has none. */
export function pluginManifestId(manifest: unknown): string | null {
    if (typeof manifest !== "object" || manifest === null) return null;
    const id: unknown = Reflect.get(manifest, "ID");
    return typeof id === "string" && id.length > 0 ? id : null;
}

/** A hashed folder name keeps any manifest ID safe on case-insensitive disks and within file-name limits. */
export function userFilesScope(pluginId: string): string {
    return `plugin-${sha256(pluginId)}`;
}

const describe = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * Keep user-lifetime fields in the user's files, one JSON file per field.
 *
 * The state owner holds each value for the session. This GUI-side bridge loads the saved
 * copy into a session that has not changed the field yet, and saves every later accepted
 * change. Without the file store (browser preview, tests) the value stays in memory.
 */
export function syncUserLifetimeFields(definition: PluginStateFields, client: Client, pluginId: string | null,
    onDefect: (error: unknown) => void): () => void {
    const keys = Object.keys(definition).filter(key => {
        const field = definition[key];
        return field?.kind === "stored" && field.lifetime === "user";
    });
    const files = installedUserFiles();
    if (keys.length === 0 || !files || !pluginId) return () => {};
    const scope = userFilesScope(pluginId);
    let stopped = false;
    const report = (message: string) => (error: unknown) => {
        if (!stopped) onDefect(new Error(`${message}: ${describe(error)}`));
    };
    // The JSON last known to be on disk, per field key; set once its load settles.
    const saved = new Map<string, string>();
    /** The accepted value as file text; an unconfirmed draft is never saved. */
    const encoded = (key: string): string | undefined => {
        const field = definition[key], snapshot = client.getSnapshot();
        if (field?.kind !== "stored" || snapshot.kind !== "ready" || snapshot.draftFields.includes(key)) return undefined;
        const current = snapshot.state.fields[key];
        return current?.readiness.kind === "ready" && "value" in current ? JSON.stringify(field.codec.encode(current.value)) : undefined;
    };
    const save = () => {
        for (const [key, previous] of saved) {
            const text = encoded(key);
            if (text === undefined || text === previous) continue;
            saved.set(key, text);
            files.write(scope, `${key}.json`, text).catch(report(`Could not save "${key}" to the user's files`));
        }
    };
    const unsubscribe = client.subscribe(save);
    const waiting = new Set<() => void>();
    /** The field's accepted version once the GUI is attached, or null if the view closes first. */
    const attachedVersion = (key: string) => new Promise<number | null>(resolve => {
        const check = () => {
            const snapshot = client.getSnapshot();
            const field = snapshot.kind === "ready" ? snapshot.state.fields[key] : undefined;
            const version = field?.readiness.kind === "ready" && "version" in field ? field.version : undefined;
            if (!stopped && version === undefined && snapshot.kind !== "closed" && snapshot.kind !== "failed") return;
            waiting.delete(check);
            remove();
            resolve(stopped ? null : version ?? null);
        };
        waiting.add(check);
        const remove = client.subscribe(check);
        check();
    });
    const load = async (key: string, names: readonly string[]) => {
        const field = definition[key];
        if (field?.kind !== "stored") return;
        const fileName = `${key}.json`;
        const text = names.includes(fileName) ? await files.read(scope, fileName) : undefined;
        const version = await attachedVersion(key);
        // A later version means this session already holds a newer value than the file.
        if (text === undefined || version !== 0) return;
        const parsed = field.codec.parse(JSON.parse(text));
        if (parsed.kind === "error") throw new Error(`the saved file is invalid: ${parsed.message}`);
        await client.dispatch({ kind: "edit", key, value: field.codec.encode(parsed.value), expectedVersion: 0 });
    };
    void files.list(scope).then(names => Promise.all(keys.map(key => load(key, names)
        .catch(report(`Could not load "${key}" from the user's files`))
        .finally(() => {
            // Until the value changes, the file keeps what it had, even if it could not be read.
            const text = encoded(key);
            if (text !== undefined) saved.set(key, text);
        }))), report("Could not read the user's files"));
    return () => {
        stopped = true;
        unsubscribe();
        for (const check of [...waiting]) check();
    };
}
