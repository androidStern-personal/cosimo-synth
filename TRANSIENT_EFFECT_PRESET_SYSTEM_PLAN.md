# Transient Plan: Shared Effect Presets

Last updated: 2026-04-16

This is a transient planning document for the effect preset system. It records the target architecture before implementation work starts.

## Goal

The preset system must save and restore the complete audible state of a plugin.

For simple effects such as OTT Lab and Chorus Lab, the audible state is the set of saveable Cmajor parameters. For more complex effects such as SeqFX, the audible state is the set of saveable Cmajor parameters plus plugin-owned structured state, such as the SeqFX matrix.

The system must be strict. It must not silently drop unknown values, silently fill missing values, or partially apply a stale preset.

## Core Decision

Use exact contracts plus explicit migrations.

A preset records the exact plugin state contract it was captured against. Loading a preset requires one of two things:

1. The preset contract hash exactly matches the current plugin contract hash.
2. A hand-written migration exists from the preset contract hash to the current plugin contract hash.

If neither is true, the preset is incompatible and must fail loudly without applying anything.

## Terms

`Plugin state contract` means the full list of state required to reproduce the audible result.

`Parameter contract` means the saveable Cmajor parameters exposed by the running patch.

`Stored-state adapter` means plugin code that captures and restores sound-producing state that is not represented as Cmajor parameters.

`Contract hash` means a SHA-256 hash of the canonical plugin state contract.

`Migration` means explicit code that converts a preset from one contract hash to another.

## Sources Of Truth

There are two sources of truth.

1. Cmajor status is the source of truth for host parameters.
2. Plugin adapters are the source of truth for non-parameter state.

The preset system is not a source of truth. It only captures, validates, migrates, and applies the state exposed by those two sources.

## State Contract Shape

The shared contract object should look like this conceptually:

```ts
type PluginStateContract = {
    effectID: string;
    parameters: ParameterContract[];
    storedState: StoredStateContract[];
    hash: string;
};
```

For OTT Lab, `storedState` is probably empty.

For SeqFX, `storedState` includes the `seqfx.v1` matrix state.

## Parameter Exporter

The shared parameter exporter reads the running Cmajor patch status:

```ts
status.details.inputs
    .filter(input => input.purpose === "parameter")
    .filter(input => !input.annotation?.hidden)
```

That exported list replaces the current hand-written preset descriptor allowlist.

Every saveable Cmajor parameter should be captured. If a parameter affects the audible result and the user expects presets to recall it, it must not be hidden.

Hidden/internal parameters such as `hostSlot0Guard` are excluded from presets and snapshots.

## Parameter Contract Fields

Each parameter contract should include fields that affect validity or meaning:

```ts
type ParameterContract = {
    endpointID: string;
    type: "number" | "integer" | "boolean";
    min?: number;
    max?: number;
    step?: number;
    defaultValue: number | boolean;
    discrete?: boolean;
    text?: string;
};
```

Do not include cosmetic grouping or display-only UI fields in the hash unless they change the meaning of a value.

Changing a display label such as `Mix` to `Wet Mix` should not break presets.

Renaming an endpoint ID such as `mix` to `ottMix` should break presets unless a migration exists.

Adding a parameter such as `envelopeBoostClampDb` should break old presets unless a migration explicitly supplies its value.

## Stored-State Adapters

Some plugin state cannot be discovered by asking Cmajor for parameters. SeqFX is the concrete example: the sequencer matrix is stored as JavaScript/Cmajor stored state and uploaded to DSP through the `patternUpload` event.

The adapter shape should be roughly:

```ts
type PluginStoredStateAdapter<T> = {
    key: string;
    schemaVersion: number;

    capture(): T;
    normalize(value: unknown): T;
    serialize(value: T): unknown;
    apply(value: T): void;

    getContract(): StoredStateContract;
};
```

For SeqFX, the adapter owns `seqfx.v1`.

Conceptually:

```ts
const seqFxMatrixAdapter = {
    key: "seqfx.v1",
    schemaVersion: 1,

    capture() {
        return serializeSeqFxState(seqFxBridge.getState());
    },

    apply(value) {
        const state = normalizeSeqFxState(value);
        seqFxBridge.replaceStateFromPreset(state);
        patchConnection.sendStoredStateValue("seqfx.v1", serializeSeqFxState(state));
        seqFxBridge.uploadSelectedPatternToDSP({ authoritative: true });
    },
};
```

The adapter reads the matrix from `SeqFxRuntimeBridge`, not from the DOM. It writes restored state back to Cmajor stored state and uploads the selected pattern to DSP so the restored state is immediately audible.

## Stored-State Contract Fields

Each stored-state adapter contributes a contract entry:

```ts
type StoredStateContract = {
    key: string;
    schemaVersion: number;
    required: true;
};
```

If a plugin changes the shape of a stored-state value, bump the adapter schema version. That changes the contract hash and requires an explicit migration for old presets.

## Preset JSON Shape

The next preset format should be version 2.

```json
{
  "kind": "cosimo.effectPreset",
  "version": 2,
  "effectID": "ott",
  "presetID": "user.ott.my-preset",
  "label": "My Preset",
  "contract": {
    "hash": "sha256:...",
    "parameters": [],
    "storedState": []
  },
  "parameters": {
    "bypass": false,
    "ottMix": 86,
    "ottAmount": 92,
    "envelopeBoostClampDb": 6
  },
  "storedState": {}
}
```

For SeqFX, the shape includes matrix state:

```json
{
  "storedState": {
    "seqfx.v1": "{...serialized matrix...}"
  }
}
```

The embedded contract is evidence of what the preset was saved against. The current running plugin still provides the current source of truth.

## Contract Hash

Compute the contract hash from canonical JSON.

Rules:

- sort parameters by `endpointID`;
- sort stored-state entries by `key`;
- include fields that affect validation or value meaning;
- exclude cosmetic display grouping;
- include enum/discrete metadata when it changes meaning;
- hash with SHA-256;
- prefix the stored hash string with `sha256:`.

The hash should change when an endpoint is added, removed, renamed, or semantically changed.

## Save Flow

Saving a preset must be complete and strict.

1. Build the current contract from Cmajor status plus stored-state adapters.
2. Track or request every parameter in the current contract.
3. If any parameter value is missing, fail and do not save.
4. Capture every stored-state adapter value.
5. Validate the captured payload against the current contract.
6. Write the preset with the current contract hash and all values.

There should be no partial presets.

There should be no hand-written list that says OTT saves only `ottMix`, `ottAmount`, or similar. The patch provides the parameter list.

## Load Flow

Loading a preset must validate before applying.

1. Parse preset JSON.
2. Validate `kind`, preset file `version`, `effectID`, `presetID`, and `label`.
3. Build the current contract from the running plugin.
4. If the preset contract hash matches the current contract hash, validate exact keys and values.
5. If the hash differs, look for an explicit migration path.
6. If a migration path exists, run it.
7. Validate the migrated preset exactly against the current contract.
8. Apply only after validation passes.

Validation requires:

- no unknown parameters;
- no missing parameters;
- no unknown stored-state keys;
- no missing required stored-state keys;
- correct value types;
- values inside current ranges;
- stored-state values accepted by their adapter normalizer.

Applying is atomic at the validation boundary. No parameter writes or stored-state writes happen until the full preset is known to match the current plugin.

## Migrations

A migration is explicit code from one contract hash to another.

Example:

```ts
{
    effectID: "ott",
    fromHash: "sha256:old",
    toHash: "sha256:new",

    migrate(oldPreset) {
        return {
            ...oldPreset,
            parameters: {
                ...rename(oldPreset.parameters, {
                    mix: "ottMix",
                    amount: "ottAmount",
                    timePercent: "ottTimePercent",
                }),
                envelopeBoostClampDb: 6,
                envelopeCutClampDb: 6,
                envelopeAttackMs: 5,
                envelopeReleaseMs: 120,
            },
        };
    },
}
```

Migration rules:

- no automatic dropping unknown parameters;
- no automatic filling missing parameters;
- no automatic clamping;
- every rename is written down;
- every added parameter gets an explicit value;
- every removed parameter is intentionally removed in migration code;
- every stored-state schema conversion is plugin-specific code;
- exact validation still runs after migration.

Chained migrations are allowed only through registered steps. For example, `hashA -> hashB -> hashC` is valid only if both steps are registered.

If no complete migration path exists, loading fails.

## Failure Behavior

Failure should be loud but not destructive.

When a preset is incompatible:

- do not apply it;
- do not import it into the user bank;
- do not delete it;
- report the concrete diff.

Example message:

```text
Preset was saved for an older OTT contract.

Unknown saved parameters:
- mix

Missing current parameters:
- ottMix
- envelopeBoostClampDb

No migration is registered from sha256:old to sha256:current.
```

The preset browser can show an incompatible preset and allow inspection/export, but applying it must fail until a migration is registered or the preset is manually repaired.

## A-G Snapshots

A-G snapshots should use the same contract engine as presets.

The difference is storage and UI:

- presets live in the preset bank;
- A-G snapshots live in local slots or another snapshot-specific store;
- both capture the same full state shape;
- both require exact contract match or explicit migration.

The current OTT A-G localStorage system should stop being a separate mini-preset format with its own validation rules.

If A-G slots remain scratch-only, `localStorage` is acceptable. If they must survive DAW project save/reopen, they must move to Cmajor stored state.

## Production Stored State

Use Cmajor stored state for production preset banks and preset metadata.

The existing stored-state key is:

```ts
export const EFFECT_PRESETS_STATE_KEY = "effects.presets.v1";
```

This stored state owns:

- user preset banks;
- active preset metadata per effect;
- label and dirty state.

It should not replay active preset sound values on boot. On DAW project restore, the host/Cmajor parameter state owns the current sound, and plugin-owned stored-state adapters own their own current structured state.

Applying a preset is a user action. Project load is not automatically preset apply.

## Endpoint Stability Rule

Endpoint IDs are public API once presets or DAW automation can reference them.

Default rule: do not rename endpoint IDs. If the control has the same meaning, keep the endpoint ID stable and only change display annotations.

If a rename is unavoidable, add an explicit preset migration. DAW automation compatibility is a separate problem and may require keeping a compatibility parameter in Cmajor, but do not add compatibility parameters just for preset migration.

## Expected Change Cases

Adding a parameter changes the contract hash. Old presets fail until a migration explicitly adds the parameter value.

Renaming a parameter changes the contract hash. Old presets fail until a migration maps the old name to the new name.

Removing a parameter changes the contract hash. Old presets fail until a migration intentionally removes the old value.

Changing a range or type changes the contract hash. Old presets fail until a migration transforms or rejects old values.

Changing the SeqFX matrix schema changes the stored-state adapter contract. Old presets fail until a migration rewrites `seqfx.v1`.

## Implementation Order

1. Add the shared contract exporter from Cmajor status.
2. Add canonical contract hashing.
3. Replace hand-written preset parameter descriptors with runtime contracts.
4. Add the stored-state adapter interface.
5. Change preset payloads to version 2 with `contract`, `parameters`, and `storedState`.
6. Add exact validation for current-contract presets.
7. Add the migration registry keyed by `effectID`, `fromHash`, and `toHash`.
8. Convert factory presets to full v2 presets and test them against the current contract.
9. Wire OTT and Chorus through the runtime parameter contract.
10. Wire SeqFX with a `seqfx.v1` stored-state adapter.
11. Rebuild A-G snapshots on top of the same capture/validate/apply engine.
12. Remove old allowlist assumptions and any default clamping during preset load.

## Acceptance Tests

The test suite should prove these behaviors:

- runtime contract exporter includes every non-hidden Cmajor parameter;
- runtime contract exporter excludes `hostSlot0Guard`;
- captured presets include every current parameter;
- save fails if any current parameter value is unavailable;
- loading fails on unknown parameters;
- loading fails on missing parameters;
- loading fails when contract hashes differ and no migration exists;
- registered migrations convert old presets and then exact validation runs;
- migration failure does not write parameters or stored state;
- applying a valid preset writes all parameters;
- applying a valid SeqFX preset writes `seqfx.v1` and uploads the selected pattern;
- A-G snapshots use the same exact contract validation as presets;
- duplicate JSON keys are rejected before import;
- production preset code does not depend on `localStorage`;
- project boot restores preset metadata without replaying active preset values.

## Current Recommendation

Proceed with strict version 2 presets:

- Cmajor status exports the saveable parameter contract.
- Plugin adapters export non-parameter state contracts.
- Presets store complete state plus the contract hash.
- Presets load only on exact contract match or explicit migration.
- Unknown, missing, stale, or partial data fails loudly.

This keeps the system honest while still allowing deliberate compatibility when the plugin evolves.
