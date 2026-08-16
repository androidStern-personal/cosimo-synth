# ADR-012: Effects Rack Modulation Destinations

Status: accepted.

## Decision

Every continuous creative parameter owned by a rack module is eligible to be a
modulation destination, including Mix/Wet.

V1 does not allow modulation of:

- rack order;
- module-enabled state;
- discrete effect algorithms or modes;
- other enumerated switches whose meaning cannot be represented as a continuous
  modulation range.

Macros are global-domain sources and require no reducer. MSEGs, Envelopes,
Velocity, MPE Pressure, and MPE Slide are voice-domain sources and require a
Maximum or Mean reducer when targeting the global rack.

## Consequences

- Modulation mappings retain a continuous amount and polarity interpretation.
- Rapid modulation cannot repeatedly reconfigure effect algorithms or rack
  structure.
- A future discrete-modulation feature requires its own transition semantics and
  is not implied by this rack design.

