# Enhance That trial and full release

The `codex/enhance-that-trial-release` branch extends the installed, accepted
0.1.5 installer repair. Source, DSP, state and plugin IDs are identical between
variants. Product version is 0.1.7; the existing Builder Kit is not rebuilt.

`VITE_ENHANCE_THAT_TRIAL=1` compiles in the editor reminder. Ordinary/customer
builds default to full. There is no expiration tracking, activation, audio dropout,
or state change. Closing/reopening the editor shows the reminder again. Purchase
uses an explicit native bridge opening the fixed store checkout in the browser.

The release builder owns the flag; do not manually alter source between variants:

```
node scripts/build_enhance_that_release.mjs --release --include-au --version 0.1.7 --variant trial
node scripts/build_enhance_that_release.mjs --release --include-au --version 0.1.7 --variant full
```

Outputs are separated under `release/enhance-that/0.1.7/{trial,full}/release`.
The same installer identity and bundle paths ensure normal replacement. The
builder requires clean committed source, signing/notarization and an allocated
`COSIMO_CMAKE_JOBS` budget. It never installs or promotes production itself.

The Song Machines store's `npm run release -- prepare <version>` coordinates
these existing builds with immutable upload and sandbox delivery. Its publish
command promotes the exact approved files, never a new native build.

Acceptance remains separate: signed package checks, pluginval, actual install,
Ableton trial reminder/checkout, trial-to-full saved-project recall, and sandbox
purchase delivery. Do not publish on the basis of compilation alone.
