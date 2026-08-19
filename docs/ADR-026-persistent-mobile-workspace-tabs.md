# ADR-026: Persistent mobile Voice, FX, and Mod tabs

Status: accepted — 2026-08-19

## Context

ADR-017 unified the mobile synth with a Voice / FX / Mod accordion. That removed
separate navigation systems, but the two closed accordion headers permanently consume
vertical space and make the active workspace feel like one section in a document rather
than one of three primary instrument views. The accepted focused Voice editor now needs
the complete content area. A separate in-flight change also makes the sticky keyboard
hideable. The tab shell therefore has to work both with and without the keyboard while
the global Mod bar, deep links, held notes, and per-workspace editing context survive
navigation.

## Decision

### Persistent primary tabs

- Compact layouts use one persistent `Voice / FX / Mod` tab row. It sits immediately
  above the sticky keyboard while the keyboard is visible and becomes the bottom dock,
  above the device safe area, while the keyboard is hidden. The active workspace receives
  all height released by hiding the keyboard.
- The current accordion's top-level `Voice`, `FX`, and `Mod` heading bars are removed.
  The selected tab identifies the active primary workspace; ordinary detail pages retain
  only the contextual title and Back controls that explain the specific thing being edited.
- The supplied screenshot is the visual direction: one restrained dark strip divided
  into three equal-width items, with centered uppercase `VOICE`, `FX`, and `MOD` labels,
  subtle outer rules, and subtle vertical separators. All three items use the same
  neutral treatment; workspace-specific cyan, amber, and magenta tab colors are rejected.
  The active item is distinguished by one short underline and no large fill, glow,
  icon, floating pill, or duplicate heading.
- The simplified preset/Back bar and primary tab row both use one shared 40 px compact-
  shell-row token. This reuses the accepted production Voice oscillator-tab and toolbar
  height, the compact keyboard-button tier, and the approved Mod-widget body width. It
  does not copy the throwaway screenshot's 30 px row, preserve the legacy preset bar's
  38 px literal, or inherit the outgoing accordion/local-Back row's 44 px literal.
- Each tab fills the complete 40 px row. All three use the same neutral label and divider
  treatment; the short active underline uses one shared neutral active color rather than
  changing color by workspace.
- The row is one component in both keyboard states. It remains visually attached to the
  keyboard while the keyboard moves on or off screen, then rests against the bottom safe
  area when the keyboard is fully hidden; it is not cross-faded into a second bottom bar.
- The top edge of the tab row is the lowest usable boundary for the perimeter-docked
  global Mod bar. A bottom-positioned Mod bar sits immediately above the tabs and expands
  upward. Side-positioned bars are constrained above the same boundary. The Mod bar,
  including its expanded drawer, never covers the tabs, keyboard, or bottom safe area.
- If showing the keyboard raises that boundary into a low side-positioned Mod bar, the
  bar slides upward only far enough to clear it. Its user-chosen perimeter position is
  retained separately and restored when the keyboard hides again; this temporary dodge
  must not overwrite the saved position.
- The keyboard and global Mod bar remain mounted while tabs change. Switching tabs does
  not interrupt held notes, audio, the selected oscillator/effect/source, or stored
  musical state.
- Each workspace remains mounted but inactive and noninteractive while hidden. It keeps
  its selected item, detailed page, scroll position, and other presentation state.
- Workspace changes occur through the tabs themselves. This decision adds no horizontal
  page-swipe navigation or other workspace-switching gesture.
- Activating Voice, FX, or Mod replaces the active workspace immediately. The primary
  workspaces are already visually distinct, so their content does not slide, fade, or
  wait for a transition. This intentionally differs from the directional slide between
  the visually similar A/B/C oscillator editors defined by ADR-024.

### Selection and repeated taps

- Tapping a different tab restores that workspace exactly where the user left it.
- Tapping the already-active tab while inside a detailed page returns that workspace to
  its main screen.
- Tapping the already-active tab on its main screen scrolls it to the top. If it is
  already at the top, nothing changes.

### Deep links and Back

- A deep link into another workspace opens the exact destination and supplies an
  explicit Back action to the exact originating context.
- Temporarily visiting another tab does not erase that return path. Returning to the
  destination tab restores the detailed page and its Back action.
- The return path ends only when the user invokes Back or resets the destination by
  tapping its already-active tab.

### Compact preset bar and universal Back

- On compact layouts, the preset bar becomes the shell's single Back location. Its
  visible row follows the supplied reference: a left Back slot, the current preset name
  centered in the available row, and one `…` button on the right.
- The Back control replaces local workspace return bars such as `Back to FX`. It is
  visible only when the active workspace has somewhere to return to. When no return path
  exists, the left slot remains reserved so the preset name does not shift sideways.
- The first version uses the reference's compact back glyph without destination text.
  Labels such as `Back (FX)` or `Back (Mod – MSEG 1)` are a future enhancement, not part
  of this cut.
- The universal Back action follows the active workspace's exact stored return path; it
  is not browser history and is not a shortcut to Voice/Home. A preserved return path in
  another, temporarily inactive tab reappears only when that tab becomes active.
- Workspace-local return bars are removed. An ordinary detail screen keeps only the
  specific name needed to identify its content, such as `DELAY`, `MSEG 1`, or
  `ENVELOPE 2`; it does not add a second Back control or a generic `FX`/`MOD` heading.
- The current mobile preset-bar controls for previous preset, next preset, Save, Save As,
  Revert, Copy JSON, and Paste JSON move behind `…`. The centered preset name remains the
  direct entry to the searchable preset browser. Existing disabled/dirty states and all
  preset operations remain available.
- The current yellow unsaved-change dot remains beside the centered preset name. The
  current factory/user source tag and dropdown chevron do not occupy the compact row;
  source information remains available inside the preset browser and action popover.
- Tapping `…` opens a compact popover anchored beneath the right side of the preset bar.
  Its actions use touch-sized rows and may scroll on an unusually short screen. It is not
  a full-screen sheet and does not replace the separate preset browser.
- This is a compact synth-shell composition. The underlying preset bar is shared with
  standalone effects, so their existing layout must not be silently changed.

### Presentation-state lifetime

- A plugin instance owns its own mobile navigation state. Closing and reopening the
  editor for that same plugin instance restores its active tab, detailed page, selected
  presentation objects, return path, and per-workspace scroll positions.
- A new plugin instance starts at Home. Home is the main Voice screen at the top.
- The standalone desktop and iOS apps keep navigation state while their current process
  remains alive, including ordinary background/foreground transitions. Quitting and
  relaunching starts at Home.
- Navigation state is presentation state. It is not stored in synth presets, DAW project
  sound state, or a global preference shared by unrelated plugin instances.

### Focused editors and gesture ownership

- Ordinary detail pages keep the primary tabs visible. A true full-screen focused
  editor, such as the detailed MSEG editor, temporarily replaces the preset/Back bar,
  primary tabs, piano keyboard, and normal workspace content until its own Done or Back
  action returns to the workspace.
- The global Mod widget is always visible, including above true full-screen editors. It
  remains movable and usable so manual Note audition and its global controls never
  disappear merely because an editor is full-screen. Full-screen layering and safe-area
  constraints must treat the widget as part of the permanent global shell, not content
  underneath the editor modal.
- Entering or leaving full-screen does not move, collapse, expand, or otherwise rewrite
  the Mod widget. Its position and expansion state remain exactly as the user left them;
  the user already owns those controls and may adjust them manually over the editor.
- Leaving a full-screen editor restores the exact prior shell, including keyboard
  visibility, active tab, scroll position, and Mod-widget perimeter position.
- An active parameter gesture keeps pointer ownership until it finishes; the tab row
  cannot steal or cancel it. Modulation-source drag navigation remains the separate
  dwell-to-navigate behavior specified by the corresponding task, which must keep the
  original drag alive through the switch.

### Accessibility

- The row is one labelled tab list with three labelled tabs and one tab panel visible to
  assistive technology at a time.
- Keyboard focus uses the standard roving-tab pattern: Left/Right move between tabs,
  Home/End reach the first/last tab, and Enter/Space activates the focused tab. Focus
  never moves into a hidden workspace.
- A tab change moves focus only when the previously focused element became hidden;
  otherwise it does not unexpectedly seize focus from the keyboard, Mod bar, or an
  active control.

### Production cutover constraints

- The keyboard visibility work already in flight remains the single owner of whether
  the keyboard is shown. The shell consumes that state to place the same tab row; it
  must not introduce a second visibility flag, persistence rule, or competing animation.
- Changing primary tabs must not clear a workspace's stored return path. The current
  workspace-selection callback clears the single mobile return value on every switch;
  that behavior must be replaced by return state owned by the destination workspace and
  cleared only by universal Back or that workspace's active-tab reset.
- Each workspace has one explicit panel element and one explicit scroll owner. Voice
  gesture scroll-lock lookup, FX drag/drop geometry, Mod-widget placement, and test
  helpers must resolve the active tab panel through the new shell contract rather than
  searching for an expanded accordion panel. Hidden panels retain their own scroll
  positions but cannot receive input.
- Existing compact FX-rack and keyboard rules are currently scoped through accordion
  classes. They must move to shell/workspace state without changing the FX row geometry,
  keyboard geometry, or short-phone overflow behavior as an accidental side effect of
  deleting the accordion markup.
- The compact preset composition must be an explicit synth-shell mode or adapter around
  the shared preset component. It must not change the standalone-effects preset bar.
  The existing workspace-local Back bar is removed only after universal Back owns the
  same return action.
- The tab row's bounds become an input to the Mod widget's placement constraints in
  addition to the keyboard, preset bar, safe area, and active panel. The global Mod
  widget must render above the focused-editor layer and remain reachable by pointer and
  assistive technology; a focused editor's dialog/focus handling must therefore include
  the widget in its usable surface rather than making it inert outside a modal trap.
- Production roles and helpers migrate from accordion toggles and `aria-expanded` to a
  stable tab-list/tab/tab-panel contract. Browser tests and the Web POC helpers must be
  rewritten around behavior, not left passing through compatibility markup that keeps
  the old accordion semantics alive.

## Consequences

- ADR-026 supersedes only ADR-017's mobile accordion decision. ADR-017 remains
  authoritative for the sticky keyboard, FX controls, parameter menu, no-LFO model,
  and the interaction contracts not replaced here.
- Per-instance editor restoration needs a presentation-state owner outside presets and
  global user preferences. A React mount lifetime alone is insufficient when a host
  destroys and recreates the WebView for the same plugin instance.
- Inactive mounted workspaces must suspend expensive visual observation and reject
  input without losing their presentation state.
- Keyboard visibility changes the available content height and the tab row's bottom
  anchor, but must not create a second tab component, reset workspace scroll state, or
  leave a blank strip where the keyboard was.
- This is a coordinated shell cutover rather than a markup-only replacement: navigation
  ownership, scroll and drag geometry, compact styling scopes, preset composition,
  overlay ordering, accessibility, browser helpers, and regression tests change together.

## Rejected alternatives

- Keeping the accordion was rejected because inactive headers consume scarce phone
  height and prevent the active workspace from reading as the primary view.
- Unmounting inactive workspaces was rejected because it would discard exact effect,
  route, source, detail, and scroll context on every tab change.
- Making a repeated active-tab tap a permanent no-op was rejected because the tab row
  would provide no dependable way back to a workspace's main screen.
- Restoring stale navigation after a complete standalone relaunch was rejected; a new
  app process starts at Home, while the same live app or plugin instance retains place.
