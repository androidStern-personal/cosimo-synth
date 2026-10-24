# Toolchain and download feed

Two committed files tell a project where its prebuilt tools come from and how
to verify them. `kit:setup` installs from them, `kit:doctor` checks against
them, and both are replaced by kit updates; edit neither by hand.

## `kit/feed.json`

```json
{ "schemaVersion": 1, "baseUrl": "https://<feed>/<your access path>" }
```

`baseUrl` is the download feed of your Builder Kit delivery. It must be an
https URL. It carries your access path, so the kit's commands never print it:
diagnostics name the artifact or say "the kit feed" instead, and the dev
server refuses to serve the file. Treat it like any private credential and do
not paste it into issues or chats.

The feed serves three things: the tool archives below, the release history
that `kit-update` merges from (`<baseUrl>/kit.git`), and the Cmajor sources
that native builds fetch (`<baseUrl>/cmajor.git`, set in
`kit/cmake/dependency-sources.cmake`).

## `kit/toolchain.json`

```json
{
  "schemaVersion": 1,
  "cmaj": { "forkCommit": "<40-hex>", "artifact": "tools/v<version>/cmaj-macos-arm64.tar.gz", "sha256": "<64-hex>", "localPath": "build/kit-tools/cmaj" },
  "cmajPlugin": { "artifact": "tools/v<version>/CmajPlugin-macos-arm64.zip", "sha256": "<64-hex>", "localPath": "build/kit-tools/CmajPlugin.vst3" },
  "requirements": { "os": "macOS", "minMacOS": "15.0", "arch": "arm64", "node": ">=22", "cmake": ">=3.28", "xcodeCommandLineTools": true }
}
```

- `artifact` is the archive's path under `baseUrl`; each release keeps its own
  `tools/v<version>/` folder, so an older kit still finds its tools.
- `sha256` pins the archive. `kit:setup` refuses to install an archive whose
  hash differs, records the installed files' digest in a receipt beside
  `localPath`, and treats any later change to those files as stale.
- `forkCommit` is the Cmajor fork commit the tools were built from; it matches
  the pin in `kit/cmake/dependencies.cmake`.
- `requirements` is what `kit:doctor` and `kit:setup` check the machine
  against.

## Which `cmaj` a build uses

`fx:prod:build` and `fx:jit:install` use `BUILDER_KIT_CMAJ` when it is set to
an absolute path of an executable (for someone who builds the pinned fork
themselves), otherwise `build/kit-tools/cmaj` when its receipt and files match
`kit/toolchain.json`. Anything else stops with a message naming
`npm run kit:setup`. A global `cmaj` on `PATH` is never used.
