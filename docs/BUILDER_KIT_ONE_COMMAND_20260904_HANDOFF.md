# Builder Kit one-command installation — September 4, 2026

## Outcome and authority

BK-21B is implemented, independently reviewed and published as **v0.1.2**.
The actual published installation command and safe rerun passed in an approved
fresh private folder on the host Mac. Earlier unpublished installer qualification
passed separately in a supported Mac VM copy. These are distinct proofs; neither
establishes a final live-VM or pristine-operating-system installation.

The publication addendum below records the separately authorized release,
exact source and live evidence. The original qualification record is retained.

Andrew's approved contract is the BK-21B section at planning commit
`c1adaf268cebc74e865ff259751f04217b3b52f0`. That historical planning branch was
not merged or cherry-picked. Scope is installation only: one prefilled line,
existing credential/feed/setup, explicit JUCE disclosure and acknowledgment,
automatic setup/final checks, failure propagation and preservation of work.

Coordinator: Bob, task `01a06784-1cfc-7f43-be19-5c93ade6f53a`, branch
`codex/builder-kit-cx-integration-20260904`, worktree
`/Users/winterfell/.codex/worktrees/77d5/cosimo-synth`.

Implementation owner: same task, agent `/root/entry`, branch
`codex/bk-21b-one-command`, worktree `/private/tmp/bk21b.B2H5ZG/entry`.
Independent source reviewer: `/root/native`; coordinator proof-driver reviewer:
`/root/presets`.

## Committed scope

- Starting source: `16f206d24cda68415ebfeffc28a13f4a0981c9ef`.
- Owner implementation: `70d8fc7ac7f00cc1abd91b6b7b08d88e2bfde008`.
- Owner cache-containment repair: `b1a46d2790d9d35782ec6fcab802500e0b40f100`.
  Owner handoff is clean and frozen.
- Coordinator canonical test wiring: `92627305`.
- Reviewed source integration: `1b692dff` (includes both owner commits).

Customer code comprises `kit/install/bootstrap.sh.template` and
`kit/scripts/complete_install.mjs`, plus narrow root README, AGENTS and ignore
template changes. Maintainer delivery uses `scripts/builder-kit-install.mjs`
and `scripts/prepare_builder_kit_install.mjs`. The existing release script
publishes content-addressed installers in its verified immutable-object phase,
before mutable refs and the manifest. Documentation and three regression test
files explain/prove those boundaries. `package.json` includes the new test in
the existing canonical release-contract gate.

No dependency pin, lockfile, DSP, example, plugin identity, UI bundle, native
build/install implementation or CI workflow was changed. Coordinator tracker
and handoff edits are separate from the customer payload.

## Initial implementation verification

- Owner focused installation/publication/release run: **37 passed, zero failed
  or skipped**, 14.822 seconds.
- Integrated `npm run test:kit:release-contracts`: **67 passed, zero failed or
  skipped**, 16.498 seconds.
- Integrated `npm run test:kit:export`: **7 passed, zero failed or skipped**.
- Bash/JavaScript syntax and `git diff --check`: passed.
- Source comparison against owner `b1a46d27`: only coordinator tracker and
  canonical package-test wiring differ before this handoff documentation.
- Independent review has no remaining Blocker or Should Fix finding.

The new installer test is reached through both canonical `npm test` and the
existing kit CI. That CI uses Ubuntu and deliberately skips the macOS-arm64
execution body; portable parsing/publication coverage is not a substitute for
the separate real Mac qualification below. No new remote CI result is implied
by the local counts above.

### Exact-command Mac qualification

The final driver recorded **70 passing outcomes**. The supplied one-line file
was passed unchanged to `/bin/zsh -f` on stdin from an unrelated starting
folder. Its credential was available to the installer without being printed.

| Scenario | Result |
| --- | --- |
| Fresh project with no Node/CMake in customer PATH and empty package cache | Exit 0; prepared in 24 seconds |
| Same command after tracked, untracked and ignored customer edits | Exit 0 in 3 seconds; files, HEAD, index and status preserved |
| Invalid access | Exit 1; specific download refusal, no ready message, new destination empty |
| Complete matching installer body followed by failed transfer | Exit 1; installer was not executed and repository acquisition did not start |
| Unrelated occupied destination | Exit 1; exact safety refusal and unchanged sentinel/directory |
| Fresh-shell dependency and strict checks, before and after rerun | Passed; actual Node 22.23.2, CMake 4.3.4 and both verified kit tools current |
| Conflicting uppercase/mixed-case external package-cache settings | Effective cache is project-owned; outside cache remains empty |

The candidate is a committed composed export of owner `b1a46d27`, not a live
directory overlay. Its private local customer Git commit is
`6d54ddd9a73ca2a416dcae5583d33b9760d9e6a9`; installer SHA-256 is
`319320fa717dc5c1e87a9b61cce668b9d9c07295ea9431e8ab277d145f6513ef`.
Those unpublished fixture identities are not production release identities.

The test Mac is an ordinary VirtualBuddy duplicate of the existing customer
VM, running macOS 26.6.2 arm64 with already-installed, already-accepted Apple
Command Line Tools. Final customer inputs are fresh under
`/Users/andrew/bk21b-proof-cache-2`. Client PATH is only
`/usr/bin:/bin:/usr/sbin:/sbin`; Node/CMake and npm packages are newly downloaded.
Old guest Node runs only the test driver/loopback server and is never a customer
PATH entry. This proves fresh project/runtime/cache installation, not a fresh
macOS installation or automatic acceptance of Apple agreements.

Candidate source/installer are served only on guest loopback; the client uses
the actual existing published tool archives and official runtime downloads.
No imported client tools, package cache or maintainer-local feed file prepares
the project. The original VM and earlier proof are preserved. Test media is
private and read-only; no shared host folder or LAN service is used.

Existing tool archive hashes remain:

- cmaj: `2f170724ca44d1c0e9bd7d0bf23f961794dc707211c3048cbf133e9593eb545d`
- CmajPlugin: `7f5bb5dd9d916b1f47437d5f7a366fedd0cbed0f1fa74887f3f8ee9e7d53ed8b`

## Review repairs and decision audit

Review rejected and repaired trusting runtime version strings without payload
integrity, writable linked control/setup paths, forced recreation of customer
history, inherited Git trace sinks and failed-transfer execution. Their focused
tests exercise real shell/Git/archive/npm/setup boundaries.

The first VM driver passed its original 65 checks, but coordinator disk
inspection found that inherited `NPM_CONFIG_CACHE` redirected 170 MiB outside
the promised project cache. This was treated as a **Blocker**, not accepted as
a harmless test pass. A red regression reproduced it; the repair normalizes
all casing variants at shell activation and independently at the npm-child
boundary. The final fresh-root proof adds effective-cache and unchanged-outside
cache assertions. The first attempt is preserved, not relabeled as final proof.

Coordinator judgments after independent review:

- **Accepted, low:** project-local pinned runtimes/cache instead of changing
  machine defaults or profiles. Costs per-project storage; subsequent agent
  shells activate the shipped environment automatically from root instructions.
- **Accepted, explicit prerequisite:** macOS 15+ arm64 with Apple Command Line
  Tools and user-accepted agreements. Unsupported setup stops with a precise
  requirement; no installer silently accepts system agreements.
- **Accepted, low:** buffer and verify transfer completion plus SHA before
  execution. `pipefail` alone does not prevent execution of a complete-looking
  failed download.
- **Accepted, preservation over automatic recovery:** changed kit code,
  questionable links/runtime contents, unexpected history or interrupted locks
  stop for inspection. No reset, forced replacement or unrelated cache cleanup.
- **Accepted, required for cache containment:** the project cache overrides
  inherited cache preferences; unrelated npm settings remain intact.
- **Accepted, release consequence:** delivery must match exact manifest installer
  metadata. Older published releases cannot silently claim this new flow.

## Initial qualification evidence and boundary

Durable private qualification root:
`/Users/winterfell/Library/Application Support/BuilderKitReleases/BK21B-20260904-qx24mS`.
`QUALIFICATION.md` distinguishes both attempts. `final-evidence/` contains
scanned redacted logs/results; private commands/media/export remain separately
under `final-private/`. Never place populated command files in source Git or
public evidence. The existing capability-bearing private feed/export format is
unchanged, not a newly claimed credential-storage migration.

The initial qualification did not publish a release. Publication was subsequently
authorized and completed as recorded below. Plugin build/install, browser/DAW
launch, listening, naming repair and Spacebar repair were not part of this work.
The held naming work and subsequent first-plugin proof remain separate.

## Authorized v0.1.2 publication and live proof

- Exact released source: `b48a09575477b67e391e6b17476c04ddd90ad08d`.
- Customer lineage commit: `5d19dfe2aabeeb77a63e83470b8115dbf08c823a`.
- Annotated `v0.1.2` tag: `0a82af2d55c29a3548bf4729521f3fb1d2829e7d`.
- Installer SHA-256:
  `0a6e159cec49ad298f7cb07af84cbc02d9b93c17ba0a4053ee0a5a70ecd1f30a`.
- Source differs from qualified base `1c6511b9bfa575100daecda65c30aa680feba19b`
  only in `kit/kit.json` version, two `kit/toolchain.json` artifact prefixes,
  and the stale strict expected-path assertion in `tests/test_release_builder_kit.mjs`.
  Three files, four insertions/four deletions; all other bytes match.
- Final release contracts: **67/67**; export checks: **7/7**, zero skips/failures.
  [GitHub run 33882904203](https://github.com/androidStern-personal/cosimo-synth/actions/runs/33882904203)
  succeeded for the exact released source. Independent source review is clear.
- Canonical 140-file customer export passed typecheck, customer tests, example
  UI build and update-flow merge. Canonical additive publication and live byte
  checks passed. Existing v0.1.1 tag/commit and both tool archives were preserved;
  all compiler/dependency/runtime pins and tool bytes/hashes remain unchanged.

Woods authorized a fresh private host destination after the VirtualBuddy chooser
prevented final live VM execution. No app was force-quit, VM configuration changed,
or exclusive desktop access assumed. Both VM copies and original projects were
preserved. The final live proof ran on macOS 26.6.2 arm64, with pre-existing Apple
developer tools, system-only customer PATH, fresh project-local runtimes/cache
and no hidden maintainer setup or private Git credentials.

Independent review confirmed **126 recorded outcomes**: 121 passing assertions,
four completed command runs and one expected HTTP-denial observation. Installation
passed in 27 seconds; rerunning the same command passed in 3 seconds and preserved
tracked, untracked and ignored customer work, Git HEAD/index/status. Invalid
access and an unrelated occupied folder exited 1 safely. Fresh-shell checks
verified Node 22.23.2, CMake 4.3.4, both published tools current by archive and
payload, the live feed, the populated owned cache and empty inherited cache.
There were no failed assertions. The expected product-owner placeholder warning
remains; no first-plugin or Ableton acceptance is implied.

The normal unchanged generator prepared Andrew's private command for
`/Users/winterfell/src/builder-kit-0.1.2`; that directory was not created.
The tested line used `/private/tmp/bk21b.B2H5ZG/live-host-proof/projects/success`
instead. Exactly two destination occurrences differ; replacing them makes the
command bytes equal. Credential, live download, installer hash and JUCE
acknowledgment are otherwise identical. Do not describe the full destination
text as byte-identical or the host proof as a final live VM/pristine-OS proof.

Private release root:
`/Users/winterfell/Library/Application Support/BuilderKitReleases/v0.1.2-20260904-86xvBV`.
`customer-delivery/delivery.txt` is the ready-filled user delivery;
`customer-delivery/command.sh` contains the line. Both are mode 0600 under a
mode-0700 directory, outside Git. `RELEASE_REPORT.md`, `host-preparation.json`
and `host-evidence/` retain the release identities, command hashes, redacted
results/logs and proof boundary. No populated command belongs in Git.

Publication decision audit:

- **Accepted, low:** publish a new immutable version and reuse exact verified
  tool archive bytes, instead of replacing v0.1.1 or rebuilding pinned tools.
- **Accepted, low:** compare the release test's expected artifact to the supplied
  toolchain path; retaining the old literal would reject an authorized version
  bump. Strict forwarding, version and path-traversal checks remain in place.
- **Accepted by Woods, explicit evidence limit:** test actual published delivery
  in a fresh private host folder after the VM UI blocked. This resolves the
  live-download check but does not replace clean-VM or first-plugin acceptance.

This documentation-only follow-up does not change the published source or payload.
No marketing/site deployment, installed-plugin change, global-runtime change,
naming repair or Spacebar repair was performed during publication.
