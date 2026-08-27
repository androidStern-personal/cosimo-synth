# Mobile Voice control inventory

This is the source-backed inventory for the throwaway mobile Voice layout prototype. ADR-024 accepts Variant D as the production hierarchy; the prototype itself remains non-production reference material.

## Scope

- The mobile `Voice` accordion currently renders the selected oscillator (`A`, `B`, or `C`), the shared filter, and a lower control card.
- Each oscillator owns the same 22 patch parameters. The selected-oscillator UI therefore presents 22 oscillator parameters at a time, plus 5 shared voice/filter parameters: **27 sound parameters in the active view**.
- Across A/B/C, the underlying Voice family is **71 patch parameters**: `(22 × 3) + 5`.
- The prototype calls `Wavetable Position` **Index** because that is the product language used in this exploration. The current UI exposes it by dragging the large wavetable graphic and reads it back as `Frame N`.

## Selected oscillator: 22 parameters

Endpoint names below use `osc{A|B|C}` because the same contract exists independently for all three oscillators.

| Group | Product control | Endpoint | Range / choices | Current mobile location | Mod destination |
| --- | --- | --- | --- | --- | --- |
| Source | Wavetable | `osc{X}WavetableSelect` | catalog index `0–238`, default `238` (`Core Shapes`) | top-left picker on graphic | no |
| Source | Index / position | `osc{X}WavetablePosition` | `0–1`, default `0` | drag the graphic; `Frame N` readout | yes |
| Source | Warp mode | `osc{X}WarpMode` | Off, Bend +/-, PWM, Asym +/-, Mirror | bottom-left overlay on graphic | no |
| Source | Warp amount | `osc{X}WarpAmount` | `0–1`, default `0` | bottom-left overlay on graphic | yes |
| Mix | Pan | `osc{X}Pan` | `-1–1`, default center | bottom-right overlay on graphic | yes |
| Pitch | Octave | `osc{X}Octave` | `-4–4`, integer | lower control card | shared pitch destination |
| Pitch | Semitone | `osc{X}Semitone` | `-12–12`, integer | lower control card | shared pitch destination |
| Pitch | Fine | `osc{X}FineCents` | `-100–100 ct` | lower control card | shared pitch destination |
| Mix | Level | `osc{X}VolumeDb` | `-48–6 dB`, default about `-9.54 dB` | lower control card | yes |
| Mix | Mute | `osc{X}Mute` | Off / On | lower control card | no |
| Mix | Solo | `osc{X}Solo` | Off / On | lower control card | no |
| Unison | Voices | `osc{X}UnisonVoices` | `1–8`, integer | Controls → Voice → Unison | no |
| Unison | Detune | `osc{X}UnisonDetune` | `0–1`, displayed `0–50 ct` | Controls → Voice → Unison | yes |
| Unison | Blend | `osc{X}UnisonBlend` | `0–100%`, default `75%` | Controls → Voice → Unison | yes |
| Unison | Width | `osc{X}UnisonWidth` | `0–100%`, default `100%` | Controls → Voice → Unison | yes |
| Unison | Phase | `osc{X}Phase` | `0–100%` | Controls → Voice → Unison | no |
| Unison | Random phase | `osc{X}PhaseRandom` | `0–100%` | Controls → Voice → Unison | no |
| Unison | Phase mode | `osc{X}Retrigger` | Free / Reset | Controls → Voice → Unison | no |
| Unison | Detune mode | `osc{X}UnisonDetuneMode` | Linear, Super, Exp, Inv, Random | Controls → Voice → Unison | no |
| Unison | Stack | `osc{X}UnisonStackMode` | Off, 12, 12+7, Center-12, Center-24 | Controls → Voice → Unison | no |
| Unison | WT position spread | `osc{X}UnisonPositionSpread` | `0–100%` | Controls → Voice → Unison | yes |
| Unison | Warp spread | `osc{X}UnisonWarpSpread` | `0–100%` | Controls → Voice → Unison | yes |

## Shared voice and filter: 5 parameters

| Group | Product control | Endpoint | Range / choices | Current mobile location | Mod destination |
| --- | --- | --- | --- | --- | --- |
| Voice | Play mode | `playMode` | Poly, Mono, Legato | Controls → Voice | no |
| Voice | Glide | `glideTime` | `0–2 s` | Controls → Voice | no |
| Filter | Mode | `filterMode` | Off, Lowpass, Highpass, Bandpass, Notch, Peak | filter graphic, top-left | no |
| Filter | Cutoff | `filterCutoff` | `20–20,000 Hz`, default `1,000 Hz` | filter graphic, bottom-left / graph drag | yes, in octaves |
| Filter | Resonance | `filterQ` | `0.1–20 Q`, default `0.707107` | filter graphic, bottom-right / graph drag | yes |

## UI controls that consume space but are not patch parameters

| Control | State ownership | Current role |
| --- | --- | --- |
| Oscillator A/B/C tabs | local presentation state | chooses which 22-parameter oscillator contract is shown |
| `Frame N` | derived readout | displays Index against the active table frame count |
| Filter analyzer mode | local presentation state | cycles Graph, Bars, Round Bars |
| Articulations / Voice selector | local presentation state | switches the lower control card between two substantial workflows |
| Keyboard octave up/down | local keyboard state | changes the on-screen keyboard range, not oscillator pitch |
| Voice / FX / Mod accordion | local workspace state | keeps exactly one mobile workspace expanded |

The Articulations editor is a separate authoring workflow competing for the same lower-card space. It is intentionally not flattened into the 27 sound-parameter count.

## Prototype variants and selected direction

Variants A–C remain discarded research alternatives. Variant D is the accepted product direction; its complete production behavior and non-prototype data requirements are specified in `docs/MOBILE_VOICE_FOCUSED_OSCILLATOR_SPEC.md`.

- **Variant A:** wavetable, Index, Warp amount, Level, Unison voices/detune, and Filter cutoff/resonance remain direct; tuning and advanced unison use drawers.
- **Variant B:** the wavetable becomes a thumbnail so tuning, Pan, Width, Play mode, and Glide can join the direct controls.
- **Variant C:** A/B/C stay visible together as edge-to-edge flat rows with thin functional separators—no outer card padding, rounded card border, or gradient. Tapping the oscillator letter toggles its existing Mute parameter and greys the row; Solo stays in the upper-right. Semitone and Voices live in the compact identity rail, Warp Mode sits above the wavetable, and Shape uses the freed fourth slot for Detune. The five named pages remain Shape, Tune, Unison, Phase, and Modes; the former bottom detail drawer is gone.
- **Variant D — accepted:** C's hierarchy becomes one edge-to-edge selected-oscillator editor behind letter-only A/B/C tabs. Tapping an inactive letter selects it; tapping the active letter toggles that oscillator on/off, replacing the duplicate power label. Semitone, Voices, and Solo remain direct. Warp Mode, Wavetable, and Frame form a flush control strip at the wavetable graphic's bottom edge. The same five control pages use paddles inside one 36-pixel Ableton-density parameter strip, where larger compact labels and values stay inline without outer vertical padding. Each readout's bottom edge contains a single neutral tick at the current base value over a source-colored low-to-high modulation band; the base is never shown as a filled range. Horizontal drag segments edit base and vertical segments edit the selected existing route amount. A short rolling direction window with hysteresis keeps diagonal movement exclusive to one value while allowing the active axis to switch before release. A transient fixed top-center HUD projects that state onto the existing FX dual-ring language, names the active axis, keeps base in the center, and shows projected low/high values at the arc ends. Octave, Semitone, and Fine correctly present vertical edits as the shared Tune modulation destination. The product accepts tab switching instead of simultaneous A/B/C comparison in exchange for the larger focused graph and controls.

## Code sources

- `ui/desktop/DesktopPatchView.tsx`: current mobile assembly, ranges, labels, and nesting.
- `ui/shared/synth-hooks.ts`: live bindings, defaults, and coercion.
- `ui/shared/oscillator-binding.ts`: the shared A/B/C 22-parameter contract.
- `ui/shared/modulation-targets.ts`: legal modulation destinations.
- `cmajor/WavetableSynth.cmajor`: host-facing parameter contract.
