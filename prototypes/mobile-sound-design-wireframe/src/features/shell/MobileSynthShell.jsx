import { useRef, useState } from "react";
import {
  FadersHorizontal,
  List,
  WaveSine,
} from "@phosphor-icons/react";
import { TransientValueHUD } from "../../design-system/TransientValueHUD.jsx";

const WORKSPACE_ICONS = {
  effects: FadersHorizontal,
  voice: WaveSine,
};

function WorkspaceGlyph({ workspace, size }) {
  const Icon = WORKSPACE_ICONS[workspace?.id] || workspace?.icon || WaveSine;
  return <Icon aria-hidden="true" size={size} weight="regular" />;
}

/**
 * The persistent iPhone frame. All product state stays outside this component;
 * it only owns the five fixed shell regions and their border ownership.
 */
export function MobileSynthShell({
  audition,
  children,
  className = "",
  header,
  rack,
  readout = "",
  sourceShelf,
  style,
}) {
  return (
    <main
      className={`cosimo-ui cosimo-mobile-shell cosimo-synth-shell ${className}`.trim()}
      data-cosimo-ui
      style={style}
    >
      <TransientValueHUD className="cosimo-global-hud" value={readout} />
      <div className="cosimo-shell-region cosimo-synth-shell__header" data-shell-region="header">
        {header}
      </div>
      <div className="cosimo-shell-region cosimo-synth-shell__rack" data-shell-region="rack">
        {rack}
      </div>
      <div className="cosimo-shell-region cosimo-synth-shell__workspace" data-shell-region="workspace">
        {children}
      </div>
      <div className="cosimo-shell-region cosimo-synth-shell__sources" data-shell-region="sources">
        {sourceShelf}
      </div>
      <div className="cosimo-shell-region cosimo-synth-shell__audition" data-shell-region="audition">
        {audition}
      </div>
    </main>
  );
}

export function WorkspaceCarousel({
  activeWorkspaceId,
  onWorkspaceChange,
  workspaces,
}) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const activeIndex = Math.max(
    0,
    workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId),
  );
  const activeWorkspace = workspaces[activeIndex];
  const previousWorkspace = workspaces[
    (activeIndex - 1 + workspaces.length) % workspaces.length
  ];
  const nextWorkspace = workspaces[(activeIndex + 1) % workspaces.length];

  const finishSwipe = (event, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const delta = event.clientX - current.startX;
    if (!cancelled && Math.abs(delta) >= 24) {
      suppressClick.current = true;
      onWorkspaceChange?.(delta > 0 ? previousWorkspace.id : nextWorkspace.id);
    }
    gesture.current = null;
    setDragOffset(0);
  };

  return (
    <div
      aria-label={`${activeWorkspace.label} workspace carousel`}
      className="cosimo-workspace-carousel"
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerCancel={(event) => finishSwipe(event, true)}
      onPointerDown={(event) => {
        const startedOnButton = Boolean(event.target.closest?.("button"));
        gesture.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startedOnButton,
        };
        if (!startedOnButton) event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const delta = Math.max(-44, Math.min(44, event.clientX - current.startX));
        setDragOffset(delta);
      }}
      onPointerUp={finishSwipe}
      role="group"
      style={{ "--cosimo-workspace-drag": `${dragOffset}px` }}
    >
      <button
        aria-label={`Previous workspace: ${previousWorkspace.label}`}
        className="cosimo-workspace-carousel__neighbor"
        onClick={() => onWorkspaceChange?.(previousWorkspace.id)}
        type="button"
      >
        <WorkspaceGlyph size={18} workspace={previousWorkspace} />
      </button>
      <div
        aria-current="page"
        aria-label={activeWorkspace.label}
        className="cosimo-workspace-carousel__current"
        role="img"
      >
        <WorkspaceGlyph size={27} workspace={activeWorkspace} />
      </div>
      <button
        aria-label={`Next workspace: ${nextWorkspace.label}`}
        className="cosimo-workspace-carousel__neighbor"
        onClick={() => onWorkspaceChange?.(nextWorkspace.id)}
        type="button"
      >
        <WorkspaceGlyph size={18} workspace={nextWorkspace} />
      </button>
    </div>
  );
}

export function InstrumentHeader({
  activeWorkspaceId,
  isPatchDirty = false,
  onPatchMenu,
  onPatchName,
  onWorkspaceChange,
  patchName,
  workspaces = [
    { id: "voice", label: "Voice / Oscillator" },
    { id: "effects", label: "Effects" },
  ],
}) {
  return (
    <header className="cosimo-instrument-header">
      <button
        aria-label={`Patch: ${patchName}${isPatchDirty ? ", modified" : ""}`}
        className="cosimo-instrument-header__patch cosimo-type-navigation"
        onClick={onPatchName}
        type="button"
      >
        <span className="cosimo-instrument-header__patch-name">{patchName}</span>
        {isPatchDirty && <span aria-hidden="true">*</span>}
      </button>
      <WorkspaceCarousel
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        workspaces={workspaces}
      />
      <button
        aria-label="Open patch menu"
        className="cosimo-instrument-header__menu cosimo-type-navigation"
        onClick={onPatchMenu}
        type="button"
      >
        <span>Menu</span>
        <List aria-hidden="true" size={22} weight="regular" />
      </button>
    </header>
  );
}
