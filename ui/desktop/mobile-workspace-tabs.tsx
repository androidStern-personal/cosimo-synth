import { SegmentedEditorTabs } from "../shared/segmented-editor-tabs";
import { WORKSPACE_TAB_IDS, type WorkspaceTabId } from "../shared/workspace-shell";

const TAB_LABELS: Readonly<Record<WorkspaceTabId, string>> = {
    voice: "VOICE",
    fx: "FX",
    mod: "MOD",
};

/**
 * The persistent Voice/FX/Mod tab row (ADR-026): one restrained strip of three
 * equal neutral items with a short underline on the active item. Sits
 * immediately above the sticky keyboard and becomes the bottom dock when the
 * keyboard hides. Tapping the active tab is meaningful (return-to-main or
 * scroll-to-top), so it stays clickable.
 *
 * This was a hand-written second tab dialect — its own markup, its own
 * keyboard handling and its own `.mobile-workspace-tab*` styles, all
 * duplicating SegmentedEditorTabs. It is now a label map over the primitive.
 */
export function MobileWorkspaceTabs({
    activeTab,
    onActivateTab,
    onTapActiveTab,
}: {
    activeTab: WorkspaceTabId;
    onActivateTab: (tab: WorkspaceTabId) => void;
    onTapActiveTab: () => void;
}) {
    return (
        <SegmentedEditorTabs
            tabs={WORKSPACE_TAB_IDS.map((tab) => ({
                id: tab,
                label: TAB_LABELS[tab],
                ariaLabel: TAB_LABELS[tab],
                domId: `mobile-workspace-tab-${tab}`,
                ariaControls: `mobile-workspace-panel-${tab}`,
                dataRole: `mobile-workspace-tab-${tab}`,
                dataDragDwell: `workspace-tab:${tab}`,
                onActiveTap: onTapActiveTab,
            }))}
            activeId={activeTab}
            ariaLabel="Primary workspaces"
            dataRole="mobile-workspace-tabs"
            onSelect={onActivateTab}
            activationMode="manual"
            dock="top"
            neutral
        />
    );
}
