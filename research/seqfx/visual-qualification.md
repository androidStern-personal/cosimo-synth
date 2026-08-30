# SeqFX packaged visual qualification

Date: 2026-08-30

Final command: `npm run fx:seqfx:visual-proof -- --require-clean`

## Proof contract

The qualification builds the production SeqFX app and worker, serves only the
built runtime from an ephemeral loopback server, calls the production view
factory, and asserts that `cosimo-seqfx-react-view` rendered inside its open
shadow root. It does not use the Vite source harness or reuse a fixed port.

The mandatory matrix contains exactly 100 measured and captured states:

- empty state at 1120 x 680, 900 x 600, 720 x 520, and 1440 x 800;
- top and lower inspector captures for all 12 effects at every one of those
  four supported sizes;
- 48 complete inspector traversals: 12 effects at four sizes.

Each traversal opens every Advanced disclosure and samples the inspector in
overlapping viewport-sized strides until every enabled button, select, and
input has appeared. The proof also records a screenshot at every interior
stride, so visually important content between the named top and lower states
is not accepted from DOM measurements alone. The current matrix produces 100
contract screenshots plus 202 stride screenshots.

## Automated acceptance

Every mandatory state is rejected for any of the following:

- document/root overflow, inspector horizontal overflow, or a visible
  inspector-owned child crossing its horizontal bounds;
- missing inspector-owned vertical scrolling or an incomplete lower capture;
- a clipped effect name or hidden chain label;
- an enabled interactive control smaller than 24 CSS px;
- a functional label/readout below 10 CSS px or prose/help text below 11 CSS px;
- normal text below WCAG AA 4.5:1 against its composited background;
- nonessential animation remaining under reduced-motion media;
- a closed Advanced disclosure or a control never exposed during traversal.

The same run reaches representative global, grid, picker, tab, mix, and
lower-inspector controls by keyboard and requires visible focus. It also models
80%, 100%, 125%, 150%, and 200% zoom as effective CSS viewports, then requires
the nine core controls to remain scrollable, focusable, and free of document
horizontal overflow.

## Source and bundle provenance

Before opening Chromium, the script records repository-relative evidence for:

- commit, tree, branch, and complete dirty status;
- `package-lock.json` SHA-256;
- every tracked or untracked source under the SeqFX, shared-UI, build, and
  proof-script scopes, including a sorted file list and aggregate SHA-256;
- production `app.js`, `app.js.map`, `worker.js`, and `worker.js.map` hashes.

It records the same evidence again after capture and fails if any field, source
aggregate, or artifact hash changed. `--require-clean` additionally refuses to
start from a dirty worktree. Source maps must carry `sourcesContent` that the
separate build-provenance gate can trace to this exact checkout; absolute
workspace paths are not written to the visual manifest.

## Defects found and repaired

- Functional text was broadly set at 5.5-9 px. All SeqFX labels/readouts now
  meet the 10 px floor, while descriptions and behavior notes meet 11 px.
- Raising the type floor exposed a real wide-layout truncation of `Tape Stop`.
  Effect cards now reserve 100 px before auto-fitting columns.
- The larger chain labels exposed insufficient left padding and clipped the
  leading `C` in `Chain`. The grid now reserves 40 px and renders the full
  label at every supported size.
- The old proof covered all effects only at default and compact sizes and used
  a source harness in light DOM. The matrix now covers all effects at all four
  sizes through the built production custom element and shadow root.
- The old proof could reuse a fixed-port Vite server from another run. The new
  server binds an ephemeral port, is owned only by this command, and closes
  before the manifest is written.

## Human inspection

The generated contract contact sheet and full-resolution representative
captures were inspected after the passing implementation run. Default,
compact, minimum, and wide layouts preserve the global/grid/inspector
hierarchy; all effect names and full chain labels remain legible; the Tape Stop
trajectory and lower behavior controls are readable; Advanced content is
reachable; and no remaining formatting defect was observed in the supported
matrix.

## Evidence location and boundary

Ignored proof artifacts live under `build/seqfx_visual_proof/`. The manifest
contains all screenshot hashes, contact-sheet hash, measurements, traversals,
focus/zoom results, source provenance, artifact provenance, and the zero-length
failure list. Hashes are intentionally read from that clean-commit manifest
instead of copied into this document and allowed to become stale.

This is production-bundle Chromium plus human screenshot qualification. It is
not Ableton WebView, physical-display, macOS accessibility-inspector, native
CPU, or listening acceptance; those remain distinct release-candidate gates.
