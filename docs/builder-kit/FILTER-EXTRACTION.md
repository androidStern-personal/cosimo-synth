# Shared filter editor and release handoff

October 3, 2026. Branch: `codex/builder-kit-knob-318e`. Qualified source: `a4e54a94e846157d58bac4a272d775970e8613de`. Implementation `f9cce3a6`, portable example qualification `501356f1`, final theme/compatibility repair `a4e54a94`.

## Delivered

`FilterEditor`, exported from `kit/index.ts`, supplies one response sampler, cutoff/resonance mapping, pointer/keyboard input and gesture lifecycle. It draws a base response, an optional effective response, either a cutoff band or two-dimensional modulation endpoints, and an optional FFT overlay. Routing and audio processing belong to the application.

Cosimo's `FilterResponseGraph` is now a thin adapter to this public control. It supplies product mode IDs, the selected resonance transfer, values, routing callbacks, observed spectrum and product colors. Its duplicated graph, pointer engine and spectrum painter were removed. SeqFX uses `FilterEditor` directly with the cutoff-band presentation and value chips. Cosimo's main graph, effects graph and filter HUD therefore share the same editor behavior with the customer kit.

`FilterRangeEditor` remains an alias of the same function. Its old TypeScript and CSS paths forward to the canonical files. Cutoff-band helpers and props remain available. `range` and `modulation` are mutually exclusive presentations in the TypeScript contract.

Controls support bipolar/unipolar presentation, constrained cutoff/Q axes, endpoint and rigid center edits through nonlinear Q mappings, overlapping grip parking, externally driven values, disabled/read-only state, and start/end callbacks for Undo or host gestures. Pointer cancellation, capture loss, blur, disabled/read-only changes and unmount settle an open edit.

Default styles are scoped to the editor and retained once per document or shadow root. Author styles follow the defaults. Mode-button contrast follows the surface theme; explicit button tokens preserve SeqFX's existing chrome. No product source or private routing types were added under `kit/`.

## Customer examples and documentation

The [shipped guide](../../kit/docs/FILTERS.md) and five Preview/Code examples cover simple editing, cutoff bands/chips, two-axis modulation, spectrum/live response, and custom theme/Q transfer/read-only state. `npm run ui:filters:dev` and `npm run test:filters` ship in the customer root template. Tests compile and independently bundle/render the displayed TSX and CSS against public imports. The analyzer example labels its generated demonstration signal; it is not presented as observed audio.

The kit AGENTS table, changelog, draft email, social copy and release writeup now include the shared filter editor. No customer message was sent or announcement video re-rendered by this task. The existing filter import remains compatible; final video review belongs to the composed release.

## Verification

| Check | Result |
|---|---|
| Public filter browser suite | 12 passed: pointer/keyboard, modes, band/unipolar, modulation axes/center, spectrum pixels/clearing, styles/contrast, phone layout, copied TSX/CSS, shadow-root ownership and gesture cleanup. |
| Existing cutoff-band browser suite | 6 passed through the compatibility imports. |
| Cosimo integration browser checks on final source | 16 passed: response mapping, resonance transfers, bipolar/unipolar travel, key-track/Q routing, live spectrum modes, input cleanup and main/effects/HUD responses. |
| SeqFX development filter checks | 3 passed: inline editing/uploads, signed modulation amounts and grouped filter edits. |
| Packaged SeqFX shadow-root checks | 2 passed: shared palette plus visible/styled filter, unchanged button colors, mode edits and independent cutoff endpoints. |
| Shared response/spectrum/curve math | 43 passed. |
| Monorepo typecheck and filter demo build | Passed. |
| Independent committed-source customer export | 293 files; exporter boundary checks passed. Ordinary `npm ci`, with its own directory of dependencies; no node_modules symlink. |
| Customer typecheck and unit suite | Passed; 293 passed, 6 monorepo-only skips, 0 failed. |
| Customer filter browser suite and demo production build | 12 passed; build passed. |

Machine-readable receipt: `build/filter-customer-qualification.json`. Command logs use `build/filter-customer-*.log`; final Cosimo checks use `build/filter-cosimo-check.log`. Desktop/phone reference images use `build/filter-reference-*.png`.

One broader SeqFX inspector test was attempted and stopped on its existing Ring slider step (`fill("440")` into a normalized 0–1 input). The focused packaged filter test is separate and passed; this handoff does not claim that the whole SeqFX browser suite passed.

## Integration boundary

This is source, browser UI and customer-export qualification. It does not establish native installed-host, listening or physical-device acceptance. The component branch is committed locally, not merged, pushed, published or delivered. The integration coordinator owns composing this source with the release candidate and rerunning the full release gates.
