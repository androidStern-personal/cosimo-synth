# ADR-006: Effects Rack V1 Inventory

Status: accepted.

## Decision

The v1 named-module inventory includes:

- Global Filter;
- Distortion;
- OTT;
- Chorus/Bloom;
- Flanger;
- Phaser;
- Delay;
- Reverb.

A final safety limiter, if present, remains fixed after the creative rack and is not
a reorderable module.

## Current Implementation Status

- Distortion and Chorus/Bloom are currently wired into the synth as a fixed chain.
- OTT exists as a substantial standalone processor with its own preset descriptors
  and tests. The synth graph declares five OTT parameters but does not instantiate
  or connect the OTT processor, so integration is still required.
- The existing Chorus contains all-pass diffusion internally, but the repository
  does not contain a rack-ready Flanger or Phaser processor.
- The global rack Filter, Delay, and Reverb processors still need to be selected or
  implemented.

Flanger and Phaser are separate independently enabled and reorderable effect
instances with separate parameters and modulation identities.
