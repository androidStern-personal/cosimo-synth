# ADR-029: Versioned URL-fragment sound sharing

Status: accepted and implemented — 2026-08-24

## Context

Cosimo needs a browser-native way to move a sound between people and fresh
browser sessions without adding a server or publishing user sound data to
request logs. The sound contract is broader than public parameters:
`modulation.v6`, `articulations.v4`, Bounce state, and the current lane tree
all affect what is heard. Preset-v2 already owns strict parameter and stored
document contracts, contract hashes, and migrations, while `lane.v1` currently
names an Init-only adapter carrying a canonical lane-v2 document.

Loading also cannot bypass the synth's existing unsaved-sound policy. A URL
must never silently replace the current sound, and a sampled Bounce bank is far
too large to embed in a useful URL.

## Decision

### Carrier and encoding

Sound links use the URL fragment `#p=2.<payload>`. T28 intentionally rejects
the pre-Polish `#p=1` complete-sound carrier. The versioned
`cosimo.soundShare` envelope contains:

- one exact preset-v2 document, including its contract identity, public
  parameters, modulation, articulation, and the null Bounce reference; and
- `supplementalStoredState`, currently the canonical serialized lane-v2 value
  in the historical `lane.v1` slot.

The browser adapter strictly parses the four envelope fields, rejects duplicate
JSON keys and non-JSON/non-finite data, deflates with native
`CompressionStream`, and base64url-encodes the result. Decode is bounded to
3,250,000 bytes before JSON parsing. A native implementation is the primary supported
path; a small vendored deflate implementation is reserved only for a supported
browser demonstrated to lack the native streams.

The final URL may be copied normally through 8,000 characters, warns while
remaining copyable through 128,000, and is refused above 128,000. Incoming
payloads are subject to equivalent fragment and decompressed-size bounds.

The threshold is measured against the current contract rather than inherited
from generic URL folklore. Default and representative sounds are about
3.0–3.2K characters. The deliberate current maximum fills all 150 public
parameters, 1,484 legal modulation pairs, 96 MSEG shape points, all 128
articulation slots with every override and articulable route, and all eight
Effects Lane devices. With the generated performer's complete endpoint
contract it is 3,110,089 bytes before compression, 71,656 characters as a
Chromium link, and 118,164 as a WebKit link. The clean-session UI harness's
equivalent saved-sound fixture is 2,872,473 bytes because its endpoint metadata
is minimal; its 68,043-character Chromium and 105,139-character WebKit links
were copied exactly and reopened in clean desktop and phone sessions. The
generated maximum therefore remains below both the 3,250,000-byte decode cap
and the 128,000-character URL cap while retaining strict refusal headroom for
unbounded names or shapes.

Each `osc*WavetableSelect` remains the ADR-021 durable projection of the
ordered factory `tableId` ledger. Capture and load both prove that all three
selected slots exist in the current browser's shipped catalog. A custom slot,
a factory slot unavailable to that recipient, or a catalog that is not ready
is refused before any sound mutation.

### Load transaction

The app boots normally and decodes a matching fragment only after the synth
preset controller is ready. It always presents a first, explicit
“Load shared sound?” confirmation. The controller then normalizes preset-v2
against the current live contract with the existing synth migration chain and
strictly normalizes every supplemental document before any write.

If the current sound is dirty, the already-existing Save / Discard / Cancel
replacement transaction remains the only way forward. A successful load is an
unnamed clean sound whose label and Revert baseline are the shared sound.
Parameters and all owning documents apply through the existing atomic sound
transaction and rollback path. Only after success does `history.replaceState`
remove the fragment. Cancellation and rejection retain the original URL.

### Sampled sounds and future seam

Any sound with `sourceMode=sampled` or a non-null `bounce.v1` reference is
rejected before encoding or mutation with:

> Bounced sounds can't be shared by link yet

The envelope stays versioned so a future server-backed, digest-addressed audio
bank can be designed without making today's links silently load a sampled sound
with missing audio.

## Consequences

- Fragments do not reach HTTP servers or ordinary request logs, and no sharing
  service is required.
- Link fidelity inherits preset-v2's exact current-contract validation and
  migration behavior rather than defining a second patch schema.
- Lane state remains explicit even while its persistence slot is outside the
  preset-v2 contract; moving it into that contract later changes one envelope
  adapter, not the URL protocol.
- Corrupt, oversized, version-skewed-without-a-migration, and partial documents
  fail as values before sound mutation.
- Browser sharing is intentionally unavailable from native `file:` surfaces.

## Rejected alternatives

- Query parameters were rejected because they are sent to servers and commonly
  logged.
- Raw JSON was rejected because representative complete sounds are needlessly
  long; fragment deflate keeps typical links practical.
- A second bespoke patch schema was rejected because it would fork contract
  identity, validation, and migration ownership from preset-v2.
- Embedding Bounce audio or loading only its lightweight reference was rejected:
  the former is tens of megabytes and the latter creates a silent or wrong
  sound.
- Silent boot-time replacement was rejected because it can destroy unsaved
  work before the user knows what the link contains.
