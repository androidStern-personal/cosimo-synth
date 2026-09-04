# Native VST3 installation

## Context

Dedicated macOS plugin installation must permit first installs and normal
same-identity updates without replacing a different plugin that happens to
have the same filename. A failed update must leave the prior version
recoverable. No ownership registry is required.

## Decisions

**Identity comes from the actual signed bundle.** The installer reads
`CFBundleIdentifier` and loads the bundle in a bounded child process to inspect
its VST3 factory. Exactly one audio processor class must be advertised. Both
the bundle identifier and processor class identifier must match for an update.
The child never instantiates a processor or editor; a failed or timed-out
factory inspection stops the install. Copied `moduleinfo.json` and a factory
compiled from the new build's settings cannot prove an existing binary's
identity, so neither is used. This is identity inspection, not a host or audio
validation run.

The small helper is compiled with the production build using the existing
pinned JUCE SDK headers and macOS CoreFoundation. Installation does not compile
it or fetch another tool. Builds predating the helper need to be rebuilt.

**Installation preserves the build's signature.** Candidate, stage, and
installed copy must pass signature verification and the required patched
WebView marker check. The existing bundle must have a valid signature and
readable identity but need not contain the replacement's current markers.
Re-signing at install time would conceal a damaged copy and replace a supplied
signature, so installation does not do it. The normal production build still
signs its output.

**Replacement is a recoverable transaction.** A private sibling directory
outside the VST3 scan directory stages `candidate.vst3` and retains
`previous.bundle`; rollback can retain `failed.bundle`. Its name is
`.<productName>.vst3.install`. Exclusive directory creation also prevents two
instances of this installer from working on the same destination. A pending
directory is never silently removed or reused.

Moves use macOS `renamex_np(RENAME_EXCL)` so a newly appeared destination is
not overwritten. The installer checks the actual captured directory entry and
payload digest after every move, including when the helper exits unsuccessfully
after the syscall. An unexpected capture or blocked rollback is retained and
reported for manual inspection. This deliberately favors recoverability over
an automatic retry that could discard another installer's bundle.

Only after post-promotion verification may the prior copy be retired. A cleanup
failure after success does not roll back a verified install. During failed
installation, restoration protects the original version; cleanup may remove
some disposable staged children before encountering an unremovable remainder.
The command reports the exact retained location, not a promise that every
staged file survived cleanup. Bundle identity paths cannot be symlinks;
contained relative resource links are supported, while escaping links stop
installation.

## Verification boundary

`npm run test:kit:native-install` in a customer repository runs
`node --test kit/tests/vst3_install_native.test.mjs`. This explicit macOS gate
needs Node, CMake 3.28 or newer, the Xcode Command Line Tools C++ compiler,
macOS tools (`codesign`, `plutil`, `chflags`), and the existing pinned JUCE
source in the shared CPM cache or network access to fetch it. It builds tiny actual factory
binaries and exercises the production installation module in isolated fixture
directories. Run it separately from other native builds. It is deliberately
excluded from `npm test`: unit tests must not acquire native compilation or
dependency-download requirements. Non-macOS runs skip the native cases.

The gate covers identity collisions, signatures, markers, failed copy and
promotion, rollback, concurrent replacements, subprocess failures, and symlink
containment. It does not install into a user's plugin folder or prove DAW scan,
display, editor, parameter, or audio behavior.
