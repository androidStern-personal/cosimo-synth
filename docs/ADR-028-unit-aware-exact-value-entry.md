# ADR-028: One unit-aware exact-value entry contract

Status: accepted architecture — implementation authorized (T19) — 2026-08-20

## Context

The 2026-08-20 inventory found seven exact-entry surfaces backed by eleven independent
parse implementations, three mutually inconsistent unit-stripping strategies, and five
formatter vocabularies. Three findings are live bugs: typing garbage into Unison Voices
commits `NaN` (the only parser returning `NaN` instead of `null` slips past
`parsedValue ?? currentValue`); `12khz` on the rack Cutoff sheet means 12 Hz because the
unit strip runs before the `k` shorthand test, while the Voice Cutoff field reads it as
12 000 Hz; and a bare envelope time under the 1-second display threshold means seconds
below 10 but milliseconds at 10 and above — the same keystroke commits a 1000× different
value depending on prior state. No field states its unit while it is being edited, and
the mobile Voice cells' long-press menu seam exists but is wired to nothing.

The route-amount contract is confirmed sound and is NOT changed by this decision: a
route's persisted `amount` is interpreted by its target (octaves, semitones, dB,
seconds, or a −1..+1 offset), and any UI percentage is derived from the target's
allowed depth.

## Decision

### One module owns the vocabulary

`ui/shared/parameter-value-entry.ts` becomes the single parse/format authority. Every
exact-entry surface routes through it; the eleven private parsers are deleted, not
wrapped.

- **`ParameterEntrySpec`** describes one editable quantity: its displayed default unit,
  the compatible typed units with their conversions, the legal domain and step, and any
  special semantics (log-position percent, depth percent, tempo-sync divisions).
  Specs are derived from the existing sources of truth — rack descriptors, the
  route-amount limit table, and the voice display descriptors — never restated by hand.
- **`parseParameterEntry(spec, text)`** returns a parsed commit or an explicit,
  human-readable rejection. Rules:
  - Unit matching is ANCHORED (a trailing unit token from the spec's vocabulary),
    never a global character strip. `khz` is matched before `k`.
  - A bare number means exactly the unit the field currently displays.
  - A compatible typed unit overrides the default and round-trips.
  - An INCOMPATIBLE unit rejects with a message; it is never silently ignored.
  - Invalid text rejects; rejection never writes, never clamps, and keeps the editor
    open with the explanation beside the field (no toast).
  - A valid out-of-range value clamps to the nearest legal value, and the field
    immediately shows what was actually applied.
  - `NaN` is unrepresentable in the result type; the Unison Voices class of bug cannot
    recur.
- **`formatParameterEntry(spec, value)`** provides both the idle readout and the
  editing draft. The editing draft keeps the value bare, but every surface must render
  the spec's current default unit as a persistent suffix token beside the field while
  editing (the `PrecisionNumberField.suffix` affordance, today unused).

### Family semantics (from the ticket, now normative)

- **Cutoff base**: default Hz; accepts Hz, kHz, and `%` meaning position through the
  logarithmic 20 Hz–20 kHz range (0% = 20 Hz, 50% ≈ 632 Hz, 100% = 20 kHz).
- **Cutoff modulation amount**: default octaves. A signed Hz/kHz entry means movement
  relative to the current base and resolves to the equivalent octave interval (the
  stored amount stays octaves, so the interval is preserved when the base later
  moves). `%` means percent of the allowed signed depth: +100% = +6 oct.
- **Modulation amounts generally**: default is the target's own unit from the existing
  limit table; `%` means percent of that target's allowed depth for non-percent-native
  targets, and the plain fraction for percent-native ones.
- **Times**: default is whatever unit the field displays at that moment (`ms` below the
  1-second display threshold, `s` at or above — visible, therefore deterministic);
  `ms`/`s` spellings always accepted. The value-conditional bare-number heuristic is
  deleted.
- **Free/tempo-sync pairs** (Delay time, Phaser rate): exact entry selects the mode as
  part of one commit. A time/rate (`250 ms`, `2 Hz`) selects Free with that value; a
  supported division (`1/8`, `1/4T`, `1/2.`) selects Sync with that division, matched
  against the descriptor's own division table. The field shows the resulting mode and
  canonical value immediately. `1/8` can never reach a float parser.
- **Unison Detune**: base stays cents (`ct`), amounts stay the percent contract; both
  fields display their unit so the same digits are never silently two scales.

### Surface migrations

The rack sheet (S1), the two Mod-matrix amount editors (S2, S3), the MSEG Rate field
(S4), the envelope fields (S5), all thirteen `PrecisionNumberField` call sites (S6),
and the two Nexus fields (S7) consume the module. The iOS view gains no new entry
surfaces in this ticket, but its duplicated formatters are replaced by the shared
formatter so the vocabulary cannot fork again. The mobile Voice cells' dormant
long-press menu seam is out of scope here (T13's drawer work owns that wiring); the
module is the contract it must consume when it lands.

## Consequences

- The same text means the same value everywhere a parameter can be edited, and
  explicit units round-trip.
- Field rejection behavior is uniform: message beside the field, nothing written.
- The dead `formatTargetValue` vocabulary and the duplicate formatters are removed.
- Divisions become typeable the moment the sheet reaches a dual-mode parameter.

## Rejected alternatives

- Wrapping the existing parsers behind a dispatcher was rejected: the inconsistencies
  ARE the parsers; a wrapper would freeze eleven vocabularies as accidental contract.
- Storing a universal percentage for route amounts was rejected (re-affirming the
  existing target-owned amount contract and T19's explicit instruction).
- Inferring intent for bare envelope numbers by magnitude was rejected: the displayed
  default unit is the only honest resolver, and it is already visible.
