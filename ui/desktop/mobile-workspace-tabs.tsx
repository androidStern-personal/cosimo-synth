import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { WORKSPACE_TAB_IDS, type WorkspaceTabId } from "../shared/workspace-shell";

const TAB_LABELS: Readonly<Record<WorkspaceTabId, string>> = {
    voice: "VOICE",
    fx: "FX",
    mod: "MOD",
};

/**
 * The persistent Voice/FX/Mod tab row (ADR-026): one restrained 40px strip of
 * three equal neutral items with a short underline on the active item. Sits
 * immediately above the sticky keyboard and becomes the bottom dock when the
 * keyboard hides. Tapping the active tab is meaningful (return-to-main or
 * scroll-to-top), so it stays clickable.
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
    const tabRefs = useRef(new Map<WorkspaceTabId, HTMLButtonElement>());

    const focusTab = (tab: WorkspaceTabId) => {
        tabRefs.current.get(tab)?.focus();
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: WorkspaceTabId) => {
        const index = WORKSPACE_TAB_IDS.indexOf(tab);
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusTab(WORKSPACE_TAB_IDS[(index + WORKSPACE_TAB_IDS.length - 1) % WORKSPACE_TAB_IDS.length]);
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            focusTab(WORKSPACE_TAB_IDS[(index + 1) % WORKSPACE_TAB_IDS.length]);
            return;
        }
        if (event.key === "Home") {
            event.preventDefault();
            focusTab(WORKSPACE_TAB_IDS[0]);
            return;
        }
        if (event.key === "End") {
            event.preventDefault();
            focusTab(WORKSPACE_TAB_IDS[WORKSPACE_TAB_IDS.length - 1]);
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (tab === activeTab) {
                onTapActiveTab();
            } else {
                onActivateTab(tab);
            }
        }
    };

    return (
        <nav
            role="tablist"
            aria-label="Primary workspaces"
            data-role="mobile-workspace-tabs"
            className="mobile-workspace-tabs"
        >
            {WORKSPACE_TAB_IDS.map((tab) => {
                const isSelected = tab === activeTab;
                return (
                    <button
                        key={tab}
                        ref={(element) => {
                            if (element) {
                                tabRefs.current.set(tab, element);
                            } else {
                                tabRefs.current.delete(tab);
                            }
                        }}
                        type="button"
                        role="tab"
                        id={`mobile-workspace-tab-${tab}`}
                        data-role={`mobile-workspace-tab-${tab}`}
                        data-drag-dwell={`workspace-tab:${tab}`}
                        className={`mobile-workspace-tab${isSelected ? " is-active" : ""}`}
                        aria-selected={isSelected}
                        aria-controls={`mobile-workspace-panel-${tab}`}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => {
                            if (isSelected) {
                                onTapActiveTab();
                            } else {
                                onActivateTab(tab);
                            }
                        }}
                        onKeyDown={(event) => handleKeyDown(event, tab)}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                );
            })}
        </nav>
    );
}
