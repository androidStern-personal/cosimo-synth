# Enhance That release preparation

L3 owner: task `01a07068-7379-7cf2-80a0-b6dde894e350`, managed by Bob.
Branch: `codex/enhance-that-release`, initially based on
`origin/master@c297eeed62aec66e85118df06a229d9cdd8491da`.
Authority: the September 5 approved Enhance That launch handoff, SHA-256
`7ab692893201e3943912fcde4534146eb9bdcfe5c3014b7ed49f4535a8ee60b9`.
This is preparation, not a frozen candidate, qualified download, or publication.

## Current verified inputs

Read-only observations on September 5, 2026:

| Input | Observation | Boundary |
| --- | --- | --- |
| Published feed | HTTP manifest and live Git tags identify `0.1.2`, source `b48a09575477b67e391e6b17476c04ddd90ad08d`, kit `5d19dfe2aabeeb77a63e83470b8115dbf08c823a` | Predates the current fixes |
| Available next kit version | Live tags are `v0.1.0`, `v0.1.1`, `v0.1.2`; R2 tool directories are `v0.1.1`, `v0.1.2`. Select `0.1.3` for preparation | Recheck tags and immutable objects before staging/publishing; this read does not reserve a version |
| Private candidate | Source `c297eeed`, kit `c840a394094f3c6a9ea14b5f1a8041eb424b22ac` | Its private `0.1.2` label must never overwrite published `0.1.2` |
| Cmajor / CHOC / JUCE | `7820a453f25e1b6eaf898d0bb2feb7e4ce01c207` / `11f7dc63d7cb78f6dbaa559fe09ade8e941c0188` / `501c07674e1ad693085a7e7c398f205c2677f5da` | Final source, generated project and tool receipts must agree |
| Signing access | One Developer ID Application identity and one Developer ID Installer identity; existing notary profile reads two Accepted submissions | Availability only, not a signature or notarization for Enhance That |
| Local host | Apple Silicon macOS `26.6.2` (`25G83`); Ableton Live `11.3.43`; GarageBand `10.4.14` | Installed application metadata; no host launched or tested by L3 |
| Existing guests | Two installed VirtualBuddy guests both originate from macOS `26.6.2` (`25G83`); VirtualBuddy `2.1` | Guest cleanliness, host suitability and current running OS remain to be checked in an allocated slot |
| macOS 15 | No macOS 15 guest/restore image found in VirtualBuddy, Downloads, Documents or Desktop inventory | Retained-scope gap, not deferred or passed |

The live manifest SHA-256 was
`71c6adbc305a49ccdd0c6cc14575a7f370fab3b0f269f13ccabaa9857da63301`.
The initial HTTP 403 was specific to Python's default User-Agent: the same
authenticated location succeeded with a curl User-Agent. No capability changed.
Keep the feed URL, cohort, delivery command and credentials out of this document,
manifests, ordinary logs and public downloads.

## Exact inventory baseline

The canonical `kit/scripts/export_kit.mjs` exported committed `c297eeed` into
an isolated outside-repository directory. Required-file, allowlist and forbidden
string gates passed. The export reports 140 files before adding
`EXPORT_MANIFEST.json`; the resulting inventory contains 139 regular files,
two relative symlinks and 33 directories. No image, font, audio or SVG files
occur in this source export. This is not the final L1/L2 export or a build test.

Its canonical inventory tree SHA-256 is
`eb9b230cdf5e8948b98576176c68ba427358cf0bebfd69959ffb324b47b97ef6`.
The inventory includes relative paths, file sizes, SHA-256s, modes, directories
and symlink targets. It excludes neither files nor metadata silently.

| Shipped surface | Inventory and notices to finish against the final bytes |
| --- | --- |
| Free plugin | Generated ahead-of-time DSP, native wrapper and linked JUCE/CHOC/helper code; compiled WebView JavaScript/CSS and actual embedded assets; plugin and installer identities |
| Builder Kit source | Exact allowlisted export, root MIT license and third-party notices, L2 modification reference and instructions, source and lockfiles actually included |
| `cmaj` archive | Compiler/tool payload and archive hash, dependency pin and payload receipt; development tooling, permitted to contain JIT |
| `CmajPlugin` archive | Generic development loader payload, archive hash and receipt; development tooling, distinct from the finished plugin |
| Customer runtime downloads | Node/CMake installer pins and applicable upstream files; distinguish fetched prerequisites from files bundled in our downloads |

The existing `kit/template/root/THIRD_PARTY_NOTICES.md` is the customer notice
foundation. Retain broad Cosimo modification/distribution/sale rights and the
customer's JUCE disclosure. Do not copy `legal/seqfx/THIRD_PARTY_NOTICES.txt`
wholesale: it contains SeqFX assets, dependency assumptions and historical
unsettled-rights language that do not establish this release's actual inventory.
For example, a React re-export in `kit/index.ts` does not prove React survives
tree shaking into this plugin; inspect the generated bundle and native link
inputs before deciding the final embedded dependency list.

## Packaging operations after L1/L2 review

1. Bob supplies the exact composed source and explicit AU decision. Keep stable
   patch ID `dev.cosimo.enhancer-lite`, codes `CsEL` / `Cosi`, parameters and
   saved-state identities. Packaging reads the final plugin's own configuration.
2. Stage in a new owned directory with the newly verified version. Export with
   the existing canonical exporter and release APIs. `kit:release --dry-run`
   still performs substantial local proof/build work on macOS: it needs the
   allocated native slot. Do not run the normal publishing command merely to
   prepare a candidate; it pushes lineage and promotes the customer manifest.
3. Use worktree-local pinned tools and normal CPM dependency acquisition. Record
   source, kit lineage, archive hashes, payload hashes and actual dependency
   commits. Reuse verified archive bytes through canonical setup APIs; do not
   copy another worktree's installed tools or dependency checkout.
4. Build the dedicated plugin; retain generated CMake, actual compile/link
   inputs and binary dependency evidence. Demonstrate generated static DSP and
   absence of Cmajor JIT/LLVM engine linkage in the final plugin. Inspect the
   extracted distributed binary too. A strings scan alone does not prove this.
   The development compiler and generic loader are outside that no-JIT claim.
5. Assemble the same normalized unsigned payload twice and compare payload,
   package and ZIP bytes. This checks packaging repeatability of one native
   build, not independent native-build or signed-byte reproducibility.
6. Sign the finished payload and installer using the available Developer ID
   identities; submit to the existing notary profile; require Accepted, staple,
   stapler validation and Gatekeeper acceptance. Record exact signature facts
   and submission ID privately in the operator evidence, with only appropriate
   public signature metadata in the release manifest.
7. Expand the actual installer and ZIP. Verify payload inventory, signatures,
   architectures, metadata hygiene, matching executable/asset bytes, no-JIT
   evidence and native validator result on the extracted payload. Generate
   checksums only after signing/stapling has finished changing bytes.
8. Use those exact downloads for installation, host, clean-environment and L2
   final customer qualification. The existing generic installer preserves the
   candidate signature: do not ad-hoc re-sign a finished Developer ID plugin.
9. Bind all evidence to the final candidate digest. Requalify affected surfaces
   after changes. Keep the candidate unpublished until Andrew approves the
   exact publication and claims through the assigned operator.

The SeqFX release builder contains reusable packaging/verification primitives,
but its executable entry point is bound to SeqFX identity, distribution and
source-map policy. It is not an Enhance That build command. Final Enhance That
packaging needs its own scoped entry point; this preparation does not claim
that entry point or final signed artifacts already exist.

The L1 build from `954207e4` still embeds UI source maps. Commit `5d0a84d1`
adds generic `FX_DISTRIBUTABLE_RUNTIME=1` support while preserving normal builds
and the existing SeqFX switch. All 59 configuration tests pass. An actual L3
runtime build demonstrated the failure before the fix, then absence of the map
file/reference after it. The JavaScript excluding only the map-reference line
is byte-identical across ordinary and distribution builds. Final packaging
must use this switch and recheck its own generated and extracted native bytes.

Read-only L1 inventory confirms generated static-performer DSP, the
`GeneratedPlugin` wrapper, QuickJS, React and JUCE link inputs. Its dynamic
dependencies are Apple frameworks/system libraries, with no LLVM linkage
observed. Hashed source-map, generated-C++, link-recipe and notice inputs are
retained in the private evidence directory. These are preparation inputs;
the final no-JIT and notice records must come from the final own build and
extracted download.

## Rename migration discovered during preparation

L1's presentation rename changes the bundle filename from
`CosimoEnhancerLite.vst3` to `EnhanceThat.vst3` while retaining the real plugin
identity. The normal installer currently checks only the requested destination.
It would treat the new filename as a first install and leave the old filename
in the scan directory. Commit `e5d37fac` adds a generic `previousProductName`
config field and recoverable same-directory migration; 58 configuration tests
pass. Independent re-review passed the reporting repair in `4a4049e6`: failed
archive verification names the observed retained paths, and failure to remove
the old filename guard produces an explicit cleanup warning. Both workflow
replays passed, using scripted signing/factory adapters; native fault-injection
cases remain pending the assigned resource slot. The final composed product
still needs the legacy field applied to its sidecar through the L1/integration
owner.

Read-only local inventory found the old user-level bundle, version `0.1.0`,
bundle identifier `dev.cosimo.enhancer-lite`, executable SHA-256
`f613554813c461e1bf67fb122402f03deb297fe346e3bac7f2adb5ced44899ea`.
Neither filename exists in the system scan root; the new filename is absent
from the user root. No bundle was moved or installed.

Migration must identify the actual signed prior binary by both bundle ID and
processor CID, capture it outside scan roots without overwriting anything,
verify the replacement, and roll back to the original path on failure. Reject
different identities and ambiguous duplicates. Test first install, same-path
update, renamed-path update, interrupted promotion, rollback, and cross-root
duplicates. Preserve a recoverable old bundle. Bob allocated the generic source
files to L3; native/install slots remain separately allocated. The package's
cross-root behavior is still unimplemented and unqualified.

## Qualification matrix and smallest remaining environment decision

Required formats: VST3. AU is pending L1's bounded generated-AU/free-host
feasibility; GarageBand is installed. No Logic-access check is needed.
If AU is impractical, record the explicit VST3-only decision and align claims.
Both macOS 15 and 26 remain required for every retained format.

For each OS/format record exact OS/build/CPU, host/version, clean-user/private
credential boundary, artifact hashes, steps, observation and evidence file:

- Install, rescan and displayed name.
- Space ownership on ordinary controls, genuine text, numeric entry and drag.
- All eight sound controls: automation write/playback and continuous/discrete
  values, saved preset and **disk-saved DAW project** close/reload.
- Editor close/reopen; playback and offline export.
- Captured input/output audio with hashes and format details; Andrew's explicit
  musical acceptance of identified audio/settings. Spectra are not listening.

Prior evidence in `docs/BK_HOST_INTEGRATION.md` and the private customer RESULTS
is retained as history. The prior unchanged-example first install, preset/editor
round trip and Space/drag checks are not final-artifact, disk-saved project,
macOS 15/26 clean-environment, automation or listening completion.

The concrete parameter states, host-gesture recording, disk-project recall and
audio comparison procedure are in `docs/ENHANCE_THAT_HOST_QUALIFICATION.md`.

The smallest macOS 15 decision is access to an existing Apple Silicon Mac or
safe disposable VM running 15 with a suitable host, or authorization to prepare
a separate guest if an available compatible restore image can be established.
Do not reset an OS, buy a machine/host, create paid infrastructure, or relabel
the missing platform as deferred. Route this retained gap through Bob/Woods.

## Evidence tooling

`scripts/enhance_that_release_manifest.py` is a maintainer-only file inventory
and evidence-index checker. It does not certify the truth of host observations
or inspect signatures on behalf of the native verification commands.

```sh
python3 scripts/enhance_that_release_manifest.py inventory <payload-root> <new-inventory.json>
python3 scripts/enhance_that_release_manifest.py template <new-candidate.json>
python3 scripts/enhance_that_release_manifest.py subject <candidate.json>
python3 scripts/enhance_that_release_manifest.py check <candidate.json> --root <artifact-and-evidence-root>
python3 tests/test_enhance_that_release_manifest.py
```

The template starts entirely pending. Set exact source/kit/dependency commits,
version, formats and five artifact paths/hashes. Hash the candidate with
`subject`, then bind each result to that digest and its own evidence file/hash.
Evidence records should include command exit status and signature/notary facts
for package checks, and operator, host, OS, observations and captured-audio
references for human/host checks. One report may support several rows only when
it actually contains their separate observations. Retain limitations in the
manifest. A changed artifact invalidates older bindings; AU inclusion adds its
own matrix. A complete index never grants publication authorization.

Preparation artifacts are held under this owner's dated visualization directory
in `enhance-that-release/`: `source-baseline-export/`,
`source-baseline-inventory.json`, `live-feed-readback.json` and
`candidate-evidence.pending.json`. They contain no delivery capability.
