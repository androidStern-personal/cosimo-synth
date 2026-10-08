import { useCallback } from "react";
import css from "./snapshot-bar.css?inline";
import type { PluginStateFields } from "./plugin-state-definition";
import { useSnapshots } from "./use-snapshots";
import { retainStyles } from "./styles";

export interface SnapshotBarProps {
    /** The plugin's state definition; it must spread `snapshots()`. */
    readonly definition: PluginStateFields;
    readonly className?: string;
}

/**
 * One button per snapshot slot. Selecting a slot is one Undo entry; a dot marks slots that
 * hold a sound. Colors follow the shared `--editor-accent-start` and `--editor-surface-bg` properties.
 */
export function SnapshotBar({ definition, className = "" }: SnapshotBarProps) {
    const snapshots = useSnapshots(definition);
    const attach = useCallback((node: HTMLDivElement | null) => node ? retainStyles(node, "snapshot-bar", css) : undefined, []);
    const ready = snapshots.status === "ready";
    const { active } = snapshots;
    return <div ref={attach} className={`bk-snapshot-bar ${className}`} role="group" aria-label="Snapshots">
        {snapshots.slots.map(slot => <button key={slot.id} type="button" className="bk-snapshot-slot"
            aria-pressed={active === slot.id} data-filled={slot.filled ? "" : undefined} disabled={!ready}
            aria-label={slot.filled ? `Snapshot ${slot.id}` : `Snapshot ${slot.id}, empty`}
            onClick={() => { void snapshots.select(slot.id); }}>{slot.id}</button>)}
        <button type="button" className="bk-snapshot-clear" disabled={!ready || active === null}
            aria-label={active === null ? "Clear snapshot" : `Clear snapshot ${active}`}
            onClick={() => { if (active !== null) void snapshots.clear(active); }}>Clear</button>
        {snapshots.error && <p className="bk-snapshot-bar-error" role="alert">{snapshots.error}</p>}
    </div>;
}
