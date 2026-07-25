Proof that ADR-001's "fixed resident processor shape advanced in a runtime-selected
serial order" is expressible in Cmajor 1.0.3066.

Everything here was compiled and run with the installed cmaj CLI. Nothing in this
directory is production code: the six modules the repository does not yet contain
are trivial stateful placeholders. Distortion and Chorus/Bloom are the real
production processors from cmajor/, reached through sources/*.cmajor symlinks.

Run everything:

    cmaj test --singleThread --sessionID=1 transient/rack-dsp-poc

Expect 9 passed, 0 failed.

Files
-----
EffectsRackShape.cmajor     The rack. Eight resident heterogeneous child nodes,
                            advanced exactly once per frame in a runtime order,
                            with the ADR-003 transition and ADR-005 hard bypass.
EffectsRackShape.cmajtest   The behavioural proof (see the assertions inline).
bench/                      A static-graph rack with the same eight modules, for
                            comparing cost and output against the dynamic one.
sources/                    Symlinked source set for the test's `## global` section.

smoke01  the core mechanism: heterogeneous resident children, runtime order,
         advance() inside a branch, non-commutative order observably changes output
smoke02  a graph can be a composed child; composition nests; value and event inputs
         can be driven from the parent; child state survives; oversampled children
         work but have a resampler settling transient
smoke03  an oversampled `* 4` child converges to the right DC answer whether it is
         advanced once or four times per parent frame
smoke04  hoisted endpoint syntax is REJECTED inside a processor (graph-only)
smoke05  a parent graph CAN wildcard-hoist a composing processor's own endpoints;
         a composed child's declared latency does not leak into its parent
smoke06  the alternative shape - one homogeneous node array of eight identical
         "any effect" slots indexed at runtime - also compiles and runs

Measured, not assumed
---------------------
- The dynamic rack in identity order renders BIT-IDENTICAL audio to the equivalent
  static Cmajor graph, at block sizes 1, 64 and 257.
- 120 s render at 44.1kHz, blockSize 256: static 3.83 s wall, dynamic 4.04 s wall
  (~0.3 s of that is compile/IO). Roughly 4% more DSP time for the runtime order.
- Both the LLVM and the C++ backends pass the proof suite; the javascript/wasm and
  cpp codegen targets both build.
- The generated C++ shows all eight children inline in the rack's state struct:
  no heap, no indirection, no dynamic allocation.

Mutation evidence lives in ../rack-dsp-poc-mutations.
