# Bounce in Place — native persistence contract

Status: M7 browser implementation lock. Browser persistence, recursive
retention, and bounded-cycle accounting are implemented and tested; the native
store/driver portion of this contract is implemented and exercised in M8.

## Invariants shared with the browser

- `bounce.v1` is the small, canonical patch/preset document. It contains the
  SHA-256 digest, encoded byte length, roots/segments, capture metadata,
  generation, and the one-level Revert snapshot. It never contains PCM.
- A bank is the exact `CSBNK001` byte stream defined by
  `bounce/bank-format.mjs`, named by lowercase SHA-256. The digest covers the
  complete header and interleaved stereo i16 payload.
- Each V1 root record uses its formerly reserved fourth word for the logical
  note-off frame offset. This lets sampled playback distinguish a genuinely
  early live release from the release already baked into PCM, which prevents
  recursive generations from applying the same amp fade twice. Zero remains
  the backwards-compatible value for hand-built/pre-M7 banks with no baked
  note-off metadata.
- Restore verifies the filename digest, byte length, format/version, frame
  capacity, ordered roots, contiguous segments, and SHA-256 before staging
  anything into DSP. Sampled mode becomes audible only in the staged bank's
  commit callback. Failure keeps or returns the engine to oscillator mode and
  presents a typed, actionable error.
- File access, hashing, allocation, decoding, state-chunk construction, and
  garbage collection are forbidden on the audio thread. Only the existing
  bounded, acknowledgement-paced bank messages and atomic commit cross into
  the performer.

## Canonical on-device store

The native `BounceBankStore` uses this layout:

```text
<container>/CosimoSynth/BounceBanks/v1/
  bank-<64 lowercase hex SHA-256>.csbk
  .staging-<digest>-<random>.tmp
```

An install writes a same-directory staging file, flushes and closes it,
reopens and verifies it, then performs a no-replace atomic rename. A racing
writer is success only when the winner verifies under the same digest. Startup
removes stale `.staging-*` files. A failed write never publishes a final
filename or changes `bounce.v1`.

### iOS and AUv3

The standalone app and AUv3 resolve the shared container for the existing App
Group `group.dev.cosimo.wavetable-synth`, declared in
`ios_auv3/Entitlements/CosimoSharedWavetableLibrary.entitlements`. Banks live
under:

```text
<App Group>/Library/Application Support/CosimoSynth/BounceBanks/v1/
```

This is the same container-resolution pattern already used by
`CosimoSharedWavetableLibrary.mm`; both processes therefore see one
content-addressed bank. Production must fail visibly if an entitled build
cannot resolve the group container. A development-only standalone fallback
may use its own `NSApplicationSupportDirectory`, but an AUv3 must not pretend
that such a private file will be visible to the containing app.

Bank files are excluded from iCloud backup because they are derived audio and
may be recreated or transferred. Apply data protection compatible with an
active audio extension after first device unlock; never open or hash them from
`processBlock`. Backgrounding, interruption, or extension teardown cancels an
uncommitted install and leaves the last active bank intact. On reactivation,
obtain the new DSP session ID and restart staging from the verified file; an
acknowledgement from the previous session cannot commit.

### macOS/desktop

Desktop standalone and plug-in wrappers use JUCE's
`userApplicationDataDirectory`, conventionally resolving to:

```text
<Application Support>/CosimoSynth/BounceBanks/v1/
```

Do not place banks next to the app bundle, plug-in bundle, project, or current
working directory. Multiple instances may read a digest concurrently. Writers
use unique staging names and the same verify/rename rule; garbage collection
uses an interprocess store lock and never unlinks an open candidate.

## DAW state and the portable option

The default DAW chunk stores only normal parameters plus `bounce.v1`; it
resolves the digest from the application-support store. This keeps routine
host automation/state saves small.

An explicit **Embed bounced audio in project** option adds one native-only
stored-state entry, `bounce.bank.v1`, containing a binary envelope followed by
the exact `CSBNK001` bytes:

```text
magic="COSIMOB1", envelopeVersion=1, digest[32], byteLength:u64, bankBytes[]
```

No base64 or JSON PCM is permitted. `CosimoCmajorPlugin.h` already serializes
each Cmajor stored-state value to a binary `juce::var` property inside the
JUCE `ValueTree`, and `getStateInformation` writes that tree directly to the
host `juce::MemoryBlock`. The portable envelope must use that binary path.
The current asynchronous `setStateInformation`/`setNewStateAsync` flow remains
the restore boundary: validate the envelope, copy/extract it off the audio
thread into the content store, then stage it for the current DSP session.

Portable restore rules are deterministic:

1. If an embedded bank matches `bounce.v1`, verify it and install it into the
   local digest store idempotently before DSP staging.
2. If both embedded and local bytes exist, both must verify to the same digest;
   the content-addressed bytes are equivalent.
3. If the embedded envelope is corrupt, do not fall through to a same-named
   unverified file. Report `corrupt-embedded-bank` and use oscillator fallback.
4. If embedding is off and the local digest is absent, report `missing-bank`
   with actions to locate/import the bank or Revert. Never show a working
   sampled-source UI over silence.

The chunk can be tens of MiB. M8 validation must measure save/load latency and
chunk size in Ableton, confirm exact recovery after deleting the local store,
and verify that hosts tolerate the selected bank capacity. If a host imposes a
smaller state limit, retain digest-only state and make the portable-option
failure explicit; do not silently truncate.

## Presets, Revert, and retirement

Synth presets carry `bounce.v1`, not bank bytes, unless exported through a
future explicitly portable preset container. Loading a preset resolves and
verifies its digest before sampled mode commits. Pre-Bounce presets migrate to
`bounce.v1: null`.

The live patch digest, its `revertRef.bankDigest`, every local user-preset
digest, and any in-flight state save are roots for retention. M7 may retire a
superseded bank only after computing this reachable set and after the DSP
inactive slot no longer owns it. Garbage collection is conservative across
processes: an unrecognized index/version, lock failure, or incomplete scan
means retain. Revert is single-level and restores the exact saved patch
document; it must verify/stage the referenced prior bank before publishing the
document.

The M7 browser implementation takes an exclusive Web Lock, validates the
recognized store/preset schemas, retains both the audible and direct-Revert
digest for each local user preset, and deletes only an explicitly superseded
ancestry digest after the next successful double-buffer install has overwritten
the inactive DSP slot. A file-backed preset catalog, unavailable lock,
unrecognized entry, or incomplete full-state read is a no-delete result. Native
M8 must preserve those rules with its interprocess store lock and file-backed
preset scan.

## M8 validation checklist

- Signed standalone and AUv3 resolve the same App-Group bank and survive app,
  extension, and device relaunch.
- AUv3 interruption/background/foreground and sample-rate/session changes
  cannot commit stale staging work.
- Desktop standalone and plug-in instances share application-support bytes
  without races; read-only project restore works after app restart.
- Digest-only missing/corrupt cases show typed oscillator fallback; portable
  chunks recover after the local bank is removed.
- Ableton save/load, duplicate-instance, collect/archive, and project transfer
  tests preserve audio and `bounce.v1`; measured chunk and restore costs are
  recorded in `BOUNCE_LOG.md` and `HUMAN_VALIDATION.md`.
- Instruments confirm no file I/O, hashing, locks, heap allocation, or
  unbounded loop occurs in `processBlock` or the sampled render path.
