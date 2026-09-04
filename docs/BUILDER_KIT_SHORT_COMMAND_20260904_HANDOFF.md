# Builder Kit short installation command — September 4, 2026

## Outcome

The approved short command is published and passed its actual live installation
and safe rerun. This corrects Andrew's rejection of the earlier giant inline
launcher. It reuses the immutable v0.1.2 private installer and kit; it is not a
new kit release or a plugin/DAW acceptance claim.

Product authority is the corrected BK-21B contract at planning commit
`04a53377`. Woods approved this complete literal before publication; only the
dummy key is replaced in the actual private delivery:

```sh
export BUILDER_KIT_ACCESS='DUMMY_KEY'; curl -fsSL https://pub-2bb7a8a7b9b44ed3b975f3f0a6bcc756.r2.dev/install.sh | bash
```

There is no pasted destination, checksum, encoded program or additional setup
command. The existing JUCE notice accompanies the private line. Hosted code owns
destination validation, temporary files, private download verification and the
existing installer dispatch. The default is `$HOME/src/builder-kit-0.1.2`.

Woods independently checked and accepted the **actual populated file**: one
line, 153 characters/154 bytes including newline, the exact approved pattern
and no extra launcher. He also confirmed its SHA, file/directory permissions,
matching anonymous public-script readback and the untouched intended project.

## Source and ownership

- Coordinator Bob: task `01a06784-1cfc-7f43-be19-5c93ade6f53a`, branch
  `codex/builder-kit-cx-integration-20260904`, worktree
  `/Users/winterfell/.codex/worktrees/77d5/cosimo-synth`.
- Owner `/root/entry`: branch `codex/bk-21b-short-public-entry`, worktree
  `/private/tmp/bk21b-short.QYUb2v/entry`, frozen commit
  `68b2b1c06239852443feb0d0681bf9eb74a3eb57`.
- Rebased owner: `64e23541341f8e9ed2da04205e9e72e9e4dd4c0d`; comparison with
  the frozen owner changed only `TODOS.txt`, not customer/source code.
- Published source, normally pushed to master and read back exactly:
  `2ebd88eb6eea83cea04f0291301214b369fc0696`.
- Independent source reviewer: `/root/native`; private operation/driver and
  completed-evidence reviewer: `/root/presets`.

The implementation changes exactly five files, 267 insertions/53 deletions:

- `scripts/builder-kit-install.mjs`
- `scripts/prepare_builder_kit_install.mjs`
- `scripts/templates/builder-kit-public-install.sh.template`
- `tests/test_kit_install_command.mjs`
- `docs/BUILDER_KIT_DELIVERY.md`

All `kit/` files, private installer rendering, release/tool/runtime pins,
examples, native code, generated synth bundles and root package metadata remain
unchanged by this correction. Independent comparison covered private rendering
across five synthetic inputs; preparation also required real production-render
byte equality. The original private installer is still SHA-256
`0a6e159cec49ad298f7cb07af84cbc02d9b93c17ba0a4053ee0a5a70ecd1f30a`.
Customer lineage remains `5d19dfe2aabeeb77a63e83470b8115dbf08c823a`.

## Verification

- Owner focused installation/publication/release tests: **41/41**, zero
  failures/skips, 15.153 seconds.
- Coordinator post-integration `npm run test:kit:release-contracts`: **71/71**,
  zero failures/cancelled/skips, 17.687 seconds.
- Syntax and whitespace checks passed. Independent source review had no
  remaining Blocker or Should Fix findings.
- Independent completed-evidence review found no blocking inconsistencies
  across the 11 scanned evidence files and three safe receipts.
- Obsolete `projectDir` and `installerOrigin` inputs refuse before preparation
  writes anything. Their former silent removal was found in review and repaired
  with an observable no-output regression test before integration.

The actual live proof recorded **124 outcomes**: **119 passing assertions**, four
command runs and one expected HTTP-404 observation for invalid access:

| Run | Exit | Duration |
| --- | --- | --- |
| New installation | 0 | 36 seconds |
| Same command after customer edits | 0 | 4 seconds |
| Invalid access | 1 | Less than one second |
| Unrelated occupied destination | 1 | Less than one second |

Success, rerun and occupied-case command bytes are exactly the actual customer
delivery bytes, SHA-256
`8c43972cd1f12b2c9d61e6c456359cbbb6d2f2154660ae98d3ff101edfb2dca1`,
154 bytes including the newline. Test isolation supplied only
`BUILDER_KIT_PROJECT_DIR` through the customer subprocess environment; HOME and
clipboard bytes were not rewritten. Invalid access used a synthetic key.

The proof used `/bin/zsh -f` on macOS arm64 with system-only customer PATH and
no initial Node/CMake on that PATH. Fresh project-owned Node 22.23.2,
CMake 4.3.4, downloaded tool archives/payloads, npm cache and live feed passed
strict first-install/fresh-shell checks before the dirty rerun, without repair.
Tracked, untracked and ignored customer work, HEAD, index and status were
preserved; conflicting inherited npm cache stayed empty; no credential or
saved private remote/FETCH_HEAD remained in Git configuration/state. The
expected product-owner placeholder warning remains; this was not a
warning-free doctor result.

This is the authorized fresh private host-folder fallback, **not** a new VM,
pristine operating system, test of the default HOME destination, plugin build,
plugin install or Ableton/listening test. The live proof did not inject failure
at the published public URL; focused local tests cover public HTTP/truncation
failures. It does not supersede the separate first-plugin customer acceptance.

## Publication and private delivery

Only the public root object `install.sh` was added. Read-only preflight returned
404; anonymous readback after publication and after the live proof returned 200,
3318 bytes, exact SHA-256:

`ab2b2be033220524af40c967c6fef4aa148e54c8a183d3f6204dfc7d59eac373`

The public payload was scanned against the actual credential and full private
feed URL before and after publication. Existing private manifest and installer
bytes were read back unchanged; no private prefix, old artifact, tag or archive
was republished. No DNS, account, global runtime or installed-plugin change.

Current private root (mode0700, outside Git):
`/Users/winterfell/Library/Application Support/BuilderKitReleases/BK21B-short-20260904-6J3NCu`.

- **Deliver `customer-delivery/delivery.txt`**; `customer-delivery/command.sh`
  contains the same filled line. Both files are mode0600. Do not paste either
  file's contents into Git, reports or tool output.
- `preparation.json`, `publication.json`, `completion.json` and
  `RELEASE_REPORT.md` retain safe identities and evidence boundaries.
- `host-evidence/` contains 11 completed evidence files scanned against the real
  credential and full private feed URL before copying; no matches.
- Intended `/Users/winterfell/src/builder-kit-0.1.2` was not created.
- Do **not** deliver the superseded giant-line file under the older
  `v0.1.2-20260904-86xvBV` directory.

Reviewed driver SHA-256:
`d8b1fe0e03590b02a7d7938812bc67fdbd50f862e3cfea0225480152605c54b4`.
The preparation operation required that exact driver before the actual run.

## Coordinator decision-provenance audit

- **Accepted product choice, explicit trust/status limit:** the short public
  curl/Bash shape replaces the rejected inline hash/trailer receiver. Public
  first-stage trust is HTTPS-origin trust. An empty failed fetch can print a
  curl error while the outer pipeline returns Bash 0. A complete executable body
  followed by a late curl failure can already run; Bash cannot observe that
  later curl status. Downstream private execution still requires successful
  full transfer and the pinned SHA. No claim of the old receiver guarantee.
- **Low, accepted:** reuse immutable v0.1.2 and the existing hosting rather
  than manufacture a new kit version or dependency delivery system. Current
  maintainer instructions are `docs/BUILDER_KIT_DELIVERY.md`; the historical
  shipped `kit/docs/EXPORT.md` remains unchanged and is not the current entry
  instruction. [Cloudflare's R2 documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/)
  describes r2.dev as rate-limited development hosting, not launch-scale
  production hosting; no new DNS work was inferred.
- **Low, accepted:** keep the exact private clipboard bytes under test and
  isolate only through a validated subprocess destination variable. Rewriting
  HOME or the command would weaken that evidence. Strict path/symlink refusal
  is retained; the default destination remains untested and untouched.

This completion follow-up changes documentation/trackers only; the published
source and payload remain the exact identities above. Naming, Spacebar and
first-plugin/Ableton acceptance remain separate work.
