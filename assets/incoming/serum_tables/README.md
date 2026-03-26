This directory is a staging area for third-party or user-supplied wavetable bundles
before they are normalized into `assets/factory_sources/`.

Current contents:
- `Tables.zip`: copied from `/Users/winterfell/Downloads/Tables.zip`

Current status:
- The provided ZIP is not directly ingestible. Its central directory contains only
  nested folders and zero actual files, so there are no Serum wavetable WAVs to
  import yet.

Expected normalized target:
- Individual mono `.wav` files in `assets/factory_sources/`
- One catalog entry per source in `assets/factory-table-catalog.json`

Importer contract for normalized source WAVs:
- mono only
- PCM16 or float32 only
- total sample count divisible by 2048
- resulting frame count in the range 1..256
