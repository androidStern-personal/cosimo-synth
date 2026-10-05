import { useCallback, useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import css from "./preset-bar.css?inline";
import type { PluginStateFields } from "./plugin-state-definition";
import { usePresets, type PresetActionResult } from "./presets";
import { retainStyles } from "./styles";

type Form = { readonly mode: "save-as" | "rename" | "paste"; readonly text: string };
type Notice = { readonly kind: "status" | "error"; readonly text: string } | null;

export interface PresetBarProps {
    /** The plugin's state definition; it must spread `presets()`. */
    readonly definition: PluginStateFields;
    readonly className?: string;
}

/**
 * Choose, save and manage presets. Recalling or reverting is one Undo entry; library changes
 * are not undoable. Colors follow the shared `--editor-accent-start` and `--editor-surface-bg` properties.
 */
export function PresetBar({ definition, className = "" }: PresetBarProps) {
    const presets = usePresets(definition);
    const attach = useCallback((node: HTMLDivElement | null) => node ? retainStyles(node, "preset-bar", css) : undefined, []);
    const [form, setForm] = useState<Form | null>(null);
    const [menu, setMenu] = useState<"closed" | "open" | "confirm-delete">("closed");
    const [notice, setNotice] = useState<Notice>(null);
    const menuId = useId();
    const ready = presets.status === "ready";
    const { active } = presets;
    const activeIsUser = active !== null && presets.user.some(preset => preset.id === active.id);
    const activeIsListed = activeIsUser || (active !== null && presets.factory.some(preset => preset.id === active.id));

    const run = async (action: () => Promise<PresetActionResult>) => {
        setNotice(null);
        setMenu("closed");
        const result = await action();
        if (result.kind === "done") setForm(null);
        else setNotice({ kind: "error", text: result.message });
        return result;
    };
    const copy = async () => {
        setMenu("closed");
        const exported = presets.exportJson();
        if (exported.kind === "failed") { setNotice({ kind: "error", text: exported.message }); return; }
        try {
            await navigator.clipboard.writeText(exported.text);
            setNotice({ kind: "status", text: "Copied" });
        } catch {
            setNotice({ kind: "error", text: "This host blocked the clipboard. Allow clipboard access, then copy again." });
        }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!form) return;
        if (form.mode === "save-as") void run(() => presets.save(form.text));
        else if (form.mode === "rename" && active) void run(() => presets.rename(active.id, form.text));
        else if (form.mode === "paste") void run(() => presets.importJson(form.text));
    };
    const open = (mode: Form["mode"]) => {
        setNotice(null);
        setMenu("closed");
        setForm({ mode, text: mode === "rename" ? active?.name ?? "" : "" });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || (!form && menu === "closed")) return;
        event.preventDefault();
        if (form) setForm(null);
        else setMenu("closed");
    };
    const message = notice?.kind === "error" ? notice.text : presets.status === "unavailable" ? presets.error : null;
    // A confirmation floats over the plugin, so it leaves by itself.
    useEffect(() => {
        if (notice?.kind !== "status") return;
        const timer = setTimeout(() => setNotice(null), 2000);
        return () => clearTimeout(timer);
    }, [notice]);

    return <div ref={attach} className={`bk-preset-bar ${className}`} role="group" aria-label="Presets" onKeyDown={closeOnEscape}>
        {form ? <form className="bk-preset-bar-form" onSubmit={submit}>
            <label>{form.mode === "paste" ? "Preset JSON" : "Preset name"}
                <input autoFocus value={form.text} onChange={event => setForm({ ...form, text: event.currentTarget.value })} />
            </label>
            <button type="submit">{form.mode === "paste" ? "Add preset" : "Save"}</button>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
        </form> : <>
            <select aria-label="Preset" value={active?.id ?? ""} disabled={!ready}
                onChange={event => { const id = event.currentTarget.value; void run(() => presets.recall(id)); }}>
                {active === null && <option value="" disabled>No preset</option>}
                {active !== null && !activeIsListed && <option value={active.id} disabled>{active.name} (deleted)</option>}
                {presets.factory.length > 0 && <optgroup label="Factory">
                    {presets.factory.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </optgroup>}
                {presets.user.length > 0 && <optgroup label="User">
                    {presets.user.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </optgroup>}
            </select>
            {presets.dirty && <span className="bk-preset-bar-dirty"><span aria-hidden="true">● </span>Modified</span>}
            <button type="button" disabled={!ready || !activeIsUser || !presets.dirty} onClick={() => { void run(presets.update); }}>Save</button>
            <button type="button" disabled={!ready} onClick={() => open("save-as")}>Save as new</button>
            <button type="button" disabled={!ready || !presets.dirty} onClick={() => { void run(presets.revert); }}>Revert</button>
            <div className="bk-preset-bar-more">
                <button type="button" aria-expanded={menu !== "closed"} aria-controls={menuId} disabled={!ready}
                    onClick={() => setMenu(menu === "closed" ? "open" : "closed")}>More</button>
                {menu !== "closed" && <div id={menuId} className="bk-preset-bar-menu" role="group" aria-label="More preset actions">
                    {menu === "confirm-delete" && active ? <>
                        <p>Delete “{active.name}”? This cannot be undone.</p>
                        <button type="button" onClick={() => { void run(() => presets.remove(active.id)); }}>Delete preset</button>
                        <button type="button" onClick={() => setMenu("open")}>Keep preset</button>
                    </> : <>
                        <button type="button" disabled={!activeIsUser} onClick={() => open("rename")}>Rename</button>
                        <button type="button" disabled={!activeIsListed} onClick={() => { if (active) void run(() => presets.duplicate(active.id)); }}>Duplicate</button>
                        <button type="button" disabled={!activeIsUser} onClick={() => setMenu("confirm-delete")}>Delete</button>
                        <button type="button" onClick={() => { void copy(); }}>Copy JSON</button>
                        <button type="button" onClick={() => open("paste")}>Paste JSON</button>
                    </>}
                </div>}
            </div>
        </>}
        {notice?.kind === "status" && <p className="bk-preset-bar-note" role="status">{notice.text}</p>}
        {message && <div className="bk-preset-bar-note bk-preset-bar-error" role="alert">
            {message}
            {notice?.kind === "error" && <button type="button" onClick={() => setNotice(null)}>Dismiss</button>}
        </div>}
    </div>;
}
