# Serum Wavetable Bundling Plan

## Current state

The repo already has a working factory-bank compiler:
- raw source WAVs live in `assets/factory_sources/`
- `assets/factory-table-catalog.json` declares one source file per table
- `build_assets.py` loads those WAVs through `wtbank.load_source_table_wav()`
- `wtbank.build_bank()` compiles the packed immutable bank
- generated outputs are `assets/factory-bank.wav` and `assets/factory-bank.json`

The supplied archive has been staged at:
- `assets/incoming/serum_tables/Tables.zip`

That archive is not usable yet. It contains only directories in the ZIP central
directory and no actual `.wav`, `.wt`, `.fxp`, or nested archive payloads.

## Recommended bundling shape

Do not point the app directly at a nested Serum library dump.

Use a two-step pipeline:
1. Stage raw third-party bundles under `assets/incoming/`.
2. Normalize selected tables into flat source WAVs under `assets/factory_sources/`,
   then add them to `assets/factory-table-catalog.json`.

This keeps the runtime compiler simple and keeps the app bundle independent from
whatever directory conventions Serum packs happen to use.

## Normalization rules

Each selected Serum wavetable should be normalized to one source WAV file with:
- mono audio
- `int16` or `float32` sample format
- total sample count divisible by `2048`
- frame count between `1` and `256`

One normalized WAV becomes one app table.

If the incoming library eventually contains:
- `.wav` files already matching the contract: copy them directly into
  `assets/factory_sources/`
- nested directories of `.wav` files: flatten selected files into
  `assets/factory_sources/` with sanitized stable names
- proprietary Serum preset files such as `.fxp`: do not build around them; export
  wavetables to WAV first, then ingest the WAVs
- nested archives: unpack them into `assets/incoming/serum_tables/extracted/`,
  inspect, then normalize

## Proposed implementation work

### Phase 1: importer hardening
- Add a staging importer script, likely `tools/import_serum_tables.py`
- Inputs:
  - a staged directory or ZIP under `assets/incoming/`
  - an allowlist of selected table paths or glob patterns
- Responsibilities:
  - recurse through nested directories
  - optionally unpack nested ZIPs into a temp directory
  - detect candidate `.wav` files
  - validate each file against the existing `load_source_table_wav()` contract
  - copy accepted files into `assets/factory_sources/`
  - emit proposed catalog entries with sanitized `tableId` and `name`
  - fail loudly on ambiguous duplicates or unsupported formats

### Phase 2: catalog generation
- Stop hand-editing `assets/factory-table-catalog.json` for imported tables
- Add a generated section or a separate import manifest such as
  `assets/imported-table-catalog.json`
- `build_assets.py` can merge:
  - manually curated built-in tables
  - imported local-test tables

### Phase 3: local testing profile
- Add a local-only catalog profile so big personal test banks do not have to become
  default shipped content
- Example:
  - `assets/factory-table-catalog.json`: minimal checked-in default bank
  - `assets/factory-table-catalog.local.json`: optional expanded local bank
- `build_assets.py` can accept a flag or env var to build the local profile when
  present

## Smallest next step once you provide a real archive

1. Extract the real Serum WAVs from the source bundle.
2. Pick a first small subset, around 8 to 16 tables.
3. Normalize and copy those WAVs into `assets/factory_sources/`.
4. Add catalog entries for that subset.
5. Run `uv run python build_assets.py`.
6. Rebuild the iPhone app and live plugin.

## Why this shape is correct

The current bank compiler already solves the runtime problem. The missing piece is
not DSP conversion logic; it is controlled ingestion of messy external libraries.
By keeping external bundles in staging and only feeding validated WAVs into
`assets/factory_sources/`, we avoid contaminating the shipping asset pipeline with
vendor-specific nesting and format quirks.
