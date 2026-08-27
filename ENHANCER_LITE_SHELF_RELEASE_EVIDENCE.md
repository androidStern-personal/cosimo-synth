# Enhancer Lite Shelf Audition Release Evidence

Date: 2026-08-27
Branch: `codex/t26-enhancer-lite-shelves`
Starting checkpoint: `2a652a4035519be1fbe12de9a8c6487ed736e3c5`

## Artifact

- Target: `enhancer-lite-shelves-audition` (explicit-only; excluded from `all`)
- Installed bundle: `/Users/winterfell/Library/Audio/Plug-Ins/VST3/CosimoEnhancerLiteShelvesAudition.vst3`
- Bundle ID: `dev.cosimo.enhancer-lite-shelves-audition`
- Version: `0.2.0`
- Architectures: `x86_64 arm64`
- Signature: valid ad-hoc (`codesign --verify --deep --strict`)
- Installed binary SHA-256: `9e3a0502e6e635e903b69ac620d00503eb0d7acf0be3170db2e09affc7c50379`
- Accepted Lite before/after SHA-256: `7e89cd2ae0e063a0d25b2ca4f7f1e2d2e422affc154f41164fbdb29fb9c7fcd3`

## Focused Evidence

- `npm run test:cmajor:enhancer-lite`: 7/7
- `npm run test:enhancer-lite:state`: 18/18
- Focused Enhancer Lite browser build/test: 11/11, including source/compiled pointer-to-handle coupling for Bell, Low, and High
- `npm run test:enhancer-lite:audio`: pass; Bell/full-Enhancer comparison remains green
- `npm run test:enhancer-lite:shelves`: pass against 284-case Spectre shelf corpus
- `node --test tests/test_enhancer_lite_shelf_corpus.mjs`: 1/1; copied input and output sample tampering rejected
- `node scripts/measure_enhancer_lite_shelves.mjs --verify-corpus`: 20 inputs and 284 outputs authenticated as decoded Float32 audio
- `/Applications/pluginval.app/Contents/MacOS/pluginval --strictness-level 5`: `SUCCESS`
- Final comparison report SHA-256: `ec168de4147d2aa559b6bdcd210ff6b3881ea023e5f748d7d8d33213eb3c2b9c`

Ignored evidence paths:

- `build/t26-spectre-shelves/` — 284 cases, 20 stimuli, 17 sessions
- `build/enhancer-lite-shelf-review/report.json` — final numerical comparison
- `build/enhancer-lite-shelf-review/listening/` — 96 raw/static-matched WAV files, 147,457,920 bytes
- `build/enhancer-lite-shelf-release/pluginval/CosimoEnhancerLiteShelvesAudition-pluginval.txt`

## Host Boundary

After Andrew explicitly cleared the host, Ableton Live 11.3.43 restarted into a blank `Untitled` set and found the unique `CosimoEnhancerLiteShelvesAudition` browser result. The host log confirms:

- Name/version: `CosimoEnhancerLiteShelvesAudition` v0.2.0
- VST3 class ID: `ABCDEF019182FAEB436F736943734C53`
- Host parameter count: 10
- Editor window: `CosimoEnhancerLiteShelvesAudition/2-Audio`

The compiled editor rendered the packaged wordmark, response/analyzer surface, Shape, routing, character, and intensity controls. Host-WebView clicks switched Low -> High -> Bell, then Stereo -> M/S -> Stereo. M/S exposed independent Mid and Side amount readouts and two graph handles. The editor remained open and responsive with no Live crash; Bell/Stereo defaults were restored. No set was saved, no unrelated set was open, and the empty audition set/editor was left open for inspection. This is a load/editor interaction smoke, not a new musical listening sign-off.

The earlier failed same-bundle multi-instance attempt remains a tooling warning: Computer Use cannot safely distinguish two `com.ableton.live` processes, so future host automation must use a user-cleared host or a PID-addressable method.
