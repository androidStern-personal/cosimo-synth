# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable decisions for this prototype

- This is a parallel React/Vite product prototype for Cosimo's eventual iOS UI, not a disposable HTML mock and not the production integration itself. Keep product components independent from mock data so `CosimoMobileExperience` can later receive a real iOS/Cmajor adapter.
- Keep the presentation as a plain structural wireframe: white canvas, black outlines, native controls, no decorative visual styling.
- The persistent shell includes the patch header, ordered effect rack, compact source shelf, current articulation, and audition/capture controls.
- In an effect view, the primary effect stays visible above an inline contextual mapping inspector; do not cover effect parameters with a drawer.
- The source shelf and mapping inspector have distinct roles. A source-shelf tap explicitly changes focus to the source editor; a mapping-chip tap keeps the primary module visible and swaps only the permanently allocated relationship detail in place.
- Global effects are patch-owned. The articulation selector remains available for audition, but it does not create a Phaser base-value override.
- Voice/Oscillator and Effects Rack are sibling sound-design workspaces selected from the centered persistent header control. The Voice workspace exposes Wavetable, Voice Filter, and Amp/Pan as its module strip.
- Scalar parameter tiles are the controls: tap selects, horizontal drag edits the base value, and vertical drag edits the selected source's modulation amount. Do not add a redundant permanent large slider above them.
- Every scalar tile visually identifies the base position, patch-default tick, selected modulation range, and selected source. Exact numeric values appear transiently during manipulation.
- Persistent compound settings such as Free/Sync and rhythmic division live as compact overlays inside the module graphic. They remain visible regardless of parameter selection so the editor never shifts vertically.
- Source-shelf items use compact type icons plus slot numbers. Source-editor target rows must contain the same editable parameter control, show the actual targets for the selected source, and offer an explicit action that opens the target module with that relationship selected.
- Returning from a source editor restores the module that opened it. Never hard-code the return target to Phaser.
- Do not add explanatory captions such as `Ordered effects — scroll` or `Sources — tap to edit`; the visible controls must communicate their own purpose.
- The persistent workspace selector is an icon carousel, not a dropdown: the current workspace is the large center icon, smaller previous/next icons remain visible, tapping a neighbor changes workspace, and horizontal swiping changes workspace. Until a third workspace is defined, the two-workspace carousel repeats the alternate workspace on both sides rather than inventing another product area.
- Keep mapping chips and the add action in one compact row. Do not create a separate title/action row or show an instructional empty-state card when no mapping exists.
- The relationship heading itself is unnecessary when the selected parameter is already visually obvious. Mapping chips should lead the contextual region, display their amounts, and support vertical drag for quick amount adjustment.
- Remove `Expand` until a concrete deeper relationship-editing use case exists. The prior expanded state duplicated the compact card and therefore did not earn its space.
- Module graphics must be real, live line-art visualizations driven by the current parameter values, with the existing touch surface layered over them. Do not fill the area with instructional placeholder text.
- Tapping the source preview inside a mapping card opens that source editor, exactly like tapping the corresponding source in the persistent source shelf.
- Every effect-rack tile exposes an editable quick control for that effect's last-touched parameter. Rack order is already visible spatially, so do not show ordinal numbers.
- Long-pressing a user-created source opens its compact action menu; deletion removes the source and all of its mappings. Reuse the first available slot when another source of that type is added later.
- Every continuous control must feed the shared transient heads-up value readout while it is manipulated, including rack quick controls, mapping amounts, and source-editor sliders.
- Preserve the black-on-white wireframe as the base language. Color is semantic and reserved for articulations and modulation sources. Each articulation and each source slot gets a stable unique color inspired by Native Instruments Super 8 and XLN DB-30 Drum Butter; reuse that color everywhere the identity appears.
- Each articulation has a compact icon. Only parameters with a sparse articulation override show that articulation's icon and color, plus a visible way to reset the override to the patch base.
- When a non-Default articulation is active, editing an eligible per-note voice parameter creates or edits that articulation's absolute override. Global effects remain patch-base controls.
- Mapping chips remain compact and directly adjustable. Tapping a chip never replaces the primary module and never changes the module/relationship boundary; it swaps the fixed detail surface to that relationship. A genuinely deep source editor is entered only through an explicit source-navigation action. Source-editor targets remain compact until one target's relationship settings are selected.
- Modulation reducers are contextual: show Mean/Max only when a per-note or MPE source crosses into a global target.
- Source-shelf chips show an upper-right target-count badge. Unmapped orphan sources are visually muted. Source chips drag onto visible eligible parameters; beginning a drag exposes drop targets and a successful drop creates or focuses the mapping.
- Opening a target from a source editor creates a shallow return path back to that source, restoring target focus and scroll position.
- The retrospective motion buffer belongs to the parameter moved while a MIDI note or the on-screen Trigger is held. Capture must not retarget the motion based on whatever is selected afterward.
- Effect-rack reordering uses a distinct drag handle, not the tile body or quick-control track. Rack quick controls reuse the same small black wireframe range language as other continuous controls.
- Envelope source controls belong in the touchable envelope graphic. Avoid separate A/D/S/R slider rows and give the recovered space to the target list.
- Primary scalar controls share one borderless parameter matrix. Preserve large invisible touch cells, but let alignment, whitespace, typography, and one outer calibration-panel boundary provide the grouping instead of drawing six separate cards.
- Contextual mappings form one ruled relationship band in the normal module view. Source colors are small identity marks inside that band; one selected mapping may invert black/white. Deeper settings belong to the contextual relationship editor, not an expanding inline card.
- The persistent source shelf reads as a graph legend, not a row of colored cards: controls are borderless, identity color is confined to the glyph and short underline, attachment count stays raised, and the focused source may invert black/white.
- The persistent audition area is an anchored transport footer. Articulation, note, and Trigger are stable grouped controls; categorical selections may use black/white inversion, while Repeat, Latch, Capture, and buffer status form a quieter secondary row.
- Treat the selected Ulm scientific-instrument mock as directional visual truth for hierarchy, density, typography, and active states, while preserving Cosimo-specific interactions rather than cloning the mock mechanically.
- The effects rack is one continuous horizontal instrument surface with light internal dividers, not a row of independent bordered cards. The active effect inverts black/white. Module focus, last-touched quick scrub, enabled state, and reorder handle must remain visually and gesturally distinct.
- Use the checked-in IBM Plex Sans Condensed font for display/control labels and Departure Mono for values, units, transient HUD text, and compact status. Do not render visible UI text below 10px.
- Use a four-level rule hierarchy: dark major workspace boundaries, light internal hairlines, strong active focus, and 3px semantic source/articulation rails. Avoid nested full-black rectangles and equal-weight borders.
- The transient parameter HUD reserves stable space but is visually silent while idle. Do not show permanent instructional text such as `Exact value appears while dragging`.
- Parameter matrices adapt to the module's actual control count; do not leave empty cells merely to preserve a fixed six-cell grid.
- On short iPhones, preserve the stable relationship surface and reduce its internal spacing before shrinking the touchable module or source graphic below a useful editing size.
- Ink owns every structural graphic: track baselines, base fills, handles, and module visualizations render black on paper. The teal accent is not a structural color; it survives only as the generic fallback where no semantic source color exists.
- Rack tile anatomy is identity row, quick label plus reserved mono value, and scrub track, beside a 44px full-height rail holding the enable cell above the dedicated reorder handle. Size the tile so the longest label/value pair ("FREQUENCY 20.00 kHz") never truncates; partial tiles at the strip edges are acceptable scroll affordances.
- Categorical selections (articulation, polarity, reducer, workspace, mode) render uppercase like all captions; mixed case is reserved for mono status strings.
- The empty relationship detail states the fact in the reserved geometry — muted rail, "NO SOURCE", "TO <parameter> —" — never instructions or a collapsed surface.
