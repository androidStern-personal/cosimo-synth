# BK-13B / BK-22A private candidate delivery plan

This plan uses the current Builder Kit release and short-installer code to give
Woods a private, loopback-only customer installation of the final integrated
source. It does not publish a release, update the customer channel, reuse a
source-only export, or edit the included Enhancer Lite example.

## Existing route

`scripts/release_builder_kit.mjs` already owns the candidate payload. Its
`runRelease` API with `dryRun: true`:

1. requires an exact clean source commit;
2. exports that committed source twice, proves the second export, and leaves
   the first export unchanged;
3. on macOS builds and archives the pinned `cmaj` and `CmajPlugin.vst3`;
4. commits the export to a throwaway lineage repository and makes dumb-HTTP
   `kit.git`, `cmajor.git`, and `choc.git` mirrors;
5. hashes the tool archives, stamps the hashes into the exported toolchain,
   and writes a manifest plus content-addressed private installer; and
6. skips the lineage push and object publication.

The proof includes the canonical exported typecheck/tests, an unchanged
Enhancer Lite build, and the update-merge simulation. The separate `proof/`
copy is allowed to become dirty; `export/` is the tree committed to lineage.

The final Cmajor source pin comes from
`kit/cmake/CosimoDependencies.cmake`. The declared canonical source is
`https://github.com/androidStern-personal/cmajor.git`; its relative
`../choc.git` submodule resolves to
`https://github.com/androidStern-personal/choc.git`. At the current source pin,
`04ee24df55c4a3ba9f67d498a70c19de1aa1ad79`, the cached immutable tree has the
required relative CHOC URL and gitlink
`98b52fb54c3b9fec03c0c13218f6557aef33eabe`. Candidate preparation must repeat
those checks against the final pins. It must not infer provenance from a cached
repository remote.

Before the serialized Mac run, make fresh private mirrors from those two fixed
GitHub repositories and confirm the final commits are present. Do not print
remote configuration. Pass the private mirror paths through the existing
`--cmajor-source` and `--choc-source` arguments; this makes `--dry-run` create
the two source mirrors instead of omitting remote sources. Use a fresh
candidate-only `CPM_SOURCE_CACHE` so the tool build fetches from the committed
GitHub dependency source rather than consulting an older cached remote.

```text
git clone --mirror https://github.com/androidStern-personal/cmajor.git <private-candidate-root>/sources/cmajor.git
git clone --mirror https://github.com/androidStern-personal/choc.git <private-candidate-root>/sources/choc.git
git -C <private-candidate-root>/sources/cmajor.git cat-file -e <final-cmajor-sha>^{commit}
git -C <private-candidate-root>/sources/choc.git cat-file -e <final-choc-sha>^{commit}
```

After placing the reviewed temporary adapter in the mode-700 private candidate
root, its invocation is:

```text
node <private-candidate-root>/candidate_delivery_adapter.mjs \
  --repo <absolute-final-integrated-checkout> \
  --source-sha <final-integrated-40-hex-sha> \
  --cmajor-source <private-candidate-root>/sources/cmajor.git \
  --choc-source <private-candidate-root>/sources/choc.git
```

The adapter reads the version from `kit/kit.json` at the requested commit,
sets a fresh candidate-only `CPM_SOURCE_CACHE`, and supplies the exact
`--dry-run` release arguments programmatically. The required
`--destination-config` parser slot receives a nonexistent private placeholder;
`runRelease` does not read it when the caller injects `destination`.

Do not add `--skip-tools` when either fork pin changed. The default macOS path
builds both archives from the final pin, checks the patched CHOC marker in the
VST3, hashes the new archives, and binds those hashes into the exported
toolchain, manifest, and installer. The release command uses fixed build
directories under `build/`; their clean preparation and the run belong to the
coordinator's serialized native slot.

## Private short entry

The public production bootstrap cannot select an unpublished candidate: its
bytes pin the published private installer. The CLI form of
`prepare_builder_kit_install.mjs` also reads the configured HTTPS feed origin
and production Keychain capability.
Its `--public-bootstrap-url` changes only the first curl URL, so that flag alone
would still fetch the private installer and tools from the production feed.

The existing programmatic boundaries do support a fully local candidate:

- `runRelease(options, { destination })` accepts a redacted loopback feed URL;
- `renderBootstrap` accepts HTTP only for numeric loopback hosts;
- `prepareInstallation` accepts a redacted loopback `feedOrigin` and a
  loopback `/install.sh` URL; and
- the tested customer fixture already serves `/install.sh` publicly and maps
  `/<capability>/...` to a private feed tree.

Use one temporary, uncommitted Node adapter outside Git to compose those APIs.
It must perform this literal sequence:

1. Generate a fresh 32-byte base64url test capability with
   `crypto.randomBytes`, immediately wrap it with the existing `redact` helper,
   and never print or persist it except through `prepareInstallation`'s
   mode-600 private delivery files. Do not read the production destination
   configuration or Keychain.
2. Bind an HTTP server to `127.0.0.1` on an OS-selected port before rendering
   the candidate. Do not use LAN, wildcard, Tailscale, Funnel, ngrok, request
   logging, directory listings, redirects, or a non-loopback listener.
3. Call `parseArgs` with the arguments above and call `runRelease` with
   `dryRun: true`. Supply a redacted destination whose `feedUrl` is
   `http://127.0.0.1:<selected-port>/<capability>` and whose unused dry-run
   `r2Target` ends in the same capability. Inject fail-closed
   `checkPublisher`, `pushRelease`, and `publishObjects` callbacks so any
   accidental non-dry-run path stops.
4. Call `prepareInstallation` with the returned manifest, the same capability,
   a destination object whose redacted `feedOrigin` is the numeric loopback
   origin without the capability, a fresh private output directory, and
   `publicBootstrapUrl` equal to that origin plus `/install.sh`.
5. Serve only the generated credential-free `public/install.sh` at
   `/install.sh`. For the exact capability path, serve regular files beneath
   `release-stage/feed/` after normalized-path containment checks. Return a
   generic refusal for every other path. Never copy the capability into logs,
   reports, process titles, or committed files.
6. Give Woods only the generated private `delivery.txt`. It has the approved
   one-line shape: access export followed by curl of `/install.sh`. Woods does
   no source overlay, archive substitution, or maintainer preparation.

The adapter's composition core is the existing API sequence below. The server
handler and all paths remain private temporary code; `refuse` throws if any
network mutation callback is unexpectedly reached.

```js
const redactedCapability = redact(randomBytes(32).toString("base64url"));
const capability = reveal(redactedCapability);
const origin = `http://127.0.0.1:${server.address().port}`;
const localDestination = Object.freeze({
    feedUrl: redact(`${origin}/${capability}`),
    r2Target: redact(`candidate:unused/${capability}`),
});
const staged = await runRelease(parseArgs(releaseArguments), {
    destination: localDestination,
    checkPublisher: refuse,
    pushRelease: refuse,
    publishObjects: refuse,
});
const prepared = await prepareInstallation({
    manifest: staged.manifest,
    destinationConfig: { feedOrigin: redact(origin) },
    capability: redactedCapability,
    outputDir: privateDeliveryDirectory,
    publicBootstrapUrl: `${origin}/install.sh`,
});
if (!prepared.ok) throw new Error(prepared.error.code);
```

The adapter is temporary orchestration around existing repository APIs, not
release infrastructure. Keep it and all generated delivery files outside Git. Retain
the process only for the coordinated Woods run, then stop it without touching
the production feed or public bootstrap.

Portless is unnecessary here. Its HTTPS route is accepted as an inner feed
origin, but the short-entry renderer rejects a custom HTTPS bootstrap URL; only
the approved production URL or numeric HTTP loopback is allowed. Portless would
also add personal proxy and CA state to a deterministic customer-delivery gate.

## Candidate identity and validation

`--version` must equal the committed `kit/kit.json` version, and both tool
artifact paths must remain under `tools/v<version>/`. If the final source still
says `0.1.2`, the private throwaway lineage may use its local `v0.1.2` tag: it
does not push or replace the immutable published tag. Woods must run in an
isolated customer home/destination so the default `builder-kit-0.1.2` folder is
unoccupied. A version bump is a separate product/release decision and is not
needed merely to identify this candidate. Record the final source SHA, local
lineage commit, manifest, fork commits, installer hash, and tool hashes as the
candidate identity.

Before handoff, verify without exposing private values:

- source HEAD equals the requested SHA and its full status is empty;
- both fresh source mirrors contain the final Cmajor and discovered CHOC
  commits, with Cmajor still using the relative CHOC submodule URL;
- `release-stage/feed/manifest.json` names the final source SHA and local
  lineage commit;
- the two staged archive digests equal the manifest and exported toolchain;
- the staged installer digest equals its content-addressed filename and
  manifest entry;
- the public bootstrap contains no capability or capability-bearing feed URL;
- anonymous requests can read only `/install.sh`, wrong capabilities cannot
  read the private tree, and an exact-capability read returns the staged bytes;
- the lineage checkout contains the unchanged exported Enhancer Lite source;
  and
- no `rclone`, Git push, production HTTP write, public-bootstrap replacement,
  plugin install, or host launch occurred.

Woods' short install, unchanged-example build/install, DAW naming and Spacebar
checks, saved-state/update/recovery journey, and listening remain product and
host acceptance after this packaging gate.

## Authority boundaries

The coordinator owns the final composed source SHA, fresh build directories,
native tool build, temporary loopback server, and Woods handoff. A changed
Cmajor or CHOC commit must first exist at the fixed canonical GitHub repository
and exact SHA; if it exists only in a worker checkout, an authorized fork push
is the one external prerequisite. No private feed upload is required.

Publication remains a separate action: do not omit `--dry-run`, pass a real
lineage clone, call `publishReleaseObjects`, upload a new public `install.sh`,
or change the customer update channel. The existing production destination
configuration and Keychain capability are not inputs to this candidate. The
ephemeral capability, populated command, and private URLs must remain out of
ordinary output and committed evidence.
