# Bounce in Place: Codespace setup

This is the reproducible Linux toolchain used for Bounce in Place. It keeps
all generated dependencies under the repository's ignored `build/` tree and
does not replace the macOS developer path.

## Verified environment

- Ubuntu 24.04, Linux x86_64
- Node 24.18.1 and npm 11.16.0
- CMake 3.28.3 and Ninja 1.11.1
- LLVM/Clang 18.1.3
- Cmajor 1.0.3066 at `172db53232337154d5a1c0f9a448318129dfacd9`
- Playwright Chromium revision 1217

Codespaces expose shared CPUs and no realtime audio device. Treat absolute
timings as informational; use paired relative measurements for performance
gates.

## System and Node dependencies

From the repository root:

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential cmake ninja-build pkg-config ripgrep \
  libgtk-3-dev libwebkit2gtk-4.1-dev \
  libasound2-dev libjack-jackd2-dev \
  clang-18 lld-18 wasi-libc \
  libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 \
  libclang-rt-18-dev-wasm32
npm ci
npx playwright install chromium
```

The renderer script understands both Homebrew's `wasm32-wasip1` sysroot
layout and Ubuntu's `wasm32-wasi` multiarch layout. No synthetic sysroot or
copied headers are needed.

## Pinned Cmajor CLI

CLI acquisition is separate from the repository's source-dependency build.
Before continuing, `cmaj version` must print `Cmajor Version: 1.0.3066`.

## External-aware code generator

The stock CLI cannot resolve Cosimo's external renderer import. Build the
repository generator against the same pinned runtime:

```bash
cmake -S tools/cmajor_external_codegen \
  -B build/cmajor_external_codegen-host -G Ninja \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build/cmajor_external_codegen-host \
  --target cosimo_cmajor_external_codegen -j 1
```

## Web product build

Ubuntu's WASI headers and libraries live under `/usr`, while Clang and the
C++ WASI headers live under `/usr/lib/llvm-18`:

```bash
COSIMO_CMAJOR_EXTERNAL_CODEGEN_BUILD_DIR="$PWD/build/cmajor_external_codegen-host" \
COSIMO_CMAJOR_BUILD_JOBS=1 \
COSIMO_RENDERER_LLVM_DIR=/usr/lib/llvm-18 \
COSIMO_RENDERER_WASI_C_DIR=/usr \
COSIMO_RENDERER_WASI_CXX_DIR=/usr/lib/llvm-18 \
npm run web:build
```

The complete browser artifact is written to `build/web`.

## M0 validation

```bash
npm run test:modulation:routing
npm run test:units:orphans
npm run test:web:bundle
node --test --test-isolation=none tests/test_web_poc_browser.mjs
node scripts/probe_bounce_offline_speed.mjs build/web/cmaj_Cosimo_Synth.js
```

On Linux, the browser harness uses Playwright's pinned headless Chromium.
Functional engine, UI, persistence, and audio-content checks run normally.
The three tests that qualify wall-clock realtime output are skipped because
headless Chromium has no realtime sink; set `COSIMO_WEB_REALTIME_AUDIO=1`
only on a Linux host with a real realtime audio output. macOS retains its
headed system-Chrome/CoreAudio path.

The committed M0 speed result is
`docs/reference/BOUNCE_M0_OFFLINE_SPEED.json`. Re-run it before and after a
material DSP change and compare the medians; do not compare unrelated
Codespace sessions as though they were controlled hardware.

## M8 native readiness probes

The platform-neutral driver/store tests need only the host C++17 compiler.
The generated integration uses the external-aware code generator above. The
QuickJS probe builds the pinned `CmajPerformer` shared library serially on
Linux, then drives the production patch from a background thread:

```bash
COSIMO_CMAJOR_EXTERNAL_CODEGEN_BUILD_DIR="$PWD/build/cmajor_external_codegen-host" \
COSIMO_CMAJOR_BUILD_JOBS=1 \
npm run test:bounce:native
```

The aggregate runs:

- the bounded sequential driver, cancellation/capacity, and lifecycle fence;
- streaming bank encoding, SHA-256, atomic publication, platform paths/policy,
  interprocess locking, and the `COSIMOB1` envelope;
- production generated C++ plus the real renderer and sampled bank path;
- three recursive roots through the real JIT patch and QuickJS worker.

On the small M8 VM, recompiling the header-heavy QuickJS probe and cold JIT
initialization can dominate wall time. Record those numbers but do not use them
as a Mac/iPhone rejection. The generated object size (135,615,616 bytes),
128-frame maximum, cancellation behavior, memory bounds, session fencing, and
functional output are architecture gates. Apple memory, deadline, lifecycle,
and Ableton gates are in `HUMAN_VALIDATION.md`.

The QuickJS runner also supports macOS after `npm run synth:desktop:build`; it
uses the bundled `libCmajPerformer.dylib` and Apple frameworks instead of the
Linux GTK/shared-library build.
