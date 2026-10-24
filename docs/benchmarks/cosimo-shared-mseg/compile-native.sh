#!/bin/zsh
set -eu
root=$PWD
base=$root/build/shared-mseg-proof
mode=$1
kind=$2
renderer=$base/before/renderer
[[ $mode == after ]] && renderer=$root/native/three_oscillator_renderer
cmajor=/Users/winterfell/.codex/worktrees/plugin-state-cmajor/cmajor
args=()
[[ $kind == aot ]] && args=(-DCOSIMO_BENCH_AOT=1 $base/$mode/native/AotFactory.cpp)
/usr/bin/c++ -std=c++17 -O2 -g0 -DCMAJOR_DLL=1 -I "$renderer" -I "$renderer/third_party/xsimd/include" -I "$base/$mode/native" -I "$cmajor/include" -I "$cmajor/include/choc" "$root/docs/benchmarks/cosimo-shared-mseg/native-host.cpp" "${args[@]}" "$renderer/RendererBridge.cpp" "$renderer/WarpRenderer.cpp" -framework Accelerate -framework AudioToolbox -framework Cocoa -framework CoreAudio -framework CoreMIDI -framework Foundation -framework IOKit -o "$base/$mode-$kind"
