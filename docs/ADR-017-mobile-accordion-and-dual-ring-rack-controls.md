# ADR-017: Mobile accordion and dual-ring rack controls

Status: accepted — 2026-08-06; compact Voice oscillator composition superseded by ADR-024; mobile accordion superseded by ADR-026

## Context

The dedicated mobile FX subpage in ADR-016 proved the eight-effect rack, but it made Voice, FX, and Mod feel like unrelated places. The approved product direction is one continuous instrument surface where all three workspaces remain visible, navigation has a single grammar, FX-to-Mod deep links preserve their origin, and the exact approved rack faceplates survive unchanged. Native range inputs also recreated pointer-capture and scroll conflicts that had already been solved elsewhere in the synth.

A later compact layout compressed the wavetable and global filter into one row and represented the four controls below the oscillator with generic numeric fields. On a phone, the two primary visual surfaces were too narrow, and touch drags on those numeric fields could yield to page scrolling. Mobile Voice therefore needs an explicit layout and control contract rather than inheriting incidental compact styles.

## Decision

- Compact layouts use one vertical accordion with Voice, FX, and Mod headers always visible. Exactly one section is expanded; inactive sections remain mounted but hidden so selection, editor, route, and scroll context survive transitions.
- Voice presents the selected oscillator's wavetable as one full-width row and the global filter as a separate full-width row beneath it. Compact layouts must not place those cards side by side. FX contains the approved eight-faceplate rack, selected-effect editor, mod bar, and selected route amount. Mod contains MSEG, Envelope, Macro, fixed sources, and the routing matrix. There is still no LFO family.
- The octave, semitone, fine-tune, and level controls below the oscillator use the same direct-manipulation knob surface as the approved mobile FX controls, showing only the base-value ring because these are not route editors. Octave and semitone snap to whole-unit detents and request a best-effort haptic at each changed detent; fine tune and level remain continuous. All four knobs own their touch gesture so the page cannot scroll during an active edit. Mute and Solo remain buttons.
- Controls embedded in the wavetable graphic, including Warp, Scan, and Pan, are outside this control decision and remain for a separate visual/interaction pass.
- Mobile rack rows contract to 48 pixels inside the accordion, while the dedicated grip and power controls retain 44-pixel touch targets. The approved faceplate images, wordmarks, quick value, and bottom meter remain the visual source of truth.
- A mod-source drag creates a route. A first tap selects an inactive source; a second tap on the selected source opens Mod at that exact source. Back restores the originating FX selection and route intersection. Source-page transitions remain visibly animated.
- Continuous rack parameters use one shared stippled dual-ring knob. The inner sector represents the base value, the outer sector represents the selected source-target route, and a fixed marker shows the factory default. The existing route-amount slider remains the authoritative explicit editor; direct outer-ring dragging is retained as a faster equivalent path.
- Pointer capture owns every knob gesture through release, cancellation, blur, or visibility loss. Touch movement does not depend on `buttons`; movement cancels long press; a completed drag suppresses its synthetic click. A stable HUD near the top reports the edited value without reflowing the control grid.
- A stationary long press opens a parameter menu and requests a best-effort haptic where the host supports it. The menu exposes exact editing, base reset, route bypass, polarity, voice-source reducer, one-route removal, and confirmed removal of every route to the target. Exact editing never creates a missing route and base reset never removes existing routes.
- The sticky mobile keyboard shows 18 notes at a shorter height. Octave controls remain usable, while redundant OCT and root-note labels are visually hidden on compact layouts.

## Consequences

- ADR-016's dedicated mobile FX-page navigation is replaced; its approved faceplate, no-LFO, touch, modulation, audio-session, and engine decisions remain in force.
- Voice, FX, and Mod now have one predictable transition model, and an FX-to-Mod visit is reversible without reconstructing UI state.
- Haptics are an enhancement rather than a web requirement because Safari exposes no general vibration API; native hosts can supply `cmaj_triggerHaptic`.
- The shared rack knob replaces native range inputs across desktop and mobile, so interaction fixes and route semantics cannot diverge by viewport.
- The full-width Voice stack uses more vertical space, but preserves readable wavetable and filter graphics and relies on the existing Voice-panel scrolling rather than shrinking both instruments.
- The controls below the oscillator reuse one knob implementation instead of creating an oscillator-specific gesture system. Detents and haptics are configuration of that shared control, not a second widget.
- Compact rows trade some faceplate height for keeping all eight effects, the selected editor, route controls, and playable keyboard in the phone flow without scrolling the rack column.
- ADR-024 supersedes this ADR's compact Voice four-knob underlay and deferred wavetable-control placement. ADR-026 supersedes the mobile accordion with persistent Voice / FX / Mod tabs. This ADR remains authoritative for the sticky keyboard, FX controls, parameter menu, and no-LFO model.
