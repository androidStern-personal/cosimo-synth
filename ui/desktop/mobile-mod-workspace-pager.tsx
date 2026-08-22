/**
 * T14: the compact Mod workspace's two top-level panels — SOURCE and
 * MAPPINGS — on the ONE segmented selector + directional slide the Voice
 * A/B/C bar uses. First visit in an instance opens SOURCE; later visits
 * restore the instance's last panel (sessionStorage, the same scope as the
 * primary shell's workspace-state contract — UI preference, never sound
 * state).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
    SegmentedEditorTabs,
    useDirectionalPanelTransition,
} from "../shared/segmented-editor-tabs";

/** Stable identities for the two compact Mod workspace panels. */
export type MobileModPanelId = "source" | "mappings";

/** Session-scoped presentation-state key for the selected Mod panel. */
export const MOD_WORKSPACE_PANEL_STORAGE_KEY = "cosimo.mod-workspace-panel.v1";

const PANEL_ORDER: ReadonlyArray<MobileModPanelId> = ["source", "mappings"];

function parseStoredPanel(raw: string | null): MobileModPanelId | null {
    return raw === "source" || raw === "mappings" ? raw : null;
}

export function MobileModWorkspacePager({
    sourcePanel,
    mappingsPanel,
    focusSourceSerial = 0,
    onPanelChange,
}: {
    sourcePanel: ReactNode;
    mappingsPanel: ReactNode;
    /** Bumps when the floating bar selects a source while Mod is open: the
        pager switches to SOURCE (T14) without a slide (programmatic). */
    focusSourceSerial?: number;
    onPanelChange?: (panel: MobileModPanelId) => void;
}) {
    const [panel, setPanel] = useState<MobileModPanelId>(() => (
        parseStoredPanel(sessionStorage.getItem(MOD_WORKSPACE_PANEL_STORAGE_KEY)) ?? "source"
    ));
    useEffect(() => {
        sessionStorage.setItem(MOD_WORKSPACE_PANEL_STORAGE_KEY, panel);
        onPanelChange?.(panel);
    }, [onPanelChange, panel]);

    useEffect(() => {
        if (focusSourceSerial > 0) {
            setPanel("source");
        }
    }, [focusSourceSerial]);

    const transition = useDirectionalPanelTransition({
        order: PANEL_ORDER,
        activeId: panel,
    });
    const beginTabTransition = transition.beginTabTransition;
    const selectPanel = useCallback((id: MobileModPanelId) => {
        beginTabTransition(id);
        setPanel(id);
    }, [beginTabTransition]);

    return (
        <div data-role="mobile-mod-workspace-pager" className="mobile-mod-workspace-pager">
            <SegmentedEditorTabs
                tabs={[
                    {
                        id: "source",
                        label: "SOURCE",
                        ariaLabel: "Show the source editor panel",
                        dataRole: "mobile-mod-panel-tab-source",
                    },
                    {
                        id: "mappings",
                        label: "MAPPINGS",
                        ariaLabel: "Show the mappings panel",
                        dataRole: "mobile-mod-panel-tab-mappings",
                    },
                ]}
                activeId={panel}
                ariaLabel="Mod workspace panels"
                dataRole="mobile-mod-panel-tabs"
                onSelect={selectPanel}
            />
            <div ref={transition.viewportRef} className="mobile-voice-panel-viewport">
                <div
                    ref={transition.panelRef}
                    className="mobile-voice-panel-live"
                    data-role={`mobile-mod-panel-${panel}`}
                >
                    {panel === "source" ? sourcePanel : mappingsPanel}
                </div>
            </div>
        </div>
    );
}
