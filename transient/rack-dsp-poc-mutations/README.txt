Mutation evidence for transient/rack-dsp-poc/EffectsRackShape.cmajtest.

Each of these three variants of the rack is deliberately broken, and each is caught
by the proof suite. They are kept out of the PoC directory because they are
SUPPOSED to fail - `cmaj test transient/rack-dsp-poc` must stay green.

  M1  the dispatch ignores currentOrder and always uses declaration order
      -> fails "position changes the sound"
  M2  a disabled module is skipped instead of advanced silently
      -> fails "every module advanced exactly once per rack frame"
  M3  a new order is committed immediately with no transition
      -> fails both the rack test and the transition test

Run:  cmaj test --singleThread --sessionID=1 transient/rack-dsp-poc-mutations
Expect: 4 failures out of 6.
