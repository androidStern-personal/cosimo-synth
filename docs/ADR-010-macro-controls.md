# ADR-010: Patch Macro Controls

Status: accepted.

## Context

Cosimo needs Serum-style macro knobs for broad, performance-oriented control of
multiple synthesis and effects parameters. Macros are part of the patch modulation
system, not an effects-rack-only feature.

## Decision

Each macro is:

- a patch-global normalized value from 0 to 1;
- a global-domain modulation source, requiring no voice-to-global reducer;
- routable to multiple continuous voice and global-effect parameters;
- exposed as a stable host-automatable parameter;
- renameable in Cosimo's UI, while retaining a stable internal ID and host endpoint;
- stored with the patch along with its mappings and UI name.

V1 macros are modulation sources, not modulation destinations. Macro-to-macro
routing and modulation-cycle detection are deferred until a concrete need appears.

V1 reserves exactly four stable macro slots. A new patch initially exposes only
Macro 1 plus an Add Macro tile. Adding macros reveals reserved slots as needed up to
four; unused reserved slots do not appear as knobs.

## Domain Invariants

- Macro ID does not change when its display name changes.
- A macro mapping targets parameter identity, never rack position.
- Macro values are finite and clamped to 0 through 1.
- Macro mappings cannot target rack order or module-enabled state.
