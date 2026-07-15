# Mobile UI Prototype Architecture

This folder is the parallel React/Vite implementation of Cosimo's future iOS
sound-design experience. It is not wired to the real synth yet, but it is built
to be ported rather than discarded.

## React composition

- `App` owns only the prototype fixture. It creates `useMockCosimoAdapter` and
  injects it into `CosimoMobileExperience`.
- `CosimoMobileExperience` composes five persistent product regions: instrument
  header, module rack, focused workspace, source shelf, and audition transport.
- Feature packages own their own JSX and CSS: `shell`, `rack`, `module-editor`,
  `modulation`, `sources`, and `audition`.
- Shared visual primitives live under `design-system`; pointer/gesture behavior
  lives under `interactions`.

## State boundary

- The adapter snapshot contains patch-owned sound state and live audition state.
- Adapter commands are the only mutation surface the UI controller consumes.
- The controller owns UI-session state such as workspace focus, shallow return
  paths, selected relationships, popovers, and transient value feedback.
- Prototype-only fixture focus is injected through `initialSession`; it is not
  imported by the product controller or encoded in the adapter snapshot.
- Domain selectors turn synth state into presentation view models. Feature
  components do not know whether the adapter is mock data or the real bridge.

## Production port

The next integration step is to implement the same `CosimoMobileAdapter`
contract against the iOS/Cmajor host and render `CosimoMobileExperience` with
that adapter. The mock reducer remains useful for Storybook-like fixtures,
interaction tests, and states that are difficult to stage against live DSP.

The prototype accepts `?fixture=stress` to render a deterministic compact-width
QA state with maximum and signed values, a bypassed module, a sparse articulation
override, orphan and attached sources, and a retrospective capture candidate.
This fixture remains behind the mock adapter and does not leak into product
components.

No production Cosimo UI file should be changed until that adapter integration is
explicitly authorized.
